import type { Application, Category, Branch, Year, Settings } from "@/lib/types"
import { Timestamp } from "firebase/firestore"

export interface AllocationResult {
  selected: Application[]
  waitlisted: Application[]
}

export function calculateMeritScore(app: Application): number {
  // For 1st year students, use CET marks (out of 200, normalize to 100)
  if (app.year === 1 && app.cetMarks !== undefined) {
    return app.cetMarks / 2 // Assuming CET out of 200
  }
  
  // For 2nd-4th year, use SGPA (out of 10, normalize to 100)
  if (app.sgpa !== undefined) {
    return app.sgpa * 10
  }
  
  return 0
}

export function rankApplications(applications: Application[]): Application[] {
  return [...applications].sort((a, b) => {
    const scoreA = calculateMeritScore(a)
    const scoreB = calculateMeritScore(b)
    
    // Higher score = higher rank (lower rank number)
    if (scoreB !== scoreA) return scoreB - scoreA
    
    // Tie-breaker: earlier submission
    const dateA = a.createdAt instanceof Timestamp ? a.createdAt.toMillis() : 0
    const dateB = b.createdAt instanceof Timestamp ? b.createdAt.toMillis() : 0
    return dateA - dateB
  })
}

export function allocateSeats(
  applications: Application[],
  seatDistribution: Record<Category, number>,
  totalSeats: number
): AllocationResult {
  const selected: Application[] = []
  const waitlisted: Application[] = []
  
  // Group applications by category
  const byCategory = new Map<Category, Application[]>()
  for (const app of applications) {
    const existing = byCategory.get(app.category) || []
    byCategory.set(app.category, [...existing, app])
  }
  
  // Rank within each category
  for (const [category, apps] of byCategory) {
    const ranked = rankApplications(apps)
    byCategory.set(category, ranked)
  }
  
  // Allocate seats per category quota
  const categorySeats = new Map<Category, number>()
  let allocatedTotal = 0
  
  for (const [category, quota] of Object.entries(seatDistribution)) {
    const catApps = byCategory.get(category as Category) || []
    const seatsForCategory = Math.min(quota, catApps.length)
    categorySeats.set(category as Category, seatsForCategory)
    allocatedTotal += seatsForCategory
  }
  
  // First pass: allocate quota seats
  for (const [category, apps] of byCategory) {
    const seats = categorySeats.get(category) || 0
    for (let i = 0; i < apps.length; i++) {
      if (i < seats) {
        selected.push({ ...apps[i], meritRank: selected.length + 1 })
      } else {
        waitlisted.push({ ...apps[i], meritRank: waitlisted.length + 1 })
      }
    }
  }
  
  // If there are remaining seats, fill from waitlist by merit
  const remainingSeats = totalSeats - selected.length
  if (remainingSeats > 0 && waitlisted.length > 0) {
    const rankedWaitlist = rankApplications(waitlisted)
    const toPromote = rankedWaitlist.slice(0, remainingSeats)
    const stillWaitlisted = rankedWaitlist.slice(remainingSeats)
    
    for (const app of toPromote) {
      selected.push({ ...app, meritRank: selected.length + 1 })
    }
    
    waitlisted.length = 0
    for (let i = 0; i < stillWaitlisted.length; i++) {
      waitlisted.push({ ...stillWaitlisted[i], meritRank: i + 1 })
    }
  }
  
  return { selected, waitlisted }
}

export function allocateByBranchYear(
  applications: Application[],
  settings: Settings
): Map<string, AllocationResult> {
  const results = new Map<string, AllocationResult>()
  
  // Group by branch and year
  const groups = new Map<string, Application[]>()
  for (const app of applications) {
    const key = `${app.branch}-${app.year}`
    const existing = groups.get(key) || []
    groups.set(key, [...existing, app])
  }
  
  // Allocate for each group
  for (const [key, apps] of groups) {
    const result = allocateSeats(
      apps,
      settings.seatDistribution,
      settings.seatsPerBranchYear
    )
    results.set(key, result)
  }
  
  return results
}

export function getConfirmationDeadline(settings: Settings): Date {
  const deadline = new Date()
  deadline.setDate(deadline.getDate() + settings.confirmationPeriodDays)
  return deadline
}
