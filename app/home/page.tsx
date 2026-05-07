"use client"

import { useEffect, useMemo, useRef, useState, type MutableRefObject, type Dispatch, type SetStateAction } from "react"
import { auth, db } from "@/lib/firebase"
import { arrayRemove, arrayUnion, collection, deleteField, doc, getDoc, getDocs, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where, addDoc } from "firebase/firestore"
import { FiHome, FiCreditCard, FiUser, FiX, FiSearch, FiStar, FiTrendingUp, FiLogOut, FiArrowLeft, FiClock, FiHelpCircle, FiAward, FiEdit2, FiBarChart2, FiCalendar, FiChevronLeft, FiChevronRight, FiFileText, FiShare2 } from "react-icons/fi"
import { BsQrCodeScan } from "react-icons/bs"
import HomeHeader from "@/components/HomeHeader"
import { useRouter } from "next/navigation"
import { getCommonMenuItems } from "@/components/commonMenuItems"
import { getNetGainRanking, getUserRank, RankingPlayer } from "@/lib/ranking"
import { getNetGainRankingFromUsers, getMyNetGainRank, getMonthlyNetGainRanking, NetGainPlayer } from "@/lib/netGainRanking"
import HandHistoryModal from "./HandHistoryModal"
import PullToRefresh from "@/app/components/PullToRefresh"
import dynamic from "next/dynamic"
const PlayerQRModal = dynamic(() => import("@/app/components/PlayerQRModal"), { ssr: false })

type StoreInfo = {
  id: string
  name: string
  iconUrl?: string
  address?: string
  chipUnitLabel?: string
  chipUnitBefore?: boolean
  description?: string
  ringBlindSb?: number
  ringBlindBb?: number
  chipExpiryMonths?: number
}
type UserProfile = { name?: string; iconUrl?: string }
type StorePlayer = { id: string; name?: string; iconUrl?: string }
type RRPlayer = { id: string; name?: string; iconUrl?: string; roi: number; rrRating: number; rank: number }

function txNetGainDelta(tx: any): number | null {
  const amt = tx.amount ?? 0
  switch (tx.type) {
    case "store_cashout": return amt
    case "store_buyin": return -amt
    case "store_tournament_entry": return -amt
    case "store_tournament_reentry": return -amt
    case "store_tournament_addon": return -amt
    case "tournament_payout": return amt
    case "manual_adjustment_net_gain": return tx.direction === "add" ? amt : -amt
    case "withdraw_approved": return -amt
    case "other_net_gain": return tx.direction === "add" ? amt : -amt
    default: return null
  }
}

