'use client'

/**
 * 増やす・減らすボタン(オーナー指定・2026-11-06。Uiverse.io の mRcOol7 の部品を金にした)。
 * 金の輪の中に + / −。乗せると 90 度回って金で塗られ、中の線が白になる。押した瞬間は濃い金。
 * エントリーの +1 など、数を増減するボタンはすべてこれ。押せる範囲は 44px 以上。
 */
export default function StepButton({ kind, onClick, label, size = 40, hit = 44, disabled = false, style }: {
  kind: 'plus' | 'minus'
  onClick: () => void
  label?: string
  size?: number
  /** 押せる範囲(既定 44px。行に入りきらない一覧だけ小さくする) */
  hit?: number
  disabled?: boolean
  style?: React.CSSProperties
}) {
  const name = label ?? (kind === 'plus' ? '増やす' : '減らす')
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={name} title={name}
      className="group outline-none duration-300 hover:rotate-90 disabled:opacity-40 disabled:hover:rotate-0"
      style={{ minWidth: hit, minHeight: hit, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0, border: 'none', background: 'none', cursor: disabled ? 'default' : 'pointer', flexShrink: 0, ...style }}>
      <svg viewBox="0 0 24 24" width={size} height={size} xmlns="http://www.w3.org/2000/svg" aria-hidden="true"
        className="fill-none stroke-[#D4910A] duration-300 group-hover:fill-[#F2A900] group-active:fill-[#D4910A] group-active:duration-0">
        <path strokeWidth="1.5" d="M12 22C17.5 22 22 17.5 22 12C22 6.5 17.5 2 12 2C6.5 2 2 6.5 2 12C2 17.5 6.5 22 12 22Z" />
        <path strokeWidth="1.5" d="M8 12H16" className="duration-300 group-hover:stroke-white group-active:stroke-white" />
        {kind === 'plus' && <path strokeWidth="1.5" d="M12 16V8" className="duration-300 group-hover:stroke-white group-active:stroke-white" />}
      </svg>
    </button>
  )
}
