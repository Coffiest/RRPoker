"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { auth, db } from "@/lib/firebase"
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore"
import HomeHeader from "@/app/components/HomeHeader"

type HistoryItem = {
  id: string
  type: "deposit" | "deposit_pending" | "deposit_rejected" | "withdraw" | "manual_adjustment"
  amount: number
  createdAt?: { seconds?: number }
  direction?: "add" | "subtract"
}

export default function HistoryPage() {
  const router = useRouter()
  const [items, setItems] = useState<HistoryItem[]>([])
  const [storeId, setStoreId] = useState<string | null>(null)
  const [unitLabel, setUnitLabel] = useState("")

  useEffect(() => {
    const fetchHistory = async () => {
      const user = auth.currentUser
      if (!user) return

      const userSnap = await getDoc(doc(db, "users", user.uid))
      const userData = userSnap.data()
      const currentStoreId = userData?.currentStoreId ?? null
      setStoreId(currentStoreId)
      if (!currentStoreId) return

      const storeSnap = await getDoc(doc(db, "stores", currentStoreId))
      const storeData = storeSnap.data()
      const label = storeData?.chipUnitLabel
      setUnitLabel(label === "単位なし" ? "" : (label ?? ""))

      const depositSnap = await getDocs(
        query(
          collection(db, "depositRequests"),
          where("playerId", "==", user.uid),
          where("storeId", "==", currentStoreId)
        )
      )
      const withdrawSnap = await getDocs(
        query(
          collection(db, "withdrawals"),
          where("playerId", "==", user.uid),
          where("storeId", "==", currentStoreId)
        )
      )
      const manualSnap = await getDocs(
        query(
          collection(db, "transactions"),
          where("playerId", "==", user.uid),
          where("storeId", "==", currentStoreId)
        )
      )

      const next: HistoryItem[] = []
      depositSnap.forEach(docSnap => {
        const data = docSnap.data()
        if (data.status === "pending") {
          next.push({ id: docSnap.id, type: "deposit_pending", amount: data.amount, createdAt: data.createdAt })
        } else if (data.status === "rejected") {
          next.push({ id: docSnap.id, type: "deposit_rejected", amount: data.amount, createdAt: data.createdAt })
        } else {
          next.push({ id: docSnap.id, type: "deposit", amount: data.amount, createdAt: data.createdAt })
        }
      })
      withdrawSnap.forEach(docSnap => {
        const data = docSnap.data()
        next.push({ id: docSnap.id, type: "withdraw", amount: data.amount, createdAt: data.createdAt })
      })
      manualSnap.forEach(docSnap => {
        const data = docSnap.data()
        next.push({
          id: docSnap.id,
          type: "manual_adjustment",
          amount: data.amount,
          createdAt: data.createdAt,
          direction: data.direction,
        })
      })

      setItems(next)
    }

    fetchHistory()
  }, [])

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))
  }, [items])

  const getLabel = (item: HistoryItem) => {
    switch (item.type) {
      case "deposit":
        return "入金"
      case "deposit_pending":
        return "入金申請中"
      case "deposit_rejected":
        return "申請拒否"
      case "withdraw":
        return "出金"
      case "manual_adjustment":
        return "手動調整"
    }
  }

  const getColor = (item: HistoryItem) => {
    switch (item.type) {
      case "deposit":
        return "text-green-600"
      case "deposit_pending":
        return "text-orange-500"
      case "deposit_rejected":
        return "text-gray-400"
      case "withdraw":
        return "text-red-500"
      case "manual_adjustment":
        return "text-[#B00020]"
    }
  }

  const getAmountLabel = (item: HistoryItem) => {
    if (item.type === "withdraw") return `-${unitLabel}${item.amount}`
    if (item.type === "manual_adjustment") {
      const sign = item.direction === "subtract" ? "-" : "+"
      return `${sign}${unitLabel}${item.amount}`
    }
    return `+${unitLabel}${item.amount}`
  }

  if (!storeId) {
    return (
      <main className="min-h-screen bg-white px-5">
        <HomeHeader homePath="/home" myPagePath="/home/mypage" />
        <div className="mx-auto max-w-sm pt-[72px] text-center">
          <p className="text-[14px] text-gray-500">入店中の店舗がありません</p>
          <button
            type="button"
            onClick={() => router.replace("/home")}
            className="mt-6 h-[48px] w-full rounded-[20px] bg-[#F2A900] text-[14px] font-semibold text-gray-900"
          >
            ホームへ戻る
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-white px-5">
      <HomeHeader homePath="/home" myPagePath="/home/mypage" />
      <div className="mx-auto max-w-sm">
        <div className="pt-[56px] text-center">
          <h1 className="text-[22px] font-semibold text-gray-900">入出金履歴</h1>
        </div>

        <div className="mt-6 space-y-3">
          {sortedItems.length === 0 ? (
            <p className="text-center text-[13px] text-gray-500">履歴がありません</p>
          ) : (
            sortedItems.map(item => (
              <div key={item.id} className="rounded-[20px] border border-gray-200 p-3">
                <div className="flex items-center justify-between">
                  <p className={`text-[14px] font-semibold ${getColor(item)}`}>{getLabel(item)}</p>
                  <p className="text-[14px] font-semibold text-gray-900">{getAmountLabel(item)}</p>
                </div>
              </div>
            ))
          )}
        </div>

        <button
          type="button"
          onClick={() => router.back()}
          className="mt-6 text-[13px] text-gray-500"
        >
          戻る
        </button>
      </div>
    </main>
  )
}
