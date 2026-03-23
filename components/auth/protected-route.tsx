"use client"

import { useAuth } from "@/components/auth/auth-provider"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { Spinner } from "@/components/ui/spinner"

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRole?: "student" | "admin"
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, userData, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return

    // ❌ Not logged in
    if (!user) {
      router.push("/login")
      return
    }

    // ❗ WAIT until userData is available
    if (!userData) return

    // ❌ Role mismatch
    if (requiredRole && userData.role !== requiredRole) {
      if (userData.role === "admin") {
        router.push("/admin/dashboard")
      } else {
        router.push("/dashboard")
      }
    }
  }, [user, userData, loading, requiredRole, router])

  // ⏳ Loading state
  if (loading || (user && !userData)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Spinner className="h-8 w-8" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  // 🚫 Not logged in
  if (!user) return null

  // 🚫 Role mismatch
  if (requiredRole && userData?.role !== requiredRole) {
    return null
  }

  // ✅ Authorized
  return <>{children}</>
}