  "use client"
  
  



import { useEffect, useState } from "react"
import {
  collection,
  onSnapshot,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc
} from "firebase/firestore"
import { db, auth } from "@/lib/firebase"
import HomeHeader from "@/components/HomeHeader"
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL
} from "firebase/storage"
import { FiPlus, FiSettings, FiTrash2, FiX, FiCamera, FiHome, FiUser } from "react-icons/fi"
import { useRouter } from "next/navigation"
import { serverTimestamp } from "firebase/firestore"



export default function TournamentsPage() {
  const router = useRouter()
  const [storeId, setStoreId] = useState<string | null>(null)
  const [tournaments, setTournaments] = useState<any[]>([])
  const [entriesMap, setEntriesMap] = useState<any>({})
  const [openModal, setOpenModal] = useState(false)
  const [editData, setEditData] = useState<any | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  const [form, setForm] = useState({
    name: "",
    date: "",
    startTime: "",
    rcTime: "",
    entryFee: "",
    reentryFee: "",
    addonFee: "",
    entryStack: "",
    reentryStack: "",
    addonStack: "",
    flyerUrl: ""
  })

  const storage = getStorage()

  // Startボタンのローディング管理
  const [startingId, setStartingId] = useState<string|null>(null)

  const handleStartTournament = async (id: string) => {
    if (!storeId) return
    setStartingId(id)
    try {
      await updateDoc(doc(db, "stores", storeId, "tournaments", id), {
        status: "active",
        startedAt: serverTimestamp(),
      })
    } finally {
      setStartingId(null)
    }
  }

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (user) => {
      if (!user) return
      const snap = await getDoc(doc(db, "users", user.uid))
      setStoreId(snap.data()?.storeId ?? null)
    })
    return () => unsub()
  }, [])

 useEffect(() => {
  if (!storeId) return
  const refCol = collection(db, "stores", storeId, "tournaments")

  const unsub = onSnapshot(refCol, async (snap) => {

const normalize = (v: any) => {
  // Firestore Timestamp
  if (v?.toDate) return v.toDate()

  // seconds/nanoseconds 型（壊れデータ）
  if (
    typeof v === "object" &&
    v !== null &&
    typeof v.seconds === "number"
  ) {
    return new Date(v.seconds * 1000)
  }

  return v
}

  const list: any[] = []

  snap.forEach((d) => {
    const data = d.data()

    list.push({
      id: d.id,
      name: data.name ?? "",
      status: data.status ?? "",
      startTime: data.startTime ?? "",
      date: normalize(data.date),
      createdAt: normalize(data.createdAt),
      startedAt: normalize(data.startedAt),
      updatedAt: normalize(data.updatedAt),
      payouts: Array.isArray(data.payouts)
        ? data.payouts.map((p: any) => ({
            playerId: p.playerId ?? "",
            rank: p.rank ?? 0,
            amount: p.amount ?? 0,
            createdAt: normalize(p.createdAt),
            updatedAt: normalize(p.updatedAt)
          }))
        : []
    })
  })

  setTournaments(list)

  const map: any = {}

  for (const t of list) {
    const entriesRef = collection(
      db,
      "stores",
      storeId,
      "tournaments",
      t.id,
      "entries"
    )

    const entriesSnap = await getDocs(entriesRef)

map[t.id] = entriesSnap.docs.map(d => {
  const data = d.data()

  return {
    id: d.id,
    name: typeof data.name === "string" ? data.name : "",
        entryCount: data.entryCount ?? 0,
        reentryCount: data.reentryCount ?? 0,
        addonCount: data.addonCount ?? 0,
        createdAt: normalize(data.createdAt),
        updatedAt: normalize(data.updatedAt)
      }
    })
  }

  setEntriesMap(map)
})

  return () => unsub()
}, [storeId])

  const handleChange = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleImageSelect = (file: File) => {
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const uploadImageIfNeeded = async (): Promise<string> => {
    if (!imageFile || !storeId) return form.flyerUrl || ""

    const fileRef = ref(
      storage,
      `tournaments/${storeId}/${Date.now()}_${imageFile.name}`
    )

    await uploadBytes(fileRef, imageFile)
    return await getDownloadURL(fileRef)
  }

  const handleSave = async () => {
    if (!storeId) return
    if (!form.name || !form.date) {
      alert("名称と日付は必須です")
      return
    }
    if (
      Number(form.entryFee) === 0 &&
      Number(form.reentryFee) === 0 &&
      Number(form.addonFee) === 0
    ) {
      alert("エントリー費、リエントリー費、アドオン費のいずれかは1以上必要です")
      return
    }

    const flyerUrl = await uploadImageIfNeeded()

    const payload = {
      name: form.name,
      date: form.date,
      startTime: form.startTime,
      rcTime: form.rcTime,
      entryFee: Number(form.entryFee) || 0,
      reentryFee: Number(form.reentryFee) || 0,
      addonFee: Number(form.addonFee) || 0,
      entryStack: Number(form.entryStack) || 0,
      reentryStack: Number(form.reentryStack) || 0,
      addonStack: Number(form.addonStack) || 0,
      flyerUrl,
      bustCount: editData?.bustCount ?? 0,
      status: editData ? (editData.status ?? "scheduled") : "scheduled",
      createdAt: editData?.createdAt ?? serverTimestamp()
    }

    let tournamentId: string | null = null

    if (editData) {
      await updateDoc(
        doc(db, "stores", storeId, "tournaments", editData.id),
        payload
      )
      tournamentId = editData.id
    } else {
      const docRef = await addDoc(
        collection(db, "stores", storeId, "tournaments"),
        payload
      )
      tournamentId = docRef.id
    }

    setOpenModal(false)
    setEditData(null)
    setImageFile(null)
    setImagePreview(null)
    setForm({
      name: "",
      date: "",
      startTime: "",
      rcTime: "",
      entryFee: "",
      reentryFee: "",
      addonFee: "",
      entryStack: "",
      reentryStack: "",
      addonStack: "",
      flyerUrl: ""
    })
  }

  const handleDelete = async (id: string) => {
    if (!storeId) return
    const ok = confirm("本当に削除しますか？")
    if (!ok) return
    await deleteDoc(doc(db, "stores", storeId, "tournaments", id))
  }

  const handleEdit = (t: any) => {
    setEditData(t)
    setImagePreview(t.flyerUrl || null)
    setForm({
      name: t.name ?? "",
      date: t.date?.toDate
        ? t.date.toDate().toISOString().slice(0, 10)
        : t.date ?? "",
      startTime: t.startTime ?? "",
      rcTime: t.rcTime ?? "",
      entryFee: String(t.entryFee ?? ""),
      reentryFee: String(t.reentryFee ?? ""),
      addonFee: String(t.addonFee ?? ""),
      entryStack: String(t.entryStack ?? ""),
      reentryStack: String(t.reentryStack ?? ""),
      addonStack: String(t.addonStack ?? ""),
      flyerUrl: t.flyerUrl ?? ""
    })
    setOpenModal(true)
  }

  return (
    <main className="min-h-screen bg-gray-50 pb-28 text-gray-900">
      <HomeHeader
        homePath="/home/store"
        myPagePath="/home/store/mypage"
        variant="store"
      />

      <div className="max-w-xl mx-auto px-4 pt-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-900">
            Tournament
          </h2>
          <button
            onClick={() => {
              setEditData(null)
              setOpenModal(true)
            }}
            className="flex items-center gap-2 bg-[#F2A900] text-white px-4 py-2 rounded-xl font-semibold"
          >
            <FiPlus />
            新規作成
          </button>
        </div>

        <div className="space-y-3">
{/* 現在のトーナメント */}


{tournaments
  .filter(t => t.status !== "finished")
  .map((t) => (
    <div
      key={t.id}
      className="bg-white border border-gray-200 rounded-xl p-4 flex justify-between items-center"
    >
      <div>
        <div className="font-semibold text-gray-900">
          {t.name}
        </div>
       <div className="text-sm text-gray-800">
          {t.date instanceof Date
            ? t.date.toLocaleDateString()
            : ""}
            {" "}
  {t.startTime || ""}
</div>
      </div>
      <div className="flex gap-3 items-center">
        <button onClick={() => handleEdit(t)}>
          <FiSettings size={18} />
        </button>
        <button onClick={() => handleDelete(t.id)}>
          <FiTrash2 size={18} />
        </button>
        {t.status === "scheduled" && (
          <button
            className="text-[13px] px-3 py-1 rounded-full bg-gray-900 text-white font-medium ml-2 disabled:opacity-50"
            onClick={() => handleStartTournament(t.id)}
            disabled={!!startingId}
          >
            {startingId === t.id ? "Starting..." : "Start !"}
          </button>
        )}
      </div>
    </div>
))}

{/* 履歴 */}
<div className="mt-6 text-sm font-bold">履歴</div>

{tournaments
  .filter(t => t.status === "finished")
  .map(t => {
    return (
      <div key={t.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-3">
        
<div className="flex items-center justify-between mb-1">
  <div className="text-[14px] font-semibold text-gray-900">
    {t.name}
  </div>
 <div className="text-[11px] text-gray-400">
      {t.startedAt instanceof Date
        ? t.startedAt.toLocaleString()
        : ""}
</div>
</div>

        <div className="mt-2 text-xs">

{entriesMap[t.id]
  ?.filter((e: any) =>
    (e.entryCount ?? 0) > 0 ||
    (e.reentryCount ?? 0) > 0 ||
    (e.addonCount ?? 0) > 0
  )
  .map((e: any, i: number) => {

    const payout = t.payouts?.find((p: any) => p.playerId === e.id)
    const isITM = !!payout

    return (
      <div
        key={i}
        className={`rounded-xl px-3 py-3 mt-2 ${
          isITM
            ? "bg-[#FFF7E6] border border-[#F2A900]"
            : "bg-gray-50"
        }`}
      >

        <div className="flex items-center justify-between">

          <div className={`text-[14px] font-semibold ${
            isITM ? "text-[#F2A900]" : "text-gray-900"
          }`}>
            {isITM && typeof payout.rank === "number" ? `${payout.rank}位 ` : ""}{typeof e.name === "string"
  ? e.name
  : typeof e.id === "string"
  ? e.id
  : ""}
          </div>

          {isITM && (
            <div className="text-[13px] font-semibold text-[#F2A900]">
             獲得プライズ：
{typeof payout.rank === "number" ? payout.rank : 0}位
（{typeof payout.amount === "number" ? payout.amount.toLocaleString() : 0}円）
            </div>
          )}

        </div>

        <div className="flex gap-4 mt-2 text-[13px] text-gray-600 font-medium">
          <span>E:{e.entryCount ?? 0}回</span>
          <span>R:{e.reentryCount ?? 0}回</span>
          <span>A:{e.addonCount ?? 0}回</span>
        </div>

      </div>
    )
})}

        </div>
      </div>
    )
  })}



          
        </div>
      </div>

      {openModal && (
        <div className="fixed inset-0 bg-black/40 flex justify-center items-center px-4">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 relative text-gray-900 
          max-h-[80vh] overflow-y-auto">
            <button
              className="absolute right-4 top-4"
              onClick={() => setOpenModal(false)}
            >
              <FiX />
            </button>

            <h3 className="text-lg font-semibold mb-8">
              {editData ? "トーナメント編集" : "トーナメント作成"}
            </h3>

            {/* ▼ セクション1: 基本情報 */}
            <div className="space-y-4 mb-8">
              <input
                placeholder="名称を入力"
                value={form.name}
                onChange={(e) => handleChange("name", e.target.value)}
                className="w-full border rounded-xl p-3 text-gray-900 placeholder-gray-400"
              />
              <input
                type="date"
                value={form.date}
                onChange={(e) => handleChange("date", e.target.value)}
                className="appearance-none w-full border rounded-xl p-3 h-12 text-base text-gray-900 placeholder-gray-400"
              />
              <input
                type="time"
                value={form.startTime}
                onChange={(e) => handleChange("startTime", e.target.value)}
                className="appearance-none w-full border rounded-xl p-3 h-12 text-base text-gray-900 placeholder-gray-400"
                placeholder="開始時刻を入力"
              />
              <input
                type="time"
                value={form.rcTime}
                onChange={(e) => handleChange("rcTime", e.target.value)}
                className="appearance-none w-full border rounded-xl p-3 h-12 text-base text-gray-900 placeholder-gray-400"
                placeholder="RC時間を入力"
              />
            </div>

            {/* ▼ セクション2: 金額＋スタック */}
            <div className="grid grid-rows-3 gap-4 mb-8">
              {/* 行1 */}
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="number"
                  value={form.entryFee}
                  onChange={(e) => handleChange("entryFee", e.target.value)}
                  className="w-full border rounded-xl p-3 text-gray-900 text-right placeholder-gray-400"
                  placeholder="エントリー費"
                />
                <input
                  type="number"
                  value={form.entryStack}
                  onChange={(e) => handleChange("entryStack", e.target.value)}
                  className="w-full border rounded-xl p-3 text-gray-900 text-right placeholder-gray-400"
                  placeholder="エントリースタック"
                />
              </div>
              {/* 行2 */}
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="number"
                  value={form.reentryFee}
                  onChange={(e) => handleChange("reentryFee", e.target.value)}
                  className="w-full border rounded-xl p-3 text-gray-900 text-right placeholder-gray-400"
                  placeholder="リエントリー費"
                />
                <input
                  type="number"
                  value={form.reentryStack}
                  onChange={(e) => handleChange("reentryStack", e.target.value)}
                  className="w-full border rounded-xl p-3 text-gray-900 text-right placeholder-gray-400"
                  placeholder="リエントリースタック"
                />
              </div>
              {/* 行3 */}
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="number"
                  value={form.addonFee}
                  onChange={(e) => handleChange("addonFee", e.target.value)}
                  className="w-full border rounded-xl p-3 text-gray-900 text-right placeholder-gray-400"
                  placeholder="アドオン費"
                />
                <input
                  type="number"
                  value={form.addonStack}
                  onChange={(e) => handleChange("addonStack", e.target.value)}
                  className="w-full border rounded-xl p-3 text-gray-900 text-right placeholder-gray-400"
                  placeholder="アドオンスタック"
                />
              </div>
            </div>

            {/* ▼ セクション3: チラシ画像 */}
            <div className="mb-8">
              <label className="block mb-2 font-semibold text-gray-900">
                チラシ画像
              </label>
              <label className="flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-6 cursor-pointer">
                <FiCamera size={32} />
                <span className="mt-2 text-gray-900">画像を選択</span>
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      handleImageSelect(e.target.files[0])
                    }
                  }}
                />
              </label>
              {imagePreview && (
                <img
                  src={imagePreview}
                  alt="preview"
                  className="mt-4 rounded-xl"
                />
              )}
            </div>

            {/* ▼ 保存ボタン */}
            <button
              onClick={handleSave}
              className="w-full bg-[#F2A900] text-white font-semibold py-3 rounded-xl mt-8"
            >
              保存
            </button>
          </div>
        </div>
      )}
      {/* フッターメニュー追加 */}
      <nav className="fixed bottom-0 left-0 right-0 w-full z-[80] border-t border-gray-200 bg-white">
        <div className="relative mx-auto flex max-w-sm w-full items-center justify-between px-8 py-3">
          <button
            type="button"
            onClick={() => router.push("/home/store")}
            className="flex flex-col items-center text-gray-400"
          >
            <FiHome className="text-[18px]" />
            <span className="mt-1 text-[11px]">
              ホーム
            </span>
          </button>

          <button
            type="button"
            onClick={() => router.push("/home/store/tournaments")}
            className="absolute left-1/2 top-0 flex h-[74px] w-[74px] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full bg-[#F2A900] text-gray-900 shadow-lg font-semibold"
            aria-label="トーナメント"
            disabled
          >
            <FiPlus className="text-[22px]" />
            <span className="mt-1 text-[10px] font-semibold">トナメ</span>
          </button>

          <button
            type="button"
            onClick={() => router.push("/home/store/mypage")}
            className="flex flex-col items-center text-gray-400"
          >
            <FiUser className="text-[18px]" />
            <span className="mt-1 text-[11px]">
              マイページ
            </span>
          </button>
        </div>
      </nav>
    </main>
  )
}