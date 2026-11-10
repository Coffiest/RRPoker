'use client'

/**
 * チェックボックス(オーナー指定・2026-11-10。Uiverse.io の Tsiangana の部品。globals.css の .ios-checkbox)。
 * 金で塗り、白いチェックが線で描かれる。アプリのチェックボックスはすべてこれ。
 * 行全体を押す作り(role="checkbox" のボタン)の中では <CheckMark on /> で見た目だけ使う。
 */
function Box({ on }: { on?: boolean }) {
  return (
    <span className={`checkbox-wrapper${on ? ' is-on' : ''}`} aria-hidden>
      <span className="checkbox-bg" />
      <svg className="checkbox-icon" viewBox="0 0 24 24" fill="none">
        <path className="check-path" d="M4 12L10 18L20 6" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  )
}

export default function RrCheckbox({ checked, onChange, children, disabled, red, className = '', style }: {
  checked: boolean
  onChange: (v: boolean) => void
  children?: React.ReactNode
  disabled?: boolean
  red?: boolean
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <label className={`ios-checkbox${red ? ' red' : ''}${disabled ? ' is-disabled' : ''}${className ? ` ${className}` : ''}`} style={style}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={e => onChange(e.target.checked)} />
      <Box />
      {children}
    </label>
  )
}

/** 見た目だけ(行を押して切り替える作りの中に置く) */
export function CheckMark({ on, red }: { on: boolean; red?: boolean }) {
  return <span className={`ios-checkbox${red ? ' red' : ''}`} style={{ pointerEvents: 'none' }}><Box on={on} /></span>
}
