"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { auth, db } from "@/lib/firebase"
import HomeHeader from "@/components/HomeHeader"
import { getCommonMenuItems } from "@/components/commonMenuItems"

import {
  addDoc,
  collection,
  deleteField,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  setDoc
} from "firebase/firestore"

import { FiArrowLeft, FiTrash2, FiHome, FiUser, FiPlus } from "react-icons/fi"

type StoreInfo = {
  name: string
  chipExpiryMonths?: number
}

type RakeEntry = {
  id: string
  amount: number
  memo?: string
  createdAt?: { seconds?: number }
}

const CLR = {
  bg:      "#FFFBF5",
  white:   "#FFFFFF",
  surface: "#F5F3EF",
  border:  "#E8E3DB",
  gold:    "#F2A900",
  goldDk:  "#D4910A",
  ink:     "#1D1D1F",
  gray2:   "#6E6E73",
  gray3:   "#AEAEB2",
  red:     "#E53E3A",
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      className="relative shrink-0 w-[46px] h-[27px] rounded-full transition-all duration-200"
      style={{ background: on ? "#34C759" : CLR.border }}
    >
      <span
        className="absolute top-[3px] left-[3px] w-[21px] h-[21px] bg-white rounded-full shadow-sm transition-all duration-200"
        style={{ transform: on ? "translateX(19px)" : "translateX(0)" }}
      />
    </button>
  )
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-3xl p-5" style={{ background: CLR.white, border: `1px solid ${CLR.border}` }}>
      {children}
    </div>
  )
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <p className="text-[15px] font-bold" style={{ color: CLR.ink }}>{title}</p>
      {subtitle && <p className="text-[12px] mt-0.5" style={{ color: CLR.gray2 }}>{subtitle}</p>}
    </div>
  )
}

function FieldInput({ value, onChange, placeholder, type = "text", disabled }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string; disabled?: boolean
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className="w-full h-11 rounded-2xl px-4 text-[14px] outline-none transition-all disabled:opacity-40"
      style={{ background: CLR.surface, border: `1.5px solid ${CLR.border}`, color: CLR.ink }}
      onFocus={e => (e.target.style.borderColor = CLR.gold)}
      onBlur={e => (e.target.style.borderColor = CLR.border)}
    />
  )
}

function PrimaryButton({ onClick, disabled, children }: {
  onClick: () => void; disabled?: boolean; children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full h-11 rounded-2xl text-[14px] font-bold active:scale-95 transition-all disabled:opacity-40"
      style={{ background: CLR.gold, color: CLR.ink }}
    >
      {children}
    </button>
  )
}

function GhostButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full h-11 rounded-2xl text-[14px] font-semibold active:scale-95 transition-all"
      style={{ background: CLR.surface, color: CLR.ink, border: `1px solid ${CLR.border}` }}
    >
      {children}
    </button>
  )
}

function FeedbackText({ text, color }: { text: string; color: "green" | "red" }) {
  return (
    <p className="text-[12px] mt-1.5 font-medium" style={{ color: color === "green" ? "#15803D" : CLR.red }}>
      {text}
    </p>
  )
}

