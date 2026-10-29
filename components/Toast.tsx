'use client'

import { useEffect, useState } from 'react'
import { CircleAlertIcon, CircleCheckIcon } from 'lucide-react'
import { hapticError, hapticSuccess } from '@/lib/haptics'

/**
 * 画面を止めない短い知らせ(iOS のバナーに近い)。ブラウザの alert() の代わりに使う。
 * どこからでも showToast() で出せるよう、window のイベントで受け渡す。
 */
type ToastKind = 'error' | 'success'
type ToastItem = { id: number; message: string; kind: ToastKind }

const EVENT = 'rrpoker:toast'

export function showToast(message: string, kind: ToastKind = 'error') {
  if (typeof window === 'undefined') return
  // 知らせが出るのと同じ瞬間に震わせる(結果が出たことを手でも分かるように)。
  if (kind === 'error') hapticError(); else hapticSuccess()
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { message, kind } }))
}

export default function ToastHost() {
  const [items, setItems] = useState<ToastItem[]>([])

  useEffect(() => {
    let seq = 0
    const onToast = (e: Event) => {
      const { message, kind } = (e as CustomEvent).detail as { message: string; kind: ToastKind }
      const id = ++seq
      setItems(list => [...list.slice(-2), { id, message, kind }])
      // 読み切れる長さだけ出す(文字数に応じて 2.5〜6 秒)。
      const ms = Math.min(6000, 2500 + message.length * 60)
      window.setTimeout(() => setItems(list => list.filter(t => t.id !== id)), ms)
    }
    window.addEventListener(EVENT, onToast)
    return () => window.removeEventListener(EVENT, onToast)
  }, [])

  if (items.length === 0) return null
  return (
    <div aria-live="polite" style={{
      position: 'fixed', left: 0, right: 0, top: 'calc(env(safe-area-inset-top, 0px) + 8px)',
      zIndex: 3000, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
      padding: '0 16px', pointerEvents: 'none',
    }}>
      {items.map(t => (
        <div key={t.id} role={t.kind === 'error' ? 'alert' : 'status'} className="a-dialog" style={{
          pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 8,
          maxWidth: 420, width: '100%', minHeight: 48, padding: '8px 16px', borderRadius: 16,
          fontSize: 13, fontWeight: 500, color: 'var(--label)',
        }}>
          {t.kind === 'error'
            ? <CircleAlertIcon size={20} style={{ color: '#D70015', flexShrink: 0 }} />
            : <CircleCheckIcon size={20} style={{ color: '#1E7B34', flexShrink: 0 }} />}
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  )
}
