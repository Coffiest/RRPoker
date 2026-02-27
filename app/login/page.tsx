'use client'

import { useState } from "react"
import { signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword, sendEmailVerification } from "firebase/auth"
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore"
import { auth, db } from "@/lib/firebase"
import { useRouter } from "next/navigation"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")

  const handleLogin = async () => {
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const user = credential.user;

      if (!user.emailVerified) {
        await sendEmailVerification(user);
        router.replace("/verify-email");
        return;
      }

      router.replace("/home");
    } catch (e: any) {
      console.log("LOGIN ERROR CODE:", e.code);
      console.log("LOGIN ERROR MESSAGE:", e.message);
      if (e.code === "auth/user-not-found") {
        try {
          const credential = await createUserWithEmailAndPassword(auth, email, password);

          await setDoc(
            doc(db, "users", credential.user.uid),
            {
              email: credential.user.email,
              createdAt: serverTimestamp(),
            },
            { merge: true }
          );

          console.log("sending verification...");
          await sendEmailVerification(credential.user);
          console.log("verification sent");
          await signOut(auth);
          router.replace("/verify-email");
          return;
        } catch (e2: any) {
          console.log(e2);
          setError(e2.message);
        }
      } else {
        setError(e.message);
      }
    }
  };

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
            onClick={handleLogin}
            className="mt-4 h-[52px] w-full rounded-[24px] bg-[#F2A900] text-[16px] font-semibold text-gray-900 shadow-sm transition-transform active:scale-[0.99]"
          >
            ログイン / 新規登録
          </button>

          {/* Divider */}
          <div className="my-4 flex items-center">
            <div className="flex-1 border-t border-gray-200" />
            <span className="mx-3 text-[13px] text-gray-400">または</span>
            <div className="flex-1 border-t border-gray-200" />
          </div>

          {/* Google sign-in button with icon and text */}
          <div className="flex justify-center">
            <button
              type="button"
              aria-label="Googleでログイン"
              className="flex items-center gap-2 h-11 px-4 rounded-full border border-gray-200 bg-white shadow-sm transition-transform active:scale-[0.99]"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <g clipPath="url(#clip0_17_40)">
                  <path d="M19.6 10.23c0-.68-.06-1.36-.18-2.02H10v3.83h5.44c-.23 1.23-.93 2.27-1.98 2.96v2.46h3.2c1.87-1.73 2.94-4.28 2.94-7.23z" fill="#4285F4"/>
                  <path d="M10 20c2.7 0 4.97-.9 6.63-2.44l-3.2-2.46c-.89.6-2.03.96-3.43.96-2.63 0-4.86-1.77-5.66-4.15H1.01v2.6C2.67 17.98 6.08 20 10 20z" fill="#34A853"/>
                  <path d="M4.34 11.91A5.99 5.99 0 0 1 4 10c0-.66.11-1.3.3-1.91V5.49H1.01A9.99 9.99 0 0 0 0 10c0 1.65.4 3.21 1.01 4.51l3.33-2.6z" fill="#FBBC05"/>
                  <path d="M10 4.04c1.47 0 2.79.51 3.83 1.51l2.87-2.87C14.97 1.1 12.7 0 10 0 6.08 0 2.67 2.02 1.01 5.49l3.29 2.6C5.14 5.81 7.37 4.04 10 4.04z" fill="#EA4335"/>
                </g>
                <defs>
                  <clipPath id="clip0_17_40">
                    <rect width="20" height="20" fill="white"/>
                  </clipPath>
                </defs>
              </svg>
              <span className="text-[15px] font-semibold text-gray-900">Googleでサインイン</span>
            </button>
          </div>

          {error && <p className="mt-3 text-center text-[13px] text-red-500">{error}</p>}
        </div>

        {/* Bottom links */}
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
    </main>
  )
}