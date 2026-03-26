import type { Timestamp } from "firebase/firestore"

export type UserRole = "student" | "admin"

export type Branch = "Civil" | "ETC" | "Mechanical" | "Electrical" | "CSE"
export type Year = 1 | 2 | 3 | 4
export type Category = "Open" | "SC" | "ST" | "VJNT" | "OBC" | "EWS" | "SEBC" | "PWD"
export type AdmissionType = "CET" | "SGPA"
export type ApplicationStatus = "draft" | "pending" | "selected" | "waitlisted" | "confirmed" | "expired" | "rejected"
export type ValidationStatus = "verified" | "warning" | "error" | "pending"
export type Gender = "Male" | "Female" | "Other"

export interface User {
  uid: string
  email: string
  role: UserRole
  createdAt: Timestamp
}

export interface OCRData {
  extractedName: string
  extractedMarks: number | null
  extractedCategory: string
  extractedAadhaar: string
  extractedCollege: string
  confidence: number
}

export interface ValidationResult {
  nameMatch: ValidationStatus
  marksMatch: ValidationStatus
  categoryMatch: ValidationStatus
  aadhaarMatch: ValidationStatus
}

export interface Documents {
  marksheet: string
  aadhaarCard: string
  categoryProof?: string
  profilePhoto?: string
  signature?: string
}

export interface Application {
  id: string
  userId: string
  status: ApplicationStatus
  
  // Student Info
  fullName: string
  email: string
  phone: string
  gender: Gender  // Make required, not optional
  branch: Branch
  year: Year
  category: Category
  aadhaarNumber: string
  
  // Academic
  admissionType: AdmissionType
  cetMarks?: number
  sgpa?: number
  
  // Documents
  documents: Documents
  
  // OCR Data
  ocrData: OCRData
  
  // Validation
  validation: ValidationResult
  
  // Additional validation data
  crossDocumentValidation?: any
  extractedData?: any
  userInputVerification?: any
  meritRank?: number
  
  // Allocation
  hostel?: "boys" | "girls"  // Add hostel assignment
  roomNumber?: string
  floor?: number
  confirmationDeadline?: Timestamp
  submittedAt?: string
  
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface Room {
  roomNumber: string
  floor: number
  capacity: number
  occupants: string[]
  hostel: "boys" | "girls"
  status: "available" | "partial" | "full"
}

export interface Hostel {
  name: string
  type: "boys" | "girls"
  totalCapacity: number
  rooms: Room[]
  seatDistribution: Record<Category, number>  // Gender-specific seat distribution
  seatsPerBranchYear: number
}

export interface Settings {
  applicationDeadline: Timestamp
  confirmationPeriodDays: number
  seatDistribution: Record<Category, number>  // Default distribution
  seatsPerBranchYear: number
  hostels: {
    boys: Hostel
    girls: Hostel
  }
}

export const BRANCHES: Branch[] = ["Civil", "ETC", "Mechanical", "Electrical", "CSE"]
export const YEARS: Year[] = [1, 2, 3, 4]
export const CATEGORIES: Category[] = ["Open", "SC", "ST", "VJNT", "OBC", "EWS", "SEBC", "PWD"]
export const GENDERS: Gender[] = ["Male", "Female", "Other"]

export const DEFAULT_SEAT_DISTRIBUTION: Record<Category, number> = {
  "Open": 3,
  "SC": 2,
  "ST": 2,
  "VJNT": 1,
  "OBC": 2,
  "EWS": 1,
  "SEBC": 1,
  "PWD": 1
}