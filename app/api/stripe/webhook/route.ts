import { NextRequest, NextResponse } from "next/server"
import { stripe } from "@/lib/stripe.server"
import { adminDb } from "@/lib/firebase-admin"
import Stripe from "stripe"

async function updateStoreSubscription(storeId: string, sub: Stripe.Subscription, plan?: string, interval?: string) {
  const currentPeriodEnd = sub.items.data[0]?.current_period_end ?? 0
  const data: Record<string, unknown> = {
    "subscription.stripeSubscriptionId": sub.id,
    "subscription.stripeCustomerId": sub.customer as string,
    "subscription.status": sub.status,
    "subscription.currentPeriodEnd": currentPeriodEnd,
    "subscription.cancelAtPeriodEnd": sub.cancel_at_period_end,
  }
  if (plan) data["subscription.plan"] = plan
  if (interval) data["subscription.interval"] = interval
  await adminDb.doc(`stores/${storeId}`).set(data, { merge: true })
  await adminDb.doc(`_stripeSubMap/${sub.id}`).set({ storeId })
}

function getSubIdFromInvoice(invoice: Stripe.Invoice): string | null {
  const sub = invoice.parent?.subscription_details?.subscription
  if (!sub) return null
  return typeof sub === "string" ? sub : sub.id
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get("stripe-signature")

  if (!sig) return NextResponse.json({ error: "No signature" }, { status: 400 })

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session
      const storeId = session.metadata?.storeId
      const plan = session.metadata?.plan
      const interval = session.metadata?.interval
      const circleCode = session.metadata?.circleCode
      if (!storeId || !session.subscription) break

      const sub = await stripe.subscriptions.retrieve(session.subscription as string)
      await updateStoreSubscription(storeId, sub, plan, interval)

      if (plan === "circle" && circleCode) {
        await adminDb.doc(`circleSerialCodes/${circleCode}`).set({ usedBy: storeId, usedAt: Date.now() }, { merge: true })
      }
      break
    }
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription
      const mapSnap = await adminDb.doc(`_stripeSubMap/${sub.id}`).get()
      const storeId = mapSnap.data()?.storeId
      if (!storeId) break
      const plan = sub.metadata?.plan
      const interval = sub.metadata?.interval
      await updateStoreSubscription(storeId, sub, plan, interval)
      break
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription
      const mapSnap = await adminDb.doc(`_stripeSubMap/${sub.id}`).get()
      const storeId = mapSnap.data()?.storeId
      if (!storeId) break
      await adminDb.doc(`stores/${storeId}`).set(
        { "subscription.status": "canceled", "subscription.cancelAtPeriodEnd": false },
        { merge: true }
      )
      break
    }
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice
      const subId = getSubIdFromInvoice(invoice)
      if (!subId) break
      const mapSnap = await adminDb.doc(`_stripeSubMap/${subId}`).get()
      const storeId = mapSnap.data()?.storeId
      if (!storeId) break
      await adminDb.doc(`stores/${storeId}`).set({ "subscription.status": "past_due" }, { merge: true })
      break
    }
  }

  return NextResponse.json({ received: true })
}
