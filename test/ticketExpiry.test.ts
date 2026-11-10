import { describe, expect, it } from 'vitest'
import { expiresAtFor, expiryLabel, validateTicket } from '@/lib/ticketExpiry'

const now = new Date(2026, 10, 10, 12, 0, 0)

describe('expiresAtFor', () => {
  it('relative days', () => {
    expect(expiresAtFor({ expiryMode: 'relative', expiryValue: 30, expiryUnit: 'day' }, now)?.getTime()).toBe(now.getTime() + 30 * 86400000)
  })
  it('relative months', () => {
    const d = expiresAtFor({ expiryMode: 'relative', expiryValue: 2, expiryUnit: 'month' }, now)!
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2027, 0, 10])
  })
  it('fixed date ends at 23:59:59', () => {
    const d = expiresAtFor({ expiryMode: 'date', expiryDate: '2026-12-31' }, now)!
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([2026, 11, 31, 23, 59])
  })
  it('none and bad input', () => {
    expect(expiresAtFor({ expiryMode: 'none' }, now)).toBeNull()
    expect(expiresAtFor({ expiryMode: 'relative', expiryValue: 0, expiryUnit: 'day' }, now)).toBeNull()
    expect(expiresAtFor({ expiryMode: 'date', expiryDate: '' }, now)).toBeNull()
  })
})

describe('expiryLabel / validateTicket', () => {
  it('labels', () => {
    expect(expiryLabel({ expiryMode: 'relative', expiryValue: 3, expiryUnit: 'month' })).toBe('付与から 3 ヶ月')
    expect(expiryLabel({ expiryMode: 'date', expiryDate: '2026-12-31' })).toBe('2026/12/31 まで')
    expect(expiryLabel({ expiryMode: 'none' })).toBe('無期限')
  })
  it('validates', () => {
    const base = { name: '参加費無料', description: '', expiryMode: 'none' as const }
    expect(validateTicket(base, 1, now)).toBeNull()
    expect(validateTicket({ ...base, name: ' ' }, 1, now)).toMatch('名前')
    expect(validateTicket(base, 0, now)).toMatch('店舗')
    expect(validateTicket({ ...base, description: 'あ'.repeat(201) }, 1, now)).toMatch('200')
    expect(validateTicket({ ...base, expiryMode: 'date', expiryDate: '2026-11-01' }, 1, now)).toMatch('過ぎ')
    expect(validateTicket({ ...base, expiryMode: 'relative', expiryValue: null, expiryUnit: 'day' }, 1, now)).toMatch('日数')
  })
})
