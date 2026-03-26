// lib/utils/document-verification.ts

export const normalizeText = (text: string): string => {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Extract name from OCR text
export const extractNameFromText = (text: string): string | null => {
  const patterns = [
    /Student Name\s*:\s*([A-Za-z\s\.]{2,})/i,
    /Name[:\s]+([A-Za-z\s\.]{2,})/i,
    /Candidate Name[:\s]+([A-Za-z\s\.]+)/i,
    /Full Name[:\s]+([A-Za-z\s\.]+)/i,
  ]
  
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match && match[1] && match[1].trim().length >= 2) {
      let name = match[1].trim()
      name = name.replace(/Roll No\.?\s*\d*/i, '').trim()
      name = name.replace(/Enrol\.? No\.?\s*\d*/i, '').trim()
      return name
    }
  }
  return null
}

// Extract Aadhaar from OCR text
export const extractAadhaarFromText = (text: string): string | null => {
  const aadhaarMatch = text.match(/\b(\d{4}[\s-]?\d{4}[\s-]?\d{4})\b/)
  if (aadhaarMatch) {
    const cleaned = aadhaarMatch[1].replace(/[\s-]/g, '')
    if (/^\d{12}$/.test(cleaned)) return cleaned
  }
  return null
}

// Extract SGPA from OCR text - IMPROVED
export const extractSGPAFromText = (text: string): number | null => {
  // First, look for explicit SGPA patterns
  const explicitPatterns = [
    /SGPA\s*:\s*(\d+\.?\d*)/i,
    /SGPA:\s*(\d+\.?\d*)/i,
    /SGPA\s+(\d+\.?\d*)/i,
    /SGPA\s*=\s*(\d+\.?\d*)/i,
    /SGPA\s*-\s*(\d+\.?\d*)/i,
    /\|\s*SGPA\s*\|\s*(\d+\.?\d*)\s*\|/i,
  ]
  
  for (const pattern of explicitPatterns) {
    const match = text.match(pattern)
    if (match && match[1]) {
      const num = Number(match[1])
      if (!isNaN(num) && num >= 0 && num <= 10) {
        return Math.round(num * 100) / 100
      }
    }
  }
  
  // Look for SGPA in the summary section (last 30 lines)
  const lines = text.split('\n')
  const lastLines = lines.slice(-30).join('\n')
  
  // Pattern for SGPA in table format like: | 184.00 | 24.00 | 7.67 | 10.00 |
  const tablePattern = /\|\s*\d+\.?\d*\s*\|\s*\d+\.?\d*\s*\|\s*(\d+\.?\d{1,2})\s*\|\s*10\.00\s*\|/i
  const tableMatch = lastLines.match(tablePattern)
  if (tableMatch && tableMatch[1]) {
    const num = Number(tableMatch[1])
    if (!isNaN(num) && num >= 0 && num <= 10) {
      return Math.round(num * 100) / 100
    }
  }
  
  // Look for any decimal number in the last 30 lines that could be SGPA
  const decimalPattern = /\b(\d+\.\d{1,2})\b/g
  const matches = [...lastLines.matchAll(decimalPattern)]
  const candidates: number[] = []
  
  for (const match of matches) {
    const num = Number(match[1])
    // SGPA is typically between 4.0 and 9.9
    if (num >= 4.0 && num <= 9.9) {
      candidates.push(num)
    }
  }
  
  if (candidates.length > 0) {
    // Sort descending and take the most likely candidate
    candidates.sort((a, b) => b - a)
    return Math.round(candidates[0] * 100) / 100
  }
  
  return null
}

