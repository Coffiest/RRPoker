'use client'

import { QRCodeSVG } from 'qrcode.react'
import { FiX } from 'react-icons/fi'

interface Props {
  uid: string
  name: string
  iconUrl?: string
  onClose: () => void
}

export default function PlayerQRModal({ uid, name, iconUrl, onClose }: Props) {
  const value = `rrpoker:checkin:${uid}`

  return (
    <div
      className="fixed inset-0 z-[300] flex flex-col justify-end"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <style>{`
        @keyframes qr-sheet-up {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0); opacity: 1; }
        }
        @keyframes qr-scan-line {
          0%   { top: 8px; opacity: 1; }
          90%  { top: calc(100% - 8px); opacity: 1; }
          100% { top: 8px; opacity: 0; }
        }
        .qr-sheet { animation: qr-sheet-up .38s cubic-bezier(.22,1,.36,1) both; }
        .qr-scan-line {
          position: absolute; left: 4px; right: 4px; height: 2px;
          background: linear-gradient(90deg, transparent, #F2A900, transparent);
          animation: qr-scan-line 2.2s ease-in-out infinite;
          border-radius: 2px;
        }
      `}</style>

      {/* Sheet — stop click propagation so tapping inside doesn't close */}
      <div
        className="qr-sheet"
        style={{ background: '#fff', borderRadius: '28px 28px 0 0', padding: '12px 24px 48px' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle bar */}
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(60,60,67,0.18)', margin: '0 auto 20px' }} />

        {/* Title row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(242,169,0,0.1)', border: '1px solid rgba(242,169,0,0.25)', borderRadius: 99, padding: '5px 14px' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#F2A900', display: 'inline-block' }} />
            <span style={{ fontSize: 11, fontWeight: 800, color: '#D4910A', letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>入店QRコード</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(120,120,128,0.12)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <FiX size={16} style={{ color: '#1C1C1E' }} />
          </button>
        </div>

        {/* QR */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
          <div style={{ position: 'relative', padding: 14, background: '#fff', borderRadius: 18, border: '1px solid rgba(0,0,0,0.07)', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
            <QRCodeSVG
              value={value}
              size={220}
              level="M"
              bgColor="#ffffff"
              fgColor="#1C1C1E"
              style={{ display: 'block' }}
            />
            <div className="qr-scan-line" />
          </div>
        </div>

        {/* Player info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#F2F2F7', borderRadius: 16, padding: '12px 16px' }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', border: '2px solid #F2A900', overflow: 'hidden', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {iconUrl
              ? <img src={iconUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ fontSize: 18 }}>👤</span>
            }
          </div>
          <div>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#1C1C1E', letterSpacing: '-0.2px' }}>{name || 'プレイヤー'}</p>
            <p style={{ fontSize: 11, color: 'rgba(60,60,67,0.45)', marginTop: 2 }}>このQRを店舗スタッフに見せてください</p>
          </div>
        </div>
      </div>
    </div>
  )
}
