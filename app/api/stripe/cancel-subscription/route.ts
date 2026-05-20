import { NextRequest, NextResponse } from "next/server"
import { stripe } from "@/lib/stripe.server"
import { adminDb, adminAuth } from "@/lib/firebase-admin"

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
  const subId: string | undefined = storeSnap.data()?.subscription?.stripeSubscriptionId
  if (!subId) return NextResponse.json({ error: "No subscription found" }, { status: 400 })

  await stripe.subscriptions.update(subId, { cancel_at_period_end: true })

  await adminDb.doc(`stores/${storeId}`).set(
    { "subscription.cancelAtPeriodEnd": true },
    { merge: true }
  )

  return NextResponse.json({ ok: true })
}
