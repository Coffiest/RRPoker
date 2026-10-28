import { ArrowRightIcon, CheckIcon, MinusIcon, PlusIcon, TriangleAlertIcon, XIcon } from 'lucide-react'
import { useEffect, useRef, useState } from "react"
import AppleSheet from "@/components/AppleSheet"
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
  /** 重なり順。全画面タイマーの上に出すときに上げる。 */
  zIndex?: number
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

export default function PlayerManageModal({ tournamentId, storeId, balanceGroupId, chipUnit, chipUnitBefore, onClose, zIndex }: PlayerManageModalProps) {
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
        const before = originalPlayers.find(p => p.id === player.id)

        // 数量は絶対値ではなく「この画面を開いてからの差」を足し込む。
        //
        // 以前は画面が持っている値をそのまま書いていたため、モーダルを開いたまま
        // プレイヤーが自分の端末からリエントリーすると、保存した瞬間にその1回が
        // 消えていた(画面は古い値を持っているため)。increment なら両者の変更が
        // 打ち消し合わずに足し合わさる。
        const dEntry   = (player.entryCount   ?? 0) - (before?.entryCount   ?? 0)
        const dReentry = (player.reentryCount ?? 0) - (before?.reentryCount ?? 0)
        const dAddon   = (player.addonCount   ?? 0) - (before?.addonCount   ?? 0)

        const entryData: Record<string, any> = { name: player.name ?? "", isTemp: player.isTemp ?? false }
        if (dEntry   !== 0) entryData.entryCount   = increment(dEntry)
        if (dReentry !== 0) entryData.reentryCount = increment(dReentry)
        if (dAddon   !== 0) entryData.addonCount   = increment(dAddon)
        // 新しく作る行には、増分ではなく初期値が要る。
        if (!before) {
          entryData.entryCount   = player.entryCount   ?? 0
          entryData.reentryCount = player.reentryCount ?? 0
          entryData.addonCount   = player.addonCount   ?? 0
        }
        ops.push(b => b.set(entryRef, entryData, { merge: true }))

        totalEntry   += dEntry
        totalReentry += dReentry
        totalAddon   += dAddon

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
      // 合計も同じ理由で増分。bustCount だけは店員が直接その数を指定する値なので絶対値のまま。
      const totalUpdate: Record<string, any> = { bustCount: localBust }
      if (totalEntry   !== 0) totalUpdate.totalEntry   = increment(totalEntry)
      if (totalReentry !== 0) totalUpdate.totalReentry = increment(totalReentry)
      if (totalAddon   !== 0) totalUpdate.totalAddon   = increment(totalAddon)
      ops.push(b => b.update(tournamentRef, totalUpdate))

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
    <AppleSheet open onClose={onClose} bare maxWidth={480} maxHeightVh={92} zIndex={zIndex ?? 300}>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, paddingBottom: 'max(8px, env(safe-area-inset-bottom, 8px))' }}>

        {/* ヘッダー */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px 16px', flexShrink: 0, borderBottom: '1px solid #F2F2F7' }}>
          <button
            onClick={onClose}
            style={{ width: 44, height: 44, borderRadius: 999, background: 'rgba(255,255,255,0.6)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.5), 0 1px 4px rgba(0,0,0,0.05)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 20, color: '#3C3C43', lineHeight: 1 }}
          ><XIcon size={20} /></button>
          <span style={{ fontSize: 17, fontWeight: 700, color: '#1C1C1E' }}>参加者</span>
          <button
            onClick={handleSave}
            disabled={isSaving}
            style={{ width: 44, height: 44, borderRadius: '50%', background: isSaving ? '#E5E5EA' : 'linear-gradient(135deg,#34C759,#2DAD4D)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: isSaving ? 'default' : 'pointer', boxShadow: isSaving ? 'none' : '0 2px 8px rgba(52,199,89,0.35)', fontSize: 18, color: '#fff', lineHeight: 1 }}
          >{isSaving ? '…' : <CheckIcon size={20} />}</button>
        </div>

        {/* スクロール可能ボディ */}
        <div style={{ overflowY: 'auto', flex: 1, minHeight: 0, padding: '16px 16px 8px' }}>
          {loading ? (
            <p className="term-comment" style={{ textAlign: 'center', color: 'var(--label3)', padding: '48px 0', fontSize: 14 }}>読み込み中…</p>
          ) : error ? (
            <p style={{ textAlign: 'center', color: '#FF3B30', padding: '48px 0', fontSize: 13 }}>{error}</p>
          ) : (
            <>
              {/* プレイヤー統計カード */}
              <div style={{ background: 'linear-gradient(135deg,#F9F9F9,#F2F2F7)', border: '1px solid #E5E5EA', borderRadius: 18, padding: '16px 16px', marginBottom: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={{ textAlign: 'center', paddingRight: 16, borderRight: '1px solid #D1D1D6' }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--label3)', letterSpacing: '0.05em', marginBottom: 8 }}>参加者</p>
                  <p style={{ fontSize: 20, fontWeight: 800, color: '#1C1C1E', letterSpacing: '-0.4px' }}>
                    {(() => { const total = localPlayers.reduce((s, p) => s + (p.entryCount ?? 0) + (p.reentryCount ?? 0), 0); return `${total - localBust}/${total}` })()}
                  </p>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--label3)', letterSpacing: '0.05em', marginBottom: 8 }}>アドオン</p>
                  <p style={{ fontSize: 20, fontWeight: 800, color: '#1C1C1E', letterSpacing: '-0.4px' }}>
                    {localPlayers.reduce((s, p) => s + (p.addonCount ?? 0), 0)}
                  </p>
                </div>
              </div>

              {/* Bust コントロール */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, padding: '16px 16px', background: '#F2F2F7', borderRadius: 14 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#1C1C1E' }}>敗退</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <button onClick={() => handleTournamentBustChange(-1)} disabled={localBust <= 0}
                    style={{ width: 44, height: 44, borderRadius: '50%', background: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: localBust > 0 ? 'pointer' : 'default', color: 'var(--label)', opacity: localBust <= 0 ? 0.3 : 1 }} aria-label="敗退を1人減らす"><MinusIcon size={20} /></button>
                  <span style={{ fontSize: 18, fontWeight: 700, color: '#1C1C1E', minWidth: '36px', textAlign: 'center' }}>{localBust}</span>
                  <button onClick={() => handleTournamentBustChange(1)}
                    style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(242,169,0,0.15)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--label)' }} aria-label="敗退を1人増やす"><PlusIcon size={20} /></button>
                </div>
              </div>

              {/* プレイヤー検索 */}
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="プレイヤー検索"
                aria-label="プレイヤー検索"
                style={{ width: '100%', height: 44, borderRadius: 12, border: '1.5px solid #E5E5EA', background: '#F9F9F9', padding: '0 16px', fontSize: 14, color: '#1C1C1E', outline: 'none', marginBottom: 16, boxSizing: 'border-box' }}
              />

              {/* プレイヤーリスト */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {allPlayers.length === 0 ? (
                  <p style={{ textAlign: 'center', color: 'var(--label3)', padding: '32px 0', fontSize: 13 }}>プレイヤーが見つかりません</p>
                ) : (
                  allPlayers.map(player => {
                    const preview = computePreview(player)
                    const extra = playerExtras[player.id]
                    return (
                      <div key={player.id} style={{ background: '#F9F9F9', borderRadius: 16, padding: '16px 16px', border: '1px solid #E5E5EA' }}>
                        {/* プレイヤー名行 */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          {!player.isTemp && player.iconUrl && (
                            <img src={player.iconUrl} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                          )}
                          {!player.isTemp && !player.iconUrl && (
                            <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#E5E5EA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--label3)', flexShrink: 0 }}>
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
                              style={{ background: 'none', border: 'none', color: 'var(--label3)', cursor: 'pointer', padding: 0, minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><XIcon size={16} /></button>
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
                            <div style={{ background: 'linear-gradient(135deg,rgba(242,169,0,0.08),rgba(242,169,0,0.12))', border: '1px solid rgba(242,169,0,0.2)', borderRadius: 12, padding: '8px 16px', marginBottom: 8 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: wrap ? 'wrap' : 'nowrap' }}>
                                <span style={{ fontSize: 11, fontWeight: 700, color: '#D4910A', letterSpacing: '0.16em', textTransform: 'uppercase', flexShrink: 0 }}>残高</span>
                                <span style={{ fontSize: 13, fontWeight: 700, color: '#1C1C1E' }}>{curStr}</span>
                                {preview && (buyStr || feeStr) && (
                                  <>
                                    {buyStr && <span style={{ fontSize: 11, fontWeight: 600, color: '#34C759', whiteSpace: 'nowrap' }}>{buyStr}</span>}
                                    {feeStr && <span style={{ fontSize: 11, fontWeight: 600, color: preview.netFee > 0 ? '#34C759' : '#FF3B30', whiteSpace: 'nowrap' }}>{feeStr}</span>}
                                    <ArrowRightIcon size={12} color="var(--label3)" />
                                    <span style={{ fontSize: 12, fontWeight: 700, color: preview.finalBalance < 0 ? '#FF3B30' : '#1C1C1E', whiteSpace: 'nowrap' }}>{finStr}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          )
                        })()}

                        {/* エントリー / リエントリー / アドオン。3つを横に並べると画面からはみ出すので、
                            行ごとに「項目名 ─ 増減」を置く(iOS のステッパー)。 */}
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          {[
                            { label: 'エントリー', field: 'entryCount' },
                            { label: 'リエントリー', field: 'reentryCount' },
                            { label: 'アドオン', field: 'addonCount' },
                          ].map((item, i) => {
                            const n = player[item.field] ?? 0
                            return (
                              <div key={item.field} style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 52, borderTop: i ? '1px solid rgba(60,60,67,0.12)' : 'none' }}>
                                <span style={{ flex: 1, fontSize: 15, color: 'var(--label)' }}>{item.label}</span>
                                <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(118,118,128,0.12)', borderRadius: 12 }}>
                                  <button type="button" aria-label={`${item.label}を1つ減らす`}
                                    onClick={() => handleEntryChange(player.id, item.field as any, -1)}
                                    disabled={n <= 0}
                                    style={{ width: 48, height: 44, border: 'none', background: 'transparent', color: 'var(--label)', cursor: n > 0 ? 'pointer' : 'default', opacity: n <= 0 ? 0.3 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <MinusIcon size={20} />
                                  </button>
                                  <span aria-live="polite" style={{ minWidth: 32, textAlign: 'center', fontSize: 17, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: 'var(--label)' }}>{n}</span>
                                  <button type="button" aria-label={`${item.label}を1つ増やす`}
                                    onClick={() => handleEntryChange(player.id, item.field as any, 1)}
                                    style={{ width: 48, height: 44, border: 'none', background: 'transparent', color: 'var(--label)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <PlusIcon size={20} />
                                  </button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              {/* 仮プレイヤー追加 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 16 }}>
                <input
                  value={newTempName} onChange={e => setNewTempName(e.target.value)}
                  placeholder="仮プレイヤー名"
                  aria-label="仮プレイヤー名"
                  style={{ minWidth: 0, height: 44, borderRadius: 12, border: '1.5px solid #E5E5EA', background: '#F9F9F9', padding: '0 16px', fontSize: 13, color: '#1C1C1E', outline: 'none', boxSizing: 'border-box' }}
                />
                <button onClick={addTempPlayer}
                  style={{ height: 44, borderRadius: 12, background: '#F2A900', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><PlusIcon size={20} /> 追加</button>
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
              <div style={{ padding: '32px 24px 16px', textAlign: 'center' }}>
                <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(255,59,48,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: '#D70015' }}><TriangleAlertIcon size={24} /></div>
                <p style={{ fontSize: 15, fontWeight: 700, color: '#1C1C1E', marginBottom: 8 }}>所持バンクロール不足</p>
                <p style={{ fontSize: 13, color: 'var(--label3)', lineHeight: 1.5 }}>会計をしてください</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '0 16px 24px' }}>
                <button
                  onClick={() => setInsufficientAlert(null)}
                  style={{ height: 48, borderRadius: 12, border: 'none', background: '#F2F2F7', color: '#1C1C1E', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}
                >キャンセル</button>
                <button
                  onClick={confirmInsufficientPurchase}
                  style={{ height: 48, borderRadius: 12, border: 'none', background: '#F2A900', color: '#1C1C1E', fontSize: 15, fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 8px rgba(242,169,0,0.25)' }}
                >確認</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppleSheet>
  )
}
