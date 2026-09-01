'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { auth } from '@/lib/firebase'
import { fetchPokerArtRating, fetchPokerArtStats, type PokerArtRating, type PokerArtStats } from '@/lib/pokerArtStats'

/**
 * マイページに出す Poker ART(オンライン)の成績。
 *
 * ライブ(店舗)の成績とは別枠にして、どちらの数字なのかが一目で分かるようにする。
 * まだ遊んでいない人には数字の代わりに卓への導線を出す。
 */

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: '#F2F2F7', borderRadius: 12, padding: '10px 12px' }}>
      <p style={{ fontSize: 10, fontWeight: 600, color: 'rgba(60,60,67,0.6)', marginBottom: 3 }}>{label}</p>
      <p style={{ fontSize: 16, fontWeight: 700, color: '#1C1C1E', lineHeight: 1 }}>{value}</p>
    </div>
  )
}

export default function PokerArtStatsCard() {
  const router = useRouter()
  const [rating, setRating] = useState<PokerArtRating | null>(null)
  const [stats, setStats] = useState<PokerArtStats | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    return auth.onAuthStateChanged(async (user) => {
      if (!user) { setLoaded(true); return }
      try {
        const token = await user.getIdToken()
        const [r, s] = await Promise.all([fetchPokerArtRating(token), fetchPokerArtStats(token)])
        setRating(r)
        setStats(s)
      } catch {
        // 通信断。未プレイ扱いで表示する。
      } finally {
        setLoaded(true)
      }
    })
  }, [])

  if (!loaded) return null

  const plays = stats?.tournamentsPlayed ?? 0
  const played = plays > 0

  return (
    <div className="mp-card mp-animate" style={{ padding: 16, marginBottom: 20, boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(60,60,67,0.5)' }}>
            Poker ART
          </p>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#1C1C1E', marginTop: 2 }}>オンラインの成績</p>
        </div>
        {played && rating && (
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: 10, fontWeight: 600, color: 'rgba(60,60,67,0.6)' }}>トナメ偏差値</p>
            <p style={{ fontSize: 26, fontWeight: 800, color: '#C97D00', lineHeight: 1.1, letterSpacing: '-0.5px' }}>
              {rating.rrRating.toFixed(2)}
            </p>
          </div>
        )}
      </div>

      {played && stats ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <Tile label="参加数" value={`${stats.tournamentsPlayed}回`} />
            <Tile label="インマネ率" value={`${Math.round(stats.itmRate * 100)}%`} />
            <Tile label="ROI" value={`${stats.roi >= 0 ? '+' : ''}${Math.round(stats.roi * 100)}%`} />
          </div>
          {rating?.nationalRank != null && (
            <button
              type="button"
              onClick={() => router.push('/home/art/table')}
              style={{
                marginTop: 10, width: '100%', height: 40, borderRadius: 12,
                background: '#F2F2F7', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 700, color: '#1C1C1E' }}>
                全国 {rating.nationalRank} 位
              </span>
              <span style={{ fontSize: 11, color: 'rgba(60,60,67,0.55)' }}>
                / {rating.totalRankedPlayers}人
              </span>
            </button>
          )}
        </>
      ) : (
        <div>
          <p style={{ fontSize: 13, color: 'rgba(60,60,67,0.6)', lineHeight: 1.6, marginBottom: 12 }}>
            まだオンラインのトーナメントに参加していません。参加すると、ここに偏差値と成績が出ます。
          </p>
          <button
            type="button"
            onClick={() => router.push('/home/art/table')}
            style={{
              width: '100%', height: 44, borderRadius: 12,
              background: 'linear-gradient(135deg,#F2A900,#D4910A)', border: 'none', cursor: 'pointer',
              fontSize: 14, fontWeight: 700, color: '#fff',
            }}
          >
            プレイする
          </button>
        </div>
      )}
    </div>
  )
}
