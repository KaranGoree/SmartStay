import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
  Image,
} from "@react-pdf/renderer"
import type { Application } from "@/lib/types"

// Register fonts
Font.register({
  family: "Roboto",
  fonts: [
    { src: "https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxP.ttf", fontWeight: "normal" },
    { src: "https://fonts.gstatic.com/s/roboto/v30/KFOlCnqEu92Fr1MmWUlfBBc4.ttf", fontWeight: "bold" },
  ],
})

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: "Roboto",
    backgroundColor: "#ffffff",
  },
  header: {
    marginBottom: 20,
    textAlign: "center",
    borderBottom: "2px solid #3b82f6",
    paddingBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 5,
    color: "#1e3a8a",
  },
  subtitle: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 5,
  },
  collegeName: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 5,
    color: "#1e40af",
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
    backgroundColor: "#f3f4f6",
    padding: 8,
    borderRadius: 5,
    color: "#1f2937",
  },
  table: {
    width: "100%",
    marginTop: 10,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#e5e7eb",
    padding: 8,
    fontWeight: "bold",
    fontSize: 9,
    borderBottom: "2px solid #d1d5db",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    padding: 8,
    fontSize: 9,
  },
  tableCell: {
    flex: 1,
  },
  cellRank: { flex: 0.5 },
  cellName: { flex: 1.5 },
  cellBranch: { flex: 0.8 },
  cellYear: { flex: 0.5 },
  cellCategory: { flex: 0.8 },
  cellSeatType: { flex: 0.8 },
  cellScore: { flex: 0.8 },
  cellStatus: { flex: 0.8 },
  cellHostel: { flex: 0.8 },
  cellAllocated: { flex: 0.8 },
  badge: {
    padding: "2px 6px",
    borderRadius: 4,
    fontSize: 8,
    textAlign: "center",
    display: "inline-block",
  },
  badgeSelected: {
    backgroundColor: "#dbeafe",
    color: "#1e40af",
  },
  badgeWaitlisted: {
    backgroundColor: "#fef3c7",
    color: "#92400e",
  },
  badgeAllocated: {
    backgroundColor: "#d1fae5",
    color: "#065f46",
  },
  badgeNotAllocated: {
    backgroundColor: "#fee2e2",
    color: "#991b1b",
  },
  footer: {
    marginTop: 30,
    textAlign: "center",
    fontSize: 8,
    color: "#9ca3af",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingTop: 10,
  },
  stats: {
    marginBottom: 15,
    padding: 10,
    backgroundColor: "#f9fafb",
    borderRadius: 5,
    border: "1px solid #e5e7eb",
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  statText: {
    fontSize: 10,
  },
  statValue: {
    fontSize: 10,
    fontWeight: "bold",
  },
  pageNumber: {
    position: "absolute",
    bottom: 20,
    right: 30,
    fontSize: 8,
    color: "#9ca3af",
  },
})

interface PDFDocumentProps {
  title: string
  students: Application[]
  type: "selected" | "waitlisted"
  generatedAt: Date
}

const getStatusColor = (status: string) => {
  if (status === "selected") return styles.badgeSelected
  if (status === "waitlisted") return styles.badgeWaitlisted
  if (status === "confirmed") return styles.badgeAllocated
  return {}
}

const getSeatType = (app: Application): string => {
  if (app.admissionType === "CET") return "CET (1st Year)"
  if (app.admissionType === "SGPA") return "SGPA (2nd-4th Year)"
  return "Not Specified"
}

const getAllocationStatus = (app: Application): string => {
  if (app.status === "confirmed") return "Allocated"
  if (app.status === "selected") return "Selected (Pending Confirmation)"
  if (app.status === "waitlisted") return "Waitlisted"
  if (app.roomNumber) return "Room Allocated"
  return "Not Allocated"
}

const getAllocationBadgeStyle = (status: string) => {
  if (status === "Allocated" || status === "Room Allocated") return styles.badgeAllocated
  if (status === "Selected (Pending Confirmation)") return styles.badgeSelected
  if (status === "Waitlisted") return styles.badgeWaitlisted
  return styles.badgeNotAllocated
}

