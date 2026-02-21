import type { Metadata } from 'next'
import AuthGuard from '@/app/components/AuthGuard'
import "./globals.css"

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
      <body>
        <AuthGuard>{children}</AuthGuard>
      </body>
    </html>
  )
}
