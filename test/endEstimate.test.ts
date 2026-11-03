import { describe, it, expect } from "vitest";
import { endLevelIndex, endClock } from "../lib/endEstimate";
import { buildTemplateLevels } from "../lib/blindTemplate";

describe("終了予定", () => {
  const levels = buildTemplateLevels(1, 2).map(l => ({ type: "level", ...l }))
  it("300点×30人なら 250/500 が終了予定", () => {
    const tpl = buildTemplateLevels(100, 200).map(l => ({ type: "level", smallBlind: l.smallBlind / 100, bigBlind: l.bigBlind / 100, duration: 20 }))
    const i = endLevelIndex(tpl, 300, 30)!
    expect(tpl[i].bigBlind).toBe(500)
  })
  it("スタックか人数が無ければ出さない", () => {
    expect(endLevelIndex(levels, null, 30)).toBeNull()
    expect(endLevelIndex(levels, 300, 0)).toBeNull()
  })
  it("終了予定時刻はそのレベルが終わる時刻(ブレイクも足す)", () => {
    const ls = [
      { type: "level", bigBlind: 2, duration: 20 }, { type: "break", duration: 10 },
      { type: "level", bigBlind: 4, duration: 20 }, { type: "level", bigBlind: 100, duration: 20 },
    ]
    // 合計 100×5/2=250、250/100 = 2.5 < 10 → 4 行目。19:00 + 70 分 = 20:10
    expect(endClock("2026-11-02", "19:00", ls, 100, 5)).toBe("20:10")
    expect(endClock("2026-11-02", "23:30", ls, 100, 5)).toBe("翌00:40")
  })
})

import { rcClock, rcBreakIndex } from '../lib/endEstimate'
describe('rcClock', () => {
  const lv = (d: number) => ({ type: 'level', bigBlind: 2, duration: d })
  it('RC ブレイクが終わった瞬間を締め切りにする', () => {
    const ls = [lv(20), lv(20), { type: 'break', duration: 5, rc: true }, lv(10)]
    expect(rcBreakIndex(ls)).toBe(2)
    expect(rcClock('19:00', ls)).toBe('19:45')
  })
  it('RC ブレイクが無ければ出さない', () => {
    expect(rcClock('19:00', [lv(20), { type: 'break', duration: 5 }])).toBeNull()
  })
  it('日をまたぐ', () => {
    expect(rcClock('23:30', [lv(30), { type: 'break', duration: 10, rc: true }])).toBe('翌00:10')
  })
})
