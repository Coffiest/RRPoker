import type { Metadata } from 'next'

import { JetBrains_Mono, Space_Grotesk } from "next/font/google"
import AuthGuard from '@/components/AuthGuard'
import CapacitorBoot from '@/components/CapacitorBoot'
import { LanguageProvider } from '@/lib/i18n'
import "./globals.css"

/**
 * タイポグラフィ
 *
 * JetBrains Mono … アプリ全体の基準書体。エディタ／コンソール由来の等幅で、
 *                  数値の桁が揃い、レート・スタック・時刻の可読性が上がる。
 * Space Grotesk  … 見出し・ロゴ用。等幅と骨格を共有しつつ字幅に抑揚があり、
 *                  同系統のまま見出しとしてのコントラストを作る。
 *
 * 日本語は端末標準（Hiragino / Noto Sans JP）にフォールバックさせる。
 * 和文の等幅は可読性を大きく損なううえ、Capacitor 同梱時のサイズも肥大するため。
 * next/font がビルド時にセルフホストするので外部CDNへの依存は発生しない。
 */
const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
  variable: "--font-jetbrains",
})

const grotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-space",
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
    // フォント変数は必ず <html> に置く。globals.css の :root で
    // --stack-mono / --stack-display がこれらを参照しており、<body> に付けると
    // :root 時点で未定義となり変数全体が無効化されて既定フォントに落ちる。
    <html lang="ja" className={`${mono.variable} ${grotesk.variable}`}>
      <head>
        {/* Viewport and other meta tags */}
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
        <meta name="theme-color" content="#F2A900" />
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
