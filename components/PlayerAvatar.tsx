/**
 * プレイヤーのアイコン(オーナー指定・2026-11-09)。
 * 画像があれば画像、無ければ灰色の地に人型(以前は名前の頭文字だった)。アプリ中のプレイヤーのアイコンはこれ。
 * 店舗のアイコンには使わない。
 */
export default function PlayerAvatar({ src, size = 32, radius, style, alt = '' }: {
  src?: string | null
  size?: number
  /** 角の丸み。省略すると丸 */
  radius?: number
  style?: React.CSSProperties
  alt?: string
}) {
  const r = radius ?? size / 2
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element -- 利用者のアイコン(data URL・外部 URL)
    return <img src={src} alt={alt} style={{ width: size, height: size, borderRadius: r, objectFit: 'cover', flexShrink: 0, display: 'block', ...style }} />
  }
  return (
    <span aria-hidden={alt ? undefined : true} role={alt ? 'img' : undefined} aria-label={alt || undefined}
      style={{ width: size, height: size, borderRadius: r, background: '#D1D1D6', flexShrink: 0, display: 'inline-flex', alignItems: 'flex-end', justifyContent: 'center', overflow: 'hidden', ...style }}>
      <svg viewBox="0 0 24 24" width={size * 0.86} height={size * 0.86} fill="#fff" aria-hidden="true" style={{ display: 'block' }}>
        <circle cx="12" cy="9" r="4.6" />
        <path d="M3.2 24c0-5.1 3.9-8.6 8.8-8.6s8.8 3.5 8.8 8.6z" />
      </svg>
    </span>
  )
}
