import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const cookie = request.headers.get("cookie") || ""
  const isAdmin = cookie.includes("admin_session=authenticated")
  return NextResponse.json({ isAdmin })
}
