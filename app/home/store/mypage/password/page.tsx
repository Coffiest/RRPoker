"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "firebase/auth"
import { auth } from "@/lib/firebase"
import HomeHeader from "@/components/HomeHeader"

export default function StorePasswordChangePage() {
  const router = useRouter()
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [loading, setLoading] = useState(false)

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
    setLoading(true)

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
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-white px-5">
      <HomeHeader homePath="/home/store" myPagePath="/home/store/mypage" variant="store" />
      <div className="mx-auto max-w-sm">
        <div className="pt-[72px] text-center">
          <h1 className="text-[22px] font-semibold text-gray-900">パスワード変更</h1>
        </div>

        <div className="mt-6 rounded-[24px] border border-gray-200 p-4">
          <input
            type="password"
            placeholder="現在のパスワード"
            value={currentPassword}
            onChange={e => setCurrentPassword(e.target.value)}
            className="mt-2 h-12 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 text-[14px]"
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

          {error && <p className="mt-3 text-center text-[13px] text-red-500">{error}</p>}
          {success && <p className="mt-3 text-center text-[13px] text-green-600">{success}</p>}

          <button
            type="button"
            onClick={changePassword}
            disabled={loading}
            className="mt-4 h-[52px] w-full rounded-[24px] bg-[#F2A900] text-[15px] font-semibold text-gray-900 disabled:opacity-60"
          >
            変更する
          </button>
        </div>

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
