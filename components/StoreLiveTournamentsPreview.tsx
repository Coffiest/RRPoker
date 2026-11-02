'use client'

import LiveTournamentTimer, { useLiveTournaments } from '@/components/LiveTournamentTimer'

/**
 * 店舗を選んだときに出る「入店する」のポップアップに、その店で実施中の
 * トーナメントをすべて並べる。
 *
 * 入店中ホームの一覧とは目的が違う。あちらは「自分が参加している大会」を出して
 * リエントリー / アドオンの操作をするための場所。こちらは入る前に「いま何が
 * 動いているか」を見て、入るかどうかを決めるための場所なので、参加の有無に
 * かかわらず全部出し、操作は一切置かない。
 *
 * 進行中の大会が無ければ、何も描かない(空の見出しだけが残らないように)。
 */
export default function StoreLiveTournamentsPreview({ storeId }: { storeId: string }) {
  const tournaments = useLiveTournaments(storeId)
  if (tournaments.length === 0) return null

  return (
    <div className="mb-5">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <p className="tech-label" style={{ fontSize: 10.5, color: '#1C1C1E', letterSpacing: '0.16em' }}>
          実施中のトナメ
        </p>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="tech-status-dot" style={{ background: '#34C759' }} />
          <span className="tech-num" style={{ fontSize: 11, fontWeight: 700, color: '#34C759' }}>
            {tournaments.length}
          </span>
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {tournaments.map(t => (
          <LiveTournamentTimer key={t.id} tournament={t} />
        ))}
      </div>
    </div>
  )
}
