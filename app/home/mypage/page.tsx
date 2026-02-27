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
  FiLogOut
} from "react-icons/fi"
import HomeHeader from "@/components/HomeHeader"
import { getCommonMenuItems } from "@/components/commonMenuItems"

type UserProfile = {
  name?: string
  iconUrl?: string
  playerId?: string
  rrRating?: number
}

export default function MyPage() {
  const router = useRouter()
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
    return () => {
      if (previewUrl && previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

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
      setError("再ログインしてください")
      return
    }

    try {
      setIsDeleting(true)
      setError("")

      const inputPassword = prompt("安全のためパスワードを再入力してください")
      if (!inputPassword) {
        setIsDeleting(false)
        return
      }

      const credential = EmailAuthProvider.credential(
        user.email!,
        inputPassword
      )

      await reauthenticateWithCredential(user, credential)

      await setDoc(
        doc(db, "users", user.uid),
        { deletedAt: new Date() },
        { merge: true }
      )

      await user.delete()

      setShowDeleteConfirm(false)
      alert("アカウントを削除しました")
      router.replace("/login")

    } catch (e) {
      console.error("DELETE ERROR:", e)
      setError("削除に失敗しました")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white pb-24">
      <HomeHeader
        homePath="/home"
        myPagePath="/home/mypage"
        menuItems={getCommonMenuItems(router, "user")}
      />

      <div className="mx-auto max-w-sm px-5 pt-6">
        <div className="pb-6">
          <div className="flex items-start gap-5">
            <div className="relative shrink-0">
              {previewUrl || profile.iconUrl ? (
                <img
                  src={previewUrl ?? profile.iconUrl}
                  alt="icon"
                  className="h-24 w-24 rounded-full object-cover shadow-md"
                />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-full border border-gray-200 bg-gray-100 text-[12px] text-gray-500">
                  アイコン
                </div>
              )}
              <button
                onClick={openIconPicker}
                className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-white shadow-md border border-gray-200 flex items-center justify-center text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <FiEdit2 className="h-3.5 w-3.5" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            <div className="flex flex-1 h-24 items-center justify-center">
              <div className="flex flex-col items-center">
                <span className="text-[34px] font-bold text-gray-900">
                  {profile.rrRating ?? 0}
                </span>
                <span className="text-[12px] text-gray-600 mt-0.5">
                  RRレーティング
                </span>
              </div>
            </div>
          </div>

          <div className="mt-5">
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
                  className="flex-1 h-10 rounded-lg border border-gray-300 bg-white px-3 text-[15px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  placeholder="名前を入力"
                />
                <button
                  onClick={saveName}
                  disabled={savingName}
                  className="h-10 w-10 rounded-lg bg-gray-900 text-white flex items-center justify-center disabled:opacity-60"
                >
                  <FiCheck className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    setDraftName(profile.name ?? "")
                    setIsEditingName(false)
                  }}
                  className="h-10 w-10 rounded-lg border border-gray-300 text-gray-600 flex items-center justify-center"
                >
                  <FiX className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h2 className="text-[18px] font-semibold text-gray-900">
                  {profile.name ?? ""}
                </h2>
                <button
                  onClick={openNameEdit}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <FiEdit2 className="h-4 w-4" />
                </button>
              </div>
            )}

            <div className="flex items-center gap-2 mt-2">
              <p className="text-[13px] text-gray-500 font-mono">
                {profile.playerId ?? "@loading"}
              </p>
              <button
                type="button"
                onClick={copyPlayerId}
                className="text-gray-400 hover:text-gray-600"
              >
                <FiCopy className="h-3.5 w-3.5" />
              </button>
            </div>
            {copySuccess && (
              <p className="mt-1.5 text-[12px] text-green-600">
                コピーしました
              </p>
            )}
          </div>

          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={() => router.push("/home/mypage/password")}
              className="flex-1 h-[36px] rounded-xl bg-gray-900 text-[14px] font-semibold text-white flex items-center justify-center gap-2"
            >
              <FiLock className="h-4 w-4" />
              パスワード変更
            </button>
          </div>
        </div>

        {error && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-red-500 text-white px-4 py-2.5 rounded-xl text-[13px] shadow-lg z-50">
            {error}
          </div>
        )}
        {success && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-4 py-2.5 rounded-xl text-[13px] shadow-lg z-50">
            {success}
          </div>
        )}
        {savingIcon && (
          <p className="mt-3 text-center text-[12px] text-gray-500">
            アイコンを更新中...
          </p>
        )}

        <div className="mt-6 space-y-3">
          <button
            type="button"
            onClick={logout}
            className="h-[52px] w-full rounded-2xl bg-white border border-gray-200 text-[15px] font-medium text-gray-900 flex items-center justify-center gap-2 shadow-sm"
          >
            <FiLogOut className="h-5 w-5" />
            ログアウト
          </button>

          {/* アカウント連携ボタン削除済み */}

          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="h-[48px] w-full rounded-2xl bg-red-50 border border-red-200 text-[14px] font-medium text-red-600"
          >
            アカウントを削除
          </button>

          {showDeleteConfirm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-5">
              <div className="w-full max-w-sm rounded-[24px] bg-white p-5">
                <h2 className="text-[16px] font-semibold text-gray-900">アカウント削除</h2>
                <p className="mt-3 text-[13px] text-gray-600">本当にアカウントを削除しますか？</p>
                <p className="mt-2 text-[12px] text-gray-500">削除すると復元できません。</p>
                <p className="mt-1 text-[12px] text-gray-500">保持チップやレートも失われます。</p>
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={isDeleting}
                    className="flex-1 rounded-2xl border border-gray-200 py-2 text-[13px] font-semibold text-gray-800 disabled:opacity-60"
                  >
                    キャンセル
                  </button>
                  <button
                    type="button"
                    onClick={deleteAccount}
                    disabled={isDeleting}
                    className="flex-1 rounded-2xl bg-red-500 py-2 text-[13px] font-semibold text-white disabled:opacity-60"
                  >
                    {isDeleting ? "削除中..." : "はい"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-[80] border-t border-gray-200 bg-white/80 backdrop-blur-xl">
        <div className="relative mx-auto flex max-w-sm items-center justify-between px-8 py-3">
          <button
            type="button"
            onClick={() => router.push("/home")}
            className="flex flex-col items-center text-gray-400"
          >
            <FiHome className="h-6 w-6" />
            <span className="mt-1 text-[11px]">ホーム</span>
          </button>

          <button
            type="button"
            onClick={() => router.push("/home/transactions")}
            className="absolute left-1/2 top-0 flex h-[70px] w-[70px] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full bg-gradient-to-br from-[#F2A900] to-[#E09600] text-gray-900 shadow-xl"
          >
            <FiCreditCard className="h-6 w-6" />
            <span className="mt-1 text-[10px] font-semibold">入出金</span>
          </button>

          <button
            type="button"
            onClick={() => router.push("/home/mypage")}
            className="flex flex-col items-center text-gray-900"
          >
            <FiUser className="h-6 w-6" />
            <span className="mt-1 text-[11px] font-semibold">
              マイページ
            </span>
          </button>
        </div>
      </nav>
    </main>
  )
}