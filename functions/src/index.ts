import { initializeApp } from "firebase-admin/app"
import { getFirestore, FieldValue } from "firebase-admin/firestore"

import { onDocumentWritten } from "firebase-functions/v2/firestore"
import { onSchedule } from "firebase-functions/v2/scheduler"
import { onCall } from "firebase-functions/v2/https"
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

// Helper: compute how many levels to advance in one pass
// Returns { newLevelIndex, newTimeRemaining } or null if tournament is over
function computeCatchUp(
  currentIdx: number,
  levelStartedAtMs: number,
  levelStartedRemaining: number,
  levels: BlindLevel[]
): { newLevelIndex: number; newTimeRemaining: number } | null {
  const elapsed = Math.floor((Date.now() - levelStartedAtMs) / 1000)
  let timeLeft = levelStartedRemaining - elapsed

  if (timeLeft > 0) return null // Level still running

  let idx = currentIdx
  while (timeLeft <= 0) {
    const nextIdx = idx + 1
    if (nextIdx >= levels.length) return null // Tournament over
    idx = nextIdx
    const dur =
      typeof levels[idx]?.duration === "number" && levels[idx].duration! > 0
        ? levels[idx].duration! * 60
        : 1
    timeLeft += dur
  }

  return { newLevelIndex: idx, newTimeRemaining: timeLeft }
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

        if (!catchUp) {
          // Tournament should be over
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