"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useAuth } from "@/components/auth/auth-provider"
import {
  Building2,
  LayoutDashboard,
  FileText,
  BedDouble,
  Users,
  Settings,
  ChevronLeft,
  LogOut,
  ClipboardList,
  CheckSquare,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useState } from "react"
import { useRouter } from "next/navigation"

interface SidebarProps {
  type: "student" | "admin"
}

const studentLinks = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/application", label: "Application", icon: FileText },
  { href: "/dashboard/status", label: "Status", icon: ClipboardList },
]

const adminLinks = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/dashboard/applications", label: "Applications", icon: FileText },
  { href: "/admin/dashboard/allocation", label: "Seat Allocation", icon: CheckSquare },
  { href: "/admin/dashboard/rooms", label: "Rooms", icon: BedDouble },
  { href: "/admin/dashboard/settings", label: "Settings", icon: Settings },
]

export function Sidebar({ type }: SidebarProps) {
  const pathname = usePathname()
  const { signOut, userData } = useAuth()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)

  const links = type === "admin" ? adminLinks : studentLinks

  const handleSignOut = async () => {
    await signOut()
    router.push("/")
  }

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen border-r bg-sidebar transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="flex h-16 items-center justify-between border-b px-4">
          <Link href="/" className="flex items-center gap-2">
            <Building2 className="h-6 w-6 text-sidebar-primary" />
            {!collapsed && <span className="font-semibold">SmartStay</span>}
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setCollapsed(!collapsed)}
          >
            <ChevronLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-2">
          {links.map((link) => {
            const Icon = link.icon
            const isActive = pathname === link.href
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span>{link.label}</span>}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="border-t p-2">
          {!collapsed && (
            <div className="mb-2 px-3 py-2">
              <p className="text-xs text-muted-foreground truncate">{userData?.email}</p>
              <p className="text-xs font-medium capitalize">{type}</p>
            </div>
          )}
          <Button
            variant="ghost"
            className={cn(
              "w-full justify-start gap-3 text-destructive hover:text-destructive hover:bg-destructive/10",
              collapsed && "justify-center px-0"
            )}
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed && <span>Sign Out</span>}
          </Button>
        </div>
      </div>
    </aside>
  )
}
