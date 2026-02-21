import * as functions from "firebase-functions"
import * as admin from "firebase-admin"

admin.initializeApp()

const db = admin.firestore()

const addMonths = (value: Date, months: number) => {
  const next = new Date(value)
  next.setMonth(next.getMonth() + months)
  return next
}

export const updatePublicRanking = functions
  .region("asia-northeast1")
  .firestore
  .document("users/{userId}/storeBalances/{storeId}")
  .onWrite(async (change, context) => {
    const { userId, storeId } = context.params

    try {
      // Get all storeBalances for this store
      const balancesSnap = await db
        .collectionGroup("storeBalances")
        .where("__name__", "==", storeId)
        .get()

      // Collect all users' balances for this store
      const rankings: Array<{
        userId: string
        name?: string
        netGain: number
      }> = []

      // Query users and their store balances
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

      // Sort by netGain descending
      rankings.sort((a, b) => b.netGain - a.netGain)

      // Write to publicRanking collection
      const batch = db.batch()
      const publicRankingRef = db.collection("stores").doc(storeId).collection("publicRanking")

      // Delete old ranking data
      const oldRankingsSnap = await publicRankingRef.get()
      oldRankingsSnap.docs.forEach(doc => {
        batch.delete(doc.ref)
      })

      // Write new ranking data
      rankings.forEach((player, index) => {
        const docRef = publicRankingRef.doc(player.userId)
        batch.set(docRef, {
          userId: player.userId,
          name: player.name || null,
          netGain: player.netGain,
          rank: index + 1,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        })
      })

      await batch.commit()
      console.log(`Updated ranking for store ${storeId}`)
    } catch (error) {
      console.error(`Error updating ranking for store ${storeId}:`, error)
      throw error
    }
  })

export const expireStoreBalances = functions
  .region("asia-northeast1")
  .pubsub
  .schedule("every 24 hours")
  .timeZone("Asia/Tokyo")
  .onRun(async () => {
    const storesSnap = await db.collection("stores").where("chipExpiryMonths", ">", 0).get()
    if (storesSnap.empty) return null

    const usersSnap = await db.collection("users").get()
    const now = new Date()

    for (const storeDoc of storesSnap.docs) {
      const storeData = storeDoc.data()
      const months = typeof storeData.chipExpiryMonths === "number" ? storeData.chipExpiryMonths : 0
      if (!months) continue

      for (const userDoc of usersSnap.docs) {
        const userData = userDoc.data()
        if (userData?.role === "store") continue

        const balanceRef = db.collection("users").doc(userDoc.id).collection("storeBalances").doc(storeDoc.id)
        const balanceSnap = await balanceRef.get()
        if (!balanceSnap.exists) continue

        const balanceData = balanceSnap.data()
        const balanceValue = typeof balanceData?.balance === "number" ? balanceData.balance : 0
        if (balanceValue <= 0) continue

        const lastVisitedAt = balanceData?.lastVisitedAt?.toDate?.()
        if (!lastVisitedAt) continue

        const lastExpiredAt = balanceData?.lastExpiredAt?.toDate?.()
        if (lastExpiredAt && lastExpiredAt.getTime() >= lastVisitedAt.getTime()) continue

        const expiresAt = addMonths(lastVisitedAt, months)
        if (now <= expiresAt) continue

        await balanceRef.update({
          balance: 0,
          netGain: 0,
          lastExpiredAt: admin.firestore.FieldValue.serverTimestamp(),
        })

        await db.collection("stores").doc(storeDoc.id).collection("notices").add({
          type: "chip_expired",
          userId: userDoc.id,
          userName: userData?.name ?? null,
          amount: balanceValue,
          expiredAt: admin.firestore.FieldValue.serverTimestamp(),
          lastVisitedAt: balanceData?.lastVisitedAt ?? null,
        })
      }
    }

    return null
  })
