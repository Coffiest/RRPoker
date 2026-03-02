'use client'

import { useState } from "react"
import { createUserWithEmailAndPassword, sendEmailVerification, signOut, GoogleAuthProvider, signInWithPopup } from "firebase/auth"
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
      console.log("REGISTER SUCCESS")
      const user = credential.user

      await setDoc(
        doc(db, "users", user.uid),
        {
          email: user.email,
          createdAt: serverTimestamp(),
        },
        { merge: true }
      )

      await sendEmailVerification(credential.user);
      console.log("EMAIL SENT")
      await signOut(auth);
      console.log("REDIRECTING")
      router.replace("/verify-email");
    } catch (e: any) {
      setError(e.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleRegister = async () => {
    setIsLoading(true)
    try {
      const provider = new GoogleAuthProvider()
      const result = await signInWithPopup(auth, provider)
      const user = result.user

      await setDoc(
        doc(db, "users", user.uid),
        {
          email: user.email,
          createdAt: serverTimestamp(),
        },
        { merge: true }
      )

      router.replace("/")
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

          <div className="my-4 flex items-center">
            <div className="flex-1 border-t border-gray-200" />
            <span className="mx-3 text-[13px] text-gray-400">または</span>
            <div className="flex-1 border-t border-gray-200" />
          </div>

          <div className="flex justify-center">
            <button
              type="button"
              aria-label="Googleで新規登録"
              className="flex items-center gap-2 h-11 px-4 rounded-full border border-gray-200 bg-white shadow-sm transition-transform active:scale-[0.99]"
              onClick={handleGoogleRegister}
              disabled={isLoading}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <g>
                  <path d="M19.6 10.23c0-.68-.06-1.36-.18-2.02H10v3.83h5.44c-.23 1.23-.93 2.27-1.98 2.96v2.46h3.2c1.87-1.73 2.94-4.28 2.94-7.23z" fill="#4285F4"/>
                  <path d="M10 20c2.7 0 4.97-.9 6.63-2.44l-3.2-2.46c-.89.6-2.03.96-3.43.96-2.63 0-4.86-1.77-5.66-4.15H1.01v2.6C2.67 17.98 6.08 20 10 20z" fill="#34A853"/>
                  <path d="M4.34 11.91A5.99 5.99 0 0 1 4 10c0-.66.11-1.3.3-1.91V5.49H1.01A9.99 9.99 0 0 0 0 10c0 1.65.4 3.21 1.01 4.51l3.33-2.6z" fill="#FBBC05"/>
                  <path d="M10 4.04c1.47 0 2.79.51 3.83 1.51l2.87-2.87C14.97 1.1 12.7 0 10 0 6.08 0 2.67 2.02 1.01 5.49l3.29 2.6C5.14 5.81 7.37 4.04 10 4.04z" fill="#EA4335"/>
                </g>
              </svg>
              <span className="text-[15px] font-semibold text-gray-900">
                Googleでサインイン
              </span>
            </button>
          </div>

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
