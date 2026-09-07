'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * 桁が入れ替わって見える数字。
 *
 * この画面でいちばん見られるのは金額と時計で、そこでは「いくつか」と同じくらい
 * 「変わったかどうか」が情報になる。差し替えてしまうと、目を離した隙の増減が
 * 分からない。桁ごとに 0-9 の帯を持ち、該当の位置まで送ることで、変わった桁だけが
 * 動く。
 *
 * 桁位置はずらさない。字幅は tabular のまま固定し、動かすのは縦位置だけ。
 * 動きを減らす設定では送りを止め、増減の色の合図だけ残す(色は前庭系に触らず、
 * 手がかりとしては要るため)。
 */
export default function KineticNumber({
  value,
  format,
  className,
  style,
  /** 増減で色を一瞬乗せる。時計のように増減に意味が無いものは false。 */
  signal = true,
}: {
  value: number
  format?: (n: number) => string
  className?: string
  style?: React.CSSProperties
  signal?: boolean
}) {
  const text = format ? format(value) : String(value)
  const prev = useRef(value)
  const [dir, setDir] = useState<'up' | 'down' | null>(null)

  useEffect(() => {
    if (!signal) { prev.current = value; return }
    if (value === prev.current) return
    setDir(value > prev.current ? 'up' : 'down')
    prev.current = value
    const id = setTimeout(() => setDir(null), 700)
    return () => clearTimeout(id)
  }, [value, signal])

  return (
    <span
      className={`a-kinetic ${dir === 'up' ? 'a-kinetic-up' : dir === 'down' ? 'a-kinetic-down' : ''} ${className ?? ''}`}
      style={style}
      // 読み上げには最終的な値だけ渡す。桁の帯を一つずつ読ませない。
      aria-label={text}
    >
      {text.split('').map((ch, i) => {
        const d = ch.charCodeAt(0) - 48
        // 区切り(コロン・カンマ・符号)も、数字と同じ高さの箱に入れる。
        // 素のインラインのままだと、行送り 1em の桁とベースラインが揃わず、
        // 時計のコロンが沈んで見える。
        if (d < 0 || d > 9) {
          return (
            <span key={i} aria-hidden style={{ display: 'inline-block', height: '1em', lineHeight: 1 }}>
              {ch}
            </span>
          )
        }
        return (
          <span key={i} className="a-kinetic-col" style={{ height: '1em', lineHeight: 1 }} aria-hidden>
            <span style={{ transform: `translateY(${-d}em)` }}>
              {['0','1','2','3','4','5','6','7','8','9'].map(n => (
                <span key={n} style={{ display: 'block', height: '1em', lineHeight: 1 }}>{n}</span>
              ))}
            </span>
          </span>
        )
      })}
    </span>
  )
}
