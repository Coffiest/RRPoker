import { collection, doc, getDocs, getDoc } from "firebase/firestore"
import { db } from "./firebase"

export type NetGainPlayer = {
  id: string
  name?: string
  iconUrl?: string
  netGain: number
  rank: number
}

export async function getNetGainRankingFromUsers(storeId: string): Promise<NetGainPlayer[]> {
  const usersSnap = await getDocs(collection(db, "users"))

  const players: NetGainPlayer[] = []

  for (const userDoc of usersSnap.docs) {
    const userData = userDoc.data()

    const balanceRef = doc(db, "users", userDoc.id, "storeBalances", storeId)
    const balanceSnap = await getDoc(balanceRef)

    if (!balanceSnap.exists()) continue

    const balanceData = balanceSnap.data()
    const netGain = typeof balanceData?.netGain === "number" ? balanceData.netGain : 0

    if (netGain === 0) continue

    players.push({
      id: userDoc.id,
      name: userData?.name,
      iconUrl: userData?.iconUrl,
      netGain,
      rank: 0,
    })
  }

  players.sort((a, b) => b.netGain - a.netGain)

  let currentRank = 0
  let lastValue: number | null = null

  return players.map((p, i) => {
    if (lastValue === null || p.netGain !== lastValue) {
      currentRank = i + 1
      lastValue = p.netGain
    }
    return { ...p, rank: currentRank }
  })
}

export function getMyNetGainRank(userId: string, ranking: NetGainPlayer[]) {
  return ranking.find(p => p.id === userId) ?? null
}