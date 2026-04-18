import { NextRequest, NextResponse } from "next/server"

if (!global.users) global.users = new Map()
if (!global.songs) global.songs = new Map()
if (!global.adminLogs) global.adminLogs = new Map()

const users = global.users!

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { error: "请输入有效的邮箱地址" },
        { status: 400 }
      )
    }

    // Check if user exists
    const user = users.get(email)

    if (!user) {
      return NextResponse.json({
        exists: false,
        hasPassword: false,
        message: "该邮箱未注册",
      })
    }

    return NextResponse.json({
      exists: true,
      hasPassword: !!user.password,
      message: user.password ? "请输入密码登录" : "请输入验证码登录",
    })
  } catch (error) {
    console.error("Check email error:", error)
    return NextResponse.json(
      { error: "检查邮箱失败" },
      { status: 500 }
    )
  }
}
