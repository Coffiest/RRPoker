"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { signOut, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth"
import { auth, db } from "@/lib/firebase"
import { doc, getDoc, setDoc } from "firebase/firestore"
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
  FiTrendingUp,
  FiAlertCircle
} from "react-icons/fi"
import HomeHeader from "@/components/HomeHeader"
import { getCommonMenuItems } from "@/components/commonMenuItems"
import { useSearchParams } from "next/navigation"

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
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [birthday, setBirthday] = useState("")

  const MAX_ICON_SIZE = 5 * 1024 * 1024
  const MAX_ICON_EDGE = 200
  const ICON_QUALITY = 0.7
  const MAX_DATA_URL_LENGTH = 900000

  useEffect(() => {
    const fetchProfile = async () => {
      const user = auth.currentUser
      if (!user) return
      const snap = await getDoc(doc(db, "users", user.uid))
      const data = snap.data() ?? {}
      setProfile(data)
      setDraftName(data.name ?? "")
      setEmail(user.email ?? "")
    }
    fetchProfile()
  }, [])

  useEffect(() => {
    if (shouldDelete === "1") {
      deleteAccount()
    }
  }, [shouldDelete])

  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  const saveBirthday = async () => {
  const user = auth.currentUser
  if (!user || !birthday) return

  await setDoc(doc(db, "users", user.uid), {
    birthday
  }, { merge: true })
}

  const openNameEdit = () => {
    setError("")
    setSuccess("")
    setIsEditingName(true)
  }

  const openIconPicker = () => {
    setError("")
    setSuccess("")
    fileInputRef.current?.click()
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null
    event.target.value = ""
    if (!nextFile) return
    if (nextFile.size > MAX_ICON_SIZE) {
      setError("画像サイズが大きすぎます（5MBまで）")
      return
    }
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }
    void uploadIcon(nextFile)
  }

  const uploadIcon = async (nextFile: File) => {
    const user = auth.currentUser
    if (!user || savingIcon) return
    setError("")
    setSuccess("")
    setSavingIcon(true)

    try {
      const dataUrl = await resizeImageToDataUrl(nextFile, MAX_ICON_EDGE, ICON_QUALITY)
      if (dataUrl.length > MAX_DATA_URL_LENGTH) {
        throw new Error("画像サイズが大きすぎます（小さめの画像を選択してください）")
      }
      setPreviewUrl(dataUrl)
      await setDoc(doc(db, "users", user.uid), { iconUrl: dataUrl }, { merge: true })
      setProfile(prev => ({ ...prev, iconUrl: dataUrl }))
      setSuccess("アイコンを更新しました")
    } catch (e: any) {
      setError(e.message || "アイコンの更新に失敗しました")
    } finally {
      setSavingIcon(false)
    }
  }

  const saveName = async () => {
    const user = auth.currentUser
    if (!user) return
    if (!draftName.trim()) {
      setError("ユーザー名を入力してください")
      return
    }

    setError("")
    setSuccess("")
    setSavingName(true)

    try {
      await setDoc(
        doc(db, "users", user.uid),
        { name: draftName.trim() },
        { merge: true }
      )
      setProfile(prev => ({ ...prev, name: draftName.trim() }))
      setSuccess("保存しました")
      setIsEditingName(false)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSavingName(false)
    }
  }

  const logout = async () => {
    await signOut(auth)
    router.replace("/login")
  }

  const copyPlayerId = async () => {
    if (!profile.playerId) return
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(profile.playerId)
      } else {
        const textarea = document.createElement("textarea")
        textarea.value = profile.playerId
        textarea.setAttribute("readonly", "")
        textarea.style.position = "fixed"
        textarea.style.opacity = "0"
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand("copy")
        document.body.removeChild(textarea)
      }
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    } catch {
      setError("コピーに失敗しました")
      setTimeout(() => setError(""), 2000)
    }
  }

  const deleteAccount = async () => {
    const user = auth.currentUser
    if (!user) {
      setError("ユーザーが見つかりません")
      return
    }

    try {
      await user.delete()
      router.replace("/")
    } catch (e: any) {
      if (e.code === "auth/requires-recent-login") {
        router.replace("/login?redirect=delete")
        return
      }
      setError(e.message || "アカウント削除に失敗しました")
    }
  }

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
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
        .animate-pulse-slow {
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        .profile-card {
          background: linear-gradient(145deg, #ffffff 0%, #fefefe 100%);
          box-shadow: 
            0 2px 8px rgba(242, 169, 0, 0.06),
            0 8px 24px rgba(0, 0, 0, 0.04);
        }
        .rating-badge {
          background: linear-gradient(135deg, #F2A900 0%, #D4910A 100%);
          box-shadow: 0 4px 16px rgba(242, 169, 0, 0.3), 0 1px 3px rgba(0, 0, 0, 0.1);
        }
        .glass-card {
          background: rgba(255, 255, 255, 0.7);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
        }
        .action-button {
          background: linear-gradient(145deg, #ffffff 0%, #fefefe 100%);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .action-button:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
        }
        .action-button:active {
          transform: scale(0.98);
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
        menuItems={getCommonMenuItems(router, "user")}
      />

      <div className="mx-auto max-w-sm px-4 pt-6">
        {/* Profile Header Card */}
        <div className="profile-card rounded-3xl p-6 animate-slideUp">
          <div className="flex items-start gap-4">
            {/* Icon Section */}
            <div className="relative shrink-0">
              <div className="relative">
                {previewUrl || profile.iconUrl ? (
                  <img
                    src={previewUrl ?? profile.iconUrl}
                    alt="icon"
                    className="h-24 w-24 rounded-2xl object-cover shadow-md border-2 border-white"
                  />
                ) : (
                  <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-gradient-to-br from-gray-100 to-gray-50 text-[14px] text-gray-400 border-2 border-white shadow-md">
                    <FiUser size={32} />
                  </div>
                )}
                {savingIcon && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/40">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  </div>
                )}
              </div>
              <button
                onClick={openIconPicker}
                className="absolute -bottom-1 -right-1 h-9 w-9 rounded-full bg-gradient-to-br from-[#F2A900] to-[#D4910A] shadow-lg flex items-center justify-center text-white hover:from-[#D4910A] hover:to-[#C48509] transition-all active:scale-95"
              >
                <FiEdit2 size={16} />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            {/* Rating Badge */}
            <div className="flex-1 flex items-center justify-center">
              <div className="rating-badge rounded-2xl px-6 py-4 text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent"></div>
                <div className="absolute top-[-50%] right-[-20%] w-32 h-32 rounded-full bg-white/10"></div>
                <div className="relative z-10 flex items-center gap-2 justify-center mb-1">
                  <FiTrendingUp className="text-white/90" size={16} />
                  <span className="text-[11px] font-medium text-white/90 tracking-wide">
                    RR RATING
                  </span>
                </div>
                <span className="relative z-10 text-[36px] font-bold text-white drop-shadow-sm tracking-tight">
                  {profile.rrRating ?? 0}
                </span>
              </div>
            </div>
          </div>

          {/* Name Section */}
          <div className="mt-6">
            {isEditingName ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={draftName}
                  onChange={e => setDraftName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") saveName()
                    if (e.key === "Escape") {
                      setDraftName(profile.name ?? "")
                      setIsEditingName(false)
                    }
                  }}
                  autoFocus
                  className="flex-1 h-12 rounded-2xl border-2 border-[#F2A900] bg-white px-4 text-[16px] text-gray-900 outline-none focus:ring-2 focus:ring-[#F2A900]/20"
                  placeholder="名前を入力"
                />
                <button
                  onClick={saveName}
                  disabled={savingName}
                  className="h-12 w-12 rounded-2xl bg-gradient-to-br from-[#F2A900] to-[#D4910A] text-white flex items-center justify-center disabled:opacity-60 shadow-md hover:shadow-lg transition-all active:scale-95"
                >
                  <FiCheck size={20} />
                </button>
                <button
                  onClick={() => {
                    setDraftName(profile.name ?? "")
                    setIsEditingName(false)
                  }}
                  className="h-12 w-12 rounded-2xl bg-gray-100 text-gray-600 flex items-center justify-center hover:bg-gray-200 transition-colors"
                >
                  <FiX size={20} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <h2 className="text-[22px] font-semibold text-gray-900">
                  {profile.name ?? ""}
                </h2>
                <button
                  onClick={openNameEdit}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-all active:scale-95"
                >
                  <FiEdit2 size={16} />
                </button>
              </div>
            )}

            <div className="mt-4">
                {!profile.birthday ? (
                  <>
                    <input
                      type="date"
                      value={birthday}
                      onChange={(e) => setBirthday(e.target.value)}
                      className="h-10 w-full rounded-xl border px-3"
                    />
                    <button
                      onClick={saveBirthday}
                      className="mt-2 w-full h-10 bg-[#F2A900] rounded-xl"
                    >
                      保存
                    </button>
                    <p className="text-[12px] text-red-500">
                      ※一度設定すると変更できません
                    </p>
                  </>
                ) : (
                  <p className="text-[14px] text-gray-700">
                    誕生日：{profile.birthday}
                  </p>
                )}
              </div>

            {/* Player ID */}
            <div className="mt-3 flex items-center gap-2 bg-gray-50 rounded-2xl px-4 py-3">
              <p className="text-[14px] text-gray-600 font-mono flex-1">
                {profile.playerId ?? "@loading"}
              </p>
              <button
                type="button"
                onClick={copyPlayerId}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-gray-500 hover:text-[#F2A900] hover:bg-[#F2A900]/10 transition-all active:scale-95"
              >
                {copySuccess ? <FiCheck size={16} className="text-[#F2A900]" /> : <FiCopy size={16} />}
              </button>
            </div>
            {copySuccess && (
              <p className="mt-2 text-[12px] text-[#F2A900] font-medium animate-slideUp">
                コピーしました！
              </p>
            )}
          </div>

          {/* Password Change Button */}
          <div className="mt-5">
            <button
              type="button"
              onClick={() => router.push("/home/mypage/password")}
              className="w-full h-12 rounded-2xl bg-gradient-to-r from-gray-900 to-gray-800 text-[15px] font-semibold text-white flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all active:scale-98"
            >
              <FiLock size={18} />
              パスワード変更
            </button>
          </div>
        </div>

        {/* Notifications */}
        {error && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-red-500 text-white px-5 py-3 rounded-2xl text-[14px] shadow-xl z-50 animate-slideUp flex items-center gap-2 max-w-[90vw]">
            <FiAlertCircle size={18} />
            {error}
          </div>
        )}
        {success && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-gradient-to-r from-[#F2A900] to-[#D4910A] text-white px-5 py-3 rounded-2xl text-[14px] shadow-xl z-50 animate-slideUp flex items-center gap-2 max-w-[90vw]">
            <FiCheck size={18} />
            {success}
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-6 space-y-3">
          <button
            type="button"
            onClick={logout}
            className="action-button h-14 w-full rounded-2xl border border-gray-200 text-[16px] font-medium text-gray-900 flex items-center justify-center gap-2"
          >
            <FiLogOut size={20} />
            ログアウト
          </button>

          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="h-12 w-full rounded-2xl bg-red-50 border border-red-200 text-[15px] font-medium text-red-600 hover:bg-red-100 transition-all active:scale-98"
          >
            アカウントを削除
          </button>

          {/* Delete Confirmation Modal */}
          {showDeleteConfirm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay px-4">
              <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl animate-slideUp">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
                    <FiAlertCircle className="text-red-600" size={24} />
                  </div>
                  <h2 className="text-[18px] font-semibold text-gray-900">アカウント削除</h2>
                </div>
                <p className="text-[14px] text-gray-600 leading-relaxed">
                  本当にアカウントを削除しますか？
                </p>
                <div className="mt-3 bg-red-50 rounded-2xl p-4 border border-red-100">
                  <p className="text-[13px] text-red-700 font-medium">⚠️ この操作は取り消せません</p>
                  <p className="text-[12px] text-gray-600 mt-1">• 保持チップやレートも失われます</p>
                  <p className="text-[12px] text-gray-600">• すべてのデータが完全に削除されます</p>
                </div>
                <div className="mt-5 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={isDeleting}
                    className="flex-1 h-12 rounded-2xl border-2 border-gray-200 text-[15px] font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60 transition-all active:scale-98"
                  >
                    キャンセル
                  </button>
                  <button
                    type="button"
                    onClick={deleteAccount}
                    disabled={isDeleting}
                    className="flex-1 h-12 rounded-2xl bg-red-500 text-[15px] font-semibold text-white hover:bg-red-600 disabled:opacity-60 shadow-md transition-all active:scale-98"
                  >
                    {isDeleting ? "削除中..." : "削除する"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 w-full z-[80] glass-card border-t border-gray-200/60 shadow-lg">
        <div className="relative mx-auto flex max-w-sm items-center justify-between px-8 py-3">
          <button
            type="button"
            onClick={() => router.push("/home")}
            className="flex flex-col items-center text-gray-400 hover:text-[#F2A900] transition-all"
          >
            <FiHome size={22} />
            <span className="mt-1 text-[11px]">ホーム</span>
          </button>

          <button
            type="button"
            onClick={() => router.push("/home/transactions")}
            className="absolute left-1/2 top-0 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-[#F2A900] to-[#D4910A] text-white shadow-xl hover:shadow-2xl transition-all active:scale-95"
          >
            <FiCreditCard size={28} />
          </button>

          <button
            type="button"
            onClick={() => router.push("/home/mypage")}
            className="flex flex-col items-center text-[#F2A900] transition-all"
          >
            <FiUser size={22} />
            <span className="mt-1 text-[11px] font-medium">
              マイページ
            </span>
          </button>
        </div>
      </nav>
    </main>
  )
}
