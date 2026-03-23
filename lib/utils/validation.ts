import type { ValidationResult, ValidationStatus, OCRData } from "@/lib/types"
import { calculateSimilarity } from "@/lib/ocr/tesseract"

const EXACT_MATCH_THRESHOLD = 0.95
const PARTIAL_MATCH_THRESHOLD = 0.7
const CROSS_DOCUMENT_THRESHOLD = 0.8

export function validateField(
  userValue: string | number | undefined,
  ocrValue: string | number | undefined | null
): ValidationStatus {
  if (ocrValue === null || ocrValue === undefined || ocrValue === "") {
    return "pending"
  }
  
  if (userValue === undefined || userValue === "") {
    return "pending"
  }
  
  // For numbers, compare directly
  if (typeof userValue === "number" && typeof ocrValue === "number") {
    const diff = Math.abs(userValue - ocrValue)
    const maxVal = Math.max(Math.abs(userValue), Math.abs(ocrValue))
    const similarity = maxVal === 0 ? 1 : 1 - diff / maxVal
    
    if (similarity >= EXACT_MATCH_THRESHOLD) return "verified"
    if (similarity >= PARTIAL_MATCH_THRESHOLD) return "warning"
    return "error"
  }
  
  // For strings, use similarity score
  const similarity = calculateSimilarity(String(userValue), String(ocrValue))
  
  if (similarity >= EXACT_MATCH_THRESHOLD) return "verified"
  if (similarity >= PARTIAL_MATCH_THRESHOLD) return "warning"
  return "error"
}

// Normalize name for comparison (remove special chars, normalize spaces)
export function normalizeName(name: string): string {
  if (!name) return ""
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .split(' ')
    .filter(word => word.length > 1)
    .join(' ')
}

// Calculate name similarity between two names
export function calculateNameSimilarity(name1: string, name2: string): number {
  if (!name1 || !name2) return 0
  
  const norm1 = normalizeName(name1)
  const norm2 = normalizeName(name2)
  
  if (norm1 === norm2) return 100
  
  // Check if one contains the other
  if (norm1.includes(norm2) || norm2.includes(norm1)) {
    return 85
  }
  
  // Split into words
  const words1 = norm1.split(' ')
  const words2 = norm2.split(' ')
  
  // Check word overlap
  let matchingWords = 0
  for (const word1 of words1) {
    for (const word2 of words2) {
      if (word1 === word2 || word1.includes(word2) || word2.includes(word1)) {
        matchingWords++
        break
      }
    }
  }
  
  const totalUniqueWords = new Set([...words1, ...words2]).size
  const wordMatchPercentage = (matchingWords / totalUniqueWords) * 100
  
  // Check first name and last name similarity
  const firstName1 = words1[0] || ""
  const firstName2 = words2[0] || ""
  const lastName1 = words1[words1.length - 1] || ""
  const lastName2 = words2[words2.length - 1] || ""
  
  let firstNameMatch = firstName1 === firstName2 || 
                      firstName1.includes(firstName2) || 
                      firstName2.includes(firstName1)
  let lastNameMatch = lastName1 === lastName2 || 
                     lastName1.includes(lastName2) || 
                     lastName2.includes(lastName1)
  
  if (firstNameMatch && lastNameMatch) {
    return Math.max(wordMatchPercentage, 75)
  }
  
  return wordMatchPercentage
}

// Cross-document validation interface
export interface CrossDocumentValidation {
  isValid: boolean
  matchScore: number
  issues: string[]
  warnings: string[]
  details: {
    marksheetVsAadhaar: { similarity: number; status: ValidationStatus }
    marksheetVsCategory: { similarity: number; status: ValidationStatus }
    aadhaarVsCategory: { similarity: number; status: ValidationStatus }
    bestName: string | null
  }
}

