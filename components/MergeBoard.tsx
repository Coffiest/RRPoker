'use client'

/**
 * タイマーカードの「合体」(Apple のホーム画面でアイコンを重ねてフォルダにする操作と同じ考え方)。
 *
 * - 各カード右上のつまみを長押し(0.5 秒)すると編集モードになり、全カードがぷるぷる震える。
 * - 編集中はカードを指でつかんで動かせる(指に 1:1 でついてくる)。
 * - 別のカードの上に重ねると、そのカードに「+」が出る。離すと 2 つが合体し、分割表示のカードになる。
 * - 合体は最大 4 つ。合体カードの「分離」で元に戻す。編集は下に出る「DONE」で終える。
 *
 * 並びと合体の状態は親が持つ(店舗の文書 timerGroups に保存する)。この部品は操作だけを受け持つ。
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CheckIcon, GripIcon, PlusIcon } from 'lucide-react'
import { hapticAction, hapticTap } from '@/lib/haptics'

export type MergeItem = { key: string; ids: string[] }

export const MAX_MERGE = 4

type Props = {
  items: MergeItem[]
  editing: boolean
  setEditing: (v: boolean) => void
  /** source を target に合体させる(合計 4 つまで)。 */
  onMerge: (sourceKey: string, targetKey: string) => void
  render: (item: MergeItem, ctx: { editing: boolean; gripProps: React.HTMLAttributes<HTMLElement> }) => React.ReactNode
}

const LONG_PRESS_MS = 500
const DRAG_SLOP = 8

