"use client"
import { AwardIcon, CheckIcon, LayoutGridIcon, ChevronDownIcon, ChevronRightIcon, CirclePlusIcon, ClockIcon, CopyIcon, CreditCardIcon, DollarSignIcon, EllipsisIcon, HouseIcon, InboxIcon, LogInIcon, LogOutIcon, Maximize2Icon, MessageSquareIcon, MinusIcon, PauseIcon, PenLineIcon, PlayIcon, PlusIcon, RefreshCwIcon, ScanIcon, SearchIcon, SendIcon, SkipBackIcon, SkipForwardIcon, Trash2Icon, TriangleAlertIcon, UserIcon, UsersIcon, XIcon } from 'lucide-react'
import { showToast } from "@/components/Toast"

import PlayerHistoryModal from "@/app/components/PlayerHistoryModal"
import dynamic from "next/dynamic"
const PlayerProfileModal = dynamic(() => import("@/components/PlayerProfileModal"), { ssr: false })
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
const QRScanner = dynamic(() => import("@/app/components/QRScanner"), { ssr: false })
import { useRouter } from "next/navigation"
import { auth, db } from "@/lib/firebase"
import { startTournamentTimer, setTournamentLevel, adjustTournamentTime } from "@/lib/timerControl"
import { computeLiveLevelState, type TimerLevel } from "@/lib/timerCompute"
import { ensureClockCalibrated, getServerNow } from "@/lib/serverClock"
import { autoStartTournament, isAutoStartDue } from "@/lib/autoStart"
import { hapticAction, hapticTap, hapticError } from "@/lib/haptics"
import HomeHeader from "@/components/HomeHeader"
import StoreBottomNav from "@/components/StoreBottomNav"
import { getCommonMenuItems } from "@/components/commonMenuItems"
import { isSubscriptionActive } from "@/lib/subscription-client"
import { isNativeApp } from "@/lib/platform"
import ConfirmDialog, { type ConfirmRequest } from "@/components/ConfirmDialog"
import AppleSheet from "@/components/AppleSheet"
import BlindLevelEditor, { validateLevels } from "@/components/BlindLevelEditor"
import TechBackdrop from "@/components/TechBackdrop"
import TournamentPurchaseLog from "@/components/TournamentPurchaseLog"
import PlayerManageModal from "./PlayerManageModal"
import PrizeDistributeModal from "./PrizeDistributeModal"
import ChipDisclaimer from "@/components/ChipDisclaimer"
import {
  arrayUnion, collection, doc, deleteField, getDoc, increment,
  onSnapshot, query, serverTimestamp, setDoc, updateDoc, where,
  Timestamp,
} from "firebase/firestore"

type StoreInfo = { name: string; iconUrl?: string; code: string; chipUnitLabel?: string; chipUnitBefore?: boolean; balanceGroupId?: string }
type AdjLevel =
  | { type: "level"; smallBlind: number | null; bigBlind: number | null; ante: number | null; duration: number | null; comment?: string | null }
  | { type: "break"; duration: number | null; comment?: string | null }
type OwnedStore = { id: string; name: string; iconUrl?: string }
type DepositRequest = { id: string; playerId: string; amount: number; comment?: string }
type WithdrawRequest = { id: string; playerId: string; amount: number; comment?: string }
type PlayerInfo = { id: string; name?: string; iconUrl?: string; visitCount?: number; lastVisitedAt?: Date | null }

function fmtChip(amount: number, unit?: string, before?: boolean): string {
  if (!unit) return amount.toLocaleString()
  return before ? `${unit}${amount.toLocaleString()}` : `${amount.toLocaleString()}${unit}`
}

// Fallback blind schedule used when a tournament has no customBlindLevels yet
// (mirrors the fallback already used elsewhere for tournaments without a saved preset).
const DEFAULT_BLIND_LEVELS: TimerLevel[] = [
  { type: "level", smallBlind: 15, bigBlind: 30, ante: 30, duration: 20 },
  { type: "level", smallBlind: 20, bigBlind: 40, ante: 40, duration: 20 },
  { type: "level", smallBlind: 25, bigBlind: 50, ante: 50, duration: 20 },
  { type: "level", smallBlind: 30, bigBlind: 60, ante: 60, duration: 20 },
  { type: "level", smallBlind: 40, bigBlind: 80, ante: 80, duration: 20 },
  { type: "level", smallBlind: 50, bigBlind: 100, ante: 100, duration: 20 },
  { type: "level", smallBlind: 75, bigBlind: 150, ante: 150, duration: 20 },
  { type: "level", smallBlind: 100, bigBlind: 200, ante: 200, duration: 20 },
]

// Computes "what level/remaining-time is correct right now" for a tournament card,
// using the same catch-up logic as TimerClient.tsx and the server, so the operator
// panel's buttons never act on a stale Firestore-cached level index.
function getLiveLevelState(t: any) {
  const levels = Array.isArray(t.customBlindLevels) && t.customBlindLevels.length > 0
    ? t.customBlindLevels : DEFAULT_BLIND_LEVELS
  return computeLiveLevelState(
    t.currentLevelIndex ?? 0,
    t.levelStartedAtMs ?? null,
    t.timerRunning ? (t.levelStartedRemaining ?? t.timeRemaining ?? 0) : (t.timeRemaining ?? 0),
    levels,
    t.timerRunning ?? false,
    getServerNow()
  )
}

// 残高への加減方向だけをアイコンの色で示す、見た目を統一したアクションタイル。
// ボタン自体の地色・枠線・タイポグラフィは常に同一にし、特定のボタンだけが
// 目立つ配色にならないようにする（Apple Walletの取引アイコンと同じ考え方）。
type ActionTileProps = { label: string; icon: ReactNode; direction: "add" | "subtract"; onClick: () => void; disabled?: boolean }
function ActionTile({ label, icon, direction, onClick, disabled }: ActionTileProps) {
  const tintBg = direction === "add" ? "rgba(52,199,89,0.12)" : "rgba(255,59,48,0.1)"
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8,
        height: 84, borderRadius: 22, border: "none",
        // ガラスの面。枠線ではなく、上端の光と内側の縁で輪郭を出す
        background: "rgba(255,255,255,0.62)",
        backdropFilter: "blur(22px) saturate(190%)",
        WebkitBackdropFilter: "blur(22px) saturate(190%)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9), inset 0 0 0 1px rgba(255,255,255,0.45), 0 2px 10px rgba(0,0,0,0.05)",
        cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.4 : 1, padding: 0,
        WebkitTapHighlightColor: "transparent",
        // 離してからではなく、押した瞬間に沈む
        transition: "background 100ms ease-out, transform 100ms ease-out",
      }}
      onPointerDown={e => { if (!disabled) { e.currentTarget.style.background = "rgba(255,255,255,0.82)"; e.currentTarget.style.transform = "scale(0.97)" } }}
      onPointerUp={e => { e.currentTarget.style.background = "rgba(255,255,255,0.62)"; e.currentTarget.style.transform = "scale(1)" }}
      onPointerLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.62)"; e.currentTarget.style.transform = "scale(1)" }}
    >
      <div style={{ width: 36, height: 36, borderRadius: 999, background: tintBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {icon}
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--label)" }}>{label}</span>
    </button>
  )
}

// iOS標準のUISwitchを模した自前のトグル（チェックボックスは使用しない）
function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="a-switch"
    />
  )
}

