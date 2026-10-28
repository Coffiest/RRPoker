'use client'

import { useEffect, useState } from "react"
import PlayerBottomNav from "@/components/PlayerBottomNav"
import { useRouter, useSearchParams } from "next/navigation"
import { auth, db } from "@/lib/firebase"
import {
  collection,
  doc,
  getDoc,
  increment,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore"
import HomeHeader from "@/components/HomeHeader"
import ChipDisclaimer from "@/components/ChipDisclaimer"

export default function WithdrawConfirmClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const amountParam = searchParams.get("amount")
  const commentParam = searchParams.get("comment") ?? ""
  const [unitLabel, setUnitLabel] = useState("")
  const [storeId, setStoreId] = useState<string | null>(null)
  const [error, setError] = useState("")

  const amount = Number(amountParam ?? 0)

  useEffect(() => {
    const fetchStore = async () => {
      const user = auth.currentUser
      if (!user) return
      const userSnap = await getDoc(doc(db, "users", user.uid))
      const data = userSnap.data()
      const currentStoreId = data?.currentStoreId ?? null
      setStoreId(currentStoreId)
      if (!currentStoreId) return

      const storeSnap = await getDoc(doc(db, "stores", currentStoreId))
      const storeData = storeSnap.data()
      const label = storeData?.chipUnitLabel
      setUnitLabel(label === "単位なし" ? "" : (label ?? ""))
    }

    fetchStore()
  }, [])

  const confirm = async () => {
    const user = auth.currentUser
    if (!user || !storeId) return
    if (!amount || amount < 1) {
      setError("金額が不正です")
      return
    }

    const balanceRef = doc(db, "users", user.uid, "storeBalances", storeId)
    const balanceSnap = await getDoc(balanceRef)
    const current = balanceSnap.data()?.balance ?? 0
    const currentNetGain = balanceSnap.data()?.netGain ?? 0
    
    if (current < amount) {
      setError("残高が不足しています")
      return
    }

    if (!balanceSnap.exists()) {
      setError("残高が不足しています")
      return
    }

    await updateDoc(balanceRef, { 
      balance: increment(-amount),
      netGain: increment(-amount)
    })
    await setDoc(doc(collection(db, "withdrawals")), {
      storeId,
      playerId: user.uid,
      amount,
      comment: commentParam,
      status: "completed",
      createdAt: serverTimestamp(),
    })

    router.replace("/home")
  }

  if (!amount) {
    return (
      <main className="min-h-screen bg-white px-6 pb-24">
        <HomeHeader homePath="/home" myPagePath="/home/mypage" />
        <div className="mx-auto max-w-sm pt-[72px] text-center">
          <p className="text-[14px] text-gray-500">金額が指定されていません</p>
          <button
            type="button"
            onClick={() => router.replace("/home")}
            className="mt-6 h-[48px] w-full rounded-[20px] bg-[#F2A900] text-[14px] font-semibold text-white"
          >
            ホームへ戻る
          </button>
        </div>
        <PlayerBottomNav />
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-white px-6 pb-24">
      <HomeHeader homePath="/home" myPagePath="/home/mypage" />
      <div className="mx-auto max-w-sm">
        <div className="pt-[72px] text-center">
          <h1 className="text-[18px] font-semibold text-gray-900">確認画面</h1>
        </div>

        <div className="mt-8 rounded-[24px] border border-gray-200 p-8 text-center">
          <p className="text-[12px] text-gray-500">ディーラーに見せてください</p>
          <div className="mt-6 text-[56px] font-bold text-gray-900">
            <span className="flip-amount-bottom">{unitLabel}{amount}</span>
          </div>
        </div>

        {error && <p className="mt-4 text-center text-[13px] text-red-500">{error}</p>}

        <button
          type="button"
          onClick={confirm}
          className="mt-6 h-[52px] w-full rounded-[24px] bg-[#F2A900] text-[15px] font-semibold text-white"
        >
          確認してもらった
        </button>
        <ChipDisclaimer className="mt-4 text-center" />
      </div>
        <PlayerBottomNav />
    </main>
  )
}
