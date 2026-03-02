"use client"
import {
  updateDoc,
  where,
  addDoc,
  Timestamp,
  orderBy,
  collection,
  doc,
  deleteField,
  deleteDoc,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore"
import { useRouter } from "next/navigation"
import { auth, db } from "@/lib/firebase"
import HomeHeader from "@/components/HomeHeader"
import { getCommonMenuItems } from "@/components/commonMenuItems"
import { useState, useEffect, useMemo } from "react"
import { FiClock, FiCopy, FiHome, FiUser } from "react-icons/fi"

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
  const router = useRouter()
  // トナメ終了モーダル用state
  const [showEndModal, setShowEndModal] = useState(false)
  const [prizeRows, setPrizeRows] = useState([
    { playerId: "", prize: "" }
  ])
  const [players, setPlayers] = useState<PlayerInfo[]>([])
  // プレイヤーID→プレイヤー情報のマップ
  const playerMap = useMemo(() => {
    const map: Record<string, PlayerInfo> = {}
    players.forEach((p) => {
      map[p.id] = p
    })
    return map
  }, [players])
  const [storeId, setStoreId] = useState<string | null>(null)
  const [store, setStore] = useState<StoreInfo | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [depositRequests, setDepositRequests] = useState<DepositRequest[]>([])
  const [playerSearchInput, setPlayerSearchInput] = useState("")
  const [tournaments, setTournaments] = useState<any[]>([])

  // ログインユーザーのroleを取得（onAuthStateChangedベース）
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        setRole(null)
        return
      }
      const snap = await getDoc(doc(db, "users", user.uid))
      const data = snap.data()
      setRole(data?.role ?? null)
    })
    return () => unsubscribe()
  }, [])
    // 今日の日付（YYYY-MM-DD）
    const todayStr = useMemo(() => {
      const now = new Date()
      const y = now.getFullYear()
      const m = String(now.getMonth() + 1).padStart(2, "0")
      const d = String(now.getDate()).padStart(2, "0")
      return `${y}-${m}-${d}`
    }, [])
    // entries state & リアルタイム購読
    const [entries, setEntries] = useState<Record<string, any>>({})
    // アクティブなトナメID
    const activeTournamentId = useMemo(() => {
      if (!tournaments || tournaments.length === 0) return null
      // 今日の日付のトナメの最初のIDを使う
      const today = todayStr
      const todayTn = tournaments.find((tn: any) => {
        if (!tn.date) return false
        if (typeof tn.date.toDate === "function") {
          const dateObj = tn.date.toDate()
          const y = dateObj.getFullYear()
          const m = String(dateObj.getMonth() + 1).padStart(2, "0")
          const d = String(dateObj.getDate()).padStart(2, "0")
          const dateStr = `${y}-${m}-${d}`
          return dateStr === today
        }
        return false
      })
      return todayTn ? todayTn.id : null
    }, [tournaments, todayStr])


    useEffect(() => {
      if (!storeId || !activeTournamentId) return
      const q = collection(
        db,
        "stores",
        storeId,
        "tournaments",
        activeTournamentId,
        "entries"
      )
      const unsub = onSnapshot(q, snap => {
        const map: Record<string, any> = {}
        snap.forEach(d => {
          map[d.id] = d.data()
        })
        setEntries(map)
      })
      return () => unsub()
    }, [storeId, activeTournamentId])

    // プレイヤー検索フィルタ
    const filteredPlayers = useMemo(() => {
      const q = playerSearchInput.toLowerCase()
      if (!q) return players
      return players.filter(
        (p) => p.name?.toLowerCase().includes(q)
      )
    }, [playerSearchInput, players])

    // プレイヤー選択
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
  // ※ ここは削除（重複しているため）

  // 本日のトーナメント抽出（防御的）
  const todaysTournaments = useMemo(() => {
    return tournaments.filter(tn => {
      if (!tn.date) return false
      return true
    })
  }, [tournaments])

    // アクティブなトナメ情報取得
  const activeTournament = useMemo(() => {
    if (!activeTournamentId) return null
    return todaysTournaments.find(tn => tn.id === activeTournamentId) || null
  }, [activeTournamentId, todaysTournaments])

  // 総エントリー数・アドオン数
  const totalEntryCount = useMemo(() => {
    return Object.values(entries).reduce(
      (sum, e) => sum + (e.entryCount || 0),
      0
    )
  }, [entries])

  const totalAddonCount = useMemo(() => {
    return Object.values(entries).reduce(
      (sum, e) => sum + (e.addonCount || 0),
      0
    )
  }, [entries])

  // プライズ計算
  const totalPrize = useMemo(() => {
    if (!activeTournament) return 0
    const entryFee = Number(activeTournament.entryFee || 0)
    const addonFee = Number(activeTournament.addonFee || 0)
    return totalEntryCount * entryFee + totalAddonCount * addonFee
  }, [activeTournament, totalEntryCount, totalAddonCount])

  // 入賞者追加
  const handleAddPrizeRow = () => {
    setPrizeRows(rows => [...rows, { playerId: "", prize: "" }])
  }

  // 入賞者選択肢（entryCount>0のみ）
  const entryPlayers = useMemo(() => {
    return players.filter(
      p => (entries[p.id]?.entryCount || 0) > 0
    )
  }, [players, entries])

  // entryカウント変更
  const handleEntryChange = async (
    uid: string,
    delta: number
  ) => {
    if (!storeId || !activeTournamentId) return

    const ref = doc(
      db,
      "stores",
      storeId,
      "tournaments",
      activeTournamentId,
      "entries",
      uid
    )

    try {
      await setDoc(
        ref,
        {
          entryCount: increment(delta),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      )
    } catch (e) {
      console.error("entry更新失敗", e)
    }
  }

  // addonカウント変更
  const handleAddonChange = async (
    uid: string,
    delta: number
  ) => {
    if (!storeId || !activeTournamentId) return

    const ref = doc(
      db,
      "stores",
      storeId,
      "tournaments",
      activeTournamentId,
      "entries",
      uid
    )

    try {
      await setDoc(
        ref,
        {
          addonCount: increment(delta),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      )
    } catch (e) {
      console.error("addon更新失敗", e)
    }
  }

  // トーナメント作成フォーム用state
  const [tnName, setTnName] = useState("")
  const [tnDate, setTnDate] = useState("")
  const [tnStartTime, setTnStartTime] = useState("")
  const [tnRcTime, setTnRcTime] = useState("")
  const [tnEntryFee, setTnEntryFee] = useState("")
  const [tnReentryFee, setTnReentryFee] = useState("")
  const [tnAddonFee, setTnAddonFee] = useState("")
  const [tnFlyerUrl, setTnFlyerUrl] = useState("")
  const [tnCreating, setTnCreating] = useState(false)

  // トーナメント削除処理
  const handleDeleteTournament = async (
    tournamentId: string
  ) => {
    if (!storeId) return
    const confirmDelete = window.confirm(
      "本当に削除しますか？"
    )
    if (!confirmDelete) return

    await deleteDoc(
      doc(db, "stores", storeId, "tournaments", tournamentId)
    )
  }

  // トーナメント作成処理
  const handleCreateTournament = async () => {
    if (!storeId) return
    if (!tnName || !tnDate || !tnStartTime || !tnRcTime) {
      alert("必須項目を入力してください")
      return
    }

    try {
      setTnCreating(true)

      await addDoc(
        collection(db, "stores", storeId, "tournaments"),
        {
          name: tnName,
          date: Timestamp.fromDate(new Date(tnDate)),
          startTime: tnStartTime,
          rcTime: tnRcTime,
          entryFee: Number(tnEntryFee || 0),
          reentryFee: Number(tnReentryFee || 0),
          addonFee: tnAddonFee ? Number(tnAddonFee) : null,
          flyerUrl: tnFlyerUrl || null,
          createdAt: serverTimestamp(),
          status: "active",
        }
      )

      setTnName("")
      setTnDate("")
      setTnStartTime("")
      setTnRcTime("")
      setTnEntryFee("")
      setTnReentryFee("")
      setTnAddonFee("")
      setTnFlyerUrl("")

      alert("トーナメントを登録しました")
    } catch (err: any) {
      console.error("Tournament create error:", err)
      alert(
        "作成失敗: " +
          (err?.message || JSON.stringify(err))
      )
    } finally {
      setTnCreating(false)
    }
  }

    const [selectedPlayerId, setSelectedPlayerId] = useState("")
  const [selectedPlayerBalance, setSelectedPlayerBalance] = useState(0)
  const [selectedPlayerNetGain, setSelectedPlayerNetGain] = useState(0)
  const [adjustAmount, setAdjustAmount] = useState("")
  const [adjustError, setAdjustError] = useState("")
  const [showAdjustmentConfirm, setShowAdjustmentConfirm] = useState(false)
  const [showNetGainConfirm, setShowNetGainConfirm] = useState(false)
  const [pendingAdjustment, setPendingAdjustment] =
    useState<{ direction: "add" | "subtract"; amount: string } | null>(null)

  // 入店履歴プレイヤーリスト
  const [storePlayers, setStorePlayers] = useState<any[]>([])
  const [storePlayersPage, setStorePlayersPage] = useState(1)
  const pageSize = 10

  useEffect(() => {

    // ここにfetchStorePlayersの正しい実装を記述する場合は必要に応じて追加
    // 現状は空でOK
  }, [storeId])

  const rejectDeposit = async (
    request: DepositRequest
  ) => {
    await updateDoc(
      doc(db, "depositRequests", request.id),
      {
        status: "rejected",
      }
    )
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
    const balanceRef = doc(db, "users", selectedPlayerId, "storeBalances", storeId)
    const balanceSnap = await getDoc(balanceRef)
    let current = 0;
    let currentNetGain = 0;
    let newBalance = 0;
    let newNetGain = 0;
    if (balanceSnap.exists()) {
      current = balanceSnap.data()?.balance ?? 0;
      currentNetGain = balanceSnap.data()?.netGain ?? 0;
    }
    if (direction === "subtract" && current < amount) {
      setAdjustError("残高が不足しています")
      return
    }
    if (!balanceSnap.exists()) {
      newBalance = direction === "add" ? amount : 0
      newNetGain = isNetGain && direction === "add" ? amount : 0
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
      newBalance = direction === "add" ? current + amount : current - amount
      newNetGain = isNetGain
        ? direction === "add"
          ? currentNetGain + amount
          : currentNetGain - amount
        : currentNetGain
      const updates: Record<string, any> = {
        balance: increment(direction === "add" ? amount : -amount),
      }
      if (isNetGain) {
        updates.netGain = increment(direction === "add" ? amount : -amount)
      }
      await updateDoc(balanceRef, updates)
    }
    await setDoc(doc(collection(db, "transactions")), {
      storeId,
      playerId: selectedPlayerId,
      playerName: playerMap[selectedPlayerId]?.name ?? null,
      amount,
      direction,
      type: isNetGain ? "manual_adjustment_net_gain" : "manual_adjustment",
      createdAt: serverTimestamp(),
    })
    setAdjustAmount("")
    setSelectedPlayerBalance(newBalance)
    setSelectedPlayerNetGain(newNetGain)
  }


  // --- ここからガード ---
  useEffect(() => {
    if (role && role !== "store") {
      router.replace("/home")
    }
  }, [role, router])

  if (role === null) {
    return <div className="p-6">Loading...</div>
  }
  if (role !== "store") {
    return null
  }
  // --- ここまでガード ---

  return (
    <main className="min-h-screen bg-white pb-28">
      <HomeHeader
        homePath="/home/store"
        myPagePath="/home/store/mypage"
        variant="store"
        menuItems={getCommonMenuItems(router, "store")}
      />
      <div className="mx-auto max-w-sm px-5">
        {/* ...existing code... */}
      </div>
      <nav className="fixed bottom-0 inset-x-0 z-[80] border-t border-gray-200 bg-white flex justify-center">
        <div className="relative flex w-full max-w-sm items-center justify-between px-8 py-3">
          <button
            type="button"
            onClick={() => router.push("/home/store")}
            className="flex flex-col items-center text-[#111]"
          >
            <FiHome className="text-[18px]" />
            <span className="mt-1 text-[11px]">
              ホーム
            </span>
          </button>
          <button
            type="button"
            onClick={() =>
              router.push("/home/store/timer")
            }
            className="absolute left-1/2 top-0 flex h-[74px] w-[74px] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full bg-[#F2A900] text-gray-900 shadow-lg"
          >
            <FiClock className="text-[22px]" />
            <span className="mt-1 text-[10px] font-semibold">
              タイマー
            </span>
          </button>

          <button
            type="button"
            onClick={() =>
              router.push("/home/store/mypage")
            }
            className="flex flex-col items-center text-gray-400"
          >
            <FiUser className="text-[18px]" />
            <span className="mt-1 text-[11px]">
              マイページ
            </span>
          </button>
        </div>
      </nav>
    </main>
  )
}