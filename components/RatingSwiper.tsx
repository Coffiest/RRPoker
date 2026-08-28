'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * 偏差値カードの横スワイプ。
 *
 * カードの幅は変えない(1枚が常に全幅)。「もう1枚ある」ことは
 *  - 下のドット
 *  - 初回だけ少し左へ動いて戻るナッジ
 * で伝える。次のカードの端をのぞかせる方式は、のぞかせる余白のぶんだけ
 * カードを細くする必要があり「サイズは変えない」と両立しないため採らない。
 *
 * スクロールは CSS の scroll-snap に任せる。JSでの位置制御をしないので、
 * 指の動きにそのまま追従し、慣性も端末のものがそのまま効く。
 */

/** ナッジを見せたかどうかの記録キー(1度見せたら二度と出さない)。 */
const NUDGE_KEY = 'rrpoker.ratingSwiper.nudged'

export default function RatingSwiper({ children }: { children: React.ReactNode[] }) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)
  const count = children.length

  // 表示中のカードをスクロール位置から求める。
  const onScroll = () => {
    const el = scrollerRef.current
    if (!el || el.clientWidth === 0) return
    setIndex(Math.round(el.scrollLeft / el.clientWidth))
  }

  // 初回だけ、スワイプできることを短いナッジで示す。
  useEffect(() => {
    const el = scrollerRef.current
    if (!el || count < 2) return
    let done = false
    try { done = localStorage.getItem(NUDGE_KEY) === '1' } catch { /* 使えなければ毎回出す */ }
    if (done) return

    const timer = window.setTimeout(() => {
      const target = scrollerRef.current
      if (!target) return
      target.scrollTo({ left: Math.min(28, target.clientWidth * 0.08), behavior: 'smooth' })
      window.setTimeout(() => scrollerRef.current?.scrollTo({ left: 0, behavior: 'smooth' }), 420)
      try { localStorage.setItem(NUDGE_KEY, '1') } catch { /* 記録できなくても動作に影響しない */ }
    }, 700)
    return () => window.clearTimeout(timer)
  }, [count])

  const goTo = (i: number) => {
    const el = scrollerRef.current
    if (!el) return
    el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' })
  }

  return (
    <div>
      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className="no-scrollbar"
        style={{
          display: 'flex',
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          WebkitOverflowScrolling: 'touch',
          scrollBehavior: 'auto',
        }}
      >
        {children.map((child, i) => (
          <div
            key={i}
            style={{ flex: '0 0 100%', minWidth: 0, scrollSnapAlign: 'start', scrollSnapStop: 'always' }}
            aria-hidden={i !== index}
          >
            {child}
          </div>
        ))}
      </div>

      {count > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 10 }}>
          {children.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`${i + 1}枚目を表示`}
              aria-current={i === index}
              style={{
                width: i === index ? 18 : 6,
                height: 6,
                borderRadius: 99,
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                background: i === index ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.45)',
                transition: 'width 0.25s ease, background 0.25s ease',
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
