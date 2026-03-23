"use client"

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User as FirebaseUser,
} from "firebase/auth"
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore"
import { auth, db } from "@/lib/firebase/config"
import type { User, UserRole } from "@/lib/types"

interface AuthContextType {
  user: FirebaseUser | null
  userData: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, role?: UserRole) => Promise<void>
  signOut: () => Promise<void>
  isAdmin: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

const ADMIN_EMAIL = "gcoenhostel@gmail.com"

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null)
  const [userData, setUserData] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!auth) return

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser)

      if (firebaseUser) {
        const userDoc = await getDoc(doc(db, "users", firebaseUser.uid))

        let data: User | null = null

        if (userDoc.exists()) {
          data = userDoc.data() as User
        }

        // ✅ FORCE ADMIN ROLE
        if (firebaseUser.email === ADMIN_EMAIL) {
          setUserData({
            uid: firebaseUser.uid,
            email: firebaseUser.email!,
            role: "admin",
            createdAt: data?.createdAt || serverTimestamp(),
          } as User)
        } else {
          if (data) {
            setUserData(data)
          }
        }
      } else {
        setUserData(null)
      }

      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    if (!auth) throw new Error("Auth not initialized")

    const result = await signInWithEmailAndPassword(auth, email, password)

    const userDoc = await getDoc(doc(db, "users", result.user.uid))

    let data: User | null = null

    if (userDoc.exists()) {
      data = userDoc.data() as User
    }

    // ✅ FORCE ADMIN ROLE
    if (email === ADMIN_EMAIL) {
      setUserData({
        uid: result.user.uid,
        email: result.user.email!,
        role: "admin",
        createdAt: data?.createdAt || serverTimestamp(),
      } as User)
    } else {
      if (data) {
        setUserData(data)
      }
    }
  }

  const signUp = async (
    email: string,
    password: string,
    role: UserRole = "student"
  ) => {
    if (!auth) throw new Error("Auth not initialized")

    const result = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    )

    const newUser: Omit<User, "createdAt"> & {
      createdAt: ReturnType<typeof serverTimestamp>
    } = {
      uid: result.user.uid,
      email: result.user.email!,
      role,
      createdAt: serverTimestamp(),
    }

    await setDoc(doc(db, "users", result.user.uid), newUser)

    setUserData(newUser as unknown as User)
  }

  const signOut = async () => {
    if (!auth) return

    await firebaseSignOut(auth)
    setUserData(null)
    setUser(null)
  }

  const isAdmin = userData?.role === "admin"

  return (
    <AuthContext.Provider
      value={{
        user,
        userData,
        loading,
        signIn,
        signUp,
        signOut,
        isAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}