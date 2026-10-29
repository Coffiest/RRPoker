'use client'

import { createPortal } from 'react-dom'
import { hapticAction } from '@/lib/haptics'

/**
 * iOS のアラートに合わせた確認ダイアログ。取り消せない操作(削除・お金の確定など)の前だけに使う。
 * 何にでも出すと、読まずに押す癖がつく(.claude/skills/apple-design §16 Agency)。
 */
export type ConfirmRequest = {
  title: string
  message: string
  /** 実行ボタンの文言。「削除」「承認」など、動詞で具体的に。 */
  action: string
  /** 取り消せない・失うものがある操作なら赤にする。 */
  destructive?: boolean
  run: () => Promise<void> | void
}

export default function ConfirmDialog({ request, onClose }: { request: ConfirmRequest | null; onClose: () => void }) {
  if (!request || typeof document === 'undefined') return null
  const { title, message, action, destructive, run } = request
  return createPortal(
    <div role="alertdialog" aria-modal="true" aria-label={title}
      style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div className="a-scrim" onClick={onClose} style={{ position: 'absolute', inset: 0 }} />
      <div className="a-dialog" style={{ position: 'relative', width: '100%', maxWidth: 320, overflow: 'hidden' }}>
        <div style={{ padding: '24px 16px 16px', textAlign: 'center' }}>
          <p style={{ fontSize: 14, fontWeight: 600, margin: 0, color: 'var(--label)' }}>{title}</p>
          <p style={{ fontSize: 13, color: 'var(--label2)', margin: '8px 0 0', lineHeight: 1.4 }}>{message}</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderTop: '1px solid rgba(60,60,67,0.12)' }}>
          <button type="button" onClick={onClose} className="confirm-btn"
            style={{ minHeight: 48, border: 'none', background: 'none', fontSize: 14, color: '#1546D9', fontFamily: 'inherit', borderRight: '1px solid rgba(60,60,67,0.12)', cursor: 'pointer' }}>
            Cancel
          </button>
          <button type="button" autoFocus className="confirm-btn"
            onClick={async () => { hapticAction(); onClose(); await run() }}
            style={{ minHeight: 48, border: 'none', background: 'none', fontSize: 14, fontWeight: 600, color: destructive ? '#D70015' : '#1546D9', fontFamily: 'inherit', cursor: 'pointer' }}>
            {action}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
