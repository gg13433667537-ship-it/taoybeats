import type { Metadata } from "next"
import { cookies } from "next/headers"
import "./globals.css"
import { Providers } from "@/components/Providers"

export const metadata: Metadata = {
  title: "TaoyBeats - AI Music Generation",
  description: "Create music with AI, share your sound. AI-powered music generation platform.",
  keywords: ["AI music", "music generation", "AI songwriter", "beat maker"],
  authors: [{ name: "TaoyBeats" }],
  openGraph: {
    title: "TaoyBeats - AI Music Generation",
    description: "Create music with AI, share your sound",
    type: "website",
  },
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // Read language from cookie on server side
  const cookieStore = await cookies()
  const langCookie = cookieStore.get("taoybeats-lang")
  const initialLang = (langCookie?.value as "en" | "zh") || "en"

  return (
    <html lang={initialLang} className="dark" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased font-sans">
        <Providers initialLang={initialLang}>{children}</Providers>
      </body>
    </html>
  )
}
