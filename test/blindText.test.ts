import { describe, it, expect } from 'vitest'
import { blindsToText } from '../lib/blindText'

describe('blindsToText', () => {
  it('レベルとブレイクを 1 行ずつ書く', () => {
    const t = blindsToText('turbo', [
      { type: 'level', smallBlind: 2, bigBlind: 4, ante: 4, duration: 20 },
      { type: 'break', duration: 5, comment: 'RC / CU 1' },
      { type: 'level', smallBlind: 1000, bigBlind: 2000, ante: 0, duration: 10 },
    ])
    expect(t).toBe('turbo\nLv1  2 / 4  (ante 4)  20分\nBREAK  5分  RC / CU 1\nLv2  1,000 / 2,000  10分')
  })
  it('空の値でも落ちない', () => {
    expect(blindsToText('', [{ type: 'level' }])).toBe('Lv1  - / -')
  })
})
