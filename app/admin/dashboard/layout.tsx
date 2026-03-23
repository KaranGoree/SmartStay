"use client"

import { Sidebar } from "@/components/shared/sidebar"
import { ProtectedRoute } from "@/components/auth/protected-route"

export default function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ProtectedRoute requiredRole="admin">
      <div className="min-h-screen bg-muted/30">
        <Sidebar type="admin" />
        <main className="pl-16 md:pl-64 transition-all duration-300">
          <div className="container mx-auto p-6">
            {children}
          </div>
        </main>
      </div>
    </ProtectedRoute>
  )
}
