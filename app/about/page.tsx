'use client'

export default function AboutPage() {
  return (
    <main className="min-h-screen px-6">
      <div className="mx-auto max-w-sm">
        <div className="pt-[72px] text-center">
          <h1 className="font-display term-prompt-arrow text-[24px] font-semibold text-label">このアプリについて</h1>
        </div>
        <div className="mt-6 rounded-[24px] border border-gray-200 p-4">
          <p className="text-[14px] text-label">製作者: なおゆき</p>
          <p className="mt-2 text-[13px] text-label2">バージョン: 0.1.0</p>
        </div>
        <div className="mt-4 rounded-[24px] border border-gray-200 p-4">
          <p className="text-[13px] font-semibold text-label mb-2">RRPokerについて</p>
          <p className="text-[12.5px] leading-[1.7] text-label2">
            RRPokerは、ポーカー店舗の運営管理およびプレイヤーの成績記録を目的としたツールです。アプリ内の「チップ」は店舗内でのゲーム進行を記録するためのポイントであり、現金・預金その他の金銭的価値を持ちません。換金・払い戻しはできず、現金・仮想通貨等をベットする賭博機能は一切提供していません。
          </p>
        </div>
      </div>
    </main>
  )
}
