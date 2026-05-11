"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { doc, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { FiShare2 } from "react-icons/fi"

const SUIT_SYM: Record<string, string> = { s: "♠", h: "♥", d: "♦", c: "♣" }
const SUIT_CLR: Record<string, string> = { s: "#1D1D1F", h: "#E53E3A", d: "#2563EB", c: "#16A34A" }
const ACT_JP: Record<string, string> = {
  fold: "fold", check: "check", call: "call", bet: "bet", raise: "raise", allin: "All-in",
}
const CLR = {
  bg: "#FFFBF5", white: "#FFFFFF", surface: "#F5F3EF", border: "#E8E3DB",
  gold: "#F2A900", goldDk: "#D4910A", ink: "#1D1D1F", gray2: "#6E6E73", gray3: "#AEAEB2",
  red: "#E53E3A",
}

type HAction = { street: string; position: string; action: string; amount?: number }
type HandData = {
  creatorName: string
  createdAt?: { seconds?: number }
  title: string
  heroPosition: string
  playerPositions: string[]
  heroCards: string[]
  villainCards: Record<string, string[]>
  board: { flop: string[] | null; turn: string | null; river: string | null }
  actions: HAction[]
  notes?: Record<string, string>
}

function seatXY(posIdx: number, total: number, btnIdx: number, cx: number, cy: number, rx: number, ry: number) {
  const btn = btnIdx < 0 ? 0 : btnIdx
  const rel = (posIdx - btn + total) % total
  const angle = Math.PI + (rel / total) * Math.PI * 2
  return { x: cx + Math.sin(angle) * rx, y: cy - Math.cos(angle) * ry }
}

