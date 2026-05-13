import { MainLayout } from "@/components/main-layout"
import { FreeBoardRoom } from "@/components/free-board-room"
import { getFreeBoardMessages } from "@/lib/backend-api"
import { cookies } from "next/headers"

export default async function FreeBoardPage() {
  const cookieStore = await cookies()
  const isAdmin = cookieStore.get("admin_session")?.value === "authenticated"
  const initialMessages = await getFreeBoardMessages()

  return (
    <MainLayout>
      <div className="p-8">
        <div className="mx-auto max-w-5xl">
          <FreeBoardRoom initialMessages={initialMessages} isAdmin={isAdmin} />
        </div>
      </div>
    </MainLayout>
  )
}
