'use client'

import { useEffect, useRef, useState } from 'react'
import { collection, doc, onSnapshot, query, where, type QuerySnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { computeLiveLevelState, type TimerLevel } from '@/lib/timerCompute'
import { getServerNow } from '@/lib/serverClock'

/**
 * 進行中トーナメントのタイマーを、読み取り専用で見せる。
 *
 * 店舗のタイマー画面(TimerClient)は、ログイン中のアカウントに紐づく
 * users/{uid}.storeId から店舗を決めるので、その店舗アカウントでしか動かない。
 * プレイヤーには storeId が無く、そのまま埋め込んでも何も映らない。だから
 * 「店舗IDを外から渡せて、書き込みを一切しない」表示だけの部品を別に置く。
 *
 * 残り時間とレベルは lib/timerCompute.ts の computeLiveLevelState で毎秒
 * 割り出す。サーバー(毎分の巡回)が Firestore を書き換えるのを待たないので、
 * レベルの切り替わりが最大1分遅れる、ということが起きない。
 * 時刻は getServerNow() を使う。端末の時計がずれていても表示がずれないため。
 *
 * ここからは Firestore へ一切書き込まない。プレイヤーがタイマーを操作できては
 * いけないので、操作の入口(lib/timerControl.ts)も読み込まない。
 */

/** 店舗側のタイマーが既定で使うブラインド表(customBlindLevels が無いとき)。 */
const DEFAULT_BLIND_LEVELS: TimerLevel[] = [
  { type: 'level', smallBlind: 50, bigBlind: 100, ante: 100, duration: 20 },
  { type: 'level', smallBlind: 75, bigBlind: 150, ante: 150, duration: 20 },
  { type: 'level', smallBlind: 100, bigBlind: 200, ante: 200, duration: 20 },
]

export type LiveTournament = {
  id: string
  name: string
  status: string
  entry: number
  reentry: number
  addon: number
  bustCount: number
  entryStack: number
  reentryStack: number
  addonStack: number
  entryFee: number
  reentryFee: number
  addonFee: number
  prizePool: number
  currentLevelIndex: number
  timeRemaining: number
  timerRunning: boolean
  levelStartedAtMs: number | null
  levelStartedRemaining: number | null
  customBlindLevels: TimerLevel[] | null
}

/** Firestore のトーナメント文書を、画面が使う形へそろえる。 */
export function toLiveTournament(id: string, data: Record<string, any>): LiveTournament {
  const entry = Number(data.totalEntry ?? 0)
  const reentry = Number(data.totalReentry ?? 0)
  const addon = Number(data.totalAddon ?? 0)
  return {
    id,
    name: data.name ?? '',
    status: data.status ?? 'scheduled',
    entry,
    reentry,
    addon,
    bustCount: Number(data.bustCount ?? 0),
    entryStack: Number(data.entryStack ?? 0),
    reentryStack: Number(data.reentryStack ?? 0),
    addonStack: Number(data.addonStack ?? 0),
    entryFee: Number(data.entryFee ?? 0),
    reentryFee: Number(data.reentryFee ?? 0),
    addonFee: Number(data.addonFee ?? 0),
    // 参加費の合計。店舗側の Pay Out と同じ数え方にそろえる。
    prizePool:
      entry * Number(data.entryFee ?? 0) +
      reentry * Number(data.reentryFee ?? 0) +
      addon * Number(data.addonFee ?? 0),
    currentLevelIndex: Number(data.currentLevelIndex ?? 0),
    timeRemaining: Number(data.timeRemaining ?? 0),
    timerRunning: Boolean(data.timerRunning ?? false),
    levelStartedAtMs: data.levelStartedAt?.toMillis?.() ?? null,
    levelStartedRemaining:
      typeof data.levelStartedRemaining === 'number' ? data.levelStartedRemaining : null,
    customBlindLevels: Array.isArray(data.customBlindLevels) ? data.customBlindLevels : null,
  }
}

/** 進行中のトーナメントを購読する。status が active のものだけ。 */
export function useLiveTournaments(storeId: string | null): LiveTournament[] {
  const [list, setList] = useState<LiveTournament[]>([])

  useEffect(() => {
    if (!storeId) { setList([]); return }
    // ここは購読するだけ。書き込みは一切しない。
    const q = query(
      collection(db, 'stores', storeId, 'tournaments'),
      where('status', '==', 'active'),
    )
    const unsub = onSnapshot(q, (snap: QuerySnapshot) => {
      const next: LiveTournament[] = []
      snap.forEach(d => next.push(toLiveTournament(d.id, d.data())))
      setList(next)
    }, () => setList([]))
    return () => unsub()
  }, [storeId])

  return list
}

/** 1つのトーナメントだけを購読する。 */
export function useLiveTournament(storeId: string | null, tournamentId: string | null): LiveTournament | null {
  const [value, setValue] = useState<LiveTournament | null>(null)
  useEffect(() => {
    if (!storeId || !tournamentId) { setValue(null); return }
    const unsub = onSnapshot(
      doc(db, 'stores', storeId, 'tournaments', tournamentId),
      snap => setValue(snap.exists() ? toLiveTournament(snap.id, snap.data()) : null),
      () => setValue(null),
    )
    return () => unsub()
  }, [storeId, tournamentId])
  return value
}

const two = (n: number) => String(n).padStart(2, '0')

export default function LiveTournamentTimer({ tournament }: { tournament: LiveTournament }) {
  // 走っている間だけ再描画する。止まっているときに毎秒描き直しても、
  // 表示は変わらないのに電池だけ減る。
  const [, setTick] = useState(0)
  const runningRef = useRef(tournament.timerRunning)
  runningRef.current = tournament.timerRunning
  useEffect(() => {
    if (!tournament.timerRunning) return
    const id = setInterval(() => setTick(n => n + 1), 250)
    return () => clearInterval(id)
  }, [tournament.timerRunning])

  const levels =
    tournament.customBlindLevels && tournament.customBlindLevels.length > 0
      ? tournament.customBlindLevels
      : DEFAULT_BLIND_LEVELS

  const { levelIndex, remainingSec } = computeLiveLevelState(
    tournament.currentLevelIndex,
    tournament.levelStartedAtMs,
    tournament.timerRunning
      ? (tournament.levelStartedRemaining ?? tournament.timeRemaining)
      : tournament.timeRemaining,
    levels,
    tournament.timerRunning,
    getServerNow(),
  )

  const level = levels[levelIndex] ?? null
  const isBreak = level?.type === 'break'
  const minutes = Math.floor(remainingSec / 60)
  const seconds = remainingSec % 60

  const totalPlayers = tournament.entry + tournament.reentry
  const alivePlayers = totalPlayers - tournament.bustCount
  const totalChips =
    tournament.entry * tournament.entryStack +
    tournament.reentry * tournament.reentryStack +
    tournament.addon * tournament.addonStack
  const averageStack = alivePlayers > 0 ? Math.floor(totalChips / alivePlayers) : 0

  // 次のブレイクまで。いまのレベルの残りに、そこまでのレベルの長さを足す。
  const hasNextBreak = levels.slice(levelIndex + 1).some(lv => lv.type === 'break')
  const nextBreakSeconds = (() => {
    let total = remainingSec
    for (let i = levelIndex + 1; i < levels.length; i++) {
      if (levels[i].type === 'break') break
      const d = levels[i].duration
      if (typeof d === 'number') total += d * 60
    }
    return total
  })()

  const sb = (level as any)?.smallBlind ?? null
  const bb = (level as any)?.bigBlind ?? null
  const ante = (level as any)?.ante ?? null

  return (
    <div
      className="con-panel"
      style={{ padding: '16px 16px 14px', position: 'relative' }}
    >
      {/* 大会名とレベル */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
        <p style={{
          fontFamily: 'var(--stack-mono)', fontSize: 13, fontWeight: 800, color: '#1C1C1E',
          minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{tournament.name}</p>
        <span className="tech-label" style={{ fontSize: 9, color: 'rgba(60,60,67,0.45)', flexShrink: 0 }}>
          {isBreak ? 'BREAK' : `LEVEL ${levelIndex + 1}`}
        </span>
      </div>

      {/* 残り時間。止まっているときは点滅させて、進んでいないことを示す。 */}
      <p
        className="tech-num"
        style={{
          textAlign: 'center', fontSize: 46, fontWeight: 800, lineHeight: 1.05,
          letterSpacing: '-1px', color: '#1C1C1E',
          opacity: tournament.timerRunning ? 1 : 0.45,
        }}
      >
        {two(minutes)}:{two(seconds)}
      </p>
      {!tournament.timerRunning && (
        <p className="tech-label" style={{ textAlign: 'center', fontSize: 9, color: 'rgba(60,60,67,0.40)', marginTop: 2 }}>
          PAUSED
        </p>
      )}

      <div className="tech-rule" style={{ margin: '10px 0' }} />

      {/* ブラインドとアンティ */}
      {isBreak ? (
        <p className="tech-label" style={{ textAlign: 'center', fontSize: 11, color: '#D4910A', letterSpacing: '0.2em' }}>
          休憩中
        </p>
      ) : (
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 14, flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span className="tech-label" style={{ fontSize: 9, color: 'rgba(60,60,67,0.45)' }}>BLIND</span>
            <span className="tech-num" style={{ fontSize: 17, fontWeight: 800, color: '#1C1C1E' }}>
              {sb == null ? '—' : sb.toLocaleString()} / {bb == null ? '—' : bb.toLocaleString()}
            </span>
          </span>
          <span style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span className="tech-label" style={{ fontSize: 9, color: 'rgba(60,60,67,0.45)' }}>ANTE</span>
            <span className="tech-num" style={{ fontSize: 17, fontWeight: 800, color: '#1C1C1E' }}>
              {ante == null ? '—' : ante.toLocaleString()}
            </span>
          </span>
        </div>
      )}

      {/* 次のブレイク */}
      <p style={{ textAlign: 'center', marginTop: 8, display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 6 }}>
        <span className="tech-label" style={{ fontSize: 9, color: 'rgba(60,60,67,0.45)' }}>NEXT BREAK</span>
        <span className="tech-num" style={{ fontSize: 12, fontWeight: 700, color: 'rgba(60,60,67,0.62)' }}>
          {hasNextBreak ? `${two(Math.floor(nextBreakSeconds / 60))}:${two(nextBreakSeconds % 60)}` : 'None.'}
        </span>
      </p>

      <div className="tech-rule" style={{ margin: '10px 0' }} />

      {/* 人数・平均スタック・賞金プール */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        {[
          { label: 'PLAYERS', value: `${alivePlayers} / ${totalPlayers}` },
          { label: 'AVERAGE', value: averageStack.toLocaleString() },
          { label: 'PRIZE POOL', value: tournament.prizePool.toLocaleString() },
        ].map(item => (
          <div key={item.label} style={{ textAlign: 'center' }}>
            <p className="tech-label tech-label-bracket" style={{ fontSize: 8, color: 'rgba(60,60,67,0.45)', marginBottom: 3 }}>
              {item.label}
            </p>
            <p className="tech-num" style={{ fontSize: 13, fontWeight: 700, color: '#1C1C1E' }}>{item.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
