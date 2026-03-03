import { useEffect, useState } from "react"
import {
  collection,
  doc,
  getDocs,
  updateDoc,
  increment,
} from "firebase/firestore"
import { db } from "@/lib/firebase"

type PlayerManageModalProps = {
  tournamentId: string
  storeId: string | null
  onClose: () => void
}

export default function PlayerManageModal({ tournamentId, storeId, onClose }: PlayerManageModalProps) {
  const [players, setPlayers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!storeId || !tournamentId) return
    const fetchPlayers = async () => {
      setLoading(true)
      try {
        const ref = collection(db, "stores", storeId, "tournaments", tournamentId, "players")
        const snap = await getDocs(ref)
        const list: any[] = []
        snap.forEach(docSnap => {
          const data = docSnap.data()
          list.push({
            id: docSnap.id,
            name: data.name ?? docSnap.id,
            entryCount: data.entryCount ?? 0,
            reentryCount: data.reentryCount ?? 0,
            addonCount: data.addonCount ?? 0,
            bustCount: data.bustCount ?? 0,
          })
        })
        setPlayers(list)
        setError("")
      } catch (e) {
        setError("プレイヤー情報の取得に失敗しました")
      }
      setLoading(false)
    }
    fetchPlayers()
  }, [storeId, tournamentId])

  const handleBustChange = async (playerId: string, delta: number) => {
    if (!storeId || !tournamentId) return
    try {
      const playerRef = doc(db, "stores", storeId, "tournaments", tournamentId, "players", playerId)
      await updateDoc(playerRef, { bustCount: increment(delta) })
      setPlayers(players =>
        players.map(p =>
          p.id === playerId ? { ...p, bustCount: p.bustCount + delta } : p
        )
      )
    } catch {
      setError("bustCountの更新に失敗しました")
    }
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded-2xl px-7 py-8 max-w-sm w-[90vw] text-center shadow-2xl border border-gray-200 animate-fadeIn">
        <h2 className="text-lg font-bold text-gray-900 mb-5">プレイヤー管理</h2>
        {loading ? (
          <p className="text-gray-500">読み込み中...</p>
        ) : error ? (
          <p className="text-red-500">{error}</p>
        ) : (
          <div className="space-y-3">
            {players.length === 0 ? (
              <p className="text-gray-500">プレイヤーがいません</p>
            ) : (
              players.map(player => (
                <div key={player.id} className="flex items-center justify-between border-b py-2">
                  <div className="text-left">
                    <div className="font-semibold text-gray-900">{player.name}</div>
                    <div className="text-xs text-gray-500">Entry: {player.entryCount} / Reentry: {player.reentryCount} / Addon: {player.addonCount}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className="px-2 py-1 rounded bg-gray-200 text-gray-700"
                      onClick={() => handleBustChange(player.id, -1)}
                      disabled={player.bustCount <= 0}
                    >−</button>
                    <span className="w-8 text-center font-bold text-gray-900">{player.bustCount}</span>
                    <button
                      className="px-2 py-1 rounded bg-gray-200 text-gray-700"
                      onClick={() => handleBustChange(player.id, 1)}
                    >＋</button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
        <button
          className="mt-6 w-full rounded-xl bg-blue-500 hover:bg-blue-600 text-white py-2.5 font-semibold text-base transition"
          onClick={onClose}
        >閉じる</button>
      </div>
    </div>
  )
}