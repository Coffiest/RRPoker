import { initializeApp } from "firebase-admin/app"
import { getFirestore, FieldValue } from "firebase-admin/firestore"

import { onDocumentWritten } from "firebase-functions/v2/firestore"
import { onSchedule } from "firebase-functions/v2/scheduler"
import { onCall, HttpsError } from "firebase-functions/v2/https"
import { setGlobalOptions } from "firebase-functions/v2"

initializeApp()
const db = getFirestore()

setGlobalOptions({ region: "asia-northeast1" })

const addMonths = (value: Date, months: number) => {
  const next = new Date(value)
  next.setMonth(next.getMonth() + months)
  return next
}

/**
 * 🔵 Store Ranking Update (v2)
 */
export const updatePublicRanking = onDocumentWritten(
  "users/{userId}/storeBalances/{storeId}",
  async (event) => {
    const { userId, storeId } = event.params

    try {
      const rankings: Array<{
        userId: string
        name?: string
        netGain: number
      }> = []

      const usersSnap = await db.collection("users").get()

      for (const userDoc of usersSnap.docs) {
        const balanceRef = db
          .collection("users")
          .doc(userDoc.id)
          .collection("storeBalances")
          .doc(storeId)

        const balanceSnap = await balanceRef.get()
        const data = balanceSnap.data()

        if (data) {
          rankings.push({
            userId: userDoc.id,
            name: userDoc.data()?.name,
            netGain: typeof data?.netGain === "number" ? data.netGain : 0,
          })
        }
      }

      rankings.sort((a, b) => b.netGain - a.netGain)

      const batch = db.batch()
      const publicRankingRef = db
        .collection("stores")
        .doc(storeId)
        .collection("publicRanking")

      const oldRankingsSnap = await publicRankingRef.get()
      oldRankingsSnap.docs.forEach((doc) => {
        batch.delete(doc.ref)
      })

      rankings.forEach((player, index) => {
        const docRef = publicRankingRef.doc(player.userId)
        batch.set(docRef, {
          userId: player.userId,
          name: player.name || null,
          netGain: player.netGain,
          rank: index + 1,
          updatedAt: FieldValue.serverTimestamp(),
        })
      })

      await batch.commit()
      console.log(`Updated ranking for store ${storeId}`)
    } catch (error) {
      console.error(`Error updating ranking for store ${storeId}:`, error)
      throw error
    }
  }
)

/**
 * 🔵 Chip Expiry Scheduler (v2)
 */
export const expireStoreBalances = onSchedule(
  {
    schedule: "every 24 hours",
    timeZone: "Asia/Tokyo",
  },
  async () => {
    const storesSnap = await db
      .collection("stores")
      .where("chipExpiryMonths", ">", 0)
      .get()

    if (storesSnap.empty) return

    const usersSnap = await db.collection("users").get()
    const now = new Date()

    for (const storeDoc of storesSnap.docs) {
      const storeData = storeDoc.data()
      const months =
        typeof storeData.chipExpiryMonths === "number"
          ? storeData.chipExpiryMonths
          : 0

      if (!months) continue

      for (const userDoc of usersSnap.docs) {
        const userData = userDoc.data()
        if (userData?.role === "store") continue

        const balanceRef = db
          .collection("users")
          .doc(userDoc.id)
          .collection("storeBalances")
          .doc(storeDoc.id)

        const balanceSnap = await balanceRef.get()
        if (!balanceSnap.exists) continue

        const balanceData = balanceSnap.data()
        const balanceValue =
          typeof balanceData?.balance === "number"
            ? balanceData.balance
            : 0

        if (balanceValue <= 0) continue

        const lastVisitedAt = balanceData?.lastVisitedAt?.toDate?.()
        if (!lastVisitedAt) continue

        const lastExpiredAt = balanceData?.lastExpiredAt?.toDate?.()
        if (
          lastExpiredAt &&
          lastExpiredAt.getTime() >= lastVisitedAt.getTime()
        )
          continue

        const expiresAt = addMonths(lastVisitedAt, months)
        if (now <= expiresAt) continue

        await balanceRef.update({
          balance: 0,
          netGain: 0,
          lastExpiredAt: FieldValue.serverTimestamp(),
        })

        await db
          .collection("stores")
          .doc(storeDoc.id)
          .collection("notices")
          .add({
            type: "chip_expired",
            userId: userDoc.id,
            userName: userData?.name ?? null,
            amount: balanceValue,
            expiredAt: FieldValue.serverTimestamp(),
            lastVisitedAt: balanceData?.lastVisitedAt ?? null,
          })
      }
    }
  }
)