// Extract category from OCR text - IMPROVED for Maratha/SEBC
export const extractCategoryFromText = (text: string): string | null => {
  // Check for Maratha first - this should return SEBC
  if (/maratha/i.test(text)) {
    return "SEBC"
  }
  
  // Check for explicit category mentions
  const categoryMap = [
    { pattern: /\bSEBC\b/i, value: "SEBC" },
    { pattern: /SOCIALLY ECONOMICALLY BACKWARD CLASS/i, value: "SEBC" },
    { pattern: /\bOBC\b/i, value: "OBC" },
    { pattern: /OTHER BACKWARD CLASS/i, value: "OBC" },
    { pattern: /\bSC\b/i, value: "SC" },
    { pattern: /SCHEDULED CASTE/i, value: "SC" },
    { pattern: /\bST\b/i, value: "ST" },
    { pattern: /SCHEDULED TRIBE/i, value: "ST" },
    { pattern: /\bVJNT\b/i, value: "VJNT" },
    { pattern: /VIMUKTA JATI/i, value: "VJNT" },
    { pattern: /\bNT\b/i, value: "NT" },
    { pattern: /\bEWS\b/i, value: "EWS" },
    { pattern: /ECONOMICALLY WEAKER SECTION/i, value: "EWS" },
    { pattern: /\bOPEN\b/i, value: "OPEN" },
    { pattern: /\bGENERAL\b/i, value: "OPEN" },
  ]
  
  for (const { pattern, value } of categoryMap) {
    if (pattern.test(text)) {
      return value
    }
  }
  
  // Check for category in "Caste:" field
  const casteMatch = text.match(/Caste[:\s]+([A-Za-z\s\/]+)/i)
  if (casteMatch && casteMatch[1]) {
    const casteValue = casteMatch[1].trim().toUpperCase()
    if (casteValue.includes("MARATHA")) return "SEBC"
    if (casteValue.includes("OBC")) return "OBC"
    if (casteValue.includes("SC")) return "SC"
    if (casteValue.includes("ST")) return "ST"
    if (casteValue.includes("VJNT")) return "VJNT"
    if (casteValue.includes("EWS")) return "EWS"
  }
  
  // Check for category in "Category:" field
  const categoryMatch = text.match(/Category[:\s]+([A-Za-z\s\/]+)/i)
  if (categoryMatch && categoryMatch[1]) {
    const categoryValue = categoryMatch[1].trim().toUpperCase()
    if (categoryValue.includes("MARATHA")) return "SEBC"
    if (categoryValue.includes("OBC")) return "OBC"
    if (categoryValue.includes("SC")) return "SC"
    if (categoryValue.includes("ST")) return "ST"
    if (categoryValue.includes("VJNT")) return "VJNT"
    if (categoryValue.includes("EWS")) return "EWS"
  }
  
  return null
}

// Extract college from OCR text
export const extractCollegeFromText = (text: string): string | null => {
  // Always check for GCOEN first
  if (text.match(/GOVERNMENT COLLEGE OF ENGINEERING,? NAGPUR/i)) {
    return "Government College of Engineering, Nagpur"
  }
  
  const collegePatterns = [
    /College[:\s]+([A-Za-z\s,\.]{5,})/i,
    /Institute[:\s]+([A-Za-z\s,\.]{5,})/i,
    /University[:\s]+([A-Za-z\s,\.]{5,})/i,
    /([A-Z][a-z]+ (?:College|Institute|University) of [A-Za-z\s,]+)/i,
  ]
  
  for (const pattern of collegePatterns) {
    const match = text.match(pattern)
    if (match && match[1] && match[1].trim().length > 5) {
      return match[1].trim()
    }
  }
  
  return null
}

// Calculate name similarity (0-100) - defined only once
export const calculateNameSimilarity = (name1: string, name2: string): number => {
  if (!name1 || !name2) return 0
  
  const norm1 = normalizeText(name1)
  const norm2 = normalizeText(name2)
  
  if (norm1 === norm2) return 100
  
  if (norm1.includes(norm2) || norm2.includes(norm1)) {
    return 85
  }
  
  const words1 = norm1.split(' ')
  const words2 = norm2.split(' ')
  
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
  return (matchingWords / totalUniqueWords) * 100
}

