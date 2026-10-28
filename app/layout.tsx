import type { Metadata } from 'next'

import AuthGuard from '@/components/AuthGuard'
import CapacitorBoot from '@/components/CapacitorBoot'
import { LanguageProvider } from '@/lib/i18n'
import "./globals.css"

/**
 * 書体は端末のシステムフォント(globals.css の --stack-system)。
 * Apple HIG に合わせ、ダウンロードする書体は使わない。
 */

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
        url: '/logo.png',
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
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
        <meta name="theme-color" content="#F2A900" />
        {/* 画面は明るい表示だけで作っている。端末のダークモードで入力欄などが暗くならないようにする */}
        <meta name="color-scheme" content="light" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="RRPoker" />
      </head>
      <body className="min-h-[100dvh] min-h-[100svh] w-full overflow-x-clip bg-white flex flex-col">
        <CapacitorBoot />
        <LanguageProvider>
          <AuthGuard>
            <div className="flex flex-col min-h-[100dvh] min-h-[100svh] w-full flex-1">
              <div className="flex-1">{children}</div>
            </div>
          </AuthGuard>
        </LanguageProvider>
      </body>
    </html>
  )
}
