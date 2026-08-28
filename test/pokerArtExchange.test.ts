import { describe, expect, it } from 'vitest'
import { decideFirebaseUid, pokerArtUid, type SupabaseIdentity } from '../lib/pokerArtExchange'

/**
 * Poker ART アカウントで RRPoker にログインするときの、
 * 「既存の RRPoker アカウントに繋ぐか、新しく作るか」の判断のテスト。
 *
 * ここは乗っ取りに直結する。未確認のメールで既存アカウントに繋いでしまうと、
 * 他人のメールアドレスで Poker ART に登録するだけでその人の RRPoker アカウントに
 * 入れてしまう。確認済みのときだけ繋ぐことを固定する。
 */

const VERIFIED: SupabaseIdentity = { sub: 'sb-1', email: 'a@example.com', emailVerified: true }
const UNVERIFIED: SupabaseIdentity = { sub: 'sb-1', email: 'a@example.com', emailVerified: false }
const NO_EMAIL: SupabaseIdentity = { sub: 'sb-2', email: null, emailVerified: false }

describe('既存アカウントへ繋ぐ条件', () => {
  it('links only when the email is verified AND an account with that email exists', () => {
    expect(decideFirebaseUid(VERIFIED, 'rr-uid-1')).toEqual({ kind: 'link', uid: 'rr-uid-1' })
  })

  it('never links on an unverified email, even if the account exists', () => {
    // ここが緩むと、他人のメールで Poker ART に登録するだけで乗っ取れてしまう。
    expect(decideFirebaseUid(UNVERIFIED, 'rr-uid-1')).toEqual({ kind: 'create', uid: 'pokerart_sb-1' })
  })

  it('creates a new account when no RRPoker account has that email', () => {
    expect(decideFirebaseUid(VERIFIED, null)).toEqual({ kind: 'create', uid: 'pokerart_sb-1' })
  })

  it('creates a new account when the identity has no email at all', () => {
    expect(decideFirebaseUid(NO_EMAIL, 'rr-uid-1')).toEqual({ kind: 'create', uid: 'pokerart_sb-2' })
    expect(decideFirebaseUid(NO_EMAIL, null)).toEqual({ kind: 'create', uid: 'pokerart_sb-2' })
  })

  it('treats a verified flag with a missing email as not linkable', () => {
    // メールが無いのに verified が立っている、という矛盾した入力でも繋がない。
    const odd: SupabaseIdentity = { sub: 'sb-3', email: null, emailVerified: true }
    expect(decideFirebaseUid(odd, 'rr-uid-1')).toEqual({ kind: 'create', uid: 'pokerart_sb-3' })
  })
})

describe('新規uidの名前空間', () => {
  it('prefixes Poker ART accounts so they cannot collide with RRPoker uids', () => {
    expect(pokerArtUid('abc')).toBe('pokerart_abc')
    // 同じ sub なら常に同じ uid(同じ人が何度ログインしても増殖しない)。
    expect(pokerArtUid('abc')).toBe(pokerArtUid('abc'))
    expect(pokerArtUid('abc')).not.toBe(pokerArtUid('abd'))
  })
})
