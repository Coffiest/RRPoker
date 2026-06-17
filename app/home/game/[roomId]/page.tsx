"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { auth, db } from "@/lib/firebase"
import { doc, onSnapshot, runTransaction, serverTimestamp, getDoc } from "firebase/firestore"
import {
  PokerRoom, PokerPlayer, ActionType,
  startHand, processAction, getValidActions, isRed, getBotAction,
  SNG_BLINDS, MTT_BLINDS, LEVEL_DURATION_MS,
} from "@/lib/poker"
import { FiArrowLeft, FiUsers, FiClock } from "react-icons/fi"
import { GiTrophy } from "react-icons/gi"

// ── Portrait poker table seat positions ────────────────────────────────────────
// Players arranged in circle around table, optimized for portrait orientation
function getTableSeatPosition(relSeat: number, total: number): React.CSSProperties {
  // For portrait table: arrange players around oval table
  // 0 (local) = bottom center
  // Others arranged clockwise from top

  const positions6 = [
    { bottom: '2%',  left: '50%', transform: 'translateX(-50%)' },     // 0: bottom (local)
    { top: '8%',   left: '50%', transform: 'translateX(-50%)' },       // 1: top
    { top: '25%',  left: '8%' },                                        // 2: top-left
    { top: '25%',  right: '8%' },                                       // 3: top-right
    { bottom: '20%', left: '10%' },                                     // 4: bottom-left
    { bottom: '20%', right: '10%' },                                    // 5: bottom-right
  ]

  const positions9 = [
    { bottom: '2%',  left: '50%', transform: 'translateX(-50%)' },     // 0: bottom (local)
    { top: '5%',   left: '50%', transform: 'translateX(-50%)' },       // 1: top
    { top: '18%',  left: '10%' },                                       // 2: top-left
    { top: '28%',  left: '4%' },                                        // 3: left-upper
    { bottom: '28%', left: '4%' },                                      // 4: left-lower
    { bottom: '18%', left: '10%' },                                     // 5: bottom-left
    { bottom: '5%', right: '50%', transform: 'translateX(50%)' },      // 6: not used for 6-max
    { top: '18%',  right: '10%' },                                      // 7: top-right
    { top: '28%',  right: '4%' },                                       // 8: right-upper
  ]

  const map = total <= 6 ? positions6 : positions9
  return (map[relSeat] ?? map[0]) as React.CSSProperties
}

