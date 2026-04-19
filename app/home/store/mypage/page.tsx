"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { signOut } from "firebase/auth"
import { auth, db } from "@/lib/firebase"
import { deleteField, doc, getDoc, setDoc } from "firebase/firestore"
import { resizeImageToDataUrl } from "@/lib/image"
import { FiHome, FiUser, FiEdit2, FiPlus, FiAlertCircle, FiCheckCircle, FiMapPin, FiFileText, FiTarget } from "react-icons/fi"
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
    console.log("DELETE CLICKED")

    const user = auth.currentUser
    console.log("CURRENT USER:", user)

    if (!user) {
      console.log("USER IS NULL")
      alert("ユーザー情報が取得できません。再ログインしてください。")
      return
    }

    try {
      console.log("TRY START")
      setIsDeleting(true)

      await setDoc(
        doc(db, "users", user.uid),
        { deletedAt: new Date() },
        { merge: true }
      )
      console.log("FIRESTORE UPDATED")

      await user.delete()
      console.log("AUTH DELETE DONE")

      alert("削除完了")
      router.replace("/login")

    } catch (e) {
      console.error("DELETE ERROR:", e)
      alert("削除エラー")
    } finally {
      console.log("FINALLY")
      setIsDeleting(false)
    }
  }

  return (
    <main className="store-mypage min-h-screen bg-[#FFFBF5] pb-32">
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
      <HomeHeader homePath="/home/store" myPagePath="/home/store/mypage" variant="store" />

      <div className="mx-auto max-w-sm px-5">
        <div className="pt-[28px] text-center">
          <h1 className="text-[24px] font-semibold text-gray-900">店舗設定</h1>
        </div>

        {/* Profile Card */}
        <div className="mt-6 profile-card rounded-3xl p-6 animate-slideUp">
          {/* Icon Section */}
          <div className="flex items-center gap-4 pb-5 border-b border-gray-100">
            <div className="relative shrink-0">
              {previewUrl || profile.iconUrl ? (
                <img
                  src={previewUrl ?? profile.iconUrl}
                  alt="icon"
                  className="h-20 w-20 rounded-2xl object-cover shadow-md border-2 border-white"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-gray-100 to-gray-50 text-[14px] text-gray-400 border-2 border-white shadow-md">
                  <FiUser size={32} />
                </div>
              )}
              {savingIcon && (
                <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/40">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                </div>
              )}
              <button
                type="button"
                onClick={openIconPicker}
                className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-gradient-to-br from-[#F2A900] to-[#D4910A] shadow-lg flex items-center justify-center text-white hover:from-[#D4910A] hover:to-[#C48509] transition-all active:scale-95"
                aria-label="アイコンを編集"
              >
                <FiEdit2 size={14} />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            <div className="flex-1">
              <p className="text-[18px] font-semibold text-gray-900">{profile.name ?? ""}</p>
              <p className="mt-1 text-[13px] text-gray-500">{email}</p>
            </div>
          </div>

          {/* Editable Fields */}
          <div className="mt-5 space-y-4">
            {/* Store Name */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[12px] font-medium text-gray-600">店舗名</p>
                {editingField !== "name" && (
                  <button
                    type="button"
                    onClick={() => setEditingField("name")}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                    aria-label="店舗名を編集"
                  >
                    <FiEdit2 size={14} />
                  </button>
                )}
              </div>
              {editingField === "name" ? (
                <input
                  type="text"
                  value={draftName}
                  onChange={e => setDraftName(e.target.value)}
                  className="h-11 w-full rounded-2xl border-2 border-[#F2A900] bg-white px-4 text-[15px] outline-none focus:ring-2 focus:ring-[#F2A900]/20"
                  autoFocus
                />
              ) : (
                <p className="text-[15px] text-gray-900">{profile.name ?? ""}</p>
              )}
            </div>

            {/* Description */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <FiFileText size={14} className="text-gray-400" />
                  <p className="text-[12px] font-medium text-gray-600">店舗の説明</p>
                </div>
                {editingField !== "description" && (
                  <button
                    type="button"
                    onClick={() => setEditingField("description")}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                    aria-label="店舗の説明を編集"
                  >
                    <FiEdit2 size={14} />
                  </button>
                )}
              </div>
              {editingField === "description" ? (
                <textarea
                  value={draftDescription}
                  onChange={e => setDraftDescription(e.target.value)}
                  className="h-24 w-full rounded-2xl border-2 border-[#F2A900] bg-white px-4 py-3 text-[15px] outline-none focus:ring-2 focus:ring-[#F2A900]/20 resize-none"
                  autoFocus
                />
              ) : (
                <p className="text-[14px] text-gray-700 leading-relaxed">{profile.description ?? ""}</p>
              )}
            </div>

            {/* Postal Code */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <FiMapPin size={14} className="text-gray-400" />
                  <p className="text-[12px] font-medium text-gray-600">郵便番号</p>
                </div>
                {editingField !== "postalCode" && (
                  <button
                    type="button"
                    onClick={() => setEditingField("postalCode")}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                    aria-label="郵便番号を編集"
                  >
                    <FiEdit2 size={14} />
                  </button>
                )}
              </div>
              {editingField === "postalCode" ? (
                <input
                  type="text"
                  value={draftPostalCode}
                  onChange={e => setDraftPostalCode(e.target.value)}
                  className="h-11 w-full rounded-2xl border-2 border-[#F2A900] bg-white px-4 text-[15px] outline-none focus:ring-2 focus:ring-[#F2A900]/20"
                  autoFocus
                />
              ) : (
                <p className="text-[14px] text-gray-700">{profile.postalCode ?? ""}</p>
              )}
            </div>

            {/* Address Line */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[12px] font-medium text-gray-600">住所、丁目</p>
                {editingField !== "addressLine" && (
                  <button
                    type="button"
                    onClick={() => setEditingField("addressLine")}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                    aria-label="住所を編集"
                  >
                    <FiEdit2 size={14} />
                  </button>
                )}
              </div>
              {editingField === "addressLine" ? (
                <input
                  type="text"
                  value={draftAddressLine}
                  onChange={e => setDraftAddressLine(e.target.value)}
                  className="h-11 w-full rounded-2xl border-2 border-[#F2A900] bg-white px-4 text-[15px] outline-none focus:ring-2 focus:ring-[#F2A900]/20"
                  autoFocus
                />
              ) : (
                <p className="text-[14px] text-gray-700">{profile.addressLine ?? ""}</p>
              )}
            </div>

            {/* Address Detail */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[12px] font-medium text-gray-600">番地、マンション名、号室など</p>
                {editingField !== "addressDetail" && (
                  <button
                    type="button"
                    onClick={() => setEditingField("addressDetail")}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                    aria-label="番地を編集"
                  >
                    <FiEdit2 size={14} />
                  </button>
                )}
              </div>
              {editingField === "addressDetail" ? (
                <input
                  type="text"
                  value={draftAddressDetail}
                  onChange={e => setDraftAddressDetail(e.target.value)}
                  className="h-11 w-full rounded-2xl border-2 border-[#F2A900] bg-white px-4 text-[15px] outline-none focus:ring-2 focus:ring-[#F2A900]/20"
                  autoFocus
                />
              ) : (
                <p className="text-[14px] text-gray-700">{profile.addressDetail ?? ""}</p>
              )}
            </div>
          </div>

          {/* Messages */}
          {error && (
            <div className="mt-4 flex items-center gap-2 rounded-2xl bg-red-50 border border-red-200 px-4 py-3">
              <FiAlertCircle className="text-red-600 shrink-0" size={18} />
              <p className="text-[13px] text-red-700 font-medium">{error}</p>
            </div>
          )}
          {success && (
            <div className="mt-4 flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#F2A900]/10 to-[#D4910A]/10 border border-[#F2A900]/30 px-4 py-3 animate-slideUp">
              <FiCheckCircle className="text-[#D4910A] shrink-0" size={18} />
              <p className="text-[13px] text-[#D4910A] font-medium">{success}</p>
            </div>
          )}

          {/* Save Button */}
          {editingField && (
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setEditingField(null)
                  setError("")
                }}
                className="flex-1 h-12 rounded-2xl bg-gray-100 text-[15px] font-semibold text-gray-700 hover:bg-gray-200 transition-all active:scale-98"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={saveProfile}
                disabled={saving}
                className="flex-1 h-12 rounded-2xl bg-gradient-to-br from-[#F2A900] to-[#D4910A] text-[15px] font-semibold text-white disabled:opacity-60 shadow-md hover:shadow-lg transition-all active:scale-98"
              >
                {saving ? "保存中..." : "保存する"}
              </button>
            </div>
          )}
        </div>

        {/* Blind Settings Card */}
        <div className="mt-4 profile-card rounded-3xl p-6 animate-slideUp">
          <div className="flex items-center gap-2 mb-4">
            <FiTarget className="text-[#F2A900]" size={18} />
            <p className="text-[16px] font-semibold text-gray-900">ブラインド設定</p>
          </div>
          <p className="text-[13px] text-gray-500 mb-4">空欄で保存すると解除されます</p>
          
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="block text-[11px] font-medium text-gray-600 mb-2">SB</label>
              <input
                type="number"
                min={0}
                value={blindSb}
                onChange={e => setBlindSb(e.target.value)}
                className="h-11 w-full rounded-2xl border border-gray-200 bg-white px-4 text-[15px] outline-none focus:border-[#F2A900] focus:ring-2 focus:ring-[#F2A900]/20 transition-all"
                placeholder="例: 5"
              />
            </div>
            <div className="pt-6 text-gray-400">-</div>
            <div className="flex-1">
              <label className="block text-[11px] font-medium text-gray-600 mb-2">BB</label>
              <input
                type="number"
                min={0}
                value={blindBb}
                onChange={e => setBlindBb(e.target.value)}
                className="h-11 w-full rounded-2xl border border-gray-200 bg-white px-4 text-[15px] outline-none focus:border-[#F2A900] focus:ring-2 focus:ring-[#F2A900]/20 transition-all"
                placeholder="例: 10"
              />
            </div>
          </div>

          {blindError && (
            <div className="mt-3 flex items-center gap-2 rounded-2xl bg-red-50 border border-red-200 px-4 py-2">
              <FiAlertCircle className="text-red-600 shrink-0" size={16} />
              <p className="text-[12px] text-red-700 font-medium">{blindError}</p>
            </div>
          )}
          {blindSuccess && (
            <div className="mt-3 flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#F2A900]/10 to-[#D4910A]/10 border border-[#F2A900]/30 px-4 py-2">
              <FiCheckCircle className="text-[#D4910A] shrink-0" size={16} />
              <p className="text-[12px] text-[#D4910A] font-medium">{blindSuccess}</p>
            </div>
          )}

          <button
            type="button"
            onClick={saveBlindSettings}
            className="mt-4 h-12 w-full rounded-2xl border-2 border-gray-200 bg-white text-[15px] font-semibold text-gray-900 hover:bg-gray-50 transition-all active:scale-98"
          >
            ブラインドを保存
          </button>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 space-y-3">
          <button
            type="button"
            onClick={() => router.push("/home/store/mypage/password")}
            className="h-14 w-full rounded-2xl bg-white border border-gray-200 text-[16px] font-medium text-gray-900 hover:bg-gray-50 shadow-sm transition-all active:scale-98"
          >
            パスワード変更
          </button>
          <button
            type="button"
            onClick={logout}
            className="h-14 w-full rounded-2xl bg-gradient-to-r from-gray-900 to-gray-800 text-[16px] font-semibold text-white shadow-md hover:shadow-lg transition-all active:scale-98"
          >
            ログアウト
          </button>
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="h-12 w-full rounded-2xl bg-red-50 border border-red-200 text-[15px] font-medium text-red-600 hover:bg-red-100 transition-all active:scale-98"
          >
            アカウント削除
          </button>
        </div>

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

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-[80] glass-card border-t border-gray-200/60 shadow-lg">
        <div className="relative mx-auto flex max-w-sm items-center justify-between px-8 py-3">
          <button
            type="button"
            onClick={() => router.push("/home/store")}
            className="flex flex-col items-center text-gray-400 hover:text-[#F2A900] transition-all"
          >
            <FiHome size={22} />
            <span className="mt-1 text-[11px]">ホーム</span>
          </button>
          <button
            type="button"
            onClick={() => router.push("/home/store/tournaments")}
            className="absolute left-1/2 top-0 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-[#F2A900] to-[#D4910A] text-white shadow-xl hover:shadow-2xl transition-all active:scale-95"
            aria-label="トーナメント"
          >
            <FiPlus size={28} />
          </button>
          <button
            type="button"
            onClick={() => router.push("/home/store/mypage")}
            className="flex flex-col items-center text-[#F2A900] transition-all"
          >
            <FiUser size={22} />
            <span className="mt-1 text-[11px] font-medium">マイページ</span>
          </button>
        </div>
      </nav>
    </main>
  )
}