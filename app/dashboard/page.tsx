"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/components/auth/auth-provider"
import { getUserApplication } from "@/lib/firebase/firestore"
import type { Application } from "@/lib/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import Link from "next/link"
import {
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  BedDouble,
  ArrowRight,
} from "lucide-react"

const statusConfig: Record<Application["status"], { label: string; color: string; icon: React.ElementType }> = {
  draft: { label: "Draft", color: "bg-muted text-muted-foreground", icon: FileText },
  pending: { label: "Pending Review", color: "bg-amber-100 text-amber-800", icon: Clock },
  selected: { label: "Selected", color: "bg-emerald-100 text-emerald-800", icon: CheckCircle },
  waitlisted: { label: "Waitlisted", color: "bg-blue-100 text-blue-800", icon: Clock },
  confirmed: { label: "Confirmed", color: "bg-emerald-100 text-emerald-800", icon: CheckCircle },
  expired: { label: "Expired", color: "bg-red-100 text-red-800", icon: XCircle },
  rejected: { label: "Rejected", color: "bg-red-100 text-red-800", icon: XCircle },
}

export default function StudentDashboard() {
  const { user, userData } = useAuth()
  const [application, setApplication] = useState<Application | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchApplication() {
      if (user?.uid) {
        const app = await getUserApplication(user.uid)
        setApplication(app)
      }
      setLoading(false)
    }
    fetchApplication()
  }, [user?.uid])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  const status = application?.status || "draft"
  const config = statusConfig[status] || statusConfig.draft
  const StatusIcon = config.icon

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Welcome, {userData?.email?.split("@")[0]}</h1>
        <p className="text-muted-foreground">Manage your hostel admission application</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Application Status Card */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Application Status
            </CardTitle>
            <CardDescription>
              {application ? "Your current application status" : "Start your hostel application"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {application ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Badge className={config.color}>
                    <StatusIcon className="h-3 w-3 mr-1" />
                    {config.label}
                  </Badge>
                  {application.meritRank && (
                    <span className="text-sm text-muted-foreground">
                      Merit Rank: #{application.meritRank}
                    </span>
                  )}
                </div>
                
                <div className="grid gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Name:</span>
                    <span className="font-medium">{application.fullName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Branch:</span>
                    <span className="font-medium">{application.branch}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Year:</span>
                    <span className="font-medium">{application.year}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Category:</span>
                    <span className="font-medium">{application.category}</span>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  {(status === "draft" || status === "pending") && (
                    <Button asChild>
                      <Link href="/dashboard/application">
                        {status === "draft" ? "Complete Application" : "Edit Application"}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  )}
                  <Button variant="outline" asChild>
                    <Link href="/dashboard/status">View Details</Link>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-6">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">
                  You haven&apos;t started your application yet.
                </p>
                <Button asChild>
                  <Link href="/dashboard/application">
                    Start Application
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Room Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BedDouble className="h-5 w-5" />
              Room Allocation
            </CardTitle>
          </CardHeader>
          <CardContent>
            {application?.roomNumber ? (
              <div className="space-y-3">
                <div className="text-center">
                  <p className="text-4xl font-bold text-primary">{application.roomNumber}</p>
                  <p className="text-sm text-muted-foreground">Room Number</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-medium">Floor {application.floor}</p>
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <BedDouble className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  {application?.status === "confirmed"
                    ? "Room will be assigned soon"
                    : "Available after confirmation"}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Important Notices */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Important Notices
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <span className="text-primary">1.</span>
              <span>Ensure all uploaded documents are clear and readable for OCR verification.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">2.</span>
              <span>You can edit your application until the deadline. Changes after selection are not allowed.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">3.</span>
              <span>If selected, confirm your seat within the specified deadline to secure your room.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">4.</span>
              <span>Contact the hostel office for any queries regarding your application.</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
