"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { doc, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { FiShare2 } from "react-icons/fi"

const SUIT_SYM: Record<string, string> = { s: "♠", h: "♥", d: "♦", c: "♣" }
const SUIT_CLR: Record<string, string> = { s: "#374151", h: "#e84040", d: "#3b7dd8", c: "#2da44e" }
const ACT_JP: Record<string, string> = {
  fold: "フォールド", check: "チェック", call: "コール",
  bet: "ベット", raise: "レイズ", allin: "オールイン",
}

function CardBadge({ card, size = "md" }: { card: string; size?: "sm" | "md" | "lg" }) {
  if (!card || card.length < 2) return (
    <span className="inline-flex items-center justify-center rounded-lg border-2 border-dashed border-gray-200 text-gray-300" style={{ width: size === "sm" ? 28 : size === "lg" ? 44 : 36, height: size === "sm" ? 36 : size === "lg" ? 54 : 44, fontSize: 10 }}>?</span>
  )
  const rank = card.slice(0, -1)
  const suit = card.slice(-1)
  const color = SUIT_CLR[suit] ?? "#374151"
  const w = size === "sm" ? 28 : size === "lg" ? 44 : 36
  const h = size === "sm" ? 36 : size === "lg" ? 54 : 44
  const fs = size === "sm" ? 10 : size === "lg" ? 14 : 12
  return (
    <span className="inline-flex flex-col items-center justify-center rounded-lg border border-gray-200 bg-white shadow-sm font-bold leading-tight"
      style={{ width: w, height: h, fontSize: fs, color }}>
      <span>{rank}</span>
      <span>{SUIT_SYM[suit]}</span>
    </span>
  )
}

type HandData = {
  creatorName: string
  createdAt?: { seconds?: number }
  title: string
  stakes: { sb: number; bb: number }
  heroPosition: string
  playerPositions: string[]
  heroCards: string[]
  villainCards: Record<string, string[]>
  board: { flop: string[] | null; turn: string | null; river: string | null }
  actions: { street: string; position: string; action: string; amount?: number }[]
  note: string
}

