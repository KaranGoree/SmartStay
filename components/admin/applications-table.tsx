"use client"

import { useState } from "react"
import type { Application, Branch, Category, ApplicationStatus } from "@/lib/types"
import { updateApplication } from "@/lib/firebase/firestore"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import {
  Search,
  Eye,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
} from "lucide-react"
import { getValidationColor } from "@/lib/utils/validation"
import { BRANCHES, CATEGORIES } from "@/lib/types"

interface ApplicationsTableProps {
  applications: Application[]
  onUpdate: () => void
}

const statusConfig: Record<ApplicationStatus, { label: string; color: string }> = {
  draft: { label: "Draft", color: "bg-muted text-muted-foreground" },
  pending: { label: "Pending", color: "bg-amber-100 text-amber-800" },
  selected: { label: "Selected", color: "bg-blue-100 text-blue-800" },
  waitlisted: { label: "Waitlisted", color: "bg-indigo-100 text-indigo-800" },
  confirmed: { label: "Confirmed", color: "bg-emerald-100 text-emerald-800" },
  expired: { label: "Expired", color: "bg-red-100 text-red-800" },
  rejected: { label: "Rejected", color: "bg-red-100 text-red-800" },
}

export function ApplicationsTable({ applications, onUpdate }: ApplicationsTableProps) {
  const [search, setSearch] = useState("")
  const [branchFilter, setBranchFilter] = useState<string>("all")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [selectedApp, setSelectedApp] = useState<Application | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)

  const filteredApps = applications.filter((app) => {
    const matchesSearch =
      app.fullName.toLowerCase().includes(search.toLowerCase()) ||
      app.email.toLowerCase().includes(search.toLowerCase())
    const matchesBranch = branchFilter === "all" || app.branch === branchFilter
    const matchesCategory = categoryFilter === "all" || app.category === categoryFilter
    const matchesStatus = statusFilter === "all" || app.status === statusFilter
    return matchesSearch && matchesBranch && matchesCategory && matchesStatus
  })

  const handleStatusUpdate = async (id: string, status: ApplicationStatus) => {
    setIsUpdating(true)
    try {
      await updateApplication(id, { status })
      toast.success(`Application ${status}`)
      onUpdate()
      setSelectedApp(null)
    } catch (error) {
      toast.error("Failed to update application")
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={branchFilter} onValueChange={setBranchFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Branch" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Branches</SelectItem>
            {BRANCHES.map((b) => (
              <SelectItem key={b} value={b}>{b}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="selected">Selected</SelectItem>
            <SelectItem value="waitlisted">Waitlisted</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead>Year</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Marks/SGPA</TableHead>
              <TableHead>Validation</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredApps.length > 0 ? (
              filteredApps.map((app) => (
                <TableRow key={app.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{app.fullName}</p>
                      <p className="text-xs text-muted-foreground">{app.email}</p>
                    </div>
                  </TableCell>
                  <TableCell>{app.branch}</TableCell>
                  <TableCell>{app.year}</TableCell>
                  <TableCell>{app.category}</TableCell>
                  <TableCell>
                    {app.admissionType === "CET" ? app.cetMarks : app.sgpa}
                  </TableCell>
                  <TableCell>
                    <ValidationIndicator validation={app.validation} />
                  </TableCell>
                  <TableCell>
                    <Badge className={statusConfig[app.status].color}>
                      {statusConfig[app.status].label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedApp(app)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  No applications found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-sm text-muted-foreground">
        Showing {filteredApps.length} of {applications.length} applications
      </p>

      {/* Detail Dialog */}
      <Dialog open={!!selectedApp} onOpenChange={() => setSelectedApp(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedApp && (
            <>
              <DialogHeader>
                <DialogTitle>Application Details</DialogTitle>
                <DialogDescription>
                  Review and manage this application
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6">
                {/* Comparison Table */}
                <div>
                  <h4 className="font-medium mb-3">Data Verification</h4>
                  <div className="rounded-lg border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Field</TableHead>
                          <TableHead>User Input</TableHead>
                          <TableHead>OCR Extracted</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell className="font-medium">Name</TableCell>
                          <TableCell>{selectedApp.fullName}</TableCell>
                          <TableCell>{selectedApp.ocrData.extractedName || "-"}</TableCell>
                          <TableCell>
                            <ValidationBadge status={selectedApp.validation.nameMatch} />
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium">Marks/SGPA</TableCell>
                          <TableCell>
                            {selectedApp.admissionType === "CET"
                              ? selectedApp.cetMarks
                              : selectedApp.sgpa}
                          </TableCell>
                          <TableCell>{selectedApp.ocrData.extractedMarks ?? "-"}</TableCell>
                          <TableCell>
                            <ValidationBadge status={selectedApp.validation.marksMatch} />
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium">Aadhaar</TableCell>
                          <TableCell>{selectedApp.aadhaarNumber}</TableCell>
                          <TableCell>{selectedApp.ocrData.extractedAadhaar || "-"}</TableCell>
                          <TableCell>
                            <ValidationBadge status={selectedApp.validation.aadhaarMatch} />
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium">Category</TableCell>
                          <TableCell>{selectedApp.category}</TableCell>
                          <TableCell>{selectedApp.ocrData.extractedCategory || "-"}</TableCell>
                          <TableCell>
                            <ValidationBadge status={selectedApp.validation.categoryMatch} />
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <Separator />

                {/* Documents */}
                <div>
                  <h4 className="font-medium mb-3">Uploaded Documents</h4>
                  <div className="grid gap-3 grid-cols-3">
                    {selectedApp.documents.marksheet && (
                      <div className="aspect-[4/3] rounded-lg overflow-hidden bg-muted">
                        <img
                          src={selectedApp.documents.marksheet}
                          alt="Marksheet"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    {selectedApp.documents.aadhaarCard && (
                      <div className="aspect-[4/3] rounded-lg overflow-hidden bg-muted">
                        <img
                          src={selectedApp.documents.aadhaarCard}
                          alt="Aadhaar"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    {selectedApp.documents.categoryProof && (
                      <div className="aspect-[4/3] rounded-lg overflow-hidden bg-muted">
                        <img
                          src={selectedApp.documents.categoryProof}
                          alt="Category Proof"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Application Info */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <h4 className="font-medium mb-2">Personal Info</h4>
                    <dl className="text-sm space-y-1">
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">Phone:</dt>
                        <dd>{selectedApp.phone}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">Email:</dt>
                        <dd>{selectedApp.email}</dd>
                      </div>
                    </dl>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">Academic Info</h4>
                    <dl className="text-sm space-y-1">
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">Branch:</dt>
                        <dd>{selectedApp.branch}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">Year:</dt>
                        <dd>{selectedApp.year}</dd>
                      </div>
                    </dl>
                  </div>
                </div>
              </div>

              <DialogFooter className="gap-2">
                {selectedApp.status === "pending" && (
                  <>
                    <Button
                      variant="destructive"
                      onClick={() => handleStatusUpdate(selectedApp.id, "rejected")}
                      disabled={isUpdating}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Reject
                    </Button>
                    <Button
                      onClick={() => handleStatusUpdate(selectedApp.id, "selected")}
                      disabled={isUpdating}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Approve
                    </Button>
                  </>
                )}
                {selectedApp.status !== "pending" && (
                  <Button variant="outline" onClick={() => setSelectedApp(null)}>
                    Close
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ValidationIndicator({ validation }: { validation: Application["validation"] }) {
  const statuses = Object.values(validation)
  const hasError = statuses.includes("error")
  const hasWarning = statuses.includes("warning")
  const allVerified = statuses.every((s) => s === "verified")

  if (allVerified) {
    return <CheckCircle className="h-4 w-4 text-emerald-600" />
  }
  if (hasError) {
    return <XCircle className="h-4 w-4 text-red-500" />
  }
  if (hasWarning) {
    return <AlertTriangle className="h-4 w-4 text-amber-500" />
  }
  return <Clock className="h-4 w-4 text-muted-foreground" />
}

function ValidationBadge({ status }: { status: string }) {
  const config: Record<string, { icon: typeof CheckCircle; className: string }> = {
    verified: { icon: CheckCircle, className: "text-emerald-600" },
    warning: { icon: AlertTriangle, className: "text-amber-500" },
    error: { icon: XCircle, className: "text-red-500" },
    pending: { icon: Clock, className: "text-muted-foreground" },
  }
  const c = config[status] || config.pending
  const Icon = c.icon

  return (
    <div className={`flex items-center gap-1 ${c.className}`}>
      <Icon className="h-4 w-4" />
      <span className="text-xs capitalize">{status}</span>
    </div>
  )
}
