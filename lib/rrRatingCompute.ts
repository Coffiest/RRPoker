// RR Rating(トナメ偏差値)の計算。副作用なしの純粋な関数だけを置く。
//
// 1. 各プレイヤーの ROI(倍率)= 獲得賞金 ÷ 支払った参加費(どちらも参加費1回分を1とした単位)
// 2. 参加回数が少ない人ほど全体平均へ寄せる(ベイズ的な縮小。k 回分の「平均的な成績」を足すのと同じ)
//    adjusted = n/(n+k) × ROI + k/(n+k) × 平均ROI
// 3. adjusted の平均と標準偏差(母集団)から偏差値を出す: 50 + 10 × (adjusted − 平均) ÷ 標準偏差
//
// 以前は 3 の平均に「縮小前の ROI の平均」を使っていたため、全体の平均がちょうど 50 にならず、
// 標準偏差もずれていた。ここでは縮小後の値の平均を使う。

export const RR_SHRINK_K = 20

export type RrInput = {
  userId: string
  /** 支払った参加費の合計(参加費1回分 = 1) */
  totalCost: number
  /** 獲得賞金の合計(参加費1回分 = 1) */
  totalReward: number
  /** 参加回数(エントリー + リエントリー) */
  plays: number
}

export type RrOutput = {
  userId: string
  /** ROI(%) */
  roiPercent: number
  /** 偏差値(小数第2位まで) */
  rrRating: number
}

export function computeRrRatings(inputs: RrInput[], k: number = RR_SHRINK_K): RrOutput[] {
  const players = inputs.filter(p => p.totalCost > 0)
  if (players.length === 0) return []

  const roi = players.map(p => p.totalReward / p.totalCost)
  const mu = roi.reduce((a, b) => a + b, 0) / players.length

  const adjusted = players.map((p, i) => {
    const n = Math.max(0, p.plays)
    return (n / (n + k)) * roi[i] + (k / (n + k)) * mu
  })
  const adjMean = adjusted.reduce((a, b) => a + b, 0) / players.length
  const sigma = Math.sqrt(adjusted.reduce((s, a) => s + (a - adjMean) ** 2, 0) / players.length)

  return players.map((p, i) => {
    const rr = sigma > 1e-12 ? 50 + 10 * ((adjusted[i] - adjMean) / sigma) : 50
    return {
      userId: p.userId,
      roiPercent: Number((roi[i] * 100).toFixed(2)),
      rrRating: Number(rr.toFixed(2)),
    }
  })
}

/**
 * 1つの大会の結果を、RR Rating の集計単位(参加費1回分 = 1)に直す。
 * 店舗の Pay Out 画面で以前から使っていた数え方と同じ。
 */
export function tournamentContribution(opts: {
  entryCount: number
  reentryCount: number
  addonCount: number
  entryFee: number
  reentryFee: number
  addonFee: number
  prize: number
}): { cost: number; reward: number; plays: number } | null {
  const { entryCount, reentryCount, addonCount, entryFee, reentryFee, addonFee, prize } = opts
  if (entryCount + reentryCount + addonCount === 0) return null
  const buyin = entryCount * entryFee + reentryCount * reentryFee + addonCount * addonFee
  const baseFee = entryFee > 0 ? entryFee : reentryFee > 0 ? reentryFee : addonFee
  if (!(baseFee > 0)) return null
  return {
    cost: buyin / baseFee,
    reward: prize / baseFee,
    plays: entryCount + reentryCount,
  }
}
