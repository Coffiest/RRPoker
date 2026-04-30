'use client'

import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { FiX } from 'react-icons/fi'

interface Props {
  onScan: (uid: string) => void
  onClose: () => void
}

export default function QRScanner({ onScan, onClose }: Props) {
  const [error, setError] = useState<string | null>(null)
  const scannedRef = useRef(false)

  useEffect(() => {
    const scanner = new Html5Qrcode('rrpoker-qr-reader')

    // Keep a reference to the start promise so cleanup can wait for it
    const startPromise = scanner
      .start(
        { facingMode: 'environment' },
        { fps: 12, qrbox: { width: 240, height: 240 }, aspectRatio: 1.0 },
        (decoded) => {
          if (scannedRef.current) return
          if (decoded.startsWith('rrpoker:checkin:')) {
            const uid = decoded.slice('rrpoker:checkin:'.length)
            if (!uid) return
            scannedRef.current = true
            scanner.stop().catch(() => {}).finally(() => onScan(uid))
          }
        },
        () => {}
      )
      .catch(() => {
        setError('カメラへのアクセスが許可されていません')
        return null
      })

    return () => {
      // Wait for start() to complete before calling stop()
      startPromise.then((result) => {
        if (result === null) return // start failed, nothing to stop
        if (scannedRef.current) return // already stopped by onScan path
        scanner.stop().catch(() => {})
      })
    }
  }, [onScan])

  return (
    <div className="fixed inset-0 z-[300]" style={{ background: '#000' }}>
      <style>{`
        #rrpoker-qr-reader video { object-fit: cover !important; width: 100% !important; height: 100% !important; }
        #rrpoker-qr-reader { width: 100% !important; height: 100dvh !important; overflow: hidden; }
        #rrpoker-qr-reader img, #rrpoker-qr-reader button, #rrpoker-qr-reader select,
        #rrpoker-qr-reader #rrpoker-qr-reader__dashboard { display: none !important; }
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

      {/* Camera view */}
      <div id="rrpoker-qr-reader" style={{ position: 'absolute', inset: 0 }} />

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
        <button type="button" onClick={onClose}
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
