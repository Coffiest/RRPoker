"use client"

import PlayerHistoryModal from "@/app/components/PlayerHistoryModal"
import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { auth, db } from "@/lib/firebase"
import HomeHeader from "@/components/HomeHeader"
import { getCommonMenuItems } from "@/components/commonMenuItems"
import PlayerManageModal from "./PlayerManageModal"
import PrizeDistributeModal from "./PrizeDistributeModal"
import { Timestamp } from "firebase/firestore"
import {
  collection, doc, deleteField, getDoc, increment,
  onSnapshot, query, serverTimestamp, setDoc, updateDoc, where,
} from "firebase/firestore"
import {
  FiPlus, FiMinus, FiCopy, FiHome, FiUser, FiPlay, FiPause,
  FiSkipForward, FiSkipBack, FiUsers, FiTrendingUp, FiDollarSign,
  FiClock, FiCheck, FiX, FiSearch, FiLogOut, FiEdit3, FiChevronRight,
} from "react-icons/fi"

type StoreInfo = { name: string; iconUrl?: string; code: string }
type DepositRequest = { id: string; playerId: string; amount: number; comment?: string }
type WithdrawRequest = { id: string; playerId: string; amount: number; comment?: string }
type PlayerInfo = { id: string; name?: string; iconUrl?: string; visitCount?: number; lastVisitedAt?: Date | null }

