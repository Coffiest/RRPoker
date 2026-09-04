'use client'

import { useState } from 'react'
import { FiUser } from 'react-icons/fi'
import ChipDisclaimer from '@/components/ChipDisclaimer'

/**
 * ディーラーが対面から読んで承認するための確認シート。
 *
 * プレイヤーが自分の端末で「リエントリーする」を押すと、卓を挟んで向かいに座る
 * ディーラーへ端末を見せる。そのため中身ごと180度回してある。プレイヤー側からは
 * 上下逆さまに見えるが、これは意図した向きで、読む相手はディーラーのほう。
 *
 * 承認そのものに技術的な鍵は無い(押そうと思えばプレイヤーにも押せる)。
 * 運用上の抑止として、確定した1件は店舗のトーナメントカードへ即座に出て、
 * その場で取り消せるようにしてある。
 */

export type DealerConfirmProps = {
  /** 何をするのか。「リエントリー」「アドオン」など。 */
  title: string
  /** 引かれるチップ数。符号は内側で付ける。 */
  amount: number
  /** チップの単位表記(店舗ごとの設定)。 */
  unitLabel: string
  /** 単位を数字の前に出すか。 */
  unitBefore: boolean
  playerName: string
  playerIconUrl?: string | null
  onApprove: () => Promise<void> | void
  onCancel: () => void
}

export default function DealerConfirmSheet({
  title,
  amount,
  unitLabel,
  unitBefore,
  playerName,
  playerIconUrl,
  onApprove,
  onCancel,
}: DealerConfirmProps) {
  const [busy, setBusy] = useState(false)

  const formatted = unitBefore
    ? `${unitLabel}${amount.toLocaleString()}`
    : `${amount.toLocaleString()}${unitLabel}`

  const handleApprove = async () => {
    if (busy) return
    setBusy(true)
    try {
      await onApprove()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
      onClick={busy ? undefined : onCancel}
    >
      {/* ここから内側が反転する。ディーラーが対面から読む向き。 */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          transform: 'rotate(180deg)',
          width: '100%', maxWidth: 340,
          background: '#fff', borderRadius: 22, overflow: 'hidden',
          boxShadow: '0 18px 50px rgba(0,0,0,0.28)',
        }}
      >
        {/* 上端の金の線。店舗側の面と同じ意匠。 */}
        <div style={{
          height: 3,
          background: 'linear-gradient(90deg, transparent, #F2A900 40%, #FFE07A 50%, #F2A900 60%, transparent)',
        }} />

        <div style={{ padding: '18px 20px 20px' }}>
          <p className="tech-label" style={{ fontSize: 9, color: 'rgba(60,60,67,0.45)', letterSpacing: '0.2em', textAlign: 'center' }}>
            ディーラー確認
          </p>

          {/* 誰の操作か。卓で複数の端末を扱うときに取り違えないため。 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 14 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10, overflow: 'hidden', flexShrink: 0,
              background: '#F2F2F7', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {playerIconUrl
                ? <img src={playerIconUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <FiUser size={16} style={{ color: '#C7C7CC' }} />}
            </div>
            <p style={{
              fontFamily: 'var(--stack-mono)', fontSize: 14, fontWeight: 700, color: '#1C1C1E',
              minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{playerName}</p>
          </div>

          <div className="tech-rule" style={{ margin: '16px 0' }} />

          {/* 名目とチップ数 */}
          <p className="tech-label tech-label-bracket" style={{ fontSize: 10, color: 'rgba(60,60,67,0.5)', textAlign: 'center', marginBottom: 8 }}>
            {title}
          </p>
          <p className="tech-num" style={{
            textAlign: 'center', fontSize: 38, fontWeight: 800, lineHeight: 1,
            letterSpacing: '-1px', color: '#1C1C1E',
          }}>
            −{formatted}
          </p>

          {/* 引き落としの数字がいちばん現金に見える場所なので、ここに置く。 */}
          <div style={{ marginTop: 14, textAlign: 'center' }}>
            <ChipDisclaimer />
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              className="con-btn"
              style={{
                flex: 1, height: 50, borderRadius: 14, background: '#F2F2F7', border: 'none',
                fontSize: 13, fontWeight: 700, color: '#3C3C43', cursor: busy ? 'default' : 'pointer',
                opacity: busy ? 0.5 : 1,
              }}
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={handleApprove}
              disabled={busy}
              className="con-btn"
              style={{
                flex: 1, height: 50, borderRadius: 14, border: 'none',
                background: 'linear-gradient(135deg,#F2A900,#D4910A)',
                fontSize: 13, fontWeight: 800, color: '#fff', cursor: busy ? 'default' : 'pointer',
                boxShadow: '0 4px 14px rgba(242,169,0,0.38)',
                opacity: busy ? 0.6 : 1,
              }}
            >
              {busy ? '処理中' : '承認'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
