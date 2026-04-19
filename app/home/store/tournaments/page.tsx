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
import { FiPlus, FiSettings, FiTrash2, FiX, FiCamera, FiHome, FiUser, FiCalendar, FiClock, FiUsers, FiAward } from "react-icons/fi"
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
    <main className="min-h-screen bg-[#FFFBF5] pb-28 text-gray-900">
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
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
        .tournament-card {
          background: linear-gradient(145deg, #ffffff 0%, #fefefe 100%);
          box-shadow: 
            0 2px 8px rgba(242, 169, 0, 0.06),
            0 8px 24px rgba(0, 0, 0, 0.04);
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .tournament-card:hover {
          transform: translateY(-2px);
          box-shadow: 
            0 4px 16px rgba(242, 169, 0, 0.1),
            0 12px 32px rgba(0, 0, 0, 0.06);
        }
        .history-card {
          background: linear-gradient(145deg, #ffffff 0%, #fefefe 100%);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
        }
        .glass-nav {
          background: rgba(255, 255, 255, 0.7);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
        }
        .modal-overlay {
          background: rgba(0, 0, 0, 0.3);
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
        }
        .action-button {
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .action-button:active {
          transform: scale(0.96);
        }
        .itm-card {
          background: linear-gradient(135deg, #FFF7E6 0%, #FFFBF5 100%);
          border: 1.5px solid #F2A900;
          box-shadow: 0 2px 12px rgba(242, 169, 0, 0.15);
        }
        .non-itm-card {
          background: linear-gradient(145deg, #F9F9F9 0%, #FEFEFE 100%);
        }
      `}</style>

      <HomeHeader
        homePath="/home/store"
        myPagePath="/home/store/mypage"
        variant="store"
      />

      <div className="max-w-xl mx-auto px-4 pt-6">
        {/* Header Section */}
        <div className="flex justify-between items-center mb-6 animate-slideUp">
          <div>
            <h2 className="text-[26px] font-bold text-gray-900">
              Tournaments
            </h2>
            <p className="text-[14px] text-gray-500 mt-1">
              トーナメント管理
            </p>
          </div>
          <button
            onClick={() => {
              setEditData(null)
              setOpenModal(true)
            }}
            className="action-button flex items-center gap-2 bg-gradient-to-br from-[#F2A900] to-[#D4910A] text-white px-5 py-3 rounded-2xl font-semibold shadow-lg hover:shadow-xl"
          >
            <FiPlus size={20} />
            New Tournament
          </button>
        </div>

        <div className="space-y-4">
{/* 現在のトーナメント */}
{tournaments
  .filter(t => t.status !== "finished")
  .map((t, index) => (
    <div
      key={t.id}
      className="tournament-card rounded-3xl p-5 animate-slideUp"
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <h3 className="text-[18px] font-bold text-gray-900 mb-2">
            {t.name}
          </h3>
          <div className="flex items-center gap-4 text-[13px] text-gray-600">
            <div className="flex items-center gap-1.5">
              <FiCalendar size={14} className="text-[#F2A900]" />
              <span>
                {t.date instanceof Date
                  ? t.date.toLocaleDateString()
                  : ""}
              </span>
            </div>
            {t.startTime && (
              <div className="flex items-center gap-1.5">
                <FiClock size={14} className="text-[#F2A900]" />
                <span>{t.startTime}</span>
              </div>
            )}
          </div>
        </div>
        {t.status === "scheduled" && (
          <div className="flex items-center gap-2">
            <button 
              onClick={() => handleEdit(t)}
              className="action-button h-9 w-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600"
            >
              <FiSettings size={16} />
            </button>
            <button 
              onClick={() => handleDelete(t.id)}
              className="action-button h-9 w-9 rounded-full bg-red-50 hover:bg-red-100 flex items-center justify-center text-red-500"
            >
              <FiTrash2 size={16} />
            </button>
          </div>
        )}
      </div>

      {t.status === "scheduled" && (
        <button
          className="action-button w-full h-12 rounded-2xl bg-gradient-to-r from-gray-900 to-gray-800 text-white font-semibold shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={() => handleStartTournament(t.id)}
          disabled={!!startingId}
        >
          {startingId === t.id ? (
            <div className="flex items-center justify-center gap-2">
              <div className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
              Starting...
            </div>
          ) : (
            "Start Tournament !"
          )}
        </button>
      )}
    </div>
))}

{/* 履歴セクション */}
{tournaments.filter(t => t.status === "finished").length > 0 && (
  <>
    <div className="mt-10 mb-5 flex items-center gap-3 animate-slideUp">
      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent"></div>
      <h3 className="text-[15px] font-bold text-gray-600 tracking-wide">History</h3>
      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent"></div>
    </div>

    {tournaments
      .filter(t => t.status === "finished")
      .map((t, index) => {
        return (
          <div key={t.id} className="history-card rounded-3xl p-5 animate-slideUp" style={{ animationDelay: `${index * 0.05}s` }}>
            
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h4 className="text-[16px] font-bold text-gray-900 mb-1">
                  {t.name}
                </h4>
                <div className="flex items-center gap-2 text-[12px] text-gray-500">
                  <FiClock size={12} />
                  {t.startedAt instanceof Date
                    ? t.startedAt.toLocaleString()
                    : ""}
                </div>
              </div>
              <button 
                onClick={() => handleEdit(t)}
                className="action-button h-8 w-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600"
              >
                <FiSettings size={14} />
              </button>
            </div>

            {/* エントリー一覧 */}
            <div className="space-y-2.5">
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
                      className={`rounded-2xl px-4 py-3 ${
                        isITM ? "itm-card" : "non-itm-card"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className={`text-[15px] font-bold ${
                          isITM ? "text-[#F2A900]" : "text-gray-900"
                        }`}>
                          {isITM && typeof payout.rank === "number" && (
                            <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-[#F2A900] text-white text-[11px] font-bold mr-2">
                              {payout.rank}
                            </span>
                          )}
                          {typeof e.name === "string"
                            ? e.name
                            : typeof e.id === "string"
                            ? e.id
                            : ""}
                        </div>

                        {isITM && (
                          <div className="flex items-center gap-1.5 bg-white/60 rounded-full px-3 py-1">
                            <FiAward size={14} className="text-[#F2A900]" />
                            <span className="text-[13px] font-bold text-[#F2A900]">
                              {typeof payout.amount === "number" ? payout.amount.toLocaleString() : 0}円
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-3 text-[12px] text-gray-600 font-medium">
                        <span className="flex items-center gap-1">
                          <span className="text-gray-400">E:</span>{e.entryCount ?? 0}
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="text-gray-400">R:</span>{e.reentryCount ?? 0}
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="text-gray-400">A:</span>{e.addonCount ?? 0}
                        </span>
                      </div>
                    </div>
                  )
              })}
            </div>
          </div>
        )
      })}
  </>
)}
        </div>
      </div>

      {/* モーダル */}
      {openModal && (
        <div className="fixed inset-0 z-50 flex justify-center items-center px-4 modal-overlay animate-fadeIn">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 relative text-gray-900 max-h-[85vh] overflow-y-auto shadow-2xl animate-slideUp">
            <button
              className="action-button absolute right-5 top-5 h-9 w-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
              onClick={() => setOpenModal(false)}
            >
              <FiX size={18} />
            </button>

            <h3 className="text-[22px] font-bold mb-8 text-gray-900">
              {editData ? "トーナメント編集" : "トーナメント作成"}
            </h3>

            {/* 基本情報 */}
            <div className="space-y-4 mb-8">
              <div>
                <label className="block text-[13px] font-semibold text-gray-700 mb-2">
                  トーナメント名
                </label>
                <input
                  placeholder="例: Daily Tournament"
                  value={form.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  className="w-full border-2 border-gray-200 rounded-2xl px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-[#F2A900] focus:outline-none transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[13px] font-semibold text-gray-700 mb-2">
                    開催日
                  </label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => handleChange("date", e.target.value)}
                    className="w-full border-2 border-gray-200 rounded-2xl px-4 py-3 text-gray-900 focus:border-[#F2A900] focus:outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-semibold text-gray-700 mb-2">
                    開始時刻
                  </label>
                  <input
                    type="time"
                    value={form.startTime}
                    onChange={(e) => handleChange("startTime", e.target.value)}
                    className="w-full border-2 border-gray-200 rounded-2xl px-4 py-3 text-gray-900 focus:border-[#F2A900] focus:outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-gray-700 mb-2">
                  RC時間
                </label>
                <input
                  type="time"
                  value={form.rcTime}
                  onChange={(e) => handleChange("rcTime", e.target.value)}
                  className="w-full border-2 border-gray-200 rounded-2xl px-4 py-3 text-gray-900 focus:border-[#F2A900] focus:outline-none transition-all"
                />
              </div>
            </div>

            {/* 費用とスタック */}
            <div className="mb-8">
              <h4 className="text-[15px] font-bold text-gray-900 mb-4">費用・スタック設定</h4>
              <div className="space-y-3">
                {/* エントリー */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[12px] font-medium text-gray-600 mb-1.5">
                      エントリー費
                    </label>
                    <input
                      type="number"
                      value={form.entryFee}
                      onChange={(e) => handleChange("entryFee", e.target.value)}
                      className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-gray-900 text-right placeholder-gray-400 focus:border-[#F2A900] focus:outline-none transition-all"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-gray-600 mb-1.5">
                      エントリースタック
                    </label>
                    <input
                      type="number"
                      value={form.entryStack}
                      onChange={(e) => handleChange("entryStack", e.target.value)}
                      className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-gray-900 text-right placeholder-gray-400 focus:border-[#F2A900] focus:outline-none transition-all"
                      placeholder="0"
                    />
                  </div>
                </div>

                {/* リエントリー */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[12px] font-medium text-gray-600 mb-1.5">
                      リエントリー費
                    </label>
                    <input
                      type="number"
                      value={form.reentryFee}
                      onChange={(e) => handleChange("reentryFee", e.target.value)}
                      className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-gray-900 text-right placeholder-gray-400 focus:border-[#F2A900] focus:outline-none transition-all"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-gray-600 mb-1.5">
                      リエントリースタック
                    </label>
                    <input
                      type="number"
                      value={form.reentryStack}
                      onChange={(e) => handleChange("reentryStack", e.target.value)}
                      className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-gray-900 text-right placeholder-gray-400 focus:border-[#F2A900] focus:outline-none transition-all"
                      placeholder="0"
                    />
                  </div>
                </div>

                {/* アドオン */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[12px] font-medium text-gray-600 mb-1.5">
                      アドオン費
                    </label>
                    <input
                      type="number"
                      value={form.addonFee}
                      onChange={(e) => handleChange("addonFee", e.target.value)}
                      className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-gray-900 text-right placeholder-gray-400 focus:border-[#F2A900] focus:outline-none transition-all"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-gray-600 mb-1.5">
                      アドオンスタック
                    </label>
                    <input
                      type="number"
                      value={form.addonStack}
                      onChange={(e) => handleChange("addonStack", e.target.value)}
                      className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-gray-900 text-right placeholder-gray-400 focus:border-[#F2A900] focus:outline-none transition-all"
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* チラシ画像 */}
            <div className="mb-8">
              <h4 className="text-[15px] font-bold text-gray-900 mb-4">チラシ画像</h4>
              <label className="action-button flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-2xl p-8 cursor-pointer hover:border-[#F2A900] hover:bg-[#FFFBF5] transition-all">
                <FiCamera size={32} className="text-gray-400 mb-3" />
                <span className="text-[14px] font-medium text-gray-600">画像を選択</span>
                <span className="text-[12px] text-gray-400 mt-1">タップして選択</span>
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
                <div className="mt-4 relative rounded-2xl overflow-hidden shadow-lg">
                  <img
                    src={imagePreview}
                    alt="preview"
                    className="w-full"
                  />
                  <button
                    onClick={() => {
                      setImagePreview(null)
                      setImageFile(null)
                    }}
                    className="action-button absolute top-3 right-3 h-8 w-8 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white"
                  >
                    <FiX size={16} />
                  </button>
                </div>
              )}
            </div>

            {/* 保存ボタン */}
            <button
              onClick={handleSave}
              className="action-button w-full bg-gradient-to-br from-[#F2A900] to-[#D4910A] text-white font-bold py-4 rounded-2xl shadow-lg hover:shadow-xl"
            >
              保存する
            </button>
          </div>
        </div>
      )}

      {/* フッターメニュー */}
      <nav className="fixed bottom-0 left-0 right-0 w-full z-[80] border-t border-gray-200/60 glass-nav shadow-lg">
        <div className="relative mx-auto flex max-w-sm w-full items-center justify-between px-8 py-3">
          <button
            type="button"
            onClick={() => router.push("/home/store")}
            className="flex flex-col items-center text-gray-400 hover:text-[#F2A900] transition-all"
          >
            <FiHome className="text-[22px]" />
            <span className="mt-1 text-[11px]">
              ホーム
            </span>
          </button>

          <button
            type="button"
            onClick={() => router.push("/home/store/tournaments")}
            className="action-button absolute left-1/2 top-0 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-[#F2A900] to-[#D4910A] text-white shadow-xl hover:shadow-2xl font-semibold"
            aria-label="トーナメント"
            disabled
          >
            <FiPlus className="text-[28px]" />
            <span className="mt-0.5 text-[10px] font-bold"></span>
          </button>

          <button
            type="button"
            onClick={() => router.push("/home/store/mypage")}
            className="flex flex-col items-center text-gray-400 hover:text-[#F2A900] transition-all"
          >
            <FiUser className="text-[22px]" />
            <span className="mt-1 text-[11px]">
              マイページ
            </span>
          </button>
        </div>
      </nav>
    </main>
  )
}
