import { NextResponse } from "next/server"
import { adminDb } from "@/lib/firebase-admin"
import { corsHeaders } from "../cors"

const CODE_TTL_MS = 5 * 60 * 1000

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders })
}

export async function POST() {
  let code = generateCode()
  for (let attempt = 0; attempt < 5; attempt++) {
    const ref = adminDb.doc(`pairingCodes/${code}`)
    const snap = await ref.get()
    if (!snap.exists) break
    code = generateCode()
  }

  const now = Date.now()
  await adminDb.doc(`pairingCodes/${code}`).set({
    status: "pending",
    createdAt: now,
    expiresAt: now + CODE_TTL_MS,
  })

  return NextResponse.json({ code, expiresAt: now + CODE_TTL_MS }, { headers: corsHeaders })
}
