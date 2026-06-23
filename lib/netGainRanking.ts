import { collection, doc, getDocs, getDoc, query, where, Timestamp, type QuerySnapshot, type DocumentData } from "firebase/firestore"
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

    try {
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
    } catch {
      // skip users whose balance doc is inaccessible
    }
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

function txNetGainDelta(tx: { type: string; amount?: number; direction?: string }): number | null {
  const amt = tx.amount ?? 0
  switch (tx.type) {
    case "store_cashout": return amt
    case "store_buyin": return -amt
    case "store_tournament_entry": return -amt
    case "store_tournament_reentry": return -amt
    case "store_tournament_addon": return -amt
    case "tournament_payout": return amt
    case "manual_adjustment_net_gain": return tx.direction === "add" ? amt : -amt
    case "withdraw_approved": return -amt
    case "other_net_gain": return tx.direction === "add" ? amt : -amt
    default: return null
  }
}

async function getMonthNetGainTotals(storeId: string, year: number, month: number): Promise<Map<string, number>> {
  const startOfMonth = new Date(year, month, 1, 0, 0, 0, 0)
  const startOfNextMonth = new Date(year, month + 1, 1, 0, 0, 0, 0)

  const txQuery = query(
    collection(db, "transactions"),
    where("storeId", "==", storeId),
    where("createdAt", ">=", Timestamp.fromDate(startOfMonth)),
    where("createdAt", "<", Timestamp.fromDate(startOfNextMonth)),
  )
  const txSnap = await getDocs(txQuery)

  const totals = new Map<string, number>()
  for (const txDoc of txSnap.docs) {
    const tx = txDoc.data()
    const playerId: string = tx.playerId
    if (!playerId) continue
    const delta = txNetGainDelta(tx as any)
    if (delta === null) continue
    totals.set(playerId, (totals.get(playerId) ?? 0) + delta)
  }
  return totals
}

async function getYearNetGainTotals(storeId: string, year: number): Promise<Map<string, number>> {
  const startOfYear = new Date(year, 0, 1, 0, 0, 0, 0)
  const startOfNextYear = new Date(year + 1, 0, 1, 0, 0, 0, 0)

  const txQuery = query(
    collection(db, "transactions"),
    where("storeId", "==", storeId),
    where("createdAt", ">=", Timestamp.fromDate(startOfYear)),
    where("createdAt", "<", Timestamp.fromDate(startOfNextYear)),
  )
  const txSnap = await getDocs(txQuery)

  const totals = new Map<string, number>()
  for (const txDoc of txSnap.docs) {
    const tx = txDoc.data()
    const playerId: string = tx.playerId
    if (!playerId) continue
    const delta = txNetGainDelta(tx as any)
    if (delta === null) continue
    totals.set(playerId, (totals.get(playerId) ?? 0) + delta)
  }
  return totals
}

function rankFromTotals(
  totals: Map<string, number>,
  usersSnap: QuerySnapshot<DocumentData>,
): NetGainPlayer[] {
  const userMap = new Map<string, { name?: string; iconUrl?: string }>()
  for (const u of usersSnap.docs) {
    const d = u.data()
    userMap.set(u.id, { name: d?.name, iconUrl: d?.iconUrl })
  }

  const players: NetGainPlayer[] = []
  for (const [id, netGain] of totals.entries()) {
    if (netGain === 0) continue
    const u = userMap.get(id)
    players.push({ id, name: u?.name, iconUrl: u?.iconUrl, netGain, rank: 0 })
  }

  players.sort((a, b) => b.netGain - a.netGain)

  let currentRank = 0
  let lastValue: number | null = null
  return players.map((p, i) => {
    if (lastValue === null || p.netGain !== lastValue) { currentRank = i + 1; lastValue = p.netGain }
    return { ...p, rank: currentRank }
  })
}

export async function getMonthlyNetGainRanking(
  storeId: string,
  year: number,
  month: number, // 0-indexed (JS Date convention)
): Promise<NetGainPlayer[]> {
  const [totals, usersSnap] = await Promise.all([
    getMonthNetGainTotals(storeId, year, month),
    getDocs(collection(db, "users")),
  ])
  return rankFromTotals(totals, usersSnap)
}

// 複数の月をまとめて合算した純増ランキング。各月を並列取得してプレイヤーごとに合計し、1回だけ順位付けする。
export async function getMultiMonthNetGainRanking(
  storeId: string,
  months: { year: number; month: number }[],
): Promise<NetGainPlayer[]> {
  if (months.length === 0) return []

  const [totalsList, usersSnap] = await Promise.all([
    Promise.all(months.map(m => getMonthNetGainTotals(storeId, m.year, m.month))),
    getDocs(collection(db, "users")),
  ])

  const combined = new Map<string, number>()
  for (const totals of totalsList) {
    for (const [id, val] of totals.entries()) {
      combined.set(id, (combined.get(id) ?? 0) + val)
    }
  }
  return rankFromTotals(combined, usersSnap)
}

export async function getYearlyNetGainRanking(
  storeId: string,
  year: number,
): Promise<NetGainPlayer[]> {
  const [totals, usersSnap] = await Promise.all([
    getYearNetGainTotals(storeId, year),
    getDocs(collection(db, "users")),
  ])
  return rankFromTotals(totals, usersSnap)
}