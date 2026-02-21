'use client'

import { useState } from "react"
import { signInWithEmailAndPassword } from "firebase/auth"
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore"
import { auth, db } from "@/lib/firebase"
import { useRouter } from "next/navigation"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")

  const login = async () => {
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password)
      const user = credential.user

      const userRef = doc(db, "users", user.uid)
      const snap = await getDoc(userRef)

      if (!snap.exists()) {
        await setDoc(
          userRef,
          {
            email: user.email,
            createdAt: serverTimestamp(),
          },
          { merge: true }
        )
        router.replace("/onboarding")
        return
      }

      const data = snap.data()
      if (!data?.role) {
        router.replace("/onboarding")
        return
      }

      const role = data.role === "user" ? "player" : data.role

      if (role === "player") {
        router.replace("/home")
        return
      }

      if (role === "store") {
        if (!data.name || !data.storeId || !data.postalCode || !data.addressLine || !data.addressDetail) {
          router.replace("/onboarding/store")
          return
        }
        router.replace("/home/store")
        return
      }

      router.replace("/onboarding")
    } catch (e: any) {
      setError(e.message)
    }
  }

  return (
    <main className="min-h-screen bg-white px-5">
      <div className="mx-auto max-w-sm">
        {/* Header */}
        <div className="pt-[72px] text-center">
          <h1 className="text-[28px] font-semibold leading-tight text-gray-900">
            RRPoker
          </h1>
          <p className="mt-2 text-[14px] text-gray-500">サインイン</p>
        </div>

        {/* Form Card */}
        <div className="mt-7 rounded-[24px] border border-gray-200 p-4">
          <label className="text-[12px] text-gray-500">メールアドレス</label>
          <input
            type="email"
            placeholder="name@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="mt-2 h-12 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 text-[16px] text-gray-950 outline-none placeholder:text-gray-400 focus:border-gray-300"
          />

          <div className="mt-3" />
          <label className="text-[12px] text-gray-500">パスワード</label>
          <input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="mt-2 h-12 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 text-[16px] text-gray-950 outline-none placeholder:text-gray-400 focus:border-gray-300"
          />

          <button
            type="button"
            onClick={login}
            className="mt-4 h-[52px] w-full rounded-[24px] bg-[#F2A900] text-[16px] font-semibold text-gray-900 shadow-sm transition-transform active:scale-[0.99]"
          >
            ログイン
          </button>

          {/* Google small round button */}
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              aria-label="Googleでログイン"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-gray-200 bg-white shadow-sm transition-transform active:scale-[0.99]"
            >
              <span className="text-[16px] font-semibold text-gray-900">G</span>
            </button>
          </div>

          {error && <p className="mt-3 text-center text-[13px] text-red-500">{error}</p>}
        </div>

        {/* Bottom links */}
        <div className="mt-6 flex items-center justify-between pb-7 text-[13px] text-gray-500">
          <button 
            type="button" 
            onClick={() => router.push('/register')}
            className="hover:text-gray-700 transition-colors"
          >
            新規作成
          </button>
          <button 
            type="button" 
            onClick={() => router.push('/forgot-password')}
            className="hover:text-gray-700 transition-colors"
          >
            パスワードを忘れた方はこちら
          </button>
        </div>
      </div>
    </main>
  )
}