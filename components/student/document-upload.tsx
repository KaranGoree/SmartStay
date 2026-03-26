"use client"

import { useCallback, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Upload, X, CheckCircle, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { extractTextFromImage, type OCRProgress } from "@/lib/ocr/tesseract"
import type { OCRData } from "@/lib/types"

interface DocumentUploadProps {
  type: "marksheet" | "aadhaarCard" | "categoryProof"
  label: string
  description: string
  required?: boolean
  value?: string
  onChange: (dataUrl: string) => void
  onOCRComplete?: (data: Partial<OCRData>, rawText: string) => void
}

export function DocumentUpload({
  type,
  label,
  description,
  required = false,
  value,
  onChange,
  onOCRComplete,
}: DocumentUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [ocrProgress, setOcrProgress] = useState<OCRProgress | null>(null)
  const [ocrComplete, setOcrComplete] = useState(false)
  const [error, setError] = useState<string>("")

  const processFile = async (file: File) => {
    setError("")
    setOcrComplete(false)

    // Preview image
    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string
      onChange(dataUrl)
    }
    reader.readAsDataURL(file)

    if (onOCRComplete) {
      setIsProcessing(true)

      try {
        // Step 1: OCR extraction
        const text = await extractTextFromImage(file, (progress) => {
          setOcrProgress(progress)
        })

        console.log(`🔍 RAW OCR TEXT for ${type}:`, text)

        if (!text || text.trim().length === 0) {
          throw new Error("No text extracted from image. Please ensure the image is clear and readable.")
        }

        // Step 2: Extract basic info using regex patterns (as fallback)
        const extractedData: Partial<OCRData> = {}
        
        // Try to extract name (look for common patterns)
        const nameMatch = text.match(/(?:Name|NAME)[\s:]*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/)
        if (nameMatch && nameMatch[1]) {
          extractedData.extractedName = nameMatch[1].trim()
        }
        
        // Try to extract Aadhaar number
        const aadhaarMatch = text.match(/\d{4}\s?\d{4}\s?\d{4}/)
        if (aadhaarMatch) {
          extractedData.extractedAadhaar = aadhaarMatch[0].replace(/\s/g, '')
        }
        
        // Try to extract marks (look for numbers with "marks" or "/")
        const marksMatch = text.match(/(\d{2,3})\s*\/?\s*200/)
        if (marksMatch && marksMatch[1]) {
          extractedData.extractedMarks = parseInt(marksMatch[1])
        }

        // Send raw text and extracted data to parent (for processing only, not display)
        onOCRComplete(extractedData, text)

        setOcrComplete(true)
        setOcrProgress(null)

      } catch (error: any) {
        console.error(`❌ OCR ERROR for ${type}:`, error)
        setError(error.message || "OCR processing failed")
        setOcrProgress(null)
      } finally {
        setIsProcessing(false)
      }
    }
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith("image/")) {
      processFile(file)
    }
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  const handleRemove = () => {
    onChange("")
    setOcrComplete(false)
    setError("")
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          {label}
          {required && <span className="text-destructive">*</span>}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>

      <CardContent>
        {value ? (
          <div className="relative space-y-3">
            {/* Image Preview */}
            <div className="relative aspect-[4/3] rounded-lg overflow-hidden bg-muted">
              <img src={value} alt={label} className="w-full h-full object-contain" />

              {isProcessing && (
                <div className="absolute inset-0 bg-background/80 flex flex-col items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                  <p className="text-sm font-medium">
                    {ocrProgress?.status || "Processing OCR..."}
                  </p>
                  {ocrProgress && ocrProgress.progress > 0 && (
                    <Progress value={ocrProgress.progress * 100} className="w-32 mt-2" />
                  )}
                </div>
              )}

              {ocrComplete && !isProcessing && (
                <div className="absolute top-2 right-2 bg-emerald-500 text-white px-2 py-1 rounded text-xs flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" />
                  OCR Complete
                </div>
              )}
            </div>

            <Button
              variant="destructive"
              size="icon"
              className="absolute top-2 left-2 h-8 w-8"
              onClick={handleRemove}
            >
              <X className="h-4 w-4" />
            </Button>

            {/* Error */}
            {error && (
              <div className="text-red-500 text-sm bg-red-50 p-2 rounded">
                ❌ {error}
              </div>
            )}
          </div>
        ) : (
          <div
            className={cn(
              "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
              isDragging
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-primary/50"
            )}
            onDragOver={(e) => {
              e.preventDefault()
              setIsDragging(true)
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => document.getElementById(`file-${type}`)?.click()}
          >
            <input
              type="file"
              id={`file-${type}`}
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
            />
            <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm font-medium">
              Drop your {label.toLowerCase()} here or click to upload
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              PNG, JPG up to 5MB
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}