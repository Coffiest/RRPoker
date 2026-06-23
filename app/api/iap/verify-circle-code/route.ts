import { NextRequest, NextResponse } from "next/server"
import { adminDb, adminAuth } from "@/lib/firebase-admin"

// Read-only check used by the iOS purchase flow: confirms a serial code is
// valid and unused WITHOUT consuming it. The code is only marked used once
// RevenueCat's webhook confirms the StoreKit purchase actually completed
// (mirrors app/api/stripe/create-checkout-session's pre-checkout validation,
// which similarly does not consume the code until the Stripe webhook fires).
export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "")
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    await adminAuth.verifyIdToken(token)
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { circleCode } = await req.json().catch(() => ({ circleCode: undefined }))
  if (!circleCode) return NextResponse.json({ error: "シリアルコードを入力してください" }, { status: 400 })

  const codeSnap = await adminDb.doc(`circleSerialCodes/${circleCode}`).get()
  if (!codeSnap.exists || !codeSnap.data()?.active || codeSnap.data()?.usedBy) {
    return NextResponse.json({ error: "シリアルコードが無効または使用済みです" }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