function formatDate(seconds?: number) {
  if (!seconds) return ""
  const d = new Date(seconds * 1000)
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`
}

export default function HandPage() {
  const params = useParams()
  const handId = params?.handId as string
  const [hand, setHand] = useState<HandData | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [replayStep, setReplayStep] = useState(0)
  const [replayPlaying, setReplayPlaying] = useState(false)

  useEffect(() => {
    if (!handId) return
    getDoc(doc(db, "handHistories", handId))
      .then(snap => { if (snap.exists()) setHand(snap.data() as HandData) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [handId])

  useEffect(() => {
    if (!hand || !replayPlaying) return
    const total = (hand.actions ?? []).length
    if (replayStep >= total) { setReplayPlaying(false); return }
    const timer = setTimeout(() => setReplayStep(s => s + 1), 2000)
    return () => clearTimeout(timer)
  }, [hand, replayPlaying, replayStep])

  const share = async () => {
    const url = `${window.location.origin}/hand/${handId}`
    if (navigator.share) {
      try { await navigator.share({ title: hand?.title || "ハンドレビュー", url }) } catch {}
    } else {
      try {
        await navigator.clipboard.writeText(url)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch {}
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: CLR.bg }}>
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
        style={{ borderColor: `${CLR.gold} transparent ${CLR.gold} ${CLR.gold}` }} />
    </div>
  )

  if (!hand) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: CLR.bg }}>
      <div className="text-center px-6">
        <p className="text-[40px] mb-3">🃏</p>
        <p className="text-[18px] font-semibold" style={{ color: CLR.ink }}>ハンドが見つかりません</p>
        <p className="text-[13px] mt-1" style={{ color: CLR.gray3 }}>このリンクは無効です</p>
      </div>
    </div>
  )

  const allActs    = hand.actions ?? []
  const totalSteps = allActs.length
  const rPositions = hand.playerPositions ?? [...new Set(allActs.map(a => a.position))]
  const rBtnIdx    = rPositions.indexOf("BTN")
  const cx = 160, cy = 100, rx = 126, ry = 76

  const shownActs = allActs.slice(0, replayStep)
  const curAct    = replayStep > 0 ? allActs[replayStep - 1] : null

  const seatActMap: Record<string, HAction> = {}
  shownActs.forEach(a => { seatActMap[a.position] = a })

  const foldedSeats = new Set(shownActs.filter(a => a.action === "fold").map(a => a.position))

  const hasFlopAct  = shownActs.some(a => a.street === "flop")
  const hasTurnAct  = shownActs.some(a => a.street === "turn")
  const hasRiverAct = shownActs.some(a => a.street === "river")
  const flop  = hasFlopAct  ? (hand.board?.flop  ?? []) : []
  const turn  = hasTurnAct  ? (hand.board?.turn  ?? null) : null
  const river = hasRiverAct ? (hand.board?.river ?? null) : null

  const streets = (["preflop", "flop", "turn", "river"] as const).filter(st =>
    allActs.some(a => a.street === st)
  )

  return (
    <main className="min-h-screen pb-12" style={{ background: CLR.bg }}>
      <div className="mx-auto max-w-sm px-4 pt-6">

        {/* Header */}
        <div className="flex items-start justify-between mb-4 gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-[20px] font-bold truncate" style={{ color: CLR.ink }}>
              {hand.title || "ハンドレビュー"}
            </h1>
            <p className="text-[12px] mt-0.5" style={{ color: CLR.gray3 }}>
              {hand.creatorName} · {formatDate(hand.createdAt?.seconds)}
            </p>
          </div>
          <button onClick={share}
            className="shrink-0 flex items-center gap-1.5 rounded-2xl px-4 py-2.5 text-[13px] font-semibold text-white shadow-md active:scale-95 transition-all"
            style={{ background: `linear-gradient(135deg,${CLR.gold},${CLR.goldDk})` }}>
            <FiShare2 size={14} />
            {copied ? "コピー完了" : "シェア"}
          </button>
        </div>

        {/* Info badges */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-[11px] font-bold rounded-full px-2.5 py-1"
            style={{ background: "#FFF8E7", color: CLR.goldDk }}>{hand.heroPosition}</span>
          <span className="text-[11px] rounded-full px-2.5 py-1"
            style={{ background: CLR.surface, color: CLR.gray2 }}>{rPositions.length}人</span>
        </div>

        {/* Oval table */}
        <div className="relative mb-3 rounded-[999px]"
          style={{ height: 204, background: "#F2EDE4", border: "1.5px solid #D8CEBD", boxShadow: "inset 0 2px 8px rgba(0,0,0,0.04)" }}>
          <div className="absolute rounded-[999px] pointer-events-none"
            style={{ inset: 8, border: "1px solid rgba(200,185,160,0.35)" }} />

          {/* Board cards */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
            {(flop.length > 0 || turn || river) && (
              <div className="flex items-center gap-1">
                {flop.map((c, i) => c ? (
                  <div key={i} className="flex flex-col items-center justify-center rounded-lg font-bold"
                    style={{ width: 22, height: 30, background: CLR.white, border: `1px solid ${CLR.border}`, color: SUIT_CLR[c.slice(-1)], fontSize: 8 }}>
                    <span className="text-[9px]">{c.slice(0, -1)}</span>
                    <span className="text-[8px]">{SUIT_SYM[c.slice(-1)]}</span>
                  </div>
                ) : null)}
                {turn && (
                  <>
                    <div style={{ width: 1, height: 16, background: "rgba(170,155,135,0.4)", margin: "0 2px" }} />
                    <div className="flex flex-col items-center justify-center rounded-lg font-bold"
                      style={{ width: 22, height: 30, background: CLR.white, border: `1px solid ${CLR.border}`, color: SUIT_CLR[turn.slice(-1)], fontSize: 8 }}>
                      <span className="text-[9px]">{turn.slice(0, -1)}</span>
                      <span className="text-[8px]">{SUIT_SYM[turn.slice(-1)]}</span>
                    </div>
                  </>
                )}
                {river && (
                  <>
                    <div style={{ width: 1, height: 16, background: "rgba(170,155,135,0.4)", margin: "0 2px" }} />
                    <div className="flex flex-col items-center justify-center rounded-lg font-bold"
                      style={{ width: 22, height: 30, background: CLR.white, border: `1px solid ${CLR.border}`, color: SUIT_CLR[river.slice(-1)], fontSize: 8 }}>
                      <span className="text-[9px]">{river.slice(0, -1)}</span>
                      <span className="text-[8px]">{SUIT_SYM[river.slice(-1)]}</span>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Seats */}
          {rPositions.map((pos, posIdx) => {
            const { x, y } = seatXY(posIdx, rPositions.length, rBtnIdx, cx, cy, rx, ry)
            const act      = seatActMap[pos]
            const isFolded = foldedSeats.has(pos)
            const isCur    = curAct?.position === pos
            const isHero   = pos === hand.heroPosition
            const hCards   = isHero ? (hand.heroCards ?? []) : (hand.villainCards?.[pos] ?? [])
            return (
              <div key={pos} className="absolute flex flex-col items-center"
                style={{ left: x - 20, top: y - 26, width: 40, opacity: isFolded ? 0.25 : 1, transition: "opacity 0.3s" }}>
                {isCur && (
                  <div className="absolute pointer-events-none" style={{ left: 0, top: 0, width: 40, height: 40 }}>
                    <div className="w-full h-full rounded-full animate-ping"
                      style={{ border: `2px solid ${CLR.gold}`, opacity: 0.5 }} />
                  </div>
                )}
                {isHero && (
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 text-[9px] z-10" style={{ color: CLR.gold }}>★</div>
                )}
                {pos === "BTN" && (
                  <div className="absolute -right-1 -top-0.5 w-4 h-4 rounded-full flex items-center justify-center z-10"
                    style={{ background: CLR.white, border: `1px solid ${CLR.border}`, fontSize: 6, fontWeight: 900, color: CLR.ink }}>D</div>
                )}
                <div className="w-[40px] h-[40px] rounded-full flex items-center justify-center"
                  style={{
                    background: isCur ? "#FFF8E7" : CLR.white,
                    border: isCur ? `2px solid ${CLR.gold}` : isHero ? `1.5px solid ${CLR.gold}` : `1.5px solid ${CLR.border}`,
                    boxShadow: isCur ? `0 0 0 3px rgba(242,169,0,0.18)` : undefined,
                  }}>
                  <div className="flex gap-[2px]">
                    {[0, 1].map(i => {
                      const c = hCards[i]
                      return (
                        <div key={i} className="rounded flex items-center justify-center font-bold"
                          style={{ width: 11, height: 15, background: c ? CLR.white : "rgba(200,190,175,0.35)", fontSize: 5, color: c ? SUIT_CLR[c.slice(-1)] : undefined }}>
                          {c ? SUIT_SYM[c.slice(-1)] : ""}
                        </div>
                      )
                    })}
                  </div>
                </div>
                {act && !isFolded && (
                  <div className="rounded-full px-1 py-px text-[7px] font-semibold mt-0.5 whitespace-nowrap"
                    style={{
                      background: act.action === "bet" || act.action === "raise" ? "#FFFBEB" : act.action === "allin" ? "#FFF5F5" : CLR.white,
                      border: `1px solid ${act.action === "bet" || act.action === "raise" ? "#FDE68A" : act.action === "allin" ? "#FCA5A5" : CLR.border}`,
                      color: act.action === "bet" || act.action === "raise" ? "#B45309" : act.action === "allin" ? CLR.red : CLR.gray2,
                    }}>
                    {ACT_JP[act.action]}{act.amount != null ? ` ${act.amount}` : ""}
                  </div>
                )}
                <span className="text-[7px] font-bold mt-0.5" style={{ color: isHero ? CLR.gold : CLR.gray2 }}>{pos}</span>
              </div>
            )
          })}
        </div>

        {/* Replay controls */}
        <div className="flex items-center justify-center gap-3 mb-4">
          <button onClick={() => { setReplayStep(0); setReplayPlaying(false) }}
            className="w-8 h-8 rounded-full flex items-center justify-center active:scale-95"
            style={{ background: CLR.surface, color: CLR.gray2, fontSize: 13 }}>⟪</button>
          <button onClick={() => setReplayStep(s => Math.max(0, s - 1))}
            className="w-8 h-8 rounded-full flex items-center justify-center active:scale-95"
            style={{ background: CLR.surface, color: CLR.gray2, fontSize: 14 }}>‹</button>
          <button onClick={() => setReplayPlaying(p => !p)}
            className="w-10 h-10 rounded-full flex items-center justify-center active:scale-95"
            style={{ background: `linear-gradient(135deg,${CLR.gold},${CLR.goldDk})`, color: CLR.ink, fontSize: 16, boxShadow: "0 3px 12px rgba(242,169,0,0.4)" }}>
            {replayPlaying ? "⏸" : "▶"}
          </button>
          <button onClick={() => setReplayStep(s => Math.min(s + 1, totalSteps))}
            className="w-8 h-8 rounded-full flex items-center justify-center active:scale-95"
            style={{ background: CLR.surface, color: CLR.gray2, fontSize: 14 }}>›</button>
          <button onClick={() => { setReplayStep(totalSteps); setReplayPlaying(false) }}
            className="w-8 h-8 rounded-full flex items-center justify-center active:scale-95"
            style={{ background: CLR.surface, color: CLR.gray2, fontSize: 13 }}>⟫</button>
          <span className="text-[11px] ml-1" style={{ color: CLR.gray3 }}>{replayStep}/{totalSteps}</span>
        </div>

        {/* Action text list — all shown, current highlighted */}
        <div className="space-y-3">
          {streets.map(st => {
            const stActs  = allActs.filter(a => a.street === st)
            const stLabel = { preflop: "プリフロップ", flop: "フロップ", turn: "ターン", river: "リバー" }[st]
            return (
              <div key={st}>
                <p className="text-[10px] font-bold mb-1.5" style={{ color: CLR.gray3 }}>{stLabel}</p>
                <div className="space-y-1">
                  {stActs.map((a, i) => {
                    const globalIdx = allActs.indexOf(a)
                    const isCurrent = globalIdx === replayStep - 1
                    const isFuture  = globalIdx > replayStep - 1
                    const isHeroAct = a.position === hand.heroPosition
                    return (
                      <div key={i} className="flex items-center gap-2 rounded-2xl px-3 py-2 transition-all"
                        style={{
                          background: isCurrent ? "#FFF8E7" : CLR.white,
                          border: isCurrent ? `1.5px solid ${CLR.gold}` : `1px solid ${CLR.surface}`,
                          opacity: isCurrent ? 1 : isFuture ? 0.28 : 0.65,
                        }}>
                        <span className="text-[11px] font-bold shrink-0"
                          style={{ color: isHeroAct ? CLR.goldDk : CLR.gray2 }}>{a.position}</span>
                        <span className="text-[11px]" style={{ color:
                          a.action === "fold" ? CLR.gray3 :
                          a.action === "bet" || a.action === "raise" ? "#B45309" :
                          a.action === "allin" ? CLR.red : CLR.ink }}>
                          {ACT_JP[a.action]}{a.amount != null ? ` ${a.amount} BB` : ""}
                        </span>
                        {isCurrent && (
                          <span className="ml-auto text-[9px] font-bold rounded-full px-1.5 py-px"
                            style={{ background: CLR.gold, color: CLR.ink }}>NOW</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {/* RRPoker CTA */}
        <div className="mt-8 text-center pb-8" style={{ borderTop: `1px solid ${CLR.border}`, paddingTop: 24 }}>
          <p className="text-[13px] mb-1 font-semibold" style={{ color: CLR.ink }}>このハンドはRRPOKERで記録されました</p>
          <p className="text-[12px] mb-4" style={{ color: CLR.gray2 }}>ポーカーのハンドを記録・共有しよう</p>
          <a href="/home"
            className="inline-flex items-center gap-1.5 h-11 px-6 rounded-full text-[14px] font-bold active:scale-95 transition-all"
            style={{ background: `linear-gradient(135deg,${CLR.gold},${CLR.goldDk})`, color: CLR.ink, textDecoration: "none", boxShadow: "0 3px 14px rgba(242,169,0,0.4)" }}>
            RRPOKERを使ってみる ›
          </a>
        </div>

      </div>
    </main>
  )
}
