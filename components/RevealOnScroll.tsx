'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * 長い一覧を「スクロールした分だけ」描くための入れ物。
 *
 * 一覧が伸びるほど、開いた瞬間に全行を組み立てる時間がそのまま待ち時間になる。
 * 実際に読むのは上のほうだけなので、最初は数十件だけ描き、末尾の番人が画面に
 * 入ったときに次の塊を足す。行の中身には触らないので、見た目は変わらない。
 *
 * IntersectionObserver が無い環境では番人を出さず、全件を描いて従来どおりにする
 * (少しでも表示されないほうが困るため)。
 */
export function useRevealOnScroll<T>(items: T[], pageSize = 20) {
  const [shown, setShown] = useState(pageSize)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  // 一覧そのものが差し替わったら最初から数え直す(タブ切り替えなど)。
  useEffect(() => { setShown(pageSize) }, [items, pageSize])

  const hasMore = shown < items.length

  useEffect(() => {
    if (!hasMore) return
    const node = sentinelRef.current
    if (!node) return
    if (typeof IntersectionObserver === 'undefined') { setShown(items.length); return }

    const io = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) {
        setShown(n => Math.min(n + pageSize, items.length))
      }
      // 余裕をもって先に読み込み始める(下端に着いてからだと一瞬空白が見える)。
    }, { rootMargin: '240px 0px' })

    io.observe(node)
    return () => io.disconnect()
  }, [hasMore, items.length, pageSize])

  return { visible: items.slice(0, shown), hasMore, sentinelRef }
}

/** 続きがあることを示す番人。ここが見えたら次の塊を読み込む。 */
export function RevealSentinel({ innerRef }: { innerRef: React.RefObject<HTMLDivElement | null> }) {
  return (
    <div ref={innerRef} style={{ padding: '10px 0 4px' }} aria-hidden="true">
      <div className="tech-bar-track"><span className="tech-bar-fill" /></div>
    </div>
  )
}
