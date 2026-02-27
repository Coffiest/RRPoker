"use client"

import { useEffect, useState } from "react"
import { db } from "@/lib/firebase"
import { collection, getDocs, query, where, doc, updateDoc, increment, serverTimestamp } from "firebase/firestore"
import { useRouter } from "next/navigation"
import HomeHeader from "@/components/HomeHeader"
import { getCommonMenuItems } from "@/components/commonMenuItems"

export default function WithdrawalsClient({ storeId }: { storeId: string }) {
  const router = useRouter()
  const [withdrawals, setWithdrawals] = useState<any[]>([])
  const [players, setPlayers] = useState<Record<string, any>>({})

  useEffect(() => {
    if (!storeId) return
    const fetchWithdrawals = async () => {
      const snap = await getDocs(
        query(
          collection(db, "withdrawals"),
          where("storeId", "==", storeId),
          where("status", "==", "pending")
        )
      )
      const list: any[] = []
      const playerIds = new Set<string>()
      snap.forEach(docSnap => {
        const data = docSnap.data()
        list.push({ id: docSnap.id, ...data })
        playerIds.add(data.playerId)
      })
      setWithdrawals(list)
      // プレイヤー情報取得
      const playerMap: Record<string, any> = {}
      await Promise.all(Array.from(playerIds).map(async playerId => {
        const userSnap = await getDocs(
          query(collection(db, "users"), where("id", "==", playerId))
        )
        userSnap.forEach(d => {
          playerMap[playerId] = d.data()
        })
      }))
      setPlayers(playerMap)
    }
    fetchWithdrawals()
  }, [storeId])

  const approveWithdrawal = async (withdrawal: any) => {
    // balance/netGain減算
    const balanceRef = doc(db, "users", withdrawal.playerId, "storeBalances", storeId)
    await updateDoc(balanceRef, {
      balance: increment(-withdrawal.amount),
      netGain: increment(-withdrawal.amount)
    })
    await updateDoc(doc(db, "withdrawals", withdrawal.id), {
      status: "completed",
      approvedAt: serverTimestamp()
    })
  }

  const rejectWithdrawal = async (withdrawal: any) => {
    await updateDoc(doc(db, "withdrawals", withdrawal.id), {
      status: "rejected",
      rejectedAt: serverTimestamp()
    })
  }

  return (
    <main className="min-h-screen bg-white px-5 pb-28">
      <HomeHeader
        homePath="/home/store"
        myPagePath="/home/store/mypage"
        variant="store"
        menuItems={getCommonMenuItems(router, "store")}
      />
      <div className="mx-auto max-w-sm mt-6">
        <h2 className="text-[16px] font-semibold text-gray-900 mb-4">出金申請一覧</h2>
        {withdrawals.length === 0 ? (
          <p className="text-[13px] text-gray-500">申請はありません</p>
        ) : (
          <div className="space-y-3">
            {withdrawals.map(w => (
              <div key={w.id} className="rounded-2xl border border-gray-200 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[14px] font-semibold text-gray-900">{players[w.playerId]?.name ?? w.playerId}</p>
                    <p className="text-[12px] text-gray-500">{w.comment || "コメントなし"}</p>
                  </div>
                  <p className="text-[16px] font-semibold text-gray-900">{w.amount}</p>
                </div>
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={() => approveWithdrawal(w)} className="flex-1 rounded-2xl bg-green-500 py-2 text-[13px] font-semibold text-white">承認</button>
                  <button type="button" onClick={() => rejectWithdrawal(w)} className="flex-1 rounded-2xl bg-red-500 py-2 text-[13px] font-semibold text-white">却下</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
