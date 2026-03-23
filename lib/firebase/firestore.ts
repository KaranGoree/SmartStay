import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  type QueryConstraint,
  writeBatch,
  Timestamp,
} from "firebase/firestore"
import { db } from "./config"
import type { Application, Room, Settings, User, Category, DEFAULT_SEAT_DISTRIBUTION } from "@/lib/types"

// Users
export async function getUser(uid: string): Promise<User | null> {
  const docRef = doc(db, "users", uid)
  const docSnap = await getDoc(docRef)
  return docSnap.exists() ? (docSnap.data() as User) : null
}

// Applications
export async function createApplication(application: Omit<Application, "id" | "createdAt" | "updatedAt">): Promise<string> {
  const docRef = doc(collection(db, "applications"))
  await setDoc(docRef, {
    ...application,
    id: docRef.id,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return docRef.id
}

export async function getApplication(id: string): Promise<Application | null> {
  const docRef = doc(db, "applications", id)
  const docSnap = await getDoc(docRef)
  return docSnap.exists() ? (docSnap.data() as Application) : null
}

export async function getUserApplication(userId: string): Promise<Application | null> {
  const q = query(collection(db, "applications"), where("userId", "==", userId))
  const querySnapshot = await getDocs(q)
  if (querySnapshot.empty) return null
  return querySnapshot.docs[0].data() as Application
}

export async function updateApplication(id: string, data: Partial<Application>): Promise<void> {
  const docRef = doc(db, "applications", id)
  await updateDoc(docRef, {
    ...data,
    updatedAt: serverTimestamp(),
  })
}

export async function deleteApplication(id: string): Promise<void> {
  const docRef = doc(db, "applications", id)
  await deleteDoc(docRef)
}

export async function batchDeleteApplications(ids: string[]): Promise<void> {
  const batch = writeBatch(db)
  
  for (const id of ids) {
    const docRef = doc(db, "applications", id)
    batch.delete(docRef)
  }
  
  await batch.commit()
}

export async function getAllApplications(constraints: QueryConstraint[] = []): Promise<Application[]> {
  const q = query(collection(db, "applications"), ...constraints)
  const querySnapshot = await getDocs(q)
  return querySnapshot.docs.map((doc) => doc.data() as Application)
}

export async function getApplicationsByStatus(status: Application["status"]): Promise<Application[]> {
  return getAllApplications([where("status", "==", status), orderBy("createdAt", "desc")])
}

export async function getApplicationsByBranchYear(branch: string, year: number): Promise<Application[]> {
  return getAllApplications([
    where("branch", "==", branch),
    where("year", "==", year),
    where("status", "in", ["pending", "selected", "waitlisted", "confirmed"]),
  ])
}

// Rooms
export async function initializeRooms(): Promise<void> {
  const batch = writeBatch(db)
  
  for (let floor = 1; floor <= 6; floor++) {
    for (let room = 1; room <= 16; room++) {
      const roomNumber = `${floor}${room.toString().padStart(2, "0")}`
      const docRef = doc(db, "rooms", roomNumber)
      batch.set(docRef, {
        roomNumber,
        floor,
        capacity: 2,
        occupants: [],
        status: "available",
      })
    }
  }
  
  await batch.commit()
}

export async function getRoom(roomNumber: string): Promise<Room | null> {
  const docRef = doc(db, "rooms", roomNumber)
  const docSnap = await getDoc(docRef)
  return docSnap.exists() ? (docSnap.data() as Room) : null
}

export async function getAllRooms(): Promise<Room[]> {
  const q = query(collection(db, "rooms"), orderBy("roomNumber"))
  const querySnapshot = await getDocs(q)
  return querySnapshot.docs.map((doc) => doc.data() as Room)
}

export async function assignRoom(roomNumber: string, applicationId: string): Promise<boolean> {
  const room = await getRoom(roomNumber)
  if (!room || room.occupants.length >= room.capacity) return false
  
  const newOccupants = [...room.occupants, applicationId]
  await updateDoc(doc(db, "rooms", roomNumber), {
    occupants: newOccupants,
    status: newOccupants.length >= room.capacity ? "full" : "partial",
  })
  
  return true
}

export async function removeFromRoom(roomNumber: string, applicationId: string): Promise<void> {
  const room = await getRoom(roomNumber)
  if (!room) return
  
  const newOccupants = room.occupants.filter((id) => id !== applicationId)
  await updateDoc(doc(db, "rooms", roomNumber), {
    occupants: newOccupants,
    status: newOccupants.length === 0 ? "available" : "partial",
  })
}

// Settings
export async function getSettings(): Promise<Settings | null> {
  const docRef = doc(db, "settings", "global")
  const docSnap = await getDoc(docRef)
  return docSnap.exists() ? (docSnap.data() as Settings) : null
}

export async function updateSettings(data: Partial<Settings>): Promise<void> {
  const docRef = doc(db, "settings", "global")
  await setDoc(docRef, data, { merge: true })
}

export async function initializeSettings(seatDistribution: typeof DEFAULT_SEAT_DISTRIBUTION): Promise<void> {
  const deadline = new Date()
  deadline.setDate(deadline.getDate() + 30) // 30 days from now
  
  await setDoc(doc(db, "settings", "global"), {
    applicationDeadline: Timestamp.fromDate(deadline),
    confirmationPeriodDays: 3,
    seatDistribution,
    seatsPerBranchYear: 10,
  })
}

// Batch operations for allocation
export async function batchUpdateApplications(
  updates: { id: string; data: Partial<Application> }[]
): Promise<void> {
  const batch = writeBatch(db)
  
  for (const { id, data } of updates) {
    const docRef = doc(db, "applications", id)
    batch.update(docRef, { ...data, updatedAt: serverTimestamp() })
  }
  
  await batch.commit()
}
// Add this function to your firestore.ts file
export async function removeFromRoomByApplicationId(applicationId: string): Promise<void> {
  // Find which room the application is in
  const application = await getApplication(applicationId)
  if (!application || !application.roomNumber) return
  
  // Remove from room
  await removeFromRoom(application.roomNumber, applicationId)
}