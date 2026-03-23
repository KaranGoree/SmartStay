import { LoginForm } from "@/components/auth/login-form"
import { Navbar } from "@/components/shared/navbar"

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 flex items-center justify-center p-4">
        <LoginForm />
      </main>
    </div>
  )
}