/**
 * 🔵 Server Time (Callable)
 * Lets clients measure their local clock's offset from the server, so wall-clock
 * timer math (elapsed = clientNow - serverTimestamp) stays correct even when a
 * device's clock is off by a few seconds.
 */
export const getServerTime = onCall(
  { region: "asia-northeast1" },
  async () => ({ serverTimeMs: Date.now() })
)

// ════════════════════════════════════════════════════════════════════════
// 🔵 Tournament Timer Control (server-authoritative, advanced via Cloud Scheduler)
// ════════════════════════════════════════════════════════════════════════

type BlindLevel = {
  type: "level"
  smallBlind: number | null
  bigBlind: number | null
  ante: number | null
  duration: number | null
  comment?: string | null
} | {
  type: "break"
  duration: number | null
  comment?: string | null
}

// Helper: resolve blind levels from customBlindLevels or preset
async function resolveLevels(
  data: any,
  storeId: string
): Promise<BlindLevel[]> {
  if (Array.isArray(data?.customBlindLevels) && data.customBlindLevels.length > 0) {
    return data.customBlindLevels as BlindLevel[]
  }
  const presetId = data?.blindPresetId || data?.selectedPreset
  if (!presetId) return []
  const presetSnap = await db
    .collection("stores")
    .doc(storeId)
    .collection("blindPresets")
    .doc(presetId)
    .get()
  const presetData = presetSnap.data()
  return (Array.isArray(presetData?.levels) ? presetData.levels : []) as BlindLevel[]
}

// Helper: compute how many levels to advance in one pass.
// Returns null ONLY when the current level is still running and no write is needed.
// "Tournament finished" is a distinct, explicit result (finished: true) — callers must
// not treat null and "finished" as the same thing, or every still-running tournament
// gets paused the next time this runs.
function computeCatchUp(
  currentIdx: number,
  levelStartedAtMs: number,
  levelStartedRemaining: number,
  levels: BlindLevel[]
): { newLevelIndex: number; newTimeRemaining: number; finished: boolean } | null {
  // Clamped to >= 0 for the same reason as the client-side computeLiveLevelState.
  const elapsed = Math.max(0, Math.floor((Date.now() - levelStartedAtMs) / 1000))
  let timeLeft = levelStartedRemaining - elapsed

  if (timeLeft > 0) return null // Level still running — nothing to do

  let idx = currentIdx
  while (timeLeft <= 0) {
    const nextIdx = idx + 1
    if (nextIdx >= levels.length) {
      return { newLevelIndex: idx, newTimeRemaining: 0, finished: true } // Tournament over
    }
    idx = nextIdx
    const dur =
      typeof levels[idx]?.duration === "number" && levels[idx].duration! > 0
        ? levels[idx].duration! * 60
        : 1
    timeLeft += dur
  }

  return { newLevelIndex: idx, newTimeRemaining: timeLeft, finished: false }
}

/**
 * 🔵 Start Tournament Timer (Callable)
 */
export const startTournamentTimer = onCall(
  { region: "asia-northeast1" },
  async (request) => {
    if (!request.auth) throw new Error("Unauthenticated")

    const { storeId, tournamentId } = request.data as {
      storeId: string
      tournamentId: string
    }
    if (!storeId || !tournamentId) throw new Error("Missing storeId or tournamentId")

    const storeRef = db.collection("stores").doc(storeId)
    const storeSnap = await storeRef.get()
    if (!storeSnap.exists) throw new Error("Store not found")

    const ownerUid = storeSnap.data()?.ownerUid
    if (ownerUid !== request.auth.uid) throw new Error("Unauthorized")

    const tournamentRef = storeRef.collection("tournaments").doc(tournamentId)

    await db.runTransaction(async (tx) => {
      const tournamentSnap = await tx.get(tournamentRef)
      const data = tournamentSnap.data()
      if (!data) throw new Error("Tournament not found")

      const levels = await resolveLevels(data, storeId)
      if (levels.length === 0) throw new Error("No blind levels configured")

      const firstDur = typeof levels[0]?.duration === "number" && levels[0].duration > 0 ? levels[0].duration * 60 : 1200

      // Update Firestore
      tx.update(tournamentRef, {
        timerRunning: true,
        currentLevelIndex: data.currentLevelIndex ?? 0,
        levelStartedAt: FieldValue.serverTimestamp(),
        levelStartedRemaining: firstDur,
        timeRemaining: firstDur,
      })
    })
  }
)

