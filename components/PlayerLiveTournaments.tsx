'use client'

import { useEffect, useState } from 'react'
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import { auth, db } from '@/lib/firebase'
import { ChevronDown, Maximize2, X } from 'lucide-react'
import RotatedFullscreen from '@/components/RotatedFullscreen'
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

  // ── 折りたたみと並び順(オーナー指定・2026-11-05) ─────────────────────────
  // 自分が最後にエントリー・リエントリー・アドオンした大会を一番上に置いて開く。ほかは最初たたむ。
  // 開閉は端末に大会ごとに覚える。新しく別の大会に入ったら、その大会を自動で開いて一番上にする。
  const [uid, setUid] = useState<string | null>(null)
  useEffect(() => onAuthStateChanged(auth, u => setUid(u?.uid ?? null)), [])
  // 自分の購入の記録(transactions)。店舗の画面からの登録も、自分の端末からの確定も、ここに時刻付きで残る
  const [lastTxAt, setLastTxAt] = useState<Record<string, number>>({})
  useEffect(() => {
    if (!uid) return
    const q = query(collection(db, 'transactions'), where('playerId', '==', uid), where('storeId', '==', storeId))
    return onSnapshot(q, snap => {
      const m: Record<string, number> = {}
      snap.forEach(d => {
        const x = d.data()
        if (typeof x.tournamentId !== 'string' || x.revokedAt || x.direction !== 'subtract') return
        if (!['store_tournament_entry', 'store_tournament_reentry', 'store_tournament_addon'].includes(x.type)) return
        const at = x.createdAt?.toMillis?.() ?? 0
        if (at > (m[x.tournamentId] ?? 0)) m[x.tournamentId] = at
      })
      setLastTxAt(m)
    }, () => {})
  }, [uid, storeId])
  // 参加費 0 の大会は記録が残らないので、参加の有無(entries/{uid})でも見る(時刻は分からないので記録のある大会より下)
  const tidKey = tournaments.map(t => t.id).join(',')
  const [entered, setEntered] = useState<Record<string, boolean>>({})
  useEffect(() => {
    if (!uid || !tidKey) return
    const unsubs = tidKey.split(',').map(tid => onSnapshot(doc(db, 'stores', storeId, 'tournaments', tid, 'entries', uid), snap => {
      const e = snap.data()
      const on = !!e && ((e.entryCount ?? 0) > 0 || (e.reentryCount ?? 0) > 0 || (e.addonCount ?? 0) > 0)
      setEntered(m => (m[tid] === on ? m : { ...m, [tid]: on }))
    }, () => {}))
    return () => unsubs.forEach(u => u())
  }, [uid, storeId, tidKey])
  const lastTid = (() => {
    const live = tournaments.map(t => t.id)
    const withTx = live.filter(id => lastTxAt[id]).sort((a, b) => lastTxAt[b] - lastTxAt[a])
    if (withTx.length > 0) return withTx[0]
    return live.find(id => entered[id]) ?? null
  })()
  const KEY = (tid: string) => `rrpoker.timerOpen.${tid}`
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({})
  useEffect(() => {
    // 端末に覚えた開閉を読む。覚えていない大会は「最後に入った大会だけ開く」
    const m: Record<string, boolean> = {}
    for (const t of tournaments) {
      let v: string | null = null
      try { v = localStorage.getItem(KEY(t.id)) } catch {}
      m[t.id] = v === null ? t.id === lastTid : v === '1'
    }
    // 新しく別の大会に入ったら、その大会を開く
    let prevLast: string | null = null
    try { prevLast = localStorage.getItem('rrpoker.timerLastTid') } catch {}
    if (lastTid && prevLast !== lastTid) {
      m[lastTid] = true
      try { localStorage.setItem(KEY(lastTid), '1'); localStorage.setItem('rrpoker.timerLastTid', lastTid) } catch {}
    }
    setOpenMap(m)
  }, [tidKey, lastTid]) // eslint-disable-line react-hooks/exhaustive-deps
  const toggle = (tid: string) => {
    hapticTap()
    setOpenMap(m => {
      const next = !m[tid]
      try { localStorage.setItem(KEY(tid), next ? '1' : '0') } catch {}
      return { ...m, [tid]: next }
    })
  }
  const ordered = lastTid ? [...tournaments.filter(t => t.id === lastTid), ...tournaments.filter(t => t.id !== lastTid)] : tournaments
  // 横向き全画面(スマホだけ)。見るだけ: 操作ボタンは置かず、閉じる × だけ
  const [fullId, setFullId] = useState<string | null>(null)

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
        {ordered.map(t => {
          const clk = tournamentClocks(t, t.blindPresetId ? presets[t.blindPresetId] : null)
          const open = !!openMap[t.id]
          return (
          <div key={t.id}>
            {/* 見出しの行。押すと開く・たたむ(ワンタップ) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: open ? 8 : 0 }}>
              <button type="button" onClick={() => toggle(t.id)} aria-expanded={open} aria-label={`${t.name}のタイマーを${open ? 'たたむ' : '開く'}`}
                style={{ flex: 1, minWidth: 0, minHeight: 44, display: 'flex', alignItems: 'center', gap: 8, padding: '0 4px', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                <ChevronDown size={18} strokeWidth={2} color="var(--label2)" aria-hidden style={{ flexShrink: 0, transform: open ? 'none' : 'rotate(-90deg)', transition: 'transform 160ms ease-out' }} />
                <span className="con-mono" style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontSize: 11, color: 'var(--label2)' }}>
                  <span style={{ fontWeight: 700, color: 'var(--label)', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: '1 1 auto', minWidth: 0 }}>{t.name}</span>
                  {clk.rc && <span style={{ fontWeight: 700, color: '#D4910A' }}>RC {clk.rc}</span>}
                  {clk.end && <span>終了予定 {clk.end}</span>}
                </span>
              </button>
              {/* 横向き全画面(スマホ版だけ。店舗と同じ) */}
              {open && (
                <button type="button" className="pc-hide" onClick={() => { hapticTap(); setFullId(t.id) }} aria-label={`${t.name}のタイマーを横向きで大きく見る`}
                  style={{ width: 44, height: 44, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'none', cursor: 'pointer' }}>
                  <span style={{ width: 32, height: 32, borderRadius: 16, background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.08), inset 0 0 0 1px var(--sep)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Maximize2 size={15} strokeWidth={2} color="var(--label)" aria-hidden />
                  </span>
                </button>
              )}
            </div>
            {open && (<>
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
            </>)}
          </div>
          )
        })}
      </div>

      {/* 横向き全画面。プレイヤーはタイマーを操作できない(CLAUDE.md): 見るだけの埋め込み(view=1・押せない)と、閉じる × だけ */}
      {fullId && (
        <RotatedFullscreen zIndex={9999} portal>
          <iframe src={`/home/store/timer/${fullId}?store=${encodeURIComponent(storeId)}&view=1`} title="timer-fullscreen" tabIndex={-1}
            style={{ width: '100%', height: '100%', border: 'none', display: 'block', pointerEvents: 'none' }} />
          <button type="button" onClick={() => setFullId(null)} aria-label="閉じる"
            style={{ position: 'absolute', top: 12, right: 12, width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'none', cursor: 'pointer', zIndex: 2 }}>
            <span style={{ width: 40, height: 40, borderRadius: 20, background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={20} strokeWidth={2.25} color="#fff" aria-hidden />
            </span>
          </button>
        </RotatedFullscreen>
      )}

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
        // 自動スタートの「Waiting for start」は表に出さない(lib/waitingLevel.ts)
        if (l.type === 'waiting') return null
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
