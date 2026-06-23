"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { FiPlus, FiTrash2, FiRefreshCw, FiCheck, FiX, FiSearch } from "react-icons/fi"

type CircleCode = { id: string; active: boolean; usedBy: string | null; createdAt?: number }

type StoreSubscription = {
  status: string | null
  plan: string | null
  cancelAtPeriodEnd: boolean
  currentPeriodEnd: number | null
  provider: string | null
}

type Store = {
  id: string
  name: string
  code: string
  iconUrl: string | null
  isFree: boolean
  subscription: StoreSubscription | null
}

function api(path: string, method: string, body?: object) {
  const pw = sessionStorage.getItem("adminPw") ?? ""
  return fetch(path, {
    method,
    headers: { "Content-Type": "application/json", "x-admin-password": pw },
    body: body ? JSON.stringify(body) : undefined,
  })
}

function SubscriptionBadge({ sub, isFree }: { sub: StoreSubscription | null; isFree: boolean }) {
  if (sub?.provider === "admin_free") {
    const expired = sub.currentPeriodEnd ? sub.currentPeriodEnd * 1000 <= Date.now() : false
    if (expired) {
      return (
        <span className="text-xs font-bold text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">
          手動無料化（終了）
        </span>
      )
    }
    return (
      <span className="text-xs font-bold text-purple-400 bg-purple-400/10 px-2 py-0.5 rounded-full">
        手動無料化
        {sub.currentPeriodEnd && (
          <span className="ml-1 font-normal">
            〜{new Date(sub.currentPeriodEnd * 1000).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" })}
          </span>
        )}
      </span>
    )
  }
  if (isFree) {
    return (
      <span className="text-xs font-bold text-purple-400 bg-purple-400/10 px-2 py-0.5 rounded-full">
        無料
      </span>
    )
  }
  if (!sub) {
    return (
      <span className="text-xs font-bold text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">
        未登録
      </span>
    )
  }
  if (sub.status === "active") {
    return (
      <span className="text-xs font-bold text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">
        {sub.plan === "circle" ? "サークル" : "スタンダード"}
        {sub.cancelAtPeriodEnd ? "（解約予定）" : ""}
      </span>
    )
  }
  return (
    <span className="text-xs font-bold text-red-400 bg-red-400/10 px-2 py-0.5 rounded-full">
      {sub.status ?? "不明"}
    </span>
  )
}

export default function AdminPage() {
  const router = useRouter()
  const [tab, setTab] = useState<"codes" | "free">("codes")

  // circle codes
  const [codes, setCodes] = useState<CircleCode[]>([])
  const [loadingCodes, setLoadingCodes] = useState(false)
  const [generating, setGenerating] = useState(false)

  // stores
  const [stores, setStores] = useState<Store[]>([])
  const [loadingStores, setLoadingStores] = useState(false)
  const [storeSearch, setStoreSearch] = useState("")
  const [savingStoreId, setSavingStoreId] = useState<string | null>(null)
  const [freeModalStore, setFreeModalStore] = useState<Store | null>(null)
  const [freeDuration, setFreeDuration] = useState<"1m" | "1y" | "custom">("1m")
  const [freeCustomMonths, setFreeCustomMonths] = useState("")

  const [authed, setAuthed] = useState(false)
  const [apiError, setApiError] = useState("")

  useEffect(() => {
    const pw = sessionStorage.getItem("adminPw")
    if (!pw) { router.replace("/login"); return }
    setAuthed(true)
  }, [router])

  const fetchCodes = async () => {
    setLoadingCodes(true)
    setApiError("")
    try {
      const res = await api("/api/admin/circle-codes", "GET")
      if (res.status === 401) { router.replace("/login"); return }
      if (!res.ok) { setApiError("APIエラーが発生しました (コード取得失敗)"); return }
      const data = await res.json()
      setCodes(data.codes ?? [])
    } finally {
      setLoadingCodes(false)
    }
  }

  const fetchStores = async () => {
    setLoadingStores(true)
    setApiError("")
    try {
      const res = await api("/api/admin/stores", "GET")
      if (res.status === 401) { router.replace("/login"); return }
      if (!res.ok) { setApiError("APIエラーが発生しました (ストア取得失敗)"); return }
      const data = await res.json()
      setStores(data.stores ?? [])
    } finally {
      setLoadingStores(false)
    }
  }

  useEffect(() => {
    if (authed) {
      fetchCodes()
      fetchStores()
    }
  }, [authed])

  const generateCode = async () => {
    setGenerating(true)
    try {
      const res = await api("/api/admin/circle-codes", "POST")
      const data = await res.json()
      if (data.code) setCodes(prev => [{ id: data.code, active: true, usedBy: null, createdAt: Date.now() }, ...prev])
    } finally {
      setGenerating(false)
    }
  }

  const deactivateCode = async (code: string) => {
    await api("/api/admin/circle-codes", "DELETE", { code })
    setCodes(prev => prev.map(c => c.id === code ? { ...c, active: false } : c))
  }

  const revokeFree = async (storeId: string) => {
    setSavingStoreId(storeId)
    try {
      const res = await api("/api/admin/free-store", "POST", { storeId, isFree: false })
      if (res.ok) {
        await fetchStores()
      } else {
        setApiError("エラーが発生しました")
      }
    } finally {
      setSavingStoreId(null)
    }
  }

  const confirmGrantFree = async () => {
    if (!freeModalStore) return
    const months = freeDuration === "1m" ? 1 : freeDuration === "1y" ? 12 : parseInt(freeCustomMonths, 10)
    if (!Number.isFinite(months) || months <= 0) {
      setApiError("無料期間（ヶ月数）を正しく入力してください")
      return
    }
    setSavingStoreId(freeModalStore.id)
    try {
      const res = await api("/api/admin/free-store", "POST", { storeId: freeModalStore.id, isFree: true, months })
      if (res.ok) {
        setFreeModalStore(null)
        setFreeDuration("1m")
        setFreeCustomMonths("")
        await fetchStores()
      } else {
        setApiError("エラーが発生しました")
      }
    } finally {
      setSavingStoreId(null)
    }
  }

  const filteredStores = stores.filter(s => {
    const q = storeSearch.toLowerCase()
    return !q || s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q) || s.id.toLowerCase().includes(q)
  })

  if (!authed) return null

  return (
    <div className="min-h-screen bg-gray-950 text-white px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-xl font-bold">Admin Panel</h1>
          <button
            onClick={() => { sessionStorage.removeItem("adminPw"); router.replace("/login") }}
            className="text-sm text-gray-400 hover:text-white"
          >
            ログアウト
          </button>
        </div>

        {apiError && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
            {apiError}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {(["codes", "free"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t ? "bg-[#F2A900] text-black" : "bg-gray-800 text-gray-300"}`}
            >
              {t === "codes" ? "サークルコード" : "ストア管理"}
            </button>
          ))}
        </div>

        {tab === "codes" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-400">{codes.length} 件</p>
              <div className="flex gap-2">
                <button onClick={fetchCodes} disabled={loadingCodes} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-800 text-sm text-gray-300 hover:bg-gray-700 disabled:opacity-50">
                  <FiRefreshCw size={13} className={loadingCodes ? "animate-spin" : ""} /> 更新
                </button>
                <button onClick={generateCode} disabled={generating} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#F2A900] text-black text-sm font-bold hover:bg-amber-400 disabled:opacity-50">
                  <FiPlus size={14} /> コードを発行
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {codes.length === 0 && !loadingCodes && (
                <p className="text-center text-gray-500 py-8 text-sm">コードがありません</p>
              )}
              {codes.map(c => (
                <div key={c.id} className="flex items-center justify-between bg-gray-900 rounded-xl px-4 py-3">
                  <div>
                    <p className="font-mono text-sm font-medium">{c.id}</p>
                    {c.usedBy && <p className="text-xs text-gray-500 mt-0.5">使用済: {c.usedBy}</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    {c.active && !c.usedBy ? (
                      <span className="text-xs font-bold text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <FiCheck size={11} /> 有効
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <FiX size={11} /> {c.usedBy ? "使用済" : "無効"}
                      </span>
                    )}
                    {c.active && !c.usedBy && (
                      <button onClick={() => deactivateCode(c.id)} className="text-gray-500 hover:text-red-400 transition-colors">
                        <FiTrash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "free" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-400">{stores.length} ストア</p>
              <button onClick={fetchStores} disabled={loadingStores} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-800 text-sm text-gray-300 hover:bg-gray-700 disabled:opacity-50">
                <FiRefreshCw size={13} className={loadingStores ? "animate-spin" : ""} /> 更新
              </button>
            </div>

            <div className="relative mb-4">
              <FiSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                value={storeSearch}
                onChange={e => setStoreSearch(e.target.value)}
                placeholder="ストア名・コード・IDで検索"
                className="w-full bg-gray-800 rounded-xl pl-9 pr-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-[#F2A900]/40"
              />
            </div>

            <div className="space-y-2">
              {loadingStores && (
                <p className="text-center text-gray-500 py-8 text-sm">読み込み中...</p>
              )}
              {!loadingStores && filteredStores.length === 0 && (
                <p className="text-center text-gray-500 py-8 text-sm">ストアが見つかりません</p>
              )}
              {filteredStores.map(s => (
                <div key={s.id} className="flex items-center justify-between bg-gray-900 rounded-xl px-4 py-3 gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{s.name || "(名称未設定)"}</p>
                    <p className="text-xs text-gray-500 font-mono truncate">{s.id}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <SubscriptionBadge sub={s.subscription} isFree={s.isFree} />
                    <button
                      onClick={() => s.isFree ? revokeFree(s.id) : setFreeModalStore(s)}
                      disabled={savingStoreId === s.id}
                      className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all disabled:opacity-50 ${
                        s.isFree
                          ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
                          : "bg-purple-600 text-white hover:bg-purple-500"
                      }`}
                    >
                      {savingStoreId === s.id ? "..." : s.isFree ? "無料解除" : "無料にする"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Grant Free Period Modal */}
        {freeModalStore && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
            <div className="w-full max-w-sm rounded-2xl bg-gray-900 p-6 shadow-2xl">
              <h2 className="text-base font-bold mb-1">無料期間を設定</h2>
              <p className="text-xs text-gray-400 mb-4 truncate">{freeModalStore.name || freeModalStore.id}</p>

              <div className="space-y-2 mb-4">
                {([
                  { id: "1m" as const, label: "今日から1ヶ月無料" },
                  { id: "1y" as const, label: "今日から1年無料" },
                  { id: "custom" as const, label: "ヶ月数を指定" },
                ]).map(opt => (
                  <label key={opt.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="freeDuration"
                      checked={freeDuration === opt.id}
                      onChange={() => setFreeDuration(opt.id)}
                      className="accent-[#F2A900]"
                    />
                    {opt.label}
                  </label>
                ))}
                {freeDuration === "custom" && (
                  <input
                    type="number"
                    min={1}
                    value={freeCustomMonths}
                    onChange={e => setFreeCustomMonths(e.target.value)}
                    placeholder="例: 3"
                    className="w-full bg-gray-800 rounded-xl px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-[#F2A900]/40 ml-6"
                    style={{ width: "calc(100% - 1.5rem)" }}
                  />
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setFreeModalStore(null)}
                  className="flex-1 h-10 rounded-xl bg-gray-800 text-sm font-medium text-gray-300 hover:bg-gray-700"
                >
                  キャンセル
                </button>
                <button
                  onClick={confirmGrantFree}
                  disabled={savingStoreId === freeModalStore.id}
                  className="flex-1 h-10 rounded-xl bg-purple-600 text-sm font-bold text-white hover:bg-purple-500 disabled:opacity-50"
                >
                  {savingStoreId === freeModalStore.id ? "..." : "適用する"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