/**
 * 🔵 Pause Tournament Timer (Callable)
 */
export const pauseTournamentTimer = onCall(
  { region: "asia-northeast1" },
  async (request) => {
    if (!request.auth) throw new Error("Unauthenticated")

    const { storeId, tournamentId } = request.data as {
      storeId: string
      tournamentId: string
    }
    if (!storeId || !tournamentId) throw new Error("Missing storeId or tournamentId")

    const storeRef = db.collection("stores").doc(storeId)
    const storeSnap = await storeRef.get()
    if (!storeSnap.exists) throw new Error("Store not found")
    if (storeSnap.data()?.ownerUid !== request.auth.uid) throw new Error("Unauthorized")

    const tournamentRef = storeRef.collection("tournaments").doc(tournamentId)

    await db.runTransaction(async (tx) => {
      const tournamentSnap = await tx.get(tournamentRef)
      const data = tournamentSnap.data()
      if (!data) throw new Error("Tournament not found")

      // Compute remaining from frozen snapshot + elapsed
      const levelStartedAtMs = data.levelStartedAt?.toMillis?.() ?? null
      const levelStartedRemaining = data.levelStartedRemaining ?? data.timeRemaining ?? 0
      const elapsed = levelStartedAtMs ? Math.floor((Date.now() - levelStartedAtMs) / 1000) : 0
      const remaining = Math.max(levelStartedRemaining - elapsed, 0)

      // Update Firestore
      tx.update(tournamentRef, {
        timerRunning: false,
        timeRemaining: remaining,
      })
    })
  }
)

/**
 * 🔵 Resume Tournament Timer (Callable)
 */
export const resumeTournamentTimer = onCall(
  { region: "asia-northeast1" },
  async (request) => {
    if (!request.auth) throw new Error("Unauthenticated")

    const { storeId, tournamentId } = request.data as {
      storeId: string
      tournamentId: string
    }
    if (!storeId || !tournamentId) throw new Error("Missing storeId or tournamentId")

    const storeRef = db.collection("stores").doc(storeId)
    const storeSnap = await storeRef.get()
    if (!storeSnap.exists) throw new Error("Store not found")
    if (storeSnap.data()?.ownerUid !== request.auth.uid) throw new Error("Unauthorized")

    const tournamentRef = storeRef.collection("tournaments").doc(tournamentId)

    await db.runTransaction(async (tx) => {
      const tournamentSnap = await tx.get(tournamentRef)
      const data = tournamentSnap.data()
      if (!data) throw new Error("Tournament not found")

      const remaining = typeof data.timeRemaining === "number" ? data.timeRemaining : 1200

      // Update Firestore
      tx.update(tournamentRef, {
        timerRunning: true,
        levelStartedAt: FieldValue.serverTimestamp(),
        levelStartedRemaining: remaining,
      })
    })
  }
)

/**
 * 🔵 Set Tournament Level (Callable)
 * Unified function for nextLevel / prevLevel. Accepts absolute level index.
 */
export const setTournamentLevel = onCall(
  { region: "asia-northeast1" },
  async (request) => {
    if (!request.auth) throw new Error("Unauthenticated")

    const { storeId, tournamentId, levelIndex } = request.data as {
      storeId: string
      tournamentId: string
      levelIndex: number
    }
    if (!storeId || !tournamentId || typeof levelIndex !== "number") {
      throw new Error("Missing or invalid parameters")
    }

    const storeRef = db.collection("stores").doc(storeId)
    const storeSnap = await storeRef.get()
    if (!storeSnap.exists) throw new Error("Store not found")
    if (storeSnap.data()?.ownerUid !== request.auth.uid) throw new Error("Unauthorized")

    const tournamentRef = storeRef.collection("tournaments").doc(tournamentId)

    await db.runTransaction(async (tx) => {
      const tournamentSnap = await tx.get(tournamentRef)
      const data = tournamentSnap.data()
      if (!data) throw new Error("Tournament not found")

      const levels = await resolveLevels(data, storeId)
      if (levels.length === 0) throw new Error("No blind levels configured")

      const clampedIdx = Math.max(0, Math.min(levelIndex, levels.length - 1))
      const nextLevel = levels[clampedIdx]
      const dur = typeof nextLevel?.duration === "number" && nextLevel.duration > 0 ? nextLevel.duration * 60 : 1200

      const isRunning = data.timerRunning ?? false

      if (isRunning) {
        tx.update(tournamentRef, {
          currentLevelIndex: clampedIdx,
          levelStartedAt: FieldValue.serverTimestamp(),
          levelStartedRemaining: dur,
          timeRemaining: dur,
          timerRunning: true,
        })
      } else {
        // Just update level and time if stopped
        tx.update(tournamentRef, {
          currentLevelIndex: clampedIdx,
          timeRemaining: dur,
          levelStartedRemaining: dur,
        })
      }
    })
  }
)

