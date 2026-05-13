import { getProfile } from "@/lib/backend-api"
import { MainLayout } from "@/components/main-layout"
import { ProfileContent } from "@/components/profile-content"

export default async function ProfilePage() {
  const profile = await getProfile()

  return (
    <MainLayout>
      <ProfileContent profile={profile} />
    </MainLayout>
  )
}
