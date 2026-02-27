'use client'

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { applyActionCode } from "firebase/auth"
import { auth } from "@/lib/firebase"

export default function VerifyCompletePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading")

  useEffect(() => {
    const mode = searchParams.get("mode")
    const oobCode = searchParams.get("oobCode")
    if (mode !== "verifyEmail" || !oobCode) {
      router.replace("/login")
      return
    }
    (async () => {
      try {
        await applyActionCode(auth, oobCode)
        setStatus("success")
      } catch {
        setStatus("error")
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleHome = () => {
    router.replace("/home")
  }
  const handleLogin = () => {
    router.replace("/login")
  }

  return (
    <main className="min-h-screen bg-white px-5">
      <div className="mx-auto max-w-sm flex flex-col items-center justify-center min-h-screen">
        {status === "loading" && (
          <div className="text-center">
            <div className="mb-4">
              <svg className="animate-spin mx-auto h-8 w-8 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
              </svg>
            </div>
            <p className="text-[15px] text-gray-900">認証処理中です...</p>
          </div>
        )}
        {status === "success" && (
          <div className="text-center">
            <h1 className="text-[22px] font-semibold text-gray-900 mb-2">メール認証が完了しました</h1>
            <button
              type="button"
              onClick={handleHome}
              className="mt-6 h-[44px] w-full rounded-[24px] bg-[#F2A900] text-[15px] font-semibold text-gray-900 shadow-sm transition-transform active:scale-[0.99]"
            >
              ホームへ
            </button>
          </div>
        )}
        {status === "error" && (
          <div className="text-center">
            <h1 className="text-[22px] font-semibold text-red-600 mb-2">認証リンクが無効です</h1>
            <button
              type="button"
              onClick={handleLogin}
              className="mt-6 h-[44px] w-full rounded-[24px] bg-gray-300 text-[15px] font-semibold text-gray-900 shadow-sm transition-transform active:scale-[0.99]"
            >
              ログインへ
            </button>
          </div>
        )}
      </div>
    </main>
  )
}
