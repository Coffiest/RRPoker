"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { auth, db } from "@/lib/firebase"
import HomeHeader from "@/components/HomeHeader"
import { getCommonMenuItems } from "@/components/commonMenuItems"
import PlayerManageModal from "./PlayerManageModal"
import PrizeDistributeModal from "./PrizeDistributeModal"
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

type PlayerInfo = {
  id: string
  name?: string
  iconUrl?: string
}

export default function StorePage() {
    const [timerRunning, setTimerRunning] = useState<Record<string, boolean>>({})

    const toggleTimer = (tournamentId: string) => {
      const running = timerRunning[tournamentId]
      if (running) {
        stopTimer(tournamentId)
      } else {
        startTimer(tournamentId)
      }
      setTimerRunning(prev => ({
        ...prev,
        [tournamentId]: !running
      }))
    }
  const router = useRouter()

  async function startTimer(tournamentId: string){
    if(!storeId) return
    await updateDoc(
      doc(db,"stores",storeId,"tournaments",tournamentId),
      {
        timerRunning:true,
        levelStartedAt:serverTimestamp()
      }
    )
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
      ? tournament.customBlindLevels.filter((lv: any) => lv?.type === "level")
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
    ? tournament.customBlindLevels.filter(
        (lv: any) => lv?.type === "level"
      )
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
  })
}
  async function pauseTimer(tournamentId: string) {
    if (!storeId) return;
    const ref = doc(db, "stores", storeId, "tournaments", tournamentId);
    await updateDoc(ref, {
      timerRunning: false
    });
  }
  async function prevLevel(tournamentId: string,currentLevel:number){
    if(!storeId) return
    await updateDoc(
      doc(db,"stores",storeId,"tournaments",tournamentId),
      {
        currentLevelIndex:Math.max(0,currentLevel-1),
        levelStartedAt:serverTimestamp()
      }
    )
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
        })
      }
      setActiveTournaments(list)
    })
    return () => unsub()
  }, [storeId])
  const [store, setStore] = useState<StoreInfo | null>(null)
  const [depositRequests, setDepositRequests] = useState<DepositRequest[]>([])
  const [players, setPlayers] = useState<PlayerInfo[]>([])
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
  const pageSize = 10

  useEffect(() => {
    if (!storeId) return
    const usersSnapUnsub = onSnapshot(collection(db, "users"), async (usersSnap) => {
      const players: any[] = []
      for (const userDoc of usersSnap.docs) {
        const userData = userDoc.data()
        const balanceRef = doc(db, "users", userDoc.id, "storeBalances", storeId)
        const balanceSnap = await getDoc(balanceRef)
        if (balanceSnap.exists()) {
          const balanceData = balanceSnap.data()
          players.push({
            id: userDoc.id,
            name: userData.name,
            iconUrl: userData.iconUrl,
            playerId: userData.playerId,
            balance: balanceData.balance ?? 0,
            netGain: balanceData.netGain ?? 0,
            lastVisitedAt: balanceData.lastVisitedAt?.toDate?.() ?? null,
          })
        }
      }
      players.sort((a, b) => {
        const atA = a.lastVisitedAt ? a.lastVisitedAt.getTime() : 0
        const atB = b.lastVisitedAt ? b.lastVisitedAt.getTime() : 0
        return atB - atA
      })
      setStorePlayers(players)
    })
    return () => usersSnapUnsub()
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
      collection(db, "users"),
      where("currentStoreId", "==", storeId)
    )
    const unsub = onSnapshot(q, snap => {
      console.log("=== INSTORE DEBUG START ===")
      console.log("storeId:", storeId)
      console.log("instore snap.size:", snap.size)
      const list: PlayerInfo[] = []
      snap.forEach(d => {
        const data = d.data()
        console.log("instore user:", d.id, {
          currentStoreId: data.currentStoreId,
          name: data.name,
        })
        list.push({
          id: d.id,
          name: data.name,
          iconUrl: data.iconUrl,
        })
      })
      console.log("=== INSTORE DEBUG END ===")
      setPlayers(list)
    })
    return () => unsub()
  }, [storeId])

  const playerMap = useMemo(() => {
    const map: Record<string, PlayerInfo> = {}
    players.forEach(p => (map[p.id] = p))
    return map
  }, [players])

  const filteredPlayers = useMemo(() => {
    const q = playerSearchInput.toLowerCase()
    if (!q) return players
    return players.filter(
      p =>
        (p.name ?? "").toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q)
    )
  }, [playerSearchInput, players])

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

    const approveDeposit = async (
    request: DepositRequest,
    approveType: "purchase" | "pure_increase"
  ) => {
    if (!storeId) return

    const balanceRef = doc(
      db,
      "users",
      request.playerId,
      "storeBalances",
      storeId
    )
    const balanceSnap = await getDoc(balanceRef)

    if (!balanceSnap.exists()) {
      await setDoc(
        balanceRef,
        {
          balance: request.amount,
          netGain: approveType === "pure_increase" ? request.amount : 0,
          storeId,
        },
        { merge: true }
      )
    } else {
      const updates: Record<string, any> = {
        balance: increment(request.amount),
      }
      if (approveType === "pure_increase") {
        updates.netGain = increment(request.amount)
      }
      await updateDoc(balanceRef, updates)
    }

    await updateDoc(doc(db, "depositRequests", request.id), {
      status: "approved",
      type: approveType,
    })

    await setDoc(doc(collection(db, "transactions")), {
      storeId,
      playerId: request.playerId,
      playerName: playerMap[request.playerId]?.name ?? null,
      amount: request.amount,
      direction: "add",
      type:
        approveType === "purchase"
          ? "deposit_approved_purchase"
          : "deposit_approved_pure_increase",
      createdAt: serverTimestamp(),
    })
  }

  const rejectDeposit = async (request: DepositRequest) => {
    await updateDoc(doc(db, "depositRequests", request.id), {
      status: "rejected",
    })
  }

  const runAdjustment = async (
    direction: "add" | "subtract",
    isNetGain: boolean
  ) => {
    if (!storeId || !selectedPlayerId) {
      setAdjustError("プレイヤーを選択してください")
      return
    }

    const amount = Number(adjustAmount)
    if (!amount || amount < 1) {
      setAdjustError("金額は1以上で入力してください")
      return
    }

    setAdjustError("")

    const balanceRef = doc(
      db,
      "users",
      selectedPlayerId,
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
      playerId: selectedPlayerId,
      playerName: playerMap[selectedPlayerId]?.name ?? null,
      amount,
      direction,
      type: isNetGain
        ? "manual_adjustment_net_gain"
        : "manual_adjustment",
      createdAt: serverTimestamp(),
    })

    setAdjustAmount("")
    setSelectedPlayerBalance(newBalance)
    setSelectedPlayerNetGain(newNetGain)
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
                          Plize
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

        {/* Cash Requests */}
        {depositRequests.length > 0 && (
          <div className="mt-6 cash-alert rounded-3xl p-5 animate-slideUp">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-8 w-8 rounded-full bg-[#F2A900] flex items-center justify-center">
                <FiDollarSign size={16} className="text-white" />
              </div>
              <p className="text-[16px] font-semibold text-gray-900">Cash</p>
              <span className="ml-auto bg-[#F2A900] text-white text-[12px] font-bold px-2.5 py-0.5 rounded-full">
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
                          {req.comment || "コメントなし"}
                        </p>
                      </div>
                    </div>
                    <p className="text-[18px] font-bold text-[#F2A900]">
                      ¥{req.amount.toLocaleString()}
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => approveDeposit(req, "purchase")}
                      className="rounded-xl bg-green-500 hover:bg-green-600 py-2.5 text-[12px] font-medium text-white transition-all active:scale-95"
                    >
                      購入
                    </button>
                    <button
                      type="button"
                      onClick={() => approveDeposit(req, "pure_increase")}
                      className="rounded-xl bg-blue-500 hover:bg-blue-600 py-2.5 text-[12px] font-medium text-white transition-all active:scale-95"
                    >
                      純増
                    </button>
                    <button
                      type="button"
                      onClick={() => rejectDeposit(req)}
                      className="rounded-xl bg-gray-200 hover:bg-gray-300 py-2.5 text-[12px] font-medium text-gray-700 transition-all active:scale-95"
                    >
                      却下
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* In-Store Players */}
        {players.length > 0 && (
          <div className="mt-6 tournament-card rounded-3xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                <FiUsers size={16} className="text-green-600" />
              </div>
              <p className="text-[15px] font-semibold text-gray-900">入店中</p>
              <span className="ml-auto bg-green-100 text-green-700 text-[12px] font-bold px-2.5 py-0.5 rounded-full">
                {players.length}
              </span>
            </div>

            <div className="space-y-2">
              {players.map(player => (
                <div
                  key={player.id}
                  className="flex items-center justify-between rounded-xl bg-gray-50 p-3 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {player.iconUrl ? (
                      <img
                        src={player.iconUrl}
                        alt={player.name}
                        className="h-8 w-8 rounded-full object-cover"
                      />
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
                        <FiUser size={14} className="text-gray-500" />
                      </div>
                    )}
                    <span className="text-[14px] font-medium text-gray-900">
                      {player.name || player.id}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={async () => {
                      await updateDoc(
                        doc(db, "users", player.id),
                        { currentStoreId: deleteField() }
                      )
                    }}
                    className="text-[13px] text-gray-500 hover:text-red-500 transition-colors flex items-center gap-1"
                  >
                    <FiLogOut size={14} />
                  </button>
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
            <p className="text-[16px] font-semibold text-gray-900">手動調整</p>
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

          {/* Selected Player Info */}
          {selectedPlayerId && (
            <div className="mb-4 rounded-2xl bg-gradient-to-br from-[#F2A900]/10 to-transparent p-4 border border-[#F2A900]/20">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[13px] font-medium text-gray-600">選択中</p>
                <p className="text-[14px] font-semibold text-gray-900">
                  {playerMap[selectedPlayerId]?.name || selectedPlayerId}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white rounded-xl p-3 text-center">
                  <p className="text-[11px] text-gray-500 mb-1">残高</p>
                  <p className="text-[18px] font-bold text-gray-900">¥{selectedPlayerBalance.toLocaleString()}</p>
                </div>
                <div className="bg-white rounded-xl p-3 text-center">
                  <p className="text-[11px] text-gray-500 mb-1">純増</p>
                  <p className={`text-[18px] font-bold ${selectedPlayerNetGain >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {selectedPlayerNetGain >= 0 ? '+' : ''}¥{selectedPlayerNetGain.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Amount Input */}
          <div className="mb-4">
            <input
              type="number"
              min={1}
              value={adjustAmount}
              onChange={e => setAdjustAmount(e.target.value)}
              placeholder="金額を入力"
              className="h-12 w-full rounded-2xl border border-gray-200 bg-white px-4 text-[16px] text-gray-900 outline-none focus:border-[#F2A900] focus:ring-2 focus:ring-[#F2A900]/20 transition-all text-center font-semibold"
            />
            {adjustError && (
              <p className="mt-2 text-[12px] text-red-500 text-center">{adjustError}</p>
            )}
          </div>

          {/* Add/Subtract Buttons */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <button
              type="button"
              onClick={() => {
                setPendingAdjustment({ direction: "add", amount: adjustAmount })
                setShowAdjustmentConfirm(true)
              }}
              className="h-12 rounded-2xl bg-gradient-to-r from-[#F2A900] to-[#D4910A] hover:from-[#D4910A] hover:to-[#C48509] text-white font-semibold text-[15px] flex items-center justify-center gap-2 transition-all shadow-md active:scale-95"
            >
              <FiPlus size={20} />
              <span>加算</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setPendingAdjustment({ direction: "subtract", amount: adjustAmount })
                setShowAdjustmentConfirm(true)
              }}
              className="h-12 rounded-2xl bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-800 hover:to-gray-900 text-white font-semibold text-[15px] flex items-center justify-center gap-2 transition-all shadow-md active:scale-95"
            >
              <FiMinus size={20} />
              <span>減算</span>
            </button>
          </div>

          {/* Confirmation Dialog */}
          {showAdjustmentConfirm && pendingAdjustment && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
              <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl animate-slideUp">
                <div className="text-center mb-6">
                  <div className={`h-14 w-14 rounded-full mx-auto mb-4 flex items-center justify-center ${pendingAdjustment.direction === 'add' ? 'bg-[#F2A900]/10' : 'bg-gray-100'}`}>
                    {pendingAdjustment.direction === 'add' ? (
                      <FiPlus size={24} className="text-[#F2A900]" />
                    ) : (
                      <FiMinus size={24} className="text-gray-700" />
                    )}
                  </div>
                  <p className="text-[18px] font-semibold text-gray-900 mb-2">
                    純増値の変更
                  </p>
                  <p className="text-[14px] text-gray-600 leading-relaxed">
                    純増値も同時に{pendingAdjustment.direction === "add" ? "加算" : "減算"}しますか？
                  </p>
                </div>
                <div className="space-y-2">
                  <button
                    className="w-full h-12 rounded-2xl bg-blue-500 hover:bg-blue-600 text-white font-semibold text-[15px] transition-all active:scale-95"
                    onClick={async () => {
                      setShowAdjustmentConfirm(false)
                      await runAdjustment(pendingAdjustment.direction, true)
                      setPendingAdjustment(null)
                    }}
                  >
                    はい（純増も変更）
                  </button>
                  <button
                    className="w-full h-12 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-900 font-semibold text-[15px] transition-all active:scale-95"
                    onClick={async () => {
                      setShowAdjustmentConfirm(false)
                      await runAdjustment(pendingAdjustment.direction, false)
                      setPendingAdjustment(null)
                    }}
                  >
                    いいえ（チップのみ）
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Player History */}
          {storePlayers.length > 0 && (
            <div className="pt-5 border-t border-gray-100">
              <p className="text-[14px] font-semibold text-gray-900 mb-3">入店履歴</p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {storePlayers.slice(0, storePlayersPage * pageSize).map(player => (
                  <button
                    key={player.id}
                    type="button"
                    onClick={() => selectPlayer(player.id)}
                    className={`w-full text-left rounded-xl p-3 transition-all ${
                      selectedPlayerId === player.id 
                        ? "bg-[#F2A900]/10 border border-[#F2A900]/30" 
                        : "bg-gray-50 border border-transparent hover:bg-gray-100"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {player.iconUrl ? (
                        <img src={player.iconUrl} alt={player.name} className="h-10 w-10 rounded-full object-cover" />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                          <FiUser size={16} className="text-gray-500" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-semibold text-gray-900 truncate">{player.name || player.id}</p>
                        <p className="text-[12px] text-gray-500">{player.playerId}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[14px] font-bold text-gray-900">¥{player.balance.toLocaleString()}</p>
                        <p className={`text-[12px] font-semibold ${player.netGain >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {player.netGain >= 0 ? "+" : ""}¥{player.netGain.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
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
    </main>
  )
}
