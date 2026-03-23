"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/components/auth/auth-provider"
import { getUserApplication, updateApplication } from "@/lib/firebase/firestore"
import type { Application } from "@/lib/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import Link from "next/link"
import {
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  BedDouble,
  Edit,
  Check,
} from "lucide-react"
import { getValidationColor, getOverallValidationStatus } from "@/lib/utils/validation"

const statusConfig: Record<Application["status"], { label: string; color: string; icon: React.ElementType; description: string }> = {
  draft: {
    label: "Draft",
    color: "bg-muted text-muted-foreground",
    icon: FileText,
    description: "Your application is saved as a draft. Complete and submit to proceed.",
  },
  pending: {
    label: "Pending Review",
    color: "bg-amber-100 text-amber-800",
    icon: Clock,
    description: "Your application is under review by the hostel administration.",
  },
  selected: {
    label: "Selected",
    color: "bg-emerald-100 text-emerald-800",
    icon: CheckCircle,
    description: "Congratulations! You have been selected. Please confirm your seat.",
  },
  waitlisted: {
    label: "Waitlisted",
    color: "bg-blue-100 text-blue-800",
    icon: Clock,
    description: "You are on the waitlist. You will be notified if a seat becomes available.",
  },
  confirmed: {
    label: "Confirmed",
    color: "bg-emerald-100 text-emerald-800",
    icon: CheckCircle,
    description: "Your hostel seat is confirmed. Room details are shown below.",
  },
  expired: {
    label: "Expired",
    color: "bg-red-100 text-red-800",
    icon: XCircle,
    description: "Your selection has expired due to non-confirmation within the deadline.",
  },
  rejected: {
    label: "Rejected",
    color: "bg-red-100 text-red-800",
    icon: XCircle,
    description: "Your application was not approved. Contact the hostel office for details.",
  },
}

export default function StatusPage() {
  const { user } = useAuth()
  const [application, setApplication] = useState<Application | null>(null)
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState(false)

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

  const handleConfirmSeat = async () => {
    if (!application) return
    
    setConfirming(true)
    try {
      await updateApplication(application.id, { status: "confirmed" })
      setApplication({ ...application, status: "confirmed" })
      toast.success("Seat confirmed successfully!")
    } catch (error) {
      toast.error("Failed to confirm seat")
    } finally {
      setConfirming(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  if (!application) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Application Status</h1>
          <p className="text-muted-foreground">Track your hostel application</p>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Application Found</h3>
            <p className="text-muted-foreground mb-4">
              You haven&apos;t submitted a hostel application yet.
            </p>
            <Button asChild>
              <Link href="/dashboard/application">Start Application</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const status = application.status
  const config = statusConfig[status]
  const StatusIcon = config.icon
  const validationStatus = getOverallValidationStatus(application.validation)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Application Status</h1>
        <p className="text-muted-foreground">Track your hostel application</p>
      </div>

      {/* Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-full ${config.color}`}>
                <StatusIcon className="h-6 w-6" />
              </div>
              <div>
                <CardTitle>{config.label}</CardTitle>
                <CardDescription>{config.description}</CardDescription>
              </div>
            </div>
            <Badge className={config.color}>{config.label}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {status === "selected" && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-emerald-800">Action Required</p>
                  <p className="text-sm text-emerald-700">
                    Confirm your seat before{" "}
                    {application.confirmationDeadline
                      ? new Date(application.confirmationDeadline.toDate()).toLocaleDateString()
                      : "the deadline"}
                  </p>
                </div>
                <Button onClick={handleConfirmSeat} disabled={confirming}>
                  {confirming ? <Spinner className="h-4 w-4 mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                  Confirm Seat
                </Button>
              </div>
            </div>
          )}

          {(status === "draft" || status === "pending") && (
            <div className="flex justify-end">
              <Button variant="outline" asChild>
                <Link href="/dashboard/application">
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Application
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Application Details */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Personal Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Full Name</dt>
                <dd className="font-medium">{application.fullName}</dd>
              </div>
              <Separator />
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Email</dt>
                <dd className="font-medium">{application.email}</dd>
              </div>
              <Separator />
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Phone</dt>
                <dd className="font-medium">{application.phone}</dd>
              </div>
              <Separator />
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Aadhaar</dt>
                <dd className="font-medium">
                  {application.aadhaarNumber.replace(/(\d{4})(\d{4})(\d{4})/, "$1 $2 $3")}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Academic Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Branch</dt>
                <dd className="font-medium">{application.branch}</dd>
              </div>
              <Separator />
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Year</dt>
                <dd className="font-medium">{application.year}</dd>
              </div>
              <Separator />
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Category</dt>
                <dd className="font-medium">{application.category}</dd>
              </div>
              <Separator />
              <div className="flex justify-between">
                <dt className="text-muted-foreground">
                  {application.admissionType === "CET" ? "CET Marks" : "SGPA"}
                </dt>
                <dd className="font-medium">
                  {application.admissionType === "CET" ? application.cetMarks : application.sgpa}
                </dd>
              </div>
              {application.meritRank && (
                <>
                  <Separator />
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Merit Rank</dt>
                    <dd className="font-medium text-primary">#{application.meritRank}</dd>
                  </div>
                </>
              )}
            </dl>
          </CardContent>
        </Card>

        {/* Validation Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              Document Verification
              <Badge variant="outline" className={getValidationColor(validationStatus)}>
                {validationStatus === "verified" && "All Verified"}
                {validationStatus === "warning" && "Review Needed"}
                {validationStatus === "error" && "Issues Found"}
                {validationStatus === "pending" && "Pending"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3 text-sm">
              {Object.entries(application.validation).map(([key, value]) => (
                <div key={key} className="flex justify-between items-center">
                  <dt className="text-muted-foreground capitalize">
                    {key.replace("Match", "")} Verification
                  </dt>
                  <dd className="flex items-center gap-1">
                    {value === "verified" && <CheckCircle className="h-4 w-4 text-emerald-600" />}
                    {value === "warning" && <AlertTriangle className="h-4 w-4 text-amber-500" />}
                    {value === "error" && <XCircle className="h-4 w-4 text-red-500" />}
                    {value === "pending" && <Clock className="h-4 w-4 text-muted-foreground" />}
                    <span className={getValidationColor(value)}>{value}</span>
                  </dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        {/* Room Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BedDouble className="h-5 w-5" />
              Room Allocation
            </CardTitle>
          </CardHeader>
          <CardContent>
            {application.roomNumber ? (
              <div className="text-center py-4">
                <p className="text-5xl font-bold text-primary mb-2">{application.roomNumber}</p>
                <p className="text-muted-foreground">Room Number</p>
                <Separator className="my-4" />
                <p className="text-lg">Floor {application.floor}</p>
              </div>
            ) : (
              <div className="text-center py-8">
                <BedDouble className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">
                  {status === "confirmed"
                    ? "Room will be assigned soon"
                    : "Available after confirmation"}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
