import { NextRequest, NextResponse } from "next/server"
import type { User } from "@/lib/types"
import { verifySessionToken, createSessionToken } from "@/lib/auth-utils"

declare global {
  var users: Map<string, User> | undefined
}

if (!global.users) global.users = new Map()

const users = global.users!

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check admin session
    const sessionToken = request.cookies.get("session-token")?.value
    if (!sessionToken) {
      return NextResponse.json({ error: "未登录" }, { status: 401 })
    }

    const session = verifySessionToken(sessionToken)
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "需要管理员权限" }, { status: 403 })
    }

    const { id } = await params
    const { role } = await request.json()

    if (!["USER", "ADMIN"].includes(role)) {
      return NextResponse.json({ error: "无效的角色" }, { status: 400 })
    }

    const user = users.get(id)
    if (!user) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 })
    }

    user.role = role
    users.set(id, user)

    // Update session if changing own role
    if (session.id === id || session.email === id) {
      const newToken = createSessionToken({
        ...user,
        password: undefined,
      } as User)
      const response = NextResponse.json({ success: true, user })
      response.cookies.set(
        "session-token",
        newToken,
        {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: 60 * 60 * 24 * 7,
        }
      )
      return response
    }

    return NextResponse.json({ success: true, user })
  } catch (error) {
    console.error("Update role error:", error)
    return NextResponse.json({ error: "更新失败" }, { status: 500 })
  }
}
