"use client"

import { useRouter } from "next/navigation"
import HomeHeader from "@/components/HomeHeader"

export default function AccountLinkPage() {
  const router = useRouter()

  return (
    <main className="min-h-screen bg-white px-5">
      <HomeHeader homePath="/home" myPagePath="/home/mypage" />
      <div className="mx-auto max-w-sm">
        <div className="pt-[72px] text-center">
          <h1 className="text-[22px] font-semibold text-gray-900">アカウント連携</h1>
        </div>

        <div className="mt-6 rounded-[24px] border border-gray-200 p-4 text-center">
          <p className="text-[14px] text-gray-600">実装までしばらくお待ちください</p>
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
