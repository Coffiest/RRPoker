'use client'

import { useEffect, useState } from "react"
import PlayerAvatar from "@/components/PlayerAvatar"
import BackButton from "@/components/BackButton"
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
      <main className="min-h-screen px-6">
        <HomeHeader
          homePath="/home"
          myPagePath="/home/mypage"
          menuItems={getCommonMenuItems(router, 'user')}
        />
        <div className="mx-auto max-w-sm pt-[72px] text-center">
          <p className="text-[14px] text-label2">店舗が選択されていません</p>
          <div className="flex justify-center mt-6"><BackButton /></div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen px-6">
      <HomeHeader
        homePath="/home"
        myPagePath="/home/mypage"
        menuItems={getCommonMenuItems(router, 'user')}
      />
      <div className="pc-page mx-auto max-w-sm">
        <div className="pt-[56px] text-center">
          <h1 className="text-[22px] font-semibold text-label">入店中プレイヤー</h1>
        </div>

        <div className="mt-6 space-y-4">
          {players.length === 0 ? (
            <p className="text-center text-[13px] text-label2">入店中のプレイヤーがいません</p>
          ) : (
            players.map(player => (
              <div key={player.id} className="flex items-center gap-4 rounded-[20px] border border-gray-200 p-4">
                <PlayerAvatar src={player.iconUrl} size={40} alt={player.name} />
                <p className="text-[14px] font-semibold text-label">{player.name ?? player.id}</p>
              </div>
            ))
          )}
        </div>

        <div className="flex justify-center mt-6"><BackButton /></div>
      </div>
    </main>
  )
}