export default function HomePage() {
  const getVisitCountResetBase = (date: Date) => {
    const base = new Date(date)
    base.setHours(3, 0, 0, 0)
    if (date.getHours() < 3) base.setDate(base.getDate() - 1)
    return base.getTime()
  }

  const router = useRouter()
  const [authReady, setAuthReady] = useState(false)
  const [splashDone, setSplashDone] = useState(false)

  useEffect(() => {
    if (sessionStorage.getItem('rrpoker_splash_shown')) setSplashDone(true)
  }, [])
  const [userId, setUserId] = useState<string | null>(null)
  const [currentStoreId, setCurrentStoreId] = useState<string | null>(null)
  const [joinedStores, setJoinedStores] = useState<string[]>([])
  const [favoriteStores, setFavoriteStores] = useState<string[]>([])
  const [stores, setStores] = useState<Record<string, StoreInfo>>({})
  const [balance, setBalance] = useState<number>(0)
  const [netGain, setNetGain] = useState<number>(0)
  const [searchQuery, setSearchQuery] = useState("")
  const [allStores, setAllStores] = useState<StoreInfo[]>([])
  const [selectedStore, setSelectedStore] = useState<StoreInfo | null>(null)
  const [profile, setProfile] = useState<UserProfile>({})
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false)
  const [isRankingModalOpen, setIsRankingModalOpen] = useState(false)
  const [isHistoryFlipped, setIsHistoryFlipped] = useState(false)
  const [isDetailedRankingModalOpen, setIsDetailedRankingModalOpen] = useState(false)
  const [favoriteMessage, setFavoriteMessage] = useState("")
  const [favoritePulse, setFavoritePulse] = useState("")
  const [transactionItems, setTransactionItems] = useState<any[]>([])
  const [tournamentHistoryItems, setTournamentHistoryItems] = useState<any[]>([])
  const [ranking, setRanking] = useState<NetGainPlayer[]>([])
  const [userRank, setUserRank] = useState<NetGainPlayer | null>(null)
  const [rankingLoading, setRankingLoading] = useState(true)
  const [rankingTab, setRankingTab] = useState<'all' | 'monthly'>('all')
  const [monthlyRanking, setMonthlyRanking] = useState<NetGainPlayer[]>([])
  const [monthlyUserRank, setMonthlyUserRank] = useState<NetGainPlayer | null>(null)
  const [monthlyRankingLoading, setMonthlyRankingLoading] = useState(false)
  const [isPlayersModalOpen, setIsPlayersModalOpen] = useState(false)
  const [playersPreview, setPlayersPreview] = useState<StorePlayer[]>([])
  const [playersPreviewStore, setPlayersPreviewStore] = useState<StoreInfo | null>(null)
  const [playersPreviewLoading, setPlayersPreviewLoading] = useState(false)
  const [rrRanking, setRrRanking] = useState<RRPlayer[]>([])
  const [rrMyEntry, setRrMyEntry] = useState<RRPlayer | null>(null)
  const [rrRatingInfoOpen, setRrRatingInfoOpen] = useState(false)
  const [rrRatingValue, setRrRatingValue] = useState(1000)
  const [rrCardFlipped, setRrCardFlipped] = useState(false)
  const [rrBackFaceVisible, setRrBackFaceVisible] = useState(false)
  const [rrFullRanking, setRrFullRanking] = useState<RRPlayer[]>([])
  const [rrRankingLoading, setRrRankingLoading] = useState(true)
  const [displayBalance, setDisplayBalance] = useState(0)
  const [displayNetGain, setDisplayNetGain] = useState(0)
  const [showBB, setShowBB] = useState(false)
  const balanceRef = useRef(0)
  const netGainRef = useRef(0)
  const [role, setRole] = useState<string | null>(null)
  const [checkinStatus, setCheckinStatus] = useState<"none" | "pending" | "approved">("none")
  const [pendingStoreId, setPendingStoreId] = useState<string | null>(null)
  const [isPendingModalOpen, setIsPendingModalOpen] = useState(false)
  const [isCheckinCompleteModalOpen, setIsCheckinCompleteModalOpen] = useState(false)
  const [showStampModal, setShowStampModal] = useState(false)
  const [stampCount, setStampCount] = useState(0)
  const prevCheckinStatusRef = useRef<"none" | "pending" | "approved">("none")
  const isFirstSnapshotRef = useRef(true)
  const [hasShownCheckinComplete, setHasShownCheckinComplete] = useState(false)
  const [hasShownStamp, setHasShownStamp] = useState(false)
  const shownWithdrawIdsRef = useRef<Set<string>>(new Set())
  const [withdrawNotice, setWithdrawNotice] = useState<{ type: "approved" | "rejected" | "pending"; amount: number } | null>(null)
  const prevCurrentStoreIdRef = useRef<string | null>(null)

  // ── チップ増減グラフ
  const [chipGraphTab, setChipGraphTab] = useState<"7" | "1m" | "all">("all")
  const [graphMode, setGraphMode] = useState<'all' | 'tournament'>('all')
  const graphTouchStartX = useRef<number | null>(null)

  // ── RR Rating 表示値（45未満は44.0〜45.0のランダム値で固定表示）
  const maskedRrDisplay = useRef<number | null>(null)
  const maskedRrForRating = useRef<number | null>(null)

  // ── QR modal
  const [isQRModalOpen, setIsQRModalOpen] = useState(false)

  // ── RR Rating tooltip (fixed position to escape overflow:hidden)
  const rrRatingBtnRef = useRef<HTMLButtonElement>(null)
  const [rrRatingInfoPos, setRrRatingInfoPos] = useState<{ top: number; right: number } | null>(null)

  // ── Stats delta animation (shows growth badges after a tournament)
  const [statsDelta, setStatsDelta] = useState<{
    rrRating: number
    totalCost: number
    totalReward: number
    itmRate: number
    roi: number | null
  } | null>(null)
  const [showStatsDelta, setShowStatsDelta] = useState(false)
  const [animRrRating, setAnimRrRating] = useState<number | null>(null)
  const deltaDismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const deltaAnimStart = useRef<number>(0)

  // ── Tournament history chart
  const [selectedTnIdx, setSelectedTnIdx] = useState<number | null>(null)
  const [tooltipPos, setTooltipPos] = useState<{ left: number; top: number; above: boolean } | null>(null)
  const historyScrollRef = useRef<HTMLDivElement>(null)

  // ── スケジュール（5日間タブ）
  const now = new Date()
  const [calFavTournaments, setCalFavTournaments] = useState<any[]>([])
  const [calDetailTournament, setCalDetailTournament] = useState<any | null>(null)
  const [calDetailPreset, setCalDetailPreset] = useState<any | null>(null)
  const [calLiveData, setCalLiveData] = useState<Record<string, any>>({})
  const [calAutoPresets, setCalAutoPresets] = useState<Record<string, any>>({})
  const calLiveUnsubsRef = useRef<(() => void)[]>([])
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
  const [calScheduleTab, setCalScheduleTab] = useState(todayStr)

  // ── チップグラフ用全トランザクション
  const [allNetGainTx, setAllNetGainTx] = useState<any[]>([])

  // ── すべての useEffect（ロジック完全保持）──────────────────────────
  useEffect(() => {
    if (isCheckinCompleteModalOpen) {
      const timer = setTimeout(() => setIsCheckinCompleteModalOpen(false), 2000)
      return () => clearTimeout(timer)
    }
  }, [isCheckinCompleteModalOpen])

  useEffect(() => {
    const fetchTransactionData = async () => {
      if (!userId || !currentStoreId) { setTransactionItems([]); return }
      try {
        const snap = await getDocs(query(collection(db, "transactions"), where("playerId", "==", userId), where("storeId", "==", currentStoreId)))
        const list: any[] = []
        snap.forEach(docSnap => list.push({ id: docSnap.id, ...docSnap.data() }))
        list.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))
        setTransactionItems(list)
      } catch (e) { console.error(e); setTransactionItems([]) }
    }
    fetchTransactionData()
  }, [userId, currentStoreId])

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(user => {
      setUserId(user?.uid ?? null)
      sessionStorage.setItem('rrpoker_splash_shown', '1')
      setAuthReady(true)
      setSplashDone(true)
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    const saved = localStorage.getItem("shownWithdrawIds")
    if (saved) shownWithdrawIdsRef.current = new Set(JSON.parse(saved))
  }, [])

  useEffect(() => {
    const checkinShown = localStorage.getItem("hasShownCheckinComplete")
    const stampShown = localStorage.getItem("hasShownStamp")
    if (checkinShown === "true") setHasShownCheckinComplete(true)
    if (stampShown === "true") setHasShownStamp(true)
  }, [])

  useEffect(() => {
    if (!userId) return
    const ref = doc(db, "users", userId)
    if (userId.startsWith("temp_")) return
    const unsub = onSnapshot(ref, async (snap) => {
      const data = snap.data()

      // Birthday coupon — subcollection may lack rules, so isolate failures
      try {
        const today = new Date()
        const todayStr = today.toISOString().slice(5, 10)
        const birthday = data?.birthday?.slice(5, 10)
        if (birthday === todayStr && userId) {
          const storeId = data?.currentStoreId
          if (storeId) {
            const storeSnap = await getDoc(doc(db, "stores", storeId))
            const store = storeSnap.data()
            if (store?.birthdayCouponEnabled) {
              const ticketSnap = await getDocs(collection(db, "users", userId, "tickets"))
              const alreadyHas = ticketSnap.docs.some(docSnap => docSnap.data().name === store.birthdayCouponName)
              if (!alreadyHas) {
                await addDoc(collection(db, "users", userId, "tickets"), {
                  name: store.birthdayCouponName, storeId,
                  createdAt: serverTimestamp(),
                  expiresAt: (() => {
                    if (store.birthdayCouponUnlimited) return null
                    const now = new Date()
                    const value = Number(store.birthdayCouponExpiryValue ?? 0)
                    if (!value || value <= 0) return null
                    if (store.birthdayCouponExpiryUnit === "day") return new Date(now.getTime() + value * 24 * 60 * 60 * 1000)
                    if (store.birthdayCouponExpiryUnit === "month") { const d = new Date(now); d.setMonth(d.getMonth() + value); return d }
                    return null
                  })(),
                  isUsed: false
                })
              }
            }
          }
        }
      } catch {}

      const userRole = data?.role ?? null
      setRole(userRole)
      if (userRole === "store") { router.replace("/home/store"); return }
      const status = data?.checkinStatus ?? "none"
      const prevStatus = prevCheckinStatusRef.current
      const isFirstSnapshot = isFirstSnapshotRef.current
      isFirstSnapshotRef.current = false
      setCheckinStatus(status)
      setPendingStoreId(data?.pendingStoreId ?? null)

      // Checkin complete + stamp modal — must run before status dispatch resets flags
      // Also triggers on QR check-in (none → approved), but not on initial page load
      if (!isFirstSnapshot && (prevStatus === "pending" || prevStatus === "none") && status === "approved" && !hasShownCheckinComplete) {
        setIsCheckinCompleteModalOpen(true)
        setHasShownCheckinComplete(true)
        localStorage.setItem("hasShownCheckinComplete", "true")
        if (data?.currentStoreId) {
          // storeStamp subcollection may lack rules — wrap so status dispatch always runs
          try {
            const storeSnap = await getDoc(doc(db, "stores", data.currentStoreId))
            const storeData = storeSnap.data()
            if (storeData?.checkinBonusEnabled && !hasShownStamp) {
              const stampSnap = await getDoc(doc(db, "users", userId, "storeStamp", data.currentStoreId))
              if (stampSnap.exists()) {
                setStampCount(stampSnap.data().stampCount ?? 0)
                setShowStampModal(true)
                setHasShownStamp(true)
                localStorage.setItem("hasShownStamp", "true")
              }
            }
          } catch {}
        }
      }

      // Status dispatch — guaranteed to run regardless of errors above
      prevCheckinStatusRef.current = status
      if (status === "approved") {
        setCurrentStoreId(data?.currentStoreId ?? null)
        localStorage.removeItem("hasShownCheckinComplete")
        localStorage.removeItem("hasShownStamp")
        setHasShownCheckinComplete(false)
        setHasShownStamp(false)
        setIsPendingModalOpen(false)
      }
      if (status === "pending") setIsPendingModalOpen(true)
      if (status === "none") { setIsPendingModalOpen(false); setCurrentStoreId(null) }
      setJoinedStores(Array.isArray(data?.joinedStores) ? data.joinedStores : [])
      setFavoriteStores(Array.isArray(data?.favoriteStores) ? data.favoriteStores : [])
      setProfile({ name: data?.name, iconUrl: data?.iconUrl })
      const rating = typeof data?.rrRating === "number" ? data.rrRating : 1000
      setRrRatingValue(rating)
      if (typeof data?.rrRating !== "number") await setDoc(ref, { rrRating: 1000 }, { merge: true })
    })
    return () => unsub()
  }, [userId, router])

  useEffect(() => {
    const fetchStores = async () => {
      if (!joinedStores.length) { setStores({}); return }
      const next: Record<string, StoreInfo> = {}
      await Promise.all(joinedStores.map(async storeId => {
        const snap = await getDoc(doc(db, "stores", storeId))
        if (!snap.exists()) return
        const data = snap.data() as StoreInfo
        next[storeId] = { id: storeId, name: data.name, iconUrl: data.iconUrl, address: data.address, chipUnitLabel: data.chipUnitLabel, chipUnitBefore: data.chipUnitBefore !== false, description: data.description, ringBlindSb: typeof data.ringBlindSb === "number" ? data.ringBlindSb : undefined, ringBlindBb: typeof data.ringBlindBb === "number" ? data.ringBlindBb : undefined, chipExpiryMonths: typeof data.chipExpiryMonths === "number" ? data.chipExpiryMonths : undefined }
      }))
      setStores(next)
    }
    fetchStores()
  }, [joinedStores])

  useEffect(() => {
    if (!userId || !currentStoreId) { setBalance(0); setNetGain(0); return }
    const balanceDocRef = doc(db, "users", userId, "storeBalances", currentStoreId)
    const unsub = onSnapshot(balanceDocRef, snap => {
      if (!snap.exists()) { setBalance(0); setNetGain(0); return }
      const data = snap.data()
      setBalance(typeof data?.balance === "number" ? data.balance : 0)
      setNetGain(typeof data?.netGain === "number" ? data.netGain : 0)
    })
    return () => unsub()
  }, [userId, currentStoreId])

  useEffect(() => {
    const fetchHistoryData = async () => {
      if (!userId) { setTournamentHistoryItems([]); return }
      try {
        const snap = await getDocs(collection(db, "users", userId, "tournamentHistory"))
        const list: any[] = []
        snap.forEach(docSnap => list.push({ id: docSnap.id, ...docSnap.data() }))
        list.sort((a, b) => (b.startedAt?.seconds ?? 0) - (a.startedAt?.seconds ?? 0))
        setTournamentHistoryItems(list)
      } catch (error) { console.error("Failed to fetch history:", error); setTournamentHistoryItems([]) }
    }
    fetchHistoryData()
  }, [userId])

  useEffect(() => {
    const fetchRankingData = async () => {
      if (!currentStoreId) { setRanking([]); setUserRank(null); setRankingLoading(false); return }
      setRankingLoading(true)
      try {
        const rankingData = await getNetGainRankingFromUsers(currentStoreId)
        setRanking(rankingData)
        if (userId) { const uRank = getMyNetGainRank(userId, rankingData); setUserRank(uRank) }
      } catch (error) { console.error("Failed to fetch ranking:", error); setRanking([]); setUserRank(null) }
      finally { setRankingLoading(false) }
    }
    fetchRankingData()
  }, [userId, currentStoreId])

  useEffect(() => {
    const fetchMonthlyRanking = async () => {
      if (!currentStoreId || rankingTab !== 'monthly') return
      setMonthlyRankingLoading(true)
      try {
        const now = new Date()
        const data = await getMonthlyNetGainRanking(currentStoreId, now.getFullYear(), now.getMonth())
        setMonthlyRanking(data)
        if (userId) setMonthlyUserRank(getMyNetGainRank(userId, data))
      } catch (e) { console.error("Failed to fetch monthly ranking:", e); setMonthlyRanking([]); setMonthlyUserRank(null) }
      finally { setMonthlyRankingLoading(false) }
    }
    fetchMonthlyRanking()
  }, [userId, currentStoreId, rankingTab])

  useEffect(() => {
    const animateCount = (target: number, ref: MutableRefObject<number>, setter: Dispatch<SetStateAction<number>>) => {
      const start = performance.now(); const from = ref.current; const diff = target - from; const duration = 900
      const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)
      const step = (time: number) => {
        const progress = Math.min((time - start) / duration, 1)
        const value = Math.round(from + diff * easeOut(progress))
        setter(value)
        if (progress < 1) requestAnimationFrame(step)
        else ref.current = target
      }
      requestAnimationFrame(step)
    }
    animateCount(balance, balanceRef, setDisplayBalance)
  }, [balance])

  useEffect(() => {
    const animateCount = (target: number, ref: MutableRefObject<number>, setter: Dispatch<SetStateAction<number>>) => {
      const start = performance.now(); const from = ref.current; const diff = target - from; const duration = 900
      const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)
      const step = (time: number) => {
        const progress = Math.min((time - start) / duration, 1)
        const value = Math.round(from + diff * easeOut(progress))
        setter(value)
        if (progress < 1) requestAnimationFrame(step)
        else ref.current = target
      }
      requestAnimationFrame(step)
    }
    animateCount(netGain, netGainRef, setDisplayNetGain)
  }, [netGain])

  useEffect(() => {
    const fetchRrRanking = async () => {
      if (!userId) { setRrRankingLoading(false); return }
      setRrRankingLoading(true)
      try {
        const snap = await getDocs(collection(db, "rrLeaderboard"))
        const promises = snap.docs.map(async (docSnap) => {
          const data = docSnap.data()
          const userSnap = await getDoc(doc(db, "users", data.userId))
          const user = userSnap.data()
          return { id: data.userId, name: user?.name, iconUrl: user?.iconUrl, roi: data.roi ?? 0, rrRating: data.rrRating ?? 0, rank: 0 }
        })
        const list = await Promise.all(promises)
        list.sort((a, b) => b.rrRating - a.rrRating)
        const hasValidRating = list.some(p => p.rrRating > 0)
        if (!hasValidRating) { setRrRanking([]); setRrFullRanking([]); setRrMyEntry(null); setRrRankingLoading(false); return }
        let currentRank = 0; let lastRating: number | null = null
        const ranked = list.map((p, i) => {
          if (lastRating === null || p.rrRating !== lastRating) { currentRank = i + 1; lastRating = p.rrRating }
          return { ...p, rank: currentRank }
        })
        setRrRanking(ranked); setRrFullRanking(ranked); setRrMyEntry(ranked.find(p => p.id === userId) ?? null)
      } catch (error) { console.error("Failed to fetch RR ranking:", error); setRrRanking([]); setRrMyEntry(null) }
      finally { setRrRankingLoading(false) }
    }
    fetchRrRanking()
  }, [userId])

  useEffect(() => { setIsHistoryFlipped(false) }, [currentStoreId])

  useEffect(() => {
    const loadCalTournaments = async () => {
      if (favoriteStores.length === 0) { setCalFavTournaments([]); return }
      try {
        const all: any[] = []
        await Promise.all(favoriteStores.map(async sid => {
          const storeSnap = await getDoc(doc(db, "stores", sid))
          const storeData = storeSnap.data()
          const storeName = storeData?.name ?? "店舗"
          const storeIconUrl = storeData?.iconUrl ?? null
          const snap = await getDocs(collection(db, "stores", sid, "tournaments"))

          snap.forEach(d => {
            const data = d.data()

            all.push({
              id: d.id,
              storeId: sid,
              storeName,
              storeIconUrl,
              ...data,
              createdAt: toDateSafe(data.createdAt),
              startedAt: toDateSafe(data.startedAt)
            })
          })


        }))
        setCalFavTournaments(all)
      } catch {}
    }
    loadCalTournaments()
  }, [favoriteStores])

  // ── カレンダー詳細モーダルが開いたときリアルタイム購読
  useEffect(() => {
    calLiveUnsubsRef.current.forEach(u => u())
    calLiveUnsubsRef.current = []
    setCalLiveData({})
    setCalAutoPresets({})
    if (!calDetailTournament) return

    const unsubs: (() => void)[] = []
    calDetailTournament.entries.forEach((entry: any) => {
      const key = `${entry.storeId}_${entry.id}`
      const unsub = onSnapshot(
        doc(db, "stores", entry.storeId, "tournaments", entry.id),
        (snap) => { if (snap.exists()) setCalLiveData(prev => ({ ...prev, [key]: snap.data() })) },
        () => {}
      )
      unsubs.push(unsub)
      if (entry.blindPresetId) {
        getDoc(doc(db, "stores", entry.storeId, "blindPresets", entry.blindPresetId))
          .then(snap => { if (snap.exists()) setCalAutoPresets(prev => ({ ...prev, [key]: snap.data() })) })
          .catch(() => {})
      }
    })
    calLiveUnsubsRef.current = unsubs
    return () => { unsubs.forEach(u => u()) }
  }, [calDetailTournament])

  useEffect(() => {
    if (!userId) return
    const unsub = onSnapshot(
      query(collection(db, "transactions"), where("playerId", "==", userId)),
      snap => {
        const list: any[] = []
        snap.forEach(d => list.push({ id: d.id, ...d.data() }))
        list.sort((a, b) => (a.createdAt?.seconds ?? 0) - (b.createdAt?.seconds ?? 0))
        setAllNetGainTx(list)
      },
      () => {}
    )
    return () => unsub()
  }, [userId])

  useEffect(() => {
  const prev = prevCurrentStoreIdRef.current

  // null → 値あり（入店した瞬間）
  if (prev === null && currentStoreId !== null) {
    setSelectedStore(null)
  }

  prevCurrentStoreIdRef.current = currentStoreId
}, [currentStoreId])

  // ── ロジック関数（完全保持）──────────────────────────────────────
  const currentStore = currentStoreId ? stores[currentStoreId] : null
  const unitLabel = useMemo(() => {
    if (!currentStore?.chipUnitLabel || currentStore.chipUnitLabel === "単位なし") return ""
    return currentStore.chipUnitLabel
  }, [currentStore])
  const blindBb = typeof currentStore?.ringBlindBb === "number" ? currentStore.ringBlindBb : null
  const useBb = typeof blindBb === "number" && blindBb > 0
  const formatBbValue = (value: number) => { if (!blindBb) return "0"; const raw = value / blindBb; const rounded = Number.isInteger(raw) ? raw : Math.round(raw * 10) / 10; return rounded.toLocaleString() }
  const chipUnitBefore = currentStore?.chipUnitBefore !== false
  const fmtChip = (v: number) => { if (!unitLabel) return v.toLocaleString(); return chipUnitBefore ? `${unitLabel}${v.toLocaleString()}` : `${v.toLocaleString()}${unitLabel}` }
  const formatChipValue = (value: number) => { if (showBB && useBb) return `${formatBbValue(value)}BB`; return fmtChip(value) }
  const formatSignedChipValue = (value: number) => { const sign = value > 0 ? "+" : value < 0 ? "-" : "±"; const absValue = Math.abs(value); if (showBB && useBb) return `${sign}${formatBbValue(absValue)}BB`; return `${sign}${fmtChip(absValue)}` }

  const sortedTransactionItems = useMemo(() => {
    const getSeconds = (t: any) => { if (!t) return 0; if (typeof t.seconds === "number") return t.seconds; if (typeof t.toDate === "function") return t.toDate().getTime() / 1000; return 0 }
    return [...transactionItems].sort((a, b) => getSeconds(b.createdAt) - getSeconds(a.createdAt))
  }, [transactionItems])

  const sortedTournamentItems = useMemo(() => {
    const getSeconds = (t: any) => { if (!t) return 0; if (typeof t.seconds === "number") return t.seconds; if (typeof t.toDate === "function") return t.toDate().getTime() / 1000; return 0 }
    return [...tournamentHistoryItems].sort((a, b) => getSeconds(b.startedAt) - getSeconds(a.startedAt))
  }, [tournamentHistoryItems])

  const tournamentItems = useMemo(() => sortedTournamentItems, [sortedTournamentItems])

  // Chart: oldest→newest (left→right). One point per tournament = pnl (prize - buyin).
  const tnChartData = useMemo(() => {
    const items = [...sortedTournamentItems].reverse() // oldest on left
    return items.map(item => {
      const ec = item.entryCount ?? 0, rc = item.reentryCount ?? 0, ac = item.addonCount ?? 0
      const ef = item.entryFee ?? 0, rf = item.reentryFee ?? 0, af = item.addonFee ?? 0
      const prize = item.prize ?? 0, rank = item.rank ?? "-"
      const buyin = ec * ef + rc * rf + ac * af
      const bf = ef > 0 ? ef : rf > 0 ? rf : af
      const cost = bf > 0 ? buyin / bf : 0
      const reward = bf > 0 ? prize / bf : 0
      const pnl = prize - buyin
      return { item, buyin, prize, rank, cost, reward, pnl, ef, rf, af, ec, rc, ac }
    })
  }, [sortedTournamentItems])

  useEffect(() => {
    if (historyScrollRef.current && tnChartData.length > 0) {
      historyScrollRef.current.scrollLeft = historyScrollRef.current.scrollWidth
    }
  }, [tnChartData.length])

  const tournamentStats = useMemo(() => {
    let totalCost = 0, totalReward = 0, plays = 0, itm = 0
    tournamentItems.forEach(item => {
      const entryCount = item.entryCount ?? 0, reentryCount = item.reentryCount ?? 0, addonCount = item.addonCount ?? 0
      const entryFee = item.entryFee ?? 0, reentryFee = item.reentryFee ?? 0, addonFee = item.addonFee ?? 0
      const prize = item.prize ?? 0, rank = item.rank ?? "-"
      const buyin = (entryCount * entryFee) + (reentryCount * reentryFee) + (addonCount * addonFee)
      let baseFee = entryFee > 0 ? entryFee : reentryFee > 0 ? reentryFee : addonFee
      const cost = baseFee > 0 ? buyin / baseFee : 0
      const reward = baseFee > 0 ? prize / baseFee : 0
      totalCost += cost; totalReward += reward
      plays += entryCount + reentryCount
      if (rank !== "-" && prize > 0) itm += 1
    })
    const roi: string | number = totalCost > 0 ? ((totalReward / totalCost) * 100).toFixed(2) : "集計中"
    const itmRate = plays > 0 ? ((itm / plays) * 100).toFixed(2) : "0.00"
    return { totalCost, totalReward, roi, plays, itmRate }
  }, [tournamentItems])

  const getHistoryLabel = (type: string, comment?: string) => {
    const map: Record<string, string> = { manual_adjustment: "手動調整（チップ）", manual_adjustment_net_gain: "手動調整（純増）", deposit_approved_purchase: "預入（購入）", deposit_approved_pure_increase: "預入（純増）", withdraw_approved: "引き出し", withdraw_request: "引き出し申請", store_buyin: "バイイン (リングゲーム)", store_cashout: "キャッシュアウト (リングゲーム)", store_chip_purchase: "チップ購入", store_tournament_entry: "エントリー (トーナメント)", store_tournament_reentry: "リエントリー (トーナメント)", store_tournament_addon: "アドオン(トーナメント)", tournament_payout: "プライズ(トーナメント)", other: comment ?? "その他", other_net_gain: comment ?? "その他（純増）" }
    return map[type] ?? "不明"
  }
  const getHistoryAmount = (item: any) => { if (item.type === "withdraw") return formatSignedChipValue(-item.amount); if (item.type === "manual_adjustment") { const signedValue = item.direction === "subtract" ? -item.amount : item.amount; return formatSignedChipValue(signedValue) }; return formatSignedChipValue(item.amount) }
  
  function toDateSafe(t: any): Date | null {
  if (!t) return null

  // Firestore Timestamp
  if (typeof t.toDate === "function") return t.toDate()

  // {seconds, nanoseconds}
  if (typeof t.seconds === "number") return new Date(t.seconds * 1000)

  // すでにDate
  if (t instanceof Date) return t

  return null
}
  
