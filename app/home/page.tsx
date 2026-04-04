          "use client"

          import { useEffect, useMemo, useRef, useState, type MutableRefObject, type Dispatch, type SetStateAction } from "react"
          import { auth, db } from "@/lib/firebase"
          import { arrayRemove, arrayUnion, collection, deleteField, doc, getDoc, getDocs, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where } from "firebase/firestore"
          import { FiHome, FiCreditCard, FiUser, FiX, FiSearch, FiStar, FiTrendingUp, FiLogOut, FiArrowLeft, FiClock, FiHelpCircle, FiAward, FiEdit2, FiBarChart2 } from "react-icons/fi"
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
            roi: number
            rrRating: number
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
            const [showBB, setShowBB] = useState(false)
            const balanceRef = useRef(0)
            const netGainRef = useRef(0)
            const [role, setRole] = useState<string | null>(null)
            const [checkinStatus, setCheckinStatus] = useState<"none" | "pending" | "approved">("none")
            const [pendingStoreId, setPendingStoreId] = useState<string | null>(null)
            const [isPendingModalOpen, setIsPendingModalOpen] = useState(false)

            useEffect(() => {
              const unsub = auth.onAuthStateChanged(user => {
                setUserId(user?.uid ?? null)
              })
              return () => unsub()
            }, [])


            useEffect(() => {
              if (!userId) return

              const ref = doc(db, "users", userId)

              const unsub = onSnapshot(ref, async (snap) => {
                const data = snap.data()

                const userRole = data?.role ?? null
                setRole(userRole)

                if (userRole === "store") {
                  router.replace("/home/store")
                  return
                }

                const status = data?.checkinStatus ?? "approved"

                if (!data?.checkinStatus) {
                  await updateDoc(ref, { checkinStatus: "approved" })
                }

                setCheckinStatus(status)
                setPendingStoreId(data?.pendingStoreId ?? null)

                if (status === "approved") {
                  setCurrentStoreId(data?.currentStoreId ?? null)
                  setIsPendingModalOpen(false)
                }

                if (status === "pending") {
                  setIsPendingModalOpen(true)
                }

                if (status === "none") {
                  setIsPendingModalOpen(false)
                  setCurrentStoreId(null)
                }

                setJoinedStores(Array.isArray(data?.joinedStores) ? data.joinedStores : [])
                setFavoriteStores(Array.isArray(data?.favoriteStores) ? data.favoriteStores : [])
                setProfile({ name: data?.name, iconUrl: data?.iconUrl })

                const rating = typeof data?.rrRating === "number" ? data.rrRating : 1000
                setRrRatingValue(rating)

                if (typeof data?.rrRating !== "number") {
                  await updateDoc(ref, { rrRating: 1000 })
                }
              })

              return () => unsub()
            }, [userId, router])
      

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
              
          const balanceDocRef = doc(db, "users", userId, "storeBalances", currentStoreId)
          const unsub = onSnapshot(balanceDocRef, snap => {
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
              const fetchHistoryData = async () => {
                if (!userId) {
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

                  const tournamentSnap = await getDocs(
                    collection(db, "users", userId, "tournamentHistory")
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

          tournamentSnap.forEach(docSnap => {
            const data = docSnap.data()

            next.push({
              id: docSnap.id,
              type: "tournament",
              ...data,
              amount: data.prize ?? 0,
              createdAt: data.startedAt
            })
          })
                
          next.sort((a, b) =>
            (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0)
          )

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



          const tournamentItems = useMemo(() => {
            return sortedHistoryItems.filter(item => item.type === "tournament")
          }, [sortedHistoryItems])


          const tournamentStats = useMemo(() => {

            let totalCost = 0
            let totalReward = 0
            let plays = 0
            let itm = 0

            tournamentItems.forEach(item => {

              const entryCount = item.entryCount ?? 0
              const reentryCount = item.reentryCount ?? 0
              const addonCount = item.addonCount ?? 0

              const entryFee = item.entryFee ?? 0
              const reentryFee = item.reentryFee ?? 0
              const addonFee = item.addonFee ?? 0

              const prize = item.prize ?? 0
              const rank = item.rank ?? "-"

              const buyin =
                (entryCount * entryFee) +
                (reentryCount * reentryFee) +
                (addonCount * addonFee)

              let baseFee = 0

              if (entryFee > 0) {
                baseFee = entryFee
              } else if (reentryFee > 0) {
                baseFee = reentryFee
              } else {
                baseFee = addonFee
              }

              const cost = baseFee > 0 ? buyin / baseFee : 0
              const reward = baseFee > 0 ? prize / baseFee : 0

              totalCost += cost
              totalReward += reward

              plays += entryCount + reentryCount

              if (rank !== "-" && prize > 0) {
                itm += 1
              }

            })

            let roi: string | number = "集計中"

            if (totalCost > 0) {
              roi = ((totalReward / totalCost) * 100).toFixed(2)
            }

            let itmRate = "0.00"

            if (plays > 0) {
              itmRate = ((itm / plays) * 100).toFixed(2)
            }

            return {
              totalCost,
              totalReward,
              roi,
              plays,
              itmRate
            }

          }, [tournamentItems])

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
                case "tournament":
                  return "トーナメント賞金"
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

                const snap = await getDocs(collection(db, "rrLeaderboard"))

                const list: RRPlayer[] = []

  const promises = snap.docs.map(async (docSnap) => {

    const data = docSnap.data()
    const playerId = data.userId
    const roi = data.roi ?? 0
    const rrRating = data.rrRating ?? 0

    const userSnap = await getDoc(doc(db, "users", playerId))
    const user = userSnap.data()

    return {
      id: playerId,
      name: user?.name,
      iconUrl: user?.iconUrl,
      roi: roi,
      rrRating: rrRating,
      rank: 0
    }
  })

  const results = await Promise.all(promises)

  list.push(...results)

                list.sort((a,b)=>b.rrRating-a.rrRating)

                let currentRank = 0
                let lastRating: number | null = null

                const hasValidRating = list.some(p => p.rrRating > 0)

    if (!hasValidRating) {
      setRrRanking([])
      setRrFullRanking([])
      setRrMyEntry(null)
      setRrRankingLoading(false)
      return
    }

    const ranked = list.map((p,i)=>{

      if(lastRating === null || p.rrRating !== lastRating){
        currentRank = i+1
        lastRating = p.rrRating
      }

      return {...p, rank:currentRank}
    })

                setRrRanking(ranked)
                setRrFullRanking(ranked)
                setRrMyEntry(ranked.find(p=>p.id===userId) ?? null)

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

        if (checkinStatus === "pending") {
          setIsPendingModalOpen(true)
          return
        }

        const storeSnap = await getDoc(doc(db, "stores", storeId))
        const storeData = storeSnap.data()
        const isApprovalRequired = storeData?.isApprovalRequired ?? true

        const userRef = doc(db, "users", userId)

        if (isApprovalRequired) {
          await updateDoc(userRef, {
            checkinStatus: "pending",
            pendingStoreId: storeId,
            currentStoreId: null,
            joinedStores: arrayUnion(storeId),
          })

          setIsPendingModalOpen(true)
          return
        }

        await updateDoc(userRef, {
          checkinStatus: "approved",
          currentStoreId: storeId,
          pendingStoreId: null,
          joinedStores: arrayUnion(storeId),
        })

        const balanceRef = doc(db, "users", userId, "storeBalances", storeId)
        const balanceSnap = await getDoc(balanceRef)

        if (!balanceSnap.exists()) {
          await setDoc(balanceRef, {
            balance: 0,
            netGain: 0,
            lastVisitedAt: serverTimestamp(),
            storeId,
          })
        }

        setCurrentStoreId(storeId)
      }

            const loadAllStores = async () => {
              if (allStores.length) return allStores
              const snap = await getDocs(collection(db, "stores"))
              const list: StoreInfo[] = []
              snap.forEach(docSnap => {
                const data = docSnap.data()
                const roi = typeof data?.roi === "number" ? data.roi : 0
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

            const openPlayersPreview = async (storeId: string) => {
              try {
                console.log("QUERY storeId:", storeId)

                const q = query(
                  collection(db, "users"),
                  where("currentStoreId", "==", storeId)
                )

                const snap = await getDocs(q)

                console.log("SNAP SIZE:", snap.size)

                if (snap.empty) {
                  console.warn("No players found for storeId:", storeId)
                }

                const list: StorePlayer[] = []

                snap.forEach(docSnap => {
                  const data = docSnap.data()

                  if (typeof data.currentStoreId === "string") {
                    list.push({
                      id: docSnap.id,
                      name: data.name,
                      iconUrl: data.iconUrl,
                    })
                  }
                })

                console.log("playersPreview:", list)

                setPlayersPreview(list)
              } catch (error) {
                console.error("playersPreview error:", error)
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
              <main className="min-h-screen bg-[#FFFBF5] pb-32">
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
                  .profile-card {
                    background: linear-gradient(145deg, #ffffff 0%, #fefefe 100%);
                    box-shadow: 
                      0 2px 8px rgba(242, 169, 0, 0.06),
                      0 8px 24px rgba(0, 0, 0, 0.04);
                  }
                  .store-badge {
                    background: linear-gradient(145deg, rgba(242, 169, 0, 0.08) 0%, rgba(242, 169, 0, 0.03) 100%);
                    border: 1.5px solid rgba(242, 169, 0, 0.2);
                  }
                  .rr-board {
                    position: relative;
                    background: linear-gradient(145deg, #FFFBF5 0%, #FFF8ED 100%);
                    border: 1px solid rgba(242, 169, 0, 0.15);
                    border-radius: 28px;
                    padding: 24px;
                    box-shadow: 0 2px 8px rgba(242, 169, 0, 0.08), 0 12px 32px rgba(242, 169, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.9);
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
                  .rr-my-entry {
                    background: linear-gradient(135deg, #FFFBF5 0%, #FFF4E0 100%);
                    border: 1.5px solid rgba(242, 169, 0, 0.3);
                    border-radius: 16px;
                    padding: 14px 16px;
                    box-shadow: 0 2px 8px rgba(242, 169, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.9);
                  }
                  .bank-card {
                    perspective: 1200px;
                  }
                  .bank-card-inner {
                    position: relative;
                    height: 220px;
                    transform: rotateY(0deg);
                    -webkit-transform: rotateY(0deg);
                    transform-style: preserve-3d;
                    -webkit-transform-style: preserve-3d;
                    transition: transform 0.8s cubic-bezier(0.3, 0.7, 0.2, 1);
                    will-change: transform;
                  }
                  .bank-card.is-flipped .bank-card-inner {
                    transform: rotateY(180deg);
                    -webkit-transform: rotateY(180deg);
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
                    -webkit-backface-visibility: hidden;
                    border-radius: 24px;
                    padding: 20px;
                    overflow: hidden;
                    transform: rotateY(0deg) translateZ(0);
                    -webkit-transform: rotateY(0deg) translateZ(0);
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
                    transform: rotateY(180deg) translateZ(0);
                    -webkit-transform: rotateY(180deg) translateZ(0);
                  }
                  .bank-card-history {
                    max-height: 130px;
                    overflow-y: auto;
                    padding-right: 2px;
                  }
                  .ticker {
                    font-variant-numeric: tabular-nums;
                    letter-spacing: 0.02em;
                  }
                  .ticker-animate {
                    display: inline-block;
                    animation: tickerPulse 0.6s ease;
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
                  .glass-card {
                    background: rgba(255, 255, 255, 0.7);
                    backdrop-filter: blur(20px);
                    -webkit-backdrop-filter: blur(20px);
                  }
                  .modal-overlay {
                    background: rgba(0, 0, 0, 0.3);
                    backdrop-filter: blur(4px);
                    -webkit-backdrop-filter: blur(4px);
                  }
                `}</style>
                
                <HomeHeader
                  homePath="/home"
                  myPagePath="/home/mypage"
                  showNotifications
                  menuItems={getCommonMenuItems(router, 'user')}
                />

                <div className="mx-auto max-w-sm px-4">
                  {currentStoreId && currentStore ? (
                    <>
                      <div className="mt-6 profile-card rounded-3xl p-6 animate-slideUp">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border-2 border-[#F2A900] bg-white shadow-md">
                              {profile.iconUrl ? (
                                <img src={profile.iconUrl} alt={profile.name ?? "icon"} className="h-full w-full object-cover" />
                              ) : (
                                <FiUser className="text-[20px] text-gray-400" />
                              )}
                            </div>
                            <div>
                              <p className="text-[15px] font-semibold text-gray-900">{profile.name || ""}</p>
                              <div className="flex items-center gap-1 mt-0.5">
                                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
                                <span className="text-[12px] text-green-600 font-medium">入店中</span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <div className="h-10 w-10 rounded-full bg-[#F2A900]/10 flex items-center justify-center">
                              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                <path d="M2 8h12M8 2l6 6-6 6" stroke="#F2A900" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </div>
                            <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border border-gray-200 bg-white">
                              {currentStore.iconUrl ? (
                                <img src={currentStore.iconUrl} alt={currentStore.name} className="h-full w-full object-cover" />
                              ) : (
                                <span className="text-[10px] text-gray-400">店舗</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="store-badge rounded-2xl p-3 text-center">
                          <p className="text-[13px] font-semibold text-gray-700">{currentStore.name || ""}</p>
                          {typeof currentStore.ringBlindSb === "number" && typeof currentStore.ringBlindBb === "number" && (
                            <p className="text-[11px] text-gray-500 mt-1">
                              レート: {currentStore.ringBlindSb}/{currentStore.ringBlindBb}
                            </p>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleLeaveStore}
                        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-red-200 py-3 text-[14px] font-medium text-red-600 transition-all hover:bg-red-50 active:scale-98"
                      >
                        <FiLogOut className="text-[16px]" />
                        退店する
                      </button>
                    </>
                  ) : (
                    <div className="mt-6 profile-card rounded-3xl p-6 text-center animate-slideUp">
                      <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-2 border-[#F2A900] bg-white mx-auto shadow-md">
                        {profile.iconUrl ? (
                          <img src={profile.iconUrl} alt={profile.name ?? "icon"} className="h-full w-full object-cover" />
                        ) : (
                          <FiUser className="text-[28px] text-gray-400" />
                        )}
                      </div>
                      <p className="mt-4 text-[20px] font-semibold text-gray-900">
                        {profile.name || ""}
                      </p>
                    </div>
                  )}

                  {/* Tournament Section */}
                  {!currentStoreId && (
                    <>
                      <div className="mt-6">
                        <p className="text-[14px] font-medium text-gray-600 mb-3">入店したことのある店舗</p>
                        {orderedJoinedStores.length > 0 ? (
                          <div className="flex gap-3 overflow-x-auto pb-2">
                            <button
                              type="button"
                              onClick={openJoinModal}
                              className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#F2A900] to-[#D4910A] hover:from-[#D4910A] hover:to-[#C48509] text-white transition-all shadow-md flex-shrink-0 active:scale-95"
                              aria-label="店舗を探す"
                            >
                              <FiSearch size={20} />
                            </button>
                            <div className="border-l border-gray-200 h-10 self-center"></div>
                            {orderedJoinedStores.map(storeId => {
                              const store = stores[storeId]
                              const isFavorite = favoriteStores.includes(storeId)
                              return (
                                <button
                                  key={storeId}
                                  type="button"
                                  onClick={() => store && setSelectedStore(store)}
                                  className={`flex h-14 w-14 items-center justify-center rounded-full border-2 bg-white shadow-sm transition-all active:scale-95 ${
                                    isFavorite ? "border-[#F2A900]" : "border-gray-200"
                                  }`}
                                >
                                  {store?.iconUrl ? (
                                    <img src={store.iconUrl} alt={store.name} className="h-12 w-12 rounded-full object-cover" />
                                  ) : (
                                    <span className="text-[12px] text-gray-400">店</span>
                                  )}
                                </button>
                              )
                            })}
                          </div>
                        ) : (
                          <div className="flex gap-3 items-center">
                            <button
                              type="button"
                              onClick={openJoinModal}
                              className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#F2A900] to-[#D4910A] hover:from-[#D4910A] hover:to-[#C48509] text-white transition-all shadow-md flex-shrink-0 active:scale-95"
                              aria-label="店舗を探す"
                            >
                              <FiSearch size={20} />
                            </button>
                            <div className="border-l border-gray-200 h-10"></div>
                            <p className="text-[13px] text-gray-500">入店したことのある店舗がありません</p>
                          </div>
                        )}
                      </div>

                      {/* RR Rating Section */}
                      <div className="relative mt-6 flex items-center gap-2">
                        <div className="flex items-center gap-2">
                          <FiTrendingUp className="text-[18px] text-[#F2A900]" />
                          <p className="text-[16px] font-semibold text-gray-900">RR Rating(トナメ偏差値)</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setRrRatingInfoOpen(prev => !prev)}
                          className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
                          aria-label="トナメ偏差値について"
                        >
                          <FiHelpCircle size={14} />
                        </button>
                        {rrRatingInfoOpen && (
                          <div className="absolute left-0 top-10 z-50 w-[240px] rounded-2xl border border-gray-200 bg-white p-4 text-[12px] text-gray-600 shadow-xl animate-slideUp">
                            トナメ偏差値とは、あなたのROIとインマネ率から、トーナメントの実力を偏差値で表したもの。上振れによってランキングが荒れないように、参加数が少ないうちは偏差値が変動しずらい設定になっているけど、トーナメントに参加すればするほど自分の実力に近い偏差値が表示されるようになるよ。偏差値を上げて、トーナメントで勝ちまくろう！
                          </div>
                        )}
                      </div>

                      {/* RR Rating Card */}
                      <div className={`mt-3 rr-board relative transition-all duration-500 min-h-[500px]`} style={{
                        transformStyle: 'preserve-3d',
                        transform: rrCardFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
                      }}>
                        {/* Front Face */}
                        {!rrCardFlipped && (
                        <>
                        <div className="rr-rate-card">
                          <p className="relative z-10 text-[12px] font-medium text-white/90">現在のあなたのトナメ偏差値 :</p>


                          <p className="relative z-10 mt-2 text-[36px] font-bold text-white tracking-tight drop-shadow-sm">
            {(rrMyEntry?.rrRating ?? 0).toFixed(2)}
          </p>


                        </div>

                        {/* Ranking Section */}
                        <div className="mt-5">
                          <div className="flex items-center gap-2 mb-3">
                            <FiAward className="text-[16px] text-[#F2A900]" />
                            <p className="text-[13px] font-semibold text-gray-600">RANKING</p>
                          </div>
                          <div className="space-y-2">

      {rrRankingLoading ? (
        <p className="text-center text-[13px] text-gray-500 py-4">ロード中...</p>
      ) : rrRanking.length === 0 ? (
        <p className="text-center text-[13px] text-gray-500">
          まだランキングデータがありません
        </p>
      ) : (
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
            <div key={player.id} className="rr-ranking-item">
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
                <p className="text-[15px] font-bold text-gray-900">{player.rrRating.toFixed(2)}</p>
              </div>
            </div>
          )
        })
      )}





                          </div>
                        </div>

                        {/* Divider */}
                        <div className="mt-5 mb-4 h-px bg-gradient-to-r from-transparent via-[#F2A900]/20 to-transparent"></div>

                        {/* Your Entry */}
                        <div className="rr-my-entry">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white border-2 border-[#F2A900] shadow-sm">
                                {profile.iconUrl ? (
                                  <img src={profile.iconUrl} alt={profile.name} className="h-8 w-8 rounded-full object-cover" />
                                ) : (
                                  <FiUser className="text-[16px] text-[#F2A900]" />
                                )}
                              </div>
                              <div>
                                <p className="text-[14px] font-semibold text-gray-900">{profile.name || "あなた"}</p>
                                <p className="text-[11px] font-medium text-[#D4910A]">{rrMyEntry?.rank ?? "-"}位</p>
                              </div>
                            </div>
                            <p className="text-[15px] font-bold text-gray-900">
                              {(rrMyEntry?.rrRating ?? 0).toFixed(2)}
                            </p>
                          </div>
                        </div>
                        </>
                        )}

                        {/* Back Face */}
                        {rrCardFlipped && (
                        <div style={{ transform: 'rotateY(180deg)' }}>
                          {rrRankingLoading ? (
                            <div className="flex items-center justify-center" style={{ minHeight: '468px' }}>
                              <p className="text-center text-[13px] text-gray-500">ロード中...</p>
                            </div>
                          ) : rrBackFaceVisible ? (
                            <>
                              <div className="flex items-center gap-2 mb-3">
                                <FiAward className="text-[16px] text-[#F2A900]" />
                                <p className="text-[13px] font-semibold text-gray-600">TOP 100 RANKING</p>
                              </div>
                              <div className="max-h-[435px] overflow-y-auto space-y-2 pr-2">
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
                                          <p className="text-[15px] font-bold text-gray-900">{player.rrRating.toFixed(2)}</p>
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

                      {/* Flip Button */}
                      <button
                        type="button"
                        onClick={() => {
                          if (rrCardFlipped) {
                            setRrBackFaceVisible(false)
                            setRrCardFlipped(false)
                          } else {
                            setRrCardFlipped(true)
                            if (rrFullRanking.length === 0) {
                              setRrFullRanking(rrRanking)
                            }
                            setTimeout(() => {
                              setRrBackFaceVisible(true)
                            }, 500)
                          }
                        }}
                        className="mt-4 w-full h-12 rounded-2xl bg-white border border-[#F2A900] text-[14px] font-semibold text-[#F2A900] hover:bg-[#F2A900]/5 transition-all shadow-sm active:scale-98"
                      >
                        {rrCardFlipped ? '戻る' : 'もっと見る'}
                      </button>

                      {/* Tournament　スタッツ Section */}
                  
                                <div className="mt-6 profile-card rounded-3xl p-5 animate-slideUp">

                                  <div className="flex items-center gap-2 mb-4">
                                    <FiBarChart2 className="text-[18px] text-[#F2A900]" />
                                    <p className="text-[16px] font-semibold text-gray-900">
                                      TOURNAMENT STATS
                                    </p>
                                  </div>
                                  <div className="grid grid-cols-2 gap-3">

            <div className="rounded-2xl bg-white border border-gray-200 p-3">
              <p className="text-[11px] text-gray-500">今までかけたコスト:</p>
              <p className="text-[18px] font-semibold text-gray-900">
                {tournamentStats.totalCost}
              </p>
            </div>

            <div className="rounded-2xl bg-white border border-gray-200 p-3">
              <p className="text-[11px] text-gray-500">今までで得たリターン:</p>
              <p className="text-[18px] font-semibold text-gray-900">
                {tournamentStats.totalReward.toFixed(2)}
              </p>
            </div>

            <div className="rounded-2xl bg-[#FFF6E5] border border-[#F2A900]/30 p-3">
              <p className="text-[11px] text-gray-500">ROI:</p>
              <p className="text-[18px] font-semibold text-[#D4910A]">
                {tournamentStats.roi === "集計中"
                  ? "集計中"
                  : `${tournamentStats.roi}%`}
              </p>
            </div>

            <div className="rounded-2xl bg-[#FFF6E5] border border-[#F2A900]/30 p-3">
              <p className="text-[11px] text-gray-500">ITM (インマネ率):</p>
              <p className="text-[18px] font-semibold text-[#D4910A]">
                {tournamentStats.itmRate}%
              </p>
            </div>

            <div className="col-span-2 rounded-2xl bg-white border border-gray-200 p-3">
              <p className="text-[11px] text-gray-500">今までエントリーしたトナメの数：</p>
              <p className="text-[18px] font-semibold text-gray-900">
                {tournamentStats.plays}
              </p>
            </div>

          </div>

                                </div>
                      

                      {/* Tournament Section */}

                            <div className="mt-6 profile-card rounded-3xl p-5 animate-slideUp">

                              <div className="text-[12px] text-gray-600 flex flex-wrap gap-x-3 gap-y-1 mb-3">

                                              

                                                </div>
                              
                              
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-2">
                                <FiAward className="text-[18px] text-[#F2A900]" />
                                <p className="text-[16px] font-semibold text-gray-900">Tournaments History</p>
                              </div>

                              <button
                                onClick={()=>router.push("/home/tournaments")}
                                className="text-[13px] font-semibold text-[#F2A900]"
                              >
                                もっと見る
                              </button>
                            </div>

                              <div className="space-y-2">
                          {sortedHistoryItems
            .filter(item => item.type === "tournament")
            .slice(0, 5)
            .map(item => {

              const entryCount = item.entryCount ?? 0
              const reentryCount = item.reentryCount ?? 0
              const addonCount = item.addonCount ?? 0

              const entryFee = item.entryFee ?? 0
              const reentryFee = item.reentryFee ?? 0
              const addonFee = item.addonFee ?? 0

              const prize = item.prize ?? 0
              const rank = item.rank ?? "-"

              const buyin =
                entryCount * entryFee +
                reentryCount * reentryFee +
                addonCount * addonFee

              let baseFee = 0

              if (entryFee > 0) baseFee = entryFee
              else if (reentryFee > 0) baseFee = reentryFee
              else baseFee = addonFee

              const cost = baseFee > 0 ? buyin / baseFee : 0
              const reward = baseFee > 0 ? prize / baseFee : 0

              return (

                <div
                  key={item.id}
                  className="p-4 rounded-xl bg-gray-50 space-y-2"
                >

                  <p className="text-[13px] font-semibold text-gray-900">
                  {formatDateTime(item.startedAt?.seconds)} {item.tournamentName ?? ""} ({item.storeName ?? ""})
                  </p>

                  <div className="text-[15px] text-gray-600">

                    <p className="font-semibold">◯ Buy-in</p>

                    {entryCount > 0 && (
                      <p>Entry ：({entryFee} ×{entryCount}回)</p>
                    )}

                    {reentryCount > 0 && (
                      <p>Reentry ：({reentryFee} ×{reentryCount}回)</p>
                    )}

                    {addonCount > 0 && (
                      <p>Addon ：({addonFee} ×{addonCount}回)</p>
                    )}

                    <p className="mt-1 font-semibold">
                      合計出費 : {buyin}
                    </p>

                  </div>

                  <div className="text-[15px] text-gray-600">

                    <p className="font-semibold">◯ Prize</p>

                    {rank !== "-" ? (
                      <p>{rank}位 {prize}</p>
                    ) : (
                      <p>-</p>
                    )}

                  </div>

                  <div className="flex gap-3 text-[12px] text-gray-600">

                    <span>Cost {cost}</span>

                    <span>Reward {reward}</span>

                  </div>

                </div>

              )

          })}

                                {sortedHistoryItems.filter(item => item.type === "tournament").length === 0 && (
                                  <p className="text-center text-[13px] text-gray-500 py-4">
                                    トーナメント履歴がありません
                                  </p>
                                )}
                              </div>
                            </div>

                    </>
                  )}

                  {currentStoreId && currentStore && (
                    <>
                      {/* Bank Card */}
                      <div className="mt-6">
                        <div className={`bank-card ${isHistoryFlipped ? "is-flipped" : ""}`}> 
                          <div className="bank-card-inner">
                            <div className="bank-card-face bank-card-front">
                              <div className="relative z-10">
                                <div className="flex items-center gap-2 text-white/80">
                                  <FiCreditCard className="text-[18px]" />
                                  <span className="text-[13px] tracking-[0.25em]">BANK ROLL</span>
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
                                  className="absolute top-0 right-0 mt-1 mr-1 inline-flex items-center gap-1 rounded-full border border-white/30 px-3 py-1 text-[11px] text-white/80 hover:border-white/50 hover:text-white bg-black/30 transition-colors"
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
                                <div className="ticker text-[32px] font-semibold text-white cursor-pointer select-none" onClick={() => setShowBB(v => !v)}>
                                  <span key={balance} className="ticker-animate">
                                    {formatChipValue(displayBalance)}
                                  </span>
                                </div>
                                {displayNetGain !== 0 && (
                                  <div
                                    className={`ticker mt-2 text-[16px] font-semibold ${
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
                              </div>
                            </div>
                            <div className="bank-card-face bank-card-back">
                              <div className="flex items-center justify-between text-white/80">
                                <p className="text-[13px] font-semibold tracking-[0.2em]">HISTORY</p>
                                <button
                                  type="button"
                                  onClick={() => setIsHistoryFlipped(false)}
                                  className="flex items-center gap-1 text-[11px] text-white/80 hover:text-white transition-colors"
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
                                      className="flex items-center justify-between rounded-xl border border-white/10 px-3 py-2 bg-white/5"
                                    >
                                      <div>
                                        <p className="text-[11px] text-white/70">{getHistoryLabel(item.type)}</p>
                                        <p className="text-[10px] text-white/50">{formatDateTime(item.createdAt?.seconds)}</p>
                                      </div>
                                      <p className="text-[13px] font-semibold text-white">{getHistoryAmount(item)}</p>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Ranking Section */}
                      <div className="mt-6 profile-card rounded-3xl p-5 animate-slideUp">

                        
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <FiTrendingUp className="text-[18px] text-[#F2A900]" />
                            <p className="text-[16px] font-semibold text-gray-900">RANKING</p>
                          </div>
                          {ranking.length > 3 && (
                            <button
                              type="button"
                              onClick={() => setIsDetailedRankingModalOpen(true)}
                              className="text-[13px] font-semibold text-[#F2A900] hover:text-[#D4910A] transition-colors"
                            >
                              もっと見る
                            </button>
                          )}
                        </div>
                        
                        {userRank && (
                          <div className="mb-4 rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100 p-4 border border-blue-200">
                            <div className="text-[13px]">
                              <p className="font-semibold text-blue-700">あなたのランク: {userRank.rank}位</p>
                              <p className="mt-1 text-gray-700">純増: <span className="font-semibold text-gray-900">{formatSignedChipValue(userRank.netGain)}</span></p>
                            </div>
                          </div>
                        )}

                        <div className="space-y-2">
                          {rankingLoading ? (
                            <p className="text-center text-[13px] text-gray-500 py-4">ロード中...</p>
                          ) : ranking.slice(0, 3).length > 0 ? (
                            ranking.slice(0, 3).map((player, index) => (
                              <div key={player.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                                <div className="flex items-center gap-3">
                                  <div className={`flex h-8 w-8 items-center justify-center rounded-full font-bold text-[13px] ${
                                    index === 0 ? 'medal-gold text-white' :
                                    index === 1 ? 'medal-silver text-gray-700' :
                                    'medal-bronze text-white'
                                  }`}>
                                    {index + 1}
                                  </div>
                                  <span className="text-[14px] font-medium text-gray-700">{player.name || "プレイヤー"}</span>
                                </div>
                                <span className="text-[14px] font-bold text-gray-900">{formatSignedChipValue(player.netGain)}</span>
                              </div>
                            ))
                          ) : (
                            <p className="text-center text-[13px] text-gray-500 py-4">プレイヤーがいません</p>
                          )}
                        </div>
                      </div>

                    </>
                  )}
                </div>

                {/* Join Modal */}


                {isPendingModalOpen && (
                  <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
                    <div className="bg-white rounded-2xl p-6 w-[90%] max-w-sm text-center">
                      <p className="text-[25px] text-gray-600 mb-2">入店申請中</p>
                      <p className="text-[14px] text-gray-600 mb-4">
                        入店承認までしばらくお待ちください
                      </p>
                      <p className="text-[12px] text-gray-400 mb-6">
                        この画面を閉じると入店申請は取り下げられます
                      </p>

                      <button
                        onClick={async () => {
                          if (!userId) return
                          await updateDoc(doc(db, "users", userId), {
                            checkinStatus: "none",
                            pendingStoreId: null,
                          })
                          setIsPendingModalOpen(false)
                        }}
                        className="w-full h-11 rounded-xl bg-gray-200 text-gray-800 font-semibold"
                      >
                        戻る
                      </button>
                    </div>
                  </div>
                )}

                {isJoinModalOpen && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay px-4">
                    <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl animate-slideUp">
                      <div className="flex items-center justify-between mb-5">
                        <h2 className="text-[18px] font-semibold text-gray-900">店舗検索</h2>
                        <button type="button" onClick={() => setIsJoinModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                          <FiX size={20} />
                        </button>
                      </div>
                      <div className="flex gap-2">
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
                          className="h-12 flex-1 rounded-2xl border border-gray-200 bg-gray-50 px-4 text-[15px] text-gray-900 outline-none placeholder:text-gray-400 focus:border-[#F2A900] focus:ring-2 focus:ring-[#F2A900]/20 transition-all"
                        />
                        <button
                          type="button"
                          onClick={handleSearch}
                          className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F2A900] text-white hover:bg-[#D4910A] transition-all active:scale-95"
                          aria-label="検索"
                        >
                          <FiSearch size={18} />
                        </button>
                      </div>
                      {suggestions.length > 0 && (
                        <div className="mt-3 rounded-2xl border border-gray-200 bg-gray-50 p-2">
                          {suggestions.map(store => (
                            <button
                              key={store.id}
                              type="button"
                              onClick={() => {
                                setSelectedStore(store)
                                setIsJoinModalOpen(false)
                              }}
                              className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left hover:bg-white transition-colors"
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

                {/* Store Detail Modal */}
                {selectedStore && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay px-4">
                    <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl animate-slideUp">
                      <div className="relative flex min-h-[32px] items-center justify-center mb-5">
                        <button
                          type="button"
                          onClick={() => setSelectedStore(null)}
                          className="absolute left-0 top-0 text-gray-400 hover:text-gray-600 transition-colors"
                          aria-label="閉じる"
                        >
                          <FiX size={20} />
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleFavoriteStore(selectedStore.id)}
                          className={`absolute right-0 top-0 flex h-10 w-10 items-center justify-center rounded-full border transition-all active:scale-95 ${
                            favoriteStores.includes(selectedStore.id)
                              ? "border-[#F2A900] bg-[#F2A900]/10 text-[#F2A900]"
                              : "border-gray-200 text-gray-400 hover:border-[#F2A900] hover:text-[#F2A900]"
                          }`}
                          aria-label="お気に入り"
                        >
                          <FiStar size={18} />
                        </button>
                        <h2 className="text-[18px] font-semibold text-gray-900">店舗詳細</h2>
                      </div>
                      {favoriteMessage && (
                        <p className="mb-3 text-center text-[13px] font-semibold text-[#F2A900] animate-slideUp">
                          {favoriteMessage}
                        </p>
                      )}
                      <div className="flex items-center gap-4 mb-4">
                        {selectedStore.iconUrl ? (
                          <img
                            src={selectedStore.iconUrl}
                            alt={selectedStore.name}
                            className="h-16 w-16 rounded-2xl object-cover shadow-md"
                          />
                        ) : (
                          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 text-[14px] text-gray-400">
                            店舗
                          </div>
                        )}
                        <div>
                          <p className="text-[17px] font-semibold text-gray-900">{selectedStore.name}</p>
                          <p className="text-[13px] text-gray-500 mt-1">{selectedStore.address}</p>
                        </div>
                      </div>
                      <p className="text-[13px] text-gray-600 leading-relaxed">
                        {selectedStore.description || "店舗の説明はまだありません"}
                      </p>

                      <div className="mt-6 space-y-3">
                        <button
                          type="button"
                          onClick={() => joinStore(selectedStore.id)}
                          className="h-12 w-full rounded-2xl bg-gradient-to-r from-[#F2A900] to-[#D4910A] text-[15px] font-semibold text-white hover:from-[#D4910A] hover:to-[#C48509] transition-all shadow-md active:scale-98"
                        >
                          入店する
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (!selectedStore) return

                            setPlayersPreviewStore(selectedStore)
                            setIsPlayersModalOpen(true)
                            setPlayersPreviewLoading(true)

                            void openPlayersPreview(selectedStore.id)

                            setSelectedStore(null)
                          }}
                          className="h-12 w-full rounded-2xl border-2 border-gray-200 text-[15px] font-semibold text-gray-700 hover:bg-gray-50 transition-all active:scale-98"
                        >
                          現在入店中のプレイヤーを見る
                        </button>
                        <button
                          type="button"
                          className="h-12 w-full rounded-2xl border-2 border-gray-200 text-[15px] font-semibold text-gray-400"
                        >
                          DMを送る
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Players Preview Modal */}
                {isPlayersModalOpen && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay px-4">
                    <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl animate-slideUp">
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-[18px] font-semibold text-gray-900">入店中プレイヤー</h2>
                        <button
                          type="button"
                          onClick={() => setIsPlayersModalOpen(false)}
                          className="text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          <FiX size={20} />
                        </button>
                      </div>
                      {playersPreviewStore && (
                        <p className="mb-4 text-[13px] text-gray-500">{playersPreviewStore.name}</p>
                      )}

                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {playersPreviewLoading ? (
                          <p className="text-center text-[13px] text-gray-500 py-8">読み込み中...</p>
                        ) : playersPreview.length === 0 ? (
                          <p className="text-center text-[13px] text-gray-500 py-8">入店中のプレイヤーがいません</p>
                        ) : (
                          playersPreview.map(player => (
                            <div key={player.id} className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-gray-50 p-3 hover:bg-gray-100 transition-colors">
                              {player.iconUrl ? (
                                <img src={player.iconUrl} alt={player.name} className="h-12 w-12 rounded-full object-cover" />
                              ) : (
                                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-200">
                                  <FiUser className="text-[16px] text-gray-400" />
                                </div>
                              )}
                              <p className="text-[15px] font-semibold text-gray-900">{player.name ?? player.id}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Detailed Ranking Modal */}
                {isDetailedRankingModalOpen && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay px-4">
                    <div className="mx-auto w-full max-w-sm rounded-3xl bg-white p-6 max-h-[80vh] overflow-y-auto shadow-2xl animate-slideUp">
                      <div className="flex items-center justify-between mb-5">
                        <h2 className="text-[18px] font-semibold text-gray-900">チップ純増ランキング（上位50）</h2>
                        <button type="button" onClick={() => setIsDetailedRankingModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                          <FiX size={20} />
                        </button>
                      </div>

                      <div className="space-y-2">
                        {ranking.slice(0, 50).map((player, index) => (
                          <div key={player.id} className="flex items-center justify-between rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 hover:bg-gray-100 transition-colors">
                            <div className="flex items-center gap-3">
                              <span className="w-8 text-[13px] text-gray-500 font-semibold text-right">{index + 1}位</span>
                              <span className="text-[14px] text-gray-800 font-medium">{player.name || "プレイヤー"}</span>
                            </div>
                            <span className="text-[14px] font-bold text-gray-900">{formatSignedChipValue(player.netGain)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Bottom Navigation */}
                <nav className="fixed bottom-0 left-0 right-0 w-full z-[80] glass-card border-t border-gray-200/60 shadow-lg">
                  <div className="relative mx-auto flex max-w-sm items-center justify-between px-8 py-3">
                    <button
                      type="button"
                      onClick={() => router.push("/home")}
                      className="flex flex-col items-center text-[#F2A900] transition-all"
                    >
                      <FiHome size={22} />
                      <span className="mt-1 text-[11px] font-medium">ホーム</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => router.push("/home/transactions")}
                      className="absolute left-1/2 top-0 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-[#F2A900] to-[#D4910A] text-white shadow-xl hover:shadow-2xl transition-all active:scale-95"
                      aria-label="入出金"
                    >
                      <FiCreditCard size={28} />
                    </button>
                    <button
                      type="button"
                      onClick={() => router.push("/home/mypage")}
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
