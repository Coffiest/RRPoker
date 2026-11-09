'use client'

/**
 * 数字の入力欄(type="number")は、ブラウザの標準では選んだ状態でマウスのホイール・トラックパッドのスワイプ・
 * 上下キーを使うと値が増減する。ブラインド作成・Adjust で、スクロールしたつもりがレベルや MIN が変わっていた。
 * 打ち込み以外で値が変わらないようにする(オーナー指定・2026-11-09)。app/layout.tsx に 1 つだけ置く。
 * - ホイール: 選んでいる数字欄の上で回したら、その欄の選択を外す(値は変わらず、画面のスクロールになる)
 * - 上下キー・PageUp/PageDown: 数字欄では何もしない
 */
import { useEffect } from 'react'

const isNumberInput = (el: EventTarget | null): el is HTMLInputElement =>
  el instanceof HTMLInputElement && el.type === 'number'

export default function NumberInputGuard() {
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      const el = document.activeElement
      if (isNumberInput(el) && (e.target === el || el.contains(e.target as Node))) el.blur()
    }
    const onKey = (e: KeyboardEvent) => {
      if (isNumberInput(e.target) && ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown'].includes(e.key)) e.preventDefault()
    }
    document.addEventListener('wheel', onWheel, { capture: true, passive: true })
    document.addEventListener('keydown', onKey, { capture: true })
    return () => {
      document.removeEventListener('wheel', onWheel, { capture: true })
      document.removeEventListener('keydown', onKey, { capture: true })
    }
  }, [])
  return null
}
