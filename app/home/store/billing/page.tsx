"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { auth, db } from "@/lib/firebase"
import { doc, getDoc, onSnapshot } from "firebase/firestore"
import { FiCheck, FiChevronLeft } from "react-icons/fi"
import { isNativeApp, isNativeIOS } from "@/lib/platform"
import { purchaseStorePlan } from "@/lib/iap"
import { isSubscriptionActive } from "@/lib/subscription-client"

type Subscription = {
  status: string
  plan: string
  interval: string
  currentPeriodEnd: number
  cancelAtPeriodEnd: boolean
  provider?: string
}

function normalizeSubscription(d: Record<string, any>): Subscription | null {
  const nested = d.subscription ?? {}
  const status = nested.status ?? d["subscription.status"]
  if (!status) return null
  return {
    status,
    plan: nested.plan ?? d["subscription.plan"] ?? "",
    interval: nested.interval ?? d["subscription.interval"] ?? "",
    currentPeriodEnd: nested.currentPeriodEnd ?? d["subscription.currentPeriodEnd"] ?? 0,
    cancelAtPeriodEnd: nested.cancelAtPeriodEnd ?? d["subscription.cancelAtPeriodEnd"] ?? false,
    provider: nested.provider,
  }
}

function BillingContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const success = searchParams.get("success") === "true"
  const sessionId = searchParams.get("session_id")

  const [plan, setPlan] = useState<"standard" | "circle">("standard")
  const [billingInterval, setBillingInterval] = useState<"monthly" | "yearly">("monthly")
  const [circleCode, setCircleCode] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [storeId, setStoreId] = useState<string | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [syncError, setSyncError] = useState("")
  const [recovering, setRecovering] = useState(false)
  const [recoverMsg, setRecoverMsg] = useState("")

  // Confirm payment directly with Stripe (independent of the webhook). Pass the
  // checkout session id after returning from Checkout, or omit it to recover an
  // already-paid subscription that the webhook failed to record.
  const syncSubscription = async (withSessionId?: string | null): Promise<boolean> => {
    const user = auth.currentUser
    if (!user) return false
    const token = await user.getIdToken()
    const res = await fetch("/api/stripe/sync-subscription", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ sessionId: withSessionId ?? undefined }),
    })
    const data = await res.json().catch(() => ({}))
    return res.ok && data.ok === true
  }

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

  const [isFree, setIsFree] = useState(false)

  useEffect(() => {
    if (!storeId) return
    const unsub = onSnapshot(doc(db, "stores", storeId), snap => {
      const d = snap.data() ?? {}
      setSubscription(normalizeSubscription(d))
      setIsFree(d.isFree === true)
    }, () => {})
    return () => unsub()
  }, [storeId])

  // 決済から戻ってきたら、Webhookに依存せずStripeへ直接確認してFirestoreをActive化
  // （ネイティブアプリのIAP購入はStripeセッションを持たないため対象外。RevenueCatのWebhookが
  // Firestoreを更新するのを待ち、下のonSnapshotがActive化を検知して自動遷移する）
  useEffect(() => {
    if (!success || !authReady || !storeId || isNativeApp()) return
    let cancelled = false
    setSyncError("")
    ;(async () => {
      // 数回リトライ（Stripe側の反映タイミング吸収）
      for (let i = 0; i < 4 && !cancelled; i++) {
        const ok = await syncSubscription(sessionId).catch(() => false)
        if (ok || cancelled) return
        await new Promise(r => setTimeout(r, 1500))
      }
      if (!cancelled) setSyncError("お支払いの確認に時間がかかっています。下のボタンで再確認できます。")
    })()
    return () => { cancelled = true }
  }, [success, authReady, storeId, sessionId])

  // アクティブ or 無料フラグがあれば /home/store へ
  // success=true の場合は2秒待ってから（成功画面を見せる）
  useEffect(() => {
    if (!authReady) return
    const canAccess = isSubscriptionActive(subscription) || isFree
    if (!canAccess) return
    const delay = success ? 2000 : 0
    const t = setTimeout(() => router.replace("/home/store"), delay)
    return () => clearTimeout(t)
  }, [authReady, subscription, isFree, success, router])

  const handleRecover = async () => {
    setRecovering(true)
    setRecoverMsg("")
    setSyncError("")
    try {
      const ok = await syncSubscription(sessionId)
      if (!ok) setRecoverMsg("有効なお支払いが見つかりませんでした。お支払い済みの場合は数分後に再度お試しください。")
      // 成功時は onSnapshot がActive化を検知して自動遷移
    } catch {
      setRecoverMsg("確認中にエラーが発生しました")
    } finally {
      setRecovering(false)
    }
  }

  const handleSubscribeNative = async () => {
    const user = auth.currentUser
    if (!user) return
    const token = await user.getIdToken()
    const trimmedCode = circleCode.trim()

    if (plan === "circle") {
      const res = await fetch("/api/iap/verify-circle-code", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ circleCode: trimmedCode }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error ?? "シリアルコードが無効です"); return }
    }

    await purchaseStorePlan(plan, billingInterval, plan === "circle" ? trimmedCode : undefined)
    // RevenueCatのWebhookがFirestoreを更新するのをonSnapshotが検知し自動遷移する
    router.replace("/home/store/billing?success=true")
  }

  const handleSubscribe = async () => {
    setLoading(true)
    setError("")
    try {
      if (isNativeApp()) {
        await handleSubscribeNative()
        return
      }
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
    } catch (e: any) {
      setError(e?.message ?? "エラーが発生しました")
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    const isActive = isSubscriptionActive(subscription) || isFree
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
              <p className="text-sm text-gray-500">お支払いを確認しています</p>
              {syncError && (
                <>
                  <p className="text-sm text-red-600 mt-5 mb-3">{syncError}</p>
                  <button
                    onClick={handleRecover}
                    disabled={recovering}
                    className="w-full bg-[#F2A900] text-white font-bold rounded-2xl py-3 text-[15px] disabled:opacity-60"
                  >
                    {recovering ? "確認中..." : "お支払いを再確認する"}
                  </button>
                  {recoverMsg && <p className="text-xs text-gray-500 mt-3">{recoverMsg}</p>}
                </>
              )}
            </>
          )}
        </div>
      </div>
    )
  }

  const iosNative = isNativeIOS()

  // iOS App Store prices (Apple 30%手数料込み)
  // Standard年額はApp Storeで販売しない（Appleの上限¥160,000を超えるため）→ Web/Stripe限定
  const stdMonthly  = iosNative ? 29000  : 19800
  const stdYearly   = 198000  // App Store非対応・Stripe/Web限定（iOS/Web共通で元価格を表示）
  const circMonthly = iosNative ? 4300   : 2980
  const circYearly  = iosNative ? 43000  : 29800

  // iOSでStandard年額を選択した場合はWebへ誘導
  const iosWebOnlyPlan = iosNative && plan === "standard" && billingInterval === "yearly"

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
        <button
          type="button"
          onClick={() => router.push("/home/store/mypage")}
          className="flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900 mb-4 -ml-1 transition-colors"
        >
          <FiChevronLeft size={18} />
          戻る
        </button>
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">プランを選択</h1>
          <p className="text-sm text-gray-500">店舗アカウントの利用にはサブスクリプションが必要です</p>
        </div>

        {iosNative && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3 mb-6 text-[13px] text-blue-800 leading-relaxed">
            <span className="font-semibold">Webブラウザからの購入がお得です。</span>{" "}
            <a href="https://rrpoker.vercel.app/home/store/billing" className="underline font-medium">こちら</a>からStripe決済で購入すると、Standard月額¥19,800・年額¥198,000でご利用いただけます。
          </div>
        )}
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
                    {iosNative && p.id === "standard" && (
                      <span className="inline-block mt-1 text-[10px] font-bold bg-gray-100 text-gray-500 rounded-full px-2 py-0.5">Web限定</span>
                    )}
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

        {iosWebOnlyPlan ? (
          <div className="space-y-3">
            <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 text-[13px] text-amber-800 leading-relaxed">
              Standard年額プランはApp Storeではご購入いただけません。Webブラウザから¥198,000でご購入ください。
            </div>
            <a
              href="https://rrpoker.vercel.app/home/store/billing"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center w-full bg-[#F2A900] text-white font-bold rounded-2xl py-4 text-[16px]"
            >
              Webブラウザで購入する（¥198,000/年）
            </a>
          </div>
        ) : (
          <button
            onClick={handleSubscribe}
            disabled={loading}
            className="w-full bg-[#F2A900] text-white font-bold rounded-2xl py-4 text-[16px] disabled:opacity-60 transition-opacity"
          >
            {loading ? "処理中..." : "サブスクリプションを開始する"}
          </button>
        )}

        <p className="text-xs text-gray-400 text-center mt-4">
          {isNativeIOS()
            ? "App Storeを通じて購入します。管理・キャンセルはいつでもiOSの設定から行えます。"
            : isNativeApp()
            ? "Google Playを通じて購入します。管理・キャンセルはいつでもPlayストアの設定から行えます。"
            : "Stripeの安全な決済ページに移動します。いつでもキャンセル可能です。"}
        </p>
        <p className="text-xs text-gray-400 text-center mt-2">
          ご購入により<a href="/terms" target="_blank" rel="noopener noreferrer" className="underline">利用規約</a>と
          <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline">プライバシーポリシー</a>に同意したものとみなされます。
        </p>

        {/* すでに決済済みなのに反映されない場合の救済 */}
        <div className="mt-6 pt-5 border-t border-gray-200 text-center">
          <p className="text-xs text-gray-500 mb-3">お支払い済みなのに反映されない場合</p>
          <button
            onClick={handleRecover}
            disabled={recovering}
            className="w-full bg-white border-2 border-gray-200 text-gray-900 font-semibold rounded-2xl py-3 text-[14px] hover:bg-gray-50 disabled:opacity-60 transition-all"
          >
            {recovering ? "確認中..." : "お支払いを確認して反映する"}
          </button>
          {recoverMsg && <p className="text-xs text-gray-500 mt-3">{recoverMsg}</p>}
        </div>
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
