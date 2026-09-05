'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

/**
 * 下から出る面。指で掴んで下げられ、投げれば飛び、途中で掴み返せる。
 *
 * ここだけは CSS のトランジションで書けない。トランジションは「今どこにいるか」
 * ではなく「どこから始めるか」を決め打ちするため、動いている最中に掴むと必ず
 * 跳ねる。指の速度を受け取ることもできない。so、位置はスプリングを毎フレーム
 * 積分して自分で持ち、DOM へ直接書く。React の state に入れると 60fps で
 * 再描画が走るので入れない。
 *
 * 実装している約束(.claude/skills/apple-design/SKILL.md):
 *  - 掴んだ位置からのずれを保つ(面の中央へ吸い付かせない)
 *  - 上端より上へは引けない。引くほど付いてこなくなる(ラバーバンド)
 *  - 離した瞬間の速度で、止まる位置を先に計算してから行き先を決める
 *  - 行き先へ向かうスプリングに、その速度をそのまま渡す(継ぎ目を作らない)
 *  - 動いている最中に掴んでも、今の位置と今の速度から続ける
 */

/** 慣性の投射。指を離した速度から、止まる位置を先に求める。 */
function project(velocity: number, decelerationRate = 0.998) {
  return (velocity / 1000) * decelerationRate / (1 - decelerationRate)
}

/** 境界の外側。引くほど付いてこなくする。 */
function rubberband(overshoot: number, dimension: number, constant = 0.55) {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot))
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

type Props = {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  /** シート上部に固定で出す見出し。スクロールしても動かない。 */
  title?: React.ReactNode
  /** 下端に固定で出す操作。本文の長さに関係なく常に押せる。 */
  footer?: React.ReactNode
  /** 画面の高さに対する上限。既定は 88%。 */
  maxHeightVh?: number
  /** 面の最大幅。既定は 420px。 */
  maxWidth?: number
  /** 重なり順。呼び出し側で必要なら上げる。 */
  zIndex?: number
}

