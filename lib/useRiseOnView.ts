'use client'

import { useEffect } from 'react'

/**
 * 画面に入った要素を一度だけ立ち上げる。
 *
 * .a-rise を付けた要素を探し、見えた時点で .is-in を足す。往復させないのは、
 * 読んでいる最中に上下すると、そのたびに動きが走って邪魔になるため。
 *
 * データの読み込み後に描かれる要素(店内ランキングなど)も拾うよう、追加された
 * 要素を MutationObserver で見張る。以前は最初に見つかった要素しか見ておらず、
 * あとから出た .a-rise は透明(opacity: 0)のまま二度と表示されなかった。
 *
 * IntersectionObserver が無い環境では、最初から出したままにする。動きが無い
 * だけで、内容は必ず見える状態にしておく。
 */
export function useRiseOnView(deps: unknown[] = []) {
  useEffect(() => {
    const pending = () => Array.from(document.querySelectorAll<HTMLElement>('.a-rise:not(.is-in)'))

    if (typeof IntersectionObserver === 'undefined') {
      pending().forEach(n => n.classList.add('is-in'))
      return
    }

    const watched = new WeakSet<Element>()
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
    const observeAll = () => {
      for (const n of pending()) {
        if (watched.has(n)) continue
        watched.add(n)
        io.observe(n)
      }
    }
    observeAll()

    const mo = typeof MutationObserver === 'undefined' ? null : new MutationObserver(observeAll)
    mo?.observe(document.body, { childList: true, subtree: true })

    return () => { io.disconnect(); mo?.disconnect() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
