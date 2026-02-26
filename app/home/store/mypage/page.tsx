"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { signOut } from "firebase/auth"
import { auth, db } from "@/lib/firebase"
import { deleteField, doc, getDoc, setDoc } from "firebase/firestore"
import { resizeImageToDataUrl } from "@/lib/image"
import { FiHome, FiUser, FiEdit2, FiClock } from "react-icons/fi"
import HomeHeader from "@/components/HomeHeader"

type StoreProfile = {
  name?: string
  iconUrl?: string
  description?: string
  postalCode?: string
  addressLine?: string
  addressDetail?: string
  address?: string
}

export default function StoreMyPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [profile, setProfile] = useState<StoreProfile>({})
  const [storeId, setStoreId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState("")
  const [draftDescription, setDraftDescription] = useState("")
  const [draftPostalCode, setDraftPostalCode] = useState("")
  const [draftAddressLine, setDraftAddressLine] = useState("")
  const [draftAddressDetail, setDraftAddressDetail] = useState("")
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [editingField, setEditingField] = useState<
    "name" | "description" | "postalCode" | "addressLine" | "addressDetail" | null
  >(null)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [saving, setSaving] = useState(false)
  const [savingIcon, setSavingIcon] = useState(false)
  const [email, setEmail] = useState("")
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [blindSb, setBlindSb] = useState("")
  const [blindBb, setBlindBb] = useState("")
  const [blindError, setBlindError] = useState("")
  const [blindSuccess, setBlindSuccess] = useState("")

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
      setStoreId(data.storeId ?? null)
      setEmail(user.email ?? "")
      setProfile(data)
      setDraftName(data.name ?? "")
      setDraftDescription(data.description ?? "")
      setDraftPostalCode(data.postalCode ?? "")
      setDraftAddressLine(data.addressLine ?? "")
      setDraftAddressDetail(data.addressDetail ?? "")
    }

    fetchProfile()
  }, [])

  useEffect(() => {
    const fetchStore = async () => {
      if (!storeId) return
      const snap = await getDoc(doc(db, "stores", storeId))
      if (!snap.exists()) return
      const data = snap.data() ?? {}
      setProfile(prev => ({
        ...prev,
        name: data.name ?? prev.name,
        iconUrl: data.iconUrl ?? prev.iconUrl,
        description: data.description ?? prev.description,
        postalCode: data.postalCode ?? prev.postalCode,
        addressLine: data.addressLine ?? prev.addressLine,
        addressDetail: data.addressDetail ?? prev.addressDetail,
        address: data.address ?? prev.address,
      }))
      setDraftName(data.name ?? "")
      setDraftDescription(data.description ?? "")
      setDraftPostalCode(data.postalCode ?? "")
      setDraftAddressLine(data.addressLine ?? "")
      setDraftAddressDetail(data.addressDetail ?? "")
      setBlindSb(typeof data.ringBlindSb === "number" ? `${data.ringBlindSb}` : "")
      setBlindBb(typeof data.ringBlindBb === "number" ? `${data.ringBlindBb}` : "")
    }

    fetchStore()
  }, [storeId])

  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

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
    if (!user || !storeId || savingIcon) return
    setError("")
    setSuccess("")
    setSavingIcon(true)

    try {
      const dataUrl = await resizeImageToDataUrl(nextFile, MAX_ICON_EDGE, ICON_QUALITY)
      if (dataUrl.length > MAX_DATA_URL_LENGTH) {
        throw new Error("画像サイズが大きすぎます（小さめの画像を選択してください）")
      }

      setPreviewUrl(dataUrl)
      await setDoc(doc(db, "stores", storeId), { iconUrl: dataUrl }, { merge: true })
      await setDoc(doc(db, "users", user.uid), { iconUrl: dataUrl }, { merge: true })

      setProfile(prev => ({ ...prev, iconUrl: dataUrl }))
      if (previewUrl && previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl)
      }
      setSuccess("アイコンを更新しました")
    } catch (e: any) {
      setError(e.message || "アイコンの更新に失敗しました")
    } finally {
      setSavingIcon(false)
    }
  }

  const saveProfile = async () => {
    const user = auth.currentUser
    if (!user || !storeId) return
    if (editingField === "name" && !draftName.trim()) {
      setError("店舗名を入力してください")
      return
    }

    setError("")
    setSuccess("")
    setSaving(true)

    try {
      const nextAddress = `${draftPostalCode.trim()} ${draftAddressLine.trim()} ${draftAddressDetail.trim()}`.trim()
      const updatePayload: Record<string, string> = {}

      if (editingField === "name") updatePayload.name = draftName.trim()
      if (editingField === "description") updatePayload.description = draftDescription.trim()
      if (editingField === "postalCode") updatePayload.postalCode = draftPostalCode.trim()
      if (editingField === "addressLine") updatePayload.addressLine = draftAddressLine.trim()
      if (editingField === "addressDetail") updatePayload.addressDetail = draftAddressDetail.trim()

      if (editingField === "postalCode" || editingField === "addressLine" || editingField === "addressDetail") {
        updatePayload.address = nextAddress
      }

      await setDoc(doc(db, "stores", storeId), updatePayload, { merge: true })
      await setDoc(doc(db, "users", user.uid), updatePayload, { merge: true })

      setProfile(prev => ({ ...prev, ...updatePayload }))
      setEditingField(null)
      setSuccess("保存しました")
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const saveBlindSettings = async () => {
    if (!storeId) return
    setBlindError("")
    setBlindSuccess("")

    const sbRaw = blindSb.trim()
    const bbRaw = blindBb.trim()
    if (!sbRaw && !bbRaw) {
      await setDoc(
        doc(db, "stores", storeId),
        { ringBlindSb: deleteField(), ringBlindBb: deleteField() },
        { merge: true }
      )
      setBlindSuccess("保存しました")
      return
    }

    if (!sbRaw || !bbRaw) {
      setBlindError("SBとBBを両方入力してください")
      return
    }

    const sbValue = Number(sbRaw)
    const bbValue = Number(bbRaw)
    if (!Number.isInteger(sbValue) || !Number.isInteger(bbValue) || sbValue < 0 || bbValue < 0) {
      setBlindError("0以上の整数で入力してください")
      return
    }

    await setDoc(
      doc(db, "stores", storeId),
      { ringBlindSb: sbValue, ringBlindBb: bbValue },
      { merge: true }
    )
    setBlindSuccess("保存しました")
  }

  const logout = async () => {
    await signOut(auth)
    router.replace("/login")
  }

  const deleteAccount = async () => {
    const user = auth.currentUser
    if (!user) return
    setIsDeleting(true)
    setError("")

    try {
      const name = profile.name || "店舗"
      await setDoc(doc(db, "users", user.uid), { deletedAt: new Date() }, { merge: true })
      await user.delete()
      setShowDeleteConfirm(false)
      alert(`さようなら、またね。\n${name}さん。`)
      router.replace("/login")
    } catch (e: any) {
      setError(e.message || "アカウント削除に失敗しました")
      setIsDeleting(false)
    }
  }

  return (
    <main className="store-mypage min-h-screen bg-white pb-24">
      <HomeHeader homePath="/home/store" myPagePath="/home/store/mypage" variant="store" />

      <div className="mx-auto max-w-sm px-5">
        <div className="pt-[28px] text-center">
          <h1 className="text-[24px] font-semibold text-gray-900">マイページ</h1>
        </div>

        <div className="mt-6 rounded-[24px] border border-gray-200 p-4">
          <div className="relative mx-auto h-[72px] w-[72px]">
            {previewUrl || profile.iconUrl ? (
              <img
                src={previewUrl ?? profile.iconUrl}
                alt="icon"
                className="h-[72px] w-[72px] rounded-full object-cover"
              />
            ) : (
              <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full border border-gray-200 text-[12px] text-gray-500">
                アイコン
              </div>
            )}
            <button
              type="button"
              onClick={openIconPicker}
              className="absolute -right-1 -bottom-1 flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600"
              aria-label="アイコンを編集"
            >
              <FiEdit2 className="text-[12px]" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          <div className="mt-4 space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <p className="text-[12px] text-gray-500">店舗名</p>
                <button
                  type="button"
                  onClick={() => setEditingField("name")}
                  className="flex h-6 w-6 items-center justify-center rounded-full border border-gray-200 text-gray-600"
                  aria-label="店舗名を編集"
                >
                  <FiEdit2 className="text-[11px]" />
                </button>
              </div>
              {editingField === "name" ? (
                <input
                  type="text"
                  value={draftName}
                  onChange={e => setDraftName(e.target.value)}
                  className="mt-2 h-10 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 text-[14px]"
                />
              ) : (
                <div>
                  <p className="mt-2 text-[15px] font-semibold text-gray-900">{profile.name ?? ""}</p>
                  <p className="mt-1 text-[12px] text-gray-400">{email}</p>
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between">
                <p className="text-[12px] text-gray-500">店舗の説明</p>
                <button
                  type="button"
                  onClick={() => setEditingField("description")}
                  className="flex h-6 w-6 items-center justify-center rounded-full border border-gray-200 text-gray-600"
                  aria-label="店舗の説明を編集"
                >
                  <FiEdit2 className="text-[11px]" />
                </button>
              </div>
              {editingField === "description" ? (
                <textarea
                  value={draftDescription}
                  onChange={e => setDraftDescription(e.target.value)}
                  className="mt-2 h-20 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-2 text-[14px]"
                />
              ) : (
                <p className="mt-2 text-[14px] text-gray-700">{profile.description ?? ""}</p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between">
                <p className="text-[12px] text-gray-500">郵便番号</p>
                <button
                  type="button"
                  onClick={() => setEditingField("postalCode")}
                  className="flex h-6 w-6 items-center justify-center rounded-full border border-gray-200 text-gray-600"
                  aria-label="郵便番号を編集"
                >
                  <FiEdit2 className="text-[11px]" />
                </button>
              </div>
              {editingField === "postalCode" ? (
                <input
                  type="text"
                  value={draftPostalCode}
                  onChange={e => setDraftPostalCode(e.target.value)}
                  className="mt-2 h-10 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 text-[14px]"
                />
              ) : (
                <p className="mt-2 text-[14px] text-gray-700">{profile.postalCode ?? ""}</p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between">
                <p className="text-[12px] text-gray-500">住所、丁目</p>
                <button
                  type="button"
                  onClick={() => setEditingField("addressLine")}
                  className="flex h-6 w-6 items-center justify-center rounded-full border border-gray-200 text-gray-600"
                  aria-label="住所を編集"
                >
                  <FiEdit2 className="text-[11px]" />
                </button>
              </div>
              {editingField === "addressLine" ? (
                <input
                  type="text"
                  value={draftAddressLine}
                  onChange={e => setDraftAddressLine(e.target.value)}
                  className="mt-2 h-10 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 text-[14px]"
                />
              ) : (
                <p className="mt-2 text-[14px] text-gray-700">{profile.addressLine ?? ""}</p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between">
                <p className="text-[12px] text-gray-500">番地、マンション名、号室など</p>
                <button
                  type="button"
                  onClick={() => setEditingField("addressDetail")}
                  className="flex h-6 w-6 items-center justify-center rounded-full border border-gray-200 text-gray-600"
                  aria-label="番地を編集"
                >
                  <FiEdit2 className="text-[11px]" />
                </button>
              </div>
              {editingField === "addressDetail" ? (
                <input
                  type="text"
                  value={draftAddressDetail}
                  onChange={e => setDraftAddressDetail(e.target.value)}
                  className="mt-2 h-10 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 text-[14px]"
                />
              ) : (
                <p className="mt-2 text-[14px] text-gray-700">{profile.addressDetail ?? ""}</p>
              )}
            </div>
          </div>

          {error && <p className="mt-3 text-center text-[13px] text-red-500">{error}</p>}
          {success && <p className="mt-3 text-center text-[13px] text-green-600">{success}</p>}
          {savingIcon && <p className="mt-3 text-center text-[12px] text-gray-500">アイコンを更新中...</p>}

          {editingField && (
            <button
              type="button"
              onClick={saveProfile}
              disabled={saving}
              className="mt-4 h-[48px] w-full rounded-[20px] bg-[#F2A900] text-[14px] font-semibold text-gray-900 disabled:opacity-60"
            >
              保存する
            </button>
          )}
        </div>

        <div className="mt-4 rounded-[24px] border border-gray-200 p-4">
          <p className="text-[14px] font-semibold text-gray-900">ブラインド設定</p>
          <p className="mt-1 text-[12px] text-gray-500">空欄で保存すると解除されます。</p>
          <div className="mt-3 flex items-center gap-2">
            <div className="flex flex-1 items-center gap-2">
              <span className="text-[12px] text-gray-500">SB</span>
              <input
                type="number"
                min={0}
                value={blindSb}
                onChange={e => setBlindSb(e.target.value)}
                className="h-10 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-[14px]"
                placeholder="例: 5"
              />
            </div>
            <span className="text-[12px] text-gray-400">-</span>
            <div className="flex flex-1 items-center gap-2">
              <span className="text-[12px] text-gray-500">BB</span>
              <input
                type="number"
                min={0}
                value={blindBb}
                onChange={e => setBlindBb(e.target.value)}
                className="h-10 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-[14px]"
                placeholder="例: 10"
              />
            </div>
          </div>
          {blindError && <p className="mt-2 text-[12px] text-red-500">{blindError}</p>}
          {blindSuccess && <p className="mt-2 text-[12px] text-green-600">{blindSuccess}</p>}
          <button
            type="button"
            onClick={saveBlindSettings}
            className="mt-3 h-[44px] w-full rounded-[18px] border border-gray-200 text-[13px] font-semibold"
          >
            ブラインドを保存
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <button
            type="button"
            onClick={() => router.push("/home/store/mypage/password")}
            className="h-[52px] w-full rounded-[24px] border border-gray-200 text-[15px] font-semibold text-gray-900"
          >
            パスワード変更
          </button>
          <button
            type="button"
            onClick={logout}
            className="h-[52px] w-full rounded-[24px] bg-red-500 text-[15px] font-semibold text-white"
          >
            ログアウト
          </button>
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="h-10 w-full text-[12px] font-semibold text-red-500 hover:text-red-600"
          >
            アカウントを削除
          </button>
        </div>

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

      <nav className="fixed bottom-0 left-0 right-0 z-[80] border-t border-gray-200 bg-white">
        <div className="relative mx-auto flex max-w-sm items-center justify-between px-8 py-3">
          <button
            type="button"
            onClick={() => router.push("/home/store")}
            className="flex flex-col items-center text-gray-400"
          >
            <FiHome className="text-[18px]" />
            <span className="mt-1 text-[11px]">ホーム</span>
          </button>
          <button
            type="button"
            onClick={() => router.push("/home/store/timer")}
            className="absolute left-1/2 top-0 flex h-[74px] w-[74px] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full bg-[#F2A900] text-gray-900 shadow-lg"
            aria-label="タイマー"
          >
            <FiClock className="text-[22px]" />
            <span className="mt-1 text-[10px] font-semibold">タイマー</span>
          </button>
          <button
            type="button"
            onClick={() => router.push("/home/store/mypage")}
            className="flex flex-col items-center text-[#111]"
          >
            <FiUser className="text-[18px]" />
            <span className="mt-1 text-[11px]">マイページ</span>
          </button>
        </div>
      </nav>
    </main>
  )
}
