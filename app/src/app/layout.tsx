import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import PWAInstallPrompt from "@/components/PWAInstallPrompt"

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })

export const viewport: Viewport = {
  themeColor: '#059669',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export const metadata: Metadata = {
  title: "SIM-PHBS | Kabupaten Malang",
  description: "Sistem Informasi Manajemen PHBS Kabupaten Malang",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SIM-PHBS",
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${inter.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-gray-50 font-sans antialiased">
        {children}
        <PWAInstallPrompt />
      </body>
    </html>
  )
}