/**
 * 🔵 Adjust Tournament Time (Callable)
 */
export const adjustTournamentTime = onCall(
  { region: "asia-northeast1" },
  async (request) => {
    if (!request.auth) throw new Error("Unauthenticated")

    const { storeId, tournamentId, newSeconds } = request.data as {
      storeId: string
      tournamentId: string
      newSeconds: number
    }
    if (!storeId || !tournamentId || typeof newSeconds !== "number") {
      throw new Error("Missing or invalid parameters")
    }

    const storeRef = db.collection("stores").doc(storeId)
    const storeSnap = await storeRef.get()
    if (!storeSnap.exists) throw new Error("Store not found")
    if (storeSnap.data()?.ownerUid !== request.auth.uid) throw new Error("Unauthorized")

    const tournamentRef = storeRef.collection("tournaments").doc(tournamentId)

    await db.runTransaction(async (tx) => {
      const tournamentSnap = await tx.get(tournamentRef)
      const data = tournamentSnap.data()
      if (!data) throw new Error("Tournament not found")

      const isRunning = data.timerRunning ?? false
      if (isRunning) {
        tx.update(tournamentRef, {
          timeRemaining: newSeconds,
          levelStartedAt: FieldValue.serverTimestamp(),
          levelStartedRemaining: newSeconds,
          timerRunning: true,
        })
      } else {
        tx.update(tournamentRef, {
          timeRemaining: newSeconds,
          levelStartedRemaining: newSeconds,
        })
      }
    })
  }
)

/**
 * 🔵 Recover Stuck Tournament Timers (Safety net scheduler)
 * Runs every 1 minute to detect and recover from any broken task chains.
 */
export const recoverStuckTournamentTimers = onSchedule(
  {
    schedule: "every 1 minutes",
    timeZone: "Asia/Tokyo",
  },
  async () => {
    const storesSnap = await db.collection("stores").get()

    for (const storeDoc of storesSnap.docs) {
      const storeId = storeDoc.id
      const tournamentQuery = db
        .collection("stores")
        .doc(storeId)
        .collection("tournaments")
        .where("timerRunning", "==", true)

      const tournamentSnap = await tournamentQuery.get()

      for (const tournamentDoc of tournamentSnap.docs) {
        const data = tournamentDoc.data()
        const tournamentId = tournamentDoc.id
        const currentIdx = data.currentLevelIndex ?? 0
        const levelStartedAtMs = data.levelStartedAt?.toMillis?.() ?? null
        const levelStartedRemaining = data.levelStartedRemaining ?? data.timeRemaining ?? 0

        if (!levelStartedAtMs) continue

        const levels = await resolveLevels(data, storeId)
        const catchUp = computeCatchUp(currentIdx, levelStartedAtMs, levelStartedRemaining, levels)

        const tournamentRef = db
          .collection("stores")
          .doc(storeId)
          .collection("tournaments")
          .doc(tournamentId)

        if (!catchUp) continue // Level still running — nothing to do

        if (catchUp.finished) {
          await tournamentRef.update({ timerRunning: false })
          continue
        }

        // Advance to the caught-up level
        await tournamentRef.update({
          currentLevelIndex: catchUp.newLevelIndex,
          levelStartedAt: FieldValue.serverTimestamp(),
          levelStartedRemaining: catchUp.newTimeRemaining,
          timeRemaining: catchUp.newTimeRemaining,
        })
      }
    }
  }
)
/* ═══════════════════════════════════════════════════════════════════════════
 * リエントリー / アドオンの確定と取消
 *
 * これまでこの会計は、店舗の Players 画面が Firestore を直接書くことでしか
 * 起きなかった。プレイヤーの端末からも確定できるようにするにあたり、処理を
 * まるごとサーバーへ移す。クライアントから直接書かせない理由は2つある。
 *
 *   1. ルールで表現できない。1回の確定では大会文書の集計値と transactions を
 *      書く必要があるが、これらはどちらも店舗オーナーにしか許していない
 *      (firestore.rules)。プレイヤーに開けば、自分の残高を増やす・大会の
 *      集計を書き換える、が同時に可能になる。
 *   2. 金額を自己申告にできてしまう。参加費は大会文書にあるので、それを
 *      読むのはサーバーの仕事にする。
 *
 * 誰の操作かは request.auth.uid だけで決める。data の playerId は受け取らない。
 * ═══════════════════════════════════════════════════════════════════════════ */

