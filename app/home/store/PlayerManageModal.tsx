import { useEffect, useRef, useState } from "react"
import {
  collection,
  doc,
  getDocs,
  getDoc,
  increment,
  query,
  where,
  onSnapshot,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore"
import { db } from "@/lib/firebase"

type PlayerManageModalProps = {
  tournamentId: string
  storeId: string | null
  onClose: () => void
}

type PlayerExtra = {
  currentBalance: number
  pendingPurchases: Array<{ type: "entry" | "reentry" | "addon"; amount: number }>
  virtualBalance: number
}

type InsufficientAlert = {
  playerId: string
  type: "entry" | "reentry" | "addon"
  fee: number
}

export default function PlayerManageModal({ tournamentId, storeId, onClose }: PlayerManageModalProps) {
  const [players, setPlayers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [newTempName, setNewTempName] = useState("")
  const [localPlayers, setLocalPlayers] = useState<any[]>([])
  const [localBust, setLocalBust] = useState(0)
  const [search, setSearch] = useState("")

  const [entryFee, setEntryFee] = useState(0)
  const [reentryFee, setReentryFee] = useState(0)
  const [addonFee, setAddonFee] = useState(0)

  const [playerExtras, setPlayerExtras] = useState<Record<string, PlayerExtra>>({})
  const [originalPlayers, setOriginalPlayers] = useState<any[]>([])
  const [insufficientAlert, setInsufficientAlert] = useState<InsufficientAlert | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const balancesFetchedRef = useRef(false)

  // ── Load tournament + players ──────────────────────────────────────────────
  useEffect(() => {
    if (!storeId || !tournamentId) { setLoading(false); return }
    setLoading(true)

    const tournamentRef = doc(db, "stores", storeId, "tournaments", tournamentId)
    const unsubTournament = onSnapshot(tournamentRef, snap => {
      if (snap.exists()) {
        const d = snap.data()
        setLocalBust(d.bustCount ?? 0)
        setEntryFee(Number(d.entryFee ?? 0))
        setReentryFee(Number(d.reentryFee ?? 0))
        setAddonFee(Number(d.addonFee ?? 0))
      }
    })

    const unsub = onSnapshot(
      query(collection(db, "users"), where("currentStoreId", "==", storeId)),
      async (usersSnap) => {
        try {
          const listMap: Record<string, any> = {}

          const entriesSnap = await getDocs(
            collection(db, "stores", storeId, "tournaments", tournamentId, "entries")
          )
          entriesSnap.forEach(d => {
            const data = d.data()
            listMap[d.id] = {
              id: d.id,
              name: data.name ?? "",
              isTemp: d.id.startsWith("temp_"),
              entryCount: data.entryCount ?? 0,
              reentryCount: data.reentryCount ?? 0,
              addonCount: data.addonCount ?? 0,
            }
          })

          for (const userDoc of usersSnap.docs) {
            const userData = userDoc.data()
            const id = userDoc.id
            if (listMap[id]) {
              listMap[id] = { ...listMap[id], name: userData.name ?? listMap[id].name, iconUrl: userData.iconUrl }
            } else {
              listMap[id] = { id, name: userData.name, iconUrl: userData.iconUrl, entryCount: 0, reentryCount: 0, addonCount: 0 }
            }
          }

          const list = Object.values(listMap)
          setPlayers(list)
          setLocalPlayers(list)
          setError("")
        } catch {
          setError("プレイヤー情報の取得に失敗しました")
        }
        setLoading(false)
      }
    )

    return () => { unsub(); unsubTournament() }
  }, [storeId, tournamentId])

  // ── Fetch balances once after first load ───────────────────────────────────
  useEffect(() => {
    if (!storeId || players.length === 0 || balancesFetchedRef.current) return
    balancesFetchedRef.current = true

    const fetchBalances = async () => {
      const extras: Record<string, PlayerExtra> = {}
      for (const player of players) {
        if (player.isTemp) continue
        try {
          const snap = await getDoc(doc(db, "users", player.id, "storeBalances", storeId))
          const balance = snap.exists() ? (snap.data()?.balance ?? 0) : 0
          extras[player.id] = { currentBalance: balance, pendingPurchases: [], virtualBalance: balance }
        } catch {
          extras[player.id] = { currentBalance: 0, pendingPurchases: [], virtualBalance: 0 }
        }
      }
      setPlayerExtras(extras)
      setOriginalPlayers(players)
    }

    fetchBalances()
  }, [players, storeId])

  // ── Helpers ────────────────────────────────────────────────────────────────
  const getFee = (field: string) => {
    if (field === "entryCount") return entryFee
    if (field === "reentryCount") return reentryFee
    return addonFee
  }

  const getType = (field: string): "entry" | "reentry" | "addon" => {
    if (field === "entryCount") return "entry"
    if (field === "reentryCount") return "reentry"
    return "addon"
  }

  // ── Entry count change ─────────────────────────────────────────────────────
  const handleEntryChange = (
    playerId: string,
    field: "entryCount" | "reentryCount" | "addonCount",
    delta: number
  ) => {
    const player = localPlayers.find(p => p.id === playerId)
    if (!player) return
    if ((player[field] ?? 0) + delta < 0) return

    const fee = getFee(field)
    const type = getType(field)
    const extra = playerExtras[playerId]

    if (!player.isTemp && extra && delta > 0 && fee > 0) {
      if (extra.virtualBalance < fee) {
        setInsufficientAlert({ playerId, type, fee })
        return
      }
      // Normal deduction
      setPlayerExtras(prev => ({
        ...prev,
        [playerId]: { ...prev[playerId], virtualBalance: prev[playerId].virtualBalance - fee },
      }))
    }

    if (!player.isTemp && extra && delta < 0 && fee > 0) {
      // Refund
      setPlayerExtras(prev => ({
        ...prev,
        [playerId]: { ...prev[playerId], virtualBalance: prev[playerId].virtualBalance + fee },
      }))
    }

    setLocalPlayers(prev =>
      prev.map(p => p.id === playerId ? { ...p, [field]: (p[field] ?? 0) + delta } : p)
    )
  }

  // ── Confirm insufficient purchase ──────────────────────────────────────────
  const confirmInsufficientPurchase = () => {
    if (!insufficientAlert) return
    const { playerId, type, fee } = insufficientAlert

    // Record pending purchase (virtualBalance unchanged: purchase cancels out with fee)
    setPlayerExtras(prev => ({
      ...prev,
      [playerId]: {
        ...prev[playerId],
        pendingPurchases: [...prev[playerId].pendingPurchases, { type, amount: fee }],
      },
    }))

    const field = type === "entry" ? "entryCount" : type === "reentry" ? "reentryCount" : "addonCount"
    setLocalPlayers(prev =>
      prev.map(p => p.id === playerId ? { ...p, [field]: (p[field] ?? 0) + 1 } : p)
    )

    setInsufficientAlert(null)
  }

  // ── Preview calc ───────────────────────────────────────────────────────────
  const computePreview = (player: any) => {
    if (player.isTemp) return null
    const extra = playerExtras[player.id]
    if (!extra) return null
    const orig = originalPlayers.find(p => p.id === player.id)

    const entryDiff   = (player.entryCount   ?? 0) - (orig?.entryCount   ?? 0)
    const reentryDiff = (player.reentryCount ?? 0) - (orig?.reentryCount ?? 0)
    const addonDiff   = (player.addonCount   ?? 0) - (orig?.addonCount   ?? 0)

    const totalFees =
      Math.max(0, entryDiff)   * entryFee +
      Math.max(0, reentryDiff) * reentryFee +
      Math.max(0, addonDiff)   * addonFee

    const totalRefunds =
      Math.max(0, -entryDiff)   * entryFee +
      Math.max(0, -reentryDiff) * reentryFee +
      Math.max(0, -addonDiff)   * addonFee

    const totalPurchase = extra.pendingPurchases.reduce((s, p) => s + p.amount, 0)
    const netFee = totalRefunds - totalFees
    const finalBalance = extra.currentBalance + totalPurchase + netFee

    if (totalFees === 0 && totalRefunds === 0 && totalPurchase === 0) return null
    return { balance: extra.currentBalance, totalPurchase, netFee, finalBalance }
  }

  // ── Save ───────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!storeId || !tournamentId) return
    setIsSaving(true)
    try {
      const batch = writeBatch(db)
      const tournamentRef = doc(db, "stores", storeId, "tournaments", tournamentId)
      let totalEntry = 0, totalReentry = 0, totalAddon = 0

      for (const player of localPlayers) {
        // Always save entry doc
        batch.set(
          doc(db, "stores", storeId, "tournaments", tournamentId, "entries", player.id),
          { name: player.name ?? "", isTemp: player.isTemp ?? false, entryCount: player.entryCount ?? 0, reentryCount: player.reentryCount ?? 0, addonCount: player.addonCount ?? 0 }
        )
        totalEntry   += player.entryCount   ?? 0
        totalReentry += player.reentryCount ?? 0
        totalAddon   += player.addonCount   ?? 0

        if (player.isTemp) continue
        const extra = playerExtras[player.id]
        const orig  = originalPlayers.find(p => p.id === player.id)
        if (!extra) continue

        const entryDiff   = (player.entryCount   ?? 0) - (orig?.entryCount   ?? 0)
        const reentryDiff = (player.reentryCount ?? 0) - (orig?.reentryCount ?? 0)
        const addonDiff   = (player.addonCount   ?? 0) - (orig?.addonCount   ?? 0)

        const totalFees =
          Math.max(0, entryDiff)   * entryFee +
          Math.max(0, reentryDiff) * reentryFee +
          Math.max(0, addonDiff)   * addonFee

        const totalRefunds =
          Math.max(0, -entryDiff)   * entryFee +
          Math.max(0, -reentryDiff) * reentryFee +
          Math.max(0, -addonDiff)   * addonFee

        const totalPurchase = extra.pendingPurchases.reduce((s, p) => s + p.amount, 0)
        const balanceDelta  = totalPurchase - totalFees + totalRefunds
        const netGainDelta  = -totalFees + totalRefunds

        if (balanceDelta !== 0 || netGainDelta !== 0) {
          const balRef = doc(db, "users", player.id, "storeBalances", storeId)
          const upd: any = { balance: increment(balanceDelta) }
          if (netGainDelta !== 0) upd.netGain = increment(netGainDelta)
          batch.update(balRef, upd)
        }

        // Chip purchase transactions
        for (const purchase of extra.pendingPurchases) {
          batch.set(doc(collection(db, "transactions")), {
            storeId, playerId: player.id, playerName: player.name ?? null,
            amount: purchase.amount, direction: "add", type: "store_chip_purchase",
            tournamentId, createdAt: serverTimestamp(),
          })
        }

        // Entry/reentry/addon transactions
        const txDefs = [
          { diff: entryDiff,   fee: entryFee,   type: "store_tournament_entry" },
          { diff: reentryDiff, fee: reentryFee, type: "store_tournament_reentry" },
          { diff: addonDiff,   fee: addonFee,   type: "store_tournament_addon" },
        ]
        for (const tx of txDefs) {
          if (tx.diff === 0 || tx.fee === 0) continue
          batch.set(doc(collection(db, "transactions")), {
            storeId, playerId: player.id, playerName: player.name ?? null,
            amount: Math.abs(tx.diff) * tx.fee,
            direction: tx.diff > 0 ? "subtract" : "add",
            type: tx.type,
            tournamentId, createdAt: serverTimestamp(),
          })
        }
      }

      batch.update(tournamentRef, { totalEntry, totalReentry, totalAddon, bustCount: localBust })
      await batch.commit()
    } catch (e) {
      console.error(e)
    } finally {
      setIsSaving(false)
    }
    onClose()
  }

  // ── Misc handlers ──────────────────────────────────────────────────────────
  const handleTournamentBustChange = (delta: number) => {
    if (delta < 0 && localBust <= 0) return
    setLocalBust(prev => prev + delta)
  }

  const addTempPlayer = () => {
    if (!newTempName.trim()) return
    setLocalPlayers(prev => [...prev, {
      id: "temp_" + Date.now(), name: newTempName, isTemp: true,
      entryCount: 0, reentryCount: 0, addonCount: 0,
    }])
    setNewTempName("")
  }

  const deleteTempPlayer = (id: string) => setLocalPlayers(prev => prev.filter(p => p.id !== id))

  const updateTempPlayerName = (id: string, name: string) =>
    setLocalPlayers(prev => prev.map(p => p.id === id ? { ...p, name } : p))

  const allPlayers = localPlayers.filter(p => (p.name ?? "").toLowerCase().includes(search.toLowerCase()))

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/20 backdrop-blur-[1px] px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-[0_20px_60px_rgba(0,0,0,0.15)] border border-gray-100 animate-fadeIn">

        {/* Header */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={onClose}
              className="text-gray-900 text-xl font-bold px-2 py-1 hover:bg-gray-100 rounded"
            >×</button>
            <div />
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="text-green-600 text-xl font-bold px-2 py-1 hover:bg-green-50 rounded disabled:opacity-40"
            >{isSaving ? "…" : "✓"}</button>
          </div>

          {/* Summary card */}
          <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 shadow-sm flex items-center justify-between">
            <div className="flex flex-col items-center">
              <span className="text-[11px] text-gray-500">Players</span>
              <span className="text-lg font-semibold text-gray-900">
                {(() => {
                  const total = localPlayers.reduce((s, p) => s + (p.entryCount ?? 0) + (p.reentryCount ?? 0), 0)
                  return `${total - localBust}/${total}`
                })()}
              </span>
            </div>
            <div className="h-6 w-px bg-gray-200" />
            <div className="flex flex-col items-center">
              <span className="text-[11px] text-gray-500">Add-on</span>
              <span className="text-lg font-semibold text-gray-900">
                {localPlayers.reduce((s, p) => s + (p.addonCount ?? 0), 0)}
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
            {/* Bust */}
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-800 tracking-wide">BUST :</span>
              <div className="flex items-center gap-3">
                <button onClick={() => handleTournamentBustChange(-1)} disabled={localBust <= 0}
                  className="w-7 h-7 rounded-full bg-orange-300 text-orange-600 hover:bg-orange-600 transition">ー</button>
                <span className="text-xl font-bold text-gray-900 w-8 text-center">{localBust}</span>
                <button onClick={() => handleTournamentBustChange(1)}
                  className="w-7 h-7 rounded-full bg-orange-300 text-orange-600 hover:bg-orange-600 transition">＋</button>
              </div>
            </div>

            {/* Search */}
            <div className="mb-3">
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="プレイヤー検索"
                className="w-full h-10 border border-gray-300 rounded-lg px-3 text-sm text-gray-900 placeholder:text-gray-400"
              />
            </div>

            {/* Player list */}
            <div className="max-h-[50vh] overflow-y-auto space-y-3">
              {allPlayers.length === 0 ? (
                <p className="text-gray-500 text-center">プレイヤーが見つかりません</p>
              ) : (
                allPlayers.map(player => {
                  const preview = computePreview(player)
                  const extra = playerExtras[player.id]

                  return (
                    <div key={player.id} className="rounded-2xl bg-white border border-gray-200 px-4 py-3 shadow-sm">
                      {/* Name row */}
                      <div className="flex items-center gap-2 mb-2">
                        {/* Icon */}
                        {!player.isTemp && (
                          <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 border border-gray-100 bg-gray-100">
                            {player.iconUrl
                              ? <img src={player.iconUrl} alt="" className="w-full h-full object-cover" />
                              : <div className="w-full h-full flex items-center justify-center text-[11px] font-bold text-gray-400">
                                  {(player.name ?? "?")[0]?.toUpperCase()}
                                </div>
                            }
                          </div>
                        )}

                        {player.isTemp ? (
                          <input
                            value={player.name}
                            onChange={e => updateTempPlayerName(player.id, e.target.value)}
                            className="text-sm text-gray-900 font-semibold border-b border-gray-400 focus:outline-none flex-1 bg-white"
                          />
                        ) : (
                          <span className="text-sm text-gray-900 font-semibold flex-1 truncate">{player.name}</span>
                        )}

                        {player.isTemp && (
                          <button onClick={() => deleteTempPlayer(player.id)}
                            className="text-gray-400 hover:text-red-500 text-lg px-1 shrink-0">×</button>
                        )}
                      </div>

                      {/* Balance + preview */}
                      {!player.isTemp && extra && (
                        <div className="mb-2 flex flex-wrap items-center gap-1 text-[11px] font-medium">
                          <span className="text-gray-700">{extra.currentBalance.toLocaleString()}</span>
                          {preview && (
                            <>
                              {preview.totalPurchase > 0 && (
                                <span className="text-green-600">(+{preview.totalPurchase.toLocaleString()})</span>
                              )}
                              {preview.netFee !== 0 && (
                                <span className={preview.netFee > 0 ? "text-green-600" : "text-red-500"}>
                                  ({preview.netFee > 0 ? "+" : ""}{preview.netFee.toLocaleString()})
                                </span>
                              )}
                              <span className="text-gray-400">→</span>
                              <span className={`font-bold ${preview.finalBalance < 0 ? "text-red-500" : "text-gray-700"}`}>
                                {preview.finalBalance.toLocaleString()}
                              </span>
                            </>
                          )}
                        </div>
                      )}

                      {/* Entry / Reentry / Addon */}
                      <div className="flex items-center justify-between text-center">
                        {[
                          { label: "Entry",   field: "entryCount" },
                          { label: "Reentry", field: "reentryCount" },
                          { label: "Addon",   field: "addonCount" },
                        ].map(item => (
                          <div key={item.field} className="flex flex-col items-center flex-1">
                            <span className="text-[10px] text-gray-500 mb-1">{item.label}</span>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleEntryChange(player.id, item.field as any, -1)}
                                disabled={(player[item.field] ?? 0) <= 0}
                                className="w-6 h-6 rounded-full bg-gray-100 text-gray-700 text-sm disabled:opacity-30">−</button>
                              <span className="text-base font-semibold text-gray-900 w-6 text-center">
                                {player[item.field] ?? 0}
                              </span>
                              <button
                                onClick={() => handleEntryChange(player.id, item.field as any, 1)}
                                className="w-6 h-6 rounded-full bg-orange-100 text-orange-600 text-sm">＋</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })
              )}

              {/* Add temp player */}
              <div className="mt-3">
                <input
                  value={newTempName} onChange={e => setNewTempName(e.target.value)}
                  placeholder="仮プレイヤー名"
                  className="w-full h-10 border border-gray-300 rounded-lg px-3 text-sm text-gray-500 placeholder:text-gray-400"
                />
                <button onClick={addTempPlayer}
                  className="w-full mt-2 h-10 rounded-xl bg-[#F5A900] text-white text-sm">
                  ＋ Add Players
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Insufficient balance popup ── */}
      {insufficientAlert && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/40 px-6">
          <div className="w-full max-w-xs rounded-2xl bg-white p-5 shadow-2xl">
            <p className="text-sm font-bold text-gray-900 mb-1">所持バンクロールが不足しています</p>
            <p className="text-xs text-gray-500 mb-5">会計をしてください</p>
            <div className="flex gap-2">
              <button
                onClick={() => setInsufficientAlert(null)}
                className="flex-1 h-10 rounded-xl border border-gray-200 text-sm text-gray-600 font-semibold"
              >キャンセル</button>
              <button
                onClick={confirmInsufficientPurchase}
                className="flex-1 h-10 rounded-xl bg-[#F5A900] text-white text-sm font-bold"
              >確認</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
