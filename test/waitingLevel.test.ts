import { vi } from 'vitest'
vi.mock('../lib/firebase', () => ({ db: {} }))
import { describe, it, expect } from 'vitest'
import { withWaiting, withoutWaiting, keepWaiting, levelNumberAt, hasWaiting } from '../lib/waitingLevel'
import { computeLiveLevelState } from '../lib/timerCompute'
import { rcClock, tournamentClocks } from '../lib/endEstimate'
import { isAutoStartDue, scheduledStartMs } from '../lib/autoStart'

const L = (d: number) => ({ type: 'level', smallBlind: 1, bigBlind: 2, ante: 2, duration: d })

describe('Waiting for start', () => {
  it('先頭に 1 つだけ入り、表示用には消える', () => {
    const ls = withWaiting(withWaiting([L(20), L(20)]))
    expect(ls.filter(l => l.type === 'waiting')).toHaveLength(1)
    expect(withoutWaiting(ls)).toHaveLength(2)
  })
  it('表を差し替えても待機レベルを残す', () => {
    expect(hasWaiting(keepWaiting(withWaiting([L(20)]), [L(10)]))).toBe(true)
    expect(hasWaiting(keepWaiting([L(20)], [L(10)]))).toBe(false)
  })
  it('レベルの番号は待機とブレイクを数えない', () => {
    const ls = withWaiting([L(20), { type: 'break', duration: 5 }, L(20)])
    expect(levelNumberAt(ls, 0)).toBeNull()
    expect(levelNumberAt(ls, 1)).toBe(1)
    expect(levelNumberAt(ls, 3)).toBe(2)
  })
  it('開始 30 分前に動かし始めると、開始時刻ちょうどにレベル 1 に上がる', () => {
    const start = Date.UTC(2026, 10, 3, 10, 0, 0)
    const ls = withWaiting([L(20), L(20)]) as any
    const anchor = start - 30 * 60 * 1000
    expect(computeLiveLevelState(0, anchor, 1800, ls, true, start - 1000)).toEqual({ levelIndex: 0, remainingSec: 1 })
    expect(computeLiveLevelState(0, anchor, 1800, ls, true, start)).toEqual({ levelIndex: 1, remainingSec: 1200 })
  })
  it('RC 時刻・終了予定の計算には入らない', () => {
    const ls = withWaiting([L(20), { type: 'break', duration: 5, rc: true }]) as any
    expect(tournamentClocks({ startTime: '19:00', customBlindLevels: ls }).rc).toBe('19:25')
    expect(rcClock('19:00', withoutWaiting(ls))).toBe('19:25')
  })
  it('自動スタートは開始の 30 分前から', () => {
    const t = { autoStart: true, status: 'scheduled', date: '2026-11-03', startTime: '19:00' }
    const at = scheduledStartMs(t.date, t.startTime)!
    expect(isAutoStartDue(t, at - 31 * 60 * 1000)).toBe(false)
    expect(isAutoStartDue(t, at - 30 * 60 * 1000)).toBe(true)
  })
})
