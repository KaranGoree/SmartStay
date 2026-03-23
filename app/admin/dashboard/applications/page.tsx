"use client"

import { useEffect, useState } from "react"
import { getAllApplications } from "@/lib/firebase/firestore"
import type { Application } from "@/lib/types"
import { ApplicationsTable } from "@/components/admin/applications-table"
import { Spinner } from "@/components/ui/spinner"

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)

  const fetchApplications = async () => {
    setLoading(true)
    const apps = await getAllApplications()
    setApplications(apps)
    setLoading(false)
  }

  useEffect(() => {
    fetchApplications()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Applications</h1>
        <p className="text-muted-foreground">
          Review and manage hostel applications
        </p>
      </div>
      <ApplicationsTable applications={applications} onUpdate={fetchApplications} />
    </div>
  )
}
