"use client"

import { useEffect, useState } from "react"
import {
  getAllApplications,
  getSettings,
  batchUpdateApplications,
  deleteApplication,
  batchDeleteApplications,
  removeFromRoomByApplicationId, // Add this import
} from "@/lib/firebase/firestore"
import { allocateByBranchYear, getConfirmationDeadline } from "@/lib/utils/allocation"
import type { Application, Settings } from "@/lib/types"
import { BRANCHES, YEARS } from "@/lib/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
import { Play, Users, Award, Clock, RefreshCw, Trash2, MoreVertical, CheckSquare, X } from "lucide-react"
import { Timestamp } from "firebase/firestore"

export default function AllocationPage() {
  const [applications, setApplications] = useState<Application[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [selectedBranch, setSelectedBranch] = useState<string>("all")
  const [selectedYear, setSelectedYear] = useState<string>("all")
  
  // Deletion states
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [applicationToDelete, setApplicationToDelete] = useState<Application | null>(null)
  const [batchDeleteDialogOpen, setBatchDeleteDialogOpen] = useState(false)
  const [selectedAppIds, setSelectedAppIds] = useState<Set<string>>(new Set())
  const [selectMode, setSelectMode] = useState(false)

  useEffect(() => {
    async function fetchData() {
      const [apps, s] = await Promise.all([getAllApplications(), getSettings()])
      setApplications(apps)
      setSettings(s)
      setLoading(false)
    }
    fetchData()
  }, [])

  // Computed values
  const pendingApps = applications.filter((a) => a.status === "pending")
  const selectedAppsList = applications.filter((a) => a.status === "selected")
  const waitlistedApps = applications.filter((a) => a.status === "waitlisted")
  const confirmedApps = applications.filter((a) => a.status === "confirmed")

  const filteredApps = applications.filter((a) => {
    const matchesBranch = selectedBranch === "all" || a.branch === selectedBranch
    const matchesYear = selectedYear === "all" || a.year === parseInt(selectedYear)
    return matchesBranch && matchesYear && ["selected", "waitlisted", "confirmed"].includes(a.status)
  })

  const runAllocation = async () => {
    if (!settings) {
      toast.error("Please configure settings first")
      return
    }

    setRunning(true)
    try {
      const results = allocateByBranchYear(pendingApps, settings)
      const deadline = getConfirmationDeadline(settings)
      const updates: { id: string; data: Partial<Application> }[] = []

      for (const [key, result] of results) {
        for (const app of result.selected) {
          updates.push({
            id: app.id,
            data: {
              status: "selected",
              meritRank: app.meritRank,
              confirmationDeadline: Timestamp.fromDate(deadline),
            },
          })
        }
        for (const app of result.waitlisted) {
          updates.push({
            id: app.id,
            data: {
              status: "waitlisted",
              meritRank: app.meritRank,
            },
          })
        }
      }

      if (updates.length > 0) {
        await batchUpdateApplications(updates)
        toast.success(`Allocated ${updates.length} applications`)
        
        // Refresh data
        const apps = await getAllApplications()
        setApplications(apps)
      } else {
        toast.info("No pending applications to allocate")
      }
    } catch (error) {
      toast.error("Allocation failed")
    } finally {
      setRunning(false)
    }
  }

  // Single delete handler with room cleanup
  const handleDeleteApplication = async () => {
    if (!applicationToDelete) return
    
    try {
      // If the student has a room assigned, remove them from it first
      if (applicationToDelete.roomNumber) {
        await removeFromRoomByApplicationId(applicationToDelete.id)
      }
      
      // Then delete the application
      await deleteApplication(applicationToDelete.id)
      toast.success(`Deleted application for ${applicationToDelete.fullName}`)
      
      // Refresh data
      const apps = await getAllApplications()
      setApplications(apps)
      setDeleteDialogOpen(false)
      setApplicationToDelete(null)
    } catch (error) {
      console.error("Delete error:", error)
      toast.error("Failed to delete application")
    }
  }

  // Batch delete handler with room cleanup
  const handleBatchDelete = async () => {
    if (selectedAppIds.size === 0) return
    
    try {
      const ids = Array.from(selectedAppIds)
      
      // First, get all applications to be deleted to check for room assignments
      const appsToDelete = applications.filter(app => ids.includes(app.id))
      
      // Remove students from their rooms
      for (const app of appsToDelete) {
        if (app.roomNumber) {
          await removeFromRoomByApplicationId(app.id)
        }
      }
      
      // Then delete all applications
      await batchDeleteApplications(ids)
      toast.success(`Deleted ${ids.length} applications`)
      
      // Refresh data
      const apps = await getAllApplications()
      setApplications(apps)
      setSelectedAppIds(new Set())
      setSelectMode(false)
      setBatchDeleteDialogOpen(false)
    } catch (error) {
      console.error("Batch delete error:", error)
      toast.error("Failed to delete applications")
    }
  }

  // Toggle selection for batch delete
  const toggleSelectApp = (appId: string) => {
    const newSelected = new Set(selectedAppIds)
    if (newSelected.has(appId)) {
      newSelected.delete(appId)
    } else {
      newSelected.add(appId)
    }
    setSelectedAppIds(newSelected)
  }

  // Select all visible applications
  const selectAllVisible = () => {
    const allIds = filteredApps.map(app => app.id)
    setSelectedAppIds(new Set(allIds))
  }

  // Clear all selections
  const clearSelections = () => {
    setSelectedAppIds(new Set())
    setSelectMode(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Seat Allocation</h1>
          <p className="text-muted-foreground">
            Run merit-based allocation for hostel seats
          </p>
        </div>
        <div className="flex gap-2">
          {selectMode && selectedAppIds.size > 0 && (
            <AlertDialog open={batchDeleteDialogOpen} onOpenChange={setBatchDeleteDialogOpen}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Selected ({selectedAppIds.size})
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Selected Applications</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete {selectedAppIds.size} selected application(s)? 
                    This action cannot be undone. Students will be removed from their assigned rooms.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleBatchDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {selectMode && (
            <Button variant="outline" onClick={clearSelections}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
          )}
          <Button 
            variant="outline" 
            onClick={() => setSelectMode(!selectMode)}
            disabled={filteredApps.length === 0}
          >
            <CheckSquare className="h-4 w-4 mr-2" />
            {selectMode ? "Exit Select Mode" : "Select Mode"}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button disabled={running || pendingApps.length === 0}>
                {running ? (
                  <Spinner className="h-4 w-4 mr-2" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                Run Allocation
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirm Seat Allocation</AlertDialogTitle>
                <AlertDialogDescription>
                  This will run the merit-based allocation algorithm on{" "}
                  {pendingApps.length} pending applications. Students will be
                  categorized as Selected or Waitlisted based on their merit and
                  category quotas.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={runAllocation}>
                  Run Allocation
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              Pending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{pendingApps.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Award className="h-4 w-4 text-blue-500" />
              Selected
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{selectedAppsList.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-indigo-500" />
              Waitlisted
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{waitlistedApps.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-emerald-500" />
              Confirmed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{confirmedApps.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Allocation Results */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Allocation Results</CardTitle>
              <CardDescription>View selected and waitlisted students</CardDescription>
            </div>
            <div className="flex gap-2">
              {selectMode && filteredApps.length > 0 && (
                <Button variant="outline" size="sm" onClick={selectAllVisible}>
                  Select All Visible
                </Button>
              )}
              <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Branch" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Branches</SelectItem>
                  {BRANCHES.map((b) => (
                    <SelectItem key={b} value={b}>{b}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Years</SelectItem>
                  {YEARS.map((y) => (
                    <SelectItem key={y} value={y.toString()}>Year {y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredApps.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  {selectMode && (
                    <TableHead className="w-[50px]">
                      <Checkbox
                        checked={selectedAppIds.size === filteredApps.length && filteredApps.length > 0}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            selectAllVisible()
                          } else {
                            setSelectedAppIds(new Set())
                          }
                        }}
                      />
                    </TableHead>
                  )}
                  <TableHead>Rank</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Year</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Room</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredApps
                  .sort((a, b) => (a.meritRank || 999) - (b.meritRank || 999))
                  .map((app) => (
                    <TableRow key={app.id}>
                      {selectMode && (
                        <TableCell>
                          <Checkbox
                            checked={selectedAppIds.has(app.id)}
                            onCheckedChange={() => toggleSelectApp(app.id)}
                          />
                        </TableCell>
                      )}
                      <TableCell>
                        <span className="font-mono">#{app.meritRank || "-"}</span>
                      </TableCell>
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
                        <Badge
                          className={
                            app.status === "selected"
                              ? "bg-blue-100 text-blue-800"
                              : app.status === "confirmed"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-indigo-100 text-indigo-800"
                          }
                        >
                          {app.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {app.roomNumber ? (
                          <Badge variant="outline" className="font-mono">
                            Room {app.roomNumber}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">Not assigned</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <AlertDialog open={deleteDialogOpen && applicationToDelete?.id === app.id} onOpenChange={setDeleteDialogOpen}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
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
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              No allocation results yet. Run allocation to see results.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}