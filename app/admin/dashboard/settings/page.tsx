"use client"

import { useEffect, useState } from "react"
import { getSettings, updateSettings, initializeSettings, initializeRooms } from "@/lib/firebase/firestore"
import type { Settings, Category } from "@/lib/types"
import { DEFAULT_SEAT_DISTRIBUTION, CATEGORIES } from "@/lib/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "sonner"
import { Save, RefreshCw, Building2 } from "lucide-react"
import { Timestamp } from "firebase/firestore"

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [initializingRooms, setInitializingRooms] = useState(false)

  const [formData, setFormData] = useState({
    applicationDeadline: "",
    confirmationPeriodDays: 3,
    seatsPerBranchYear: 10,
    seatDistribution: { ...DEFAULT_SEAT_DISTRIBUTION },
  })

  useEffect(() => {
    async function fetchSettings() {
      const s = await getSettings()
      if (s) {
        setSettings(s)
        setFormData({
          applicationDeadline: s.applicationDeadline?.toDate?.()?.toISOString().split("T")[0] || "",
          confirmationPeriodDays: s.confirmationPeriodDays,
          seatsPerBranchYear: s.seatsPerBranchYear,
          seatDistribution: s.seatDistribution,
        })
      }
      setLoading(false)
    }
    fetchSettings()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateSettings({
        applicationDeadline: Timestamp.fromDate(new Date(formData.applicationDeadline)),
        confirmationPeriodDays: formData.confirmationPeriodDays,
        seatsPerBranchYear: formData.seatsPerBranchYear,
        seatDistribution: formData.seatDistribution,
      })
      toast.success("Settings saved successfully")
    } catch (error) {
      toast.error("Failed to save settings")
    } finally {
      setSaving(false)
    }
  }

  const handleInitialize = async () => {
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
        })
      }
      toast.success("Settings initialized")
    } catch (error) {
      toast.error("Failed to initialize settings")
    } finally {
      setSaving(false)
    }
  }

  const handleInitializeRooms = async () => {
    setInitializingRooms(true)
    try {
      await initializeRooms()
      toast.success("Rooms initialized: 6 floors x 16 rooms = 96 rooms")
    } catch (error) {
      toast.error("Failed to initialize rooms")
    } finally {
      setInitializingRooms(false)
    }
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
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Configure system parameters</p>
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
            <Button onClick={handleInitialize} disabled={saving}>
              {saving ? <Spinner className="h-4 w-4 mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Initialize Settings
            </Button>
          </CardContent>
        </Card>
      )}

      {settings && (
        <div className="grid gap-6">
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
                    Seats per Branch/Year
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
              <CardTitle>Category-wise Seat Distribution</CardTitle>
              <CardDescription>
                Define seat quotas for each category (per branch/year)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                {CATEGORIES.map((category) => (
                  <Field key={category}>
                    <FieldLabel htmlFor={`seat-${category}`}>{category}</FieldLabel>
                    <Input
                      id={`seat-${category}`}
                      type="number"
                      min={0}
                      value={formData.seatDistribution[category]}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          seatDistribution: {
                            ...formData.seatDistribution,
                            [category]: parseInt(e.target.value),
                          },
                        })
                      }
                    />
                  </Field>
                ))}
              </div>
              <p className="text-sm text-muted-foreground mt-4">
                Total per branch/year:{" "}
                {Object.values(formData.seatDistribution).reduce((a, b) => a + b, 0)} seats
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Room Management</CardTitle>
              <CardDescription>
                Initialize room database (6 floors x 16 rooms x 2 capacity)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                onClick={handleInitializeRooms}
                disabled={initializingRooms}
              >
                {initializingRooms ? (
                  <Spinner className="h-4 w-4 mr-2" />
                ) : (
                  <Building2 className="h-4 w-4 mr-2" />
                )}
                Initialize 96 Rooms
              </Button>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Spinner className="h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Save Settings
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
