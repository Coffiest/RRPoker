'use client'

import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { auth, db } from "@/lib/firebase"
import HomeHeader from "@/components/HomeHeader"
import {
  collection,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  increment,
} from "firebase/firestore"
import { FiArrowLeft, FiArrowDownCircle, FiArrowUpCircle, FiHome, FiCreditCard, FiUser } from "react-icons/fi"

const KEYPAD_ROWS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["backspace", "0", ""],
]

export default function TransactionsClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialMode = searchParams.get("mode") === "withdraw" ? "withdraw" : "deposit"
  const [mode, setMode] = useState<"deposit" | "withdraw">(initialMode)
  const [amount, setAmount] = useState("")
  const [comment, setComment] = useState("")
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [storeId, setStoreId] = useState<string | null>(null)
  const [balance, setBalance] = useState(0)
  const [unitLabel, setUnitLabel] = useState("")
  const [blindBb, setBlindBb] = useState<number | null>(null)
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false)

  useEffect(() => {
    const fetchInfo = async () => {
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
      setBlindBb(typeof storeData?.ringBlindBb === "number" ? storeData.ringBlindBb : null)

      const balanceSnap = await getDoc(doc(db, "users", user.uid, "storeBalances", currentStoreId))
      const balanceData = balanceSnap.data()
      setBalance(typeof balanceData?.balance === "number" ? balanceData.balance : 0)
    }

    fetchInfo()
  }, [])

  const formattedAmount = useMemo(() => {
    const value = amount ? Number(amount) : 0
    return `${unitLabel}${value}`
  }, [amount, unitLabel])

  const useBb = typeof blindBb === "number" && blindBb > 0

  const formatBbValue = (value: number) => {
    if (!blindBb) return "0"
    const raw = value / blindBb
    const rounded = Number.isInteger(raw) ? raw : Math.round(raw * 10) / 10
    return rounded.toLocaleString()
  }

  const appendDigit = (digit: string) => {
    if (digit === "backspace") {
      setAmount(prev => prev.slice(0, -1))
      return
    }
    if (amount === "0") {
      setAmount(digit)
      return
    }
    setAmount(prev => `${prev}${digit}`)
  }

  const clearAmount = () => {
    setAmount("")
  }

  const submit = async () => {
    const user = auth.currentUser
    if (!user || !storeId) return
    const numeric = Number(amount)

    if (!numeric || numeric < 1) {
      setError("金額は1以上で入力してください")
      return
    }

    if (mode === "withdraw" && numeric > balance) {
      setError("残高が不足しています")
      return
    }

    setError("")

    if (mode === "deposit") {
      await setDoc(doc(collection(db, "depositRequests")), {
        storeId,
        playerId: user.uid,
        amount: numeric,
        comment,
        status: "pending",
        createdAt: serverTimestamp(),
      })
      setMessage("申請を行いました")
      setTimeout(() => router.replace("/home"), 1200)
      return
    }

    setIsWithdrawModalOpen(true)
  }

  const confirmWithdraw = async () => {
  const user = auth.currentUser
  if (!user || !storeId) return
  const numeric = Number(amount)

  if (!numeric || numeric < 1) {
    setError("金額が不正です")
    return
  }

  const balanceRef = doc(db, "users", user.uid, "storeBalances", storeId)
  const balanceSnap = await getDoc(balanceRef)
  const current = balanceSnap.data()?.balance ?? 0

  if (current < numeric) {
    setError("残高が不足しています")
    return
  }

  if (!balanceSnap.exists()) {
    setError("残高が不足しています")
    return
  }

  await updateDoc(balanceRef, {
    balance: increment(-numeric),
    netGain: increment(-numeric),
  })

  await setDoc(doc(collection(db, "withdrawals")), {
    storeId,
    playerId: user.uid,
    amount: numeric,
    comment,
    status: "completed",
    createdAt: serverTimestamp(),
  })

  setIsWithdrawModalOpen(false)
  router.replace("/home")
}

  if (!storeId) {
    return (
      <main className="min-h-screen bg-white px-5 pb-24">
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
        <nav className="fixed bottom-0 left-0 right-0 z-[80] border-t border-gray-200 bg-white">
          <div className="relative mx-auto flex max-w-sm items-center justify-between px-8 py-3">
            <button
              type="button"
              onClick={() => router.push("/home")}
              className="flex flex-col items-center text-gray-400"
            >
              <FiHome className="text-[18px]" />
              <span className="mt-1 text-[11px]">ホーム</span>
            </button>
            <button
              type="button"
              onClick={() => router.push("/home/transactions")}
              className="absolute left-1/2 top-0 flex h-[74px] w-[74px] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full bg-[#F2A900] text-gray-900"
              aria-label="入出金"
            >
              <FiCreditCard className="text-[22px]" />
              <span className="mt-1 text-[10px] font-semibold">入出金</span>
            </button>
            <button
              type="button"
              onClick={() => router.push("/home/mypage")}
              className="flex flex-col items-center text-gray-400"
            >
              <FiUser className="text-[18px]" />
              <span className="mt-1 text-[11px]">マイページ</span>
            </button>
          </div>
        </nav>

      </main>
    )
  }

  return (
    <main className="min-h-screen bg-white px-5 pb-24">
      <HomeHeader homePath="/home" myPagePath="/home/mypage" />
      <div className="mx-auto max-w-sm">
        <div className="flex items-center justify-between pt-[24px]">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex items-center gap-1 text-gray-600"
          >
            <FiArrowLeft className="text-[18px]" />
          </button>
          <h1 className="text-[20px] font-semibold text-gray-900">入出金</h1>
          <div className="w-6" />
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => setMode("deposit")}
            className={`flex-1 h-10 rounded-2xl border text-[14px] font-semibold flex items-center justify-center gap-2 ${
              mode === "deposit"
                ? "border-emerald-400 bg-emerald-50 text-emerald-700"
                : "border-gray-200 text-gray-900"
            }`}
          >
            <FiArrowDownCircle className="text-[16px]" />
            入金
          </button>
          <button
            type="button"
            onClick={() => setMode("withdraw")}
            className={`flex-1 h-10 rounded-2xl border text-[14px] font-semibold flex items-center justify-center gap-2 ${
              mode === "withdraw"
                ? "border-rose-400 bg-rose-50 text-rose-600"
                : "border-gray-200 text-gray-900"
            }`}
          >
            <FiArrowUpCircle className="text-[16px]" />
            出金
          </button>
        </div>

        <div className="mt-6 rounded-[28px] border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-[13px] text-gray-500">{mode === "deposit" ? "いくら入金しますか？" : "いくら出金しますか？"}</p>
          <div className="mt-3 rounded-[20px] border border-gray-200 bg-gray-50 px-4 py-3 text-center text-[30px] font-semibold text-gray-900">
            {formattedAmount}
          </div>
          <div className="mt-2 text-center text-[12px] text-gray-600">
            残高: {unitLabel}{balance}
            {useBb && `（${formatBbValue(balance)}BB）`}
          </div>

          <div className="mt-6 space-y-3">
            {KEYPAD_ROWS.map((row, rowIndex) => (
              <div key={rowIndex} className="grid grid-cols-3 gap-3">
                {row.map((key, index) => {
                  if (!key) return <div key={`${rowIndex}-${index}`} />
                  const isBackspace = key === "backspace"
                  return (
                    <button
                      key={`${rowIndex}-${index}`}
                      type="button"
                      onClick={() => appendDigit(key)}
                      className="h-14 rounded-2xl border border-gray-200 text-[18px] font-semibold text-gray-900 flex items-center justify-center"
                    >
                      {isBackspace ? "⌫" : key}
                    </button>
                  )
                })}
              </div>
            ))}
            <button
              type="button"
              onClick={clearAmount}
              className="h-12 w-full rounded-2xl border border-gray-200 text-[13px] text-gray-500"
            >
              クリア
            </button>
          </div>

          <div className="mt-4">
            <label className="text-[12px] text-gray-600">コメント（任意）</label>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              className="mt-2 h-20 w-full rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2 text-[14px]"
            />
          </div>

          {error && <p className="mt-3 text-center text-[13px] text-red-500">{error}</p>}
          {message && <p className="mt-3 text-center text-[13px] text-green-600">{message}</p>}

          <button
            type="button"
            onClick={submit}
            className={`mt-4 h-[52px] w-full rounded-[24px] text-[15px] font-semibold ${
              mode === "deposit"
                ? "bg-emerald-500 text-white"
                : "bg-rose-500 text-white"
            }`}
          >
            {mode === "deposit" ? "入金申請する" : "出金する"}
          </button>
        </div>
      </div>
      <nav className="fixed bottom-0 left-0 right-0 z-[80] border-t border-gray-200 bg-white">
        <div className="relative mx-auto flex max-w-sm items-center justify-between px-8 py-3">
          <button
            type="button"
            onClick={() => router.push("/home")}
            className="flex flex-col items-center text-gray-400"
          >
            <FiHome className="text-[18px]" />
            <span className="mt-1 text-[11px]">ホーム</span>
          </button>
          <button
            type="button"
            onClick={() => router.push("/home/transactions")}
            className="absolute left-1/2 top-0 flex h-[74px] w-[74px] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full bg-[#F2A900] text-gray-900"
            aria-label="入出金"
          >
            <FiCreditCard className="text-[22px]" />
            <span className="mt-1 text-[10px] font-semibold">入出金</span>
          </button>
          <button
            type="button"
            onClick={() => router.push("/home/mypage")}
            className="flex flex-col items-center text-gray-400"
          >
            <FiUser className="text-[18px]" />
            <span className="mt-1 text-[11px]">マイページ</span>
          </button>
        </div>
      </nav>

              {isWithdrawModalOpen && (
          <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/50">
            <div className="w-[90%] max-w-sm rounded-[24px] bg-white p-6">
              <h2 className="text-center text-[18px] font-semibold text-gray-900">確認画面</h2>

              <div className="mt-6 rounded-[20px] border border-gray-200 p-6 text-center">
                <p className="text-[12px] text-gray-500">ディーラーに見せてください</p>
                <div className="mt-4 text-[48px] font-bold text-gray-900">
                  {unitLabel}{Number(amount || 0)}
                </div>
              </div>

              {error && <p className="mt-3 text-center text-[13px] text-red-500">{error}</p>}

              <button
                onClick={confirmWithdraw}
                className="mt-6 h-[52px] w-full rounded-[24px] bg-[#F2A900] text-[15px] font-semibold text-gray-900"
              >
                確認してもらった
              </button>
            </div>
          </div>
        )}

    </main>
  )
}
