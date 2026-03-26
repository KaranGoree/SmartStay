"use client"

import { useEffect, useState } from "react"
import { 
  getSettings, 
  updateSettings, 
  initializeSettings, 
  initializeRoomsByHostel,
  getHostelStats 
} from "@/lib/firebase/firestore"
import type { Settings, Category } from "@/lib/types"
import { DEFAULT_SEAT_DISTRIBUTION, CATEGORIES } from "@/lib/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import { Save, RefreshCw, Building2, User, Settings as SettingsIcon } from "lucide-react"
import { Timestamp } from "firebase/firestore"

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [initializingBoysRooms, setInitializingBoysRooms] = useState(false)
  const [initializingGirlsRooms, setInitializingGirlsRooms] = useState(false)
  const [boysStats, setBoysStats] = useState<any>(null)
  const [girlsStats, setGirlsStats] = useState<any>(null)

  const [formData, setFormData] = useState({
    applicationDeadline: "",
    confirmationPeriodDays: 3,
    seatsPerBranchYear: 10,
    seatDistribution: { ...DEFAULT_SEAT_DISTRIBUTION },
    boysHostel: {
      name: "Boys Hostel",
      type: "boys" as const,
      totalCapacity: 160,
      seatDistribution: { ...DEFAULT_SEAT_DISTRIBUTION },
      seatsPerBranchYear: 10,
      floors: 5,
      roomsPerFloor: 16,
      capacityPerRoom: 2,
    },
    girlsHostel: {
      name: "Girls Hostel",
      type: "girls" as const,
      totalCapacity: 72,
      seatDistribution: { ...DEFAULT_SEAT_DISTRIBUTION },
      seatsPerBranchYear: 10,
      floors: 3,
      roomsPerFloor: 12,
      capacityPerRoom: 2,
    },
  })

  useEffect(() => {
    async function fetchSettings() {
      try {
        const s = await getSettings()
        if (s) {
          setSettings(s)
          setFormData({
            applicationDeadline: s.applicationDeadline?.toDate?.()?.toISOString().split("T")[0] || "",
            confirmationPeriodDays: s.confirmationPeriodDays,
            seatsPerBranchYear: s.seatsPerBranchYear,
            seatDistribution: s.seatDistribution,
            boysHostel: s.hostels?.boys || formData.boysHostel,
            girlsHostel: s.hostels?.girls || formData.girlsHostel,
          })
        }
        
        // Fetch hostel statistics
        const boysStatsData = await getHostelStats("boys")
        const girlsStatsData = await getHostelStats("girls")
        setBoysStats(boysStatsData)
        setGirlsStats(girlsStatsData)
      } catch (error) {
        console.error("Error fetching settings:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchSettings()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const updatedSettings = {
        applicationDeadline: Timestamp.fromDate(new Date(formData.applicationDeadline)),
        confirmationPeriodDays: formData.confirmationPeriodDays,
        seatsPerBranchYear: formData.seatsPerBranchYear,
        seatDistribution: formData.seatDistribution,
        hostels: {
          boys: {
            ...formData.boysHostel,
            totalCapacity: formData.boysHostel.floors * formData.boysHostel.roomsPerFloor * formData.boysHostel.capacityPerRoom,
          },
          girls: {
            ...formData.girlsHostel,
            totalCapacity: formData.girlsHostel.floors * formData.girlsHostel.roomsPerFloor * formData.girlsHostel.capacityPerRoom,
          },
        },
      }
      
      await updateSettings(updatedSettings)
      toast.success("Settings saved successfully")
      
      // Refresh settings
      const s = await getSettings()
      setSettings(s)
    } catch (error) {
      console.error("Save error:", error)
      toast.error("Failed to save settings")
    } finally {
      setSaving(false)
    }
  }

  const handleInitializeSettings = async () => {
    setSaving(true)
    try {
      await initializeSettings(DEFAULT_SEAT_DISTRIBUTION)
      const s = await getSettings()
      if (s) {
        setSettings(s)
        setFormData({
          applicationDeadline: s.applicationDeadline?.toDate?.()?.toISOString().split("T")[0] || "",
          confirmationPeriodDays: s.confirmationPeriodDays,
          seatsPerBranchYear: s.seatsPerBranchYear,
          seatDistribution: s.seatDistribution,
          boysHostel: s.hostels?.boys || formData.boysHostel,
          girlsHostel: s.hostels?.girls || formData.girlsHostel,
        })
      }
      toast.success("Settings initialized")
    } catch (error) {
      toast.error("Failed to initialize settings")
    } finally {
      setSaving(false)
    }
  }

  const handleInitializeRooms = async (hostelType: "boys" | "girls") => {
    if (hostelType === "boys") {
      setInitializingBoysRooms(true)
    } else {
      setInitializingGirlsRooms(true)
    }
    
    try {
      const hostelConfig = hostelType === "boys" ? formData.boysHostel : formData.girlsHostel
      const roomCount = await initializeRoomsByHostel(hostelType, {
        floors: hostelConfig.floors,
        roomsPerFloor: hostelConfig.roomsPerFloor,
        capacityPerRoom: hostelConfig.capacityPerRoom,
        name: hostelConfig.name
      })
      
      // Refresh stats
      const boysStatsData = await getHostelStats("boys")
      const girlsStatsData = await getHostelStats("girls")
      setBoysStats(boysStatsData)
      setGirlsStats(girlsStatsData)
      
      toast.success(`${hostelType === "boys" ? "Boys" : "Girls"} hostel initialized: ${roomCount} rooms created`)
    } catch (error) {
      console.error("Room initialization error:", error)
      toast.error(`Failed to initialize ${hostelType === "boys" ? "Boys" : "Girls"} hostel rooms`)
    } finally {
      if (hostelType === "boys") {
        setInitializingBoysRooms(false)
      } else {
        setInitializingGirlsRooms(false)
      }
    }
  }

  const updateBoysHostel = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      boysHostel: { ...prev.boysHostel, [field]: value }
    }))
  }

  const updateGirlsHostel = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      girlsHostel: { ...prev.girlsHostel, [field]: value }
    }))
  }

  const updateSeatDistribution = (category: Category, value: number) => {
    setFormData(prev => ({
      ...prev,
      seatDistribution: {
        ...prev.seatDistribution,
        [category]: value
      }
    }))
  }

  const totalSeats = Object.values(formData.seatDistribution).reduce((a, b) => a + b, 0)
  const totalBoysSeats = Object.values(formData.boysHostel.seatDistribution).reduce((a, b) => a + b, 0)
  const totalGirlsSeats = Object.values(formData.girlsHostel.seatDistribution).reduce((a, b) => a + b, 0)

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
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Configure system parameters for Boys and Girls hostels</p>
      </div>

      {!settings && (
        <Card>
          <CardHeader>
            <CardTitle>Initialize System</CardTitle>
            <CardDescription>
              Set up initial configuration for the hostel admission system
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleInitializeSettings} disabled={saving}>
              {saving ? <Spinner className="h-4 w-4 mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Initialize Settings
            </Button>
          </CardContent>
        </Card>
      )}

      {settings && (
        <div className="grid gap-6">
          <Tabs defaultValue="general" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="general" className="flex items-center gap-2">
                <SettingsIcon className="h-4 w-4" />
                General
              </TabsTrigger>
              <TabsTrigger value="boys" className="flex items-center gap-2">
                <User className="h-4 w-4 text-blue-600" />
                Boys Hostel
              </TabsTrigger>
              <TabsTrigger value="girls" className="flex items-center gap-2">
                <User className="h-4 w-4 text-pink-600" />
                Girls Hostel
              </TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Application Settings</CardTitle>
                  <CardDescription>
                    Configure deadlines and confirmation periods
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="deadline">Application Deadline</FieldLabel>
                      <Input
                        id="deadline"
                        type="date"
                        value={formData.applicationDeadline}
                        onChange={(e) =>
                          setFormData({ ...formData, applicationDeadline: e.target.value })
                        }
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="confirmationDays">
                        Confirmation Period (days)
                      </FieldLabel>
                      <Input
                        id="confirmationDays"
                        type="number"
                        min={1}
                        max={14}
                        value={formData.confirmationPeriodDays}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            confirmationPeriodDays: parseInt(e.target.value),
                          })
                        }
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="seatsPerBranchYear">
                        Default Seats per Branch/Year
                      </FieldLabel>
                      <Input
                        id="seatsPerBranchYear"
                        type="number"
                        min={1}
                        value={formData.seatsPerBranchYear}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            seatsPerBranchYear: parseInt(e.target.value),
                          })
                        }
                      />
                    </Field>
                  </FieldGroup>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Default Category-wise Seat Distribution</CardTitle>
                  <CardDescription>
                    Define seat quotas for each category (used as fallback)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-4">
                    {CATEGORIES.map((category) => (
                      <Field key={category}>
                        <FieldLabel>{category}</FieldLabel>
                        <Input
                          type="number"
                          min={0}
                          value={formData.seatDistribution[category]}
                          onChange={(e) =>
                            updateSeatDistribution(category, parseInt(e.target.value))
                          }
                        />
                      </Field>
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground mt-4">
                    Total per branch/year: {totalSeats} seats
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="boys" className="space-y-4">
              <Card>
                <CardHeader className="bg-gradient-to-r from-blue-50 to-transparent">
                  <CardTitle className="flex items-center gap-2 text-blue-700">
                    <User className="h-5 w-5" />
                    Boys Hostel Configuration
                  </CardTitle>
                  <CardDescription>
                    Configure seat distribution and room settings for boys hostel
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field>
                      <FieldLabel>Hostel Name</FieldLabel>
                      <Input
                        value={formData.boysHostel.name}
                        onChange={(e) => updateBoysHostel("name", e.target.value)}
                      />
                    </Field>
                    <Field>
                      <FieldLabel>Seats per Branch/Year</FieldLabel>
                      <Input
                        type="number"
                        min={1}
                        value={formData.boysHostel.seatsPerBranchYear}
                        onChange={(e) => updateBoysHostel("seatsPerBranchYear", parseInt(e.target.value))}
                      />
                    </Field>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-3">Category-wise Seat Distribution (Boys)</h3>
                    <div className="grid gap-4 md:grid-cols-4">
                      {CATEGORIES.map((category) => (
                        <Field key={`boys-${category}`}>
                          <FieldLabel>{category}</FieldLabel>
                          <Input
                            type="number"
                            min={0}
                            value={formData.boysHostel.seatDistribution[category]}
                            onChange={(e) => {
                              setFormData(prev => ({
                                ...prev,
                                boysHostel: {
                                  ...prev.boysHostel,
                                  seatDistribution: {
                                    ...prev.boysHostel.seatDistribution,
                                    [category]: parseInt(e.target.value)
                                  }
                                }
                              }))
                            }}
                          />
                        </Field>
                      ))}
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      Total per branch/year (Boys): {totalBoysSeats} seats
                    </p>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-3">Room Configuration</h3>
                    <div className="grid gap-4 md:grid-cols-3">
                      <Field>
                        <FieldLabel>Number of Floors</FieldLabel>
                        <Input
                          type="number"
                          min={1}
                          max={10}
                          value={formData.boysHostel.floors}
                          onChange={(e) => updateBoysHostel("floors", parseInt(e.target.value))}
                        />
                      </Field>
                      <Field>
                        <FieldLabel>Rooms per Floor</FieldLabel>
                        <Input
                          type="number"
                          min={1}
                          max={50}
                          value={formData.boysHostel.roomsPerFloor}
                          onChange={(e) => updateBoysHostel("roomsPerFloor", parseInt(e.target.value))}
                        />
                      </Field>
                      <Field>
                        <FieldLabel>Capacity per Room</FieldLabel>
                        <Input
                          type="number"
                          min={1}
                          max={4}
                          value={formData.boysHostel.capacityPerRoom}
                          onChange={(e) => updateBoysHostel("capacityPerRoom", parseInt(e.target.value))}
                        />
                      </Field>
                    </div>
                    <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                      <p className="text-sm text-blue-700">
                        <strong>Total Capacity:</strong> {formData.boysHostel.floors * formData.boysHostel.roomsPerFloor * formData.boysHostel.capacityPerRoom} students
                        <br />
                        <strong>Total Rooms:</strong> {formData.boysHostel.floors * formData.boysHostel.roomsPerFloor} rooms
                        {boysStats && (
                          <>
                            <br />
                            <strong>Current Occupancy:</strong> {boysStats.totalOccupants} / {boysStats.totalCapacity} ({Math.round(boysStats.occupancyRate)}%)
                          </>
                        )}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => handleInitializeRooms("boys")}
                      disabled={initializingBoysRooms}
                      className="w-full mt-3"
                    >
                      {initializingBoysRooms ? (
                        <Spinner className="h-4 w-4 mr-2" />
                      ) : (
                        <Building2 className="h-4 w-4 mr-2" />
                      )}
                      Initialize Boys Hostel Rooms
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="girls" className="space-y-4">
              <Card>
                <CardHeader className="bg-gradient-to-r from-pink-50 to-transparent">
                  <CardTitle className="flex items-center gap-2 text-pink-700">
                    <User className="h-5 w-5" />
                    Girls Hostel Configuration
                  </CardTitle>
                  <CardDescription>
                    Configure seat distribution and room settings for girls hostel
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field>
                      <FieldLabel>Hostel Name</FieldLabel>
                      <Input
                        value={formData.girlsHostel.name}
                        onChange={(e) => updateGirlsHostel("name", e.target.value)}
                      />
                    </Field>
                    <Field>
                      <FieldLabel>Seats per Branch/Year</FieldLabel>
                      <Input
                        type="number"
                        min={1}
                        value={formData.girlsHostel.seatsPerBranchYear}
                        onChange={(e) => updateGirlsHostel("seatsPerBranchYear", parseInt(e.target.value))}
                      />
                    </Field>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-3">Category-wise Seat Distribution (Girls)</h3>
                    <div className="grid gap-4 md:grid-cols-4">
                      {CATEGORIES.map((category) => (
                        <Field key={`girls-${category}`}>
                          <FieldLabel>{category}</FieldLabel>
                          <Input
                            type="number"
                            min={0}
                            value={formData.girlsHostel.seatDistribution[category]}
                            onChange={(e) => {
                              setFormData(prev => ({
                                ...prev,
                                girlsHostel: {
                                  ...prev.girlsHostel,
                                  seatDistribution: {
                                    ...prev.girlsHostel.seatDistribution,
                                    [category]: parseInt(e.target.value)
                                  }
                                }
                              }))
                            }}
                          />
                        </Field>
                      ))}
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      Total per branch/year (Girls): {totalGirlsSeats} seats
                    </p>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-3">Room Configuration</h3>
                    <div className="grid gap-4 md:grid-cols-3">
                      <Field>
                        <FieldLabel>Number of Floors</FieldLabel>
                        <Input
                          type="number"
                          min={1}
                          max={10}
                          value={formData.girlsHostel.floors}
                          onChange={(e) => updateGirlsHostel("floors", parseInt(e.target.value))}
                        />
                      </Field>
                      <Field>
                        <FieldLabel>Rooms per Floor</FieldLabel>
                        <Input
                          type="number"
                          min={1}
                          max={50}
                          value={formData.girlsHostel.roomsPerFloor}
                          onChange={(e) => updateGirlsHostel("roomsPerFloor", parseInt(e.target.value))}
                        />
                      </Field>
                      <Field>
                        <FieldLabel>Capacity per Room</FieldLabel>
                        <Input
                          type="number"
                          min={1}
                          max={4}
                          value={formData.girlsHostel.capacityPerRoom}
                          onChange={(e) => updateGirlsHostel("capacityPerRoom", parseInt(e.target.value))}
                        />
                      </Field>
                    </div>
                    <div className="mt-3 p-3 bg-pink-50 rounded-lg">
                      <p className="text-sm text-pink-700">
                        <strong>Total Capacity:</strong> {formData.girlsHostel.floors * formData.girlsHostel.roomsPerFloor * formData.girlsHostel.capacityPerRoom} students
                        <br />
                        <strong>Total Rooms:</strong> {formData.girlsHostel.floors * formData.girlsHostel.roomsPerFloor} rooms
                        {girlsStats && (
                          <>
                            <br />
                            <strong>Current Occupancy:</strong> {girlsStats.totalOccupants} / {girlsStats.totalCapacity} ({Math.round(girlsStats.occupancyRate)}%)
                          </>
                        )}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => handleInitializeRooms("girls")}
                      disabled={initializingGirlsRooms}
                      className="w-full mt-3"
                    >
                      {initializingGirlsRooms ? (
                        <Spinner className="h-4 w-4 mr-2" />
                      ) : (
                        <Building2 className="h-4 w-4 mr-2" />
                      )}
                      Initialize Girls Hostel Rooms
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving} size="lg">
              {saving ? <Spinner className="h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Save All Settings
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}