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
import type { Application, Room, Settings, User, Category } from "@/lib/types"

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
  try {
    const batch = writeBatch(db)
    
    // Delete all existing rooms
    const allRooms = await getAllRooms()
    for (const room of allRooms) {
      const docRef = doc(db, "rooms", room.id || `${room.hostel || "boys"}_${room.roomNumber}`)
      batch.delete(docRef)
    }
    
    // Initialize boys hostel rooms (5 floors, 16 rooms each, capacity 2)
    let roomCount = 0
    for (let floor = 1; floor <= 5; floor++) {
      for (let roomNum = 1; roomNum <= 16; roomNum++) {
        const roomNumber = `${floor}${roomNum.toString().padStart(2, "0")}`
        const docRef = doc(db, "rooms", `boys_${roomNumber}`)
        batch.set(docRef, {
          id: `boys_${roomNumber}`,
          roomNumber: roomNumber,
          floor: floor,
          capacity: 2,
          occupants: [],
          hostel: "boys",
          status: "available",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
        roomCount++
      }
    }
    
    // Initialize girls hostel rooms (3 floors, 12 rooms each, capacity 2)
    for (let floor = 1; floor <= 3; floor++) {
      for (let roomNum = 1; roomNum <= 12; roomNum++) {
        const roomNumber = `${floor}${roomNum.toString().padStart(2, "0")}`
        const docRef = doc(db, "rooms", `girls_${roomNumber}`)
        batch.set(docRef, {
          id: `girls_${roomNumber}`,
          roomNumber: roomNumber,
          floor: floor,
          capacity: 2,
          occupants: [],
          hostel: "girls",
          status: "available",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
        roomCount++
      }
    }
    
    await batch.commit()
    console.log(`Initialized ${roomCount} rooms (Boys: 80, Girls: 36)`)
  } catch (error) {
    console.error("Error initializing rooms:", error)
    throw error
  }
}

// Initialize rooms for a specific hostel
export async function initializeRoomsByHostel(
  hostelType: "boys" | "girls",
  hostelConfig: {
    floors: number
    roomsPerFloor: number
    capacityPerRoom: number
    name: string
  }
): Promise<number> {
  try {
    const batch = writeBatch(db)
    let roomCount = 0
    
    // First, delete existing rooms for this hostel
    const existingRoomsQuery = query(collection(db, "rooms"), where("hostel", "==", hostelType))
    const existingRooms = await getDocs(existingRoomsQuery)
    
    for (const doc of existingRooms.docs) {
      batch.delete(doc.ref)
    }
    
    // Create new rooms
    for (let floor = 1; floor <= hostelConfig.floors; floor++) {
      for (let roomNum = 1; roomNum <= hostelConfig.roomsPerFloor; roomNum++) {
        const roomNumber = `${floor}${roomNum.toString().padStart(2, "0")}`
        const docRef = doc(db, "rooms", `${hostelType}_${roomNumber}`)
        
        batch.set(docRef, {
          id: `${hostelType}_${roomNumber}`,
          roomNumber: roomNumber,
          floor: floor,
          capacity: hostelConfig.capacityPerRoom,
          occupants: [],
          hostel: hostelType,
          status: "available",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
        roomCount++
      }
    }
    
    await batch.commit()
    console.log(`Initialized ${roomCount} rooms for ${hostelType} hostel`)
    return roomCount
  } catch (error) {
    console.error("Error initializing rooms:", error)
    throw error
  }
}

export async function getRoom(roomId: string): Promise<Room | null> {
  const docRef = doc(db, "rooms", roomId)
  const docSnap = await getDoc(docRef)
  return docSnap.exists() ? (docSnap.data() as Room) : null
}

export async function getAllRooms(): Promise<Room[]> {
  const q = query(collection(db, "rooms"), orderBy("roomNumber"))
  const querySnapshot = await getDocs(q)
  return querySnapshot.docs.map((doc) => doc.data() as Room)
}

export async function getRoomsByHostel(hostelType: "boys" | "girls"): Promise<Room[]> {
  try {
    const q = query(
      collection(db, "rooms"), 
      where("hostel", "==", hostelType),
      orderBy("roomNumber")
    )
    const querySnapshot = await getDocs(q)
    return querySnapshot.docs.map((doc) => doc.data() as Room)
  } catch (error) {
    console.error("Error getting rooms by hostel:", error)
    throw error
  }
}

export async function getHostelStats(hostelType: "boys" | "girls"): Promise<{
  totalRooms: number
  availableRooms: number
  occupiedRooms: number
  totalOccupants: number
  totalCapacity: number
  occupancyRate: number
}> {
  try {
    const q = query(collection(db, "rooms"), where("hostel", "==", hostelType))
    const querySnapshot = await getDocs(q)
    
    const rooms = querySnapshot.docs.map((doc) => doc.data() as Room)
    const totalRooms = rooms.length
    const availableRooms = rooms.filter(room => room.status === "available").length
    const occupiedRooms = rooms.filter(room => room.status === "full" || room.status === "partial").length
    const totalOccupants = rooms.reduce((sum, room) => sum + (room.occupants?.length || 0), 0)
    const totalCapacity = rooms.reduce((sum, room) => sum + (room.capacity || 0), 0)
    const occupancyRate = totalCapacity > 0 ? (totalOccupants / totalCapacity) * 100 : 0
    
    return {
      totalRooms,
      availableRooms,
      occupiedRooms,
      totalOccupants,
      totalCapacity,
      occupancyRate
    }
  } catch (error) {
    console.error("Error getting hostel stats:", error)
    throw error
  }
}

export async function assignRoom(roomId: string, applicationId: string): Promise<boolean> {
  const room = await getRoom(roomId)
  if (!room || room.occupants.length >= room.capacity) return false
  
  const newOccupants = [...room.occupants, applicationId]
  await updateDoc(doc(db, "rooms", roomId), {
    occupants: newOccupants,
    status: newOccupants.length >= room.capacity ? "full" : "partial",
    updatedAt: serverTimestamp(),
  })
  
  return true
}

export async function removeFromRoom(roomId: string, applicationId: string): Promise<void> {
  const room = await getRoom(roomId)
  if (!room) return
  
  const newOccupants = room.occupants.filter((id) => id !== applicationId)
  await updateDoc(doc(db, "rooms", roomId), {
    occupants: newOccupants,
    status: newOccupants.length === 0 ? "available" : "partial",
    updatedAt: serverTimestamp(),
  })
}

export async function removeFromRoomByApplicationId(applicationId: string): Promise<void> {
  // Find which room the application is in
  const application = await getApplication(applicationId)
  if (!application || !application.roomNumber) return
  
  // Find the room with this room number
  const roomsQuery = query(collection(db, "rooms"), where("roomNumber", "==", application.roomNumber))
  const roomsSnapshot = await getDocs(roomsQuery)
  
  for (const roomDoc of roomsSnapshot.docs) {
    const room = roomDoc.data() as Room
    if (room.occupants.includes(applicationId)) {
      await removeFromRoom(roomDoc.id, applicationId)
      break
    }
  }
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

export async function initializeSettings(seatDistribution: Record<Category, number>): Promise<void> {
  const deadline = new Date()
  deadline.setDate(deadline.getDate() + 30) // 30 days from now
  
  await setDoc(doc(db, "settings", "global"), {
    applicationDeadline: Timestamp.fromDate(deadline),
    confirmationPeriodDays: 3,
    seatDistribution,
    seatsPerBranchYear: 10,
    hostels: {
      boys: {
        name: "Boys Hostel",
        type: "boys",
        totalCapacity: 160,
        seatDistribution: seatDistribution,
        seatsPerBranchYear: 10,
        floors: 5,
        roomsPerFloor: 16,
        capacityPerRoom: 2,
      },
      girls: {
        name: "Girls Hostel",
        type: "girls",
        totalCapacity: 72,
        seatDistribution: seatDistribution,
        seatsPerBranchYear: 10,
        floors: 3,
        roomsPerFloor: 12,
        capacityPerRoom: 2,
      },
    },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
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