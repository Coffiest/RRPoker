import { NextRequest, NextResponse } from "next/server"
import { stripe } from "@/lib/stripe.server"
import { adminDb, adminAuth } from "@/lib/firebase-admin"

const PRICE_IDS: Record<string, string> = {
  "standard-monthly": process.env.NEXT_PUBLIC_STRIPE_STANDARD_MONTHLY!,
  "standard-yearly": process.env.NEXT_PUBLIC_STRIPE_STANDARD_YEARLY!,
  "circle-monthly": process.env.NEXT_PUBLIC_STRIPE_CIRCLE_MONTHLY!,
  "circle-yearly": process.env.NEXT_PUBLIC_STRIPE_CIRCLE_YEARLY!,
}

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

  const { plan, interval, circleCode } = await req.json()
  const priceKey = `${plan}-${interval}`
  const priceId = PRICE_IDS[priceKey]
  if (!priceId) return NextResponse.json({ error: "Invalid plan" }, { status: 400 })

  const userSnap = await adminDb.doc(`users/${uid}`).get()
  const storeId: string | undefined = userSnap.data()?.storeId
  if (!storeId) return NextResponse.json({ error: "No store found" }, { status: 400 })

  if (plan === "circle") {
    if (!circleCode) return NextResponse.json({ error: "シリアルコードを入力してください" }, { status: 400 })
    const codeSnap = await adminDb.doc(`circleSerialCodes/${circleCode}`).get()
    if (!codeSnap.exists || !codeSnap.data()?.active || codeSnap.data()?.usedBy) {
      return NextResponse.json({ error: "シリアルコードが無効または使用済みです" }, { status: 400 })
    }
  }

  const storeSnap = await adminDb.doc(`stores/${storeId}`).get()
  const storeData = storeSnap.data()
  // Support both nested format and flat format
  let customerId: string | undefined = storeData?.subscription?.stripeCustomerId || storeData?.["subscription.stripeCustomerId"]

  const email = userSnap.data()?.email
  const origin = req.headers.get("origin") ?? "https://rrpoker.com"

  const createSession = (customer: string) => stripe.checkout.sessions.create({
    customer,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: { storeId, plan, interval, circleCode: circleCode ?? "", uid },
    success_url: `${origin}/home/store/billing?success=true`,
    cancel_url: `${origin}/home/store/billing`,
    subscription_data: { metadata: { storeId, plan, interval, uid } },
  })

  try {
    if (!customerId) {
      const customer = await stripe.customers.create({ metadata: { storeId }, email })
      customerId = customer.id
    }
    try {
      const session = await createSession(customerId)
      return NextResponse.json({ url: session.url })
    } catch (e: any) {
      // Stored customer doesn't exist in the current Stripe mode (e.g. leftover
      // test-mode customer after switching to live keys). Create a fresh one.
      if (e?.code === "resource_missing") {
        const customer = await stripe.customers.create({ metadata: { storeId }, email })
        const session = await createSession(customer.id)
        return NextResponse.json({ url: session.url })
      }
      throw e
    }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "決済セッションの作成に失敗しました" }, { status: 500 })
  }
}
