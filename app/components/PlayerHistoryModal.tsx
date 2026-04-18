"use client"

import { useEffect, useState } from "react"
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import { FiX, FiTrendingUp, FiTrendingDown } from "react-icons/fi"

type Transaction = {
  id: string
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

/* ===== 日付 ===== */
function formatDate(ts: any) {
  if (!ts) return "-"
  if (typeof ts.seconds === "number") {
    return new Date(ts.seconds * 1000).toLocaleString("ja-JP")
  }
  return "-"
}

/* ===== タイプ日本語化 ===== */
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

    case "withdraw_approved":
      return "出金"

    case "withdraw_request":
      return "出金申請"

    default:
      return "不明"
  }
}

export default function PlayerHistoryModal({
  playerId,
  storeId,
  onClose
}: Props) {

  const [history, setHistory] = useState<Transaction[]>([])

  useEffect(() => {
    if (!playerId || !storeId) return

    const q = query(
      collection(db, "transactions"),
      where("playerId", "==", playerId),
      where("storeId", "==", storeId),
      orderBy("createdAt", "desc")
    )

    const unsub = onSnapshot(q, snap => {
      const list: Transaction[] = []
      snap.forEach(doc => {
        list.push({
          id: doc.id,
          ...(doc.data() as Omit<Transaction, "id">)
        })
      })
      setHistory(list)
    })

    return () => unsub()
  }, [playerId, storeId])

  return (
    <div className="fixed inset-0 z-[200] bg-black/30 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
      
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl animate-slideUp overflow-hidden">

        {/* ===== Header ===== */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <p className="text-[16px] font-semibold text-gray-900">
            チップ履歴
          </p>
          <button onClick={onClose}>
            <FiX size={20} className="text-gray-500"/>
          </button>
        </div>

        {/* ===== Body ===== */}
        <div className="max-h-[60vh] overflow-y-auto px-4 py-3 space-y-2">

          {history.length === 0 && (
            <p className="text-center text-gray-400 text-[13px] py-10">
              履歴なし
            </p>
          )}

          {history.map(item => {
            const isAdd = item.direction === "add"

            return (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3"
              >
                <div className="flex items-center gap-2">
                  
                  {/* アイコン */}
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                    isAdd ? "bg-green-100" : "bg-red-100"
                  }`}>
                    {isAdd ? (
                      <FiTrendingUp size={16} className="text-green-600"/>
                    ) : (
                      <FiTrendingDown size={16} className="text-red-500"/>
                    )}
                  </div>

                  {/* テキスト */}
                  <div>
                    <p className="text-[13px] font-medium text-gray-900">
                      {formatType(item.type)}
                    </p>
                    <p className="text-[11px] text-gray-500">
                      {formatDate(item.createdAt)}
                    </p>
                  </div>
                </div>

                {/* 金額 */}
                <p className={`text-[14px] font-bold ${
                  isAdd ? "text-green-600" : "text-red-500"
                }`}>
                  {isAdd ? "+" : "-"}¥{item.amount?.toLocaleString()}
                </p>
              </div>
            )
          })}
        </div>

        {/* ===== Footer ===== */}
        <div className="p-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="w-full h-11 rounded-2xl bg-gray-100 text-gray-700 text-[14px] font-medium hover:bg-gray-200 transition-all"
          >
            閉じる
          </button>
        </div>

      </div>
    </div>
  )
}