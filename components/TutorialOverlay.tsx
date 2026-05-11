'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'

export interface TutorialStep {
  target: string
  title: string
  body: string
  spotlightPadding?: number
  spotlightRadius?: number
}

interface SpotlightRect {
  x: number
  y: number
  width: number
  height: number
  rx: number
}

interface TooltipPos {
  top?: number
  bottom?: number
}

interface Props {
  steps: TutorialStep[]
  onDone: () => void
  onSkip: () => void
}

export default function TutorialOverlay({ steps, onDone, onSkip }: Props) {
  const [currentStep, setCurrentStep] = useState(0)
  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null)
  const [tooltipPos, setTooltipPos] = useState<TooltipPos | null>(null)
  const [show, setShow] = useState(false)

  useEffect(() => {
    let aborted = false
    setShow(false)
    setSpotlight(null)
    setTooltipPos(null)

    ;(async () => {
      const s = steps[currentStep]
      if (!s) return

      if (currentStep === 0) await new Promise(r => setTimeout(r, 300))
      if (aborted) return

      const el = document.querySelector(`[data-tutorial="${s.target}"]`) as HTMLElement | null
      if (!el) {
        // No element found: show tooltip centered
        setTooltipPos({ top: Math.round(window.innerHeight * 0.38) })
        setShow(true)
        return
      }

      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      await new Promise(r => setTimeout(r, 400))
      if (aborted) return

      const rect = el.getBoundingClientRect()
      const padding = s.spotlightPadding ?? 12
      const radius = s.spotlightRadius ?? 18

      const sp: SpotlightRect = {
        x: Math.max(4, rect.left - padding),
        y: Math.max(4, rect.top - padding),
        width: rect.width + padding * 2,
        height: rect.height + padding * 2,
        rx: radius,
      }
      setSpotlight(sp)

      const centerY = rect.top + rect.height / 2
      const above = centerY > window.innerHeight * 0.55
      if (above) {
        setTooltipPos({ bottom: window.innerHeight - sp.y + 14 })
      } else {
        setTooltipPos({ top: sp.y + sp.height + 14 })
      }
      setShow(true)
    })()

    return () => { aborted = true }
  }, [currentStep, steps])

  const step = steps[currentStep]
  const isLast = currentStep >= steps.length - 1

  const advance = () => {
    if (isLast) onDone()
    else setCurrentStep(prev => prev + 1)
  }

  if (!step) return null

  return createPortal(
    <>
      <style>{`
        @keyframes tut-fade {
          from { opacity: 0; transform: translateX(-50%) translateY(8px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
      <div style={{ position: 'fixed', inset: 0, zIndex: 9999 }}>

        {/* Dimmed overlay with spotlight cutout */}
        <svg
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1 }}
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <mask id="tut-mask">
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              {spotlight && (
                <rect
                  x={spotlight.x} y={spotlight.y}
                  width={spotlight.width} height={spotlight.height}
                  rx={spotlight.rx} fill="black"
                />
              )}
            </mask>
          </defs>
          <rect x="0" y="0" width="100%" height="100%" fill="rgba(0,0,0,0.62)" mask="url(#tut-mask)" />
        </svg>

        {/* Gold spotlight border */}
        {spotlight && show && (
          <div style={{
            position: 'absolute',
            left: spotlight.x, top: spotlight.y,
            width: spotlight.width, height: spotlight.height,
            borderRadius: spotlight.rx,
            border: '2px solid rgba(242,169,0,0.75)',
            boxShadow: '0 0 0 4px rgba(242,169,0,0.20)',
            pointerEvents: 'none',
            zIndex: 2,
          }} />
        )}

        {/* Tap background to advance */}
        <div style={{ position: 'absolute', inset: 0, zIndex: 3 }} onClick={advance} />

        {/* Tooltip card */}
        {show && (
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position: 'absolute',
              left: '50%',
              transform: 'translateX(-50%)',
              width: 'calc(100% - 48px)',
              maxWidth: 340,
              background: '#fff',
              borderRadius: 22,
              padding: '20px 20px 16px',
              boxShadow: '0 8px 48px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.08)',
              zIndex: 4,
              animation: 'tut-fade 0.28s cubic-bezier(0.22,1,0.36,1) both',
              ...(tooltipPos ?? {}),
            }}
          >
            {/* Step dots */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 5, marginBottom: 16 }}>
              {steps.map((_, i) => (
                <div key={i} style={{
                  width: i === currentStep ? 20 : 6,
                  height: 6,
                  borderRadius: 99,
                  background: i === currentStep ? '#F2A900' : '#E5E5EA',
                  transition: 'all 0.25s ease',
                  flexShrink: 0,
                }} />
              ))}
            </div>

            {/* Title */}
            <p style={{ fontSize: 16, fontWeight: 700, color: '#1C1C1E', marginBottom: 7, lineHeight: 1.3 }}>
              {step.title}
            </p>

            {/* Body */}
            <p style={{ fontSize: 14, color: '#48484A', lineHeight: 1.65, marginBottom: 18 }}>
              {step.body}
            </p>

            {/* Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <button
                type="button"
                onClick={onSkip}
                style={{ fontSize: 13, color: '#8E8E93', background: 'none', border: 'none', cursor: 'pointer', padding: '8px 0', fontFamily: 'inherit', fontWeight: 500 }}
              >
                スキップ
              </button>
              <button
                type="button"
                onClick={advance}
                style={{
                  height: 42,
                  paddingInline: 28,
                  borderRadius: 99,
                  background: 'linear-gradient(135deg,#F2A900,#D4910A)',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 700,
                  fontFamily: 'inherit',
                  boxShadow: '0 3px 14px rgba(242,169,0,0.45)',
                  letterSpacing: '-0.1px',
                }}
              >
                {isLast ? 'はじめる ✓' : '次へ →'}
              </button>
            </div>
          </div>
        )}
      </div>
    </>,
    document.body
  )
}
