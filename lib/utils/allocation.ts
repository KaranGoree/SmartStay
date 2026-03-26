import type { Application, Category, Branch, Year, Settings, Hostel } from "@/lib/types"
import { Timestamp } from "firebase/firestore"

export interface AllocationResult {
  selected: Application[]
  waitlisted: Application[]
  byCategory: Map<Category, { selected: Application[], waitlisted: Application[] }>
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
  const byCategory = new Map<Category, { selected: Application[], waitlisted: Application[] }>()
  
  // Initialize byCategory map
  for (const category of Object.keys(seatDistribution) as Category[]) {
    byCategory.set(category, { selected: [], waitlisted: [] })
  }
  
  // Group applications by category
  const appsByCategory = new Map<Category, Application[]>()
  for (const app of applications) {
    const existing = appsByCategory.get(app.category) || []
    appsByCategory.set(app.category, [...existing, app])
  }
  
  // Rank within each category
  for (const [category, apps] of appsByCategory) {
    const ranked = rankApplications(apps)
    appsByCategory.set(category, ranked)
  }
  
  // Allocate seats per category quota
  const categorySeats = new Map<Category, number>()
  let allocatedTotal = 0
  
  for (const [category, quota] of Object.entries(seatDistribution)) {
    const catApps = appsByCategory.get(category as Category) || []
    const seatsForCategory = Math.min(quota, catApps.length)
    categorySeats.set(category as Category, seatsForCategory)
    allocatedTotal += seatsForCategory
  }
  
  // First pass: allocate quota seats
  for (const [category, apps] of appsByCategory) {
    const seats = categorySeats.get(category) || 0
    const categoryResult = byCategory.get(category)!
    
    for (let i = 0; i < apps.length; i++) {
      if (i < seats) {
        const appWithRank = { ...apps[i], meritRank: selected.length + 1, hostel: undefined as any }
        selected.push(appWithRank)
        categoryResult.selected.push(appWithRank)
      } else {
        const appWithRank = { ...apps[i], meritRank: waitlisted.length + 1, hostel: undefined as any }
        waitlisted.push(appWithRank)
        categoryResult.waitlisted.push(appWithRank)
      }
    }
    
    byCategory.set(category, categoryResult)
  }
  
  // If there are remaining seats, fill from waitlist by merit
  const remainingSeats = totalSeats - selected.length
  if (remainingSeats > 0 && waitlisted.length > 0) {
    const rankedWaitlist = rankApplications(waitlisted)
    const toPromote = rankedWaitlist.slice(0, remainingSeats)
    const stillWaitlisted = rankedWaitlist.slice(remainingSeats)
    
    // Update selected and waitlisted
    selected.length = 0
    waitlisted.length = 0
    
    // Add all quota seats back
    for (const [category, apps] of appsByCategory) {
      const seats = categorySeats.get(category) || 0
      for (let i = 0; i < apps.length && i < seats; i++) {
        const app = { ...apps[i], meritRank: selected.length + 1 }
        selected.push(app)
      }
    }
    
    // Add promoted students
    for (const app of toPromote) {
      selected.push({ ...app, meritRank: selected.length + 1 })
    }
    
    // Add remaining waitlisted
    for (let i = 0; i < stillWaitlisted.length; i++) {
      waitlisted.push({ ...stillWaitlisted[i], meritRank: i + 1 })
    }
    
    // Update byCategory with promoted students
    for (const app of toPromote) {
      const categoryResult = byCategory.get(app.category)!
      const index = categoryResult.waitlisted.findIndex(a => a.id === app.id)
      if (index !== -1) {
        categoryResult.waitlisted.splice(index, 1)
        categoryResult.selected.push({ ...app, meritRank: categoryResult.selected.length + 1 })
      }
    }
  }
  
  return { selected, waitlisted, byCategory }
}

