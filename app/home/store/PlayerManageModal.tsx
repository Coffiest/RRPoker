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
  onSnapshot,
  setDoc // 追加
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
  const [bustUpdating, setBustUpdating] = useState(false)

  useEffect(() => {
    if (!storeId || !tournamentId) {
      setLoading(false)
      return
    }
    setLoading(true)
    const tournamentRef = doc(
      db,
      "stores",
      storeId,
      "tournaments",
      tournamentId
    )
    const unsubTournament = onSnapshot(tournamentRef, snap => {
      if (snap.exists()) {
        setTournamentBust(snap.data().bustCount ?? 0)
      }
    })
    const unsub = onSnapshot(
      query(collection(db, "users"), where("currentStoreId", "==", storeId)),
      async (usersSnap) => {
        try {
          const list: any[] = []
          for (const userDoc of usersSnap.docs) {
            const userData = userDoc.data()
            const entryRef = doc(
              db,
              "stores",
              storeId,
              "tournaments",
              tournamentId,
              "entries",
              userDoc.id
            )
            const entrySnap = await getDoc(entryRef)
            const entryData = entrySnap.exists() ? entrySnap.data() : {}
            list.push({
              id: userDoc.id,
              name: userData.name,
              iconUrl: userData.iconUrl,
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
    )
    return () => {
      unsub()
      unsubTournament()
    }
  }, [storeId, tournamentId])


  // トーナメント単位のBust更新
  const handleTournamentBustChange = async (delta: number) => {
    if (!storeId || !tournamentId) return
    if (bustUpdating) return
    if (delta < 0 && tournamentBust <= 0) return

    setBustUpdating(true)
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
      // bust値は onSnapshot(tournamentRef) からのみ反映させる（ここで setTournamentBust は絶対にしない）
      setError("")
    } catch (e) {
      setError("bust更新に失敗しました")
    } finally {
      setBustUpdating(false)
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

      await setDoc(
        entryRef,
        {
          [field]: increment(delta)
        },
        { merge: true }
      )

      // entries再集計
      const entriesRef = collection(
        db,
        "stores",
        storeId,
        "tournaments",
        tournamentId,
        "entries"
      )
      const entriesSnap = await getDocs(entriesRef)
      let totalEntry = 0
      let totalReentry = 0
      let totalAddon = 0
      entriesSnap.forEach(d => {
        const data = d.data()
        totalEntry += data.entryCount ?? 0
        totalReentry += data.reentryCount ?? 0
        totalAddon += data.addonCount ?? 0
      })
      await updateDoc(
        doc(db, "stores", storeId, "tournaments", tournamentId),
        {
          totalEntry,
          totalReentry,
          totalAddon
        }
      )

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
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/20 backdrop-blur-[1px] px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-[0_20px_60px_rgba(0,0,0,0.15)] border border-gray-100 animate-fadeIn">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[16px] font-semibold text-gray-900">Players:</h2>
          <button type="button" onClick={onClose} className="text-gray-500 text-[22px] p-1 hover:bg-gray-100 rounded-full">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 6L14 14M14 6L6 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          </button>
        </div>
        {loading ? (
          <p className="text-gray-500 text-center">Loading...</p>
        ) : error ? (
          <p className="text-red-500 text-center">{error}</p>
        ) : (
          <>
            {/* Bustセクション内 */}
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-800 tracking-wide">BUST : </span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleTournamentBustChange(-1)}
                  disabled={tournamentBust <= 0 || bustUpdating}
                  className="w-7 h-7 rounded-full bg-orange-300 text-orange-600 hover:bg-orange-600 transition"
                >ー</button>
                <span className="text-xl font-bold text-gray-900 w-8 text-center">
                  {tournamentBust}
                </span>
                <button
                  onClick={() => handleTournamentBustChange(1)}
                  disabled={bustUpdating}
                  className="w-7 h-7 rounded-full bg-orange-300 text-orange-600 hover:bg-orange-600 transition"
                >＋</button>
              </div>
            </div>
            {/* プレイヤー表示（コンパクト・横並び・スクロール対応） */}
            <div className="max-h-[50vh] overflow-y-auto space-y-3">
              {players.length === 0 ? (
                <p className="text-gray-500 text-center">No Players</p>
              ) : (
                players.map(player => (
                  <div key={player.id} className="rounded-xl bg-gray-50 border border-gray-100 py-3 px-3">
                    <div className="font-medium text-[14px] text-gray-900 mb-2">
                      {player.name}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {[{ label: "Entry", field: "entryCount" }, { label: "Reentry", field: "reentryCount" }, { label: "Addon", field: "addonCount" }].map(item => (
                        <div key={item.field} className="flex flex-col items-center gap-1">
                          <span className="text-[11px] text-gray-800">{item.label}</span>
                          <div className="flex items-center text-gray-800 gap-2">
                            <button
                              onClick={() => handleEntryChange(player.id, item.field as any, -1)}
                              disabled={player[item.field] <= 0}
                              className="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 text-orange-600 bg-orange-100  text-sm"
                            >ー</button>
                            <span className="w-6 text-center font-medium">
                              {player[item.field]}
                            </span>
                            <button
                              onClick={() => handleEntryChange(player.id, item.field as any, 1)}
                              className="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 text-orange-600 bg-orange-100  text-sm"
                            >＋</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}