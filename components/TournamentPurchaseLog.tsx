'use client'

import { useEffect, useState } from 'react'
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { revertTournamentPurchase } from '@/lib/tournamentEntryActions'

/**
 * その大会で確定したリエントリー / アドオンの一覧と、その取消。
 *
 * プレイヤーの端末から確定できるようにしたぶん、店舗側が「いま何が起きたか」を
 * 必ず見られる場所が要る。承認そのものには技術的な鍵が無いので、間違いや
 * 不正があったときに、その場で取り消せることが歯止めになる。
 *
 * 卓を回している店員がいちばん見る場所ということで、店舗ホームの
 * 該当トーナメントカードの中に置く。
 */

type Row = {
  id: string
  playerName: string | null
  type: string
  amount: number
  createdAtMs: number | null
  revoked: boolean
  source: string | null
}

const LABEL: Record<string, string> = {
  store_tournament_reentry: 'リエントリー',
  store_tournament_addon: 'アドオン',
}

/** 直近何件まで出すか。卓の運用で遡るのはせいぜい直近なので、これで足りる。 */
const MAX_ROWS = 20

export default function TournamentPurchaseLog({
  tournamentId,
  storeId,
  canRevoke,
  unitLabel,
  unitBefore,
}: {
  tournamentId: string
  storeId: string
  /** 大会が終わったら取り消せなくする。 */
  canRevoke: boolean
  unitLabel: string
  unitBefore: boolean
}) {
  const [rows, setRows] = useState<Row[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const q = query(
      collection(db, 'transactions'),
      where('tournamentId', '==', tournamentId),
      where('type', 'in', ['store_tournament_reentry', 'store_tournament_addon']),
      orderBy('createdAt', 'desc'),
      limit(MAX_ROWS),
    )
    const unsub = onSnapshot(q, snap => {
      const next: Row[] = []
      snap.forEach(d => {
        const v = d.data()
        next.push({
          id: d.id,
          playerName: v.playerName ?? null,
          type: v.type,
          amount: Number(v.amount ?? 0),
          createdAtMs: v.createdAt?.toMillis?.() ?? null,
          revoked: Boolean(v.revokedAt),
          source: v.source ?? null,
        })
      })
      setRows(next)
    }, () => setRows([]))
    return () => unsub()
  }, [tournamentId, storeId])

  if (rows.length === 0) return null

  const fmt = (n: number) =>
    unitBefore ? `${unitLabel}${n.toLocaleString()}` : `${n.toLocaleString()}${unitLabel}`

  const revoke = async (id: string) => {
    setBusyId(id)
    setError(null)
    try {
      const result = await revertTournamentPurchase(id)
      if (!result.ok && result.reason !== 'already_revoked') {
        setError('取り消せませんでした')
      }
    } catch {
      setError('取り消せませんでした')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div style={{ marginTop: 12 }}>
      <p className="section-hd" style={{ marginBottom: 8 }}>リエントリー / アドオン</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {rows.map(row => (
          <div
            key={row.id}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 11px', borderRadius: 10,
              background: row.revoked ? 'transparent' : '#F2F2F7',
              border: row.revoked ? '1px dashed rgba(60,60,67,0.18)' : '1px solid transparent',
              opacity: row.revoked ? 0.5 : 1,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                fontFamily: 'var(--stack-mono)', fontSize: 12, fontWeight: 700, color: 'var(--label)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                textDecoration: row.revoked ? 'line-through' : 'none',
              }}>
                {row.playerName || 'プレイヤー'}
              </p>
              <p className="tech-label" style={{ fontSize: 8.5, color: 'var(--label3)', marginTop: 2 }}>
                {LABEL[row.type] ?? row.type}
                {row.createdAtMs
                  ? ` · ${new Date(row.createdAtMs).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}`
                  : ''}
                {row.revoked ? ' · 取消済み' : ''}
              </p>
            </div>

            <span className="tech-num" style={{
              fontSize: 12, fontWeight: 700, color: row.revoked ? 'var(--label3)' : '#FF3B30', flexShrink: 0,
            }}>
              −{fmt(row.amount)}
            </span>

            {canRevoke && !row.revoked && (
              <button
                type="button"
                onClick={() => void revoke(row.id)}
                disabled={busyId === row.id}
                className="con-btn"
                style={{
                  flexShrink: 0, height: 30, padding: '0 11px', borderRadius: 8,
                  background: 'rgba(255,59,48,0.09)', border: '1px solid rgba(255,59,48,0.2)',
                  color: '#FF3B30', fontSize: 10, fontWeight: 700, cursor: 'pointer',
                  opacity: busyId === row.id ? 0.5 : 1,
                }}
              >
                取消
              </button>
            )}
          </div>
        ))}
      </div>

      {error && (
        <p style={{ fontSize: 11, color: '#FF3B30', marginTop: 6 }}>{error}</p>
      )}
    </div>
  )
}
