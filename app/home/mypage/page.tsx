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
}

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
        .mp-animate { animation: slideUp .3s ease-out; }
        .mp-sheet   { animation: sheetUp .38s cubic-bezier(.22,1,.36,1) both; }
        .mp-card {
          background: #fff;
          border-radius: 20px;
          overflow: hidden;
        }
        .mp-row {
          display: flex; align-items: center; padding: 14px 18px;
          border-bottom: 1px solid rgba(0,0,0,0.06);
        }
        .mp-row:last-child { border-bottom: none; }
        button { -webkit-tap-highlight-color: transparent; }
      `}</style>

      <HomeHeader
        homePath="/home"
        myPagePath="/home/mypage"
        menuItems={getCommonMenuItems(router, "user")}
      />

      {/* トースト */}
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

          {/* ヘッダーバンド — RR Rating を内包 */}
          <div style={{ background: 'linear-gradient(135deg,#F2A900 0%,#C97D00 100%)', height: 110, position: 'relative', padding: '0 22px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
            <div style={{ position: 'absolute', top: -28, left: -18, width: 130, height: 130, borderRadius: '50%', background: 'radial-gradient(circle,rgba(255,255,255,0.18) 0%,transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: -30, right: 60, width: 90, height: 90, borderRadius: '50%', background: 'radial-gradient(circle,rgba(255,255,255,0.1) 0%,transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ position: 'relative', zIndex: 1, textAlign: 'right' }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.72)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 2 }}>トナメ偏差値</p>
              <p style={{ fontSize: 46, fontWeight: 800, color: '#fff', lineHeight: 1, letterSpacing: '-1.5px', textShadow: '0 2px 12px rgba(0,0,0,0.12)' }}>
                {profile.rrRating ?? 0}
              </p>
            </div>
          </div>

          {/* アバター（バンドに半分乗り出す） */}
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
                style={{ position: 'absolute', bottom: 0, right: 0, width: 26, height: 26, borderRadius: '50%', background: '#1C1C1E', border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
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
              <p style={{ fontSize: 32, marginBottom: 8 }}></p>
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