const formatDateTime = (t?: any) => {
  if (!t) return ""
  const pad = (v: number) => v.toString().padStart(2, "0")
  // 文字列の場合: ISO日付文字列なら整形、それ以外(HH:MM等)はそのまま返す
  if (typeof t === "string") {
    const d = new Date(t)
    if (!isNaN(d.getTime())) return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
    return t
  }
  // ミリ秒数値
  if (typeof t === "number") {
    const d = new Date(t)
    return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  }
  // Firestore Timestamp / Date / {seconds, nanoseconds}
  const date = toDateSafe(t)
  if (!date) return ""
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

  const joinStore = async (storeId: string) => {
    if (!userId) return
    if (checkinStatus === "pending") { setIsPendingModalOpen(true); return }
    const storeSnap = await getDoc(doc(db, "stores", storeId))
    const storeData = storeSnap.data()
    const isApprovalRequired = storeData?.isApprovalRequired ?? true
    const userRef = doc(db, "users", userId)
    if (checkinStatus === "approved" && currentStoreId === storeId) return
    if (isApprovalRequired) {
      await updateDoc(userRef, { checkinStatus: "pending", pendingStoreId: storeId, currentStoreId: null, joinedStores: arrayUnion(storeId) })
      setIsPendingModalOpen(true); return
    }
    await updateDoc(userRef, { checkinStatus: "approved", currentStoreId: storeId, pendingStoreId: null, joinedStores: arrayUnion(storeId) })
    const balRef = doc(db, "users", userId, "storeBalances", storeId)
    const balSnap = await getDoc(balRef)
    const now = new Date(); const nowFirestoreTimestamp = serverTimestamp()
    let currentBalance = 0, currentNetGain = 0, currentVisitCount = 0, shouldIncrementVisitCount = true
    if (balSnap.exists()) {
      const bd = balSnap.data(); currentBalance = bd.balance ?? 0; currentNetGain = bd.netGain ?? 0; currentVisitCount = bd.visitCount ?? 0
      const lastVisitCountedAt = bd.lastVisitCountedAt?.toDate?.() ?? null
      if (lastVisitCountedAt) { const currentBase = getVisitCountResetBase(now); const lastBase = getVisitCountResetBase(lastVisitCountedAt); if (currentBase === lastBase) shouldIncrementVisitCount = false }
    }
    await setDoc(balRef, { balance: currentBalance, netGain: currentNetGain, storeId, lastVisitedAt: nowFirestoreTimestamp, ...(shouldIncrementVisitCount ? { visitCount: currentVisitCount + 1, lastVisitCountedAt: nowFirestoreTimestamp } : {}) }, { merge: true })
    if (!balSnap.exists()) await setDoc(balRef, { balance: 0, netGain: 0, lastVisitedAt: serverTimestamp(), storeId })
    setCurrentStoreId(storeId)
  }

  const loadAllStores = async () => {
    if (allStores.length) return allStores
    const snap = await getDocs(collection(db, "stores"))
    const list: StoreInfo[] = []
    snap.forEach(docSnap => { const data = docSnap.data(); list.push({ id: docSnap.id, name: data.name, iconUrl: data.iconUrl, address: data.address, chipUnitLabel: data.chipUnitLabel, chipUnitBefore: data.chipUnitBefore !== false, description: data.description, ringBlindSb: typeof data.ringBlindSb === "number" ? data.ringBlindSb : undefined, ringBlindBb: typeof data.ringBlindBb === "number" ? data.ringBlindBb : undefined, chipExpiryMonths: typeof data.chipExpiryMonths === "number" ? data.chipExpiryMonths : undefined }) })
    setAllStores(list); return list
  }
  const handleSearch = async () => {
    const q = searchQuery.trim(); if (!q) return
    const list = await loadAllStores(); const normalized = q.toLowerCase()
    const byCode = list.find(s => s.id.toLowerCase() === normalized); const byName = list.find(s => s.name?.toLowerCase() === normalized)
    const found = byCode || byName; if (found) { setSelectedStore(found); setIsJoinModalOpen(false) }
  }
  const handleLeaveStore = async () => { if (!userId) return; await updateDoc(doc(db, "users", userId), { currentStoreId: deleteField(), checkinStatus: "none", pendingStoreId: null }); setCurrentStoreId(null) }
  const openJoinModal = () => { setSearchQuery(""); void loadAllStores(); setIsJoinModalOpen(true) }
  const toggleFavoriteStore = async (storeId: string) => {
    if (!userId) return
    const isFavorite = favoriteStores.includes(storeId)
    await updateDoc(doc(db, "users", userId), { favoriteStores: isFavorite ? arrayRemove(storeId) : arrayUnion(storeId) })
    setFavoriteStores(prev => isFavorite ? prev.filter(id => id !== storeId) : prev.includes(storeId) ? prev : [...prev, storeId])
    setFavoriteMessage(isFavorite ? "お気に入りを解除しました" : "お気に入りに登録しました")
    setFavoritePulse(storeId); setTimeout(() => setFavoriteMessage(""), 2000); setTimeout(() => setFavoritePulse(""), 700)
  }
  const openPlayersPreview = async (storeId: string) => {
    try {
      const q = query(collection(db, "users"), where("currentStoreId", "==", storeId))
      const snap = await getDocs(q); const list: StorePlayer[] = []
      snap.forEach(docSnap => { const data = docSnap.data(); if (typeof data.currentStoreId === "string" && data.showInStore !== false) list.push({ id: docSnap.id, name: data.name, iconUrl: data.iconUrl }) })
      setPlayersPreview(list)
    } catch (error) { console.error("playersPreview error:", error); setPlayersPreview([]) }
    finally { setPlayersPreviewLoading(false) }
  }
  const suggestions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase(); if (!q || !allStores.length) return []
    return allStores.filter(s => s.name?.toLowerCase().includes(q) || s.id.toLowerCase().includes(q)).slice(0, 5)
  }, [allStores, searchQuery])
  const orderedJoinedStores = useMemo(() => {
    const favoriteSet = new Set(favoriteStores)
    return [...joinedStores.filter(id => favoriteSet.has(id)), ...joinedStores.filter(id => !favoriteSet.has(id))]
  }, [favoriteStores, joinedStores])

  // ── メダルクラスヘルパー
const medalClass = (rank: number) => {
    if (rank === 1) return "medal-gold"
    if (rank === 2) return "medal-silver"
    if (rank === 3) return "medal-bronze"
    return "bg-white border border-gray-200 shadow-sm"
  }

