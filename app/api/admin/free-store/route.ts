import { NextRequest, NextResponse } from "next/server"
import { adminDb } from "@/lib/firebase-admin"
import { readSubscription, writeSubscription, clearSubscription } from "@/lib/store-subscription"

function verifyAdmin(req: NextRequest) {
  const expected = (process.env.ADMIN_PASSWORD ?? "").trim()
  if (!expected) return false
  return (req.headers.get("x-admin-password") ?? "").trim() === expected
}

// Calendar-correct month addition: clamps to the target month's last day
// instead of overflowing (e.g. Jan 31 + 1 month -> Feb 28/29, not Mar 3).
function addMonthsUnix(months: number): number {
  const now = new Date()
  const day = now.getDate()
  const d = new Date(now.getFullYear(), now.getMonth() + months, 1, now.getHours(), now.getMinutes(), now.getSeconds())
  const lastDayOfTargetMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(day, lastDayOfTargetMonth))
  return Math.floor(d.getTime() / 1000)
}

export async function POST(req: NextRequest) {
  if (!verifyAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { storeId, isFree, months } = await req.json()
  if (!storeId) return NextResponse.json({ error: "storeId required" }, { status: 400 })

  if (isFree === true) {
    const m = Number(months)
    if (!Number.isFinite(m) || m <= 0) {
      return NextResponse.json({ error: "無料期間（ヶ月数）を指定してください" }, { status: 400 })
    }
    await adminDb.doc(`stores/${storeId}`).update({ isFree: true })
    await writeSubscription(storeId, {
      provider: "admin_free",
      status: "active",
      plan: "free",
      currentPeriodEnd: addMonthsUnix(m),
      cancelAtPeriodEnd: false,
    })
    return NextResponse.json({ ok: true })
  }

  // 無料解除: 運営による無料化のみ取り消す。Stripe/Apple経由の実契約は触らない
  await adminDb.doc(`stores/${storeId}`).update({ isFree: false })
  const storeSnap = await adminDb.doc(`stores/${storeId}`).get()
  if (readSubscription(storeSnap.data()).provider === "admin_free") {
    await clearSubscription(storeId)
  }
  return NextResponse.json({ ok: true })
}
