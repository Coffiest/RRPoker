"use client"

import HomeHeader from "@/components/HomeHeader"
import { useRouter } from "next/navigation"
import { getCommonMenuItems } from "@/components/commonMenuItems"
import { FiCreditCard, FiHome, FiUser } from "react-icons/fi"
import { useEffect, useState } from "react"
import { auth, db } from "@/lib/firebase"
import { collection, getDocs, updateDoc, doc, serverTimestamp } from "firebase/firestore"


const isExpired = (expiresAt: any) => {
  if (!expiresAt) return false
  if (typeof expiresAt.toDate === "function") {
    return expiresAt.toDate() < new Date()
  }
  return false
}

export default function TicketsPage() {

  const router = useRouter()

  const [tickets, setTickets] = useState<any[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null)
  const [isUseModalOpen, setIsUseModalOpen] = useState(false)
  const [isChecked, setIsChecked] = useState(false)


useEffect(() => {

  const unsub = auth.onAuthStateChanged(async (user) => {

    if (!user) {
      setUserId(null)
      setTickets([])
      return
    }

    const uid = user.uid
    setUserId(uid)

    const snap = await getDocs(
      collection(db, "users", uid, "tickets")
    )

    const list: any[] = []

    snap.forEach(doc => {
      list.push({
        id: doc.id,
        ...doc.data()
      })
    })

    setTickets(list)
  })

  return () => unsub()

}, [])

  return (
    <main className="min-h-screen bg-[#FFFBF5] pb-32">

      <HomeHeader
        homePath="/home"
        myPagePath="/home/mypage"
        showNotifications
        menuItems={getCommonMenuItems(router, 'user')}
      />

      <div className="mx-auto max-w-sm px-4">

        {/* Header */}
        <div className="mt-6">
          <div className="flex items-center gap-3 mb-4">
            <FiCreditCard className="text-[20px] text-[#F2A900]" />
            <h1 className="text-[20px] font-semibold text-gray-900">
              クーポン
            </h1>
          </div>

          {/* チケット一覧 */}
          {tickets.length === 0 ? (
            <div className="rounded-3xl bg-white p-6 shadow-sm border border-gray-100 text-center">
              <p className="text-[14px] text-gray-500">
                クーポンはまだありません
              </p>
            </div>
          ) : (


                <div className="space-y-3">
                  {tickets.map(ticket => (
                    <div
                      key={ticket.id}
                      className="rounded-2xl bg-white p-4 border border-gray-200 shadow-sm"
                    >
                      <p className="text-[15px] font-semibold text-gray-900">
                        {ticket.name}
                      </p>

                      <p className="text-[12px] text-gray-500 mt-1">
                        {ticket.isUsed ? "使用済み" : "未使用"}
                      </p>

                      {ticket.expiresAt && (
                        <p className="text-[11px] text-gray-500 mt-1">
                          期限: {ticket.expiresAt.toDate().toLocaleDateString()}
                        </p>
                      )}





<div className="flex items-center justify-between mt-3">


  {!ticket.isUsed && !isExpired(ticket.expiresAt) && (
    <button
      onClick={() => {
        setSelectedTicket(ticket)
        setIsUseModalOpen(true)
        setIsChecked(false)
      }}
      className="px-4 h-9 rounded-xl bg-[#F2A900] text-white text-[13px] font-semibold shadow-sm active:scale-95"
    >
      使用する
    </button>
  )}

</div>



                    </div>



                  ))}
                </div>




          )}

          

        </div>

      </div>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 w-full z-[80] glass-card border-t border-gray-200/60 shadow-lg">
        <div className="relative mx-auto flex max-w-sm items-center justify-between px-8 py-3">
          
          <button onClick={() => router.push("/home")}
            className="flex flex-col items-center text-gray-400">
            <FiHome size={22} />
            <span className="mt-1 text-[11px]">ホーム</span>
          </button>

          <button onClick={() => router.push("/home/transactions")}
            className="absolute left-1/2 top-0 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-2xl bg-[#F2A900] text-white">
            <FiCreditCard size={28} />
          </button>

          <button onClick={() => router.push("/home/mypage")}
            className="flex flex-col items-center text-gray-400">
            <FiUser size={22} />
            <span className="mt-1 text-[11px]">マイページ</span>
          </button>

        </div>
      </nav>

{isUseModalOpen && selectedTicket && (
  <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm">
    
    <div className="bg-white rounded-3xl p-6 w-[90%] max-w-sm shadow-2xl animate-slideUp">

      <p className="text-[18px] font-semibold text-gray-900 text-center mb-2">
        クーポンを使用
      </p>

      <p className="text-[13px] text-gray-500 text-center mb-5">
        スタッフにこの画面を見せてください
      </p>

      <div className="flex items-center gap-3 mb-5 px-2">
        <input
          type="checkbox"
          checked={isChecked}
          onChange={(e) => setIsChecked(e.target.checked)}
          className="w-5 h-5 accent-[#F2A900]"
        />
        <span className="text-[14px] text-gray-700 font-medium">
          スタッフが確認しました
        </span>
      </div>

      <button
        disabled={!isChecked}
        onClick={async () => {
          if (!selectedTicket || !userId) return

          await updateDoc(
            doc(db, "users", userId, "tickets", selectedTicket.id),
            {
              isUsed: true,
              usedAt: serverTimestamp()
            }
          )

          setTickets(prev =>
            prev.map(t =>
              t.id === selectedTicket.id
                ? { ...t, isUsed: true }
                : t
            )
          )

          setIsUseModalOpen(false)
        }}
        className={`w-full h-12 rounded-2xl font-semibold transition-all ${
          isChecked
            ? "bg-[#F2A900] text-white shadow-md active:scale-95"
            : "bg-gray-200 text-gray-400"
        }`}
      >
        使用済みにする
      </button>

      <button
        onClick={() => setIsUseModalOpen(false)}
        className="mt-3 w-full h-11 text-gray-500 text-[14px]"
      >
        キャンセル
      </button>

    </div>
  </div>
)}



    </main>
  )
}