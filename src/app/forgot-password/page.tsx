'use client'

import { useState } from "react"
import { sendPasswordResetEmail } from "firebase/auth"
import { auth } from "@/lib/firebase"
import { useRouter } from "next/navigation"

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleResetPassword = async () => {
    if (!email) {
      setError("メールアドレスを入力してください")
      return
    }
    setIsLoading(true)
    try {
      await sendPasswordResetEmail(auth, email)
      setSuccess(true)
      setError("")
    } catch (e: any) {
      setError(e.message)
      setSuccess(false)
    } finally {
      setIsLoading(false)
    }
  }


  return (
    <main className="min-h-screen bg-white px-5">
      <div className="mx-auto max-w-sm">
        <div className="pt-[72px] text-center">
          <h1 className="text-[28px] font-semibold leading-tight text-gray-900">
            RRPoker
          </h1>
          <p className="mt-2 text-[14px] text-gray-500">パスワード再設定</p>
        </div>

        <div className="mt-7 rounded-[24px] border border-gray-200 p-4">
          <label className="text-[12px] text-gray-500">メールアドレス</label>
          <input
            type="email"
            placeholder="name@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            disabled={isLoading}
            className="mt-2 h-12 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 text-[16px] text-gray-950 outline-none placeholder:text-gray-400 focus:border-gray-300"
          />

          <button
            type="button"
            onClick={handleResetPassword}
            disabled={isLoading}
            className="mt-4 h-[52px] w-full rounded-[24px] bg-[#F2A900] text-[16px] font-semibold text-gray-900 shadow-sm transition-transform active:scale-[0.99] disabled:opacity-50"
          >
            {isLoading ? "送信中..." : "再設定メールを送信"}
          </button>

          {error && <p className="mt-3 text-center text-[13px] text-red-500">{error}</p>}
          {success && (
            <p className="mt-3 text-center text-[13px] text-green-600">
              パスワード再設定メールを送信しました。メールをご確認ください。
            </p>
          )}
        </div>

        <div className="mt-6 flex items-center justify-center pb-7 text-[13px] text-gray-500">
          <button
            type="button"
            onClick={() => router.push("/login")}
            className="hover:text-gray-700 transition-colors"
          >
            ログインに戻る
          </button>
        </div>
      </div>
    </main>
  )
}
