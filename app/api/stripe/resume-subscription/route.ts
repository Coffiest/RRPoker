import { NextRequest, NextResponse } from "next/server"
import { stripe } from "@/lib/stripe.server"
import { adminDb, adminAuth } from "@/lib/firebase-admin"
import { readSubscription, patchSubscription } from "@/lib/store-subscription"

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
    // Undo the scheduled cancellation, then sync all owned stores
    await stripe.subscriptions.update(subId, { cancel_at_period_end: false })
    await Promise.all(ownedIds.map(id => patchSubscription(id, { cancelAtPeriodEnd: false })))
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "再開に失敗しました" }, { status: 500 })
  }
}
