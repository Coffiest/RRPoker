"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { auth, db } from "@/lib/firebase"
import HomeHeader from "@/components/HomeHeader"
import { getCommonMenuItems } from "@/components/commonMenuItems"
import {
  addDoc,
  collection,
  deleteField,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore"
import { FiArrowLeft, FiTrash2, FiHome, FiCreditCard, FiUser } from "react-icons/fi"

type StoreInfo = {
  name: string
  chipExpiryMonths?: number
}

type RakeEntry = {
  id: string
  amount: number
  memo?: string
  createdAt?: { seconds?: number }
}

export default function StoreSettingsPage() {
  const router = useRouter()
  const [storeId, setStoreId] = useState<string | null>(null)
  const [store, setStore] = useState<StoreInfo | null>(null)
  const [chipExpiryInput, setChipExpiryInput] = useState("")
  const [chipExpiryError, setChipExpiryError] = useState("")
  const [chipExpirySuccess, setChipExpirySuccess] = useState("")
  const [isChipExpiryModalOpen, setIsChipExpiryModalOpen] = useState(false)
  const [rakeEntries, setRakeEntries] = useState<RakeEntry[]>([])
  const [isRakeModalOpen, setIsRakeModalOpen] = useState(false)
  const [rakeView, setRakeView] = useState<"menu" | "add" | "history">("menu")
  const [rakeAmount, setRakeAmount] = useState("")
  const [rakeMemo, setRakeMemo] = useState("")
  const [rakeError, setRakeError] = useState("")

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async user => {
      if (!user) return
      const userSnap = await getDoc(doc(db, "users", user.uid))
      const data = userSnap.data()
      const nextStoreId = data?.storeId as string | undefined
      setStoreId(nextStoreId ?? null)
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    const fetchStore = async () => {
      if (!storeId) return
      const snap = await getDoc(doc(db, "stores", storeId))
      const data = snap.data()
      setStore({
        name: data?.name ?? "",
        chipExpiryMonths: data?.chipExpiryMonths,
      })
    }
    fetchStore()
  }, [storeId])

  useEffect(() => {
    if (!storeId) return
    const q = query(collection(db, "stores", storeId, "rakeEntries"))
    const unsub = onSnapshot(q, snap => {
      const list: RakeEntry[] = []
      snap.forEach(docSnap => {
        const data = docSnap.data()
        list.push({
          id: docSnap.id,
          amount: typeof data.amount === "number" ? data.amount : 0,
          memo: data.memo,
          createdAt: data.createdAt,
        })
      })
      setRakeEntries(list)
    })
    return () => unsub()
  }, [storeId])

  const rakeTotal = rakeEntries.reduce(
    (sum, entry) => sum + (typeof entry.amount === "number" ? entry.amount : 0),
    0
  )

  const sortedRakeEntries = [...rakeEntries].sort(
    (a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0)
  )

  const formatDateTime = (seconds?: number) => {
    if (!seconds) return ""
    const date = new Date(seconds * 1000)
    const pad = (v: number) => v.toString().padStart(2, "0")
    return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(
      date.getDate()
    )} ${pad(date.getHours())}:${pad(date.getMinutes())}`
  }

  const saveChipExpiry = async () => {
    if (!storeId) return
    setChipExpiryError("")
    setChipExpirySuccess("")

    const raw = chipExpiryInput.trim()
    const previousValue = store?.chipExpiryMonths

    if (!raw) {
      await updateDoc(doc(db, "stores", storeId), {
        chipExpiryMonths: deleteField(),
      })
      setChipExpirySuccess("保存しました")
      setChipExpiryInput("")
      if (previousValue !== undefined) {
        await sendExpiryChangeNotification(storeId, undefined, previousValue)
      }
      setTimeout(() => setChipExpirySuccess(""), 3000)
      return
    }

    const months = Number(raw)
    if (!Number.isInteger(months) || months < 0) {
      setChipExpiryError("0以上の整数で入力してください")
      return
    }

    if (months === 0) {
      await updateDoc(doc(db, "stores", storeId), {
        chipExpiryMonths: deleteField(),
      })
      setChipExpirySuccess("保存しました")
      setChipExpiryInput("")
      if (previousValue !== undefined && previousValue !== 0) {
        await sendExpiryChangeNotification(storeId, undefined, previousValue)
      }
      setTimeout(() => setChipExpirySuccess(""), 3000)
      return
    }

    await updateDoc(doc(db, "stores", storeId), {
      chipExpiryMonths: months,
    })
    setChipExpirySuccess("保存しました")
    if (previousValue !== months) {
      await sendExpiryChangeNotification(storeId, months, previousValue)
    }
    setTimeout(() => setChipExpirySuccess(""), 3000)
  }

  const sendExpiryChangeNotification = async (
    storeId: string,
    newValue?: number,
    oldValue?: number
  ) => {
    try {
      const storeSnap = await getDoc(doc(db, "stores", storeId))
      const storeName = storeSnap.data()?.name ?? "店舗"

      const message = newValue
        ? `チップの有効期限が${newValue}ヶ月に変更されました`
        : `チップの有効期限が削除されました（期限なし）`

      const playerMessage = newValue
        ? `${storeName}のチップ有効期限が${newValue}ヶ月に変更されました`
        : `${storeName}のチップ有効期限が削除されました（期限なし）`

      const timestamp = serverTimestamp()

      await addDoc(collection(db, "stores", storeId, "notices"), {
        message,
        createdAt: timestamp,
        expiredAt: timestamp,
      })

      const usersSnap = await getDocs(collection(db, "users"))
      const promises: Promise<any>[] = []

      for (const userDoc of usersSnap.docs) {
        const userId = userDoc.id
        const balanceSnap = await getDoc(
          doc(db, "users", userId, "storeBalances", storeId)
        )

        if (balanceSnap.exists()) {
          const balance = balanceSnap.data()?.balance ?? 0
          if (balance >= 1) {
            promises.push(
              addDoc(collection(db, "notifications"), {
                userId,
                storeId,
                storeName,
                message: playerMessage,
                type: "chip_expiry_change",
                createdAt: timestamp,
                read: false,
              })
            )
          }
        }
      }

      await Promise.all(promises)
    } catch (error) {
      console.error("Failed to send expiry change notification:", error)
    }
  }

  return (
    <main className="min-h-screen bg-white pb-28">
      <HomeHeader
        homePath="/home/store"
        myPagePath="/home/store/mypage"
        variant="store"
        menuItems={getCommonMenuItems(router, "store")}
      />

      <div className="mx-auto max-w-sm px-5">
        <button
          type="button"
          onClick={() => router.push("/home/store")}
          className="mt-6 inline-flex items-center gap-2 text-[14px] font-semibold text-gray-700 hover:text-gray-900"
        >
          <FiArrowLeft className="text-[16px]" />
          戻る
        </button>

        <h1 className="mt-4 text-[20px] font-bold text-gray-900">設定</h1>

        <div className="mt-6 rounded-[24px] border border-gray-200 p-4">
          <p className="text-[14px] font-semibold text-gray-900">
            チップの有効期限設定
          </p>
          <p className="mt-1 text-[12px] text-gray-500">
            {store?.chipExpiryMonths
              ? `現在の設定: ${store.chipExpiryMonths}ヶ月`
              : "現在の設定: 期限なし"}
          </p>
          <button
            type="button"
            onClick={() => {
              setChipExpiryError("")
              setChipExpirySuccess("")
              setChipExpiryInput(
                store?.chipExpiryMonths?.toString() ?? ""
              )
              setIsChipExpiryModalOpen(true)
            }}
            className="mt-3 h-11 w-full rounded-2xl bg-[#F2A900] text-[14px] font-semibold text-gray-900"
          >
            有効期限を変更する
          </button>
        </div>

        <div className="mt-4 rounded-[24px] border border-gray-200 p-4">
          <p className="text-[14px] font-semibold text-gray-900">レーキ</p>
          <button
            type="button"
            onClick={() => {
              setRakeView("menu")
              setRakeError("")
              setIsRakeModalOpen(true)
            }}
            className="mt-3 h-11 w-full rounded-2xl border border-gray-200 text-[14px] font-semibold text-gray-800"
          >
            レーキを記録する
          </button>
        </div>
      </div>

      {isChipExpiryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-5">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <p className="text-[16px] font-semibold text-gray-900">
                チップの有効期限設定
              </p>
              <button
                type="button"
                onClick={() => setIsChipExpiryModalOpen(false)}
                className="text-[13px] text-gray-500"
              >
                閉じる
              </button>
            </div>

            <div className="mt-4">
              <label className="text-[12px] text-gray-500">
                チップの有効期限（ヶ月）
              </label>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  value={chipExpiryInput}
                  onChange={e => setChipExpiryInput(e.target.value)}
                  placeholder="0"
                  className="h-10 w-24 rounded-xl border border-gray-200 bg-gray-50 px-3 text-[14px] text-gray-950"
                />
                <span className="text-[12px] text-gray-500">ヶ月</span>
                <span className="text-[11px] text-gray-400">
                  0で期限なし
                </span>
              </div>
              {chipExpiryError && (
                <p className="mt-2 text-[12px] text-red-500">
                  {chipExpiryError}
                </p>
              )}
              {chipExpirySuccess && (
                <div className="mt-3 rounded-lg bg-green-50 border border-green-200 p-3">
                  <p className="text-[12px] font-semibold text-green-700">
                    {chipExpirySuccess}
                  </p>
                  <p className="mt-1 text-[11px] text-green-600">
                    通知を送信しました
                  </p>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={saveChipExpiry}
              className="mt-4 h-11 w-full rounded-2xl bg-[#F2A900] text-[14px] font-semibold text-gray-900"
            >
              保存する
            </button>
          </div>
        </div>
      )}

      {isRakeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-5">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <p className="text-[16px] font-semibold text-gray-900">
                レーキ管理
              </p>
              <button
                type="button"
                onClick={() => setIsRakeModalOpen(false)}
                className="text-[13px] text-gray-500"
              >
                閉じる
              </button>
            </div>

            <div className="mt-4 rounded-lg bg-gray-50 p-3 text-center">
              <p className="text-[12px] text-gray-500">レーキ総数</p>
              <p className="mt-1 text-[20px] font-semibold text-gray-900">
                {rakeTotal}
              </p>
            </div>

            {rakeView === "menu" && (
              <div className="mt-4 space-y-2">
                <button
                  type="button"
                  onClick={() => setRakeView("add")}
                  className="h-11 w-full rounded-2xl bg-[#F2A900] text-[14px] font-semibold text-gray-900"
                >
                  レーキを追加する
                </button>
                <button
                  type="button"
                  onClick={() => setRakeView("history")}
                  className="h-11 w-full rounded-2xl border border-gray-200 text-[14px] font-semibold text-gray-800"
                >
                  レーキ履歴
                </button>
              </div>
            )}

            {rakeView === "add" && (
              <div className="mt-4">
                <input
                  type="number"
                  min={1}
                  value={rakeAmount}
                  onChange={e => setRakeAmount(e.target.value)}
                  placeholder="レーキ金額"
                  className="h-11 w-full rounded-2xl border border-gray-200 px-3 text-[14px] text-gray-950"
                />
                <textarea
                  value={rakeMemo}
                  onChange={e => setRakeMemo(e.target.value)}
                  placeholder="メモ（任意）"
                  className="mt-3 h-20 w-full rounded-2xl border border-gray-200 px-3 py-2 text-[14px] text-gray-950"
                />
                {rakeError && (
                  <p className="mt-2 text-[12px] text-red-500">
                    {rakeError}
                  </p>
                )}
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setRakeView("menu")}
                    className="flex-1 rounded-2xl border border-gray-200 py-2 text-[14px] font-semibold text-gray-700"
                  >
                    戻る
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!storeId) return
                      const amount = Number(rakeAmount)
                      if (!amount || amount < 1) {
                        setRakeError("金額は1以上で入力してください")
                        return
                      }
                      setRakeError("")
                      try {
                        await addDoc(
                          collection(db, "stores", storeId, "rakeEntries"),
                          {
                            amount,
                            memo: rakeMemo.trim() || null,
                            createdAt: serverTimestamp(),
                          }
                        )
                        setRakeAmount("")
                        setRakeMemo("")
                        setRakeView("menu")
                      } catch (error) {
                        console.error(
                          "Failed to add rake entry:",
                          error
                        )
                        setRakeError(
                          "記録に失敗しました。権限を確認してください"
                        )
                      }
                    }}
                    className="flex-1 rounded-2xl bg-green-500 py-2 text-[14px] font-semibold text-white"
                  >
                    記録する
                  </button>
                </div>
              </div>
            )}

            {rakeView === "history" && (
              <div className="mt-4">
                {sortedRakeEntries.length === 0 ? (
                  <p className="text-center text-[13px] text-gray-500">
                    履歴がありません
                  </p>
                ) : (
                  <div className="space-y-2">
                    {sortedRakeEntries.map(entry => (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between rounded-2xl border border-gray-200 px-3 py-2"
                      >
                        <div>
                          <p className="text-[12px] text-gray-500">
                            {formatDateTime(
                              entry.createdAt?.seconds
                            )}
                          </p>
                          {entry.memo && (
                            <p className="text-[12px] text-gray-600">
                              {entry.memo}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <p className="text-[13px] font-semibold text-gray-900">
                            +{entry.amount}
                          </p>
                          <button
                            type="button"
                            onClick={async () => {
                              if (!storeId) return
                              try {
                                await deleteDoc(
                                  doc(
                                    db,
                                    "stores",
                                    storeId,
                                    "rakeEntries",
                                    entry.id
                                  )
                                )
                              } catch (error) {
                                console.error(
                                  "Failed to delete rake entry:",
                                  error
                                )
                                setRakeError(
                                  "削除に失敗しました。権限を確認してください"
                                )
                              }
                            }}
                            className="text-gray-400 hover:text-red-500"
                            aria-label="削除"
                          >
                            <FiTrash2 className="text-[14px]" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setRakeView("menu")}
                  className="mt-4 w-full rounded-2xl border border-gray-200 py-2 text-[14px] font-semibold text-gray-700"
                >
                  戻る
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      
    </main>
  )
}