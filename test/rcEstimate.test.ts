import { describe, it, expect } from 'vitest'
import { computeRcEstimate, rcBoundaryMs, tournamentClocks, msToClock, rcEndAtNow } from '../lib/endEstimate'

const L = (bb: number, d = 20) => ({ type: 'level', bigBlind: bb, duration: d })
const RC = { type: 'break', duration: 10, rc: true }
// 100/200/300/400/500/1000/2000 の 20 分レベル、2 レベル目の後に RC ブレイク
const levels = [L(100), L(200), RC, L(300), L(400), L(500), L(1000), L(2000)]

describe('RC 後の終了予定の再計算', () => {
  it('合計チップ ÷ 2 が 10BB を切る最初のレベルの終わり', () => {
    // 10 人 × 1000 = 10000 → ヘッズアップのアベレージ 5000
    // 300: 16.6、400: 12.5、500: 10(切らない)、1000: 5 → 1000 のレベルの終わり = RC 後 4 レベル × 20 分
    const est = computeRcEstimate(levels, { totalEntry: 10, entryStack: 1000 }, 0)
    expect(est?.endAtMs).toBe(80 * 60_000)
    expect(est?.players).toBe(10)
    expect(est?.avgStack).toBe(1000)
  })
  it('バストした人を引いて人数を出すが、合計チップは変わらない', () => {
    const est = computeRcEstimate(levels, { totalEntry: 10, totalReentry: 2, bustCount: 4, entryStack: 1000, reentryStack: 1000 }, 0)
    expect(est?.players).toBe(8)
    expect(est?.avgStack).toBe(1500)
    expect(est?.totalChips).toBe(12000)
  })
  it('RC ブレイクが無い・チップが分からないときは null', () => {
    expect(computeRcEstimate([L(100), L(200)], { totalEntry: 10, entryStack: 1000 }, 0)).toBeNull()
    expect(computeRcEstimate(levels, { totalEntry: 10 }, 0)).toBeNull()
  })
  it('RC ブレイクが終わる時刻はタイマーの状態から出す', () => {
    // 1 レベル目の残り 300 秒 → +20 分 +10 分
    expect(rcBoundaryMs(levels, 0, 1000, 300)).toBe(1000 + (300 + 1200 + 600) * 1000)
    expect(rcBoundaryMs(levels, 3, 1000, 300)).toBeNull()
  })
  it('最初の予定との差を分で出す(遅延はプラス)', () => {
    const preset = { levels, startStack: 1000, players: 10 }
    const t = { date: '2026-11-05', startTime: '19:00' }
    const base = tournamentClocks(t, preset)
    // 開始 19:00 + 40 + 10 + 80 = 21:10
    expect(base.end).toBe('21:10')
    expect(base.start).toBe('19:00')
    expect(base.delayMin).toBeNull()
    const endAtMs = new Date('2026-11-05T21:50:00').getTime()
    const later = tournamentClocks({ ...t, rcEstimate: { endAtMs, rcEndAtMs: 0, players: 0, avgStack: 0, totalChips: 0 } }, preset)
    expect(later.end).toBe('21:50')
    expect(later.endOriginal).toBe('21:10')
    expect(later.delayMin).toBe(40)
  })
  it('日をまたぐと「翌」', () => {
    expect(msToClock(new Date('2026-11-06T00:30:00').getTime(), '2026-11-05')).toBe('翌00:30')
  })
  it('ブラインドの表が変わったら、RC 後の終了予定と遅延も計算し直す', () => {
    const rcEndAtMs = new Date('2026-11-05T19:50:00').getTime()
    const est = { endAtMs: rcEndAtMs + 80 * 60_000, rcEndAtMs, players: 10, avgStack: 1000, totalChips: 10000 }
    // 元の表: RC 後 4 レベル × 20 分 = 21:10
    expect(rcEndAtNow(levels, est)).toBe(rcEndAtMs + 80 * 60_000)
    // RC 後のレベルを 30 分にした表: 4 × 30 = 120 分 → 21:50
    const longer = [L(100), L(200), RC, L(300, 30), L(400, 30), L(500, 30), L(1000, 30), L(2000, 30)]
    expect(rcEndAtNow(longer, est)).toBe(rcEndAtMs + 120 * 60_000)
    // 表示: プリセットを変えると終了も遅延も変わる
    const t = { date: '2026-11-05', startTime: '19:00', rcEstimate: est }
    const a = tournamentClocks(t, { levels, startStack: 1000, players: 10 })
    expect(a.end).toBe('21:10'); expect(a.delayMin).toBe(0)
    const b = tournamentClocks(t, { levels: longer, startStack: 1000, players: 10 })
    expect(b.end).toBe('21:50')
    // 最初の終了予定も同じ表で計算し直す(19:00 + 40 + 10 + 120 = 21:50)ので、遅延は 0
    expect(b.endOriginal).toBe('21:50'); expect(b.delayMin).toBe(0)
    // Adjust でこの大会だけ変えたときは大会の表を使う
    const c = tournamentClocks({ ...t, customBlindLevels: longer, blindsCustomized: true }, { levels, startStack: 1000, players: 10 })
    expect(c.end).toBe('21:50')
  })
})
