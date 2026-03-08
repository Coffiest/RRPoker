"use client"

import { useEffect, useState } from "react"
import { auth, db } from "@/lib/firebase"
import { collection, getDocs } from "firebase/firestore"
import { FiArrowLeft } from "react-icons/fi"
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

    <main className="min-h-screen bg-[#FFFBF5] px-4">

      <div className="mx-auto max-w-sm">

        <button
          onClick={()=>router.back()}
          className="mt-6 flex items-center gap-2 text-[14px] text-gray-700"
        >
          <FiArrowLeft/>
          戻る
        </button>

        <h1 className="mt-4 text-[20px] font-semibold text-gray-700">
          Tournament History
        </h1>

        <div className="mt-6 space-y-3">

         {history.map(item => {

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
      className="rounded-2xl bg-white p-4 border border-gray-200 space-y-2"
    >

    <p className="text-[13px] text-gray-500">
  {formatDateTime(item.startedAt?.seconds)} {item.tournamentName ?? ""} ({item.storeName ?? ""})
</p>

      <div className="text-[12px] text-gray-700">

        <p className="font-semibold">Buy-in</p>

        {entryCount > 0 && (
          <p>Entry ({entryFee} ×{entryCount})</p>
        )}

        {reentryCount > 0 && (
          <p>Reentry ({reentryFee} ×{reentryCount})</p>
        )}

        {addonCount > 0 && (
          <p>Addon ({addonFee} ×{addonCount})</p>
        )}

        <p className="mt-1 font-semibold">
          Total {buyin}
        </p>

      </div>

      <div className="text-[12px] text-gray-700">

        <p className="font-semibold">Prize</p>

        {rank !== "-" ? (
          <p>{rank}位 {prize}</p>
        ) : (
          <p>-</p>
        )}

      </div>

      <div className="flex gap-3 text-[12px] text-gray-600">

        <span>Cost {cost}</span>

        <span>Reward {reward}</span>

      </div>

    </div>

  )

})}

        </div>

      </div>

    </main>

  )
}