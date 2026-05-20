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
  const customerId: string | undefined = storeSnap.data()?.subscription?.stripeCustomerId
  if (!customerId) return NextResponse.json({ error: "No customer found" }, { status: 400 })

  const origin = req.headers.get("origin") ?? "https://rrpoker.com"
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${origin}/home/store/mypage`,
  })

  return NextResponse.json({ url: session.url })
}
