"use client"

/**
 * 姉妹アプリ「Poker ART」の告知バナー(RRPokerのプレイヤーホームに掲出)。
 *
 * 白背景のカードに、Poker ART のリポジトリ公式アイコン(/pokerart-icon.png)と
 * アンバーゴールドのアクセントを合わせた、RRPoker の暖色クリーム背景に馴染む意匠。
 * タップすると Poker ART 本体(https://meta-geo-poker.vercel.app)へ遷移する。
 *
 * 「無料で遊べる本格トーナメント + GTO/GEO戦略ぶんせき」を簡潔に訴求し、遊んでみたいと
 * 思わせるコピーにしている。
 */
const POKER_ART_URL = "https://meta-geo-poker.vercel.app"

export default function PokerArtPromoBanner() {
  return (
    <a
      href={POKER_ART_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="姉妹アプリ Poker ART を無料でプレイする"
      className="relative block overflow-hidden rounded-3xl transition-transform active:scale-[0.985]"
      style={{ background: "#ffffff", boxShadow: "0 1px 2px rgba(0,0,0,0.04),0 12px 30px -16px rgba(0,0,0,0.18)", border: "1px solid rgba(10,10,10,0.08)" }}
    >
      {/* 上端の細いアンバーライン(Poker ART の黒×金アクセント)。 */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0"
        style={{ height: 3, background: "linear-gradient(90deg,#f2a900,#f7c548,#f2a900)" }}
      />

      <div className="relative p-4">
        <div className="flex items-center gap-3.5">
          {/* リポジトリ公式アイコン(スペード入りのPoker ARTマーク)。 */}
          <div
            className="grid shrink-0 place-items-center overflow-hidden rounded-2xl"
            style={{ width: 56, height: 56, background: "#ffffff", border: "1px solid rgba(10,10,10,0.10)" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/pokerart-icon.png" alt="Poker ART" style={{ width: 48, height: 48, objectFit: "contain" }} />
          </div>

          <div className="min-w-0 flex-1">
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.16em", color: "#737373" }}>
              無料で遊べる <span style={{ color: "#d4910a" }}>・</span> <span style={{ color: "#171717" }}>POKER ART</span>
            </p>
            <h3 className="font-display" style={{ color: "#0a0a0a", fontSize: 18, fontWeight: 800, lineHeight: 1.2, marginTop: 3 }}>
              本格トーナメントを、指先で。
            </h3>
            <p style={{ color: "#525252", fontSize: 11.5, lineHeight: 1.55, marginTop: 4 }}>
              バーチャルチップのNLHトーナメント(SNG/MTT)を無料でプレイ。GTO/GEO戦略ぶんせきで、遊びながら強くなる。
            </p>
          </div>
        </div>

        <div className="mt-3.5 flex items-center justify-between">
          <span
            className="inline-flex items-center gap-1.5 rounded-full"
            style={{ background: "#f2a900", color: "#0a0a0a", fontSize: 12, fontWeight: 700, padding: "6px 14px" }}
          >
            無料でプレイ
            <svg viewBox="0 0 24 24" fill="none" width="14" height="14" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span style={{ color: "#a3a3a3", fontSize: 10.5 }}>登録なしでもすぐ</span>
        </div>
      </div>
    </a>
  )
}
