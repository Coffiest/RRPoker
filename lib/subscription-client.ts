// Client-safe subscription helpers (no firebase-admin import, unlike
// lib/store-subscription.ts which is server-only).

export type ClientSubFields = {
  status?: string | null
  currentPeriodEnd?: number | null
  provider?: string | null
}

// Admin-granted free periods have no external billing system pushing
// cancellation events, so "active" is only true while currentPeriodEnd is
// still in the future — checked live on every read instead of relying on a
// stored status flip.
export function isSubscriptionActive(sub: ClientSubFields | null | undefined): boolean {
  if (!sub || sub.status !== "active") return false
  if (sub.provider === "admin_free") {
    return !!sub.currentPeriodEnd && sub.currentPeriodEnd * 1000 > Date.now()
  }
  return true
}

export function subscriptionPlanLabel(sub: { plan?: string | null; provider?: string | null } | null | undefined): string {
  if (sub?.provider === "admin_free") return "手動無料化"
  return sub?.plan === "circle" ? "サークル応援プラン" : "スタンダード"
}
