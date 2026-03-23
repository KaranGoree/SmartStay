"use client"

import { AdminRegisterForm } from "@/components/auth/AdminRegisterForm"

export default function AdminRegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md p-4">
        <AdminRegisterForm />
      </div>
    </div>
  )
}