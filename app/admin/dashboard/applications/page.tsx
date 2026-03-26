"use client"

import { useEffect, useState } from "react"
import { getAllApplications } from "@/lib/firebase/firestore"
import type { Application } from "@/lib/types"
import { ApplicationsTable } from "@/components/admin/applications-table"
import { Spinner } from "@/components/ui/spinner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { User, Users, Clock, CheckCircle, XCircle } from "lucide-react"

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedGender, setSelectedGender] = useState<string>("all")

  const fetchApplications = async () => {
    setLoading(true)
    const apps = await getAllApplications()
    setApplications(apps)
    setLoading(false)
  }

  useEffect(() => {
    fetchApplications()
  }, [])

  // Filter applications by gender
  const maleApplications = applications.filter(app => app.gender === "Male")
  const femaleApplications = applications.filter(app => app.gender === "Female")
  const otherApplications = applications.filter(app => app.gender === "Other")

  // Statistics by gender
  const getStatsByGender = (apps: Application[]) => {
    return {
      total: apps.length,
      pending: apps.filter(a => a.status === "pending").length,
      selected: apps.filter(a => a.status === "selected").length,
      confirmed: apps.filter(a => a.status === "confirmed").length,
      waitlisted: apps.filter(a => a.status === "waitlisted").length,
      rejected: apps.filter(a => a.status === "rejected").length,
    }
  }

  const maleStats = getStatsByGender(maleApplications)
  const femaleStats = getStatsByGender(femaleApplications)
  const otherStats = getStatsByGender(otherApplications)
  const totalStats = getStatsByGender(applications)

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
          Review and manage hostel applications (separate for Boys & Girls)
        </p>
      </div>

      {/* Gender Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <User className="h-4 w-4 text-blue-600" />
              Boys Applications
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700">{maleStats.total}</div>
            <div className="grid grid-cols-2 gap-1 mt-2 text-xs">
              <div className="flex justify-between">
                <span>Pending:</span>
                <span className="font-semibold text-amber-600">{maleStats.pending}</span>
              </div>
              <div className="flex justify-between">
                <span>Selected:</span>
                <span className="font-semibold text-blue-600">{maleStats.selected}</span>
              </div>
              <div className="flex justify-between">
                <span>Confirmed:</span>
                <span className="font-semibold text-emerald-600">{maleStats.confirmed}</span>
              </div>
              <div className="flex justify-between">
                <span>Waitlisted:</span>
                <span className="font-semibold text-indigo-600">{maleStats.waitlisted}</span>
              </div>
            </div>
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
            <div className="text-2xl font-bold text-pink-700">{femaleStats.total}</div>
            <div className="grid grid-cols-2 gap-1 mt-2 text-xs">
              <div className="flex justify-between">
                <span>Pending:</span>
                <span className="font-semibold text-amber-600">{femaleStats.pending}</span>
              </div>
              <div className="flex justify-between">
                <span>Selected:</span>
                <span className="font-semibold text-pink-600">{femaleStats.selected}</span>
              </div>
              <div className="flex justify-between">
                <span>Confirmed:</span>
                <span className="font-semibold text-emerald-600">{femaleStats.confirmed}</span>
              </div>
              <div className="flex justify-between">
                <span>Waitlisted:</span>
                <span className="font-semibold text-indigo-600">{femaleStats.waitlisted}</span>
              </div>
            </div>
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
            <div className="text-2xl font-bold text-purple-700">{otherStats.total}</div>
            <div className="grid grid-cols-2 gap-1 mt-2 text-xs">
              <div className="flex justify-between">
                <span>Pending:</span>
                <span className="font-semibold text-amber-600">{otherStats.pending}</span>
              </div>
              <div className="flex justify-between">
                <span>Selected:</span>
                <span className="font-semibold text-purple-600">{otherStats.selected}</span>
              </div>
              <div className="flex justify-between">
                <span>Confirmed:</span>
                <span className="font-semibold text-emerald-600">{otherStats.confirmed}</span>
              </div>
              <div className="flex justify-between">
                <span>Waitlisted:</span>
                <span className="font-semibold text-indigo-600">{otherStats.waitlisted}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
          <CardDescription>Total applications by status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 grid-cols-2 md:grid-cols-5">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold">{totalStats.total}</div>
              <div className="text-xs text-muted-foreground">Total</div>
            </div>
            <div className="text-center p-3 bg-amber-50 rounded-lg">
              <div className="text-2xl font-bold text-amber-700">{totalStats.pending}</div>
              <div className="text-xs text-amber-600">Pending</div>
            </div>
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-700">{totalStats.selected}</div>
              <div className="text-xs text-blue-600">Selected</div>
            </div>
            <div className="text-center p-3 bg-indigo-50 rounded-lg">
              <div className="text-2xl font-bold text-indigo-700">{totalStats.waitlisted}</div>
              <div className="text-xs text-indigo-600">Waitlisted</div>
            </div>
            <div className="text-center p-3 bg-emerald-50 rounded-lg">
              <div className="text-2xl font-bold text-emerald-700">{totalStats.confirmed}</div>
              <div className="text-xs text-emerald-600">Confirmed</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Applications Table with Gender Tabs */}
      <Tabs defaultValue="all" className="space-y-4" onValueChange={(value) => setSelectedGender(value)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            All ({totalStats.total})
          </TabsTrigger>
          <TabsTrigger value="Male" className="flex items-center gap-2">
            <User className="h-4 w-4 text-blue-600" />
            Boys ({maleStats.total})
          </TabsTrigger>
          <TabsTrigger value="Female" className="flex items-center gap-2">
            <User className="h-4 w-4 text-pink-600" />
            Girls ({femaleStats.total})
          </TabsTrigger>
          <TabsTrigger value="Other" className="flex items-center gap-2">
            <Users className="h-4 w-4 text-purple-600" />
            Other ({otherStats.total})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <ApplicationsTable 
            applications={applications} 
            onUpdate={fetchApplications}
            genderFilter="all"
          />
        </TabsContent>

        <TabsContent value="Male">
          <ApplicationsTable 
            applications={maleApplications} 
            onUpdate={fetchApplications}
            genderFilter="male"
          />
        </TabsContent>

        <TabsContent value="Female">
          <ApplicationsTable 
            applications={femaleApplications} 
            onUpdate={fetchApplications}
            genderFilter="female"
          />
        </TabsContent>

        <TabsContent value="Other">
          <ApplicationsTable 
            applications={otherApplications} 
            onUpdate={fetchApplications}
            genderFilter="other"
          />
          {otherStats.pending > 0 && (
            <Card className="mt-4 border-purple-200 bg-purple-50">
              <CardContent className="pt-6">
                <p className="text-sm text-purple-700">
                  ⚠️ {otherStats.pending} application(s) with "Other" gender need manual assignment.
                  These applications require special attention as they don't fit into boys or girls hostels.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}