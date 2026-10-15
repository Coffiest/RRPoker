import { NextRequest, NextResponse } from "next/server"
import { adminDb, adminAuth } from "@/lib/firebase-admin"
import { applyTournamentToRr, recomputeAllRrRatings } from "@/lib/rrRating.server"

/**
 * 店舗が大会の終了処理(Pay Out)を終えたあとに呼ぶ。
 * その大会の成績を RR の集計に足し込み、全員の偏差値を計算し直す。
 *
 * 偏差値の書き込みはサーバーだけが行う(firestore.rules で rrLeaderboard と
 * users.rrRating への書き込みはクライアントから禁止している)。
 */
export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "")
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let uid: string
  try {
    uid = (await adminAuth.verifyIdToken(token)).uid
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { storeId, tournamentId } = await req.json().catch(() => ({}))
  if (typeof storeId !== "string" || typeof tournamentId !== "string" || !storeId || !tournamentId) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 })
  }

  const storeSnap = await adminDb.collection("stores").doc(storeId).get()
  if (!storeSnap.exists || storeSnap.data()?.ownerUid !== uid) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const applied = await applyTournamentToRr(storeId, tournamentId)
    const result = await recomputeAllRrRatings({ storeId, tournamentId })
    return NextResponse.json({ ok: true, applied, ...result })
  } catch (e) {
    console.error("rr-rating finalize failed", e)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
