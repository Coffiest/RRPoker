import { NextRequest, NextResponse } from "next/server"
import { adminDb } from "@/lib/firebase-admin"
import { corsHeaders } from "../cors"

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders })
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code")
  if (!code) return NextResponse.json({ error: "code is required" }, { status: 400, headers: corsHeaders })

  const ref = adminDb.doc(`pairingCodes/${code}`)
  const snap = await ref.get()
  if (!snap.exists) return NextResponse.json({ status: "not_found" }, { status: 404, headers: corsHeaders })

  const data = snap.data()!
  if (Date.now() > data.expiresAt) {
    await ref.delete()
    return NextResponse.json({ status: "expired" }, { status: 410, headers: corsHeaders })
  }

  if (data.status === "confirmed") {
    const customToken = data.customToken
    await ref.delete()
    return NextResponse.json({ status: "confirmed", customToken }, { headers: corsHeaders })
  }

  return NextResponse.json({ status: data.status }, { headers: corsHeaders })
}
