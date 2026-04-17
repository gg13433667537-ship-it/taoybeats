import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

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
      <body className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-background text-foreground antialiased`}>
        {children}
      </body>
    </html>
  )
}
