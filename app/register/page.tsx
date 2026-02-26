'use client'

import { useState } from "react"
import { createUserWithEmailAndPassword } from "firebase/auth"
import { doc, setDoc, serverTimestamp } from "firebase/firestore"
import { auth, db } from "@/lib/firebase"
import { useRouter } from "next/navigation"

export default function RegisterPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleRegister = async () => {
    if (password !== confirmPassword) {
      setError("パスワードが一致しません")
      return
    }
    if (!email || !password) {
      setError("全ての項目を入力してください")
      return
    }
    setIsLoading(true)
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password)
      const user = credential.user

      await setDoc(
        doc(db, "users", user.uid),
        {
          email: user.email,
          createdAt: serverTimestamp(),
        },
        { merge: true }
      )

      router.replace("/onboarding")
    } catch (e: any) {
      setError(e.message)
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
          <p className="mt-2 text-[14px] text-gray-500">新規登録</p>
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

          <div className="mt-3" />
          <label className="text-[12px] text-gray-500">パスワード</label>
          <input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={e => setPassword(e.target.value)}
            disabled={isLoading}
            className="mt-2 h-12 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 text-[16px] text-gray-950 outline-none placeholder:text-gray-400 focus:border-gray-300"
          />

          <div className="mt-3" />
          <label className="text-[12px] text-gray-500">パスワード（確認用）</label>
          <input
            type="password"
            placeholder="••••••••"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            disabled={isLoading}
            className="mt-2 h-12 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 text-[16px] text-gray-950 outline-none placeholder:text-gray-400 focus:border-gray-300"
          />

          <button
            type="button"
            onClick={handleRegister}
            disabled={isLoading}
            className="mt-4 h-[52px] w-full rounded-[24px] bg-[#F2A900] text-[16px] font-semibold text-gray-900 shadow-sm transition-transform active:scale-[0.99] disabled:opacity-50"
          >
            {isLoading ? "処理中..." : "登録する"}
          </button>

          {error && <p className="mt-3 text-center text-[13px] text-red-500">{error}</p>}
        </div>

        <div className="mt-6 flex items-center justify-center pb-7 text-[13px] text-gray-500">
          <button
            type="button"
            onClick={() => router.push("/login")}
            className="hover:text-gray-700 transition-colors"
          >
            既にアカウントがある場合はログイン
          </button>
        </div>
      </div>
    </main>
  )
}
