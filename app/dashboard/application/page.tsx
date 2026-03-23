import { ApplicationForm } from "@/components/student/application-form"

export default function ApplicationPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Hostel Application</h1>
        <p className="text-muted-foreground">
          Fill in your details and upload required documents
        </p>
      </div>
      <ApplicationForm />
    </div>
  )
}
