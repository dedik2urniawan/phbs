import type { Metadata, Viewport } from "next"
import { Inter, Plus_Jakarta_Sans } from "next/font/google"
import "./globals.css"
import PWAInstallPrompt from "@/components/PWAInstallPrompt"

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })
const plusJakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-plus-jakarta" })

export const viewport: Viewport = {
  themeColor: '#059669',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export const metadata: Metadata = {
  title: "SIM-PHBS | Sistem Informasi PHBS Kabupaten Malang",
  description: "Platform digital survei Perilaku Hidup Bersih dan Sehat (PHBS) Kabupaten Malang. Mendukung 40 Puskesmas, 390 desa, dengan teknologi offline-first PWA.",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/promkes.png?v=1" },
      { url: "/promkes.png?v=1", sizes: "32x32", type: "image/png" },
    ],
    apple: "/promkes.png?v=1",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SIM-PHBS",
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${inter.variable} ${plusJakarta.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-gray-50 font-sans antialiased">
        {children}
        <PWAInstallPrompt />
      </body>
    </html>
  )
}
