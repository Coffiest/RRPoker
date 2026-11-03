'use client'

import { useEffect, useState } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { tournamentClocks } from '@/lib/endEstimate'
import { FiList, FiCopy } from 'react-icons/fi'
import { blindsToText, copyText } from '@/lib/blindText'
import { showToast } from '@/lib/toast'
import AppleSheet from '@/components/AppleSheet'
import { useLiveTournaments, type LiveTournament } from '@/components/LiveTournamentTimer'
import { computeLiveLevelState, type TimerLevel } from '@/lib/timerCompute'
import { getServerNow } from '@/lib/serverClock'
import { hapticTap } from '@/lib/haptics'

/**
 * 入店中のプレイヤーに、その店で進行中のトーナメントのタイマーを見せる。
 *
 * 見た目は店舗側で実際に映しているタイマー画面(/home/store/timer/[id])そのもの。
 * それを「見るだけ」の指定(?store=<店舗ID>&view=1)で埋め込む。プライズも同じに見える。
 *
 * プレイヤーはタイマーを絶対に操作できない(オーナー確定のルール)。
 *  - 埋め込みは押せない(pointer-events: none)。view=1 のときタイマー画面は何も書き込まない。
 *  - Firestore のルールでも、大会の文書は店舗しか書けない(firestore.rules)。
 * 操作ボタンは置かない。全体のブラインド一覧だけをシートで見られる。
 */

type Props = { storeId: string }

const DESIGN_W = 1440
const DESIGN_H = 900

export default function PlayerLiveTournaments({ storeId }: Props) {
  const tournaments = useLiveTournaments(storeId)
  const [blindsOf, setBlindsOf] = useState<LiveTournament | null>(null)
  // RC 時刻・終了予定(オーナー指定)。店舗のブラインドのプリセットから計算する(読むだけ)
  const [presets, setPresets] = useState<Record<string, any>>({})
  useEffect(() => {
    return onSnapshot(collection(db, 'stores', storeId, 'blindPresets'), snap => {
      const m: Record<string, any> = {}; snap.forEach(d => { m[d.id] = d.data() }); setPresets(m)
    }, () => {})
  }, [storeId])

  if (tournaments.length === 0) return null

  return (
    <div
      className="section-card home-boot pd-live"
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

      <div className="pd-live-list" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {tournaments.map(t => {
          const clk = tournamentClocks(t, t.blindPresetId ? presets[t.blindPresetId] : null)
          return (
          <div key={t.id}>
            {(clk.rc || clk.end) && (
              <p className="con-mono" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontSize: 11, color: 'var(--label2)', margin: '0 0 8px' }}>
                <span style={{ fontWeight: 700, color: 'var(--label)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: '1 1 auto', minWidth: 0 }}>{t.name}</span>
                {clk.rc && <span style={{ fontWeight: 700, color: '#D4910A' }}>RC {clk.rc}</span>}
                {clk.end && <span>終了予定 {clk.end}</span>}
              </p>
            )}
            {/* 店舗のタイマー画面(1440×900)を、幅に合わせてそのまま縮める */}
            <div style={{ position: 'relative', width: '100%', aspectRatio: `${DESIGN_W} / ${DESIGN_H}`, overflow: 'hidden', borderRadius: 12, border: '1px solid var(--sep)', background: '#fff' }}>
              <iframe
                src={`/home/store/timer/${t.id}?store=${encodeURIComponent(storeId)}&view=1`}
                title={`timer-${t.name}`}
                tabIndex={-1}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none', pointerEvents: 'none' }}
              />
            </div>
            <button
              type="button"
              onClick={() => { hapticTap(); setBlindsOf(t) }}
              className="gl-press"
              style={{
                marginTop: 8, width: '100%', minHeight: 44, borderRadius: 12, border: '1px solid var(--sep)', background: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                fontFamily: 'var(--stack-mono)', fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--label)', cursor: 'pointer',
              }}
            >
              <FiList size={14} /> BLINDS
            </button>
          </div>
          )
        })}
      </div>

      <AppleSheet open={blindsOf !== null} onClose={() => setBlindsOf(null)} zIndex={1300}
        title={<span className="tech-label" style={{ fontSize: 11, color: 'var(--label)', letterSpacing: '0.14em' }}>BLINDS · {blindsOf?.name ?? ''}</span>}>
        {blindsOf && <BlindList t={blindsOf} />}
      </AppleSheet>
    </div>
  )
}

function BlindList({ t }: { t: LiveTournament }) {
  const levels: TimerLevel[] = t.customBlindLevels ?? []
  if (levels.length === 0) {
    return <p style={{ fontSize: 13, color: 'var(--label3)', textAlign: 'center', padding: '24px 0' }}>ブラインド表がありません</p>
  }
  const live = computeLiveLevelState(
    t.currentLevelIndex, t.levelStartedAtMs, t.levelStartedRemaining ?? t.timeRemaining, levels, t.timerRunning, getServerNow(),
  ).levelIndex
  let lv = 0
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingBottom: 16 }}>
      {/* テキストでコピー(オーナー指定)。見るだけの機能で、大会には何も書き込まない */}
      <button type="button"
        onClick={async () => { const ok = await copyText(blindsToText(t.name ?? '', levels)); showToast(ok ? 'ブラインドをコピーしました' : 'コピーできませんでした', ok ? 'ok' : 'error') }}
        className="gl-press"
        style={{ alignSelf: 'flex-end', minHeight: 44, padding: '0 16px', marginBottom: 8, borderRadius: 12, border: '1px solid var(--sep)', background: '#fff', display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--stack-mono)', fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--label)', cursor: 'pointer' }}>
        <FiCopy size={14} /> COPY TEXT
      </button>
      {levels.map((l, i) => {
        const isBreak = l.type === 'break'
        if (!isBreak) lv++
        const now = i === live
        return (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 12, minHeight: 40, padding: '0 12px', borderRadius: 10,
            background: now ? 'rgba(242,169,0,0.12)' : isBreak ? 'var(--fill)' : 'transparent',
            fontFamily: 'var(--stack-mono)', fontSize: 13, color: 'var(--label)',
          }}>
            <span style={{ width: 64, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: now ? '#D4910A' : 'var(--label2)' }}>
              {isBreak ? 'BREAK' : `LV ${lv}`}
            </span>
            <span style={{ flex: 1, fontWeight: now ? 800 : 600 }} className="tech-num">
              {isBreak ? '' : `${(l.smallBlind ?? 0).toLocaleString()} / ${(l.bigBlind ?? 0).toLocaleString()}`}
              {!isBreak && l.ante ? <span style={{ color: 'var(--label3)', fontWeight: 500 }}>{` (${l.ante.toLocaleString()})`}</span> : null}
            </span>
            <span style={{ fontSize: 11, color: 'var(--label3)' }}>{l.duration ?? '-'}min</span>
          </div>
        )
      })}
    </div>
  )
}
