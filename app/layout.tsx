import type { Metadata, Viewport } from 'next'

import { JetBrains_Mono, Space_Grotesk } from "next/font/google"
import AuthGuard from '@/components/AuthGuard'
import CapacitorBoot from '@/components/CapacitorBoot'
import TechBackdrop from '@/components/TechBackdrop'
import Toaster from '@/components/Toaster'
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

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#F2A900',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // フォント変数は必ず <html> に置く。globals.css の :root で
    // --stack-mono / --stack-display がこれらを参照しており、<body> に付けると
    // :root 時点で未定義となり変数全体が無効化されて既定フォントに落ちる。
    <html lang="ja" suppressHydrationWarning className={`${mono.variable} ${grotesk.variable}`}>
      <head>
        {/* 拡大の禁止(オーナー指定)。viewport の指定は下の export const viewport で出す
            (<head> に手で書くと Next.js の既定の viewport と 2 つ並び、どちらが効くか定まらない)。
            iOS Safari は user-scalable=no を無視してピンチで拡大できてしまうため、
            ピンチ(gesture* と 2 本指の touchmove)を止める。ダブルタップの拡大は globals.css の touch-action で止める
            (touchend を止めると、ボタンを素早く 2 回押したときの 2 回目まで消えてしまうため使わない)。
            maximum-scale=1 は、小さい文字の入力欄に触れたときの自動拡大も止める
            (ブラインド作成で拡大されたまま戻せなくなっていたのはこれ)。 */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var p=function(e){e.preventDefault()};['gesturestart','gesturechange','gestureend'].forEach(function(t){document.addEventListener(t,p,{passive:false})});document.addEventListener('touchmove',function(e){if(e.touches&&e.touches.length>1)e.preventDefault()},{passive:false})}catch(e){}})()` }} />
        {/* 画面は明るい表示だけで作っている。端末のダークモードで入力欄などが暗くならないようにする */}
        <meta name="color-scheme" content="light" />
        {/* PC の判定。広い画面(1024px 以上)で、マウスのように細かく指せて、ホバーできる端末を PC とみなす。
            画面の幅だけで決めると大きなタブレットまで PC になるため、入力の種類も見る(Media Queries Level 4 の hover / pointer)。
            描画前に <html class="pc"> を付けて、表示が一瞬スマホ版になるのを防ぐ。ウィンドウの幅を変えたら付け外しする。 */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var m=window.matchMedia('(min-width: 1024px) and (hover: hover) and (pointer: fine)');var f=function(){document.documentElement.classList.toggle('pc',m.matches)};f();m.addEventListener?m.addEventListener('change',f):m.addListener(f)}catch(e){}})()` }} />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="RRPoker" />
      </head>
      <body className="min-h-[100dvh] min-h-[100svh] w-full overflow-x-clip flex flex-col" style={{ background: "transparent" }}>
        {/* 全画面で同じ下地(店舗ホームと同じ: 方眼と金のにじみ)。各画面は背景を塗らない */}
        <TechBackdrop />
        <CapacitorBoot />
        <Toaster />
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