export default function AppleSheet({
  open,
  onClose,
  children,
  title,
  footer,
  maxHeightVh = 88,
  maxWidth = 420,
  zIndex = 100,
}: Props) {
  const sheetRef = useRef<HTMLDivElement | null>(null)
  const scrimRef = useRef<HTMLDivElement | null>(null)
  const bodyRef = useRef<HTMLDivElement | null>(null)

  // 面が閉じきるまで DOM に残す。閉じる動きの途中で消してしまわないため。
  const [mounted, setMounted] = useState(open)

  // 位置と速度。描画のたびに読み書きするので ref に置く。
  const y = useRef(0)
  const v = useRef(0)
  const raf = useRef<number | null>(null)
  const height = useRef(0)

  // ドラッグ中の状態。
  const dragging = useRef(false)
  const grabOffset = useRef(0)
  /** 直近数点の (時刻, 位置)。離す瞬間の速度をここから出す。 */
  const history = useRef<{ t: number; y: number }[]>([])

  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  /** 位置を DOM に書く。スクリムの濃さも位置に連れて薄くする。 */
  const paint = useCallback(() => {
    const el = sheetRef.current
    if (!el) return
    el.style.transform = `translate3d(0, ${y.current}px, 0)`
    const s = scrimRef.current
    if (s && height.current > 0) {
      const p = Math.min(1, Math.max(0, y.current / height.current))
      s.style.opacity = String(1 - p)
    }
  }, [])

  const stop = useCallback(() => {
    if (raf.current != null) cancelAnimationFrame(raf.current)
    raf.current = null
  }, [])

  /**
   * 今いる場所・今の速度から目標へ向かうスプリング。
   * 動いている最中に呼び直しても、位置と速度は引き継がれる。
   */
  const springTo = useCallback(
    (target: number, opts?: { velocity?: number; onRest?: () => void; bounce?: boolean }) => {
      stop()
      if (opts?.velocity != null) v.current = opts.velocity

      if (prefersReducedMotion()) {
        y.current = target
        v.current = 0
        paint()
        opts?.onRest?.()
        return
      }

      // damping 1.0 / response 0.4 を既定にする。掴んで投げた時だけ少し跳ねさせる。
      const response = opts?.bounce ? 0.34 : 0.4
      const zeta = opts?.bounce ? 0.82 : 1.0
      const omega = (2 * Math.PI) / response

      let last = performance.now()
      const step = (now: number) => {
        // タブが戻ってきた直後に大きく飛ばないよう、1フレーム分に丸める。
        const dt = Math.min((now - last) / 1000, 1 / 30)
        last = now

        const x = y.current - target
        const a = -omega * omega * x - 2 * zeta * omega * v.current
        v.current += a * dt
        y.current += v.current * dt

        // 目標に十分近く、かつ十分遅くなったら止める。
        if (Math.abs(y.current - target) < 0.4 && Math.abs(v.current) < 12) {
          y.current = target
          v.current = 0
          paint()
          raf.current = null
          opts?.onRest?.()
          return
        }
        paint()
        raf.current = requestAnimationFrame(step)
      }
      raf.current = requestAnimationFrame(step)
    },
    [paint, stop],
  )

  const dismiss = useCallback(
    (velocity = 0) => {
      const h = height.current || window.innerHeight
      springTo(h, { velocity, onRest: () => onCloseRef.current() })
    },
    [springTo],
  )

  // 開閉。開いたら下から立ち上げ、閉じたら下へ送る。
  useEffect(() => {
    if (open) setMounted(true)
    else if (mounted) dismiss(0)
  }, [open, mounted, dismiss])

  useLayoutEffect(() => {
    if (!mounted || !open) return
    const el = sheetRef.current
    if (!el) return
    height.current = el.offsetHeight
    y.current = height.current
    v.current = 0
    paint()
    // 一拍おいてから立ち上げる。初期位置が確実に描かれてから動かすため。
    const id = requestAnimationFrame(() => springTo(0, { velocity: 0 }))
    return () => cancelAnimationFrame(id)
  }, [mounted, open, paint, springTo])

  useEffect(() => stop, [stop])

  // 背後のスクロールを止める。面が動く間に下が動くと、掴んでいる感じが壊れる。
  useEffect(() => {
    if (!mounted) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [mounted])

  // Esc で閉じる。
  useEffect(() => {
    if (!mounted) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') dismiss(0) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mounted, dismiss])

  /* ---- ジェスチャー -------------------------------------------------- */

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return
    // 本文を上に送っている途中は、面ではなく本文を動かす。
    const body = bodyRef.current
    const fromBody = body?.contains(e.target as Node)
    if (fromBody && body && body.scrollTop > 0) return

    // 動いている最中でも掴める。今の位置をそのまま引き継ぐ。
    stop()
    dragging.current = true
    grabOffset.current = e.clientY - y.current   // 掴んだ場所からのずれを保つ
    history.current = [{ t: performance.now(), y: y.current }]
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return
    let next = e.clientY - grabOffset.current

    // 上端より上へは引けない。引くほど付いてこなくする。
    if (next < 0) next = -rubberband(-next, height.current || window.innerHeight)

    y.current = next
    paint()

    const t = performance.now()
    history.current.push({ t, y: next })
    // 直近 100ms だけ残す。古い点を混ぜると速度がなまる。
    while (history.current.length > 2 && t - history.current[0].t > 100) history.current.shift()
  }

  const endDrag = (e: React.PointerEvent) => {
    if (!dragging.current) return
    dragging.current = false
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId) } catch {}

    // 離した瞬間の速度(px/s)。
    const h = history.current
    const first = h[0]
    const last = h[h.length - 1]
    const dt = last && first ? (last.t - first.t) / 1000 : 0
    const velocity = dt > 0 ? (last.y - first.y) / dt : 0

    // 止まる位置を先に求めてから、行き先を決める。
    const projected = y.current + project(velocity)
    const sheetH = height.current || window.innerHeight

    if (projected > sheetH * 0.42) dismiss(velocity)
    else springTo(0, { velocity, bounce: Math.abs(velocity) > 320 })
  }

  if (!mounted) return null

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex }}>
      <div
        ref={scrimRef}
        className="a-scrim"
        onClick={() => dismiss(0)}
        style={{ position: 'absolute', inset: 0 }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}
      >
        <div
          ref={sheetRef}
          className="a-sheet"
          style={{
            pointerEvents: 'auto',
            width: '100%',
            maxWidth,
            maxHeight: `${maxHeightVh}vh`,
            display: 'flex',
            flexDirection: 'column',
            willChange: 'transform',
            touchAction: 'none',
            animation: 'none',   // 位置はスプリングが持つ
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <div className="a-grabber" />
          {title != null && (
            <div style={{ flexShrink: 0, padding: '16px 20px 12px' }}>{title}</div>
          )}
          <div
            ref={bodyRef}
            className="a-edge-bottom"
            style={{
              position: 'relative',
              flex: 1,
              overflowY: 'auto',
              overscrollBehavior: 'contain',
              padding: '0 20px',
              touchAction: 'pan-y',
            }}
          >
            {children}
          </div>
          {footer != null && (
            <div
              style={{
                flexShrink: 0,
                padding: '12px 20px calc(14px + max(0px, env(safe-area-inset-bottom)))',
                borderTop: '1px solid var(--a-sep)',
                background: 'var(--a-surface)',
              }}
            >
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
