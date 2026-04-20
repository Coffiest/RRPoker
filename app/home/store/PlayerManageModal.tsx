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
  const [newTempName, setNewTempName] = useState("")
  const [localPlayers, setLocalPlayers] = useState<any[]>([])
  const [localBust, setLocalBust] = useState(0)

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
        const bust = snap.data().bustCount ?? 0
        setTournamentBust(bust)
        setLocalBust(bust)
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
      setLocalPlayers(list)
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


  const handleSave = async () => {
  if (!storeId || !tournamentId) return

  const tournamentRef = doc(db, "stores", storeId, "tournaments", tournamentId)

  let totalEntry = 0
  let totalReentry = 0
  let totalAddon = 0

  for (const p of localPlayers) {
    const entryRef = doc(
      db,
      "stores",
      storeId,
      "tournaments",
      tournamentId,
      "entries",
      p.id
    )

    await setDoc(entryRef, {
      name: p.name,
      isTemp: p.isTemp ?? false,
      entryCount: p.entryCount ?? 0,
      reentryCount: p.reentryCount ?? 0,
      addonCount: p.addonCount ?? 0,
    })

    totalEntry += p.entryCount ?? 0
    totalReentry += p.reentryCount ?? 0
    totalAddon += p.addonCount ?? 0
  }

  await updateDoc(tournamentRef, {
    totalEntry,
    totalReentry,
    totalAddon,
    bustCount: localBust
  })

  onClose()
}


const handleTournamentBustChange = (delta: number) => {
  if (delta < 0 && localBust <= 0) return
  setLocalBust(prev => prev + delta)
}

const addTempPlayer = () => {
  if (!newTempName.trim()) return

  const id = "temp_" + Date.now()

  setLocalPlayers(prev => [
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


const deleteTempPlayer = (playerId: string) => {
  setLocalPlayers(prev => prev.filter(p => p.id !== playerId))
}



const updateTempPlayerName = (playerId: string, newName: string) => {
  setLocalPlayers(prev =>
    prev.map(p =>
      p.id === playerId ? { ...p, name: newName } : p
    )
  )
}




const handleEntryChange = (
  playerId: string,
  field: "entryCount" | "reentryCount" | "addonCount",
  delta: number
) => {
  setLocalPlayers(prev =>
    prev.map(p =>
      p.id === playerId
        ? { ...p, [field]: Math.max(0, (p[field] ?? 0) + delta) }
        : p
    )
  )
}

const allPlayers = localPlayers

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/20 backdrop-blur-[1px] px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-[0_20px_60px_rgba(0,0,0,0.15)] border border-gray-100 animate-fadeIn">
     
     
<div className="mb-4">
  {/* 上段：× と ✓ */}
  <div className="flex items-center justify-between mb-2">
    <button
      onClick={onClose}
      className="text-gray-900 text-xl font-bold px-2 py-1 hover:bg-gray-100 rounded"
    >
      ×
    </button>

    <div />

    <button
      onClick={handleSave}
      className="text-green-600 text-xl font-bold px-2 py-1 hover:bg-green-50 rounded"
    >
      ✓
    </button>
  </div>

  {/* 下段：プレビューカード */}
  <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 shadow-sm flex items-center justify-between">
    
    {/* Players */}
    <div className="flex flex-col items-center">
      <span className="text-[11px] text-gray-500">Players</span>
      <span className="text-lg font-semibold text-gray-900">
        {(() => {
          const total = localPlayers.reduce(
            (sum, p) => sum + (p.entryCount ?? 0) + (p.reentryCount ?? 0),
            0
          )
          const alive = total - localBust
          return `${alive}/${total}`
        })()}
      </span>
    </div>

    {/* 区切り */}
    <div className="h-6 w-px bg-gray-200" />

    {/* Addon */}
    <div className="flex flex-col items-center">
      <span className="text-[11px] text-gray-500">Add-on</span>
      <span className="text-lg font-semibold text-gray-900">
        {localPlayers.reduce((sum, p) => sum + (p.addonCount ?? 0), 0)}
      </span>
    </div>

  </div>
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
                  disabled={localBust <= 0}
                  className="w-7 h-7 rounded-full bg-orange-300 text-orange-600 hover:bg-orange-600 transition"
                >ー</button>
                <span className="text-xl font-bold text-gray-900 w-8 text-center">
                  {localBust}
                </span>
                <button
                  onClick={() => handleTournamentBustChange(1)}
                  disabled={false}
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

                  
<div
  key={player.id}
  className="rounded-2xl bg-white border border-gray-200 px-4 py-3 shadow-sm"
>
  {/* 上段：名前＋削除 */}
  <div className="flex items-center justify-between gap-2 mb-3">
    {player.isTemp ? (
      <input
        value={player.name}
        onChange={(e) =>
          updateTempPlayerName(player.id, e.target.value)
        }

   className="text-base text-gray-900 font-semibold border-b border-gray-400 focus:outline-none w-full mr-2 bg-white"
style={{ opacity: 1 }}
   
   />
        
    ) : (
      <div className="text-sm text-gray-900 font-semibold">
        {player.name}
      </div>
    )}

{player.isTemp && (
  <button
    onClick={() => deleteTempPlayer(player.id)}
    className="text-gray-400 hover:text-red-500 text-lg px-1"
  >
    ×
  </button>
)}


  </div>

  {/* 下段：数値 */}
  <div className="flex items-center justify-between text-center">
    {[
      { label: "Entry", field: "entryCount" },
      { label: "Reentry", field: "reentryCount" },
      { label: "Addon", field: "addonCount" },
    ].map(item => (
      <div key={item.field} className="flex flex-col items-center flex-1">
        
        <span className="text-[10px] text-gray-500 mb-1">
          {item.label}
        </span>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleEntryChange(player.id, item.field as any, -1)}
            disabled={player[item.field] <= 0}
            className="w-6 h-6 rounded-full bg-gray-100 text-gray-700 text-sm"
          >
            −
          </button>

          <span className="text-base font-semibold text-gray-900 w-6 text-center">
            {player[item.field]}
          </span>

          <button
            onClick={() => handleEntryChange(player.id, item.field as any, 1)}
            className="w-6 h-6 rounded-full bg-orange-100 text-orange-600 text-sm"
          >
            ＋
          </button>
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
      className="w-full h-10 border border-gray-300 rounded-lg px-3 text-sm text-gray-500 placeholder:text-gray-400"
    />
    <button
      onClick={addTempPlayer}
      className="w-full mt-2 h-10 rounded-xl bg-[#F5A900] text-white text-sm"
    >
      ＋ Add Players
    </button>
  </div>

            </div>
          </>
        )}
      </div>
    </div>
  )
}