"use client"

import HomeHeader from "@/components/HomeHeader"
import { useRouter } from "next/navigation"
import { getCommonMenuItems } from "@/components/commonMenuItems"
import { FiCreditCard } from "react-icons/fi"
import { FiHome, FiUser } from "react-icons/fi"

export default function TicketsPage() {

  const router = useRouter()

  return (
    <main className="min-h-screen bg-[#FFFBF5] pb-32">

      <HomeHeader
        homePath="/home"
        myPagePath="/home/mypage"
        showNotifications
        menuItems={getCommonMenuItems(router, 'user')}
      />

      <div className="mx-auto max-w-sm px-4">

        {/* Header */}
        <div className="mt-6 animate-slideUp">
          <div className="flex items-center gap-3 mb-4">
            <FiCreditCard className="text-[20px] text-[#F2A900]" />
            <h1 className="text-[20px] font-semibold text-gray-900">
              クーポン
            </h1>
          </div>

          {/* Empty Card UI */}
          <div className="rounded-3xl bg-white p-6 shadow-sm border border-gray-100 text-center">
            <p className="text-[14px] text-gray-500">
              クーポンはまだありません
            </p>
          </div>
        </div>

      </div>

      {/* Bottom Navigation（/homeからコピー） */}
            <nav className="fixed bottom-0 left-0 right-0 w-full z-[80] glass-card border-t border-gray-200/60 shadow-lg">
            <div className="relative mx-auto flex max-w-sm items-center justify-between px-8 py-3">
                
                <button
                type="button"
                onClick={() => router.push("/home")}
                className="flex flex-col items-center text-gray-400 hover:text-[#F2A900] transition-all"
                >
                <FiHome size={22} />
                <span className="mt-1 text-[11px]">ホーム</span>
                </button>

                <button
                type="button"
                onClick={() => router.push("/home/transactions")}
                className="absolute left-1/2 top-0 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-[#F2A900] to-[#D4910A] text-white shadow-xl hover:shadow-2xl transition-all active:scale-95"
                >
                <FiCreditCard size={28} />
                </button>

                <button
                type="button"
                onClick={() => router.push("/home/mypage")}
                className="flex flex-col items-center text-gray-400 hover:text-[#F2A900] transition-all"
                >
                <FiUser size={22} />
                <span className="mt-1 text-[11px]">マイページ</span>
                </button>

            </div>
            </nav>

    </main>
  )
}