export default function HandPage() {
  const params = useParams()
  const handId = params?.handId as string
  const [hand, setHand] = useState<HandData | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!handId) return
    getDoc(doc(db, "handHistories", handId))
      .then(snap => { if (snap.exists()) setHand(snap.data() as HandData) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [handId])

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

  const formatDate = (seconds?: number) => {
    if (!seconds) return ""
    const d = new Date(seconds * 1000)
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`
  }

  if (loading) return (
    <div className="min-h-screen bg-[#FFFBF5] flex items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#F2A900] border-t-transparent" />
    </div>
  )

  if (!hand) return (
    <div className="min-h-screen bg-[#FFFBF5] flex items-center justify-center">
      <div className="text-center px-6">
        <p className="text-[40px] mb-3">🃏</p>
        <p className="text-[18px] font-semibold text-gray-900">ハンドが見つかりません</p>
        <p className="text-[13px] text-gray-400 mt-1">このリンクは無効です</p>
      </div>
    </div>
  )

  const streets = [
    { key: "preflop", label: "プリフロップ" },
    ...(hand.board.flop ? [{ key: "flop", label: "フロップ" }] : []),
    ...(hand.board.turn ? [{ key: "turn", label: "ターン" }] : []),
    ...(hand.board.river ? [{ key: "river", label: "リバー" }] : []),
  ]

  return (
    <main className="min-h-screen bg-[#FFFBF5] pb-12">
      <div className="mx-auto max-w-sm px-4 pt-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-5 gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-[20px] font-bold text-gray-900 truncate">{hand.title || "ハンドレビュー"}</h1>
            <p className="text-[12px] text-gray-400 mt-0.5">{hand.creatorName} · {formatDate(hand.createdAt?.seconds)}</p>
          </div>
          <button
            onClick={share}
            className="shrink-0 flex items-center gap-1.5 rounded-2xl bg-[#F2A900] px-4 py-2.5 text-[13px] font-semibold text-white shadow-md active:scale-95 transition-all"
          >
            <FiShare2 size={14} />
            {copied ? "コピー完了" : "シェア"}
          </button>
        </div>

        {/* Basic Info */}
        <div className="bg-white rounded-3xl p-4 mb-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-6 flex-wrap">
            <div className="text-center">
              <p className="text-[10px] text-gray-400">ステークス</p>
              <p className="text-[14px] font-bold text-gray-900">{hand.stakes.sb}/{hand.stakes.bb}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-gray-400">ポジション</p>
              <p className="text-[14px] font-bold text-[#D4910A]">{hand.heroPosition}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-gray-400">人数</p>
              <p className="text-[14px] font-bold text-gray-900">{(hand.playerPositions ?? []).length}人</p>
            </div>
          </div>
        </div>

        {/* Cards */}
        <div className="bg-white rounded-3xl p-4 mb-4 shadow-sm border border-gray-100">
          <p className="text-[12px] font-semibold text-gray-500 mb-3">カード</p>

          <div className="mb-3">
            <p className="text-[11px] text-gray-400 font-medium mb-1.5">ヒーロー ({hand.heroPosition})</p>
            <div className="flex gap-1.5">
              {(hand.heroCards ?? []).map((c, i) => <CardBadge key={i} card={c} size="lg" />)}
            </div>
          </div>

          {(hand.board.flop || hand.board.turn || hand.board.river) && (
            <div className="mb-3">
              <p className="text-[11px] text-gray-400 font-medium mb-1.5">ボード</p>
              <div className="flex gap-1.5 flex-wrap items-end">
                {(hand.board.flop ?? []).map((c, i) => <CardBadge key={`f${i}`} card={c} size="lg" />)}
                {hand.board.turn && <><span className="text-gray-300 self-center text-[16px]">|</span><CardBadge card={hand.board.turn} size="lg" /></>}
                {hand.board.river && <><span className="text-gray-300 self-center text-[16px]">|</span><CardBadge card={hand.board.river} size="lg" /></>}
              </div>
            </div>
          )}

          {Object.keys(hand.villainCards ?? {}).length > 0 && (
            <div>
              <p className="text-[11px] text-gray-400 font-medium mb-1.5">ヴィランカード</p>
              <div className="space-y-1.5">
                {Object.entries(hand.villainCards ?? {}).map(([pos, cards]) => (
                  <div key={pos} className="flex items-center gap-2">
                    <span className="text-[12px] text-gray-600 font-semibold w-12 shrink-0">{pos}</span>
                    <div className="flex gap-1">
                      {cards.map((c, i) => <CardBadge key={i} card={c} />)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Actions by street */}
        {streets.map(({ key, label }) => {
          const streetActions = (hand.actions ?? []).filter(a => a.street === key)
          if (streetActions.length === 0) return null
          return (
            <div key={key} className="bg-white rounded-3xl p-4 mb-4 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[12px] font-semibold text-gray-500">{label}</p>
                <div className="flex gap-1">
                  {key === "flop" && (hand.board.flop ?? []).map((c, i) => <CardBadge key={i} card={c} size="sm" />)}
                  {key === "turn" && hand.board.turn && <CardBadge card={hand.board.turn} size="sm" />}
                  {key === "river" && hand.board.river && <CardBadge card={hand.board.river} size="sm" />}
                </div>
              </div>
              <div className="space-y-1.5">
                {streetActions.map((a, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className={`text-[11px] font-bold w-12 shrink-0 ${a.position === hand.heroPosition ? "text-[#D4910A]" : "text-gray-500"}`}>{a.position}</span>
                    <span className={`text-[13px] font-semibold ${a.action === "fold" ? "text-gray-400" : a.action === "allin" ? "text-red-500" : "text-gray-800"}`}>
                      {ACT_JP[a.action] ?? a.action}
                      {a.amount ? ` ${a.amount.toLocaleString()}` : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}

        {/* Note */}
        {hand.note && (
          <div className="bg-white rounded-3xl p-4 mb-4 shadow-sm border border-gray-100">
            <p className="text-[12px] font-semibold text-gray-500 mb-2">メモ</p>
            <p className="text-[13px] text-gray-700 leading-relaxed whitespace-pre-wrap">{hand.note}</p>
          </div>
        )}

        <p className="text-center text-[11px] text-gray-300 mt-6">Powered by RRPOKER</p>
      </div>
    </main>
  )
}
