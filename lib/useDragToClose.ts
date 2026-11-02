'use client'

// 下から出る画面(シート)を、指で下に引いて閉じられるようにする。
// 見た目は各画面の元のシートのまま。返す ref をシートの面に付けるだけで動く。
//
// - 指に 1:1 でついてくる(上へは引くほど重くなる)
// - 離したときの速さから止まる位置を見込み、高さの 4 割を超えたら閉じる。届かなければ元の位置へ戻る
// - 中身がスクロール途中のとき・入力欄から始めたときは掴まない(スクロールや入力を邪魔しない)
// .claude/skills/apple-design §2・§5・§6・§9

import { useCallback, useRef } from 'react'
import { hapticTap } from './haptics'

export function useDragToClose(onClose: () => void) {
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  const cleanup = useRef<(() => void) | null>(null)

  return useCallback((el: HTMLElement | null) => {
    cleanup.current?.()
    cleanup.current = null
    if (!el) return

    let startY = 0, dy = 0, active = false, tracking = false, pid = -1
    let hist: { y: number; t: number }[] = []

    const setY = (y: number, anim?: string) => {
      el.style.transition = anim ?? 'none'
      el.style.transform = y ? `translate3d(0, ${y}px, 0)` : ''
    }
    const rubber = (o: number) => -(Math.abs(o) * 80 * 0.55) / (80 + 0.55 * Math.abs(o))

    const down = (e: PointerEvent) => {
      if (e.button !== 0) return
      const t = e.target as HTMLElement
      if (t.closest('input, textarea, select, [contenteditable="true"]')) return
      for (let n: HTMLElement | null = t; n && n !== el.parentElement; n = n.parentElement) {
        if (n.scrollTop > 0) return
      }
      tracking = true; active = false; startY = e.clientY; dy = 0; pid = e.pointerId
      hist = [{ y: e.clientY, t: performance.now() }]
    }
    const move = (e: PointerEvent) => {
      if (!tracking || e.pointerId !== pid) return
      dy = e.clientY - startY
      if (!active) {
        if (Math.abs(dy) < 10) return
        if (dy < 0) { tracking = false; return } // 上向きはスクロールに任せる
        active = true
        try { el.setPointerCapture(pid) } catch {}
      }
      e.preventDefault()
      hist.push({ y: e.clientY, t: performance.now() }); if (hist.length > 6) hist.shift()
      setY(dy >= 0 ? dy : rubber(dy))
    }
    const up = (e: PointerEvent) => {
      if (!tracking || e.pointerId !== pid) return
      tracking = false
      if (!active) return
      active = false
      const a = hist[0], b = hist[hist.length - 1]
      const v = b && a && b.t > a.t ? ((b.y - a.y) / (b.t - a.t)) * 1000 : 0 // px/s
      const projected = dy + (v / 1000) * 0.998 / (1 - 0.998)
      const h = el.getBoundingClientRect().height || window.innerHeight
      if (projected > h * 0.4) {
        hapticTap()
        setY(h + 40, 'transform 0.28s cubic-bezier(0.2, 0.9, 0.3, 1)')
        window.setTimeout(() => closeRef.current(), 260)
      } else {
        setY(0, 'transform 0.35s cubic-bezier(0.2, 0.9, 0.3, 1)')
      }
    }

    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move, { passive: false })
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
    el.style.touchAction = 'pan-y'
    cleanup.current = () => {
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
    }
  }, [])
}