export default function MergeBoard({ items, editing, setEditing, onMerge, render }: Props) {
  const refs = useRef(new Map<string, HTMLDivElement>())
  const press = useRef<number | null>(null)
  const drag = useRef<{ key: string; pointerId: number; startX: number; startY: number; dx: number; dy: number; active: boolean; lastX: number; lastY: number; scroll0: number } | null>(null)
  const autoScroll = useRef<number | null>(null)
  const [dragKey, setDragKey] = useState<string | null>(null)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [target, setTarget] = useState<string | null>(null)
  const [returning, setReturning] = useState<string | null>(null)

  const sizeOf = (k: string) => items.find(i => i.key === k)?.ids.length ?? 0

  // ── つまみの長押しで編集モードへ ──
  const gripProps = (key: string): React.HTMLAttributes<HTMLElement> => ({
    onPointerDown: e => {
      e.stopPropagation()
      if (editing) { startDrag(key, e); return }
      const startX = e.clientX, startY = e.clientY
      press.current = window.setTimeout(() => {
        press.current = null
        hapticAction()
        setEditing(true)
      }, LONG_PRESS_MS)
      const cancel = (ev: PointerEvent) => {
        if (ev.type === 'pointermove' && Math.hypot(ev.clientX - startX, ev.clientY - startY) < DRAG_SLOP) return
        if (press.current) { clearTimeout(press.current); press.current = null }
        window.removeEventListener('pointermove', cancel); window.removeEventListener('pointerup', cancel); window.removeEventListener('pointercancel', cancel)
      }
      window.addEventListener('pointermove', cancel); window.addEventListener('pointerup', cancel); window.addEventListener('pointercancel', cancel)
    },
    onContextMenu: e => e.preventDefault(),
    style: { touchAction: 'none', cursor: editing ? 'grab' : 'pointer' },
  })

  // ── 編集中のドラッグ ──
  const hitTest = useCallback((x: number, y: number, self: string) => {
    for (const [k, el] of refs.current) {
      if (k === self) continue
      const r = el.getBoundingClientRect()
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return k
    }
    return null
  }, [])

  function startDrag(key: string, e: React.PointerEvent) {
    drag.current = { key, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, dx: 0, dy: 0, active: false, lastX: e.clientX, lastY: e.clientY, scroll0: window.scrollY }
  }

  useEffect(() => {
    if (!editing) return
    const move = (e: PointerEvent) => {
      const d = drag.current
      if (!d || e.pointerId !== d.pointerId) return
      d.lastX = e.clientX; d.lastY = e.clientY
      d.dx = e.clientX - d.startX; d.dy = e.clientY - d.startY + (window.scrollY - d.scroll0)
      if (!d.active) {
        if (Math.hypot(d.dx, d.dy) < DRAG_SLOP) return
        d.active = true
        setDragKey(d.key)
        hapticTap()
      }
      e.preventDefault()
      setOffset({ x: d.dx, y: d.dy })
      const hit = hitTest(e.clientX, e.clientY, d.key)
      const ok = hit && sizeOf(hit) + sizeOf(d.key) <= MAX_MERGE ? hit : null
      setTarget(prev => { if (prev !== ok && ok) hapticTap(); return ok })
      // 画面の上下の端に近づいたら、その方向へ少しずつスクロールする
      const edge = 96, h = window.innerHeight
      const speed = e.clientY > h - edge ? (e.clientY - (h - edge)) / 6 : e.clientY < edge ? -(edge - e.clientY) / 6 : 0
      if (autoScroll.current) cancelAnimationFrame(autoScroll.current)
      autoScroll.current = null
      if (speed) {
        const step = () => {
          const dd = drag.current
          if (!dd || !dd.active) return
          window.scrollBy(0, speed)
          dd.dy = dd.lastY - dd.startY + (window.scrollY - dd.scroll0)
          setOffset({ x: dd.dx, y: dd.dy })
          const hit2 = hitTest(dd.lastX, dd.lastY, dd.key)
          setTarget(hit2 && sizeOf(hit2) + sizeOf(dd.key) <= MAX_MERGE ? hit2 : null)
          autoScroll.current = requestAnimationFrame(step)
        }
        autoScroll.current = requestAnimationFrame(step)
      }
    }
    const up = (e: PointerEvent) => {
      const d = drag.current
      if (!d || e.pointerId !== d.pointerId) return
      drag.current = null
      if (autoScroll.current) { cancelAnimationFrame(autoScroll.current); autoScroll.current = null }
      if (!d.active) return
      const hit = hitTest(e.clientX, e.clientY, d.key)
      if (hit && sizeOf(hit) + sizeOf(d.key) <= MAX_MERGE) {
        hapticAction()
        onMerge(d.key, hit)
        setDragKey(null); setOffset({ x: 0, y: 0 }); setTarget(null)
        return
      }
      // 重ならなかったら元の場所へ戻す(戻る動きだけ付ける)
      setReturning(d.key); setTarget(null); setOffset({ x: 0, y: 0 })
      window.setTimeout(() => { setReturning(null); setDragKey(null) }, 320)
    }
    window.addEventListener('pointermove', move, { passive: false })
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, items, hitTest, onMerge])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {items.map((item, i) => {
        const isDrag = dragKey === item.key
        const isTarget = target === item.key
        return (
          <div key={item.key}
            ref={el => { if (el) refs.current.set(item.key, el); else refs.current.delete(item.key) }}
            className={editing && !isDrag ? 'mb-jiggle' : undefined}
            onPointerDown={editing ? e => { if ((e.target as HTMLElement).closest('button,a,input')) return; startDrag(item.key, e) } : undefined}
            style={{
              position: 'relative',
              touchAction: editing ? 'none' : undefined,
              transform: isDrag ? `translate(${offset.x}px, ${offset.y}px) scale(${target ? 0.92 : 1.03})` : undefined,
              opacity: isDrag && target ? 0.85 : 1,
              transition: isDrag && returning !== item.key ? 'opacity 0.15s ease' : 'transform 0.3s cubic-bezier(0.2, 0.9, 0.3, 1)',
              zIndex: isDrag ? 50 : undefined,
              filter: isDrag ? 'drop-shadow(0 16px 32px rgba(0,0,0,0.18))' : undefined,
              animationDelay: `${(i % 3) * -0.09}s`,
              userSelect: editing ? 'none' : undefined,
            }}>
            {render(item, { editing, gripProps: gripProps(item.key) })}
            {/* 重ねた先に「+」 */}
            {isTarget && (
              <div aria-hidden="true" style={{ position: 'absolute', inset: 0, borderRadius: 16, border: '2px solid #1546D9', background: 'rgba(21,70,217,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 60 }}>
                <span style={{ width: 64, height: 64, borderRadius: 32, background: '#1546D9', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(21,70,217,0.4)' }}>
                  <PlusIcon size={32} color="#fff" strokeWidth={3} />
                </span>
              </div>
            )}
          </div>
        )
      })}

      {editing && typeof document !== 'undefined' && createPortal(
        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 'calc(env(safe-area-inset-bottom, 0px) + 112px)', display: 'flex', justifyContent: 'center', zIndex: 1200, pointerEvents: 'none' }}>
          <div style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 16, padding: '8px 8px 8px 24px', borderRadius: 999, background: 'rgba(28,28,30,0.86)', backdropFilter: 'blur(20px)', color: '#fff' }}>
            <span className="tech-label" style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'none' }}>$ merge --drag-onto-another</span>
            <button type="button" onClick={() => setEditing(false)} className="gl-press"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 44, padding: '0 16px', borderRadius: 999, border: 'none', background: '#1546D9', color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
              <CheckIcon size={16} /> DONE
            </button>
          </div>
        </div>,
        document.body,
      )}

      <style>{`
        @keyframes mbJiggle { 0% { transform: rotate(-0.7deg) } 50% { transform: rotate(0.7deg) } 100% { transform: rotate(-0.7deg) } }
        .mb-jiggle { animation: mbJiggle 0.26s ease-in-out infinite; transform-origin: 50% 40%; }
        @media (prefers-reduced-motion: reduce) {
          .mb-jiggle { animation: none; outline: 2px dashed rgba(21,70,217,0.5); outline-offset: 4px; border-radius: 16px; }
        }
      `}</style>
    </div>
  )
}

/** カード右上のつまみ。長押しで編集モード、編集中はここからもつかめる。 */
export function MergeGrip({ gripProps }: { gripProps: React.HTMLAttributes<HTMLElement> }) {
  return (
    <span role="button" tabIndex={0} aria-label="長押しで並べ替え・合体" {...gripProps}
      style={{ ...(gripProps.style ?? {}), display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 32, margin: '-8px -8px -8px 0', color: '#1546D9', flexShrink: 0 }}>
      <GripIcon size={18} />
    </span>
  )
}
