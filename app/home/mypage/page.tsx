"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { signOut } from "firebase/auth"
import { auth, db } from "@/lib/firebase"
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, where, query } from "firebase/firestore"
import { resizeImageToDataUrl } from "@/lib/image"
import {
  FiHome,
  FiCreditCard,
  FiUser,
  FiEdit2,
  FiCopy,
  FiCheck,
  FiX,
  FiLock,
  FiLogOut,
  FiAlertCircle,
  FiShare2,
  FiStar,
  FiTrash2,
  FiChevronRight,
  FiCamera,
} from "react-icons/fi"
import HomeHeader from "@/components/HomeHeader"
import { getCommonMenuItems } from "@/components/commonMenuItems"
import { useSearchParams } from "next/navigation"

type HandItem = {
  id: string
  title: string
  stakes: { sb: number; bb: number }
  heroPosition: string
  heroCards: string[]
  createdAt?: { seconds?: number }
  note: string
  favorite: boolean
}

const HAND_SUIT_SYM: Record<string, string> = { s: "♠", h: "♥", d: "♦", c: "♣" }
const HAND_SUIT_CLR: Record<string, string> = { s: "#1C1C1E", h: "#e84040", d: "#3b7dd8", c: "#2da44e" }

function MiniCard({ card }: { card: string }) {
  if (!card || card.length < 2) return null
  const rank = card.slice(0, -1)
  const suit = card.slice(-1)
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: 26, height: 34, borderRadius: 6, border: '1px solid rgba(0,0,0,0.1)', background: '#fff', fontWeight: 700, fontSize: 10, color: HAND_SUIT_CLR[suit], boxShadow: '0 1px 3px rgba(0,0,0,0.08)', lineHeight: 1.1 }}>
      <span>{rank}</span><span>{HAND_SUIT_SYM[suit]}</span>
    </span>
  )
}

type UserProfile = {
  name?: string
  iconUrl?: string
  playerId?: string
  rrRating?: number
  birthday?: string
  region?: string
  favoriteHand?: string
  pokerHistory?: string
}

// ── Canvas helpers ────────────────────────────────────────────

