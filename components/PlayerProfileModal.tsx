'use client'

import { useEffect, useState } from 'react'
import { db } from '@/lib/firebase'
import { doc, getDoc, getDocs, collection } from 'firebase/firestore'
import { FiUser } from 'react-icons/fi'

type PlayerData = {
  name?: string
  iconUrl?: string
  playerId?: string
  rrRating?: number
  region?: string
  favoriteHand?: string
  pokerHistory?: string
}

type Stats = {
  plays: number
  itmCount: number
  totalCost: number
  totalReward: number
}

type Props = {
  uid: string | null
  onClose: () => void
}

function calcStats(docs: any[]): Stats {
  let plays = 0, itmCount = 0, totalCost = 0, totalReward = 0
  docs.forEach(item => {
    const ec = item.entryCount ?? 0, rc = item.reentryCount ?? 0, ac = item.addonCount ?? 0
    const ef = item.entryFee ?? 0, rf = item.reentryFee ?? 0, af = item.addonFee ?? 0
    const prize = item.prize ?? 0
    const rank = item.rank
    const buyin = ec * ef + rc * rf + ac * af
    const base = ef > 0 ? ef : rf > 0 ? rf : af
    totalCost += base > 0 ? buyin / base : 0
    totalReward += base > 0 ? prize / base : 0
    plays++
    if (typeof rank === 'number' && prize > 0) itmCount++
  })
  return { plays, itmCount, totalCost, totalReward }
}