// Main PDF Document
const StudentListPDF = ({ title, students, type, generatedAt }: PDFDocumentProps) => {
  // Group by year
  const groupedByYear = students.reduce((acc, student) => {
    const year = student.year
    if (!acc[year]) acc[year] = []
    acc[year].push(student)
    return acc
  }, {} as Record<number, Application[]>)

  // Sort years
  const sortedYears = Object.keys(groupedByYear).sort((a, b) => parseInt(a) - parseInt(b))

  // Calculate statistics
  const totalStudents = students.length
  const branches = [...new Set(students.map(s => s.branch))]
  const categories = [...new Set(students.map(s => s.category))]
  const allocatedCount = students.filter(s => s.status === "confirmed" || s.roomNumber).length
  const pendingCount = students.filter(s => s.status === "selected").length
  const waitlistedCount = students.filter(s => s.status === "waitlisted").length

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.collegeName}>Government College of Engineering, Nagpur</Text>
          <Text style={styles.title}>Hostel Admission {title}</Text>
          <Text style={styles.subtitle}>Academic Year 2024-25</Text>
          <Text style={styles.subtitle}>Generated on: {generatedAt.toLocaleDateString()} at {generatedAt.toLocaleTimeString()}</Text>
        </View>

        {/* Summary Stats */}
        <View style={styles.stats}>
          <View style={styles.statRow}>
            <Text style={styles.statText}>Total {title}:</Text>
            <Text style={styles.statValue}>{totalStudents}</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statText}>Allocated Students:</Text>
            <Text style={styles.statValue}>{allocatedCount}</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statText}>Pending Confirmation:</Text>
            <Text style={styles.statValue}>{pendingCount}</Text>
          </View>
          {type === "waitlisted" && (
            <View style={styles.statRow}>
              <Text style={styles.statText}>Waitlisted Students:</Text>
              <Text style={styles.statValue}>{waitlistedCount}</Text>
            </View>
          )}
          <View style={styles.statRow}>
            <Text style={styles.statText}>Total Branches:</Text>
            <Text style={styles.statValue}>{branches.length}</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statText}>Total Categories:</Text>
            <Text style={styles.statValue}>{categories.length}</Text>
          </View>
        </View>

        {/* Year-wise Sections */}
        {sortedYears.map((year) => {
          const yearStudents = groupedByYear[parseInt(year)]
          const sortedStudents = [...yearStudents].sort((a, b) => (a.meritRank || 999) - (b.meritRank || 999))

          return (
            <View key={year} style={styles.section} wrap={false}>
              <Text style={styles.sectionTitle}>Year {year} - {yearStudents.length} Students</Text>
              
              {/* Table Header */}
              <View style={styles.tableHeader}>
                <Text style={[styles.tableCell, styles.cellRank]}>Rank</Text>
                <Text style={[styles.tableCell, styles.cellName]}>Student Name</Text>
                <Text style={[styles.tableCell, styles.cellBranch]}>Branch</Text>
                <Text style={[styles.tableCell, styles.cellYear]}>Year</Text>
                <Text style={[styles.tableCell, styles.cellCategory]}>Caste</Text>
                <Text style={[styles.tableCell, styles.cellSeatType]}>Seat Type</Text>
                <Text style={[styles.tableCell, styles.cellScore]}>Score</Text>
                <Text style={[styles.tableCell, styles.cellHostel]}>Hostel</Text>
                <Text style={[styles.tableCell, styles.cellAllocated]}>Allocation Status</Text>
              </View>

              {/* Table Rows */}
              {sortedStudents.map((student) => {
                const seatType = getSeatType(student)
                const allocationStatus = getAllocationStatus(student)
                const allocationStyle = getAllocationBadgeStyle(allocationStatus)
                const score = student.admissionType === "CET" ? student.cetMarks : student.sgpa
                const scoreLabel = student.admissionType === "CET" ? "CET" : "SGPA"

                return (
                  <View key={student.id} style={styles.tableRow}>
                    <Text style={[styles.tableCell, styles.cellRank]}>#{student.meritRank || "-"}</Text>
                    <Text style={[styles.tableCell, styles.cellName]}>{student.fullName}</Text>
                    <Text style={[styles.tableCell, styles.cellBranch]}>{student.branch}</Text>
                    <Text style={[styles.tableCell, styles.cellYear]}>{student.year}</Text>
                    <Text style={[styles.tableCell, styles.cellCategory]}>{student.category}</Text>
                    <Text style={[styles.tableCell, styles.cellSeatType]}>{seatType}</Text>
                    <Text style={[styles.tableCell, styles.cellScore]}>{score} ({scoreLabel})</Text>
                    <Text style={[styles.tableCell, styles.cellHostel]}>
                      {student.hostel ? (student.hostel === "boys" ? "Boys Hostel" : "Girls Hostel") : "Not Assigned"}
                    </Text>
                    <Text style={[styles.tableCell, styles.cellAllocated]}>
                      <Text style={[styles.badge, allocationStyle]}>
                        {allocationStatus}
                      </Text>
                    </Text>
                  </View>
                )
              })}
            </View>
          )
        })}

        {/* Footer */}
        <View style={styles.footer}>
          <Text>This is a computer-generated document. No signature required.</Text>
          <Text>For any queries, contact Hostel Administration Office</Text>
          <Text>Email: hostel@gcoen.ac.in | Phone: 0712-1234567</Text>
        </View>

        {/* Page Number */}
        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
      </Page>
    </Document>
  )
}

// Helper function to download PDF
export const downloadPDF = async (
  students: Application[],
  type: "selected" | "waitlisted"
) => {
  const { pdf } = await import("@react-pdf/renderer")
  
  const title = type === "selected" 
    ? "Selected Students List" 
    : "Waitlisted Students List"
  
  const blob = await pdf(
    <StudentListPDF
      title={title}
      students={students}
      type={type}
      generatedAt={new Date()}
    />
  ).toBlob()
  
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `hostel_${type}_students_${new Date().toISOString().split("T")[0]}.pdf`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// Function to generate and download all PDFs
export const downloadAllPDFs = async (
  selectedStudents: Application[],
  waitlistedStudents: Application[]
) => {
  await downloadPDF(selectedStudents, "selected")
  // Small delay to prevent browser blocking multiple downloads
  setTimeout(async () => {
    await downloadPDF(waitlistedStudents, "waitlisted")
  }, 1000)
}

// Function to get summary statistics
export const getPDFSummary = (students: Application[], type: "selected" | "waitlisted") => {
  const byBranch = students.reduce((acc, s) => {
    acc[s.branch] = (acc[s.branch] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const byYear = students.reduce((acc, s) => {
    acc[s.year] = (acc[s.year] || 0) + 1
    return acc
  }, {} as Record<number, number>)

  const byCategory = students.reduce((acc, s) => {
    acc[s.category] = (acc[s.category] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const bySeatType = students.reduce((acc, s) => {
    const seatType = s.admissionType === "CET" ? "CET" : "SGPA"
    acc[seatType] = (acc[seatType] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const allocated = students.filter(s => s.status === "confirmed" || s.roomNumber).length
  const pending = students.filter(s => s.status === "selected").length
  const waitlisted = students.filter(s => s.status === "waitlisted").length

  return {
    total: students.length,
    byBranch,
    byYear,
    byCategory,
    bySeatType,
    allocated,
    pending,
    waitlisted,
  }
}