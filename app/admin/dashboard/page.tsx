"use client"

import { useEffect, useState } from "react"
import { getAllApplications, getAllRooms } from "@/lib/firebase/firestore"
import type { Application, Room } from "@/lib/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  FileText,
  Users,
  BedDouble,
  CheckCircle,
  Clock,
  XCircle,
  ArrowRight,
  TrendingUp,
} from "lucide-react"

export default function AdminDashboard() {
  const [applications, setApplications] = useState<Application[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      const [apps, roomData] = await Promise.all([
        getAllApplications(),
        getAllRooms(),
      ])
      setApplications(apps)
      setRooms(roomData)
      setLoading(false)
    }
    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  const stats = {
    total: applications.length,
    pending: applications.filter((a) => a.status === "pending").length,
    selected: applications.filter((a) => a.status === "selected").length,
    confirmed: applications.filter((a) => a.status === "confirmed").length,
    waitlisted: applications.filter((a) => a.status === "waitlisted").length,
    rejected: applications.filter((a) => a.status === "rejected").length,
    availableRooms: rooms.filter((r) => r.status === "available").length,
    totalRooms: rooms.length,
  }

  const recentApplications = [...applications]
    .sort((a, b) => {
      const dateA = a.createdAt?.toMillis?.() || 0
      const dateB = b.createdAt?.toMillis?.() || 0
      return dateB - dateA
    })
    .slice(0, 5)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground">Manage hostel applications and allocations</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Applications</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">
              {stats.pending} pending review
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending}</div>
            <p className="text-xs text-muted-foreground">
              Awaiting admin action
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Confirmed</CardTitle>
            <CheckCircle className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.confirmed}</div>
            <p className="text-xs text-muted-foreground">
              Seats confirmed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Room Availability</CardTitle>
            <BedDouble className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.availableRooms}/{stats.totalRooms || "N/A"}
            </div>
            <p className="text-xs text-muted-foreground">
              Rooms available
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions & Recent Applications */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common administrative tasks</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Button variant="outline" className="justify-between" asChild>
              <Link href="/admin/dashboard/applications">
                <span className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Review Applications
                </span>
                <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full text-xs">
                  {stats.pending}
                </span>
              </Link>
            </Button>
            <Button variant="outline" className="justify-between" asChild>
              <Link href="/admin/dashboard/allocation">
                <span className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Run Seat Allocation
                </span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" className="justify-between" asChild>
              <Link href="/admin/dashboard/rooms">
                <span className="flex items-center gap-2">
                  <BedDouble className="h-4 w-4" />
                  Manage Rooms
                </span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Recent Applications */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Applications</CardTitle>
            <CardDescription>Latest submitted applications</CardDescription>
          </CardHeader>
          <CardContent>
            {recentApplications.length > 0 ? (
              <div className="space-y-3">
                {recentApplications.map((app) => (
                  <div
                    key={app.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div>
                      <p className="font-medium text-sm">{app.fullName}</p>
                      <p className="text-xs text-muted-foreground">
                        {app.branch} - Year {app.year}
                      </p>
                    </div>
                    <StatusBadge status={app.status} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No applications yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Status Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Application Status Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-5">
            <StatusCard label="Pending" count={stats.pending} color="bg-amber-500" />
            <StatusCard label="Selected" count={stats.selected} color="bg-blue-500" />
            <StatusCard label="Waitlisted" count={stats.waitlisted} color="bg-indigo-500" />
            <StatusCard label="Confirmed" count={stats.confirmed} color="bg-emerald-500" />
            <StatusCard label="Rejected" count={stats.rejected} color="bg-red-500" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function StatusBadge({ status }: { status: Application["status"] }) {
  const config: Record<string, { bg: string; text: string }> = {
    pending: { bg: "bg-amber-100", text: "text-amber-800" },
    selected: { bg: "bg-blue-100", text: "text-blue-800" },
    waitlisted: { bg: "bg-indigo-100", text: "text-indigo-800" },
    confirmed: { bg: "bg-emerald-100", text: "text-emerald-800" },
    rejected: { bg: "bg-red-100", text: "text-red-800" },
    draft: { bg: "bg-muted", text: "text-muted-foreground" },
    expired: { bg: "bg-red-100", text: "text-red-800" },
  }
  const c = config[status] || config.draft
  
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
      {status}
    </span>
  )
}

function StatusCard({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="text-center">
      <div className={`w-3 h-3 rounded-full ${color} mx-auto mb-2`} />
      <p className="text-2xl font-bold">{count}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}