// Validate documents across each other
export function validateCrossDocuments(
  marksheetData: { fullName: string | null; marks: number | null; college: string | null },
  aadhaarData: { fullName: string | null; aadhaarNumber: string | null },
  categoryData: { fullName: string | null; category: string | null },
  selectedCategory?: string
): CrossDocumentValidation {
  const issues: string[] = []
  const warnings: string[] = []
  let matchScore = 100
  
  const marksheetName = marksheetData.fullName
  const aadhaarName = aadhaarData.fullName
  const categoryName = categoryData.fullName
  
  let marksheetVsAadhaar = { similarity: 0, status: "pending" as ValidationStatus }
  let marksheetVsCategory = { similarity: 0, status: "pending" as ValidationStatus }
  let aadhaarVsCategory = { similarity: 0, status: "pending" as ValidationStatus }
  
  // Compare Marksheet vs Aadhaar
  if (marksheetName && aadhaarName) {
    const similarity = calculateNameSimilarity(marksheetName, aadhaarName)
    marksheetVsAadhaar = { similarity, status: "pending" as ValidationStatus }
    
    if (similarity >= CROSS_DOCUMENT_THRESHOLD) {
      marksheetVsAadhaar.status = "verified"
    } else if (similarity >= PARTIAL_MATCH_THRESHOLD) {
      marksheetVsAadhaar.status = "warning"
      warnings.push(`Name similarity is ${similarity.toFixed(0)}% between Marksheet ("${marksheetName}") and Aadhaar ("${aadhaarName}")`)
      matchScore = Math.min(matchScore, 70)
    } else {
      marksheetVsAadhaar.status = "error"
      issues.push(`Name mismatch: Marksheet shows "${marksheetName}" but Aadhaar shows "${aadhaarName}"`)
      matchScore = Math.min(matchScore, 30)
    }
  } else if (marksheetName && !aadhaarName) {
    warnings.push("Aadhaar name not extracted. Please verify manually.")
    marksheetVsAadhaar.status = "warning"
  } else if (!marksheetName && aadhaarName) {
    warnings.push("Marksheet name not extracted. Please verify manually.")
    marksheetVsAadhaar.status = "warning"
  }
  
  // Compare Marksheet vs Category Certificate
  if (selectedCategory && selectedCategory !== "Open" && marksheetName && categoryName) {
    const similarity = calculateNameSimilarity(marksheetName, categoryName)
    marksheetVsCategory = { similarity, status: "pending" as ValidationStatus }
    
    if (similarity >= CROSS_DOCUMENT_THRESHOLD) {
      marksheetVsCategory.status = "verified"
    } else if (similarity >= PARTIAL_MATCH_THRESHOLD) {
      marksheetVsCategory.status = "warning"
      warnings.push(`Name similarity is ${similarity.toFixed(0)}% between Marksheet ("${marksheetName}") and Category Certificate ("${categoryName}")`)
      matchScore = Math.min(matchScore, 70)
    } else {
      marksheetVsCategory.status = "error"
      issues.push(`Name mismatch: Marksheet shows "${marksheetName}" but Category Certificate shows "${categoryName}"`)
      matchScore = Math.min(matchScore, 30)
    }
  } else if (selectedCategory && selectedCategory !== "Open" && marksheetName && !categoryName) {
    warnings.push("Category certificate name not extracted. Please verify manually.")
    marksheetVsCategory.status = "warning"
  }
  
  // Compare Aadhaar vs Category Certificate
  if (selectedCategory && selectedCategory !== "Open" && aadhaarName && categoryName) {
    const similarity = calculateNameSimilarity(aadhaarName, categoryName)
    aadhaarVsCategory = { similarity, status: "pending" as ValidationStatus }
    
    if (similarity >= CROSS_DOCUMENT_THRESHOLD) {
      aadhaarVsCategory.status = "verified"
    } else if (similarity >= PARTIAL_MATCH_THRESHOLD) {
      aadhaarVsCategory.status = "warning"
      warnings.push(`Name similarity is ${similarity.toFixed(0)}% between Aadhaar ("${aadhaarName}") and Category Certificate ("${categoryName}")`)
    } else if (similarity < PARTIAL_MATCH_THRESHOLD && similarity > 0) {
      aadhaarVsCategory.status = "warning"
      warnings.push(`Name similarity is low (${similarity.toFixed(0)}%) between Aadhaar and Category Certificate`)
    }
  }
  
  // Determine best name (most common across documents)
  const allNames = [marksheetName, aadhaarName, categoryName].filter(n => n)
  const nameFrequency = new Map()
  allNames.forEach(name => {
    const normalized = normalizeName(name)
    nameFrequency.set(normalized, (nameFrequency.get(normalized) || 0) + 1)
  })
  
  let bestName = marksheetName || aadhaarName || categoryName
  let maxFrequency = 0
  for (const [normalized, count] of nameFrequency) {
    if (count > maxFrequency) {
      maxFrequency = count
      const originalName = allNames.find(n => normalizeName(n) === normalized)
      if (originalName) bestName = originalName
    }
  }
  
  const isValid = issues.length === 0 && matchScore >= 50
  
  return {
    isValid,
    matchScore,
    issues,
    warnings,
    details: {
      marksheetVsAadhaar,
      marksheetVsCategory,
      aadhaarVsCategory,
      bestName
    }
  }
}

// Enhanced validation that includes cross-document validation
export function validateApplication(
  userInput: {
    fullName: string
    cetMarks?: number
    sgpa?: number
    category: string
    aadhaarNumber: string
  },
  ocrData: OCRData,
  crossDocumentValidation?: CrossDocumentValidation
): ValidationResult {
  const marks = userInput.cetMarks ?? userInput.sgpa
  
  const validationResult = {
    nameMatch: validateField(userInput.fullName, ocrData.extractedName),
    marksMatch: validateField(marks, ocrData.extractedMarks),
    categoryMatch: validateField(userInput.category, ocrData.extractedCategory),
    aadhaarMatch: validateField(
      userInput.aadhaarNumber.replace(/\s/g, ""),
      ocrData.extractedAadhaar?.replace(/\s/g, "") || ""
    ),
  }
  
  // Add cross-document validation status if available
  if (crossDocumentValidation) {
    return {
      ...validationResult,
      crossDocumentStatus: crossDocumentValidation.isValid ? "verified" : "error",
      crossDocumentIssues: crossDocumentValidation.issues,
      crossDocumentWarnings: crossDocumentValidation.warnings,
      crossDocumentScore: crossDocumentValidation.matchScore
    }
  }
  
  return validationResult
}

export function getValidationIcon(status: ValidationStatus): string {
  switch (status) {
    case "verified":
      return "check-circle"
    case "warning":
      return "alert-triangle"
    case "error":
      return "x-circle"
    case "pending":
      return "clock"
    default:
      return "help-circle"
  }
}

export function getValidationColor(status: ValidationStatus): string {
  switch (status) {
    case "verified":
      return "text-emerald-600"
    case "warning":
      return "text-amber-500"
    case "error":
      return "text-red-500"
    case "pending":
      return "text-muted-foreground"
    default:
      return "text-muted-foreground"
  }
}

export function getOverallValidationStatus(validation: ValidationResult): ValidationStatus {
  const statuses = Object.values(validation).filter(v => typeof v === "string") as ValidationStatus[]
  
  if (statuses.includes("error")) return "error"
  if (statuses.includes("warning")) return "warning"
  if (statuses.every((s) => s === "verified")) return "verified"
  return "pending"
}