import { NextRequest, NextResponse } from "next/server"
import { stripe } from "@/lib/stripe.server"
import { adminDb, adminAuth } from "@/lib/firebase-admin"
import { writeSubscription } from "@/lib/store-subscription"
import type Stripe from "stripe"

// Reliable subscription activation that does NOT depend on the Stripe webhook.
// Called by the client right after returning from Stripe Checkout (with the
// checkout session id), and also usable as a manual recovery (no session id)
// that finds the store's active subscription directly on Stripe and syncs it.

async function ownedStoreIds(uid: string, storeId: string): Promise<string[]> {
  const userSnap = await adminDb.doc(`users/${uid}`).get()
  const ids: string[] = userSnap.data()?.ownedStoreIds ?? []
  return ids.length > 0 ? ids : [storeId]
}

async function syncToOwnedStores(sub: Stripe.Subscription, storeId: string, uid: string, plan?: string, interval?: string) {
  const ids = await ownedStoreIds(uid, storeId)
  await Promise.all(ids.map(id => writeSubscription(id, {
    stripeSubscriptionId: sub.id,
    stripeCustomerId: sub.customer as string,
    status: sub.status,
    plan: plan ?? sub.metadata?.plan,
    interval: interval ?? sub.metadata?.interval,
    currentPeriodEnd: sub.items.data[0]?.current_period_end ?? 0,
    cancelAtPeriodEnd: sub.cancel_at_period_end,
  })))
  await adminDb.doc(`_stripeSubMap/${sub.id}`).set({ storeId, uid })
}

const ACTIVE = new Set(["active", "trialing", "past_due"])

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "")
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let uid: string
  try {
    uid = (await adminAuth.verifyIdToken(token)).uid
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const userSnap = await adminDb.doc(`users/${uid}`).get()
  const storeId: string | undefined = userSnap.data()?.storeId
  if (!storeId) return NextResponse.json({ error: "No store found" }, { status: 400 })

  const { sessionId } = await req.json().catch(() => ({ sessionId: undefined }))

  try {
    // Preferred path: confirm the specific checkout session
    if (sessionId) {
      const session = await stripe.checkout.sessions.retrieve(sessionId)
      if (session.metadata?.storeId !== storeId) {
        return NextResponse.json({ error: "Session does not belong to this store" }, { status: 403 })
      }
      if (!session.subscription) {
        return NextResponse.json({ ok: false, reason: "no_subscription" })
      }
      const sub = await stripe.subscriptions.retrieve(session.subscription as string)
      await syncToOwnedStores(sub, storeId, uid, session.metadata?.plan, session.metadata?.interval)
      if (session.metadata?.plan === "circle" && session.metadata?.circleCode) {
        await adminDb.doc(`circleSerialCodes/${session.metadata.circleCode}`)
          .set({ usedBy: storeId, usedAt: Date.now() }, { merge: true })
      }
      return NextResponse.json({ ok: true, status: sub.status })
    }

    // Recovery path: find the store's customer(s) on Stripe and sync any
    // active subscription. Handles payments where the webhook never landed.
    const search = await stripe.customers.search({ query: `metadata['storeId']:'${storeId}'` })
    for (const customer of search.data) {
      const subs = await stripe.subscriptions.list({ customer: customer.id, status: "all", limit: 20 })
      const active = subs.data.find(s => ACTIVE.has(s.status))
      if (active) {
        await syncToOwnedStores(active, storeId, uid)
        return NextResponse.json({ ok: true, status: active.status })
      }
    }
    return NextResponse.json({ ok: false, reason: "not_found" })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "同期に失敗しました" }, { status: 500 })
  }
}
