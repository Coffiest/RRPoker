"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { auth, db } from "@/lib/firebase"
import { doc, getDoc, onSnapshot } from "firebase/firestore"
import { FiCheck } from "react-icons/fi"

type Subscription = {
  status: string
  plan: string
  interval: string
  currentPeriodEnd: number
  cancelAtPeriodEnd: boolean
}

function normalizeSubscription(d: Record<string, any>): Subscription | null {
  if (d.subscription?.status) return d.subscription as Subscription
  if (d["subscription.status"]) {
    return {
      status: d["subscription.status"],
      plan: d["subscription.plan"] ?? "",
      interval: d["subscription.interval"] ?? "",
      currentPeriodEnd: d["subscription.currentPeriodEnd"] ?? 0,
      cancelAtPeriodEnd: d["subscription.cancelAtPeriodEnd"] ?? false,
    }
  }
  return null
}

function BillingContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const success = searchParams.get("success") === "true"

  const [plan, setPlan] = useState<"standard" | "circle">("standard")
  const [billingInterval, setBillingInterval] = useState<"monthly" | "yearly">("monthly")
  const [circleCode, setCircleCode] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [storeId, setStoreId] = useState<string | null>(null)
  const [authReady, setAuthReady] = useState(false)

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async user => {
      if (!user) { router.replace("/"); return }
      const snap = await getDoc(doc(db, "users", user.uid))
      const data = snap.data() ?? {}
      if (data.role !== "store") { router.replace("/home"); return }
      setStoreId(data.storeId ?? null)
      setAuthReady(true)
    })
    return () => unsub()
  }, [router])

  useEffect(() => {
    if (!storeId) return
    const unsub = onSnapshot(doc(db, "stores", storeId), snap => {
      setSubscription(normalizeSubscription(snap.data() ?? {}))
    })
    return () => unsub()
  }, [storeId])

  // アクティブになったら自動リダイレクト
  // success=true の場合は2秒待ってから（成功画面を見せる）
  // success=false の場合は即座に（既存サブスクがある人がbillingを開いた場合）
  useEffect(() => {
    if (!authReady) return
    if (subscription?.status !== "active") return
    const delay = success ? 2000 : 0
    const t = setTimeout(() => router.replace("/home/store"), delay)
    return () => clearTimeout(t)
  }, [authReady, subscription, success, router])

  const handleSubscribe = async () => {
    setLoading(true)
    setError("")
    try {
      const user = auth.currentUser
      if (!user) return
      const token = await user.getIdToken()
      const res = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan, interval: billingInterval, circleCode: circleCode.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? "エラーが発生しました"); return }
      window.location.href = data.url
    } catch {
      setError("エラーが発生しました")
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    const isActive = subscription?.status === "active"
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex flex-col items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 max-w-sm w-full text-center">
          {isActive ? (
            <>
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-5">
                <FiCheck className="text-green-600" size={32} />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">ご登録ありがとうございます！</h2>
              <p className="text-sm text-gray-500">RRPokerへ移動します...</p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 flex items-center justify-center mx-auto mb-5">
                <div className="w-10 h-10 rounded-full border-4 border-[#F2A900] border-t-transparent animate-spin" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">処理中...</h2>
              <p className="text-sm text-gray-500">少々お待ちください</p>
            </>
          )}
        </div>
      </div>
    )
  }

  const stdMonthly = 19800
  const stdYearly = 198000
  const circMonthly = 2980
  const circYearly = 29800

  const plans = [
    {
      id: "standard" as const,
      name: "スタンダード",
      monthly: stdMonthly,
      yearly: stdYearly,
      perMonth: Math.round(stdYearly / 12),
      features: ["タイマー何台でも同時稼働", "チップ登録プレイヤー人数無制限"],
    },
    {
      id: "circle" as const,
      name: "サークル応援プラン",
      monthly: circMonthly,
      yearly: circYearly,
      perMonth: Math.round(circYearly / 12),
      features: ["スタンダードと同等の全機能", "学生・サークル団体向け特別価格", "シリアルコード認証が必要"],
      badge: "学生・サークル向け",
    },
  ]

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col items-center px-4 py-12">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">プランを選択</h1>
          <p className="text-sm text-gray-500">店舗アカウントの利用にはサブスクリプションが必要です</p>
        </div>

        <div className="flex items-center justify-center gap-3 mb-8">
          <button
            onClick={() => setBillingInterval("monthly")}
            className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${billingInterval === "monthly" ? "bg-[#F2A900] text-white" : "bg-white text-gray-600 border border-gray-200"}`}
          >
            月払い
          </button>
          <button
            onClick={() => setBillingInterval("yearly")}
            className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${billingInterval === "yearly" ? "bg-[#F2A900] text-white" : "bg-white text-gray-600 border border-gray-200"}`}
          >
            年払い
            <span className="ml-2 text-[10px] font-bold bg-green-500 text-white rounded-full px-1.5 py-0.5">17%OFF</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {plans.map(p => (
            <button
              key={p.id}
              onClick={() => setPlan(p.id)}
              className={`text-left rounded-2xl border-2 p-6 transition-all ${plan === p.id ? "border-[#F2A900] bg-amber-50" : "border-gray-200 bg-white"}`}
            >
              {p.badge && (
                <span className="inline-block text-[11px] font-bold bg-blue-100 text-blue-700 rounded-full px-2 py-0.5 mb-3">
                  {p.badge}
                </span>
              )}
              <div className="flex items-start justify-between mb-1">
                <h3 className="font-bold text-gray-900 text-[15px]">{p.name}</h3>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${plan === p.id ? "border-[#F2A900] bg-[#F2A900]" : "border-gray-300"}`}>
                  {plan === p.id && <FiCheck size={11} color="#fff" strokeWidth={3} />}
                </div>
              </div>
              <div className="mb-4">
                {billingInterval === "monthly" ? (
                  <span className="text-2xl font-bold text-gray-900">¥{p.monthly.toLocaleString()}<span className="text-sm font-normal text-gray-500">/月</span></span>
                ) : (
                  <div>
                    <span className="text-2xl font-bold text-gray-900">¥{p.yearly.toLocaleString()}<span className="text-sm font-normal text-gray-500">/年</span></span>
                    <div className="text-xs text-gray-500 mt-0.5">（¥{p.perMonth.toLocaleString()}/月換算）</div>
                  </div>
                )}
              </div>
              <ul className="space-y-1.5">
                {p.features.map(f => (
                  <li key={f} className="flex items-start gap-2 text-[13px] text-gray-600">
                    <FiCheck className="text-green-500 flex-shrink-0 mt-0.5" size={14} />
                    {f}
                  </li>
                ))}
              </ul>
            </button>
          ))}
        </div>

        {plan === "circle" && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">シリアルコード</label>
            <input
              type="text"
              value={circleCode}
              onChange={e => setCircleCode(e.target.value)}
              placeholder="発行されたシリアルコードを入力"
              className="w-full rounded-xl px-4 py-3 text-sm text-gray-900 border border-gray-200 outline-none focus:border-[#F2A900] focus:ring-2 focus:ring-[#F2A900]/15 transition-all"
            />
            <p className="text-xs text-gray-400 mt-2">管理者から発行されたコードを入力してください</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4 text-sm text-red-600">
            {error}
          </div>
        )}

        <button
          onClick={handleSubscribe}
          disabled={loading}
          className="w-full bg-[#F2A900] text-white font-bold rounded-2xl py-4 text-[16px] disabled:opacity-60 transition-opacity"
        >
          {loading ? "処理中..." : "サブスクリプションを開始する"}
        </button>

        <p className="text-xs text-gray-400 text-center mt-4">
          Stripeの安全な決済ページに移動します。いつでもキャンセル可能です。
        </p>
      </div>
    </div>
  )
}

export default function BillingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FAFAFA]" />}>
      <BillingContent />
    </Suspense>
  )
}
