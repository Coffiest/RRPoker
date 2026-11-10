"use client"

import { Pause, Play, Spade } from 'lucide-react'
import Loader from "@/components/Loader"
import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { doc, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { FiShare2 } from "react-icons/fi"
import { PlayingCard } from "@/components/PlayingCard"
import HandTable, { actionBadge } from "@/components/HandTable"
import { buildHandReplay } from "@/lib/handReplay"

const ACT_JP: Record<string, string> = {
  fold: "fold", check: "check", call: "call", bet: "bet", raise: "raise", allin: "All-in",
}
const CLR = {
  bg: "#FFFBF5", white: "#FFFFFF", surface: "#F5F3EF", border: "#E8E3DB",
  gold: "#F2A900", goldDk: "#D4910A", ink: "#1D1D1F", gray2: "#545458", gray3: "#6E6E73",
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
    <div className="min-h-screen flex items-center justify-center" style={{ background: "transparent" }}>
      <Loader />
    </div>
  )

  if (!hand) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "transparent" }}>
      <div className="text-center px-6">
        <div className="mb-4 flex justify-center"><Spade size={40} strokeWidth={2} color="#6E6E73" aria-hidden /></div>
        <p className="term-comment text-[18px] font-semibold" style={{ color: CLR.ink }}>ハンドが見つかりません</p>
        <p className="text-[13px] mt-1" style={{ color: CLR.gray3 }}>このリンクは無効です</p>
      </div>
    </div>
  )

  const allActs    = hand.actions ?? []
  const totalSteps = allActs.length
  const rPositions = hand.playerPositions ?? [...new Set(allActs.map(a => a.position))]

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
    <main className="min-h-screen pb-12" style={{ background: "transparent" }}>
      <div className="mx-auto max-w-sm px-4 pt-6">

        {/* Header */}
        <div className="flex items-start justify-between mb-4 gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-[20px] font-bold truncate" style={{ color: CLR.ink }}>
              {hand.title || "ハンドレビュー"}
            </h1>
            <p className="text-[12px] mt-1" style={{ color: CLR.gray3 }}>
              {hand.creatorName} · {formatDate(hand.createdAt?.seconds)}
            </p>
          </div>
          <button onClick={share}
            className="shrink-0 flex items-center gap-2 rounded-2xl px-4 py-2 text-[13px] font-semibold text-white shadow-md active:scale-95 transition-all"
            style={{ background: `linear-gradient(135deg,${CLR.gold},${CLR.goldDk})` }}>
            <FiShare2 size={14} />
            {copied ? "コピー完了" : "シェア"}
          </button>
        </div>

        {/* Info badges */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-[11px] font-bold rounded-full px-2 py-1"
            style={{ background: "#FFF8E7", color: CLR.goldDk }}>{hand.heroPosition}</span>
          <span className="text-[11px] rounded-full px-2 py-1"
            style={{ background: CLR.surface, color: CLR.gray2 }}>{rPositions.length}人</span>
        </div>

        {/* 卓(ハンド記録と同じ。PokerART の卓を金・白で。components/HandTable.tsx) */}
        <div className="mb-4 -mx-2">
          <HandTable
            height={360}
            anchorPos={hand.heroPosition || "BTN"}
            board={[...flop, turn, river]}
            boardCount={river ? 5 : turn ? 4 : flop.length > 0 ? 3 : 0}
            pot={(() => { const st = buildHandReplay(hand)[replayStep]; return st ? `POT ${st.snapshot.pot} BB` : null })()}
            seats={rPositions.map(pos => {
              const act = seatActMap[pos]
              const isHero = pos === hand.heroPosition
              return {
                pos,
                cards: isHero ? (hand.heroCards ?? []) : (hand.villainCards?.[pos] ?? []),
                dim: foldedSeats.has(pos),
                turn: curAct?.position === pos,
                hero: isHero,
                // 札はいまのストリートのアクションだけ(PokerART と同じ)
                badge: act && (act.street === curAct?.street || act.action === "fold") ? actionBadge(act) : null,
              }
            })}
          />
        </div>

        {/* Replay controls */}
        <div className="flex items-center justify-center gap-4 mb-4">
          <button onClick={() => { setReplayStep(0); setReplayPlaying(false) }}
            className="w-8 h-8 rounded-full flex items-center justify-center active:scale-95"
            style={{ background: CLR.surface, color: CLR.gray2, fontSize: 13 }}>⟪</button>
          <button onClick={() => setReplayStep(s => Math.max(0, s - 1))}
            className="w-8 h-8 rounded-full flex items-center justify-center active:scale-95"
            style={{ background: CLR.surface, color: CLR.gray2, fontSize: 14 }}>‹</button>
          <button onClick={() => setReplayPlaying(p => !p)}
            className="w-10 h-10 rounded-full flex items-center justify-center active:scale-95"
            style={{ background: `linear-gradient(135deg,${CLR.gold},${CLR.goldDk})`, color: "#fff", fontSize: 16, boxShadow: "0 3px 12px rgba(242,169,0,0.4)" }}>
            {replayPlaying ? <Pause size={16} strokeWidth={2} aria-hidden /> : <Play size={16} strokeWidth={2} aria-hidden />}
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
        <div className="space-y-4">
          {streets.map(st => {
            const stActs  = allActs.filter(a => a.street === st)
            const stLabel = { preflop: "プリフロップ", flop: "フロップ", turn: "ターン", river: "リバー" }[st]
            return (
              <div key={st}>
                <p className="text-[10px] font-bold mb-2" style={{ color: CLR.gray3 }}>{stLabel}</p>
                <div className="space-y-1">
                  {stActs.map((a, i) => {
                    const globalIdx = allActs.indexOf(a)
                    const isCurrent = globalIdx === replayStep - 1
                    const isFuture  = globalIdx > replayStep - 1
                    const isHeroAct = a.position === hand.heroPosition
                    return (
                      <div key={i} className="flex items-center gap-2 rounded-2xl px-4 py-2 transition-all"
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
                          <span className="ml-auto text-[9px] font-bold rounded-full px-2 py-px"
                            style={{ background: CLR.gold, color: "#fff" }}>NOW</span>
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
            className="inline-flex items-center gap-2 h-11 px-6 rounded-full text-[14px] font-bold active:scale-95 transition-all"
            style={{ background: `linear-gradient(135deg,${CLR.gold},${CLR.goldDk})`, color: "#fff", textDecoration: "none", boxShadow: "0 3px 14px rgba(242,169,0,0.4)" }}>
            RRPOKERを使ってみる ›
          </a>
        </div>

      </div>
    </main>
  )
}
