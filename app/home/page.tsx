"use client"

import { useEffect, useMemo, useRef, useState, type MutableRefObject, type Dispatch, type SetStateAction } from "react"
import { auth, db } from "@/lib/firebase"
import { arrayRemove, arrayUnion, collection, deleteField, doc, getDoc, getDocs, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where, addDoc } from "firebase/firestore"
import { FiHome, FiCreditCard, FiUser, FiX, FiSearch, FiStar, FiTrendingUp, FiLogOut, FiArrowLeft, FiClock, FiHelpCircle, FiAward, FiEdit2, FiBarChart2 } from "react-icons/fi"
import HomeHeader from "@/components/HomeHeader"
import { useRouter } from "next/navigation"
import { getCommonMenuItems } from "@/components/commonMenuItems"
import { getNetGainRanking, getUserRank, RankingPlayer } from "@/lib/ranking"
import { getNetGainRankingFromUsers, getMyNetGainRank, NetGainPlayer } from "@/lib/netGainRanking"

type StoreInfo = {
  id: string
  name: string
  iconUrl?: string
  address?: string
  chipUnitLabel?: string
  description?: string
  ringBlindSb?: number
  ringBlindBb?: number
  chipExpiryMonths?: number
}
type UserProfile = { name?: string; iconUrl?: string }
type StorePlayer = { id: string; name?: string; iconUrl?: string }
type RRPlayer = { id: string; name?: string; iconUrl?: string; roi: number; rrRating: number; rank: number }