export default function StoreSettingsPage() {
  const router = useRouter()
  const [storeId, setStoreId] = useState<string | null>(null)
  const [store, setStore] = useState<StoreInfo | null>(null)
  const [chipExpiryInput, setChipExpiryInput] = useState("")
  const [chipExpiryError, setChipExpiryError] = useState("")
  const [chipExpirySuccess, setChipExpirySuccess] = useState("")
  const [isChipExpiryModalOpen, setIsChipExpiryModalOpen] = useState(false)
  const [rakeEntries, setRakeEntries] = useState<RakeEntry[]>([])
  const [isRakeModalOpen, setIsRakeModalOpen] = useState(false)
  const [rakeView, setRakeView] = useState<"menu" | "add" | "history">("menu")
  const [rakeAmount, setRakeAmount] = useState("")
  const [rakeMemo, setRakeMemo] = useState("")
  const [rakeError, setRakeError] = useState("")
  const [checkinBonusEnabled, setCheckinBonusEnabled] = useState(false)
  const [couponName, setCouponName] = useState("")
  const [couponError, setCouponError] = useState("")
  const [couponSuccess, setCouponSuccess] = useState("")
  const [isApprovalRequired, setIsApprovalRequired] = useState(true)
  const [birthdayCouponEnabled, setBirthdayCouponEnabled] = useState(false)
  const [birthdayCouponName, setBirthdayCouponName] = useState("")
  const [birthdayCouponExpiryValue, setBirthdayCouponExpiryValue] = useState("")
  const [birthdayCouponExpiryUnit, setBirthdayCouponExpiryUnit] = useState<"day" | "month">("day")
  const [birthdayCouponUnlimited, setBirthdayCouponUnlimited] = useState(false)
  const [birthdayCouponSuccess, setBirthdayCouponSuccess] = useState("")
  const [birthdayCouponError, setBirthdayCouponError] = useState("")
  const [noticeMessage, setNoticeMessage] = useState("")
  const [noticeSending, setNoticeSending] = useState(false)
  const [noticeSuccess, setNoticeSuccess] = useState("")
  const [noticeError, setNoticeError] = useState("")
  const [chipUnitLabel, setChipUnitLabel] = useState("")
  const [chipUnitBefore, setChipUnitBefore] = useState(true)
  const [chipUnitSuccess, setChipUnitSuccess] = useState("")
  const [chipUnitError, setChipUnitError] = useState("")

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async user => {
      if (!user) return
      const userSnap = await getDoc(doc(db, "users", user.uid))
      const data = userSnap.data()
      const nextStoreId = data?.storeId as string | undefined
      setStoreId(nextStoreId ?? null)
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    const fetchStore = async () => {
      if (!storeId) return
      const snap = await getDoc(doc(db, "stores", storeId))
      const data = snap.data()
      setStore({
        name: data?.name ?? "",
        chipExpiryMonths: data?.chipExpiryMonths,
      })
      setCheckinBonusEnabled(data?.checkinBonusEnabled ?? false)
      setCouponName(data?.checkinBonusCouponName ?? "")
      setIsApprovalRequired(data?.isApprovalRequired ?? true)
      setBirthdayCouponEnabled(data?.birthdayCouponEnabled ?? false)
      setBirthdayCouponName(data?.birthdayCouponName ?? "")
      setBirthdayCouponExpiryValue(data?.birthdayCouponExpiryValue?.toString() ?? "")
      setBirthdayCouponExpiryUnit(data?.birthdayCouponExpiryUnit ?? "day")
      setBirthdayCouponUnlimited(data?.birthdayCouponUnlimited ?? false)
      setChipUnitLabel(data?.chipUnitLabel ?? "")
      setChipUnitBefore(data?.chipUnitBefore !== false)
    }
    fetchStore()
  }, [storeId])

  useEffect(() => {
    if (!storeId) return
    const q = query(collection(db, "stores", storeId, "rakeEntries"))
    const unsub = onSnapshot(q, snap => {
      const list: RakeEntry[] = []
      snap.forEach(docSnap => {
        const data = docSnap.data()
        list.push({
          id: docSnap.id,
          amount: typeof data.amount === "number" ? data.amount : 0,
          memo: data.memo,
          createdAt: data.createdAt,
        })
      })
      setRakeEntries(list)
    })
    return () => unsub()
  }, [storeId])

  const rakeTotal = rakeEntries.reduce(
    (sum, entry) => sum + (typeof entry.amount === "number" ? entry.amount : 0),
    0
  )

  const sortedRakeEntries = [...rakeEntries].sort(
    (a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0)
  )

  const formatDateTime = (seconds?: number) => {
    if (!seconds) return ""
    const date = new Date(seconds * 1000)
    const pad = (v: number) => v.toString().padStart(2, "0")
    return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
  }

  const saveChipExpiry = async () => {
    if (!storeId) return
    setChipExpiryError("")
    setChipExpirySuccess("")

    const raw = chipExpiryInput.trim()
    const previousValue = store?.chipExpiryMonths

    if (!raw) {
      await updateDoc(doc(db, "stores", storeId), { chipExpiryMonths: deleteField() })
      setChipExpirySuccess("保存しました")
      setChipExpiryInput("")
      if (previousValue !== undefined) await sendExpiryChangeNotification(storeId, undefined, previousValue)
      setTimeout(() => setChipExpirySuccess(""), 3000)
      return
    }

    const months = Number(raw)
    if (!Number.isInteger(months) || months < 0) {
      setChipExpiryError("0以上の整数で入力してください")
      return
    }

    if (months === 0) {
      await updateDoc(doc(db, "stores", storeId), { chipExpiryMonths: deleteField() })
      setChipExpirySuccess("保存しました")
      setChipExpiryInput("")
      if (previousValue !== undefined && previousValue !== 0) await sendExpiryChangeNotification(storeId, undefined, previousValue)
      setTimeout(() => setChipExpirySuccess(""), 3000)
      return
    }

    await updateDoc(doc(db, "stores", storeId), { chipExpiryMonths: months })
    setChipExpirySuccess("保存しました")
    if (previousValue !== months) await sendExpiryChangeNotification(storeId, months, previousValue)
    setTimeout(() => setChipExpirySuccess(""), 3000)
  }

  const toggleCheckinBonus = async () => {
    if (!storeId) return
    const next = !checkinBonusEnabled
    setCheckinBonusEnabled(next)
    await updateDoc(doc(db, "stores", storeId), { checkinBonusEnabled: next })
  }

  const toggleBirthdayCoupon = async () => {
    if (!storeId) return
    const next = !birthdayCouponEnabled
    setBirthdayCouponEnabled(next)
    await updateDoc(doc(db, "stores", storeId), { birthdayCouponEnabled: next })
  }

  const saveBirthdayCoupon = async () => {
    if (!storeId) return
    if (!birthdayCouponName.trim()) { setBirthdayCouponError("クーポン名を入力してください"); return }
    if (!birthdayCouponUnlimited && !birthdayCouponExpiryValue) { setBirthdayCouponError("有効期限を入力してください"); return }
    setBirthdayCouponError("")
    setBirthdayCouponSuccess("")
    await updateDoc(doc(db, "stores", storeId), {
      birthdayCouponName,
      birthdayCouponExpiryValue: birthdayCouponUnlimited ? null : Number(birthdayCouponExpiryValue),
      birthdayCouponExpiryUnit,
      birthdayCouponUnlimited
    })
    setBirthdayCouponSuccess("保存しました")
    setTimeout(() => setBirthdayCouponSuccess(""), 2000)
  }

  const toggleApprovalRequired = async () => {
    if (!storeId) return
    const next = !isApprovalRequired
    setIsApprovalRequired(next)
    await updateDoc(doc(db, "stores", storeId), { isApprovalRequired: next })
    if (!next) {
      const usersSnap = await getDocs(collection(db, "users"))
      for (const userDoc of usersSnap.docs) {
        const data = userDoc.data()
        if (data.pendingStoreId === storeId && data.checkinStatus === "pending") {
          await updateDoc(doc(db, "users", userDoc.id), {
            currentStoreId: storeId, checkinStatus: "approved", pendingStoreId: null
          })
          const balanceRef = doc(db, "users", userDoc.id, "storeBalances", storeId)
          const balanceSnap = await getDoc(balanceRef)
          if (!balanceSnap.exists()) {
            await setDoc(balanceRef, { balance: 0, netGain: 0, createdAt: serverTimestamp() })
          }
        }
      }
    }
  }

  const saveCouponName = async () => {
    if (!storeId) return
    if (!couponName.trim()) { setCouponError("クーポン名を入力してください"); return }
    if (couponName.length > 20) { setCouponError("20文字以内で入力してください"); return }
    setCouponError("")
    setCouponSuccess("")
    await updateDoc(doc(db, "stores", storeId), { checkinBonusCouponName: couponName })
    setCouponSuccess("保存しました")
    setTimeout(() => setCouponSuccess(""), 2000)
  }

  const sendNotice = async () => {
    if (!storeId || !noticeMessage.trim()) { setNoticeError("メッセージを入力してください"); return }
    setNoticeSending(true)
    setNoticeError("")
    try {
      await addDoc(collection(db, "stores", storeId, "notices"), {
        message: noticeMessage.trim(), createdAt: serverTimestamp(),
      })
      setNoticeMessage("")
      setNoticeSuccess("送信しました")
      setTimeout(() => setNoticeSuccess(""), 2500)
    } catch {
      setNoticeError("送信に失敗しました")
    } finally {
      setNoticeSending(false)
    }
  }

  const sendExpiryChangeNotification = async (storeId: string, newValue?: number, _oldValue?: number) => {
    try {
      const storeSnap = await getDoc(doc(db, "stores", storeId))
      const storeName = storeSnap.data()?.name ?? "店舗"
      const message = newValue
        ? `チップの有効期限が${newValue}ヶ月に変更されました`
        : `チップの有効期限が削除されました（期限なし）`
      const playerMessage = newValue
        ? `${storeName}のチップ有効期限が${newValue}ヶ月に変更されました`
        : `${storeName}のチップ有効期限が削除されました（期限なし）`
      const timestamp = serverTimestamp()
      await addDoc(collection(db, "stores", storeId, "notices"), { message, createdAt: timestamp, expiredAt: timestamp })
      const usersSnap = await getDocs(collection(db, "users"))
      const promises: Promise<any>[] = []
      for (const userDoc of usersSnap.docs) {
        const userId = userDoc.id
        const balanceSnap = await getDoc(doc(db, "users", userId, "storeBalances", storeId))
        if (balanceSnap.exists()) {
          const balance = balanceSnap.data()?.balance ?? 0
          if (balance >= 1) {
            promises.push(addDoc(collection(db, "notifications"), {
              userId, storeId, storeName, message: playerMessage,
              type: "chip_expiry_change", createdAt: timestamp, read: false,
            }))
          }
        }
      }
      await Promise.all(promises)
    } catch (error) {
      console.error("Failed to send expiry change notification:", error)
    }
  }

  const saveChipUnit = async () => {
    if (!storeId) return
    setChipUnitError("")
    setChipUnitSuccess("")
    try {
      await updateDoc(doc(db, "stores", storeId), {
        chipUnitLabel: chipUnitLabel.trim(),
        chipUnitBefore,
      })
      setChipUnitSuccess("保存しました")
      setTimeout(() => setChipUnitSuccess(""), 3000)
    } catch {
      setChipUnitError("保存に失敗しました")
    }
  }

  return (
    <main className="min-h-screen pb-28" style={{ background: CLR.bg }}>
      <HomeHeader
        homePath="/home/store"
        myPagePath="/home/store/mypage"
        variant="store"
        menuItems={getCommonMenuItems(router, "store")}
      />

      <div className="mx-auto max-w-sm px-5">
        <button
          type="button"
          onClick={() => router.push("/home/store")}
          className="mt-6 inline-flex items-center gap-1.5 text-[13px] font-semibold active:scale-95 transition-all"
          style={{ color: CLR.gray2 }}
        >
          <FiArrowLeft size={14} />
          戻る
        </button>

        <h1 className="mt-3 text-[22px] font-bold tracking-tight" style={{ color: CLR.ink }}>設定</h1>

        <div className="mt-6 space-y-4">

          {/* ── 入店ボーナス ── */}
          <SectionCard>
            <SectionTitle title="入店ボーナス" subtitle="入店時にスタンプを付与し、一定数でクーポンを配布します" />
            <div className="flex items-center justify-between">
              <span className="text-[14px]" style={{ color: CLR.ink }}>機能を有効にする</span>
              <Toggle on={checkinBonusEnabled} onToggle={toggleCheckinBonus} />
            </div>
            {checkinBonusEnabled && (
              <div className="mt-4 space-y-3">
                <div>
                  <p className="text-[11px] font-semibold mb-1.5" style={{ color: CLR.gray2 }}>クーポン名</p>
                  <FieldInput
                    value={couponName}
                    onChange={setCouponName}
                    placeholder="例：入店無料クーポン"
                  />
                  {couponError && <FeedbackText text={couponError} color="red" />}
                  {couponSuccess && <FeedbackText text={couponSuccess} color="green" />}
                </div>
                <PrimaryButton onClick={saveCouponName}>保存する</PrimaryButton>
              </div>
            )}
          </SectionCard>

          {/* ── 入店制限 ── */}
          <SectionCard>
            <SectionTitle title="入店制限" subtitle="ON：承認必要 / OFF：即入店" />
            <div className="flex items-center justify-between">
              <span className="text-[14px]" style={{ color: CLR.ink }}>承認を必要にする</span>
              <Toggle on={isApprovalRequired} onToggle={toggleApprovalRequired} />
            </div>
          </SectionCard>

          {/* ── 誕生日クーポン ── */}
          <SectionCard>
            <SectionTitle title="誕生日クーポン" subtitle="誕生日にクーポンを自動配布" />
            <div className="flex items-center justify-between">
              <span className="text-[14px]" style={{ color: CLR.ink }}>有効にする</span>
              <Toggle on={birthdayCouponEnabled} onToggle={toggleBirthdayCoupon} />
            </div>
            {birthdayCouponEnabled && (
              <div className="mt-4 space-y-3">
                <FieldInput
                  value={birthdayCouponName}
                  onChange={setBirthdayCouponName}
                  placeholder="クーポン名"
                />
                <div className="flex items-center gap-2">
                  <div className="w-24 shrink-0">
                    <FieldInput
                      type="number"
                      value={birthdayCouponExpiryValue}
                      onChange={setBirthdayCouponExpiryValue}
                      placeholder="7"
                      disabled={birthdayCouponUnlimited}
                    />
                  </div>
                  <select
                    value={birthdayCouponExpiryUnit}
                    onChange={e => setBirthdayCouponExpiryUnit(e.target.value as any)}
                    disabled={birthdayCouponUnlimited}
                    className="h-11 rounded-2xl px-3 text-[14px] outline-none disabled:opacity-40"
                    style={{ background: CLR.surface, border: `1.5px solid ${CLR.border}`, color: CLR.ink }}
                  >
                    <option value="day">日</option>
                    <option value="month">ヶ月</option>
                  </select>
                  <label className="flex items-center gap-1.5 shrink-0 text-[13px] cursor-pointer" style={{ color: CLR.gray2 }}>
                    <input
                      type="checkbox"
                      checked={birthdayCouponUnlimited}
                      onChange={e => setBirthdayCouponUnlimited(e.target.checked)}
                      className="w-4 h-4 accent-[#F2A900]"
                    />
                    無期限
                  </label>
                </div>
                {birthdayCouponError && <FeedbackText text={birthdayCouponError} color="red" />}
                {birthdayCouponSuccess && <FeedbackText text={birthdayCouponSuccess} color="green" />}
                <PrimaryButton onClick={saveBirthdayCoupon}>保存する</PrimaryButton>
              </div>
            )}
          </SectionCard>

          {/* ── お知らせ配信 ── */}
          <SectionCard>
            <SectionTitle title="お知らせ配信" subtitle="お気に入り登録しているプレイヤーに通知が届きます" />
            <textarea
              value={noticeMessage}
              onChange={e => setNoticeMessage(e.target.value)}
              placeholder="メッセージを入力..."
              rows={3}
              className="w-full rounded-2xl px-4 py-3 text-[14px] resize-none outline-none transition-all"
              style={{ background: CLR.surface, border: `1.5px solid ${CLR.border}`, color: CLR.ink }}
              onFocus={e => (e.target.style.borderColor = CLR.gold)}
              onBlur={e => (e.target.style.borderColor = CLR.border)}
            />
            {noticeError && <FeedbackText text={noticeError} color="red" />}
            {noticeSuccess && <FeedbackText text={noticeSuccess} color="green" />}
            <div className="mt-3">
              <PrimaryButton onClick={sendNotice} disabled={noticeSending}>
                {noticeSending ? "送信中..." : "送信する"}
              </PrimaryButton>
            </div>
          </SectionCard>

          {/* ── 店内通貨単位 ── */}
          <SectionCard>
            <SectionTitle title="店内通貨の単位" subtitle="全画面でチップ量の横に表示されます" />
            <div className="space-y-4">
              <div>
                <p className="text-[11px] font-semibold mb-1.5" style={{ color: CLR.gray2 }}>単位（例: $、pt.、chips）</p>
                <FieldInput
                  value={chipUnitLabel}
                  onChange={setChipUnitLabel}
                  placeholder="単位なしの場合は空欄"
                />
              </div>
              <div>
                <p className="text-[11px] font-semibold mb-2" style={{ color: CLR.gray2 }}>表示位置</p>
                <div className="flex gap-3">
                  {([{ v: true, label: "前（例: $500）" }, { v: false, label: "後（例: 500pt.）" }] as const).map(opt => (
                    <button
                      key={String(opt.v)}
                      type="button"
                      onClick={() => setChipUnitBefore(opt.v)}
                      className="flex-1 h-10 rounded-2xl text-[13px] font-semibold transition-all"
                      style={{
                        background: chipUnitBefore === opt.v ? CLR.gold : CLR.surface,
                        color: chipUnitBefore === opt.v ? CLR.ink : CLR.gray2,
                        border: `1.5px solid ${chipUnitBefore === opt.v ? CLR.goldDk : CLR.border}`,
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl p-4 text-center" style={{ background: CLR.surface, border: `1px solid ${CLR.border}` }}>
                <p className="text-[11px] font-semibold mb-1" style={{ color: CLR.gray2 }}>プレビュー</p>
                <p className="text-[24px] font-bold" style={{ color: CLR.ink }}>
                  {chipUnitLabel
                    ? chipUnitBefore ? `${chipUnitLabel}500` : `500${chipUnitLabel}`
                    : "500"}
                </p>
              </div>
              {chipUnitError && <FeedbackText text={chipUnitError} color="red" />}
              {chipUnitSuccess && <FeedbackText text={chipUnitSuccess} color="green" />}
              <PrimaryButton onClick={saveChipUnit}>保存する</PrimaryButton>
            </div>
          </SectionCard>

          {/* ── チップ有効期限 ── */}
          <SectionCard>
            <SectionTitle title="チップの有効期限設定" />
            <div className="flex items-center justify-between mb-4">
              <span className="text-[13px]" style={{ color: CLR.gray2 }}>現在の設定</span>
              <span className="text-[14px] font-bold" style={{ color: CLR.ink }}>
                {store?.chipExpiryMonths ? `${store.chipExpiryMonths}ヶ月` : "期限なし"}
              </span>
            </div>
            <PrimaryButton onClick={() => {
              setChipExpiryError("")
              setChipExpirySuccess("")
              setChipExpiryInput(store?.chipExpiryMonths?.toString() ?? "")
              setIsChipExpiryModalOpen(true)
            }}>
              有効期限を変更する
            </PrimaryButton>
          </SectionCard>

          {/* ── レーキ ── */}
          <SectionCard>
            <SectionTitle title="レーキ" />
            <GhostButton onClick={() => { setRakeView("menu"); setRakeError(""); setIsRakeModalOpen(true) }}>
              レーキを記録する
            </GhostButton>
          </SectionCard>

        </div>
      </div>

      {/* ── チップ有効期限モーダル ── */}
      {isChipExpiryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)" }}>
          <div className="w-full max-w-sm rounded-t-3xl p-6 pb-8" style={{ background: CLR.white }}>
            <div className="w-9 h-[3px] rounded-full mx-auto mb-5" style={{ background: CLR.border }} />
            <div className="flex items-center justify-between mb-5">
              <p className="text-[17px] font-bold" style={{ color: CLR.ink }}>チップの有効期限設定</p>
              <button type="button" onClick={() => setIsChipExpiryModalOpen(false)}
                className="text-[13px] font-medium" style={{ color: CLR.gray2 }}>閉じる</button>
            </div>

            <p className="text-[11px] font-semibold mb-2" style={{ color: CLR.gray2 }}>有効期限（ヶ月）　0で期限なし</p>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-28">
                <FieldInput
                  type="number"
                  value={chipExpiryInput}
                  onChange={setChipExpiryInput}
                  placeholder="0"
                />
              </div>
              <span className="text-[13px]" style={{ color: CLR.gray2 }}>ヶ月</span>
            </div>

            {chipExpiryError && <FeedbackText text={chipExpiryError} color="red" />}
            {chipExpirySuccess && (
              <div className="mb-3 rounded-2xl p-3" style={{ background: "#F0FDF4", border: "1px solid #BBF7D0" }}>
                <p className="text-[12px] font-bold" style={{ color: "#15803D" }}>{chipExpirySuccess}</p>
                <p className="text-[11px] mt-0.5" style={{ color: "#16A34A" }}>通知を送信しました</p>
              </div>
            )}
            <PrimaryButton onClick={saveChipExpiry}>保存する</PrimaryButton>
          </div>
        </div>
      )}

      {/* ── レーキモーダル ── */}
      {isRakeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)" }}>
          <div className="w-full max-w-sm rounded-t-3xl p-6 pb-8" style={{ background: CLR.white }}>
            <div className="w-9 h-[3px] rounded-full mx-auto mb-5" style={{ background: CLR.border }} />
            <div className="flex items-center justify-between mb-4">
              <p className="text-[17px] font-bold" style={{ color: CLR.ink }}>レーキ管理</p>
              <button type="button" onClick={() => setIsRakeModalOpen(false)}
                className="text-[13px] font-medium" style={{ color: CLR.gray2 }}>閉じる</button>
            </div>

            {/* Total */}
            <div className="rounded-2xl p-4 mb-4 text-center" style={{ background: CLR.surface }}>
              <p className="text-[11px] font-semibold mb-1" style={{ color: CLR.gray2 }}>レーキ総数</p>
              <p className="text-[28px] font-bold" style={{ color: CLR.ink }}>{rakeTotal.toLocaleString()}</p>
            </div>

            {rakeView === "menu" && (
              <div className="space-y-2">
                <PrimaryButton onClick={() => setRakeView("add")}>レーキを追加する</PrimaryButton>
                <GhostButton onClick={() => setRakeView("history")}>レーキ履歴を見る</GhostButton>
              </div>
            )}

            {rakeView === "add" && (
              <div className="space-y-3">
                <FieldInput type="number" value={rakeAmount} onChange={setRakeAmount} placeholder="レーキ額" />
                <textarea
                  value={rakeMemo}
                  onChange={e => setRakeMemo(e.target.value)}
                  placeholder="メモ（任意）"
                  rows={3}
                  className="w-full rounded-2xl px-4 py-3 text-[14px] resize-none outline-none transition-all"
                  style={{ background: CLR.surface, border: `1.5px solid ${CLR.border}`, color: CLR.ink }}
                  onFocus={e => (e.target.style.borderColor = CLR.gold)}
                  onBlur={e => (e.target.style.borderColor = CLR.border)}
                />
                {rakeError && <FeedbackText text={rakeError} color="red" />}
                <div className="flex gap-2 pt-1">
                  <GhostButton onClick={() => setRakeView("menu")}>戻る</GhostButton>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!storeId) return
                      const amount = Number(rakeAmount)
                      if (!amount || amount < 1) { setRakeError("金額は1以上で入力してください"); return }
                      setRakeError("")
                      try {
                        await addDoc(collection(db, "stores", storeId, "rakeEntries"), {
                          amount, memo: rakeMemo.trim() || null, createdAt: serverTimestamp(),
                        })
                        setRakeAmount("")
                        setRakeMemo("")
                        setRakeView("menu")
                      } catch (error) {
                        console.error("Failed to add rake entry:", error)
                        setRakeError("記録に失敗しました。権限を確認してください")
                      }
                    }}
                    className="flex-1 h-11 rounded-2xl text-[14px] font-bold text-white active:scale-95 transition-all"
                    style={{ background: "#15803D" }}
                  >
                    記録する
                  </button>
                </div>
              </div>
            )}

            {rakeView === "history" && (
              <div>
                {sortedRakeEntries.length === 0 ? (
                  <p className="text-center py-8 text-[13px]" style={{ color: CLR.gray3 }}>履歴がありません</p>
                ) : (
                  <div className="space-y-2 max-h-[40vh] overflow-y-auto mb-3">
                    {sortedRakeEntries.map(entry => (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between rounded-2xl px-4 py-3"
                        style={{ background: CLR.surface }}
                      >
                        <div>
                          <p className="text-[11px]" style={{ color: CLR.gray3 }}>{formatDateTime(entry.createdAt?.seconds)}</p>
                          {entry.memo && <p className="text-[12px] mt-0.5" style={{ color: CLR.gray2 }}>{entry.memo}</p>}
                        </div>
                        <div className="flex items-center gap-3">
                          <p className="text-[14px] font-bold" style={{ color: CLR.ink }}>+{entry.amount.toLocaleString()}</p>
                          <button
                            type="button"
                            onClick={async () => {
                              if (!storeId) return
                              try {
                                await deleteDoc(doc(db, "stores", storeId, "rakeEntries", entry.id))
                              } catch (error) {
                                console.error("Failed to delete rake entry:", error)
                                setRakeError("削除に失敗しました。権限を確認してください")
                              }
                            }}
                            className="active:scale-90 transition-all"
                            style={{ color: CLR.gray3 }}
                            aria-label="削除"
                          >
                            <FiTrash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <GhostButton onClick={() => setRakeView("menu")}>戻る</GhostButton>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Bottom Nav ── */}
      <nav className="fixed bottom-0 left-0 right-0 w-full z-[80] border-t" style={{ background: "rgba(255,251,245,0.85)", backdropFilter: "blur(20px)", borderColor: CLR.border }}>
        <div className="relative mx-auto flex max-w-sm w-full items-center justify-between px-8 py-3">
          <button
            type="button"
            onClick={() => router.push("/home/store")}
            className="flex flex-col items-center gap-0.5 transition-all"
            style={{ color: CLR.gray3 }}
          >
            <FiHome size={22} />
            <span className="text-[10px] font-medium">ホーム</span>
          </button>

          <button
            type="button"
            onClick={() => router.push("/home/store/tournaments")}
            className="absolute left-1/2 top-0 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-2xl text-white shadow-lg active:scale-95 transition-all"
            style={{ background: CLR.gold }}
          >
            <FiPlus size={26} />
          </button>

          <button
            type="button"
            onClick={() => router.push("/home/store/mypage")}
            className="flex flex-col items-center gap-0.5 transition-all"
            style={{ color: CLR.gray3 }}
          >
            <FiUser size={22} />
            <span className="text-[10px] font-medium">マイページ</span>
          </button>
        </div>
      </nav>
    </main>
  )
}
