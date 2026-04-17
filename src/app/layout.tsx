import type { Metadata } from "next"
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
