import { Navbar } from "@/components/shared/navbar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import {
  FileText,
  ScanSearch,
  CheckCircle,
  BedDouble,
  Clock,
  Shield,
  ArrowRight,
  Building2,
  Phone,
  Mail,
  MapPin,
} from "lucide-react"

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      {/* Hero Section */}
      <section className="relative bg-primary/5 py-20 lg:py-32">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm text-primary">
              <Building2 className="h-4 w-4" />
              GCOEN Hostel Admission 2026
            </div>
            <h1 className="mb-6 text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl text-balance">
              Streamlined Hostel Admission for Engineering Excellence
            </h1>
            <p className="mb-8 text-lg text-muted-foreground text-pretty">
              SmartStay simplifies the hostel admission process at Government College of Engineering, Nagpur. 
              Apply online, track your status, and secure your accommodation seamlessly.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" asChild>
                <Link href="/register">
                  Apply Now
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/admin">Admin Login</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20">
        <div className="container mx-auto px-4">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-bold">Why Choose SmartStay?</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Our intelligent admission system ensures a fair, transparent, and efficient process for all students.
            </p>
          </div>
          
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <FileText className="h-10 w-10 text-primary mb-2" />
                <CardTitle>Digital Applications</CardTitle>
                <CardDescription>
                  Submit your hostel application online with easy document uploads and form filling.
                </CardDescription>
              </CardHeader>
            </Card>
            
            <Card>
              <CardHeader>
                <ScanSearch className="h-10 w-10 text-primary mb-2" />
                <CardTitle>Smart OCR Verification</CardTitle>
                <CardDescription>
                  Automatic document scanning extracts and verifies your information for accuracy.
                </CardDescription>
              </CardHeader>
            </Card>
            
            <Card>
              <CardHeader>
                <CheckCircle className="h-10 w-10 text-primary mb-2" />
                <CardTitle>Merit-Based Allocation</CardTitle>
                <CardDescription>
                  Transparent seat allocation based on academic merit and category reservations.
                </CardDescription>
              </CardHeader>
            </Card>
            
            <Card>
              <CardHeader>
                <BedDouble className="h-10 w-10 text-primary mb-2" />
                <CardTitle>Room Assignment</CardTitle>
                <CardDescription>
                  Automatic room allocation with floor and room preferences for confirmed students.
                </CardDescription>
              </CardHeader>
            </Card>
            
            <Card>
              <CardHeader>
                <Clock className="h-10 w-10 text-primary mb-2" />
                <CardTitle>Real-time Tracking</CardTitle>
                <CardDescription>
                  Monitor your application status and receive updates at every stage of the process.
                </CardDescription>
              </CardHeader>
            </Card>
            
            <Card>
              <CardHeader>
                <Shield className="h-10 w-10 text-primary mb-2" />
                <CardTitle>Secure & Reliable</CardTitle>
                <CardDescription>
                  Your data is protected with enterprise-grade security and encrypted storage.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* Process Section */}
      <section id="process" className="py-20 bg-muted/50">
        <div className="container mx-auto px-4">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-bold">Application Process</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Follow these simple steps to apply for hostel accommodation.
            </p>
          </div>
          
          <div className="grid gap-8 md:grid-cols-4">
            {[
              { step: 1, title: "Register", desc: "Create your account with college email" },
              { step: 2, title: "Apply", desc: "Fill the application form and upload documents" },
              { step: 3, title: "Verify", desc: "Documents are scanned and verified automatically" },
              { step: 4, title: "Confirm", desc: "Accept your seat allocation and get room details" },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                  {item.step}
                </div>
                <h3 className="mb-2 font-semibold">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Statistics */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="grid gap-8 md:grid-cols-4 text-center">
            {[
              { value: "500+", label: "Hostel Seats" },
              { value: "5", label: "Branches" },
              { value: "6", label: "Floors" },
              { value: "96", label: "Rooms" },
            ].map((stat) => (
              <div key={stat.label}>
                <p className="text-4xl font-bold text-primary">{stat.value}</p>
                <p className="text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-20 bg-muted/50">
        <div className="container mx-auto px-4">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-bold">Contact Us</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Have questions? Reach out to the hostel administration.
            </p>
          </div>
          
          <div className="grid gap-6 md:grid-cols-3 max-w-3xl mx-auto">
            <Card>
              <CardContent className="flex flex-col items-center pt-6">
                <Phone className="h-8 w-8 text-primary mb-2" />
                <p className="font-medium">Phone</p>
                <p className="text-sm text-muted-foreground">+91 712 280 1234</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="flex flex-col items-center pt-6">
                <Mail className="h-8 w-8 text-primary mb-2" />
                <p className="font-medium">Email</p>
                <p className="text-sm text-muted-foreground">hostel@gcoen.ac.in</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="flex flex-col items-center pt-6">
                <MapPin className="h-8 w-8 text-primary mb-2" />
                <p className="font-medium">Address</p>
                <p className="text-sm text-muted-foreground text-center">GCOEN, Nagpur, MH</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              <span className="font-semibold">SmartStay</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Government College of Engineering, Nagpur. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
