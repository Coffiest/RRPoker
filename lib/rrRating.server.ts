import { FieldValue } from "firebase-admin/firestore"
import { adminDb } from "@/lib/firebase-admin"
import { computeRrRatings, tournamentContribution, type RrInput } from "@/lib/rrRatingCompute"

/** Firestore の一括書き込みは 1 回 500 件まで。余裕を見て区切る。 */
const BATCH_LIMIT = 400

async function commitInChunks(ops: Array<(b: FirebaseFirestore.WriteBatch) => void>) {
  for (let i = 0; i < ops.length; i += BATCH_LIMIT) {
    const batch = adminDb.batch()
    ops.slice(i, i + BATCH_LIMIT).forEach(op => op(batch))
    await batch.commit()
  }
}

/** BAN されているプレイヤーの uid 一覧。 */
export async function bannedUserIds(): Promise<Set<string>> {
  const snap = await adminDb.collection("users").where("banned", "==", true).get()
  return new Set(snap.docs.map(d => d.id))
}

/**
 * 全員の RR Rating を計算し直して保存する。
 * BAN されている人は母集団から外し、偏差値を消す(ランキングにも出さない)。
 * tournamentId を渡すと、その大会の履歴にもその時点の偏差値を残す(履歴の吹き出し用)。
 */
export async function recomputeAllRrRatings(opts: { storeId?: string; tournamentId?: string } = {}) {
  const [lbSnap, banned] = await Promise.all([
    adminDb.collection("rrLeaderboard").get(),
    bannedUserIds(),
  ])

  const inputs: RrInput[] = []
  const bannedDocs: string[] = []
  lbSnap.forEach(d => {
    const data = d.data()
    if (d.id.startsWith("temp_")) return
    if (banned.has(d.id)) { bannedDocs.push(d.id); return }
    inputs.push({
      userId: d.id,
      totalCost: Number(data.totalCost ?? 0),
      totalReward: Number(data.totalReward ?? 0),
      plays: Number(data.plays ?? 0),
    })
  })

  const results = computeRrRatings(inputs)
  const rated = new Set(results.map(r => r.userId))

  let historyHolders = new Set<string>()
  if (opts.storeId && opts.tournamentId) {
    const entries = await adminDb
      .collection("stores").doc(opts.storeId)
      .collection("tournaments").doc(opts.tournamentId)
      .collection("entries").get()
    historyHolders = new Set(entries.docs.map(d => d.id))
  }

  const ops: Array<(b: FirebaseFirestore.WriteBatch) => void> = []
  for (const r of results) {
    ops.push(b => b.set(adminDb.collection("rrLeaderboard").doc(r.userId),
      { roi: r.roiPercent, rrRating: r.rrRating, banned: false }, { merge: true }))
    ops.push(b => b.set(adminDb.collection("users").doc(r.userId), { rrRating: r.rrRating }, { merge: true }))
    if (historyHolders.has(r.userId) && opts.tournamentId) {
      const tid = opts.tournamentId
      ops.push(b => b.set(adminDb.collection("users").doc(r.userId).collection("tournamentHistory").doc(tid),
        { rrRating: r.rrRating }, { merge: true }))
    }
  }
  // 参加費が 0 の人など、計算の対象外になった人は偏差値を持たせない。
  lbSnap.forEach(d => {
    if (d.id.startsWith("temp_") || rated.has(d.id) || banned.has(d.id)) return
    ops.push(b => b.set(d.ref, { rrRating: 0, banned: false }, { merge: true }))
  })
  for (const uid of bannedDocs) {
    ops.push(b => b.set(adminDb.collection("rrLeaderboard").doc(uid), { rrRating: 0, banned: true }, { merge: true }))
    ops.push(b => b.set(adminDb.collection("users").doc(uid), { rrRating: FieldValue.delete() }, { merge: true }))
  }
  await commitInChunks(ops)
  return { rated: results.length, excluded: bannedDocs.length }
}

/**
 * 終了した大会の成績を RR の集計に足し込む。同じ大会を二重に足さないよう、
 * 足し込んだら大会の文書に rrApplied を立てる(トランザクションで確認)。
 * 足し込んだときだけ true を返す。
 */
export async function applyTournamentToRr(storeId: string, tournamentId: string): Promise<boolean> {
  const tRef = adminDb.collection("stores").doc(storeId).collection("tournaments").doc(tournamentId)
  const entriesSnap = await tRef.collection("entries").get()

  return adminDb.runTransaction(async tx => {
    const tSnap = await tx.get(tRef)
    const t = tSnap.data()
    // rrPending は店舗が終了処理のときに立てる。この仕組みより前に終わった大会(すでに
    // 足し込み済み)には立っていないので、あとから呼ばれても二重に足さない。
    if (!t || t.status !== "finished" || t.rrPending !== true || t.rrApplied === true) return false

    const payouts: Array<{ playerId?: string; amount?: number }> = Array.isArray(t.payouts) ? t.payouts : []
    const fees = {
      entryFee: Number(t.entryFee ?? 0),
      reentryFee: Number(t.reentryFee ?? 0),
      addonFee: Number(t.addonFee ?? 0),
    }
    for (const d of entriesSnap.docs) {
      if (d.id.startsWith("temp_")) continue
      const e = d.data()
      const prize = Number(payouts.find(p => p.playerId === d.id)?.amount ?? 0)
      const c = tournamentContribution({
        entryCount: Number(e.entryCount ?? 0),
        reentryCount: Number(e.reentryCount ?? 0),
        addonCount: Number(e.addonCount ?? 0),
        ...fees,
        prize,
      })
      if (!c) continue
      tx.set(adminDb.collection("rrLeaderboard").doc(d.id), {
        userId: d.id,
        storeId,
        totalCost: FieldValue.increment(c.cost),
        totalReward: FieldValue.increment(c.reward),
        plays: FieldValue.increment(c.plays),
      }, { merge: true })
    }
    tx.update(tRef, { rrApplied: true, rrPending: false })
    return true
  })
}