export default function HomePage() {
  const getVisitCountResetBase = (date: Date) => {
    const base = new Date(date)
    base.setHours(3, 0, 0, 0)
    if (date.getHours() < 3) base.setDate(base.getDate() - 1)
    return base.getTime()
  }

  const router = useRouter()
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
  const [hasShownCheckinComplete, setHasShownCheckinComplete] = useState(false)
  const [hasShownStamp, setHasShownStamp] = useState(false)
  const shownWithdrawIdsRef = useRef<Set<string>>(new Set())
  const [withdrawNotice, setWithdrawNotice] = useState<{ type: "approved" | "rejected" | "pending"; amount: number } | null>(null)
  const prevCurrentStoreIdRef = useRef<string | null>(null)

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
    const unsub = auth.onAuthStateChanged(user => setUserId(user?.uid ?? null))
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
      const userRole = data?.role ?? null
      setRole(userRole)
      if (userRole === "store") { router.replace("/home/store"); return }
      const status = data?.checkinStatus ?? "none"
      const prevStatus = prevCheckinStatusRef.current
      setCheckinStatus(status)
      setPendingStoreId(data?.pendingStoreId ?? null)
      if (prevStatus === "pending" && status === "approved" && !hasShownCheckinComplete) {
        setIsCheckinCompleteModalOpen(true)
        setHasShownCheckinComplete(true)
        localStorage.setItem("hasShownCheckinComplete", "true")
        if (data?.currentStoreId) {
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
        }
      }
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
        next[storeId] = { id: storeId, name: data.name, iconUrl: data.iconUrl, address: data.address, chipUnitLabel: data.chipUnitLabel, description: data.description, ringBlindSb: typeof data.ringBlindSb === "number" ? data.ringBlindSb : undefined, ringBlindBb: typeof data.ringBlindBb === "number" ? data.ringBlindBb : undefined, chipExpiryMonths: typeof data.chipExpiryMonths === "number" ? data.chipExpiryMonths : undefined }
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
  const formatChipValue = (value: number) => { if (showBB && useBb) return `${formatBbValue(value)}BB`; return `${unitLabel}${value.toLocaleString()}` }
  const formatSignedChipValue = (value: number) => { const sign = value > 0 ? "+" : value < 0 ? "-" : "±"; const absValue = Math.abs(value); if (showBB && useBb) return `${sign}${formatBbValue(absValue)}BB`; return `${sign}${unitLabel}${absValue.toLocaleString()}` }

  const sortedTransactionItems = useMemo(() => {
    const getSeconds = (t: any) => { if (!t) return 0; if (typeof t.seconds === "number") return t.seconds; if (typeof t.toDate === "function") return t.toDate().getTime() / 1000; return 0 }
    return [...transactionItems].sort((a, b) => getSeconds(b.createdAt) - getSeconds(a.createdAt))
  }, [transactionItems])

  const sortedTournamentItems = useMemo(() => {
    const getSeconds = (t: any) => { if (!t) return 0; if (typeof t.seconds === "number") return t.seconds; if (typeof t.toDate === "function") return t.toDate().getTime() / 1000; return 0 }
    return [...tournamentHistoryItems].sort((a, b) => getSeconds(b.startedAt) - getSeconds(a.startedAt))
  }, [tournamentHistoryItems])

  const tournamentItems = useMemo(() => sortedTournamentItems, [sortedTournamentItems])

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
    const map: Record<string, string> = { manual_adjustment: "手動調整（チップ）", manual_adjustment_net_gain: "手動調整（純増）", deposit_approved_purchase: "預入（購入）", deposit_approved_pure_increase: "預入（純増）", withdraw_approved: "引き出し", withdraw_request: "引き出し申請", store_buyin: "バイイン (リングゲーム)", store_cashout: "キャッシュアウト (リングゲーム)", store_chip_purchase: "チップ購入", store_tournament_entry: "エントリー (トーナメント)", store_tournament_reentry: "リエントリー (トーナメント)", store_tournament_addon: "アドオン(トーナメント)", tournament_payout: "プライズ(トーナメント)", other: comment ?? "その他" }
    return map[type] ?? "不明"
  }
  const getHistoryAmount = (item: any) => { if (item.type === "withdraw") return formatSignedChipValue(-item.amount); if (item.type === "manual_adjustment") { const signedValue = item.direction === "subtract" ? -item.amount : item.amount; return formatSignedChipValue(signedValue) }; return formatSignedChipValue(item.amount) }
  const formatDateTime = (seconds?: number) => { if (!seconds) return ""; const date = new Date(seconds * 1000); const pad = (v: number) => v.toString().padStart(2, "0"); return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}` }

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
    snap.forEach(docSnap => { const data = docSnap.data(); list.push({ id: docSnap.id, name: data.name, iconUrl: data.iconUrl, address: data.address, chipUnitLabel: data.chipUnitLabel, description: data.description, ringBlindSb: typeof data.ringBlindSb === "number" ? data.ringBlindSb : undefined, ringBlindBb: typeof data.ringBlindBb === "number" ? data.ringBlindBb : undefined, chipExpiryMonths: typeof data.chipExpiryMonths === "number" ? data.chipExpiryMonths : undefined }) })
    setAllStores(list); return list
  }
  const handleSearch = async () => {
    const q = searchQuery.trim(); if (!q) return
    const list = await loadAllStores(); const normalized = q.toLowerCase()
    const byCode = list.find(s => s.id.toLowerCase() === normalized); const byName = list.find(s => s.name?.toLowerCase() === normalized)
    const found = byCode || byName; if (found) { setSelectedStore(found); setIsJoinModalOpen(false) }
  }
  const handleLeaveStore = async () => { if (!userId) return; await updateDoc(doc(db, "users", userId), { currentStoreId: deleteField() }); setCurrentStoreId(null) }
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
      snap.forEach(docSnap => { const data = docSnap.data(); if (typeof data.currentStoreId === "string") list.push({ id: docSnap.id, name: data.name, iconUrl: data.iconUrl }) })
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

  // ════════════════════════════════════════════════════
  // JSX
  // ════════════════════════════════════════════════════
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
        @keyframes pulseGlow {
          0%,100% { box-shadow:0 0 0 0 rgba(242,169,0,0.3); }
          50%      { box-shadow:0 0 0 8px rgba(242,169,0,0); }
        }
        @keyframes shimmer {
          0%   { background-position:-200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes spin { to { transform:rotate(360deg); } }

        .animate-slideUp  { animation:slideUp  0.35s ease-out; }
        .animate-bounceIn { animation:bounceIn 0.4s  ease-out; }
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
        .bank-card { perspective:1200px; }
        .bank-card-inner {
          position:relative; height:220px;
          transform-style:preserve-3d; -webkit-transform-style:preserve-3d;
          transition:transform 0.8s cubic-bezier(0.3,0.7,0.2,1); will-change:transform;
        }
        .bank-card.is-flipped .bank-card-inner { transform:rotateY(180deg); -webkit-transform:rotateY(180deg); }
        .bank-card.is-flipped .bank-card-front { pointer-events:none; }
        .bank-card:not(.is-flipped) .bank-card-back { pointer-events:none; }
        .bank-card-face {
          position:absolute; inset:0; backface-visibility:hidden; -webkit-backface-visibility:hidden;
          border-radius:24px; padding:20px; overflow:hidden;
          transform:rotateY(0deg) translateZ(0); -webkit-transform:rotateY(0deg) translateZ(0);
        }
        .bank-card-front {
          background:linear-gradient(135deg,#1f1b16 0%,#3b2f22 45%,#1c1510 100%);
          box-shadow:0 18px 40px rgba(15,12,8,0.35);
        }
        .bank-card-front::after {
          content:""; position:absolute; inset:-20% 40% auto -20%; height:140%;
          background:radial-gradient(circle at top,rgba(255,255,255,0.2),transparent 60%); opacity:0.6;
        }
        .bank-card-back {
          background:linear-gradient(135deg,#0f172a 0%,#1f2937 55%,#111827 100%);
          box-shadow:0 18px 40px rgba(17,24,39,0.35);
          transform:rotateY(180deg) translateZ(0); -webkit-transform:rotateY(180deg) translateZ(0);
        }
        .bank-card-history { max-height:130px; overflow-y:auto; padding-right:2px; }

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
      `}</style>

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
                  {/* 矢印 */}
                  <div className="flex items-center gap-2">
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
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="section-label">Bankroll</p>
                <span className="text-[11px] text-gray-400">タップでBB切替</span>
              </div>
              <div className={`bank-card ${isHistoryFlipped ? "is-flipped" : ""}`}>
                <div className="bank-card-inner">
                  {/* Front */}
                  <div className="bank-card-face bank-card-front">
                    <div className="relative z-10 flex items-center justify-between text-white/80">
                      <div className="flex items-center gap-2">
                        <FiCreditCard className="text-[17px]" />
                        <span className="text-[12px] tracking-[0.25em]">BANK ROLL</span>
                      </div>
                      <button type="button" onClick={() => setIsHistoryFlipped(true)}
                        className="inline-flex items-center gap-1 rounded-full border border-white/30 bg-black/30 px-3 py-1 text-[11px] text-white/80 hover:border-white/50 hover:text-white transition-colors"
                      >
                        <FiClock className="text-[11px]" />履歴
                      </button>
                    </div>
                    <p className="relative z-10 mt-1.5 text-[12px] text-white/60">
                      {currentStore.name}
                      {typeof currentStore.ringBlindSb === "number" && typeof currentStore.ringBlindBb === "number" && (
                        <span className="ml-2 text-[10px] text-white/40">({currentStore.ringBlindSb}/{currentStore.ringBlindBb})</span>
                      )}
                    </p>
                    <div className="relative z-10 mt-5 text-center cursor-pointer select-none" onClick={() => setShowBB(v => !v)}>
                      <p className="text-[10px] text-white/50 mb-1">{showBB ? 'BB表示' : 'チップ表示'} — タップで切替</p>
                      <p className="ticker text-[36px] font-bold text-white">
                        <span key={balance} className="ticker-animate">{formatChipValue(displayBalance)}</span>
                      </p>
                      {displayNetGain !== 0 && (
                        <p className={`ticker mt-1.5 text-[15px] font-semibold ${displayNetGain > 0 ? "text-emerald-300" : "text-rose-300"}`}>
                          <span key={netGain} className="ticker-animate">{formatSignedChipValue(displayNetGain)}</span>
                        </p>
                      )}
                    </div>
                  </div>
                  {/* Back */}
                  <div className="bank-card-face bank-card-back">
                    <div className="flex items-center justify-between text-white/80">
                      <p className="text-[12px] font-semibold tracking-[0.2em]">HISTORY</p>
                      <button type="button" onClick={() => setIsHistoryFlipped(false)} className="flex items-center gap-1 text-[11px] text-white/80 hover:text-white transition-colors">
                        <FiArrowLeft className="text-[11px]" />戻る
                      </button>
                    </div>
                    <div className="bank-card-history mt-3 space-y-2">
                      {sortedTransactionItems.length === 0 ? (
                        <p className="text-center text-[12px] text-white/60 py-6">履歴がありません</p>
                      ) : sortedTransactionItems.map(item => (
                        <div key={item.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                          <div>
                            <p className="text-[11px] text-white/70">{getHistoryLabel(item.type)}</p>
                            <p className="text-[10px] text-white/40">{formatDateTime(item.createdAt?.seconds)}</p>
                          </div>
                          <p className="text-[12px] font-semibold text-white">{getHistoryAmount(item)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

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
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <FiTrendingUp className="text-[17px] text-[#F2A900]" />
                  <p className="text-[15px] font-semibold text-gray-900">RANKING</p>
                  <span className="rounded-full bg-[#F2A900]/10 px-2 py-0.5 text-[10px] font-bold text-[#D4910A]">{currentStore.name}</span>
                </div>
                {ranking.length > 3 && (
                  <button type="button" onClick={() => setIsDetailedRankingModalOpen(true)} className="text-[12px] font-semibold text-[#F2A900]">もっと見る</button>
                )}
              </div>

              {userRank && (
                <div className="mb-3 rounded-2xl p-3 flex items-center justify-between" style={{ background: 'linear-gradient(135deg,#FFF8ED,#FFFBF5)', border: '1.5px solid rgba(242,169,0,0.25)' }}>
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F2A900]/15">
                      <FiUser className="text-[13px] text-[#D4910A]" />
                    </div>
                    <div>
                      <p className="text-[11px] text-gray-500">あなたの順位</p>
                      <p className="text-[14px] font-bold text-gray-900">{userRank.rank}位</p>
                    </div>
                  </div>
                  <p className={`text-[15px] font-bold ${userRank.netGain >= 0 ? "net-positive" : "net-negative"}`}>
                    {formatSignedChipValue(userRank.netGain)}
                  </p>
                </div>
              )}

              <div className="space-y-2">
                {rankingLoading ? (
                  <p className="text-center text-[13px] text-gray-400 py-4">ロード中…</p>
                ) : ranking.slice(0, 5).length > 0 ? (
                  ranking.slice(0, 5).map((player, index) => (
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
                ) : (
                  <p className="text-center text-[13px] text-gray-400 py-4">プレイヤーがいません</p>
                )}
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
                <button type="button" onClick={openJoinModal}
                  className="gold-btn flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold text-white"
                >
                  <FiSearch size={12} />新しい店舗
                </button>
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

            {/* RR Rating セクション */}
            <div>
              <div className="relative flex items-center gap-2 mb-3">
                <FiTrendingUp className="text-[17px] text-[#F2A900]" />
                <p className="text-[16px] font-semibold text-gray-900">RR Rating</p>
                <button type="button" onClick={() => setRrRatingInfoOpen(prev => !prev)}
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
                >
                  <FiHelpCircle size={13} />
                </button>
                {rrRatingInfoOpen && (
                  <div className="absolute left-0 top-9 z-50 w-[260px] rounded-2xl border border-gray-200 bg-white p-4 text-[12px] text-gray-600 shadow-xl animate-slideUp leading-relaxed">
                    トナメ偏差値とは、ROIとインマネ率からトーナメントの実力を偏差値で表したもの。参加数が少ないうちは変動しにくく、参加すればするほど実力に近い値になるよ。
                  </div>
                )}
              </div>

              <div className={`rr-board relative transition-all duration-500 min-h-[480px]`}
                style={{ transformStyle: 'preserve-3d', transform: rrCardFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
              >
                {!rrCardFlipped && (
                  <>
                    {/* RR Rate Card */}
                    <div className="rr-rate-card">
                      <p className="relative z-10 text-[11px] font-semibold uppercase tracking-wider text-white/80">あなたのトナメ偏差値</p>
                      <div className="relative z-10 mt-2 flex items-end gap-3">
                        <p className="text-[40px] font-bold text-white tracking-tight drop-shadow-sm leading-none">
                          {(rrMyEntry?.rrRating ?? 0).toFixed(2)}
                        </p>
                        {rrMyEntry && (
                          <div className="mb-1 rounded-full bg-white/20 px-2 py-0.5">
                            <p className="text-[11px] font-bold text-white">{rrMyEntry.rank}位</p>
                          </div>
                        )}
                      </div>
                      <p className="relative z-10 mt-2 text-[11px] text-white/60">
                        {rrMyEntry ? `ROI: ${rrMyEntry.roi.toFixed(2)}%` : "まだデータがありません"}
                      </p>
                    </div>

                    {/* ランキング */}
                    <div className="mt-5">
                      <div className="flex items-center gap-2 mb-3">
                        <FiAward className="text-[15px] text-[#F2A900]" />
                        <p className="section-label">Ranking</p>
                      </div>
                      <div className="space-y-2">
                        {rrRankingLoading ? (
                          <p className="text-center text-[13px] text-gray-400 py-4">ロード中…</p>
                        ) : rrRanking.length === 0 ? (
                          <p className="text-center text-[13px] text-gray-400">まだランキングデータがありません</p>
                        ) : rrRanking.slice(0, 5).map(player => (
                          <div key={player.id} className="rr-ranking-item">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className={`flex h-10 w-10 items-center justify-center rounded-full ${medalClass(player.rank)}`}>
                                  {player.iconUrl ? <img src={player.iconUrl} alt={player.name} className="h-8 w-8 rounded-full object-cover" /> : <FiUser className="text-[13px] text-gray-600" />}
                                </div>
                                <div>
                                  <p className="text-[13px] font-semibold text-gray-900">{player.name || "プレイヤー"}</p>
                                  <p className="text-[10px] text-gray-400">{player.rank}位</p>
                                </div>
                              </div>
                              <p className="text-[14px] font-bold text-gray-900">{player.rrRating.toFixed(2)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="divider-gold my-4" />

                    {/* 自分のエントリー */}
                    <div className="rr-my-entry">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white border-2 border-[#F2A900] shadow-sm">
                            {profile.iconUrl ? <img src={profile.iconUrl} alt={profile.name} className="h-8 w-8 rounded-full object-cover" /> : <FiUser className="text-[15px] text-[#F2A900]" />}
                          </div>
                          <div>
                            <p className="text-[13px] font-semibold text-gray-900">{profile.name || "あなた"}</p>
                            <p className="text-[10px] font-medium text-[#D4910A]">{rrMyEntry?.rank ?? "-"}位</p>
                          </div>
                        </div>
                        <p className="text-[14px] font-bold text-gray-900">{(rrMyEntry?.rrRating ?? 0).toFixed(2)}</p>
                      </div>
                    </div>
                  </>
                )}

                {rrCardFlipped && (
                  <div style={{ transform: 'rotateY(180deg)' }}>
                    {rrRankingLoading ? (
                      <div className="flex items-center justify-center" style={{ minHeight: 420 }}>
                        <p className="text-[13px] text-gray-400">ロード中…</p>
                      </div>
                    ) : rrBackFaceVisible ? (
                      <>
                        <div className="flex items-center gap-2 mb-3">
                          <FiAward className="text-[15px] text-[#F2A900]" />
                          <p className="section-label">TOP 100 RANKING</p>
                        </div>
                        <div className="max-h-[400px] overflow-y-auto space-y-2 pr-1">
                          {rrFullRanking.slice(0, 100).length > 0 ? rrFullRanking.slice(0, 100).map(player => (
                            <div key={player.id} className="rr-ranking-item">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className={`flex h-10 w-10 items-center justify-center rounded-full ${medalClass(player.rank)}`}>
                                    {player.iconUrl ? <img src={player.iconUrl} alt={player.name} className="h-8 w-8 rounded-full object-cover" /> : <FiUser className="text-[13px] text-gray-600" />}
                                  </div>
                                  <div>
                                    <p className="text-[13px] font-semibold text-gray-900">{player.name || "プレイヤー"}</p>
                                    <p className="text-[10px] text-gray-400">{player.rank}位</p>
                                  </div>
                                </div>
                                <p className="text-[14px] font-bold text-gray-900">{player.rrRating.toFixed(2)}</p>
                              </div>
                            </div>
                          )) : <p className="text-center text-[13px] text-gray-400 py-4">データを読み込み中…</p>}
                        </div>
                      </>
                    ) : null}
                  </div>
                )}
              </div>

              {/* フリップボタン */}
              <button type="button"
                onClick={() => {
                  if (rrCardFlipped) { setRrBackFaceVisible(false); setRrCardFlipped(false) }
                  else { setRrCardFlipped(true); if (rrFullRanking.length === 0) setRrFullRanking(rrRanking); setTimeout(() => setRrBackFaceVisible(true), 500) }
                }}
                className="mt-3 w-full h-11 rounded-2xl outline-gold-btn text-[13px] font-semibold"
              >
                {rrCardFlipped ? '← 戻る' : 'TOP 100を見る'}
              </button>
            </div>

            {/* トーナメントスタッツ */}
            <div className="section-card animate-slideUp">
              <div className="flex items-center gap-2 mb-4">
                <FiBarChart2 className="text-[17px] text-[#F2A900]" />
                <p className="text-[15px] font-semibold text-gray-900">TOURNAMENT STATS</p>
              </div>

              {/* メインROI表示 */}
              <div className="rounded-2xl p-4 mb-3 text-center" style={{ background: 'linear-gradient(135deg,#F2A900,#D4910A)', boxShadow: '0 4px 16px rgba(242,169,0,0.25)' }}>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-white/80 mb-1">ROI</p>
                <p className="text-[36px] font-bold text-white leading-none">
                  {tournamentStats.roi === "集計中" ? "—" : `${tournamentStats.roi}%`}
                </p>
                <p className="text-[11px] text-white/70 mt-1">
                  {tournamentStats.roi === "集計中" ? "トーナメントに参加すると計算されます" : `${tournamentStats.plays}回参加 · ITM ${tournamentStats.itmRate}%`}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="stat-chip">
                  <p className="section-label mb-1">コスト</p>
                  <p className="text-[17px] font-bold text-gray-900">{tournamentStats.totalCost}</p>
                </div>
                <div className="stat-chip">
                  <p className="section-label mb-1">リターン</p>
                  <p className="text-[17px] font-bold text-gray-900">{tournamentStats.totalReward.toFixed(2)}</p>
                </div>
                <div className="stat-chip" style={{ background: 'linear-gradient(135deg,#FFF8ED,#FFFBF5)', border: '1px solid rgba(242,169,0,0.2)' }}>
                  <p className="section-label mb-1">ITM率</p>
                  <p className="text-[17px] font-bold text-[#D4910A]">{tournamentStats.itmRate}%</p>
                </div>
                <div className="stat-chip" style={{ background: 'linear-gradient(135deg,#FFF8ED,#FFFBF5)', border: '1px solid rgba(242,169,0,0.2)' }}>
                  <p className="section-label mb-1">エントリー</p>
                  <p className="text-[17px] font-bold text-[#D4910A]">{tournamentStats.plays}回</p>
                </div>
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

              <div className="space-y-3">
                {sortedTournamentItems.slice(0, 5).map(item => {
                  const entryCount = item.entryCount ?? 0, reentryCount = item.reentryCount ?? 0, addonCount = item.addonCount ?? 0
                  const entryFee = item.entryFee ?? 0, reentryFee = item.reentryFee ?? 0, addonFee = item.addonFee ?? 0
                  const prize = item.prize ?? 0, rank = item.rank ?? "-"
                  const buyin = entryCount * entryFee + reentryCount * reentryFee + addonCount * addonFee
                  let baseFee = entryFee > 0 ? entryFee : reentryFee > 0 ? reentryFee : addonFee
                  const cost = baseFee > 0 ? buyin / baseFee : 0
                  const reward = baseFee > 0 ? prize / baseFee : 0
                  const pnl = prize - buyin

                  return (
                    <div key={item.id} className="rounded-2xl bg-white border border-gray-100 overflow-hidden hover:shadow-md transition-all">
                      {/* カラーバー */}
                      <div style={{ height: 3, background: pnl > 0 ? 'linear-gradient(90deg,#10b981,#34d399)' : pnl < 0 ? 'linear-gradient(90deg,#ef4444,#f87171)' : 'linear-gradient(90deg,#9ca3af,#d1d5db)' }} />
                      <div style={{ padding: '14px' }}>
                        {/* ヘッダー */}
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <p className="text-[13px] font-semibold text-gray-900 leading-tight">{item.tournamentName ?? ""}</p>
                            <p className="text-[10px] text-gray-400 mt-0.5">{formatDateTime(item.startedAt?.seconds)} · {item.storeName ?? ""}</p>
                          </div>
                          {rank !== "-" && (
                            <div className="ml-2 flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#F2A900] to-[#D4910A] shadow-sm flex-shrink-0">
                              <span className="text-[12px] font-bold text-white">{rank}位</span>
                            </div>
                          )}
                        </div>
                        {/* グリッドスタッツ */}
                        <div className="grid grid-cols-3 gap-2 mb-3">
                          <div className="rounded-xl bg-gray-50 p-2 text-center">
                            <p className="text-[9px] text-gray-400 mb-0.5">コスト</p>
                            <p className="text-[13px] font-bold text-gray-700">{cost.toFixed(1)}</p>
                          </div>
                          <div className="rounded-xl bg-gray-50 p-2 text-center">
                            <p className="text-[9px] text-gray-400 mb-0.5">リワード</p>
                            <p className="text-[13px] font-bold text-gray-700">{reward.toFixed(1)}</p>
                          </div>
                          <div className={`rounded-xl p-2 text-center ${pnl > 0 ? "bg-green-50" : pnl < 0 ? "bg-red-50" : "bg-gray-50"}`}>
                            <p className="text-[9px] text-gray-400 mb-0.5">収支</p>
                            <p className={`text-[13px] font-bold ${pnl > 0 ? "text-green-600" : pnl < 0 ? "text-red-500" : "text-gray-600"}`}>
                              {formatSignedChipValue(pnl)}
                            </p>
                          </div>
                        </div>
                        {/* バイイン詳細 */}
                        <div className="rounded-xl bg-gray-50 p-2.5 text-[11px] text-gray-500 space-y-0.5">
                          {entryCount > 0 && <div className="flex justify-between"><span>Entry</span><span className="font-medium text-gray-700">{entryFee} × {entryCount}</span></div>}
                          {reentryCount > 0 && <div className="flex justify-between"><span>Re-entry</span><span className="font-medium text-gray-700">{reentryFee} × {reentryCount}</span></div>}
                          {addonCount > 0 && <div className="flex justify-between"><span>Add-on</span><span className="font-medium text-gray-700">{addonFee} × {addonCount}</span></div>}
                          <div className="border-t border-gray-200 pt-0.5 flex justify-between font-semibold text-gray-800">
                            <span>合計</span><span>{buyin.toLocaleString()}</span>
                          </div>
                          {rank !== "-" && (
                            <div className="flex justify-between text-[#D4910A] font-semibold">
                              <span>Prize</span><span>{prize.toLocaleString()}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}

                {sortedTournamentItems.length === 0 && (
                  <div className="text-center py-10">
                    <div className="h-14 w-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                      <FiAward className="text-gray-300" size={24} />
                    </div>
                    <p className="text-[13px] text-gray-400">トーナメント履歴がありません</p>
                    <p className="text-[11px] text-gray-300 mt-1">参加すると記録されます</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* ════ モーダル群（ロジック完全保持・デザインのみ刷新）════ */}

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
          <div className="bg-white rounded-3xl p-6 w-[88%] max-w-sm text-center animate-bounceIn shadow-2xl border-2 border-[#F2A900]">
            <p className="text-[20px] font-bold text-[#F2A900] mb-1">スタンプ獲得！</p>
            <p className="text-[12px] text-gray-400 mb-4">{stampCount} 個貯まりました</p>
            <div className="grid grid-cols-4 gap-2 mb-5">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className={`h-14 w-14 rounded-2xl flex items-center justify-center text-[18px] border-2 transition-all duration-300 ${i < stampCount ? "bg-[#F2A900] border-[#F2A900] shadow-lg animate-stampPop" : "bg-gray-50 border-gray-200 text-gray-300"}`}>
                  {i < stampCount ? "✓" : ""}
                </div>
              ))}
            </div>
            <button onClick={() => setShowStampModal(false)} className="w-full h-11 rounded-2xl gold-btn text-gray-900 font-semibold text-[14px]">OK</button>
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

      {/* フッター（変更なし） */}
      <nav className="fixed bottom-0 left-0 right-0 w-full z-[80] glass-card border-t border-gray-200/60 shadow-lg">
        <div className="relative mx-auto flex max-w-sm items-center justify-between px-8 py-3">
          <button type="button" onClick={() => router.push("/home")} className="flex flex-col items-center text-[#F2A900] transition-all">
            <FiHome size={22} /><span className="mt-1 text-[11px] font-medium">ホーム</span>
          </button>
          <button type="button" onClick={() => router.push("/home/transactions")}
            className="absolute left-1/2 top-0 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-[#F2A900] to-[#D4910A] text-white shadow-xl hover:shadow-2xl transition-all active:scale-95"
          >
            <FiCreditCard size={28} />
          </button>
          <button type="button" onClick={() => router.push("/home/mypage")} className="flex flex-col items-center text-gray-400 hover:text-[#F2A900] transition-all">
            <FiUser size={22} /><span className="mt-1 text-[11px]">マイページ</span>
          </button>
        </div>
      </nav>
    </main>
  )
}