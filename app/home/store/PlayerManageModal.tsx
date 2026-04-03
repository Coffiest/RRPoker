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
  setDoc,
  deleteDoc
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
  const [newTempName, setNewTempName] = useState("")

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


if (!storeId || !tournamentId) return


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

      // 仮プレイヤー追加
      const entriesSnap = await getDocs(
        collection(db, "stores", storeId, "tournaments", tournamentId, "entries")
      )

      entriesSnap.forEach(d => {
        if (d.id.startsWith("temp_")) {
          const data = d.data()
          list.push({
            id: d.id,
            name: data.name,
            isTemp: true,
            entryCount: data.entryCount ?? 0,
            reentryCount: data.reentryCount ?? 0,
            addonCount: data.addonCount ?? 0,
          })
        }
      })

      setPlayers(list)
      setError("")
    } catch {
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

const addTempPlayer = async () => {
  if (!storeId || !tournamentId) return
  if (!newTempName.trim()) return

  const id = "temp_" + Date.now()

  const entryRef = doc(
    db,
    "stores",
    storeId,
    "tournaments",
    tournamentId,
    "entries",
    id
  )

  await setDoc(
    entryRef,
    {
      name: newTempName,
      isTemp: true,
      entryCount: 0,
      reentryCount: 0,
      addonCount: 0,
    },
    { merge: true }
  )

  // 🔴これ追加（即UI反映）
  setPlayers(prev => [
    ...prev,
    {
      id,
      name: newTempName,
      isTemp: true,
      entryCount: 0,
      reentryCount: 0,
      addonCount: 0,
    }
  ])

  setNewTempName("")
}

const deleteTempPlayer = async (playerId: string) => {
  if (!storeId || !tournamentId) return

  const entryRef = doc(
    db,
    "stores",
    storeId,
    "tournaments",
    tournamentId,
    "entries",
    playerId
  )

  // ① 0にリセット
  await setDoc(
    entryRef,
    {
      entryCount: 0,
      reentryCount: 0,
      addonCount: 0,
    },
    { merge: true }
  )

  // ② 削除
  await deleteDoc(entryRef)

  // ③ UI即反映
  setPlayers(prev => prev.filter(p => p.id !== playerId))
}

const updateTempPlayerName = async (playerId: string, newName: string) => {
  if (!storeId || !tournamentId) return

  await updateDoc(
    doc(
      db,
      "stores",
      storeId,
      "tournaments",
      tournamentId,
      "entries",
      playerId
    ),
    {
      name: newName
    }
  )
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

const allPlayers = players

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
              {allPlayers.length === 0 ? (
                <p className="text-gray-500 text-center">No Players</p>
              ) : (
                allPlayers.map(player => (
                  <div key={player.id} className="rounded-xl bg-gray-50 border border-gray-100 py-3 px-3">
           <div className="flex items-center justify-between mb-2">
  {player.isTemp ? (
    <input
      value={player.name}
      onChange={(e) =>
        updateTempPlayerName(player.id, e.target.value)
      }
      className="text-[14px] text-gray-900 border px-1 rounded w-full mr-2"
    />
  ) : (
    <div className="text-[14px] text-gray-500">
      {player.name}
    </div>
  )}

  {player.isTemp && (
    <button
      onClick={() => deleteTempPlayer(player.id)}
      className="text-[10px] px-1 py-[2px] text-red-500 border border-red-400 rounded"
    >
      削除
    </button>
  )}
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

<div className="mt-3">
    <input
      value={newTempName}
      onChange={(e)=>setNewTempName(e.target.value)}
      placeholder="仮プレイヤー名"
      className="w-full h-10 border rounded-lg px-2 text-sm"
    />
    <button
      onClick={addTempPlayer}
      className="w-full mt-2 h-10 rounded-xl bg-red-500 text-white text-sm"
    >
      ＋プレイヤーを追加
    </button>
  </div>

            </div>
          </>
        )}
      </div>
    </div>
  )
}