// ── Card component ─────────────────────────────────────────────────────────────
function CardView({ card, hidden, small }: { card?: any; hidden?: boolean; small?: boolean }) {
  const w = small ? 28 : 38
  const h = small ? 38 : 52
  const fs = small ? 9 : 13
  if (hidden || !card) {
    return (
      <div style={{ width: w, height: h, borderRadius: 6, background: 'linear-gradient(135deg,#1e3a5f,#0f2744)', border: '1.5px solid rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: small ? 10 : 14, opacity: 0.3 }}>♠</span>
      </div>
    )
  }
  const red = isRed(card)
  return (
    <div style={{ width: w, height: h, borderRadius: 6, background: '#fff', border: '1px solid rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.3)', gap: 0 }}>
      <span style={{ fontSize: fs, fontWeight: 800, color: red ? '#dc2626' : '#1a1a1a', lineHeight: 1, letterSpacing: '-0.5px' }}>
        {card.rank === 14 ? 'A' : card.rank === 13 ? 'K' : card.rank === 12 ? 'Q' : card.rank === 11 ? 'J' : card.rank === 10 ? '10' : card.rank}
      </span>
      <span style={{ fontSize: fs + 2, color: red ? '#dc2626' : '#1a1a1a', lineHeight: 1 }}>
        {card.suit === 'S' ? '♠' : card.suit === 'H' ? '♥' : card.suit === 'D' ? '♦' : '♣'}
      </span>
    </div>
  )
}

// ── Player slot ────────────────────────────────────────────────────────────────
function PlayerSlot({ player, isCurrent, isLocal, potSize }: { player: PokerPlayer | null; isCurrent: boolean; isLocal: boolean; potSize: number }) {
  if (!player) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        padding: '6px 4px',
        background: 'rgba(0,0,0,0.15)',
        borderRadius: 10
      }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', border: '2px dashed rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <FiUsers size={12} style={{ color: 'rgba(255,255,255,0.1)' }}/>
        </div>
        <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.15)', fontWeight: 600 }}>空席</span>
      </div>
    )
  }
  const folded  = player.status === 'folded'
  const out     = player.status === 'out'
  const allIn   = player.status === 'allIn'

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 3,
      padding: '6px 4px',
      background: 'rgba(0,0,0,0.25)',
      borderRadius: 10,
      opacity: folded || out ? 0.5 : 1
    }}>
      {/* Avatar */}
      <div style={{ position: 'relative' }}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%',
          border: `2px solid ${isCurrent ? '#F2A900' : isLocal ? '#4ade80' : 'rgba(255,255,255,0.1)'}`,
          background: player.iconUrl ? 'none' : 'linear-gradient(135deg,#15803D,#0d4a1f)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: isCurrent ? '0 0 12px rgba(242,169,0,0.6)' : isLocal ? '0 0 8px rgba(74,222,128,0.3)' : 'none',
          transition: 'border-color 0.3s, box-shadow 0.3s',
          overflow: 'hidden',
        }}>
          {player.iconUrl
            ? <img src={player.iconUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
            : <span style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>{player.name?.charAt(0) ?? '?'}</span>
          }
        </div>
        {player.isDealer && (
          <div style={{ position: 'absolute', bottom: -3, right: -3, width: 16, height: 16, borderRadius: '50%', background: '#F2A900', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: '#000', boxShadow: '0 1px 4px rgba(0,0,0,0.3)' }}>D</div>
        )}
        {allIn && (
          <div style={{ position: 'absolute', top: -3, right: -3, width: 16, height: 16, borderRadius: '50%', background: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 7, fontWeight: 800, color: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.3)' }}>ALL</div>
        )}
      </div>
      {/* Name */}
      <span style={{ fontSize: 9, fontWeight: 700, color: isLocal ? '#4ade80' : '#fff', maxWidth: 52, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }}>
        {player.name}
      </span>
      {/* Stack */}
      <span style={{ fontSize: 9, fontWeight: 700, color: out ? '#ef4444' : allIn ? '#f97316' : 'rgba(255,255,255,0.75)', fontVariantNumeric: 'tabular-nums', textAlign: 'center' }}>
        {out ? 'BUSTED' : allIn ? 'ALL-IN' : player.stack.toLocaleString().slice(0, 10)}
      </span>
      {/* Current bet */}
      {player.bet > 0 && !out && (
        <div style={{ background: 'rgba(242,169,0,0.2)', border: '0.5px solid rgba(242,169,0,0.4)', borderRadius: 5, padding: '1px 5px' }}>
          <span style={{ fontSize: 8, fontWeight: 700, color: '#FFD700', fontVariantNumeric: 'tabular-nums' }}>{player.bet.toLocaleString().slice(0, 6)}</span>
        </div>
      )}
    </div>
  )
}

