"use client"

import { Badge } from "@/components/ui/badge"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useAuth } from "@/components/auth/auth-provider"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FieldGroup, Field, FieldLabel, FieldError } from "@/components/ui/field"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Spinner } from "@/components/ui/spinner"
import { Progress } from "@/components/ui/progress"
import { DocumentUpload } from "./document-upload"
import { createApplication, getUserApplication, updateApplication } from "@/lib/firebase/firestore"
import { validateApplication, validateCrossDocuments, getOverallValidationStatus, getValidationColor, getValidationIcon } from "@/lib/utils/validation"
import { toast } from "sonner"
import { BRANCHES, YEARS, CATEGORIES, type Branch, type Year, type Category, type AdmissionType, type OCRData, type Application } from "@/lib/types"
import { ArrowLeft, ArrowRight, Save, Send, Bot, Download, CheckCircle, AlertCircle, Clock, XCircle } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"

const applicationSchema = z.object({
  fullName: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phone: z.string().regex(/^\d{10}$/, "Phone must be 10 digits"),
  branch: z.enum(["Civil", "ETC", "Mechanical", "Electrical", "CSE"]),
  year: z.coerce.number().min(1).max(4),
  category: z.enum(["Open", "SC/ST", "VJNT", "OBC", "EWS/SEBC", "PWD"]),
  aadhaarNumber: z.string().regex(/^\d{12}$/, "Aadhaar must be 12 digits"),
  admissionType: z.enum(["CET", "SGPA"]),
  cetMarks: z.coerce.number().optional(),
  sgpa: z.coerce.number().min(0).max(10).optional(),
}).refine((data) => {
  if (data.admissionType === "CET" && (data.cetMarks === undefined || data.cetMarks < 0)) {
    return false
  }
  if (data.admissionType === "SGPA" && (data.sgpa === undefined || data.sgpa < 0)) {
    return false
  }
  return true
}, {
  message: "Please enter valid marks/SGPA based on admission type",
  path: ["cetMarks"],
})

type ApplicationFormData = z.infer<typeof applicationSchema>

const STEPS = [
  { id: 1, title: "Personal Info", description: "Basic details" },
  { id: 2, title: "Academic Info", description: "Branch & marks" },
  { id: 3, title: "Documents", description: "Upload & verify" },
  { id: 4, title: "Review", description: "Submit application" },
]

interface ExtractedData {
  fullName: string | null
  aadhaarNumber: string | null
  marks: number | null
  sgpa: number | null
  category: string | null
  college: string | null
}