function roundRectCanvas(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

async function generateProfileCard(opts: {
  name: string
  playerId: string
  iconUrl?: string
  rrRating: number
  region?: string
  favoriteHand?: string
  pokerHistory?: string
  plays: number
  itmRate: number
  roi: number
  todayTournamentName?: string | null
}): Promise<Blob> {
  const W = 375, H = 640
  const canvas = document.createElement('canvas')
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = W * dpr
  canvas.height = H * dpr
  const ctx = canvas.getContext('2d')!
  ctx.scale(dpr, dpr)
  const FONT = '-apple-system, BlinkMacSystemFont, "Hiragino Kaku Gothic ProN", sans-serif'

  // Background
  const bg = ctx.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, '#1A1A1C')
  bg.addColorStop(1, '#242426')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  // Decorative circles
  ctx.fillStyle = 'rgba(242,169,0,0.04)'
  ctx.beginPath(); ctx.arc(-30, -30, 150, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(W + 30, H * 0.7, 120, 0, Math.PI * 2); ctx.fill()

  // Gold top bar
  const goldGrad = ctx.createLinearGradient(0, 0, W, 0)
  goldGrad.addColorStop(0, '#F2A900')
  goldGrad.addColorStop(1, '#D4910A')
  ctx.fillStyle = goldGrad
  ctx.fillRect(0, 0, W, 5)

  // App branding
  ctx.font = `600 12px ${FONT}`
  ctx.fillStyle = 'rgba(255,255,255,0.35)'
  ctx.textAlign = 'right'
  ctx.fillText('RR Poker', W - 18, 30)

  // Avatar ring
  const CX = W / 2, CY = 108, R = 46
  const ringGrad = ctx.createLinearGradient(CX - R, CY - R, CX + R, CY + R)
  ringGrad.addColorStop(0, '#F2A900'); ringGrad.addColorStop(1, '#D4910A')
  ctx.strokeStyle = ringGrad; ctx.lineWidth = 3
  ctx.beginPath(); ctx.arc(CX, CY, R + 3, 0, Math.PI * 2); ctx.stroke()

  if (opts.iconUrl) {
    try {
      const img = new Image()
      await new Promise<void>((res, rej) => {
        img.onload = () => res()
        img.onerror = () => rej(new Error('img'))
        img.src = opts.iconUrl!
      })
      ctx.save()
      ctx.beginPath(); ctx.arc(CX, CY, R, 0, Math.PI * 2); ctx.clip()
      ctx.drawImage(img, CX - R, CY - R, R * 2, R * 2)
      ctx.restore()
    } catch {
      ctx.fillStyle = '#3C3C43'
      ctx.beginPath(); ctx.arc(CX, CY, R, 0, Math.PI * 2); ctx.fill()
    }
  } else {
    ctx.fillStyle = '#3C3C43'
    ctx.beginPath(); ctx.arc(CX, CY, R, 0, Math.PI * 2); ctx.fill()
  }

  // Name
  ctx.font = `700 23px ${FONT}`; ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'center'
  ctx.fillText(opts.name || 'Player', W / 2, 178)

  // Player ID
  ctx.font = `500 12px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.4)'
  ctx.fillText(opts.playerId || '', W / 2, 197)

  // Divider
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(24, 212); ctx.lineTo(W - 24, 212); ctx.stroke()

  // Profile info badges
  const badges: Array<[string, string, string]> = [
    ['地域', opts.region || '未設定', '📍'],
    ['好きなハンド', opts.favoriteHand || '未設定', '🃏'],
    ['ポーカー歴', opts.pokerHistory || '未設定', '⏰'],
  ]
  const bW = (W - 56) / 3
  badges.forEach(([label, value, icon], i) => {
    const bx = 20 + i * (bW + 8)
    const bY = 220
    ctx.fillStyle = 'rgba(255,255,255,0.06)'
    roundRectCanvas(ctx, bx, bY, bW, 60, 12); ctx.fill()
    ctx.font = `400 16px sans-serif`; ctx.textAlign = 'center'; ctx.fillStyle = '#FFFFFF'
    ctx.fillText(icon, bx + bW / 2, bY + 23)
    ctx.font = `600 10px ${FONT}`; ctx.fillStyle = '#FFFFFF'
    let v = value
    if (ctx.measureText(v).width > bW - 8) {
      while (v.length > 0 && ctx.measureText(v + '..').width > bW - 8) v = v.slice(0, -1)
      v += '..'
    }
    ctx.fillText(v, bx + bW / 2, bY + 40)
    ctx.font = `400 9px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.35)'
    ctx.fillText(label, bx + bW / 2, bY + 54)
  })

  // Divider
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(24, 294); ctx.lineTo(W - 24, 294); ctx.stroke()

  // RR Rating
  ctx.font = `600 11px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.textAlign = 'center'
  ctx.fillText('トナメ偏差値', W / 2, 315)
  const ratingGrad = ctx.createLinearGradient(0, 320, 0, 395)
  ratingGrad.addColorStop(0, '#F2A900'); ratingGrad.addColorStop(1, '#C97D00')
  ctx.fillStyle = ratingGrad
  ctx.font = `800 68px ${FONT}`
  ctx.fillText(opts.rrRating.toFixed(1), W / 2, 395)

  // Stats box
  const statsY = 436
  ctx.fillStyle = 'rgba(255,255,255,0.05)'
  roundRectCanvas(ctx, 20, statsY - 24, W - 40, 60, 16); ctx.fill()
  const statsItems = [
    { label: '参加数', value: String(opts.plays) },
    { label: 'ITM率', value: opts.plays > 0 ? `${Math.round(opts.itmRate)}%` : '-' },
    { label: 'ROI', value: opts.plays > 0 ? `${opts.roi >= 0 ? '+' : ''}${Math.round(opts.roi)}%` : '-' },
  ]
  statsItems.forEach((s, i) => {
    const sx = W / 6 + i * (W / 3)
    ctx.font = `700 18px ${FONT}`; ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'center'
    ctx.fillText(s.value, sx, statsY + 4)
    ctx.font = `400 10px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.45)'
    ctx.fillText(s.label, sx, statsY + 20)
  })

  // Divider after stats
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(24, statsY + 48); ctx.lineTo(W - 24, statsY + 48); ctx.stroke()

  if (opts.todayTournamentName) {
    ctx.font = `500 10px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.textAlign = 'center'
    ctx.fillText('今日参加したトナメ', W / 2, statsY + 68)
    ctx.font = `600 13px ${FONT}`; ctx.fillStyle = '#F2A900'
    ctx.fillText(opts.todayTournamentName, W / 2, statsY + 88)
    ctx.font = `400 10px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.22)'
    ctx.fillText('RR Poker でポーカーライフをシェア', W / 2, H - 18)
  } else {
    ctx.font = `500 11px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.textAlign = 'center'
    ctx.fillText('RR Poker でポーカーライフをシェア', W / 2, statsY + 72)
  }

  // Gold bottom bar
  ctx.fillStyle = goldGrad
  ctx.fillRect(0, H - 5, W, 5)

  return new Promise<Blob>(res => canvas.toBlob(b => res(b!), 'image/png'))
}

// ─────────────────────────────────────────────────────────────

export default function MyPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const shouldDelete = searchParams.get("delete")
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [profile, setProfile] = useState<UserProfile>({})
  const [email, setEmail] = useState("")
  const [draftName, setDraftName] = useState("")
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isEditingName, setIsEditingName] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [savingName, setSavingName] = useState(false)
  const [savingIcon, setSavingIcon] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [copySuccess, setCopySuccess] = useState(false)
  const [birthday, setBirthday] = useState("")
  const [handItems, setHandItems] = useState<HandItem[]>([])
  const [handLoading, setHandLoading] = useState(true)
  const [handDeleteConfirmId, setHandDeleteConfirmId] = useState<string | null>(null)
  const [handFavorites, setHandFavorites] = useState<Set<string>>(new Set())
  const [uid, setUid] = useState<string | null>(null)

  // Extended profile
  const [draftRegion, setDraftRegion] = useState("")
  const [draftFavoriteHand, setDraftFavoriteHand] = useState("")
  const [draftPokerHistory, setDraftPokerHistory] = useState("")
  const [isEditingExtProfile, setIsEditingExtProfile] = useState(false)
  const [savingExtProfile, setSavingExtProfile] = useState(false)
  const [sharingProfile, setSharingProfile] = useState(false)
  const [tourStats, setTourStats] = useState({ plays: 0, itmRate: 0, roi: 0, todayName: null as string | null })

  const MAX_ICON_SIZE = 5 * 1024 * 1024
  const MAX_ICON_EDGE = 200
  const ICON_QUALITY = 0.7
  const MAX_DATA_URL_LENGTH = 900000

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async user => {
      if (!user) return
      setUid(user.uid)
      const snap = await getDoc(doc(db, "users", user.uid))
      const data = snap.data() ?? {}
      setProfile(data)
      setDraftName(data.name ?? "")
      setDraftRegion(data.region ?? "")
      setDraftFavoriteHand(data.favoriteHand ?? "")
      setDraftPokerHistory(data.pokerHistory ?? "")
      setEmail(user.email ?? "")
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    if (shouldDelete === "1") deleteAccount()
  }, [shouldDelete])

  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith("blob:")) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  useEffect(() => {
    if (!uid) return
    const loadHands = async () => {
      setHandLoading(true)
      try {
        const q = query(collection(db, "handHistories"), where("creatorId", "==", uid))
        const snap = await getDocs(q)
        const items: HandItem[] = snap.docs.map(d => {
          const data = d.data()
          return { id: d.id, favorite: false, title: data.title ?? "", stakes: data.stakes ?? { sb: 0, bb: 0 }, heroPosition: data.heroPosition ?? "", heroCards: data.heroCards ?? [], createdAt: data.createdAt ?? null, note: data.note ?? "" }
        })
        const favSnap = await getDocs(collection(db, "users", uid, "handFavorites"))
        const favSet = new Set<string>(favSnap.docs.map(d => d.id))
        setHandFavorites(favSet)
        items.sort((a, b) => {
          const af = favSet.has(a.id) ? 1 : 0
          const bf = favSet.has(b.id) ? 1 : 0
          if (bf !== af) return bf - af
          return (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0)
        })
        setHandItems(items)
      } catch (e) { console.error("hand load error", e) }
      setHandLoading(false)
    }
    loadHands()
  }, [uid])

  useEffect(() => {
    if (!uid) return
    getDocs(collection(db, "users", uid, "tournamentHistory")).then(snap => {
      const list = snap.docs.map(d => d.data())
      const plays = list.length
      const itm = list.filter(h => h.rank && h.rank !== "-").length
      let totalBuyin = 0, totalPrize = 0
      list.forEach(item => {
        totalBuyin += (item.entryCount ?? 0) * (item.entryFee ?? 0)
                    + (item.reentryCount ?? 0) * (item.reentryFee ?? 0)
                    + (item.addonCount ?? 0) * (item.addonFee ?? 0)
        totalPrize += item.prize ?? 0
      })
      const itmRate = plays > 0 ? (itm / plays * 100) : 0
      const roi = totalBuyin > 0 ? ((totalPrize - totalBuyin) / totalBuyin * 100) : 0
      const todayStr = new Date().toISOString().slice(0, 10)
      const todayItem = list.find(item => {
        if (!item.startedAt?.seconds) return false
        return new Date(item.startedAt.seconds * 1000).toISOString().slice(0, 10) === todayStr
      })
      setTourStats({ plays, itmRate, roi, todayName: todayItem?.tournamentName ?? null })
    })
  }, [uid])

  const toggleHandFavorite = async (handId: string) => {
    const user = auth.currentUser
    if (!user) return
    const isFav = handFavorites.has(handId)
    const ref = doc(db, "users", user.uid, "handFavorites", handId)
    if (isFav) {
      await deleteDoc(ref)
      setHandFavorites(prev => { const n = new Set(prev); n.delete(handId); return n })
    } else {
      await setDoc(ref, { addedAt: serverTimestamp() })
      setHandFavorites(prev => new Set([...prev, handId]))
    }
  }

  const deleteHand = async (handId: string) => {
    const user = auth.currentUser
    if (!user) return
    try {
      await deleteDoc(doc(db, "handHistories", handId))
      await deleteDoc(doc(db, "users", user.uid, "handFavorites", handId)).catch(() => {})
      setHandItems(prev => prev.filter(h => h.id !== handId))
      setHandFavorites(prev => { const n = new Set(prev); n.delete(handId); return n })
    } catch {}
    setHandDeleteConfirmId(null)
  }

  const shareHand = async (handId: string, title: string) => {
    const url = `${window.location.origin}/hand/${handId}`
    if (navigator.share) {
      try { await navigator.share({ title: title || "ハンドレビュー", url }) } catch {}
    } else {
      try { await navigator.clipboard.writeText(url) } catch {}
    }
  }

  const saveBirthday = async () => {
    const user = auth.currentUser
    if (!user || !birthday) return
    await setDoc(doc(db, "users", user.uid), { birthday }, { merge: true })
    setProfile(prev => ({ ...prev, birthday }))
  }

  const openIconPicker = () => { setError(""); setSuccess(""); fileInputRef.current?.click() }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null
    event.target.value = ""
    if (!nextFile) return
    if (nextFile.size > MAX_ICON_SIZE) { setError("画像サイズが大きすぎます（5MBまで）"); return }
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    void uploadIcon(nextFile)
  }

  const uploadIcon = async (nextFile: File) => {
    const user = auth.currentUser
    if (!user || savingIcon) return
    setError(""); setSuccess(""); setSavingIcon(true)
    try {
      const dataUrl = await resizeImageToDataUrl(nextFile, MAX_ICON_EDGE, ICON_QUALITY)
      if (dataUrl.length > MAX_DATA_URL_LENGTH) throw new Error("画像サイズが大きすぎます（小さめの画像を選択してください）")
      setPreviewUrl(dataUrl)
      await setDoc(doc(db, "users", user.uid), { iconUrl: dataUrl }, { merge: true })
      setProfile(prev => ({ ...prev, iconUrl: dataUrl }))
      setSuccess("アイコンを更新しました")
    } catch (e: any) { setError(e.message || "アイコンの更新に失敗しました") }
    finally { setSavingIcon(false) }
  }

  const saveName = async () => {
    const user = auth.currentUser
    if (!user) return
    if (!draftName.trim()) { setError("ユーザー名を入力してください"); return }
    setError(""); setSuccess(""); setSavingName(true)
    try {
      await setDoc(doc(db, "users", user.uid), { name: draftName.trim() }, { merge: true })
      setProfile(prev => ({ ...prev, name: draftName.trim() }))
      setSuccess("保存しました")
      setIsEditingName(false)
    } catch (e: any) { setError(e.message) }
    finally { setSavingName(false) }
  }

  const saveExtProfile = async () => {
    const user = auth.currentUser
    if (!user) return
    setSavingExtProfile(true)
    try {
      await setDoc(doc(db, "users", user.uid), {
        region: draftRegion.trim(),
        favoriteHand: draftFavoriteHand.trim(),
        pokerHistory: draftPokerHistory,
      }, { merge: true })
      setProfile(prev => ({ ...prev, region: draftRegion.trim(), favoriteHand: draftFavoriteHand.trim(), pokerHistory: draftPokerHistory }))
      setSuccess("保存しました")
      setIsEditingExtProfile(false)
    } catch (e: any) { setError(e.message) }
    finally { setSavingExtProfile(false) }
  }

  const shareProfileCard = async () => {
    setSharingProfile(true)
    try {
      const blob = await generateProfileCard({
        name: profile.name ?? "",
        playerId: profile.playerId ?? "",
        iconUrl: profile.iconUrl,
        rrRating: profile.rrRating ?? 0,
        region: profile.region,
        favoriteHand: profile.favoriteHand,
        pokerHistory: profile.pokerHistory,
        plays: tourStats.plays,
        itmRate: tourStats.itmRate,
        roi: tourStats.roi,
        todayTournamentName: tourStats.todayName,
      })
      const file = new File([blob], 'rrpoker-profile.png', { type: 'image/png' })
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `${profile.name ?? 'Player'} のポーカープロフィール`, text: '#RRPoker' })
      } else {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a'); a.href = url; a.download = 'rrpoker-profile.png'; a.click()
        URL.revokeObjectURL(url)
      }
    } catch {}
    finally { setSharingProfile(false) }
  }

  const logout = async () => { await signOut(auth); router.replace("/login") }

  const copyPlayerId = async () => {
    if (!profile.playerId) return
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(profile.playerId)
      } else {
        const ta = document.createElement("textarea")
        ta.value = profile.playerId; ta.style.position = "fixed"; ta.style.opacity = "0"
        document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta)
      }
      setCopySuccess(true); setTimeout(() => setCopySuccess(false), 2000)
    } catch { setError("コピーに失敗しました"); setTimeout(() => setError(""), 2000) }
  }

  const deleteAccount = async () => {
    const user = auth.currentUser
    if (!user) { setError("ユーザーが見つかりません"); return }
    try {
      await user.delete()
      router.replace("/")
    } catch (e: any) {
      if (e.code === "auth/requires-recent-login") { router.replace("/login?redirect=delete"); return }
      setError(e.message || "アカウント削除に失敗しました")
    }
  }

  return (
    <main style={{ minHeight: '100dvh', background: '#F2F2F7', paddingBottom: 120 }}>
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes sheetUp {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0); opacity: 1; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .mp-animate { animation: slideUp .3s ease-out; }
        .mp-sheet   { animation: sheetUp .38s cubic-bezier(.22,1,.36,1) both; }
        .mp-card { background: #fff; border-radius: 20px; overflow: hidden; }
        .mp-row { display: flex; align-items: center; padding: 14px 18px; border-bottom: 1px solid rgba(0,0,0,0.06); }
        .mp-row:last-child { border-bottom: none; }
        button { -webkit-tap-highlight-color: transparent; }
      `}</style>

      <HomeHeader
        homePath="/home"
        myPagePath="/home/mypage"
        menuItems={getCommonMenuItems(router, "user")}
      />

      {/* Toast */}
      {error && (
        <div style={{ position: 'fixed', top: 76, left: '50%', transform: 'translateX(-50%)', background: '#FF3B30', color: '#fff', padding: '10px 18px', borderRadius: 14, fontSize: 13, fontWeight: 600, zIndex: 200, display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 4px 20px rgba(255,59,48,0.35)', whiteSpace: 'nowrap' }} className="mp-animate">
          <FiAlertCircle size={15} />{error}
        </div>
      )}
      {success && (
        <div style={{ position: 'fixed', top: 76, left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(135deg,#F2A900,#D4910A)', color: '#fff', padding: '10px 18px', borderRadius: 14, fontSize: 13, fontWeight: 600, zIndex: 200, display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 4px 20px rgba(242,169,0,0.35)', whiteSpace: 'nowrap' }} className="mp-animate">
          <FiCheck size={15} />{success}
        </div>
      )}

      <div style={{ maxWidth: 430, margin: '0 auto', padding: '16px 16px 0' }}>

        {/* ── プロフィールカード ── */}
        <div className="mp-card mp-animate" style={{ marginBottom: 20, boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}>

          {/* ヘッダーバンド */}
          <div style={{ background: 'linear-gradient(135deg,#F2A900 0%,#C97D00 100%)', height: 110, position: 'relative', padding: '0 22px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
            <div style={{ position: 'absolute', top: -28, left: -18, width: 130, height: 130, borderRadius: '50%', background: 'radial-gradient(circle,rgba(255,255,255,0.18) 0%,transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: -30, right: 60, width: 90, height: 90, borderRadius: '50%', background: 'radial-gradient(circle,rgba(255,255,255,0.1) 0%,transparent 70%)', pointerEvents: 'none' }} />

            {/* Share button */}
            <button type="button" onClick={shareProfileCard} disabled={sharingProfile}
              style={{ position: 'absolute', top: 12, left: 14, display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.22)', borderRadius: 10, padding: '7px 12px', border: 'none', cursor: 'pointer', backdropFilter: 'blur(8px)', zIndex: 1 }}>
              {sharingProfile
                ? <div style={{ width: 13, height: 13, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.8)', borderTopColor: 'transparent', animation: 'spin .7s linear infinite' }} />
                : <FiShare2 size={13} style={{ color: '#fff' }} />
              }
              <span style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>シェア</span>
            </button>

            <div style={{ position: 'relative', zIndex: 1, textAlign: 'right' }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.72)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 2 }}>トナメ偏差値</p>
              <p style={{ fontSize: 46, fontWeight: 800, color: '#fff', lineHeight: 1, letterSpacing: '-1.5px', textShadow: '0 2px 12px rgba(0,0,0,0.12)' }}>
                {profile.rrRating ?? 0}
              </p>
            </div>
          </div>

          {/* アバター */}
          <div style={{ padding: '0 20px', marginTop: -40, marginBottom: 12 }}>
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <div style={{ width: 80, height: 80, borderRadius: '50%', border: '3px solid #fff', overflow: 'hidden', background: '#F2F2F7', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(0,0,0,0.18)' }}>
                {previewUrl || profile.iconUrl
                  ? <img src={previewUrl ?? profile.iconUrl} alt="icon" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <FiUser size={30} style={{ color: '#C7C7CC' }} />
                }
                {savingIcon && (
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}>
                    <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid #fff', borderTopColor: 'transparent', animation: 'spin .7s linear infinite' }} />
                  </div>
                )}
              </div>
              <button type="button" onClick={openIconPicker}
                style={{ position: 'absolute', bottom: 0, right: 0, width: 26, height: 26, borderRadius: '50%', background: '#1C1C1E', border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <FiCamera size={12} style={{ color: '#fff' }} />
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
            </div>
          </div>

          {/* 名前 */}
          <div style={{ padding: '0 20px 6px' }}>
            {isEditingName ? (
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <input
                  type="text"
                  value={draftName}
                  onChange={e => setDraftName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") saveName(); if (e.key === "Escape") { setDraftName(profile.name ?? ""); setIsEditingName(false) } }}
                  autoFocus
                  style={{ flex: 1, height: 44, borderRadius: 12, border: '1.5px solid #F2A900', padding: '0 14px', fontSize: 16, fontFamily: 'inherit', outline: 'none', color: '#1C1C1E' }}
                  placeholder="名前を入力"
                />
                <button type="button" onClick={saveName} disabled={savingName}
                  style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg,#F2A900,#D4910A)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', opacity: savingName ? 0.6 : 1 }}>
                  <FiCheck size={18} style={{ color: '#fff' }} />
                </button>
                <button type="button" onClick={() => { setDraftName(profile.name ?? ""); setIsEditingName(false) }}
                  style={{ width: 44, height: 44, borderRadius: 12, background: '#F2F2F7', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <FiX size={18} style={{ color: '#3C3C43' }} />
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1C1C1E', letterSpacing: '-0.4px', margin: 0 }}>{profile.name || "名前未設定"}</h2>
                <button type="button" onClick={() => { setError(""); setSuccess(""); setIsEditingName(true) }}
                  style={{ width: 30, height: 30, borderRadius: '50%', background: '#F2F2F7', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <FiEdit2 size={14} style={{ color: '#8E8E93' }} />
                </button>
              </div>
            )}

            {/* Player ID */}
            <button type="button" onClick={copyPlayerId}
              style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#F2F2F7', borderRadius: 10, padding: '8px 12px', border: 'none', cursor: 'pointer', marginBottom: 14, width: '100%' }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: '#8E8E93', fontFamily: 'monospace', flex: 1, textAlign: 'left' }}>{profile.playerId || "@loading"}</span>
              {copySuccess
                ? <FiCheck size={14} style={{ color: '#34C759', flexShrink: 0 }} />
                : <FiCopy size={14} style={{ color: '#C7C7CC', flexShrink: 0 }} />
              }
            </button>
          </div>

          {/* ── 拡張プロフィール ── */}
          <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', padding: '14px 20px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#8E8E93', letterSpacing: '0.04em', textTransform: 'uppercase' }}>プロフィール詳細</p>
              <button type="button"
                onClick={() => { setDraftRegion(profile.region ?? ""); setDraftFavoriteHand(profile.favoriteHand ?? ""); setDraftPokerHistory(profile.pokerHistory ?? ""); setIsEditingExtProfile(true) }}
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 8, background: '#F2F2F7', border: 'none', cursor: 'pointer' }}>
                <FiEdit2 size={11} style={{ color: '#8E8E93' }} />
                <span style={{ fontSize: 11, fontWeight: 500, color: '#8E8E93' }}>編集</span>
              </button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {[
                { icon: '📍', label: '地域', value: profile.region },
                { icon: '🃏', label: '好きなハンド', value: profile.favoriteHand },
                { icon: '⏰', label: 'ポーカー歴', value: profile.pokerHistory },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#F2F2F7', borderRadius: 10, padding: '7px 12px' }}>
                  <span style={{ fontSize: 14 }}>{item.icon}</span>
                  <div>
                    <p style={{ fontSize: 9, color: '#C7C7CC', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 1 }}>{item.label}</p>
                    <p style={{ fontSize: 12, fontWeight: 600, color: item.value ? '#1C1C1E' : '#C7C7CC' }}>{item.value || '未設定'}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 誕生日 */}
          <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', padding: '14px 20px 18px' }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: '#8E8E93', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 8 }}>誕生日</p>
            {!profile.birthday ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="date" value={birthday} onChange={e => setBirthday(e.target.value)}
                  style={{ flex: 1, height: 40, borderRadius: 10, border: '1.5px solid rgba(0,0,0,0.12)', padding: '0 12px', fontSize: 14, fontFamily: 'inherit', color: '#1C1C1E', background: '#fff', outline: 'none' }} />
                <button type="button" onClick={saveBirthday}
                  style={{ height: 40, padding: '0 18px', borderRadius: 10, background: 'linear-gradient(135deg,#F2A900,#D4910A)', border: 'none', fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer', flexShrink: 0 }}>
                  保存
                </button>
              </div>
            ) : (
              <p style={{ fontSize: 15, fontWeight: 500, color: '#1C1C1E' }}>{profile.birthday}</p>
            )}
            {!profile.birthday && <p style={{ fontSize: 11, color: '#FF3B30', marginTop: 6 }}>※一度設定すると変更できません</p>}
          </div>
        </div>

        {/* ── 設定リスト ── */}
        <div className="mp-card mp-animate" style={{ marginBottom: 20, boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
          <button type="button" onClick={() => router.push("/home/mypage/password")}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: '#1C1C1E', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <FiLock size={15} style={{ color: '#fff' }} />
            </div>
            <span style={{ flex: 1, fontSize: 15, fontWeight: 500, color: '#1C1C1E' }}>パスワード変更</span>
            <FiChevronRight size={16} style={{ color: '#C7C7CC' }} />
          </button>
        </div>

        {/* ── ハンドヒストリー ── */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px 10px' }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#8E8E93', letterSpacing: '0.04em', textTransform: 'uppercase' }}>ハンドヒストリー</p>
            {handItems.length > 0 && <p style={{ fontSize: 12, color: '#8E8E93' }}>{handItems.length}件</p>}
          </div>

          {handLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '28px 0' }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2.5px solid #F2A900', borderTopColor: 'transparent', animation: 'spin .7s linear infinite' }} />
            </div>
          ) : handItems.length === 0 ? (
            <div className="mp-card" style={{ padding: '36px 20px', textAlign: 'center' }}>
              <p style={{ fontSize: 32, marginBottom: 8 }}>🃏</p>
              <p style={{ fontSize: 13, color: '#8E8E93', fontWeight: 500 }}>ハンドヒストリーがありません</p>
              <p style={{ fontSize: 11, color: '#C7C7CC', marginTop: 4 }}>ホームのボタンから作成できます</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {handItems.map(hand => (
                <div key={hand.id} className="mp-card" style={{ padding: '14px 16px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 14, fontWeight: 600, color: '#1C1C1E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{hand.title || "ハンドレビュー"}</p>
                      <p style={{ fontSize: 11, color: '#8E8E93', marginTop: 2 }}>
                        {hand.stakes?.sb}/{hand.stakes?.bb} · {hand.heroPosition}
                        {hand.createdAt?.seconds ? ` · ${new Date(hand.createdAt.seconds * 1000).toLocaleDateString("ja-JP")}` : ""}
                      </p>
                    </div>
                    {handFavorites.has(hand.id) && <FiStar size={14} style={{ color: '#F2A900', flexShrink: 0, marginTop: 2 }} fill="currentColor" />}
                  </div>

                  {(hand.heroCards ?? []).length > 0 && (
                    <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
                      {(hand.heroCards ?? []).map((c, i) => <MiniCard key={i} card={c} />)}
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button type="button" onClick={() => shareHand(hand.id, hand.title)}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, height: 32, padding: '0 12px', borderRadius: 8, background: 'linear-gradient(135deg,#F2A900,#D4910A)', border: 'none', fontSize: 12, fontWeight: 600, color: '#fff', cursor: 'pointer' }}>
                      <FiShare2 size={11} />シェア
                    </button>
                    <button type="button" onClick={() => toggleHandFavorite(hand.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, height: 32, padding: '0 12px', borderRadius: 8, border: `1.5px solid ${handFavorites.has(hand.id) ? 'rgba(242,169,0,0.4)' : 'rgba(0,0,0,0.1)'}`, background: handFavorites.has(hand.id) ? 'rgba(242,169,0,0.08)' : 'transparent', fontSize: 12, fontWeight: 600, color: handFavorites.has(hand.id) ? '#D4910A' : '#8E8E93', cursor: 'pointer' }}>
                      <FiStar size={11} fill={handFavorites.has(hand.id) ? "currentColor" : "none"} />
                      {handFavorites.has(hand.id) ? "お気に入り済" : "お気に入り"}
                    </button>
                    <button type="button" onClick={() => setHandDeleteConfirmId(hand.id)}
                      style={{ marginLeft: 'auto', width: 32, height: 32, borderRadius: 8, border: '1.5px solid rgba(0,0,0,0.1)', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                      <FiTrash2 size={13} style={{ color: '#8E8E93' }} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── アカウント操作 ── */}
        <div className="mp-card" style={{ marginBottom: 20, boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
          <button type="button" onClick={logout}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px', background: 'none', borderBottom: '1px solid rgba(0,0,0,0.06)', borderLeft: 'none', borderRight: 'none', borderTop: 'none', cursor: 'pointer', textAlign: 'left' }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: '#FF9500', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <FiLogOut size={15} style={{ color: '#fff' }} />
            </div>
            <span style={{ fontSize: 15, fontWeight: 500, color: '#1C1C1E' }}>ログアウト</span>
            <FiChevronRight size={16} style={{ color: '#C7C7CC', marginLeft: 'auto' }} />
          </button>
          <button type="button" onClick={() => setShowDeleteConfirm(true)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: '#FF3B30', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <FiAlertCircle size={15} style={{ color: '#fff' }} />
            </div>
            <span style={{ fontSize: 15, fontWeight: 500, color: '#FF3B30' }}>アカウントを削除</span>
            <FiChevronRight size={16} style={{ color: '#C7C7CC', marginLeft: 'auto' }} />
          </button>
        </div>

      </div>

      {/* ── 拡張プロフィール編集シート ── */}
      {isEditingExtProfile && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={() => setIsEditingExtProfile(false)}>
          <div className="mp-sheet" style={{ background: '#fff', borderRadius: '28px 28px 0 0', width: '100%', maxWidth: 480, padding: '12px 20px 48px' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(60,60,67,0.18)', margin: '0 auto 20px' }} />
            <p style={{ fontSize: 17, fontWeight: 700, color: '#1C1C1E', marginBottom: 22 }}>プロフィール詳細を編集</p>

            {/* 地域 */}
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 12, color: '#8E8E93', fontWeight: 600, marginBottom: 7, display: 'block' }}>📍 地域</label>
              <input type="text" value={draftRegion} onChange={e => setDraftRegion(e.target.value)}
                placeholder="例: 東京都" maxLength={30}
                style={{ width: '100%', height: 44, borderRadius: 12, border: '1.5px solid rgba(0,0,0,0.12)', padding: '0 14px', fontSize: 15, color: '#1C1C1E', background: '#F2F2F7', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
            </div>

            {/* 好きなハンド */}
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 12, color: '#8E8E93', fontWeight: 600, marginBottom: 7, display: 'block' }}>🃏 好きなハンド</label>
              <input type="text" value={draftFavoriteHand} onChange={e => setDraftFavoriteHand(e.target.value)}
                placeholder="例: AA, KK, AKs" maxLength={20}
                style={{ width: '100%', height: 44, borderRadius: 12, border: '1.5px solid rgba(0,0,0,0.12)', padding: '0 14px', fontSize: 15, color: '#1C1C1E', background: '#F2F2F7', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
            </div>

            {/* ポーカー歴 */}
            <div style={{ marginBottom: 28 }}>
              <label style={{ fontSize: 12, color: '#8E8E93', fontWeight: 600, marginBottom: 10, display: 'block' }}>⏰ ポーカー歴</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {['1年未満', '1〜3年', '3〜5年', '5年以上'].map(opt => (
                  <button key={opt} type="button" onClick={() => setDraftPokerHistory(opt)}
                    style={{ padding: '9px 18px', borderRadius: 20, border: `1.5px solid ${draftPokerHistory === opt ? '#F2A900' : 'rgba(0,0,0,0.12)'}`, background: draftPokerHistory === opt ? 'rgba(242,169,0,0.1)' : '#F2F2F7', fontSize: 13, fontWeight: draftPokerHistory === opt ? 700 : 500, color: draftPokerHistory === opt ? '#D4910A' : '#3C3C43', cursor: 'pointer' }}>
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <button type="button" onClick={saveExtProfile} disabled={savingExtProfile}
              style={{ width: '100%', height: 52, borderRadius: 16, background: 'linear-gradient(135deg,#F2A900,#D4910A)', border: 'none', fontSize: 15, fontWeight: 700, color: '#fff', cursor: 'pointer', opacity: savingExtProfile ? 0.7 : 1 }}>
              {savingExtProfile ? '保存中...' : '保存する'}
            </button>
          </div>
        </div>
      )}

      {/* ── ハンド削除モーダル ── */}
      {handDeleteConfirmId && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={() => setHandDeleteConfirmId(null)}>
          <div className="mp-sheet" style={{ background: '#fff', borderRadius: '28px 28px 0 0', width: '100%', maxWidth: 480, padding: '12px 20px 40px' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(60,60,67,0.18)', margin: '0 auto 20px' }} />
            <p style={{ fontSize: 17, fontWeight: 700, color: '#1C1C1E', marginBottom: 6 }}>ハンドを削除しますか？</p>
            <p style={{ fontSize: 13, color: '#8E8E93', marginBottom: 24, lineHeight: 1.6 }}>この操作は取り消せません。共有リンクも無効になります。</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={() => setHandDeleteConfirmId(null)}
                style={{ flex: 1, height: 50, borderRadius: 14, border: '1.5px solid rgba(0,0,0,0.12)', background: '#fff', fontSize: 15, fontWeight: 600, color: '#1C1C1E', cursor: 'pointer' }}>
                キャンセル
              </button>
              <button type="button" onClick={() => deleteHand(handDeleteConfirmId)}
                style={{ flex: 1, height: 50, borderRadius: 14, border: 'none', background: '#FF3B30', fontSize: 15, fontWeight: 700, color: '#fff', cursor: 'pointer' }}>
                削除する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── アカウント削除確認モーダル ── */}
      {showDeleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={() => setShowDeleteConfirm(false)}>
          <div className="mp-sheet" style={{ background: '#fff', borderRadius: '28px 28px 0 0', width: '100%', maxWidth: 480, padding: '12px 20px 40px' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(60,60,67,0.18)', margin: '0 auto 20px' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ width: 44, height: 44, borderRadius: 14, background: '#FF3B30', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <FiAlertCircle size={22} style={{ color: '#fff' }} />
              </div>
              <div>
                <p style={{ fontSize: 17, fontWeight: 700, color: '#1C1C1E' }}>アカウント削除</p>
                <p style={{ fontSize: 12, color: '#8E8E93', marginTop: 2 }}>この操作は取り消せません</p>
              </div>
            </div>
            <div style={{ background: 'rgba(255,59,48,0.06)', border: '1px solid rgba(255,59,48,0.15)', borderRadius: 14, padding: '12px 14px', marginBottom: 22 }}>
              <p style={{ fontSize: 13, color: '#FF3B30', fontWeight: 600, marginBottom: 4 }}>⚠️ 以下のデータが失われます</p>
              <p style={{ fontSize: 12, color: '#3C3C43', lineHeight: 1.7 }}>• 保持チップ・レート・戦績<br/>• すべてのアカウント情報</p>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={() => setShowDeleteConfirm(false)} disabled={isDeleting}
                style={{ flex: 1, height: 50, borderRadius: 14, border: '1.5px solid rgba(0,0,0,0.12)', background: '#fff', fontSize: 15, fontWeight: 600, color: '#1C1C1E', cursor: 'pointer', opacity: isDeleting ? 0.6 : 1 }}>
                キャンセル
              </button>
              <button type="button" onClick={deleteAccount} disabled={isDeleting}
                style={{ flex: 1, height: 50, borderRadius: 14, border: 'none', background: '#FF3B30', fontSize: 15, fontWeight: 700, color: '#fff', cursor: 'pointer', opacity: isDeleting ? 0.6 : 1 }}>
                {isDeleting ? "削除中..." : "削除する"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ボトムナビ ── */}
      <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 80, background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderTop: '1px solid rgba(0,0,0,0.08)' }}>
        <div style={{ maxWidth: 430, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 40px 14px', position: 'relative' }}>
          <button type="button" onClick={() => router.push("/home")}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, background: 'none', border: 'none', cursor: 'pointer', color: '#8E8E93' }}>
            <FiHome size={22} />
            <span style={{ fontSize: 10, fontWeight: 500 }}>ホーム</span>
          </button>

          <button type="button" onClick={() => router.push("/home/transactions")}
            style={{ position: 'absolute', left: '50%', top: 0, transform: 'translate(-50%,-50%)', width: 56, height: 56, borderRadius: 18, background: 'linear-gradient(135deg,#F2A900,#D4910A)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 16px rgba(242,169,0,0.4)' }}>
            <FiCreditCard size={24} style={{ color: '#fff' }} />
          </button>

          <button type="button" onClick={() => router.push("/home/mypage")}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, background: 'none', border: 'none', cursor: 'pointer', color: '#F2A900' }}>
            <FiUser size={22} />
            <span style={{ fontSize: 10, fontWeight: 700 }}>マイページ</span>
          </button>
        </div>
      </nav>
    </main>
  )
}
