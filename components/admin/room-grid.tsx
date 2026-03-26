"use client"

import type { Room, Application } from "@/lib/types"
import { cn } from "@/lib/utils"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { BedDouble, User } from "lucide-react"

interface RoomGridProps {
  rooms: Room[]
  applications: Application[]
  floor: number
  onRoomClick?: (room: Room) => void
  hostelType?: "boys" | "girls"
}

export function RoomGrid({ rooms, applications, floor, onRoomClick, hostelType }: RoomGridProps) {
  const floorRooms = rooms
    .filter((r) => r.floor === floor)
    .sort((a, b) => parseInt(a.roomNumber) - parseInt(b.roomNumber))

  const getOccupants = (room: Room) => {
    return room.occupants
      .map((id) => applications.find((a) => a.id === id))
      .filter(Boolean) as Application[]
  }

  // Color schemes based on hostel type
  const getStatusColors = (room: Room) => {
    const baseColors = {
      full: room.hostel === "boys" 
        ? "bg-red-100 border-red-300 text-red-800 hover:bg-red-200" 
        : "bg-red-100 border-red-300 text-red-800 hover:bg-red-200",
      partial: room.hostel === "boys"
        ? "bg-amber-100 border-amber-300 text-amber-800 hover:bg-amber-200"
        : "bg-amber-100 border-amber-300 text-amber-800 hover:bg-amber-200",
      available: room.hostel === "boys"
        ? "bg-blue-100 border-blue-300 text-blue-800 hover:bg-blue-200"
        : "bg-pink-100 border-pink-300 text-pink-800 hover:bg-pink-200",
    }

    switch (room.status) {
      case "full":
        return baseColors.full
      case "partial":
        return baseColors.partial
      default:
        return baseColors.available
    }
  }

  const getHostelIcon = () => {
    if (hostelType === "boys") {
      return <User className="h-3 w-3 text-blue-600" />
    } else if (hostelType === "girls") {
      return <User className="h-3 w-3 text-pink-600" />
    }
    return null
  }

  if (floorRooms.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No rooms on floor {floor} for {hostelType === "boys" ? "Boys" : "Girls"} hostel
      </div>
    )
  }

  return (
    <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
      <TooltipProvider>
        {floorRooms.map((room) => {
          const occupants = getOccupants(room)
          const statusColor = getStatusColors(room)

          return (
            <Tooltip key={room.id || room.roomNumber}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onRoomClick?.(room)}
                  className={cn(
                    "aspect-square rounded-lg border-2 flex flex-col items-center justify-center p-2 transition-all hover:scale-105",
                    statusColor
                  )}
                >
                  {getHostelIcon()}
                  <BedDouble className="h-4 w-4 mb-1 mt-1" />
                  <span className="text-xs font-bold">{room.roomNumber}</span>
                  <span className="text-[10px]">
                    {occupants.length}/{room.capacity}
                  </span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <div className="text-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium">Room {room.roomNumber}</p>
                    <span className={cn(
                      "text-xs px-1.5 py-0.5 rounded-full",
                      room.hostel === "boys" ? "bg-blue-100 text-blue-700" : "bg-pink-100 text-pink-700"
                    )}>
                      {room.hostel === "boys" ? "Boys" : "Girls"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Floor {room.floor} | {occupants.length}/{room.capacity} occupied
                  </p>
                  {room.status === "full" && (
                    <p className="text-xs text-red-600 mt-1">⚠️ Room is full</p>
                  )}
                  {room.status === "partial" && (
                    <p className="text-xs text-amber-600 mt-1">
                      ⚠️ {room.capacity - occupants.length} seat(s) available
                    </p>
                  )}
                  {room.status === "available" && (
                    <p className="text-xs text-emerald-600 mt-1">
                      ✓ {room.capacity} seats available
                    </p>
                  )}
                  {occupants.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <p className="text-xs font-semibold">Current Occupants:</p>
                      {occupants.map((occ) => (
                        <div key={occ.id} className="text-xs border-l-2 pl-2 border-gray-300">
                          <p className="font-medium">{occ.fullName}</p>
                          <p className="text-muted-foreground">
                            {occ.branch} - Year {occ.year}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          )
        })}
      </TooltipProvider>
    </div>
  )
}