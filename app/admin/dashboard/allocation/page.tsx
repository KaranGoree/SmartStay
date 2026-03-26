"use client"

import { useEffect, useState } from "react"
import { getAllApplications, getAllRooms } from "@/lib/firebase/firestore"
import type { Application, Room } from "@/lib/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import {
  FileText,
  Users,
  BedDouble,
  CheckCircle,
  Clock,
  XCircle,
  ArrowRight,
  TrendingUp,
  User,
  UserCheck,
  UserX,
  Download,
  FileSpreadsheet,
  Printer,
  Award,
  Building2,
} from "lucide-react"

// Import PDF utilities
import { downloadPDF, downloadAllPDFs, getPDFSummary } from "@/lib/utils/pdf-generator"

export default function AdminDashboard() {
  const [applications, setApplications] = useState<Application[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [pdfGenerating, setPdfGenerating] = useState(false)

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

  // PDF Download Handlers
  const handleDownloadSelectedPDF = async () => {
    setPdfGenerating(true)
    try {
      const selectedStudents = applications.filter(app => app.status === "selected")
      if (selectedStudents.length === 0) {
        toast.error("No selected students to download")
        return
      }
      await downloadPDF(selectedStudents, "selected")
      toast.success("Selected students PDF downloaded")
    } catch (error) {
      console.error("PDF generation error:", error)
      toast.error("Failed to generate PDF")
    } finally {
      setPdfGenerating(false)
    }
  }

  const handleDownloadWaitlistedPDF = async () => {
    setPdfGenerating(true)
    try {
      const waitlistedStudents = applications.filter(app => app.status === "waitlisted")
      if (waitlistedStudents.length === 0) {
        toast.error("No waitlisted students to download")
        return
      }
      await downloadPDF(waitlistedStudents, "waitlisted")
      toast.success("Waitlisted students PDF downloaded")
    } catch (error) {
      console.error("PDF generation error:", error)
      toast.error("Failed to generate PDF")
    } finally {
      setPdfGenerating(false)
    }
  }

  const handleDownloadConfirmedPDF = async () => {
    setPdfGenerating(true)
    try {
      const confirmedStudents = applications.filter(app => app.status === "confirmed")
      if (confirmedStudents.length === 0) {
        toast.error("No confirmed students to download")
        return
      }
      await downloadPDF(confirmedStudents, "selected")
      toast.success("Confirmed students PDF downloaded")
    } catch (error) {
      console.error("PDF generation error:", error)
      toast.error("Failed to generate PDF")
    } finally {
      setPdfGenerating(false)
    }
  }

  const handleDownloadAllPDFs = async () => {
    setPdfGenerating(true)
    try {
      const selectedStudents = applications.filter(app => app.status === "selected")
      const waitlistedStudents = applications.filter(app => app.status === "waitlisted")
      
      if (selectedStudents.length === 0 && waitlistedStudents.length === 0) {
        toast.error("No students to download")
        return
      }
      
      await downloadAllPDFs(selectedStudents, waitlistedStudents)
      toast.success("All PDFs downloaded")
    } catch (error) {
      console.error("PDF generation error:", error)
      toast.error("Failed to generate PDFs")
    } finally {
      setPdfGenerating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  // Filter applications by gender
  const maleApplications = applications.filter(app => app.gender === "Male")
  const femaleApplications = applications.filter(app => app.gender === "Female")
  const otherApplications = applications.filter(app => app.gender === "Other")

  // Filter rooms by hostel type
  const boysRooms = rooms.filter(room => room.hostel === "boys")
  const girlsRooms = rooms.filter(room => room.hostel === "girls")

  // Overall stats
  const overallStats = {
    total: applications.length,
    pending: applications.filter((a) => a.status === "pending").length,
    selected: applications.filter((a) => a.status === "selected").length,
    confirmed: applications.filter((a) => a.status === "confirmed").length,
    waitlisted: applications.filter((a) => a.status === "waitlisted").length,
    rejected: applications.filter((a) => a.status === "rejected").length,
    maleCount: maleApplications.length,
    femaleCount: femaleApplications.length,
    otherCount: otherApplications.length,
  }

  // Boys hostel stats
  const boysStats = {
    total: maleApplications.length,
    pending: maleApplications.filter((a) => a.status === "pending").length,
    selected: maleApplications.filter((a) => a.status === "selected").length,
    confirmed: maleApplications.filter((a) => a.status === "confirmed").length,
    waitlisted: maleApplications.filter((a) => a.status === "waitlisted").length,
    rejected: maleApplications.filter((a) => a.status === "rejected").length,
    availableRooms: boysRooms.filter((r) => r.status === "available").length,
    totalRooms: boysRooms.length,
  }

  // Girls hostel stats
  const girlsStats = {
    total: femaleApplications.length,
    pending: femaleApplications.filter((a) => a.status === "pending").length,
    selected: femaleApplications.filter((a) => a.status === "selected").length,
    confirmed: femaleApplications.filter((a) => a.status === "confirmed").length,
    waitlisted: femaleApplications.filter((a) => a.status === "waitlisted").length,
    rejected: femaleApplications.filter((a) => a.status === "rejected").length,
    availableRooms: girlsRooms.filter((r) => r.status === "available").length,
    totalRooms: girlsRooms.length,
  }

  const recentApplications = [...applications]
    .sort((a, b) => {
      const dateA = a.createdAt?.toMillis?.() || 0
      const dateB = b.createdAt?.toMillis?.() || 0
      return dateB - dateA
    })
    .slice(0, 5)

  const recentMaleApplications = [...maleApplications]
    .sort((a, b) => {
      const dateA = a.createdAt?.toMillis?.() || 0
      const dateB = b.createdAt?.toMillis?.() || 0
      return dateB - dateA
    })
    .slice(0, 3)

  const recentFemaleApplications = [...femaleApplications]
    .sort((a, b) => {
      const dateA = a.createdAt?.toMillis?.() || 0
      const dateB = b.createdAt?.toMillis?.() || 0
      return dateB - dateA
    })
    .slice(0, 3)

  // Calculate PDF summaries for display
  const selectedSummary = getPDFSummary(applications.filter(app => app.status === "selected"), "selected")
  const waitlistedSummary = getPDFSummary(applications.filter(app => app.status === "waitlisted"), "waitlisted")

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground">Manage hostel applications and allocations</p>
      </div>

      {/* PDF Download Section */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5 text-blue-600" />
            Download Reports
          </CardTitle>
          <CardDescription>
            Generate and download PDF reports of student lists
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button 
              onClick={handleDownloadSelectedPDF} 
              disabled={pdfGenerating || overallStats.selected === 0}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {pdfGenerating ? <Spinner className="h-4 w-4 mr-2" /> : <FileText className="h-4 w-4 mr-2" />}
              Selected Students ({overallStats.selected})
            </Button>
            <Button 
              onClick={handleDownloadWaitlistedPDF} 
              disabled={pdfGenerating || overallStats.waitlisted === 0}
              variant="outline"
              className="border-yellow-500 text-yellow-700 hover:bg-yellow-50"
            >
              {pdfGenerating ? <Spinner className="h-4 w-4 mr-2" /> : <FileSpreadsheet className="h-4 w-4 mr-2" />}
              Waitlisted Students ({overallStats.waitlisted})
            </Button>
            <Button 
              onClick={handleDownloadConfirmedPDF} 
              disabled={pdfGenerating || overallStats.confirmed === 0}
              variant="outline"
              className="border-emerald-500 text-emerald-700 hover:bg-emerald-50"
            >
              {pdfGenerating ? <Spinner className="h-4 w-4 mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
              Confirmed Students ({overallStats.confirmed})
            </Button>
            <Button 
              onClick={handleDownloadAllPDFs} 
              disabled={pdfGenerating || (overallStats.selected === 0 && overallStats.waitlisted === 0)}
              variant="outline"
            >
              {pdfGenerating ? <Spinner className="h-4 w-4 mr-2" /> : <Download className="h-4 w-4 mr-2" />}
              Download All PDFs
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Gender Distribution Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <User className="h-4 w-4 text-blue-600" />
              Boys Applications
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700">{boysStats.total}</div>
            <p className="text-xs text-blue-600">
              {boysStats.pending} pending review
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-pink-50 to-pink-100 border-pink-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <User className="h-4 w-4 text-pink-600" />
              Girls Applications
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-pink-700">{girlsStats.total}</div>
            <p className="text-xs text-pink-600">
              {girlsStats.pending} pending review
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-purple-50 to-purple-100 border-purple-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-purple-600" />
              Other Applications
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-700">{overallStats.otherCount}</div>
            <p className="text-xs text-purple-600">
              Need manual assignment
            </p>
          </CardContent>
        </Card>
      </div>

      {/* PDF Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Selected Students Summary */}
        <Card>
          <CardHeader className="bg-gradient-to-r from-blue-50 to-transparent">
            <CardTitle className="flex items-center gap-2 text-blue-700">
              <FileText className="h-5 w-5" />
              Selected Students Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-blue-50 rounded-lg text-center">
                  <p className="text-xs text-blue-600">Total Selected</p>
                  <p className="text-2xl font-bold text-blue-700">{selectedSummary.total}</p>
                </div>
                <div className="p-3 bg-emerald-50 rounded-lg text-center">
                  <p className="text-xs text-emerald-600">Allocated</p>
                  <p className="text-2xl font-bold text-emerald-700">{selectedSummary.allocated}</p>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Award className="h-4 w-4" />
                  Seat Type Distribution
                </p>
                <div className="flex gap-2 flex-wrap">
                  {Object.entries(selectedSummary.bySeatType).map(([type, count]) => (
                    <span key={type} className="px-2 py-1 bg-gray-100 rounded-full text-xs">
                      {type}: {count}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Year-wise Distribution
                </p>
                <div className="flex gap-2 flex-wrap">
                  {Object.entries(selectedSummary.byYear).map(([year, count]) => (
                    <span key={year} className="px-2 py-1 bg-blue-50 rounded-full text-xs">
                      Year {year}: {count}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Category Distribution
                </p>
                <div className="flex gap-2 flex-wrap">
                  {Object.entries(selectedSummary.byCategory).map(([cat, count]) => (
                    <span key={cat} className="px-2 py-1 bg-gray-100 rounded-full text-xs">
                      {cat}: {count}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Waitlisted Students Summary */}
        <Card>
          <CardHeader className="bg-gradient-to-r from-yellow-50 to-transparent">
            <CardTitle className="flex items-center gap-2 text-yellow-700">
              <FileSpreadsheet className="h-5 w-5" />
              Waitlisted Students Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-yellow-50 rounded-lg text-center">
                  <p className="text-xs text-yellow-600">Total Waitlisted</p>
                  <p className="text-2xl font-bold text-yellow-700">{waitlistedSummary.total}</p>
                </div>
                <div className="p-3 bg-orange-50 rounded-lg text-center">
                  <p className="text-xs text-orange-600">Pending</p>
                  <p className="text-2xl font-bold text-orange-700">{waitlistedSummary.pending}</p>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Award className="h-4 w-4" />
                  Seat Type Distribution
                </p>
                <div className="flex gap-2 flex-wrap">
                  {Object.entries(waitlistedSummary.bySeatType).map(([type, count]) => (
                    <span key={type} className="px-2 py-1 bg-gray-100 rounded-full text-xs">
                      {type}: {count}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Year-wise Distribution
                </p>
                <div className="flex gap-2 flex-wrap">
                  {Object.entries(waitlistedSummary.byYear).map(([year, count]) => (
                    <span key={year} className="px-2 py-1 bg-yellow-50 rounded-full text-xs">
                      Year {year}: {count}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Category Distribution
                </p>
                <div className="flex gap-2 flex-wrap">
                  {Object.entries(waitlistedSummary.byCategory).map(([cat, count]) => (
                    <span key={cat} className="px-2 py-1 bg-gray-100 rounded-full text-xs">
                      {cat}: {count}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stats Grid with Tabs for Hostels */}
      <Tabs defaultValue="overall" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overall">Overall Statistics</TabsTrigger>
          <TabsTrigger value="boys">Boys Hostel</TabsTrigger>
          <TabsTrigger value="girls">Girls Hostel</TabsTrigger>
        </TabsList>

        {/* Overall Statistics Tab - Keep your existing code */}
        <TabsContent value="overall" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Applications</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{overallStats.total}</div>
                <p className="text-xs text-muted-foreground">
                  {overallStats.pending} pending review
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
                <Clock className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{overallStats.pending}</div>
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
                <div className="text-2xl font-bold">{overallStats.confirmed}</div>
                <p className="text-xs text-muted-foreground">
                  Seats confirmed
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Gender Distribution</CardTitle>
                <Users className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span>Boys:</span>
                    <span className="font-semibold">{overallStats.maleCount}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span>Girls:</span>
                    <span className="font-semibold">{overallStats.femaleCount}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span>Other:</span>
                    <span className="font-semibold">{overallStats.otherCount}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Boys Hostel Tab - Keep your existing code */}
        <TabsContent value="boys" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="border-blue-200 bg-blue-50/30">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Boys Applications</CardTitle>
                <User className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-700">{boysStats.total}</div>
                <p className="text-xs text-blue-600">
                  {boysStats.pending} pending
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Selected</CardTitle>
                <UserCheck className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{boysStats.selected}</div>
                <p className="text-xs text-muted-foreground">
                  Awaiting confirmation
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Confirmed</CardTitle>
                <CheckCircle className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{boysStats.confirmed}</div>
                <p className="text-xs text-muted-foreground">
                  Seats occupied
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
                  {boysStats.availableRooms}/{boysStats.totalRooms || "N/A"}
                </div>
                <p className="text-xs text-muted-foreground">
                  Rooms available
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-blue-600" />
                Recent Boys Applications
              </CardTitle>
              <CardDescription>Latest male student applications</CardDescription>
            </CardHeader>
            <CardContent>
              {recentMaleApplications.length > 0 ? (
                <div className="space-y-3">
                  {recentMaleApplications.map((app) => (
                    <div
                      key={app.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-blue-50/50 border border-blue-100"
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
                  No male applications yet
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Girls Hostel Tab - Keep your existing code */}
        <TabsContent value="girls" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="border-pink-200 bg-pink-50/30">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Girls Applications</CardTitle>
                <User className="h-4 w-4 text-pink-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-pink-700">{girlsStats.total}</div>
                <p className="text-xs text-pink-600">
                  {girlsStats.pending} pending
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Selected</CardTitle>
                <UserCheck className="h-4 w-4 text-pink-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{girlsStats.selected}</div>
                <p className="text-xs text-muted-foreground">
                  Awaiting confirmation
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Confirmed</CardTitle>
                <CheckCircle className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{girlsStats.confirmed}</div>
                <p className="text-xs text-muted-foreground">
                  Seats occupied
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
                  {girlsStats.availableRooms}/{girlsStats.totalRooms || "N/A"}
                </div>
                <p className="text-xs text-muted-foreground">
                  Rooms available
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-pink-600" />
                Recent Girls Applications
              </CardTitle>
              <CardDescription>Latest female student applications</CardDescription>
            </CardHeader>
            <CardContent>
              {recentFemaleApplications.length > 0 ? (
                <div className="space-y-3">
                  {recentFemaleApplications.map((app) => (
                    <div
                      key={app.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-pink-50/50 border border-pink-100"
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
                  No female applications yet
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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
                  Review All Applications
                </span>
                <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full text-xs">
                  {overallStats.pending}
                </span>
              </Link>
            </Button>
            <Button variant="outline" className="justify-between" asChild>
              <Link href="/admin/dashboard/applications?gender=male">
                <span className="flex items-center gap-2">
                  <User className="h-4 w-4 text-blue-600" />
                  Review Boys Applications
                </span>
                <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-xs">
                  {boysStats.pending}
                </span>
              </Link>
            </Button>
            <Button variant="outline" className="justify-between" asChild>
              <Link href="/admin/dashboard/applications?gender=female">
                <span className="flex items-center gap-2">
                  <User className="h-4 w-4 text-pink-600" />
                  Review Girls Applications
                </span>
                <span className="bg-pink-100 text-pink-800 px-2 py-0.5 rounded-full text-xs">
                  {girlsStats.pending}
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

        {/* Recent All Applications */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Applications</CardTitle>
            <CardDescription>Latest submitted applications (all genders)</CardDescription>
          </CardHeader>
          <CardContent>
            {recentApplications.length > 0 ? (
              <div className="space-y-3">
                {recentApplications.map((app) => (
                  <div
                    key={app.id}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      app.gender === "Male" 
                        ? "bg-blue-50/50 border border-blue-100" 
                        : app.gender === "Female"
                        ? "bg-pink-50/50 border border-pink-100"
                        : "bg-purple-50/50 border border-purple-100"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">{app.fullName}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          app.gender === "Male" 
                            ? "bg-blue-100 text-blue-700" 
                            : app.gender === "Female"
                            ? "bg-pink-100 text-pink-700"
                            : "bg-purple-100 text-purple-700"
                        }`}>
                          {app.gender}
                        </span>
                      </div>
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

      {/* Status Distribution by Gender */}
      <Card>
        <CardHeader>
          <CardTitle>Application Status Distribution by Gender</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            {/* Boys Distribution */}
            <div className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2 text-blue-700">
                <User className="h-4 w-4" />
                Boys Hostel
              </h3>
              <div className="grid gap-2 grid-cols-5">
                <StatusCard label="Pending" count={boysStats.pending} color="bg-amber-500" />
                <StatusCard label="Selected" count={boysStats.selected} color="bg-blue-500" />
                <StatusCard label="Waitlisted" count={boysStats.waitlisted} color="bg-indigo-500" />
                <StatusCard label="Confirmed" count={boysStats.confirmed} color="bg-emerald-500" />
                <StatusCard label="Rejected" count={boysStats.rejected} color="bg-red-500" />
              </div>
            </div>

            {/* Girls Distribution */}
            <div className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2 text-pink-700">
                <User className="h-4 w-4" />
                Girls Hostel
              </h3>
              <div className="grid gap-2 grid-cols-5">
                <StatusCard label="Pending" count={girlsStats.pending} color="bg-amber-500" />
                <StatusCard label="Selected" count={girlsStats.selected} color="bg-pink-500" />
                <StatusCard label="Waitlisted" count={girlsStats.waitlisted} color="bg-indigo-500" />
                <StatusCard label="Confirmed" count={girlsStats.confirmed} color="bg-emerald-500" />
                <StatusCard label="Rejected" count={girlsStats.rejected} color="bg-red-500" />
              </div>
            </div>
          </div>

          {/* Other Gender Notice */}
          {overallStats.otherCount > 0 && (
            <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
              <p className="text-sm text-purple-700 flex items-center gap-2">
                <UserX className="h-4 w-4" />
                {overallStats.otherCount} application(s) with "Other" gender need manual assignment.
              </p>
            </div>
          )}
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
      <p className="text-xl font-bold">{count}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}