// ── Main table page ────────────────────────────────────────────────────────────
export default function PokerTablePage() {
  const params   = useParams()
  const roomId   = params.roomId as string
  const router   = useRouter()
  const [uid, setUid]     = useState<string | null>(null)
  const [room, setRoom]   = useState<PokerRoom | null>(null)
  const [raiseAmt, setRaiseAmt] = useState("")
  const [acting, setActing]     = useState(false)
  const [showdown, setShowdown] = useState(false)
  const autoNextRef = useRef<NodeJS.Timeout | null>(null)

  // Auth
  useEffect(() => {
    return auth.onAuthStateChanged(user => {
      if (!user) { router.push('/login'); return }
      setUid(user.uid)
    })
  }, [router])

  // Real-time room listener
  useEffect(() => {
    if (!roomId) return
    return onSnapshot(doc(db, 'pokerRooms', roomId), snap => {
      if (!snap.exists()) { router.push('/home/game'); return }
      const data = { id: snap.id, ...snap.data() } as PokerRoom
      setRoom(data)
      if (data.stage === 'showdown') setShowdown(true)
      else setShowdown(false)
    })
  }, [roomId, router])

  // Auto-start logic
  // SnG: starts when all seats are filled (maxPlayers)
  // MTT: starts when 4+ active (non-out) players are seated; below 4 → waiting state
  useEffect(() => {
    if (!room || !uid) return
    const activeCnt = room.players.filter(p => p.status !== 'out').length
    const isFirst   = room.players[0]?.uid === uid

    if (room.type === 'sng' && room.status === 'waiting' && activeCnt >= room.maxPlayers) {
      if (isFirst) triggerStartHand()
    }
    if (room.type === 'mtt' && room.status === 'waiting' && activeCnt >= 4) {
      if (isFirst) triggerStartHand()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.players.length, room?.status])

  // Auto next hand after showdown
  useEffect(() => {
    if (!showdown || !room || !uid) return
    if (autoNextRef.current) clearTimeout(autoNextRef.current)
    autoNextRef.current = setTimeout(() => {
      const myPlayer = room.players.find(p => p.uid === uid)
      if (myPlayer && room.players[0]?.uid === uid) {
        triggerStartHand()
      }
    }, 3500)
    return () => { if (autoNextRef.current) clearTimeout(autoNextRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showdown])

  // Blind level up
  useEffect(() => {
    if (!room || room.status !== 'active') return
    const interval = setInterval(() => {
      const elapsed = Date.now() - (room.levelStartMs ?? Date.now())
      const levelDuration = LEVEL_DURATION_MS[room.type]
      if (elapsed >= levelDuration && room.players[0]?.uid === uid) {
        const nextLevel = room.blindLevel + 1
        const blindTable = room.type === 'sng' ? SNG_BLINDS : MTT_BLINDS
        if (nextLevel < blindTable.length) {
          runTransaction(db, async tx => {
            const ref = doc(db, 'pokerRooms', roomId)
            const snap = await tx.get(ref)
            if (!snap.exists()) return
            const d = snap.data() as PokerRoom
            tx.update(ref, {
              blindLevel: nextLevel,
              smallBlind: blindTable[nextLevel][0],
              bigBlind: blindTable[nextLevel][1],
              levelStartMs: Date.now(),
              lastUpdated: serverTimestamp(),
            })
          }).catch(() => {})
        }
      }
    }, 15000)
    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.levelStartMs, room?.status])

  const triggerStartHand = useCallback(async () => {
    if (!roomId) return
    await runTransaction(db, async tx => {
      const ref = doc(db, 'pokerRooms', roomId)
      const snap = await tx.get(ref)
      if (!snap.exists()) return
      const current = { id: snap.id, ...snap.data() } as PokerRoom
      if (current.stage === 'preflop') return // already started
      const newState = startHand(current)
      tx.update(ref, { ...newState, status: 'active', startedAt: serverTimestamp(), lastUpdated: serverTimestamp() })
    })
  }, [roomId])

  const takeAction = useCallback(async (action: ActionType, raiseAmount?: number) => {
    if (!roomId || !uid || acting) return
    setActing(true)
    try {
      await runTransaction(db, async tx => {
        const ref = doc(db, 'pokerRooms', roomId)
        const snap = await tx.get(ref)
        if (!snap.exists()) return
        const current = { id: snap.id, ...snap.data() } as PokerRoom
        const myPlayer = current.players.find(p => p.uid === uid)
        if (!myPlayer) return
        const amt = action === 'raise' ? (raiseAmount ?? (Number(raiseAmt) || current.currentBet * 2)) : undefined
        const next = processAction(current, myPlayer.seat, action, amt)
        tx.update(ref, { ...next, lastUpdated: serverTimestamp() })
      })
      setRaiseAmt("")
    } finally {
      setActing(false)
    }
  }, [roomId, uid, acting, raiseAmt])

  // Bot auto-play (for testing/demo)
  useEffect(() => {
    if (!room || !uid) return
    const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')
    const isTestBot = params.get('testBot') === 'true' || params.get('bots') === 'true'
    if (!isTestBot) return

    const botRef = useRef<NodeJS.Timeout | null>(null)
    if (botRef.current) clearTimeout(botRef.current)

    // Check if current turn is a bot player
    const currentPlayer = room.players.find(p => p.seat === room.currentSeat)
    if (currentPlayer && currentPlayer.uid.startsWith('bot_') && room.stage !== 'showdown' && room.stage !== 'waiting') {
      botRef.current = setTimeout(() => {
        const botAction = getBotAction(room, room.currentSeat)
        const action = typeof botAction === 'string' ? botAction : botAction.action
        const amount = typeof botAction === 'string' ? undefined : botAction.amount
        takeAction(action, amount).catch(() => {})
      }, 500 + Math.random() * 1000)
    }

    return () => { if (botRef.current) clearTimeout(botRef.current) }
  }, [room?.currentSeat, room?.stage, uid, takeAction])

  if (!room || !uid) {
    return (
      <div style={{ minHeight: '100dvh', background: '#0F172A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid rgba(242,169,0,0.3)', borderTopColor: '#F2A900', animation: 'spin 0.8s linear infinite' }}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  const myPlayer = room.players.find(p => p.uid === uid)
  const mySeat   = myPlayer?.seat ?? 0
  const isMyTurn = room.stage !== 'waiting' && room.stage !== 'showdown' && room.currentSeat === mySeat && myPlayer?.status === 'active'
  const validActions = isMyTurn ? getValidActions(room, mySeat) : []
  const toCall   = room.currentBet - (myPlayer?.bet ?? 0)
  const minRaise = room.currentBet * 2

  // Relative seat ordering (my seat always at position 0 in rendering)
  const totalSeats = room.maxPlayers
  const orderedSeats = Array.from({ length: totalSeats }, (_, i) => (mySeat + i) % totalSeats)
  const playerMap: Record<number, PokerPlayer> = {}
  for (const p of room.players) playerMap[p.seat] = p

  const isWaiting = room.status === 'waiting'

  return (
    <div style={{ height: '100dvh', background: '#0F172A', color: '#fff', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: 'inherit' }}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes dealIn{from{opacity:0;transform:scale(0.5) translateY(-20px)}to{opacity:1;transform:scale(1) translateY(0)}}
        .deal-card{animation:dealIn 0.25s ease-out both;}
        .itap{transition:opacity 0.15s,transform 0.15s;cursor:pointer;-webkit-tap-highlight-color:transparent;}
        .itap:active{opacity:0.7;transform:scale(0.96);}
      `}</style>

      {/* ── Top bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(0,0,0,0.4)', flexShrink: 0 }}>
        <button onClick={() => router.push('/home/game')} className="itap"
          style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 13, padding: 0 }}>
          <FiArrowLeft size={14}/> ロビー
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.3)' }}>{room.name}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(242,169,0,0.1)', borderRadius: 99, padding: '3px 8px', border: '1px solid rgba(242,169,0,0.2)' }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#F2A900' }}>Lv.{room.blindLevel + 1}</span>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{room.smallBlind}/{room.bigBlind}</span>
          </div>
          {room.hand > 0 && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>Hand #{room.hand}</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <FiUsers size={12} style={{ color: 'rgba(255,255,255,0.3)' }}/>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{room.players.length}/{room.maxPlayers}</span>
        </div>
      </div>

      {/* ── Table area (Portrait/Vertical) ── */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        padding: '12px',
        gap: 8,
        minHeight: 0,
        overflowY: 'auto',
        background: 'linear-gradient(180deg, #0f5c28 0%, #15803d 50%, #0d3018 100%)',
        position: 'relative'
      }}>
        {/* Content container */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Community cards + Pot */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            {/* Pot */}
            {room.pot > 0 && (
              <div style={{ background: 'rgba(0,0,0,0.5)', borderRadius: 99, padding: '4px 12px', border: '1px solid rgba(255,255,255,0.1)' }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: '#F2A900', fontVariantNumeric: 'tabular-nums' }}>
                  Pot: {room.pot.toLocaleString()}
                </span>
              </div>
            )}

            {/* Community cards */}
            {room.communityCards.length > 0 ? (
              <div style={{ display: 'flex', gap: 3, justifyContent: 'center', flexWrap: 'wrap' }}>
                {room.communityCards.map((card, i) => (
                  <div key={i} className="deal-card" style={{ animationDelay: `${i * 0.08}s` }}>
                    <CardView card={card} small={false}/>
                  </div>
                ))}
                {room.stage === 'preflop' && [0,1,2,3,4].map(i => <CardView key={i} hidden/>)}
                {room.stage === 'flop'   && [0,1].map(i => <CardView key={i} hidden/>)}
                {room.stage === 'turn'   && <CardView hidden/>}
              </div>
            ) : (
              room.stage !== 'waiting' && (
                <div style={{ height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>準備中...</span>
                </div>
              )
            )}
          </div>

          {/* Last action */}
          {room.lastAction && (
            <div style={{ background: 'rgba(0,0,0,0.45)', borderRadius: 8, padding: '4px 10px', alignSelf: 'center', maxWidth: 200 }}>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', textAlign: 'center', display: 'block', lineHeight: 1.4 }}>{room.lastAction}</span>
            </div>
          )}

          {/* Players around table (absolute positioning) */}
          <div style={{ position: 'relative', width: '100%', aspectRatio: '3/4', minHeight: 280 }}>
            {orderedSeats.map((seat, relIdx) => {
              const player = playerMap[seat]
              const seatPos = getTableSeatPosition(relIdx, totalSeats)
              const isCurr = room.currentSeat === seat && room.stage !== 'waiting' && room.stage !== 'showdown'
              const isMe   = seat === mySeat
              return (
                <div key={seat} style={{ position: 'absolute', ...seatPos }}>
                  <PlayerSlot player={player ?? null} isCurrent={isCurr} isLocal={isMe} potSize={room.pot}/>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── My cards + action panel ── */}
      <div style={{ flexShrink: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(20px)', borderTop: '1px solid rgba(255,255,255,0.06)', padding: '12px 14px', paddingBottom: 'max(12px, env(safe-area-inset-bottom, 12px))' }}>

        {isWaiting ? (
          /* Waiting for players */
          (() => {
            const activeCnt  = room.players.filter(p => p.status !== 'out').length
            const needMore   = room.type === 'mtt' ? Math.max(0, 4 - activeCnt) : Math.max(0, room.maxPlayers - activeCnt)
            const isMttPause = room.type === 'mtt' && activeCnt < 4  // 3人以下は待機
            return (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '8px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid rgba(242,169,0,0.3)', borderTopColor: '#F2A900', animation: 'spin 0.8s linear infinite' }}/>
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>
                    {isMttPause
                      ? `あと ${needMore} 人でゲーム開始 (${activeCnt}/9)`
                      : `プレイヤーを待機中… ${activeCnt}/${room.maxPlayers}`
                    }
                  </span>
                </div>
                {/* Progress dots: MTT shows 4-player threshold */}
                <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                  {room.type === 'mtt' ? (
                    <>
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: i < activeCnt ? '#4ade80' : 'rgba(255,255,255,0.15)' }}/>
                      ))}
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginLeft: 4 }}>4人で開始</span>
                    </>
                  ) : (
                    Array.from({ length: room.maxPlayers }).map((_, i) => (
                      <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: i < activeCnt ? '#4ade80' : 'rgba(255,255,255,0.15)' }}/>
                    ))
                  )}
                </div>
                {/* MTT: 待機中プレイヤーに座席確保メッセージ */}
                {isMttPause && (
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', margin: 0, textAlign: 'center' }}>
                    席を確保しました。他のプレイヤーが揃い次第カードを配ります。
                  </p>
                )}
                {/* Manual start (SnG only, first player) */}
                {room.type === 'sng' && activeCnt >= 2 && room.players[0]?.uid === uid && (
                  <button onClick={triggerStartHand} className="itap"
                    style={{ height: 40, padding: '0 20px', borderRadius: 99, background: 'rgba(242,169,0,0.15)', border: '1.5px solid rgba(242,169,0,0.4)', color: '#F2A900', fontSize: 13, fontWeight: 700, marginTop: 4 }}>
                    ゲームを開始する ({activeCnt}人)
                  </button>
                )}
              </div>
            )
          })()

        ) : showdown ? (
          /* Showdown result */
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            {/* Show all cards */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
              {room.players.filter(p => p.status !== 'out' && p.holeCards.length > 0).map(p => {
                const isWinner = room.winners?.some(w => w.seat === p.seat)
                return (
                  <div key={p.seat} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: isWinner ? '#F2A900' : 'rgba(255,255,255,0.4)' }}>
                        {p.name}
                      </span>
                      {isWinner && <GiTrophy size={10} style={{ color: '#F2A900' }}/>}
                    </div>
                    <div style={{ display: 'flex', gap: 3 }}>
                      {p.holeCards.map((c, i) => <CardView key={i} card={c} small/>)}
                    </div>
                    {room.winners?.find(w => w.seat === p.seat)?.handName && (
                      <span style={{ fontSize: 8, color: '#F2A900', fontWeight: 600 }}>
                        {room.winners.find(w => w.seat === p.seat)?.handName}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
            <div style={{ width: 120, height: 2, background: 'rgba(255,255,255,0.08)', borderRadius: 1 }}/>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(242,169,0,0.3)', borderTopColor: '#F2A900', animation: 'spin 0.8s linear infinite' }}/>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>次のハンドを準備中…</span>
            </div>
          </div>

        ) : (
          /* Game actions */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* My hole cards */}
            {myPlayer && myPlayer.holeCards.length > 0 && myPlayer.status !== 'folded' && myPlayer.status !== 'out' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  {myPlayer.holeCards.map((card, i) => (
                    <div key={i} className="deal-card" style={{ animationDelay: `${i * 0.1}s` }}>
                      <CardView card={card}/>
                    </div>
                  ))}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#fff', margin: 0 }}>{myPlayer.name}</p>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', margin: '2px 0 0', fontVariantNumeric: 'tabular-nums' }}>
                    Stack: {myPlayer.stack.toLocaleString()}
                    {myPlayer.isSB && ' · SB'}
                    {myPlayer.isBB && ' · BB'}
                    {myPlayer.isDealer && ' · BTN'}
                  </p>
                </div>
              </div>
            )}

            {/* Action buttons */}
            {isMyTurn && validActions.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {/* Raise amount input */}
                {validActions.includes('raise') && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: '0 10px', height: 36, border: '1px solid rgba(255,255,255,0.08)' }}>
                      <input
                        type="number" value={raiseAmt}
                        onChange={e => setRaiseAmt(e.target.value)}
                        placeholder={`Min ${minRaise.toLocaleString()}`}
                        inputMode="numeric"
                        style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: '#fff', fontSize: 13, fontFamily: 'inherit' }}
                      />
                    </div>
                    {[2, 3, 4].map(x => (
                      <button key={x} onClick={() => setRaiseAmt(String(room.bigBlind * x))} className="itap"
                        style={{ height: 36, padding: '0 10px', borderRadius: 9, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 600 }}>
                        {x}BB
                      </button>
                    ))}
                  </div>
                )}
                {/* Action buttons row */}
                <div style={{ display: 'flex', gap: 8 }}>
                  {validActions.includes('fold') && (
                    <button onClick={() => takeAction('fold')} disabled={acting} className="itap"
                      style={{ flex: 1, height: 46, borderRadius: 13, background: 'rgba(239,68,68,0.12)', border: '1.5px solid rgba(239,68,68,0.3)', color: '#ef4444', fontSize: 13, fontWeight: 800 }}>
                      フォールド
                    </button>
                  )}
                  {validActions.includes('check') && (
                    <button onClick={() => takeAction('check')} disabled={acting} className="itap"
                      style={{ flex: 1, height: 46, borderRadius: 13, background: 'rgba(255,255,255,0.08)', border: '1.5px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: 13, fontWeight: 800 }}>
                      チェック
                    </button>
                  )}
                  {validActions.includes('call') && toCall > 0 && (
                    <button onClick={() => takeAction('call')} disabled={acting} className="itap"
                      style={{ flex: 1, height: 46, borderRadius: 13, background: 'rgba(34,197,94,0.15)', border: '1.5px solid rgba(34,197,94,0.35)', color: '#4ade80', fontSize: 13, fontWeight: 800 }}>
                      コール {toCall.toLocaleString()}
                    </button>
                  )}
                  {validActions.includes('raise') && (
                    <button onClick={() => takeAction('raise')} disabled={acting} className="itap"
                      style={{ flex: 1, height: 46, borderRadius: 13, background: 'linear-gradient(135deg,#F2A900,#D4910A)', border: 'none', color: '#000', fontSize: 13, fontWeight: 800, boxShadow: '0 3px 12px rgba(242,169,0,0.35)' }}>
                      レイズ
                    </button>
                  )}
                  {validActions.includes('allin') && (
                    <button onClick={() => takeAction('allin')} disabled={acting} className="itap"
                      style={{ flex: 1, height: 46, borderRadius: 13, background: 'rgba(249,115,22,0.15)', border: '1.5px solid rgba(249,115,22,0.4)', color: '#f97316', fontSize: 13, fontWeight: 800 }}>
                      オールイン
                    </button>
                  )}
                </div>
              </div>
            ) : myPlayer?.status === 'folded' ? (
              <div style={{ textAlign: 'center', padding: '8px 0' }}>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', fontWeight: 600 }}>フォールド済み — 他のプレイヤーのアクションを待っています</span>
              </div>
            ) : myPlayer?.status === 'allIn' ? (
              <div style={{ textAlign: 'center', padding: '8px 0' }}>
                <span style={{ fontSize: 12, color: '#f97316', fontWeight: 700 }}>オールイン — ショーダウンを待っています</span>
              </div>
            ) : myPlayer?.status === 'out' ? (
              <div style={{ textAlign: 'center', padding: '8px 0' }}>
                <span style={{ fontSize: 13, color: '#ef4444', fontWeight: 700 }}>バスト — ゲーム終了</span>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '6px 0' }}>
                <FiClock size={13} style={{ color: 'rgba(255,255,255,0.25)' }}/>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
                  {room.players.find(p => p.seat === room.currentSeat)?.name ?? '他のプレイヤー'}のターン
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
