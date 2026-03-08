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
        (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0)
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

          {history.map(item => (

            <div
              key={item.id}
              className="rounded-2xl bg-white p-4 border border-gray-200"
            >

              <p className="text-[13px] text-gray-500">
                {formatDateTime(item.createdAt?.seconds)}
              </p>

              <p className="text-[16px] font-semibold mt-1 text-gray-700">
                Prize: {item.prize ?? 0}
              </p>

              <p className="text-[14px] text-gray-600">
                Place: {item.place ?? "-"}
              </p>

              <p className="text-[14px] text-gray-600">
                Players: {item.players ?? "-"}
              </p>

            </div>

          ))}

        </div>

      </div>

    </main>

  )
}