export default function StorePage() {
  const getVisitCountResetBase = (date: Date) => {
    const base = new Date(date); base.setHours(3, 0, 0, 0)
    if (date.getHours() < 3) base.setDate(base.getDate() - 1)
    return base.getTime()
  }

  useEffect(() => { ensureClockCalibrated() }, [])


  const [timerRunning, setTimerRunning] = useState<Record<string, boolean>>({})
  // 分割表示(2〜4 個のタイマーを 1 画面に)
  const [splitOpen, setSplitOpen] = useState(false)
  const [splitIds, setSplitIds] = useState<string[]>([])
  const [adjustModalOpen, setAdjustModalOpen] = useState<Record<string, boolean>>({})
  const [adjustSeconds, setAdjustSeconds] = useState<Record<string, number>>({})
  const [adjustTab, setAdjustTab] = useState<Record<string, 'time' | 'blind'>>({})
  const [adjustBlindLevels, setAdjustBlindLevels] = useState<Record<string, AdjLevel[]>>({})
  const [expandedTimerId, setExpandedTimerId] = useState<string | null>(null)
  const [expandCtrlVisible, setExpandCtrlVisible] = useState(false)
  /** 操作バーに触れた回数。触るたびに「5 秒で隠す」を数え直す。 */
  const [expandCtrlTouch, setExpandCtrlTouch] = useState(0)
  // 全画面タイマーの操作バーは、最後に触ってから 5 秒で自動的に隠す(表示用の画面にボタンを残さない)。
  useEffect(() => {
    if (!expandCtrlVisible) return
    const id = window.setTimeout(() => setExpandCtrlVisible(false), 5000)
    return () => window.clearTimeout(id)
  }, [expandCtrlVisible, expandCtrlTouch])
  const [expandPlayerOpen, setExpandPlayerOpen] = useState(false)
  const [expandPrizeOpen, setExpandPrizeOpen] = useState(false)


  const openAdjustModal = (id: string, s: number, blindLevels?: AdjLevel[] | null) => {
    setAdjustModalOpen(p => ({ ...p, [id]: true }))
    setAdjustSeconds(p => ({ ...p, [id]: s }))
    setAdjustTab(p => ({ ...p, [id]: 'time' }))
    setAdjustBlindLevels(p => ({ ...p, [id]: blindLevels ? JSON.parse(JSON.stringify(blindLevels)) : [] }))
  }
  const closeAdjustModal = (id: string) => setAdjustModalOpen(p => ({ ...p, [id]: false }))
  const updateAdjustTime = (id: string, diff: number) =>
    setAdjustSeconds(p => ({ ...p, [id]: Math.max(0, (p[id] ?? 0) + diff) }))
  const confirmAdjustTime = async (id: string) => {
    if (!storeId) return
    try {
      await adjustTournamentTime(storeId, id, adjustSeconds[id])
      closeAdjustModal(id)
    } catch (error) {
      console.error("Failed to adjust time:", error)
      showToast("時間調整に失敗しました")
    }
  }
  const confirmAdjustBlinds = async (id: string) => {
    if (!storeId) return
    const invalid = validateLevels(adjustBlindLevels[id] ?? [])
    if (invalid) { showToast(invalid); return }
    try {
      await updateDoc(doc(db, "stores", storeId, "tournaments", id), { customBlindLevels: adjustBlindLevels[id] ?? [] })
      closeAdjustModal(id)
      showToast("ブラインド表を変更しました", "success")
    } catch {
      showToast("ブラインド表を変更できませんでした")
    }
  }
  const toggleTimer = async (id: string) => {
    hapticAction()
    timerRunning[id] ? await pauseTimer(id) : await resumeTimer(id)
  }

  const router = useRouter()

  async function startTimer(id: string) {
    if (!storeId) return
    try {
      await startTournamentTimer(storeId, id)
    } catch (error) {
      console.error("Failed to start timer:", error)
      showToast("タイマー開始に失敗しました")
    }
  }
  // 再生・一時停止は Firestore に直接書く。サーバー関数を経由すると起動待ちで数秒遅れていた。
  // 直接書けば、この端末の画面には書いた瞬間に反映され(Firestore の手元反映)、他の端末にも
  // すぐ届く。時刻はサーバー時計に合わせた値(getServerNow)を使い、端末の時計のずれに左右されない。
  async function resumeTimer(id: string) {
    if (!storeId) return
    const t = activeTournaments.find(x => x.id === id)
    if (!t) return
    const remaining = typeof t.timeRemaining === "number" && t.timeRemaining > 0 ? t.timeRemaining : (getLiveLevelState(t).remainingSec || 1200)
    setTimerRunning(m => ({ ...m, [id]: true }))
    try {
      await updateDoc(doc(db, "stores", storeId, "tournaments", id), {
        timerRunning: true,
        levelStartedAt: Timestamp.fromMillis(getServerNow()),
        levelStartedRemaining: remaining,
        timeRemaining: remaining,
      })
    } catch (error) {
      console.error("Failed to resume timer:", error)
      setTimerRunning(m => ({ ...m, [id]: false }))
      showToast("タイマー再開に失敗しました")
    }
  }
  async function nextLevel(id: string) {
    if (!storeId) return
    const t = activeTournaments.find(t => t.id === id)
    if (!t) return
    const live = getLiveLevelState(t)
    hapticTap()
    try {
      await setTournamentLevel(storeId, id, live.levelIndex + 1)
    } catch (error) {
      console.error("Failed to advance level:", error)
      hapticError()
      showToast("レベル変更に失敗しました")
    }
  }
  async function pauseTimer(id: string) {
    if (!storeId) return
    const t = activeTournaments.find(x => x.id === id)
    if (!t) return
    // 今の画面に出ているレベルと残り時間で止める(途中でレベルが進んでいても正しく止まる)
    const live = getLiveLevelState(t)
    setTimerRunning(m => ({ ...m, [id]: false }))
    try {
      await updateDoc(doc(db, "stores", storeId, "tournaments", id), {
        timerRunning: false,
        currentLevelIndex: live.levelIndex,
        timeRemaining: live.remainingSec,
        levelStartedRemaining: live.remainingSec,
      })
    } catch (error) {
      console.error("Failed to pause timer:", error)
      setTimerRunning(m => ({ ...m, [id]: true }))
      showToast("タイマー一時停止に失敗しました")
    }
  }
  async function prevLevel(id: string) {
    if (!storeId) return
    const t = activeTournaments.find(t => t.id === id)
    if (!t) return
    const live = getLiveLevelState(t)
    hapticTap()
    try {
      await setTournamentLevel(storeId, id, Math.max(0, live.levelIndex - 1))
    } catch (error) {
      console.error("Failed to go to previous level:", error)
      hapticError()
      showToast("レベル変更に失敗しました")
    }
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

  // 「開始時刻にタイマースタート」の大会を見張り、時刻になったら始める(lib/autoStart.ts)
  useEffect(() => {
    if (!storeId) return
    let pending: any[] = []
    const q = query(collection(db, "stores", storeId, "tournaments"), where("autoStart", "==", true))
    const unsub = onSnapshot(q, snap => { pending = snap.docs.map(d => ({ id: d.id, ...d.data() })) })
    const tick = setInterval(() => {
      const now = getServerNow()
      for (const t of pending) if (isAutoStartDue(t, now)) void autoStartTournament(storeId, t.id)
    }, 1000)
    return () => { unsub(); clearInterval(tick) }
  }, [storeId])

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
          levelStartedAtMs: data.levelStartedAt?.toMillis?.() ?? null,
          levelStartedRemaining: typeof data.levelStartedRemaining === "number" ? data.levelStartedRemaining : null,
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
  const [manualComment, setManualComment] = useState("")
  const [negativeConfirmAction, setNegativeConfirmAction] = useState<{ run: () => void; resultingBalance: number } | null>(null)
  const [storePlayers, setStorePlayers] = useState<any[]>([])
  const playerMetaRef = useRef<Record<string, any>>({})
  const balanceSubsRef = useRef<Record<string, () => void>>({})
  const [removingAdjustmentPlayerIds, setRemovingAdjustmentPlayerIds] = useState<string[]>([])
  const [adjustModalPlayer, setAdjustModalPlayer] = useState<any | null>(null)
  const [profileUid, setProfileUid] = useState<string | null>(null)
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
  const [confirmReq, setConfirmReq] = useState<ConfirmRequest | null>(null)
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
    if (!storeId || !store) return
    const balKey = (store.balanceGroupId ?? storeId)!

    function rebuild() {
      const results = Object.values(playerMetaRef.current).map(p => ({ ...p }))
      results.sort((a: any, b: any) => (b.lastVisitedAt?.getTime() ?? 0) - (a.lastVisitedAt?.getTime() ?? 0))
      setStorePlayers(results)
    }

    const q = query(collection(db, "users"), where("joinedStores", "array-contains", storeId))
    const userUnsub = onSnapshot(q, snap => {
      const filtered = snap.docs.filter(d => !d.id.startsWith("temp_"))
      const currentIds = new Set(filtered.map(d => d.id))

      // Remove players no longer in query
      Object.keys(playerMetaRef.current).forEach(id => {
        if (!currentIds.has(id)) {
          balanceSubsRef.current[id]?.()
          delete balanceSubsRef.current[id]
          delete playerMetaRef.current[id]
        }
      })

      // Update user metadata
      filtered.forEach(d => {
        const data = d.data()
        playerMetaRef.current[d.id] = {
          ...(playerMetaRef.current[d.id] ?? { balance: 0, netGain: 0, lastVisitedAt: null }),
          id: d.id,
          name: data.name,
          iconUrl: data.iconUrl,
          playerId: data.playerId ?? null,
          isInStore: data.currentStoreId === storeId,
        }

        // Subscribe to balance doc if not already subscribed
        if (!balanceSubsRef.current[d.id]) {
          const balRef = doc(db, "users", d.id, "storeBalances", balKey)
          balanceSubsRef.current[d.id] = onSnapshot(balRef, balSnap => {
            const bal = balSnap.exists() ? balSnap.data() : {}
            playerMetaRef.current[d.id] = {
              ...playerMetaRef.current[d.id],
              balance: bal.balance ?? 0,
              netGain: bal.netGain ?? 0,
              lastVisitedAt: bal.lastVisitedAt?.toDate?.() ?? null,
            }
            rebuild()
          }, () => {})
        }
      })

      rebuild()
    })

    return () => {
      userUnsub()
      Object.values(balanceSubsRef.current).forEach(u => u())
      balanceSubsRef.current = {}
      playerMetaRef.current = {}
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, store])

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async user => {
      if (!user) return
      const snap = await getDoc(doc(db, "users", user.uid))
      const data = snap.data() ?? {}
      const sid = data.storeId ?? null
      setStoreId(sid)

      if (sid) {
        const storeSnap = await getDoc(doc(db, "stores", sid))
        const d = storeSnap.data() ?? {}
        const nested = d.subscription ?? {}
        const sub = {
          status: nested.status ?? d["subscription.status"] ?? null,
          currentPeriodEnd: nested.currentPeriodEnd ?? d["subscription.currentPeriodEnd"] ?? null,
          provider: nested.provider ?? null,
        }
        const isFree = d.isFree === true
        if (!isSubscriptionActive(sub) && !isFree) {
          router.replace("/home/store/billing")
          return
        }
      }

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
  }, [router])

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

  // Live player from onSnapshot — always up-to-date even while modal is open
  const liveAdjustPlayer = adjustModalPlayer
    ? (storePlayers.find(p => p.id === adjustModalPlayer.id) ?? adjustModalPlayer)
    : null

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
      storeId: balGroupId, playerId: req.playerId, playerName: playerMap[req.playerId]?.name ?? null,
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
      storeId: balGroupId, playerId: req.playerId, playerName: playerMap[req.playerId]?.name ?? null,
      amount: req.amount, direction: "subtract", type: txType,
      comment: type === "other" ? withdrawOtherComment : null, createdAt: serverTimestamp(),
    })
  }

  const rejectDeposit = async (req: DepositRequest) => { await updateDoc(doc(db, "depositRequests", req.id), { status: "rejected" }) }
  const rejectWithdraw = async (req: WithdrawRequest) => { await updateDoc(doc(db, "withdrawRequests", req.id), { status: "rejected" }) }

  const runAdjustment = async (direction: "add" | "subtract", isNetGain: boolean, skipConfirm = false) => {
    if (!storeId || !adjustModalPlayer) { setAdjustError("プレイヤーを選択してください"); return }
    const amount = Number(adjustValue)
    if (!amount || amount < 1) { setAdjustError("数字は1以上で入力してください"); return }
    setAdjustError("")
    const pid = adjustModalPlayer.id
    const balRef = doc(db, "users", pid, "storeBalances", balGroupId!)
    const balSnap = await getDoc(balRef)
    const current = balSnap.data()?.balance ?? 0
    const currentNG = balSnap.data()?.netGain ?? 0
    const resultingBalance = direction === "add" ? current + amount : current - amount

    if (!skipConfirm && resultingBalance < 0) {
      setNegativeConfirmAction({ run: () => runAdjustment(direction, isNetGain, true), resultingBalance })
      return
    }

    if (!balSnap.exists()) {
      const newBal = direction === "add" ? amount : -amount
      const newNG = isNetGain ? newBal : 0
      await setDoc(balRef, { balance: newBal, netGain: newNG, storeId }, { merge: true })
      setSelectedPlayerBalance(newBal); setSelectedPlayerNetGain(newNG)
    } else {
      const updates: Record<string, any> = { balance: increment(direction === "add" ? amount : -amount) }
      if (isNetGain) updates.netGain = increment(direction === "add" ? amount : -amount)
      await updateDoc(balRef, updates)
      setSelectedPlayerBalance(resultingBalance)
      if (isNetGain) setSelectedPlayerNetGain(direction === "add" ? currentNG + amount : currentNG - amount)
    }
    await setDoc(doc(collection(db, "transactions")), {
      storeId: balGroupId, playerId: pid, playerName: adjustModalPlayer.name ?? null, amount, direction,
      type: isNetGain ? "manual_adjustment_net_gain" : "manual_adjustment",
      comment: manualComment.trim() || null, createdAt: serverTimestamp(),
    })
    setAdjustValue(""); setAdjustModalPlayer(null); setManualComment("")
  }

  const runStoreAdjustment = async (adjustType: string, skipConfirm = false) => {
    if (!storeId || !adjustModalPlayer) return
    const amount = Number(adjustValue)
    if (!amount || amount < 1) { setAdjustError("金額を入力してください"); return }
    setAdjustError("")
    const pid = adjustModalPlayer.id
    const balRef = doc(db, "users", pid, "storeBalances", balGroupId!)
    let bDiff = 0, nDiff = 0, type = "", direction: "add" | "subtract" = "add"
    switch (adjustType) {
      case "buyin":   bDiff = -amount; nDiff = -amount; type = "store_buyin";              direction = "subtract"; break
      case "cashout": bDiff =  amount; nDiff =  amount; type = "store_cashout";                                   break
      case "chip":    bDiff =  amount; nDiff =  0;      type = "store_chip_purchase";                             break
      case "tE":      bDiff = -amount; nDiff = -amount; type = "store_tournament_entry";   direction = "subtract"; break
      case "tR":      bDiff = -amount; nDiff = -amount; type = "store_tournament_reentry"; direction = "subtract"; break
      case "tA":      bDiff = -amount; nDiff = -amount; type = "store_tournament_addon";   direction = "subtract"; break
      default: return
    }

    if (!skipConfirm && bDiff < 0) {
      const balSnap = await getDoc(balRef)
      const current = balSnap.data()?.balance ?? 0
      const resultingBalance = current + bDiff
      if (resultingBalance < 0) {
        setNegativeConfirmAction({ run: () => runStoreAdjustment(adjustType, true), resultingBalance })
        return
      }
    }

    // Write to Firestore — onSnapshot handles UI update, no optimistic setStorePlayers
    const updates: any = { balance: increment(bDiff) }
    if (nDiff !== 0) updates.netGain = increment(nDiff)
    await updateDoc(balRef, updates)
    await setDoc(doc(collection(db, "transactions")), { storeId: balGroupId, playerId: pid, playerName: adjustModalPlayer.name ?? null, amount, direction, type, createdAt: serverTimestamp() })
    setAdjustModalPlayer(null); setAdjustValue(""); setManualComment("")
  }

  const runPrizeAdjustment = async () => {
    if (!storeId || !adjustModalPlayer) return
    const amount = Number(adjustValue)
    if (!amount || amount < 1) { setAdjustError("金額を入力してください"); return }
    setAdjustError("")
    const pid = adjustModalPlayer.id
    const balRef = doc(db, "users", pid, "storeBalances", balGroupId!)
    // Write to Firestore — onSnapshot handles UI update, no optimistic setStorePlayers
    await updateDoc(balRef, { balance: increment(amount), netGain: increment(amount) })
    await setDoc(doc(collection(db, "transactions")), {
      storeId: balGroupId, playerId: pid, playerName: adjustModalPlayer.name ?? null,
      amount, direction: "add", type: "tournament_payout", createdAt: serverTimestamp(),
    })
    setAdjustModalPlayer(null)
    setAdjustValue("")
    setManualComment("")
  }

  const STAMP_GOAL = 12

  const approvePlayer = async (playerId: string) => {
    if (!storeId) return
    const storeSnap = await getDoc(doc(db, "stores", storeId))
    const storeData = storeSnap.data()
    const now = new Date()

    // 1. バランス更新（status 変更より先に実行）
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

    // 2. スタンプ更新（status 変更より先に実行）
    // クーポンは自動発行せずプレイヤーが手動取得。STAMP_GOAL で上限キャップ。
    if (storeData?.checkinBonusEnabled) {
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
        if (canStamp) {
          const prev = stampSnap.exists() ? (stampSnap.data().stampCount ?? 0) : 0
          const newCount = Math.min(prev + 1, STAMP_GOAL)
          await setDoc(stampRef, { stampCount: newCount, lastStampAt: serverTimestamp() }, { merge: true })
        }
      } catch {}
    }

    // 3. ユーザー status を最後に更新（スナップショット発火タイミングをスタンプ書き込み後にする）
    await setDoc(doc(db, "users", playerId), { currentStoreId: storeId, checkinStatus: "approved", pendingStoreId: null }, { merge: true })
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
    // スマホアプリ(Capacitor)では window.open が新しいタブにならず、アプリの画面そのものが
    // タイマーに置き換わって戻れなくなる。アプリでは閉じるボタンを持つ全画面表示で開く。
    if (isNativeApp()) {
      // 開いた直後だけ操作バーを出し、閉じ方が分かるようにする(5 秒で消える)。
      setExpandCtrlVisible(true)
      setExpandedTimerId(id)
    } else {
      // Web: window.open はタップの処理の中で同期的に呼ぶ必要がある。先に開いてから書き込む。
      window.open(`/home/store/timer/${id}`, "_blank")
    }
    // タイマーはここでは絶対に止めない。止まるのは、店舗が一時停止ボタンを押した時だけ
    // (人のお金を預かる大会の時計なので、明確な操作以外で止めてはいけない)。
  }

  if (role === null) return (
    <div style={{ minHeight: '100dvh', background: '#EDECE6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid rgba(249,179,24,0.2)', borderTopColor: '#F9B318', animation: 'spin .8s linear infinite' }}/>
    </div>
  )
  if (role !== "store") return null

  const notifCount = depositRequests.length + withdrawRequests.length + pendingPlayers.length

  return (
    <>
    {/* 下地(方眼 + 金のにじみ)。プレイヤー側と同じものを敷く。 */}
    <TechBackdrop base="#EDECE6" />
    <main className="min-h-[100dvh] w-full max-w-full overflow-x-hidden pb-32" style={{ background: 'transparent', position: 'relative', zIndex: 1 }}>
      <style>{`
        :root {
          --gold:#F9B318; --gold-dk:#995C00;
          --label:#1C1C1E;
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

        /* 立ち上がり。上から順に点いていくように見せる。 */
        .su  { opacity:0; animation:techReveal .5s cubic-bezier(.22,1,.36,1) forwards; }
        @media (prefers-reduced-motion: reduce) { .su { opacity:1; animation:none; } }
        .d0  { animation-delay:.03s; }
        .d1  { animation-delay:.09s; }
        .d2  { animation-delay:.15s; }
        .d3  { animation-delay:.21s; }
        .d4  { animation-delay:.27s; }
        .d5  { animation-delay:.33s; }

        /* 紙のカードではなく計器の板に見せる。上端の金の線が読み込み位置を示す。 */
        .ios-card {
          position:relative;
          background:#fff; border-radius:18px;
          border:1px solid rgba(60,60,67,0.10);
          box-shadow:0 2px 12px rgba(0,0,0,0.05);
          overflow:hidden;
        }
        .ios-card::before {
          content:""; position:absolute; top:0; left:0; right:0; height:2px;
          background:linear-gradient(90deg,transparent,#F9B318 40%,#FFD36B 50%,#F9B318 60%,transparent);
          opacity:0.55; pointer-events:none;
        }
        /* 見出しは二重スラッシュ付きの等幅。下の罫が左から引かれる。 */
        .section-hd {
          position:relative;
          font-family:var(--stack-mono);
          font-size:11px; font-weight:700; letter-spacing:0.04em;
          text-transform:uppercase; color:var(--label3);
          padding:0 0 8px; margin-bottom:16px;
          display:flex; align-items:center; gap:8px;
        }
        .section-hd::after {
          content:""; position:absolute; left:0; bottom:0; width:100%; height:1px;
          background:linear-gradient(90deg,rgba(249,179,24,0.55),rgba(249,179,24,0.06));
          transform-origin:left center;
          animation:techDraw .7s cubic-bezier(.22,1,.36,1) both;
        }
        @media (prefers-reduced-motion: reduce) { .section-hd::after { animation:none; } }

        /* Gold accent line */
        .gold-line {
          height:3px;
          background:#F9B318;
          background-size:200% auto;
          animation:shimmer 3s linear infinite;
        }

        /* Stat chip */
        .stat-chip {
          background:#EDECE6; border-radius:12px; padding:8px 8px; text-align:center;
          font-family:var(--stack-mono); font-variant-numeric:tabular-nums;
        }

        /* Action btn */
        .action-btn {
          min-height:48px; border-radius:12px; border:none; cursor:pointer; padding:0 8px;
          font-family:inherit;
          font-size:15px; font-weight:600; letter-spacing:0;
          display:flex; align-items:center; justify-content:center; gap:8px;
          transition:transform .12s ease, opacity .12s ease, filter .12s ease;
        }
        .action-btn:active { transform:scale(0.97); filter:brightness(.95); }

        /* Gold btn */
        .btn-gold {
          background:#F9B318;
          color:#fff;
        }

        /* Outline btn */
        .btn-outline-gold {
          background:#fff; border:1.5px solid rgba(249,179,24,0.45); color:#995C00;
        }

        /* Danger btn */
        .btn-danger { background:rgba(255,59,48,0.09); color:#FF3B30; border:1.5px solid rgba(255,59,48,0.2); }

        /* Timer controls */
        .timer-btn {
          display:flex; align-items:center; justify-content:center;
          border:none; cursor:pointer; transition:transform .12s ease;
        }
        .timer-btn:active { transform:scale(0.97); }

        /* Player row */
        .player-row {
          display:flex; align-items:center; justify-content:space-between;
          padding:16px 16px; background:#fff; transition:background .12s;
        }
        .player-row:not(:last-child) { border-bottom:1px solid var(--sep); }
        .player-row:active { background:#EDECE6; }

        /* Tab bar */
        .tab-item {
          flex:1; padding:8px 0; font-size:13px; font-weight:600;
          background:none; border:none; cursor:pointer; position:relative;
          transition:color .15s;
        }

        /* Request card */
        .req-card {
          background:#fff; border-radius:16px; padding:16px;
          box-shadow:0 1px 4px rgba(0,0,0,0.05);
        }
        .req-action {
          min-height:44px; border-radius:12px; border:none; cursor:pointer; padding:0 4px;
          font-size:14px; font-weight:600; transition:transform .1s ease-out;
          display:flex; align-items:center; justify-content:center;
        }
        .req-action:active { transform:scale(0.97); }

        /* Pending player */
        .pending-row {
          background:#EDECE6; border-radius:14px; padding:16px 16px;
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
        .adj-btn:active { transform:scale(0.97); opacity:.85; }
        .adj-btn-dark { background:#1C1C1E; color:#fff; }
        .adj-btn-gold { background:#F9B318; color:#fff; box-shadow:0 2px 8px rgba(249,179,24,0.25); }
        .adj-btn-add  { background:linear-gradient(135deg,#1546D9,#0066DD); color:#fff; }
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
      {historyPlayerId && balGroupId && <PlayerHistoryModal playerId={historyPlayerId} storeId={balGroupId} playerName={storePlayers.find(p => p.id === historyPlayerId)?.name} chipUnit={store?.chipUnitLabel} chipUnitBefore={store?.chipUnitBefore} onClose={() => setHistoryPlayerId(null)} />}
      <PlayerProfileModal uid={profileUid} onClose={() => setProfileUid(null)} />
      <ConfirmDialog request={confirmReq} onClose={() => setConfirmReq(null)} />
      <AppleSheet open={splitOpen} onClose={() => setSplitOpen(false)} title="SPLIT VIEW">
        <p style={{ fontSize: 15, color: 'var(--label2)', margin: '0 0 16px', lineHeight: 1.5 }}>1 つの画面に並べるタイマーを、2〜4 個選んでください。2 個は左右、3 個は横に 3 つ、4 個は 4 分割で表示します。</p>
        <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', marginBottom: 24 }}>
          {activeTournaments.map((t, i) => {
            const on = splitIds.includes(t.id)
            const full = !on && splitIds.length >= 4
            return (
              <button key={t.id} type="button" role="checkbox" aria-checked={on} disabled={full}
                onClick={() => setSplitIds(ids => on ? ids.filter(x => x !== t.id) : [...ids, t.id])}
                style={{ display: 'flex', alignItems: 'center', gap: 16, width: '100%', minHeight: 56, padding: '8px 16px', border: 'none', borderTop: i ? '1px solid rgba(60,60,67,0.12)' : 'none', background: 'none', fontFamily: 'inherit', textAlign: 'left', cursor: full ? 'default' : 'pointer', opacity: full ? 0.5 : 1 }}>
                <span style={{ flex: 1, fontSize: 17, color: 'var(--label)' }}>{t.name || '名称なし'}</span>
                <span className="tech-label" style={{ fontSize: 13, color: timerRunning[t.id] ? '#1E7B34' : 'var(--label2)' }}>{timerRunning[t.id] ? 'RUNNING' : 'PAUSED'}</span>
                <span style={{ width: 24, height: 24, borderRadius: 12, border: on ? 'none' : '2px solid var(--label3)', background: on ? '#F9B318' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {on && <CheckIcon size={16} color="#fff" strokeWidth={3} />}
                </span>
              </button>
            )
          })}
        </div>
        <button type="button" disabled={splitIds.length < 2} className="gl-press"
          onClick={() => {
            const url = `/home/store/timer/split?ids=${splitIds.join(',')}`
            setSplitOpen(false)
            // Web は別のタブ(モニター用)、アプリは同じ画面で開く(タップで閉じるボタンが出る)
            if (isNativeApp()) router.push(url)
            else window.open(url, '_blank')
          }}
          style={{ width: '100%', minHeight: 54, borderRadius: 14, border: 'none', background: splitIds.length < 2 ? '#E5E5EA' : '#F9B318', color: splitIds.length < 2 ? 'var(--label3)' : '#fff', fontSize: 17, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
          <span className="tech-label" style={{ fontSize: 17 }}>OPEN {splitIds.length >= 2 ? `${splitIds.length}-SPLIT` : ''}</span>
        </button>
      </AppleSheet>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 16px' }}>

        {/* ── Store Header Card ── */}
        <div className="su d0" style={{ marginTop: 16, position: 'relative' }}>
          <div
            className="ios-card"
            style={{ overflow: 'hidden' }}
            onTouchStart={e => { cardTouchStartX.current = e.touches[0].clientX; cardTouchStartY.current = e.touches[0].clientY; e.currentTarget.style.transition = 'none' }}
            onTouchMove={e => {
              // 横に引いた分だけカードが指について動く(引くほど重くなる)。
              const dx = e.touches[0].clientX - cardTouchStartX.current
              const dy = e.touches[0].clientY - cardTouchStartY.current
              if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy)) return
              const w = e.currentTarget.offsetWidth || 360
              const x = (dx * w * 0.55) / (w + 0.55 * Math.abs(dx)) * 0.4
              e.currentTarget.style.transform = `translateX(${x}px)`
            }}
            onTouchEnd={e => {
              e.currentTarget.style.transition = 'transform 0.35s cubic-bezier(0.2, 0.9, 0.3, 1)'
              e.currentTarget.style.transform = ''
              const dx = e.changedTouches[0].clientX - cardTouchStartX.current
              const dy = e.changedTouches[0].clientY - cardTouchStartY.current
              if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5 && dx > 0) setSwitcherOpen(p => !p)
            }}
          >
            <div className="gold-line"/>
            <div style={{ padding: '16px 16px 16px', display: 'flex', alignItems: 'center', gap: 16 }}>
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
                  style={{ width: 60, height: 60, borderRadius: 18, background: '#F9B318', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: 'white', fontWeight: 800, flexShrink: 0, boxShadow: '0 3px 10px rgba(249,179,24,0.28)', cursor: 'pointer' }}
                  onClick={handleIconTap}
                  onTouchStart={startLongPress}
                  onTouchEnd={cancelLongPress}
                  onTouchMove={cancelLongPress}
                >店</div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* 店舗名を押すと系列店の切り替え(以前はスワイプ・長押しでしか出せず、見つけられなかった) */}
                <button type="button" onClick={() => setShowStorePicker(true)} aria-haspopup="menu" aria-label="店舗を切り替える"
                  style={{ display: 'flex', alignItems: 'center', gap: 4, maxWidth: '100%', minHeight: 44, padding: 0, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--label)', marginBottom: 4 }}>
                  <span style={{ fontSize: 17, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{store?.name ?? ""}</span>
                  <ChevronDownIcon size={20} style={{ color: 'var(--label2)', flexShrink: 0 }} />
                </button>
                <button onClick={copyCode}
                  className="con-btn"
                  aria-label={copiedCode ? "コピーしました" : "店舗コードをコピー"}
                  style={{ whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 8, background: copiedCode ? 'rgba(52,199,89,0.12)' : 'rgba(255,255,255,0.6)', borderRadius: 999, padding: '8px 16px', border: 'none', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.5), 0 1px 4px rgba(0,0,0,0.05)', cursor: 'pointer', transition: 'background 240ms cubic-bezier(0.32,0.72,0,1)' }}
                >
                  <span style={{ fontSize: 13, color: 'var(--label2)', whiteSpace: 'nowrap' }}>CODE</span>
                  <span className="con-mono" style={{ fontSize: 15, fontWeight: 700, color: copiedCode ? '#1E7B34' : 'var(--label)', letterSpacing: '0.08em' }}>{store?.code ?? ""}</span>
                  {copiedCode ? <CheckIcon size={12} style={{ color: '#28A745' }}/> : <CopyIcon size={12} style={{ color: 'var(--label3)' }}/>}
                </button>
              </div>
              {/* QRスキャンボタン + 通知バッジ */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <button
                  onClick={() => setIsScannerOpen(true)}
                  style={{ width: 44, height: 44, borderRadius: 999, background: '#F9B318', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6), 0 6px 18px rgba(249,179,24,0.30)', flexShrink: 0, transition: 'transform 100ms ease-out, filter 100ms ease-out' }}
                  onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.97)')}
                  onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
                  onTouchStart={e => { e.currentTarget.style.transform = 'scale(0.97)' }}
                  onTouchEnd={e => { e.currentTarget.style.transform = 'scale(1)' }}
                  title="QRスキャンで入店"
                  aria-label="プレイヤーのQRを読み取って入店させる"
                >
                  <ScanIcon size={20} color="white" />
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
              <div style={{ borderTop: '1px solid var(--sep)', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px' }}>
                {ownedStores.map(s => (
                  <button key={s.id} onClick={() => switchStore(s.id)} style={{ width: 46, height: 46, borderRadius: 14, padding: 0, border: 'none', cursor: 'pointer', flexShrink: 0, outline: s.id === storeId ? '2.5px solid #F9B318' : '2px solid transparent', outlineOffset: 2, background: 'transparent', transition: 'outline .15s' }}>
                    {s.iconUrl
                      ? <img src={s.iconUrl} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 14 }}/>
                      : <div style={{ width: '100%', height: '100%', borderRadius: 14, background: '#F9B318', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: 'white', fontWeight: 800 }}>店</div>
                    }
                  </button>
                ))}
                <button onClick={() => router.push('/home/store/branch/new')} style={{ width: 46, height: 46, borderRadius: 14, border: '2px dashed rgba(60,60,67,0.25)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <PlusIcon size={18} style={{ color: 'var(--label2)' }}/>
                </button>
                <span style={{ fontSize: 11, color: 'var(--label3)', marginLeft: 8 }}>系列店を切替 / 追加</span>
              </div>
            </div>
          </div>

          {/* ── 長押しポップオーバー ── */}
          {showStorePicker && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 100 }} onClick={() => setShowStorePicker(false)}/>
              <div className="a-dialog" style={{ position: 'absolute', top: 76, left: 16, zIndex: 101, padding: 16, minWidth: 220, transformOrigin: 'top left', animation: 'aDialogIn 280ms cubic-bezier(0.2, 0.9, 0.3, 1) both' }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--label2)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 16 }}>アカウント切替</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {ownedStores.map(s => (
                    <button key={s.id} onClick={() => switchStore(s.id)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: s.id === storeId ? 'rgba(249,179,24,0.08)' : 'transparent', border: 'none', cursor: 'pointer', borderRadius: 12, padding: '8px 8px', width: '100%', textAlign: 'left' }}>
                      {s.iconUrl
                        ? <img src={s.iconUrl} style={{ width: 36, height: 36, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }}/>
                        : <div style={{ width: 36, height: 36, borderRadius: 10, background: '#F9B318', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'white', fontWeight: 800, flexShrink: 0 }}>店</div>
                      }
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--label)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</p>
                        {s.id === storeId && <p style={{ fontSize: 11, color: '#F9B318', fontWeight: 600 }}>表示中</p>}
                      </div>
                      {s.id === storeId && <CheckIcon size={14} style={{ color: '#F9B318', flexShrink: 0 }}/>}
                    </button>
                  ))}
                </div>
                <div style={{ height: 1, background: 'var(--sep)', margin: '8px 0' }}/>
                <button onClick={() => { setShowStorePicker(false); router.push('/home/store/branch/new') }} style={{ display: 'flex', alignItems: 'center', gap: 8, border: 'none', cursor: 'pointer', borderRadius: 12, padding: '8px 8px', width: '100%', textAlign: 'left', background: 'transparent' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--fill)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <PlusIcon size={16} style={{ color: 'var(--label2)' }}/>
                  </div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--label)' }}>系列店を追加</p>
                </button>
              </div>
            </>
          )}
        </div>

        {/* ── Tournaments ── */}
        <div className="su d1" style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, padding: '0 2px' }}>
            <p className="section-hd" style={{ marginBottom: 0 }}>LIVE TOURNAMENTS</p>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            {activeTournaments.length >= 2 && (
              <button type="button" onClick={() => { setSplitIds(activeTournaments.slice(0, 4).map(t => t.id)); setSplitOpen(true) }} className="gl-press"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 44, padding: '0 16px', borderRadius: 999, border: '1px solid var(--a-sep, rgba(60,60,67,0.18))', background: '#fff', color: 'var(--label)', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
                <LayoutGridIcon size={16} /> <span className="tech-label" style={{ fontSize: 13 }}>SPLIT</span>
              </button>
            )}
            {activeTournaments.length > 0 && (
              <span className="con-mono" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 700, color: '#34C759', background: 'rgba(52,199,89,0.10)', border: '1px solid rgba(52,199,89,0.22)', borderRadius: 8, padding: '3px 8px' }}>
                <span className="tech-status-dot" style={{ background: '#34C759' }} />
                {activeTournaments.length} 件
              </span>
            )}
            </span>
          </div>

          {activeTournaments.length === 0 ? (
            <div className="ios-card" style={{ padding: '32px 24px', textAlign: 'center' }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--fill)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px' }}>
                <ClockIcon size={22} style={{ color: 'var(--label3)' }}/>
              </div>
              <p className="term-comment" style={{ fontSize: 13, color: 'var(--label2)' }}>開催中のトーナメントはありません</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {activeTournaments.map(t => {
                return (
                  <div key={t.id} className="ios-card su con-live-panel" style={{ overflow: 'hidden' }}>
                    <div className="gold-line"/>
                    <div style={{ padding: '16px 16px 16px', position: 'relative', zIndex: 1 }}>

                      {/* ヘッダー。稼働中なので名前の後ろにカーソルを置く。 */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 8 }}>
                        <p className="tech-caret" style={{ fontFamily: 'var(--stack-mono)', fontSize: 15.5, fontWeight: 800, color: 'var(--label)', letterSpacing: '0.01em', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</p>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: '#1E7B34' }}>LIVE</span>
                          <span className="tech-status-dot" style={{ background: '#34C759' }} />
                        </span>
                      </div>

                      {/* Fee / Stack info */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2px 8px', marginBottom: 16, padding: '8px 8px', background: 'var(--fill)', borderRadius: 10 }}>
                        {[
                          { label: 'Entry',   fee: Number(t.entryFee),   stack: Number(t.entryStack) },
                          { label: 'Re-entry', fee: Number(t.reentryFee), stack: Number(t.reentryStack) },
                          { label: 'Add-on',  fee: Number(t.addonFee),   stack: Number(t.addonStack) },
                        ].map(item => (
                          <div key={item.label} style={{ textAlign: 'center' }}>
                            <p className="tech-label tech-label-bracket" style={{ fontSize: 11, color: 'var(--label3)', marginBottom: 8 }}>{item.label}</p>
                            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 2, marginBottom: 2 }}>
                              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--label2)' }}>Fee</span>
                              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--label)' }}>
                                {item.fee > 0 ? item.fee.toLocaleString() : '—'}
                              </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 2 }}>
                              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--label2)' }}>Stack</span>
                              <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--label2)' }}>
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
                        marginBottom: 16,
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
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                        <button className="action-btn btn-gold" onClick={() => openTimer(t.id)}>
                          <ClockIcon size={16}/> TIMER
                        </button>
                        <button className="action-btn btn-gold" onClick={() => openAdjustModal(t.id, getLiveLevelState(t).remainingSec, t.customBlindLevels)}>
                          <PenLineIcon size={16}/> ADJUST
                        </button>
                        <button className="action-btn btn-gold" onClick={() => setShowPlayerModal(t.id)}>
                          <UsersIcon size={16}/> PLAYERS
                        </button>
                        <button className="action-btn btn-gold" onClick={() => setShowPrizeModal(t.id)} disabled={t.status !== "active"} style={{ opacity: t.status !== "active" ? 0.4 : 1 }}>
                          <DollarSignIcon size={16}/> PAY OUT
                        </button>
                      </div>

                      {/* プレイヤーの端末から確定したリエントリー / アドオン。
                          その場で取り消せるようにしておく(承認に技術的な鍵が無いため)。 */}
                      <TournamentPurchaseLog
                        tournamentId={t.id}
                        storeId={storeId!}
                        canRevoke={t.status === "active"}
                        unitLabel={store?.chipUnitLabel && store.chipUnitLabel !== "単位なし" ? store.chipUnitLabel : ""}
                        unitBefore={store?.chipUnitBefore !== false}
                      />

                      {/* Timer controls */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, paddingTop: 16, borderTop: '1px solid var(--sep)' }}>
                        <button className="timer-btn" onClick={() => prevLevel(t.id)}
                          style={{ width: 44, height: 44, borderRadius: '50%', background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: '1px solid var(--sep)' }}
                        ><SkipBackIcon size={17} style={{ color: 'var(--label)' }}/></button>

                        <button className="timer-btn" onClick={() => toggleTimer(t.id)}
                          style={{ width: 56, height: 56, borderRadius: '50%', background: '#F9B318', boxShadow: '0 4px 14px rgba(249,179,24,0.32)' }}
                        >
                          {timerRunning[t.id] ? <PauseIcon size={20} style={{ color: 'white' }}/> : <PlayIcon size={20} style={{ color: 'white', marginLeft: 2 }}/>}
                        </button>

                        <button className="timer-btn" onClick={() => nextLevel(t.id)}
                          style={{ width: 44, height: 44, borderRadius: '50%', background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: '1px solid var(--sep)' }}
                        ><SkipForwardIcon size={17} style={{ color: 'var(--label)' }}/></button>

                        <button className="timer-btn" onClick={() => setExpandedTimerId(t.id)}
                          style={{ width: 44, height: 44, borderRadius: '50%', background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: '1px solid var(--sep)' }}
                        ><Maximize2Icon size={16} style={{ color: 'var(--label)' }}/></button>
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
            alignItems: 'center', justifyContent: 'center', gap: 8, background: 'none',
          }
          const iconCircle = (gold?: boolean): React.CSSProperties => ({
            width: gold ? 52 : 42, height: gold ? 52 : 42, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: gold ? '#F9B318' : 'rgba(255,255,255,0.14)',
            border: gold ? 'none' : '1px solid rgba(255,255,255,0.22)',
            boxShadow: gold ? '0 4px 14px rgba(249,179,24,0.38)' : 'none',
          })
          const labelStyle: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }
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

                {/* 表示用の画面なのでボタンは常には出さない。画面のどこかをタップすると操作バーが出て、
                    5 秒触らなければ消える(iPhone の動画再生と同じ)。閉じるは操作バーの中にある。 */}
                {!expandCtrlVisible && (
                  <button
                    type="button"
                    aria-label="操作を表示"
                    onClick={() => setExpandCtrlVisible(true)}
                    style={{ position: 'absolute', inset: 0, background: 'transparent', border: 'none', cursor: 'pointer', zIndex: 1 }}
                  />
                )}

                {/* コントロールバー */}
                {et && expandCtrlVisible && (
                  <div onPointerDown={() => setExpandCtrlTouch(n => n + 1)} style={{
                    position: 'absolute',
                    bottom: 0, left: 0, right: 0,
                    background: 'rgba(0,0,0,0.72)',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                    borderTop: '1px solid rgba(255,255,255,0.10)',
                    padding: '8px 16px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}>
                    {/* 左: CLOSE + HIDE */}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => { setExpandedTimerId(null); setExpandCtrlVisible(false) }} style={btnBase}>
                        <div style={iconCircle()}>
                          <XIcon size={17} style={{ color: '#fff' }} />
                        </div>
                        <span style={labelStyle}>閉じる</span>
                      </button>
                      <button onClick={() => setExpandCtrlVisible(false)} style={btnBase}>
                        <div style={iconCircle()}>
                          <ChevronDownIcon size={17} style={{ color: '#fff' }} />
                        </div>
                        <span style={labelStyle}>隠す</span>
                      </button>
                    </div>

                    {/* 中央: タイマー制御 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <button className="timer-btn" onClick={() => prevLevel(et.id)} style={btnBase}>
                        <div style={iconCircle()}>
                          <SkipBackIcon size={17} style={{ color: '#fff' }} />
                        </div>
                        <span style={labelStyle}>前へ</span>
                      </button>
                      <button className="timer-btn" onClick={() => toggleTimer(et.id)} style={btnBase}>
                        <div style={iconCircle(true)}>
                          {timerRunning[et.id]
                            ? <PauseIcon size={20} style={{ color: '#fff' }} />
                            : <PlayIcon size={20} style={{ color: '#fff', marginLeft: 2 }} />}
                        </div>
                        <span style={{ ...labelStyle, color: 'rgba(249,179,24,0.8)' }}>
                          {timerRunning[et.id] ? 'PAUSE' : 'START'}
                        </span>
                      </button>
                      <button className="timer-btn" onClick={() => nextLevel(et.id)} style={btnBase}>
                        <div style={iconCircle()}>
                          <SkipForwardIcon size={17} style={{ color: '#fff' }} />
                        </div>
                        <span style={labelStyle}>Next</span>
                      </button>
                    </div>

                    {/* 右: アクション */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <button onClick={() => openAdjustModal(et.id, getLiveLevelState(et).remainingSec, et.customBlindLevels)} style={btnBase}>
                        <div style={iconCircle()}>
                          <PenLineIcon size={15} style={{ color: '#fff' }} />
                        </div>
                        <span style={labelStyle}>ADJUST</span>
                      </button>
                      <button onClick={() => setExpandPlayerOpen(true)} style={btnBase}>
                        <div style={iconCircle()}>
                          <UsersIcon size={15} style={{ color: '#fff' }} />
                        </div>
                        <span style={labelStyle}>PLAYERS</span>
                      </button>
                      <button onClick={() => setExpandPrizeOpen(true)} style={btnBase}>
                        <div style={iconCircle()}>
                          <DollarSignIcon size={15} style={{ color: '#fff' }} />
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


        {/* ── Expand: インライン Players Modal - Apple Bottom-Sheet (z:10001) ── */}
        {expandPlayerOpen && expandedTimerId && (() => {
          const et = activeTournaments.find(t => t.id === expandedTimerId)
          if (!et) return null
          return (
            <PlayerManageModal
                  tournamentId={et.id}
                  storeId={storeId}
                  balanceGroupId={store?.balanceGroupId ?? storeId ?? undefined}
                  chipUnit={store?.chipUnitLabel}
                  chipUnitBefore={store?.chipUnitBefore}
                  onClose={() => setExpandPlayerOpen(false)}
                zIndex={10001}
                />
          )
        })()}

        {/* ── Expand: インライン Prize Modal - Apple Bottom-Sheet (z:10001) ── */}
        {expandPrizeOpen && expandedTimerId && (() => {
          const et = activeTournaments.find(t => t.id === expandedTimerId)
          if (!et) return null
          return (
            <PrizeDistributeModal
                  tournamentId={et.id}
                  storeId={storeId}
                  balanceGroupId={store?.balanceGroupId ?? storeId ?? undefined}
                  chipUnit={store?.chipUnitLabel}
                  chipUnitBefore={store?.chipUnitBefore}
                  onClose={() => setExpandPrizeOpen(false)}
                zIndex={10001}
                />
          )
        })()}

        {/* ── 時間・ブラインドの調整(下から出るシート) ── */}
        {activeTournaments.map(t => {
          const tab = adjustTab[t.id] ?? 'time'
          const sec = adjustSeconds[t.id] ?? 0
          return (
            <AppleSheet
              key={`adj-${t.id}`}
              open={!!adjustModalOpen[t.id]}
              onClose={() => closeAdjustModal(t.id)}
              maxWidth={560}
              maxHeightVh={92}
              zIndex={10001}
              title={
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: '-0.01em' }}>時間・ブラインドの調整</p>
                      <p style={{ fontSize: 13, color: 'var(--label2)', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</p>
                    </div>
                    <button type="button" onClick={() => closeAdjustModal(t.id)} aria-label="閉じる"
                      style={{ width: 44, height: 44, borderRadius: 22, background: 'var(--fill)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--label)', marginRight: -8 }}>
                      <XIcon size={20} />
                    </button>
                  </div>
                  {/* セグメント(iOS の切り替え) */}
                  <div role="tablist" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, padding: 4, marginTop: 16, background: 'rgba(118,118,128,0.12)', borderRadius: 12 }}>
                    {(['time', 'blind'] as const).map(tb => (
                      <button key={tb} type="button" role="tab" aria-selected={tab === tb} onClick={() => setAdjustTab(p => ({ ...p, [t.id]: tb }))}
                        style={{ minHeight: 44, borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 15, fontWeight: tab === tb ? 600 : 500,
                          background: tab === tb ? '#fff' : 'transparent', color: 'var(--label)', boxShadow: tab === tb ? '0 1px 3px rgba(0,0,0,0.12)' : 'none', fontFamily: 'inherit' }}>
                        {tb === 'time' ? '残り時間' : 'ブラインド表'}
                      </button>
                    ))}
                  </div>
                </div>
              }
              footer={
                <button type="button" onClick={() => tab === 'time' ? confirmAdjustTime(t.id) : confirmAdjustBlinds(t.id)} className="action-btn btn-gold" style={{ width: '100%' }}>
                  {tab === 'time' ? 'この残り時間にする' : 'このブラインド表にする'}
                </button>
              }
            >
              {tab === 'time' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: '8px 0 16px' }}>
                  <p aria-live="polite" style={{ textAlign: 'center', fontSize: 64, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1, margin: 0, fontVariantNumeric: 'tabular-nums', color: 'var(--label)' }}>
                    {String(Math.floor(sec / 60)).padStart(2, "0")}<span style={{ color: 'var(--label3)', fontWeight: 400 }}>:</span>{String(sec % 60).padStart(2, "0")}
                  </p>
                  <input type="range" min={0} max={7200} step={10} value={sec} aria-label="残り時間"
                    onChange={e => setAdjustSeconds(p => ({ ...p, [t.id]: Number(e.target.value) }))}
                    style={{ width: '100%', height: 44, accentColor: '#F9B318', cursor: 'pointer' }} />
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                    {[{ label: '−1分', diff: -60 }, { label: '−10秒', diff: -10 }, { label: '+10秒', diff: 10 }, { label: '+1分', diff: 60 }].map(b => (
                      <button key={b.label} type="button" onClick={() => updateAdjustTime(t.id, b.diff)} className="action-btn"
                        style={{ background: 'rgba(118,118,128,0.12)', color: 'var(--label)', fontVariantNumeric: 'tabular-nums' }}>
                        {b.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ padding: '8px 0' }}>
                  <BlindLevelEditor
                    levels={adjustBlindLevels[t.id] ?? []}
                    onChange={ls => setAdjustBlindLevels(p => ({ ...p, [t.id]: ls }))}
                    showAddButtons
                  />
                </div>
              )}
            </AppleSheet>
          )
        })}

        {/* ── Withdraw Requests ── */}
        {withdrawRequests.length > 0 && (
          <div className="su d2" style={{ marginTop: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, padding: '0 2px' }}>
              <p className="section-hd" style={{ marginBottom: 0 }}>引き出しリクエスト</p>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#fff', background: '#FF3B30', borderRadius: 99, padding: '2px 8px', animation: 'badge-pop .4s cubic-bezier(.22,1,.36,1)' }}>{withdrawRequests.length}</span>
            </div>
            <div className="ios-card" style={{ overflow: 'hidden' }}>
              {withdrawRequests.map((req, idx) => (
                <div key={req.id} style={{ padding: '16px 16px', borderBottom: idx < withdrawRequests.length - 1 ? '1px solid var(--sep)' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(255,59,48,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <MinusIcon size={14} style={{ color: '#FF3B30' }}/>
                      </div>
                      <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--label)' }}>{playerMap[req.playerId]?.name ?? req.playerId}</p>
                    </div>
                    <p style={{ fontSize: 18, fontWeight: 900, color: '#FF3B30', letterSpacing: '-0.3px' }}>{req.amount.toLocaleString()}</p>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                    {[
                      { label: 'リング', type: 'buyin' as const },
                      { label: 'Entry', type: 'tE' as const },
                      { label: 'Re-entry', type: 'tR' as const },
                      { label: 'Add-on', type: 'tA' as const },
                      { label: 'その他', type: 'other' as const, special: true },
                      { label: '却下', type: null },
                    ].map((b, i) => (
                      <button key={i}
                        className="req-action"
                        onClick={() => {
                          const who = playerMap[req.playerId]?.name ?? req.playerId
                          if (b.type === null) setConfirmReq({ title: '引き出しを却下', message: `${who} の ${req.amount.toLocaleString()} の引き出しを却下します。`, action: '却下', destructive: true, run: () => rejectWithdraw(req) })
                          else if (b.special) setWithdrawOtherOpenId(req.id)
                          else setConfirmReq({ title: `${b.label}で引き出し`, message: `${who} の残高から ${req.amount.toLocaleString()} を引き出します。`, action: '承認', run: () => approveWithdrawWithType(req, b.type as any) })
                        }}
                        style={{ background: b.type === null ? 'rgba(255,59,48,0.07)' : 'rgba(255,59,48,0.85)', color: b.type === null ? '#FF3B30' : '#fff', border: b.type === null ? '1px solid rgba(255,59,48,0.2)' : 'none' }}
                      >{b.label}</button>
                    ))}
                  </div>
                  {withdrawOtherOpenId === req.id && (
                    <div style={{ marginTop: 8, background: 'rgba(249,179,24,0.07)', border: '1px solid rgba(249,179,24,0.2)', borderRadius: 14, padding: '16px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--label)', fontWeight: 500 }}>
                        <input type="checkbox" checked={withdrawOtherNetGain} onChange={e => setWithdrawOtherNetGain(e.target.checked)} style={{ accentColor: '#F9B318' }}/>
                        純増する
                      </label>
                      <input value={withdrawOtherComment} onChange={e => setWithdrawOtherComment(e.target.value)}
                        style={{ height: 40, borderRadius: 10, border: '1.5px solid var(--sep)', background: '#fff', padding: '0 16px', fontSize: 14, outline: 'none', color: 'var(--label)' }}
                        placeholder="コメントを入力"
                      />
                      <button onClick={() => approveWithdrawWithType(req, "other")}
                        style={{ height: 44, borderRadius: 10, background: '#F9B318', color: '#fff', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer', boxShadow: '0 2px 8px rgba(249,179,24,0.25)' }}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, padding: '0 2px' }}>
              <p className="section-hd" style={{ marginBottom: 0 }}>預け入れリクエスト</p>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#fff', background: '#34C759', borderRadius: 99, padding: '2px 8px', animation: 'badge-pop .4s cubic-bezier(.22,1,.36,1)' }}>{depositRequests.length}</span>
            </div>
            <div className="ios-card" style={{ overflow: 'hidden' }}>
              {depositRequests.map((req, idx) => (
                <div key={req.id} style={{ padding: '16px 16px', borderBottom: idx < depositRequests.length - 1 ? '1px solid var(--sep)' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(52,199,89,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <PlusIcon size={14} style={{ color: '#34C759' }}/>
                      </div>
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--label)' }}>{playerMap[req.playerId]?.name ?? req.playerId}</p>
                        {req.comment && <p style={{ fontSize: 11, color: 'var(--label2)', marginTop: 1 }}>{req.comment}</p>}
                      </div>
                    </div>
                    <p style={{ fontSize: 18, fontWeight: 900, color: '#34C759', letterSpacing: '-0.3px' }}>{req.amount.toLocaleString()}</p>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>
                    {[
                      { label: 'キャッシュアウト', type: 'cashout' as const },
                      { label: 'チップ購入', type: 'chip' as const },
                      { label: 'その他', type: 'other' as const, special: true },
                      { label: '却下', type: null },
                    ].map((b, i) => (
                      <button key={i}
                        className="req-action"
                        onClick={() => {
                          const who = playerMap[req.playerId]?.name ?? req.playerId
                          if (b.type === null) setConfirmReq({ title: '預け入れを却下', message: `${who} の ${req.amount.toLocaleString()} の預け入れを却下します。`, action: '却下', destructive: true, run: () => rejectDeposit(req) })
                          else if (b.special) setDepositOtherOpenId(req.id)
                          else setConfirmReq({ title: `${b.label}で預け入れ`, message: `${who} の残高に ${req.amount.toLocaleString()} を加えます。`, action: '承認', run: () => approveDepositWithType(req, b.type as any) })
                        }}
                        style={{ background: b.type === null ? 'rgba(255,59,48,0.07)' : 'rgba(52,199,89,0.85)', color: b.type === null ? '#FF3B30' : '#fff', border: b.type === null ? '1px solid rgba(255,59,48,0.2)' : 'none' }}
                      >{b.label}</button>
                    ))}
                  </div>
                  {depositOtherOpenId === req.id && (
                    <div style={{ marginTop: 8, background: 'rgba(249,179,24,0.07)', border: '1px solid rgba(249,179,24,0.2)', borderRadius: 14, padding: '16px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--label)', fontWeight: 500 }}>
                        <input type="checkbox" checked={depositOtherNetGain} onChange={e => setDepositOtherNetGain(e.target.checked)} style={{ accentColor: '#F9B318' }}/>
                        純増する
                      </label>
                      <input value={depositOtherComment} onChange={e => setDepositOtherComment(e.target.value)}
                        style={{ height: 40, borderRadius: 10, border: '1.5px solid var(--sep)', background: '#fff', padding: '0 16px', fontSize: 14, outline: 'none', color: 'var(--label)' }}
                        placeholder="コメントを入力"
                      />
                      <button onClick={() => approveDepositWithType(req, "other")}
                        style={{ height: 44, borderRadius: 10, background: '#F9B318', color: '#fff', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer', boxShadow: '0 2px 8px rgba(249,179,24,0.25)' }}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, padding: '0 2px' }}>
              <p className="section-hd" style={{ marginBottom: 0 }}>入店申請</p>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#1a1a1a', background: '#FFD60A', borderRadius: 99, padding: '2px 8px' }}>{pendingPlayers.length}</span>
            </div>
            <div className="ios-card" style={{ overflow: 'hidden' }}>
              {pendingPlayers.map((player, idx) => (
                <div key={player.id} style={{ padding: '16px 16px', borderBottom: idx < pendingPlayers.length - 1 ? '1px solid var(--sep)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }} onClick={() => setProfileUid(player.id)}>
                    {player.iconUrl
                      ? <img src={player.iconUrl} style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover' }}/>
                      : <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--fill)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><UserIcon size={16} style={{ color: 'var(--label2)' }}/></div>
                    }
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--label)' }}>{player.name}</p>
                      <p style={{ fontSize: 11, color: 'var(--label2)', marginTop: 1 }}>来店 {player.visitCount ?? 0}回 · 前回 {formatDateTime(player.lastVisitedAt)}</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => approvePlayer(player.id)}
                      style={{ height: 44, width: 52, borderRadius: 10, background: '#34C759', color: '#fff', fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer' }}
                    >許可</button>
                    <button onClick={() => setConfirmReq({ title: '入店を却下', message: `${player.name} の入店申請を却下します。`, action: '却下', destructive: true, run: () => rejectPlayer(player.id) })}
                      style={{ height: 44, width: 52, borderRadius: 10, background: 'var(--fill)', color: 'var(--label2)', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer' }}
                    >却下</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Players Section ── */}
        <div style={{ marginTop: 32 }}>

          {/* Section header + stats */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 16 }}>
            <p className="section-hd" style={{ marginBottom: 0 }}>プレイヤー</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* Total balance of in-store players */}
              {inPlayers.length > 0 && (
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--label)', fontVariantNumeric: 'tabular-nums' }}>
                  合計 {fmtChip(inPlayers.reduce((s, p) => s + (p.balance ?? 0), 0), store?.chipUnitLabel, store?.chipUnitBefore)}
                </span>
              )}
              {/* In-store count badge */}
              <span style={{ fontSize: 12, fontWeight: 800, background: 'linear-gradient(135deg, #34C759 0%, #30B452 100%)', color: '#fff', borderRadius: 99, padding: '8px 8px', boxShadow: '0 2px 8px rgba(52,199,89,0.25)' }}>
                {inPlayers.length}名
              </span>
            </div>
          </div>

          {/* Main card */}
          <div className="ios-card" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.08)', borderRadius: 20 }}>

            {/* Search */}
            <div style={{ padding: '16px 16px 0' }}>
              <div style={{ position: 'relative' }}>
                <SearchIcon size={15} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--label2)', pointerEvents: 'none' }}/>
                <input
                  type="text" value={playerSearchInput} onChange={e => setPlayerSearchInput(e.target.value)}
                  placeholder="名前・IDで検索…"
                  style={{ width: '100%', height: 42, borderRadius: 13, border: 'none', background: 'var(--fill)', paddingLeft: 40, paddingRight: playerSearchInput ? 36 : 13, fontSize: 14, color: 'var(--label)', outline: 'none', boxSizing: 'border-box', transition: 'background 0.2s ease' }}
                />
                {playerSearchInput && (
                  <button onClick={() => setPlayerSearchInput("")} style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', width: 44, height: 44, borderRadius: '50%', background: 'rgba(60,60,67,0.3)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'transform 0.15s ease, opacity 0.15s ease, background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease' }}>
                    <XIcon size={10} style={{ color: '#fff' }}/>
                  </button>
                )}
                {playerSearchInput && filteredPlayers.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20, marginTop: 8, background: '#fff', borderRadius: 15, boxShadow: '0 10px 40px rgba(0,0,0,0.12)', border: '1px solid var(--sep)', overflow: 'hidden' }}>
                    {filteredPlayers.map((p, i) => (
                      <button key={p.id} onClick={() => selectPlayer(p.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '16px 16px', textAlign: 'left', background: 'none', border: 'none', borderBottom: i < filteredPlayers.length - 1 ? '1px solid var(--sep)' : 'none', cursor: 'pointer', transition: 'background 0.15s ease' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(249,179,24,0.02)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'none'}
                      >
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--fill)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <UserIcon size={13} style={{ color: 'var(--label2)' }}/>
                        </div>
                        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--label)' }}>{p.name || '(不明なプレイヤー)'}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Segmented tabs */}
            <div style={{ padding: '16px 16px 16px' }}>
              <div style={{ display: 'flex', background: 'var(--fill)', borderRadius: 13, padding: 8, gap: 8 }}>
                {(['in', 'out'] as const).map(tab => (
                  <button key={tab} onClick={() => setActiveTab(tab)} style={{
                    flex: 1, height: 44, borderRadius: 11, border: 'none', cursor: 'pointer',
                    fontSize: 13, fontWeight: 700, transition: 'transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.22s cubic-bezier(0.34, 1.56, 0.64, 1), background-color 0.22s cubic-bezier(0.34, 1.56, 0.64, 1), border-color 0.22s cubic-bezier(0.34, 1.56, 0.64, 1), color 0.22s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.22s cubic-bezier(0.34, 1.56, 0.64, 1)',
                    background: activeTab === tab ? '#fff' : 'transparent',
                    color: activeTab === tab ? 'var(--label)' : 'var(--label2)',
                    boxShadow: activeTab === tab ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
                  }}>
                    {tab === 'in' ? `在店中 ${inPlayers.length}` : `退店済 ${outPlayers.length}`}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ height: 1, background: 'var(--sep)' }}/>

            {/* Player rows */}
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
                  {merged.map((player, idx) => (
                    <div key={player.id} style={{
                      display: 'flex', alignItems: 'center', padding: '16px 16px',
                      gap: 16,
                      borderBottom: idx < merged.length - 1 ? '1px solid var(--sep)' : 'none',
                      background: selectedPlayerId === player.id ? 'rgba(249,179,24,0.06)' : 'transparent',
                      opacity: removingAdjustmentPlayerIds.includes(player.id) ? 0 : 1,
                      transition: 'opacity 0.28s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.18s ease',
                    }}>
                      {/* Avatar — circle with green online dot */}
                      <div style={{ position: 'relative', flexShrink: 0, cursor: 'pointer', transition: 'transform 0.2s ease' }} onClick={() => setProfileUid(player.id)}>
                        {player.iconUrl
                          ? <img src={player.iconUrl} style={{ width: 46, height: 46, borderRadius: '50%', objectFit: 'cover', display: 'block', boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}/>
                          : <div style={{ width: 46, height: 46, borderRadius: '50%', background: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(249,179,24,0.25)' }}>
                              {player.name
                                ? <span style={{ fontSize: 18, fontWeight: 800, color: '#fff', lineHeight: 1 }}>{player.name.charAt(0)}</span>
                                : <UserIcon size={20} style={{ color: '#fff' }}/>
                              }
                            </div>
                        }
                        {player.isInStore && (
                          <div style={{ position: 'absolute', bottom: -1, right: -1, width: 15, height: 15, borderRadius: '50%', background: '#34C759', border: '3px solid #fff', boxShadow: '0 2px 4px rgba(0,0,0,0.15)' }}/>
                        )}
                      </div>

                      {/* Name + balance */}
                      <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => setProfileUid(player.id)}>
                        <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--label)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '-0.3px' }}>
                          {player.name || <span style={{ color: 'var(--label2)', fontStyle: 'italic', fontWeight: 500, fontSize: 14 }}>不明なプレイヤー</span>}
                        </p>
                        {/* Balance + net gain: flexWrap so they break before hitting buttons */}
                        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--label)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                            {fmtChip(player.balance, store?.chipUnitLabel, store?.chipUnitBefore)}
                          </span>
                          <span style={{
                            fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums', flexShrink: 0,
                            color: player.netGain >= 0 ? '#30B452' : '#FF453A',
                            background: player.netGain >= 0 ? 'rgba(52,199,89,0.12)' : 'rgba(255,69,58,0.1)',
                            borderRadius: 6, padding: '2px 8px',
                          }}>
                            {player.netGain >= 0 ? '+' : ''}{fmtChip(player.netGain, store?.chipUnitLabel, store?.chipUnitBefore)}
                          </span>
                        </div>
                        {/* Player ID: always on its own line to prevent button collision */}
                        {player.playerId && (
                          <p style={{ fontSize: 11, color: 'var(--label2)', fontVariantNumeric: 'tabular-nums', margin: '3px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '0.2px' }}>
                            ID: {player.playerId}
                          </p>
                        )}
                      </div>

                      {/* Action buttons — 36px touch targets */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        <button onClick={() => setHistoryPlayerId(player.id)}
                          style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--fill)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'transform 0.18s ease, opacity 0.18s ease, background-color 0.18s ease, border-color 0.18s ease, color 0.18s ease, box-shadow 0.18s ease' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(120,120,128,0.2)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'var(--fill)'}
                        ><ClockIcon size={15} style={{ color: 'var(--label2)', transition: 'color 0.15s ease' }}/></button>

                        <button onClick={() => { setAdjustModalPlayer(player); setAdjustError("") }}
                          style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--gold)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 8px rgba(249,179,24,0.35)', transition: 'transform 0.18s ease, opacity 0.18s ease, background-color 0.18s ease, border-color 0.18s ease, color 0.18s ease, box-shadow 0.18s ease' }}
                          onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(249,179,24,0.45)'}
                          onMouseLeave={e => e.currentTarget.style.boxShadow = '0 2px 8px rgba(249,179,24,0.35)'}
                        ><DollarSignIcon size={16} style={{ color: '#fff' }}/></button>

                        {player.isInStore ? (
                          <button
                            onClick={async () => {
                              setRemovingAdjustmentPlayerIds(p => [...p, player.id])
                              setTimeout(async () => {
                                await setDoc(doc(db, "users", player.id), { currentStoreId: deleteField(), checkinStatus: "none", pendingStoreId: null }, { merge: true })
                                setRemovingAdjustmentPlayerIds(p => p.filter(id => id !== player.id))
                              }, 280)
                            }}
                            style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(255,59,48,0.1)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'transform 0.18s ease, opacity 0.18s ease, background-color 0.18s ease, border-color 0.18s ease, color 0.18s ease, box-shadow 0.18s ease' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,59,48,0.15)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,59,48,0.1)'}
                          ><LogOutIcon size={15} style={{ color: '#FF3B30' }}/></button>
                        ) : activeTab === "out" && storeId && (
                          <button
                            onClick={async () => {
                              await setDoc(doc(db, "users", player.id), { currentStoreId: storeId, checkinStatus: "approved", pendingStoreId: null }, { merge: true })
                            }}
                            style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(52,199,89,0.12)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'transform 0.18s ease, opacity 0.18s ease, background-color 0.18s ease, border-color 0.18s ease, color 0.18s ease, box-shadow 0.18s ease' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(52,199,89,0.18)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'rgba(52,199,89,0.12)'}
                          ><LogInIcon size={15} style={{ color: '#34C759' }}/></button>
                        )}
                      </div>
                    </div>
                  ))}
                  {merged.length === 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 24px', gap: 8 }}>
                      <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--fill)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <UsersIcon size={24} style={{ color: 'var(--label2)' }}/>
                      </div>
                      <p style={{ fontSize: 14, color: 'var(--label)', margin: 0, fontWeight: 600 }}>
                        {activeTab === "in" ? "在店中のプレイヤーがいません" : "退店済みのプレイヤーがいません"}
                      </p>
                      <p style={{ fontSize: 12, color: 'var(--label2)', margin: 0, textAlign: 'center' }}>
                        {activeTab === "in" ? "プレイヤーが入店すると表示されます" : "プレイヤー管理でチェックイン状態を確認"}
                      </p>
                    </div>
                  )}
                  {list.length > storePlayersPage * pageSize && (
                    <button onClick={() => setStorePlayersPage(p => p + 1)}
                      style={{ width: '100%', height: 46, background: 'none', border: 'none', borderTop: '1px solid var(--sep)', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: '#1546D9', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'transform 0.2s ease, opacity 0.2s ease, background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(249,179,24,0.03)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    >
                      もっと見る <ChevronDownIcon size={14} style={{ transition: 'transform 0.2s ease' }}/>
                    </button>
                  )}
                </>
              )
            })()}
          </div>{/* /main card */}
        </div>{/* /players section */}
      </div>

      {/* ── Bottom Nav ── */}
      <StoreBottomNav />

      {/* ── Footer ── */}
      <footer style={{ padding: '0 24px 48px', textAlign: 'center', maxWidth: 480, margin: '0 auto' }}>
        <div style={{ height: 1, background: 'var(--sep)', marginBottom: 24 }}/>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 16 }}>

        </div>
        <p style={{ fontSize: 11, color: 'var(--label3)', marginBottom: 3 }}>ver 1.11.0</p>
        <p style={{ fontSize: 11, color: 'var(--label3)', marginBottom: 3 }}>RRPoker by Runner Runner</p>
        <p style={{ fontSize: 11, color: 'var(--label3)' }}>製作者 : なおゆき</p>
        <div style={{ marginTop: 16 }}>
        </div>
      </footer>

      {/* ── Adjust Modal ─────────────────────────────────────────────────── */}
      {adjustModalPlayer && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 999, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}
          onClick={() => { setAdjustModalPlayer(null); setAdjustValue(""); setAdjustError(""); setManualComment("") }}>

          <div style={{ width: '100%', maxWidth: 480, background: '#fff', borderRadius: '24px 24px 0 0', maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 -4px 24px rgba(0,0,0,0.1)', paddingBottom: 'max(16px, env(safe-area-inset-bottom, 16px))' }}
            onClick={e => e.stopPropagation()}>

            {/* Drag handle */}
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 8, flexShrink: 0 }}>
              <div style={{ width: 36, height: 4, borderRadius: 99, background: 'var(--sep)' }}/>
            </div>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 16px 16px', borderBottom: '1px solid var(--sep)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {adjustModalPlayer.iconUrl
                  ? <img src={adjustModalPlayer.iconUrl} style={{ width: 38, height: 38, borderRadius: 10, objectFit: 'cover' }}/>
                  : <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(249,179,24,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <UserIcon size={16} style={{ color: 'var(--gold)' }}/>
                    </div>
                }
                <div>
                  <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--label)', margin: 0 }}>
                    {adjustModalPlayer.name || '不明なプレイヤー'}
                  </p>
                  <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--gold-dk)', margin: '2px 0 0', fontVariantNumeric: 'tabular-nums' }}>
                    {fmtChip(liveAdjustPlayer?.balance ?? 0, store?.chipUnitLabel, store?.chipUnitBefore)}
                  </p>
                </div>
              </div>
              <button onClick={() => { setAdjustModalPlayer(null); setAdjustValue(""); setAdjustError(""); setManualComment("") }}
                style={{ width: 44, height: 44, borderRadius: 9, background: 'var(--fill)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              ><XIcon size={14} style={{ color: 'var(--label3)' }}/></button>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 0' }}>

              {/* Amount input — Apple Cash／Wallet 風の大きな金額表示 */}
              <div style={{ marginBottom: 24 }}>
                <div style={{
                  position: 'relative', background: 'var(--fill)', borderRadius: 18,
                  padding: '24px 48px', display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 3,
                }}>
                  {store?.chipUnitBefore && store?.chipUnitLabel && (
                    <span style={{ fontSize: 22, fontWeight: 700, color: adjustValue ? 'var(--label2)' : 'var(--label3)' }}>{store.chipUnitLabel}</span>
                  )}
                  <input
                    value={adjustValue} onChange={e => { setAdjustValue(e.target.value); setAdjustError("") }}
                    placeholder="0"
                    inputMode="numeric"
                    size={Math.max((adjustValue || '0').length, 1)}
                    style={{
                      border: 'none', background: 'transparent', outline: 'none', padding: 0,
                      fontSize: 40, fontWeight: 800, textAlign: 'center', minWidth: 24, maxWidth: '100%',
                      color: adjustValue ? 'var(--label)' : 'var(--label3)', letterSpacing: '-1px',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  />
                  {!store?.chipUnitBefore && store?.chipUnitLabel && (
                    <span style={{ fontSize: 22, fontWeight: 700, color: adjustValue ? 'var(--label2)' : 'var(--label3)' }}>{store.chipUnitLabel}</span>
                  )}
                  {adjustValue && (
                    <button onClick={() => setAdjustValue("")} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', width: 44, height: 44, borderRadius: '50%', background: 'rgba(120,120,128,0.16)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                      <XIcon size={11} style={{ color: 'var(--label2)' }}/>
                    </button>
                  )}
                </div>
                {adjustError && (
                  <p style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: '#FF3B30', margin: '8px 0 0' }}>{adjustError}</p>
                )}
              </div>

              {/* Ring Game */}
              <div style={{ marginBottom: 16 }}>
                <p className="tech-label tech-label-bracket" style={{ fontSize: 11, color: 'var(--label3)', margin: '0 0 8px' }}>リングゲーム</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                  <ActionTile label="Buy-in" direction="subtract" icon={<SendIcon size={15} style={{ color: '#FF3B30' }}/>} onClick={() => runStoreAdjustment('buyin')} />
                  <ActionTile label="Cash Out" direction="add" icon={<InboxIcon size={15} style={{ color: '#34C759' }}/>} onClick={() => runStoreAdjustment('cashout')} />
                  <ActionTile label="チップ購入" direction="add" icon={<CreditCardIcon size={15} style={{ color: '#34C759' }}/>} onClick={() => runStoreAdjustment('chip')} />
                </div>
              </div>

              {/* Tournament */}
              <div style={{ marginBottom: 16 }}>
                <p className="tech-label tech-label-bracket" style={{ fontSize: 11, color: 'var(--label3)', margin: '0 0 8px' }}>トーナメント</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                  <ActionTile label="Entry" direction="subtract" icon={<PlayIcon size={15} style={{ color: '#FF3B30' }}/>} onClick={() => runStoreAdjustment('tE')} />
                  <ActionTile label="Re-entry" direction="subtract" icon={<RefreshCwIcon size={15} style={{ color: '#FF3B30' }}/>} onClick={() => runStoreAdjustment('tR')} />
                  <ActionTile label="Add-on" direction="subtract" icon={<CirclePlusIcon size={15} style={{ color: '#FF3B30' }}/>} onClick={() => runStoreAdjustment('tA')} />
                </div>
              </div>

              {/* Prize */}
              <div style={{ marginBottom: 16 }}>
                <button
                  type="button"
                  onClick={runPrizeAdjustment}
                  style={{
                    width: '100%', height: 52, borderRadius: 16, border: '1px solid var(--sep)', background: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer', padding: 0,
                    WebkitTapHighlightColor: 'transparent', transition: 'background 0.15s ease, transform 0.12s ease',
                  }}
                  onPointerDown={e => { e.currentTarget.style.background = 'var(--fill)'; e.currentTarget.style.transform = 'scale(0.98)' }}
                  onPointerUp={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.transform = 'scale(1)' }}
                  onPointerLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.transform = 'scale(1)' }}
                >
                  <div style={{ width: 28, height: 28, borderRadius: 9, background: 'rgba(52,199,89,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <AwardIcon size={14} style={{ color: '#34C759' }}/>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--label)' }}>プライズ</span>
                </button>
              </div>

              {/* 手動調整 */}
              <div style={{ borderTop: '1px solid var(--sep)', paddingTop: 16, marginBottom: 8 }}>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--label3)', margin: '0 0 8px' }}>手動調整</p>

                {/* コメント */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--fill)', borderRadius: 12, padding: '0 16px', marginBottom: 8 }}>
                  <MessageSquareIcon size={14} style={{ color: 'var(--label3)', flexShrink: 0 }}/>
                  <input
                    value={manualComment} onChange={e => setManualComment(e.target.value)}
                    placeholder="コメント（任意）"
                    style={{ flex: 1, height: 42, border: 'none', background: 'transparent', outline: 'none', fontSize: 13, color: 'var(--label)' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                  <ActionTile label="手動プラス" direction="add" icon={<PlusIcon size={16} style={{ color: '#34C759' }}/>} onClick={() => runAdjustment('add', manualNetGain)} />
                  <ActionTile label="手動マイナス" direction="subtract" icon={<MinusIcon size={16} style={{ color: '#FF3B30' }}/>} onClick={() => runAdjustment('subtract', manualNetGain)} />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 16px', background: 'var(--fill)', borderRadius: 14 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--label)' }}>純増値も更新</span>
                  <ToggleSwitch checked={manualNetGain} onChange={setManualNetGain} />
                </div>
              </div>

              <ChipDisclaimer className="px-2 pb-4" />
            </div>
          </div>
        </div>
      )}

      {/* ── バンクロールがマイナスになる場合の確認 ── */}
      {negativeConfirmAction && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', padding: '0 24px' }}
          onClick={() => setNegativeConfirmAction(null)}>
          <div style={{ width: '100%', maxWidth: 320, background: '#fff', borderRadius: 22, overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.25)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ padding: '32px 24px 16px', textAlign: 'center' }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(255,59,48,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <TriangleAlertIcon size={24} style={{ color: '#FF3B30' }}/>
              </div>
              <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--label)', marginBottom: 8 }}>バンクロールがマイナスになります</p>
              <p style={{ fontSize: 13, color: 'var(--label2)', lineHeight: 1.5 }}>
                変更後の残高: {fmtChip(negativeConfirmAction.resultingBalance, store?.chipUnitLabel, store?.chipUnitBefore)}
                <br/>このまま続行しますか？
              </p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '0 16px 24px' }}>
              <button
                onClick={() => setNegativeConfirmAction(null)}
                style={{ height: 48, borderRadius: 12, border: 'none', background: 'var(--fill)', color: 'var(--label)', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}
              >Cancel</button>
              <button
                onClick={() => { const action = negativeConfirmAction; setNegativeConfirmAction(null); action?.run() }}
                style={{ height: 48, borderRadius: 12, border: 'none', background: '#FF3B30', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 8px rgba(255,59,48,0.3)' }}
              >続行</button>
            </div>
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
          <div style={{ borderRadius: 20, padding: '16px 16px', display: 'flex', alignItems: 'center', gap: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.2)', animation: 'slideUp .35s cubic-bezier(.22,1,.36,1)', background: qrCheckinResult.success ? 'linear-gradient(135deg,#1C1C1E,#2C2C2E)' : 'linear-gradient(135deg,#FF3B30,#CC2200)' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: qrCheckinResult.success ? 'rgba(52,199,89,0.18)' : 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {qrCheckinResult.success
                ? <CheckIcon size={18} color="#34C759" />
                : <XIcon size={16} style={{ color: 'white' }} />
              }
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'white', letterSpacing: '-0.1px' }}>
                {qrCheckinResult.success ? `${qrCheckinResult.name || 'プレイヤー'} が入店しました` : 'QRコードが無効です'}
              </p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.72)', marginTop: 2 }}>
                {qrCheckinResult.success ? '入店が承認されました' : 'RRPokerのQRコードを読み取ってください'}
              </p>
            </div>
          </div>
        </div>
      )}
    </main>
    </>
  )
}