"use client"

import { useEffect, useState } from "react"
import {
  getAllRooms,
  getAllApplications,
  assignRoom,
  updateApplication,
} from "@/lib/firebase/firestore"
import type { Room, Application } from "@/lib/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { RoomGrid } from "@/components/admin/room-grid"
import { toast } from "sonner"
import { BedDouble, Users, Building2, Wand2 } from "lucide-react"

export default function RoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([])
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null)
  const [selectedStudent, setSelectedStudent] = useState<string>("")
  const [assigning, setAssigning] = useState(false)
  const [autoAssigning, setAutoAssigning] = useState(false)

  const fetchData = async () => {
    const [roomData, appData] = await Promise.all([
      getAllRooms(),
      getAllApplications(),
    ])
    setRooms(roomData)
    setApplications(appData)
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [])

  const confirmedWithoutRoom = applications.filter(
    (a) => a.status === "confirmed" && !a.roomNumber
  )

  const stats = {
    total: rooms.length,
    available: rooms.filter((r) => r.status === "available").length,
    partial: rooms.filter((r) => r.status === "partial").length,
    full: rooms.filter((r) => r.status === "full").length,
    totalCapacity: rooms.reduce((acc, r) => acc + r.capacity, 0),
    occupied: rooms.reduce((acc, r) => acc + r.occupants.length, 0),
  }

  const handleAssign = async () => {
    if (!selectedRoom || !selectedStudent) return

    setAssigning(true)
    try {
      const success = await assignRoom(selectedRoom.roomNumber, selectedStudent)
      if (success) {
        await updateApplication(selectedStudent, {
          roomNumber: selectedRoom.roomNumber,
          floor: selectedRoom.floor,
        })
        toast.success("Room assigned successfully")
        await fetchData()
        setSelectedRoom(null)
        setSelectedStudent("")
      } else {
        toast.error("Room is full")
      }
    } catch (error) {
      toast.error("Failed to assign room")
    } finally {
      setAssigning(false)
    }
  }

  const handleAutoAssign = async () => {
    setAutoAssigning(true)
    try {
      const availableRooms = rooms
        .filter((r) => r.status !== "full")
        .sort((a, b) => a.roomNumber.localeCompare(b.roomNumber))

      let assigned = 0
      let roomIndex = 0

      for (const student of confirmedWithoutRoom) {
        while (roomIndex < availableRooms.length) {
          const room = availableRooms[roomIndex]
          if (room.occupants.length < room.capacity) {
            const success = await assignRoom(room.roomNumber, student.id)
            if (success) {
              await updateApplication(student.id, {
                roomNumber: room.roomNumber,
                floor: room.floor,
              })
              room.occupants.push(student.id)
              assigned++
            }
            break
          }
          roomIndex++
        }
      }

      toast.success(`Auto-assigned ${assigned} students to rooms`)
      await fetchData()
    } catch (error) {
      toast.error("Auto-assignment failed")
    } finally {
      setAutoAssigning(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  if (rooms.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Room Management</h1>
          <p className="text-muted-foreground">Manage hostel room assignments</p>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Rooms Initialized</h3>
            <p className="text-muted-foreground mb-4">
              Go to Settings to initialize the room database.
            </p>
            <Button asChild>
              <a href="/admin/dashboard/settings">Go to Settings</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Room Management</h1>
          <p className="text-muted-foreground">Manage hostel room assignments</p>
        </div>
        {confirmedWithoutRoom.length > 0 && (
          <Button onClick={handleAutoAssign} disabled={autoAssigning}>
            {autoAssigning ? (
              <Spinner className="h-4 w-4 mr-2" />
            ) : (
              <Wand2 className="h-4 w-4 mr-2" />
            )}
            Auto-Assign ({confirmedWithoutRoom.length})
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Rooms</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Available
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.available}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              Partial
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.partial}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              Full
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.full}</p>
          </CardContent>
        </Card>
      </div>

      {/* Occupancy */}
      <Card>
        <CardHeader>
          <CardTitle>Occupancy</CardTitle>
          <CardDescription>
            {stats.occupied} of {stats.totalCapacity} beds occupied (
            {Math.round((stats.occupied / stats.totalCapacity) * 100)}%)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-4 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${(stats.occupied / stats.totalCapacity) * 100}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Floor Tabs */}
      <Card>
        <CardHeader>
          <CardTitle>Room Layout</CardTitle>
          <CardDescription>
            Click on a room to view details or assign students
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="1">
            <TabsList className="grid grid-cols-6 mb-4">
              {[1, 2, 3, 4, 5, 6].map((floor) => (
                <TabsTrigger key={floor} value={floor.toString()}>
                  Floor {floor}
                </TabsTrigger>
              ))}
            </TabsList>
            {[1, 2, 3, 4, 5, 6].map((floor) => (
              <TabsContent key={floor} value={floor.toString()}>
                <RoomGrid
                  rooms={rooms}
                  applications={applications}
                  floor={floor}
                  onRoomClick={setSelectedRoom}
                />
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {/* Unassigned Students */}
      {confirmedWithoutRoom.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Awaiting Room Assignment
            </CardTitle>
            <CardDescription>
              {confirmedWithoutRoom.length} confirmed students without rooms
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
              {confirmedWithoutRoom.map((student) => (
                <div
                  key={student.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div>
                    <p className="font-medium text-sm">{student.fullName}</p>
                    <p className="text-xs text-muted-foreground">
                      {student.branch} - Year {student.year}
                    </p>
                  </div>
                  <Badge variant="outline">Pending</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Room Detail Dialog */}
      <Dialog open={!!selectedRoom} onOpenChange={() => setSelectedRoom(null)}>
        <DialogContent>
          {selectedRoom && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <BedDouble className="h-5 w-5" />
                  Room {selectedRoom.roomNumber}
                </DialogTitle>
                <DialogDescription>
                  Floor {selectedRoom.floor} | Capacity: {selectedRoom.capacity}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium mb-2">Current Occupants</h4>
                  {selectedRoom.occupants.length > 0 ? (
                    <div className="space-y-2">
                      {selectedRoom.occupants.map((id) => {
                        const student = applications.find((a) => a.id === id)
                        return student ? (
                          <div
                            key={id}
                            className="flex items-center justify-between p-2 rounded bg-muted"
                          >
                            <div>
                              <p className="text-sm font-medium">{student.fullName}</p>
                              <p className="text-xs text-muted-foreground">
                                {student.branch} - Year {student.year}
                              </p>
                            </div>
                          </div>
                        ) : null
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No occupants</p>
                  )}
                </div>

                {selectedRoom.occupants.length < selectedRoom.capacity && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Assign Student</h4>
                    <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a student" />
                      </SelectTrigger>
                      <SelectContent>
                        {confirmedWithoutRoom.map((student) => (
                          <SelectItem key={student.id} value={student.id}>
                            {student.fullName} ({student.branch} - Y{student.year})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedRoom(null)}>
                  Close
                </Button>
                {selectedRoom.occupants.length < selectedRoom.capacity && (
                  <Button
                    onClick={handleAssign}
                    disabled={!selectedStudent || assigning}
                  >
                    {assigning && <Spinner className="h-4 w-4 mr-2" />}
                    Assign
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
