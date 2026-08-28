import { NextResponse } from 'next/server'
import { adminAuth } from '@/lib/firebase-admin'
import { decideFirebaseUid, verifySupabaseToken } from '@/lib/pokerArtExchange'

/**
 * Poker ART(Supabase)のアクセストークンを、RRPoker(Firebase)のカスタムトークンに交換する。
 * クライアントは返ってきたトークンで signInWithCustomToken すれば RRPoker に入れる。
 *
 * 逆方向(RRPoker → Poker ART)は Poker ART のサーバーが Firebase の IDトークンを
 * 直接受け付けるので、交換は要らない。
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { accessToken?: unknown }
  const accessToken = typeof body.accessToken === 'string' ? body.accessToken : ''

  const identity = await verifySupabaseToken(accessToken)
  if (!identity) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // 同じメールの RRPoker アカウントが既にあるか。無ければ null。
  let existingUid: string | null = null
  if (identity.emailVerified && identity.email) {
    try {
      existingUid = (await adminAuth.getUserByEmail(identity.email)).uid
    } catch {
      // 見つからない(=新規)。エラーではない。
    }
  }

  const decision = decideFirebaseUid(identity, existingUid)

  try {
    const customToken = await adminAuth.createCustomToken(decision.uid)
    return NextResponse.json({ customToken, linked: decision.kind === 'link' })
  } catch {
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
}
