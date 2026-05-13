import { cookies } from "next/headers"
import Link from "next/link"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { FreeBoardManagement } from "@/components/admin/free-board-management"
import { ArrowLeft, ArrowLeftCircle } from "lucide-react"

export default async function AdminBoardPage() {
  const cookieStore = await cookies()
  const session = cookieStore.get("admin_session")

  if (!session || session.value !== "authenticated") {
    redirect("/admin")
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <h1 className="text-xl font-semibold">관리자 게시판 관리</h1>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/">
                <ArrowLeftCircle className="mr-2 h-4 w-4" />
                관리자 모드 나가기
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin/dashboard">
                <ArrowLeft className="mr-2 h-4 w-4" />
                대시보드로
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <FreeBoardManagement />
      </main>
    </div>
  )
}
