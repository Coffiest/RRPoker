"use client"
import { ClubIcon, DiamondIcon, HeartIcon, SpadeIcon } from 'lucide-react'

import { useState, type CSSProperties } from "react"

/**
 * トランプの描画。絵柄は PokerART(Meta---GEO)と同じ `public/cards/` の画像をそのまま使う。
 * RRPoker 内のカード表示はすべてこの部品を通すこと(デザインを1箇所に揃えるため)。
 *
 * カードの表記は "As" "Th" "10h" "Kd" のように「ランク+スート(s/h/d/c)」。
 * ランクは A/K/Q/J/T/2-10 を受け付ける。
 */

const SUIT_ICON = { s: SpadeIcon, h: HeartIcon, d: DiamondIcon, c: ClubIcon } as const
// 画像のデザインに合わせた4色デッキ(スペード=黒, ハート=赤, ダイヤ=青, クラブ=緑)
const SUIT_COLOR: Record<string, string> = { s: "#1D1D1F", h: "#E53E3A", d: "#1546D9", c: "#16A34A" }

/** 画像のファイル名規則(`public/cards/{1-13}{suit}.png`、1=A, 10=T, 11=J, 12=Q, 13=K)に変換する。 */
function cardToAssetName(card: string): string {
  const suit = card.slice(-1).toLowerCase()
  const rank = card.slice(0, -1).toUpperCase()
  const num =
    rank === "A" ? 1 : rank === "K" ? 13 : rank === "Q" ? 12 : rank === "J" ? 11 : rank === "T" ? 10 : rank
  return `${num}${suit}`
}

/* カード画像の実寸。表と裏で比率が違うので、枠は面ごとに自分の比率を持つ
   (共通の比率に押し込むと、どちらかが切り抜かれるかレターボックスされる)。 */
const FACE_ASPECT = 744 / 1039 // public/cards/{1-13}{suit}.png
const BACK_ASPECT = 744 / 982 // public/cards/back_v3.png(scripts/card-back.py が書き出す寸法)

function CardFace({ card, height }: { card: string; height: number }) {
  const [imgFailed, setImgFailed] = useState(false)
  const box: CSSProperties = {
    height,
    width: Math.round(height * FACE_ASPECT),
    borderRadius: Math.min(6, height * 0.2),
  }

  if (!imgFailed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- 小さな静的画像なので素のimgでよい
      <img
        src={`/cards/${cardToAssetName(card)}.png`}
        alt={card}
        draggable={false}
        onError={() => setImgFailed(true)}
        className="block select-none object-contain"
        style={{ ...box, boxShadow: "0 0 0 1px rgba(0,0,0,0.4), 0 1px 3px rgba(0,0,0,0.18)" }}
      />
    )
  }

  const suit = card.slice(-1).toLowerCase()
  return (
    <span
      className="inline-flex flex-col items-center justify-center font-bold leading-none select-none"
      style={{ ...box, background: "#FFFFFF", border: "1px solid #E8E3DB", color: SUIT_COLOR[suit], fontSize: Math.max(11, height * 0.3) }}
    >
      <span>{card.slice(0, -1)}</span>
      {(() => { const Icon = SUIT_ICON[suit as keyof typeof SUIT_ICON]; return Icon ? <Icon size={Math.max(8, height * 0.3)} fill="currentColor" strokeWidth={0} /> : null })()}
    </span>
  )
}

/**
 * 伏せカード。絵柄は原画 `public/cards/back_source.jpg` から `scripts/card-back.py` が
 * 書き出した `public/cards/back_v3.png`(744×982)。
 * 絵に角丸と白い縁が描き込まれていて台紙の黒は透過済みなので、CSSで一切クリップしない
 * (角丸・枠・影を付けると四隅が削れて見える)。
 */
function CardBack({ height }: { height: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/cards/back_v3.png"
      alt=""
      draggable={false}
      className="block select-none object-contain"
      style={{ height, width: Math.round(height * BACK_ASPECT) }}
    />
  )
}

export function PlayingCard({
  card,
  height = 30,
  faceDown = false,
  className,
  style,
}: {
  card?: string | null
  /** 表示する高さ(px)。幅は面ごとの比率から決まる。 */
  height?: number
  faceDown?: boolean
  className?: string
  style?: CSSProperties
}) {
  return (
    <span className={`inline-flex shrink-0 align-middle ${className ?? ""}`} style={style}>
      {faceDown || !card ? <CardBack height={height} /> : <CardFace card={card} height={height} />}
    </span>
  )
}

export default PlayingCard
