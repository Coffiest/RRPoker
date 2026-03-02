'use client'

import { useState } from "react"
import { signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword, sendEmailVerification, reauthenticateWithPopup } from "firebase/auth"
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore"
import { auth, db } from "@/lib/firebase"
import { useRouter } from "next/navigation"
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth"
import { useSearchParams } from "next/navigation"
import { getAuthErrorMessage } from "src/lib/auth-error"

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get("redirect")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")

  const handleLogin = async () => {
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password)
      const user = credential.user

      // recent login redirect
      if (redirect === "delete") {
        router.replace("/home/mypage?delete=1")
        return
      }

      // 未認証ユーザーは verify-email へ
      if (!user.emailVerified) {
        await sendEmailVerification(user)
        router.replace("/verify-email")
        return
      }

      // ===== ここから追加ロジック（role 判定） =====
      const userDocRef = doc(db, "users", user.uid)
      const userDocSnap = await getDoc(userDocRef)

      if (!userDocSnap.exists()) {
        router.replace("/onboarding")
        return
      }

      const role = userDocSnap.data()?.role

      if (role === "player") {
        router.replace("/home")
        return
      }

      if (role === "store") {
        router.replace("/home/store")
        return
      }

      router.replace("/onboarding")
      return
      // ===== 追加ロジックここまで =====

    } catch (e: any) {
      setError("メールまたはパスワードが違います")
      return
    }
  }

  const handleGoogleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider()
      const result = await signInWithPopup(auth, provider)
      const user = result.user

      // recent login redirect
      if (redirect === "delete") {
        router.replace("/home/mypage?delete=1")
        return
      }

      const userDocRef = doc(db, "users", user.uid)
      const userDocSnap = await getDoc(userDocRef)

      // Firestore未登録 → 自動作成してonboardingへ
      if (!userDocSnap.exists()) {
        await setDoc(
          doc(db, "users", user.uid),
          {
            email: user.email,
            createdAt: serverTimestamp(),
            provider: "google"
          },
          { merge: true }
        )
        router.replace("/onboarding")
        return
      }

      const role = userDocSnap.data()?.role

      if (role === "player") {
        router.replace("/home")
        return
      }

      if (role === "store") {
        router.replace("/home/store")
        return
      }

      router.replace("/onboarding")
    } catch (e: any) {
      console.log("GOOGLE LOGIN ERROR:", e)
      setError(e.message || "Googleログインに失敗しました")
    }
  }

  const deleteAccount = async () => {
    try {
      const user = auth.currentUser
      if (!user) throw new Error("ユーザーが見つかりません")
      const providerId = user.providerData[0]?.providerId
      if (providerId === "google.com") {
        const provider = new GoogleAuthProvider()
        await reauthenticateWithPopup(user, provider)
      } else if (providerId === "password") {
        router.replace("/login?reauth=true")
        return
      } else {
        throw new Error("未対応の認証プロバイダです")
      }
      await user.delete()
      // ...既存の削除後処理...
    } catch (e: any) {
      setError(e.message || "アカウント削除に失敗しました")
    }
  }

  return (
    <main className="min-h-screen bg-white px-5">
      <div className="mx-auto max-w-sm">
        <div className="pt-[72px] text-center">
          <h1 className="text-[28px] font-semibold leading-tight text-gray-900">
            RRPoker
          </h1>
          <p className="mt-2 text-[14px] text-gray-500">Let's login.</p>
     
        </div>

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
              onClick={handleLogin}
              className="mt-4 h-[52px] w-full rounded-[24px] bg-[#F2A900] text-[16px] font-semibold text-gray-900 shadow-sm transition-transform active:scale-[0.99]"
            >
              Log in
            </button>

            <div className="mt-4 text-center text-sm text-gray-500">
              アカウントをお持ちでない方は
              <button
                type="button"
                onClick={() => router.push('/register')}
                className="ml-1 text-[#F2A900] font-normal"
              >
                新規登録
              </button>
            </div>

            <div className="my-4 flex items-center">
              <div className="flex-1 border-t border-gray-200" />
              <span className="mx-3 text-[13px] text-gray-400">または</span>
              <div className="flex-1 border-t border-gray-200" />
            </div>

            <div className="flex justify-center">
              <button
                type="button"
                aria-label="Googleでログイン"
                className="flex items-center gap-2 h-11 px-4 rounded-full border border-gray-200 bg-white shadow-sm transition-transform active:scale-[0.99]"
                onClick={handleGoogleLogin}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <g>
                    <path d="M19.6 10.23c0-.68-.06-1.36-.18-2.02H10v3.83h5.44c-.23 1.23-.93 2.27-1.98 2.96v2.46h3.2c1.87-1.73 2.94-4.28 2.94-7.23z" fill="#4285F4"/>
                    <path d="M10 20c2.7 0 4.97-.9 6.63-2.44l-3.2-2.46c-.89.6-2.03.96-3.43.96-2.63 0-4.86-1.77-5.66-4.15H1.01v2.6C2.67 17.98 6.08 20 10 20z" fill="#34A853"/>
                    <path d="M4.34 11.91A5.99 5.99 0 0 1 4 10c0-.66.11-1.3.3-1.91V5.49H1.01A9.99 9.99 0 0 0 0 10c0 1.65.4 3.21 1.01 4.51l3.33-2.6z" fill="#FBBC05"/>
                    <path d="M10 4.04c1.47 0 2.79.51 3.83 1.51l2.87-2.87C14.97 1.1 12.7 0 10 0 6.08 0 2.67 2.02 1.01 5.49l3.29 2.6C5.14 5.81 7.37 4.04 10 4.04z" fill="#EA4335"/>
                  </g>
                </svg>
                <span className="text-[15px] font-semibold text-gray-900">Googleでサインイン</span>
              </button>
            </div>

            {error && <p className="mt-3 text-center text-[13px] text-red-500">{error}</p>}
          </div>

          <div className="mt-6 flex items-center justify-center pb-7 text-[13px] text-gray-500">
            <button 
              type="button" 
              onClick={() => router.push('/forgot-password')}
              className="hover:text-gray-700 transition-colors"
            >
              パスワードを忘れた方はこちら
            </button>
          </div>
      </div>


  <div className="pt-[50px] text-center">
    
               <p className="mt-2 text-[10px] text-gray-500">ver 1.0.1</p>
                <p className="mt-2 text-[10px] text-gray-500">RRPoker by "Runner Runner"</p>
                <p className="mt-2 text-[10px] text-gray-500">製作者 : なおゆき</p>
        </div>

     

    </main>
  )
}