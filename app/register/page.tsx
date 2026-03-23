import { RegisterForm } from "@/components/auth/register-form"
import { Navbar } from "@/components/shared/navbar"

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 flex items-center justify-center p-4">
        <RegisterForm />
      </main>
    </div>
  )
}
