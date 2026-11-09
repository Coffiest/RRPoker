import { describe, it, expect } from 'vitest'
import { validateLevels } from '../components/BlindLevelEditor'

const L = (bb: number, d: number | null = 20) => ({ type: 'level' as const, smallBlind: bb / 2, bigBlind: bb, ante: bb, duration: d })
const B = (d: number | null) => ({ type: 'break' as const, duration: d })

describe('ブラインド表の確認', () => {
  it('空のブレイクは、画面の番号(レベルだけを数える)で知らせる', () => {
    expect(validateLevels([L(200), L(400), B(null), L(600)] as any)).toBe('レベル 2 のあとのブレイク: 時間を入力してください')
  })
  it('空のレベルはその番号で知らせる(前にブレイクがあってもずれない)', () => {
    expect(validateLevels([L(200), B(10), L(400, null)] as any)).toBe('レベル 2: SB・BB・時間を入力してください')
  })
  it('全部入っていれば通す', () => {
    expect(validateLevels([L(200), B(10), L(400)] as any)).toBeNull()
  })
})
