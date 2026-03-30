"use client"

import { useRouter } from "next/navigation"
import { FiClock, FiHome, FiUser } from "react-icons/fi"
import HomeHeader from "@/components/HomeHeader"

export default function StoreTimerPage() {
  const router = useRouter()

  return (
    <main className="min-h-screen bg-white px-5 pb-24">
      <HomeHeader homePath="/home/store" myPagePath="/home/store/mypage" variant="store" />
      <div className="mx-auto max-w-sm">
        <div className="pt-[72px] text-center">
          <h1 className="text-[22px] font-semibold text-gray-900">タイマー</h1>
          <p className="mt-2 text-[13px] text-gray-500">準備中です</p>
        </div>

        <button
          type="button"
          onClick={() => router.back()}
          className="mt-6 h-[48px] w-full rounded-[20px] border border-gray-200 text-[14px] font-semibold text-gray-700"
        >
          戻る
        </button>
      </div>
      <nav className="fixed bottom-0 left-0 right-0 z-[80] border-t border-gray-200 bg-white">
        <div className="relative mx-auto flex max-w-sm items-center justify-between px-8 py-3">
          <button
            type="button"
            onClick={() => router.push("/home/store")}
            className="flex flex-col items-center text-gray-400"
          >
            <FiHome className="text-[18px]" />
            <span className="mt-1 text-[11px]">ホーム</span>
          </button>
          <button
            type="button"
            onClick={() => router.push("/home/store/timer")}
            className="absolute left-1/2 top-0 flex h-[74px] w-[74px] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full bg-[#F2A900] text-gray-900 shadow-lg"
            aria-label="タイマー"
          >
            <FiClock className="text-[22px]" />
            <span className="mt-1 text-[10px] font-semibold">タイマー</span>
          </button>
          <button
            type="button"
            onClick={() => router.push("/home/store/mypage")}
            className="flex flex-col items-center text-gray-400"
          >
            <FiUser className="text-[18px]" />
            <span className="mt-1 text-[11px]">マイページ</span>
          </button>
        </div>
      </nav>
    </main>
  )
}
