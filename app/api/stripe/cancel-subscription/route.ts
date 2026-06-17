import { NextRequest, NextResponse } from "next/server"
import { stripe } from "@/lib/stripe.server"
import { adminDb, adminAuth } from "@/lib/firebase-admin"
import { readSubscription, patchSubscription, clearSubscription } from "@/lib/store-subscription"

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "")
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let uid: string
  try {
    const decoded = await adminAuth.verifyIdToken(token)
    uid = decoded.uid
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const userSnap = await adminDb.doc(`users/${uid}`).get()
  const storeId: string | undefined = userSnap.data()?.storeId
  if (!storeId) return NextResponse.json({ error: "No store found" }, { status: 400 })

  const storeSnap = await adminDb.doc(`stores/${storeId}`).get()
  const subId = readSubscription(storeSnap.data()).stripeSubscriptionId
  if (!subId) return NextResponse.json({ error: "No subscription found" }, { status: 400 })

  const ownedIdsRaw: string[] = userSnap.data()?.ownedStoreIds ?? []
  const ownedIds = ownedIdsRaw.length > 0 ? ownedIdsRaw : [storeId]

  try {
    // Cancel at period end on Stripe, then mark all owned stores
    await stripe.subscriptions.update(subId, { cancel_at_period_end: true })
    await Promise.all(ownedIds.map(id => patchSubscription(id, { cancelAtPeriodEnd: true })))
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    // Subscription not found in the current Stripe mode — typically a leftover
    // test-mode subscription after switching to live keys. Clear the stale
    // subscription data across all owned stores so the store can re-subscribe.
    const notFound = e?.code === "resource_missing" || e?.statusCode === 404
    if (notFound) {
      await Promise.all(ownedIds.map(id => clearSubscription(id)))
      return NextResponse.json({ ok: true, cleared: true })
    }
    return NextResponse.json({ error: e?.message ?? "キャンセルに失敗しました" }, { status: 500 })
  }
}