export function ApplicationForm() {
  const { user, userData } = useAuth()
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [existingApp, setExistingApp] = useState<Application | null>(null)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [previewTitle, setPreviewTitle] = useState("")
  
  const [documents, setDocuments] = useState({
    marksheet: "",
    aadhaarCard: "",
    categoryProof: "",
  })
  const [rawOCRTexts, setRawOCRTexts] = useState({
    marksheet: "",
    aadhaarCard: "",
    categoryProof: "",
  })
  const [ocrData, setOcrData] = useState<OCRData>({
    extractedName: "",
    extractedMarks: null,
    extractedCategory: "",
    extractedAadhaar: "",
    extractedCollege: "",
    confidence: 0,
  })

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
    trigger,
    getValues,
  } = useForm<ApplicationFormData>({
    resolver: zodResolver(applicationSchema),
    defaultValues: {
      email: userData?.email || "",
      admissionType: "CET",
    },
  })
  const [isValidating, setIsValidating] = useState(false)
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null)
  const [crossDocValidation, setCrossDocValidation] = useState<any>(null)
  const admissionType = watch("admissionType")
  const selectedYear = watch("year")
  const selectedCategory = watch("category")

  // Load existing application
  useEffect(() => {
    async function loadApplication() {
      if (user?.uid) {
        const app = await getUserApplication(user.uid)
        if (app) {
          setExistingApp(app)
          setValue("fullName", app.fullName)
          setValue("email", app.email)
          setValue("phone", app.phone)
          setValue("branch", app.branch)
          setValue("year", app.year)
          setValue("category", app.category)
          setValue("aadhaarNumber", app.aadhaarNumber)
          setValue("admissionType", app.admissionType)
          if (app.cetMarks) setValue("cetMarks", app.cetMarks)
          if (app.sgpa) setValue("sgpa", app.sgpa)
          setDocuments(app.documents)
          setOcrData(app.ocrData)
        }
      }
    }
    loadApplication()
  }, [user?.uid, setValue])

  const handleOCRComplete = (type: "marksheet" | "aadhaarCard" | "categoryProof", data: Partial<OCRData>, rawText: string) => {
    setOcrData((prev) => ({
      ...prev,
      ...data,
      confidence: Math.max(prev.confidence, data.confidence || 0),
    }))

    setRawOCRTexts((prev) => ({
      ...prev,
      [type]: rawText,
    }))
    
    console.log(`📄 OCR Text for ${type}:`, rawText.substring(0, 500))
  }

  const processAllDocumentsWithAI = async () => {
    if (!documents.marksheet) {
      toast.error("Please upload Marksheet first")
      return
    }
    if (!documents.aadhaarCard) {
      toast.error("Please upload Aadhaar Card first")
      return
    }

    if (!rawOCRTexts.marksheet || !rawOCRTexts.aadhaarCard) {
      toast.error("OCR processing not complete. Please wait for document processing.")
      return
    }

    setIsValidating(true)
    setExtractedData(null)
    setCrossDocValidation(null)

    try {
      // Process Marksheet separately
      console.log("🤖 Extracting from Marksheet...")
      const marksheetResponse = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: rawOCRTexts.marksheet }),
      })
      const marksheetResult = await marksheetResponse.json()
      const marksheetData = marksheetResult.success ? marksheetResult.data : {}
      console.log("Marksheet Data:", marksheetData)

      // Process Aadhaar separately
      console.log("🤖 Extracting from Aadhaar...")
      const aadhaarResponse = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: rawOCRTexts.aadhaarCard }),
      })
      const aadhaarResult = await aadhaarResponse.json()
      const aadhaarData = aadhaarResult.success ? aadhaarResult.data : {}
      console.log("Aadhaar Data:", aadhaarData)

      // Process Category Certificate separately
      let categoryData = {}
      if (rawOCRTexts.categoryProof) {
        console.log("🤖 Extracting from Category Certificate...")
        const categoryResponse = await fetch('/api/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: rawOCRTexts.categoryProof }),
        })
        const categoryResult = await categoryResponse.json()
        categoryData = categoryResult.success ? categoryResult.data : {}
        console.log("Category Data:", categoryData)
      }

      // Get the marks/sgpa value
      const marksValue = marksheetData.sgpa || marksheetData.marks || null
      
      // Validate cross-documents
      const validation = validateCrossDocuments(
        { 
          fullName: marksheetData.fullName, 
          marks: marksValue, 
          college: marksheetData.college 
        },
        { 
          fullName: aadhaarData.fullName, 
          aadhaarNumber: aadhaarData.aadhaarNumber 
        },
        { 
          fullName: categoryData.fullName, 
          category: categoryData.category 
        },
        selectedCategory
      )
      
      setCrossDocValidation(validation)
      console.log("📋 Cross-Document Validation:", validation)

      // Show validation results
      if (!validation.isValid) {
        toast.error("❌ Document Validation Failed!")
        validation.issues.forEach(issue => toast.error(issue))
        toast.error("Please upload documents belonging to the same person.")
      } else if (validation.warnings.length > 0) {
        toast.warning("⚠️ Document Validation Warnings")
        validation.warnings.forEach(warning => toast.warning(warning))
      } else if (validation.matchScore >= 80) {
        toast.success("✅ All documents verified! Names match across all documents.")
      }

      // Use the best name from cross-document validation
      const bestName = validation.details.bestName || marksheetData.fullName || aadhaarData.fullName
      
      const combinedData: ExtractedData = {
        fullName: bestName,
        aadhaarNumber: aadhaarData.aadhaarNumber || null,
        marks: marksValue,
        sgpa: marksValue,
        category: (() => {
          if (categoryData.category && typeof categoryData.category === "string") {
            const cat = categoryData.category.trim().toUpperCase()
            if (cat.includes("OBC")) return "OBC"
            if (cat.includes("SC")) return "SC"
            if (cat.includes("ST")) return "ST"
            if (cat.includes("VJNT")) return "VJNT"
            if (cat.includes("EWS")) return "EWS"
            if (cat.includes("OPEN")) return "OPEN"
          }
          return null
        })(),
        college: marksheetData.college || null,
      }

      console.log("🤖 Combined Extracted Data:", combinedData)
      setExtractedData(combinedData)

      // Auto-fill form fields only if documents are valid or have warnings
      if (validation.isValid) {
        let autoFilledCount = 0
        
        if (combinedData.fullName && !getValues("fullName")) {
          setValue("fullName", combinedData.fullName)
          toast.info(`✓ Name auto-filled: ${combinedData.fullName}`)
          autoFilledCount++
        }
        
        if (combinedData.aadhaarNumber && !getValues("aadhaarNumber")) {
          setValue("aadhaarNumber", combinedData.aadhaarNumber)
          toast.info("✓ Aadhaar number auto-filled from document")
          autoFilledCount++
        }
        
        if (combinedData.category && !getValues("category")) {
          let normalizedCategory = combinedData.category
          if (normalizedCategory === "OBC") normalizedCategory = "OBC"
          else if (normalizedCategory === "SC") normalizedCategory = "SC/ST"
          else if (normalizedCategory === "ST") normalizedCategory = "SC/ST"
          else if (normalizedCategory === "OPEN") normalizedCategory = "Open"
          
          const allowedCategories = ["Open", "SC/ST", "VJNT", "OBC", "EWS/SEBC", "PWD"]
          if (allowedCategories.includes(normalizedCategory)) {
            setValue("category", normalizedCategory as Category)
            toast.info(`✓ Category auto-filled: ${normalizedCategory}`)
            autoFilledCount++
          }
        }
        
        const academicValue = combinedData.marks || combinedData.sgpa
        if (academicValue && !getValues(admissionType === "CET" ? "cetMarks" : "sgpa")) {
          if (admissionType === "CET") {
            setValue("cetMarks", academicValue)
            toast.info(`✓ CET Marks auto-filled: ${academicValue}`)
          } else {
            setValue("sgpa", academicValue)
            toast.info(`✓ SGPA auto-filled: ${academicValue}`)
          }
          autoFilledCount++
        }

        if (autoFilledCount > 0) {
          toast.success(`✅ ${autoFilledCount} field(s) auto-filled from documents!`)
        }
      }

      // Update OCR data
      setOcrData((prev) => ({
        ...prev,
        extractedName: combinedData.fullName || "",
        extractedAadhaar: combinedData.aadhaarNumber || "",
        extractedMarks: marksValue,
        extractedCategory: combinedData.category || "",
        extractedCollege: combinedData.college || "",
        confidence: validation.isValid ? 0.95 : 0.7,
      }))

    } catch (err) {
      console.error("❌ AI Validation Error:", err)
      toast.error(err instanceof Error ? err.message : "Failed to process documents. Please try again.")
    } finally {
      setIsValidating(false)
    }
  }

  const nextStep = async () => {
    const fieldsToValidate: (keyof ApplicationFormData)[] = 
      step === 1 ? ["fullName", "email", "phone", "aadhaarNumber"] :
      step === 2 ? ["branch", "year", "category", "admissionType"] : []
    
    if (fieldsToValidate.length > 0) {
      const valid = await trigger(fieldsToValidate)
      if (!valid) return
    }
    
    if (step < 4) setStep(step + 1)
  }

  const prevStep = () => {
    if (step > 1) setStep(step - 1)
  }

  const saveProgress = async () => {
    setIsSaving(true)
    try {
      const formData = getValues()
      const validation = validateApplication(
        {
          fullName: formData.fullName,
          cetMarks: formData.cetMarks,
          sgpa: formData.sgpa,
          category: formData.category,
          aadhaarNumber: formData.aadhaarNumber,
        },
        ocrData,
        crossDocValidation
      )

      const applicationData = {
        userId: user!.uid,
        status: "draft" as const,
        ...formData,
        documents,
        ocrData,
        validation,
        crossDocumentValidation: crossDocValidation,
      }

      if (existingApp) {
        await updateApplication(existingApp.id, applicationData)
      } else {
        const id = await createApplication(applicationData)
        setExistingApp({ ...applicationData, id } as Application)
      }
      
      toast.success("Progress saved")
    } catch (error) {
      toast.error("Failed to save progress")
    } finally {
      setIsSaving(false)
    }
  }

  const downloadApplication = () => {
    const formData = getValues()
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Hostel Application - ${formData.fullName}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
          .header { text-align: center; margin-bottom: 40px; }
          .title { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
          .subtitle { color: #666; }
          .section { margin-bottom: 30px; }
          .section-title { font-size: 18px; font-weight: bold; border-bottom: 2px solid #333; margin-bottom: 15px; padding-bottom: 5px; }
          .info-row { display: flex; margin-bottom: 10px; }
          .info-label { font-weight: bold; width: 150px; }
          .info-value { flex: 1; }
          .extracted-data, .validation-data { margin-top: 20px; padding: 15px; border-radius: 8px; }
          .extracted-data { background: #f0f9ff; }
          .validation-success { background: #f0fdf4; border: 1px solid #86efac; }
          .validation-warning { background: #fef9e3; border: 1px solid #fde047; }
          .validation-error { background: #fee2e2; border: 1px solid #fca5a5; }
          @media print {
            body { margin: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">Hostel Accommodation Application</div>
          <div class="subtitle">Government College of Engineering, Nagpur</div>
          <div class="subtitle">Application Date: ${new Date().toLocaleDateString()}</div>
        </div>

        <div class="section">
          <div class="section-title">Personal Information</div>
          <div class="info-row">
            <div class="info-label">Full Name:</div>
            <div class="info-value">${formData.fullName}</div>
          </div>
          <div class="info-row">
            <div class="info-label">Email:</div>
            <div class="info-value">${formData.email}</div>
          </div>
          <div class="info-row">
            <div class="info-label">Phone:</div>
            <div class="info-value">${formData.phone}</div>
          </div>
          <div class="info-row">
            <div class="info-label">Aadhaar Number:</div>
            <div class="info-value">${formData.aadhaarNumber}</div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Academic Information</div>
          <div class="info-row">
            <div class="info-label">Branch:</div>
            <div class="info-value">${formData.branch}</div>
          </div>
          <div class="info-row">
            <div class="info-label">Year:</div>
            <div class="info-value">${formData.year}</div>
          </div>
          <div class="info-row">
            <div class="info-label">Category:</div>
            <div class="info-value">${formData.category}</div>
          </div>
          <div class="info-row">
            <div class="info-label">Admission Type:</div>
            <div class="info-value">${formData.admissionType}</div>
          </div>
          <div class="info-row">
            <div class="info-label">${formData.admissionType === "CET" ? "CET Marks:" : "SGPA:"}</div>
            <div class="info-value">${formData.admissionType === "CET" ? formData.cetMarks : formData.sgpa}</div>
          </div>
        </div>

        ${extractedData ? `
          <div class="section">
            <div class="section-title">AI Extracted Information</div>
            <div class="extracted-data">
              ${extractedData.fullName ? `<div><strong>Name:</strong> ${extractedData.fullName}</div>` : '<div><strong>Name:</strong> Not extracted</div>'}
              ${extractedData.aadhaarNumber ? `<div><strong>Aadhaar:</strong> ${extractedData.aadhaarNumber}</div>` : '<div><strong>Aadhaar:</strong> Not extracted</div>'}
              ${(extractedData.marks || extractedData.sgpa) ? `<div><strong>Marks/SGPA:</strong> ${extractedData.marks || extractedData.sgpa}</div>` : '<div><strong>Marks/SGPA:</strong> Not extracted</div>'}
              ${extractedData.category ? `<div><strong>Category:</strong> ${extractedData.category}</div>` : '<div><strong>Category:</strong> Not extracted</div>'}
              ${extractedData.college ? `<div><strong>College:</strong> ${extractedData.college}</div>` : '<div><strong>College:</strong> Not extracted</div>'}
            </div>
          </div>
        ` : ''}

        ${crossDocValidation ? `
          <div class="section">
            <div class="section-title">Document Validation Report</div>
            <div class="validation-${crossDocValidation.isValid ? 'success' : crossDocValidation.warnings.length > 0 ? 'warning' : 'error'}">
              <div><strong>Validation Status:</strong> ${crossDocValidation.isValid ? '✓ Passed' : '✗ Failed'}</div>
              <div><strong>Match Score:</strong> ${crossDocValidation.matchScore.toFixed(0)}%</div>
              ${crossDocValidation.issues.length > 0 ? `
                <div><strong>Issues Found:</strong></div>
                <ul>${crossDocValidation.issues.map((i: string) => `<li>${i}</li>`).join('')}</ul>
              ` : ''}
              ${crossDocValidation.warnings.length > 0 ? `
                <div><strong>Warnings:</strong></div>
                <ul>${crossDocValidation.warnings.map((w: string) => `<li>${w}</li>`).join('')}</ul>
              ` : ''}
              <div class="info-row" style="margin-top: 10px;">
                <div class="info-label">Marksheet vs Aadhaar:</div>
                <div class="info-value">${crossDocValidation.details.marksheetVsAadhaar.similarity.toFixed(0)}% (${crossDocValidation.details.marksheetVsAadhaar.status})</div>
              </div>
              ${crossDocValidation.details.marksheetVsCategory ? `
                <div class="info-row">
                  <div class="info-label">Marksheet vs Category:</div>
                  <div class="info-value">${crossDocValidation.details.marksheetVsCategory.similarity.toFixed(0)}% (${crossDocValidation.details.marksheetVsCategory.status})</div>
                </div>
              ` : ''}
            </div>
          </div>
        ` : ''}

        <div class="section">
          <div class="section-title">Declaration</div>
          <p>I hereby declare that all the information provided in this application is true and correct to the best of my knowledge. I understand that any false information may lead to cancellation of my application and hostel accommodation.</p>
          <p style="margin-top: 40px;">Signature: ____________________</p>
          <p>Date: ${new Date().toLocaleDateString()}</p>
        </div>
      </body>
      </html>
    `

    const blob = new Blob([htmlContent], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Hostel_Application_${formData.fullName.replace(/\s/g, '_')}.html`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    toast.success("Application downloaded successfully")
  }

  const onSubmit = async (data: ApplicationFormData) => {
    if (!documents.marksheet || !documents.aadhaarCard) {
      toast.error("Please upload required documents")
      setStep(3)
      return
    }

    // Check if documents are validated
    if (!crossDocValidation) {
      toast.error("Please run document verification first")
      setStep(3)
      return
    }

    if (!crossDocValidation.isValid) {
      toast.error("Please fix document validation issues before submitting")
      return
    }

    setIsLoading(true)
    try {
      const validation = validateApplication(
        {
          fullName: data.fullName,
          cetMarks: data.cetMarks,
          sgpa: data.sgpa,
          category: data.category,
          aadhaarNumber: data.aadhaarNumber,
        },
        ocrData,
        crossDocValidation
      )

      const applicationData = {
        userId: user!.uid,
        status: "pending" as const,
        ...data,
        documents,
        ocrData,
        validation,
        crossDocumentValidation: crossDocValidation,
      }

      if (existingApp) {
        await updateApplication(existingApp.id, { ...applicationData, status: "pending" })
      } else {
        await createApplication(applicationData)
      }

      toast.success("Application submitted successfully!")
      router.push("/dashboard/status")
    } catch (error) {
      toast.error("Failed to submit application")
    } finally {
      setIsLoading(false)
    }
  }

  const progress = (step / STEPS.length) * 100

  const renderValidationBadge = (status: string) => {
    switch (status) {
      case "verified":
        return <CheckCircle className="h-4 w-4 text-emerald-500" />
      case "warning":
        return <AlertCircle className="h-4 w-4 text-amber-500" />
      case "error":
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Progress */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          {STEPS.map((s) => (
            <div
              key={s.id}
              className={`flex-1 text-center ${step >= s.id ? "text-primary" : "text-muted-foreground"}`}
            >
              <span className="hidden sm:inline">{s.title}</span>
              <span className="sm:hidden">{s.id}</span>
            </div>
          ))}
        </div>
        <Progress value={progress} />
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        {/* Step 1: Personal Info */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>Enter your basic details</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="fullName">Full Name (as per documents)</FieldLabel>
                  <Input id="fullName" placeholder="Enter your full name" {...register("fullName")} />
                  {errors.fullName && <FieldError>{errors.fullName.message}</FieldError>}
                  {ocrData.extractedName && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Extracted: {ocrData.extractedName}
                    </p>
                  )}
                </Field>
                <Field>
                  <FieldLabel htmlFor="email">Email Address</FieldLabel>
                  <Input id="email" type="email" placeholder="your.email@gcoen.ac.in" {...register("email")} />
                  {errors.email && <FieldError>{errors.email.message}</FieldError>}
                </Field>
                <Field>
                  <FieldLabel htmlFor="phone">Phone Number</FieldLabel>
                  <Input id="phone" placeholder="10-digit mobile number" {...register("phone")} />
                  {errors.phone && <FieldError>{errors.phone.message}</FieldError>}
                </Field>
                <Field>
                  <FieldLabel htmlFor="aadhaarNumber">Aadhaar Number</FieldLabel>
                  <Input id="aadhaarNumber" placeholder="12-digit Aadhaar number" {...register("aadhaarNumber")} />
                  {errors.aadhaarNumber && <FieldError>{errors.aadhaarNumber.message}</FieldError>}
                  {ocrData.extractedAadhaar && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Extracted: {ocrData.extractedAadhaar}
                    </p>
                  )}
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Academic Info */}
        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Academic Information</CardTitle>
              <CardDescription>Enter your academic details</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel>Branch</FieldLabel>
                  <Select onValueChange={(v) => setValue("branch", v as Branch)} value={watch("branch")}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select your branch" />
                    </SelectTrigger>
                    <SelectContent>
                      {BRANCHES.map((b) => (
                        <SelectItem key={b} value={b}>{b}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.branch && <FieldError>{errors.branch.message}</FieldError>}
                </Field>
                <Field>
                  <FieldLabel>Year</FieldLabel>
                  <Select onValueChange={(v) => setValue("year", parseInt(v) as Year)} value={watch("year")?.toString()}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select your year" />
                    </SelectTrigger>
                    <SelectContent>
                      {YEARS.map((y) => (
                        <SelectItem key={y} value={y.toString()}>Year {y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.year && <FieldError>{errors.year.message}</FieldError>}
                </Field>
                <Field>
                  <FieldLabel>Category</FieldLabel>
                  <Select onValueChange={(v) => setValue("category", v as Category)} value={watch("category")}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select your category" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.category && <FieldError>{errors.category.message}</FieldError>}
                  {ocrData.extractedCategory && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Extracted: {ocrData.extractedCategory}
                    </p>
                  )}
                </Field>
                <Field>
                  <FieldLabel>Admission Type</FieldLabel>
                  <RadioGroup
                    onValueChange={(v) => setValue("admissionType", v as AdmissionType)}
                    value={admissionType}
                    className="flex gap-4"
                  >
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="CET" id="cet" />
                      <label htmlFor="cet" className="text-sm">CET (1st Year)</label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="SGPA" id="sgpa" />
                      <label htmlFor="sgpa" className="text-sm">SGPA (2nd-4th Year)</label>
                    </div>
                  </RadioGroup>
                </Field>
                {admissionType === "CET" ? (
                  <Field>
                    <FieldLabel htmlFor="cetMarks">CET Marks (out of 200)</FieldLabel>
                    <Input id="cetMarks" type="number" placeholder="Enter CET marks" {...register("cetMarks")} />
                    {errors.cetMarks && <FieldError>{errors.cetMarks.message}</FieldError>}
                    {ocrData.extractedMarks && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Extracted: {ocrData.extractedMarks} marks
                      </p>
                    )}
                  </Field>
                ) : (
                  <Field>
                    <FieldLabel htmlFor="sgpa">SGPA (out of 10)</FieldLabel>
                    <Input id="sgpa" type="number" step="0.01" placeholder="Enter SGPA" {...register("sgpa")} />
                    {errors.sgpa && <FieldError>{errors.sgpa.message}</FieldError>}
                    {ocrData.extractedMarks && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Extracted: {ocrData.extractedMarks} SGPA
                      </p>
                    )}
                  </Field>
                )}
              </FieldGroup>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Documents */}
        {step === 3 && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Document Upload</CardTitle>
                <CardDescription>
                  Upload clear images of your documents. OCR will automatically extract and verify information.
                </CardDescription>
              </CardHeader>
            </Card>
            
            <div className="grid gap-4 md:grid-cols-2">
              <DocumentUpload
                type="marksheet"
                label="Marksheet / Result"
                description="Latest semester marksheet or CET scorecard"
                required
                value={documents.marksheet}
                onChange={(v) => setDocuments((d) => ({ ...d, marksheet: v }))}
                onOCRComplete={(data, rawText) => {
                  handleOCRComplete("marksheet", data, rawText)
                }}
              />
              <DocumentUpload
                type="aadhaarCard"
                label="Aadhaar Card"
                description="Front side of your Aadhaar card"
                required
                value={documents.aadhaarCard}
                onChange={(v) => setDocuments((d) => ({ ...d, aadhaarCard: v }))}
                onOCRComplete={(data, rawText) => {
                  handleOCRComplete("aadhaarCard", data, rawText)
                }}
              />
              {selectedCategory && selectedCategory !== "Open" && (
                <DocumentUpload
                  type="categoryProof"
                  label="Category Certificate"
                  description="Caste/Category certificate issued by competent authority"
                  value={documents.categoryProof}
                  onChange={(v) => setDocuments((d) => ({ ...d, categoryProof: v }))}
                  onOCRComplete={(data, rawText) => {
                    handleOCRComplete("categoryProof", data, rawText)
                  }}
                />
              )}
            </div>

            {/* Extract Info Button */}
            {(documents.marksheet && documents.aadhaarCard) && (
              <Card>
                <CardContent className="pt-6">
                  <Button 
                    onClick={processAllDocumentsWithAI}
                    disabled={isValidating || !rawOCRTexts.marksheet || !rawOCRTexts.aadhaarCard}
                    className="w-full"
                    size="lg"
                  >
                    {isValidating ? (
                      <>
                        <Spinner className="h-5 w-5 mr-2" />
                        Extracting Information...
                      </>
                    ) : (
                      <>
                        <Bot className="h-5 w-5 mr-2" />
                        Extract & Verify Documents with AI
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    Extracts and verifies name, Aadhaar, marks, and category across all documents
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Cross-Document Validation Results */}
            {crossDocValidation && (
              <Card className={crossDocValidation.isValid ? "border-emerald-500" : crossDocValidation.warnings.length > 0 ? "border-amber-500" : "border-red-500"}>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    {crossDocValidation.isValid ? (
                      <CheckCircle className="h-5 w-5 text-emerald-500" />
                    ) : crossDocValidation.warnings.length > 0 ? (
                      <AlertCircle className="h-5 w-5 text-amber-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                    Document Verification Report
                  </CardTitle>
                  <CardDescription>
                    Match Score: {crossDocValidation.matchScore.toFixed(0)}% | 
                    {crossDocValidation.isValid ? " All documents verified" : crossDocValidation.warnings.length > 0 ? " Warnings found" : " Validation failed"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Name Match Summary */}
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">Name Verification</h4>
                    <div className="grid gap-2">
                      <div className="flex items-center justify-between p-2 bg-muted rounded">
                        <span className="text-sm">Marksheet vs Aadhaar</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{crossDocValidation.details.marksheetVsAadhaar.similarity.toFixed(0)}%</span>
                          {renderValidationBadge(crossDocValidation.details.marksheetVsAadhaar.status)}
                        </div>
                      </div>
                      {crossDocValidation.details.marksheetVsCategory && (
                        <div className="flex items-center justify-between p-2 bg-muted rounded">
                          <span className="text-sm">Marksheet vs Category</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{crossDocValidation.details.marksheetVsCategory.similarity.toFixed(0)}%</span>
                            {renderValidationBadge(crossDocValidation.details.marksheetVsCategory.status)}
                          </div>
                        </div>
                      )}
                      {crossDocValidation.details.aadhaarVsCategory && (
                        <div className="flex items-center justify-between p-2 bg-muted rounded">
                          <span className="text-sm">Aadhaar vs Category</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{crossDocValidation.details.aadhaarVsCategory.similarity.toFixed(0)}%</span>
                            {renderValidationBadge(crossDocValidation.details.aadhaarVsCategory.status)}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Issues and Warnings */}
                  {crossDocValidation.issues.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm text-red-600">Issues Found</h4>
                      <ul className="list-disc list-inside text-sm text-red-600 space-y-1">
                        {crossDocValidation.issues.map((issue: string, idx: number) => (
                          <li key={idx}>{issue}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {crossDocValidation.warnings.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm text-amber-600">Warnings</h4>
                      <ul className="list-disc list-inside text-sm text-amber-600 space-y-1">
                        {crossDocValidation.warnings.map((warning: string, idx: number) => (
                          <li key={idx}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {crossDocValidation.isValid && crossDocValidation.warnings.length === 0 && (
                    <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                      <div className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-emerald-500 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-emerald-800">All Documents Verified!</p>
                          <p className="text-xs text-emerald-700 mt-1">
                            Names match across all documents. You can proceed to review and submit.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Extracted Data Display */}
            {extractedData && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Bot className="h-5 w-5" />
                    Extracted Information
                  </CardTitle>
                  <CardDescription>
                    Information extracted from your uploaded documents
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {/* Full Name */}
                    <div className={`p-3 rounded-lg ${extractedData.fullName ? 'bg-muted' : 'bg-yellow-50 border border-yellow-200'}`}>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium text-muted-foreground">Full Name</p>
                        {!extractedData.fullName && (
                          <Badge variant="outline" className="text-yellow-600">Not Found</Badge>
                        )}
                      </div>
                      <p className="text-lg font-semibold">
                        {extractedData.fullName || "Not extracted from documents"}
                      </p>
                    </div>
                    
                    {/* Aadhaar Number */}
                    <div className={`p-3 rounded-lg ${extractedData.aadhaarNumber ? 'bg-muted' : 'bg-yellow-50 border border-yellow-200'}`}>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium text-muted-foreground">Aadhaar Number</p>
                        {!extractedData.aadhaarNumber && (
                          <Badge variant="outline" className="text-yellow-600">Not Found</Badge>
                        )}
                      </div>
                      <p className="text-lg font-mono font-semibold">
                        {extractedData.aadhaarNumber || "Not extracted from documents"}
                      </p>
                    </div>
                    
                    {/* SGPA / Marks */}
                    <div className={`p-3 rounded-lg ${(extractedData.marks !== null || extractedData.sgpa !== null) ? 'bg-muted' : 'bg-yellow-50 border border-yellow-200'}`}>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium text-muted-foreground">
                          {admissionType === "CET" ? "CET Marks" : "SGPA / CGPA"}
                        </p>
                        {(extractedData.marks === null && extractedData.sgpa === null) && (
                          <Badge variant="outline" className="text-yellow-600">Not Found</Badge>
                        )}
                      </div>
                      <p className="text-lg font-semibold">
                        {extractedData.marks !== null 
                          ? extractedData.marks 
                          : extractedData.sgpa !== null 
                            ? extractedData.sgpa 
                            : `Not extracted from ${admissionType === "CET" ? "marksheet" : "marksheet"}`
                        }
                      </p>
                    </div>
                    
                    {/* Category */}
                    <div className={`p-3 rounded-lg ${extractedData.category ? 'bg-muted' : 'bg-yellow-50 border border-yellow-200'}`}>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium text-muted-foreground">Category</p>
                        {!extractedData.category && (
                          <Badge variant="outline" className="text-yellow-600">Not Found</Badge>
                        )}
                      </div>
                      <p className="text-lg font-semibold">
                        {extractedData.category || "Not extracted from category certificate"}
                      </p>
                    </div>
                    
                    {/* College */}
                    <div className={`p-3 rounded-lg ${extractedData.college ? 'bg-muted' : 'bg-yellow-50 border border-yellow-200'}`}>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium text-muted-foreground">College / Institute</p>
                        {!extractedData.college && (
                          <Badge variant="outline" className="text-yellow-600">Not Found</Badge>
                        )}
                      </div>
                      <p className="text-lg font-semibold">
                        {extractedData.college || "Not extracted from marksheet"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Step 4: Review */}
        {step === 4 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Review Your Application</CardTitle>
                  <CardDescription>
                    Please verify all information before submitting. You can edit until the deadline.
                  </CardDescription>
                </div>
                <Button type="button" variant="outline" onClick={downloadApplication}>
                  <Download className="h-4 w-4 mr-2" />
                  Download Application
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h4 className="font-medium mb-2">Personal Details</h4>
                  <dl className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Name:</dt>
                      <dd className="font-medium">{watch("fullName")}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Email:</dt>
                      <dd className="font-medium">{watch("email")}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Phone:</dt>
                      <dd className="font-medium">{watch("phone")}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Aadhaar:</dt>
                      <dd className="font-medium">{watch("aadhaarNumber")}</dd>
                    </div>
                  </dl>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Academic Details</h4>
                  <dl className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Branch:</dt>
                      <dd className="font-medium">{watch("branch")}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Year:</dt>
                      <dd className="font-medium">{watch("year")}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Category:</dt>
                      <dd className="font-medium">{watch("category")}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">
                        {admissionType === "CET" ? "CET Marks:" : "SGPA:"}
                      </dt>
                      <dd className="font-medium">
                        {admissionType === "CET" ? watch("cetMarks") : watch("sgpa")}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">Uploaded Documents</h4>
                <div className="grid gap-4 grid-cols-3">
                  {documents.marksheet && (
                    <div 
                      className="aspect-video rounded-lg overflow-hidden bg-muted cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => {
                        setPreviewImage(documents.marksheet)
                        setPreviewTitle("Marksheet / Result")
                      }}
                    >
                      <img src={documents.marksheet} alt="Marksheet" className="w-full h-full object-cover" />
                    </div>
                  )}
                  {documents.aadhaarCard && (
                    <div 
                      className="aspect-video rounded-lg overflow-hidden bg-muted cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => {
                        setPreviewImage(documents.aadhaarCard)
                        setPreviewTitle("Aadhaar Card")
                      }}
                    >
                      <img src={documents.aadhaarCard} alt="Aadhaar" className="w-full h-full object-cover" />
                    </div>
                  )}
                  {documents.categoryProof && (
                    <div 
                      className="aspect-video rounded-lg overflow-hidden bg-muted cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => {
                        setPreviewImage(documents.categoryProof)
                        setPreviewTitle("Category Certificate")
                      }}
                    >
                      <img src={documents.categoryProof} alt="Category Proof" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
              </div>

              {/* Show Extracted Data Summary in Review */}
              {extractedData && (
                <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                  <h4 className="font-medium text-sm mb-2">AI Extracted Information</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <strong>Name:</strong>
                      <span>{extractedData.fullName || "Not extracted"}</span>
                    </div>
                    <div className="flex justify-between">
                      <strong>Aadhaar:</strong>
                      <span>{extractedData.aadhaarNumber || "Not extracted"}</span>
                    </div>
                    <div className="flex justify-between">
                      <strong>Marks/SGPA:</strong>
                      <span>{(extractedData.marks || extractedData.sgpa) || "Not extracted"}</span>
                    </div>
                    <div className="flex justify-between">
                      <strong>Category:</strong>
                      <span>{extractedData.category || "Not extracted"}</span>
                    </div>
                    <div className="flex justify-between">
                      <strong>College:</strong>
                      <span>{extractedData.college || "Not extracted"}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Show Validation Summary in Review */}
              {crossDocValidation && (
                <div className={`p-3 rounded-lg ${
                  crossDocValidation.isValid 
                    ? 'bg-green-50 border border-green-200' 
                    : crossDocValidation.warnings.length > 0 
                      ? 'bg-amber-50 border border-amber-200' 
                      : 'bg-red-50 border border-red-200'
                }`}>
                  <h4 className="font-medium text-sm mb-2">Document Verification Summary</h4>
                  <div className="flex items-center gap-2">
                    {crossDocValidation.isValid ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : crossDocValidation.warnings.length > 0 ? (
                      <AlertCircle className="h-4 w-4 text-amber-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                    <span className="text-sm">
                      {crossDocValidation.isValid 
                        ? "✅ All documents verified successfully" 
                        : crossDocValidation.warnings.length > 0 
                          ? `⚠️ ${crossDocValidation.warnings.length} warning(s) found` 
                          : `❌ ${crossDocValidation.issues.length} issue(s) found`}
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    Match Score: {crossDocValidation.matchScore.toFixed(0)}%
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Navigation */}
        <div className="flex justify-between pt-4">
          <Button type="button" variant="outline" onClick={prevStep} disabled={step === 1}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Previous
          </Button>
          
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={saveProgress} disabled={isSaving}>
              {isSaving ? <Spinner className="h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Save Draft
            </Button>
            
            {step < 4 ? (
              <Button type="button" onClick={nextStep}>
                Next
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button type="submit" disabled={isLoading || !crossDocValidation?.isValid}>
                {isLoading ? <Spinner className="h-4 w-4 mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                Submit Application
              </Button>
            )}
          </div>
        </div>
      </form>

      {/* Image Preview Dialog */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{previewTitle}</DialogTitle>
            <DialogDescription>
              Document preview - click outside to close
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center">
            <img src={previewImage!} alt={previewTitle} className="max-h-[80vh] object-contain" />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}