/**
 * 読み込み中の表示(オーナー指定・2026-11-06。Uiverse.io の david-mohseni の部品)。
 * 12 本の棒が順に薄くなる。アプリの読み込み表示はすべてこれ(globals.css の .rr-loader)。
 * light は金や濃い面の上(棒を白に)。
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
      {Array.from({ length: 12 }, (_, i) => <div key={i} />)}
    </div>
  )
}
