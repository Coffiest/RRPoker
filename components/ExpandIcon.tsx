/**
 * 開く・たたむの印(オーナー指定・2026-11-10。Uiverse.io の AbanoubMagdy1 の部品。globals.css の .rr-expand)。
 * たたんでいると +、開くと縦の線が倒れて −。押す場所はこれを囲むボタン(aria-expanded を付ける)。
 */
export default function ExpandIcon({ open, light, size = 26 }: { open: boolean; light?: boolean; size?: number }) {
  return (
    <span className={`rr-expand${open ? ' is-open' : ''}${light ? ' is-light' : ''}`} aria-hidden style={{ width: size, height: size }}>
      <i /><i />
    </span>
  )
}
