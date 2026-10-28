'use client'

import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { hapticTap } from '@/lib/haptics'

/**
 * iOS の「設定」アプリと同じ、まとまった一覧(グループ表)の部品。
 * 見出しは面の外に小さく、行は 56px 以上、行と行の間にだけ細い罫を引く。
 * 設定・プロフィールなど、項目を並べる画面はこの部品で組む(見た目と押し心地をそろえるため)。
 */

export function PageTitleBar({ title, onBack, backLabel = '戻る' }: { title: string; onBack?: () => void; backLabel?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', minHeight: 44, margin: '8px 0 0' }}>
      {onBack && (
        <button type="button" onClick={onBack} className="gl-press"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 2, minHeight: 44, padding: '0 8px 0 0', border: 'none', background: 'none', color: '#B57F00', fontSize: 17, fontFamily: 'inherit', cursor: 'pointer' }}>
          <ChevronLeftIcon size={24} /> {backLabel}
        </button>
      )}
      <h1 style={{ flex: 1, fontSize: 17, fontWeight: 600, textAlign: 'center', margin: 0, marginRight: onBack ? 64 : 0, color: 'var(--label)' }}>{title}</h1>
    </div>
  )
}

export function LargeTitle({ children }: { children: React.ReactNode }) {
  return <h1 style={{ fontSize: 34, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.2, margin: '16px 0 24px', color: 'var(--label)' }}>{children}</h1>
}

export function Section({ header, footer, children }: { header?: React.ReactNode; footer?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 32 }}>
      {header && <h2 style={{ fontSize: 13, fontWeight: 400, color: 'var(--label2)', margin: '0 16px 8px', letterSpacing: 0 }}>{header}</h2>}
      <div className="gl-list" style={{ background: '#fff', borderRadius: 16, overflow: 'hidden' }}>{children}</div>
      {footer && <p style={{ fontSize: 13, color: 'var(--label2)', margin: '8px 16px 0', lineHeight: 1.4 }}>{footer}</p>}
      <style>{`
        .gl-list > * + * { box-shadow: inset 0 1px 0 rgba(60,60,67,0.12); }
        .gl-row { -webkit-tap-highlight-color: transparent; transition: background-color 100ms ease-out; }
        button.gl-row:active, label.gl-row:active { background: rgba(60,60,67,0.08); }
        .gl-press { -webkit-tap-highlight-color: transparent; transition: opacity 100ms ease-out; }
        .gl-press:active { opacity: 0.5; }
        .gl-input:focus { outline: none; }
      `}</style>
    </section>
  )
}

const rowBase: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 16, width: '100%', minHeight: 56,
  padding: '8px 16px', background: 'transparent', border: 'none', textAlign: 'left',
  fontSize: 17, color: 'var(--label)', fontFamily: 'inherit', boxSizing: 'border-box',
}

/** 押すと別の画面へ進む行(右端に「>」)。 */
export function NavRow({ icon, label, detail, onClick, destructive }: {
  icon?: React.ReactNode; label: string; detail?: string; onClick: () => void; destructive?: boolean
}) {
  return (
    <button type="button" onClick={onClick} className="gl-row" style={{ ...rowBase, cursor: 'pointer', color: destructive ? '#D70015' : 'var(--label)' }}>
      {icon && <span style={{ display: 'flex', flexShrink: 0 }}>{icon}</span>}
      <span style={{ flex: 1, minWidth: 0 }}>{label}</span>
      {detail && <span style={{ color: 'var(--label2)', fontSize: 17 }}>{detail}</span>}
      {!destructive && <ChevronRightIcon size={20} style={{ color: 'var(--label3)', flexShrink: 0 }} />}
    </button>
  )
}

/** 左に項目名、右に入力や値を置く行。 */
export function FieldRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="gl-row" style={rowBase}>
      <span style={{ flexShrink: 0, maxWidth: '50%' }}>
        <span style={{ display: 'block' }}>{label}</span>
        {hint && <span style={{ display: 'block', fontSize: 13, color: 'var(--label2)', marginTop: 2 }}>{hint}</span>}
      </span>
      <span style={{ flex: 1, minWidth: 0, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>{children}</span>
    </label>
  )
}

export const fieldInput: React.CSSProperties = {
  width: '100%', minWidth: 0, height: 44, border: 'none', background: 'none', outline: 'none',
  fontSize: 17, color: 'var(--label)', textAlign: 'right', fontFamily: 'inherit',
}

/** 選択肢から 1 つ選ぶ行(選ばれている行に「✓」)。 */
export function ChoiceRow({ label, detail, selected, onSelect }: { label: string; detail?: string; selected: boolean; onSelect: () => void }) {
  return (
    <button type="button" role="radio" aria-checked={selected} onClick={() => { if (!selected) hapticTap(); onSelect() }} className="gl-row" style={{ ...rowBase, cursor: 'pointer' }}>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block' }}>{label}</span>
        {detail && <span style={{ display: 'block', fontSize: 13, color: 'var(--label2)', marginTop: 2 }}>{detail}</span>}
      </span>
      {selected && (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ color: '#B57F00', flexShrink: 0 }}>
          <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  )
}

/** オン/オフの行。スイッチは iOS と同じ 51×31。 */
export function SwitchRow({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="gl-row" style={rowBase}>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block' }}>{label}</span>
        {hint && <span style={{ display: 'block', fontSize: 13, color: 'var(--label2)', marginTop: 2 }}>{hint}</span>}
      </span>
      <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => { hapticTap(); onChange(!checked) }} className="a-switch" />
    </div>
  )
}

/** 画面いちばん下の主な操作など、一覧の外に置く大きいボタン。 */
export function PrimaryButton({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="gl-press"
      style={{ width: '100%', minHeight: 48, borderRadius: 999, border: 'none', background: '#F2A900', color: '#fff', fontSize: 17, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', opacity: disabled ? 0.5 : 1 }}>
      {children}
    </button>
  )
}
