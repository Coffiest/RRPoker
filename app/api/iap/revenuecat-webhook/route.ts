import { NextRequest, NextResponse } from "next/server"
import { adminDb } from "@/lib/firebase-admin"
import { patchSubscription } from "@/lib/store-subscription"

// App Store / Play Store product identifiers -> {plan, interval}, mirroring
// the Stripe PRICE_IDS map in app/api/stripe/create-checkout-session/route.ts.
// Same identifier strings are used for both stores' subscription products
// (see lib/iap.ts), so one map covers both — distinguished by event.store instead.
const PRODUCT_MAP: Record<string, { plan: string; interval: string }> = {
  "com.rrpoker.app.standard.monthly": { plan: "standard", interval: "monthly" },
  "com.rrpoker.app.standard.yearly": { plan: "standard", interval: "yearly" },
  "com.rrpoker.app.circle.monthly": { plan: "circle", interval: "monthly" },
  "com.rrpoker.app.circle.yearly": { plan: "circle", interval: "yearly" },
}

const ACTIVE_EVENTS = new Set(["INITIAL_PURCHASE", "RENEWAL", "UNCANCELLATION", "PRODUCT_CHANGE"])
const ENDED_EVENTS = new Set(["EXPIRATION"])

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization")
  if (!auth || auth !== `Bearer ${process.env.REVENUECAT_WEBHOOK_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const event = body?.event
  if (!event) return NextResponse.json({ error: "Invalid payload" }, { status: 400 })

  const uid: string | undefined = event.app_user_id
  const type: string = event.type
  const productId: string | undefined = event.product_id
  if (!uid) return NextResponse.json({ received: true })

  const userSnap = await adminDb.doc(`users/${uid}`).get()
  const storeId: string | undefined = userSnap.data()?.storeId
  if (!storeId) return NextResponse.json({ received: true })

  const mapped = productId ? PRODUCT_MAP[productId] : undefined
  const currentPeriodEnd = event.expiration_at_ms ? Math.floor(event.expiration_at_ms / 1000) : undefined
  // RevenueCat's event.store is "APP_STORE" or "PLAY_STORE" (also "STRIPE"/"AMAZON" for
  // other integrations, not used here since web keeps its own direct Stripe checkout).
  const provider = event.store === "PLAY_STORE" ? "google_play" : "apple_iap"

  if (ACTIVE_EVENTS.has(type)) {
    await patchSubscription(storeId, {
      provider,
      status: "active",
      plan: mapped?.plan,
      interval: mapped?.interval,
      currentPeriodEnd,
      cancelAtPeriodEnd: false,
    })

    // Circle-plan serial code consumption: the client attaches the
    // verified code as a RevenueCat subscriber attribute before purchasing
    // (see Purchases.setAttributes in the billing page), since StoreKit/Play
    // Billing purchases carry no custom checkout metadata like Stripe sessions do.
    const circleCode = event.subscriber_attributes?.circle_code?.value
    if (mapped?.plan === "circle" && circleCode) {
      await adminDb.doc(`circleSerialCodes/${circleCode}`).set({ usedBy: storeId, usedAt: Date.now() }, { merge: true })
    }
  } else if (type === "CANCELLATION") {
    await patchSubscription(storeId, { provider, cancelAtPeriodEnd: true })
  } else if (ENDED_EVENTS.has(type)) {
    await patchSubscription(storeId, { provider, status: "canceled", cancelAtPeriodEnd: false })
  } else if (type === "BILLING_ISSUE") {
    await patchSubscription(storeId, { provider, status: "past_due" })
  }

  return NextResponse.json({ received: true })
}
