import { NextResponse } from "next/server"
import groq from "@/lib/groq"

export async function POST(req: Request) {
  try {
    const { text } = await req.json()

    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        { error: "No OCR text provided" },
        { status: 400 }
      )
    }

    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      temperature: 0,
      messages: [
        {
          role: "system",
          content: `
You are an OCR data extractor for Indian educational documents.

Extract the following fields from the provided text and return ONLY valid JSON. DO NOT add any other text, explanations, or markdown.

Fields to extract:
- fullName: Student's full name
- aadhaarNumber: 12-digit Aadhaar number
- sgpa: SGPA/CGPA value (numeric, 0-10)
- category: Caste/Category (SC, ST, OBC, VJNT, EWS, Open, etc.)
- college: College/Institute name

full name rule 
 - Check every document for name 
 - Rashtrasant Tukadoji Maharaj is a university name so never write it as name

Category Rules:
-Whenever you see " Maratha " in extracted text return as "SEBC"
- For OBC with caste name: return exactly "OBC"
- For SC: return "SC"
- For ST: return "ST"
- For VJNT: return "VJNT"
- For EWS: return "EWS"
- For Maratha: return "SEBC" also refered as socially economically bacword classes
- For Open/General: return "OPEN"
- Do NOT include caste names like "Kunbi" or "Maratha" in the category field
- Return only the category abbreviation

SGPA Rules:
- Look for "SGPA" followed by a number
- If you see "SGPA: 7.67", extract 7.67
- If you see numbers like 7.67 in table format, extract that number
- If percentage found, calculate SGPA = percentage / 9.5
- Return as number, not string

College Rules:
- Always return "Government College of Engineering, Nagpur"

Return EXACTLY this format with no extra text:
{
  "fullName": "string or null",
  "aadhaarNumber": "string or null",
  "sgpa": number or null,
  "category": "string or null",
  "college": "string"
}
          `,
        },
        {
          role: "user",
          content: text,
        },
      ],
    })

    let content = response.choices[0]?.message?.content || "{}"
    
    // Clean the response - remove any text before or after JSON
    console.log("Raw GROQ Response:", content)
    
    // Try to extract JSON from the response
    let jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      content = jsonMatch[0]
    }
    
    // Remove any markdown code blocks
    content = content.replace(/```json/g, "").replace(/```/g, "").trim()
    
    console.log("Cleaned JSON:", content)

    let parsed: any = {}
    try {
      parsed = JSON.parse(content)
    } catch (err) {
      console.error("JSON parse error:", content)
      parsed = {}
    }

    // EXTREME SGPA EXTRACTION - Try every possible pattern
    let extractedSgpa: number | null = null
    
    const isValidSgpa = (num: number) => {
      return !isNaN(num) && num >= 0 && num <= 10
    }
    
    // 1. Check if GROQ extracted it (prioritize GROQ's extraction)
    if (parsed.sgpa !== null && parsed.sgpa !== undefined) {
      const num = Number(parsed.sgpa)
      if (isValidSgpa(num) && num > 1) { // SGPA should be > 1
        extractedSgpa = Math.round(num * 100) / 100
      }
    }
    
    // 2. Direct SGPA patterns
    if (!extractedSgpa) {
      const sgpaDirectPatterns = [
        /SGPA\s*:\s*(\d+\.?\d*)/i,
        /SGPA:\s*(\d+\.?\d*)/i,
        /SGPA\s+(\d+\.?\d*)/i,
        /\|\s*SGPA\s*\|\s*(\d+\.?\d*)\s*\|/i,
      ]
      
      for (const pattern of sgpaDirectPatterns) {
        const match = text.match(pattern)
        if (match && match[1]) {
          const num = Number(match[1])
          if (isValidSgpa(num) && num > 1) {
            extractedSgpa = Math.round(num * 100) / 100
            break
          }
        }
      }
    }
    
    // 3. Look for table pattern with SGPA
    if (!extractedSgpa) {
      const tablePattern = /\|\s*\d+\.?\d*\s*\|\s*\d+\.?\d*\s*\|\s*(\d+\.?\d{1,2})\s*\|\s*10\.00\s*\|/i
      const match = text.match(tablePattern)
      if (match && match[1]) {
        const num = Number(match[1])
        if (isValidSgpa(num) && num > 1) {
          extractedSgpa = Math.round(num * 100) / 100
        }
      }
    }
    
    // 4. Look for any decimal number in last 30 lines
    if (!extractedSgpa) {
      const lines = text.split('\n')
      const lastLines = lines.slice(-30).join('\n')
      const decimalPattern = /\b(\d+\.\d{1,2})\b/g
      const matches = [...lastLines.matchAll(decimalPattern)]
      
      for (const match of matches) {
        const num = Number(match[1])
        if (isValidSgpa(num) && num > 1 && num !== Math.floor(num)) {
          extractedSgpa = Math.round(num * 100) / 100
          break
        }
      }
    }
    
    // 5. Last resort: Look for numbers between 6 and 9.9 (typical SGPA range)
    if (!extractedSgpa) {
      const allNumbers = text.match(/\b(\d+\.\d{1,2})\b/g)
      const candidates: number[] = []
      if (allNumbers) {
        for (const numStr of allNumbers) {
          const num = Number(numStr)
          if (num >= 6 && num <= 9.9) {
            candidates.push(num)
          }
        }
      }
      
      if (candidates.length > 0) {
        const sorted = candidates.sort((a, b) => b - a)
        extractedSgpa = Math.round(sorted[0] * 100) / 100
      }
    }
    
    // ENHANCED CATEGORY EXTRACTION - Only extract valid categories
    let extractedCategory: string | null = null
    
    // First check if GROQ extracted it
    if (parsed.category && typeof parsed.category === "string") {
      const cat = parsed.category.trim().toUpperCase()
      // Only accept valid categories
      const validCategories = ["SC", "ST", "OBC", "VJNT", "NT", "EWS", "SEBC", "OPEN"]
      if (validCategories.some(vc => cat.includes(vc))) {
        if (cat.includes("OBC")) extractedCategory = "OBC"
        else if (cat.includes("SC")) extractedCategory = "SC"
        else if (cat.includes("ST")) extractedCategory = "ST"
        else if (cat.includes("VJNT")) extractedCategory = "VJNT"
        else if (cat.includes("EWS")) extractedCategory = "EWS"
        else if (cat.includes("OPEN")) extractedCategory = "OPEN"
      }
    }
    
    // If not found, try to extract from text
    if (!extractedCategory) {
      const categoryPatterns = [
        // Direct category mentions
        { pattern: /\bOBC\b/i, value: "OBC" },
        { pattern: /\bSC\b/i, value: "SC" },
        { pattern: /\bST\b/i, value: "ST" },
        { pattern: /\bVJNT\b/i, value: "VJNT" },
        { pattern: /\bNT\b/i, value: "NT" },
        { pattern: /\bEWS\b/i, value: "EWS" },
        { pattern: /\bSEBC\b/i, value: "SEBC" },
        { pattern: /\bOPEN\b/i, value: "OPEN" },
        { pattern: /\bGENERAL\b/i, value: "OPEN" },
        { pattern: /OTHER BACKWARD CLASS/i, value: "OBC" },
        { pattern: /SCHEDULED CASTE/i, value: "SC" },
        { pattern: /SCHEDULED TRIBE/i, value: "ST" },
        { pattern: /VIMUKTA JATI/i, value: "VJNT" },
        { pattern: /ECONOMICALLY WEAKER SECTION/i, value: "EWS" },
      ]
      
      for (const { pattern, value } of categoryPatterns) {
        if (pattern.test(text)) {
          extractedCategory = value
          break
        }
      }
    }
    
    // If category still not found and text contains "Kunbi" or "Maratha", set to OBC
    if (!extractedCategory) {
      if (/Kunbi|Maratha|Mahar|Dhangar/i.test(text)) {
        extractedCategory = "OBC"
      }
    }
    
    console.log("🎯 Extracted SGPA:", extractedSgpa)
    console.log("🏷️ Extracted Category:", extractedCategory)

    const cleanedData = {
      fullName: (() => {
        if (parsed.fullName && typeof parsed.fullName === "string" && parsed.fullName.trim().length >= 2) {
          let name = parsed.fullName.trim()
          name = name.replace(/Roll No\.?\s*\d*/i, '').trim()
          return name
        }
        const namePatterns = [
          /Student Name\s*:\s*([A-Za-z\s\.]{2,})/i,
          /Name[:\s]+([A-Za-z\s\.]{2,})/i,
          /([A-Z][a-z]+\s+[A-Z][a-z]+\s+[A-Z][a-z]+)/i,
        ]
        for (const pattern of namePatterns) {
          const match = text.match(pattern)
          if (match && match[1] && match[1].trim().length >= 2) {
            let name = match[1].trim()
            name = name.replace(/Roll No\.?\s*\d*/i, '').trim()
            return name
          }
        }
        return null
      })(),
      
      aadhaarNumber: (() => {
        if (parsed.aadhaarNumber && /^\d{12}$/.test(String(parsed.aadhaarNumber))) {
          return String(parsed.aadhaarNumber)
        }
        const aadhaarMatch = text.match(/\b(\d{4}[\s-]?\d{4}[\s-]?\d{4})\b/)
        if (aadhaarMatch) {
          const cleaned = aadhaarMatch[1].replace(/[\s-]/g, '')
          if (/^\d{12}$/.test(cleaned)) return cleaned
        }
        return null
      })(),
      
      sgpa: extractedSgpa,
      
      category: extractedCategory,
      
      college: "Government College of Engineering, Nagpur",
    }

    // Log final extraction results
    console.log("📊 Final Extraction Results:", {
      fullName: cleanedData.fullName,
      aadhaarNumber: cleanedData.aadhaarNumber,
      sgpa: cleanedData.sgpa,
      category: cleanedData.category,
      college: cleanedData.college,
    })

    return NextResponse.json({
      success: true,
      data: cleanedData,
      meta: {
        extracted: {
          fullName: !!cleanedData.fullName,
          aadhaarNumber: !!cleanedData.aadhaarNumber,
          sgpa: cleanedData.sgpa !== null,
          category: !!cleanedData.category,
          college: true,
        }
      }
    })

  } catch (error) {
    console.error("GROQ API ERROR:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Extraction failed" },
      { status: 500 }
    )
  }
}