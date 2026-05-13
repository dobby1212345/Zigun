import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { getProfile, getStories } from "@/lib/backend-api"
import { AdminDashboard } from "@/components/admin-dashboard"

export default async function AdminDashboardPage() {
  const cookieStore = await cookies()
  const session = cookieStore.get("admin_session")

  if (!session || session.value !== "authenticated") {
    redirect("/admin")
  }

  const [profile, stories] = await Promise.all([
    getProfile(),
    getStories(),
  ])

  return <AdminDashboard initialProfile={profile} initialStories={stories} />
}
