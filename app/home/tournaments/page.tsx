"use client"

import { useEffect, useState } from "react"
import { auth, db } from "@/lib/firebase"
import { collection, getDocs } from "firebase/firestore"
import { FiArrowLeft, FiAward, FiTrendingUp } from "react-icons/fi"
import { useRouter } from "next/navigation"

export default function TournamentHistoryPage() {

  const router = useRouter()

  const [userId, setUserId] = useState<string | null>(null)
  const [history, setHistory] = useState<any[]>([])
  

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(user => {
      setUserId(user?.uid ?? null)
    })
    return () => unsub()
  }, [])

  useEffect(() => {

    const fetchHistory = async () => {

      if (!userId) return

      const snap = await getDocs(
        collection(db, "users", userId, "tournamentHistory")
      )

      const list: any[] = []

      snap.forEach(docSnap => {
        const data = docSnap.data()

        list.push({
          id: docSnap.id,
          ...data
        })
      })

    list.sort((a, b) =>
  (b.startedAt?.seconds ?? 0) - (a.startedAt?.seconds ?? 0)
)

      setHistory(list)
    }

    fetchHistory()

  }, [userId])

  const formatDateTime = (seconds?: number) => {
    if (!seconds) return ""
    const date = new Date(seconds * 1000)

    const pad = (v:number)=>v.toString().padStart(2,"0")

    return `${date.getFullYear()}/${pad(date.getMonth()+1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
  }

  return (

    <main className="min-h-screen bg-[#FFFBF5] px-4 pb-12">
      <style>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-slideUp {
          animation: slideUp 0.3s ease-out;
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.4s ease-out;
        }
        .history-card {
          background: linear-gradient(145deg, #ffffff 0%, #fefefe 100%);
          box-shadow: 
            0 2px 8px rgba(242, 169, 0, 0.06),
            0 8px 24px rgba(0, 0, 0, 0.04);
        }
      `}</style>

      <div className="mx-auto max-w-sm">

        {/* Header */}
        <div className="flex items-center justify-between pt-6 mb-6">
          <button
            onClick={()=>router.back()}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/80 text-gray-600 hover:bg-white hover:text-gray-900 transition-all active:scale-95 shadow-sm"
          >
            <FiArrowLeft size={20} />
          </button>
          <h1 className="text-[20px] font-semibold text-gray-900">
            Tournament History
          </h1>
          <div className="w-10" />
        </div>

        {/* Stats Summary Card */}
        {history.length > 0 && (
          <div className="history-card rounded-3xl p-5 mb-6 animate-slideUp">
            <div className="flex items-center gap-2 mb-3">
              <FiTrendingUp className="text-[#F2A900]" size={18} />
              <p className="text-[14px] font-semibold text-gray-900">サマリー</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <p className="text-[11px] text-gray-500">参加数</p>
                <p className="text-[20px] font-bold text-gray-900">{history.length}</p>
              </div>
              <div className="text-center">
                <p className="text-[11px] text-gray-500">インマネ回数</p>
                <p className="text-[20px] font-bold text-[#F2A900]">
                  {history.filter(h => h.rank && h.rank !== "-").length}
                </p>
              </div>
              <div className="text-center">
                <p className="text-[11px] text-gray-500">インマネ率</p>
                <p className="text-[20px] font-bold text-[#D4910A]">
                  {history.length > 0 
                    ? `${Math.round((history.filter(h => h.rank && h.rank !== "-").length / history.length) * 100)}%`
                    : "0%"
                  }
                </p>
              </div>
            </div>
          </div>
        )}

        {/* History List */}
        <div className="space-y-3">

         {history.map((item, index) => {

  const entryCount = item.entryCount ?? 0
  const reentryCount = item.reentryCount ?? 0
  const addonCount = item.addonCount ?? 0

  const entryFee = item.entryFee ?? 0
  const reentryFee = item.reentryFee ?? 0
  const addonFee = item.addonFee ?? 0

  const prize = item.prize ?? 0
  const rank = item.rank ?? "-"

  const buyin =
    entryCount * entryFee +
    reentryCount * reentryFee +
    addonCount * addonFee

  let baseFee = 0

  if (entryFee > 0) baseFee = entryFee
  else if (reentryFee > 0) baseFee = reentryFee
  else baseFee = addonFee

  const cost = baseFee > 0 ? buyin / baseFee : 0
  const reward = baseFee > 0 ? prize / baseFee : 0

  return (

    <div
      key={item.id}
      className="history-card rounded-2xl p-4 hover:shadow-lg transition-all animate-fadeIn"
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      {/* Tournament Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <p className="text-[14px] font-semibold text-gray-900 leading-tight mb-1">
            {item.tournamentName ?? ""}
          </p>
          <p className="text-[11px] text-gray-500">
            {formatDateTime(item.startedAt?.seconds)} • {item.storeName ?? ""}
          </p>
        </div>
        {rank !== "-" && (
          <div className="ml-3 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#F2A900] to-[#D4910A] shadow-sm">
            <span className="text-[13px] font-bold text-white">{rank}位</span>
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        {/* Buy-in Section */}
        <div className="col-span-2 rounded-xl bg-gray-50 p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <div className="h-1.5 w-1.5 rounded-full bg-[#F2A900]"></div>
            <p className="text-[11px] font-semibold text-gray-600">Buy-in</p>
          </div>
          <div className="space-y-1 text-[12px] text-gray-600">
            {entryCount > 0 && (
              <p className="flex justify-between">
                <span>Entry:</span>
                <span className="font-medium">{entryFee} × {entryCount}回</span>
              </p>
            )}
            {reentryCount > 0 && (
              <p className="flex justify-between">
                <span>Re-entry:</span>
                <span className="font-medium">{reentryFee} × {reentryCount}回</span>
              </p>
            )}
            {addonCount > 0 && (
              <p className="flex justify-between">
                <span>Add-on:</span>
                <span className="font-medium">{addonFee} × {addonCount}回</span>
              </p>
            )}
            <div className="h-px bg-gray-200 my-1.5"></div>
            <p className="flex justify-between text-[13px] font-semibold text-gray-900">
              <span>合計出費:</span>
              <span>{buyin.toLocaleString()}</span>
            </p>
          </div>
        </div>

        {/* Prize Section */}
        <div className={`rounded-xl p-3 ${rank !== "-" ? "bg-gradient-to-br from-[#FFF6E5] to-[#FFFBF5] border border-[#F2A900]/20" : "bg-gray-50"}`}>
          <div className="flex items-center gap-1.5 mb-1.5">
            <div className={`h-1.5 w-1.5 rounded-full ${rank !== "-" ? "bg-[#F2A900]" : "bg-gray-400"}`}></div>
            <p className="text-[11px] font-semibold text-gray-600">Prize</p>
          </div>
          {rank !== "-" ? (
            <p className="text-[16px] font-bold text-[#D4910A]">
              {prize.toLocaleString()}
            </p>
          ) : (
            <p className="text-[14px] text-gray-400">-</p>
          )}
        </div>

        {/* ROI Indicator */}
        <div className="rounded-xl bg-gray-50 p-3">
          <p className="text-[11px] font-semibold text-gray-600 mb-1.5">ROI</p>
          <p className={`text-[16px] font-bold ${
            reward > cost ? "text-green-600" : 
            reward < cost ? "text-red-600" : 
            "text-gray-600"
          }`}>
            {cost > 0 ? `${(((reward - cost) / cost) * 100).toFixed(1)}%` : "-"}
          </p>
        </div>
      </div>

      {/* Cost/Reward Footer */}
      <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
        <div className="flex items-center gap-1.5 text-[11px]">
          <span className="text-gray-500">Cost:</span>
          <span className="font-semibold text-gray-700">{cost.toFixed(1)}</span>
        </div>
        <div className="h-3 w-px bg-gray-200"></div>
        <div className="flex items-center gap-1.5 text-[11px]">
          <span className="text-gray-500">Reward:</span>
          <span className="font-semibold text-gray-700">{reward.toFixed(1)}</span>
        </div>
      </div>

    </div>

  )

})}

          {/* Empty State */}
          {history.length === 0 && (
            <div className="text-center py-16 animate-fadeIn">
              <div className="h-20 w-20 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <FiAward className="text-gray-300" size={36} />
              </div>
              <p className="text-[16px] font-semibold text-gray-900 mb-1">
                トーナメント履歴がありません
              </p>
              <p className="text-[14px] text-gray-500">
                トーナメントに参加すると履歴が表示されます
              </p>
            </div>
          )}

        </div>

      </div>

    </main>

  )
}