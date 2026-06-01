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
  balanceGroupId?: string
  chipUnit?: string
  chipUnitBefore?: boolean
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

function fmtChip(amount: number, unit?: string, before?: boolean): string {
  if (!unit) return amount.toLocaleString()
  return before ? `${unit}${amount.toLocaleString()}` : `${amount.toLocaleString()}${unit}`
}

export default function PlayerManageModal({ tournamentId, storeId, balanceGroupId, chipUnit, chipUnitBefore, onClose }: PlayerManageModalProps) {
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
  const bustDirtyRef = useRef(false)

  // ── Load tournament + players ──────────────────────────────────────────────
  useEffect(() => {
    if (!storeId || !tournamentId) { setLoading(false); return }
    setLoading(true)

    const tournamentRef = doc(db, "stores", storeId, "tournaments", tournamentId)
    const unsubTournament = onSnapshot(tournamentRef, snap => {
      if (snap.exists()) {
        const d = snap.data()
        if (!bustDirtyRef.current) setLocalBust(d.bustCount ?? 0)
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
      const realPlayers = players.filter(p => !p.isTemp)
      const snaps = await Promise.all(
        realPlayers.map(p =>
          getDoc(doc(db, "users", p.id, "storeBalances", balanceGroupId ?? storeId!)).catch(() => null)
        )
      )
      const extras: Record<string, PlayerExtra> = {}
      snaps.forEach((snap, i) => {
        const id = realPlayers[i].id
        const balance = snap?.exists() ? (snap.data()?.balance ?? 0) : 0
        extras[id] = { currentBalance: balance, pendingPurchases: [], virtualBalance: balance }
      })
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
      // pendingPurchasesに該当typeがあればそちらを先に取り消す（チップが増えるバグ対策）
      const pendingPurchases = extra.pendingPurchases
      let lastMatchIdx = -1
      for (let i = pendingPurchases.length - 1; i >= 0; i--) {
        if (pendingPurchases[i].type === type) { lastMatchIdx = i; break }
      }
      if (lastMatchIdx >= 0) {
        const newPending = pendingPurchases.filter((_, i) => i !== lastMatchIdx)
        setPlayerExtras(prev => ({
          ...prev,
          [playerId]: { ...prev[playerId], pendingPurchases: newPending },
        }))
      } else {
        // 通常の残高返金
        setPlayerExtras(prev => ({
          ...prev,
          [playerId]: { ...prev[playerId], virtualBalance: prev[playerId].virtualBalance + fee },
        }))
      }
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
      const CHUNK = 490
      type WriteOp = (b: ReturnType<typeof writeBatch>) => void
      const ops: WriteOp[] = []

      const tournamentRef = doc(db, "stores", storeId, "tournaments", tournamentId)
      let totalEntry = 0, totalReentry = 0, totalAddon = 0

      for (const player of localPlayers) {
        const entryRef = doc(db, "stores", storeId, "tournaments", tournamentId, "entries", player.id)
        const entryData = { name: player.name ?? "", isTemp: player.isTemp ?? false, entryCount: player.entryCount ?? 0, reentryCount: player.reentryCount ?? 0, addonCount: player.addonCount ?? 0 }
        ops.push(b => b.set(entryRef, entryData))
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
          const balRef = doc(db, "users", player.id, "storeBalances", balanceGroupId ?? storeId!)
          const upd: any = { balance: increment(balanceDelta) }
          if (netGainDelta !== 0) upd.netGain = increment(netGainDelta)
          ops.push(b => b.update(balRef, upd))
        }

        for (const purchase of extra.pendingPurchases) {
          const txRef = doc(collection(db, "transactions"))
          const txData = { storeId, playerId: player.id, playerName: player.name ?? null, amount: purchase.amount, direction: "add", type: "store_chip_purchase", tournamentId, createdAt: serverTimestamp() }
          ops.push(b => b.set(txRef, txData))
        }

        const txDefs = [
          { diff: entryDiff,   fee: entryFee,   type: "store_tournament_entry" },
          { diff: reentryDiff, fee: reentryFee, type: "store_tournament_reentry" },
          { diff: addonDiff,   fee: addonFee,   type: "store_tournament_addon" },
        ]
        for (const tx of txDefs) {
          if (tx.diff === 0 || tx.fee === 0) continue
          const txRef = doc(collection(db, "transactions"))
          const txData = { storeId, playerId: player.id, playerName: player.name ?? null, amount: Math.abs(tx.diff) * tx.fee, direction: tx.diff > 0 ? "subtract" : "add", type: tx.type, tournamentId, createdAt: serverTimestamp() }
          ops.push(b => b.set(txRef, txData))
        }
      }

      // tournament update goes in the last chunk
      ops.push(b => b.update(tournamentRef, { totalEntry, totalReentry, totalAddon, bustCount: localBust }))

      // commit in chunks of CHUNK ops
      for (let i = 0; i < ops.length; i += CHUNK) {
        const batch = writeBatch(db)
        ops.slice(i, i + CHUNK).forEach(op => op(batch))
        await batch.commit()
      }
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
    bustDirtyRef.current = true
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
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}
      onClick={onClose}
    >
      <div
        style={{ width: '100%', maxWidth: 480, background: '#fff', borderRadius: '24px 24px 0 0', maxHeight: '92vh', display: 'flex', flexDirection: 'column', paddingBottom: 'max(8px, env(safe-area-inset-bottom, 8px))' }}
        onClick={e => e.stopPropagation()}
      >
        {/* ドラッグハンドル */}
        <div style={{ width: 36, height: 4, borderRadius: 99, background: '#D1D1D6', margin: '12px auto 0', flexShrink: 0 }} />

        {/* ヘッダー */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px 14px', flexShrink: 0, borderBottom: '1px solid #F2F2F7' }}>
          <button
            onClick={onClose}
            style={{ width: 34, height: 34, borderRadius: '50%', background: '#F2F2F7', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 20, color: '#3C3C43', lineHeight: 1 }}
          >×</button>
          <span style={{ fontSize: 17, fontWeight: 700, color: '#1C1C1E' }}>Players</span>
          <button
            onClick={handleSave}
            disabled={isSaving}
            style={{ width: 34, height: 34, borderRadius: '50%', background: isSaving ? '#E5E5EA' : 'linear-gradient(135deg,#34C759,#2DAD4D)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: isSaving ? 'default' : 'pointer', boxShadow: isSaving ? 'none' : '0 2px 8px rgba(52,199,89,0.35)', fontSize: 18, color: '#fff', lineHeight: 1 }}
          >{isSaving ? '…' : '✓'}</button>
        </div>

        {/* スクロール可能ボディ */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '16px 16px 8px' }}>
          {loading ? (
            <p style={{ textAlign: 'center', color: '#8E8E93', padding: '48px 0', fontSize: 14 }}>読み込み中…</p>
          ) : error ? (
            <p style={{ textAlign: 'center', color: '#FF3B30', padding: '48px 0', fontSize: 13 }}>{error}</p>
          ) : (
            <>
              {/* プレイヤー統計カード */}
              <div style={{ background: 'linear-gradient(135deg,#F9F9F9,#F2F2F7)', border: '1px solid #E5E5EA', borderRadius: 18, padding: '12px 14px', marginBottom: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ textAlign: 'center', paddingRight: 12, borderRight: '1px solid #D1D1D6' }}>
                  <p style={{ fontSize: 10, fontWeight: 600, color: '#8E8E93', letterSpacing: '0.05em', marginBottom: 4 }}>Players</p>
                  <p style={{ fontSize: 20, fontWeight: 800, color: '#1C1C1E', letterSpacing: '-0.4px' }}>
                    {(() => { const total = localPlayers.reduce((s, p) => s + (p.entryCount ?? 0) + (p.reentryCount ?? 0), 0); return `${total - localBust}/${total}` })()}
                  </p>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: 10, fontWeight: 600, color: '#8E8E93', letterSpacing: '0.05em', marginBottom: 4 }}>Add-on</p>
                  <p style={{ fontSize: 20, fontWeight: 800, color: '#1C1C1E', letterSpacing: '-0.4px' }}>
                    {localPlayers.reduce((s, p) => s + (p.addonCount ?? 0), 0)}
                  </p>
                </div>
              </div>

              {/* Bust コントロール */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, padding: '12px 16px', background: '#F2F2F7', borderRadius: 14 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#1C1C1E' }}>BUST</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button onClick={() => handleTournamentBustChange(-1)} disabled={localBust <= 0}
                    style={{ width: 36, height: 36, borderRadius: '50%', background: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: localBust > 0 ? 'pointer' : 'default', fontSize: 18, color: '#D4910A', opacity: localBust <= 0 ? 0.4 : 1 }}>−</button>
                  <span style={{ fontSize: 18, fontWeight: 700, color: '#1C1C1E', minWidth: '36px', textAlign: 'center' }}>{localBust}</span>
                  <button onClick={() => handleTournamentBustChange(1)}
                    style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(242,169,0,0.15)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 18, fontWeight: 700, color: '#D4910A' }}>＋</button>
                </div>
              </div>

              {/* プレイヤー検索 */}
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="プレイヤー検索"
                style={{ width: '100%', height: 40, borderRadius: 12, border: '1.5px solid #E5E5EA', background: '#F9F9F9', padding: '0 14px', fontSize: 14, color: '#1C1C1E', outline: 'none', marginBottom: 12, boxSizing: 'border-box' }}
              />

              {/* プレイヤーリスト */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {allPlayers.length === 0 ? (
                  <p style={{ textAlign: 'center', color: '#8E8E93', padding: '32px 0', fontSize: 13 }}>プレイヤーが見つかりません</p>
                ) : (
                  allPlayers.map(player => {
                    const preview = computePreview(player)
                    const extra = playerExtras[player.id]
                    return (
                      <div key={player.id} style={{ background: '#F9F9F9', borderRadius: 16, padding: '12px 14px', border: '1px solid #E5E5EA' }}>
                        {/* プレイヤー名行 */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                          {!player.isTemp && player.iconUrl && (
                            <img src={player.iconUrl} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                          )}
                          {!player.isTemp && !player.iconUrl && (
                            <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#E5E5EA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#8E8E93', flexShrink: 0 }}>
                              {(player.name ?? '?')[0]?.toUpperCase()}
                            </div>
                          )}
                          {player.isTemp ? (
                            <input
                              value={player.name}
                              onChange={e => updateTempPlayerName(player.id, e.target.value)}
                              style={{ fontSize: 13, fontWeight: 600, color: '#1C1C1E', borderBottom: '1.5px solid #D4910A', outline: 'none', flex: 1, background: 'transparent', padding: '2px 0' }}
                            />
                          ) : (
                            <span style={{ fontSize: 13, fontWeight: 600, color: '#1C1C1E', flex: 1 }}>{player.name}</span>
                          )}
                          {player.isTemp && (
                            <button onClick={() => deleteTempPlayer(player.id)}
                              style={{ background: 'none', border: 'none', color: '#8E8E93', fontSize: 18, cursor: 'pointer', padding: 0 }}>×</button>
                          )}
                        </div>

                        {/* バンクロール + プレビュー */}
                        {!player.isTemp && extra && (() => {
                          const curStr = fmtChip(extra.currentBalance, chipUnit, chipUnitBefore)
                          const buyStr = preview && preview.totalPurchase > 0 ? `+${fmtChip(preview.totalPurchase, chipUnit, chipUnitBefore)}` : ''
                          const feeStr = preview && preview.netFee !== 0 ? `${preview.netFee > 0 ? '+' : ''}${fmtChip(preview.netFee, chipUnit, chipUnitBefore)}` : ''
                          const finStr = preview ? fmtChip(preview.finalBalance, chipUnit, chipUnitBefore) : ''
                          const totalLen = curStr.length + buyStr.length + feeStr.length + finStr.length
                          const wrap = totalLen > 18
                          return (
                            <div style={{ background: 'linear-gradient(135deg,rgba(242,169,0,0.08),rgba(242,169,0,0.12))', border: '1px solid rgba(242,169,0,0.2)', borderRadius: 12, padding: '9px 12px', marginBottom: 10 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: wrap ? 'wrap' : 'nowrap' }}>
                                <span style={{ fontSize: 9, fontWeight: 700, color: '#D4910A', letterSpacing: '0.1em', textTransform: 'uppercase', flexShrink: 0 }}>Bankroll</span>
                                <span style={{ fontSize: 13, fontWeight: 700, color: '#1C1C1E' }}>{curStr}</span>
                                {preview && (buyStr || feeStr) && (
                                  <>
                                    {buyStr && <span style={{ fontSize: 11, fontWeight: 600, color: '#34C759', whiteSpace: 'nowrap' }}>{buyStr}</span>}
                                    {feeStr && <span style={{ fontSize: 11, fontWeight: 600, color: preview.netFee > 0 ? '#34C759' : '#FF3B30', whiteSpace: 'nowrap' }}>{feeStr}</span>}
                                    <span style={{ fontSize: 10, color: '#8E8E93', whiteSpace: 'nowrap' }}>→</span>
                                    <span style={{ fontSize: 12, fontWeight: 700, color: preview.finalBalance < 0 ? '#FF3B30' : '#1C1C1E', whiteSpace: 'nowrap' }}>{finStr}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          )
                        })()}

                        {/* Entry / Reentry / Addon */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                          {[
                            { label: 'Entry', field: 'entryCount' },
                            { label: 'Reentry', field: 'reentryCount' },
                            { label: 'Addon', field: 'addonCount' },
                          ].map(item => (
                            <div key={item.field} style={{ textAlign: 'center' }}>
                              <p style={{ fontSize: 10, color: '#8E8E93', fontWeight: 600, marginBottom: 6 }}>{item.label}</p>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                <button
                                  onClick={() => handleEntryChange(player.id, item.field as any, -1)}
                                  disabled={(player[item.field] ?? 0) <= 0}
                                  style={{ width: 28, height: 28, borderRadius: '50%', background: '#fff', border: '1px solid #E5E5EA', color: '#8E8E93', fontSize: 14, cursor: 'pointer', opacity: (player[item.field] ?? 0) <= 0 ? 0.4 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                                <span style={{ fontSize: 15, fontWeight: 700, color: '#1C1C1E', minWidth: '24px', textAlign: 'center' }}>{player[item.field] ?? 0}</span>
                                <button
                                  onClick={() => handleEntryChange(player.id, item.field as any, 1)}
                                  style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(242,169,0,0.15)', border: 'none', color: '#D4910A', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>＋</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              {/* 仮プレイヤー追加 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
                <input
                  value={newTempName} onChange={e => setNewTempName(e.target.value)}
                  placeholder="仮プレイヤー名"
                  style={{ height: 40, borderRadius: 12, border: '1.5px solid #E5E5EA', background: '#F9F9F9', padding: '0 12px', fontSize: 13, color: '#1C1C1E', outline: 'none', boxSizing: 'border-box' }}
                />
                <button onClick={addTempPlayer}
                  style={{ height: 40, borderRadius: 12, background: 'linear-gradient(135deg,#F2A900,#D4910A)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 8px rgba(242,169,0,0.25)' }}>＋ Add</button>
              </div>
            </>
          )}
        </div>

        {/* 不足残高アラート */}
        {insufficientAlert && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', padding: '0 24px' }}
            onClick={() => setInsufficientAlert(null)}>
            <div style={{ width: '100%', maxWidth: 320, background: '#fff', borderRadius: 22, overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.25)' }}
              onClick={e => e.stopPropagation()}>
              <div style={{ padding: '28px 20px 16px', textAlign: 'center' }}>
                <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(255,59,48,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', fontSize: 26 }}>⚠️</div>
                <p style={{ fontSize: 15, fontWeight: 700, color: '#1C1C1E', marginBottom: 6 }}>所持バンクロール不足</p>
                <p style={{ fontSize: 13, color: '#8E8E93', lineHeight: 1.5 }}>会計をしてください</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '0 16px 20px' }}>
                <button
                  onClick={() => setInsufficientAlert(null)}
                  style={{ height: 48, borderRadius: 12, border: 'none', background: '#F2F2F7', color: '#1C1C1E', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}
                >キャンセル</button>
                <button
                  onClick={confirmInsufficientPurchase}
                  style={{ height: 48, borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#F2A900,#D4910A)', color: '#1C1C1E', fontSize: 15, fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 8px rgba(242,169,0,0.25)' }}
                >確認</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
