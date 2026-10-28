'use client'
import { ClockIcon, MapPinIcon, SpadeIcon, TrophyIcon, UserIcon } from 'lucide-react'
import AppleSheet from "@/components/AppleSheet"

import { useEffect, useState } from 'react'
import { db } from '@/lib/firebase'
import { doc, getDoc, getDocs, collection } from 'firebase/firestore'

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
        // 利用停止(BAN)中の人のプロフィールは出さない
        if (data.banned === true) return
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
    <AppleSheet open onClose={onClose} bare maxWidth={440} maxHeightVh={88} zIndex={500}>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>

        <div style={{ overflowY: 'auto', flex: 1, minHeight: 0, padding: '24px 24px 8px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '56px 0' }}>
              <p className="term-comment" style={{ fontSize: 13, color: 'var(--label3)' }}>LOADING...</p>
            </div>
          ) : player === null ? (
            <div style={{ textAlign: 'center', padding: '56px 0' }}>
              <p style={{ fontSize: 13, color: 'var(--label3)' }}>プレイヤー情報を取得できませんでした</p>
            </div>
          ) : (
            <>
              {/* ── アバター + 名前 */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, marginBottom: 24 }}>
                <div style={{
                  width: 84, height: 84, borderRadius: '50%',
                  overflow: 'hidden', background: '#EDECE6',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '3px solid rgba(249,179,24,0.25)',
                  flexShrink: 0,
                }}>
                  {player.iconUrl
                    ? <img src={player.iconUrl} alt={player.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <UserIcon size={34} color="var(--label3)" />
                  }
                </div>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: 20, fontWeight: 700, color: '#1C1C1E', letterSpacing: '-0.4px' }}>
                    {player.name || 'プレイヤー'}
                  </p>
                  {player.playerId && (
                    <p style={{ fontSize: 13, color: 'var(--label3)', marginTop: 8 }}>{player.playerId}</p>
                  )}
                </div>
              </div>

              {/* ── RR Rating カード */}
              <div style={{
                background: 'linear-gradient(135deg, #F7F1E3, #FFF3CC)',
                border: '1px solid rgba(249,179,24,0.25)',
                borderRadius: 20,
                padding: '16px 24px',
                marginBottom: 16,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div>
                  <p className="tech-label tech-label-bracket" style={{ fontSize: 11, color: '#8F5E00', marginBottom: 8 }}>
                    RR Rating
                  </p>
                  <p className="tech-num" style={{ fontSize: 34, fontWeight: 800, color: '#1C1C1E', letterSpacing: '-1px', lineHeight: 1 }}>
                    {rrDisplay}
                  </p>
                </div>
                <div style={{
                  width: 54, height: 54, borderRadius: '50%',
                  background: '#F9B318',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <TrophyIcon size={24} color="#fff" />
                </div>
              </div>

              {/* ── トナメ統計グリッド */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
                {[
                  { label: '参加回数', value: stats.plays > 0 ? `${stats.plays}回` : '—' },
                  { label: 'インマネ率', value: itmRate ? `${itmRate}%` : '—' },
                  { label: 'ROI', value: roi ? `${roi}%` : '—' },
                ].map(({ label, value }) => (
                  <div key={label} style={{
                    background: '#EDECE6', borderRadius: 16,
                    padding: '16px 8px', textAlign: 'center',
                  }}>
                    <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--label3)', letterSpacing: '0.03em', marginBottom: 8 }}>
                      {label}
                    </p>
                    <p className="tech-num" style={{ fontSize: 16, fontWeight: 700, color: '#1C1C1E', letterSpacing: '-0.4px' }}>
                      {value}
                    </p>
                  </div>
                ))}
              </div>

              {/* ── プロフィール詳細 */}
              {(player.region || player.favoriteHand || player.pokerHistory) && (
                <div style={{ background: '#EDECE6', borderRadius: 20, overflow: 'hidden' }}>
                  {[
                    { icon: <MapPinIcon size={20} />, label: '地域', value: player.region },
                    { icon: <SpadeIcon size={20} />, label: '好きなハンド', value: player.favoriteHand },
                    { icon: <ClockIcon size={20} />, label: 'ポーカー歴', value: player.pokerHistory },
                  ].filter(r => r.value).map(({ icon, label, value }, i, arr) => (
                    <div key={label} style={{
                      padding: '16px 16px',
                      borderBottom: i < arr.length - 1 ? '1px solid rgba(0,0,0,0.06)' : 'none',
                      display: 'flex', alignItems: 'center', gap: 16,
                    }}>
                      <span style={{ fontSize: 20, flexShrink: 0, lineHeight: 1 }}>{icon}</span>
                      <div>
                        <p style={{ fontSize: 11, color: 'var(--label3)', fontWeight: 600, marginBottom: 3, letterSpacing: '0.03em' }}>
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
    </AppleSheet>
  )
}
