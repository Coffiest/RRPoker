import { NextRequest, NextResponse } from "next/server"
import { stripe } from "@/lib/stripe.server"
import { adminDb } from "@/lib/firebase-admin"
import Stripe from "stripe"

async function getOwnedStoreIds(storeId: string, uid?: string): Promise<string[]> {
  if (uid) {
    const userSnap = await adminDb.doc(`users/${uid}`).get()
    const ownedIds: string[] = userSnap.data()?.ownedStoreIds ?? []
    if (ownedIds.length > 0) return ownedIds
  }
  return [storeId]
}

async function updateStoreSubscription(storeId: string, sub: Stripe.Subscription, plan?: string, interval?: string) {
  const currentPeriodEnd = sub.items.data[0]?.current_period_end ?? 0
  const fields: Record<string, unknown> = {
    "subscription.stripeSubscriptionId": sub.id,
    "subscription.stripeCustomerId": sub.customer as string,
    "subscription.status": sub.status,
    "subscription.currentPeriodEnd": currentPeriodEnd,
    "subscription.cancelAtPeriodEnd": sub.cancel_at_period_end,
    "subscription.provider": "stripe",
  }
  if (plan) fields["subscription.plan"] = plan
  if (interval) fields["subscription.interval"] = interval
  await adminDb.doc(`stores/${storeId}`).update(fields)
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
      const uid = session.metadata?.uid
      if (!storeId || !session.subscription) break

      const sub = await stripe.subscriptions.retrieve(session.subscription as string)
      const storeIds = await getOwnedStoreIds(storeId, uid)
      await Promise.all(storeIds.map(id => updateStoreSubscription(id, sub, plan, interval)))
      await adminDb.doc(`_stripeSubMap/${sub.id}`).set({ storeId, uid: uid ?? "" })

      if (plan === "circle" && circleCode) {
        await adminDb.doc(`circleSerialCodes/${circleCode}`).set({ usedBy: storeId, usedAt: Date.now() }, { merge: true })
      }
      break
    }
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription
      const mapSnap = await adminDb.doc(`_stripeSubMap/${sub.id}`).get()
      const storeId = mapSnap.data()?.storeId
      const uid = mapSnap.data()?.uid
      if (!storeId) break
      const plan = sub.metadata?.plan
      const interval = sub.metadata?.interval
      const storeIds = await getOwnedStoreIds(storeId, uid)
      await Promise.all(storeIds.map(id => updateStoreSubscription(id, sub, plan, interval)))
      break
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription
      const mapSnap = await adminDb.doc(`_stripeSubMap/${sub.id}`).get()
      const storeId = mapSnap.data()?.storeId
      const uid = mapSnap.data()?.uid
      if (!storeId) break
      const storeIds = await getOwnedStoreIds(storeId, uid)
      await Promise.all(storeIds.map(id =>
        adminDb.doc(`stores/${id}`).update({
          "subscription.status": "canceled",
          "subscription.cancelAtPeriodEnd": false,
        })
      ))
      break
    }
    case "invoice.payment_succeeded": {
      // 更新時の請求が確定した瞬間に次回更新日を最新化する
      // （customer.subscription.updated より早く届く場合があるため明示的に同期）
      const invoice = event.data.object as Stripe.Invoice
      const subId = getSubIdFromInvoice(invoice)
      if (!subId) break
      const mapSnap = await adminDb.doc(`_stripeSubMap/${subId}`).get()
      const storeId = mapSnap.data()?.storeId
      const uid = mapSnap.data()?.uid
      if (!storeId) break
      const sub = await stripe.subscriptions.retrieve(subId)
      const storeIds = await getOwnedStoreIds(storeId, uid)
      await Promise.all(storeIds.map(id => updateStoreSubscription(id, sub, sub.metadata?.plan, sub.metadata?.interval)))
      break
    }
    case "invoice.payment_failed": {
      // 更新日を過ぎた時点で課金が確認できなかった場合、Stripeの自動リトライを待たず
      // その場でサブスクリプションを即時終了する（仕様により猶予期間なし）
      const invoice = event.data.object as Stripe.Invoice
      const subId = getSubIdFromInvoice(invoice)
      if (!subId) break
      const mapSnap = await adminDb.doc(`_stripeSubMap/${subId}`).get()
      const storeId = mapSnap.data()?.storeId
      const uid = mapSnap.data()?.uid
      if (!storeId) break
      await stripe.subscriptions.cancel(subId).catch(() => {})
      const storeIds = await getOwnedStoreIds(storeId, uid)
      await Promise.all(storeIds.map(id =>
        adminDb.doc(`stores/${id}`).update({
          "subscription.status": "canceled",
          "subscription.cancelAtPeriodEnd": false,
        })
      ))
      break
    }
  }

  return NextResponse.json({ received: true })
}
