"use client"

/**
 * ハンド記録の卓(PokerART の卓のデザインを RRPoker の金・白で描き直したもの)。
 *
 * - 縦長の卓(スタジアム形)。自分(Hero)を一番下に置き、そこから時計回りに席を並べる。
 *   Hero が決まっていないときは BTN を一番下に置く。
 * - フェルトは白、レールは金(オーナー指定)。卓の中央に PokerART のロゴ、
 *   ディーラーボタンとベットのチップは PokerART の画像をそのまま使う(オーナー指定)。
 *   画像は public/table/(PokerART の apps/web/public/table/ から複製。ロゴは卓画像から切り出し)。
 * - 表示だけを受け持つ。記録の入力(HandHistoryModal)とリプレイ(履歴・共有ページ)の両方で使う。
 */

import type { CSSProperties } from "react"
import { PlayingCard } from "@/components/PlayingCard"

export type SeatBadgeTone = "raise" | "call" | "fold" | "allin" | "blind"
export type HandSeatView = {
  pos: string
  cards: (string | null | undefined)[]
  /** 前のストリートで降りた席など、卓に出さない席 */
  hidden?: boolean
  /** このストリートで降りた席(薄く出す) */
  dim?: boolean
  /** いまアクションする席(金の輪が脈打つ) */
  turn?: boolean
  /** 選んでいる席 */
  selected?: boolean
  hero?: boolean
  badge?: { text: string; tone: SeatBadgeTone } | null
  onClick?: () => void
}

type Props = {
  seats: HandSeatView[]
  /** 一番下に置く席(Hero、いなければ BTN) */
  anchorPos?: string | null
  board: (string | null | undefined)[]
  /** 見せるボードの枚数(0 / 3 / 4 / 5) */
  boardCount: number
  onBoardClick?: (index: number) => void
  pot?: string | null
  height?: number
}

/** アクションを卓の札(PokerART と同じ「Raise 6」「Call 2」「Fold」の形)にする */
export function actionBadge(a: { action: string; amount?: number }): { text: string; tone: SeatBadgeTone } {
  const amt = a.amount != null ? ` ${a.amount}` : ""
  switch (a.action) {
    case "raise": return { text: `Raise${amt}`, tone: "raise" }
    case "bet":   return { text: `Bet${amt}`, tone: "raise" }
    case "call":  return { text: `Call${amt}`, tone: "call" }
    case "check": return { text: "Check", tone: "blind" }
    case "fold":  return { text: "Fold", tone: "fold" }
    case "allin": return { text: `All In${amt}`, tone: "allin" }
    default:      return { text: a.action, tone: "blind" }
  }
}

const GOLD = "#F2A900"
const GOLD_DK = "#D4910A"

const BADGE_STYLE: Record<SeatBadgeTone, CSSProperties> = {
  raise: { background: "#FFF8E7", color: "#9A6200", border: "1px solid rgba(242,169,0,0.45)" },
  call: { background: "#FFFFFF", color: "#1C1C1E", border: "1px solid rgba(60,60,67,0.18)" },
  fold: { background: "#F2F2F7", color: "#545458", border: "1px solid rgba(60,60,67,0.12)" },
  allin: { background: "#FFF1F0", color: "#C62828", border: "1px solid rgba(229,62,58,0.45)" },
  blind: { background: "#FFFFFF", color: "#545458", border: "1px solid rgba(60,60,67,0.18)" },
}

/** 卓の上での席の位置(%)。rel=0 が一番下で、時計回り。 */
function seatPoint(rel: number, total: number) {
  const angle = Math.PI + (rel / total) * Math.PI * 2
  return { x: 50 + Math.sin(angle) * 39, y: 50 - Math.cos(angle) * 41 }
}

