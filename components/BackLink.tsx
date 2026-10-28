'use client'

import { ChevronLeftIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'

/**
 * 「戻る」。来た画面へ戻る(設定から開いたら設定へ)。履歴が無いとき(直接開いた・新しいタブ)は fallback へ。
 */
export default function BackLink({ fallback = '/' }: { fallback?: string }) {
  const router = useRouter()
  return (
    <button
      type="button"
      onClick={() => (window.history.length > 1 ? router.back() : router.push(fallback))}
      data-nav-back=""
      className="inline-flex min-h-[44px] items-center gap-1 text-[17px] text-[#B57F00] mb-4 -ml-2 pr-2"
      style={{ background: 'none', border: 'none', cursor: 'pointer' }}
    >
      <ChevronLeftIcon size={24} />
      Back
    </button>
  )
}
