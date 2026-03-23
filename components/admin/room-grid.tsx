"use client"

import type { Room, Application } from "@/lib/types"
import { cn } from "@/lib/utils"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { BedDouble } from "lucide-react"

interface RoomGridProps {
  rooms: Room[]
  applications: Application[]
  floor: number
  onRoomClick?: (room: Room) => void
}

export function RoomGrid({ rooms, applications, floor, onRoomClick }: RoomGridProps) {
  const floorRooms = rooms
    .filter((r) => r.floor === floor)
    .sort((a, b) => parseInt(a.roomNumber) - parseInt(b.roomNumber))

  const getOccupants = (room: Room) => {
    return room.occupants
      .map((id) => applications.find((a) => a.id === id))
      .filter(Boolean) as Application[]
  }

  return (
    <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
      <TooltipProvider>
        {floorRooms.map((room) => {
          const occupants = getOccupants(room)
          const statusColor =
            room.status === "full"
              ? "bg-red-100 border-red-300 text-red-800"
              : room.status === "partial"
              ? "bg-amber-100 border-amber-300 text-amber-800"
              : "bg-emerald-100 border-emerald-300 text-emerald-800"

          return (
            <Tooltip key={room.roomNumber}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onRoomClick?.(room)}
                  className={cn(
                    "aspect-square rounded-lg border-2 flex flex-col items-center justify-center p-2 transition-all hover:scale-105",
                    statusColor
                  )}
                >
                  <BedDouble className="h-4 w-4 mb-1" />
                  <span className="text-xs font-bold">{room.roomNumber}</span>
                  <span className="text-[10px]">
                    {occupants.length}/{room.capacity}
                  </span>
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-sm">
                  <p className="font-medium">Room {room.roomNumber}</p>
                  <p className="text-xs text-muted-foreground">
                    Floor {room.floor} | {occupants.length}/{room.capacity} occupied
                  </p>
                  {occupants.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {occupants.map((occ) => (
                        <p key={occ.id} className="text-xs">
                          {occ.fullName} ({occ.branch})
                        </p>
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
