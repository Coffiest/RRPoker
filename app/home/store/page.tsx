"use client"

import PlayerHistoryModal from "@/app/components/PlayerHistoryModal"
import dynamic from "next/dynamic"
import { useEffect, useMemo, useRef, useState } from "react"
const QRScanner = dynamic(() => import("@/app/components/QRScanner"), { ssr: false })
import { useRouter } from "next/navigation"
import { auth, db } from "@/lib/firebase"
import HomeHeader from "@/components/HomeHeader"
import StoreBottomNav from "@/components/StoreBottomNav"
import { getCommonMenuItems } from "@/components/commonMenuItems"
import PlayerManageModal from "./PlayerManageModal"
import PrizeDistributeModal from "./PrizeDistributeModal"
import {
  arrayUnion, collection, doc, deleteField, getDoc, increment,
  onSnapshot, query, serverTimestamp, setDoc, updateDoc, where,
} from "firebase/firestore"
import {
  FiPlus, FiMinus, FiCopy, FiHome, FiUser, FiPlay, FiPause,
  FiSkipForward, FiSkipBack, FiUsers, FiDollarSign,
  FiClock, FiCheck, FiX, FiSearch, FiLogOut, FiEdit3, FiChevronRight, FiMaximize2,
  FiChevronDown, FiMenu,
} from "react-icons/fi"

type StoreInfo = { name: string; iconUrl?: string; code: string; chipUnitLabel?: string; chipUnitBefore?: boolean; balanceGroupId?: string }
type OwnedStore = { id: string; name: string; iconUrl?: string }
type DepositRequest = { id: string; playerId: string; amount: number; comment?: string }
type WithdrawRequest = { id: string; playerId: string; amount: number; comment?: string }
type PlayerInfo = { id: string; name?: string; iconUrl?: string; visitCount?: number; lastVisitedAt?: Date | null }

function fmtChip(amount: number, unit?: string, before?: boolean): string {
  if (!unit) return amount.toLocaleString()
  return before ? `${unit}${amount.toLocaleString()}` : `${amount.toLocaleString()}${unit}`
}