// Extract all data from OCR text
export const extractAllDataFromOCR = (text: string) => {
  return {
    fullName: extractNameFromText(text),
    aadhaarNumber: extractAadhaarFromText(text),
    sgpa: extractSGPAFromText(text),
    category: extractCategoryFromText(text),
    college: extractCollegeFromText(text),
  }
}

// Validate cross-documents without AI
export const validateDocumentsWithoutAI = (
  marksheetText: string,
  aadhaarText: string,
  categoryText: string | null,
  selectedCategory?: string
) => {
  const marksheetData = extractAllDataFromOCR(marksheetText)
  const aadhaarData = extractAllDataFromOCR(aadhaarText)
  const categoryData = categoryText ? extractAllDataFromOCR(categoryText) : null
  
  const issues: string[] = []
  const warnings: string[] = []
  
  console.log("📊 Marksheet Data:", marksheetData)
  console.log("📊 Aadhaar Data:", aadhaarData)
  console.log("📊 Category Data:", categoryData)
  
  // Validate name consistency
  if (marksheetData.fullName && aadhaarData.fullName) {
    const similarity = calculateNameSimilarity(marksheetData.fullName, aadhaarData.fullName)
    if (similarity < 60) {
      issues.push(`Name mismatch: Marksheet shows "${marksheetData.fullName}" but Aadhaar shows "${aadhaarData.fullName}"`)
    } else if (similarity < 80) {
      warnings.push(`Name similarity is ${similarity.toFixed(0)}% between Marksheet and Aadhaar`)
    }
  }
  
  // Validate name with category certificate
  if (selectedCategory && selectedCategory !== "Open" && marksheetData.fullName && categoryData?.fullName) {
    const similarity = calculateNameSimilarity(marksheetData.fullName, categoryData.fullName)
    if (similarity < 60) {
      issues.push(`Name mismatch: Marksheet shows "${marksheetData.fullName}" but Category Certificate shows "${categoryData.fullName}"`)
    } else if (similarity < 80) {
      warnings.push(`Name similarity is ${similarity.toFixed(0)}% between Marksheet and Category Certificate`)
    }
  }
  
  // Validate category
  if (selectedCategory && selectedCategory !== "Open" && categoryData?.category) {
    const extractedCat = categoryData.category
    const selectedCat = selectedCategory
    
    // Special handling for EWS/SEBC
    if (selectedCat === "SEBC" && extractedCat === "SEBC") {
      // Valid match
    } else if (selectedCat === "EWS" && extractedCat === "EWS") {
      // Valid match
    } else if (!extractedCat.includes(selectedCat) && !selectedCat.includes(extractedCat)) {
      warnings.push(`Category mismatch: You selected "${selectedCategory}" but certificate shows "${categoryData.category}"`)
    }
  }
  
  // Determine best name
  const allNames = [marksheetData.fullName, aadhaarData.fullName, categoryData?.fullName].filter(n => n)
  let bestName = marksheetData.fullName || aadhaarData.fullName || null
  
  if (allNames.length > 1) {
    const nameFrequency = new Map()
    allNames.forEach(name => {
      const normalized = normalizeText(name!)
      nameFrequency.set(normalized, (nameFrequency.get(normalized) || 0) + 1)
    })
    
    let maxFrequency = 0
    for (const [normalized, count] of nameFrequency) {
      if (count > maxFrequency) {
        maxFrequency = count
        const originalName = allNames.find(n => normalizeText(n!) === normalized)
        if (originalName) bestName = originalName
      }
    }
  }
  
  const isValid = issues.length === 0
  const matchScore = isValid ? Math.max(80, 100 - warnings.length * 10) : 30
  
  return {
    isValid,
    matchScore,
    issues,
    warnings,
    data: {
      marksheet: marksheetData,
      aadhaar: aadhaarData,
      category: categoryData,
    },
    combinedData: {
      fullName: bestName,
      aadhaarNumber: aadhaarData.aadhaarNumber,
      marks: marksheetData.sgpa,
      sgpa: marksheetData.sgpa,
      category: categoryData?.category || marksheetData.category,
      college: marksheetData.college,
    }
  }
}