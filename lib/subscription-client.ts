// Client-safe subscription helpers (no firebase-admin import, unlike
// lib/store-subscription.ts which is server-only).

export type ClientSubFields = {
  status?: string | null
  currentPeriodEnd?: number | null
  provider?: string | null
}

/**
 * 契約が「いま」有効かどうか。
 *
 * 以前は admin_free のときだけ終了日を見て、それ以外(Stripe / アプリ内課金)は
 * status が "active" でありさえすれば true を返していた。「外部の課金基盤が
 * 解約イベントを送ってくるはず」という前提だったが、そのイベントが届かなかったり
 * 取りこぼされたりすると status が "active" のまま残り、終了日を何ヶ月過ぎても
 * 使い続けられてしまう(実際に発生した)。
 *
 * 終了日は毎回そこにある確かな値なので、発行元にかかわらず必ず見る。
 * status と終了日の両方を満たしたときだけ有効とする。
 *
 * 終了日が無い / 0 のときだけは status に委ねる。アプリ内課金では期限を持たない
 * 権利で終了日が送られてこないことがあり、そこで一律に無効化すると正当な契約者を
 * 締め出してしまうため。ただし手動無料化は必ず期限とセットで発行するので、
 * 期限が無いものは不正とみなして通さない(従来どおり)。
 */
export function isSubscriptionActive(sub: ClientSubFields | null | undefined): boolean {
  if (!sub || sub.status !== "active") return false

  const endsAtSec = sub.currentPeriodEnd
  if (typeof endsAtSec === "number" && endsAtSec > 0) {
    return endsAtSec * 1000 > Date.now()
  }

  if (sub.provider === "admin_free") return false

  return true
}

export function subscriptionPlanLabel(sub: { plan?: string | null; provider?: string | null } | null | undefined): string {
  if (sub?.provider === "admin_free") return "手動無料化"
  return sub?.plan === "circle" ? "サークル応援プラン" : "スタンダード"
}
