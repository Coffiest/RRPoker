import { useEffect, useState } from "react"
import {
  collection,
  doc,
  getDocs,
  getDoc,
  updateDoc,
  increment,
  query,
  where,
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
  const [tournamentBust, setTournamentBust] = useState(0)

  useEffect(() => {
    if (!storeId || !tournamentId) return

    const fetchPlayers = async () => {
      setLoading(true)
      try {
        // ① トーナメントのbustCount取得
        const tournamentRef = doc(
          db,
          "stores",
          storeId,
          "tournaments",
          tournamentId
        )
        const tournamentSnap = await getDoc(tournamentRef)
        const tournamentData = tournamentSnap.exists() ? tournamentSnap.data() : {}
        setTournamentBust(tournamentData.bustCount ?? 0)

        // 入店中ユーザー取得
        const usersQuery = query(
          collection(db, "users"),
          where("currentStoreId", "==", storeId)
        )
        const usersSnap = await getDocs(usersQuery)

        const list: any[] = []

        // entries取得用参照
        const entriesRefBase = collection(
          db,
          "stores",
          storeId,
          "tournaments",
          tournamentId,
          "entries"
        )

        for (const userDoc of usersSnap.docs) {
          const userData = userDoc.data()

          const entryRef = doc(entriesRefBase, userDoc.id)
          const entrySnap = await getDoc(entryRef)
          const entryData = entrySnap.exists() ? entrySnap.data() : {}

          list.push({
            id: userDoc.id,
            name: userData.name ?? userDoc.id,
            entryCount: entryData.entryCount ?? 0,
            reentryCount: entryData.reentryCount ?? 0,
            addonCount: entryData.addonCount ?? 0,
          })
        }

        setPlayers(list)
        setError("")
      } catch (e) {
        setError("プレイヤー情報の取得に失敗しました")
      }
      setLoading(false)
    }

    fetchPlayers()
  }, [storeId, tournamentId])


  // トーナメント単位のBust更新
  const handleTournamentBustChange = async (delta: number) => {
    if (!storeId || !tournamentId) return
    try {
      const tournamentRef = doc(
        db,
        "stores",
        storeId,
        "tournaments",
        tournamentId
      )
      await updateDoc(tournamentRef, {
        bustCount: increment(delta)
      })
      setTournamentBust(prev => prev + delta)
    } catch (e) {
      setError("bust更新に失敗しました")
    }
  }

  // Entry/Reentry/Addon更新
  const handleEntryChange = async (
    playerId: string,
    field: "entryCount" | "reentryCount" | "addonCount",
    delta: number
  ) => {
    if (!storeId || !tournamentId) return

    try {
      const entryRef = doc(
        db,
        "stores",
        storeId,
        "tournaments",
        tournamentId,
        "entries",
        playerId
      )

      await updateDoc(entryRef, {
        [field]: increment(delta)
      })

      setPlayers(players =>
        players.map(p =>
          p.id === playerId
            ? { ...p, [field]: p[field] + delta }
            : p
        )
      )
    } catch {
      setError("更新に失敗しました")
    }
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-transparent px-5">
      <div className="w-full max-w-sm rounded-[24px] bg-white p-5 shadow-2xl border border-gray-200 animate-fadeIn">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[16px] font-semibold text-gray-900">プレイヤー管理</h2>
          <button type="button" onClick={onClose} className="text-gray-500 text-[22px] p-1 hover:bg-gray-100 rounded-full">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 6L14 14M14 6L6 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          </button>
        </div>
        {loading ? (
          <p className="text-gray-500 text-center">読み込み中...</p>
        ) : error ? (
          <p className="text-red-500 text-center">{error}</p>
        ) : (
          <>
            {/* Bustセクション */}
            <div className="mb-6 border-b pb-4">
              <div className="text-sm font-semibold text-gray-700 mb-2">トーナメント進行</div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600 text-sm">Bust</span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleTournamentBustChange(-1)}
                    disabled={tournamentBust <= 0}
                    className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200"
                  >−</button>
                  <span className="w-8 text-center font-bold text-lg">
                    {tournamentBust}
                  </span>
                  <button
                    onClick={() => handleTournamentBustChange(1)}
                    className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200"
                  >＋</button>
                </div>
              </div>
            </div>
            {/* プレイヤー表示 */}
            <div className="space-y-4">
              {players.length === 0 ? (
                <p className="text-gray-500 text-center">プレイヤーがいません</p>
              ) : (
                players.map(player => (
                  <div key={player.id} className="rounded-2xl bg-gray-50 p-4 space-y-3">
                    <div className="font-semibold text-gray-900">
                      {player.name}
                    </div>
                    {[
                      { label: "Entry", field: "entryCount" },
                      { label: "Reentry", field: "reentryCount" },
                      { label: "Addon", field: "addonCount" }
                    ].map(item => (
                      <div key={item.field} className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">{item.label}</span>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() =>
                              handleEntryChange(player.id, item.field as any, -1)
                            }
                            disabled={player[item.field] <= 0}
                            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200"
                          >−</button>
                          <span className="w-8 text-center font-medium">
                            {player[item.field]}
                          </span>
                          <button
                            onClick={() =>
                              handleEntryChange(player.id, item.field as any, 1)
                            }
                            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200"
                          >＋</button>
                        </div>
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>
          </>
        )}
        <button
          className="mt-6 w-full rounded-xl bg-blue-500 hover:bg-blue-600 text-white py-2.5 font-semibold text-base transition"
          onClick={onClose}
        >閉じる</button>
      </div>
    </div>
  )
}