'use client'

import { useEffect, useRef, useState } from 'react'
import { CircleAlert, CircleCheck } from 'lucide-react'
import type { ToastKind } from '@/lib/toast'

/** lib/toast.ts の showToast() を受けて、画面の下に 3 秒だけ出す。 */
export default function Toaster() {
  const [toast, setToast] = useState<{ message: string; kind: ToastKind; id: number } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<{ message: string; kind: ToastKind }>).detail
      setToast({ ...d, id: Date.now() })
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => setToast(null), 3000)
    }
    window.addEventListener('rrpoker:toast', on)
    return () => { window.removeEventListener('rrpoker:toast', on); if (timer.current) clearTimeout(timer.current) }
  }, [])

  if (!toast) return null
  const Icon = toast.kind === 'ok' ? CircleCheck : CircleAlert
  return (
    <div role="status" aria-live="polite" key={toast.id}
      style={{ position: 'fixed', left: '50%', bottom: 'calc(112px + env(safe-area-inset-bottom, 0px))', transform: 'translateX(-50%)', zIndex: 20000, width: 'calc(100% - 32px)', maxWidth: 360, pointerEvents: 'none' }}>
      <style>{`@keyframes rrToastIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}@media (prefers-reduced-motion: reduce){[role=status] *{animation:none!important}}`}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderRadius: 16, background: '#fff', boxShadow: '0 8px 32px rgba(0,0,0,0.16)', animation: 'rrToastIn .3s cubic-bezier(.22,1,.36,1)' }}>
        <Icon size={18} strokeWidth={2} color={toast.kind === 'ok' ? '#248A3D' : '#C62828'} aria-hidden style={{ flexShrink: 0 }} />
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--label)', lineHeight: 1.4 }}>{toast.message}</span>
      </div>
    </div>
  )
}
