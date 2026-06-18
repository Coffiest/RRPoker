import { NextRequest, NextResponse } from "next/server"
import { adminDb } from "@/lib/firebase-admin"

function verifyAdmin(req: NextRequest) {
  const expected = (process.env.ADMIN_PASSWORD ?? "").trim()
  if (!expected) return false
  return (req.headers.get("x-admin-password") ?? "").trim() === expected
}

export async function POST(req: NextRequest) {
  if (!verifyAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { storeId, isFree } = await req.json()
  if (!storeId) return NextResponse.json({ error: "storeId required" }, { status: 400 })
  await adminDb.doc(`stores/${storeId}`).update({ isFree: isFree === true })
  return NextResponse.json({ ok: true })
}
