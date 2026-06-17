"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { FiPlus, FiTrash2, FiRefreshCw, FiCheck, FiX } from "react-icons/fi"
import { initializeApp } from "firebase/app"
import { getFirestore, collection, query, getDocs, orderBy } from "firebase/firestore"

type CircleCode = { id: string; active: boolean; usedBy: string | null; createdAt?: number }
type StoreData = { id: string; name: string; isFree?: boolean; createdAt?: any }

// Initialize Firebase
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}
const app = initializeApp(firebaseConfig)
const db = getFirestore(app)

function api(path: string, method: string, body?: object) {
  const pw = sessionStorage.getItem("adminPw") ?? ""
  return fetch(path, {
    method,
    headers: { "Content-Type": "application/json", "x-admin-password": pw },
    body: body ? JSON.stringify(body) : undefined,
  })
}

export default function AdminPage() {
  const router = useRouter()
  const [tab, setTab] = useState<"codes" | "free">("codes")
  const [codes, setCodes] = useState<CircleCode[]>([])
  const [stores, setStores] = useState<StoreData[]>([])
  const [loadingCodes, setLoadingCodes] = useState(false)
  const [loadingStores, setLoadingStores] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [freeStoreId, setFreeStoreId] = useState("")
  const [freeMsg, setFreeMsg] = useState("")
  const [freeSaving, setFreeSaving] = useState(false)
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
    try {
      const storesCollection = collection(db, "stores")
      const q = query(storesCollection, orderBy("createdAt", "desc"))
      const snap = await getDocs(q)
      const storesList: StoreData[] = snap.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name || "（名前なし）",
        isFree: doc.data().isFree ?? false,
        createdAt: doc.data().createdAt,
      }))
      setStores(storesList)
    } catch (e) {
      console.error("Failed to fetch stores:", e)
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

  const setFree = async (isFree: boolean, storeId?: string) => {
    const sid = (storeId || freeStoreId).trim()
    if (!sid) return
    setFreeSaving(true)
    if (!storeId) setFreeMsg("")
    try {
      const res = await api("/api/admin/free-store", "POST", { storeId: sid, isFree })
      const msg = isFree ? `${sid} を無料に設定しました` : `${sid} の無料設定を解除しました`
      if (res.ok) {
        if (storeId) {
          setStores(prev => prev.map(s => s.id === storeId ? { ...s, isFree } : s))
        } else {
          setFreeMsg(msg)
        }
      } else {
        if (!storeId) setFreeMsg("エラーが発生しました")
      }
    } finally {
      setFreeSaving(false)
    }
  }

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
              {t === "codes" ? "サークルコード" : "無料アカウント"}
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
          <div className="space-y-6">
            {/* Store List */}
            <div className="bg-gray-900 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-sm font-bold text-white">全店舗（作成順）</h3>
                <button
                  onClick={fetchStores}
                  disabled={loadingStores}
                  className="text-xs text-gray-400 hover:text-white disabled:opacity-50"
                >
                  <FiRefreshCw size={13} className={loadingStores ? "animate-spin" : ""} />
                </button>
              </div>
              {stores.length === 0 && !loadingStores && (
                <p className="text-center text-gray-500 py-8 text-sm">店舗がありません</p>
              )}
              <div className="space-y-2">
                {stores.map(store => (
                  <div key={store.id} className="flex items-center justify-between bg-gray-800 rounded-xl px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-white truncate">{store.name}</p>
                      <p className="text-xs text-gray-500 mt-1 font-mono truncate">{store.id}</p>
                    </div>
                    <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                      <span className={`text-xs font-bold px-2 py-1 rounded-full ${store.isFree ? "bg-green-400/20 text-green-400" : "bg-gray-700 text-gray-400"}`}>
                        {store.isFree ? "無料" : "有料"}
                      </span>
                      {store.isFree ? (
                        <button
                          onClick={() => setFree(false, store.id)}
                          disabled={freeSaving}
                          className="px-3 py-1.5 rounded-lg bg-gray-700 text-white text-xs font-bold hover:bg-gray-600 disabled:opacity-50"
                        >
                          有料化
                        </button>
                      ) : (
                        <button
                          onClick={() => setFree(true, store.id)}
                          disabled={freeSaving}
                          className="px-3 py-1.5 rounded-lg bg-[#F2A900] text-black text-xs font-bold hover:bg-amber-400 disabled:opacity-50"
                        >
                          無料化
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Manual Search */}
            <div className="bg-gray-900 rounded-2xl p-6">
              <h3 className="text-sm font-bold text-white mb-5">Store IDで検索</h3>
              <p className="text-sm text-gray-400 mb-5">store IDを入力して無料設定のON/OFFを切り替えます。</p>
              <input
                type="text"
                value={freeStoreId}
                onChange={e => setFreeStoreId(e.target.value)}
                placeholder="Store ID"
                className="w-full bg-gray-800 rounded-xl px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-[#F2A900]/40 mb-4"
              />
              {freeMsg && (
                <p className="text-sm text-green-400 mb-4">{freeMsg}</p>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => setFree(true)}
                  disabled={freeSaving || !freeStoreId.trim()}
                  className="flex-1 py-3 rounded-xl bg-[#F2A900] text-black font-bold text-sm disabled:opacity-50"
                >
                  無料に設定
                </button>
                <button
                  onClick={() => setFree(false)}
                  disabled={freeSaving || !freeStoreId.trim()}
                  className="flex-1 py-3 rounded-xl bg-gray-700 text-white font-bold text-sm disabled:opacity-50"
                >
                  無料設定を解除
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
