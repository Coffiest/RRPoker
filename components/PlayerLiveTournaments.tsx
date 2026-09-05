'use client'

import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import LiveTournamentTimer, { useLiveTournaments, type LiveTournament } from '@/components/LiveTournamentTimer'
import DealerConfirmSheet from '@/components/DealerConfirmSheet'
import { applyTournamentPurchase, type PurchaseKind } from '@/lib/tournamentEntryActions'
import { hapticTap } from '@/lib/haptics'

/**
 * 入店中のプレイヤーに、自分が参加している進行中トーナメントを見せる。
 *
 * タイマーは読み取り専用。そのうえで、リエントリーとアドオンだけを
 * その場で確定できるようにする。これまでは店員が Players 画面を開いて
 * 数字を打ち直すしかなく、そのたびに卓の進行が止まっていた。
 *
 * 出すのは「自分がエントリー登録されている」大会だけ。初回のエントリーは
 * 従来どおり店舗側の Players 画面から行う(飛び入りの受付は人が確認する)。
 */

type Props = {
  storeId: string
  /** 残高の置き場。系列店で共有するため storeId とは別。 */
  balanceGroupId: string
  userId: string
  playerName: string
  playerIconUrl?: string | null
  /** いまのチップ残高。足りているかの判定に使う。 */
  balance: number
  unitLabel: string
  unitBefore: boolean
}

const KIND_LABEL: Record<PurchaseKind, string> = {
  reentry: 'リエントリー',
  addon: 'アドオン',
}

export default function PlayerLiveTournaments(props: Props) {
  const tournaments = useLiveTournaments(props.storeId)
  const [joined, setJoined] = useState<Record<string, boolean>>({})

  // 各大会について、自分の参加記録があるかを見る。
  useEffect(() => {
    const unsubs = tournaments.map(t =>
      onSnapshot(
        doc(db, 'stores', props.storeId, 'tournaments', t.id, 'entries', props.userId),
        snap => setJoined(prev => ({ ...prev, [t.id]: snap.exists() })),
        () => setJoined(prev => ({ ...prev, [t.id]: false })),
      ),
    )
    return () => unsubs.forEach(u => u())
    // tournaments の中身ではなく「どの大会か」が変わったときだけ張り直す。
  }, [props.storeId, props.userId, tournaments.map(t => t.id).join(',')])

  const mine = tournaments.filter(t => joined[t.id])
  if (mine.length === 0) return null

  return (
    <div
      className="section-card home-boot"
      style={{ marginTop: 20, ['--tech-reveal-delay' as string]: '0.07s' } as React.CSSProperties}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <p className="tech-label" style={{ fontSize: 10.5, color: '#1C1C1E', letterSpacing: '0.16em' }}>
          現在進行中のトナメ
        </p>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="tech-status-dot" style={{ background: '#34C759' }} />
          <span className="tech-label" style={{ fontSize: 9, color: '#34C759' }}>LIVE</span>
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {mine.map(t => (
          <LiveTournamentRow key={t.id} tournament={t} {...props} />
        ))}
      </div>
    </div>
  )
}

function LiveTournamentRow({
  tournament,
  storeId,
  balanceGroupId,
  userId,
  playerName,
  playerIconUrl,
  balance,
  unitLabel,
  unitBefore,
}: Props & { tournament: LiveTournament }) {
  const [confirming, setConfirming] = useState<PurchaseKind | null>(null)
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)

  const feeOf = (kind: PurchaseKind) =>
    kind === 'reentry' ? tournament.reentryFee : tournament.addonFee

  const runPurchase = async (kind: PurchaseKind) => {
    setMessage(null)
    const result = await applyTournamentPurchase({
      storeId,
      balanceGroupId,
      tournamentId: tournament.id,
      playerId: userId,
      playerName,
      kind,
    })
    setConfirming(null)
    if (result.ok) {
      setMessage({ tone: 'ok', text: `${KIND_LABEL[kind]}を記録しました` })
      window.setTimeout(() => setMessage(null), 4000)
      return
    }
    const text =
      result.reason === 'insufficient' ? 'チップが不足しています'
      : result.reason === 'no_fee' ? 'この大会では選べません'
      : result.reason === 'not_active' ? 'この大会は進行中ではありません'
      : '記録できませんでした'
    setMessage({ tone: 'error', text })
  }

  const button = (kind: PurchaseKind) => {
    const fee = feeOf(kind)
    // 参加費が設定されていない種別は、そもそもその大会に無いのでボタンを出さない。
    if (fee <= 0) return null
    const short = balance < fee
    return (
      <button
        type="button"
        className="con-btn"
        onClick={() => { if (!short) { hapticTap(); setConfirming(kind) } }}
        disabled={short}
        style={{
          flex: 1, height: 50, borderRadius: 999, border: 'none',
          background: short ? '#F2F2F7' : 'linear-gradient(135deg,#F2A900,#D4910A)',
          color: short ? 'rgba(60,60,67,0.4)' : '#fff',
          fontSize: 12.5, fontWeight: 800,
          cursor: short ? 'default' : 'pointer',
          boxShadow: short ? 'none' : '0 3px 12px rgba(242,169,0,0.30)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
        }}
      >
        <span>{KIND_LABEL[kind]}</span>
        <span className="tech-num" style={{ fontSize: 10, fontWeight: 600, opacity: 0.85, letterSpacing: 0 }}>
          {unitBefore ? `${unitLabel}${fee.toLocaleString()}` : `${fee.toLocaleString()}${unitLabel}`}
        </span>
      </button>
    )
  }

  const reentryBtn = button('reentry')
  const addonBtn = button('addon')
  const shortOfAny =
    (tournament.reentryFee > 0 && balance < tournament.reentryFee) ||
    (tournament.addonFee > 0 && balance < tournament.addonFee)

  return (
    <div>
      <LiveTournamentTimer tournament={tournament} />

      {(reentryBtn || addonBtn) && (
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          {reentryBtn}
          {addonBtn}
        </div>
      )}

      {shortOfAny && (
        <p className="term-comment" style={{ fontSize: 11, color: 'rgba(60,60,67,0.45)', marginTop: 8, textAlign: 'center' }}>
          チップが不足している項目は選べません
        </p>
      )}

      {message && (
        <p style={{
          fontSize: 12, fontWeight: 600, marginTop: 8, textAlign: 'center',
          color: message.tone === 'ok' ? '#D4910A' : '#FF3B30',
        }}>
          {message.text}
        </p>
      )}

      {confirming && (
        <DealerConfirmSheet
          title={KIND_LABEL[confirming]}
          amount={feeOf(confirming)}
          unitLabel={unitLabel}
          unitBefore={unitBefore}
          playerName={playerName}
          playerIconUrl={playerIconUrl}
          onApprove={() => runPurchase(confirming)}
          onCancel={() => setConfirming(null)}
        />
      )}
    </div>
  )
}
