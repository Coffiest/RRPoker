'use client'

/**
 * 丸の + ボタン(オーナー指定・2026-11-10。Uiverse.io の mRcOol7 の部品。globals.css の .rr-add)。
 * 乗せると 90 度回って金で塗られ、+ は白。何かを足す操作(大会・プリセット・仮プレイヤー・レベル等)に使う。
 */
export default function AddButton({ onClick, label, size = 40, disabled, className = '', style }: {
  onClick: () => void
  label: string
  size?: number
  disabled?: boolean
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <button type="button" className={`rr-add${className ? ` ${className}` : ''}`} onClick={onClick} disabled={disabled}
      aria-label={label} title={label} style={{ minWidth: 44, minHeight: 44, ...style }}>
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
        <path strokeWidth="1.5" d="M12 22C17.5 22 22 17.5 22 12C22 6.5 17.5 2 12 2C6.5 2 2 6.5 2 12C2 17.5 6.5 22 12 22Z" />
        <path strokeWidth="1.5" d="M8 12H16" />
        <path strokeWidth="1.5" d="M12 16V8" />
      </svg>
    </button>
  )
}

/** 見た目だけ(行全体が押せるボタンの中に置く。行に乗せると回って金になる) */
export function AddIcon({ size = 32 }: { size?: number }) {
  return (
    <span className="rr-add rr-add-ico" aria-hidden>
      <svg viewBox="0 0 24 24" width={size} height={size}>
        <path strokeWidth="1.5" d="M12 22C17.5 22 22 17.5 22 12C22 6.5 17.5 2 12 2C6.5 2 2 6.5 2 12C2 17.5 6.5 22 12 22Z" />
        <path strokeWidth="1.5" d="M8 12H16" />
        <path strokeWidth="1.5" d="M12 16V8" />
      </svg>
    </span>
  )
}