// ── チップグラフ用データ計算（全トランザクション純増値）
  const chipGraphData = useMemo(() => {
    const nowSec = Date.now() / 1000

    const withDelta = allNetGainTx
  .filter(tx => tx.storeId === currentStoreId)
  .map(tx => ({ tx, delta: txNetGainDelta(tx), sec: tx.createdAt?.seconds ?? 0 }))
  .filter(x => x.delta !== null)


    const filtered = (() => {
      if (chipGraphTab === "7") return withDelta.slice(-7)
      if (chipGraphTab === "1m") return withDelta.filter(x => x.sec >= nowSec - 30 * 86400)
      return withDelta
    })()
    let running = 0
    const points: number[] = [0]
    filtered.forEach(({ delta }) => { running += delta!; points.push(running) })
    return points
  }, [allNetGainTx, currentStoreId, chipGraphTab])



  // ── トーナメント専用グラフデータ
  const tournamentGraphData = useMemo(() => {
    const tournamentTypes = new Set(['store_tournament_entry', 'store_tournament_reentry', 'store_tournament_addon', 'tournament_payout'])
    const nowSec = Date.now() / 1000
    const withDelta = allNetGainTx
      .filter(tx => tx.storeId === currentStoreId && tournamentTypes.has(tx.type))
      .map(tx => ({ delta: txNetGainDelta(tx), sec: tx.createdAt?.seconds ?? 0 }))
      .filter(x => x.delta !== null)
    const filtered = (() => {
      if (chipGraphTab === "7") return withDelta.slice(-7)
      if (chipGraphTab === "1m") return withDelta.filter(x => x.sec >= nowSec - 30 * 86400)
      return withDelta
    })()
    let running = 0
    const points: number[] = [0]
    filtered.forEach(({ delta }) => { running += delta!; points.push(running) })
    return points
  }, [allNetGainTx, currentStoreId, chipGraphTab])

  // ── RR Rating 表示値（45未満は44.0〜45.0で固定マスク）
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const displayRrRating = useMemo(() => {
    const actual = rrMyEntry?.rrRating ?? 0
    if (actual < 45) {
      if (maskedRrForRating.current !== actual || maskedRrDisplay.current === null) {
        maskedRrDisplay.current = 44.0 + Math.random()
        maskedRrForRating.current = actual
      }
      return maskedRrDisplay.current as number
    }
    return actual
  }, [rrMyEntry?.rrRating])

  // ── Stats delta detection: localStorage snapshot → count-up animation + delta badges
  useEffect(() => {
    if (!userId || tournamentStats.plays === 0) return
    const key = `rrpoker.statSnapshot.${userId}`
    const roiNum = typeof tournamentStats.roi === 'string' && tournamentStats.roi !== '集計中'
      ? parseFloat(tournamentStats.roi) : typeof tournamentStats.roi === 'number' ? tournamentStats.roi : null
    const current = {
      rrRating: displayRrRating,
      totalCost: tournamentStats.totalCost,
      totalReward: tournamentStats.totalReward,
      itmRate: parseFloat(tournamentStats.itmRate),
      roi: roiNum,
      plays: tournamentStats.plays,
    }
    const save = () => localStorage.setItem(key, JSON.stringify(current))
    const stored = localStorage.getItem(key)
    if (!stored) { save(); return }
    let prev: typeof current
    try { prev = JSON.parse(stored) } catch { save(); return }
    // Only animate when plays increases (new tournament completed)
    if ((prev.plays ?? current.plays) >= current.plays) { save(); return }
    const delta = {
      rrRating: current.rrRating - (prev.rrRating ?? current.rrRating),
      totalCost: current.totalCost - (prev.totalCost ?? 0),
      totalReward: current.totalReward - (prev.totalReward ?? 0),
      itmRate: current.itmRate - (prev.itmRate ?? current.itmRate),
      roi: roiNum !== null && prev.roi !== null ? roiNum - prev.roi : null,
    }
    const hasChange = Math.abs(delta.rrRating) > 0.001 || delta.totalCost !== 0 || Math.abs(delta.totalReward) > 0.001
    if (hasChange) {
      setStatsDelta(delta)
      setShowStatsDelta(true)
      // Count-up animation: animate RR Rating from prev to current
      const fromRating = prev.rrRating ?? current.rrRating
      const toRating = current.rrRating
      const duration = 1600
      const startTime = performance.now()
      const tick = (now: number) => {
        const t = Math.min((now - startTime) / duration, 1)
        const eased = 1 - Math.pow(1 - t, 3) // ease-out cubic
        setAnimRrRating(fromRating + (toRating - fromRating) * eased)
        if (t < 1) requestAnimationFrame(tick)
        else setAnimRrRating(null)
      }
      requestAnimationFrame(tick)
      if (deltaDismissTimer.current) clearTimeout(deltaDismissTimer.current)
      deltaDismissTimer.current = setTimeout(() => setShowStatsDelta(false), 6000)
    }
    save()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, tournamentStats.plays])

  // ── 5日間スケジュール用エントリー生成
  const scheduleDays = useMemo(() => {
    const DOW_JA = ["日", "月", "火", "水", "木", "金", "土"]
    return Array.from({ length: 5 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i)
      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
      return { ds, day: d.getDate(), dow: DOW_JA[d.getDay()], isToday: i === 0, isSun: d.getDay() === 0, isSat: d.getDay() === 6 }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const scheduleEntries = useMemo(() => {
    const map: Record<string, any[]> = {}
    const daySet = new Set(scheduleDays.map(d => d.ds))
    calFavTournaments.forEach(t => {
      if (!t.date || typeof t.date !== "string") return
      if (t.repeatWeekly) {
        const base = new Date(t.date + "T00:00:00")
        const dow = base.getDay()
        scheduleDays.forEach(({ ds }) => {
          const d = new Date(ds + "T00:00:00")
          if (d.getDay() === dow) {
            if (!map[ds]) map[ds] = []
            map[ds].push({ ...t, date: ds })
          }
        })
      } else if (daySet.has(t.date)) {
        if (!map[t.date]) map[t.date] = []
        map[t.date].push(t)
      }
    })
    return map
  }, [calFavTournaments, scheduleDays])

  // ════════════════════════════════════════════════════
  // JSX
  // ════════════════════════════════════════════════════
  if (!authReady) return (
    <main style={{ position: "fixed", inset: 0, background: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      {!splashDone && (
        <>
          <style>{`
            @keyframes splashLogoIn {
              0%   { opacity: 0; transform: scale(0.72); }
              60%  { opacity: 1; transform: scale(1.05); }
              100% { opacity: 1; transform: scale(1); }
            }
            @keyframes splashNameIn {
              0%   { opacity: 0; transform: translateY(6px); }
              100% { opacity: 1; transform: translateY(0); }
            }
            .splash-logo-anim { animation: splashLogoIn 0.48s cubic-bezier(0.34,1.56,0.64,1) forwards; }
            .splash-name-anim { animation: splashNameIn 0.36s ease-out 0.28s forwards; opacity: 0; }
          `}</style>
          <img
            src="/logo.png"
            alt="RRPoker"
            className="splash-logo-anim"
            style={{ width: 96, height: 96, objectFit: "contain" }}
          />
          <p
            className="splash-name-anim"
            style={{ marginTop: 16, fontSize: 18, fontWeight: 700, color: "#1D1D1F", letterSpacing: "0.06em" }}
          >
            RRPoker
          </p>
        </>
      )}
    </main>
  )

  return (
    <main className="min-h-screen pb-32" style={{ background: "#FFFBF5" }}>
      <style>{`
        /* ── アニメーション ── */
        @keyframes slideUp {
          from { opacity:0; transform:translateY(12px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity:0; } to { opacity:1; }
        }
        @keyframes tickerPulse {
          0%   { transform:translateY(6px); opacity:0.6; }
          100% { transform:translateY(0);   opacity:1; }
        }
        @keyframes stampPop {
          0%   { transform:scale(0.3) rotate(-20deg); opacity:0; }
          60%  { transform:scale(1.3) rotate(10deg);  opacity:1; }
          100% { transform:scale(1)   rotate(0deg); }
        }
        @keyframes bounceIn {
          0%   { transform:scale(0.6); opacity:0; }
          70%  { transform:scale(1.08); opacity:1; }
          100% { transform:scale(1); }
        }
        @keyframes deltaFloat {
          0%   { opacity:0; transform:translateY(4px) scale(0.75); }
          12%  { opacity:1; transform:translateY(-4px) scale(1.05); }
          70%  { opacity:1; transform:translateY(-10px) scale(1); }
          100% { opacity:0; transform:translateY(-20px) scale(0.9); }
        }
        @keyframes deltaGlow {
          0%,100% { box-shadow: none; }
          30%  { box-shadow: 0 0 0 3px rgba(242,169,0,0.35); }
        }
        @keyframes countFlip {
          0%   { transform:translateY(6px); opacity:0; }
          100% { transform:translateY(0);   opacity:1; }
        }
        .delta-badge {
          animation: deltaFloat 5s cubic-bezier(0.22,1,0.36,1) forwards;
          position: absolute;
          top: -8px;
          right: -6px;
          pointer-events: none;
          z-index: 10;
        }
        .delta-glow { animation: deltaGlow 2s ease-in-out 2; }
        .count-flip { animation: countFlip 0.28s cubic-bezier(0.22,1,0.36,1) both; }
        @keyframes pulseGlow {
          0%,100% { box-shadow:0 0 0 0 rgba(242,169,0,0.3); }
          50%      { box-shadow:0 0 0 8px rgba(242,169,0,0); }
        }
        @keyframes shimmer {
          0%   { background-position:-200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes spin { to { transform:rotate(360deg); } }
        @keyframes sheetUp {
          from { transform:translateY(100%); opacity:0; }
          to   { transform:translateY(0);    opacity:1; }
        }
        .animate-sheetUp { animation:sheetUp .38s cubic-bezier(.22,1,.36,1) both; }
        @keyframes chipIn {
          from { transform:scale(0.2) translateY(4px); opacity:0; }
          to   { transform:scale(1)   translateY(0);   opacity:1; }
        }

        .animate-slideUp  { animation:slideUp  0.35s ease-out; }
        .animate-bounceIn { animation:bounceIn 0.4s  ease-out; }
        .animate-chipIn   { animation:chipIn   0.25s ease-out; }
        .animate-stampPop { animation:stampPop 0.35s ease-out; }
        .ticker-animate   { display:inline-block; animation:tickerPulse 0.6s ease; }

        /* ── カード共通 ── */
        .profile-card {
          background: linear-gradient(145deg,#fff 0%,#fefefe 100%);
          box-shadow: 0 2px 8px rgba(242,169,0,0.06), 0 8px 24px rgba(0,0,0,0.04);
        }
        .section-card {
          background: linear-gradient(145deg,#fff 0%,#fefefe 100%);
          box-shadow: 0 2px 8px rgba(242,169,0,0.06), 0 8px 24px rgba(0,0,0,0.04);
          border-radius: 28px;
          padding: 20px;
        }

        /* ── ストアバッジ ── */
        .store-badge {
          background: linear-gradient(145deg,rgba(242,169,0,0.08) 0%,rgba(242,169,0,0.03) 100%);
          border: 1.5px solid rgba(242,169,0,0.2);
        }

        /* ── RR ── */
        .rr-board {
          position:relative;
          background: linear-gradient(145deg,#FFFBF5 0%,#FFF8ED 100%);
          border: 1px solid rgba(242,169,0,0.15);
          border-radius: 28px;
          padding: 24px;
          box-shadow: 0 2px 8px rgba(242,169,0,0.08), 0 12px 32px rgba(242,169,0,0.12), inset 0 1px 0 rgba(255,255,255,0.9);
        }
        .rr-rate-card {
          background: linear-gradient(135deg,#F2A900 0%,#D4910A 100%);
          border-radius: 20px; padding:24px;
          box-shadow: 0 4px 16px rgba(242,169,0,0.3), 0 1px 3px rgba(0,0,0,0.1);
          position:relative; overflow:hidden;
        }
        .rr-rate-card::before {
          content:""; position:absolute; top:0; left:0; right:0; height:1px;
          background:linear-gradient(90deg,transparent 0%,rgba(255,255,255,0.6) 50%,transparent 100%);
        }
        .rr-rate-card::after {
          content:""; position:absolute; top:-50%; right:-20%; width:200px; height:200px;
          background:radial-gradient(circle,rgba(255,255,255,0.15) 0%,transparent 70%); border-radius:50%;
        }
        .rr-ranking-item {
          background:rgba(255,255,255,0.85); backdrop-filter:blur(20px); -webkit-backdrop-filter:blur(20px);
          border:1px solid rgba(242,169,0,0.1); border-radius:16px; padding:14px 16px;
          box-shadow:0 1px 3px rgba(242,169,0,0.08),inset 0 1px 0 rgba(255,255,255,1);
          transition:all 0.2s cubic-bezier(0.4,0,0.2,1);
        }
        .rr-ranking-item:hover { transform:translateY(-2px); box-shadow:0 4px 12px rgba(242,169,0,0.15),inset 0 1px 0 rgba(255,255,255,1); border-color:rgba(242,169,0,0.2); }
        .rr-my-entry {
          background:linear-gradient(135deg,#FFFBF5 0%,#FFF4E0 100%);
          border:1.5px solid rgba(242,169,0,0.3); border-radius:16px; padding:14px 16px;
          box-shadow:0 2px 8px rgba(242,169,0,0.12),inset 0 1px 0 rgba(255,255,255,0.9);
        }

        /* ── メダル ── */
        .medal-gold   { background:linear-gradient(135deg,#FFD700 0%,#FFA500 100%); box-shadow:0 2px 8px rgba(255,215,0,0.5),inset 0 1px 0 rgba(255,255,255,0.6); }
        .medal-silver { background:linear-gradient(135deg,#E8E8E8 0%,#C0C0C0 100%); box-shadow:0 2px 8px rgba(192,192,192,0.4),inset 0 1px 0 rgba(255,255,255,0.7); }
        .medal-bronze { background:linear-gradient(135deg,#F4A460 0%,#CD7F32 100%); box-shadow:0 2px 8px rgba(205,127,50,0.4),inset 0 1px 0 rgba(255,255,255,0.4); }

        /* ── バンクカード ── */
        @keyframes cardEntrance {
          from { opacity:0; transform:translateY(22px) scale(0.93); filter:blur(3px); }
          to   { opacity:1; transform:translateY(0)    scale(1);    filter:blur(0); }
        }
        @keyframes breatheGold {
          0%,100% { opacity:0.55; transform:translate(-50%,-52%) scale(1); }
          50%      { opacity:1;   transform:translate(-50%,-52%) scale(1.18); }
        }
        @keyframes goldDotPulse {
          0%,100% { box-shadow:0 0 0 0 rgba(242,169,0,0); }
          50%      { box-shadow:0 0 0 4px rgba(242,169,0,0.25); }
        }
        .bank-card {
          perspective:1600px;
          animation:cardEntrance 0.65s cubic-bezier(0.22,1,0.36,1) both;
        }
        .bank-card-inner {
          position:relative; height:256px;
          transform-style:preserve-3d; -webkit-transform-style:preserve-3d;
          transition:transform 0.92s cubic-bezier(0.22,1,0.36,1);
          will-change:transform;
        }
        .bank-card.is-flipped .bank-card-inner { transform:rotateY(180deg); }
        .bank-card.is-flipped .bank-card-front { pointer-events:none; }
        .bank-card:not(.is-flipped) .bank-card-back { pointer-events:none; }
        .bank-card-face {
          position:absolute; inset:0;
          backface-visibility:hidden; -webkit-backface-visibility:hidden;
          border-radius:28px; overflow:hidden;
          transform:rotateY(0deg) translateZ(1px);
        }
        .bank-card-front {
          background:#09090B;
          box-shadow:
            0 0 0 1px rgba(255,255,255,0.07),
            0 36px 72px rgba(0,0,0,0.72),
            0 8px 24px rgba(242,169,0,0.04);
        }
        .bank-card-front::before {
          content:""; position:absolute; inset:0; pointer-events:none;
          background-image:
            radial-gradient(rgba(255,255,255,0.045) 1px, transparent 1px),
            radial-gradient(rgba(255,255,255,0.02)  1px, transparent 1px);
          background-size:22px 22px, 11px 11px;
          background-position:0 0, 5.5px 5.5px;
        }
        .bank-card-front::after {
          content:""; position:absolute; top:0; left:0; right:0; height:2px;
          background:linear-gradient(90deg,transparent 0%,#E09000 15%,#F2A900 40%,#FFD060 50%,#F2A900 60%,#E09000 85%,transparent 100%);
        }
        .bank-card-glow {
          position:absolute; top:50%; left:50%;
          width:64%; padding-top:40%;
          background:radial-gradient(ellipse at center,rgba(242,169,0,0.2) 0%,rgba(242,169,0,0.06) 45%,transparent 70%);
          transform:translate(-50%,-52%);
          animation:breatheGold 3.6s ease-in-out infinite;
          pointer-events:none;
        }
        .bank-card-back {
          background:#0C0D12;
          box-shadow:
            0 0 0 1px rgba(255,255,255,0.06),
            0 36px 72px rgba(0,0,0,0.68);
          transform:rotateY(180deg) translateZ(1px);
        }
        .bank-card-back::before {
          content:""; position:absolute; inset:0; pointer-events:none;
          background-image:radial-gradient(rgba(255,255,255,0.035) 1px,transparent 1px);
          background-size:22px 22px;
        }
        .bank-card-back::after {
          content:""; position:absolute; top:0; left:0; right:0; height:2px;
          background:linear-gradient(90deg,transparent 0%,rgba(80,140,255,0.7) 20%,rgba(140,190,255,0.9) 50%,rgba(80,140,255,0.7) 80%,transparent 100%);
          opacity:0.75;
        }
        .bank-gold-dot { animation:goldDotPulse 3s ease-in-out infinite; }
        .bank-card-history { max-height:172px; overflow-y:auto; -webkit-overflow-scrolling:touch; }
        .bank-card-history::-webkit-scrollbar { display:none; }

        /* ── ティッカー ── */
        .ticker { font-variant-numeric:tabular-nums; letter-spacing:0.02em; }

        /* ── モーダル ── */
        .glass-card { background:rgba(255,255,255,0.7); backdrop-filter:blur(20px); -webkit-backdrop-filter:blur(20px); }
        .modal-overlay { background:rgba(0,0,0,0.3); backdrop-filter:blur(4px); -webkit-backdrop-filter:blur(4px); }

        /* ── 追加ユーティリティ ── */
        .divider-gold { height:1px; background:linear-gradient(90deg,transparent,rgba(242,169,0,0.2),transparent); }
        .stat-chip {
          background:#fff; border:1px solid rgba(242,169,0,0.18);
          border-radius:16px; padding:12px 14px;
          box-shadow:0 1px 4px rgba(242,169,0,0.06);
        }
        .gold-btn {
          background:linear-gradient(135deg,#F2A900 0%,#D4910A 100%);
          box-shadow:0 4px 14px rgba(242,169,0,0.28);
          transition:transform 0.13s ease, box-shadow 0.13s ease;
        }
        .gold-btn:active { transform:scale(0.977); }
        .outline-gold-btn {
          background:#fff; border:1.5px solid rgba(242,169,0,0.5);
          color:#D4910A; transition:all 0.13s ease;
        }
        .outline-gold-btn:hover { background:rgba(242,169,0,0.05); }
        .outline-gold-btn:active { transform:scale(0.977); }
        .section-label {
          font-size:11px; font-weight:700; letter-spacing:0.6px; text-transform:uppercase; color:rgba(0,0,0,0.3);
        }
        .pulse-dot { animation:pulseGlow 2s ease-in-out infinite; }
        .shimmer-num {
          background:linear-gradient(90deg,#D4910A 0%,#F2A900 40%,#ffe577 55%,#F2A900 70%,#D4910A 100%);
          background-size:200% auto; -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text;
          animation:shimmer 2.4s linear infinite;
        }
        .checkin-banner {
          background:linear-gradient(135deg,#1f1b16 0%,#3b2f22 100%);
          border-radius:20px; padding:16px 18px;
          box-shadow:0 4px 18px rgba(0,0,0,0.15);
        }
        .net-positive { color:#10b981; }
        .net-negative { color:#ef4444; }
        .net-neutral  { color:#6b7280; }

        /* ── チップグラフ ── */
        @keyframes drawLine {
          from { stroke-dashoffset: 1; }
          to   { stroke-dashoffset: 0; }
        }
        .chart-line {
          stroke-dasharray: 1;
          stroke-dashoffset: 1;
          animation: drawLine 0.9s ease-out forwards;
        }

        /* ── カレンダー ── */
        .cal-day-dot { width:5px; height:5px; border-radius:50%; background:#F2A900; margin:0 auto; }

        /* ── スタンプ ── */
        @keyframes stampPress {
          0%   { transform:scale(2.4) rotate(-18deg); opacity:0; filter:blur(3px); }
          30%  { transform:scale(0.76) rotate(-3deg);  opacity:1; filter:blur(0); }
          52%  { transform:scale(1.12) rotate(2.5deg); }
          72%  { transform:scale(0.94) rotate(-0.5deg); }
          100% { transform:scale(1)   rotate(0deg); }
        }
        @keyframes inkSpread {
          0%   { transform:scale(0.4); opacity:0.65; }
          100% { transform:scale(3.8); opacity:0; }
        }
        @keyframes stampCardIn {
          0%   { transform:scale(0.88) translateY(16px); opacity:0; }
          100% { transform:scale(1)    translateY(0);    opacity:1; }
        }
        .stamp-new-press { animation:stampPress 0.58s cubic-bezier(0.36,0.07,0.19,0.97) both; }
        .ink-spread      { animation:inkSpread  0.75s ease-out 0.08s both; }
        .stamp-card-in   { animation:stampCardIn 0.38s cubic-bezier(0.34,1.56,0.64,1) both; }
      `}</style>

      <PullToRefresh onRefresh={() => window.location.reload()} />

      {/* ヘッダー（変更なし） */}
      <HomeHeader homePath="/home" myPagePath="/home/mypage" showNotifications menuItems={getCommonMenuItems(router, 'user')} />

      <div className="mx-auto max-w-sm px-4 space-y-5">

        {/* ════ 入店中 ════ */}
        {currentStoreId && currentStore ? (
          <>
            {/* プロフィール + 店舗バナー */}
            <div className="mt-6 section-card animate-slideUp" style={{ padding: 0, overflow: 'hidden' }}>
              {/* ゴールドアクセントライン */}
              <div style={{ height: 4, background: 'linear-gradient(90deg,#F2A900,#D4910A,#F2A900)', backgroundSize: '200% auto', animation: 'shimmer 3s linear infinite' }} />
              <div style={{ padding: '20px' }}>
                <div className="flex items-center justify-between">
                  {/* 左：ユーザー */}
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border-2 border-[#F2A900] bg-white shadow-md pulse-dot">
                        {profile.iconUrl ? <img src={profile.iconUrl} alt={profile.name ?? "icon"} className="h-full w-full object-cover" /> : <FiUser className="text-[20px] text-gray-400" />}
                      </div>
                      <div className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-green-500 border-2 border-white" />
                    </div>
                    <div>
                      <p className="text-[15px] font-semibold text-gray-900">{profile.name || ""}</p>
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-50 border border-green-200 px-2 py-0.5 mt-0.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                        <span className="text-[10px] font-semibold text-green-600">入店中</span>
                      </span>
                    </div>
                  </div>
                  {/* QR + 矢印 */}
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setIsQRModalOpen(true)}
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-[#F2A900]/30 bg-[#F2A900]/10 transition-all active:scale-90"
                      title="QRコードを表示"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="#D4910A" strokeWidth="2"/>
                        <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="#D4910A" strokeWidth="2"/>
                        <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="#D4910A" strokeWidth="2"/>
                        <rect x="14" y="14" width="3" height="3" rx="0.5" fill="#D4910A"/>
                        <rect x="18" y="14" width="3" height="3" rx="0.5" fill="#D4910A"/>
                        <rect x="14" y="18" width="3" height="3" rx="0.5" fill="#D4910A"/>
                        <rect x="18" y="18" width="3" height="3" rx="0.5" fill="#D4910A"/>
                      </svg>
                    </button>
                    <div className="h-8 w-8 rounded-full bg-[#F2A900]/10 flex items-center justify-center">
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2 8h12M8 2l6 6-6 6" stroke="#F2A900" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </div>
                    {/* 右：店舗 */}
                    <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border-2 border-gray-200 bg-white shadow-sm">
                      {currentStore.iconUrl ? <img src={currentStore.iconUrl} alt={currentStore.name} className="h-full w-full object-cover" /> : <span className="text-[10px] text-gray-400">店舗</span>}
                    </div>
                  </div>
                </div>
                {/* 店舗バッジ */}
                <div className="store-badge mt-4 rounded-2xl p-3 text-center">
                  <p className="text-[13px] font-semibold text-gray-700">{currentStore.name || ""}</p>
                  {typeof currentStore.ringBlindSb === "number" && typeof currentStore.ringBlindBb === "number" && (
                    <p className="text-[11px] text-gray-400 mt-0.5">レート: {currentStore.ringBlindSb} / {currentStore.ringBlindBb}</p>
                  )}
                </div>
              </div>
            </div>

            {/* 退店ボタン */}
            <button type="button" onClick={handleLeaveStore}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-red-200 bg-white py-3 text-[14px] font-medium text-red-500 transition-all hover:bg-red-50 active:scale-[0.98]"
            >
              <FiLogOut className="text-[15px]" />退店する
            </button>

            {/* バンクロールカード */}
            <div className={`bank-card ${isHistoryFlipped ? "is-flipped" : ""}`}>
              <div className="bank-card-inner">

                {/* ── Front ── */}
                <div className="bank-card-face bank-card-front">
                  <div className="bank-card-shine" />
                  <div style={{ display:'flex', flexDirection:'column', height:'100%', padding:'20px 22px', position:'relative', zIndex:1 }}>

                    {/* Top row */}
                    <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <div style={{ width:36, height:36, borderRadius:10, background:'linear-gradient(135deg,#F2A900 0%,#B87000 100%)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 3px 10px rgba(242,169,0,0.5),0 1px 0 rgba(255,255,255,0.18) inset', flexShrink:0 }}>
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,0.9)" strokeWidth="1.8"/>
                            <circle cx="12" cy="12" r="3.6" fill="rgba(255,255,255,0.9)"/>
                            <line x1="3" y1="12" x2="7.8" y2="12" stroke="rgba(255,255,255,0.65)" strokeWidth="1.8" strokeLinecap="round"/>
                            <line x1="16.2" y1="12" x2="21" y2="12" stroke="rgba(255,255,255,0.65)" strokeWidth="1.8" strokeLinecap="round"/>
                            <line x1="12" y1="3" x2="12" y2="7.8" stroke="rgba(255,255,255,0.65)" strokeWidth="1.8" strokeLinecap="round"/>
                            <line x1="12" y1="16.2" x2="12" y2="21" stroke="rgba(255,255,255,0.65)" strokeWidth="1.8" strokeLinecap="round"/>
                          </svg>
                        </div>
                        <div>
                          <p style={{ fontSize:9, fontWeight:700, color:'rgba(255,255,255,0.36)', letterSpacing:'0.22em', textTransform:'uppercase', marginBottom:3 }}>Bankroll</p>
                          <p style={{ fontSize:13, fontWeight:600, color:'rgba(255,255,255,0.78)', lineHeight:1 }}>{currentStore.name}</p>
                        </div>
                      </div>
                      <button type="button" onClick={() => setIsHistoryFlipped(true)}
                        style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 14px', borderRadius:22, background:'rgba(0,0,0,0.32)', border:'1px solid rgba(255,255,255,0.13)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', fontSize:11, fontWeight:600, color:'rgba(255,255,255,0.62)', cursor:'pointer', flexShrink:0 }}>
                        <FiClock style={{ fontSize:11 }} /><span>履歴</span>
                      </button>
                    </div>

                    {/* Balance hero */}
                    <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', cursor:'pointer', userSelect:'none' }} onClick={() => setShowBB(v => !v)}>
                      <p style={{ fontSize:10, color:'rgba(255,255,255,0.28)', letterSpacing:'0.2em', textTransform:'uppercase', marginBottom:9 }}>
                        {showBB && blindBb ? 'BB 表示' : 'Chip Balance'}
                      </p>
                      <p style={{ fontSize:48, fontWeight:800, color:'#fff', lineHeight:1, letterSpacing:'-2px', fontVariantNumeric:'tabular-nums', textShadow:'0 2px 28px rgba(242,169,0,0.22)' }}>
                        <span key={balance} className="ticker-animate">{formatChipValue(displayBalance)}</span>
                      </p>
                      {displayNetGain !== 0 && (
                        <div style={{ display:'inline-flex', alignItems:'center', gap:5, marginTop:11, padding:'5px 15px', borderRadius:22, background:displayNetGain > 0 ? 'rgba(52,199,89,0.16)' : 'rgba(255,59,48,0.16)', border:`1px solid ${displayNetGain > 0 ? 'rgba(52,199,89,0.32)' : 'rgba(255,59,48,0.32)'}` }}>
                          <span style={{ fontSize:14, fontWeight:700, color:displayNetGain > 0 ? '#34C759' : '#FF6060', fontVariantNumeric:'tabular-nums' }}>
                            <span key={netGain} className="ticker-animate">{formatSignedChipValue(displayNetGain)}</span>
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Bottom row */}
                    <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between' }}>
                      <div>
                        {typeof currentStore.ringBlindSb === "number" && typeof currentStore.ringBlindBb === "number" && (
                          <p style={{ fontSize:10, color:'rgba(255,255,255,0.26)', letterSpacing:'0.06em' }}>Rate {currentStore.ringBlindSb} / {currentStore.ringBlindBb}</p>
                        )}
                        <p style={{ fontSize:9, color:'rgba(255,255,255,0.16)', marginTop:3, letterSpacing:'0.12em', textTransform:'uppercase' }}>Tap to switch BB</p>
                      </div>
                      <div style={{ display:'flex', gap:4, alignItems:'center' }}>
                        {[0,1,2].map(i => <div key={i} style={{ width:5, height:5, borderRadius:'50%', background:'rgba(255,255,255,0.13)' }} />)}
                        <div style={{ width:5, height:5, marginLeft:3, borderRadius:'50%', background:'rgba(242,169,0,0.65)' }} />
                      </div>
                    </div>

                  </div>
                </div>

                {/* ── Back ── */}
                <div className="bank-card-face bank-card-back">
                  <div style={{ display:'flex', flexDirection:'column', height:'100%', padding:'20px 22px', position:'relative', zIndex:1 }}>

                    {/* Header */}
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:13 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                        <FiClock style={{ color:'rgba(255,255,255,0.42)', fontSize:13 }} />
                        <span style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.52)', letterSpacing:'0.22em', textTransform:'uppercase' }}>History</span>
                      </div>
                      <button type="button" onClick={() => setIsHistoryFlipped(false)}
                        style={{ display:'flex', alignItems:'center', gap:4, padding:'6px 13px', borderRadius:18, background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.1)', fontSize:11, fontWeight:600, color:'rgba(255,255,255,0.58)', cursor:'pointer' }}>
                        <FiArrowLeft style={{ fontSize:10 }} />戻る
                      </button>
                    </div>

                    {/* Transaction list */}
                    <div className="bank-card-history" style={{ flex:1 }}>
                      {sortedTransactionItems.length === 0 ? (
                        <div style={{ textAlign:'center', paddingTop:32 }}>
                          <p style={{ fontSize:12, color:'rgba(255,255,255,0.26)' }}>履歴がありません</p>
                        </div>
                      ) : sortedTransactionItems.map(item => {
                        const amtStr = getHistoryAmount(item)
                        const isPlus = amtStr.startsWith('+')
                        const isMinus = amtStr.startsWith('-')
                        return (
                          <div key={item.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 12px', borderRadius:13, background:'rgba(255,255,255,0.042)', border:'1px solid rgba(255,255,255,0.07)', marginBottom:7 }}>
                            <div style={{ minWidth:0, flex:1 }}>
                              <p style={{ fontSize:11, fontWeight:600, color:'rgba(255,255,255,0.72)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{getHistoryLabel(item.type, item.comment)}</p>
                              <p style={{ fontSize:9, color:'rgba(255,255,255,0.28)', marginTop:2 }}>{formatDateTime(item.createdAt)}</p>
                            </div>
                            <p style={{ fontSize:13, fontWeight:700, color:isPlus ? '#34C759' : isMinus ? '#FF6060' : 'rgba(255,255,255,0.62)', fontVariantNumeric:'tabular-nums', flexShrink:0, marginLeft:10 }}>{amtStr}</p>
                          </div>
                        )
                      })}
                    </div>

                  </div>
                </div>

              </div>
            </div>

            {/* チップ増減グラフ（スワイプで全体⇔トナメ切替） */}
            {tournamentHistoryItems.length >= 2 && (() => {
              const pts = graphMode === 'all' ? chipGraphData : tournamentGraphData
              if (pts.length < 2) return null
              const W = 300, H = 100, PL = 36, PR = 8, PT = 8, PB = 16
              const minV = Math.min(...pts), maxV = Math.max(...pts)
              const range = maxV - minV || 1
              const xs = pts.map((_, i) => PL + (i / (pts.length - 1)) * (W - PL - PR))
              const ys = pts.map(v => PT + ((maxV - v) / range) * (H - PT - PB))
              const pathD = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(" ")
              const zeroY = PT + ((maxV - 0) / range) * (H - PT - PB)
              const lastVal = pts[pts.length - 1]
              const lineColor = lastVal >= 0 ? "#10b981" : "#ef4444"
              return (
                <div className="section-card animate-slideUp"
                  onTouchStart={e => { graphTouchStartX.current = e.touches[0].clientX }}
                  onTouchEnd={e => {
                    if (graphTouchStartX.current === null) return
                    const dx = e.changedTouches[0].clientX - graphTouchStartX.current
                    if (Math.abs(dx) > 48) setGraphMode(prev => prev === 'all' ? 'tournament' : 'all')
                    graphTouchStartX.current = null
                  }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <FiBarChart2 className="text-[15px] text-[#F2A900]" />
                      <p className="text-[13px] font-semibold text-gray-900">
                        {graphMode === 'all' ? '総収支グラフ' : 'トナメ収支グラフ'}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      {(["7", "1m", "all"] as const).map(tab => (
                        <button key={tab} type="button" onClick={() => setChipGraphTab(tab)}
                          className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all ${chipGraphTab === tab ? "bg-[#F2A900] text-gray-900" : "bg-gray-100 text-gray-500"}`}>
                          {tab === "7" ? "直近7回" : tab === "1m" ? "1ヶ月" : "全期間"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 100 }}>
                    {zeroY >= PT && zeroY <= H - PB && (
                      <line x1={PL} y1={zeroY.toFixed(1)} x2={W - PR} y2={zeroY.toFixed(1)} stroke="rgba(0,0,0,0.08)" strokeWidth="1" strokeDasharray="3,3" />
                    )}
                    <text x={PL - 4} y={PT + 4} textAnchor="end" fontSize="9" fill="#9ca3af">{maxV.toLocaleString()}</text>
                    <text x={PL - 4} y={H - PB} textAnchor="end" fontSize="9" fill="#9ca3af">{minV.toLocaleString()}</text>
                    <path d={pathD} fill="none" stroke={lineColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                      vectorEffect="non-scaling-stroke" pathLength="1" className="chart-line" key={`${chipGraphTab}-${graphMode}`} />
                    {xs.map((x, i) => (
                      <circle key={i} cx={x.toFixed(1)} cy={ys[i].toFixed(1)} r="2.5" fill={lineColor} />
                    ))}
                  </svg>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-[10px] text-gray-400">{pts.length - 1}回</p>
                    <p className={`text-[12px] font-bold ${lastVal > 0 ? "net-positive" : lastVal < 0 ? "net-negative" : "net-neutral"}`}>
                      {lastVal > 0 ? "+" : ""}{lastVal.toLocaleString()}
                    </p>
                  </div>
                  {/* ページインジケーター */}
                  <div className="flex justify-center gap-1.5 mt-2">
                    <div onClick={() => setGraphMode('all')}
                      className={`rounded-full transition-all cursor-pointer ${graphMode === 'all' ? 'w-4 h-1.5 bg-[#F2A900]' : 'w-1.5 h-1.5 bg-gray-300'}`} />
                    <div onClick={() => setGraphMode('tournament')}
                      className={`rounded-full transition-all cursor-pointer ${graphMode === 'tournament' ? 'w-4 h-1.5 bg-[#F2A900]' : 'w-1.5 h-1.5 bg-gray-300'}`} />
                  </div>
                  <p className="text-center text-[9px] text-gray-300 mt-1">← スワイプで切替 →</p>
                </div>
              )
            })()}

            {/* クイックスタット（入店中） */}
            <div className="grid grid-cols-2 gap-2">
              <div className="stat-chip">
                <p className="section-label mb-1">残高</p>
                <p className="text-[20px] font-bold text-gray-900 ticker">{formatChipValue(displayBalance)}</p>
              </div>
              <div className="stat-chip">
                <p className="section-label mb-1">純増</p>
                <p className={`text-[20px] font-bold ticker ${displayNetGain > 0 ? "net-positive" : displayNetGain < 0 ? "net-negative" : "net-neutral"}`}>
                  {formatSignedChipValue(displayNetGain)}
                </p>
              </div>
            </div>

            {/* ランキング */}
            <div className="section-card animate-slideUp">
              {/* ヘッダー */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <FiTrendingUp className="text-[17px] text-[#F2A900]" />
                  <p className="text-[12px] font-semibold text-gray-900">店内純増ランキング</p>
                  <span className="rounded-full bg-[#F2A900]/10 px-2 py-0.5 text-[6px] font-bold text-[#D4910A]">{currentStore.name}</span>
                </div>
                {(rankingTab === 'all' ? ranking : monthlyRanking).length > 3 && (
                  <button type="button" onClick={() => setIsDetailedRankingModalOpen(true)} className="text-[6px] font-semibold text-[#F2A900]">もっと見る</button>
                )}
              </div>

              {/* タブ */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 14, background: '#F2F2F7', borderRadius: 12, padding: 4 }}>
                {([
                  { key: 'all', label: '全期間' },
                  { key: 'monthly', label: (() => { const n = new Date(); return `${n.getMonth() + 1}月` })() },
                ] as const).map(tab => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setRankingTab(tab.key)}
                    style={{
                      flex: 1, height: 32, borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', transition: 'all .15s',
                      background: rankingTab === tab.key ? '#fff' : 'transparent',
                      color: rankingTab === tab.key ? '#D4910A' : 'rgba(60,60,67,0.45)',
                      boxShadow: rankingTab === tab.key ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* 自分の順位カード */}
              {(() => {
                const myRank = rankingTab === 'all' ? userRank : monthlyUserRank
                if (!myRank) return null
                return (
                  <div className="mb-3 rounded-2xl p-3 flex items-center justify-between" style={{ background: 'linear-gradient(135deg,#FFF8ED,#FFFBF5)', border: '1.5px solid rgba(242,169,0,0.25)' }}>
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F2A900]/15">
                        <FiUser className="text-[13px] text-[#D4910A]" />
                      </div>
                      <div>
                        <p className="text-[11px] text-gray-500">あなたの順位</p>
                        <p className="text-[14px] font-bold text-gray-900">{myRank.rank}位</p>
                      </div>
                    </div>
                    <p className={`text-[15px] font-bold ${myRank.netGain >= 0 ? "net-positive" : "net-negative"}`}>
                      {formatSignedChipValue(myRank.netGain)}
                    </p>
                  </div>
                )
              })()}

              {/* リスト */}
              <div className="space-y-2">
                {(() => {
                  const loading = rankingTab === 'all' ? rankingLoading : monthlyRankingLoading
                  const list = rankingTab === 'all' ? ranking : monthlyRanking
                  if (loading) return <p className="text-center text-[13px] text-gray-400 py-4">ロード中…</p>
                  if (list.length === 0) return <p className="text-center text-[13px] text-gray-400 py-4">データがありません</p>
                  return list.slice(0, 5).map((player, index) => (
                    <div key={player.id} className="flex items-center justify-between rounded-2xl bg-gray-50 px-3 py-2.5 hover:bg-gray-100 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-bold ${index === 0 ? "medal-gold text-white" : index === 1 ? "medal-silver text-gray-700" : index === 2 ? "medal-bronze text-white" : "bg-white border border-gray-200 text-gray-500"}`}>
                          {index + 1}
                        </div>
                        <span className="text-[13px] font-medium text-gray-700">{player.name || "プレイヤー"}</span>
                      </div>
                      <span className={`text-[13px] font-bold ${player.netGain >= 0 ? "net-positive" : "net-negative"}`}>{formatSignedChipValue(player.netGain)}</span>
                    </div>
                  ))
                })()}
              </div>
            </div>
          </>
        ) : (
          /* ════ 未入店 ════ */
          <>
            {/* プロフィールカード */}
            <div className="mt-6 section-card animate-slideUp text-center" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ height: 4, background: 'linear-gradient(90deg,#F2A900,#D4910A,#F2A900)', backgroundSize: '200% auto', animation: 'shimmer 3s linear infinite' }} />
              <div style={{ padding: '24px 20px' }}>
                <div className="relative mx-auto w-fit">
                  <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-[3px] border-[#F2A900] bg-white mx-auto shadow-lg">
                    {profile.iconUrl ? <img src={profile.iconUrl} alt={profile.name ?? "icon"} className="h-full w-full object-cover" /> : <FiUser className="text-[28px] text-gray-400" />}
                  </div>
                </div>
                <p className="mt-3 text-[20px] font-bold text-gray-900">{profile.name || ""}</p>
                <p className="mt-1 text-[12px] text-gray-400">現在、どこにも入店していません</p>
              </div>
            </div>

            {/* 店舗セレクター */}
            <div className="section-card">
              <div className="flex items-center justify-between mb-3">
                <p className="section-label">入店したことのある店舗</p>
                <div className="flex items-center gap-2">
                  {/* QRで入店 */}
                  <button type="button" onClick={() => setIsQRModalOpen(true)}
                    className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold transition-all active:scale-95"
                    style={{ background: '#1C1C1E', color: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                      <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="white" strokeWidth="2.2"/>
                      <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="white" strokeWidth="2.2"/>
                      <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="white" strokeWidth="2.2"/>
                      <rect x="14" y="14" width="3" height="3" rx="0.5" fill="white"/>
                      <rect x="18" y="14" width="3" height="3" rx="0.5" fill="white"/>
                      <rect x="14" y="18" width="3" height="3" rx="0.5" fill="white"/>
                      <rect x="18" y="18" width="3" height="3" rx="0.5" fill="white"/>
                    </svg>
                    QR
                  </button>
                  <button type="button" onClick={openJoinModal}
                    className="gold-btn flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold text-white"
                  >
                    <FiSearch size={12} />New
                  </button>
                </div>
              </div>
              {orderedJoinedStores.length > 0 ? (
                <div className="flex gap-3 overflow-x-auto pb-1">
                  {orderedJoinedStores.map(storeId => {
                    const store = stores[storeId]
                    const isFav = favoriteStores.includes(storeId)
                    return (
                      <button key={storeId} type="button" onClick={() => store && setSelectedStore(store)}
                        className={`flex-shrink-0 flex flex-col items-center gap-1.5 group`}
                      >
                        <div className={`flex h-14 w-14 items-center justify-center rounded-2xl border-2 bg-white shadow-sm transition-all active:scale-95 ${isFav ? "border-[#F2A900]" : "border-gray-200"}`}>
                          {store?.iconUrl ? <img src={store.iconUrl} alt={store.name} className="h-12 w-12 rounded-xl object-cover" /> : <span className="text-[12px] text-gray-400">店</span>}
                        </div>
                        <span className="text-[10px] text-gray-500 max-w-[56px] truncate">{store?.name ?? ""}</span>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <p className="text-[13px] text-gray-400 text-center py-4">入店したことのある店舗がありません</p>
              )}
            </div>

            {/* 5日間スケジュールタブ */}
            {favoriteStores.length > 0 && (
              <div className="section-card animate-slideUp" style={{ padding: 0, overflow: 'hidden' }}>
                {/* ── セクションヘッダー */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px 18px 14px' }}>
                  <FiCalendar color="#F2A900" size={15} />
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#1C1C1E' }}>スケジュール</p>
                </div>

                {/* ── 5日タブ */}
                <div style={{ display: 'flex', gap: 6, padding: '0 14px 14px' }}>
                  {scheduleDays.map(({ ds, day, dow, isToday, isSun, isSat }) => {
                    const entries = scheduleEntries[ds] ?? []
                    const selected = calScheduleTab === ds
                    const dowColor = selected ? 'rgba(255,255,255,0.8)' : isSun ? '#FF3B30' : isSat ? '#007AFF' : '#8E8E93'
                    const numColor = selected ? '#fff' : isSun ? '#FF3B30' : isSat ? '#007AFF' : '#1C1C1E'
                    return (
                      <button
                        key={ds}
                        type="button"
                        onClick={() => setCalScheduleTab(ds)}
                        style={{
                          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                          padding: '9px 0 8px', borderRadius: 14, border: 'none', cursor: 'pointer',
                          background: selected ? 'linear-gradient(135deg,#F2A900,#C97D00)' : '#F2F2F7',
                          boxShadow: selected ? '0 3px 10px rgba(242,169,0,0.35)' : 'none',
                          transition: 'all 0.18s cubic-bezier(0.22,1,0.36,1)',
                        }}
                      >
                        <span style={{ fontSize: 9, fontWeight: 700, color: dowColor, letterSpacing: '0.04em' }}>{dow}</span>
                        <span style={{ fontSize: 20, fontWeight: 800, color: numColor, lineHeight: 1.1 }}>{day}</span>
                        <div style={{ height: 5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {entries.length > 0 && (
                            <div style={{ width: 5, height: 5, borderRadius: '50%', background: selected ? 'rgba(255,255,255,0.6)' : '#F2A900' }} />
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>

                {/* ── 区切り */}
                <div style={{ height: '0.5px', background: 'rgba(60,60,67,0.1)', margin: '0 14px' }} />

                {/* ── トーナメントカードリスト */}
                <div style={{ padding: '12px 12px 16px', minHeight: 100 }}>
                  {(scheduleEntries[calScheduleTab] ?? []).length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '24px 0 12px' }}>
                      <p style={{ fontSize: 13, color: '#AEAEB2', fontWeight: 500 }}>この日のトーナメント情報はありません</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {(scheduleEntries[calScheduleTab] ?? []).map((entry: any, idx: number) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setCalDetailTournament({ date: calScheduleTab, entries: [entry] })}
                          style={{ width: '100%', textAlign: 'left', background: '#fff', borderRadius: 16, border: '0.5px solid rgba(60,60,67,0.1)', boxShadow: '0 1px 6px rgba(0,0,0,0.05)', padding: 0, overflow: 'hidden', cursor: 'pointer', display: 'block' }}
                        >
                          <div style={{ display: 'flex', alignItems: 'stretch', gap: 0 }}>
                            {/* ゴールドサイドバー */}
                            <div style={{ width: 4, background: 'linear-gradient(180deg,#F2A900,#C97D00)', flexShrink: 0, borderRadius: '0 0 0 0' }} />

                            {/* コンテンツ */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', flex: 1 }}>
                              {/* 店舗アイコン */}
                              <div style={{ width: 44, height: 44, borderRadius: '50%', overflow: 'hidden', background: '#F2F2F7', flexShrink: 0, border: '2px solid rgba(242,169,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {entry.storeIconUrl
                                  ? <img src={entry.storeIconUrl} alt={entry.storeName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                  : <span style={{ fontSize: 18 }}>🏠</span>
                                }
                              </div>

                              {/* テキスト */}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                                  <p style={{ fontSize: 14, fontWeight: 700, color: '#1C1C1E', letterSpacing: '-0.2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                                    {entry.name || 'トーナメント'}
                                  </p>
                                  {entry.repeatWeekly && (
                                    <span style={{ fontSize: 9, fontWeight: 800, color: '#D4910A', background: 'rgba(242,169,0,0.12)', borderRadius: 99, padding: '2px 7px', whiteSpace: 'nowrap', flexShrink: 0 }}>毎週</span>
                                  )}
                                </div>
                                <p style={{ fontSize: 11, color: '#8E8E93', fontWeight: 500 }}>{entry.storeName}</p>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 5 }}>
                                  {entry.startTime && (
                                    <span style={{ fontSize: 11, fontWeight: 600, color: '#3C3C43' }}>🕐 {formatDateTime(entry.startTime)}</span>
                                  )}
                                  {entry.entryFee != null && (
                                    <span style={{ fontSize: 12, fontWeight: 800, color: '#D4910A' }}>{fmtChip(Number(entry.entryFee))}</span>
                                  )}
                                </div>
                              </div>

                              {/* 矢印 */}
                              <FiChevronRight size={16} color="#C7C7CC" style={{ flexShrink: 0 }} />
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* RR Rating + Tournament Stats 統合セクション */}
            <div className={`section-card animate-slideUp${showStatsDelta ? ' delta-glow' : ''}`} style={{ padding: 0, overflow: 'hidden' }}>

              {/* ── ヒーローカード（グラデーション） ── */}
              <div style={{ background: 'linear-gradient(135deg,#F2A900 0%,#C97D00 100%)', padding: '22px 22px 18px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: -40, right: -30, width: 160, height: 160, borderRadius: '50%', background: 'radial-gradient(circle,rgba(255,255,255,0.18) 0%,transparent 70%)', pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', bottom: -20, left: -20, width: 100, height: 100, borderRadius: '50%', background: 'radial-gradient(circle,rgba(255,255,255,0.1) 0%,transparent 70%)', pointerEvents: 'none' }} />

                {/* 上段：ラベル + ? ボタン（fixed tooltip） */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, position: 'relative', zIndex: 1 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)' }}>トナメ偏差値</p>
                  <button
                    ref={rrRatingBtnRef}
                    type="button"
                    onClick={() => {
                      if (rrRatingInfoOpen) {
                        setRrRatingInfoOpen(false)
                        setRrRatingInfoPos(null)
                      } else {
                        const rect = rrRatingBtnRef.current?.getBoundingClientRect()
                        if (rect) setRrRatingInfoPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right })
                        setRrRatingInfoOpen(true)
                      }
                    }}
                    style={{ width: 26, height: 26, borderRadius: '50%', background: 'rgba(255,255,255,0.18)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <FiHelpCircle size={13} style={{ color: 'rgba(255,255,255,0.85)' }} />
                  </button>
                </div>

                {/* 大きい数値 + 順位 + RR delta badge */}
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, position: 'relative', zIndex: 1 }}>
                  {tournamentStats.plays === 0 ? (
                    <p style={{ fontSize: 40, fontWeight: 800, color: 'rgba(255,255,255,0.75)', lineHeight: 1, letterSpacing: '-0.5px' }}>集計中</p>
                  ) : (
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', gap: 10 }}>
                      <p style={{ fontSize: 52, fontWeight: 800, color: '#fff', lineHeight: 1, letterSpacing: '-1px' }}>
                        {(animRrRating ?? displayRrRating).toFixed(2)}
                      </p>
                      {showStatsDelta && statsDelta && Math.abs(statsDelta.rrRating) > 0.001 && (
                        <span className="delta-badge" style={{ fontSize: 13, fontWeight: 800, color: statsDelta.rrRating >= 0 ? '#86EFAC' : '#FCA5A5', background: 'rgba(0,0,0,0.3)', borderRadius: 99, padding: '3px 9px', whiteSpace: 'nowrap', display: 'inline-block' }}>
                          {statsDelta.rrRating >= 0 ? '+' : ''}{statsDelta.rrRating.toFixed(2)}
                        </span>
                      )}
                      {rrMyEntry && (
                        <div style={{ marginBottom: 6, background: 'rgba(0,0,0,0.18)', borderRadius: 99, padding: '4px 10px' }}>
                          <p style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>全国{rrMyEntry.rank}位</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* ROI サブ */}
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 6, position: 'relative', zIndex: 1 }}>
                  {rrMyEntry ? `ROI ${rrMyEntry.roi.toFixed(2)}%` : 'まだデータがありません'}
                </p>
              </div>

              {/* ── スタッツグリッド ── */}
              <div style={{ padding: '16px 18px' }}>
                {/* 上段：参加 / コスト合計 / リターン */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
                  {[
                    { label: '参加', value: `${tournamentStats.plays}回`, deltaVal: null },
                    { label: 'コスト合計', value: `${tournamentStats.totalCost}pt`, deltaVal: showStatsDelta && statsDelta ? statsDelta.totalCost : null, deltaFmt: (v: number) => Number.isInteger(v) ? `${v >= 0 ? '+' : ''}${v}` : `${v >= 0 ? '+' : ''}${v.toFixed(1)}` },
                    { label: 'リターン', value: `${tournamentStats.totalReward.toFixed(2)}pt`, deltaVal: showStatsDelta && statsDelta ? statsDelta.totalReward : null, deltaFmt: (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}` },
                  ].map((s, i) => (
                    <div key={i} style={{ background: '#F2F2F7', borderRadius: 12, padding: '9px 4px', textAlign: 'center', position: 'relative' }}>
                      <p style={{ fontSize: 9, fontWeight: 600, color: 'rgba(60,60,67,0.45)', marginBottom: 3, letterSpacing: '0.04em' }}>{s.label}</p>
                      <p style={{ fontSize: 13, fontWeight: 700, color: '#1C1C1E', lineHeight: 1 }}>{s.value}</p>
                      {s.deltaVal !== null && s.deltaFmt && Math.abs(s.deltaVal) > 0.001 && (
                        <span className="delta-badge" style={{ fontSize: 10, fontWeight: 800, color: '#fff', background: s.deltaVal >= 0 ? '#16A34A' : '#DC2626', borderRadius: 99, padding: '2px 6px', whiteSpace: 'nowrap', display: 'inline-block' }}>
                          {s.deltaFmt(s.deltaVal)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                {/* 下段：ITM率 / ROI（ゴールド強調 + delta badge） */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                  {[
                    { label: 'インマネ率', value: `${tournamentStats.itmRate}%`, deltaVal: showStatsDelta && statsDelta ? statsDelta.itmRate : null, deltaFmt: (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%` },
                    { label: 'ROI', value: tournamentStats.roi === '集計中' ? '—' : `${tournamentStats.roi}%`, deltaVal: showStatsDelta && statsDelta ? statsDelta.roi : null, deltaFmt: (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%` },
                  ].map((s, i) => (
                    <div key={i} style={{ background: 'linear-gradient(135deg,#FFF8ED,#FFFBF5)', border: '1px solid rgba(242,169,0,0.2)', borderRadius: 12, padding: '11px 4px', textAlign: 'center', position: 'relative' }}>
                      <p style={{ fontSize: 9, fontWeight: 600, color: 'rgba(212,145,10,0.6)', marginBottom: 3, letterSpacing: '0.04em' }}>{s.label}</p>
                      <p style={{ fontSize: 16, fontWeight: 800, color: '#D4910A', lineHeight: 1 }}>{s.value}</p>
                      {s.deltaVal !== null && s.deltaFmt && Math.abs(s.deltaVal) > 0.001 && (
                        <span className="delta-badge" style={{ fontSize: 10, fontWeight: 800, color: '#fff', background: s.deltaVal >= 0 ? '#16A34A' : '#DC2626', borderRadius: 99, padding: '2px 6px', whiteSpace: 'nowrap', display: 'inline-block' }}>
                          {s.deltaFmt(s.deltaVal)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                {/* ランキングボタン */}
                <button type="button"
                  onClick={() => {
                    if (rrFullRanking.length === 0) setRrFullRanking(rrRanking)
                    setIsRankingModalOpen(true)
                  }}
                  style={{ width: '100%', height: 44, borderRadius: 14, background: 'none', border: '1.5px solid rgba(242,169,0,0.5)', color: '#D4910A', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontFamily: 'inherit', transition: 'background .13s' }}
                >
                  <FiAward size={14} />
                  ランキングを見る
                </button>
              </div>
            </div>

            {/* トーナメント履歴 */}
            <div className="section-card animate-slideUp">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <FiAward className="text-[17px] text-[#F2A900]" />
                  <p className="text-[15px] font-semibold text-gray-900">Tournament History</p>
                </div>
                <button onClick={() => router.push("/home/tournaments")} className="text-[12px] font-semibold text-[#F2A900]">もっと見る</button>
              </div>

              {tnChartData.length === 0 ? (
                <div className="text-center py-10">
                  <div className="h-14 w-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                    <FiAward className="text-gray-300" size={24} />
                  </div>
                  <p className="text-[13px] text-gray-400">トーナメント履歴がありません</p>
                  <p className="text-[11px] text-gray-300 mt-1">参加すると記録されます</p>
                </div>
              ) : (() => {
                const STEP = 72, DOT_R = 9, H = 120, PT = 16, PB = 28, PL = 24, PR = 24
                const n = tnChartData.length
                const svgW = Math.max(PL + (n - 1) * STEP + PR, 240)
                const pnls = tnChartData.map(d => d.pnl)
                const rawMin = Math.min(...pnls), rawMax = Math.max(...pnls)
                const minP = Math.min(rawMin, 0), maxP = Math.max(rawMax, 0)
                const range = maxP - minP || 1
                const yOf = (v: number) => PT + H - ((v - minP) / range) * H
                const zeroY = yOf(0)
                const svgH = H + PT + PB
                return (
                  <div
                    ref={historyScrollRef}
                    style={{ overflowX: 'auto', overflowY: 'visible', WebkitOverflowScrolling: 'touch' as const, marginLeft: -16, marginRight: -16, paddingLeft: 16, paddingRight: 16 }}
                    onScroll={() => { setSelectedTnIdx(null); setTooltipPos(null) }}
                  >
                    <div style={{ position: 'relative', width: svgW + 'px', minWidth: '100%' }}>
                      <svg width={svgW} height={svgH} style={{ display: 'block', overflow: 'visible' }}>
                        {/* Zero line */}
                        <line x1={PL} y1={zeroY} x2={svgW - PR} y2={zeroY} stroke="rgba(0,0,0,0.1)" strokeWidth={1} strokeDasharray="4 3" />
                        {/* Connecting line */}
                        {n > 1 && (
                          <polyline
                            points={tnChartData.map((d, i) => `${PL + i * STEP},${yOf(d.pnl)}`).join(' ')}
                            fill="none" stroke="#F2A900" strokeWidth={2} strokeLinejoin="round"
                          />
                        )}
                        {/* Dots + labels */}
                        {tnChartData.map((d, i) => {
                          const cx = PL + i * STEP
                          const cy = yOf(d.pnl)
                          const isSelected = selectedTnIdx === i
                          const dotColor = d.pnl > 0 ? '#10b981' : d.pnl < 0 ? '#ef4444' : '#9ca3af'
                          const ts = d.item.startedAt
                          const dateStr = ts
                            ? (() => { const dt: Date = ts.toDate ? ts.toDate() : new Date(ts); return `${String(dt.getMonth() + 1).padStart(2, '0')}/${String(dt.getDate()).padStart(2, '0')}` })()
                            : ''
                          return (
                            <g key={i} style={{ cursor: 'pointer' }}
                              onClick={e => {
                                e.stopPropagation()
                                if (selectedTnIdx === i) { setSelectedTnIdx(null); setTooltipPos(null); return }
                                const circ = (e.currentTarget as SVGGElement).querySelector('circle')!
                                const rect = circ.getBoundingClientRect()
                                const tipW = 268
                                const above = rect.top >= 252
                                const left = Math.min(Math.max(rect.left + rect.width / 2 - tipW / 2, 8), window.innerWidth - tipW - 8)
                                const top = above ? rect.top - 240 : rect.bottom + 12
                                setSelectedTnIdx(i)
                                setTooltipPos({ left, top, above })
                              }}
                            >
                              <circle cx={cx} cy={cy} r={isSelected ? DOT_R + 2 : DOT_R} fill={dotColor} stroke="#fff" strokeWidth={2.5} />
                              {d.rank !== '-' && (
                                <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fill="#fff" fontSize={6} fontWeight={700}>{d.rank}</text>
                              )}
                              <text x={cx} y={svgH - 6} textAnchor="middle" fill="rgba(60,60,67,0.45)" fontSize={9.5} fontWeight={500}>{dateStr}</text>
                            </g>
                          )
                        })}
                      </svg>
                    </div>
                  </div>
                )
              })()}
            </div>
          </>
        )}
      </div>

      {/* ════ モーダル群（ロジック完全保持・デザインのみ刷新）════ */}

      {/* Chart tooltip backdrop */}
      {selectedTnIdx !== null && tooltipPos && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 499 }} onClick={() => { setSelectedTnIdx(null); setTooltipPos(null) }} />
      )}

      {/* Chart tooltip card */}
      {selectedTnIdx !== null && tooltipPos && tnChartData[selectedTnIdx] && (() => {
        const d = tnChartData[selectedTnIdx]
        const pnlColor = d.pnl > 0 ? '#10b981' : d.pnl < 0 ? '#ef4444' : '#6b7280'
        return (
          <div style={{ position: 'fixed', left: tooltipPos.left, top: tooltipPos.top, width: 268, zIndex: 500 }} onClick={e => e.stopPropagation()}>
            {!tooltipPos.above && (
              <div style={{ position: 'absolute', top: -6, left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderBottom: '6px solid #fff', filter: 'drop-shadow(0 -1px 1px rgba(0,0,0,0.06))' }} />
            )}
            <div style={{ background: '#fff', borderRadius: 18, boxShadow: '0 8px 40px rgba(0,0,0,0.18)', border: '1px solid rgba(0,0,0,0.06)', overflow: 'hidden' }}>
              <div style={{ padding: '12px 14px 10px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div style={{ flex: 1, marginRight: 8 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#1C1C1E', lineHeight: 1.3 }}>{d.item.tournamentName ?? ''}</p>
                    <p style={{ fontSize: 10, color: 'rgba(60,60,67,0.45)', marginTop: 2 }}>{d.item.storeName ?? ''}</p>
                  </div>
                  {d.rank !== '-' && (
                    <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,#F2A900,#D4910A)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: '#fff' }}>{d.rank}位</span>
                    </div>
                  )}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, background: 'rgba(0,0,0,0.05)' }}>
                {([
                  { label: 'コスト', value: `${d.cost.toFixed(1)} pt`, color: '#1C1C1E' },
                  { label: 'リワード', value: `${d.reward.toFixed(1)} pt`, color: '#1C1C1E' },
                  { label: '収支', value: d.pnl > 0 ? `+${d.pnl.toLocaleString()}` : d.pnl.toLocaleString(), color: pnlColor },
                ] as const).map((s, si) => (
                  <div key={si} style={{ background: '#fff', padding: '8px 6px', textAlign: 'center' }}>
                    <p style={{ fontSize: 9, color: 'rgba(60,60,67,0.45)', marginBottom: 2 }}>{s.label}</p>
                    <p style={{ fontSize: 13, fontWeight: 700, color: s.color }}>{s.value}</p>
                  </div>
                ))}
              </div>
              <div style={{ padding: '10px 14px 12px', fontSize: 11, color: 'rgba(60,60,67,0.55)' }}>
                {d.ec > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}><span>Entry</span><span style={{ fontWeight: 600, color: '#1C1C1E' }}>{d.ef} × {d.ec}</span></div>}
                {d.rc > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}><span>Re-entry</span><span style={{ fontWeight: 600, color: '#1C1C1E' }}>{d.rf} × {d.rc}</span></div>}
                {d.ac > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}><span>Add-on</span><span style={{ fontWeight: 600, color: '#1C1C1E' }}>{d.af} × {d.ac}</span></div>}
                <div style={{ borderTop: '1px solid rgba(0,0,0,0.07)', paddingTop: 4, marginTop: 2, display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#1C1C1E' }}>
                  <span>合計</span><span>{d.buyin.toLocaleString()}</span>
                </div>
                {d.rank !== '-' && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2, color: '#D4910A', fontWeight: 700 }}>
                    <span>Prize</span><span>{d.prize.toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>
            {tooltipPos.above && (
              <div style={{ position: 'absolute', bottom: -6, left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: '6px solid #fff', filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.06))' }} />
            )}
          </div>
        )
      })()}

      {isQRModalOpen && userId && (
        <PlayerQRModal
          uid={userId}
          name={profile.name ?? ""}
          iconUrl={profile.iconUrl}
          onClose={() => setIsQRModalOpen(false)}
        />
      )}

      {/* ── トナメ偏差値 説明ツールチップ（fixed：overflow:hidden を回避） ── */}
      {rrRatingInfoOpen && rrRatingInfoPos && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 1998 }} onClick={() => { setRrRatingInfoOpen(false); setRrRatingInfoPos(null) }} />
          <div
            style={{ position: 'fixed', top: rrRatingInfoPos.top, right: rrRatingInfoPos.right, width: 260, background: '#fff', borderRadius: 16, padding: '14px 16px', boxShadow: '0 8px 32px rgba(0,0,0,0.18)', border: '1px solid rgba(0,0,0,0.07)', fontSize: 12, color: '#3C3C43', lineHeight: 1.8, zIndex: 1999 }}
            onClick={e => e.stopPropagation()}
          >
            <p style={{ fontWeight: 700, color: '#1C1C1E', marginBottom: 6 }}>トナメ偏差値とは？</p>
            ROIとインマネ率からトーナメントの実力を偏差値で表したもの。参加数が少ないうちは変動しにくく、参加すればするほど実力に近い値になるよ。
          </div>
        </>
      )}

      {isPendingModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center modal-overlay">
          <div className="bg-white rounded-3xl p-6 w-[88%] max-w-sm text-center animate-slideUp shadow-2xl">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full" style={{ background: 'linear-gradient(135deg,#FFF8ED,#FFF0C0)' }}>
              <FiClock className="text-[24px] text-[#F2A900]" />
            </div>
            <p className="text-[18px] font-bold text-gray-900 mb-1">入店申請中</p>
            <p className="text-[13px] text-gray-500 mb-2">入店承認までしばらくお待ちください</p>
            <p className="text-[11px] text-gray-400 mb-5">この画面を閉じると入店申請は取り下げられます</p>
            <button onClick={async () => { if (!userId) return; await updateDoc(doc(db, "users", userId), { checkinStatus: "none", pendingStoreId: null }); setIsPendingModalOpen(false) }}
              className="w-full h-11 rounded-2xl bg-gray-100 text-gray-700 font-semibold text-[14px]"
            >戻る</button>
          </div>
        </div>
      )}

      {isCheckinCompleteModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center modal-overlay">
          <div className="bg-white rounded-3xl p-6 w-[88%] max-w-sm text-center animate-bounceIn shadow-2xl">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full" style={{ background: 'linear-gradient(135deg,#F2A900,#D4910A)' }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <p className="text-[18px] font-bold text-gray-900 mb-1">入店しました！</p>
            <p className="text-[13px] text-gray-500">入店が承認されました</p>
          </div>
        </div>
      )}

      {showStampModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center modal-overlay">
          <div className="w-[88%] max-w-sm stamp-card-in">
            {/* カード本体 */}
            <div className="rounded-3xl overflow-hidden shadow-2xl" style={{ background: "linear-gradient(160deg,#FEFAF4 0%,#F5EDD8 100%)", border: "1px solid rgba(139,90,43,0.18)" }}>
              {/* ヘッダーバー */}
              <div className="px-5 py-3 text-center" style={{ background: "linear-gradient(90deg,#7B1818,#B22222)" }}>
                <p className="text-white font-bold text-[12px] tracking-[0.2em] uppercase">Stamp Card</p>
                {currentStore?.name && <p className="text-white/65 text-[11px] mt-0.5">{currentStore.name}</p>}
              </div>

              <div className="px-5 pt-4 pb-5">
                {/* タイトル */}
                <div className="text-center mb-4">
                  <p className="text-[21px] font-bold text-gray-900">スタンプ獲得！</p>
                  <p className="text-[12px] text-gray-400 mt-0.5">{stampCount} / 12</p>
                </div>

                {/* スタンプグリッド */}
                <div className="grid grid-cols-4 gap-2.5 mb-5">
                  {Array.from({ length: 12 }).map((_, i) => {
                    const isStamped = i < stampCount
                    const isNew = i === stampCount - 1
                    return (
                      <div key={i} className="relative flex items-center justify-center">
                        {/* スタンプ枠 */}
                        <div
                          className={`relative h-[58px] w-[58px] rounded-full overflow-hidden flex items-center justify-center ${isNew ? "stamp-new-press" : ""}`}
                          style={isStamped
                            ? { border: "3px solid #7B1818", boxShadow: "0 3px 10px rgba(123,24,24,0.28), inset 0 1px 2px rgba(0,0,0,0.12)" }
                            : { border: "2px dashed #E8D5A8", background: "rgba(242,169,0,0.04)" }}
                        >
                          {isStamped ? (
                            <>
                              {currentStore?.iconUrl
                                ? <img src={currentStore.iconUrl} alt="" className="h-full w-full object-cover"
                                    style={{ filter: isNew ? "sepia(0.15)" : "sepia(0.55) saturate(0.7)" }} />
                                : <div className="h-full w-full flex items-center justify-center text-[12px] font-bold text-white"
                                    style={{ background: "linear-gradient(135deg,#B22222,#7B1818)" }}>
                                    {currentStore?.name?.slice(0, 2) ?? "★"}
                                  </div>
                              }
                              {/* インクオーバーレイ */}
                              <div className="absolute inset-0 rounded-full pointer-events-none"
                                style={{ background: isNew ? "rgba(123,24,24,0.08)" : "rgba(123,24,24,0.22)" }} />
                            </>
                          ) : (
                            <span className="text-[11px] font-bold" style={{ color: "#E8D5A8" }}>{i + 1}</span>
                          )}
                        </div>

                        {/* インク広がりエフェクト（新スタンプのみ） */}
                        {isNew && (
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="h-[58px] w-[58px] rounded-full ink-spread"
                              style={{ background: "radial-gradient(circle, rgba(123,24,24,0.45) 0%, transparent 70%)" }} />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                <button onClick={() => setShowStampModal(false)}
                  className="w-full h-12 rounded-2xl font-bold text-[15px] text-white"
                  style={{ background: "linear-gradient(135deg,#B22222,#7B1818)", boxShadow: "0 4px 14px rgba(123,24,24,0.3)" }}>
                  OK
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isJoinModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay px-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl animate-slideUp">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[17px] font-semibold text-gray-900">店舗を探す</h2>
              <button type="button" onClick={() => setIsJoinModalOpen(false)} className="text-gray-400 hover:text-gray-600"><FiX size={20} /></button>
            </div>
            <div className="flex gap-2">
              <input type="text" value={searchQuery}
                onChange={e => { const v = e.target.value; setSearchQuery(v); if (v.trim() && !allStores.length) void loadAllStores() }}
                placeholder="店舗コード or 店舗名"
                className="h-12 flex-1 rounded-2xl border border-gray-200 bg-gray-50 px-4 text-[14px] text-gray-900 outline-none placeholder:text-gray-400 focus:border-[#F2A900] focus:ring-2 focus:ring-[#F2A900]/20 transition-all"
              />
              <button type="button" onClick={handleSearch} className="flex h-12 w-12 items-center justify-center rounded-2xl gold-btn text-white active:scale-95">
                <FiSearch size={17} />
              </button>
            </div>
            {suggestions.length > 0 && (
              <div className="mt-3 rounded-2xl border border-gray-200 bg-gray-50 p-2">
                {suggestions.map(store => (
                  <button key={store.id} type="button" onClick={() => { setSelectedStore(store); setIsJoinModalOpen(false) }}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-3 hover:bg-white transition-colors"
                  >
                    <span className="text-[14px] font-semibold text-gray-900">{store.name}</span>
                    <span className="text-[11px] text-gray-400">{store.id}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {selectedStore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay px-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl animate-slideUp">
            <div className="relative flex min-h-[32px] items-center justify-center mb-5">
              <button type="button" onClick={() => setSelectedStore(null)} className="absolute left-0 text-gray-400 hover:text-gray-600"><FiX size={20} /></button>
              <button type="button" onClick={() => toggleFavoriteStore(selectedStore.id)}
                className={`absolute right-0 flex h-9 w-9 items-center justify-center rounded-full border transition-all ${favoriteStores.includes(selectedStore.id) ? "border-[#F2A900] bg-[#F2A900]/10 text-[#F2A900]" : "border-gray-200 text-gray-400 hover:border-[#F2A900] hover:text-[#F2A900]"}`}
              ><FiStar size={16} /></button>
              <h2 className="text-[17px] font-semibold text-gray-900">店舗詳細</h2>
            </div>
            {favoriteMessage && <p className="mb-3 text-center text-[12px] font-semibold text-[#F2A900] animate-slideUp">{favoriteMessage}</p>}
            <div className="flex items-center gap-4 mb-4">
              {selectedStore.iconUrl ? <img src={selectedStore.iconUrl} alt={selectedStore.name} className="h-16 w-16 rounded-2xl object-cover shadow-md" /> : <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 text-[13px] text-gray-400">店舗</div>}
              <div>
                <p className="text-[16px] font-semibold text-gray-900">{selectedStore.name}</p>
                <p className="text-[12px] text-gray-400 mt-0.5">{selectedStore.address}</p>
              </div>
            </div>
            <p className="text-[13px] text-gray-600 leading-relaxed mb-5">{selectedStore.description || "店舗の説明はまだありません"}</p>
            <div className="space-y-2.5">
              <button type="button" onClick={() => joinStore(selectedStore.id)} className="h-12 w-full rounded-2xl gold-btn text-[15px] font-semibold text-gray-900">入店する</button>
              <button type="button" onClick={() => { if (!selectedStore) return; setPlayersPreviewStore(selectedStore); setIsPlayersModalOpen(true); setPlayersPreviewLoading(true); void openPlayersPreview(selectedStore.id); setSelectedStore(null) }}
                className="h-12 w-full rounded-2xl border-2 border-gray-200 text-[14px] font-semibold text-gray-700 hover:bg-gray-50 transition-all"
              >現在入店中のプレイヤーを見る</button>
              <button type="button" className="h-12 w-full rounded-2xl border-2 border-gray-200 text-[14px] font-semibold text-gray-400">DMを送る</button>
            </div>
          </div>
        </div>
      )}

      {isPlayersModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay px-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl animate-slideUp">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[17px] font-semibold text-gray-900">入店中プレイヤー</h2>
              <button type="button" onClick={() => setIsPlayersModalOpen(false)} className="text-gray-400 hover:text-gray-600"><FiX size={20} /></button>
            </div>
            {playersPreviewStore && <p className="mb-4 text-[12px] text-gray-400">{playersPreviewStore.name}</p>}
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {playersPreviewLoading ? <p className="text-center text-[13px] text-gray-400 py-8">読み込み中…</p>
              : playersPreview.length === 0 ? <p className="text-center text-[13px] text-gray-400 py-8">入店中のプレイヤーがいません</p>
              : playersPreview.map(player => (
                <div key={player.id} className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-gray-50 p-3 hover:bg-gray-100 transition-colors">
                  {player.iconUrl ? <img src={player.iconUrl} alt={player.name} className="h-11 w-11 rounded-full object-cover" /> : <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gray-200"><FiUser className="text-[15px] text-gray-400" /></div>}
                  <p className="text-[14px] font-semibold text-gray-900">{player.name ?? player.id}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* RR Rating ランキングモーダル */}
      {isRankingModalOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-end justify-center"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
          onClick={() => setIsRankingModalOpen(false)}
        >
          <div
            className="animate-sheetUp"
            style={{ background: '#fff', borderRadius: '28px 28px 0 0', width: '100%', maxWidth: 480, maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Handle */}
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(60,60,67,0.18)', margin: '12px auto 0', flexShrink: 0 }} />

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px 10px', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: 'linear-gradient(135deg,#F2A900,#D4910A)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FiAward size={15} style={{ color: '#fff' }} />
                </div>
                <div>
                  <p style={{ fontSize: 16, fontWeight: 700, color: '#1C1C1E', lineHeight: 1.2 }}>RR Rating ランキング</p>
                  <p style={{ fontSize: 11, color: 'rgba(60,60,67,0.45)', marginTop: 1 }}>トナメ偏差値 TOP 100</p>
                </div>
              </div>
              <button type="button" onClick={() => setIsRankingModalOpen(false)}
                style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(120,120,128,0.12)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <FiX size={15} style={{ color: '#1C1C1E' }} />
              </button>
            </div>

            {/* My entry (pinned) */}
            {rrMyEntry && (
              <div style={{ margin: '0 16px 8px', background: 'linear-gradient(135deg,#FFFBF5,#FFF4E0)', border: '1.5px solid rgba(242,169,0,0.3)', borderRadius: 16, padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', border: '2px solid #F2A900', overflow: 'hidden', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {profile.iconUrl ? <img src={profile.iconUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <FiUser style={{ color: '#F2A900', fontSize: 14 }} />}
                  </div>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#1C1C1E' }}>{profile.name || 'あなた'}</p>
                    <p style={{ fontSize: 10, color: '#D4910A', fontWeight: 600, marginTop: 1 }}>{rrMyEntry.rank}位</p>
                  </div>
                </div>
                <p style={{ fontSize: 18, fontWeight: 800, color: '#1C1C1E', letterSpacing: '-0.5px' }}>{displayRrRating.toFixed(2)}</p>
              </div>
            )}

            {/* Divider */}
            <div style={{ height: 1, background: 'linear-gradient(90deg,transparent,rgba(242,169,0,0.2),transparent)', margin: '0 16px 4px', flexShrink: 0 }} />

            {/* List */}
            <div style={{ overflowY: 'auto', flex: 1, padding: '4px 16px 40px' }}>
              {rrRankingLoading ? (
                <p style={{ textAlign: 'center', fontSize: 13, color: 'rgba(60,60,67,0.45)', padding: '40px 0' }}>ロード中…</p>
              ) : (rrFullRanking.length > 0 ? rrFullRanking : rrRanking).slice(0, 100).map((player, idx) => {
                const isMe = player.id === userId
                return (
                  <div key={player.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 14, background: isMe ? 'rgba(242,169,0,0.07)' : idx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.015)', marginBottom: 2 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, ...(player.rank === 1 ? { background: 'linear-gradient(135deg,#FFD700,#FFA500)', boxShadow: '0 2px 8px rgba(255,215,0,0.5)' } : player.rank === 2 ? { background: 'linear-gradient(135deg,#E8E8E8,#C0C0C0)', boxShadow: '0 2px 6px rgba(192,192,192,0.4)' } : player.rank === 3 ? { background: 'linear-gradient(135deg,#F4A460,#CD7F32)', boxShadow: '0 2px 6px rgba(205,127,50,0.4)' } : { background: '#F2F2F7' }) }}>
                        {player.iconUrl
                          ? <img src={player.iconUrl} alt={player.name} style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />
                          : <FiUser style={{ fontSize: 13, color: player.rank <= 3 ? '#fff' : '#8E8E93' }} />
                        }
                      </div>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: isMe ? 700 : 600, color: '#1C1C1E' }}>{player.name || 'プレイヤー'}{isMe && <span style={{ fontSize: 10, color: '#D4910A', marginLeft: 5 }}>（あなた）</span>}</p>
                        <p style={{ fontSize: 10, color: 'rgba(60,60,67,0.4)', marginTop: 1 }}>{player.rank}位</p>
                      </div>
                    </div>
                    <p style={{ fontSize: 15, fontWeight: 700, color: '#1C1C1E', letterSpacing: '-0.3px' }}>{player.rrRating.toFixed(2)}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {isDetailedRankingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay px-4">
          <div className="mx-auto w-full max-w-sm rounded-3xl bg-white p-6 max-h-[80vh] overflow-y-auto shadow-2xl animate-slideUp">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[16px] font-semibold text-gray-900">純増ランキング（上位50）</h2>
              <button type="button" onClick={() => setIsDetailedRankingModalOpen(false)} className="text-gray-400 hover:text-gray-600"><FiX size={20} /></button>
            </div>
            <div className="space-y-2">
              {ranking.slice(0, 50).map((player, index) => (
                <div key={player.id} className="flex items-center justify-between rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 hover:bg-gray-100 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="w-8 text-[12px] text-gray-400 font-semibold text-right">{index + 1}位</span>
                    <span className="text-[13px] text-gray-800 font-medium">{player.name || "プレイヤー"}</span>
                  </div>
                  <span className={`text-[13px] font-bold ${player.netGain >= 0 ? "net-positive" : "net-negative"}`}>{formatSignedChipValue(player.netGain)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {withdrawNotice && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center modal-overlay">
          <div className="bg-white rounded-3xl p-6 w-[88%] max-w-sm text-center animate-slideUp shadow-2xl">
            {withdrawNotice.type === "pending" && (<><p className="text-[18px] font-bold text-gray-900 mb-1">引き出し申請中</p><p className="text-[13px] text-gray-500">この画面をスタッフに見せてください</p></>)}
            {withdrawNotice.type === "approved" && (<><p className="text-[18px] font-bold text-gray-900 mb-1">引き出し承認</p><p className="text-[13px] text-gray-500">{withdrawNotice.amount} が引き出されました</p></>)}
            {withdrawNotice.type === "rejected" && (<><p className="text-[18px] font-bold text-gray-900 mb-1">引き出し却下</p><p className="text-[13px] text-gray-500">引き出しが却下されました</p></>)}
            <button onClick={() => setWithdrawNotice(null)} className="mt-5 w-full h-11 rounded-2xl gold-btn text-gray-900 font-semibold text-[14px]">OK</button>
          </div>
        </div>
      )}

      {/* カレンダー詳細モーダル */}
      {calDetailTournament && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center px-0" style={{ background: "rgba(0,0,0,0.45)" }}
          onClick={() => { setCalDetailTournament(null); setCalDetailPreset(null) }}>
          <div className="w-full max-w-sm rounded-t-[32px] bg-white shadow-2xl animate-slideUp flex flex-col" style={{ maxHeight: "82vh" }}
            onClick={e => e.stopPropagation()}>
            {/* Handle bar */}
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-9 h-1 rounded-full bg-gray-200" />
            </div>
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-2 pb-4 shrink-0">
              <div>
                <p className="text-[18px] font-bold text-gray-900">{calDetailTournament.date}</p>
                <p className="text-[12px] text-gray-400 mt-0.5">{calDetailTournament.entries.length}件のトーナメント</p>
              </div>
              <button type="button" onClick={() => { setCalDetailTournament(null); setCalDetailPreset(null) }}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500"><FiX size={16} /></button>
            </div>

            {/* Entry list */}
            <div className="overflow-y-auto px-4 pb-8 space-y-3">
              {calDetailTournament.entries.map((entry: any, idx: number) => (
                <div key={idx} className="rounded-3xl bg-gray-50 border border-gray-100 overflow-hidden shadow-sm">
                  {/* Flyer image */}
                  {entry.flyerUrl && (
                    <div className="w-full aspect-[2/1] bg-gray-100 overflow-hidden">
                      <img src={entry.flyerUrl} alt="flyer" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="p-4">
                    {/* Title row */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-[15px] font-bold text-gray-900 leading-tight">{entry.name || "トーナメント"}</p>
                        <p className="text-[12px] text-gray-500 mt-0.5">{entry.storeName}</p>
                      </div>
                      {entry.repeatWeekly && (
                        <span className="shrink-0 rounded-full bg-[#F2A900]/15 px-2.5 py-1 text-[10px] font-bold text-[#D4910A]">毎週</span>
                      )}
                    </div>

                    {/* Info grid */}
                    <div className="grid grid-cols-2 gap-2 mb-3">

                      {entry.startTime && (
                        <div className="bg-white rounded-2xl px-3 py-2 border border-gray-100">
                          <p className="text-[9px] text-gray-400 font-medium uppercase tracking-wide">開始日時</p>
                          <p className="text-[13px] font-bold text-gray-900 mt-0.5">
                            {formatDateTime(entry.startTime)}
                          </p>
                        </div>
                      )}


                      {entry.rcTime && (
                        <div className="bg-white rounded-2xl px-3 py-2 border border-gray-100">
                          <p className="text-[9px] text-gray-400 font-medium uppercase tracking-wide">RC</p>
                          <p className="text-[13px] font-bold text-gray-900 mt-0.5">{entry.rcTime}</p>
                        </div>
                      )}
                      {entry.entryFee != null && (
                        <div className="bg-white rounded-2xl px-3 py-2 border border-gray-100">
                          <p className="text-[9px] text-gray-400 font-medium uppercase tracking-wide">エントリー金額</p>
                          <p className="text-[13px] font-bold text-[#D4910A] mt-0.5">{fmtChip(Number(entry.entryFee))}</p>
                        </div>
                      )}
                      {entry.entryStack != null && (
                        <div className="bg-white rounded-2xl px-3 py-2 border border-gray-100">
                          <p className="text-[9px] text-gray-400 font-medium uppercase tracking-wide">スタートスタック</p>
                          <p className="text-[13px] font-bold text-gray-900 mt-0.5">{Number(entry.entryStack).toLocaleString()}</p>
                        </div>
                      )}
                      {entry.reentryFee != null && (
                        <div className="bg-white rounded-2xl px-3 py-2 border border-gray-100">
                          <p className="text-[9px] text-gray-400 font-medium uppercase tracking-wide">リエントリー金額</p>
                          <p className="text-[13px] font-bold text-[#D4910A] mt-0.5">{fmtChip(Number(entry.reentryFee))}</p>
                        </div>
                      )}
                      {entry.reentryStack != null && (
                        <div className="bg-white rounded-2xl px-3 py-2 border border-gray-100">
                          <p className="text-[9px] text-gray-400 font-medium uppercase tracking-wide">リエントリー スタック</p>
                          <p className="text-[13px] font-bold text-gray-900 mt-0.5">{Number(entry.reentryStack).toLocaleString()}</p>
                        </div>
                      )}
                      {entry.addonFee != null && (
                        <div className="bg-white rounded-2xl px-3 py-2 border border-gray-100">
                          <p className="text-[9px] text-gray-400 font-medium uppercase tracking-wide">アドオン</p>
                          <p className="text-[13px] font-bold text-[#D4910A] mt-0.5">{fmtChip(Number(entry.addonFee))}</p>
                        </div>
                      )}
                      {entry.addonStack != null && (
                        <div className="bg-white rounded-2xl px-3 py-2 border border-gray-100">
                          <p className="text-[9px] text-gray-400 font-medium uppercase tracking-wide">アドオン スタック</p>
                          <p className="text-[13px] font-bold text-gray-900 mt-0.5">{Number(entry.addonStack).toLocaleString()}</p>
                        </div>
                      )}
                    </div>

                    {/* Live data (active/finished tournaments) */}
                    {(() => {
                      const key = `${entry.storeId}_${entry.id}`
                      const live = calLiveData[key]
                      if (!live || live.status === "scheduled") return null
                      const totalEntry = live.totalEntry ?? 0
                      const totalReentry = live.totalReentry ?? 0
                      const totalAddon = live.totalAddon ?? 0
                      const bustCount = live.bustCount ?? 0
                      const alivePlayers = Math.max(0, totalEntry + totalReentry - bustCount)
                      const entryStackVal = Number(live.entryStack ?? entry.entryStack ?? 0)
                      const reentryStackVal = Number(live.reentryStack ?? entry.reentryStack ?? 0)
                      const addonStackVal = Number(live.addonStack ?? entry.addonStack ?? 0)
                      const totalChips = totalEntry * entryStackVal + totalReentry * reentryStackVal + totalAddon * addonStackVal
                      const avgStack = alivePlayers > 0 ? Math.floor(totalChips / alivePlayers) : 0
                      const levelIndex = live.currentLevelIndex ?? 0
                      const presetLevels = calAutoPresets[key]?.levels
                      const levels: any[] = presetLevels ?? live.customBlindLevels ?? []
                      const currentLevel = levels[levelIndex]
                      const isActive = live.status === "active"
                      return (
                        <div className="mb-3 rounded-2xl bg-amber-50 border border-amber-100 p-3">
                          <div className="flex items-center gap-1.5 mb-2">
                            {isActive && <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />}
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">{isActive ? "ライブ" : "終了"}</p>
                          </div>
                          {currentLevel && (
                            <div className="mb-1.5">
                              <div className="bg-white rounded-xl px-2 py-1.5 border border-amber-100">
                                <p className="text-[8px] text-gray-400">現在のブラインド</p>
                                <p className="text-[12px] font-bold text-gray-900">
                                  {currentLevel.type === "break" ? "Break" : `${currentLevel.smallBlind} / ${currentLevel.bigBlind}${currentLevel.ante ? ` ante : ${currentLevel.ante}` : ""}`}
                                </p>
                              </div>
                            </div>
                          )}
                          <div className="grid grid-cols-2 gap-1.5">
                            <div className="bg-white rounded-xl px-3 py-2 text-center border border-amber-100">
                              <p className="text-[8px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Players</p>
                              <p className="text-[16px] font-bold text-gray-900 timer-num">{alivePlayers}/{totalEntry + totalReentry}</p>
                            </div>
                            <div className="bg-white rounded-xl px-3 py-2 text-center border border-amber-100">
                              <p className="text-[8px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Avg Stack</p>
                              <p className="text-[16px] font-bold text-gray-900 timer-num">{avgStack.toLocaleString()}</p>
                            </div>
                          </div>
                        </div>
                      )
                    })()}

                    {/* Blind structure */}
                    {(() => {
                      const key = `${entry.storeId}_${entry.id}`
                      const live = calLiveData[key]
                      const autoPreset = calAutoPresets[key]
                      const levels: any[] | undefined = autoPreset?.levels ?? live?.customBlindLevels ?? undefined
                      if (!entry.blindPresetId && !levels?.length) return null
                      return (
                        <>
                          <button type="button"
                            onClick={async () => {
                              if (calDetailPreset?.tournamentId === key) { setCalDetailPreset(null); return }
                              if (levels?.length) { setCalDetailPreset({ tournamentId: key, levels }); return }
                              try {
                                const snap = await getDoc(doc(db, "stores", entry.storeId, "blindPresets", entry.blindPresetId))
                                if (snap.exists()) setCalDetailPreset({ tournamentId: key, ...snap.data() })
                              } catch {}
                            }}
                            className="flex items-center gap-1.5 text-[12px] font-semibold text-[#F2A900]">
                            <FiChevronRight size={14} className={calDetailPreset?.tournamentId === key ? "rotate-90" : ""} />
                            ブラインド構成
                          </button>
                          {calDetailPreset?.tournamentId === key && calDetailPreset.levels && (
                            <div className="mt-2 rounded-2xl bg-white border border-gray-100 divide-y divide-gray-50 overflow-hidden">
                              <div className="grid grid-cols-3 px-3 py-1.5 text-[9px] font-bold text-gray-400 uppercase tracking-wide">
                                <span>Level</span><span>Blinds</span><span className="text-right">Time</span>
                              </div>
                              {(calDetailPreset.levels as any[]).map((lv: any, li: number) => (
                                <div key={li} className="px-3 py-2 flex items-center gap-3 text-[11px]">
                                  {lv.type === "break" ? (
                                    <span className="text-gray-400 col-span-3"> Break : {lv.duration}min</span>
                                  ) : (
                                    <>
                                      <span className="font-bold text-gray-400 w-8">Lv.{li + 1}</span>
                                      <span className="flex-1 text-gray-700 font-medium">{lv.smallBlind} / {lv.bigBlind}{lv.ante ? ` ante : ${lv.ante}` : ""}</span>
                                      <span className="text-gray-400">{lv.duration}min</span>
                                    </>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      )
                    })()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <HandHistoryModal userId={userId} creatorName={profile.name ?? "Unknown"} />

      {/* フッター（変更なし） */}
      <nav className="fixed bottom-0 left-0 right-0 w-full z-[80] glass-card border-t border-gray-200/60 shadow-lg">
        <div className="relative mx-auto flex max-w-sm items-center justify-between px-8 py-3">
          <button type="button" onClick={() => router.push("/home")} className="flex flex-col items-center text-[#F2A900] transition-all">
            <FiHome size={22} /><span className="mt-1 text-[11px] font-medium">ホーム</span>
          </button>
          <button type="button" onClick={() => router.push("/home/transactions")}
            className="absolute left-1/2 top-0 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-[#F2A900] to-[#D4910A] text-white shadow-xl hover:shadow-2xl transition-all active:scale-95"
          >
            {currentStoreId ? <FiCreditCard size={28} /> : <BsQrCodeScan size={26} />}
          </button>
          <button type="button" onClick={() => router.push("/home/mypage")} className="flex flex-col items-center text-gray-400 hover:text-[#F2A900] transition-all">
            <FiUser size={22} /><span className="mt-1 text-[11px]">マイページ</span>
          </button>
        </div>
      </nav>
    </main>
  )
}

