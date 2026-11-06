'use client'

/**
 * 線で縁取りするボタン(オーナー指定・2026-11-06。Uiverse.io の himanshu9682 の部品を金にした)。
 * 乗せる・押すと上下の線が反対側へ流れ、字の間が広がる(globals.css の .rr-line)。
 * 「ランキングを見る」のような、ページの中の二番手の案内に使う。
 */
export default function LineButton({ children, onClick, style }: {
  children: React.ReactNode
  onClick: () => void
  style?: React.CSSProperties
}) {
  return (
    <button type="button" className="rr-line" onClick={onClick} style={style}>
      <span className="rr-line__line" />
      <span className="rr-line__line" />
      <span className="rr-line__text">{children}</span>
    </button>
  )
}
