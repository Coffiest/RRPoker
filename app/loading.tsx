'use client'

/**
 * 読み込み画面。
 * 起動シーケンスを流すコンソールに見立て、方眼＋走査線＋シェルプロンプトで構成する。
 * 配色は既存テーマ（白基調・グレー階層・#F2A900）のみ。
 */
export default function Loading() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-6">
      <div className="tech-grid tech-scanline tech-corners w-full max-w-[300px] rounded-[22px] border border-gray-100 bg-white/70 px-6 py-8 shadow-sm">
        {/* 端末のタイトルバー */}
        <div className="flex items-center justify-between">
          <span className="tech-label text-label3 tech-label-bracket">RRPOKER</span>
          <span className="tech-status-dot" />
        </div>

        <hr className="tech-rule my-4" />

        {/* 起動ログ */}
        <div className="space-y-2 text-[11px] leading-relaxed text-gray-500">
          <p className="term-comment">initializing session</p>
          <p className="term-prompt text-gray-700">
            <span className="tech-type">boot --app=rrpoker</span>
          </p>
          <p className="term-prompt-arrow text-gray-900 tech-caret">loading</p>
        </div>

        <div className="tech-bar-track mt-6">
          <span className="tech-bar-fill" />
        </div>

        <div className="mt-4 flex items-center justify-between">
          <span className="tech-label text-label3">状態</span>
          <span className="tech-label text-[#D4910A]">LOADING</span>
        </div>
      </div>
    </div>
  )
}