export function allocateByHostel(
  hostel: Hostel,
  applications: Application[]
): AllocationResult {
  // Group by branch and year within this hostel
  const groups = new Map<string, Application[]>()
  for (const app of applications) {
    const key = `${app.branch}-${app.year}`
    const existing = groups.get(key) || []
    groups.set(key, [...existing, app])
  }
  
  const allSelected: Application[] = []
  const allWaitlisted: Application[] = []
  const byCategory = new Map<Category, { selected: Application[], waitlisted: Application[] }>()
  
  // Initialize byCategory
  for (const category of Object.keys(hostel.seatDistribution) as Category[]) {
    byCategory.set(category, { selected: [], waitlisted: [] })
  }
  
  // Allocate for each branch-year group
  for (const [key, apps] of groups) {
    const result = allocateSeats(
      apps,
      hostel.seatDistribution,
      hostel.seatsPerBranchYear
    )
    
    // Add hostel assignment
    result.selected.forEach(app => {
      app.hostel = hostel.type
      allSelected.push(app)
      
      const catResult = byCategory.get(app.category)!
      catResult.selected.push(app)
      byCategory.set(app.category, catResult)
    })
    
    result.waitlisted.forEach(app => {
      app.hostel = hostel.type
      allWaitlisted.push(app)
      
      const catResult = byCategory.get(app.category)!
      catResult.waitlisted.push(app)
      byCategory.set(app.category, catResult)
    })
  }
  
  return {
    selected: allSelected,
    waitlisted: allWaitlisted,
    byCategory
  }
}

export function allocateAllHostels(
  settings: Settings,
  applications: Application[]
): {
  boys: AllocationResult
  girls: AllocationResult
  unallocated: Application[]
} {
  // Separate applications by gender
  const maleApplications = applications.filter(app => app.gender === "Male")
  const femaleApplications = applications.filter(app => app.gender === "Female")
  const otherApplications = applications.filter(app => app.gender === "Other")
  
  // Allocate to respective hostels
  const boysAllocation = allocateByHostel(settings.hostels.boys, maleApplications)
  const girlsAllocation = allocateByHostel(settings.hostels.girls, femaleApplications)
  
  // For "Other" gender, we need to handle separately (maybe ask admin to assign manually)
  const unallocated = otherApplications
  
  return {
    boys: boysAllocation,
    girls: girlsAllocation,
    unallocated
  }
}

export function getAllocationStats(
  allocation: {
    boys: AllocationResult
    girls: AllocationResult
  }
): {
  totalSelected: number
  totalWaitlisted: number
  boysSelected: number
  girlsSelected: number
  boysWaitlisted: number
  girlsWaitlisted: number
  byBranchYear: Map<string, { boysSelected: number, girlsSelected: number, totalSelected: number }>
  byCategory: Map<Category, { boysSelected: number, girlsSelected: number, totalSelected: number }>
} {
  let totalSelected = 0
  let totalWaitlisted = 0
  let boysSelected = 0
  let girlsSelected = 0
  let boysWaitlisted = 0
  let girlsWaitlisted = 0
  
  const byBranchYear = new Map<string, { boysSelected: number, girlsSelected: number, totalSelected: number }>()
  const byCategory = new Map<Category, { boysSelected: number, girlsSelected: number, totalSelected: number }>()
  
  // Process boys allocation
  for (const app of allocation.boys.selected) {
    totalSelected++
    boysSelected++
    
    const key = `${app.branch}-${app.year}`
    const existing = byBranchYear.get(key) || { boysSelected: 0, girlsSelected: 0, totalSelected: 0 }
    existing.boysSelected++
    existing.totalSelected++
    byBranchYear.set(key, existing)
    
    const catExisting = byCategory.get(app.category) || { boysSelected: 0, girlsSelected: 0, totalSelected: 0 }
    catExisting.boysSelected++
    catExisting.totalSelected++
    byCategory.set(app.category, catExisting)
  }
  
  for (const app of allocation.boys.waitlisted) {
    totalWaitlisted++
    boysWaitlisted++
  }
  
  // Process girls allocation
  for (const app of allocation.girls.selected) {
    totalSelected++
    girlsSelected++
    
    const key = `${app.branch}-${app.year}`
    const existing = byBranchYear.get(key) || { boysSelected: 0, girlsSelected: 0, totalSelected: 0 }
    existing.girlsSelected++
    existing.totalSelected++
    byBranchYear.set(key, existing)
    
    const catExisting = byCategory.get(app.category) || { boysSelected: 0, girlsSelected: 0, totalSelected: 0 }
    catExisting.girlsSelected++
    catExisting.totalSelected++
    byCategory.set(app.category, catExisting)
  }
  
  for (const app of allocation.girls.waitlisted) {
    totalWaitlisted++
    girlsWaitlisted++
  }
  
  return {
    totalSelected,
    totalWaitlisted,
    boysSelected,
    girlsSelected,
    boysWaitlisted,
    girlsWaitlisted,
    byBranchYear,
    byCategory
  }
}

export function getConfirmationDeadline(settings: Settings): Date {
  const deadline = new Date()
  deadline.setDate(deadline.getDate() + settings.confirmationPeriodDays)
  return deadline
}