'use client'

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { db } from "@/lib/firebase"
import { collection, getDocs, query, where } from "firebase/firestore"
import HomeHeader from "@/components/HomeHeader"
import { getCommonMenuItems } from "@/components/commonMenuItems"

type Player = {
  id: string
  name?: string
  iconUrl?: string
}

export default function Page() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const storeIdParam = searchParams.get("storeId")
  const [players, setPlayers] = useState<Player[]>([])

  useEffect(() => {
    const fetchPlayers = async () => {
      const storeId = storeIdParam
      if (!storeId) return

      const snap = await getDocs(
        query(
          collection(db, "users"),
          where("currentStoreId", "==", storeId),
          where("role", "==", "player")
        )
      )
      const list: Player[] = []
      snap.forEach(docSnap => {
        const data = docSnap.data()
        if (data.showInStore !== false) list.push({ id: docSnap.id, name: data.name, iconUrl: data.iconUrl })
      })
      setPlayers(list)
    }

    fetchPlayers()
  }, [storeIdParam])

  if (!storeIdParam) {
    return (
      <main className="min-h-screen bg-white px-5">
        <HomeHeader
          homePath="/home"
          myPagePath="/home/mypage"
          menuItems={getCommonMenuItems(router, 'user')}
        />
        <div className="mx-auto max-w-sm pt-[72px] text-center">
          <p className="text-[14px] text-gray-500">店舗が選択されていません</p>
          <button
            type="button"
            onClick={() => router.back()}
            className="mt-6 h-[48px] w-full rounded-[20px] bg-[#F2A900] text-[14px] font-semibold text-gray-900"
          >
            戻る
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-white px-5">
      <HomeHeader
        homePath="/home"
        myPagePath="/home/mypage"
        menuItems={getCommonMenuItems(router, 'user')}
      />
      <div className="mx-auto max-w-sm">
        <div className="pt-[56px] text-center">
          <h1 className="text-[22px] font-semibold text-gray-900">入店中プレイヤー</h1>
        </div>

        <div className="mt-6 space-y-3">
          {players.length === 0 ? (
            <p className="text-center text-[13px] text-gray-500">入店中のプレイヤーがいません</p>
          ) : (
            players.map(player => (
              <div key={player.id} className="flex items-center gap-3 rounded-[20px] border border-gray-200 p-3">
                {player.iconUrl ? (
                  <img src={player.iconUrl} alt={player.name} className="h-10 w-10 rounded-full object-cover" />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-[12px] text-gray-500">
                    人
                  </div>
                )}
                <p className="text-[14px] font-semibold text-gray-900">{player.name ?? player.id}</p>
              </div>
            ))
          )}
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