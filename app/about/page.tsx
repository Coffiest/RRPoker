'use client'

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-white px-5">
      <div className="mx-auto max-w-sm">
        <div className="pt-[72px] text-center">
          <h1 className="font-display term-prompt-arrow text-[24px] font-semibold text-gray-900">このアプリについて</h1>
        </div>
        <div className="mt-6 rounded-[24px] border border-gray-200 p-4">
          <p className="text-[14px] text-gray-900">製作者: なおゆき</p>
          <p className="mt-2 text-[13px] text-gray-500">バージョン: 0.1.0</p>
        </div>
        <div className="mt-4 rounded-[24px] border border-gray-200 p-4">
          <p className="text-[13px] font-semibold text-gray-900 mb-1.5">RRPokerについて</p>
          <p className="text-[12.5px] leading-[1.7] text-gray-600">
            RRPokerは、ポーカー店舗の運営管理およびプレイヤーの成績記録を目的としたツールです。アプリ内の「チップ」は店舗内でのゲーム進行を記録するためのポイントであり、現金・預金その他の金銭的価値を持ちません。換金・払い戻しはできず、現金・仮想通貨等をベットする賭博機能は一切提供していません。
          </p>
        </div>
      </div>
    </main>
  )
}
