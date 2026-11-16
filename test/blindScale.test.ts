import { describe, expect, it } from 'vitest'
import { canGrow, canShrink, scaleBlinds, shiftLabel } from '@/lib/blindScale'

const t = [
  { type: 'level', smallBlind: 100, bigBlind: 200, ante: 200, duration: 20 },
  { type: 'break', duration: 10 },
  { type: 'level', smallBlind: 200, bigBlind: 400, ante: null, duration: 20 },
]

describe('scaleBlinds', () => {
  it('100/200 を 2 回外すと 1/2、時間とブレイクはそのまま', () => {
    const r = scaleBlinds(scaleBlinds(t, -1), -1)
    expect(r[0]).toMatchObject({ smallBlind: 1, bigBlind: 2, ante: 2, duration: 20 })
    expect(r[1]).toEqual({ type: 'break', duration: 10 })
    expect(r[2]).toMatchObject({ smallBlind: 2, bigBlind: 4, ante: null })
  })
  it('割り切れないと外せない(元のまま)', () => {
    const one = scaleBlinds(scaleBlinds(t, -1), -1)
    expect(canShrink(one)).toBe(false)
    expect(scaleBlinds(one, -1)).toBe(one)
  })
  it('付けて外すと元に戻る', () => {
    expect(scaleBlinds(scaleBlinds(t, 1), -1)).toEqual(t)
  })
  it('空の表は変えられない', () => {
    expect(canGrow([])).toBe(false)
    expect(canShrink([{ type: 'level', smallBlind: null, bigBlind: null, ante: null }])).toBe(false)
  })
  it('表示', () => {
    expect(shiftLabel(0)).toBe('元のまま')
    expect(shiftLabel(2)).toBe('×100')
    expect(shiftLabel(-3)).toBe('÷1,000')
  })
})
