"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { auth, db } from "@/lib/firebase"
import {
  collection, onSnapshot, runTransaction, serverTimestamp,
  query, where, orderBy, limit, doc, deleteDoc,
  getDocs, getDoc, addDoc
} from "firebase/firestore"
import {
  PokerRoom, SNG_BLINDS, MTT_BLINDS,
  getMttSlotTime, getMttSlotId, getMttRegCloseTime, formatCountdown, formatSlotTime,
  MTT_STACK, MTT_TABLE_MAX, MTT_TABLE_MIN_START,
} from "@/lib/poker"
import { FiUsers, FiX, FiClock, FiAward, FiBarChart2 } from "react-icons/fi"
import { GiPokerHand } from "react-icons/gi"

// ─────────────────────────────────────────────────────────────────────────────
interface QueueEntry { uid: string; name: string; iconUrl?: string | null; joinedAt: number }
interface QueueDoc   { players: QueueEntry[]; updatedAt?: any }

const SNG_REQUIRED = 6

// ── MTT helpers ───────────────────────────────────────────────────────────────
/** Aggregated stats across all tables of an MTT slot */
function calcMttStats(tables: PokerRoom[]) {
  const allActive = tables.flatMap(t => t.players.filter(p => p.status !== 'out'))
  const playerCount = allActive.length
  const tableCount  = tables.length
  const avgStack    = playerCount > 0
    ? Math.round(allActive.reduce((s, p) => s + p.stack, 0) / playerCount)
    : MTT_STACK
  return { playerCount, tableCount, avgStack }
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function GameLobbyPage() {
  const router = useRouter()

  const [uid,  setUid]  = useState<string | null>(null)
  const [name, setName] = useState("")
  const [icon, setIcon] = useState<string | null>(null)

  // SnG
  const [sngQueue,    setSngQueue]    = useState<QueueEntry[]>([])
  const [inSngQueue,  setInSngQueue]  = useState(false)
  // sngMatching: true while in matching flow (persists even after queue is cleared at match time)
  const [sngMatching, setSngMatching] = useState(false)

  // MTT
  const [mttTables,     setMttTables]     = useState<PokerRoom[]>([])
  const [mttNextTables, setMttNextTables] = useState<PokerRoom[]>([])
  const [joiningMtt,    setJoiningMtt]    = useState(false)
  // Initialize to 0 for SSR; set to real value in useEffect to avoid hydration mismatch
  const [now, setNow] = useState(0)

  // ── Auth ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    return auth.onAuthStateChanged(async user => {
      if (!user) { router.push('/login'); return }
      setUid(user.uid)
      const snap = await getDoc(doc(db, 'users', user.uid))
      const d = snap.data()
      setName(d?.name ?? user.displayName ?? 'Player')
      setIcon(d?.iconUrl ?? null)
    })
  }, [router])

  // ── Clock tick (1s) — initialize on mount to avoid hydration mismatch ────
  useEffect(() => {
    setNow(Date.now())  // set real value after client hydration
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  // ── Current and next MTT slot ────────────────────────────────────────────
  // nowReal: fall back to current time until client has hydrated (now===0 on SSR)
  const nowReal      = now > 0 ? now : Date.now()
  const curSlotTime  = getMttSlotTime(nowReal)
  const curSlotId    = getMttSlotId(curSlotTime)
  const curRegClose  = getMttRegCloseTime(curSlotTime)
  const msToRc       = curRegClose - nowReal
  const isRegOpen    = msToRc > 0

  // Next slot (30 min later)
  const nextSlotTime = curSlotTime + 30 * 60 * 1000
  const nextSlotId   = getMttSlotId(nextSlotTime)

  // ── MTT tables listener (current slot) ──────────────────────────────────
  useEffect(() => {
    const q = query(
      collection(db, 'pokerRooms'),
      where('type', '==', 'mtt'),
      where('mttSlotId', '==', curSlotId),
    )
    return onSnapshot(q, snap => {
      setMttTables(snap.docs.map(d => ({ id: d.id, ...d.data() } as PokerRoom)))
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curSlotId])

  // ── MTT tables listener (next slot, so we can show it too) ──────────────
  useEffect(() => {
    const q = query(
      collection(db, 'pokerRooms'),
      where('type', '==', 'mtt'),
      where('mttSlotId', '==', nextSlotId),
    )
    return onSnapshot(q, snap => {
      setMttNextTables(snap.docs.map(d => ({ id: d.id, ...d.data() } as PokerRoom)))
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextSlotId])

  // ── SnG queue listener ────────────────────────────────────────────────────
  useEffect(() => {
    return onSnapshot(doc(db, 'matchmaking', 'sng'), snap => {
      const data = snap.data() as QueueDoc | undefined
      const players = data?.players ?? []
      setSngQueue(players)
      if (uid) setInSngQueue(players.some(p => p.uid === uid))
    })
  }, [uid])

  // ── Watch for SnG matched room ───────────────────────────────────────────
  // IMPORTANT: use sngMatching (not inSngQueue) as the condition.
  // When 6 players match, the queue is cleared → inSngQueue becomes false.
  // If we used inSngQueue here, the listener would be cleaned up before
  // matched_{uid} fires, and nobody would get redirected.
  // sngMatching stays true until redirect or explicit cancel.
  useEffect(() => {
    if (!uid || !sngMatching) return
    const unsub = onSnapshot(doc(db, 'matchmaking', `matched_${uid}`), snap => {
      if (snap.exists()) {
        const roomId = snap.data()?.roomId
        if (roomId) {
          deleteDoc(doc(db, 'matchmaking', `matched_${uid}`)).catch(() => {})
          setSngMatching(false)
          router.push(`/home/game/${roomId}`)
        }
      }
    })
    return () => unsub()
  }, [uid, sngMatching, router])

  // ── SnG: join queue ───────────────────────────────────────────────────────
  const joinSngQueue = useCallback(async () => {
    if (!uid || sngMatching) return
    setSngMatching(true)  // enter matching flow immediately
    try {
      await runTransaction(db, async tx => {
        const queueRef  = doc(db, 'matchmaking', 'sng')
        const queueSnap = await tx.get(queueRef)
        const queueData = (queueSnap.data() ?? { players: [] }) as QueueDoc
        let players     = queueData.players ?? []
        if (players.some(p => p.uid === uid)) return

        const me: QueueEntry = { uid, name, iconUrl: icon, joinedAt: Date.now() }
        players = [...players, me]

        if (players.length >= SNG_REQUIRED) {
          // 6 players ready — create room and notify all
          const batch     = players.slice(0, SNG_REQUIRED)
          const remaining = players.slice(SNG_REQUIRED)
          const [sb, bb]  = SNG_BLINDS[0]
          const roomRef   = doc(collection(db, 'pokerRooms'))
          tx.set(roomRef, {
            type: 'sng', name: 'Sit & Go', status: 'waiting',
            maxPlayers: SNG_REQUIRED, startStack: 1000,
            players: batch.map((p, i) => ({
              uid: p.uid, name: p.name, iconUrl: p.iconUrl ?? null,
              seat: i, stack: 1000, status: 'waiting',
              bet: 0, handBet: 0, holeCards: [],
              isDealer: false, isSB: false, isBB: false,
            })),
            hand: 0, stage: 'waiting', communityCards: [], deck: [],
            pot: 0, currentBet: 0, currentSeat: 0, dealerSeat: 0,
            lastAction: '', lastActorSeat: -1, actionsInRound: 0,
            blindLevel: 0, smallBlind: sb, bigBlind: bb,
            levelStartMs: Date.now(),
            createdAt: serverTimestamp(), lastUpdated: serverTimestamp(),
          })
          for (const p of batch) {
            tx.set(doc(db, 'matchmaking', `matched_${p.uid}`), {
              roomId: roomRef.id, matchedAt: serverTimestamp(),
            })
          }
          tx.set(queueRef, { players: remaining, updatedAt: serverTimestamp() })
        } else {
          tx.set(queueRef, { players, updatedAt: serverTimestamp() })
        }
      })
      // sngMatching stays true — the matched_uid watcher will redirect when room is created
    } catch (e) {
      console.error(e)
      setSngMatching(false)  // reset only on error
    }
  }, [uid, name, icon, sngMatching])

  const leaveSngQueue = useCallback(async () => {
    if (!uid) return
    setSngMatching(false)
    await runTransaction(db, async tx => {
      const queueRef  = doc(db, 'matchmaking', 'sng')
      const queueSnap = await tx.get(queueRef)
      const data      = (queueSnap.data() ?? { players: [] }) as QueueDoc
      tx.set(queueRef, {
        players: (data.players ?? []).filter(p => p.uid !== uid),
        updatedAt: serverTimestamp(),
      })
    }).catch(() => {})
  }, [uid])

  // Cleanup on unmount: leave queue if still matching
  useEffect(() => () => { if (sngMatching) leaveSngQueue() }, [sngMatching, leaveSngQueue])

  // ── MTT: Play ─────────────────────────────────────────────────────────────
  const playMtt = useCallback(async () => {
    if (!uid || joiningMtt) return
    setJoiningMtt(true)
    try {
      // Decide which slot to register in
      // If current slot is still open → current; else → next slot
      const targetSlotId   = isRegOpen ? curSlotId   : nextSlotId
      const targetSlotTime = isRegOpen ? curSlotTime : nextSlotTime
      const targetRegClose = getMttRegCloseTime(targetSlotTime)

      const [sb, bb] = MTT_BLINDS[0]
      const newPlayerBase = {
        uid, name, iconUrl: icon ?? null,
        stack: MTT_STACK, status: 'waiting' as const,
        bet: 0, handBet: 0, holeCards: [],
        isDealer: false, isSB: false, isBB: false,
      }

      // Find tables for this slot
      const tablesQ = query(
        collection(db, 'pokerRooms'),
        where('type', '==', 'mtt'),
        where('mttSlotId', '==', targetSlotId),
      )
      const tablesSnap = await getDocs(tablesQ)
      const tables = tablesSnap.docs.map(d => ({ id: d.id, ...d.data() } as PokerRoom))

      // Already in a table for this slot?
      for (const t of tables) {
        if (t.players.some(p => p.uid === uid)) {
          router.push(`/home/game/${t.id}`); return
        }
      }

      // Find a table with room (< MTT_TABLE_MAX)
      const joinableTable = tables.find(t =>
        t.players.filter(p => p.status !== 'out').length < MTT_TABLE_MAX
      )

      if (joinableTable) {
        // Join existing table (transaction for safety)
        await runTransaction(db, async tx => {
          const ref  = doc(db, 'pokerRooms', joinableTable.id!)
          const snap = await tx.get(ref)
          if (!snap.exists()) return
          const t    = snap.data() as PokerRoom
          const activePlayers = t.players.filter(p => p.status !== 'out')

          // Re-check still has room
          if (activePlayers.length >= MTT_TABLE_MAX) return

          const seat      = t.players.length
          const newPlayer = { ...newPlayerBase, seat }

          // If table is full after this join (9→10), split 5/5
          if (activePlayers.length + 1 > MTT_TABLE_MAX - 1) {
            // This shouldn't happen if we filter correctly, but guard anyway
            return
          }

          tx.update(ref, {
            players: [...t.players, newPlayer],
            lastUpdated: serverTimestamp(),
          })
        })
        router.push(`/home/game/${joinableTable.id}`)
        return
      }

      // No joinable table → create new table for this slot
      const newRef = await addDoc(collection(db, 'pokerRooms'), {
        type: 'mtt',
        name: `MTT ${formatSlotTime(targetSlotTime)}`,
        status: 'waiting',
        maxPlayers: MTT_TABLE_MAX,
        startStack: MTT_STACK,
        mttSlotId:    targetSlotId,
        mttSlotTime:  targetSlotTime,
        mttRegCloseAt: targetRegClose,
        players: [{ ...newPlayerBase, seat: 0 }],
        hand: 0, stage: 'waiting', communityCards: [], deck: [],
        pot: 0, currentBet: 0, currentSeat: 0, dealerSeat: 0,
        lastAction: '', lastActorSeat: -1, actionsInRound: 0,
        blindLevel: 0, smallBlind: sb, bigBlind: bb,
        levelStartMs: Date.now(),
        createdAt: serverTimestamp(), lastUpdated: serverTimestamp(),
      })
      router.push(`/home/game/${newRef.id}`)
    } catch (e) {
      console.error(e)
      setJoiningMtt(false)
    }
  }, [uid, name, icon, joiningMtt, router, isRegOpen, curSlotId, curSlotTime, nextSlotId, nextSlotTime])

  // ── Derived ───────────────────────────────────────────────────────────────
  const sngProgress  = Math.min(sngQueue.length, SNG_REQUIRED)
  const mttStats     = calcMttStats(mttTables)
  const rcProgress   = Math.max(0, Math.min(1, msToRc / (30 * 60 * 1000)))  // 0→1 progress
  const amInMtt      = mttTables.some(t => t.players.some(p => p.uid === uid))
  const myMttTable   = mttTables.find(t => t.players.some(p => p.uid === uid))

  // Display which slot is "active" for registration
  const displaySlotTime = isRegOpen ? curSlotTime : nextSlotTime
  const displaySlotId   = isRegOpen ? curSlotId   : nextSlotId
  const displayTables   = isRegOpen ? mttTables   : mttNextTables
  const displayStats    = calcMttStats(displayTables)
  const displayRcMs     = isRegOpen ? msToRc : getMttRegCloseTime(nextSlotTime) - now

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100dvh', background: '#0F172A', color: '#fff', fontFamily: 'inherit' }}>
      <style>{`
        @keyframes gUp  { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes ping  { 0%{transform:scale(1);opacity:0.8} 75%,100%{transform:scale(1.8);opacity:0} }
        @keyframes spin  { to{transform:rotate(360deg)} }
        .g0  { animation: gUp 0.28s ease-out both; }
        .g1  { animation: gUp 0.28s 0.07s ease-out both; }
        .g2  { animation: gUp 0.28s 0.14s ease-out both; }
        .itap { transition: opacity 0.15s, transform 0.15s; cursor: pointer; -webkit-tap-highlight-color: transparent; }
        .itap:active { opacity: 0.7; transform: scale(0.97); }
        .ping-ring { animation: ping 1.3s cubic-bezier(0,0,0.2,1) infinite; }
      `}</style>

      {/* ── Header ── */}
      <div style={{ background: 'rgba(15,23,42,0.95)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '0 16px', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 480, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12, height: 52 }}>
          <button onClick={() => router.back()} className="itap" style={{ background: 'none', border: 'none', color: '#F2A900', fontSize: 13, fontWeight: 600, padding: '0 4px' }}>
            ← 戻る
          </button>
          <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.12)' }}/>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 26, height: 26, borderRadius: 8, background: 'linear-gradient(135deg,#15803D,#0d4a1f)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>♠</div>
            <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.3px' }}>Meta Poker</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#F2A900', background: 'rgba(242,169,0,0.15)', borderRadius: 99, padding: '2px 7px' }}>BETA</span>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '16px 16px 120px' }}>

        {/* ── Hero ── */}
        <div className="g0" style={{ background: 'linear-gradient(135deg,rgba(21,128,61,0.15),rgba(15,23,42,0))', border: '1px solid rgba(21,128,61,0.2)', borderRadius: 20, padding: '18px 18px', marginBottom: 24 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#4ade80', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 5px' }}>No Limit Hold'em</p>
          <h1 style={{ fontSize: 21, fontWeight: 900, margin: '0 0 6px', letterSpacing: '-0.4px' }}>仮想マネー制ポーカー</h1>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', margin: 0 }}>自動マッチングで即座に対戦開始。スタッツは全て記録されます。</p>
        </div>

        {/* ══ SnG ══ */}
        <div className="g1" style={{ marginBottom: 20 }}>
          <SectionLabel>Sit &amp; Go</SectionLabel>

          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 20, overflow: 'hidden' }}>
            <div style={{ padding: '16px 18px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 16, fontWeight: 800, margin: '0 0 4px' }}>6-Max Sit &amp; Go</p>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', margin: 0, lineHeight: 1.5 }}>
                  6人揃い次第即スタート。スタック1,000 chips。
                </p>
                <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                  <StatChip icon={<FiAward size={10} style={{ color: '#F2A900' }}/>} label={`${SNG_BLINDS[0][0]}/${SNG_BLINDS[0][1]} スタート`}/>
                  <StatChip icon={<FiClock size={10}/>} label="10分 Level UP"/>
                </div>
              </div>
              {/* Progress ring */}
              <ProgressRing value={sngProgress} max={SNG_REQUIRED} active={sngProgress >= SNG_REQUIRED}/>
            </div>

            {/* Queue avatars */}
            {sngQueue.length > 0 && (
              <div style={{ padding: '0 18px 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
                {sngQueue.map(p => (
                  <div key={p.uid} style={{ position: 'relative' }}>
                    <PlayerAvatar player={p} isMe={p.uid === uid} size={32}/>
                    {p.uid === uid && sngMatching && (
                      <div style={{ position: 'absolute', inset: -3, borderRadius: '50%', border: '2px solid #F2A900', opacity: 0.5 }} className="ping-ring"/>
                    )}
                  </div>
                ))}
                {Array.from({ length: SNG_REQUIRED - sngQueue.length }).map((_, idx) => (
                  <div key={`e${idx}`} style={{ width: 32, height: 32, borderRadius: '50%', border: '2px dashed rgba(255,255,255,0.1)', flexShrink: 0 }}/>
                ))}
              </div>
            )}

            <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }}/>
            <div style={{ padding: '14px 18px' }}>
              {!sngMatching ? (
                <PlayButton onClick={joinSngQueue}>
                  <GiPokerHand size={18}/> Play SnG
                </PlayButton>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '6px 0' }}>
                    <Spinner/>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#F2A900' }}>
                      マッチング中… あと {SNG_REQUIRED - sngProgress} 人
                    </span>
                  </div>
                  <button onClick={leaveSngQueue} className="itap"
                    style={{ width: '100%', height: 40, borderRadius: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <FiX size={14}/> キャンセル
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ══ MTT ══ */}
        <div className="g2">
          <SectionLabel>MTT — マルチテーブルトーナメント</SectionLabel>

          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 20, overflow: 'hidden' }}>

            {/* Slot header + RC countdown */}
            <div style={{ padding: '14px 18px 10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 800 }}>
                    MTT {formatSlotTime(displaySlotTime)}
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#4ade80', background: 'rgba(74,222,128,0.1)', borderRadius: 99, padding: '2px 8px', border: '1px solid rgba(74,222,128,0.2)' }}>
                    受付中
                  </span>
                </div>
                {/* RC timer */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <FiClock size={11} style={{ color: displayRcMs < 5 * 60_000 ? '#f97316' : 'rgba(255,255,255,0.35)' }}/>
                  <span suppressHydrationWarning style={{ fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: displayRcMs < 5 * 60_000 ? '#f97316' : 'rgba(255,255,255,0.55)' }}>
                    RC {now > 0 ? formatCountdown(displayRcMs) : '--:--'}
                  </span>
                </div>
              </div>

              {/* RC progress bar */}
              <div style={{ height: 4, background: 'rgba(255,255,255,0.07)', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 99,
                  width: `${isRegOpen ? (rcProgress * 100).toFixed(1) : 100}%`,
                  background: displayRcMs < 5 * 60_000
                    ? 'linear-gradient(90deg,#f97316,#ef4444)'
                    : 'linear-gradient(90deg,#4ade80,#22c55e)',
                  transition: 'width 1s linear, background 0.5s',
                }}/>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)' }}>スタート</span>
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)' }}>RC（受付終了）</span>
              </div>
            </div>

            {/* Stats row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 0, borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              {[
                { icon: <FiUsers size={13}/>,     label: 'Players',   value: String(displayStats.playerCount),     hydration: false },
                { icon: <GiPokerHand size={13}/>, label: 'Tables',    value: String(displayStats.tableCount || (displayStats.playerCount > 0 ? 1 : 0)), hydration: false },
                { icon: <FiBarChart2 size={13}/>, label: 'Avg Stack', value: displayStats.playerCount > 0 ? displayStats.avgStack.toLocaleString() : '—', hydration: false },
                { icon: <FiClock size={13}/>,     label: 'RC閉切',   value: now > 0 ? formatCountdown(displayRcMs) : '--:--', hydration: true },
              ].map(({ icon, label, value, hydration }) => (
                <div key={label} style={{ padding: '12px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, borderRight: '1px solid rgba(255,255,255,0.06)' }}>
                  <span style={{ color: 'rgba(255,255,255,0.3)' }}>{icon}</span>
                  <span suppressHydrationWarning={hydration} style={{ fontSize: 14, fontWeight: 900, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
                  <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>{label}</span>
                </div>
              ))}
            </div>

            {/* Info */}
            <div style={{ padding: '12px 18px 0' }}>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', margin: 0, lineHeight: 1.6 }}>
                スタック <strong style={{ color: '#fff' }}>20,000 chips</strong>　·　4人揃い次第カード配布　·　9人満卓で自動テーブル分割　·　最後の1人まで継続
              </p>
            </div>

            {/* Registered player avatars */}
            {displayStats.playerCount > 0 && (
              <div style={{ padding: '10px 18px 0', display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                {displayTables.flatMap(t => t.players.filter(p => p.status !== 'out')).slice(0, 12).map((p, i) => (
                  <div key={`${p.uid}-${i}`} style={{ width: 26, height: 26, borderRadius: '50%', background: 'linear-gradient(135deg,#1e3a5f,#0f2744)', border: `1.5px solid ${p.uid === uid ? '#F2A900' : 'rgba(255,255,255,0.08)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                    {p.iconUrl
                      ? <img src={p.iconUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                      : <span style={{ fontSize: 9, fontWeight: 800, color: '#fff' }}>{p.name?.charAt(0) ?? '?'}</span>
                    }
                  </div>
                ))}
                {displayStats.playerCount > 12 && (
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginLeft: 4 }}>+{displayStats.playerCount - 12}</span>
                )}
              </div>
            )}

            {/* CTA */}
            <div style={{ padding: '14px 18px' }}>
              {amInMtt && myMttTable ? (
                <button onClick={() => router.push(`/home/game/${myMttTable.id}`)} className="itap"
                  style={{ width: '100%', height: 50, borderRadius: 14, background: 'rgba(74,222,128,0.1)', border: '1.5px solid rgba(74,222,128,0.3)', color: '#4ade80', fontSize: 15, fontWeight: 900, letterSpacing: '-0.2px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  テーブルに戻る →
                </button>
              ) : (
                <PlayButton onClick={playMtt} disabled={joiningMtt}>
                  {joiningMtt
                    ? <><Spinner/> 参加中…</>
                    : <><GiPokerHand size={18}/> Play MTT</>
                  }
                </PlayButton>
              )}
            </div>

            {/* Next slot preview */}
            <div style={{ padding: '0 18px 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>次のスロット:</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)' }}>
                MTT {formatSlotTime(isRegOpen ? nextSlotTime : nextSlotTime + 30 * 60_000)} — RC終了後に自動開放
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.08em', textTransform: 'uppercase', margin: 0 }}>{children}</p>
      <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }}/>
    </div>
  )
}

function StatChip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', gap: 3 }}>
      {icon} {label}
    </span>
  )
}

function ProgressRing({ value, max, active }: { value: number; max: number; active: boolean }) {
  const pct = value / max
  const C   = 2 * Math.PI * 24  // circumference for r=24
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0 }}>
      <div style={{ position: 'relative', width: 56, height: 56 }}>
        <svg viewBox="0 0 56 56" style={{ position: 'absolute', inset: 0 }}>
          <circle cx="28" cy="28" r="24" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="4"/>
          <circle cx="28" cy="28" r="24" fill="none"
            stroke={active ? '#4ade80' : '#F2A900'} strokeWidth="4" strokeLinecap="round"
            strokeDasharray={`${pct * C} ${C}`} transform="rotate(-90 28 28)"
            style={{ transition: 'stroke-dasharray 0.4s ease' }}
          />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 16, fontWeight: 900, lineHeight: 1, color: active ? '#4ade80' : '#fff' }}>{value}</span>
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)' }}>/{max}</span>
        </div>
      </div>
      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>待機中</span>
    </div>
  )
}

function PlayerAvatar({ player, isMe, size }: { player: { name: string; iconUrl?: string | null }; isMe: boolean; size: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: 'linear-gradient(135deg,#15803D,#0d4a1f)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: isMe ? '2px solid #F2A900' : '2px solid rgba(255,255,255,0.1)', overflow: 'hidden', flexShrink: 0 }}>
      {player.iconUrl
        ? <img src={player.iconUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
        : <span style={{ fontSize: size * 0.35, fontWeight: 800, color: '#fff' }}>{player.name?.charAt(0) ?? '?'}</span>
      }
    </div>
  )
}

function PlayButton({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick} disabled={disabled} className="itap"
      style={{ width: '100%', height: 50, borderRadius: 14, background: disabled ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg,#F2A900,#D4910A)', border: 'none', color: disabled ? 'rgba(255,255,255,0.3)' : '#000', fontSize: 15, fontWeight: 900, letterSpacing: '-0.2px', boxShadow: disabled ? 'none' : '0 4px 16px rgba(242,169,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
      {children}
    </button>
  )
}

function Spinner() {
  return <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.2)', borderTopColor: 'rgba(255,255,255,0.7)', animation: 'spin 0.7s linear infinite' }}/>
}
