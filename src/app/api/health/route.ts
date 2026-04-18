import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET() {
  const start = Date.now()

  // Check database connection
  let dbStatus = "ok"
  try {
    await prisma.$queryRaw`SELECT 1`
  } catch {
    dbStatus = "error"
  }

  const duration = Date.now() - start

  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "0.1.0",
    checks: {
      database: dbStatus,
      responseTime: `${duration}ms`,
    },
  })
}
