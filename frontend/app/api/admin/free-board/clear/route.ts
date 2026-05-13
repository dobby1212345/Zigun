import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { getBackendBaseUrl } from "@/lib/backend-url"

const BACKEND_BASE_URL = getBackendBaseUrl()

export async function POST() {
  const cookieStore = await cookies()
  const session = cookieStore.get("admin_session")

  if (!session || session.value !== "authenticated") {
    return NextResponse.json({ message: "관리자 권한이 필요합니다." }, { status: 403 })
  }

  const response = await fetch(`${BACKEND_BASE_URL}/api/free-board/messages/clear`, {
    method: "POST",
    headers: {
      "x-admin-session": "authenticated",
    },
    cache: "no-store",
  })

  const raw = await response.text()

  if (!response.ok) {
    return NextResponse.json(
      {
        message: raw || `요청에 실패했습니다. (${response.status})`,
      },
      { status: response.status },
    )
  }

  try {
    return NextResponse.json(JSON.parse(raw), { status: response.status })
  } catch {
    return NextResponse.json({ success: true }, { status: response.status })
  }
}
