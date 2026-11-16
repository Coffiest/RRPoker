'use client'

/**
 * 画面に近づいた間だけ中身を出す(電池対策・2026-11-16)。
 * 店舗ホームのカードやプレイヤーのタイマーは、タイマー画面を丸ごと埋め込んでいる(iframe = 中でアプリがもう 1 つ動く)。
 * 大会が 7 つあると 7 つのアプリが同時に動き、画面の外のものまで毎秒描き直して電池を減らしていた。
 * 画面から 600px 以上離れたら外し、近づいたら付け直す。外している間は placeholder を出す。
 */
import { useEffect, useRef, useState } from 'react'

export default function WhenVisible({ children, placeholder = null, rootMargin = '600px' }: {
  children: React.ReactNode
  placeholder?: React.ReactNode
  rootMargin?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') { setVisible(true); return }
    const io = new IntersectionObserver(entries => {
      for (const e of entries) setVisible(e.isIntersecting)
    }, { rootMargin })
    io.observe(el)
    return () => io.disconnect()
  }, [rootMargin])
  return <div ref={ref} style={{ position: 'absolute', inset: 0 }}>{visible ? children : placeholder}</div>
}
