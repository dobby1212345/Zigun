import { NextResponse } from "next/server"

const ADMIN_PASSWORD = "1234"

export async function POST(request: Request) {
  const body = await request.json()
  const { password } = body

  if (password === ADMIN_PASSWORD) {
    const response = NextResponse.json({ success: true })
    response.cookies.set("admin_session", "authenticated", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24, // 24 hours
      path: "/",
    })

    return response
  }

  return NextResponse.json({ error: "Invalid password" }, { status: 401 })
}
