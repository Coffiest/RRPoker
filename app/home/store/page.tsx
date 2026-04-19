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
  collection,
  doc,
  deleteField,
  getDoc,
  increment,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore"
import { FiPlus, FiMinus, FiCopy, FiHome, FiUser, FiPlay, FiPause, FiSkipForward, FiSkipBack, FiUsers, FiTrendingUp, FiDollarSign, FiClock, FiCheck, FiX, FiSearch, FiLogOut } from "react-icons/fi"

type StoreInfo = {
  name: string
  iconUrl?: string
  code: string
}

type DepositRequest = {
  id: string
  playerId: string
  amount: number
  comment?: string
}

type WithdrawRequest = {
  id: string
  playerId: string
  amount: number
  comment?: string
}

type PlayerInfo = {
  id: string
  name?: string
  iconUrl?: string
}

export default function StorePage() {
    const [timerRunning, setTimerRunning] = useState<Record<string, boolean>>({})


const toggleTimer = async (tournamentId: string) => {
  const running = timerRunning[tournamentId]

  if (running) {
    await pauseTimer(tournamentId)
  } else {
    await resumeTimer(tournamentId)
  }


}


  const router = useRouter()

async function startTimer(tournamentId: string){
  if(!storeId) return

  await updateDoc(
    doc(db,"stores",storeId,"tournaments",tournamentId),
    {
      timerRunning:true,
      levelStartedAt:serverTimestamp(),
      pausedAt:null
    }
  )
}

async function resumeTimer(tournamentId: string){
  if(!storeId) return

  const ref = doc(db,"stores",storeId,"tournaments",tournamentId)
  const snap = await getDoc(ref)
  const data = snap.data()

  if(!data?.pausedAt || !data?.levelStartedAt) {
    await startTimer(tournamentId)
    return
  }

const now = Timestamp.now().toMillis()
const pausedMs = now - data.pausedAt.toMillis()

let startedAtMs: number

if (data.levelStartedAt?.toMillis) {
  startedAtMs = data.levelStartedAt.toMillis()
} else if (data.levelStartedAt instanceof Date) {
  startedAtMs = data.levelStartedAt.getTime()
} else if (typeof data.levelStartedAt === "number") {
  startedAtMs = data.levelStartedAt
} else {
   await startTimer(tournamentId)
  return
}

const newStart = startedAtMs + pausedMs

  await updateDoc(ref,{
    timerRunning:true,
    levelStartedAt: Timestamp.fromMillis(newStart),
    pausedAt:null
  })
}

  async function stopTimer(tournamentId: string){
    if(!storeId) return
    await updateDoc(
      doc(db,"stores",storeId,"tournaments",tournamentId),
      {
        timerRunning:false
      }
    )
  }
  function getNextLevelDurationSeconds(tournament: any, nextIndex: number) {
    const customLevels = Array.isArray(tournament.customBlindLevels)
  ? tournament.customBlindLevels
  : null

    const defaultLevels = [
      { smallBlind: 15, bigBlind: 30, ante: 30, duration: 20 },
      { smallBlind: 20, bigBlind: 40, ante: 40, duration: 20 },
      { smallBlind: 25, bigBlind: 50, ante: 50, duration: 20 },
      { smallBlind: 30, bigBlind: 60, ante: 60, duration: 20 },
      { smallBlind: 40, bigBlind: 80, ante: 80, duration: 20 },
      { smallBlind: 50, bigBlind: 100, ante: 100, duration: 20 },
      { smallBlind: 75, bigBlind: 150, ante: 150, duration: 20 },
      { smallBlind: 100, bigBlind: 200, ante: 200, duration: 20 },
    ]

    const levelsToUse =
      customLevels && customLevels.length > 0 ? customLevels : defaultLevels

    const safeIndex = Math.min(nextIndex, levelsToUse.length - 1)
    const nextLevel = levelsToUse[safeIndex]

    if (!nextLevel) return 0

    const durationMinutes =
      typeof nextLevel.duration === "number" && nextLevel.duration > 0
        ? nextLevel.duration
        : 20

    return durationMinutes * 60
  }

  async function nextLevel(tournamentId: string) {
  if (!storeId) return

  const ref = doc(db, "stores", storeId, "tournaments", tournamentId)

  const snap = await getDoc(ref)
  const data = snap.data()

  if (!data) return

  const currentLevel =
    typeof data.currentLevelIndex === "number"
      ? data.currentLevelIndex
      : 0

  const tournament = activeTournaments.find(
    (t) => t.id === tournamentId
  )

  if (!tournament) return

    const customLevels = Array.isArray(tournament.customBlindLevels)
  ? tournament.customBlindLevels
  : null

  const defaultLevels = [
    { smallBlind: 15, bigBlind: 30, ante: 30, duration: 20 },
    { smallBlind: 20, bigBlind: 40, ante: 40, duration: 20 },
    { smallBlind: 25, bigBlind: 50, ante: 50, duration: 20 },
    { smallBlind: 30, bigBlind: 60, ante: 60, duration: 20 },
    { smallBlind: 40, bigBlind: 80, ante: 80, duration: 20 },
    { smallBlind: 50, bigBlind: 100, ante: 100, duration: 20 },
    { smallBlind: 75, bigBlind: 150, ante: 150, duration: 20 },
    { smallBlind: 100, bigBlind: 200, ante: 200, duration: 20 },
  ]

  const levelsToUse =
    customLevels && customLevels.length > 0
      ? customLevels
      : defaultLevels

  const lastIndex = Math.max(0, levelsToUse.length - 1)

  const nextIndex = Math.min(currentLevel + 1, lastIndex)

  const nextLevelData = levelsToUse[nextIndex]

  const nextDurationSeconds =
    typeof nextLevelData?.duration === "number" &&
    nextLevelData.duration > 0
      ? nextLevelData.duration * 60
      : 20 * 60


await updateDoc(ref, {
  currentLevelIndex: nextIndex,
  timeRemaining: nextDurationSeconds,
  levelStartedAt: serverTimestamp(),
  pausedAt: null,
  timerRunning: false
})

}


async function pauseTimer(tournamentId: string){
  if(!storeId) return

  await updateDoc(
    doc(db,"stores",storeId,"tournaments",tournamentId),
    {
      timerRunning:false,
      pausedAt:serverTimestamp()
    }
  )
}

async function prevLevel(tournamentId: string,currentLevel:number){
  if(!storeId) return

  const ref = doc(db,"stores",storeId,"tournaments",tournamentId)

  const snap = await getDoc(ref)
  const data = snap.data()
  if(!data) return

  const tournament = activeTournaments.find(t => t.id === tournamentId)
  if(!tournament) return

  const customLevels = Array.isArray(tournament.customBlindLevels)
    ? tournament.customBlindLevels
    : null

  const defaultLevels = [
    { smallBlind: 15, bigBlind: 30, ante: 30, duration: 20 },
    { smallBlind: 20, bigBlind: 40, ante: 40, duration: 20 },
    { smallBlind: 25, bigBlind: 50, ante: 50, duration: 20 },
    { smallBlind: 30, bigBlind: 60, ante: 60, duration: 20 },
    { smallBlind: 40, bigBlind: 80, ante: 80, duration: 20 },
    { smallBlind: 50, bigBlind: 100, ante: 100, duration: 20 },
    { smallBlind: 75, bigBlind: 150, ante: 150, duration: 20 },
    { smallBlind: 100, bigBlind: 200, ante: 200, duration: 20 },
  ]

  const levelsToUse =
    customLevels && customLevels.length > 0
      ? customLevels
      : defaultLevels

  const prevIndex = Math.max(0, currentLevel - 1)

  const prevLevelData = levelsToUse[prevIndex]

  const prevDurationSeconds =
    typeof prevLevelData?.duration === "number" && prevLevelData.duration > 0
      ? prevLevelData.duration * 60
      : 20 * 60

  await updateDoc(ref, {
    currentLevelIndex: prevIndex,
    timeRemaining: prevDurationSeconds,
    levelStartedAt: serverTimestamp(),
    pausedAt: null,
    timerRunning: false
  })
}

  const [role, setRole] = useState<string | null>(null)

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        router.replace("/")
        return
      }

      const snap = await getDoc(doc(db, "users", user.uid))
      const data = snap.data()
      const userRole = data?.role ?? null

      setRole(userRole)

      if (userRole !== "store") {
        router.replace("/home")
      }
    })

    return () => unsub()
  }, [router])


  const [storeId, setStoreId] = useState<string | null>(null)
  const [activeTournaments, setActiveTournaments] = useState<any[]>([])
  const [showPlayerModal, setShowPlayerModal] = useState<string|null>(null)
  const [showPrizeModal, setShowPrizeModal] = useState<string|null>(null)
  const [activeTab, setActiveTab] = useState<"in" | "out">("in")
  const [inStorePage, setInStorePage] = useState(1)
  const [outStorePage, setOutStorePage] = useState(1)

  

  useEffect(() => {
    if (!storeId) return
    const tournamentsRef = collection(db, "stores", storeId, "tournaments")
    const q = query(tournamentsRef, where("status", "==", "active"))
    const unsub = onSnapshot(q, (snap) => {
      const list: any[] = []
      for (const docSnap of snap.docs) {
        const data = docSnap.data()
        const entry = (data.totalEntry ?? 0) as number
        const reentry = (data.totalReentry ?? 0) as number
        const addon = (data.totalAddon ?? 0) as number
        const bustCount = (data.bustCount ?? 0) as number
        const entryStack = (data.entryStack ?? 0) as number
        const reentryStack = (data.reentryStack ?? 0) as number
        const addonStack = (data.addonStack ?? 0) as number
        const totalEntries = entry + reentry
        const alive = totalEntries - bustCount
  list.push({
  id: docSnap.id,
  name: data.name,
  entry,
  reentry,
  addon,
  bustCount,
  entryStack,
  reentryStack,
  addonStack,
  totalEntries,
  alive,
  status: data.status ?? "scheduled",
  currentLevelIndex: data.currentLevelIndex ?? 0,
  timeRemaining: data.timeRemaining ?? 1200,
  selectedPreset: data.selectedPreset ?? "",
  customBlindLevels: Array.isArray(data.customBlindLevels) ? data.customBlindLevels : null,
  timerRunning: data.timerRunning ?? false   // ← 追加
})
      }
      setActiveTournaments(list)

      const runningMap: Record<string, boolean> = {}

list.forEach(t => {
  runningMap[t.id] = t.timerRunning ?? false
})

setTimerRunning(runningMap)

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
  const [adjustAmount, setAdjustAmount] = useState("")
  const [adjustError, setAdjustError] = useState("")
  const [showAdjustmentConfirm, setShowAdjustmentConfirm] = useState(false)
  const [showNetGainConfirm, setShowNetGainConfirm] = useState(false)
  const [pendingAdjustment, setPendingAdjustment] = useState<{ direction: "add" | "subtract"; amount: string } | null>(null)

  const [storePlayers, setStorePlayers] = useState<any[]>([])
  const [storePlayersPage, setStorePlayersPage] = useState(1)
  const [removingPlayerIds, setRemovingPlayerIds] = useState<string[]>([])
  const [removingAdjustmentPlayerIds, setRemovingAdjustmentPlayerIds] = useState<string[]>([])
  const [removingHistoryPlayerIds, setRemovingHistoryPlayerIds] = useState<string[]>([])
  const pageSize = 10
  const [adjustModalPlayer, setAdjustModalPlayer] = useState<any | null>(null)
const [adjustValue, setAdjustValue] = useState("")
const [manualNetGain, setManualNetGain] = useState(false)
const [depositOtherOpenId, setDepositOtherOpenId] = useState<string | null>(null)
const [withdrawOtherOpenId, setWithdrawOtherOpenId] = useState<string | null>(null)

const [depositOtherNetGain, setDepositOtherNetGain] = useState(false)
const [withdrawOtherNetGain, setWithdrawOtherNetGain] = useState(false)

const [depositOtherComment, setDepositOtherComment] = useState("")
const [withdrawOtherComment, setWithdrawOtherComment] = useState("")

useEffect(() => {
  if (!playerSearchInput) return

  const keyword = playerSearchInput.toLowerCase()

  const hitIn = storePlayers.filter(p =>
    p.isInStore && (p.name ?? "").toLowerCase().includes(keyword)
  )

  const hitOut = storePlayers.filter(p =>
    !p.isInStore && (p.name ?? "").toLowerCase().includes(keyword)
  )

  if (hitOut.length > 0 && hitIn.length === 0) {
    setActiveTab("out")
  }

  if (hitIn.length > 0 && hitOut.length === 0) {
    setActiveTab("in")
  }

}, [playerSearchInput, storePlayers])

useEffect(() => {
  if (!storeId) return

  const unsub = onSnapshot(collection(db, "users"), async (usersSnap) => {
    const list: any[] = []

    for (const userDoc of usersSnap.docs) {
      if (userDoc.id.startsWith("temp_")) continue

      const userData = userDoc.data()

      if (!userData.joinedStores?.includes(storeId)) continue

      const balanceRef = doc(db, "users", userDoc.id, "storeBalances", storeId)
      const balanceSnap = await getDoc(balanceRef)

      const balanceData = balanceSnap.exists() ? balanceSnap.data() : {}

      list.push({
        id: userDoc.id,
        name: userData.name,
        iconUrl: userData.iconUrl,
        balance: balanceData.balance ?? 0,
        netGain: balanceData.netGain ?? 0,
        lastVisitedAt: balanceData.lastVisitedAt?.toDate?.() ?? null,
        isInStore: userData.currentStoreId === storeId,
      })
    }

    list.sort((a, b) => {
      const atA = a.lastVisitedAt ? a.lastVisitedAt.getTime() : 0
      const atB = b.lastVisitedAt ? b.lastVisitedAt.getTime() : 0
      return atB - atA
    })

    setStorePlayers(list)
  })

  return () => unsub()
}, [storeId])

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async user => {
      if (!user) return
      const snap = await getDoc(doc(db, "users", user.uid))
      const data = snap.data()
      setStoreId(data?.storeId ?? null)
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    if (!storeId) return
    const fetchStore = async () => {
      const snap = await getDoc(doc(db, "stores", storeId))
      const data = snap.data() as StoreInfo | undefined
      if (!data) return
      setStore(data)
    }
    fetchStore()
  }, [storeId])

  useEffect(() => {
    if (!storeId) return
    const q = query(
      collection(db, "depositRequests"),
      where("storeId", "==", storeId),
      where("status", "==", "pending")
    )
    const unsub = onSnapshot(q, snap => {
      const list: DepositRequest[] = []
      snap.forEach(d => {
        const data = d.data()
        list.push({
          id: d.id,
          playerId: data.playerId,
          amount: data.amount,
          comment: data.comment,
        })
      })
      setDepositRequests(list)
    })
    return () => unsub()
  }, [storeId])

 useEffect(() => {
  if (!storeId) return

  const q = query(
    collection(db, "withdrawRequests"),
    where("storeId", "==", storeId),
    where("status", "==", "pending")
  )

  const unsub = onSnapshot(q, snap => {
    const list: WithdrawRequest[] = []
    snap.forEach(d => {
      const data = d.data()
      list.push({
        id: d.id,
        playerId: data.playerId,
        amount: data.amount,
        comment: data.comment,
      })
    })
    setWithdrawRequests(list)
  })

  return () => unsub()
}, [storeId])

 useEffect(() => {
  if (!storeId) return

  const q = query(
    collection(db, "users"),
    where("currentStoreId", "==", storeId)
  )

  const unsub = onSnapshot(q, snap => {
    const list: PlayerInfo[] = []
    snap.forEach(d => {
      const data = d.data()
      list.push({
        id: d.id,
        name: data.name,
        iconUrl: data.iconUrl,
      })
    })
    setPlayers(list)
  })

  return () => unsub()
}, [storeId])

useEffect(() => {
  if (!storeId) return

  const q = query(
    collection(db, "users"),
    where("pendingStoreId", "==", storeId)
  )

  const unsub = onSnapshot(q, snap => {
    const list: PlayerInfo[] = []
    snap.forEach(d => {
      const data = d.data()
      if (data.checkinStatus === "pending") {
        list.push({
          id: d.id,
          name: data.name,
          iconUrl: data.iconUrl,
        })
      }
    })
    setPendingPlayers(list.reverse())
  })

  return () => unsub()
}, [storeId])

useEffect(() => {
  if (!storeId) return

  const unsub = onSnapshot(collection(db, "users"), async (snap) => {
    const map: Record<string, number> = {}

    for (const userDoc of snap.docs) {
      if (userDoc.id.startsWith("temp_")) continue
      const ref = doc(db, "users", userDoc.id, "storeBalances", storeId)
      const s = await getDoc(ref)
      if (s.exists()) {
        map[userDoc.id] = s.data()?.balance ?? 0
      }
    }

    setPlayerBalances(map)
  })

  return () => unsub()
}, [storeId])



  const playerMap = useMemo(() => {
    const map: Record<string, PlayerInfo> = {}
    storePlayers.forEach(p => (map[p.id] = p))
    return map
  }, [storePlayers])

const inPlayers = useMemo(() => {
  const list = storePlayers
    .filter(p => p.isInStore)
    .sort((a, b) => {
      const atA = a.lastVisitedAt ? a.lastVisitedAt.getTime() : 0
      const atB = b.lastVisitedAt ? b.lastVisitedAt.getTime() : 0
      return atB - atA
    })

  if (!playerSearchInput) return list

  const keyword = playerSearchInput.toLowerCase()

const exact = list.filter(p =>
  (p.name ?? "").toLowerCase() === keyword
)

const partial = list.filter(p =>
  (p.name ?? "").toLowerCase().includes(keyword) &&
  (p.name ?? "").toLowerCase() !== keyword
)

const others = list.filter(p =>
  !(p.name ?? "").toLowerCase().includes(keyword)
)

return [...exact, ...partial, ...others]
}, [storePlayers, playerSearchInput])

const outPlayers = useMemo(() => {
  const list = storePlayers
    .filter(p => !p.isInStore)
    .sort((a, b) => {
      const atA = a.lastVisitedAt ? a.lastVisitedAt.getTime() : 0
      const atB = b.lastVisitedAt ? b.lastVisitedAt.getTime() : 0
      return atB - atA
    })

  if (!playerSearchInput) return list

  const keyword = playerSearchInput.toLowerCase()

const exact = list.filter(p =>
  (p.name ?? "").toLowerCase() === keyword
)

const partial = list.filter(p =>
  (p.name ?? "").toLowerCase().includes(keyword) &&
  (p.name ?? "").toLowerCase() !== keyword
)

const others = list.filter(p =>
  !(p.name ?? "").toLowerCase().includes(keyword)
)

return [...exact, ...partial, ...others]
}, [storePlayers, playerSearchInput])

const filteredPlayers = useMemo(() => {
  const q = playerSearchInput.toLowerCase()

  if (!q) return storePlayers

  return storePlayers.filter(
    p =>
      (p.name ?? "").toLowerCase().includes(q) ||
      p.id.toLowerCase().includes(q)
  )
}, [playerSearchInput, storePlayers])

  const selectPlayer = async (playerId: string) => {
    setSelectedPlayerId(playerId)
    setPlayerSearchInput("")
    if (!storeId) return
    const snap = await getDoc(
      doc(db, "users", playerId, "storeBalances", storeId)
    )
    if (snap.exists()) {
      setSelectedPlayerBalance(snap.data()?.balance ?? 0)
      setSelectedPlayerNetGain(snap.data()?.netGain ?? 0)
    } else {
      setSelectedPlayerBalance(0)
      setSelectedPlayerNetGain(0)
    }
  }

const approveDepositWithType = async (
  request: DepositRequest,
  type: "cashout" | "chip" | "other"
) => {
  if (!storeId) return

  const balanceRef = doc(db, "users", request.playerId, "storeBalances", storeId)

  let balanceDiff = 0
  let netDiff = 0
  let txType = ""

  if (type === "cashout") {
    balanceDiff = request.amount
    netDiff = request.amount
    txType = "store_cashout"
  }

  if (type === "chip") {
    balanceDiff = request.amount
    netDiff = 0
    txType = "store_chip_purchase"
  }

  if (type === "other") {
    balanceDiff = request.amount
    netDiff = depositOtherNetGain ? request.amount : 0
    txType = "other"
  }

  const updates: any = {
    balance: increment(balanceDiff),
  }

  if (netDiff !== 0) {
    updates.netGain = increment(netDiff)
  }

  await updateDoc(balanceRef, updates)

  await updateDoc(doc(db, "depositRequests", request.id), {
    status: "approved",
  })

  await setDoc(doc(collection(db, "transactions")), {
    storeId,
    playerId: request.playerId,
    playerName: playerMap[request.playerId]?.name ?? null,
    amount: request.amount,
    direction: "add",
    type: txType,
    comment: type === "other" ? depositOtherComment : null,
    createdAt: serverTimestamp(),
  })
}
const approveWithdrawWithType = async (
  request: WithdrawRequest,
  type: "buyin" | "tE" | "tR" | "tA" | "other"
) => {
  if (!storeId) return

  const balanceRef = doc(db, "users", request.playerId, "storeBalances", storeId)

  let balanceDiff = 0
  let netDiff = 0
  let txType = ""

  if (type === "buyin") {
    balanceDiff = -request.amount
    netDiff = -request.amount
    txType = "store_buyin"
  }

  if (type === "tE") {
    balanceDiff = -request.amount
    netDiff = -request.amount
    txType = "store_tournament_entry"
  }

  if (type === "tR") {
    balanceDiff = -request.amount
    netDiff = -request.amount
    txType = "store_tournament_reentry"
  }

  if (type === "tA") {
    balanceDiff = -request.amount
    netDiff = -request.amount
    txType = "store_tournament_addon"
  }

  if (type === "other") {
    balanceDiff = -request.amount
    netDiff = withdrawOtherNetGain ? -request.amount : 0
    txType = "other"
  }

  const updates: any = {
    balance: increment(balanceDiff),
  }

  if (netDiff !== 0) {
    updates.netGain = increment(netDiff)
  }

  await updateDoc(balanceRef, updates)

  await updateDoc(doc(db, "withdrawRequests", request.id), {
    status: "approved",
  })

  await setDoc(doc(collection(db, "transactions")), {
    storeId,
    playerId: request.playerId,
    playerName: playerMap[request.playerId]?.name ?? null,
    amount: request.amount,
    direction: "subtract",
    type: txType,
    comment: type === "other" ? withdrawOtherComment : null,
    createdAt: serverTimestamp(),
  })
}

  const rejectDeposit = async (request: DepositRequest) => {
    await updateDoc(doc(db, "depositRequests", request.id), {
      status: "rejected",
    })
  }

  const rejectWithdraw = async (request: WithdrawRequest) => {
  await updateDoc(doc(db, "withdrawRequests", request.id), {
    status: "rejected",
  })
}

  const runAdjustment = async (
    direction: "add" | "subtract",
    isNetGain: boolean
  ) => {
    if (!storeId || !adjustModalPlayer) {
      setAdjustError("プレイヤーを選択してください")
      return
    }

    const amount = Number(adjustValue)
    if (!amount || amount < 1) {
      setAdjustError("数字は1以上で入力してください")
      return
    }

    

    setAdjustError("")

const playerId = adjustModalPlayer.id

const balanceRef = doc(
  db,
  "users",
  playerId,
  "storeBalances",
  storeId
)


    const balanceSnap = await getDoc(balanceRef)
    const current = balanceSnap.data()?.balance ?? 0
    const currentNetGain = balanceSnap.data()?.netGain ?? 0

    if (direction === "subtract" && current < amount) {
      setAdjustError("残高が不足しています")
      return
    }

    let newBalance = current
    let newNetGain = currentNetGain

    if (!balanceSnap.exists()) {
      newBalance = direction === "add" ? amount : 0
      newNetGain =
        isNetGain && direction === "add" ? amount : 0

      await setDoc(
        balanceRef,
        {
          balance: newBalance,
          netGain: newNetGain,
          storeId,
        },
        { merge: true }
      )
    } else {
      newBalance =
        direction === "add" ? current + amount : current - amount

      if (isNetGain) {
        newNetGain =
          direction === "add"
            ? currentNetGain + amount
            : currentNetGain - amount
      }

      const updates: Record<string, any> = {
        balance: increment(direction === "add" ? amount : -amount),
      }

      if (isNetGain) {
        updates.netGain = increment(
          direction === "add" ? amount : -amount
        )
      }

      await updateDoc(balanceRef, updates)
    }

    

    await setDoc(doc(collection(db, "transactions")), {
      storeId,
playerId,
playerName: adjustModalPlayer.name ?? null,
      amount,
      direction,
      type: isNetGain
        ? "manual_adjustment_net_gain"
        : "manual_adjustment",
      createdAt: serverTimestamp(),
    })

    setAdjustValue("")
    setSelectedPlayerBalance(newBalance)
    setSelectedPlayerNetGain(newNetGain)
  }

  const runStoreAdjustment = async (adjustType: string) => {

  if (!storeId || !adjustModalPlayer) return

  const amount = Number(adjustValue)
  if (!amount || amount < 1) return

  const playerId = adjustModalPlayer.id

  const balanceRef = doc(db, "users", playerId, "storeBalances", storeId)

  let balanceDiff = 0

  let netDiff = 0

  let type = ""

  let direction: "add" | "subtract" = "add"

  switch (adjustType) {

    case "buyin":

      balanceDiff = -amount

      netDiff = -amount

      type = "store_buyin"

      direction = "subtract"

      break

    case "cashout":

      balanceDiff = amount

      netDiff = amount

      type = "store_cashout"

      direction = "add"

      break

    case "chip":

      balanceDiff = amount

      netDiff = 0

      type = "store_chip_purchase"

      direction = "add"

      break

    case "tE":

      balanceDiff = -amount

      netDiff = -amount

      type = "store_tournament_entry"

      direction = "subtract"

      break

    case "tR":

      balanceDiff = -amount

      netDiff = -amount

      type = "store_tournament_reentry"

      direction = "subtract"

      break

    case "tA":

      balanceDiff = -amount

      netDiff = -amount

      type = "store_tournament_addon"

      direction = "subtract"

      break

    default:

      return

  }

  const updates: any = {
  balance: increment(balanceDiff),
}

if (netDiff !== 0) {
  updates.netGain = increment(netDiff)
}

  await updateDoc(balanceRef, updates)

  

setStorePlayers(prev =>

  prev.map(p =>

    p.id === playerId

      ? {

          ...p,

          balance: p.balance + balanceDiff,

          netGain: netDiff !== 0 ? p.netGain + netDiff : p.netGain,

        }

      : p

  )

)

  await setDoc(doc(collection(db, "transactions")), {

    storeId,

    playerId,

    playerName: adjustModalPlayer.name ?? null,

    amount,

    direction,

    type,

    createdAt: serverTimestamp(),

  })

  setAdjustModalPlayer(null)

  setAdjustValue("")



}



const approvePlayer = async (playerId: string) => {
  if (!storeId) return

  const storeRef = doc(db, "stores", storeId)
  const storeSnap = await getDoc(storeRef)
  const storeData = storeSnap.data()

  await setDoc(doc(db, "users", playerId), {
    currentStoreId: storeId,
    checkinStatus: "approved",
    pendingStoreId: null,
  }, { merge: true })

  if (!storeData?.checkinBonusEnabled) return

  const stampRef = doc(db, "users", playerId, "storeStamp", storeId)
  const stampSnap = await getDoc(stampRef)

  const now = Timestamp.now().toMillis()

  let canStamp = true

  if (stampSnap.exists()) {
    const data = stampSnap.data()
    if (data.lastStampAt?.toMillis) {
      const last = data.lastStampAt.toMillis()

      const nowDate = new Date(now)
      const lastDate = new Date(last)

      const getResetBase = (d: Date) => {
        const base = new Date(d)
        base.setHours(3, 0, 0, 0)
        if (d.getHours() < 3) base.setDate(base.getDate() - 1)
        return base.getTime()
      }

      if (getResetBase(nowDate) === getResetBase(lastDate)) {
        canStamp = false
      }
    }
  }

  if (!canStamp) return

  let newCount = 1

  if (stampSnap.exists()) {
    const current = stampSnap.data().stampCount ?? 0
    newCount = current + 1
  }

  if (newCount >= 12) {
    await setDoc(doc(collection(db, "users", playerId, "coupons")), {
      name: storeData.checkinBonusCouponName,
      storeId: storeId,
      createdAt: serverTimestamp(),
    })

    await setDoc(stampRef, {
      stampCount: 0,
      lastStampAt: serverTimestamp(),
    })
  } else {
    await setDoc(stampRef, {
      stampCount: newCount,
      lastStampAt: serverTimestamp(),
    })
  }
}

const rejectPlayer = async (playerId: string) => {
  await setDoc(doc(db, "users", playerId), {
    checkinStatus: "none",
    pendingStoreId: null,
  }, { merge: true })
}

  const copyCode = async () => {
    if (!store?.code) return
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(store.code)
      } else {
        const textarea = document.createElement("textarea")
        textarea.value = store.code
        textarea.setAttribute("readonly", "")
        textarea.style.position = "fixed"
        textarea.style.opacity = "0"
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand("copy")
        document.body.removeChild(textarea)
      }
    } catch {}
  }

  if (role === null) {
    return <div className="p-6 bg-[#FFFBF5] min-h-screen flex items-center justify-center"><p className="text-gray-600">Loading...</p></div>
  }

  if (role !== "store") {
    return null
  }

  const openTimer = async (tournamentId:string) => {
    if (!storeId) {
      window.open(
        `/home/store/timer/${tournamentId}`,
        "_blank",
        "width=1200,height=900"
      )
      return;
    }
    try {
      await updateDoc(
        doc(db,"stores",storeId,"tournaments",tournamentId),
        {
          timerRunning:false
        }
      )
    } catch(e) {
      console.error("timerRunning reset error",e)
    }
    window.open(
      `/home/store/timer/${tournamentId}`,
      "_blank",
      "width=1200,height=900"
    )
  }

  return (
    <main className="min-h-[100dvh] w-full max-w-full overflow-x-hidden bg-[#FFFBF5] pb-32">
      <style>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-slideUp {
          animation: slideUp 0.3s ease-out;
        }
        .stat-badge {
          background: linear-gradient(145deg, rgba(242, 169, 0, 0.08) 0%, rgba(242, 169, 0, 0.03) 100%);
          border: 1px solid rgba(242, 169, 0, 0.15);
        }
        .tournament-card {
          background: linear-gradient(145deg, #ffffff 0%, #fefefe 100%);
          box-shadow: 
            0 2px 8px rgba(242, 169, 0, 0.06),
            0 8px 24px rgba(0, 0, 0, 0.04);
        }
        .cash-alert {
          background: linear-gradient(145deg, #FFF8ED 0%, #FFFBF5 100%);
          border: 1.5px solid rgba(242, 169, 0, 0.25);
        }
        .glass-card {
          background: rgba(255, 255, 255, 0.7);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
        }
      `}</style>
      
      <HomeHeader
        homePath="/home/store"
        myPagePath="/home/store/mypage"
        variant="store"
        menuItems={getCommonMenuItems(router, "store")}
      />

      <div className="mx-auto max-w-sm px-4">
        {showPlayerModal && (
          <PlayerManageModal
            tournamentId={showPlayerModal}
            storeId={storeId}
            onClose={() => setShowPlayerModal(null)}
          />
        )}
        {showPrizeModal && (
          <PrizeDistributeModal
            tournamentId={showPrizeModal}
            storeId={storeId}
            onClose={() => setShowPrizeModal(null)}
          />
        )}
        
{historyPlayerId && storeId && (
  <PlayerHistoryModal
    playerId={historyPlayerId}
    storeId={storeId}
    onClose={() => setHistoryPlayerId(null)}
  />
)}


        {/* Store Header */}
        <div className="mt-6 tournament-card rounded-3xl p-6 animate-slideUp">
          <div className="flex items-center gap-4">
            {store?.iconUrl ? (
              <div className="relative">
                <img
                  src={store.iconUrl}
                  alt={store?.name}
                  className="h-16 w-16 rounded-2xl object-cover shadow-md"
                />
                <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-green-500 border-2 border-white"></div>
              </div>
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#F2A900] to-[#D4910A] text-[16px] font-semibold text-white shadow-md">
                店
              </div>
            )}
            <div className="flex-1">
              <p className="text-[19px] font-semibold text-gray-900">
                {store?.name ?? ""}
              </p>
              <div className="mt-1.5 flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-1.5 w-fit">
                <span className="text-[13px] font-mono text-gray-600">
                  {store?.code ?? ""}
                </span>
                <button
                  type="button"
                  onClick={copyCode}
                  className="text-[#F2A900] hover:text-[#D4910A] transition-colors"
                >
                  <FiCopy size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Tournaments Section */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[18px] font-semibold text-gray-900">Today's Tournaments</h2>
            {activeTournaments.length > 0 && (
              <span className="text-[13px] font-medium text-gray-500">
                {activeTournaments.length} Active
              </span>
            )}
          </div>
          
          {activeTournaments.length === 0 ? (
            <div className="tournament-card rounded-3xl p-8 text-center">
              <div className="h-16 w-16 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-3">
                <FiClock size={28} className="text-gray-300" />
              </div>
              <p className="text-[14px] text-gray-500">開催中のトーナメントはありません</p>
            </div>
          ) : (
            <div className="space-y-4">
              {activeTournaments.map(t => {
                const totalEntry = t.entry ?? 0
                const totalReentry = t.reentry ?? 0
                const totalAddon = t.addon ?? 0
                const bustCount = t.bustCount ?? 0
                const entryStack = t.entryStack ?? 0
                const reentryStack = t.reentryStack ?? 0
                const addonStack = t.addonStack ?? 0
                const alive = (totalEntry + totalReentry) - bustCount
                const totalEntries = totalEntry + totalReentry
                const totalStack = (totalEntry * entryStack) + (totalReentry * reentryStack) + (totalAddon * addonStack)
                const average = alive > 0 ? Math.floor(totalStack / alive) : 0
                return (
                  <div key={t.id} className="tournament-card rounded-3xl p-5 animate-slideUp">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-[17px] font-semibold text-gray-900">{t.name}</h3>
                      <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
                    </div>
                    
                    {/* Stats Grid */}
                    <div className="grid grid-cols-3 gap-2 mb-4">
                      <div className="stat-badge rounded-xl p-3 text-center">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <FiUsers size={14} className="text-[#F2A900]" />
                        </div>
                        <p className="text-[18px] font-bold text-gray-900">{alive}</p>
                        <p className="text-[11px] text-gray-500 mt-0.5">Players</p>
                      </div>
                      <div className="stat-badge rounded-xl p-3 text-center">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <FiTrendingUp size={14} className="text-[#F2A900]" />
                        </div>
                        <p className="text-[18px] font-bold text-gray-900">{average.toLocaleString()}</p>
                        <p className="text-[11px] text-gray-500 mt-0.5">Average</p>
                      </div>
                      <div className="stat-badge rounded-xl p-3 text-center">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <FiPlus size={14} className="text-[#F2A900]" />
                        </div>
                        <p className="text-[18px] font-bold text-gray-900">{totalAddon}</p>
                        <p className="text-[11px] text-gray-500 mt-0.5">Add-on</p>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="space-y-2 mb-3">
                      <button
                        onClick={() => openTimer(t.id)}
                        className="w-full h-11 rounded-2xl bg-gradient-to-r from-gray-900 to-gray-800 hover:from-gray-800 hover:to-gray-700 text-white font-medium text-[14px] transition-all shadow-md active:scale-98 flex items-center justify-center gap-2"
                      >
                        <FiClock size={16} />
                        <span>タイマーへ</span>
                      </button>



                      <div className="grid grid-cols-2 gap-2">
                        <button
                          className="h-11 rounded-2xl bg-[#F2A900] hover:bg-[#D4910A] text-white font-medium text-[14px] transition-all shadow-md active:scale-98"
                          onClick={() => setShowPlayerModal(t.id)}
                        >
                          Players
                        </button>
                        <button
                          className="h-11 rounded-2xl bg-red-500 hover:bg-red-600 text-white font-medium text-[14px] transition-all shadow-md active:scale-98 disabled:opacity-40 disabled:cursor-not-allowed"
                          onClick={() => setShowPrizeModal(t.id)}
                          disabled={t.status !== "active"}
                        >
                          PRIZE
                        </button>
                      </div>








                    </div>
                    
                    {/* Timer Controls */}
                    <div className="flex items-center justify-center gap-2 pt-3 border-t border-gray-100">
                      <button
                        onClick={()=>prevLevel(t.id,t.currentLevelIndex ?? 0)}
                        className="h-10 w-10 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 transition-all active:scale-95"
                      >
                        <FiSkipBack size={16} className="text-gray-700"/>
                      </button>
                      <button
                        onClick={() => toggleTimer(t.id)}
                        className="h-10 w-10 flex items-center justify-center rounded-xl bg-gray-900 text-white hover:bg-gray-800 transition-all shadow-md active:scale-95"
                      >
                        {timerRunning[t.id] ? <FiPause size={16}/> : <FiPlay size={16}/>} 
                      </button>
                      <button
                        onClick={()=>nextLevel(t.id)}
                        className="h-10 w-10 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 transition-all active:scale-95"
                      >
                        <FiSkipForward size={16} className="text-gray-700"/>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {withdrawRequests.length > 0 && (
  <div className="mt-6 cash-alert rounded-3xl p-5 animate-slideUp">
    <div className="flex items-center gap-2 mb-4">
      <div className="h-8 w-8 rounded-full bg-red-700 flex items-center justify-center">
        <FiMinus size={16} className="text-white" />
      </div>
      <p className="text-[16px] font-semibold text-gray-900">ひきだしたい！</p>
      <span className="ml-auto bg-red-700 text-white text-[12px] font-bold px-2.5 py-0.5 rounded-full">
        {withdrawRequests.length}
      </span>
    </div>

    <div className="space-y-3">
      {withdrawRequests.map(req => (
        <div
          key={req.id}
          className="rounded-2xl bg-white p-4 shadow-sm border border-gray-100"
        >
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[14px] font-semibold text-gray-700">
                {playerMap[req.playerId]?.name ?? req.playerId}
              </p>
            </div>
            <p className="text-[18px] font-bold text-red-900">
              ¥{req.amount.toLocaleString()}
            </p>
          </div>






<div className="grid grid-cols-3 gap-2">

<button onClick={() => approveWithdrawWithType(req, "buyin")} className="rounded-xl bg-red-700 text-white py-2 text-sm font-medium">Buy-in</button>
<button onClick={() => approveWithdrawWithType(req, "tE")} className="rounded-xl bg-red-700 text-white py-2 text-sm">トナメE</button>
<button onClick={() => approveWithdrawWithType(req, "tR")} className="rounded-xl bg-red-700 text-white py-2 text-sm">トナメR</button>
<button onClick={() => approveWithdrawWithType(req, "tA")} className="rounded-xl bg-red-700 text-white py-2 text-sm">トナメA</button>
<button onClick={() => setWithdrawOtherOpenId(req.id)} className="rounded-xl bg-red-700 text-white py-2 text-sm">その他</button>
<button onClick={() => rejectWithdraw(req)} className="rounded-xl border border-red-400 text-red-500 py-2 text-sm font-medium">却下</button>

</div>

{withdrawOtherOpenId === req.id && (




<div className="mt-3 p-3 rounded-2xl bg-[#F2A900]/10 border border-[#F2A900]/30 space-y-3">

  <label className="flex items-center gap-2 text-sm text-gray-700">
    <input
      type="checkbox"
      checked={withdrawOtherNetGain}
      onChange={(e) => setWithdrawOtherNetGain(e.target.checked)}
      className="accent-[#F2A900]"
    />
    純増する
  </label>

  <input
    value={withdrawOtherComment}
    onChange={(e) => setWithdrawOtherComment(e.target.value)}
    className="w-full h-10 rounded-xl border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#F2A900]/40"
    placeholder="コメントを入力"
  />

  <button
    onClick={() => approveWithdrawWithType(req, "other")}
    className="w-full h-10 rounded-xl bg-[#F2A900] text-white text-sm font-medium shadow-sm hover:bg-[#D4910A] active:scale-95 transition-all"
  >
    確定する
  </button>

</div>




)}













        </div>
      ))}
    </div>
  </div>
)}

        {/* Cash Requests */}
        {depositRequests.length > 0 && (
          <div className="mt-6 cash-alert rounded-3xl p-5 animate-slideUp">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-8 w-8 rounded-full bg-green-500 flex items-center justify-center">
                <FiDollarSign size={16} className="text-white" />
              </div>
              <p className="text-[16px] font-semibold text-gray-900">あずけたい！</p>
              <span className="ml-auto bg-green-500 text-white text-[12px] font-bold px-2.5 py-0.5 rounded-full">
                {depositRequests.length}
              </span>
            </div>

            <div className="space-y-3">
              {depositRequests.map(req => (
                <div
                  key={req.id}
                  className="rounded-2xl bg-white p-4 shadow-sm border border-gray-100"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="h-9 w-9 rounded-full bg-gray-100 flex items-center justify-center">
                        <FiUser size={16} className="text-gray-600" />
                      </div>
                      <div>
                        <p className="text-[14px] font-semibold text-gray-900">
                          {playerMap[req.playerId]?.name ?? req.playerId}
                        </p>
                        <p className="text-[12px] text-gray-500">
                          {req.comment || ""}
                        </p>
                      </div>
                    </div>
                    <p className="text-[18px] font-bold text-green-500">
                      ¥{req.amount.toLocaleString()}
                    </p>
                  </div>

                    <div className="grid grid-cols-2 gap-2">




<button
  onClick={() => approveDepositWithType(req, "cashout")}
  className="rounded-xl bg-green-500 text-white py-2 text-sm font-medium"
>
CashOut
</button>

<button
  onClick={() => approveDepositWithType(req, "chip")}
  className="rounded-xl bg-green-500 text-white py-2 text-sm"
>
チップ購入
</button>

<button
  onClick={() => setDepositOtherOpenId(req.id)}
  className="rounded-xl bg-green-500 text-white py-2 text-sm"
>
その他
</button>

<button
  onClick={() => rejectDeposit(req)}
  className="rounded-xl border border-red-400 text-red-500 py-2 text-sm font-medium"
>
却下
</button>





                    </div>

                    {depositOtherOpenId === req.id && (


             <div className="mt-3 p-3 rounded-2xl bg-[#F2A900]/10 border border-[#F2A900]/30 space-y-3">

                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={depositOtherNetGain}
                      onChange={(e) => setDepositOtherNetGain(e.target.checked)}
                      className="accent-[#F2A900]"
                    />
                    純増する
                  </label>

                  <input
                    value={depositOtherComment}
                    onChange={(e) => setDepositOtherComment(e.target.value)}
                    className="w-full h-10 rounded-xl border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#F2A900]/40"
                    placeholder="コメントを入力"
                  />

                  <button
                    onClick={() => approveDepositWithType(req, "other")}
                    className="w-full h-10 rounded-xl bg-[#F2A900] text-white text-sm font-medium shadow-sm hover:bg-[#D4910A] active:scale-95 transition-all"
                  >
                    確定する
                  </button>

                </div>



                    )}








                </div>
              ))}
            </div>
          </div>
        )}


        {pendingPlayers.length > 0 && (
            <div className="mt-6 tournament-card rounded-3xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <p className="text-[15px] font-semibold text-gray-900">入店申請中のプレイヤー</p>
                <span className="ml-auto bg-yellow-100 text-yellow-700 text-[12px] font-bold px-2.5 py-0.5 rounded-full">
                  {pendingPlayers.length}
                </span>
              </div>

              <div className="space-y-2">
                {pendingPlayers.map(player => (
                  <div key={player.id} className="rounded-xl bg-gray-50 p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {player.iconUrl ? (
                          <img src={player.iconUrl} className="h-8 w-8 rounded-full"/>
                        ) : (
                          <FiUser />
                        )}
                        <span className="text-[14px] text-gray-900">{player.name}</span>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => approvePlayer(player.id)}
                          className="px-2 py-1 text-xs bg-green-500 text-white rounded"
                        >
                          許可
                        </button>
                        <button
                          onClick={() => rejectPlayer(player.id)}
                          className="px-2 py-1 text-xs bg-gray-400 text-white rounded"
                        >
                          却下
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

  

        {/* Manual Adjustment */}
        <div className="mt-6 tournament-card rounded-3xl p-5">
          <div className="flex items-center gap-2 mb-5">
            <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
              <FiDollarSign size={16} className="text-blue-600" />
            </div>
            <p className="text-[16px] font-semibold text-gray-900">Players</p>
          </div>

          {/* Search Player */}
          <div className="relative mb-4">
            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              value={playerSearchInput}
              onChange={e => setPlayerSearchInput(e.target.value)}
              placeholder="プレイヤー検索..."
              className="h-12 w-full rounded-2xl border border-gray-200 bg-white pl-11 pr-4 text-[14px] text-gray-900 outline-none focus:border-[#F2A900] focus:ring-2 focus:ring-[#F2A900]/20 transition-all"
            />
            {playerSearchInput && filteredPlayers.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-10 mt-2 max-h-60 overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-xl">
                {filteredPlayers.map(player => (
                  <button
                    key={player.id}
                    type="button"
                    onClick={() => selectPlayer(player.id)}
                    className="block w-full border-b border-gray-100 px-4 py-3 text-left text-[14px] text-gray-900 hover:bg-gray-50 transition-colors last:border-b-0"
                  >
                    {player.name ?? player.id}
                  </button>
                ))}
              </div>
            )}
          </div>

         

          {/* Player History */}
          {storePlayers.length > 0 && (
            <div className="pt-5 border-t border-gray-100">

              {/* タブ */}
                    <div className="flex mb-3">
                      <button
                        onClick={() => setActiveTab("in")}
                        className={`flex-1 py-2 text-sm ${activeTab === "in" ? "text-black font-bold" : "text-gray-400"}`}
                      >
                        入店中
                      </button>
                      <button
                        onClick={() => setActiveTab("out")}
                        className={`flex-1 py-2 text-sm ${activeTab === "out" ? "text-black font-bold" : "text-gray-400"}`}
                      >
                        退店済
                      </button>
                    </div>

                    <div className="space-y-2 max-h-[500px] overflow-y-auto">














{(() => {
  const list = activeTab === "in" ? inPlayers : outPlayers
  const keyword = playerSearchInput.toLowerCase()

  const hit = list.filter(p =>
    (p.name ?? "").toLowerCase().includes(keyword)
  )

  const paginated = list.slice(0, storePlayersPage * pageSize)

const selected = list.find(p => p.id === selectedPlayerId)

const merged = [
  ...(selected ? [selected] : []),
  ...hit.filter(p => p.id !== selectedPlayerId),
  ...paginated.filter(
    p =>
      p.id !== selectedPlayerId &&
      !hit.some(h => h.id === p.id)
  )
]

  return merged.map(player => (
             
                 <div
                  key={player.id}
                  className={`w-full rounded-xl p-3 transition-all duration-300 ${
                    removingAdjustmentPlayerIds.includes(player.id)
                      ? "opacity-0 translate-x-10 scale-95"
                      : selectedPlayerId === player.id
                      ? "bg-[#F2A900]/10 border border-[#F2A900]/30"
                      : "bg-gray-50 border border-transparent hover:bg-gray-100"
                  }`}
>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            

                            <div className="relative">
                              {player.iconUrl ? (
                                <img src={player.iconUrl} className="h-10 w-10 rounded-full object-cover" />
                              ) : (
                                <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                                  <FiUser size={16} className="text-gray-500" />
                                </div>
                              )}

                              {player.isInStore && (
                                <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 border-2 border-white"></span>
                              )}
                            </div>




                            <div>
                              <p className="text-[14px] font-semibold text-gray-900">
                                {player.name || player.id}
                              </p>
                            </div>
                          </div>

                          <div className="text-right">
                            <p className="text-[14px] font-bold text-gray-900">
                              ¥{player.balance.toLocaleString()}
                            </p>
                            <p className={`text-[12px] font-semibold ${player.netGain >= 0 ? "text-green-600" : "text-red-600"}`}>
                              {player.netGain >= 0 ? "+" : ""}¥{player.netGain.toLocaleString()}
                            </p>
                          </div>
                        </div>

                            <div className="flex gap-2 mt-2 justify-end">

                          <button
                            onClick={() => setHistoryPlayerId(player.id)}
                            className="h-8 px-3 rounded-xl bg-white border border-gray-200 text-gray-700 text-[12px] font-medium hover:bg-gray-50 transition-all"
                          >
                            りれき
                          </button>

                          <button
                            onClick={() => setAdjustModalPlayer(player)}
                            className="h-8 px-3 rounded-xl bg-[#F2A900] text-white text-[12px] font-medium hover:bg-[#D4910A] transition-all"
                          >
                            chip
                          </button>

                          {player.isInStore && (
                            <button
                              type="button"
                             onClick={async () => {
                                setRemovingAdjustmentPlayerIds(prev => [...prev, player.id])

                                setTimeout(async () => {
                                  await setDoc(
                                    doc(db, "users", player.id),
                                    {
                                      currentStoreId: deleteField(),
                                      checkinStatus: "none",
                                      pendingStoreId: null,
                                    },
                                    { merge: true }
                                  )

                                  setRemovingAdjustmentPlayerIds(prev => prev.filter(id => id !== player.id))
                                }, 300)
                              }}
                              className="h-8 w-8 rounded-xl bg-red-500 text-white flex items-center justify-center shadow-sm hover:bg-red-900 transition-all"
                            >
                              <FiLogOut size={14} />
                            </button>
                          )}

                        </div>
                      </div>
                

  ))
})()}


                
                {storePlayers.length > storePlayersPage * pageSize && (
                  <button
                    type="button"
                    className="w-full mt-3 h-10 rounded-xl border border-gray-200 bg-white text-[13px] font-medium text-gray-700 hover:bg-gray-50 transition-all"
                    onClick={() => setStorePlayersPage(p => p + 1)}
                  >
                    もっと見る
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 w-full z-[80] glass-card border-t border-gray-200/60 shadow-lg">
        <div className="relative mx-auto flex max-w-sm w-full items-center justify-between px-8 py-3">
          <button
            type="button"
            onClick={() => router.push("/home/store")}
            className="flex flex-col items-center text-[#F2A900] transition-all"
          >
            <FiHome size={22} />
            <span className="mt-1 text-[11px] font-medium">ホーム</span>
          </button>

          <button
            type="button"
            onClick={() => router.push("/home/store/tournaments")}
            className="absolute left-1/2 top-0 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-[#F2A900] to-[#D4910A] text-white shadow-xl hover:shadow-2xl transition-all active:scale-95"
          >
            <FiPlus size={28} />
          </button>

          <button
            type="button"
            onClick={() => router.push("/home/store/mypage")}
            className="flex flex-col items-center text-gray-400 hover:text-[#F2A900] transition-all"
          >
            <FiUser size={22} />
            <span className="mt-1 text-[11px]">マイページ</span>
          </button>
        </div>
      </nav>

{adjustModalPlayer && (
  <div className="fixed inset-0 z-[999] bg-black/60 flex items-center justify-center px-4">
    
    <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl p-6 animate-slideUp">
      
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-5">
        <p className="text-lg font-semibold text-gray-900">
          手動調整
        </p>
        <button
          onClick={() => setAdjustModalPlayer(null)}
          className="text-gray-400 hover:text-gray-700 text-xl"
        >
          ×
        </button>
      </div>

      {/* 金額入力 */}
      <input
        value={adjustValue}
        onChange={e => setAdjustValue(e.target.value)}
        className="w-full h-12 rounded-xl border border-gray-300 px-4 text-center text-lg font-semibold text-gray-900 mb-4 focus:outline-none focus:ring-2 focus:ring-[#F2A900]"
        placeholder="数字を入力"
      />



{/* 通常操作 */}
<p className="text-sm text-gray-500 mb-2">リングゲーム</p>
<div className="grid grid-cols-3 gap-2 mb-4">
  <button
    onClick={async () => {
      await runStoreAdjustment("buyin")
    }}
    className="h-10 rounded-xl bg-gray-800 text-white text-sm font-medium"
  >
    Buy-in
  </button>
  <button
    onClick={async () => {
      await runStoreAdjustment("cashout")
    }}
    className="h-10 rounded-xl bg-gray-800 text-white text-sm font-medium"
  >
    CashOut
  </button>
  <button
    onClick={async () => {
      await runStoreAdjustment("chip")
    }}
    className="h-10 rounded-xl bg-gray-800 text-white text-sm font-medium"
  >
    チップ購入
  </button>
</div>

{/* トナメ */}
<p className="text-sm text-gray-500 mb-2">トーナメント</p>
<div className="grid grid-cols-3 gap-2 mb-6">
  <button
    onClick={async () => {
      await runStoreAdjustment("tE")
    }}
    className="h-10 rounded-xl bg-gray-800 text-white text-sm"
  >
    トナメE
  </button>
  <button
    onClick={async () => {
      await runStoreAdjustment("tR")
    }}
    className="h-10 rounded-xl bg-gray-800 text-white text-sm"
  >
    トナメR
  </button>
  <button
    onClick={async () => {
      await runStoreAdjustment("tA")
    }}
    className="h-10 rounded-xl bg-gray-800 text-white text-sm"
  >
    トナメA
  </button>
</div>


      {/* 手動調整 */}
<p className="text-sm text-gray-500 mb-2">手動調整</p>

<div className="grid grid-cols-2 gap-2 mb-3">
  <button
    onClick={async () => {
      await runAdjustment("add", manualNetGain)
      setAdjustModalPlayer(null)
      setAdjustValue("")
    }}
    className="h-10 rounded-xl bg-blue-900 text-white text-sm font-medium"
  >
    ＋(加算する)
  </button>

  <button
    onClick={async () => {
      await runAdjustment("subtract", manualNetGain)
      setAdjustModalPlayer(null)
      setAdjustValue("")
    }}
    className="h-10 rounded-xl bg-red-900 text-white text-sm font-medium"
  >
    ー(減算する)
  </button>
</div>

<label className="flex items-center gap-2 text-sm text-gray-700 mb-6">
  <input
    type="checkbox"
    checked={manualNetGain}
    onChange={(e) => setManualNetGain(e.target.checked)}
  />
  純増値も更新する
</label>



    </div>
  </div>
)}

      
    </main>
  )
}
