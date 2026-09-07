'use client'

import { useEffect } from 'react'

/**
 * 画面に入った要素を一度だけ立ち上げる。
 *
 * .a-rise を付けた要素を探し、見えた時点で .is-in を足す。往復させないのは、
 * 読んでいる最中に上下すると、そのたびに動きが走って邪魔になるため。
 *
 * IntersectionObserver が無い環境では、最初から出したままにする。動きが無い
 * だけで、内容は必ず見える状態にしておく。
 */
export function useRiseOnView(deps: unknown[] = []) {
  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>('.a-rise:not(.is-in)'))
    if (nodes.length === 0) return

    if (typeof IntersectionObserver === 'undefined') {
      nodes.forEach(n => n.classList.add('is-in'))
      return
    }

    const io = new IntersectionObserver(
      entries => {
        for (const e of entries) {
          if (!e.isIntersecting) continue
          e.target.classList.add('is-in')
          io.unobserve(e.target)
        }
      },
      // 少し手前で始める。指が上げきる前に出ていてほしい。
      { rootMargin: '0px 0px -8% 0px', threshold: 0.02 },
    )
    nodes.forEach(n => io.observe(n))
    return () => io.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
