"use client"

import { useEffect, useState } from "react"
import {
  collection,
  query,
  where,
  getDocs,
  orderBy
} from "firebase/firestore"
import { db } from "@/lib/firebase"

type Transaction = {
  amount: number
  createdAt?: any
  direction: "add" | "subtract"
  type: string
}

type Props = {
  playerId: string
  storeId: string
  onClose: () => void
}

function formatDate(ts: any) {
  if (!ts) return "-"
  if (typeof ts.seconds === "number") {
    return new Date(ts.seconds * 1000).toLocaleString()
  }
  return "-"
}

function formatType(type: string) {
  switch (type) {
    case "manual_adjustment":
      return "手動調整（チップ）"
    case "manual_adjustment_net_gain":
      return "手動調整（純増）"
    case "deposit_approved_purchase":
      return "入金（購入）"
    case "deposit_approved_pure_increase":
      return "入金（純増）"
    default:
      return type
  }
}

export default function PlayerHistoryModal({
  playerId,
  storeId,
  onClose
}: Props) {


  const [history, setHistory] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!playerId || !storeId) return

    const fetchHistory = async () => {
      setLoading(true)

      try {
        const q = query(
  collection(db, "transactions"),
  where("playerId", "==", playerId),
  where("storeId", "==", storeId),
  orderBy("createdAt", "desc")
)

        const snap = await getDocs(q)

        const data = snap.docs.map(doc => doc.data() as Transaction)

        setHistory(data)
      } catch (e) {
        console.error(e)
      }

      setLoading(false)
    }

    fetchHistory()
  }, [playerId, storeId])


  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white w-[420px] max-h-[80vh] overflow-y-auto text-gray-800 rounded-xl p-4">
        <h2 className="text-lg font-bold mb-4">チップ履歴</h2>

        {loading && <div>読み込み中...</div>}

        {!loading && history.length === 0 && (
          <div className="text-gray-500 text-sm">履歴なし</div>
        )}

        {!loading &&
          history.map((h, i) => (
            <div key={i} className="border-b py-2 text-sm">
            <div className="flex items-center justify-between">
  <div>
    <div className="text-[14px] font-semibold text-gray-900">
      {formatType(h.type)}
    </div>
    <div className="text-[12px] text-gray-500">
      {formatDate(h.createdAt)}
    </div>
  </div>

  <div
    className={`text-[14px] font-bold ${
      h.direction === "add" ? "text-green-600" : "text-red-600"
    }`}
  >
    {h.direction === "add" ? "+" : "-"}
    {h.amount}
  </div>
</div>
            </div>
          ))}

        <button
          onClick={onClose}
          className="mt-4 w-full bg-black text-white py-2 rounded"
        >
          閉じる
        </button>
      </div>
    </div>
  )
}