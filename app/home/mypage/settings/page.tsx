"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { auth, db } from "@/lib/firebase"
import { doc, getDoc, setDoc } from "firebase/firestore"
import { resizeImageToDataUrl } from "@/lib/image"
import HomeHeader from "@/components/HomeHeader"

export default function UserSettingsPage() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [file, setFile] = useState<File | null>(null)
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
      const snap = await getDoc(doc(db, "users", user.uid))
      const data = snap.data()
      setName(data?.name ?? "")
    }

    fetchProfile()
  }, [])

  const saveProfile = async () => {
    const user = auth.currentUser
    if (!user) return
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

      await setDoc(
        doc(db, "users", user.uid),
        { name, ...(iconUrl ? { iconUrl } : {}) },
        { merge: true }
      )

      setSuccess("保存しました")
    } catch (e: any) {
      setError(e.message)
    }
  }

  return (
    <main className="min-h-screen bg-white px-5">
      <HomeHeader homePath="/home" myPagePath="/home/mypage" />
      <div className="mx-auto max-w-sm">
        <div className="pt-[56px] text-center">
          <h1 className="text-[24px] font-semibold text-gray-900">プロフィール編集</h1>
        </div>

        <div className="mt-6 rounded-[24px] border border-gray-200 p-4">
          <label className="text-[12px] text-gray-500">ユーザー名</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="mt-2 h-12 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 text-[16px]"
          />

          <div className="mt-4" />
          <label className="text-[12px] text-gray-500">アイコン画像</label>
          <input
            type="file"
            accept="image/*"
            onChange={e => setFile(e.target.files?.[0] ?? null)}
            className="mt-2 w-full text-[14px]"
          />

          <button
            type="button"
            onClick={saveProfile}
            className="mt-4 h-[48px] w-full rounded-[20px] bg-[#F2A900] text-[14px] font-semibold text-gray-900"
          >
            プロフィールを保存
          </button>
        </div>

        {error && <p className="mt-3 text-center text-[13px] text-red-500">{error}</p>}
        {success && <p className="mt-3 text-center text-[13px] text-green-600">{success}</p>}

        <button
          type="button"
          onClick={() => router.push('/home/mypage/password')}
          className="mt-6 h-[48px] w-full rounded-[20px] bg-[#F2A900] text-[14px] font-semibold text-gray-900"
        >
          パスワード変更
        </button>

        {/* アカウント連携ボタン削除済み */}

        <button
          type="button"
          onClick={() => router.back()}
          className="mt-4 text-[13px] text-gray-500"
        >
          戻る
        </button>
      </div>
    </main>
  )
}
