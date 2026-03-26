"use client"

import { useState } from "react"
import { updateApplication, deleteApplication, removeFromRoomByApplicationId } from "@/lib/firebase/firestore"
import type { Application } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner"
import { MoreVertical, Trash2, CheckSquare, X } from "lucide-react"
import { Timestamp } from "firebase/firestore"

interface ApplicationsTableProps {
  applications: Application[]
  onUpdate: () => void
  genderFilter?: string
}

export function ApplicationsTable({ applications, onUpdate, genderFilter = "all" }: ApplicationsTableProps) {
  const [updating, setUpdating] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [applicationToDelete, setApplicationToDelete] = useState<Application | null>(null)
  const [selectedAppIds, setSelectedAppIds] = useState<Set<string>>(new Set())
  const [selectMode, setSelectMode] = useState(false)

  const handleStatusChange = async (appId: string, newStatus: Application["status"]) => {
    setUpdating(appId)
    try {
      await updateApplication(appId, { status: newStatus, updatedAt: Timestamp.now() })
      toast.success("Status updated")
      onUpdate()
    } catch (error) {
      toast.error("Failed to update status")
    } finally {
      setUpdating(null)
    }
  }

  const handleDeleteApplication = async () => {
    if (!applicationToDelete) return
    
    try {
      if (applicationToDelete.roomNumber) {
        await removeFromRoomByApplicationId(applicationToDelete.id)
      }
      
      await deleteApplication(applicationToDelete.id)
      toast.success(`Deleted application for ${applicationToDelete.fullName}`)
      onUpdate()
      setDeleteDialogOpen(false)
      setApplicationToDelete(null)
    } catch (error) {
      console.error("Delete error:", error)
      toast.error("Failed to delete application")
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "selected": return "bg-blue-100 text-blue-800"
      case "confirmed": return "bg-emerald-100 text-emerald-800"
      case "waitlisted": return "bg-indigo-100 text-indigo-800"
      case "pending": return "bg-amber-100 text-amber-800"
      case "rejected": return "bg-red-100 text-red-800"
      default: return "bg-gray-100 text-gray-800"
    }
  }

  const getGenderColor = (gender: string) => {
    switch (gender) {
      case "Male": return "border-blue-200 bg-blue-50 text-blue-700"
      case "Female": return "border-pink-200 bg-pink-50 text-pink-700"
      default: return "border-purple-200 bg-purple-50 text-purple-700"
    }
  }

  const toggleSelectApp = (appId: string) => {
    const newSelected = new Set(selectedAppIds)
    if (newSelected.has(appId)) {
      newSelected.delete(appId)
    } else {
      newSelected.add(appId)
    }
    setSelectedAppIds(newSelected)
  }

  const selectAllVisible = () => {
    const allIds = applications.map(app => app.id)
    setSelectedAppIds(new Set(allIds))
  }

  const clearSelections = () => {
    setSelectedAppIds(new Set())
    setSelectMode(false)
  }

  const handleBatchStatusUpdate = async (newStatus: Application["status"]) => {
    if (selectedAppIds.size === 0) return
    
    try {
      for (const appId of selectedAppIds) {
        await updateApplication(appId, { status: newStatus, updatedAt: Timestamp.now() })
      }
      toast.success(`Updated ${selectedAppIds.size} applications to ${newStatus}`)
      setSelectedAppIds(new Set())
      setSelectMode(false)
      onUpdate()
    } catch (error) {
      toast.error("Failed to update applications")
    }
  }

  const handleBatchDelete = async () => {
    if (selectedAppIds.size === 0) return
    
    try {
      for (const appId of selectedAppIds) {
        const app = applications.find(a => a.id === appId)
        if (app?.roomNumber) {
          await removeFromRoomByApplicationId(appId)
        }
        await deleteApplication(appId)
      }
      toast.success(`Deleted ${selectedAppIds.size} applications`)
      setSelectedAppIds(new Set())
      setSelectMode(false)
      onUpdate()
    } catch (error) {
      toast.error("Failed to delete applications")
    }
  }

  if (applications.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground border rounded-lg">
        No applications found
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {selectMode && (
        <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
          <div className="flex items-center gap-2">
            <Checkbox
              id="select-all"
              checked={selectedAppIds.size === applications.length && applications.length > 0}
              onCheckedChange={(checked) => {
                if (checked) {
                  selectAllVisible()
                } else {
                  clearSelections()
                }
              }}
            />
            <label htmlFor="select-all" className="text-sm">
              {selectedAppIds.size} selected
            </label>
          </div>
          <div className="flex gap-2">
            <Select onValueChange={(value) => handleBatchStatusUpdate(value as Application["status"])}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Change Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="selected">Selected</SelectItem>
                <SelectItem value="waitlisted">Waitlisted</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="destructive" size="sm" onClick={handleBatchDelete}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Selected
            </Button>
            <Button variant="outline" size="sm" onClick={clearSelections}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">
                {!selectMode ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectMode(true)}
                    className="h-8 px-2"
                    type="button"
                  >
                    <CheckSquare className="h-4 w-4 mr-1" />
                    Select
                  </Button>
                ) : (
                  <Checkbox
                    id="select-all-header"
                    checked={selectedAppIds.size === applications.length && applications.length > 0}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        selectAllVisible()
                      } else {
                        setSelectedAppIds(new Set())
                      }
                    }}
                  />
                )}
              </TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Gender</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead>Year</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Hostel</TableHead>
              <TableHead>Room</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {applications.map((app) => (
              <TableRow key={app.id} className={
                app.gender === "Male" ? "hover:bg-blue-50/50" : 
                app.gender === "Female" ? "hover:bg-pink-50/50" : 
                "hover:bg-purple-50/50"
              }>
                <TableCell>
                  {selectMode ? (
                    <Checkbox
                      id={`select-${app.id}`}
                      checked={selectedAppIds.has(app.id)}
                      onCheckedChange={() => toggleSelectApp(app.id)}
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <div>
                    <p className="font-medium">{app.fullName}</p>
                    <p className="text-xs text-muted-foreground">{app.email}</p>
                    <p className="text-xs text-muted-foreground">{app.phone}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={getGenderColor(app.gender || "Other")}>
                    {app.gender || "Not specified"}
                  </Badge>
                </TableCell>
                <TableCell>{app.branch}</TableCell>
                <TableCell>{app.year}</TableCell>
                <TableCell>{app.category}</TableCell>
                <TableCell>
                  {app.admissionType === "CET" ? app.cetMarks : app.sgpa}
                </TableCell>
                <TableCell>
                  <Select
                    value={app.status}
                    onValueChange={(v) => handleStatusChange(app.id, v as Application["status"])}
                    disabled={updating === app.id}
                  >
                    <SelectTrigger className="w-[110px]">
                      <SelectValue>
                        <Badge className={getStatusColor(app.status)}>
                          {app.status}
                        </Badge>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="selected">Selected</SelectItem>
                      <SelectItem value="waitlisted">Waitlisted</SelectItem>
                      <SelectItem value="confirmed">Confirmed</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  {app.hostel ? (
                    <Badge variant="outline" className={
                      app.hostel === "boys" ? "border-blue-200 bg-blue-50" : "border-pink-200 bg-pink-50"
                    }>
                      {app.hostel === "boys" ? "Boys" : "Girls"} Hostel
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">Not assigned</span>
                  )}
                </TableCell>
                <TableCell>
                  {app.roomNumber ? (
                    <Badge variant="outline" className="font-mono">
                      Room {app.roomNumber}
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <AlertDialog open={deleteDialogOpen && applicationToDelete?.id === app.id} onOpenChange={setDeleteDialogOpen}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0" type="button">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <AlertDialogTrigger asChild>
                          <DropdownMenuItem 
                            className="text-destructive focus:text-destructive"
                            onClick={() => setApplicationToDelete(app)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </AlertDialogTrigger>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Application</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete the application for{" "}
                          <span className="font-semibold">{app.fullName}</span>? 
                          {app.roomNumber && " They will be removed from their assigned room."}
                          This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={handleDeleteApplication}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}