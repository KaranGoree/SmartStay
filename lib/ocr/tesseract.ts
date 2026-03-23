import Tesseract from "tesseract.js"
import type { OCRData, Category } from "@/lib/types"

export interface OCRProgress {
  status: string
  progress: number
}

export async function extractTextFromImage(
  imageFile: File,
  onProgress?: (progress: OCRProgress) => void
): Promise<string> {
  const result = await Tesseract.recognize(imageFile, "eng", {
    logger: (m) => {
      if (onProgress && m.status && typeof m.progress === "number") {
        onProgress({ status: m.status, progress: m.progress })
      }
    },
  })
  
  return result.data.text
}

export function parseMarksheetOCR(text: string): Partial<OCRData> {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean)
  
  // Extract name (usually near "Name" label)
  let extractedName = ""
  const namePatterns = [/name[:\s]+([a-zA-Z\s]+)/i, /student[:\s]+([a-zA-Z\s]+)/i]
  for (const pattern of namePatterns) {
    const match = text.match(pattern)
    if (match) {
      extractedName = match[1].trim()
      break
    }
  }
  
  // Extract marks/percentage/SGPA
  let extractedMarks: number | null = null
  const marksPatterns = [
    /(?:total|aggregate|percentage|cgpa|sgpa)[:\s]*(\d+\.?\d*)/i,
    /(\d+\.?\d*)\s*(?:%|percent|cgpa|sgpa)/i,
    /marks[:\s]*(\d+)/i,
  ]
  for (const pattern of marksPatterns) {
    const match = text.match(pattern)
    if (match) {
      extractedMarks = parseFloat(match[1])
      break
    }
  }
  
  // Extract college name
  let extractedCollege = ""
  const collegePatterns = [
    /government college of engineering[,\s]*nagpur/i,
    /gcoen/i,
    /college[:\s]+([a-zA-Z\s]+)/i,
  ]
  for (const pattern of collegePatterns) {
    const match = text.match(pattern)
    if (match) {
      extractedCollege = match[0].trim()
      break
    }
  }
  
  return {
    extractedName,
    extractedMarks,
    extractedCollege,
    confidence: 0.7, // Base confidence for marksheet
  }
}

export function parseAadhaarOCR(text: string): Partial<OCRData> {
  // Extract Aadhaar number (12 digits, may have spaces)
  let extractedAadhaar = ""
  const aadhaarPattern = /\d{4}\s*\d{4}\s*\d{4}/
  const match = text.match(aadhaarPattern)
  if (match) {
    extractedAadhaar = match[0].replace(/\s/g, "")
  }
  
  // Extract name from Aadhaar
  let extractedName = ""
  const namePatterns = [/(?:name|नाम)[:\s]*([a-zA-Z\s]+)/i]
  for (const pattern of namePatterns) {
    const nameMatch = text.match(pattern)
    if (nameMatch) {
      extractedName = nameMatch[1].trim()
      break
    }
  }
  
  return {
    extractedAadhaar,
    extractedName,
    confidence: 0.8, // Higher confidence for Aadhaar format
  }
}

export function parseCategoryProofOCR(text: string): Partial<OCRData> {
  const textUpper = text.toUpperCase()
  
  // Detect category from certificate
  let extractedCategory = ""
  const categoryKeywords: Record<Category, string[]> = {
    "Open": ["GENERAL", "OPEN"],
    "SC/ST": ["SCHEDULED CASTE", "SCHEDULED TRIBE", "SC", "ST"],
    "VJNT": ["VJNT", "VIMUKTA JATI", "NOMADIC TRIBE"],
    "OBC": ["OTHER BACKWARD CLASS", "OBC"],
    "EWS/SEBC": ["EWS", "ECONOMICALLY WEAKER", "SEBC"],
    "PWD": ["PWD", "PERSON WITH DISABILITY", "DIVYANG"],
  }
  
  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    for (const keyword of keywords) {
      if (textUpper.includes(keyword)) {
        extractedCategory = category
        break
      }
    }
    if (extractedCategory) break
  }
  
  return {
    extractedCategory,
    confidence: extractedCategory ? 0.75 : 0.3,
  }
}

export function calculateSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0
  
  const s1 = str1.toLowerCase().trim()
  const s2 = str2.toLowerCase().trim()
  
  if (s1 === s2) return 1
  
  // Simple Levenshtein-based similarity
  const longer = s1.length > s2.length ? s1 : s2
  const shorter = s1.length > s2.length ? s2 : s1
  
  if (longer.length === 0) return 1
  
  const editDistance = levenshteinDistance(longer, shorter)
  return (longer.length - editDistance) / longer.length
}

function levenshteinDistance(s1: string, s2: string): number {
  const costs: number[] = []
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) {
        costs[j] = j
      } else if (j > 0) {
        let newValue = costs[j - 1]
        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1
        }
        costs[j - 1] = lastValue
        lastValue = newValue
      }
    }
    if (i > 0) {
      costs[s2.length] = lastValue
    }
  }
  return costs[s2.length]
}
