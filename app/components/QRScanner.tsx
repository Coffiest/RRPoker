'use client'

import { useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'
import { FiX } from 'react-icons/fi'

interface Props {
  onScan: (uid: string) => void
  onClose: () => void
}

export default function QRScanner({ onScan, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scannedRef = useRef(false)
  const [error, setError] = useState<string | null>(null)

  const stopCamera = () => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    if (videoRef.current) { videoRef.current.srcObject = null }
  }

  useEffect(() => {
    let active = true

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        })
        if (!active) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream

        const video = videoRef.current
        if (!video) { stream.getTracks().forEach(t => t.stop()); return }
        video.srcObject = stream
        video.setAttribute('playsinline', 'true')
        await video.play()

        function tick() {
          if (!active || scannedRef.current) return
          const v = videoRef.current
          const c = canvasRef.current
          if (!v || !c || v.readyState < v.HAVE_ENOUGH_DATA) {
            rafRef.current = requestAnimationFrame(tick)
            return
          }
          c.width = v.videoWidth
          c.height = v.videoHeight
          const ctx = c.getContext('2d', { willReadFrequently: true })
          if (!ctx) { rafRef.current = requestAnimationFrame(tick); return }
          ctx.drawImage(v, 0, 0, c.width, c.height)
          const imgData = ctx.getImageData(0, 0, c.width, c.height)
          // 'attemptBoth' handles overexposed screens (PC monitors) where QR can appear inverted
          const code = jsQR(imgData.data, imgData.width, imgData.height, { inversionAttempts: 'attemptBoth' })
          if (code?.data.startsWith('rrpoker:checkin:')) {
            const uid = code.data.slice('rrpoker:checkin:'.length)
            if (uid) {
              scannedRef.current = true
              stopCamera() // Stop immediately before calling onScan
              onScan(uid)
              return
            }
          }
          rafRef.current = requestAnimationFrame(tick)
        }
        rafRef.current = requestAnimationFrame(tick)
      } catch {
        if (active) setError('カメラへのアクセスが許可されていません')
      }
    }

    start()

    return () => {
      active = false
      stopCamera()
    }
  }, [onScan]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="fixed inset-0 z-[300]" style={{ background: '#000' }}>
      <style>{`
        @keyframes scan-frame-pulse {
          0%,100% { opacity: 0.6; }
          50%      { opacity: 1; }
        }
        @keyframes scan-beam {
          0%   { transform: translateY(0); opacity: 1; }
          90%  { transform: translateY(236px); opacity: 1; }
          100% { transform: translateY(0); opacity: 0; }
        }
      `}</style>

      <video
        ref={videoRef}
        playsInline
        muted
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
      />
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Dark overlay with cutout */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 'calc(50% + 120px)', background: 'rgba(0,0,0,0.6)' }} />
        <div style={{ position: 'absolute', top: 'calc(50% + 120px)', left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)' }} />
        <div style={{ position: 'absolute', top: 'calc(50% - 120px)', left: 0, width: 'calc(50% - 120px)', height: 240, background: 'rgba(0,0,0,0.6)' }} />
        <div style={{ position: 'absolute', top: 'calc(50% - 120px)', right: 0, width: 'calc(50% - 120px)', height: 240, background: 'rgba(0,0,0,0.6)' }} />
        {[
          { top: 'calc(50% - 120px)', left: 'calc(50% - 120px)', borderTop: '3px solid #F2A900', borderLeft: '3px solid #F2A900' },
          { top: 'calc(50% - 120px)', right: 'calc(50% - 120px)', borderTop: '3px solid #F2A900', borderRight: '3px solid #F2A900' },
          { bottom: 'calc(50% - 120px)', left: 'calc(50% - 120px)', borderBottom: '3px solid #F2A900', borderLeft: '3px solid #F2A900' },
          { bottom: 'calc(50% - 120px)', right: 'calc(50% - 120px)', borderBottom: '3px solid #F2A900', borderRight: '3px solid #F2A900' },
        ].map((s, i) => (
          <div key={i} style={{ position: 'absolute', width: 28, height: 28, animation: 'scan-frame-pulse 2s ease-in-out infinite', ...s }} />
        ))}
        <div style={{ position: 'absolute', top: 'calc(50% - 120px)', left: 'calc(50% - 120px)', width: 240, height: 2, background: 'linear-gradient(90deg, transparent, #F2A900, transparent)', animation: 'scan-beam 2s ease-in-out infinite', borderRadius: 2 }} />
      </div>

      {/* Header */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '52px 20px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div/>
        <p style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>QRスキャン</p>
        <button type="button" onClick={() => { stopCamera(); onClose() }}
          style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)' }}
        >
          <FiX size={18} style={{ color: '#fff' }} />
        </button>
      </div>

      {/* Instructions */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '20px 24px 48px', textAlign: 'center' }}>
        {error ? (
          <p style={{ fontSize: 14, color: '#FF3B30', fontWeight: 600 }}>{error}</p>
        ) : (
          <>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 6 }}>プレイヤーのQRコードを枠内に合わせてください</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>自動的に読み取られます</p>
          </>
        )}
      </div>
    </div>
  )
}
