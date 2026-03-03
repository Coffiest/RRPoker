"use client"

import { useEffect, useState } from "react"
import {
  collection,
  onSnapshot,
  doc,
  getDoc,
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

const storage = getStorage()

export default function TournamentsPage() {
  const router = useRouter()
  const [storeId, setStoreId] = useState<string | null>(null)
  const [tournaments, setTournaments] = useState<any[]>([])
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

    const unsub = onSnapshot(refCol, (snap) => {
      const list: any[] = []
      snap.forEach((d) => {
        list.push({ id: d.id, ...d.data() })
      })
      setTournaments(list)
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
      status: editData?.status ?? "active",
      createdAt: editData?.createdAt ?? new Date()
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
          {tournaments.map((t) => (
            <div
              key={t.id}
              className="bg-white border border-gray-200 rounded-xl p-4 flex justify-between items-center"
            >
              <div>
                <div className="font-semibold text-gray-900">
                  {t.name}
                </div>
                <div className="text-sm text-gray-800">
                  {t.date && t.date.toDate
                    ? t.date.toDate().toLocaleDateString()
                    : t.date || ""}
                  {" "}
                  {t.startTime || ""}
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => handleEdit(t)}>
                  <FiSettings size={18} />
                </button>
                <button onClick={() => handleDelete(t.id)}>
                  <FiTrash2 size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {openModal && (
        <div className="fixed inset-0 bg-black/40 flex justify-center items-center px-4">
          <div className="bg-white w-full max-w-lg rounded-2xl p-6 relative text-gray-900">
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
                className="w-full border rounded-xl p-3 text-gray-900 placeholder-gray-400"
              />
              <input
                type="time"
                value={form.startTime}
                onChange={(e) => handleChange("startTime", e.target.value)}
                className="w-full border rounded-xl p-3 text-gray-900 placeholder-gray-400"
                placeholder="開始時刻を入力"
              />
              <input
                type="time"
                value={form.rcTime}
                onChange={(e) => handleChange("rcTime", e.target.value)}
                className="w-full border rounded-xl p-3 text-gray-900 placeholder-gray-400"
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