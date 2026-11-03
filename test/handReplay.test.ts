import { describe, it, expect } from "vitest"
import { buildHandReplay, fullBoard } from "../lib/handReplay"

const hand = {
  heroPosition: "BTN", heroCards: ["As", "Kd"], villainCards: { BB: ["Qh", "Qc"] },
  playerPositions: ["CO", "BTN", "SB", "BB"],
  board: { flop: ["2c", "7d", "9h"], turn: "Ts", river: null },
  actions: [
    { street: "preflop", position: "CO", action: "fold" },
    { street: "preflop", position: "BTN", action: "raise", amount: 2.5 },
    { street: "preflop", position: "SB", action: "fold" },
    { street: "preflop", position: "BB", action: "call", amount: 2.5 },
    { street: "flop", position: "BB", action: "check" },
    { street: "flop", position: "BTN", action: "bet", amount: 3 },
    { street: "flop", position: "BB", action: "raise", amount: 9 },
    { street: "flop", position: "BTN", action: "call", amount: 9 },
  ],
}

describe("buildHandReplay", () => {
  it("開始時点はブラインドだけ", () => {
    const s = buildHandReplay(hand)[0].snapshot
    expect(s.pot).toBe(1.5)
    expect(s.board).toEqual([])
  })
  it("コールは差額だけ足す(二重に数えない)", () => {
    const steps = buildHandReplay(hand)
    expect(steps[4].snapshot.pot).toBe(5.5) // 2.5+2.5+SB0.5
    expect(steps[steps.length - 1].snapshot.pot).toBe(23.5)
    expect(steps[steps.length - 1].snapshot.board).toEqual(["2c", "7d", "9h"])
  })
  it("フォールドと手札", () => {
    const last = buildHandReplay(hand).at(-1)!.snapshot
    expect(last.seats.find(x => x.position === "CO")!.status).toBe("folded")
    expect(last.seats.find(x => x.position === "BB")!.cards).toEqual(["Qh", "Qc"])
  })
  it("中身が空でも落ちない", () => {
    expect(buildHandReplay({})).toHaveLength(1)
    expect(fullBoard({ board: { flop: null, turn: "Ts", river: null } })).toEqual([])
  })
})
