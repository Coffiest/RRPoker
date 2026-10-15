import { NextRequest, NextResponse } from "next/server"
import { verifyAdmin } from "@/lib/adminAuth.server"
import { recomputeAllRrRatings } from "@/lib/rrRating.server"

/** 全員の偏差値を、いまの集計から計算し直す(管理者画面のボタン)。 */
export async function POST(req: NextRequest) {
  if (!verifyAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    return NextResponse.json({ ok: true, ...(await recomputeAllRrRatings()) })
  } catch (e) {
    console.error("rr recompute failed", e)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
