import { NextRequest, NextResponse } from "next/server"
import { adminDb } from "@/lib/firebase-admin"

function verifyAdmin(req: NextRequest) {
  const expected = (process.env.ADMIN_PASSWORD ?? "").trim()
  if (!expected) return false
  return (req.headers.get("x-admin-password") ?? "").trim() === expected
}

function randomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  return "CIRCLE-" + Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("")
}

export async function GET(req: NextRequest) {
  if (!verifyAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    const snap = await adminDb.collection("circleSerialCodes").get()
    const codes = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    return NextResponse.json({ codes })
  } catch (e) {
    return NextResponse.json({ error: "DB error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  if (!verifyAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    const code = randomCode()
    await adminDb.doc(`circleSerialCodes/${code}`).set({ active: true, usedBy: null, createdAt: Date.now() })
    return NextResponse.json({ code })
  } catch (e) {
    return NextResponse.json({ error: "DB error" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  if (!verifyAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    const { code } = await req.json()
    if (!code) return NextResponse.json({ error: "code required" }, { status: 400 })
    await adminDb.doc(`circleSerialCodes/${code}`).update({ active: false })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: "DB error" }, { status: 500 })
  }
}
