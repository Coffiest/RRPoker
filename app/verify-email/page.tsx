"use client"

import { useRouter } from "next/navigation"

export default function VerifyEmailPage() {
  const router = useRouter()
  return (
    <main className="min-h-screen bg-white px-5">
      <div className="mx-auto max-w-sm flex flex-col items-center justify-center pt-[72px]">
        <h1 className="text-[24px] font-semibold text-gray-900 mb-4">確認メールを送信しました</h1>
        <p className="text-[15px] text-gray-600 mb-8">メールをご確認ください</p>
        <button
          type="button"
          onClick={() => router.replace("/login")}
          className="h-[48px] w-full rounded-[20px] bg-[#F2A900] text-[15px] font-semibold text-gray-900 shadow-sm transition-transform active:scale-[0.99]"
        >
          ログインへ
        </button>
      </div>
    </main>
  )
}
