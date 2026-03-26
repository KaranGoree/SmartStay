"use client"

import { Badge } from "@/components/ui/badge"
import { useEffect, useState, useRef } from "react"
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
import { validateApplication } from "@/lib/utils/validation"
import { toast } from "sonner"
import { BRANCHES, YEARS, CATEGORIES, type Branch, type Year, type Category, type AdmissionType, type OCRData, type Application } from "@/lib/types"
import { ArrowLeft, ArrowRight, Save, Send, Bot, Download, CheckCircle, AlertCircle, Clock, XCircle, Printer, User, Signature, FileText, Shield, Award, Eye, FileCheck, Loader2 } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { validateDocumentsWithoutAI } from "@/lib/utils/document-verification"
import { calculateNameSimilarity } from "@/lib/utils/document-verification"

const applicationSchema = z.object({
  fullName: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phone: z.string().regex(/^\d{10}$/, "Phone must be 10 digits"),
  gender: z.enum(["Male", "Female", "Other"]),
  branch: z.enum(["Civil", "ETC", "Mechanical", "Electrical", "CSE"]),
  year: z.coerce.number().min(1).max(4),
  category: z.enum(["Open", "SC", "ST", "VJNT", "OBC", "EWS", "SEBC", "PWD"]),
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
  const printRef = useRef<HTMLDivElement>(null)
  const [isVerifying, setIsVerifying] = useState(false)
  const [showErrorDialog, setShowErrorDialog] = useState(false)
  const [errorDialogMessage, setErrorDialogMessage] = useState("")
  const [errorDialogDetails, setErrorDialogDetails] = useState<string[]>([])
  
  const [documents, setDocuments] = useState({
    marksheet: "",
    aadhaarCard: "",
    categoryProof: "",
    profilePhoto: "",
    signature: "",
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
      gender: "Male",
      branch: "Civil",
      year: 1,
      category: "Open",
      fullName: "",
      phone: "",
      aadhaarNumber: "",
      cetMarks: undefined,
      sgpa: undefined,
    },
  })
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null)
  const [crossDocValidation, setCrossDocValidation] = useState<any>(null)
  const admissionType = watch("admissionType")
  const selectedYear = watch("year")
  const selectedCategory = watch("category")
  const selectedGender = watch("gender")

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
          setValue("gender", (app as any).gender || "Male")
          setValue("branch", app.branch)
          setValue("year", app.year)
          setValue("category", app.category)
          setValue("aadhaarNumber", app.aadhaarNumber)
          setValue("admissionType", app.admissionType)
          if (app.cetMarks) setValue("cetMarks", app.cetMarks)
          if (app.sgpa) setValue("sgpa", app.sgpa)
          setDocuments(app.documents || {
            marksheet: "",
            aadhaarCard: "",
            categoryProof: "",
            profilePhoto: "",
            signature: "",
          })
          setOcrData(app.ocrData)
          setCrossDocValidation(app.crossDocumentValidation)
          setExtractedData(app.extractedData)
        }
      }
    }
    loadApplication()
  }, [user?.uid, setValue])

  const handleOCRComplete = (type: "marksheet" | "aadhaarCard" | "categoryProof", data: Partial<OCRData>, rawText: string) => {
    if (type !== "profilePhoto" && type !== "signature") {
      setOcrData((prev) => ({
        ...prev,
        ...data,
        confidence: Math.max(prev.confidence, data.confidence || 0),
      }))

      setRawOCRTexts((prev) => ({
        ...prev,
        [type]: rawText,
      }))
    }
  }

  const handlePrint = () => {
    if (!printRef.current) return
    
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      toast.error("Please allow popups to print the application")
      return
    }
    
    const content = printRef.current.innerHTML
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Hostel Application - ${getValues("fullName")}</title>
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
          .photo-signature { display: flex; gap: 40px; margin: 20px 0; justify-content: center; }
          .photo-box, .signature-box { text-align: center; }
          .photo-box img, .signature-box img { max-width: 150px; border: 1px solid #ddd; border-radius: 8px; padding: 5px; }
          .verification-box { margin-top: 20px; padding: 15px; border-radius: 8px; }
          .verification-passed { background: #f0fdf4; border: 1px solid #86efac; }
          .verification-warning { background: #fef9e3; border: 1px solid #fde047; }
          .verification-failed { background: #fee2e2; border: 1px solid #fca5a5; }
          .document-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-top: 20px; }
          .document-item { text-align: center; }
          .document-item img { width: 100%; border-radius: 8px; border: 1px solid #ddd; }
          @media print {
            body { margin: 0; padding: 20px; }
          }
        </style>
      </head>
      <body>
        ${content}
        <script>
          window.onload = () => {
            window.print()
            setTimeout(() => window.close(), 500)
          }
        </script>
      </body>
      </html>
    `)
    printWindow.document.close()
  }

  // Verify user input against extracted documents
  const verifyUserInputWithDocuments = () => {
    const formData = getValues();
    const errors: string[] = [];
    const warnings: string[] = [];

    // Name similarity
    if (extractedData?.fullName && formData.fullName) {
      const nameSimilarity = calculateNameSimilarity(formData.fullName, extractedData.fullName);
      if (nameSimilarity < 80) {
        errors.push(`Name mismatch: Form says "${formData.fullName}" but documents show "${extractedData.fullName}"`);
      } else if (nameSimilarity < 95) {
        warnings.push(`Name slight mismatch: Form "${formData.fullName}" vs Document "${extractedData.fullName}"`);
      }
    }

    // Aadhaar
    if (extractedData?.aadhaarNumber && formData.aadhaarNumber) {
      if (extractedData.aadhaarNumber !== formData.aadhaarNumber) {
        errors.push(`Aadhaar mismatch: Form "${formData.aadhaarNumber}" doesn't match document "${extractedData.aadhaarNumber}"`);
      }
    }

    // Category verification with separate SC/ST and EWS/SEBC
    if (extractedData?.category && formData.category && documents.categoryProof) {
      let extractedCat = extractedData.category.toUpperCase()
      let formCat = formData.category.toUpperCase()
      
      // Category mapping for comparison
      const categoryMap: { [key: string]: string[] } = {
        'SC': ['SC'],
        'ST': ['ST'],
        'SC/ST': ['SC', 'ST'], // For backward compatibility
        'OBC': ['OBC'],
        'VJNT': ['VJNT'],
        'EWS': ['EWS'],
        'SEBC': ['SEBC'],
        'PWD': ['PWD', 'PH', 'DISABLED'],
        'OPEN': ['OPEN', 'GENERAL']
      }
      
      // Find matching category from extracted text
      let extractedMatch = null
      let formMatch = null
      
      for (const [key, values] of Object.entries(categoryMap)) {
        if (values.includes(extractedCat)) {
          extractedMatch = key
          break
        }
      }
      
      for (const [key, values] of Object.entries(categoryMap)) {
        if (values.includes(formCat)) {
          formMatch = key
          break
        }
      }
      
      if (extractedMatch && formMatch && extractedMatch !== formMatch) {
        warnings.push(`Category mismatch: Form selected "${formData.category}" but document shows "${extractedData.category}"`)
      }
    }

    // Marks
    if (admissionType === "CET" && extractedData?.marks && formData.cetMarks) {
      const marksDiff = Math.abs(extractedData.marks - formData.cetMarks);
      if (marksDiff > 10) {
        errors.push(`CET Marks mismatch: Form entered ${formData.cetMarks} but document shows ${extractedData.marks}`);
      } else if (marksDiff > 0) {
        warnings.push(`CET Marks slight difference: Form ${formData.cetMarks} vs Document ${extractedData.marks}`);
      }
    } else if (admissionType === "SGPA" && extractedData?.sgpa && formData.sgpa) {
      const sgpaDiff = Math.abs(extractedData.sgpa - formData.sgpa);
      if (sgpaDiff > 0.5) {
        errors.push(`SGPA mismatch: Form entered ${formData.sgpa} but document shows ${extractedData.sgpa}`);
      } else if (sgpaDiff > 0) {
        warnings.push(`SGPA slight difference: Form ${formData.sgpa} vs Document ${extractedData.sgpa}`);
      }
    }

    return { isValid: errors.length === 0, errors, warnings };
  };

  const processDocumentVerification = async () => {
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

    setIsVerifying(true)

    try {
      const validation = validateDocumentsWithoutAI(
        rawOCRTexts.marksheet,
        rawOCRTexts.aadhaarCard,
        rawOCRTexts.categoryProof,
        selectedCategory
      )
      
      setCrossDocValidation({
        isValid: validation.isValid,
        matchScore: validation.matchScore,
        issues: validation.issues,
        warnings: validation.warnings,
        details: {
          marksheetVsAadhaar: {
            similarity: validation.data.marksheet.fullName && validation.data.aadhaar.fullName 
              ? calculateNameSimilarity(validation.data.marksheet.fullName, validation.data.aadhaar.fullName) 
              : 0,
            status: validation.isValid ? "verified" : "error"
          },
          bestName: validation.combinedData.fullName
        }
      })
      
      setExtractedData(validation.combinedData)
      
      let autoFilledCount = 0
      
      if (validation.combinedData.fullName && !getValues("fullName")) {
        setValue("fullName", validation.combinedData.fullName)
        toast.info(`✓ Name auto-filled: ${validation.combinedData.fullName}`)
        autoFilledCount++
      }
      
      if (validation.combinedData.aadhaarNumber && !getValues("aadhaarNumber")) {
        setValue("aadhaarNumber", validation.combinedData.aadhaarNumber)
        toast.info("✓ Aadhaar number auto-filled from document")
        autoFilledCount++
      }
      
      // Updated category normalization with separate SC/ST and EWS/SEBC
      if (validation.combinedData.category && !getValues("category")) {
        let normalizedCategory = validation.combinedData.category.toUpperCase()
        
        // Normalize based on detected category
        if (normalizedCategory === "SC") normalizedCategory = "SC"
        else if (normalizedCategory === "ST") normalizedCategory = "ST"
        else if (normalizedCategory === "OBC") normalizedCategory = "OBC"
        else if (normalizedCategory === "VJNT") normalizedCategory = "VJNT"
        else if (normalizedCategory === "EWS") normalizedCategory = "EWS"
        else if (normalizedCategory === "SEBC") normalizedCategory = "SEBC"
        else if (normalizedCategory === "PWD" || normalizedCategory === "PH" || normalizedCategory === "DISABLED") normalizedCategory = "PWD"
        else if (normalizedCategory === "OPEN" || normalizedCategory === "GENERAL") normalizedCategory = "Open"
        
        const allowedCategories = ["Open", "SC", "ST", "VJNT", "OBC", "EWS", "SEBC", "PWD"]
        if (allowedCategories.includes(normalizedCategory)) {
          setValue("category", normalizedCategory as Category)
          toast.info(`✓ Category auto-filled: ${normalizedCategory}`)
          autoFilledCount++
        }
      }
      
      const academicValue = validation.combinedData.marks || validation.combinedData.sgpa
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
      
      if (!validation.isValid) {
        toast.error("❌ Document Validation Failed! Please fix the issues.")
        validation.issues.forEach(issue => toast.error(issue))
      } else if (validation.warnings.length > 0) {
        toast.warning("⚠️ Document Validation Warnings")
        validation.warnings.forEach(warning => toast.warning(warning))
        if (autoFilledCount > 0) {
          toast.info(`📝 ${autoFilledCount} field(s) auto-filled. Please review.`)
        }
      } else {
        toast.success(`✅ All documents verified! ${autoFilledCount > 0 ? `${autoFilledCount} field(s) auto-filled.` : ''}`)
      }
      
      setOcrData((prev) => ({
        ...prev,
        extractedName: validation.combinedData.fullName || "",
        extractedAadhaar: validation.combinedData.aadhaarNumber || "",
        extractedMarks: academicValue,
        extractedCategory: validation.combinedData.category || "",
        extractedCollege: validation.combinedData.college || "",
        confidence: validation.isValid ? 0.95 : 0.7,
      }))
      
    } catch (err) {
      console.error("❌ Validation Error:", err)
      toast.error("Failed to process documents. Please try again.")
    } finally {
      setIsVerifying(false)
    }
  }

  const nextStep = async () => {
    const fieldsToValidate: (keyof ApplicationFormData)[] = 
      step === 1 ? ["fullName", "email", "phone", "gender", "aadhaarNumber"] :
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

      const { cetMarks, sgpa, ...rest } = formData

      const applicationData = {
        userId: user!.uid,
        status: "draft" as const,
        ...rest,
        gender: selectedGender,
        documents,
        ocrData,
        validation,
        crossDocumentValidation: crossDocValidation,
        extractedData: extractedData,
        ...(admissionType === "CET" ? { cetMarks } : { sgpa }),
      }

      if (existingApp) {
        await updateApplication(existingApp.id, applicationData)
      } else {
        const id = await createApplication(applicationData)
        setExistingApp({ ...applicationData, id } as Application)
      }
      
      toast.success("Progress saved")
    } catch (error) {
      console.error("Save error:", error)
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
          .photo-signature { display: flex; gap: 40px; margin: 20px 0; justify-content: center; }
          .photo-box, .signature-box { text-align: center; }
          .photo-box img, .signature-box img { max-width: 150px; border: 1px solid #ddd; border-radius: 8px; padding: 5px; }
          .verification-box { margin-top: 20px; padding: 15px; border-radius: 8px; }
          .verification-passed { background: #f0fdf4; border: 1px solid #86efac; }
          .verification-warning { background: #fef9e3; border: 1px solid #fde047; }
          .verification-failed { background: #fee2e2; border: 1px solid #fca5a5; }
          .document-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-top: 20px; }
          .document-item { text-align: center; }
          .document-item img { width: 100%; border-radius: 8px; border: 1px solid #ddd; }
          @media print {
            body { margin: 0; padding: 20px; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">Hostel Accommodation Application</div>
          <div class="subtitle">Government College of Engineering, Nagpur</div>
          <div class="subtitle">Application Date: ${new Date().toLocaleDateString()}</div>
        </div>

        <div class="photo-signature">
          ${documents.profilePhoto ? `
            <div class="photo-box">
              <img src="${documents.profilePhoto}" alt="Profile Photo" />
              <p><strong>Profile Photo</strong></p>
            </div>
          ` : ''}
          ${documents.signature ? `
            <div class="signature-box">
              <img src="${documents.signature}" alt="Signature" />
              <p><strong>Signature</strong></p>
            </div>
          ` : ''}
        </div>

        <div class="section">
          <div class="section-title">Personal Information</div>
          <div class="info-row">
            <div class="info-label">Full Name:</div>
            <div class="info-value">${formData.fullName}</div>
          </div>
          <div class="info-row">
            <div class="info-label">Gender:</div>
            <div class="info-value">${selectedGender}</div>
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
            <div class="section-title">Verified Information</div>
            <div class="verification-box verification-passed">
              <div class="info-row">
                <div class="info-label">Verified Name:</div>
                <div class="info-value">${extractedData.fullName || "Not found"}</div>
              </div>
              <div class="info-row">
                <div class="info-label">Verified Aadhaar:</div>
                <div class="info-value">${extractedData.aadhaarNumber || "Not found"}</div>
              </div>
              <div class="info-row">
                <div class="info-label">Verified ${admissionType === "CET" ? "Marks" : "SGPA"}:</div>
                <div class="info-value">${extractedData.marks || extractedData.sgpa || "Not found"}</div>
              </div>
              <div class="info-row">
                <div class="info-label">Verified Category:</div>
                <div class="info-value">${extractedData.category || "Not found"}</div>
              </div>
              <div class="info-row">
                <div class="info-label">College:</div>
                <div class="info-value">${extractedData.college || "Government College of Engineering, Nagpur"}</div>
              </div>
            </div>
          </div>
        ` : ''}

        ${crossDocValidation ? `
          <div class="section">
            <div class="section-title">Document Verification Report</div>
            <div class="verification-box ${crossDocValidation.isValid && crossDocValidation.warnings?.length === 0 ? 'verification-passed' : crossDocValidation.warnings?.length > 0 ? 'verification-warning' : 'verification-failed'}">
              <div><strong>Validation Status:</strong> ${crossDocValidation.isValid && crossDocValidation.warnings?.length === 0 ? '✓ Perfect Match' : crossDocValidation.isValid ? '⚠️ Verified with Warnings' : '✗ Failed'}</div>
              <div><strong>Match Score:</strong> ${crossDocValidation.matchScore.toFixed(0)}%</div>
              <div><strong>Name Match (Marksheet vs Aadhaar):</strong> ${crossDocValidation.details?.marksheetVsAadhaar?.similarity?.toFixed(0) || 0}%</div>
              ${crossDocValidation.issues?.length > 0 ? `
                <div><strong>Issues Found:</strong></div>
                <ul>${crossDocValidation.issues.map((i: string) => `<li>${i}</li>`).join('')}</ul>
              ` : ''}
              ${crossDocValidation.warnings?.length > 0 ? `
                <div><strong>Warnings:</strong></div>
                <ul>${crossDocValidation.warnings.map((w: string) => `<li>${w}</li>`).join('')}</ul>
              ` : ''}
            </div>
          </div>
        ` : ''}

        <div class="section">
          <div class="section-title">Uploaded Documents</div>
          <div class="document-grid">
            ${documents.marksheet ? `
              <div class="document-item">
                <img src="${documents.marksheet}" alt="Marksheet" />
                <p>Marksheet</p>
              </div>
            ` : ''}
            ${documents.aadhaarCard ? `
              <div class="document-item">
                <img src="${documents.aadhaarCard}" alt="Aadhaar Card" />
                <p>Aadhaar Card</p>
              </div>
            ` : ''}
            ${documents.categoryProof ? `
              <div class="document-item">
                <img src="${documents.categoryProof}" alt="Category Certificate" />
                <p>Category Certificate</p>
              </div>
            ` : ''}
          </div>
        </div>

        <div class="section">
          <div class="section-title">Declaration</div>
          <p>I hereby declare that all the information provided in this application is true and correct to the best of my knowledge. I understand that any false information may lead to cancellation of my application and hostel accommodation.</p>
          <div style="margin-top: 40px; display: flex; justify-content: space-between;">
            <div>
              ${documents.signature ? `
                <img src="${documents.signature}" alt="Signature" style="max-width: 150px; border: 1px solid #ddd; border-radius: 8px; padding: 5px;" />
              ` : '<p>Signature: ____________________</p>'}
              <p style="font-size: 12px; color: #666; margin-top: 5px;">(Applicant Signature)</p>
            </div>
            <div>
              <p>Date: ${new Date().toLocaleDateString()}</p>
            </div>
          </div>
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
    console.log("Manual submission triggered by user click");
    
    // Check all required documents
    if (!documents.marksheet) {
      toast.error("❌ Please upload your marksheet/result")
      setStep(3)
      return
    }

    if (!documents.aadhaarCard) {
      toast.error("❌ Please upload your Aadhaar card")
      setStep(3)
      return
    }

    if (!documents.profilePhoto) {
      toast.error("❌ Please upload your profile photo")
      setStep(3)
      return
    }

    if (!documents.signature) {
      toast.error("❌ Please upload your signature")
      setStep(3)
      return
    }

    // Check if verification was performed
    if (!crossDocValidation) {
      toast.error("❌ Please verify your documents first by clicking the 'Verify Documents' button")
      setStep(3)
      return
    }

    // Verify document match score
    if (crossDocValidation.matchScore < 95) {
      const msg = `❌ Document verification score is ${crossDocValidation.matchScore.toFixed(0)}%. Minimum 95% required. Please upload clearer images.`;
      toast.error(msg);
      setStep(3);
      return;
    }

    // Check for verification warnings
    if (crossDocValidation.warnings && crossDocValidation.warnings.length > 0) {
      const warningCount = crossDocValidation.warnings.length;
      toast.error(`❌ Please resolve ${warningCount} verification warning(s) before submitting.`);
      setStep(3);
      return;
    }

    // Verify user input matches extracted documents
    const inputVerification = verifyUserInputWithDocuments();
    
    if (!inputVerification.isValid) {
      setErrorDialogMessage("Verification Failed");
      setErrorDialogDetails(inputVerification.errors);
      setShowErrorDialog(true);
      setStep(1);
      return;
    }

    // Show warnings if any
    if (inputVerification.warnings.length > 0) {
      const warningMessage = inputVerification.warnings.join('\n• ');
      const confirmed = window.confirm(
        `⚠️ Verification Warnings:\n• ${warningMessage}\n\nDo you still want to submit?`
      );
      if (!confirmed) return;
    }

    // Final confirmation
    const confirmed = window.confirm(
      "Are you sure you want to submit this application?\n\n" +
      "Please verify all information carefully. Once submitted, you cannot make changes until reviewed by admin."
    );
    
    if (!confirmed) return;

    setIsLoading(true);
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
      );

      const { cetMarks, sgpa, ...rest } = data;

      const applicationData = {
        userId: user!.uid,
        status: "pending" as const,
        ...rest,
        gender: selectedGender,
        documents,
        ocrData,
        validation,
        crossDocumentValidation: crossDocValidation,
        extractedData: extractedData,
        userInputVerification: inputVerification,
        submittedAt: new Date().toISOString(),
        ...(admissionType === "CET" ? { cetMarks } : { sgpa }),
      };

      if (existingApp) {
        await updateApplication(existingApp.id, { ...applicationData, status: "pending" })
      } else {
        await createApplication(applicationData)
      }

      toast.success("✅ Application submitted successfully!")
      router.push("/dashboard/status")
    } catch (error) {
      console.error("Submission error:", error)
      toast.error("Failed to submit application. Please try again.")
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

  const canSubmit = crossDocValidation && 
                    crossDocValidation.isValid && 
                    crossDocValidation.warnings?.length === 0 && 
                    crossDocValidation.matchScore >= 95

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Hidden Print Content */}
      <div ref={printRef} className="hidden">
        <div className="p-8 max-w-4xl mx-auto bg-white">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold">Government College of Engineering, Nagpur</h1>
            <h2 className="text-xl font-semibold mt-2">Hostel Accommodation Application</h2>
            <p className="text-gray-600 mt-1">Application Date: {new Date().toLocaleDateString()}</p>
            <p className="text-gray-600">Application ID: {existingApp?.id || "NEW"}</p>
          </div>

          <div className="photo-signature" style={{ display: 'flex', gap: '40px', margin: '20px 0', justifyContent: 'center' }}>
            {documents.profilePhoto && (
              <div style={{ textAlign: 'center' }}>
                <img src={documents.profilePhoto} alt="Profile Photo" style={{ maxWidth: '150px', border: '1px solid #ddd', borderRadius: '8px', padding: '5px' }} />
                <p><strong>Profile Photo</strong></p>
              </div>
            )}
            {documents.signature && (
              <div style={{ textAlign: 'center' }}>
                <img src={documents.signature} alt="Signature" style={{ maxWidth: '150px', border: '1px solid #ddd', borderRadius: '8px', padding: '5px' }} />
                <p><strong>Signature</strong></p>
              </div>
            )}
          </div>

          <div className="mb-6">
            <h3 className="text-lg font-semibold border-b pb-2 mb-4">Personal Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div><strong>Full Name:</strong> {watch("fullName")}</div>
              <div><strong>Gender:</strong> {selectedGender}</div>
              <div><strong>Email:</strong> {watch("email")}</div>
              <div><strong>Phone:</strong> {watch("phone")}</div>
              <div><strong>Aadhaar Number:</strong> {watch("aadhaarNumber")}</div>
            </div>
          </div>

          <div className="mb-6">
            <h3 className="text-lg font-semibold border-b pb-2 mb-4">Academic Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div><strong>Branch:</strong> {watch("branch")}</div>
              <div><strong>Year:</strong> {watch("year")}</div>
              <div><strong>Category:</strong> {watch("category")}</div>
              <div><strong>Admission Type:</strong> {watch("admissionType")}</div>
              <div><strong>{admissionType === "CET" ? "CET Marks:" : "SGPA:"}</strong> 
                {admissionType === "CET" ? watch("cetMarks") : watch("sgpa")}
              </div>
            </div>
          </div>

          {extractedData && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold border-b pb-2 mb-4">Verified Information</h3>
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <div className="grid grid-cols-2 gap-4">
                  <div><strong>Verified Name:</strong> {extractedData.fullName || "Not found"}</div>
                  <div><strong>Verified Aadhaar:</strong> {extractedData.aadhaarNumber || "Not found"}</div>
                  <div><strong>Verified {admissionType === "CET" ? "Marks" : "SGPA"}:</strong> {extractedData.marks || extractedData.sgpa || "Not found"}</div>
                  <div><strong>Verified Category:</strong> {extractedData.category || "Not found"}</div>
                  <div><strong>College:</strong> {extractedData.college || "Government College of Engineering, Nagpur"}</div>
                </div>
              </div>
            </div>
          )}

          {crossDocValidation && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold border-b pb-2 mb-4">Document Verification Report</h3>
              <div className={`p-4 rounded-lg ${
                crossDocValidation.isValid && crossDocValidation.warnings?.length === 0 ? "bg-green-50" : crossDocValidation.warnings?.length > 0 ? "bg-yellow-50" : "bg-red-50"
              }`}>
                <p><strong>Validation Status:</strong> {crossDocValidation.isValid && crossDocValidation.warnings?.length === 0 ? "✓ Perfect Match" : crossDocValidation.isValid ? "⚠️ Verified with Warnings" : "✗ Failed"}</p>
                <p><strong>Match Score:</strong> {crossDocValidation.matchScore.toFixed(0)}%</p>
                <p><strong>Name Match (Marksheet vs Aadhaar):</strong> {crossDocValidation.details?.marksheetVsAadhaar?.similarity?.toFixed(0) || 0}%</p>
                {crossDocValidation.issues?.length > 0 && (
                  <div className="mt-2">
                    <strong>Issues Found:</strong>
                    <ul className="list-disc list-inside mt-1">
                      {crossDocValidation.issues.map((issue: string, idx: number) => (
                        <li key={idx}>{issue}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {crossDocValidation.warnings?.length > 0 && (
                  <div className="mt-2">
                    <strong>Warnings:</strong>
                    <ul className="list-disc list-inside mt-1">
                      {crossDocValidation.warnings.map((warning: string, idx: number) => (
                        <li key={idx}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="mb-6">
            <h3 className="text-lg font-semibold border-b pb-2 mb-4">Uploaded Documents</h3>
            <div className="grid grid-cols-3 gap-4">
              {documents.marksheet && (
                <div className="text-center">
                  <img src={documents.marksheet} alt="Marksheet" className="w-full rounded-lg border shadow-sm" />
                  <p className="text-sm mt-1">Marksheet</p>
                </div>
              )}
              {documents.aadhaarCard && (
                <div className="text-center">
                  <img src={documents.aadhaarCard} alt="Aadhaar Card" className="w-full rounded-lg border shadow-sm" />
                  <p className="text-sm mt-1">Aadhaar Card</p>
                </div>
              )}
              {documents.categoryProof && (
                <div className="text-center">
                  <img src={documents.categoryProof} alt="Category Certificate" className="w-full rounded-lg border shadow-sm" />
                  <p className="text-sm mt-1">Category Certificate</p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-8 pt-4 border-t">
            <h3 className="text-lg font-semibold mb-4">Declaration</h3>
            <p className="text-sm">
              I hereby declare that all the information provided in this application is true and correct to the best of my knowledge. 
              I understand that any false information may lead to cancellation of my application and hostel accommodation.
            </p>
            <div className="mt-8 flex justify-between">
              <div>
                {documents.signature ? (
                  <>
                    <img src={documents.signature} alt="Signature" style={{ maxWidth: '150px', border: '1px solid #ddd', borderRadius: '8px', padding: '5px' }} />
                    <p className="text-sm text-gray-500 mt-1">(Applicant Signature)</p>
                  </>
                ) : (
                  <p>Signature: ____________________</p>
                )}
              </div>
              <div>
                <p>Date: {new Date().toLocaleDateString()}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Progress with enhanced styling */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          {STEPS.map((s) => (
            <div
              key={s.id}
              className={`flex-1 text-center ${step >= s.id ? "text-primary font-medium" : "text-muted-foreground"}`}
            >
              <div className="hidden sm:block">{s.title}</div>
              <div className="sm:hidden">{s.id}</div>
            </div>
          ))}
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        {/* Step 1: Personal Info */}
        {step === 1 && (
          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent">
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                Personal Information
              </CardTitle>
              <CardDescription>Enter your basic details as per your documents</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="fullName">Full Name (as per documents)</FieldLabel>
                  <Input id="fullName" placeholder="Enter your full name" {...register("fullName")} className="focus:ring-2 focus:ring-primary/20" />
                  {errors.fullName && <FieldError>{errors.fullName.message}</FieldError>}
                </Field>
                <Field>
                  <FieldLabel>Gender</FieldLabel>
                  <RadioGroup
                    onValueChange={(v) => setValue("gender", v as "Male" | "Female" | "Other")}
                    value={selectedGender}
                    className="flex gap-6"
                  >
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="Male" id="male" />
                      <label htmlFor="male" className="text-sm cursor-pointer">Male</label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="Female" id="female" />
                      <label htmlFor="female" className="text-sm cursor-pointer">Female</label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="Other" id="other" />
                      <label htmlFor="other" className="text-sm cursor-pointer">Other</label>
                    </div>
                  </RadioGroup>
                  {errors.gender && <FieldError>{errors.gender.message}</FieldError>}
                </Field>
                <Field>
                  <FieldLabel htmlFor="email">Email Address</FieldLabel>
                  <Input id="email" type="email" placeholder="your.email@gcoen.ac.in" {...register("email")} className="focus:ring-2 focus:ring-primary/20" />
                  {errors.email && <FieldError>{errors.email.message}</FieldError>}
                </Field>
                <Field>
                  <FieldLabel htmlFor="phone">Phone Number</FieldLabel>
                  <Input id="phone" placeholder="10-digit mobile number" {...register("phone")} className="focus:ring-2 focus:ring-primary/20" />
                  {errors.phone && <FieldError>{errors.phone.message}</FieldError>}
                </Field>
                <Field>
                  <FieldLabel htmlFor="aadhaarNumber">Aadhaar Number</FieldLabel>
                  <Input id="aadhaarNumber" placeholder="12-digit Aadhaar number" {...register("aadhaarNumber")} className="focus:ring-2 focus:ring-primary/20" />
                  {errors.aadhaarNumber && <FieldError>{errors.aadhaarNumber.message}</FieldError>}
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Academic Info */}
        {step === 2 && (
          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent">
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5 text-primary" />
                Academic Information
              </CardTitle>
              <CardDescription>Enter your academic details</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
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
                </Field>
                <Field>
                  <FieldLabel>Admission Type</FieldLabel>
                  <RadioGroup
                    onValueChange={(v) => setValue("admissionType", v as AdmissionType)}
                    value={admissionType}
                    className="flex gap-6"
                  >
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="CET" id="cet" />
                      <label htmlFor="cet" className="text-sm cursor-pointer">CET (1st Year)</label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="SGPA" id="sgpa" />
                      <label htmlFor="sgpa" className="text-sm cursor-pointer">SGPA (2nd-4th Year)</label>
                    </div>
                  </RadioGroup>
                </Field>
                {admissionType === "CET" ? (
                  <Field>
                    <FieldLabel htmlFor="cetMarks">CET Marks (out of 200)</FieldLabel>
                    <Input id="cetMarks" type="number" placeholder="Enter CET marks" {...register("cetMarks")} className="focus:ring-2 focus:ring-primary/20" />
                    {errors.cetMarks && <FieldError>{errors.cetMarks.message}</FieldError>}
                  </Field>
                ) : (
                  <Field>
                    <FieldLabel htmlFor="sgpa">SGPA (out of 10)</FieldLabel>
                    <Input id="sgpa" type="number" step="0.01" placeholder="Enter SGPA" {...register("sgpa")} className="focus:ring-2 focus:ring-primary/20" />
                    {errors.sgpa && <FieldError>{errors.sgpa.message}</FieldError>}
                  </Field>
                )}
              </FieldGroup>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Documents */}
        {step === 3 && (
          <div className="space-y-6">
            <Card className="shadow-sm">
              <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Document Upload
                </CardTitle>
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
              {(selectedCategory === "SC" || selectedCategory === "ST" || selectedCategory === "VJNT" || selectedCategory === "OBC" || selectedCategory === "EWS" || selectedCategory === "SEBC" || selectedCategory === "PWD") && (
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

            {/* Profile Photo and Signature */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Profile Photo <span className="text-destructive">*</span>
                </label>
                <DocumentUpload
                  type="profilePhoto"
                  label="Profile Photo"
                  description="Recent passport size photograph"
                  required
                  value={documents.profilePhoto}
                  onChange={(v) => setDocuments((d) => ({ ...d, profilePhoto: v }))}
                  onOCRComplete={() => {}}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Signature className="h-4 w-4" />
                  Signature <span className="text-destructive">*</span>
                </label>
                <DocumentUpload
                  type="signature"
                  label="Signature"
                  description="Sign on white paper with black ink"
                  required
                  value={documents.signature}
                  onChange={(v) => setDocuments((d) => ({ ...d, signature: v }))}
                  onOCRComplete={() => {}}
                />
              </div>
            </div>

            {/* Verify Documents Button */}
            {(documents.marksheet && documents.aadhaarCard) && (
              <Card className="bg-gradient-to-r from-blue-50 to-white border-blue-200">
                <CardContent className="pt-6">
                  <Button 
                    onClick={processDocumentVerification}
                    disabled={isVerifying || !rawOCRTexts.marksheet || !rawOCRTexts.aadhaarCard}
                    className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
                    size="lg"
                  >
                    {isVerifying ? (
                      <>
                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                        Verifying Documents...
                      </>
                    ) : (
                      <>
                        <Shield className="h-5 w-5 mr-2" />
                        Verify Documents
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground mt-3 text-center">
                    This will verify name, Aadhaar, marks, and category across all uploaded documents
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Verification Results */}
            {crossDocValidation && (
              <Card className={`shadow-md transition-all ${
                crossDocValidation.isValid && crossDocValidation.warnings?.length === 0 
                  ? "border-emerald-500 bg-emerald-50/30" 
                  : crossDocValidation.isValid 
                    ? "border-amber-500 bg-amber-50/30" 
                    : "border-red-500 bg-red-50/30"
              }`}>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    {crossDocValidation.isValid && crossDocValidation.warnings?.length === 0 ? (
                      <CheckCircle className="h-5 w-5 text-emerald-600" />
                    ) : crossDocValidation.isValid ? (
                      <AlertCircle className="h-5 w-5 text-amber-600" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600" />
                    )}
                    Document Verification Results
                  </CardTitle>
                  <CardDescription className="text-base">
                    <span className="font-semibold">Match Score:</span> {crossDocValidation.matchScore.toFixed(0)}% | 
                    <span className="ml-1">
                      {crossDocValidation.isValid && crossDocValidation.warnings?.length === 0 
                        ? " ✅ Perfect match - Ready for submission" 
                        : crossDocValidation.isValid 
                          ? " ⚠️ Verified with warnings" 
                          : " ❌ Validation failed"}
                    </span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {extractedData && (
                    <div className="space-y-3">
                      <h4 className="font-semibold text-sm flex items-center gap-2 text-emerald-700">
                        <FileCheck className="h-4 w-4" />
                        Verified Information from Documents
                      </h4>
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="flex items-center justify-between p-3 bg-white rounded-lg border">
                          <span className="text-sm font-medium text-muted-foreground">Full Name</span>
                          <span className="text-sm font-semibold">{extractedData.fullName || "Not found"}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-white rounded-lg border">
                          <span className="text-sm font-medium text-muted-foreground">Aadhaar Number</span>
                          <span className="text-sm font-mono font-semibold">{extractedData.aadhaarNumber || "Not found"}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-white rounded-lg border">
                          <span className="text-sm font-medium text-muted-foreground">{admissionType === "CET" ? "CET Marks" : "SGPA / CGPA"}</span>
                          <span className="text-sm font-semibold">{extractedData.marks || extractedData.sgpa || "Not found"}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-white rounded-lg border">
                          <span className="text-sm font-medium text-muted-foreground">Category</span>
                          <span className="text-sm font-semibold">{extractedData.category || "Not found"}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-white rounded-lg border md:col-span-2">
                          <span className="text-sm font-medium text-muted-foreground">College</span>
                          <span className="text-sm font-semibold">{extractedData.college || "Government College of Engineering, Nagpur"}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">Name Verification</h4>
                    <div className="grid gap-2">
                      <div className="flex items-center justify-between p-3 bg-white rounded-lg border">
                        <span className="text-sm">Marksheet vs Aadhaar</span>
                        <div className="flex items-center gap-3">
                          <div className="w-32 bg-gray-200 rounded-full h-2 overflow-hidden">
                            <div 
                              className="h-full bg-primary rounded-full transition-all"
                              style={{ width: `${crossDocValidation.details?.marksheetVsAadhaar?.similarity || 0}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium min-w-[50px]">{crossDocValidation.details?.marksheetVsAadhaar?.similarity?.toFixed(0) || 0}%</span>
                          {renderValidationBadge(crossDocValidation.details?.marksheetVsAadhaar?.status || "pending")}
                        </div>
                      </div>
                    </div>
                  </div>

                  {crossDocValidation.isValid && crossDocValidation.warnings?.length === 0 && crossDocValidation.matchScore >= 95 && (
                    <div className="p-4 rounded-lg bg-emerald-100 border border-emerald-300">
                      <div className="flex items-start gap-3">
                        <CheckCircle className="h-6 w-6 text-emerald-600 mt-0.5" />
                        <div>
                          <p className="text-sm font-semibold text-emerald-800">✅ Perfect Document Verification!</p>
                          <p className="text-sm text-emerald-700 mt-1">
                            All documents are perfectly verified with {crossDocValidation.matchScore.toFixed(0)}% match score. 
                            You can now proceed to review and submit your application.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {crossDocValidation.isValid && crossDocValidation.warnings?.length > 0 && (
                    <div className="p-4 rounded-lg bg-amber-100 border border-amber-300">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="h-6 w-6 text-amber-600 mt-0.5" />
                        <div>
                          <p className="text-sm font-semibold text-amber-800">⚠️ Verification Warnings Found</p>
                          <p className="text-sm text-amber-700 mt-1">
                            Please resolve all warnings before submitting. Documents need perfect verification (95%+ match score).
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {!crossDocValidation.isValid && (
                    <div className="p-4 rounded-lg bg-red-100 border border-red-300">
                      <div className="flex items-start gap-3">
                        <XCircle className="h-6 w-6 text-red-600 mt-0.5" />
                        <div>
                          <p className="text-sm font-semibold text-red-800">❌ Verification Failed</p>
                          <p className="text-sm text-red-700 mt-1">
                            Please fix the issues below before submitting.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {crossDocValidation.issues?.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm text-red-600">Issues Found (Must Fix)</h4>
                      <ul className="list-disc list-inside text-sm text-red-600 space-y-1 bg-red-50 p-3 rounded-lg">
                        {crossDocValidation.issues.map((issue: string, idx: number) => (
                          <li key={idx}>{issue}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {crossDocValidation.warnings?.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm text-amber-600">Warnings (Must Resolve)</h4>
                      <ul className="list-disc list-inside text-sm text-amber-600 space-y-1 bg-amber-50 p-3 rounded-lg">
                        {crossDocValidation.warnings.map((warning: string, idx: number) => (
                          <li key={idx}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Step 4: Review */}
        {step === 4 && (
          <Card className="shadow-lg">
            <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <CardTitle className="text-xl flex items-center gap-2">
                    <Eye className="h-5 w-5 text-primary" />
                    Review Your Application
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Please verify all information before submitting. You can edit until the deadline.
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={handlePrint} className="gap-2">
                    <Printer className="h-4 w-4" />
                    Print / Save as PDF
                  </Button>
                  <Button type="button" variant="outline" onClick={downloadApplication} className="gap-2">
                    <Download className="h-4 w-4" />
                    Download HTML
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="bg-muted/30 p-4 rounded-lg">
                  <h4 className="font-semibold mb-3 flex items-center gap-2 text-primary">
                    <User className="h-4 w-4" />
                    Personal Details
                  </h4>
                  <dl className="space-y-2 text-sm">
                    <div className="flex justify-between py-1 border-b">
                      <dt className="text-muted-foreground">Name:</dt>
                      <dd className="font-medium">{watch("fullName")}</dd>
                    </div>
                    <div className="flex justify-between py-1 border-b">
                      <dt className="text-muted-foreground">Gender:</dt>
                      <dd className="font-medium">{selectedGender}</dd>
                    </div>
                    <div className="flex justify-between py-1 border-b">
                      <dt className="text-muted-foreground">Email:</dt>
                      <dd className="font-medium">{watch("email")}</dd>
                    </div>
                    <div className="flex justify-between py-1 border-b">
                      <dt className="text-muted-foreground">Phone:</dt>
                      <dd className="font-medium">{watch("phone")}</dd>
                    </div>
                    <div className="flex justify-between py-1">
                      <dt className="text-muted-foreground">Aadhaar:</dt>
                      <dd className="font-mono font-medium">{watch("aadhaarNumber")}</dd>
                    </div>
                  </dl>
                </div>
                <div className="bg-muted/30 p-4 rounded-lg">
                  <h4 className="font-semibold mb-3 flex items-center gap-2 text-primary">
                    <Award className="h-4 w-4" />
                    Academic Details
                  </h4>
                  <dl className="space-y-2 text-sm">
                    <div className="flex justify-between py-1 border-b">
                      <dt className="text-muted-foreground">Branch:</dt>
                      <dd className="font-medium">{watch("branch")}</dd>
                    </div>
                    <div className="flex justify-between py-1 border-b">
                      <dt className="text-muted-foreground">Year:</dt>
                      <dd className="font-medium">{watch("year")}</dd>
                    </div>
                    <div className="flex justify-between py-1 border-b">
                      <dt className="text-muted-foreground">Category:</dt>
                      <dd className="font-medium">{watch("category")}</dd>
                    </div>
                    <div className="flex justify-between py-1">
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
                <h4 className="font-semibold mb-3 flex items-center gap-2 text-primary">
                  <FileText className="h-4 w-4" />
                  Photos & Signatures
                </h4>
                <div className="grid gap-4 grid-cols-2">
                  {documents.profilePhoto && (
                    <div 
                      className="aspect-square rounded-lg overflow-hidden bg-muted cursor-pointer hover:opacity-90 transition-opacity border-2 hover:border-primary"
                      onClick={() => {
                        setPreviewImage(documents.profilePhoto)
                        setPreviewTitle("Profile Photo")
                      }}
                    >
                      <img src={documents.profilePhoto} alt="Profile Photo" className="w-full h-full object-cover" />
                    </div>
                  )}
                  {documents.signature && (
                    <div 
                      className="aspect-square rounded-lg overflow-hidden bg-muted cursor-pointer hover:opacity-90 transition-opacity border-2 hover:border-primary"
                      onClick={() => {
                        setPreviewImage(documents.signature)
                        setPreviewTitle("Signature")
                      }}
                    >
                      <img src={documents.signature} alt="Signature" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
              </div>
              
              <div>
                <h4 className="font-semibold mb-3">Uploaded Documents</h4>
                <div className="grid gap-4 grid-cols-3">
                  {documents.marksheet && (
                    <div 
                      className="aspect-video rounded-lg overflow-hidden bg-muted cursor-pointer hover:opacity-90 transition-opacity border hover:border-primary"
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
                      className="aspect-video rounded-lg overflow-hidden bg-muted cursor-pointer hover:opacity-90 transition-opacity border hover:border-primary"
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
                      className="aspect-video rounded-lg overflow-hidden bg-muted cursor-pointer hover:opacity-90 transition-opacity border hover:border-primary"
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

              {extractedData && (
                <div className="p-4 rounded-lg bg-green-50 border border-green-200">
                  <h4 className="font-semibold text-sm mb-3 flex items-center gap-2 text-green-700">
                    <CheckCircle className="h-4 w-4" />
                    Verified Information from Documents
                  </h4>
                  <div className="grid gap-3 md:grid-cols-2 text-sm">
                    <div className="flex justify-between">
                      <strong>Verified Name:</strong>
                      <span>{extractedData.fullName || "Not found"}</span>
                    </div>
                    <div className="flex justify-between">
                      <strong>Verified Aadhaar:</strong>
                      <span>{extractedData.aadhaarNumber || "Not found"}</span>
                    </div>
                    <div className="flex justify-between">
                      <strong>Verified {admissionType === "CET" ? "Marks" : "SGPA"}:</strong>
                      <span>{extractedData.marks || extractedData.sgpa || "Not found"}</span>
                    </div>
                    <div className="flex justify-between">
                      <strong>Verified Category:</strong>
                      <span>{extractedData.category || "Not found"}</span>
                    </div>
                    <div className="flex justify-between md:col-span-2">
                      <strong>College:</strong>
                      <span>{extractedData.college || "Government College of Engineering, Nagpur"}</span>
                    </div>
                  </div>
                </div>
              )}

              {crossDocValidation && (
                <div className={`p-4 rounded-lg ${
                  canSubmit 
                    ? 'bg-emerald-50 border border-emerald-200' 
                    : crossDocValidation.warnings?.length > 0 
                      ? 'bg-amber-50 border border-amber-200' 
                      : 'bg-red-50 border border-red-200'
                }`}>
                  <h4 className="font-semibold text-sm mb-2">Document Verification Summary</h4>
                  <div className="flex items-center gap-2 mb-2">
                    {canSubmit ? (
                      <CheckCircle className="h-5 w-5 text-emerald-600" />
                    ) : crossDocValidation.warnings?.length > 0 ? (
                      <AlertCircle className="h-5 w-5 text-amber-600" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600" />
                    )}
                    <span className="font-medium">
                      {canSubmit 
                        ? "✅ Perfect verification - Ready for submission" 
                        : crossDocValidation.warnings?.length > 0 
                          ? `⚠️ ${crossDocValidation.warnings.length} warning(s) found - Please fix before submitting` 
                          : `❌ ${crossDocValidation.issues.length} issue(s) found - Must fix to submit`}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Match Score: <span className="font-semibold">{crossDocValidation.matchScore.toFixed(0)}%</span>
                    {!canSubmit && (
                      <span className="ml-2 text-amber-600">(95%+ required for submission)</span>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Navigation */}
        <div className="flex justify-between pt-6">
          <Button type="button" variant="outline" onClick={prevStep} disabled={step === 1} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Previous
          </Button>
          
          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={saveProgress} disabled={isSaving} className="gap-2">
              {isSaving ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />}
              Save Draft
            </Button>
            
            {step < 4 ? (
              <Button type="button" onClick={nextStep} className="gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70">
                Next
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button 
                type="submit" 
                disabled={isLoading || !canSubmit}
                className={`gap-2 ${canSubmit ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600' : ''}`}
              >
                {isLoading ? <Spinner className="h-4 w-4" /> : <Send className="h-4 w-4" />}
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

      {/* Error Dialog */}
      <Dialog open={showErrorDialog} onOpenChange={setShowErrorDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <XCircle className="h-5 w-5" />
              {errorDialogMessage}
            </DialogTitle>
            <DialogDescription>
              Please fix these issues before submitting:
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {errorDialogDetails.map((detail, idx) => (
              <div key={idx} className="p-3 bg-red-50 rounded-lg border border-red-200">
                <p className="text-sm text-red-700">{detail}</p>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <Button onClick={() => setShowErrorDialog(false)}>
              OK, I'll Fix
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}