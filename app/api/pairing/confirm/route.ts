import { NextRequest, NextResponse } from "next/server"
import { adminDb, adminAuth } from "@/lib/firebase-admin"
import { corsHeaders } from "../cors"

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders })
}

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "")
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders })

  let uid: string
  try {
    const decoded = await adminAuth.verifyIdToken(token)
    uid = decoded.uid
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders })
  }

  const { code } = await req.json()
  if (!code) return NextResponse.json({ error: "code is required" }, { status: 400, headers: corsHeaders })

  const ref = adminDb.doc(`pairingCodes/${code}`)
  const snap = await ref.get()
  if (!snap.exists) return NextResponse.json({ error: "コードが見つかりません" }, { status: 404, headers: corsHeaders })

  const data = snap.data()!
  if (Date.now() > data.expiresAt) {
    await ref.delete()
    return NextResponse.json({ error: "コードの有効期限が切れています" }, { status: 410, headers: corsHeaders })
  }
  if (data.status !== "pending") {
    return NextResponse.json({ error: "このコードは既に使用されています" }, { status: 400, headers: corsHeaders })
  }

  const customToken = await adminAuth.createCustomToken(uid)
  await ref.update({ status: "confirmed", uid, customToken })

  return NextResponse.json({ success: true }, { headers: corsHeaders })
}
