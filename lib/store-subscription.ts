import { FieldValue, FieldPath } from "firebase-admin/firestore"
import { adminDb } from "@/lib/firebase-admin"

// Legacy literal field names that contain a dot in the key itself. These were
// accidentally created by setDoc() calls using dot-notation keys (setDoc does
// NOT expand dot keys into nested paths the way update() does). We normalize
// everything to a single nested `subscription` object and delete these.
const LEGACY_LITERAL_KEYS = [
  "subscription.stripeSubscriptionId",
  "subscription.stripeCustomerId",
  "subscription.status",
  "subscription.plan",
  "subscription.interval",
  "subscription.currentPeriodEnd",
  "subscription.cancelAtPeriodEnd",
]

export type SubFields = {
  stripeSubscriptionId?: string
  stripeCustomerId?: string
  status?: string
  plan?: string
  interval?: string
  currentPeriodEnd?: number
  cancelAtPeriodEnd?: boolean
  // 'stripe'（Web）/ 'apple_iap'（iOS StoreKit経由）/ 'google_play'（Android Play Billing経由）/ 'admin_free'（運営による手動無料化）
  provider?: "stripe" | "apple_iap" | "google_play" | "admin_free"
}

// Read a store's subscription, merging the canonical nested object with any
// leftover legacy literal dotted keys (nested takes precedence).
export function readSubscription(data: Record<string, any> | undefined): SubFields {
  if (!data) return {}
  const nested = data.subscription ?? {}
  return {
    stripeSubscriptionId: nested.stripeSubscriptionId ?? data["subscription.stripeSubscriptionId"],
    stripeCustomerId: nested.stripeCustomerId ?? data["subscription.stripeCustomerId"],
    status: nested.status ?? data["subscription.status"],
    plan: nested.plan ?? data["subscription.plan"],
    interval: nested.interval ?? data["subscription.interval"],
    currentPeriodEnd: nested.currentPeriodEnd ?? data["subscription.currentPeriodEnd"],
    cancelAtPeriodEnd: nested.cancelAtPeriodEnd ?? data["subscription.cancelAtPeriodEnd"],
    provider: nested.provider,
  }
}

async function deleteLegacyKeys(storeId: string) {
  const ref = adminDb.doc(`stores/${storeId}`)
  await Promise.all(LEGACY_LITERAL_KEYS.map(k =>
    ref.update(new FieldPath(k), FieldValue.delete()).catch(() => {})
  ))
}

// Write a clean nested subscription object and remove any legacy literal keys.
export async function writeSubscription(storeId: string, sub: SubFields) {
  const clean: Record<string, any> = {}
  for (const [k, v] of Object.entries(sub)) if (v !== undefined) clean[k] = v
  await adminDb.doc(`stores/${storeId}`).set({ subscription: clean }, { merge: true })
  await deleteLegacyKeys(storeId)
}

// Read the current subscription, apply a partial patch, write back normalized.
export async function patchSubscription(storeId: string, patch: SubFields) {
  const snap = await adminDb.doc(`stores/${storeId}`).get()
  const current = readSubscription(snap.data())
  await writeSubscription(storeId, { ...current, ...patch })
}

// Completely remove subscription data (nested + legacy literal keys).
export async function clearSubscription(storeId: string) {
  const ref = adminDb.doc(`stores/${storeId}`)
  await ref.update({ subscription: FieldValue.delete() }).catch(() => {})
  await deleteLegacyKeys(storeId)
}
