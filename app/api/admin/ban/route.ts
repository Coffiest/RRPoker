import { NextRequest, NextResponse } from "next/server"
import { FieldValue } from "firebase-admin/firestore"
import { adminDb, adminAuth } from "@/lib/firebase-admin"
import { verifyAdmin } from "@/lib/adminAuth.server"
import { recomputeAllRrRatings } from "@/lib/rrRating.server"

/**
 * プレイヤーの利用停止(BAN)と解除。
 *
 * BAN すると:
 * - Firebase のアカウントを無効にし、ログイン中の端末のトークンも失効させる(ログイン不可)
 * - users に banned を立てる(AuthGuard が即座に締め出す / 入店・検索・プロフィールから外す)
 * - 入店中なら退店させる
 * - 偏差値の母集団から外して、全員を計算し直す
 * 理由は管理者だけが読める adminBans に置く(users は他のプレイヤーも読めるため)。
 * データ(残高・履歴・取引)は消さない。解除すれば元に戻る。
 */
export async function POST(req: NextRequest) {
  if (!verifyAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { uid, banned, reason } = await req.json().catch(() => ({}))
  if (typeof uid !== "string" || !uid || typeof banned !== "boolean") {
    return NextResponse.json({ error: "Bad request" }, { status: 400 })
  }

  const userRef = adminDb.collection("users").doc(uid)
  const userSnap = await userRef.get()
  if (!userSnap.exists) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (userSnap.data()?.role === "store") {
    return NextResponse.json({ error: "Store accounts cannot be banned here" }, { status: 400 })
  }

  try {
    try {
      await adminAuth.updateUser(uid, { disabled: banned })
      if (banned) await adminAuth.revokeRefreshTokens(uid)
    } catch (e) {
      // Firebase Auth 側にアカウントが無い(移行データなど)ときは、users 側の印だけで止める。
      if ((e as { code?: string })?.code !== "auth/user-not-found") throw e
    }

    if (banned) {
      await userRef.set({
        banned: true,
        bannedAt: FieldValue.serverTimestamp(),
        currentStoreId: FieldValue.delete(),
        checkinStatus: "none",
        pendingStoreId: null,
      }, { merge: true })
      await adminDb.collection("adminBans").doc(uid).set({
        reason: typeof reason === "string" ? reason.trim().slice(0, 500) : "",
        bannedAt: FieldValue.serverTimestamp(),
      })
    } else {
      await userRef.set({ banned: FieldValue.delete(), bannedAt: FieldValue.delete() }, { merge: true })
      await adminDb.collection("adminBans").doc(uid).delete()
    }

    const rr = await recomputeAllRrRatings()
    return NextResponse.json({ ok: true, ...rr })
  } catch (e) {
    console.error("admin ban failed", e)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