type PurchaseKind = "reentry" | "addon"

/** 履歴に残す種別。店舗側の履歴表示がこの文字列で分岐している。 */
const TX_TYPE: Record<PurchaseKind, string> = {
  reentry: "store_tournament_reentry",
  addon: "store_tournament_addon",
}
/** entries の、種別ごとのフィールド名。 */
const COUNT_FIELD: Record<PurchaseKind, string> = {
  reentry: "reentryCount",
  addon: "addonCount",
}
/** 大会文書の集計フィールド名。 */
const TOTAL_FIELD: Record<PurchaseKind, string> = {
  reentry: "totalReentry",
  addon: "totalAddon",
}
/** 参加費のフィールド名。金額はクライアントから受け取らず、必ずここから読む。 */
const FEE_FIELD: Record<PurchaseKind, string> = {
  reentry: "reentryFee",
  addon: "addonFee",
}

/** 残高の置き場。系列店で共有するため、storeId とは別物になりうる。 */
const resolveBalanceGroupId = async (storeId: string): Promise<string> => {
  const storeSnap = await db.collection("stores").doc(storeId).get()
  const grouped = storeSnap.data()?.balanceGroupId
  return typeof grouped === "string" && grouped.length > 0 ? grouped : storeId
}

/**
 * 🔵 Apply Tournament Purchase (Callable)
 *
 * 1回の確定で動くものは4つ。どれか1つでも欠けると帳尻が合わなくなるので、
 * すべて1つのトランザクションで行う:
 *   1. entries/{uid} の reentryCount / addonCount
 *   2. 大会文書の totalReentry / totalAddon
 *   3. storeBalances/{balanceGroupId} の balance と netGain
 *   4. transactions に1件(これが「取り消せる単位」になる)
 *
 * 加減はすべて increment。絶対値を書かないので、店員が Players 画面を開いた
 * ままプレイヤーが操作しても、互いの変更が打ち消し合わない。
 */
export const applyTournamentPurchase = onCall(
  { region: "asia-northeast1" },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Unauthenticated")
    // 誰の操作かはトークンだけで決める。他人名義での確定はここで塞がる。
    const playerId = request.auth.uid

    const { storeId, tournamentId, kind } = request.data as {
      storeId?: string
      tournamentId?: string
      kind?: PurchaseKind
    }
    if (!storeId || !tournamentId) {
      throw new HttpsError("invalid-argument", "Missing storeId or tournamentId")
    }
    if (kind !== "reentry" && kind !== "addon") {
      throw new HttpsError("invalid-argument", "Invalid kind")
    }

    const balanceGroupId = await resolveBalanceGroupId(storeId)

    // 履歴に出す名前。プレイヤー自身のプロフィールから引く。
    const userSnap = await db.collection("users").doc(playerId).get()
    const playerName = (userSnap.data()?.name as string | undefined) ?? null

    const tournamentRef = db
      .collection("stores").doc(storeId)
      .collection("tournaments").doc(tournamentId)
    const entryRef = tournamentRef.collection("entries").doc(playerId)
    const balanceRef = db
      .collection("users").doc(playerId)
      .collection("storeBalances").doc(balanceGroupId)
    const txRef = db.collection("transactions").doc()

    const fee = await db.runTransaction(async (tx) => {
      const [tournamentSnap, balanceSnap] = await Promise.all([
        tx.get(tournamentRef),
        tx.get(balanceRef),
      ])

      const tournament = tournamentSnap.data()
      if (!tournament) throw new HttpsError("not-found", "not_found")

      // 終わった大会に後から積めないようにする。
      if (tournament.status !== "active") {
        throw new HttpsError("failed-precondition", "not_active")
      }

      const amount = Number(tournament[FEE_FIELD[kind]] ?? 0)
      // 参加費が設定されていない種別は、そもそも買えない(アドオン無しの大会など)。
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new HttpsError("failed-precondition", "no_fee")
      }

      const balance = Number(balanceSnap.data()?.balance ?? 0)
      // 画面側でもボタンを無効化しているが、すり抜けたときの最後の砦。
      if (balance < amount) {
        throw new HttpsError("failed-precondition", "insufficient")
      }

      // entries はまだ1件も無いことがある(仮参加など)。作りにいく。
      tx.set(
        entryRef,
        { name: playerName ?? "", [COUNT_FIELD[kind]]: FieldValue.increment(1) },
        { merge: true },
      )
      tx.update(tournamentRef, { [TOTAL_FIELD[kind]]: FieldValue.increment(1) })
      tx.set(
        balanceRef,
        { balance: FieldValue.increment(-amount), netGain: FieldValue.increment(-amount) },
        { merge: true },
      )
      tx.set(txRef, {
        storeId,
        playerId,
        playerName,
        amount,
        direction: "subtract",
        type: TX_TYPE[kind],
        tournamentId,
        // 取消のときに同じ残高へ戻すため、どこから引いたかを残す。
        balanceGroupId,
        // プレイヤー自身の端末から確定したものだと後から分かるようにする。
        // 見た目や集計には使わない(店員が入れたものと同じ1件として扱う)。
        source: "player",
        createdAt: FieldValue.serverTimestamp(),
      })

      return amount
    })

    return { transactionId: txRef.id, fee }
  }
)

