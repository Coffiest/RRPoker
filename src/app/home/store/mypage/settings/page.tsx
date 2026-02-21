"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "firebase/auth"
import { auth, db } from "@/lib/firebase"
import { doc, getDoc, setDoc } from "firebase/firestore"
import { resizeImageToDataUrl } from "@/lib/image"
import HomeHeader from "@/app/components/HomeHeader"

const UNIT_OPTIONS = ["$", "チップ", "単位なし", "その他"]

export default function StoreSettingsPage() {
  const router = useRouter()
  const [storeId, setStoreId] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [address, setAddress] = useState("")
  const [unit, setUnit] = useState("チップ")
  const [customUnit, setCustomUnit] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const MAX_ICON_SIZE = 5 * 1024 * 1024
  const MAX_ICON_EDGE = 200
  const ICON_QUALITY = 0.7
  const MAX_DATA_URL_LENGTH = 900000

  useEffect(() => {
    const fetchProfile = async () => {
      const user = auth.currentUser
      if (!user) return
      const userSnap = await getDoc(doc(db, "users", user.uid))
      const data = userSnap.data()
      setStoreId(data?.storeId ?? null)
      setName(data?.name ?? "")
      setAddress(data?.address ?? "")
      setUnit(data?.chipUnitLabel ?? "チップ")
    }

    fetchProfile()
  }, [])

  const saveProfile = async () => {
    const user = auth.currentUser
    if (!user || !storeId) return
    setError("")
    setSuccess("")

    try {
      let iconUrl: string | undefined
      if (file) {
        if (file.size > MAX_ICON_SIZE) {
          throw new Error("画像サイズが大きすぎます（5MBまで）")
        }
        const dataUrl = await resizeImageToDataUrl(file, MAX_ICON_EDGE, ICON_QUALITY)
        if (dataUrl.length > MAX_DATA_URL_LENGTH) {
          throw new Error("画像サイズが大きすぎます（小さめの画像を選択してください）")
        }
        iconUrl = dataUrl
      }

      const chipUnitLabel = unit === "その他" ? customUnit : unit

      await setDoc(
        doc(db, "stores", storeId),
        { name, address, chipUnitLabel, ...(iconUrl ? { iconUrl } : {}) },
        { merge: true }
      )
      await setDoc(
        doc(db, "users", user.uid),
        { name, address, chipUnitLabel, ...(iconUrl ? { iconUrl } : {}) },
        { merge: true }
      )

      setSuccess("保存しました")
    } catch (e: any) {
      setError(e.message)
    }
  }

  const changePassword = async () => {
    const user = auth.currentUser
    if (!user || !user.email) return
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("すべてのパスワード欄を入力してください")
      return
    }
    if (newPassword !== confirmPassword) {
      setError("新しいパスワードが一致しません")
      return
    }

    setError("")
    setSuccess("")

    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword)
      await reauthenticateWithCredential(user, credential)
      await updatePassword(user, newPassword)
      setSuccess("パスワードを変更しました")
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch (e: any) {
      setError(e.message)
    }
  }

  return (
    <main className="min-h-screen bg-white px-5">
      <HomeHeader homePath="/home/store" myPagePath="/home/store/mypage" variant="store" />
      <div className="mx-auto max-w-sm">
        <div className="pt-[56px] text-center">
          <h1 className="text-[24px] font-semibold text-gray-900">設定</h1>
        </div>

        <div className="mt-6 rounded-[24px] border border-gray-200 p-4">
          <label className="text-[12px] text-gray-500">店舗名</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="mt-2 h-12 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 text-[16px]"
          />

          <div className="mt-4" />
          <label className="text-[12px] text-gray-500">店舗アイコン</label>
          <input
            type="file"
            accept="image/*"
            onChange={e => setFile(e.target.files?.[0] ?? null)}
            className="mt-2 w-full text-[14px]"
          />

          <div className="mt-4" />
          <label className="text-[12px] text-gray-500">住所</label>
          <input
            type="text"
            value={address}
            onChange={e => setAddress(e.target.value)}
            className="mt-2 h-12 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 text-[16px]"
          />

          <div className="mt-4" />
          <label className="text-[12px] text-gray-500">チップ単位</label>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {UNIT_OPTIONS.map(option => (
              <button
                key={option}
                type="button"
                onClick={() => setUnit(option)}
                className={`h-10 rounded-2xl border text-[14px] ${
                  unit === option ? "border-[#F2A900] bg-[#FDF2D0]" : "border-gray-200"
                }`}
              >
                {option}
              </button>
            ))}
          </div>

          {unit === "その他" && (
            <input
              type="text"
              placeholder="単位を入力"
              value={customUnit}
              onChange={e => setCustomUnit(e.target.value)}
              className="mt-3 h-12 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 text-[16px]"
            />
          )}

          <button
            type="button"
            onClick={saveProfile}
            className="mt-4 h-[48px] w-full rounded-[20px] bg-[#F2A900] text-[14px] font-semibold text-gray-900"
          >
            保存する
          </button>
        </div>

        <div className="mt-4 rounded-[24px] border border-gray-200 p-4">
          <p className="text-[14px] font-semibold text-gray-900">パスワード変更</p>
          <input
            type="password"
            placeholder="現在のパスワード"
            value={currentPassword}
            onChange={e => setCurrentPassword(e.target.value)}
            className="mt-3 h-12 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 text-[14px]"
          />
          <input
            type="password"
            placeholder="新しいパスワード"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            className="mt-3 h-12 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 text-[14px]"
          />
          <input
            type="password"
            placeholder="新しいパスワード（確認）"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            className="mt-3 h-12 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 text-[14px]"
          />
          <button
            type="button"
            onClick={changePassword}
            className="mt-4 h-[48px] w-full rounded-[20px] border border-gray-200 text-[14px] font-semibold"
          >
            パスワードを変更
          </button>
        </div>

        {error && <p className="mt-3 text-center text-[13px] text-red-500">{error}</p>}
        {success && <p className="mt-3 text-center text-[13px] text-green-600">{success}</p>}

        <button
          type="button"
          onClick={() => router.back()}
          className="mt-6 text-[13px] text-gray-500"
        >
          戻る
        </button>
      </div>
    </main>
  )
}
