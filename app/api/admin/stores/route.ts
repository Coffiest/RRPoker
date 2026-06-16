import { NextRequest, NextResponse } from "next/server"
import { adminDb } from "@/lib/firebase-admin"

function verifyAdmin(req: NextRequest) {
  return req.headers.get("x-admin-password") === process.env.ADMIN_PASSWORD
}

export async function GET(req: NextRequest) {
  if (!verifyAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    const snap = await adminDb.collection("stores").get()
    const stores = snap.docs.map(d => {
      const data = d.data()
      return {
        id: d.id,
        name: data.name ?? "",
        code: data.code ?? "",
        iconUrl: data.iconUrl ?? null,
        isFree: data.isFree === true,
        subscription: data.subscription
          ? {
              status: data.subscription.status ?? null,
              plan: data.subscription.plan ?? null,
              cancelAtPeriodEnd: data.subscription.cancelAtPeriodEnd ?? false,
              currentPeriodEnd: data.subscription.currentPeriodEnd ?? null,
            }
          : null,
      }
    })
    return NextResponse.json({ stores })
  } catch {
    return NextResponse.json({ error: "DB error" }, { status: 500 })
  }
}
