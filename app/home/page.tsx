"use client"

import { useEffect, useMemo, useRef, useState, type MutableRefObject, type Dispatch, type SetStateAction } from "react"
// ...existing code...
import { auth, db } from "@/lib/firebase"
import { arrayRemove, arrayUnion, collection, deleteField, doc, getDoc, getDocs, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where } from "firebase/firestore"
import { FiHome, FiCreditCard, FiUser, FiX, FiSearch, FiStar, FiTrendingUp, FiLogOut, FiArrowLeft, FiClock, FiHelpCircle, FiAward, FiEdit2 } from "react-icons/fi"
import HomeHeader from "@/components/HomeHeader"
import { useRouter } from "next/navigation"
import { getCommonMenuItems } from "@/components/commonMenuItems"
import { getNetGainRanking, getUserRank, RankingPlayer } from "@/lib/ranking"

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

type UserProfile = {
  name?: string
  iconUrl?: string
}

type StorePlayer = {
  id: string
  name?: string
  iconUrl?: string
}

type RRPlayer = {
  id: string

  name?: string
  iconUrl?: string
  rating: number
  rank: number
}

export default function HomePage() {

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
  // ...以降のロジック・JSXもこの関数内...
  const [favoritePulse, setFavoritePulse] = useState("")
  const [historyItems, setHistoryItems] = useState<any[]>([])
  const [ranking, setRanking] = useState<RankingPlayer[]>([])
  const [userRank, setUserRank] = useState<RankingPlayer | null>(null)
  const [rankingLoading, setRankingLoading] = useState(true)
  const [isPlayersModalOpen, setIsPlayersModalOpen] = useState(false)
  const [playersPreview, setPlayersPreview] = useState<StorePlayer[]>([])
  const [playersPreviewStore, setPlayersPreviewStore] = useState<StoreInfo | null>(null)
  const [playersPreviewLoading, setPlayersPreviewLoading] = useState(false)
  const [rrRanking, setRrRanking] = useState<RRPlayer[]>([])
  const [rrMyEntry, setRrMyEntry] = useState<RRPlayer | null>(null)
  const [rrRatingInfoOpen, setRrRatingInfoOpen] = useState(false)
  const [rrRatingValue, setRrRatingValue] = useState(1000)
  const [rrSuit, setRrSuit] = useState<"spade" | "diamond" | "club" | "heart">("heart")
  const [rrNumber, setRrNumber] = useState<"A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K">("A")
  const [rrCardModalOpen, setRrCardModalOpen] = useState(false)
  const [rrCardFlipped, setRrCardFlipped] = useState(false)
  const [rrBackFaceVisible, setRrBackFaceVisible] = useState(false)
  const [rrFullRanking, setRrFullRanking] = useState<RRPlayer[]>([])
  const [rrRankingLoading, setRrRankingLoading] = useState(true)
  const [displayBalance, setDisplayBalance] = useState(0)
  const [displayNetGain, setDisplayNetGain] = useState(0)
  // チップ/BB表記切り替え用
  const [showBB, setShowBB] = useState(false)
  const balanceRef = useRef(0)
  const netGainRef = useRef(0)

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(user => {
      setUserId(user?.uid ?? null)
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    const fetchUser = async () => {
      if (!userId) return
      const snap = await getDoc(doc(db, "users", userId))
      const data = snap.data()
      setCurrentStoreId(data?.currentStoreId ?? null)
      setJoinedStores(Array.isArray(data?.joinedStores) ? data.joinedStores : [])
      setFavoriteStores(Array.isArray(data?.favoriteStores) ? data.favoriteStores : [])
      setProfile({ name: data?.name, iconUrl: data?.iconUrl })
      const rating = typeof data?.rrRating === "number" ? data.rrRating : 1000
      setRrRatingValue(rating)
      if (typeof data?.rrRating !== "number") {
        await updateDoc(doc(db, "users", userId), { rrRating: 1000 })
      }
    }

    fetchUser()
  }, [userId])

  useEffect(() => {
    const fetchStores = async () => {
      if (!joinedStores.length) {
        setStores({})
        return
      }

      const next: Record<string, StoreInfo> = {}
      await Promise.all(
        joinedStores.map(async storeId => {
          const snap = await getDoc(doc(db, "stores", storeId))
          if (!snap.exists()) return
          const data = snap.data() as StoreInfo
          next[storeId] = {
            id: storeId,
            name: data.name,
            iconUrl: data.iconUrl,
            address: data.address,
            chipUnitLabel: data.chipUnitLabel,
            description: data.description,
            ringBlindSb: typeof data.ringBlindSb === "number" ? data.ringBlindSb : undefined,
            ringBlindBb: typeof data.ringBlindBb === "number" ? data.ringBlindBb : undefined,
            chipExpiryMonths: typeof data.chipExpiryMonths === "number" ? data.chipExpiryMonths : undefined,
          }
        })
      )
      setStores(next)
    }

    fetchStores()
  }, [joinedStores])

  useEffect(() => {
    if (!userId || !currentStoreId) {
      setBalance(0)
      setNetGain(0)
      return
    }

    const balanceRef = doc(db, "users", userId, "storeBalances", currentStoreId)
    const unsub = onSnapshot(balanceRef, snap => {
      if (!snap.exists()) {
        setBalance(0)
        setNetGain(0)
        return
      }
      const data = snap.data()
      setBalance(typeof data?.balance === "number" ? data.balance : 0)
      setNetGain(typeof data?.netGain === "number" ? data.netGain : 0)
    })

    return () => unsub()
  }, [userId, currentStoreId])

  useEffect(() => {
    if (!userId || !currentStoreId) return
    const balanceRef = doc(db, "users", userId, "storeBalances", currentStoreId)
    void setDoc(
      balanceRef,
      { lastVisitedAt: serverTimestamp(), storeId: currentStoreId },
      { merge: true }
    )
  }, [userId, currentStoreId])

  useEffect(() => {
    const fetchHistoryData = async () => {
      if (!userId || !currentStoreId) {
        setHistoryItems([])
        return
      }

      try {
        const depositSnap = await getDocs(
          query(
            collection(db, "depositRequests"),
            where("playerId", "==", userId),
            where("storeId", "==", currentStoreId)
          )
        )
        const withdrawSnap = await getDocs(
          query(
            collection(db, "withdrawals"),
            where("playerId", "==", userId),
            where("storeId", "==", currentStoreId)
          )
        )
        const transactionSnap = await getDocs(
          query(
            collection(db, "transactions"),
            where("playerId", "==", userId),
            where("storeId", "==", currentStoreId)
          )
        )

        const next: any[] = []
        depositSnap.forEach(docSnap => {
          const data = docSnap.data()
          if (data.status === "pending") {
            next.push({ id: docSnap.id, type: "deposit_pending", amount: data.amount, createdAt: data.createdAt })
          } else if (data.status === "rejected") {
            next.push({ id: docSnap.id, type: "deposit_rejected", amount: data.amount, createdAt: data.createdAt })
          } else {
            next.push({ id: docSnap.id, type: "deposit", amount: data.amount, createdAt: data.createdAt })
          }
        })
        withdrawSnap.forEach(docSnap => {
          const data = docSnap.data()
          next.push({ id: docSnap.id, type: "withdraw", amount: data.amount, createdAt: data.createdAt })
        })
        transactionSnap.forEach(docSnap => {
          const data = docSnap.data()
          next.push({
            id: docSnap.id,
            type: "manual_adjustment",
            amount: data.amount,
            createdAt: data.createdAt,
            direction: data.direction,
          })
        })

        setHistoryItems(next)
      } catch (error) {
        console.error("Failed to fetch history:", error)
        setHistoryItems([])
      }
    }

    fetchHistoryData()
  }, [userId, currentStoreId])

  useEffect(() => {
    const fetchRankingData = async () => {
      if (!currentStoreId) {
        setRanking([])
        setUserRank(null)
        setRankingLoading(false)
        return
      }

      setRankingLoading(true)
      try {
　        const rankingData = await getNetGainRanking(currentStoreId)
        setRanking(rankingData)
        if (userId) {
          const uRank = getUserRank(userId, rankingData)
          setUserRank(uRank)
        }
      } catch (error) {
        console.error("Failed to fetch ranking:", error)
        setRanking([])
        setUserRank(null)
      } finally {
        setRankingLoading(false)
      }
    }

    fetchRankingData()
  }, [userId, currentStoreId])

  const currentStore = currentStoreId ? stores[currentStoreId] : null

  const unitLabel = useMemo(() => {
    if (!currentStore?.chipUnitLabel || currentStore.chipUnitLabel === "単位なし") return ""
    return currentStore.chipUnitLabel
  }, [currentStore])

  const blindBb = typeof currentStore?.ringBlindBb === "number" ? currentStore.ringBlindBb : null
  const useBb = typeof blindBb === "number" && blindBb > 0

  const formatBbValue = (value: number) => {
    if (!blindBb) return "0"
    const raw = value / blindBb
    const rounded = Number.isInteger(raw) ? raw : Math.round(raw * 10) / 10
    return rounded.toLocaleString()
  }

  // チップ/BB表記切り替え対応
  const formatChipValue = (value: number) => {
    if (showBB && useBb) return `${formatBbValue(value)}BB`
    return `${unitLabel}${value.toLocaleString()}`
  }

  const formatSignedChipValue = (value: number) => {
    const sign = value > 0 ? "+" : value < 0 ? "-" : ""
    const absValue = Math.abs(value)
    if (showBB && useBb) return `${sign}${formatBbValue(absValue)}BB`
    return `${sign}${unitLabel}${absValue.toLocaleString()}`
  }

  const sortedHistoryItems = useMemo(() => {
    return [...historyItems].sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))
  }, [historyItems])

  const getHistoryLabel = (type: string) => {
    switch (type) {
      case "deposit":
        return "入金"
      case "deposit_pending":
        return "入金申請中"
      case "deposit_rejected":
        return "申請拒否"
      case "withdraw":
        return "出金"
      case "manual_adjustment":
        return "手動調整"
      default:
        return ""
    }
  }

  const getHistoryAmount = (item: any) => {
    if (item.type === "withdraw") return formatSignedChipValue(-item.amount)
    if (item.type === "manual_adjustment") {
      const signedValue = item.direction === "subtract" ? -item.amount : item.amount
      return formatSignedChipValue(signedValue)
    }
    return formatSignedChipValue(item.amount)
  }

  const formatDateTime = (seconds?: number) => {
    if (!seconds) return ""
    const date = new Date(seconds * 1000)
    const pad = (value: number) => value.toString().padStart(2, "0")
    return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(
      date.getMinutes()
    )}`
  }

  useEffect(() => {
    setIsHistoryFlipped(false)
  }, [currentStoreId])

  useEffect(() => {
    const animateCount = (
      target: number,
      ref: MutableRefObject<number>,
      setter: Dispatch<SetStateAction<number>>
    ) => {
      const start = performance.now()
      const from = ref.current
      const diff = target - from
      const duration = 900
      const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)

      const step = (time: number) => {
        const progress = Math.min((time - start) / duration, 1)
        const value = Math.round(from + diff * easeOut(progress))
        setter(value)
        if (progress < 1) {
          requestAnimationFrame(step)
        } else {
          ref.current = target
        }
      }

      requestAnimationFrame(step)
    }

    animateCount(balance, balanceRef, setDisplayBalance)
  }, [balance])

  useEffect(() => {
    const animateCount = (
      target: number,
      ref: MutableRefObject<number>,
      setter: Dispatch<SetStateAction<number>>
    ) => {
      const start = performance.now()
      const from = ref.current
      const diff = target - from
      const duration = 900
      const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)

      const step = (time: number) => {
        const progress = Math.min((time - start) / duration, 1)
        const value = Math.round(from + diff * easeOut(progress))
        setter(value)
        if (progress < 1) {
          requestAnimationFrame(step)
        } else {
          ref.current = target
        }
      }

      requestAnimationFrame(step)
    }

    animateCount(netGain, netGainRef, setDisplayNetGain)
  }, [netGain])

  useEffect(() => {
    const fetchRrRanking = async () => {
      if (!userId) {
        setRrRankingLoading(false)
        return
      }
      setRrRankingLoading(true)
      try {
        const snap = await getDocs(collection(db, "users"))
        const list: RRPlayer[] = []
        const updates: Array<Promise<void>> = []
        snap.forEach(docSnap => {
          const data = docSnap.data()
          if (data.role === "store") return
          const rating = typeof data.rrRating === "number" ? data.rrRating : 1000
          if (typeof data.rrRating !== "number") {
            updates.push(updateDoc(doc(db, "users", docSnap.id), { rrRating: 1000 }) as Promise<void>)
          }
          list.push({
            id: docSnap.id,
            name: data.name,
            iconUrl: data.iconUrl,
            rating,
            rank: 0,
          })
        })

        if (updates.length) {
          await Promise.allSettled(updates)
        }

        list.sort((a, b) => b.rating - a.rating)
        let currentRank = 0
        let lastRating: number | null = null
        const ranked = list.map((player, index) => {
          if (lastRating === null || player.rating !== lastRating) {
            currentRank = index + 1
            lastRating = player.rating
          }
          return { ...player, rank: currentRank }
        })

        setRrRanking(ranked)
        setRrMyEntry(ranked.find(player => player.id === userId) ?? null)
      } catch (error) {
        console.error("Failed to fetch RR ranking:", error)
        setRrRanking([])
        setRrMyEntry(null)
      } finally {
        setRrRankingLoading(false)
      }
    }

    fetchRrRanking()
  }, [userId])

  const joinStore = async (storeId: string) => {
    if (!userId) return
    const userRef = doc(db, "users", userId)

    await updateDoc(userRef, {
      currentStoreId: storeId,
      joinedStores: arrayUnion(storeId),
    })

    const balanceRef = doc(db, "users", userId, "storeBalances", storeId)
    const balanceSnap = await getDoc(balanceRef)
    if (!balanceSnap.exists()) {
      await setDoc(
        balanceRef,
        { balance: 0, netGain: 0, lastVisitedAt: serverTimestamp(), storeId },
        { merge: true }
      )
    } else {
      await setDoc(
        balanceRef,
        { lastVisitedAt: serverTimestamp(), storeId },
        { merge: true }
      )
    }

    setCurrentStoreId(storeId)
    setJoinedStores(prev => (prev.includes(storeId) ? prev : [...prev, storeId]))
    setSelectedStore(null)
  }

  const loadAllStores = async () => {
    if (allStores.length) return allStores
    const snap = await getDocs(collection(db, "stores"))
    const list: StoreInfo[] = []
    snap.forEach(docSnap => {
      const data = docSnap.data()
      list.push({
        id: docSnap.id,
        name: data.name,
        iconUrl: data.iconUrl,
        address: data.address,
        chipUnitLabel: data.chipUnitLabel,
        description: data.description,
        ringBlindSb: typeof data.ringBlindSb === "number" ? data.ringBlindSb : undefined,
        ringBlindBb: typeof data.ringBlindBb === "number" ? data.ringBlindBb : undefined,
        chipExpiryMonths: typeof data.chipExpiryMonths === "number" ? data.chipExpiryMonths : undefined,
      })
    })
    setAllStores(list)
    return list
  }

  const handleSearch = async () => {
    const query = searchQuery.trim()
    if (!query) return
    const list = await loadAllStores()
    const normalized = query.toLowerCase()
    const byCode = list.find(store => store.id.toLowerCase() === normalized)
    const byName = list.find(store => store.name?.toLowerCase() === normalized)
    const found = byCode || byName
    if (found) {
      setSelectedStore(found)
      setIsJoinModalOpen(false)
    }
  }

  const handleLeaveStore = async () => {
    if (!userId) return
    await updateDoc(doc(db, "users", userId), {
      currentStoreId: deleteField(),
    })
    setCurrentStoreId(null)
  }

  const openJoinModal = () => {
    setSearchQuery("")
    void loadAllStores()
    setIsJoinModalOpen(true)
  }

  const toggleFavoriteStore = async (storeId: string) => {
    if (!userId) return
    const isFavorite = favoriteStores.includes(storeId)
    await updateDoc(doc(db, "users", userId), {
      favoriteStores: isFavorite ? arrayRemove(storeId) : arrayUnion(storeId),
    })
    setFavoriteStores(prev =>
      isFavorite ? prev.filter(id => id !== storeId) : prev.includes(storeId) ? prev : [...prev, storeId]
    )
    setFavoriteMessage(isFavorite ? "お気に入りを解除しました" : "お気に入りに登録しました")
    setFavoritePulse(storeId)
    setTimeout(() => setFavoriteMessage(""), 2000)
    setTimeout(() => setFavoritePulse(""), 700)
  }

  const openPlayersPreview = async (store: StoreInfo) => {
    setPlayersPreviewStore(store)
    setPlayersPreview([])
    setPlayersPreviewLoading(true)
    setIsPlayersModalOpen(true)
    try {
      const snap = await getDocs(
        query(
          collection(db, "users"),
          where("currentStoreId", "==", store.id)
        )
      )
      const list: StorePlayer[] = []
      snap.forEach(docSnap => {
        const data = docSnap.data()
        list.push({ id: docSnap.id, name: data.name, iconUrl: data.iconUrl })
      })
      setPlayersPreview(list)
    } catch (error) {
      console.error("Failed to fetch store players:", error)
      setPlayersPreview([])
    } finally {
      setPlayersPreviewLoading(false)
    }
  }

  const suggestions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query || !allStores.length) return []
    return allStores
      .filter(store => store.name?.toLowerCase().includes(query) || store.id.toLowerCase().includes(query))
      .slice(0, 5)
  }, [allStores, searchQuery])

  const orderedJoinedStores = useMemo(() => {
    const favoriteSet = new Set(favoriteStores)
    const favorites = joinedStores.filter(storeId => favoriteSet.has(storeId))
    const others = joinedStores.filter(storeId => !favoriteSet.has(storeId))
    return [...favorites, ...others]
  }, [favoriteStores, joinedStores])

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white pb-28">
      <HomeHeader
        homePath="/home"
        myPagePath="/home/mypage"
        showNotifications
        menuItems={getCommonMenuItems(router, 'user')}
      />

      <style>{`
        @keyframes arrowShift {
          0% {
            stroke-dashoffset: 10;
          }
          100% {
            stroke-dashoffset: 0;
          }
        }
        .arrow-animate {
          animation: arrowShift 1.5s ease-in-out infinite;
          stroke-dasharray: 10;
        }
        @keyframes tickerPulse {
          0% {
            transform: translateY(6px);
            opacity: 0.6;
          }
          100% {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .ticker {
          font-variant-numeric: tabular-nums;
          letter-spacing: 0.02em;
        }
        .ticker-animate {
          display: inline-block;
          animation: tickerPulse 0.6s ease;
        }
        .bank-card {
          perspective: 1200px;
        }
        .bank-card-inner {
          position: relative;
          height: 220px;
          transform-style: preserve-3d;
          transition: transform 0.8s cubic-bezier(0.3, 0.7, 0.2, 1);
        }
        .bank-card.is-flipped .bank-card-inner {
          transform: rotateY(180deg);
        }
        .bank-card.is-flipped .bank-card-front {
          pointer-events: none;
        }
        .bank-card:not(.is-flipped) .bank-card-back {
          pointer-events: none;
        }
        .bank-card-face {
          position: absolute;
          inset: 0;
          backface-visibility: hidden;
          border-radius: 24px;
          padding: 20px;
          overflow: hidden;
        }
        .bank-card-front {
          background: linear-gradient(135deg, #1f1b16 0%, #3b2f22 45%, #1c1510 100%);
          box-shadow: 0 18px 40px rgba(15, 12, 8, 0.35);
        }
        .bank-card-front::after {
          content: "";
          position: absolute;
          inset: -20% 40% auto -20%;
          height: 140%;
          background: radial-gradient(circle at top, rgba(255, 255, 255, 0.2), transparent 60%);
          opacity: 0.6;
        }
        .bank-card-back {
          background: linear-gradient(135deg, #0f172a 0%, #1f2937 55%, #111827 100%);
          box-shadow: 0 18px 40px rgba(17, 24, 39, 0.35);
          transform: rotateY(180deg);
        }
        .bank-card-history {
          max-height: 130px;
          overflow-y: auto;
          padding-right: 2px;
        }
        .rr-board {
          position: relative;
          background: linear-gradient(145deg, #FFFBF5 0%, #FFF8ED 100%);
          border: 1px solid rgba(242, 169, 0, 0.15);
          border-radius: 28px;
          padding: 24px;
          box-shadow: 0 2px 8px rgba(242, 169, 0, 0.08), 0 12px 32px rgba(242, 169, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.9);
          z-index: 1;
        }
        .rr-rate-card {
          background: linear-gradient(135deg, #F2A900 0%, #D4910A 100%);
          border-radius: 20px;
          padding: 24px;
          box-shadow: 0 4px 16px rgba(242, 169, 0, 0.3), 0 1px 3px rgba(0, 0, 0, 0.1);
          position: relative;
          overflow: hidden;
        }
        .rr-rate-card::before {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.6) 50%, transparent 100%);
        }
        .rr-rate-card::after {
          content: "";
          position: absolute;
          top: -50%;
          right: -20%;
          width: 200px;
          height: 200px;
          background: radial-gradient(circle, rgba(255, 255, 255, 0.15) 0%, transparent 70%);
          border-radius: 50%;
        }
        .rr-ranking-item {
          background: rgba(255, 255, 255, 0.85);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(242, 169, 0, 0.1);
          border-radius: 16px;
          padding: 14px 16px;
          box-shadow: 0 1px 3px rgba(242, 169, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 1);
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .rr-ranking-item:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(242, 169, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 1);
          border-color: rgba(242, 169, 0, 0.2);
        }
        .medal-gold {
          background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%);
          box-shadow: 0 2px 8px rgba(255, 215, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.6);
        }
        .medal-silver {
          background: linear-gradient(135deg, #E8E8E8 0%, #C0C0C0 100%);
          box-shadow: 0 2px 8px rgba(192, 192, 192, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.7);
        }
        .medal-bronze {
          background: linear-gradient(135deg, #F4A460 0%, #CD7F32 100%);
          box-shadow: 0 2px 8px rgba(205, 127, 50, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.4);
        }
        .rr-divider {
          height: 1px;
          background: linear-gradient(90deg, transparent 0%, rgba(242, 169, 0, 0.2) 50%, transparent 100%);
        }
        .rr-my-entry {
          background: linear-gradient(135deg, #FFFBF5 0%, #FFF4E0 100%);
          border: 1.5px solid rgba(242, 169, 0, 0.3);
          border-radius: 16px;
          padding: 14px 16px;
          box-shadow: 0 2px 8px rgba(242, 169, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.9);
        }
        .rr-more-btn {
          background: rgba(255, 255, 255, 0.9);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          border: 1px solid rgba(242, 169, 0, 0.4);
          color: #D4910A;
          border-radius: 14px;
          padding: 12px;
          font-weight: 600;
          box-shadow: 0 2px 8px rgba(242, 169, 0, 0.15);
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .rr-more-btn:hover {
          background: rgba(255, 255, 255, 1);
          border-color: rgba(242, 169, 0, 0.6);
          box-shadow: 0 4px 12px rgba(242, 169, 0, 0.25);
          color: #F2A900;
        }
        .rr-full-ranking-container {
          background: linear-gradient(145deg, #FFF8ED 0%, #FFF0D6 100%);
          border-radius: 20px;
          padding: 16px;
          max-height: 435px;
          overflow-y: auto;
        }
        .rr-full-ranking-container::-webkit-scrollbar {
          width: 6px;
        }
        .rr-full-ranking-container::-webkit-scrollbar-track {
          background: rgba(242, 169, 0, 0.05);
          border-radius: 3px;
        }
        .rr-full-ranking-container::-webkit-scrollbar-thumb {
          background: rgba(242, 169, 0, 0.3);
          border-radius: 3px;
        }
        .rr-full-ranking-container::-webkit-scrollbar-thumb:hover {
          background: rgba(242, 169, 0, 0.5);
        }
      `}</style>

      <div className="mx-auto max-w-sm px-5">
        {currentStoreId && currentStore ? (
          <>
            <div className="mt-6 flex items-center justify-center gap-2">
              <div className="flex flex-col items-center">
                <div className="flex h-[60px] w-[60px] items-center justify-center overflow-hidden rounded-full border border-gray-200 bg-gray-100">
                  {profile.iconUrl ? (
                    <img src={profile.iconUrl} alt={profile.name ?? "icon"} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-[10px] text-gray-500">icon</span>
                  )}
                </div>
                <p className="mt-2 text-[13px] font-semibold text-gray-900">
                  {profile.name || ""}
                </p>
              </div>

              <div className="flex flex-col items-center flex-1">
                <svg className="h-1" width="100%" viewBox="0 0 80 1" preserveAspectRatio="none">
                  <line x1="0" y1="0.5" x2="80" y2="0.5" stroke="#F2A900" strokeWidth="2" className="arrow-animate" />
                </svg>
                <span className="text-[11px] font-semibold text-[#F2A900] mt-1">入店中</span>
                <svg className="h-1" width="100%" viewBox="0 0 80 1" preserveAspectRatio="none">
                  <line x1="0" y1="0.5" x2="80" y2="0.5" stroke="transparent" strokeWidth="2" />
                </svg>
              </div>

              <div className="flex flex-col items-center">
                <div className="flex h-[60px] w-[60px] items-center justify-center overflow-hidden rounded-full border border-gray-200 bg-gray-100">
                  {currentStore.iconUrl ? (
                    <img src={currentStore.iconUrl} alt={currentStore.name} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-[10px] text-gray-500">icon</span>
                  )}
                </div>
                <p className="mt-2 text-[13px] font-semibold text-gray-900">
                  {currentStore.name || ""}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLeaveStore}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full border border-red-200 py-2 text-[13px] font-semibold text-red-600 transition hover:border-red-300 hover:text-red-700"
            >
              <FiLogOut className="text-[14px]" />
              退店する
            </button>
          </>
        ) : (
          <div className="mt-6 flex flex-col items-center text-center">
            <div className="flex h-[88px] w-[88px] items-center justify-center overflow-hidden rounded-full border border-gray-200 bg-gray-100">
              {profile.iconUrl ? (
                <img src={profile.iconUrl} alt={profile.name ?? "icon"} className="h-full w-full object-cover" />
              ) : (
                <span className="text-[12px] text-gray-500">icon</span>
              )}
            </div>
            <p className="mt-3 text-[22px] font-semibold text-gray-900">
              {profile.name || ""}
            </p>
          </div>
        )}

        {!currentStoreId && (
          <>
            <div className="mt-6">
              <p className="text-[13px] text-gray-500">入店したことのある店舗</p>
              {orderedJoinedStores.length > 0 ? (
                <div className="mt-3 flex gap-3 overflow-x-auto">
                  <button
                    type="button"
                    onClick={openJoinModal}
                    className="flex h-14 w-14 items-center justify-center rounded-full border border-gray-200 bg-white hover:bg-gray-50 transition-colors flex-shrink-0"
                    aria-label="店舗を探す"
                  >
                    <FiSearch className="text-[20px] text-[#F2A900]" />
                  </button>
                  <div className="border-l border-gray-300 h-8 self-center"></div>
                  {orderedJoinedStores.map(storeId => {
                    const store = stores[storeId]
                    const isFavorite = favoriteStores.includes(storeId)
                    return (
                      <button
                        key={storeId}
                        type="button"
                        onClick={() => store && setSelectedStore(store)}
                        className={`flex h-14 w-14 items-center justify-center rounded-full border bg-white ${
                          isFavorite ? "border-[#F4D77C]" : "border-gray-200"
                        }`}
                      >
                        {store?.iconUrl ? (
                          <img src={store.iconUrl} alt={store.name} className="h-12 w-12 rounded-full object-cover" />
                        ) : (
                          <span className="text-[12px] text-gray-500">店</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div className="mt-3 flex gap-3 items-center">
                  <button
                    type="button"
                    onClick={openJoinModal}
                    className="flex h-14 w-14 items-center justify-center rounded-full border border-gray-200 bg-white hover:bg-gray-50 transition-colors flex-shrink-0"
                    aria-label="店舗を探す"
                  >
                    <FiSearch className="text-[20px] text-[#F2A900]" />
                  </button>
                  <div className="border-l border-gray-300 h-8"></div>
                  <p className="text-[13px] text-gray-500">入店したことのある店舗がありません</p>
                </div>
              )}
            </div>

            {/* RR Rating Header - Outside Frame */}
            <div className="relative mt-6 flex items-center gap-1">
              <div className="flex items-center gap-2">
                <FiTrendingUp className="text-[16px] text-[#F2A900]" />
                <p className="text-[14px] font-semibold text-gray-900">RR Rating</p>
              </div>
              <button
                type="button"
                onClick={() => setRrRatingInfoOpen(prev => !prev)}
                className="flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 text-gray-500"
                aria-label="RR Ratingについて"
              >
                <FiHelpCircle className="text-[14px]" />
              </button>
              {rrRatingInfoOpen && (
                <div className="absolute left-0 top-9 z-50 w-[220px] rounded-xl border border-gray-200 bg-white p-3 text-[11px] text-gray-600 shadow-lg">
                  RR Rating(RRレーティング)とは、ポーカーの強さを数値化したもの。2000で上級者、3000で世界最強レベル。
                </div>
              )}
            </div>

            {/* RR Rating Frame */}
            <div className={`mt-2 rr-board relative transition-transform duration-500 min-h-[500px]`} style={{
              transformStyle: 'preserve-3d',
              transform: rrCardFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
            }}>
              {/* Front Face - Current Rate Display */}
              {!rrCardFlipped && (
              <>
              <div className="rr-rate-card">
                <p className="relative z-10 text-[12px] font-medium text-white/90">現在のレート</p>
                <p className="relative z-10 mt-2 text-[32px] font-bold text-white tracking-tight drop-shadow-sm">
                  {(rrMyEntry?.rating ?? rrRatingValue).toLocaleString()}
                </p>
              </div>

              {/* Ranking Section */}
              <div className="mt-5">
                <div className="flex items-center gap-2 mb-3">
                  <FiAward className="text-[14px] text-[#F2A900]" />
                  <p className="text-[12px] font-semibold text-gray-600">RANKING</p>
                </div>
                <div className="space-y-2">
                  {rrRankingLoading ? (
                    <p className="text-center text-[13px] text-gray-500 py-4">ロード中...</p>
                  ) : rrRanking.slice(0, 5).length > 0 ? (
                    rrRanking.slice(0, 5).map(player => {
                      let medalClass = ""
                      if (player.rank === 1) {
                        medalClass = "medal-gold"
                      } else if (player.rank === 2) {
                        medalClass = "medal-silver"
                      } else if (player.rank === 3) {
                        medalClass = "medal-bronze"
                      } else {
                        medalClass = "bg-white border border-gray-200 shadow-sm"
                      }
                      return (
                        <div
                          key={player.id}
                          className="rr-ranking-item"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`flex h-10 w-10 items-center justify-center rounded-full ${medalClass}`}>
                                {player.iconUrl ? (
                                  <img src={player.iconUrl} alt={player.name} className="h-8 w-8 rounded-full object-cover" />
                                ) : (
                                  <FiUser className="text-[14px] text-gray-600" />
                                )}
                              </div>
                              <div>
                                <p className="text-[14px] font-semibold text-gray-900">{player.name || "プレイヤー"}</p>
                                <p className="text-[11px] font-medium text-gray-500">{player.rank}位</p>
                              </div>
                            </div>
                            <p className="text-[14px] font-bold text-gray-900">{player.rating.toLocaleString()}</p>
                          </div>
                        </div>
                      )
                    })
                  ) : (
                    <p className="text-center text-[13px] text-gray-500">プレイヤーがいません</p>
                  )}
                </div>
              </div>

              {/* Divider */}
              <div className="mt-5 mb-4 relative">
                <div className="rr-divider" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-3" style={{ backgroundColor: 'inherit' }}>
                  <p className="text-[11px] font-semibold text-gray-400">あなた</p>
                </div>
              </div>

              {/* Your Entry */}
              <div className="rr-my-entry">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white border-2 border-[#F2A900] shadow-sm">
                      {profile.iconUrl ? (
                        <img src={profile.iconUrl} alt={profile.name} className="h-8 w-8 rounded-full object-cover" />
                      ) : (
                        <FiUser className="text-[14px] text-[#F2A900]" />
                      )}
                    </div>
                    <div>
                      <p className="text-[14px] font-semibold text-gray-900">{profile.name || "あなた"}</p>
                      <p className="text-[11px] font-medium text-[#D4910A]">{rrMyEntry?.rank ?? "-"}位</p>
                    </div>
                  </div>
                  <p className="text-[14px] font-bold text-gray-900">
                    {(rrMyEntry?.rating ?? rrRatingValue).toLocaleString()}
                  </p>
                </div>
              </div>
              </>
              )}

              {/* Back Face - Full Ranking Display */}
              {rrCardFlipped && (
              <div style={{ transform: 'rotateY(180deg)' }}>
                {rrRankingLoading ? (
                  <div className="flex items-center justify-center" style={{ minHeight: '468px' }}>
                    <p className="text-center text-[13px] text-gray-500">ロード中...</p>
                  </div>
                ) : rrBackFaceVisible ? (
                  <>
                    <div className="flex items-center gap-2 mb-3">
                      <FiAward className="text-[14px] text-[#F2A900]" />
                      <p className="text-[12px] font-semibold text-gray-600">TOP 100 RANKING</p>
                    </div>
                    <div className="rr-full-ranking-container space-y-2">
                      {rrFullRanking.slice(0, 100).length > 0 ? (
                        rrFullRanking.slice(0, 100).map(player => {
                          let medalClass = ""
                          if (player.rank === 1) {
                            medalClass = "medal-gold"
                          } else if (player.rank === 2) {
                            medalClass = "medal-silver"
                          } else if (player.rank === 3) {
                            medalClass = "medal-bronze"
                          } else {
                            medalClass = "bg-white border border-gray-200 shadow-sm"
                          }
                          return (
                            <div
                              key={player.id}
                              className="rr-ranking-item"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className={`flex h-10 w-10 items-center justify-center rounded-full ${medalClass}`}>
                                    {player.iconUrl ? (
                                      <img src={player.iconUrl} alt={player.name} className="h-8 w-8 rounded-full object-cover" />
                                    ) : (
                                      <FiUser className="text-[14px] text-gray-600" />
                                    )}
                                  </div>
                                  <div>
                                    <p className="text-[14px] font-semibold text-gray-900">{player.name || "プレイヤー"}</p>
                                    <p className="text-[11px] font-medium text-gray-500">{player.rank}位</p>
                                  </div>
                                </div>
                                <p className="text-[14px] font-bold text-gray-900">{player.rating.toLocaleString()}</p>
                              </div>
                            </div>
                          )
                        })
                      ) : (
                        <p className="text-center text-[13px] text-gray-500 py-4">ランキングデータを読み込み中...</p>
                      )}
                    </div>
                  </>
                ) : null}
              </div>
              )}
            </div>

            {/* Flip Card / "もっと見る" Button - Outside Frame */}
            <button
              type="button"
              onClick={() => {
                if (rrCardFlipped) {
                  // 戻る: 裏面を非表示にしてからカードをフリップ
                  setRrBackFaceVisible(false)
                  setRrCardFlipped(false)
                } else {
                  // もっと見る: カードをフリップしてから裏面を表示
                  setRrCardFlipped(true)
                  if (rrFullRanking.length === 0) {
                    setRrFullRanking(rrRanking)
                  }
                  // アニメーション完了後に裏面を表示
                  setTimeout(() => {
                    setRrBackFaceVisible(true)
                  }, 500)
                }
              }}
              className="mt-4 w-full rr-more-btn text-[14px]"
            >
              {rrCardFlipped ? '戻る' : 'もっと見る'}
            </button>
          </>
        )}

        {currentStoreId && currentStore && (
          <>
            <div className="mt-6">
              <div className={`bank-card ${isHistoryFlipped ? "is-flipped" : ""}`}> 
                <div className="bank-card-inner">
                  <div className="bank-card-face bank-card-front">
                    <div className="relative z-10">
                      <div className="flex items-center gap-2 text-white/80">
                        <FiCreditCard className="text-[16px]" />
                        <span className="text-[12px] tracking-[0.25em]">BANK ROLL</span>
                      </div>
                      <p className="mt-2 text-[13px] text-white/70">
                        {currentStore.name}
                        {typeof currentStore.ringBlindSb === "number" && typeof currentStore.ringBlindBb === "number" && (
                          <span className="ml-2 text-[11px] text-white/50">(レート: {currentStore.ringBlindSb} - {currentStore.ringBlindBb})</span>
                        )}
                      </p>
                      <button
                        type="button"
                        onClick={() => setIsHistoryFlipped(true)}
                        className="absolute top-0 right-0 mt-1 mr-1 inline-flex items-center gap-1 rounded-full border border-white/30 px-3 py-1 text-[11px] text-white/80 hover:border-white/50 hover:text-white bg-black/30"
                        style={{ zIndex: 20 }}
                      >
                        <FiClock className="text-[12px]" />
                        履歴
                      </button>
                    </div>
                    <div className="relative z-10 mt-6 text-center">
                      <div className="mb-1 flex justify-center">
                        <span
                          className="text-[10px] px-2 py-0.5 rounded bg-white/10 text-white/60 cursor-pointer select-none"
                          style={{ fontSize: '10px', letterSpacing: '0.05em' }}
                        >
                          タップで{showBB ? 'チップ' : 'BB'}表記に変更！
                        </span>
                      </div>
                      <div className="ticker text-[30px] font-semibold text-white cursor-pointer select-none" onClick={() => setShowBB(v => !v)}>
                        <span key={balance} className="ticker-animate">
                          {formatChipValue(displayBalance)}
                        </span>
                      </div>
                      {displayNetGain !== 0 && (
                        <div
                          className={`ticker mt-2 text-[15px] font-semibold ${
                            displayNetGain > 0 ? "text-emerald-200" : "text-rose-200"
                          } cursor-pointer select-none`}
                          onClick={() => setShowBB(v => !v)}
                        >
                          <span key={netGain} className="ticker-animate">
                            {formatSignedChipValue(displayNetGain)}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="relative z-10 mt-6 flex items-center justify-end text-[11px] text-white/80">
                      {/* RRPoker表記削除 */}
                    </div>
                  </div>
                  <div className="bank-card-face bank-card-back">
                    <div className="flex items-center justify-between text-white/80">
                      <p className="text-[12px] font-semibold tracking-[0.2em]">HISTORY</p>
                      <button
                        type="button"
                        onClick={() => setIsHistoryFlipped(false)}
                        className="flex items-center gap-1 text-[11px] text-white/80 hover:text-white"
                      >
                        <FiArrowLeft className="text-[12px]" />
                        戻る
                      </button>
                    </div>
                    <div className="bank-card-history mt-3 space-y-2">
                      {sortedHistoryItems.length === 0 ? (
                        <p className="text-center text-[12px] text-white/60">履歴がありません</p>
                      ) : (
                        sortedHistoryItems.map(item => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between rounded-xl border border-white/10 px-3 py-2"
                          >
                            <div>
                              <p className="text-[11px] text-white/70">{getHistoryLabel(item.type)}</p>
                              <p className="text-[10px] text-white/50">{formatDateTime(item.createdAt?.seconds)}</p>
                            </div>
                            <p className="text-[12px] font-semibold text-white">{getHistoryAmount(item)}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-[24px] border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FiTrendingUp className="text-[16px] text-[#F2A900]" />
                  <p className="text-[14px] font-semibold text-gray-900">RANKING</p>
                </div>
                {ranking.length > 3 && (
                  <button
                    type="button"
                    onClick={() => setIsDetailedRankingModalOpen(true)}
                    className="text-[12px] font-semibold text-[#F2A900]"
                  >
                    もっと見る
                  </button>
                )}
              </div>
              
              {userRank && (
                <div className="mt-3 rounded-lg bg-blue-50 p-3 border border-blue-200">
                  <div className="text-[12px] text-gray-600">
                    <p className="font-semibold text-blue-600">あなたのランク: {userRank.rank}位</p>
                    <p className="mt-1">純増: <span className="font-semibold text-gray-900">{formatSignedChipValue(userRank.netGain)}</span></p>
                  </div>
                </div>
              )}

              <div className="mt-3 space-y-2">
                {rankingLoading ? (
                  <p className="text-center text-[13px] text-gray-500">ロード中...</p>
                ) : ranking.slice(0, 3).length > 0 ? (
                  ranking.slice(0, 3).map((player, index) => (
                    <div key={player.id} className="flex items-center justify-between text-[13px]">
                      <div className="flex items-center gap-2">
                        <span className="w-5 text-gray-600 font-semibold">{index + 1}位</span>
                        <span className="text-gray-700">{player.name || "プレイヤー"}</span>
                      </div>
                      <span className="font-semibold text-gray-900">{formatSignedChipValue(player.netGain)}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-[13px] text-gray-500">プレイヤーがいません</p>
                )}
              </div>
            </div>

          </>
        )}
      </div>

      {isJoinModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-5">
          <div className="w-full max-w-sm rounded-[24px] bg-white p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-[16px] font-semibold text-gray-900">店舗検索</h2>
              <button type="button" onClick={() => setIsJoinModalOpen(false)} className="text-gray-500">
                <FiX />
              </button>
            </div>
            <div className="mt-4 flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={e => {
                  const value = e.target.value
                  setSearchQuery(value)
                  if (value.trim() && !allStores.length) {
                    void loadAllStores()
                  }
                }}
                placeholder="店舗コード or 店舗名"
                className="h-12 flex-1 rounded-2xl border border-gray-200 bg-gray-50 px-4 text-[16px] text-gray-900 outline-none placeholder:text-gray-400 focus:border-gray-300"
              />
              <button
                type="button"
                onClick={handleSearch}
                className="flex h-12 w-12 items-center justify-center rounded-2xl border border-gray-200 text-gray-700"
                aria-label="検索"
              >
                <FiSearch />
              </button>
            </div>
            {suggestions.length > 0 && (
              <div className="mt-3 rounded-2xl border border-gray-200 bg-white p-2">
                {suggestions.map(store => (
                  <button
                    key={store.id}
                    type="button"
                    onClick={() => {
                      setSelectedStore(store)
                      setIsJoinModalOpen(false)
                    }}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-[13px] text-gray-700 hover:bg-gray-50"
                  >
                    <span className="font-semibold text-gray-900">{store.name}</span>
                    <span className="text-[11px] text-gray-400">{store.id}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {selectedStore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-5">
          <div className="w-full max-w-sm rounded-[24px] bg-white p-5">
            <div className="relative flex min-h-[32px] items-center justify-center">
              <button
                type="button"
                onClick={() => setSelectedStore(null)}
                className="absolute left-0 top-0 text-gray-500"
                aria-label="閉じる"
              >
                <FiX />
              </button>
              <button
                type="button"
                onClick={() => toggleFavoriteStore(selectedStore.id)}
                className={`absolute right-0 top-0 flex h-9 w-9 items-center justify-center rounded-full border ${
                  favoriteStores.includes(selectedStore.id)
                    ? "border-[#F4D77C] text-[#F4D77C]"
                    : "border-gray-200 text-gray-400"
                } ${favoritePulse === selectedStore.id ? "favorite-sparkle-strong" : ""}`}
                aria-label="お気に入り"
              >
                <FiStar className="text-[16px]" />
              </button>
              <h2 className="text-[16px] font-semibold text-gray-900">店舗詳細</h2>
            </div>
            {favoriteMessage && (
              <p className="mt-2 text-center text-[12px] font-semibold text-[#F4D77C]">
                {favoriteMessage}
              </p>
            )}
            <div className="mt-4 flex items-center gap-3">
              {selectedStore.iconUrl ? (
                <img
                  src={selectedStore.iconUrl}
                  alt={selectedStore.name}
                  className="h-12 w-12 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-gray-200 text-[12px] text-gray-500">
                  店舗
                </div>
              )}
              <div>
                <p className="text-[15px] font-semibold text-gray-900">{selectedStore.name}</p>
                <p className="text-[12px] text-gray-500">{selectedStore.address}</p>
              </div>
            </div>
            <p className="mt-3 text-[12px] text-gray-600">
              {selectedStore.description || "店舗の説明はまだありません"}
            </p>

            <div className="mt-5 space-y-2">
              <button
                type="button"
                onClick={() => joinStore(selectedStore.id)}
                className="h-[48px] w-full rounded-[20px] bg-[#F2A900] text-[14px] font-semibold text-gray-900"
              >
                入店する
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedStore(null)
                  void openPlayersPreview(selectedStore)
                }}
                className="h-[48px] w-full rounded-[20px] border border-gray-200 text-[14px] font-semibold text-gray-800"
              >
                現在入店中のプレイヤーを見る
              </button>
              <button
                type="button"
                className="h-[48px] w-full rounded-[20px] border border-gray-200 text-[14px] font-semibold text-gray-400"
              >
                DMを送る
              </button>
            </div>
          </div>
        </div>
      )}

      {isPlayersModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-5">
          <div className="w-full max-w-sm rounded-[24px] bg-white p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-[16px] font-semibold text-gray-900">入店中プレイヤー</h2>
              <button
                type="button"
                onClick={() => setIsPlayersModalOpen(false)}
                className="text-gray-500"
              >
                <FiX />
              </button>
            </div>
            {playersPreviewStore && (
              <p className="mt-2 text-[12px] text-gray-500">{playersPreviewStore.name}</p>
            )}

            <div className="mt-4 space-y-3">
              {playersPreviewLoading ? (
                <p className="text-center text-[13px] text-gray-500">読み込み中...</p>
              ) : playersPreview.length === 0 ? (
                <p className="text-center text-[13px] text-gray-500">入店中のプレイヤーがいません</p>
              ) : (
                playersPreview.map(player => (
                  <div key={player.id} className="flex items-center gap-3 rounded-[20px] border border-gray-200 p-3">
                    {player.iconUrl ? (
                      <img src={player.iconUrl} alt={player.name} className="h-10 w-10 rounded-full object-cover" />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-[12px] text-gray-500">
                        人
                      </div>
                    )}
                    <p className="text-[14px] font-semibold text-gray-900">{player.name ?? player.id}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {isDetailedRankingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-5">
          <div className="mx-auto w-full max-w-sm rounded-[24px] bg-white p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-[16px] font-semibold text-gray-900">チップ純増ランキング（上位50）</h2>
              <button type="button" onClick={() => setIsDetailedRankingModalOpen(false)} className="text-gray-500">
                <FiX />
              </button>
            </div>

            <div className="mt-4 space-y-2">
              {ranking.slice(0, 50).map((player, index) => (
                <div key={player.id} className="flex items-center justify-between rounded-2xl border border-gray-200 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="w-8 text-[12px] text-gray-500 font-semibold text-right">{index + 1}位</span>
                    <span className="text-[13px] text-gray-800">{player.name || "プレイヤー"}</span>
                  </div>
                  <span className="text-[12px] font-semibold text-gray-900">{formatSignedChipValue(player.netGain)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {isRankingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-5">
          <div className="w-full max-w-sm rounded-[24px] bg-white p-5 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-[16px] font-semibold text-gray-900">RR Rating Ranking（上位100）</h2>
              <button type="button" onClick={() => setIsRankingModalOpen(false)} className="text-gray-500">
                <FiX />
              </button>
            </div>
            <p className="mt-2 text-[12px] text-gray-500">
              RR Rating（RR レーティング）はポーカーの強さを数値化したもの。2000で上級者、3000で世界最強レベル。
            </p>
            <div className="mt-4 space-y-2">
              {rrRanking.slice(0, 100).map(player => (
                <div key={player.id} className="flex items-center justify-between rounded-2xl border border-gray-200 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="w-8 text-[12px] text-gray-500 font-semibold text-right">{player.rank}位</span>
                    <div className="flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 bg-white">
                      {player.iconUrl ? (
                        <img src={player.iconUrl} alt={player.name} className="h-6 w-6 rounded-full object-cover" />
                      ) : (
                        <FiUser className="text-[12px] text-gray-400" />
                      )}
                    </div>
                    <span className="text-[13px] text-gray-800">{player.name || "プレイヤー"}</span>
                  </div>
                  <span className="text-[12px] font-semibold text-gray-900">{player.rating.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-[80] border-t border-gray-200 bg-white">
        <div className="relative mx-auto flex max-w-sm items-center justify-between px-8 py-3">
          <button
            type="button"
            onClick={() => router.push("/home")}
            className="flex flex-col items-center text-[#111]"
          >
            <FiHome className="text-[18px]" />
            <span className="mt-1 text-[11px]">ホーム</span>
          </button>
          <button
            type="button"
            onClick={() => router.push("/home/transactions")}
            className="absolute left-1/2 top-0 flex h-[74px] w-[74px] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full bg-[#F2A900] text-gray-900 shadow-lg"
            aria-label="入出金"
          >
            <FiCreditCard className="text-[22px]" />
            <span className="mt-1 text-[10px] font-semibold">入出金</span>
          </button>
          <button
            type="button"
            onClick={() => router.push("/home/mypage")}
            className="flex flex-col items-center text-gray-400"
          >
            <FiUser className="text-[18px]" />
            <span className="mt-1 text-[11px]">マイページ</span>
          </button>
        </div>
      </nav>
    </main>
  )
}