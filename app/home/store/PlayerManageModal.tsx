import { TriangleAlert } from 'lucide-react'
import { FiX } from "react-icons/fi"
import { RingButton } from "@/components/BackButton"
import StepButton from "@/components/StepButton"
import Loader from "@/components/Loader"
import PlayerAvatar from "@/components/PlayerAvatar"
import { useEffect, useRef, useState } from "react"
import { FiEdit2, FiMoreHorizontal, FiTrash2 } from "react-icons/fi"
import { useDragToClose } from "@/lib/useDragToClose"
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
  /** QR から開いたとき: このプレイヤーだけを表示し、autoAction を 1 回だけ行う(確定は ✓ で、普段と同じ処理) */
  focusPlayerId?: string
  autoAction?: "entry" | "reentry" | "addon" | "bust"
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

export default function PlayerManageModal({ tournamentId, storeId, balanceGroupId, chipUnit, chipUnitBefore, onClose, focusPlayerId, autoAction }: PlayerManageModalProps) {
  // 下から出る画面を指で下に引いて閉じられるように(見た目は元のまま)
  const sheetDrag = useDragToClose(() => onClose())
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
  // スタック(エントリーとリエントリーが同じか・アドオンがあるかを決める。2026-11-09)
  const [entryStack, setEntryStack] = useState(0)
  const [reentryStack, setReentryStack] = useState(0)
  const [addonStack, setAddonStack] = useState(0)
  // 開いたときのバスト数(変更を「10→11」と赤で見せる)
  const [origBust, setOrigBust] = useState<number | null>(null)

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
        setOrigBust(prev => prev ?? (d.bustCount ?? 0))
        setEntryFee(Number(d.entryFee ?? 0))
        setReentryFee(Number(d.reentryFee ?? 0))
        setAddonFee(Number(d.addonFee ?? 0))
        setEntryStack(Number(d.entryStack ?? 0))
        setReentryStack(Number(d.reentryStack ?? 0))
        setAddonStack(Number(d.addonStack ?? 0))
      }
    })

    // QR から開いたとき(focusPlayerId)は、そのプレイヤー 1 人分だけを同時に読む。
    // 以前は店にいる全員の参加記録と全員の残高を読み終えるまで待ち、エントリーが出るまで遅れていた(オーナー指定・2026-11-07)
    if (focusPlayerId) {
      let alive = true
      ;(async () => {
        try {
          const [entrySnap, userSnap, balSnap] = await Promise.all([
            getDoc(doc(db, "stores", storeId, "tournaments", tournamentId, "entries", focusPlayerId)),
            getDoc(doc(db, "users", focusPlayerId)),
            getDoc(doc(db, "users", focusPlayerId, "storeBalances", balanceGroupId ?? storeId)).catch(() => null),
          ])
          if (!alive) return
          const e = entrySnap.data(), u = userSnap.data()
          const one = {
            id: focusPlayerId, name: u?.name ?? e?.name ?? "", iconUrl: u?.iconUrl, isTemp: focusPlayerId.startsWith("temp_"),
            entryCount: e?.entryCount ?? 0, reentryCount: e?.reentryCount ?? 0, addonCount: e?.addonCount ?? 0,
          }
          const balance = balSnap?.exists() ? (balSnap.data()?.balance ?? 0) : 0
          balancesFetchedRef.current = true
          setPlayers([one]); setLocalPlayers([one]); setOriginalPlayers([one])
          setPlayerExtras({ [focusPlayerId]: { currentBalance: balance, pendingPurchases: [], virtualBalance: balance } })
          setError("")
        } catch {
          if (alive) setError("プレイヤー情報の取得に失敗しました")
        }
        if (alive) setLoading(false)
      })()
      return () => { alive = false; unsubTournament() }
    }

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
  }, [storeId, tournamentId, focusPlayerId, balanceGroupId])

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
          // 参加費が 0 でも参加の記録は残す(チップ履歴にすべての参加が出るように。2026-11-10)
          if (tx.diff === 0) continue
          const txRef = doc(collection(db, "transactions"))
          const txData = { storeId, playerId: player.id, playerName: player.name ?? null, amount: Math.abs(tx.diff) * tx.fee, direction: tx.diff > 0 ? "subtract" : "add", type: tx.type, tournamentId, createdAt: serverTimestamp() }
          ops.push(b => b.set(txRef, txData))
        }
      }

      // 消した仮プレイヤー: 参加記録を消し、その人の分を大会の合計からも引く(2026-11-09)。
      // 以前は画面の一覧から外すだけで、開き直すと復活していた
      for (const before of originalPlayers) {
        if (!before.isTemp || localPlayers.some(p => p.id === before.id)) continue
        ops.push(b => b.delete(doc(db, "stores", storeId, "tournaments", tournamentId, "entries", before.id)))
        totalEntry   -= before.entryCount   ?? 0
        totalReentry -= before.reentryCount ?? 0
        totalAddon   -= before.addonCount   ?? 0
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

  // QR から開いたとき: そのプレイヤーに絞り、頼まれた操作を 1 回だけ(残高の扱いは手で + を押したときと同じ)
  const autoDoneRef = useRef(false)
  useEffect(() => {
    if (!focusPlayerId || autoDoneRef.current || loading) return
    const pl = localPlayers.find(p => p.id === focusPlayerId)
    if (!pl) return
    if (autoAction && autoAction !== "bust" && !playerExtras[focusPlayerId]) return // 残高の読み込み待ち
    autoDoneRef.current = true
    setSearch(pl.name ?? "")
    if (autoAction === "bust") handleTournamentBustChange(1)
    else if (autoAction) handleEntryChange(focusPlayerId, autoAction === "entry" ? "entryCount" : autoAction === "reentry" ? "reentryCount" : "addonCount", 1)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusPlayerId, autoAction, loading, localPlayers, playerExtras])

  // 仮プレイヤーは検索に関係なく常に一番上に固定(足した順)。その下に検索に合うプレイヤー
  // 並び(2026-11-09): いま足した仮プレイヤーを一番上、その下はエントリー数(E+R)の多い順、まだの人は一番下。
  // 並びは開いたときの数で決める(押すたびにカードが動かないように)
  const origCount = (id: string) => { const o = originalPlayers.find(p => p.id === id); return o ? (o.entryCount ?? 0) + (o.reentryCount ?? 0) : -1 }
  const kw = search.toLowerCase()
  const allPlayers = focusPlayerId ? localPlayers.filter(p => p.id === focusPlayerId) : [
    ...localPlayers.filter(p => p.isTemp && origCount(p.id) < 0),
    ...localPlayers
      .filter(p => !(p.isTemp && origCount(p.id) < 0) && (p.isTemp || (p.name ?? "").toLowerCase().includes(kw)))
      .sort((a, b) => Math.max(0, origCount(b.id)) - Math.max(0, origCount(a.id))),
  ]
  const [tempMenuId, setTempMenuId] = useState<string | null>(null)
  // 名前の変更はブラウザ標準の入力小窓(window.prompt)ではなく、アプリの入力画面で行う
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null)
  const renameTempPlayer = (id: string) => {
    setRenaming({ id, name: localPlayers.find(p => p.id === id)?.name ?? "" })
  }
  const submitRename = () => {
    if (renaming && renaming.name.trim()) updateTempPlayerName(renaming.id, renaming.name.trim())
    setRenaming(null)
  }

  // ── 出す項目(2026-11-09)──────────────────────────────────────────────────
  // エントリーとリエントリーの金額・スタックが同じ大会は E だけ(+ は全部エントリーとして記録。
  // − はリエントリーがあれば先にそちらを減らす)。アドオンの金額もスタックも無い大会は A を出さない。
  const eqER = entryFee === reentryFee && entryStack === reentryStack
  const hasAddon = addonFee > 0 || addonStack > 0
  type Field = { key: string; label: string; value: (p: any) => number; plus: (p: any) => void; minus: (p: any) => void }
  const fields: Field[] = [
    eqER
      ? { key: 'E', label: 'Entry', value: p => (p.entryCount ?? 0) + (p.reentryCount ?? 0),
          plus: p => handleEntryChange(p.id, 'entryCount', 1),
          minus: p => handleEntryChange(p.id, (p.reentryCount ?? 0) > 0 ? 'reentryCount' : 'entryCount', -1) }
      : { key: 'E', label: 'Entry', value: p => p.entryCount ?? 0, plus: p => handleEntryChange(p.id, 'entryCount', 1), minus: p => handleEntryChange(p.id, 'entryCount', -1) },
    ...(eqER ? [] : [{ key: 'R', label: 'Re-entry', value: (p: any) => p.reentryCount ?? 0, plus: (p: any) => handleEntryChange(p.id, 'reentryCount', 1), minus: (p: any) => handleEntryChange(p.id, 'reentryCount', -1) }]),
    ...(hasAddon ? [{ key: 'A', label: 'Add-on', value: (p: any) => p.addonCount ?? 0, plus: (p: any) => handleEntryChange(p.id, 'addonCount', 1), minus: (p: any) => handleEntryChange(p.id, 'addonCount', -1) }] : []),
  ]
  const twoCol = fields.length <= 2

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', background: 'rgba(0,0,0,0.28)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)' }}
      onClick={onClose}
    >
      {renaming && (
        <div role="dialog" aria-modal="true" aria-label="仮プレイヤーの名前"
          style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={e => { e.stopPropagation(); setRenaming(null) }}>
          <div className="a-scrim" style={{ position: 'absolute', inset: 0 }} />
          <form className="a-dialog" onClick={e => e.stopPropagation()} onSubmit={e => { e.preventDefault(); submitRename() }}
            style={{ position: 'relative', width: '100%', maxWidth: 320, overflow: 'hidden' }}>
            <div style={{ padding: '24px 16px 16px', textAlign: 'center' }}>
              <p style={{ fontSize: 14, fontWeight: 600, margin: 0, color: 'var(--label)' }}>仮プレイヤーの名前</p>
              <input autoFocus value={renaming.name} maxLength={30}
                onChange={e => setRenaming(r => r && { ...r, name: e.target.value })}
                style={{ width: '100%', height: 44, marginTop: 16, borderRadius: 12, border: '1px solid var(--sep)', padding: '0 16px', fontSize: 16, color: 'var(--label)', background: '#fff', fontFamily: 'inherit', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderTop: '1px solid rgba(60,60,67,0.12)' }}>
              <button className="rr-btn is-mute is-sm" style={{ margin: 8 }} type="button" onClick={() => setRenaming(null)}>キャンセル</button>
              <button className="rr-btn is-solid is-sm" style={{ margin: 8 }} type="submit" disabled={!renaming.name.trim()}>保存</button>
            </div>
          </form>
        </div>
      )}
      <div ref={sheetDrag}
        style={{ width: '100%', maxWidth: 480, background: 'rgba(255,255,255,0.94)', backdropFilter: 'blur(40px) saturate(200%)', WebkitBackdropFilter: 'blur(40px) saturate(200%)', borderRadius: '34px 34px 0 0', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9), 0 4px 12px rgba(0,0,0,0.06), 0 28px 68px rgba(0,0,0,0.16)', maxHeight: '94vh', display: 'flex', flexDirection: 'column', paddingBottom: 'max(8px, env(safe-area-inset-bottom, 8px))' }}
        onClick={e => e.stopPropagation()}
      >
        {/* ドラッグハンドル */}
        <div className="a-grabber" />

        {/* ヘッダー */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 16px 8px', flexShrink: 0, borderBottom: '1px solid #F2F2F7' }}>
          <RingButton label="閉じる" onClick={onClose} icon={<FiX />} />
          <span style={{ fontSize: 17, fontWeight: 700, color: '#1C1C1E' }}>Players</span>
          <button className="rr-ok"
            onClick={handleSave}
            disabled={isSaving}
            style={{ width: 34, height: 34, borderRadius: '50%', background: isSaving ? '#E5E5EA' : 'linear-gradient(135deg,#34C759,#2DAD4D)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: isSaving ? 'default' : 'pointer', boxShadow: isSaving ? 'none' : '0 2px 8px rgba(52,199,89,0.35)', fontSize: 18, color: '#fff', lineHeight: 1 }}
          >{isSaving ? '…' : '✓'}</button>
        </div>

        {/* スクロール可能ボディ */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '8px 8px 8px' }}>
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "48px 0" }}><Loader /></div>
          ) : error ? (
            <p style={{ textAlign: 'center', color: '#FF3B30', padding: '48px 0', fontSize: 13 }}>{error}</p>
          ) : (
            <>
              {/* 上の数字(Players・Re-entry・Add-on・Bust)。変えた分は「10/18→11/19」と赤で出す(2026-11-09) */}
              {(() => {
                const sum = (list: any[], f: string) => list.reduce((a, p) => a + (p[f] ?? 0), 0)
                const tE = sum(localPlayers, 'entryCount') + sum(localPlayers, 'reentryCount')
                const oE = sum(originalPlayers, 'entryCount') + sum(originalPlayers, 'reentryCount')
                const oBust = origBust ?? localBust
                const cells: { label: string; now: string; before: string }[] = [
                  { label: 'Players', now: `${tE - localBust}/${tE}`, before: `${oE - oBust}/${oE}` },
                  ...(eqER ? [] : [{ label: 'Re-entry', now: String(sum(localPlayers, 'reentryCount')), before: String(sum(originalPlayers, 'reentryCount')) }]),
                  ...(hasAddon ? [{ label: 'Add-on', now: String(sum(localPlayers, 'addonCount')), before: String(sum(originalPlayers, 'addonCount')) }] : []),
                ]
                return (
                  <div style={{ display: 'flex', alignItems: 'stretch', gap: 8, marginBottom: 8 }}>
                    <div style={{ flex: 1, display: 'grid', gridTemplateColumns: `repeat(${cells.length}, 1fr)`, background: '#F2F2F7', borderRadius: 12, padding: '8px 4px' }}>
                      {cells.map((c, i) => (
                        <div key={c.label} style={{ textAlign: 'center', borderLeft: i ? '1px solid #D1D1D6' : 'none', minWidth: 0 }}>
                          <p className="tech-label" style={{ fontSize: 9, color: 'var(--label3)' }}>{c.label}</p>
                          <p className="tech-num" style={{ fontSize: 15, fontWeight: 800, color: '#1C1C1E', lineHeight: 1.2 }}>{c.now}</p>
                          {originalPlayers.length > 0 && c.before !== c.now && <p className="tech-num" style={{ fontSize: 9, fontWeight: 700, color: '#C62828', lineHeight: 1.1 }}>{c.before}→{c.now}</p>}
                        </div>
                      ))}
                    </div>
                    {/* Bust */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 0, background: '#F2F2F7', borderRadius: 12, padding: '0 4px' }}>
                      <StepButton kind="minus" label="バストを減らす" size={24} hit={32} disabled={localBust <= 0} onClick={() => handleTournamentBustChange(-1)} />
                      <div style={{ textAlign: 'center', minWidth: 34 }}>
                        <p className="tech-label" style={{ fontSize: 9, color: 'var(--label3)' }}>Bust</p>
                        <p className="tech-num" style={{ fontSize: 15, fontWeight: 800, color: '#1C1C1E', lineHeight: 1.2 }}>{localBust}</p>
                        {origBust !== null && origBust !== localBust && <p className="tech-num" style={{ fontSize: 9, fontWeight: 700, color: '#C62828', lineHeight: 1.1 }}>{origBust}→{localBust}</p>}
                      </div>
                      <StepButton kind="plus" label="バストを増やす" size={24} hit={32} onClick={() => handleTournamentBustChange(1)} />
                    </div>
                  </div>
                )
              })()}

              {/* 検索と仮プレイヤーの追加を 1 行に */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, marginBottom: 8 }}>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="検索"
                  style={{ width: '100%', height: 36, padding: '0 16px', fontSize: 13, color: '#1C1C1E', boxSizing: 'border-box', minWidth: 0 }} />
                <input value={newTempName} onChange={e => setNewTempName(e.target.value)} placeholder="仮プレイヤー名"
                  onKeyDown={e => { if (e.key === 'Enter') addTempPlayer() }}
                  style={{ width: '100%', height: 36, padding: '0 16px', fontSize: 13, color: '#1C1C1E', boxSizing: 'border-box', minWidth: 0 }} />
                <button className="rr-btn is-gold is-sm" style={{ letterSpacing: 1 }} onClick={addTempPlayer} aria-label="仮プレイヤーを追加">＋ Add</button>
              </div>

              {/* プレイヤー。E と R が同じ大会は E だけ、アドオンが無い大会は A を出さない。
                   E・R・A を全部出すときは 1 列、それ以外は 2 列(2026-11-09) */}
              {allPlayers.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--label3)', padding: '24px 0', fontSize: 13 }}>プレイヤーが見つかりません</p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: twoCol ? '1fr 1fr' : '1fr', gap: 8 }}>
                  {allPlayers.map(player => {
                    const preview = computePreview(player)
                    const extra = playerExtras[player.id]
                    const before = originalPlayers.find(p => p.id === player.id)
                    const entered = ((player.entryCount ?? 0) + (player.reentryCount ?? 0)) > 0
                    return (
                      <div key={player.id} style={{ background: player.isTemp ? 'rgba(242,169,0,0.06)' : entered ? '#fff' : '#F2F2F7', borderRadius: 12, padding: '8px 8px 8px', boxShadow: entered || player.isTemp ? '0 1px 3px rgba(0,0,0,0.08)' : 'none', position: 'relative', minWidth: 0 }}>
                        {/* 名前の行 */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 24 }}>
                          {!player.isTemp && <PlayerAvatar src={player.iconUrl} size={20} />}
                          <span style={{ fontSize: 12, fontWeight: 700, color: entered || player.isTemp ? '#1C1C1E' : 'var(--label2)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{player.name}</span>
                          {player.isTemp && <span className="tech-label" style={{ fontSize: 9, color: '#D4910A' }}>TEMP</span>}
                          {player.isTemp && (
                            <button onClick={() => setTempMenuId(id => id === player.id ? null : player.id)} aria-label="仮プレイヤーの操作"
                              style={{ width: 28, height: 24, margin: '-4px -4px -4px 0', borderRadius: 8, background: 'none', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--label2)' }}>
                              <FiMoreHorizontal size={16} />
                            </button>
                          )}
                          {player.isTemp && tempMenuId === player.id && (
                            <div style={{ position: 'absolute', top: 30, right: 4, zIndex: 5, background: '#fff', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.16)', border: '1px solid #E5E5EA', overflow: 'hidden', minWidth: 132 }}>
                              <button onClick={() => { setTempMenuId(null); renameTempPlayer(player.id) }}
                                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 16px', background: 'none', border: 'none', fontSize: 13, fontWeight: 600, color: '#1C1C1E', cursor: 'pointer', textAlign: 'left' }}>
                                <FiEdit2 size={14} /> 名前を変更
                              </button>
                              <button onClick={() => { setTempMenuId(null); deleteTempPlayer(player.id) }}
                                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 16px', background: 'none', border: 'none', borderTop: '1px solid #F2F2F7', fontSize: 13, fontWeight: 600, color: '#C62828', cursor: 'pointer', textAlign: 'left' }}>
                                <FiTrash2 size={14} /> 削除
                              </button>
                            </div>
                          )}
                        </div>

                        {/* 残高(1 行・小さく)。変わるときは → のあとに確定後の残高 */}
                        {!player.isTemp && extra && (
                          <p className="tech-num" style={{ display: 'flex', alignItems: 'baseline', gap: 4, flexWrap: 'wrap', fontSize: 10, color: 'var(--label2)', margin: '4px 0 4px', lineHeight: 1.3 }}>
                            <span style={{ fontWeight: 700, color: '#D4910A' }}>BR</span>
                            <span style={{ fontWeight: 700, color: '#1C1C1E' }}>{fmtChip(extra.currentBalance, chipUnit, chipUnitBefore)}</span>
                            {preview && preview.totalPurchase > 0 && <span style={{ fontWeight: 700, color: '#1E7B34' }}>+{fmtChip(preview.totalPurchase, chipUnit, chipUnitBefore)}</span>}
                            {preview && preview.netFee !== 0 && <span style={{ fontWeight: 700, color: preview.netFee > 0 ? '#1E7B34' : '#C62828' }}>{preview.netFee > 0 ? '+' : ''}{fmtChip(preview.netFee, chipUnit, chipUnitBefore)}</span>}
                            {preview && <><span>→</span><span style={{ fontWeight: 700, color: preview.finalBalance < 0 ? '#C62828' : '#1C1C1E' }}>{fmtChip(preview.finalBalance, chipUnit, chipUnitBefore)}</span></>}
                          </p>
                        )}

                        {/* 増減。数の下に、変えた分を「0→1」と赤で */}
                        <div style={{ display: 'grid', gridTemplateColumns: twoCol ? '1fr' : `repeat(${fields.length}, 1fr)`, gap: 0 }}>
                          {fields.map(f => {
                            const now = f.value(player)
                            const was = before ? f.value(before) : 0
                            return (
                              <div key={f.key} style={{ display: 'flex', alignItems: 'center', justifyContent: twoCol ? 'space-between' : 'center', gap: 4 }}>
                                <span className="tech-label" style={{ fontSize: 9, color: 'var(--label2)', width: 12 }}>{f.key}</span>
                                <StepButton kind="minus" label={`${f.label}を減らす`} size={24} hit={30} disabled={now <= 0} onClick={() => f.minus(player)} />
                                <span style={{ position: 'relative', minWidth: 22, textAlign: 'center' }}>
                                  <span className="tech-num" style={{ fontSize: 14, fontWeight: 800, color: '#1C1C1E' }}>{now}</span>
                                  {now !== was && <span className="tech-num" style={{ position: 'absolute', left: '50%', top: '100%', transform: 'translateX(-50%)', fontSize: 9, fontWeight: 700, color: '#C62828', whiteSpace: 'nowrap', lineHeight: 1 }}>{was}→{now}</span>}
                                </span>
                                <StepButton kind="plus" label={`${f.label}を増やす`} size={24} hit={30} onClick={() => f.plus(player)} />
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

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
                <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(255,59,48,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 26 }}><TriangleAlert size={26} strokeWidth={2} color="#C62828" aria-hidden /></div>
                <p style={{ fontSize: 15, fontWeight: 700, color: '#1C1C1E', marginBottom: 8 }}>所持バンクロール不足</p>
                <p style={{ fontSize: 13, color: 'var(--label3)', lineHeight: 1.5 }}>会計をしてください</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '0 16px 24px' }}>
                <button className="rr-btn is-mute" style={{ minHeight: 48 }}
                  onClick={() => setInsufficientAlert(null)}
                >キャンセル</button>
                <button className="rr-btn is-solid" style={{ minHeight: 48 }}
                  onClick={confirmInsufficientPurchase}
                >確認</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