export default function PlayerProfileModal({ uid, onClose }: Props) {
  const [loading, setLoading] = useState(true)
  const [player, setPlayer] = useState<PlayerData | null>(null)
  const [stats, setStats] = useState<Stats>({ plays: 0, itmCount: 0, totalCost: 0, totalReward: 0 })

  useEffect(() => {
    if (!uid) return
    setLoading(true)
    setPlayer(null)
    setStats({ plays: 0, itmCount: 0, totalCost: 0, totalReward: 0 })

    const load = async () => {
      try {
        const [userSnap, histSnap] = await Promise.all([
          getDoc(doc(db, 'users', uid)),
          getDocs(collection(db, 'users', uid, 'tournamentHistory')),
        ])
        const data = userSnap.data() ?? {}
        setPlayer({
          name: data.name,
          iconUrl: data.iconUrl,
          playerId: data.playerId,
          rrRating: typeof data.rrRating === 'number' ? data.rrRating : undefined,
          region: data.region,
          favoriteHand: data.favoriteHand,
          pokerHistory: data.pokerHistory,
        })
        const docs = histSnap.docs.map(d => d.data())
        setStats(calcStats(docs))
      } catch { /* ignore */ } finally {
        setLoading(false)
      }
    }
    void load()
  }, [uid])

  if (!uid) return null

  const itmRate = stats.plays > 0 ? (stats.itmCount / stats.plays * 100).toFixed(1) : null
  const roi = stats.totalCost > 0
    ? ((stats.totalReward / stats.totalCost) * 100).toFixed(1)
    : null

  // RR Rating 表示（45未満はマスク）
  const rr = player?.rrRating
  const rrDisplay = rr !== undefined
    ? rr < 45 ? '< 45' : rr.toFixed(2)
    : '—'

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 500,
        background: 'rgba(0,0,0,0.45)',
        backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%', maxWidth: 440,
          background: '#fff',
          borderRadius: '24px 24px 0 0',
          maxHeight: '88vh',
          display: 'flex', flexDirection: 'column',
          paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* ドラッグハンドル */}
        <div style={{ width: 36, height: 4, borderRadius: 99, background: '#D1D1D6', margin: '12px auto 0', flexShrink: 0 }} />

        <div style={{ overflowY: 'auto', flex: 1, padding: '20px 24px 8px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '56px 0' }}>
              <p style={{ fontSize: 13, color: '#8E8E93' }}>読み込み中…</p>
            </div>
          ) : player === null ? (
            <div style={{ textAlign: 'center', padding: '56px 0' }}>
              <p style={{ fontSize: 13, color: '#8E8E93' }}>プレイヤー情報を取得できませんでした</p>
            </div>
          ) : (
            <>
              {/* ── アバター + 名前 */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginBottom: 22 }}>
                <div style={{
                  width: 84, height: 84, borderRadius: '50%',
                  overflow: 'hidden', background: '#F2F2F7',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '3px solid rgba(242,169,0,0.25)',
                  flexShrink: 0,
                }}>
                  {player.iconUrl
                    ? <img src={player.iconUrl} alt={player.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <FiUser size={34} color="#8E8E93" />
                  }
                </div>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: 20, fontWeight: 700, color: '#1C1C1E', letterSpacing: '-0.4px' }}>
                    {player.name || 'プレイヤー'}
                  </p>
                  {player.playerId && (
                    <p style={{ fontSize: 13, color: '#8E8E93', marginTop: 4 }}>{player.playerId}</p>
                  )}
                </div>
              </div>

              {/* ── RR Rating カード */}
              <div style={{
                background: 'linear-gradient(135deg, #FFFBF0, #FFF3CC)',
                border: '1px solid rgba(242,169,0,0.25)',
                borderRadius: 20,
                padding: '18px 20px',
                marginBottom: 14,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div>
                  <p style={{ fontSize: 10, fontWeight: 800, color: '#D4910A', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
                    RR Rating
                  </p>
                  <p style={{ fontSize: 34, fontWeight: 800, color: '#1C1C1E', letterSpacing: '-1px', lineHeight: 1 }}>
                    {rrDisplay}
                  </p>
                </div>
                <div style={{
                  width: 54, height: 54, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #F2A900, #D4910A)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <span style={{ fontSize: 24 }}>🏆</span>
                </div>
              </div>

              {/* ── トナメ統計グリッド */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
                {[
                  { label: '参加回数', value: stats.plays > 0 ? `${stats.plays}回` : '—' },
                  { label: 'インマネ率', value: itmRate ? `${itmRate}%` : '—' },
                  { label: 'ROI', value: roi ? `${roi}%` : '—' },
                ].map(({ label, value }) => (
                  <div key={label} style={{
                    background: '#F2F2F7', borderRadius: 16,
                    padding: '14px 8px', textAlign: 'center',
                  }}>
                    <p style={{ fontSize: 10, fontWeight: 600, color: '#8E8E93', letterSpacing: '0.03em', marginBottom: 6 }}>
                      {label}
                    </p>
                    <p style={{ fontSize: 16, fontWeight: 700, color: '#1C1C1E', letterSpacing: '-0.4px' }}>
                      {value}
                    </p>
                  </div>
                ))}
              </div>

              {/* ── プロフィール詳細 */}
              {(player.region || player.favoriteHand || player.pokerHistory) && (
                <div style={{ background: '#F2F2F7', borderRadius: 20, overflow: 'hidden' }}>
                  {[
                    { icon: '📍', label: '地域', value: player.region },
                    { icon: '🃏', label: '好きなハンド', value: player.favoriteHand },
                    { icon: '⏰', label: 'ポーカー歴', value: player.pokerHistory },
                  ].filter(r => r.value).map(({ icon, label, value }, i, arr) => (
                    <div key={label} style={{
                      padding: '14px 18px',
                      borderBottom: i < arr.length - 1 ? '1px solid rgba(0,0,0,0.06)' : 'none',
                      display: 'flex', alignItems: 'center', gap: 14,
                    }}>
                      <span style={{ fontSize: 20, flexShrink: 0, lineHeight: 1 }}>{icon}</span>
                      <div>
                        <p style={{ fontSize: 10, color: '#8E8E93', fontWeight: 600, marginBottom: 3, letterSpacing: '0.03em' }}>
                          {label}
                        </p>
                        <p style={{ fontSize: 14, fontWeight: 600, color: '#1C1C1E' }}>{value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
