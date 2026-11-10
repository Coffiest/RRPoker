/**
 * 読み込み中の表示(オーナー指定・2026-11-10。Uiverse.io の PriyanshuGupta28 の部品。以前は david-mohseni の 12 本)。
 * 10 本の棒が順に外へ伸びる。アプリの読み込み表示はすべてこれ(globals.css の .rr-loader / .rr-spin)。
 * 色は金。light は金や濃い面の上(棒を白に)。
 */
export default function Loader({ size = 54, light = false, label = '読み込み中', className = '', style }: {
  size?: number
  light?: boolean
  label?: string
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <div className={`rr-loader${light ? ' is-light' : ''}${className ? ` ${className}` : ''}`} role="status" aria-label={label}
      style={{ width: size, height: size, ...style }}>
      <span className="rr-spin" aria-hidden>{Array.from({ length: 10 }, (_, i) => <i key={i} />)}</span>
    </div>
  )
}
