import type { Metadata } from 'next'

import { Playfair_Display, Plus_Jakarta_Sans } from "next/font/google"
import AuthGuard from '@/components/AuthGuard'
import "./globals.css"
const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["600", "700"],
  display: "swap",
})

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  display: "swap",
})

export const metadata: Metadata = {
  title: 'RRPoker',
  description: 'ポーカーレーティングアプリ',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'RRPoker',
  },
  icons: {
    apple: [
      {
        url: '/apple-touch-icon.png',
        sizes: '180x180',
      },
    ],
    icon: [
      {
        url: '/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        url: '/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  },
  manifest: '/manifest.json',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <head>
        {/* Viewport and other meta tags */}
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#F2A900" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="RRPoker" />
      </head>
      <body className={`${playfair.variable} ${jakarta.variable} min-h-[100dvh] min-h-[100svh] w-full overflow-x-clip bg-white flex flex-col`}>
        <AuthGuard>
          <div className="flex flex-col min-h-[100dvh] min-h-[100svh] w-full flex-1">
            <div className="flex-1">{children}</div>
          </div>
        </AuthGuard>
      </body>
    </html>
  )
}
