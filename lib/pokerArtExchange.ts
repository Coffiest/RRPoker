/**
 * Poker ART(Supabase)のアカウントで RRPoker にログインするための橋渡し。
 *
 * 手順:
 *  1. Poker ART のアクセストークンを Supabase に検証してもらう
 *  2. その結果から、サインインさせるべき Firebase の uid を決める
 *  3. Firebase のカスタムトークンを発行して返す(クライアントが signInWithCustomToken)
 *
 * 2 の判断だけはここに純粋な関数として切り出してある。「同じメールなら既存の
 * RRPoker アカウントに繋ぐ」という挙動は乗っ取りに直結しうるので、単体テストで
 * 条件を固定しておきたいため。
 */

/** Supabase 側で確認できたユーザー。 */
export interface SupabaseIdentity {
  /** Supabase の user id。 */
  sub: string
  email: string | null
  /** そのメールアドレスが Supabase 上で確認済みか。 */
  emailVerified: boolean
}

export type UidDecision =
  /** 既存の RRPoker アカウントに繋ぐ(同一人物とみなす)。 */
  | { kind: 'link'; uid: string }
  /** 新しい RRPoker アカウントを作る。 */
  | { kind: 'create'; uid: string }

/** Poker ART 由来の Firebase uid。既存の uid と衝突しないよう接頭辞を付ける。 */
export function pokerArtUid(sub: string): string {
  return `pokerart_${sub}`
}

/**
 * どの Firebase uid でサインインさせるかを決める。
 *
 * 既存アカウントへ繋ぐのは「Poker ART 側でメールが確認済み」かつ「同じメールの
 * RRPoker アカウントが実在する」ときだけ。
 *
 * 未確認のメールで繋いでしまうと、他人のメールアドレスで Poker ART に登録するだけで
 * その人の RRPoker アカウントに入れてしまう。確認済みを必須にすることでこれを防ぐ。
 */
export function decideFirebaseUid(
  identity: SupabaseIdentity,
  existingUidForEmail: string | null,
): UidDecision {
  if (identity.emailVerified && identity.email && existingUidForEmail) {
    return { kind: 'link', uid: existingUidForEmail }
  }
  return { kind: 'create', uid: pokerArtUid(identity.sub) }
}

/**
 * Poker ART のアクセストークンを Supabase に検証してもらう。
 *
 * 検証は Supabase の Auth API に任せる(署名の検証をこちら側で真似しない)。
 * 必要なのは公開されている URL と anon キーだけで、新しい秘密情報は増えない。
 */
export async function verifySupabaseToken(accessToken: string): Promise<SupabaseIdentity | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey || !accessToken) return null

  try {
    const res = await fetch(`${url}/auth/v1/user`, {
      headers: { authorization: `Bearer ${accessToken}`, apikey: anonKey },
      cache: 'no-store',
    })
    if (!res.ok) return null
    const user = (await res.json()) as {
      id?: unknown
      email?: unknown
      email_confirmed_at?: unknown
    }
    if (typeof user.id !== 'string' || user.id.length === 0) return null
    return {
      sub: user.id,
      email: typeof user.email === 'string' ? user.email : null,
      emailVerified: typeof user.email_confirmed_at === 'string' && user.email_confirmed_at.length > 0,
    }
  } catch {
    return null
  }
}
