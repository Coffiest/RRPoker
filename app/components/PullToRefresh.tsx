'use client'

import { useEffect, useRef, useState } from 'react'

const THRESHOLD = 72
const MAX_PULL = 110

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    ('standalone' in window.navigator && (window.navigator as any).standalone === true) ||
    window.matchMedia('(display-mode: standalone)').matches
  )
}

export default function PullToRefresh({ onRefresh }: { onRefresh: () => void }) {
  const [pullY, setPullY] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const startYRef = useRef<number | null>(null)
  const pullingRef = useRef(false)

  useEffect(() => {
    if (!isStandalone()) return

    const onTouchStart = (e: TouchEvent) => {
      if (window.scrollY > 0) return
      startYRef.current = e.touches[0].clientY
      pullingRef.current = true
    }

    const onTouchMove = (e: TouchEvent) => {
      if (!pullingRef.current || startYRef.current === null) return
      const dy = e.touches[0].clientY - startYRef.current
      if (dy <= 0) { setPullY(0); return }
      e.preventDefault()
      setPullY(Math.min(dy * 0.5, MAX_PULL))
    }

    const onTouchEnd = async () => {
      if (!pullingRef.current) return
      pullingRef.current = false
      if (pullY >= THRESHOLD) {
        setRefreshing(true)
        setPullY(THRESHOLD)
        await new Promise<void>(resolve => { onRefresh(); setTimeout(resolve, 800) })
        setRefreshing(false)
      }
      setPullY(0)
      startYRef.current = null
    }

    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('touchend', onTouchEnd)
    return () => {
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
    }
  }, [pullY, onRefresh])

  if (!isStandalone() || (pullY === 0 && !refreshing)) return null

  const progress = Math.min(pullY / THRESHOLD, 1)
  const ready = pullY >= THRESHOLD

  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        height: pullY + 48,
        pointerEvents: 'none',
        transition: pullY === 0 ? 'height 0.3s ease' : 'none',
      }}
    >
      <div style={{
        marginBottom: 12,
        width: 36, height: 36, borderRadius: '50%',
        background: ready ? 'linear-gradient(135deg,#F2A900,#D4910A)' : 'rgba(242,169,0,0.12)',
        border: `2px solid ${ready ? '#F2A900' : 'rgba(242,169,0,0.25)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background 0.2s, border-color 0.2s',
        boxShadow: ready ? '0 4px 14px rgba(242,169,0,0.3)' : 'none',
      }}>
        {refreshing ? (
          <div style={{
            width: 18, height: 18, borderRadius: '50%',
            border: '2.5px solid rgba(255,255,255,0.3)',
            borderTopColor: '#fff',
            animation: 'spin 0.7s linear infinite',
          }} />
        ) : (
          <svg
            width="16" height="16" viewBox="0 0 16 16" fill="none"
            style={{
              transform: `rotate(${progress * 180}deg) ${ready ? 'scale(1.1)' : ''}`,
              transition: 'transform 0.15s ease',
            }}
          >
            <path d="M8 2v10M4 9l4 4 4-4" stroke={ready ? '#fff' : '#F2A900'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
    </div>
  )
}
