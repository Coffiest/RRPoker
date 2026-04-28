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
import { FiArrowLeft, FiArrowDownCircle, FiArrowUpCircle, FiHome, FiCreditCard, FiUser, FiAlertCircle, FiCheckCircle } from "react-icons/fi"

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
  const [uid, setUid] = useState<string | null>(null)

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async user => {
      if (!user) return
      setUid(user.uid)
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
    })
    return () => unsub()
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
    if (!uid || !storeId) return
    const numeric = Number(amount)

    if (!numeric || numeric < 1) {
      setError("数字は1以上で入力してください")
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
        playerId: uid,
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
    if (!uid || !storeId) return
    const numeric = Number(amount)

    if (!numeric || numeric < 1) {
      setError("数字は1以上で入力してください")
      return
    }

    const balanceRef = doc(db, "users", uid, "storeBalances", storeId)
    const balanceSnap = await getDoc(balanceRef)
    const current = balanceSnap.data()?.balance ?? 0

    if (!balanceSnap.exists() || current < numeric) {
      setError("残高が不足しています")
      return
    }

    await setDoc(doc(collection(db, "withdrawRequests")), {
      storeId,
      playerId: uid,
      amount: numeric,
      comment,
      status: "pending",
      createdAt: serverTimestamp(),
    })

    setIsWithdrawModalOpen(false)
    router.replace("/home")
  }

  if (!storeId) {
    return (
      <main className="min-h-screen bg-[#FFFBF5] px-5 pb-24">
        <style>{`
          .glass-card {
            background: rgba(255, 255, 255, 0.7);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
          }
        `}</style>
        <HomeHeader homePath="/home" myPagePath="/home/mypage" />
        <div className="mx-auto max-w-sm pt-[72px] text-center">
          <div className="h-20 w-20 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <FiAlertCircle className="text-gray-400" size={36} />
          </div>
          <p className="text-[16px] font-semibold text-gray-900 mb-2">入店中の店舗がありません</p>
          <p className="text-[14px] text-gray-500">店舗にチェックインしてください</p>
          <button
            type="button"
            onClick={() => router.replace("/home")}
            className="mt-6 h-[52px] w-full rounded-2xl bg-gradient-to-br from-[#F2A900] to-[#D4910A] text-[15px] font-semibold text-white shadow-lg hover:shadow-xl transition-all active:scale-98"
          >
            ホームへ戻る
          </button>
        </div>
        <nav className="fixed bottom-0 left-0 right-0 z-[80] glass-card border-t border-gray-200/60 shadow-lg">
          <div className="relative mx-auto flex max-w-sm items-center justify-between px-8 py-3">
            <button
              type="button"
              onClick={() => router.push("/home")}
              className="flex flex-col items-center text-gray-400"
            >
              <FiHome size={22} />
              <span className="mt-1 text-[11px]">ホーム</span>
            </button>
            <button
              type="button"
              onClick={() => router.push("/home/transactions")}
              className="absolute left-1/2 top-0 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-[#F2A900] to-[#D4910A] text-white shadow-xl"
              aria-label="Bank Roll"
            >
              <FiCreditCard size={28} />
            </button>
            <button
              type="button"
              onClick={() => router.push("/home/mypage")}
              className="flex flex-col items-center text-gray-400"
            >
              <FiUser size={22} />
              <span className="mt-1 text-[11px]">マイページ</span>
            </button>
          </div>
        </nav>

      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#FFFBF5] px-5 pb-24">
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
        .transaction-card {
          background: linear-gradient(145deg, #ffffff 0%, #fefefe 100%);
          box-shadow: 
            0 2px 8px rgba(242, 169, 0, 0.06),
            0 8px 24px rgba(0, 0, 0, 0.04);
        }
        .keypad-button {
          background: linear-gradient(145deg, #ffffff 0%, #fefefe 100%);
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
          transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .keypad-button:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.08);
        }
        .keypad-button:active {
          transform: scale(0.96);
        }
        .glass-card {
          background: rgba(255, 255, 255, 0.7);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
        }
        .modal-overlay {
          background: rgba(0, 0, 0, 0.3);
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
        }
      `}</style>
      <HomeHeader homePath="/home" myPagePath="/home/mypage" />
      <div className="mx-auto max-w-sm">
        <div className="flex items-center justify-between pt-[24px]">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/80 text-gray-600 hover:bg-white hover:text-gray-900 transition-all active:scale-95 shadow-sm"
          >
            <FiArrowLeft size={20} />
          </button>
          <h1 className="text-[20px] font-semibold text-gray-900">入出金</h1>
          <div className="w-10" />
        </div>

        {/* Mode Toggle */}
        <div className="mt-6 flex gap-3 animate-slideUp">
          <button
            type="button"
            onClick={() => setMode("deposit")}
            className={`flex-1 h-12 rounded-2xl border-2 text-[15px] font-semibold flex items-center justify-center gap-2 transition-all ${
              mode === "deposit"
                ? "border-emerald-400 bg-gradient-to-br from-emerald-50 to-emerald-100 text-emerald-700 shadow-md"
                : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            <FiArrowDownCircle size={18} />
            あずける
          </button>
          <button
            type="button"
            onClick={() => setMode("withdraw")}
            className={`flex-1 h-12 rounded-2xl border-2 text-[15px] font-semibold flex items-center justify-center gap-2 transition-all ${
              mode === "withdraw"
                ? "border-rose-400 bg-gradient-to-br from-rose-50 to-rose-100 text-rose-700 shadow-md"
                : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            <FiArrowUpCircle size={18} />
            ひきだす
          </button>
        </div>

        {/* Main Card */}
        <div className="mt-6 transaction-card rounded-3xl p-6 animate-slideUp">
          <p className="text-[14px] font-medium text-gray-600 mb-4">
            {mode === "deposit" ? "いくらあずけたい？" : "いくらひきだしたい？"}
          </p>
          
          {/* Amount Display */}
          <div className="relative rounded-2xl border-2 border-gray-200 bg-gradient-to-br from-gray-50 to-white px-5 py-5 text-center overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-[#F2A900]/5 -mr-16 -mt-16"></div>
            <div className="relative">
              <p className="text-[36px] font-bold text-gray-900 tracking-tight">
                {formattedAmount}
              </p>
            </div>
          </div>
          
          {/* Balance Info */}
          <div className="mt-3 flex items-center justify-center gap-2 text-[13px]">
            <span className="text-gray-500">残高:</span>
            <span className="font-semibold text-gray-900">{unitLabel}{balance}</span>
            {useBb && (
              <span className="text-gray-500">（{formatBbValue(balance)}BB）</span>
            )}
          </div>

          {/* Keypad */}
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
                      className="keypad-button h-14 rounded-2xl border border-gray-200 text-[20px] font-semibold text-gray-900 flex items-center justify-center"
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
              className="h-11 w-full rounded-2xl bg-gray-100 border border-gray-200 text-[14px] font-medium text-gray-600 hover:bg-gray-200 transition-colors"
            >
              クリア
            </button>
          </div>

  

          {/* Error & Success Messages */}
          {error && (
            <div className="mt-4 flex items-center gap-2 rounded-2xl bg-red-50 border border-red-200 px-4 py-3">
              <FiAlertCircle className="text-red-600 shrink-0" size={18} />
              <p className="text-[13px] text-red-700 font-medium">{error}</p>
            </div>
          )}
          {message && (
            <div className="mt-4 flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#F2A900]/10 to-[#D4910A]/10 border border-[#F2A900]/30 px-4 py-3 animate-slideUp">
              <FiCheckCircle className="text-[#D4910A] shrink-0" size={18} />
              <p className="text-[13px] text-[#D4910A] font-medium">{message}</p>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="button"
            onClick={submit}
            className={`mt-5 h-14 w-full rounded-2xl text-[16px] font-semibold shadow-lg hover:shadow-xl transition-all active:scale-98 ${
              mode === "deposit"
                ? "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white"
                : "bg-gradient-to-r from-rose-500 to-rose-600 text-white"
            }`}
          >
            {mode === "deposit" ? "あずける！(申請)" : "ひきだす！(申請)"}
          </button>
        </div>
      </div>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-[80] glass-card border-t border-gray-200/60 shadow-lg">
        <div className="relative mx-auto flex max-w-sm items-center justify-between px-8 py-3">
          <button
            type="button"
            onClick={() => router.push("/home")}
            className="flex flex-col items-center text-gray-400 hover:text-[#F2A900] transition-all"
          >
            <FiHome size={22} />
            <span className="mt-1 text-[11px]">ホーム</span>
          </button>
          <button
            type="button"
            onClick={() => router.push("/home/transactions")}
            className="absolute left-1/2 top-0 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-[#F2A900] to-[#D4910A] text-white shadow-xl hover:shadow-2xl transition-all active:scale-95"
            aria-label="あずける"
          >
            <FiCreditCard size={28} />
          </button>
          <button
            type="button"
            onClick={() => router.push("/home/mypage")}
            className="flex flex-col items-center text-gray-400 hover:text-[#F2A900] transition-all"
          >
            <FiUser size={22} />
            <span className="mt-1 text-[11px]">マイページ</span>
          </button>
        </div>
      </nav>

      {/* Withdraw Confirmation Modal */}
      {isWithdrawModalOpen && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center modal-overlay px-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl animate-slideUp">
            <div className="flex items-center justify-center mb-4">
              <div className="h-14 w-14 rounded-full bg-gradient-to-br from-[#F2A900] to-[#D4910A] flex items-center justify-center">
                <FiArrowUpCircle className="text-white" size={28} />
              </div>
            </div>
            <h2 className="text-center text-[20px] font-semibold text-gray-900">確認画面</h2>

            <div className="mt-6 rounded-2xl border-2 border-[#F2A900]/30 bg-gradient-to-br from-[#FFF6E5] to-[#FFFBF5] p-6 text-center relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-[#F2A900]/10 -mr-16 -mt-16"></div>
              <p className="text-[12px] font-medium text-gray-600 mb-3 relative z-10">ディーラーに見せてください</p>
              <div className="text-[48px] font-bold text-[#D4910A] relative z-10">
                {unitLabel}{Number(amount || 0).toLocaleString()}
              </div>
            </div>

            {error && (
              <div className="mt-4 flex items-center gap-2 rounded-2xl bg-red-50 border border-red-200 px-4 py-3">
                <FiAlertCircle className="text-red-600 shrink-0" size={18} />
                <p className="text-[13px] text-red-700 font-medium">{error}</p>
              </div>
            )}

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setIsWithdrawModalOpen(false)}
                className="flex-1 h-12 rounded-2xl border-2 border-gray-200 text-[15px] font-semibold text-gray-700 hover:bg-gray-50 transition-all active:scale-98"
              >
                キャンセル
              </button>
              <button
                onClick={confirmWithdraw}
                className="flex-1 h-12 rounded-2xl bg-gradient-to-br from-[#F2A900] to-[#D4910A] text-[15px] font-semibold text-white shadow-lg hover:shadow-xl transition-all active:scale-98"
              >
                確認完了
              </button>
            </div>
          </div>
        </div>
      )}

    </main>
  )
}