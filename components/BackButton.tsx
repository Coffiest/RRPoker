'use client'

/**
 * 戻るボタン(オーナー指定・2026-11-06。Uiverse.io の karthik092726122003 の部品を 44px にした)。
 * 輪は濃い文字色。乗せる・押すと金の輪に変わり、矢印が横へ抜けて次の矢印が入る(globals.css の .rr-back)。
 * onClick も href も無ければ前の画面へ戻る。light は濃い面の上(輪と矢印を白に)。
 */
import { useRouter } from 'next/navigation'

const Arrow = () => (
  <svg className="rr-back-elem" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
    <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
  </svg>
)

export default function BackButton({ onClick, href, label = '戻る', light = false, className = '', style }: {
  onClick?: () => void
  /** 押すとこの画面へ移る(サーバーで作る画面から使うとき) */
  href?: string
  label?: string
  light?: boolean
  className?: string
  style?: React.CSSProperties
}) {
  const router = useRouter()
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick ?? (() => (href ? router.push(href) : router.back()))}
      className={`rr-back${light ? ' is-light' : ''}${className ? ` ${className}` : ''}`} style={style}>
      <span className="rr-back-box"><Arrow /><Arrow /></span>
    </button>
  )
}