export default function StorePage() {
  const getVisitCountResetBase = (date: Date) => {
    const base = new Date(date); base.setHours(3, 0, 0, 0)
    if (date.getHours() < 3) base.setDate(base.getDate() - 1)
    return base.getTime()
  }

  const [timerRunning, setTimerRunning] = useState<Record<string, boolean>>({})
  const [adjustModalOpen, setAdjustModalOpen] = useState<Record<string, boolean>>({})
  const [adjustSeconds, setAdjustSeconds] = useState<Record<string, number>>({})

  const openAdjustModal = (id: string, s: number) => {
    setAdjustModalOpen(p => ({ ...p, [id]: true }))
    setAdjustSeconds(p => ({ ...p, [id]: s }))
  }
  const closeAdjustModal = (id: string) => setAdjustModalOpen(p => ({ ...p, [id]: false }))
  const updateAdjustTime = (id: string, diff: number) =>
    setAdjustSeconds(p => ({ ...p, [id]: Math.max(0, (p[id] ?? 0) + diff) }))
  const confirmAdjustTime = async (id: string) => {
    if (!storeId) return
    await updateDoc(doc(db, "stores", storeId, "tournaments", id), { timeRemaining: adjustSeconds[id] })
    closeAdjustModal(id)
  }
  const toggleTimer = async (id: string) => {
    timerRunning[id] ? await pauseTimer(id) : await resumeTimer(id)
  }

  const router = useRouter()

  async function startTimer(id: string) {
    if (!storeId) return
    await updateDoc(doc(db, "stores", storeId, "tournaments", id), { timerRunning: true, levelStartedAt: serverTimestamp(), pausedAt: null })
  }
  async function resumeTimer(id: string) {
    if (!storeId) return
    const ref = doc(db, "stores", storeId, "tournaments", id)
    const snap = await getDoc(ref); const data = snap.data()
    if (!data?.pausedAt || !data?.levelStartedAt) { await startTimer(id); return }
    const now = Timestamp.now().toMillis()
    const pausedMs = now - data.pausedAt.toMillis()
    let startedAtMs: number
    if (data.levelStartedAt?.toMillis) startedAtMs = data.levelStartedAt.toMillis()
    else if (data.levelStartedAt instanceof Date) startedAtMs = data.levelStartedAt.getTime()
    else if (typeof data.levelStartedAt === "number") startedAtMs = data.levelStartedAt
    else { await startTimer(id); return }
    await updateDoc(ref, { timerRunning: true, levelStartedAt: Timestamp.fromMillis(startedAtMs + pausedMs), pausedAt: null })
  }
  async function stopTimer(id: string) {
    if (!storeId) return
    await updateDoc(doc(db, "stores", storeId, "tournaments", id), { timerRunning: false })
  }
  function getNextLevelDurationSeconds(tournament: any, nextIndex: number) {
    const custom = Array.isArray(tournament.customBlindLevels) ? tournament.customBlindLevels : null
    const defaults = [
      { smallBlind:15,bigBlind:30,ante:30,duration:20 }, { smallBlind:20,bigBlind:40,ante:40,duration:20 },
      { smallBlind:25,bigBlind:50,ante:50,duration:20 }, { smallBlind:30,bigBlind:60,ante:60,duration:20 },
      { smallBlind:40,bigBlind:80,ante:80,duration:20 }, { smallBlind:50,bigBlind:100,ante:100,duration:20 },
      { smallBlind:75,bigBlind:150,ante:150,duration:20 }, { smallBlind:100,bigBlind:200,ante:200,duration:20 },
    ]
    const levels = custom && custom.length > 0 ? custom : defaults
    const level = levels[Math.min(nextIndex, levels.length - 1)]
    if (!level) return 0
    return (typeof level.duration === "number" && level.duration > 0 ? level.duration : 20) * 60
  }
  async function nextLevel(id: string) {
    if (!storeId) return
    const ref = doc(db, "stores", storeId, "tournaments", id)
    const snap = await getDoc(ref); const data = snap.data()
    if (!data) return
    const current = typeof data.currentLevelIndex === "number" ? data.currentLevelIndex : 0
    const t = activeTournaments.find(t => t.id === id); if (!t) return
    const custom = Array.isArray(t.customBlindLevels) ? t.customBlindLevels : null
    const defaults = [
      { smallBlind:15,bigBlind:30,ante:30,duration:20 }, { smallBlind:20,bigBlind:40,ante:40,duration:20 },
      { smallBlind:25,bigBlind:50,ante:50,duration:20 }, { smallBlind:30,bigBlind:60,ante:60,duration:20 },
      { smallBlind:40,bigBlind:80,ante:80,duration:20 }, { smallBlind:50,bigBlind:100,ante:100,duration:20 },
      { smallBlind:75,bigBlind:150,ante:150,duration:20 }, { smallBlind:100,bigBlind:200,ante:200,duration:20 },
    ]
    const levels = custom && custom.length > 0 ? custom : defaults
    const nextIdx = Math.min(current + 1, levels.length - 1)
    const nextLevel = levels[nextIdx]
    const dur = typeof nextLevel?.duration === "number" && nextLevel.duration > 0 ? nextLevel.duration * 60 : 1200
    await updateDoc(ref, { currentLevelIndex: nextIdx, timeRemaining: dur, levelStartedAt: serverTimestamp(), pausedAt: null, timerRunning: false })
  }
  async function pauseTimer(id: string) {
    if (!storeId) return
    await updateDoc(doc(db, "stores", storeId, "tournaments", id), { timerRunning: false, pausedAt: serverTimestamp() })
  }
  async function prevLevel(id: string, currentLevel: number) {
    if (!storeId) return
    const ref = doc(db, "stores", storeId, "tournaments", id)
    const snap = await getDoc(ref); const data = snap.data()
    if (!data) return
    const t = activeTournaments.find(t => t.id === id); if (!t) return
    const custom = Array.isArray(t.customBlindLevels) ? t.customBlindLevels : null
    const defaults = [
      { smallBlind:15,bigBlind:30,ante:30,duration:20 }, { smallBlind:20,bigBlind:40,ante:40,duration:20 },
      { smallBlind:25,bigBlind:50,ante:50,duration:20 }, { smallBlind:30,bigBlind:60,ante:60,duration:20 },
      { smallBlind:40,bigBlind:80,ante:80,duration:20 }, { smallBlind:50,bigBlind:100,ante:100,duration:20 },
      { smallBlind:75,bigBlind:150,ante:150,duration:20 }, { smallBlind:100,bigBlind:200,ante:200,duration:20 },
    ]
    const levels = custom && custom.length > 0 ? custom : defaults
    const prevIdx = Math.max(0, currentLevel - 1)
    const prevLvl = levels[prevIdx]
    const dur = typeof prevLvl?.duration === "number" && prevLvl.duration > 0 ? prevLvl.duration * 60 : 1200
    await updateDoc(ref, { currentLevelIndex: prevIdx, timeRemaining: dur, levelStartedAt: serverTimestamp(), pausedAt: null, timerRunning: false })
  }

  const [role, setRole] = useState<string | null>(null)
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (user) => {
      if (!user) { router.replace("/"); return }
      const snap = await getDoc(doc(db, "users", user.uid))
      const userRole = snap.data()?.role ?? null
      setRole(userRole)
      if (userRole !== "store") router.replace("/home")
    })
    return () => unsub()
  }, [router])

  const [storeId, setStoreId] = useState<string | null>(null)
  const [activeTournaments, setActiveTournaments] = useState<any[]>([])
  const [showPlayerModal, setShowPlayerModal] = useState<string | null>(null)
  const [showPrizeModal, setShowPrizeModal] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"in" | "out">("in")
  const [storePlayersPage, setStorePlayersPage] = useState(1)
  const pageSize = 10

  useEffect(() => {
    if (!storeId) return
    const q = query(collection(db, "stores", storeId, "tournaments"), where("status", "==", "active"))
    const unsub = onSnapshot(q, (snap) => {
      const list: any[] = []
      for (const d of snap.docs) {
        const data = d.data()
        const entry = data.totalEntry ?? 0, reentry = data.totalReentry ?? 0, addon = data.totalAddon ?? 0
        const bustCount = data.bustCount ?? 0
        list.push({
          id: d.id, name: data.name, entry, reentry, addon, bustCount,
          entryStack: data.entryStack ?? 0, reentryStack: data.reentryStack ?? 0, addonStack: data.addonStack ?? 0,
          totalEntries: entry + reentry, alive: (entry + reentry) - bustCount,
          status: data.status ?? "scheduled", currentLevelIndex: data.currentLevelIndex ?? 0,
          timeRemaining: data.timeRemaining ?? 1200, selectedPreset: data.selectedPreset ?? "",
          customBlindLevels: Array.isArray(data.customBlindLevels) ? data.customBlindLevels : null,
          timerRunning: data.timerRunning ?? false,
        })
      }
      setActiveTournaments(list)
      const map: Record<string, boolean> = {}
      list.forEach(t => { map[t.id] = t.timerRunning ?? false })
      setTimerRunning(map)
    })
    return () => unsub()
  }, [storeId])

  const [store, setStore] = useState<StoreInfo | null>(null)
  const [depositRequests, setDepositRequests] = useState<DepositRequest[]>([])
  const [withdrawRequests, setWithdrawRequests] = useState<WithdrawRequest[]>([])
  const [players, setPlayers] = useState<PlayerInfo[]>([])
  const [pendingPlayers, setPendingPlayers] = useState<PlayerInfo[]>([])
  const [historyPlayerId, setHistoryPlayerId] = useState<string | null>(null)
  const [playerBalances, setPlayerBalances] = useState<Record<string, number>>({})
  const [playerSearchInput, setPlayerSearchInput] = useState("")
  const [selectedPlayerId, setSelectedPlayerId] = useState("")
  const [selectedPlayerBalance, setSelectedPlayerBalance] = useState(0)
  const [selectedPlayerNetGain, setSelectedPlayerNetGain] = useState(0)
  const [adjustValue, setAdjustValue] = useState("")
  const [adjustError, setAdjustError] = useState("")
  const [manualNetGain, setManualNetGain] = useState(false)
  const [storePlayers, setStorePlayers] = useState<any[]>([])
  const [removingAdjustmentPlayerIds, setRemovingAdjustmentPlayerIds] = useState<string[]>([])
  const [adjustModalPlayer, setAdjustModalPlayer] = useState<any | null>(null)
  const [depositOtherOpenId, setDepositOtherOpenId] = useState<string | null>(null)
  const [withdrawOtherOpenId, setWithdrawOtherOpenId] = useState<string | null>(null)
  const [depositOtherNetGain, setDepositOtherNetGain] = useState(false)
  const [withdrawOtherNetGain, setWithdrawOtherNetGain] = useState(false)
  const [depositOtherComment, setDepositOtherComment] = useState("")
  const [withdrawOtherComment, setWithdrawOtherComment] = useState("")
  const [copiedCode, setCopiedCode] = useState(false)

  useEffect(() => {
    if (!playerSearchInput) return
    const kw = playerSearchInput.toLowerCase()
    const hitIn = storePlayers.filter(p => p.isInStore && (p.name ?? "").toLowerCase().includes(kw))
    const hitOut = storePlayers.filter(p => !p.isInStore && (p.name ?? "").toLowerCase().includes(kw))
    if (hitOut.length > 0 && hitIn.length === 0) setActiveTab("out")
    if (hitIn.length > 0 && hitOut.length === 0) setActiveTab("in")
  }, [playerSearchInput, storePlayers])

  useEffect(() => {
    if (!storeId) return
    const unsub = onSnapshot(collection(db, "users"), async (snap) => {
      const list: any[] = []
      for (const d of snap.docs) {
        if (d.id.startsWith("temp_")) continue
        const data = d.data()
        if (!data.joinedStores?.includes(storeId)) continue
        const balSnap = await getDoc(doc(db, "users", d.id, "storeBalances", storeId))
        const bal = balSnap.exists() ? balSnap.data() : {}
        list.push({
          id: d.id, name: data.name, iconUrl: data.iconUrl,
          balance: bal.balance ?? 0, netGain: bal.netGain ?? 0,
          lastVisitedAt: bal.lastVisitedAt?.toDate?.() ?? null,
          isInStore: data.currentStoreId === storeId,
        })
      }
      list.sort((a, b) => (b.lastVisitedAt?.getTime() ?? 0) - (a.lastVisitedAt?.getTime() ?? 0))
      setStorePlayers(list)
    })
    return () => unsub()
  }, [storeId])

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async user => {
      if (!user) return
      const snap = await getDoc(doc(db, "users", user.uid))
      setStoreId(snap.data()?.storeId ?? null)
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    if (!storeId) return
    getDoc(doc(db, "stores", storeId)).then(snap => { if (snap.data()) setStore(snap.data() as StoreInfo) })
  }, [storeId])

  useEffect(() => {
    if (!storeId) return
    const q = query(collection(db, "depositRequests"), where("storeId", "==", storeId), where("status", "==", "pending"))
    const unsub = onSnapshot(q, snap => {
      const list: DepositRequest[] = []
      snap.forEach(d => list.push({ id: d.id, playerId: d.data().playerId, amount: d.data().amount, comment: d.data().comment }))
      setDepositRequests(list)
    })
    return () => unsub()
  }, [storeId])

  useEffect(() => {
    if (!storeId) return
    const q = query(collection(db, "withdrawRequests"), where("storeId", "==", storeId), where("status", "==", "pending"))
    const unsub = onSnapshot(q, snap => {
      const list: WithdrawRequest[] = []
      snap.forEach(d => list.push({ id: d.id, playerId: d.data().playerId, amount: d.data().amount, comment: d.data().comment }))
      setWithdrawRequests(list)
    })
    return () => unsub()
  }, [storeId])

  useEffect(() => {
    if (!storeId) return
    const q = query(collection(db, "users"), where("currentStoreId", "==", storeId))
    const unsub = onSnapshot(q, snap => {
      const list: PlayerInfo[] = []
      snap.forEach(d => list.push({ id: d.id, name: d.data().name, iconUrl: d.data().iconUrl }))
      setPlayers(list)
    })
    return () => unsub()
  }, [storeId])

  useEffect(() => {
    if (!storeId) return
    const q = query(collection(db, "users"), where("pendingStoreId", "==", storeId))
    const unsub = onSnapshot(q, async snap => {
      const list: PlayerInfo[] = []
      for (const d of snap.docs) {
        const data = d.data()
        if (data.checkinStatus !== "pending") continue
        const balSnap = await getDoc(doc(db, "users", d.id, "storeBalances", storeId))
        const b = balSnap.exists() ? balSnap.data() : {}
        list.push({ id: d.id, name: data.name, iconUrl: data.iconUrl, visitCount: b.visitCount ?? 0, lastVisitedAt: b.lastVisitedAt?.toDate?.() ?? null })
      }
      setPendingPlayers(list.reverse())
    })
    return () => unsub()
  }, [storeId])

  const playerMap = useMemo(() => { const m: Record<string, any> = {}; storePlayers.forEach(p => (m[p.id] = p)); return m }, [storePlayers])

  const inPlayers = useMemo(() => {
    const list = storePlayers.filter(p => p.isInStore).sort((a, b) => (b.lastVisitedAt?.getTime() ?? 0) - (a.lastVisitedAt?.getTime() ?? 0))
    if (!playerSearchInput) return list
    const kw = playerSearchInput.toLowerCase()
    const exact = list.filter(p => (p.name ?? "").toLowerCase() === kw)
    const partial = list.filter(p => (p.name ?? "").toLowerCase().includes(kw) && (p.name ?? "").toLowerCase() !== kw)
    const others = list.filter(p => !(p.name ?? "").toLowerCase().includes(kw))
    return [...exact, ...partial, ...others]
  }, [storePlayers, playerSearchInput])

  const outPlayers = useMemo(() => {
    const list = storePlayers.filter(p => !p.isInStore).sort((a, b) => (b.lastVisitedAt?.getTime() ?? 0) - (a.lastVisitedAt?.getTime() ?? 0))
    if (!playerSearchInput) return list
    const kw = playerSearchInput.toLowerCase()
    const exact = list.filter(p => (p.name ?? "").toLowerCase() === kw)
    const partial = list.filter(p => (p.name ?? "").toLowerCase().includes(kw) && (p.name ?? "").toLowerCase() !== kw)
    const others = list.filter(p => !(p.name ?? "").toLowerCase().includes(kw))
    return [...exact, ...partial, ...others]
  }, [storePlayers, playerSearchInput])

  const filteredPlayers = useMemo(() => {
    if (!playerSearchInput) return storePlayers
    const q = playerSearchInput.toLowerCase()
    return storePlayers.filter(p => (p.name ?? "").toLowerCase().includes(q) || p.id.toLowerCase().includes(q))
  }, [playerSearchInput, storePlayers])

  const selectPlayer = async (playerId: string) => {
    setSelectedPlayerId(playerId); setPlayerSearchInput("")
    if (!storeId) return
    const snap = await getDoc(doc(db, "users", playerId, "storeBalances", storeId))
    if (snap.exists()) { setSelectedPlayerBalance(snap.data()?.balance ?? 0); setSelectedPlayerNetGain(snap.data()?.netGain ?? 0) }
    else { setSelectedPlayerBalance(0); setSelectedPlayerNetGain(0) }
  }

  const approveDepositWithType = async (req: DepositRequest, type: "cashout" | "chip" | "other") => {
    if (!storeId) return
    const balRef = doc(db, "users", req.playerId, "storeBalances", storeId)
    let bDiff = 0, nDiff = 0, txType = ""
    if (type === "cashout") { bDiff = req.amount; nDiff = req.amount; txType = "store_cashout" }
    if (type === "chip") { bDiff = req.amount; nDiff = 0; txType = "store_chip_purchase" }
    if (type === "other") { bDiff = req.amount; nDiff = depositOtherNetGain ? req.amount : 0; txType = "other" }
    const updates: any = { balance: increment(bDiff) }
    if (nDiff !== 0) updates.netGain = increment(nDiff)
    await updateDoc(balRef, updates)
    await updateDoc(doc(db, "depositRequests", req.id), { status: "approved" })
    await setDoc(doc(collection(db, "transactions")), {
      storeId, playerId: req.playerId, playerName: playerMap[req.playerId]?.name ?? null,
      amount: req.amount, direction: "add", type: txType,
      comment: type === "other" ? depositOtherComment : null, createdAt: serverTimestamp(),
    })
  }

  const approveWithdrawWithType = async (req: WithdrawRequest, type: "buyin" | "tE" | "tR" | "tA" | "other") => {
    if (!storeId) return
    const balRef = doc(db, "users", req.playerId, "storeBalances", storeId)
    let bDiff = 0, nDiff = 0, txType = ""
    if (type === "buyin") { bDiff = -req.amount; nDiff = -req.amount; txType = "store_buyin" }
    if (type === "tE") { bDiff = -req.amount; nDiff = -req.amount; txType = "store_tournament_entry" }
    if (type === "tR") { bDiff = -req.amount; nDiff = -req.amount; txType = "store_tournament_reentry" }
    if (type === "tA") { bDiff = -req.amount; nDiff = -req.amount; txType = "store_tournament_addon" }
    if (type === "other") { bDiff = -req.amount; nDiff = withdrawOtherNetGain ? -req.amount : 0; txType = "other" }
    const updates: any = { balance: increment(bDiff) }
    if (nDiff !== 0) updates.netGain = increment(nDiff)
    await updateDoc(balRef, updates)
    await updateDoc(doc(db, "withdrawRequests", req.id), { status: "approved" })
    await setDoc(doc(collection(db, "transactions")), {
      storeId, playerId: req.playerId, playerName: playerMap[req.playerId]?.name ?? null,
      amount: req.amount, direction: "subtract", type: txType,
      comment: type === "other" ? withdrawOtherComment : null, createdAt: serverTimestamp(),
    })
  }

  const rejectDeposit = async (req: DepositRequest) => { await updateDoc(doc(db, "depositRequests", req.id), { status: "rejected" }) }
  const rejectWithdraw = async (req: WithdrawRequest) => { await updateDoc(doc(db, "withdrawRequests", req.id), { status: "rejected" }) }

  const runAdjustment = async (direction: "add" | "subtract", isNetGain: boolean) => {
    if (!storeId || !adjustModalPlayer) { setAdjustError("プレイヤーを選択してください"); return }
    const amount = Number(adjustValue)
    if (!amount || amount < 1) { setAdjustError("数字は1以上で入力してください"); return }
    setAdjustError("")
    const pid = adjustModalPlayer.id
    const balRef = doc(db, "users", pid, "storeBalances", storeId)
    const balSnap = await getDoc(balRef)
    const current = balSnap.data()?.balance ?? 0
    const currentNG = balSnap.data()?.netGain ?? 0
    if (direction === "subtract" && current < amount) { setAdjustError("残高が不足しています"); return }
    if (!balSnap.exists()) {
      const newBal = direction === "add" ? amount : 0
      const newNG = isNetGain && direction === "add" ? amount : 0
      await setDoc(balRef, { balance: newBal, netGain: newNG, storeId }, { merge: true })
      setSelectedPlayerBalance(newBal); setSelectedPlayerNetGain(newNG)
    } else {
      const updates: Record<string, any> = { balance: increment(direction === "add" ? amount : -amount) }
      if (isNetGain) updates.netGain = increment(direction === "add" ? amount : -amount)
      await updateDoc(balRef, updates)
      setSelectedPlayerBalance(direction === "add" ? current + amount : current - amount)
      if (isNetGain) setSelectedPlayerNetGain(direction === "add" ? currentNG + amount : currentNG - amount)
    }
    await setDoc(doc(collection(db, "transactions")), {
      storeId, playerId: pid, playerName: adjustModalPlayer.name ?? null, amount, direction,
      type: isNetGain ? "manual_adjustment_net_gain" : "manual_adjustment", createdAt: serverTimestamp(),
    })
    setAdjustValue(""); setSelectedPlayerBalance(direction === "add" ? current + amount : current - amount)
  }

  const runStoreAdjustment = async (adjustType: string) => {
    if (!storeId || !adjustModalPlayer) return
    const amount = Number(adjustValue)
    if (!amount || amount < 1) return
    const pid = adjustModalPlayer.id
    const balRef = doc(db, "users", pid, "storeBalances", storeId)
    let bDiff = 0, nDiff = 0, type = "", direction: "add" | "subtract" = "add"
    switch (adjustType) {
      case "buyin": bDiff = -amount; nDiff = -amount; type = "store_buyin"; direction = "subtract"; break
      case "cashout": bDiff = amount; nDiff = amount; type = "store_cashout"; break
      case "chip": bDiff = amount; nDiff = 0; type = "store_chip_purchase"; break
      case "tE": bDiff = -amount; nDiff = -amount; type = "store_tournament_entry"; direction = "subtract"; break
      case "tR": bDiff = -amount; nDiff = -amount; type = "store_tournament_reentry"; direction = "subtract"; break
      case "tA": bDiff = -amount; nDiff = -amount; type = "store_tournament_addon"; direction = "subtract"; break
      default: return
    }
    const updates: any = { balance: increment(bDiff) }
    if (nDiff !== 0) updates.netGain = increment(nDiff)
    await updateDoc(balRef, updates)
    setStorePlayers(prev => prev.map(p => p.id === pid ? { ...p, balance: p.balance + bDiff, netGain: nDiff !== 0 ? p.netGain + nDiff : p.netGain } : p))
    await setDoc(doc(collection(db, "transactions")), { storeId, playerId: pid, playerName: adjustModalPlayer.name ?? null, amount, direction, type, createdAt: serverTimestamp() })
    setAdjustModalPlayer(null); setAdjustValue("")
  }

  const runPrizeAdjustment = async () => {
  if (!storeId || !adjustModalPlayer) return

  const amount = Number(adjustValue)
  if (!amount || amount < 1) return

  const pid = adjustModalPlayer.id

  const balRef = doc(db, "users", pid, "storeBalances", storeId)

  // バンクロール & 純増 両方加算
  await updateDoc(balRef, {
    balance: increment(amount),
    netGain: increment(amount),
  })

  // トランザクション履歴
  await setDoc(doc(collection(db, "transactions")), {
    storeId,
    playerId: pid,
    playerName: adjustModalPlayer.name ?? null,
    amount: amount,
    direction: "add",
    type: "tournament_payout",
    createdAt: serverTimestamp(),
  })

  // UI更新
  setStorePlayers(prev =>
    prev.map(p =>
      p.id === pid
        ? { ...p, balance: p.balance + amount, netGain: p.netGain + amount }
        : p
    )
  )

  setAdjustModalPlayer(null)
  setAdjustValue("")
}

  const approvePlayer = async (playerId: string) => {
    if (!storeId) return
    const storeSnap = await getDoc(doc(db, "stores", storeId)); const storeData = storeSnap.data()
    await setDoc(doc(db, "users", playerId), { currentStoreId: storeId, checkinStatus: "approved", pendingStoreId: null }, { merge: true })
    const balRef = doc(db, "users", playerId, "storeBalances", storeId)
    const balSnap = await getDoc(balRef); const now = new Date(); const ts = serverTimestamp()
    let cb = 0, cn = 0, vc = 0, incr = true
    if (balSnap.exists()) {
      const b = balSnap.data(); cb = b.balance ?? 0; cn = b.netGain ?? 0; vc = b.visitCount ?? 0
      const lv = b.lastVisitCountedAt?.toDate?.() ?? null
      if (lv && getVisitCountResetBase(now) === getVisitCountResetBase(lv)) incr = false
    }
    await setDoc(balRef, { balance: cb, netGain: cn, storeId, lastVisitedAt: ts, ...(incr ? { visitCount: vc + 1, lastVisitCountedAt: ts } : {}) }, { merge: true })
    if (!storeData?.checkinBonusEnabled) return
    const stampRef = doc(db, "users", playerId, "storeStamp", storeId)
    const stampSnap = await getDoc(stampRef); let canStamp = true
    if (stampSnap.exists()) {
      const data = stampSnap.data()
      if (data.lastStampAt?.toMillis) {
        const getBase = (d: Date) => { const b = new Date(d); b.setHours(3,0,0,0); if (d.getHours() < 3) b.setDate(b.getDate()-1); return b.getTime() }
        if (getBase(now) === getBase(new Date(data.lastStampAt.toMillis()))) canStamp = false
      }
    }
    if (!canStamp) return
    let newCount = 1
    if (stampSnap.exists()) newCount = (stampSnap.data().stampCount ?? 0) + 1
    if (newCount >= 12) {
      await setDoc(doc(collection(db, "users", playerId, "coupons")), { name: storeData.checkinBonusCouponName, storeId, createdAt: serverTimestamp() })
      await setDoc(stampRef, { stampCount: 0, lastStampAt: serverTimestamp() })
    } else {
      await setDoc(stampRef, { stampCount: newCount, lastStampAt: serverTimestamp() })
    }
  }

  const rejectPlayer = async (playerId: string) => {
    await setDoc(doc(db, "users", playerId), { checkinStatus: "none", pendingStoreId: null }, { merge: true })
  }

  const formatDateTime = (date?: Date | null) => {
    if (!date) return "なし"
    const p = (n: number) => n.toString().padStart(2, "0")
    return `${date.getFullYear()}/${p(date.getMonth()+1)}/${p(date.getDate())} ${p(date.getHours())}:${p(date.getMinutes())}`
  }

  const copyCode = async () => {
    if (!store?.code) return
    try {
      if (navigator?.clipboard?.writeText) await navigator.clipboard.writeText(store.code)
      else {
        const t = document.createElement("textarea"); t.value = store.code
        t.style.position = "fixed"; t.style.opacity = "0"; document.body.appendChild(t); t.select()
        document.execCommand("copy"); document.body.removeChild(t)
      }
      setCopiedCode(true); setTimeout(() => setCopiedCode(false), 2000)
    } catch {}
  }

  const openTimer = async (id: string) => {
    if (!storeId) { window.open(`/home/store/timer/${id}`, "_blank", "width=1200,height=900"); return }
    try { await updateDoc(doc(db, "stores", storeId, "tournaments", id), { timerRunning: false }) } catch {}
    window.open(`/home/store/timer/${id}`, "_blank", "width=1200,height=900")
  }

  if (role === null) return (
    <div style={{ minHeight: '100dvh', background: '#F2F2F7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid rgba(242,169,0,0.2)', borderTopColor: '#F2A900', animation: 'spin .7s linear infinite' }}/>
    </div>
  )
  if (role !== "store") return null

  const notifCount = depositRequests.length + withdrawRequests.length + pendingPlayers.length

  return (
    <main className="min-h-[100dvh] w-full max-w-full overflow-x-hidden pb-32" style={{ background: '#F2F2F7' }}>
      <style>{`
        :root {
          --gold:#F2A900; --gold-dk:#D4910A;
          --label:#1C1C1E; --label2:rgba(60,60,67,0.6); --label3:rgba(60,60,67,0.3);
          --sep:rgba(60,60,67,0.12); --fill:rgba(120,120,128,0.12);
          --green:#34C759; --red:#FF3B30;
        }
        @keyframes slideUp {
          from { opacity:0; transform:translateY(12px) scale(0.98); }
          to   { opacity:1; transform:translateY(0) scale(1); }
        }
        @keyframes spin { to { transform:rotate(360deg); } }
        @keyframes pulse-dot {
          0%,100%{ opacity:1; transform:scale(1); }
          50%    { opacity:0.4; transform:scale(0.7); }
        }
        @keyframes shimmer {
          0%  { background-position:-200% center; }
          100%{ background-position:200% center; }
        }
        @keyframes badge-pop {
          0%  { transform:scale(0.6); opacity:0; }
          70% { transform:scale(1.15); }
          100%{ transform:scale(1); opacity:1; }
        }

        .su  { opacity:0; animation:slideUp .4s cubic-bezier(.22,1,.36,1) forwards; }
        .d0  { animation-delay:.03s; }
        .d1  { animation-delay:.09s; }
        .d2  { animation-delay:.15s; }
        .d3  { animation-delay:.21s; }
        .d4  { animation-delay:.27s; }
        .d5  { animation-delay:.33s; }

        .ios-card {
          background:#fff; border-radius:20px;
          box-shadow:0 2px 10px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
        }
        .section-hd {
          font-size:11px; font-weight:700; letter-spacing:.06em;
          text-transform:uppercase; color:var(--label2);
          padding:0 2px; margin-bottom:10px;
        }

        /* Gold accent line */
        .gold-line {
          height:3px;
          background:linear-gradient(90deg,#F2A900,#FFE07A,#F2A900);
          background-size:200% auto;
          animation:shimmer 3s linear infinite;
        }

        /* Stat chip */
        .stat-chip {
          background:#F2F2F7; border-radius:14px; padding:10px 8px; text-align:center;
        }

        /* Action btn */
        .action-btn {
          height:44px; border-radius:12px; border:none; cursor:pointer;
          font-size:13px; font-weight:700; display:flex; align-items:center;
          justify-content:center; gap:6px; transition:transform .12s ease, opacity .12s ease;
        }
        .action-btn:active { transform:scale(0.96); opacity:.85; }

        /* Gold btn */
        .btn-gold {
          background:linear-gradient(135deg,#F2A900,#D4910A);
          color:#1a1a1a;
          box-shadow:0 3px 10px rgba(242,169,0,0.28);
        }

        /* Outline btn */
        .btn-outline-gold {
          background:#fff; border:1.5px solid rgba(242,169,0,0.45); color:#D4910A;
        }

        /* Danger btn */
        .btn-danger { background:rgba(255,59,48,0.09); color:#FF3B30; border:1.5px solid rgba(255,59,48,0.2); }

        /* Timer controls */
        .timer-btn {
          display:flex; align-items:center; justify-content:center;
          border:none; cursor:pointer; transition:transform .12s ease;
        }
        .timer-btn:active { transform:scale(0.9); }

        /* Player row */
        .player-row {
          display:flex; align-items:center; justify-content:space-between;
          padding:12px 14px; background:#fff; transition:background .12s;
        }
        .player-row:not(:last-child) { border-bottom:1px solid var(--sep); }
        .player-row:active { background:#F2F2F7; }

        /* Tab bar */
        .tab-item {
          flex:1; padding:10px 0; font-size:13px; font-weight:600;
          background:none; border:none; cursor:pointer; position:relative;
          transition:color .15s;
        }

        /* Request card */
        .req-card {
          background:#fff; border-radius:16px; padding:14px;
          box-shadow:0 1px 4px rgba(0,0,0,0.05);
        }
        .req-action {
          height:38px; border-radius:10px; border:none; cursor:pointer;
          font-size:12px; font-weight:700; transition:transform .12s ease;
          display:flex; align-items:center; justify-content:center;
        }
        .req-action:active { transform:scale(0.95); }

        /* Pending player */
        .pending-row {
          background:#F2F2F7; border-radius:14px; padding:12px 14px;
          display:flex; align-items:center; justify-content:space-between;
        }

        /* Glass nav */
        .glass-nav {
          background:rgba(255,255,255,0.85);
          backdrop-filter:blur(20px); -webkit-backdrop-filter:blur(20px);
        }

        /* Adjust modal */
        .adj-btn {
          height:44px; border-radius:12px; border:none; cursor:pointer;
          font-size:13px; font-weight:700; transition:transform .12s, opacity .12s;
        }
        .adj-btn:active { transform:scale(0.96); opacity:.85; }
        .adj-btn-dark { background:#1C1C1E; color:#fff; }
        .adj-btn-gold { background:linear-gradient(135deg,#F2A900,#D4910A); color:#1a1a1a; box-shadow:0 2px 8px rgba(242,169,0,0.25); }
        .adj-btn-add  { background:linear-gradient(135deg,#007AFF,#0066DD); color:#fff; }
        .adj-btn-sub  { background:rgba(255,59,48,0.1); color:#FF3B30; border:1.5px solid rgba(255,59,48,0.2); }

        .divider { height:1px; background:var(--sep); }
        .pulse { animation:pulse-dot 1.8s ease-in-out infinite; }
        button { -webkit-tap-highlight-color:transparent; }
      `}</style>

      <HomeHeader
        homePath="/home/store"
        myPagePath="/home/store/mypage"
        variant="store"
        menuItems={getCommonMenuItems(router, "store")}
      />

      {showPlayerModal && <PlayerManageModal tournamentId={showPlayerModal} storeId={storeId} onClose={() => setShowPlayerModal(null)} />}
      {showPrizeModal && <PrizeDistributeModal tournamentId={showPrizeModal} storeId={storeId} onClose={() => setShowPrizeModal(null)} />}
      {historyPlayerId && storeId && <PlayerHistoryModal playerId={historyPlayerId} storeId={storeId} onClose={() => setHistoryPlayerId(null)} />}

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 16px' }}>

        {/* ── Store Header Card ── */}
        <div className="su d0" style={{ marginTop: 16 }}>
          <div className="ios-card" style={{ overflow: 'hidden' }}>
            <div className="gold-line"/>
            <div style={{ padding: '18px 18px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
              {store?.iconUrl ? (
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <img src={store.iconUrl} alt={store.name} style={{ width: 60, height: 60, borderRadius: 18, objectFit: 'cover', boxShadow: '0 3px 10px rgba(0,0,0,0.1)' }}/>
                  <div style={{ position: 'absolute', bottom: 2, right: 2, width: 12, height: 12, borderRadius: '50%', background: '#34C759', border: '2px solid white' }} className="pulse"/>
                </div>
              ) : (
                <div style={{ width: 60, height: 60, borderRadius: 18, background: 'linear-gradient(135deg,#F2A900,#D4910A)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: 'white', fontWeight: 800, flexShrink: 0, boxShadow: '0 3px 10px rgba(242,169,0,0.28)' }}>店</div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 18, fontWeight: 800, color: 'var(--label)', letterSpacing: '-0.3px', marginBottom: 6 }}>{store?.name ?? ""}</p>
                <button onClick={copyCode}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: copiedCode ? 'rgba(52,199,89,0.1)' : 'var(--fill)', borderRadius: 10, padding: '5px 10px', border: 'none', cursor: 'pointer', transition: 'background .2s' }}
                >
                  <span style={{ fontSize: 12, fontWeight: 700, color: copiedCode ? '#28A745' : 'var(--label2)', fontFamily: 'monospace', letterSpacing: '0.05em' }}>{store?.code ?? ""}</span>
                  {copiedCode
                    ? <FiCheck size={12} style={{ color: '#28A745' }}/>
                    : <FiCopy size={12} style={{ color: 'var(--label3)' }}/>
                  }
                </button>
              </div>
              {/* 通知バッジ */}
              {notifCount > 0 && (
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#FF3B30', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: 'white', flexShrink: 0, animation: 'badge-pop .4s cubic-bezier(.22,1,.36,1)' }}>
                  {notifCount}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Tournaments ── */}
        <div className="su d1" style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, padding: '0 2px' }}>
            <p className="section-hd" style={{ marginBottom: 0 }}>Today's Tournaments</p>
            {activeTournaments.length > 0 && (
              <span style={{ fontSize: 11, fontWeight: 700, color: '#34C759', background: 'rgba(52,199,89,0.1)', borderRadius: 99, padding: '3px 8px' }}>
                {activeTournaments.length} Active
              </span>
            )}
          </div>

          {activeTournaments.length === 0 ? (
            <div className="ios-card" style={{ padding: '32px 20px', textAlign: 'center' }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--fill)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
                <FiClock size={22} style={{ color: 'var(--label3)' }}/>
              </div>
              <p style={{ fontSize: 13, color: 'var(--label2)' }}>開催中のトーナメントはありません</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {activeTournaments.map(t => {
                const totalStack = (t.entry * t.entryStack) + (t.reentry * t.reentryStack) + (t.addon * t.addonStack)
                const avg = t.alive > 0 ? Math.floor(totalStack / t.alive) : 0
                return (
                  <div key={t.id} className="ios-card su" style={{ overflow: 'hidden' }}>
                    <div className="gold-line"/>
                    <div style={{ padding: '16px 16px 14px' }}>

                      {/* ヘッダー */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                        <p style={{ fontSize: 16, fontWeight: 800, color: 'var(--label)', letterSpacing: '-0.2px' }}>{t.name}</p>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#34C759' }} className="pulse"/>
                      </div>

                      {/* Stats */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
                        {[
                          { icon: <FiUsers size={13} style={{ color: 'var(--gold)' }}/>, val: t.alive, label: 'Players' },
                          { icon: <FiTrendingUp size={13} style={{ color: 'var(--gold)' }}/>, val: avg.toLocaleString(), label: 'Avg Stack' },
                          { icon: <FiPlus size={13} style={{ color: 'var(--gold)' }}/>, val: t.addon, label: 'Add-on' },
                        ].map((s, i) => (
                          <div key={i} className="stat-chip">
                            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>{s.icon}</div>
                            <p style={{ fontSize: 18, fontWeight: 800, color: 'var(--label)', letterSpacing: '-0.5px', lineHeight: 1 }}>{s.val}</p>
                            <p style={{ fontSize: 10, color: 'var(--label3)', marginTop: 3, fontWeight: 600 }}>{s.label}</p>
                          </div>
                        ))}
                      </div>

                      {/* Action buttons */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                        <button className="action-btn btn-gold" onClick={() => openTimer(t.id)}>
                          <FiClock size={14}/> Timer
                        </button>
                        <button className="action-btn btn-gold" onClick={() => openAdjustModal(t.id, t.timeRemaining)}>
                          <FiEdit3 size={14}/> Adjust
                        </button>
                        <button className="action-btn btn-gold" onClick={() => setShowPlayerModal(t.id)}>
                          <FiUsers size={14}/> Players
                        </button>
                        <button className="action-btn btn-gold" onClick={() => setShowPrizeModal(t.id)} disabled={t.status !== "active"} style={{ opacity: t.status !== "active" ? 0.4 : 1 }}>
                          <FiDollarSign size={14}/> Pay Out
                        </button>
                      </div>

                      {/* Timer controls */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, paddingTop: 12, borderTop: '1px solid var(--sep)' }}>
                        <button className="timer-btn" onClick={() => prevLevel(t.id, t.currentLevelIndex ?? 0)}
                          style={{ width: 44, height: 44, borderRadius: '50%', background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: '1px solid var(--sep)' }}
                        ><FiSkipBack size={17} style={{ color: 'var(--label)' }}/></button>

                        <button className="timer-btn" onClick={() => toggleTimer(t.id)}
                          style={{ width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg,#F2A900,#D4910A)', boxShadow: '0 4px 14px rgba(242,169,0,0.32)' }}
                        >
                          {timerRunning[t.id] ? <FiPause size={20} style={{ color: 'white' }}/> : <FiPlay size={20} style={{ color: 'white', marginLeft: 2 }}/>}
                        </button>

                        <button className="timer-btn" onClick={() => nextLevel(t.id)}
                          style={{ width: 44, height: 44, borderRadius: '50%', background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: '1px solid var(--sep)' }}
                        ><FiSkipForward size={17} style={{ color: 'var(--label)' }}/></button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Adjust Time Modal ── */}
        {activeTournaments.map(t => adjustModalOpen[t.id] && (
          <div key={`adj-${t.id}`} className="fixed inset-0 z-[999] flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }}>
            <div className="ios-card su" style={{ width: '100%', maxWidth: 360, padding: '22px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                <p style={{ fontSize: 16, fontWeight: 800, color: 'var(--label)' }}>タイム調整</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => closeAdjustModal(t.id)}
                    style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--fill)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                  ><FiX size={14} style={{ color: 'var(--label2)' }}/></button>
                  <button onClick={() => confirmAdjustTime(t.id)}
                    style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(242,169,0,0.12)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                  ><FiCheck size={14} style={{ color: '#D4910A' }}/></button>
                </div>
              </div>

              <div style={{ textAlign: 'center', marginBottom: 18 }}>
                <p style={{ fontSize: 48, fontWeight: 900, color: 'var(--label)', letterSpacing: '-2px', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                  {String(Math.floor((adjustSeconds[t.id] ?? 0) / 60)).padStart(2, "0")}
                  <span style={{ color: 'var(--label3)', fontWeight: 400 }}>:</span>
                  {String((adjustSeconds[t.id] ?? 0) % 60).padStart(2, "0")}
                </p>
              </div>

              <input type="range" min={0} max={7200} step={10}
                value={adjustSeconds[t.id] ?? 0}
                onChange={e => setAdjustSeconds(p => ({ ...p, [t.id]: Number(e.target.value) }))}
                style={{ width: '100%', marginBottom: 18, accentColor: '#F2A900' }}
              />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[{ label: '-1分', diff: -60 }, { label: '+1分', diff: 60 }, { label: '-10秒', diff: -10 }, { label: '+10秒', diff: 10 }].map((b, i) => (
                  <button key={i} onClick={() => updateAdjustTime(t.id, b.diff)}
                    style={{ height: 44, borderRadius: 12, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, background: b.diff > 0 ? 'linear-gradient(135deg,#F2A900,#D4910A)' : 'var(--fill)', color: b.diff > 0 ? '#1a1a1a' : 'var(--label)', boxShadow: b.diff > 0 ? '0 2px 8px rgba(242,169,0,0.25)' : 'none', transition: 'transform .12s' }}
                  >{b.label}</button>
                ))}
              </div>
            </div>
          </div>
        ))}

        {/* ── Withdraw Requests ── */}
        {withdrawRequests.length > 0 && (
          <div className="su d2" style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, padding: '0 2px' }}>
              <p className="section-hd" style={{ marginBottom: 0 }}>引き出しリクエスト</p>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#fff', background: '#FF3B30', borderRadius: 99, padding: '2px 7px', animation: 'badge-pop .4s cubic-bezier(.22,1,.36,1)' }}>{withdrawRequests.length}</span>
            </div>
            <div className="ios-card" style={{ overflow: 'hidden' }}>
              {withdrawRequests.map((req, idx) => (
                <div key={req.id} style={{ padding: '14px 16px', borderBottom: idx < withdrawRequests.length - 1 ? '1px solid var(--sep)' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(255,59,48,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <FiMinus size={14} style={{ color: '#FF3B30' }}/>
                      </div>
                      <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--label)' }}>{playerMap[req.playerId]?.name ?? req.playerId}</p>
                    </div>
                    <p style={{ fontSize: 18, fontWeight: 900, color: '#FF3B30', letterSpacing: '-0.3px' }}>¥{req.amount.toLocaleString()}</p>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
                    {[
                      { label: 'Buy-in', type: 'buyin' as const },
                      { label: 'トナメ E', type: 'tE' as const },
                      { label: 'トナメ R', type: 'tR' as const },
                      { label: 'トナメ A', type: 'tA' as const },
                      { label: 'その他', type: 'other' as const, special: true },
                      { label: '却下', type: null },
                    ].map((b, i) => (
                      <button key={i}
                        className="req-action"
                        onClick={() => b.type === null ? rejectWithdraw(req) : b.special ? setWithdrawOtherOpenId(req.id) : approveWithdrawWithType(req, b.type as any)}
                        style={{ background: b.type === null ? 'rgba(255,59,48,0.07)' : 'rgba(255,59,48,0.85)', color: b.type === null ? '#FF3B30' : '#fff', border: b.type === null ? '1px solid rgba(255,59,48,0.2)' : 'none' }}
                      >{b.label}</button>
                    ))}
                  </div>
                  {withdrawOtherOpenId === req.id && (
                    <div style={{ marginTop: 10, background: 'rgba(242,169,0,0.07)', border: '1px solid rgba(242,169,0,0.2)', borderRadius: 14, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--label)', fontWeight: 500 }}>
                        <input type="checkbox" checked={withdrawOtherNetGain} onChange={e => setWithdrawOtherNetGain(e.target.checked)} style={{ accentColor: '#F2A900' }}/>
                        純増する
                      </label>
                      <input value={withdrawOtherComment} onChange={e => setWithdrawOtherComment(e.target.value)}
                        style={{ height: 40, borderRadius: 10, border: '1.5px solid var(--sep)', background: '#fff', padding: '0 12px', fontSize: 14, outline: 'none', color: 'var(--label)' }}
                        placeholder="コメントを入力"
                      />
                      <button onClick={() => approveWithdrawWithType(req, "other")}
                        style={{ height: 40, borderRadius: 10, background: 'linear-gradient(135deg,#F2A900,#D4910A)', color: '#1a1a1a', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer', boxShadow: '0 2px 8px rgba(242,169,0,0.25)' }}
                      >確定する</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Deposit Requests ── */}
        {depositRequests.length > 0 && (
          <div className="su d2" style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, padding: '0 2px' }}>
              <p className="section-hd" style={{ marginBottom: 0 }}>預け入れリクエスト</p>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#fff', background: '#34C759', borderRadius: 99, padding: '2px 7px', animation: 'badge-pop .4s cubic-bezier(.22,1,.36,1)' }}>{depositRequests.length}</span>
            </div>
            <div className="ios-card" style={{ overflow: 'hidden' }}>
              {depositRequests.map((req, idx) => (
                <div key={req.id} style={{ padding: '14px 16px', borderBottom: idx < depositRequests.length - 1 ? '1px solid var(--sep)' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(52,199,89,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <FiPlus size={14} style={{ color: '#34C759' }}/>
                      </div>
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--label)' }}>{playerMap[req.playerId]?.name ?? req.playerId}</p>
                        {req.comment && <p style={{ fontSize: 11, color: 'var(--label2)', marginTop: 1 }}>{req.comment}</p>}
                      </div>
                    </div>
                    <p style={{ fontSize: 18, fontWeight: 900, color: '#34C759', letterSpacing: '-0.3px' }}>¥{req.amount.toLocaleString()}</p>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 6 }}>
                    {[
                      { label: 'Cash Out', type: 'cashout' as const },
                      { label: 'チップ購入', type: 'chip' as const },
                      { label: 'その他', type: 'other' as const, special: true },
                      { label: '却下', type: null },
                    ].map((b, i) => (
                      <button key={i}
                        className="req-action"
                        onClick={() => b.type === null ? rejectDeposit(req) : b.special ? setDepositOtherOpenId(req.id) : approveDepositWithType(req, b.type as any)}
                        style={{ background: b.type === null ? 'rgba(255,59,48,0.07)' : 'rgba(52,199,89,0.85)', color: b.type === null ? '#FF3B30' : '#fff', border: b.type === null ? '1px solid rgba(255,59,48,0.2)' : 'none' }}
                      >{b.label}</button>
                    ))}
                  </div>
                  {depositOtherOpenId === req.id && (
                    <div style={{ marginTop: 10, background: 'rgba(242,169,0,0.07)', border: '1px solid rgba(242,169,0,0.2)', borderRadius: 14, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--label)', fontWeight: 500 }}>
                        <input type="checkbox" checked={depositOtherNetGain} onChange={e => setDepositOtherNetGain(e.target.checked)} style={{ accentColor: '#F2A900' }}/>
                        純増する
                      </label>
                      <input value={depositOtherComment} onChange={e => setDepositOtherComment(e.target.value)}
                        style={{ height: 40, borderRadius: 10, border: '1.5px solid var(--sep)', background: '#fff', padding: '0 12px', fontSize: 14, outline: 'none', color: 'var(--label)' }}
                        placeholder="コメントを入力"
                      />
                      <button onClick={() => approveDepositWithType(req, "other")}
                        style={{ height: 40, borderRadius: 10, background: 'linear-gradient(135deg,#F2A900,#D4910A)', color: '#1a1a1a', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer', boxShadow: '0 2px 8px rgba(242,169,0,0.25)' }}
                      >確定する</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Pending Players ── */}
        {pendingPlayers.length > 0 && (
          <div className="su d3" style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, padding: '0 2px' }}>
              <p className="section-hd" style={{ marginBottom: 0 }}>入店申請</p>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#1a1a1a', background: '#FFD60A', borderRadius: 99, padding: '2px 7px' }}>{pendingPlayers.length}</span>
            </div>
            <div className="ios-card" style={{ overflow: 'hidden' }}>
              {pendingPlayers.map((player, idx) => (
                <div key={player.id} style={{ padding: '12px 16px', borderBottom: idx < pendingPlayers.length - 1 ? '1px solid var(--sep)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {player.iconUrl
                      ? <img src={player.iconUrl} style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover' }}/>
                      : <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--fill)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FiUser size={16} style={{ color: 'var(--label2)' }}/></div>
                    }
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--label)' }}>{player.name}</p>
                      <p style={{ fontSize: 10, color: 'var(--label2)', marginTop: 1 }}>来店 {player.visitCount ?? 0}回 · 前回 {formatDateTime(player.lastVisitedAt)}</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => approvePlayer(player.id)}
                      style={{ height: 32, width: 52, borderRadius: 10, background: '#34C759', color: '#fff', fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer' }}
                    >許可</button>
                    <button onClick={() => rejectPlayer(player.id)}
                      style={{ height: 32, width: 52, borderRadius: 10, background: 'var(--fill)', color: 'var(--label2)', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer' }}
                    >却下</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Players Section ── */}
        <div className="su d4" style={{ marginTop: 20 }}>
          <p className="section-hd">Players</p>
          <div className="ios-card" style={{ overflow: 'hidden' }}>
            {/* 検索 */}
            <div style={{ padding: '12px 14px 10px', borderBottom: '1px solid var(--sep)' }}>
              <div style={{ position: 'relative' }}>
                <FiSearch style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: 'var(--label3)' }}/>
                <input
                  type="text" value={playerSearchInput} onChange={e => setPlayerSearchInput(e.target.value)}
                  placeholder="プレイヤーを検索…"
                  style={{ width: '100%', height: 40, borderRadius: 12, border: '1.5px solid var(--sep)', background: '#F2F2F7', paddingLeft: 34, paddingRight: 12, fontSize: 14, color: 'var(--label)', outline: 'none', boxSizing: 'border-box', transition: 'border-color .15s' }}
                />
                {playerSearchInput && filteredPlayers.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, marginTop: 4, background: '#fff', borderRadius: 14, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', border: '1px solid var(--sep)', overflow: 'hidden' }}>
                    {filteredPlayers.map(p => (
                      <button key={p.id} onClick={() => selectPlayer(p.id)}
                        style={{ display: 'block', width: '100%', padding: '11px 14px', textAlign: 'left', background: 'none', border: 'none', borderBottom: '1px solid var(--sep)', fontSize: 14, fontWeight: 600, color: 'var(--label)', cursor: 'pointer' }}
                      >{p.name ?? p.id}</button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* タブ */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--sep)' }}>
              {(['in', 'out'] as const).map(tab => (
                <button key={tab} className="tab-item" onClick={() => setActiveTab(tab)}
                  style={{ color: activeTab === tab ? 'var(--gold-dk)' : 'var(--label3)', fontWeight: activeTab === tab ? 700 : 500 }}
                >
                  {tab === 'in' ? `入店中 (${inPlayers.length})` : `退店済 (${outPlayers.length})`}
                  {activeTab === tab && <div style={{ position: 'absolute', bottom: 0, left: '25%', right: '25%', height: 2, background: 'var(--gold)', borderRadius: 1 }}/>}
                </button>
              ))}
            </div>

            {/* プレイヤーリスト */}
            {(() => {
              const list = activeTab === "in" ? inPlayers : outPlayers
              const kw = playerSearchInput.toLowerCase()
              const hit = kw ? list.filter(p => (p.name ?? "").toLowerCase().includes(kw)) : list
              const paginated = list.slice(0, storePlayersPage * pageSize)
              const selected = list.find(p => p.id === selectedPlayerId)
              const merged = [
                ...(selected ? [selected] : []),
                ...hit.filter(p => p.id !== selectedPlayerId),
                ...paginated.filter(p => p.id !== selectedPlayerId && !hit.some(h => h.id === p.id)),
              ]
              return (
                <>
                  {merged.map(player => (
                    <div key={player.id} className="player-row"
                      style={{ background: selectedPlayerId === player.id ? 'rgba(242,169,0,0.05)' : removingAdjustmentPlayerIds.includes(player.id) ? 'transparent' : '#fff', opacity: removingAdjustmentPlayerIds.includes(player.id) ? 0 : 1, transition: 'opacity .3s, background .15s' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ position: 'relative' }}>
                          {player.iconUrl
                            ? <img src={player.iconUrl} style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }}/>
                            : <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--fill)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FiUser size={16} style={{ color: 'var(--label2)' }}/></div>
                          }
                          {player.isInStore && <div style={{ position: 'absolute', bottom: 1, right: 1, width: 10, height: 10, borderRadius: '50%', background: '#34C759', border: '1.5px solid white' }}/>}
                        </div>
                        <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--label)' }}>{player.name || player.id}</p>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ textAlign: 'right', marginRight: 4 }}>
                          <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--label)', letterSpacing: '-0.2px' }}>¥{player.balance.toLocaleString()}</p>
                          <p style={{ fontSize: 11, fontWeight: 700, color: player.netGain >= 0 ? '#34C759' : '#FF3B30' }}>
                            {player.netGain >= 0 ? '+' : ''}¥{player.netGain.toLocaleString()}
                          </p>
                        </div>
                        <button onClick={() => setHistoryPlayerId(player.id)}
                          style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--fill)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
                        ><FiClock size={13} style={{ color: 'var(--label2)' }}/></button>
                        <button onClick={() => setAdjustModalPlayer(player)}
                          style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(242,169,0,0.12)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
                        ><FiDollarSign size={13} style={{ color: '#D4910A' }}/></button>
                        {player.isInStore && (
                          <button
                            onClick={async () => {
                              setRemovingAdjustmentPlayerIds(p => [...p, player.id])
                              setTimeout(async () => {
                                await setDoc(doc(db, "users", player.id), { currentStoreId: deleteField(), checkinStatus: "none", pendingStoreId: null }, { merge: true })
                                setRemovingAdjustmentPlayerIds(p => p.filter(id => id !== player.id))
                              }, 280)
                            }}
                            style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(255,59,48,0.09)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
                          ><FiLogOut size={13} style={{ color: '#FF3B30' }}/></button>
                        )}
                      </div>
                    </div>
                  ))}
                  {list.length > storePlayersPage * pageSize && (
                    <button onClick={() => setStorePlayersPage(p => p + 1)}
                      style={{ width: '100%', height: 44, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#007AFF', borderTop: '1px solid var(--sep)' }}
                    >もっと見る</button>
                  )}
                </>
              )
            })()}
          </div>
        </div>
      </div>

      {/* ── Bottom Nav（変更なし） ── */}
      <nav className="fixed bottom-0 left-0 right-0 w-full z-[80] glass-nav border-t" style={{ borderTopColor: 'rgba(60,60,67,0.1)' }}>
        <div style={{ position: 'relative', maxWidth: 480, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 32px 12px' }}>
          <button type="button" onClick={() => router.push("/home/store")}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', color: '#F2A900' }}
          >
            <FiHome size={22}/><span style={{ marginTop: 3, fontSize: 11, fontWeight: 700 }}>ホーム</span>
          </button>
          <button type="button" onClick={() => router.push("/home/store/tournaments")}
            style={{ position: 'absolute', left: '50%', top: 0, transform: 'translate(-50%,-50%)', width: 60, height: 60, borderRadius: 18, background: 'linear-gradient(135deg,#F2A900,#D4910A)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', boxShadow: '0 6px 20px rgba(242,169,0,0.35)' }}
          ><FiPlus size={26} style={{ color: 'white' }}/></button>
          <button type="button" onClick={() => router.push("/home/store/mypage")}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--label3)' }}
          >
            <FiUser size={22}/><span style={{ marginTop: 3, fontSize: 11, fontWeight: 500 }}>マイページ</span>
          </button>
        </div>
      </nav>

      {/* ── Adjust Modal ── */}
      {adjustModalPlayer && (
        <div className="fixed inset-0 z-[999] flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }}>
          <div className="ios-card su" style={{ width: '100%', maxWidth: 480, borderRadius: '24px 24px 0 0', padding: '22px 18px 40px', overflow: 'hidden' }}>
            <div className="gold-line" style={{ position: 'absolute', top: 0, left: 0, right: 0 }}/>

            {/* ドラッグハンドル */}
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--sep)', margin: '0 auto 18px' }}/>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {adjustModalPlayer.iconUrl
                  ? <img src={adjustModalPlayer.iconUrl} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }}/>
                  : <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--fill)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FiUser size={15} style={{ color: 'var(--label2)' }}/></div>
                }
                <div>
                  <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--label)' }}>{adjustModalPlayer.name}</p>
                  <p style={{ fontSize: 11, color: 'var(--label2)' }}>手動調整</p>
                </div>
              </div>
              <button onClick={() => { setAdjustModalPlayer(null); setAdjustValue("") }}
                style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--fill)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              ><FiX size={14} style={{ color: 'var(--label2)' }}/></button>
            </div>

            {/* 金額入力 */}
            <input
              value={adjustValue} onChange={e => setAdjustValue(e.target.value)}
              placeholder="金額を入力"
              style={{ width: '100%', height: 52, borderRadius: 14, border: '1.5px solid var(--sep)', background: '#F2F2F7', padding: '0 16px', fontSize: 20, fontWeight: 800, textAlign: 'center', color: 'var(--label)', outline: 'none', marginBottom: 16, boxSizing: 'border-box', letterSpacing: '-0.5px' }}
            />

            {/* リングゲーム */}
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--label3)', marginBottom: 8 }}>リングゲーム</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, marginBottom: 14 }}>
              {[{ l: 'Buy-in', t: 'buyin' }, { l: 'Cash Out', t: 'cashout' }, { l: 'チップ購入', t: 'chip' }].map(b => (
                <button key={b.t} className="adj-btn adj-btn-dark" onClick={() => runStoreAdjustment(b.t)}>{b.l}</button>
              ))}
            </div>

            {/* トーナメント */}
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--label3)', marginBottom: 8 }}>トーナメント</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, marginBottom: 14 }}>
              {[{ l: 'Entry', t: 'tE' }, { l: 'Re-entry', t: 'tR' }, { l: 'Add-on', t: 'tA' }].map(b => (
                <button key={b.t} className="adj-btn adj-btn-dark" onClick={() => runStoreAdjustment(b.t)}>{b.l}</button>
              ))}
            </div>

            <button
              className="adj-btn adj-btn-gold"
              onClick={runPrizeAdjustment}
              style={{ width: "100%", marginBottom: 14 }}
            >
              PRIZE
            </button>



            {/* 手動調整 */}
            <div style={{ height: 1, background: 'var(--sep)', margin: '4px 0 14px' }}/>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--label3)', marginBottom: 8 }}>手動調整</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
              <button className="adj-btn adj-btn-add" onClick={async () => { await runAdjustment("add", manualNetGain); setAdjustModalPlayer(null); setAdjustValue("") }}>
                ＋ 加算
              </button>
              <button className="adj-btn adj-btn-sub" onClick={async () => { await runAdjustment("subtract", manualNetGain); setAdjustModalPlayer(null); setAdjustValue("") }}>
                − 減算
              </button>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--label2)', fontWeight: 500 }}>
              <input type="checkbox" checked={manualNetGain} onChange={e => setManualNetGain(e.target.checked)} style={{ accentColor: '#F2A900' }}/>
              純増値も更新する
            </label>
          </div>
        </div>
      )}
    </main>
  )
}