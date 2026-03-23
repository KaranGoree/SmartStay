import { NextResponse } from "next/server"
import Groq from "groq-sdk"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  try {
    // ✅ SAFE ENV CHECK
    if (!process.env.GROQ_API_KEY) {
      console.error("❌ Missing GROQ_API_KEY")
      return NextResponse.json(
        { success: false, error: "Server not configured" },
        { status: 500 }
      )
    }

    // ✅ SAFE INIT (moved inside function)
    const groq = new Groq({
      apiKey: process.env.GROQ_API_KEY,
    })

    const body = await req.json().catch(() => null)

    if (!body || !body.text) {
      return NextResponse.json(
        { error: "No OCR text provided" },
        { status: 400 }
      )
    }

    const { text } = body

    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        { error: "No OCR text provided" },
        { status: 400 }
      )
    }

    // ✅ SAFE GROQ CALL
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
    }).catch((err) => {
      console.error("❌ GROQ CALL FAILED:", err)
      return null
    })

    if (!response) {
      return NextResponse.json(
        { success: false, error: "AI extraction failed" },
        { status: 500 }
      )
    }

    let content = response.choices?.[0]?.message?.content || "{}"

    console.log("Raw GROQ Response:", content)

    let jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      content = jsonMatch[0]
    }

    content = content.replace(/```json/g, "").replace(/```/g, "").trim()

    console.log("Cleaned JSON:", content)

    let parsed: any = {}
    try {
      parsed = JSON.parse(content)
    } catch (err) {
      console.error("JSON parse error:", content)
      parsed = {}
    }

    // ================= ORIGINAL LOGIC START =================

    let extractedSgpa: number | null = null
    
    const isValidSgpa = (num: number) => {
      return !isNaN(num) && num >= 0 && num <= 10
    }
    
    if (parsed.sgpa !== null && parsed.sgpa !== undefined) {
      const num = Number(parsed.sgpa)
      if (isValidSgpa(num) && num > 1) {
        extractedSgpa = Math.round(num * 100) / 100
      }
    }
    
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
    
    let extractedCategory: string | null = null
    
    if (parsed.category && typeof parsed.category === "string") {
      const cat = parsed.category.trim().toUpperCase()
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
    
    if (!extractedCategory) {
      const categoryPatterns = [
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
    
    if (!extractedCategory) {
      if (/Kunbi|Maratha|Mahar|Dhangar/i.test(text)) {
        extractedCategory = "OBC"
      }
    }

    const cleanedData = {
      fullName: parsed.fullName || null,
      aadhaarNumber: parsed.aadhaarNumber || null,
      sgpa: extractedSgpa,
      category: extractedCategory,
      college: "Government College of Engineering, Nagpur",
    }

    return NextResponse.json({
      success: true,
      data: cleanedData
    })

  } catch (error) {
    console.error("❌ FINAL ERROR:", error)

    return NextResponse.json(
      { success: false, error: "Extraction failed" },
      { status: 500 }
    )
  }
}