/**
 * 🔵 Revert Tournament Purchase (Callable)
 *
 * 反対仕訳をもう1件足すのではなく、元の1件に revokedAt を立てたうえで
 * 数量と残高を逆向きに戻す。履歴に「リエントリー」と「その取消」が2行並ぶより、
 * 1行が取消済みとして残るほうが、店員が現状を読み違えないため。
 *
 * 押せるのは店舗オーナーだけ。プレイヤーが自分で取り消せると、
 * チップを払わずにリエントリーだけ残す、という抜け道ができる。
 */
export const revertTournamentPurchase = onCall(
  { region: "asia-northeast1" },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Unauthenticated")
    const uid = request.auth.uid

    const { transactionId } = request.data as { transactionId?: string }
    if (!transactionId) throw new HttpsError("invalid-argument", "Missing transactionId")

    const txRef = db.collection("transactions").doc(transactionId)
    const txSnap = await txRef.get()
    const data = txSnap.data()
    if (!data) throw new HttpsError("not-found", "not_found")

    const storeId = data.storeId as string | undefined
    if (!storeId) throw new HttpsError("failed-precondition", "wrong_type")

    const storeSnap = await db.collection("stores").doc(storeId).get()
    if (storeSnap.data()?.ownerUid !== uid) {
      throw new HttpsError("permission-denied", "Unauthorized")
    }

    const kind: PurchaseKind | null =
      data.type === TX_TYPE.reentry ? "reentry"
      : data.type === TX_TYPE.addon ? "addon"
      : null
    if (!kind) throw new HttpsError("failed-precondition", "wrong_type")

    // 残高の置き場は、引いたときと同じ場所でなければならない。この仕組みより前に
    // 店員が入れた履歴には記録が無いので、そのときは店舗文書から引き直す。
    const recorded = data.balanceGroupId
    const balanceGroupId =
      typeof recorded === "string" && recorded.length > 0
        ? recorded
        : ((storeSnap.data()?.balanceGroupId as string | undefined) || storeId)

    const { tournamentId, playerId } = data as { tournamentId: string; playerId: string }
    const fee = Number(data.amount ?? 0)

    const tournamentRef = db
      .collection("stores").doc(storeId)
      .collection("tournaments").doc(tournamentId)
    const entryRef = tournamentRef.collection("entries").doc(playerId)
    const balanceRef = db
      .collection("users").doc(playerId)
      .collection("storeBalances").doc(balanceGroupId)

    await db.runTransaction(async (tx) => {
      // 二重取消でチップが二重に戻らないよう、トランザクションの中で見直す。
      const fresh = await tx.get(txRef)
      if (fresh.data()?.revokedAt) {
        throw new HttpsError("already-exists", "already_revoked")
      }

      tx.set(entryRef, { [COUNT_FIELD[kind]]: FieldValue.increment(-1) }, { merge: true })
      tx.update(tournamentRef, { [TOTAL_FIELD[kind]]: FieldValue.increment(-1) })
      tx.set(
        balanceRef,
        { balance: FieldValue.increment(fee), netGain: FieldValue.increment(fee) },
        { merge: true },
      )
      tx.update(txRef, { revokedAt: FieldValue.serverTimestamp() })
    })

    return { ok: true }
  }
)
