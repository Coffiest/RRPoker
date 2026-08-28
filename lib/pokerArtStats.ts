/**
 * Poker ART(オンライン)側の成績を取りに行くクライアント。
 *
 * 認証は RRPoker の Firebase IDトークンをそのまま Bearer で送る。
 * Poker ART のサーバーは Firebase のトークンも受け付けるようになっている
 * (Meta---GEO の packages/server/src/firebaseAuth.ts)。
 */

/** Poker ART の対戦サーバー。 */
const SERVER_ORIGIN =
  process.env.NEXT_PUBLIC_POKERART_SERVER_ORIGIN ?? 'https://meta---geo.fly.dev'

export interface PokerArtRating {
  /** トナメ偏差値(平均50・標準偏差10)。ライブ側と同じ計算式。 */
  rrRating: number
  roi: number
  tournamentsPlayed: number
  nationalRank: number | null
  totalRankedPlayers: number
}

/**
 * Poker ART のトナメ偏差値を取得する。
 * 未ログイン・通信断・サーバー未設定のいずれでも null を返し、呼び出し側は
 * 「まだ数値が無い」として扱えばよい(ホームの他の情報は妨げない)。
 */
export async function fetchPokerArtRating(idToken: string): Promise<PokerArtRating | null> {
  try {
    const res = await fetch(`${SERVER_ORIGIN}/api/lobby/rr-rating`, {
      headers: { authorization: `Bearer ${idToken}` },
      cache: 'no-store',
    })
    if (!res.ok) return null
    return (await res.json()) as PokerArtRating
  } catch {
    return null
  }
}

export interface PokerArtStats {
  tournamentsPlayed: number
  itmCount: number
  itmRate: number
  totalBuyIns: number
  totalPayouts: number
  profit: number
  roi: number
  nationalRank: number | null
  totalRankedPlayers: number
  vpipRate: number
  pfrRate: number
  threeBetRate: number
}

/**
 * Poker ART の成績一式を取得する。
 * 取得できないときは null を返し、呼び出し側は「まだ記録が無い」として扱えばよい。
 */
export async function fetchPokerArtStats(idToken: string): Promise<PokerArtStats | null> {
  try {
    const res = await fetch(`${SERVER_ORIGIN}/api/lobby/stats`, {
      headers: { authorization: `Bearer ${idToken}` },
      cache: 'no-store',
    })
    if (!res.ok) return null
    return (await res.json()) as PokerArtStats
  } catch {
    return null
  }
}