export default function StorePage() {
  const getVisitCountResetBase = (date: Date) => {
    const base = new Date(date); base.setHours(3, 0, 0, 0)
    if (date.getHours() < 3) base.setDate(base.getDate() - 1)
    return base.getTime()
  }

  const [timerRunning, setTimerRunning] = useState<Record<string, boolean>>({})
  const [adjustModalOpen, setAdjustModalOpen] = useState<Record<string, boolean>>({})
  const [adjustSeconds, setAdjustSeconds] = useState<Record<string, number>>({})
  const [expandedTimerId, setExpandedTimerId] = useState<string | null>(null)
  const [expandCtrlVisible, setExpandCtrlVisible] = useState(false)
  const [expandAdjustOpen, setExpandAdjustOpen] = useState(false)
  const [expandPlayerOpen, setExpandPlayerOpen] = useState(false)
  const [expandPrizeOpen, setExpandPrizeOpen] = useState(false)

  const openAdjustModal = (id: string, s: number) => {
    setAdjustModalOpen(p => ({ ...p, [id]: true }))
    setAdjustSeconds(p => ({ ...p, [id]: s }))
  }
  const closeAdjustModal = (id: string) => setAdjustModalOpen(p => ({ ...p, [id]: false }))
  const updateAdjustTime = (id: string, diff: number) =>
    setAdjustSeconds(p => ({ ...p, [id]: Math.max(0, (p[id] ?? 0) + diff) }))
  const confirmAdjustTime = async (id: string) => {
    if (!storeId) return
    await updateDoc(doc(db, "stores", storeId, "tournaments", id), { timeRemaining: adjustSeconds[id], levelStartedAt: serverTimestamp(), levelStartedRemaining: adjustSeconds[id] })
    closeAdjustModal(id)
  }
  const toggleTimer = async (id: string) => {
    timerRunning[id] ? await pauseTimer(id) : await resumeTimer(id)
  }

  const router = useRouter()

  async function startTimer(id: string) {
    if (!storeId) return
    const ref = doc(db, "stores", storeId, "tournaments", id)
    const snap = await getDoc(ref); const data = snap.data()
    const remaining = typeof data?.timeRemaining === "number" ? data.timeRemaining : 1200
    await updateDoc(ref, { timerRunning: true, levelStartedAt: serverTimestamp(), levelStartedRemaining: remaining })
  }
  async function resumeTimer(id: string) {
    if (!storeId) return
    // timeRemaining was saved accurately by pauseTimer; stamp levelStartedAt = now.
    const ref = doc(db, "stores", storeId, "tournaments", id)
    const snap = await getDoc(ref); const data = snap.data()
    const remaining = typeof data?.timeRemaining === "number" ? data.timeRemaining : 1200
    await updateDoc(ref, { timerRunning: true, levelStartedAt: serverTimestamp(), levelStartedRemaining: remaining })
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
    await updateDoc(ref, { currentLevelIndex: nextIdx, timeRemaining: dur, levelStartedAt: serverTimestamp(), levelStartedRemaining: dur, timerRunning: data.timerRunning ?? false })
  }
  async function pauseTimer(id: string) {
    if (!storeId) return
    const ref = doc(db, "stores", storeId, "tournaments", id)
    const snap = await getDoc(ref); const data = snap.data(); if (!data) return
    // Use levelStartedRemaining (frozen at resume time) — not timeRemaining which
    // may have been corrupted by old cached code. Fall back to timeRemaining if not set.
    const startRemaining = typeof data.levelStartedRemaining === "number"
      ? data.levelStartedRemaining
      : (typeof data.timeRemaining === "number" ? data.timeRemaining : 0)
    const elapsed = data.levelStartedAt ? Math.floor((Date.now() - data.levelStartedAt.toMillis()) / 1000) : 0
    const remaining = Math.max(startRemaining - elapsed, 0)
    await updateDoc(ref, { timerRunning: false, timeRemaining: remaining })
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
    await updateDoc(ref, { currentLevelIndex: prevIdx, timeRemaining: dur, levelStartedAt: serverTimestamp(), levelStartedRemaining: dur, timerRunning: data.timerRunning ?? false })
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
          entryFee: data.entryFee ?? 0, reentryFee: data.reentryFee ?? 0, addonFee: data.addonFee ?? 0,
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
  const balGroupId = store?.balanceGroupId ?? storeId
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
  const [isScannerOpen, setIsScannerOpen] = useState(false)
  const [qrCheckinResult, setQrCheckinResult] = useState<{ success: boolean; name?: string } | null>(null)
  const [ownedStores, setOwnedStores] = useState<OwnedStore[]>([])
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const [showStorePicker, setShowStorePicker] = useState(false)
  const cardTouchStartX = useRef(0)
  const cardTouchStartY = useRef(0)
  const lastIconTapTime = useRef(0)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

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
    const balKey = (store?.balanceGroupId ?? storeId)!
    const q = query(collection(db, "users"), where("joinedStores", "array-contains", storeId))
    const unsub = onSnapshot(q, async (snap) => {
      const filtered = snap.docs.filter(d => !d.id.startsWith("temp_"))
      const results = await Promise.all(filtered.map(async d => {
        const data = d.data()
        let bal: Record<string, any> = {}
        try {
          const balSnap = await getDoc(doc(db, "users", d.id, "storeBalances", balKey))
          if (balSnap.exists()) bal = balSnap.data()
        } catch {}
        return {
          id: d.id, name: data.name, iconUrl: data.iconUrl,
          balance: bal.balance ?? 0, netGain: bal.netGain ?? 0,
          lastVisitedAt: bal.lastVisitedAt?.toDate?.() ?? null,
          isInStore: data.currentStoreId === storeId,
        }
      }))
      results.sort((a, b) => (b.lastVisitedAt?.getTime() ?? 0) - (a.lastVisitedAt?.getTime() ?? 0))
      setStorePlayers(results)
    })
    return () => unsub()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, store])

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async user => {
      if (!user) return
      const snap = await getDoc(doc(db, "users", user.uid))
      const data = snap.data() ?? {}
      const sid = data.storeId ?? null
      setStoreId(sid)
      const ownedIds: string[] = data.ownedStoreIds ?? (sid ? [sid] : [])
      if (ownedIds.length > 0) {
        const infos = await Promise.all(
          ownedIds.map(async (id: string) => {
            const s = await getDoc(doc(db, "stores", id))
            const d = s.data()
            return { id, name: d?.name ?? "", iconUrl: d?.iconUrl as string | undefined }
          })
        )
        setOwnedStores(infos)
      }
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
    const balKey = (store?.balanceGroupId ?? storeId)!
    const q = query(collection(db, "users"), where("pendingStoreId", "==", storeId))
    const unsub = onSnapshot(q, async snap => {
      const list: PlayerInfo[] = []
      for (const d of snap.docs) {
        const data = d.data()
        if (data.checkinStatus !== "pending") continue
        let b: Record<string, any> = {}
        try {
          const balSnap = await getDoc(doc(db, "users", d.id, "storeBalances", balKey))
          if (balSnap.exists()) b = balSnap.data()
        } catch {}
        list.push({ id: d.id, name: data.name, iconUrl: data.iconUrl, visitCount: b.visitCount ?? 0, lastVisitedAt: b.lastVisitedAt?.toDate?.() ?? null })
      }
      setPendingPlayers(list.reverse())
    })
    return () => unsub()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, store])

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
    const snap = await getDoc(doc(db, "users", playerId, "storeBalances", balGroupId!))
    if (snap.exists()) { setSelectedPlayerBalance(snap.data()?.balance ?? 0); setSelectedPlayerNetGain(snap.data()?.netGain ?? 0) }
    else { setSelectedPlayerBalance(0); setSelectedPlayerNetGain(0) }
  }

  const approveDepositWithType = async (req: DepositRequest, type: "cashout" | "chip" | "other") => {
    if (!storeId) return
    const balRef = doc(db, "users", req.playerId, "storeBalances", balGroupId!)
    let bDiff = 0, nDiff = 0, txType = ""
    if (type === "cashout") { bDiff = req.amount; nDiff = req.amount; txType = "store_cashout" }
    if (type === "chip") { bDiff = req.amount; nDiff = 0; txType = "store_chip_purchase" }
    if (type === "other") { bDiff = req.amount; nDiff = depositOtherNetGain ? req.amount : 0; txType = depositOtherNetGain ? "other_net_gain" : "other" }
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
    const balRef = doc(db, "users", req.playerId, "storeBalances", balGroupId!)
    let bDiff = 0, nDiff = 0, txType = ""
    if (type === "buyin") { bDiff = -req.amount; nDiff = -req.amount; txType = "store_buyin" }
    if (type === "tE") { bDiff = -req.amount; nDiff = -req.amount; txType = "store_tournament_entry" }
    if (type === "tR") { bDiff = -req.amount; nDiff = -req.amount; txType = "store_tournament_reentry" }
    if (type === "tA") { bDiff = -req.amount; nDiff = -req.amount; txType = "store_tournament_addon" }
    if (type === "other") { bDiff = -req.amount; nDiff = withdrawOtherNetGain ? -req.amount : 0; txType = withdrawOtherNetGain ? "other_net_gain" : "other" }
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
    const balRef = doc(db, "users", pid, "storeBalances", balGroupId!)
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
    const balRef = doc(db, "users", pid, "storeBalances", balGroupId!)
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

  const balRef = doc(db, "users", pid, "storeBalances", balGroupId!)

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
    const now = new Date()
    try {
      const balRef = doc(db, "users", playerId, "storeBalances", balGroupId!)
      const balSnap = await getDoc(balRef); const ts = serverTimestamp()
      let cb = 0, cn = 0, vc = 0, incr = true
      if (balSnap.exists()) {
        const b = balSnap.data(); cb = b.balance ?? 0; cn = b.netGain ?? 0; vc = b.visitCount ?? 0
        const lv = b.lastVisitCountedAt?.toDate?.() ?? null
        if (lv && getVisitCountResetBase(now) === getVisitCountResetBase(lv)) incr = false
      }
      await setDoc(balRef, { balance: cb, netGain: cn, storeId, lastVisitedAt: ts, ...(incr ? { visitCount: vc + 1, lastVisitCountedAt: ts } : {}) }, { merge: true })
    } catch {}
    if (!storeData?.checkinBonusEnabled) return
    try {
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
    } catch {}
  }

  const rejectPlayer = async (playerId: string) => {
    await setDoc(doc(db, "users", playerId), { checkinStatus: "none", pendingStoreId: null }, { merge: true })
  }

  const qrCheckinPlayer = async (playerUid: string) => {
    if (!storeId) return
    setIsScannerOpen(false)
    try {
      const playerSnap = await getDoc(doc(db, "users", playerUid))
      if (!playerSnap.exists()) { setQrCheckinResult({ success: false }); setTimeout(() => setQrCheckinResult(null), 3000); return }
      const playerName = playerSnap.data()?.name ?? ""
      await setDoc(doc(db, "users", playerUid), { joinedStores: arrayUnion(storeId) }, { merge: true })
      await approvePlayer(playerUid)
      setQrCheckinResult({ success: true, name: playerName })
      setTimeout(() => setQrCheckinResult(null), 3000)
    } catch {
      setQrCheckinResult({ success: false })
      setTimeout(() => setQrCheckinResult(null), 3000)
    }
  }

  const formatDateTime = (date?: Date | null) => {
    if (!date) return "なし"
    const p = (n: number) => n.toString().padStart(2, "0")
    return `${date.getFullYear()}/${p(date.getMonth()+1)}/${p(date.getDate())} ${p(date.getHours())}:${p(date.getMinutes())}`
  }

  const switchStore = async (newStoreId: string) => {
    if (newStoreId === storeId) { setSwitcherOpen(false); setShowStorePicker(false); return }
    const user = auth.currentUser
    if (!user) return
    await updateDoc(doc(db, "users", user.uid), { storeId: newStoreId })
    setStoreId(newStoreId)
    setStore(null)
    setSwitcherOpen(false)
    setShowStorePicker(false)
  }

  const handleIconTap = () => {
    const now = Date.now()
    if (now - lastIconTapTime.current < 350) {
      setSwitcherOpen(p => !p)
      lastIconTapTime.current = 0
    } else {
      lastIconTapTime.current = now
    }
  }

  const startLongPress = () => {
    longPressTimer.current = setTimeout(() => setShowStorePicker(true), 500)
  }

  const cancelLongPress = () => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null }
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
    // iOS/Android: window.open must be called synchronously within the user gesture.
    // Open first, then do async Firestore update.
    window.open(`/home/store/timer/${id}`, "_blank")
    if (storeId) {
      try { await updateDoc(doc(db, "stores", storeId, "tournaments", id), { timerRunning: false }) } catch {}
    }
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

      {showPlayerModal && <PlayerManageModal tournamentId={showPlayerModal} storeId={storeId} balanceGroupId={store?.balanceGroupId ?? storeId ?? undefined} chipUnit={store?.chipUnitLabel} chipUnitBefore={store?.chipUnitBefore} onClose={() => setShowPlayerModal(null)} />}
      {showPrizeModal && <PrizeDistributeModal tournamentId={showPrizeModal} storeId={storeId} balanceGroupId={store?.balanceGroupId ?? storeId ?? undefined} chipUnit={store?.chipUnitLabel} chipUnitBefore={store?.chipUnitBefore} onClose={() => setShowPrizeModal(null)} />}
      {historyPlayerId && storeId && <PlayerHistoryModal playerId={historyPlayerId} storeId={storeId} chipUnit={store?.chipUnitLabel} chipUnitBefore={store?.chipUnitBefore} onClose={() => setHistoryPlayerId(null)} />}

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 16px' }}>

        {/* ── Store Header Card ── */}
        <div className="su d0" style={{ marginTop: 16, position: 'relative' }}>
          <div
            className="ios-card"
            style={{ overflow: 'hidden' }}
            onTouchStart={e => { cardTouchStartX.current = e.touches[0].clientX; cardTouchStartY.current = e.touches[0].clientY }}
            onTouchEnd={e => {
              const dx = e.changedTouches[0].clientX - cardTouchStartX.current
              const dy = e.changedTouches[0].clientY - cardTouchStartY.current
              if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5 && dx > 0) setSwitcherOpen(p => !p)
            }}
          >
            <div className="gold-line"/>
            <div style={{ padding: '18px 18px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
              {/* Store icon — double-tap to toggle switcher, long-press to show picker */}
              {store?.iconUrl ? (
                <div
                  style={{ position: 'relative', flexShrink: 0, cursor: 'pointer' }}
                  onClick={handleIconTap}
                  onTouchStart={startLongPress}
                  onTouchEnd={cancelLongPress}
                  onTouchMove={cancelLongPress}
                >
                  <img src={store.iconUrl} alt={store.name} style={{ width: 60, height: 60, borderRadius: 18, objectFit: 'cover', boxShadow: '0 3px 10px rgba(0,0,0,0.1)' }}/>
                  <div style={{ position: 'absolute', bottom: 2, right: 2, width: 12, height: 12, borderRadius: '50%', background: '#34C759', border: '2px solid white' }} className="pulse"/>
                </div>
              ) : (
                <div
                  style={{ width: 60, height: 60, borderRadius: 18, background: 'linear-gradient(135deg,#F2A900,#D4910A)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: 'white', fontWeight: 800, flexShrink: 0, boxShadow: '0 3px 10px rgba(242,169,0,0.28)', cursor: 'pointer' }}
                  onClick={handleIconTap}
                  onTouchStart={startLongPress}
                  onTouchEnd={cancelLongPress}
                  onTouchMove={cancelLongPress}
                >店</div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 18, fontWeight: 800, color: 'var(--label)', letterSpacing: '-0.3px', marginBottom: 6 }}>{store?.name ?? ""}</p>
                <button onClick={copyCode}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: copiedCode ? 'rgba(52,199,89,0.1)' : 'var(--fill)', borderRadius: 10, padding: '5px 10px', border: 'none', cursor: 'pointer', transition: 'background .2s' }}
                >
                  <span style={{ fontSize: 12, fontWeight: 700, color: copiedCode ? '#28A745' : 'var(--label2)', fontFamily: 'monospace', letterSpacing: '0.05em' }}>{store?.code ?? ""}</span>
                  {copiedCode ? <FiCheck size={12} style={{ color: '#28A745' }}/> : <FiCopy size={12} style={{ color: 'var(--label3)' }}/>}
                </button>
              </div>
              {/* QRスキャンボタン + 通知バッジ */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <button
                  onClick={() => setIsScannerOpen(true)}
                  style={{ width: 42, height: 42, borderRadius: 13, background: 'linear-gradient(135deg,#F2A900,#D4910A)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 3px 10px rgba(242,169,0,0.35)', flexShrink: 0, transition: 'transform .12s ease, opacity .12s ease' }}
                  onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.93)')}
                  onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
                  onTouchStart={e => { e.currentTarget.style.transform = 'scale(0.93)' }}
                  onTouchEnd={e => { e.currentTarget.style.transform = 'scale(1)' }}
                  title="QRスキャンで入店"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M2 7V4a2 2 0 012-2h3" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                    <path d="M17 2h3a2 2 0 012 2v3" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                    <path d="M22 17v3a2 2 0 01-2 2h-3" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                    <path d="M7 22H4a2 2 0 01-2-2v-3" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                    <rect x="6" y="6" width="4" height="4" rx="1" fill="white"/>
                    <rect x="14" y="6" width="4" height="4" rx="1" fill="white"/>
                    <rect x="6" y="14" width="4" height="4" rx="1" fill="white"/>
                    <rect x="14" y="14" width="4" height="4" rx="1" fill="white"/>
                  </svg>
                </button>
                {notifCount > 0 && (
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#FF3B30', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: 'white', animation: 'badge-pop .4s cubic-bezier(.22,1,.36,1)' }}>
                    {notifCount}
                  </div>
                )}
              </div>
            </div>

            {/* ── アカウントスイッチャー (スワイプ/ダブルタップで展開) ── */}
            <div style={{ maxHeight: switcherOpen ? 80 : 0, overflow: 'hidden', transition: 'max-height 0.3s cubic-bezier(0.4,0,0.2,1)' }}>
              <div style={{ borderTop: '1px solid var(--sep)', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px' }}>
                {ownedStores.map(s => (
                  <button key={s.id} onClick={() => switchStore(s.id)} style={{ width: 46, height: 46, borderRadius: 14, padding: 0, border: 'none', cursor: 'pointer', flexShrink: 0, outline: s.id === storeId ? '2.5px solid #F2A900' : '2px solid transparent', outlineOffset: 2, background: 'transparent', transition: 'outline .15s' }}>
                    {s.iconUrl
                      ? <img src={s.iconUrl} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 14 }}/>
                      : <div style={{ width: '100%', height: '100%', borderRadius: 14, background: 'linear-gradient(135deg,#F2A900,#D4910A)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: 'white', fontWeight: 800 }}>店</div>
                    }
                  </button>
                ))}
                <button onClick={() => router.push('/home/store/branch/new')} style={{ width: 46, height: 46, borderRadius: 14, border: '2px dashed rgba(60,60,67,0.25)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <FiPlus size={18} style={{ color: 'var(--label2)' }}/>
                </button>
                <span style={{ fontSize: 11, color: 'var(--label3)', marginLeft: 4 }}>系列店を切替 / 追加</span>
              </div>
            </div>
          </div>

          {/* ── 長押しポップオーバー ── */}
          {showStorePicker && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 100 }} onClick={() => setShowStorePicker(false)}/>
              <div style={{ position: 'absolute', top: 76, left: 16, zIndex: 101, background: 'white', borderRadius: 20, padding: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.18)', minWidth: 220 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--label2)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>アカウント切替</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {ownedStores.map(s => (
                    <button key={s.id} onClick={() => switchStore(s.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, background: s.id === storeId ? 'rgba(242,169,0,0.08)' : 'transparent', border: 'none', cursor: 'pointer', borderRadius: 12, padding: '8px 10px', width: '100%', textAlign: 'left' }}>
                      {s.iconUrl
                        ? <img src={s.iconUrl} style={{ width: 36, height: 36, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }}/>
                        : <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#F2A900,#D4910A)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'white', fontWeight: 800, flexShrink: 0 }}>店</div>
                      }
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--label)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</p>
                        {s.id === storeId && <p style={{ fontSize: 11, color: '#F2A900', fontWeight: 600 }}>表示中</p>}
                      </div>
                      {s.id === storeId && <FiCheck size={14} style={{ color: '#F2A900', flexShrink: 0 }}/>}
                    </button>
                  ))}
                </div>
                <div style={{ height: 1, background: 'var(--sep)', margin: '10px 0' }}/>
                <button onClick={() => { setShowStorePicker(false); router.push('/home/store/branch/new') }} style={{ display: 'flex', alignItems: 'center', gap: 10, border: 'none', cursor: 'pointer', borderRadius: 12, padding: '8px 10px', width: '100%', textAlign: 'left', background: 'transparent' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--fill)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <FiPlus size={16} style={{ color: 'var(--label2)' }}/>
                  </div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--label)' }}>系列店を追加</p>
                </button>
              </div>
            </>
          )}
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
                return (
                  <div key={t.id} className="ios-card su" style={{ overflow: 'hidden' }}>
                    <div className="gold-line"/>
                    <div style={{ padding: '16px 16px 14px' }}>

                      {/* ヘッダー */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                        <p style={{ fontSize: 16, fontWeight: 800, color: 'var(--label)', letterSpacing: '-0.2px' }}>{t.name}</p>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#34C759' }} className="pulse"/>
                      </div>

                      {/* Fee / Stack info */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2px 6px', marginBottom: 12, padding: '8px 10px', background: 'var(--fill)', borderRadius: 10 }}>
                        {[
                          { label: 'Entry',   fee: Number(t.entryFee),   stack: Number(t.entryStack) },
                          { label: 'Reentry', fee: Number(t.reentryFee), stack: Number(t.reentryStack) },
                          { label: 'Add-on',  fee: Number(t.addonFee),   stack: Number(t.addonStack) },
                        ].map(item => (
                          <div key={item.label} style={{ textAlign: 'center' }}>
                            <p style={{ fontSize: 8, fontWeight: 700, color: 'var(--label3)', letterSpacing: '0.04em', marginBottom: 4 }}>{item.label}</p>
                            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 2, marginBottom: 2 }}>
                              <span style={{ fontSize: 8, fontWeight: 600, color: 'var(--label2)' }}>費</span>
                              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--label)' }}>
                                {item.fee > 0 ? item.fee.toLocaleString() : '—'}
                              </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 2 }}>
                              <span style={{ fontSize: 8, fontWeight: 600, color: 'var(--label2)' }}>ST</span>
                              <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--label2)' }}>
                                {item.stack > 0 ? item.stack.toLocaleString() : '—'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Timer Display — full TimerClient view scaled to card width */}
                      <div style={{
                        position: 'relative',
                        width: '100%',
                        height: '224px',
                        overflow: 'hidden',
                        borderRadius: 12,
                        marginBottom: 14,
                        border: '1px solid var(--sep)',
                        background: '#fff',
                      }}>
                        <iframe
                          src={`/home/store/timer/${t.id}`}
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '1200px',
                            height: '800px',
                            transform: 'scale(0.28)',
                            transformOrigin: 'top left',
                            border: 'none',
                            pointerEvents: 'none',
                          }}
                        />
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

                        <button className="timer-btn" onClick={() => setExpandedTimerId(t.id)}
                          style={{ width: 44, height: 44, borderRadius: '50%', background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: '1px solid var(--sep)' }}
                        ><FiMaximize2 size={16} style={{ color: 'var(--label)' }}/></button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Timer Expand Modal (landscape / スマホ横持ち対応) ── */}
        {expandedTimerId && (() => {
          const et = activeTournaments.find(t => t.id === expandedTimerId)
          const btnBase: React.CSSProperties = {
            border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 4, background: 'none',
          }
          const iconCircle = (gold?: boolean): React.CSSProperties => ({
            width: gold ? 52 : 42, height: gold ? 52 : 42, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: gold ? 'linear-gradient(135deg,#F2A900,#D4910A)' : 'rgba(255,255,255,0.14)',
            border: gold ? 'none' : '1px solid rgba(255,255,255,0.22)',
            boxShadow: gold ? '0 4px 14px rgba(242,169,0,0.38)' : 'none',
          })
          const labelStyle: React.CSSProperties = { fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.08em' }
          return (
            <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#000', overflow: 'hidden' }}>
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                width: '100vh',
                height: '100vw',
                transform: 'translate(-50%, -50%) rotate(90deg)',
                transformOrigin: 'center center',
                overflow: 'hidden',
              }}>
                <iframe
                  src={`/home/store/timer/${expandedTimerId}`}
                  style={{ width: '100%', height: '100%', border: 'none', display: 'block', pointerEvents: 'none' }}
                  allow="autoplay"
                />

                {/* コントロールバー非表示時のトグルボタン */}
                {!expandCtrlVisible && (
                  <button
                    onClick={() => setExpandCtrlVisible(true)}
                    style={{
                      position: 'absolute',
                      bottom: 12, right: 12,
                      width: 42, height: 42,
                      borderRadius: '50%',
                      background: 'rgba(0,0,0,0.50)',
                      backdropFilter: 'blur(12px)',
                      WebkitBackdropFilter: 'blur(12px)',
                      border: '1px solid rgba(255,255,255,0.18)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    <FiMenu size={18} style={{ color: 'rgba(255,255,255,0.75)' }} />
                  </button>
                )}

                {/* コントロールバー */}
                {et && expandCtrlVisible && (
                  <div style={{
                    position: 'absolute',
                    bottom: 0, left: 0, right: 0,
                    background: 'rgba(0,0,0,0.72)',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                    borderTop: '1px solid rgba(255,255,255,0.10)',
                    padding: '10px 16px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}>
                    {/* 左: CLOSE + HIDE */}
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button onClick={() => { setExpandedTimerId(null); setExpandCtrlVisible(false) }} style={btnBase}>
                        <div style={iconCircle()}>
                          <FiX size={17} style={{ color: '#fff' }} />
                        </div>
                        <span style={labelStyle}>CLOSE</span>
                      </button>
                      <button onClick={() => setExpandCtrlVisible(false)} style={btnBase}>
                        <div style={iconCircle()}>
                          <FiChevronDown size={17} style={{ color: '#fff' }} />
                        </div>
                        <span style={labelStyle}>HIDE</span>
                      </button>
                    </div>

                    {/* 中央: タイマー制御 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <button className="timer-btn" onClick={() => prevLevel(et.id, et.currentLevelIndex ?? 0)} style={btnBase}>
                        <div style={iconCircle()}>
                          <FiSkipBack size={17} style={{ color: '#fff' }} />
                        </div>
                        <span style={labelStyle}>PREV</span>
                      </button>
                      <button className="timer-btn" onClick={() => toggleTimer(et.id)} style={btnBase}>
                        <div style={iconCircle(true)}>
                          {timerRunning[et.id]
                            ? <FiPause size={20} style={{ color: '#fff' }} />
                            : <FiPlay size={20} style={{ color: '#fff', marginLeft: 2 }} />}
                        </div>
                        <span style={{ ...labelStyle, color: 'rgba(242,169,0,0.8)' }}>
                          {timerRunning[et.id] ? 'PAUSE' : 'START'}
                        </span>
                      </button>
                      <button className="timer-btn" onClick={() => nextLevel(et.id)} style={btnBase}>
                        <div style={iconCircle()}>
                          <FiSkipForward size={17} style={{ color: '#fff' }} />
                        </div>
                        <span style={labelStyle}>NEXT</span>
                      </button>
                    </div>

                    {/* 右: アクション */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <button onClick={() => { setAdjustSeconds(p => ({ ...p, [et.id]: et.timeRemaining })); setExpandAdjustOpen(true) }} style={btnBase}>
                        <div style={iconCircle()}>
                          <FiEdit3 size={15} style={{ color: '#fff' }} />
                        </div>
                        <span style={labelStyle}>ADJUST</span>
                      </button>
                      <button onClick={() => setExpandPlayerOpen(true)} style={btnBase}>
                        <div style={iconCircle()}>
                          <FiUsers size={15} style={{ color: '#fff' }} />
                        </div>
                        <span style={labelStyle}>PLAYERS</span>
                      </button>
                      <button onClick={() => setExpandPrizeOpen(true)} style={btnBase}>
                        <div style={iconCircle()}>
                          <FiDollarSign size={15} style={{ color: '#fff' }} />
                        </div>
                        <span style={labelStyle}>PAY OUT</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })()}

        {/* ── Expand: インライン Adjust Modal (z:10001) ── */}
        {expandAdjustOpen && expandedTimerId && (() => {
          const et = activeTournaments.find(t => t.id === expandedTimerId)
          if (!et) return null
          return (
            <div style={{ position: 'fixed', inset: 0, zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 16px', background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}>
              <div className="ios-card" style={{ width: '100%', maxWidth: 360, padding: '22px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                  <p style={{ fontSize: 16, fontWeight: 800, color: 'var(--label)' }}>タイム調整</p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setExpandAdjustOpen(false)}
                      style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--fill)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                    ><FiX size={14} style={{ color: 'var(--label2)' }}/></button>
                    <button onClick={async () => { await confirmAdjustTime(et.id); setExpandAdjustOpen(false) }}
                      style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(242,169,0,0.12)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                    ><FiCheck size={14} style={{ color: '#D4910A' }}/></button>
                  </div>
                </div>
                <div style={{ textAlign: 'center', marginBottom: 18 }}>
                  <p style={{ fontSize: 48, fontWeight: 900, color: 'var(--label)', letterSpacing: '-2px', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                    {String(Math.floor((adjustSeconds[et.id] ?? 0) / 60)).padStart(2, "0")}
                    <span style={{ color: 'var(--label3)', fontWeight: 400 }}>:</span>
                    {String((adjustSeconds[et.id] ?? 0) % 60).padStart(2, "0")}
                  </p>
                </div>
                <input type="range" min={0} max={7200} step={10}
                  value={adjustSeconds[et.id] ?? 0}
                  onChange={e => setAdjustSeconds(p => ({ ...p, [et.id]: Number(e.target.value) }))}
                  style={{ width: '100%', marginBottom: 18, accentColor: '#F2A900' }}
                />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {[{ label: '-1分', diff: -60 }, { label: '+1分', diff: 60 }, { label: '-10秒', diff: -10 }, { label: '+10秒', diff: 10 }].map((b, i) => (
                    <button key={i} onClick={() => updateAdjustTime(et.id, b.diff)}
                      style={{ height: 44, borderRadius: 12, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, background: b.diff > 0 ? 'linear-gradient(135deg,#F2A900,#D4910A)' : 'var(--fill)', color: b.diff > 0 ? '#1a1a1a' : 'var(--label)', boxShadow: b.diff > 0 ? '0 2px 8px rgba(242,169,0,0.25)' : 'none' }}
                    >{b.label}</button>
                  ))}
                </div>
              </div>
            </div>
          )
        })()}

        {/* ── Expand: インライン Players Modal (z:10001) ── */}
        {expandPlayerOpen && expandedTimerId && (() => {
          const et = activeTournaments.find(t => t.id === expandedTimerId)
          if (!et) return null
          return (
            <div style={{ position: 'fixed', inset: 0, zIndex: 10001 }}>
              <PlayerManageModal
                tournamentId={et.id}
                storeId={storeId}
                balanceGroupId={store?.balanceGroupId ?? storeId ?? undefined}
                chipUnit={store?.chipUnitLabel}
                chipUnitBefore={store?.chipUnitBefore}
                onClose={() => setExpandPlayerOpen(false)}
              />
            </div>
          )
        })()}

        {/* ── Expand: インライン Prize Modal (z:10001) ── */}
        {expandPrizeOpen && expandedTimerId && (() => {
          const et = activeTournaments.find(t => t.id === expandedTimerId)
          if (!et) return null
          return (
            <div style={{ position: 'fixed', inset: 0, zIndex: 10001 }}>
              <PrizeDistributeModal
                tournamentId={et.id}
                storeId={storeId}
                balanceGroupId={store?.balanceGroupId ?? storeId ?? undefined}
                chipUnit={store?.chipUnitLabel}
                chipUnitBefore={store?.chipUnitBefore}
                onClose={() => setExpandPrizeOpen(false)}
              />
            </div>
          )
        })()}

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
                    <p style={{ fontSize: 18, fontWeight: 900, color: '#FF3B30', letterSpacing: '-0.3px' }}>{req.amount.toLocaleString()}</p>
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
                    <p style={{ fontSize: 18, fontWeight: 900, color: '#34C759', letterSpacing: '-0.3px' }}>{req.amount.toLocaleString()}</p>
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
                          <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--label)', letterSpacing: '-0.2px' }}>{fmtChip(player.balance, store?.chipUnitLabel, store?.chipUnitBefore)}</p>
                          <p style={{ fontSize: 11, fontWeight: 700, color: player.netGain >= 0 ? '#34C759' : '#FF3B30' }}>
                            {player.netGain >= 0 ? '+' : '-'}{fmtChip(Math.abs(player.netGain), store?.chipUnitLabel, store?.chipUnitBefore)}
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
      <StoreBottomNav />

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

      {/* QRスキャナー */}
      {isScannerOpen && (
        <QRScanner
          onScan={qrCheckinPlayer}
          onClose={() => setIsScannerOpen(false)}
        />
      )}

      {/* QR入店結果トースト */}
      {qrCheckinResult && (
        <div style={{ position: 'fixed', bottom: 100, left: '50%', transform: 'translateX(-50%)', zIndex: 400, maxWidth: 320, width: 'calc(100% - 40px)' }}>
          <div style={{ borderRadius: 20, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.2)', animation: 'slideUp .35s cubic-bezier(.22,1,.36,1)', background: qrCheckinResult.success ? 'linear-gradient(135deg,#1C1C1E,#2C2C2E)' : 'linear-gradient(135deg,#FF3B30,#CC2200)' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: qrCheckinResult.success ? 'rgba(52,199,89,0.18)' : 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {qrCheckinResult.success
                ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="#34C759" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                : <FiX size={16} style={{ color: 'white' }} />
              }
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'white', letterSpacing: '-0.1px' }}>
                {qrCheckinResult.success ? `${qrCheckinResult.name || 'プレイヤー'} が入店しました` : 'QRコードが無効です'}
              </p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                {qrCheckinResult.success ? '入店が承認されました' : 'RRPokerのQRコードを読み取ってください'}
              </p>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}