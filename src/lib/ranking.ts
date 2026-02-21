import { collection, getDocs } from "firebase/firestore"
import { db } from "./firebase"

export type RankingPlayer = {
  id: string
  name?: string
  netGain: number
  rank: number
}

export async function getNetGainRanking(storeId: string): Promise<RankingPlayer[]> {
  try {
    const players: Array<{ id: string; name?: string; netGain: number; rank: number }> = []

    const rankingSnap = await getDocs(collection(db, "stores", storeId, "publicRanking"))
    rankingSnap.forEach(docSnap => {
      const data = docSnap.data()
      players.push({
        id: docSnap.id,
        name: data?.name,
        netGain: typeof data?.netGain === "number" ? data.netGain : 0,
        rank: typeof data?.rank === "number" ? data.rank : 0,
      })
    })

    // Sort by rank (which is calculated by Cloud Functions)
    players.sort((a, b) => a.rank - b.rank)

    return players
  } catch (error) {
    console.error("Failed to get ranking:", error)
    return []
  }
}

export function getUserRank(userId: string, ranking: RankingPlayer[]): RankingPlayer | null {
  return ranking.find(p => p.id === userId) ?? null
}