export default function HandTable({ seats, anchorPos, board, boardCount, onBoardClick, pot, height = 360 }: Props) {
  const total = seats.length
  const anchorIdx = Math.max(0, seats.findIndex(s => s.pos === (anchorPos ?? "BTN")))
  const btnIdx = seats.findIndex(s => s.pos === "BTN")
  const pointOf = (i: number) => seatPoint((i - anchorIdx + total) % total, total)
  const btnPt = btnIdx >= 0 ? pointOf(btnIdx) : null

  return (
    <div className="relative w-full select-none" style={{ height }}>
      {/* フェルト(白)とレール(金)。カードの上端に色の線を入れる意匠ではなく、卓そのものの縁 */}
      <div className="absolute" style={{
        left: "20%", right: "20%", top: "12%", bottom: "12%", borderRadius: 9999,
        background: "linear-gradient(135deg,#F2A900,#D4910A)", padding: 7,
        boxShadow: "0 10px 28px rgba(212,145,10,0.22), 0 2px 6px rgba(0,0,0,0.08)",
      }}>
        <div className="relative h-full w-full" style={{ borderRadius: 9999, background: "#FFFFFF", boxShadow: "inset 0 2px 10px rgba(0,0,0,0.06)" }}>
          <div className="absolute pointer-events-none" style={{ inset: 7, borderRadius: 9999, border: `1.5px solid rgba(242,169,0,0.55)` }} />
          {/* 中央: ポット・ボード・ロゴ */}
          <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ gap: 8, padding: "0 10%" }}>
            {pot && (
              <span className="tech-num rounded-full" style={{ padding: "2px 10px", fontSize: 10, fontWeight: 800, color: "#1C1C1E", background: "rgba(242,169,0,0.14)" }}>
                {pot}
              </span>
            )}
            {boardCount > 0 && (
              <div className="flex items-center" style={{ gap: 3 }}>
                {Array.from({ length: boardCount }).map((_, i) => {
                  const c = board[i]
                  const inner = c
                    ? <PlayingCard card={c} height={34} />
                    : <span style={{ width: 24, height: 34, borderRadius: 5, border: "1.5px dashed rgba(212,145,10,0.55)", background: "rgba(242,169,0,0.06)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "#9A6200" }}>?</span>
                  return onBoardClick
                    ? <button key={i} type="button" onClick={() => onBoardClick(i)} className="active:scale-95 transition-transform" style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}>{inner}</button>
                    : <span key={i}>{inner}</span>
                })}
              </div>
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/table/pokerart_logo.png" alt="Poker Art" draggable={false} style={{ width: "62%", maxWidth: 120, opacity: 0.55, marginTop: 4 }} />
          </div>
        </div>
      </div>

      {/* ディーラーボタン(PokerART の画像)。BTN の席から卓の中へ少し寄せた所 */}
      {btnPt && !seats[btnIdx]?.hidden && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src="/table/dealer_button_v1.png" alt="D" draggable={false} className="absolute pointer-events-none"
          style={{
            width: 20, height: 20, borderRadius: "50%", zIndex: 6, boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
            left: `${btnPt.x + (50 - btnPt.x) * 0.36}%`, top: `${btnPt.y + (50 - btnPt.y) * 0.36}%`, transform: "translate(-50%,-50%)",
          }} />
      )}

      {/* 席 */}
      {seats.map((s, i) => {
        if (s.hidden) return null
        const p = pointOf(i)
        const pill: CSSProperties = s.hero
          ? { background: "linear-gradient(135deg,#F2A900,#D4910A)", color: "#fff", border: "none" }
          : { background: "#fff", color: "#1C1C1E", border: s.selected || s.turn ? `2px solid ${GOLD}` : "1px solid rgba(60,60,67,0.16)" }
        const Tag = s.onClick ? "button" : "div"
        return (
          <Tag key={s.pos} type={s.onClick ? "button" : undefined} onClick={s.onClick}
            className={`absolute flex flex-col items-center ${s.onClick ? "active:scale-95" : ""}`}
            style={{
              left: `${p.x}%`, top: `${p.y}%`, transform: "translate(-50%,-50%)", zIndex: 10,
              opacity: s.dim ? 0.3 : 1, transition: "opacity 0.3s, transform 0.15s",
              background: "none", border: "none", padding: 0, cursor: s.onClick ? "pointer" : "default", minWidth: 44, minHeight: 44,
            }}>
            {/* 手札 */}
            <div className="flex" style={{ gap: 2, marginBottom: -6, position: "relative", zIndex: 1 }}>
              {[0, 1].map(k => <PlayingCard key={k} card={s.cards[k] ?? null} height={28} />)}
            </div>
            {/* 席の札(ポジション) */}
            <div className="relative flex items-center justify-center rounded-full" style={{
              ...pill, position: "relative", zIndex: 2, minWidth: 50, height: 22, padding: "0 10px",
              boxShadow: s.hero ? "0 3px 10px rgba(242,169,0,0.35)" : "0 2px 8px rgba(0,0,0,0.10)",
            }}>
              {s.turn && (
                <span className="absolute animate-ping rounded-full pointer-events-none" style={{ inset: -3, border: `2px solid ${GOLD}`, opacity: 0.5 }} />
              )}
              <span className="tech-num" style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.06em", color: s.hero ? "#fff" : s.selected || s.turn ? GOLD_DK : "#1C1C1E" }}>
                {s.pos}
              </span>
            </div>
            {/* アクションの札(PokerART と同じく、賭けた額にはチップの絵を添える) */}
            <div style={{ minHeight: 18, marginTop: 3 }}>
              {s.badge && (
                <span className="inline-flex items-center whitespace-nowrap rounded-full tech-num" style={{
                  ...BADGE_STYLE[s.badge.tone], gap: 3, fontSize: 9, fontWeight: 800, height: 18,
                  padding: s.badge.tone === "raise" || s.badge.tone === "call" || s.badge.tone === "allin" ? "0 7px 0 3px" : "0 7px",
                }}>
                  {(s.badge.tone === "raise" || s.badge.tone === "call") && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src="/table/chip_bet_v1.png" alt="" style={{ width: 12, height: 12 }} />
                  )}
                  {s.badge.tone === "allin" && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src="/table/allin_marker_v1.png" alt="" style={{ width: 13, height: 11 }} />
                  )}
                  {s.badge.text}
                </span>
              )}
            </div>
          </Tag>
        )
      })}
    </div>
  )
}
