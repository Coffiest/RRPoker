"use client"

import { useRouter } from "next/navigation"
import BackButton from "@/components/BackButton"
import HomeHeader from "@/components/HomeHeader"

export default function AccountLinkPage() {
  const router = useRouter()

  return (
    <main className="min-h-screen px-5">
      <HomeHeader homePath="/home" myPagePath="/home/mypage" />
      <div className="pc-form mx-auto max-w-sm">
        <div className="pt-[72px] text-center">
          <h1 className="text-[22px] font-semibold text-gray-900">アカウント連携</h1>
        </div>

        <div className="mt-6 rounded-[24px] border border-gray-200 p-4 text-center">
          <p className="text-[14px] text-gray-600">実装までしばらくお待ちください</p>
        </div>

        <div className="flex justify-center mt-6"><BackButton /></div>
      </div>
    </main>
  )
}
