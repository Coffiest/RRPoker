'use client'

import Loader from '@/components/Loader'

/**
 * 読み込み画面。
 * 起動シーケンスを流すコンソールに見立て、方眼＋走査線＋シェルプロンプトで構成する。
 * 配色は既存テーマ（白基調・グレー階層・#F2A900）のみ。
 */
export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="tech-grid tech-scanline tech-corners w-full max-w-[300px] rounded-[22px] border border-gray-100 bg-white/70 px-6 py-8 shadow-sm">
        {/* 端末のタイトルバー */}
        <div className="flex items-center justify-between">
          <span className="tech-label text-label3 tech-label-bracket">RRPOKER</span>
          <span className="tech-status-dot" />
        </div>

        <hr className="tech-rule my-4" />

        {/* 起動ログ */}
        <div className="space-y-2 text-[11px] leading-relaxed text-label2">
          <p className="term-comment">initializing session</p>
          <p className="term-prompt text-label">
            <span className="tech-type">boot --app=rrpoker</span>
          </p>
          <p className="term-prompt-arrow text-label tech-caret">loading</p>
        </div>

        <div className="mt-6 flex justify-center">
          <Loader />
        </div>

        <div className="mt-4 flex items-center justify-between">
          <span className="tech-label text-label3">STATUS</span>
          <span className="tech-label text-[#D4910A]">RUNNING</span>
        </div>
      </div>
    </div>
  )
}
