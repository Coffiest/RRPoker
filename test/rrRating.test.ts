import { describe, expect, it } from "vitest"
import { computeRrRatings, tournamentContribution } from "../lib/rrRatingCompute"

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
const sd = (xs: number[]) => { const m = mean(xs); return Math.sqrt(mean(xs.map(x => (x - m) ** 2))) }

describe("computeRrRatings", () => {
  const sample = [
    { userId: "a", totalCost: 10, totalReward: 30, plays: 10 },
    { userId: "b", totalCost: 40, totalReward: 20, plays: 40 },
    { userId: "c", totalCost: 2, totalReward: 0, plays: 2 },
    { userId: "d", totalCost: 25, totalReward: 50, plays: 22 },
    { userId: "e", totalCost: 5, totalReward: 12, plays: 5 },
  ]

  it("平均がちょうど50、標準偏差がちょうど10になる", () => {
    const rr = computeRrRatings(sample).map(r => r.rrRating)
    expect(mean(rr)).toBeCloseTo(50, 1)
    expect(sd(rr)).toBeCloseTo(10, 1)
  })

  it("ROI は % で返す", () => {
    const a = computeRrRatings(sample).find(r => r.userId === "a")!
    expect(a.roiPercent).toBe(300)
  })

  it("参加費0の人は対象外、全員同じ成績なら50", () => {
    const rr = computeRrRatings([
      { userId: "x", totalCost: 0, totalReward: 0, plays: 0 },
      { userId: "y", totalCost: 3, totalReward: 3, plays: 3 },
      { userId: "z", totalCost: 6, totalReward: 6, plays: 6 },
    ])
    expect(rr.map(r => r.userId)).toEqual(["y", "z"])
    expect(rr.every(r => r.rrRating === 50)).toBe(true)
  })

  it("1人を外すと、残りの全員が計算し直される", () => {
    const all = computeRrRatings(sample)
    const without = computeRrRatings(sample.filter(p => p.userId !== "a"))
    expect(without).toHaveLength(4)
    expect(without.find(r => r.userId === "b")!.rrRating).not.toBe(all.find(r => r.userId === "b")!.rrRating)
    expect(mean(without.map(r => r.rrRating))).toBeCloseTo(50, 1)
  })

  it("同じ ROI なら、参加回数が多いほど平均から離れる(縮小)", () => {
    const rr = computeRrRatings([
      { userId: "few", totalCost: 2, totalReward: 6, plays: 2 },
      { userId: "many", totalCost: 50, totalReward: 150, plays: 50 },
      { userId: "base", totalCost: 30, totalReward: 15, plays: 30 },
    ])
    const few = rr.find(r => r.userId === "few")!.rrRating
    const many = rr.find(r => r.userId === "many")!.rrRating
    expect(many).toBeGreaterThan(few)
  })
})

describe("tournamentContribution", () => {
  it("参加費1回分を1として数える(以前の Pay Out と同じ)", () => {
    expect(tournamentContribution({ entryCount: 1, reentryCount: 2, addonCount: 1, entryFee: 1000, reentryFee: 1000, addonFee: 500, prize: 5000 }))
      .toEqual({ cost: 3.5, reward: 5, plays: 3 })
  })
  it("参加していない・参加費が無い大会は数えない", () => {
    expect(tournamentContribution({ entryCount: 0, reentryCount: 0, addonCount: 0, entryFee: 1000, reentryFee: 0, addonFee: 0, prize: 0 })).toBeNull()
    expect(tournamentContribution({ entryCount: 1, reentryCount: 0, addonCount: 0, entryFee: 0, reentryFee: 0, addonFee: 0, prize: 0 })).toBeNull()
  })
})
