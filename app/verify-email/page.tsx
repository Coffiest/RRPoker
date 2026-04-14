"use client"

import { useEffect, useState } from "react"
import { auth } from "@/lib/firebase"
import { sendEmailVerification } from "firebase/auth"
import { useRouter } from "next/navigation"

export default function VerifyEmailPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [cooldown, setCooldown] = useState(0)
  const [message, setMessage] = useState("")

  useEffect(() => {
    const user = auth.currentUser
    if (user?.email) {
      setEmail(user.email)
    }
  }, [])

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setInterval(() => {
      setCooldown((prev) => prev - 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [cooldown])

  const handleResend = async () => {
    const user = auth.currentUser
    if (!user) {
      setMessage("再ログインしてください")
      return
    }

    try {
      await sendEmailVerification(user)
      setMessage("確認メールを再送しました")
      setCooldown(60)
    } catch {
      setMessage("再送に失敗しました。時間をおいて再度お試しください。")
    }
  }

  const handleCheck = async () => {
    const user = auth.currentUser
    if (!user) {
      setMessage("再ログインしてください")
      return
    }

    await user.reload()

    if (user.emailVerified) {
      router.replace("/login")
    } else {
      setMessage("まだ認証が完了していません")
    }
  }

  return (
    <main className="min-h-screen bg-white px-5">
      <div className="mx-auto max-w-sm flex flex-col items-center pt-[72px]">
        <h1 className="text-[22px] font-semibold text-gray-900 mb-4 text-center">
          確認メールを送信しました
        </h1>

        <p className="text-[14px] text-gray-600 text-center mb-4">
          {email} に確認メールを送信しました。
        </p>

        <p className="text-[13px] text-gray-500 text-center mb-6 leading-relaxed">
          メール内のリンクをクリックして認証を完了してください。<br />
          <br />
          メールが届かない場合は以下をご確認ください。<br />
          ・迷惑メールフォルダに入っていないか<br />
          ・メールアドレスが正しいか<br />
          ・しばらく待ってから再送する<br />
          <br />
          ※iCloudメールは届かない、または遅延する場合があります。<br />
          Gmail、または捨てメールサービスの使用を推奨します。
        </p>

        <button
          onClick={handleResend}
          disabled={cooldown > 0}
          className={`h-[48px] w-full rounded-[20px] text-[14px] mb-3 transition-all
            ${cooldown > 0 
              ? "bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed" 
              : "bg-white text-gray-900 border border-gray-300 hover:bg-gray-50 active:scale-[0.98]"}
            `}
        >
          {cooldown > 0 ? `再送まで ${cooldown}秒` : "確認メールを再送"}
        </button>

        <button
          onClick={handleCheck}
          className="h-[48px] w-full rounded-[20px] bg-[#F2A900] text-[14px] font-semibold text-gray-900 mb-3"
        >
          認証完了後はこちら
        </button>

        <button
          onClick={() => router.replace("/login")}
          className="text-[13px] text-gray-500"
        >
          ログイン画面へ戻る
        </button>

        {message && (
          <p className="mt-3 text-[13px] text-center text-gray-600">{message}</p>
        )}
      </div>
    </main>
  )
}