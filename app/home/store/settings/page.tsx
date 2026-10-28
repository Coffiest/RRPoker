"use client"
import { ChevronLeftIcon, ChevronRightIcon, MinusIcon, PlusIcon, SearchIcon, Trash2Icon, UserIcon, XIcon } from 'lucide-react'

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { auth, db } from "@/lib/firebase"
import HomeHeader from "@/components/HomeHeader"
import StoreBottomNav from "@/components/StoreBottomNav"
import { getCommonMenuItems } from "@/components/commonMenuItems"
import { useLanguage, type Language } from "@/lib/i18n"
import AppleSheet from "@/components/AppleSheet"
import ConfirmDialog, { type ConfirmRequest } from "@/components/ConfirmDialog"
import { ChoiceRow, FieldRow, LargeTitle, NavRow, PageTitleBar, PrimaryButton, Section, SwitchRow, fieldInput } from "@/components/GroupedList"

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
  setDoc,
  where,
} from "firebase/firestore"


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

type StampPlayer = {
  uid: string
  name: string
  iconUrl?: string
  stampCount: number
  lastStampAt: Date | null
}

function FeedbackText({ text, color }: { text: string; color: "green" | "red" }) {
  return (
    <p role={color === "red" ? "alert" : "status"} style={{ fontSize: 15, margin: '-16px 16px 16px', color: color === "green" ? "#1E7B34" : "#D70015" }}>
      {text}
    </p>
  )
}

export default function StoreSettingsPage() {
  const router = useRouter()
  const { language, setLanguage, t } = useLanguage()
  const [storeId, setStoreId] = useState<string | null>(null)
  const [store, setStore] = useState<StoreInfo | null>(null)
  const [chipExpiryInput, setChipExpiryInput] = useState("")
  const [chipExpiryError, setChipExpiryError] = useState("")
  const [chipExpirySuccess, setChipExpirySuccess] = useState("")
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
  const [postalCode, setPostalCode] = useState("")
  const [postalCodeError, setPostalCodeError] = useState("")
  const [postalCodeSuccess, setPostalCodeSuccess] = useState("")

  // スタンプ管理
  const [stampModalOpen, setStampModalOpen] = useState(false)
  const [stampPlayers, setStampPlayers] = useState<StampPlayer[]>([])
  const [stampLoading, setStampLoading] = useState(false)
  const [stampSearch, setStampSearch] = useState("")
  const [stampSort, setStampSort] = useState<"recent" | "name" | "count">("recent")
  const [editStampPlayer, setEditStampPlayer] = useState<StampPlayer | null>(null)
  const [editStampCount, setEditStampCount] = useState("")
  const [editSaving, setEditSaving] = useState(false)
  const [confirmReq, setConfirmReq] = useState<ConfirmRequest | null>(null)

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
      setPostalCode(data?.postalCode ?? "")
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

  const savePostalCode = async () => {
    if (!storeId) return
    const code = postalCode.replace(/[^0-9]/g, "")
    if (code.length !== 7) { setPostalCodeError("7桁の郵便番号を入力してください（ハイフンなし）"); return }
    setPostalCodeError("")
    setPostalCodeSuccess("")
    try {
      const res = await fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${code}`)
      const json = await res.json()
      if (!json.results?.[0]) { setPostalCodeError("郵便番号が見つかりませんでした"); return }
      const { latitude, longitude } = json.results[0]
      await updateDoc(doc(db, "stores", storeId), {
        postalCode: code,
        lat: parseFloat(latitude),
        lng: parseFloat(longitude),
      })
      setPostalCodeSuccess("保存しました")
      setTimeout(() => setPostalCodeSuccess(""), 3000)
    } catch {
      setPostalCodeError("保存に失敗しました")
    }
  }

  const loadStampPlayers = async () => {
    if (!storeId) return
    setStampLoading(true)
    try {
      const usersSnap = await getDocs(
        query(collection(db, "users"), where("joinedStores", "array-contains", storeId))
      )
      const players: StampPlayer[] = []
      await Promise.all(usersSnap.docs.map(async userDoc => {
        const userData = userDoc.data()
        const stampSnap = await getDoc(doc(db, "users", userDoc.id, "storeStamp", storeId))
        const stampData = stampSnap.data()
        players.push({
          uid: userDoc.id,
          name: userData.name ?? userDoc.id,
          iconUrl: userData.iconUrl,
          stampCount: stampData?.stampCount ?? 0,
          lastStampAt: stampData?.lastStampAt?.toDate?.() ?? null,
        })
      }))
      setStampPlayers(players)
    } finally {
      setStampLoading(false)
    }
  }

  const saveStampCount = async () => {
    if (!storeId || !editStampPlayer) return
    const count = parseInt(editStampCount, 10)
    if (isNaN(count) || count < 0) return
    setEditSaving(true)
    try {
      const stampRef = doc(db, "users", editStampPlayer.uid, "storeStamp", storeId)
      await setDoc(stampRef, { stampCount: count }, { merge: true })
      setStampPlayers(prev =>
        prev.map(p => p.uid === editStampPlayer.uid ? { ...p, stampCount: count } : p)
      )
      setEditStampPlayer(null)
    } finally {
      setEditSaving(false)
    }
  }

  const filteredStampPlayers = useMemo(() => {
    let list = stampPlayers.filter(p =>
      !stampSearch.trim() || p.name.toLowerCase().includes(stampSearch.toLowerCase())
    )
    if (stampSort === "recent") {
      list = [...list].sort((a, b) => (b.lastStampAt?.getTime() ?? 0) - (a.lastStampAt?.getTime() ?? 0))
    } else if (stampSort === "name") {
      list = [...list].sort((a, b) => a.name.localeCompare(b.name, "ja"))
    } else {
      list = [...list].sort((a, b) => b.stampCount - a.stampCount)
    }
    return list
  }, [stampPlayers, stampSearch, stampSort])

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

  const [sheet, setSheet] = useState<null | "coupon" | "birthday" | "notice" | "unit" | "expiry" | "postal">(null)
  const closeSheet = () => setSheet(null)
  const unitPreview = chipUnitLabel ? (chipUnitBefore ? `${chipUnitLabel}500` : `500${chipUnitLabel}`) : "500"
  const sheetTitle = (title: string, sub?: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: '-0.01em', color: 'var(--label)' }}>{title}</p>
        {sub && <p style={{ fontSize: 13, color: 'var(--label2)', margin: '2px 0 0' }}>{sub}</p>}
      </div>
      <button type="button" onClick={closeSheet} aria-label="閉じる"
        style={{ width: 44, height: 44, borderRadius: 22, border: 'none', background: 'rgba(118,118,128,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--label)', marginRight: -8, cursor: 'pointer' }}>
        <XIcon size={20} />
      </button>
    </div>
  )

  return (
    <main style={{ minHeight: '100dvh', background: '#F2F2F7', paddingBottom: 'calc(136px + env(safe-area-inset-bottom, 0px))' }}>
      <HomeHeader
        homePath="/home/store"
        myPagePath="/home/store/mypage"
        variant="store"
        menuItems={getCommonMenuItems(router, "store")}
      />

      <div style={{ maxWidth: 560, margin: '0 auto', padding: '0 16px' }}>
        <PageTitleBar title="" onBack={() => router.push("/home/store")} />
        <LargeTitle>Settings</LargeTitle>

        <Section header="入店" footer="オフにすると、プレイヤーは申請するとすぐ入店できます。">
          <SwitchRow label="入店に承認を必要にする" checked={isApprovalRequired} onChange={() => void toggleApprovalRequired()} />
        </Section>

        <Section header="入店ボーナス" footer="入店するたびにスタンプが 1 つ付き、一定数でクーポンを配ります。">
          <SwitchRow label="入店ボーナス" checked={checkinBonusEnabled} onChange={() => void toggleCheckinBonus()} />
          {checkinBonusEnabled && (
            <>
              <NavRow label="クーポン名" detail={couponName || "未設定"} onClick={() => { setCouponError(""); setCouponSuccess(""); setSheet("coupon") }} />
              <NavRow label="スタンプ数の管理" onClick={() => { setStampSearch(""); setStampSort("recent"); setStampModalOpen(true); void loadStampPlayers() }} />
            </>
          )}
        </Section>

        <Section header="誕生日クーポン" footer="誕生日を登録したプレイヤーに、誕生日にクーポンを自動で配ります。">
          <SwitchRow label="誕生日クーポン" checked={birthdayCouponEnabled} onChange={() => void toggleBirthdayCoupon()} />
          {birthdayCouponEnabled && (
            <NavRow label="内容" detail={birthdayCouponName || "未設定"} onClick={() => { setBirthdayCouponError(""); setBirthdayCouponSuccess(""); setSheet("birthday") }} />
          )}
        </Section>

        <Section header="お知らせ">
          <NavRow label="お知らせを送る" onClick={() => { setNoticeError(""); setNoticeSuccess(""); setSheet("notice") }} />
        </Section>

        <Section header="チップ">
          <NavRow label="通貨の単位" detail={unitPreview} onClick={() => { setChipUnitError(""); setChipUnitSuccess(""); setSheet("unit") }} />
          <NavRow label="有効期限" detail={store?.chipExpiryMonths ? `${store.chipExpiryMonths}ヶ月` : "期限なし"} onClick={() => {
            setChipExpiryError(""); setChipExpirySuccess(""); setChipExpiryInput(store?.chipExpiryMonths?.toString() ?? ""); setSheet("expiry")
          }} />
          <NavRow label="レーキ" detail={rakeTotal.toLocaleString()} onClick={() => { setRakeView("menu"); setRakeError(""); setIsRakeModalOpen(true) }} />
        </Section>

        <Section header="店舗の場所" footer="プレイヤーの予定画面で、近い店舗から順に並べるために使います。">
          <NavRow label="郵便番号" detail={postalCode || "未設定"} onClick={() => { setPostalCodeError(""); setPostalCodeSuccess(""); setSheet("postal") }} />
        </Section>

        <Section header={t('settings.language')} footer={t('settings.languageNote')}>
          {([{ v: 'ja' as Language, label: t('common.japanese') }, { v: 'en' as Language, label: t('common.english') }]).map(opt => (
            <ChoiceRow key={opt.v} label={opt.label} selected={language === opt.v} onSelect={() => setLanguage(opt.v)} />
          ))}
        </Section>

        <Section>
          <NavRow label={t('common.privacyPolicy')} onClick={() => router.push('/privacy')} />
        </Section>
      </div>

      {/* ── 入店ボーナスのクーポン名 ── */}
      <AppleSheet open={sheet === "coupon"} onClose={closeSheet} title={sheetTitle("クーポン名", "スタンプが貯まったときに配るクーポン")}
        footer={<PrimaryButton onClick={async () => { await saveCouponName(); }}>保存する</PrimaryButton>}>
        <Section footer="20 文字まで">
          <FieldRow label="名前">
            <input value={couponName} onChange={e => { setCouponError(""); setCouponName(e.target.value) }} placeholder="例: 入店無料クーポン" maxLength={20} style={fieldInput} />
          </FieldRow>
        </Section>
        {couponError && <FeedbackText text={couponError} color="red" />}
        {couponSuccess && <FeedbackText text={couponSuccess} color="green" />}
      </AppleSheet>

      {/* ── 誕生日クーポン ── */}
      <AppleSheet open={sheet === "birthday"} onClose={closeSheet} title={sheetTitle("誕生日クーポン")}
        footer={<PrimaryButton onClick={saveBirthdayCoupon}>保存する</PrimaryButton>}>
        <Section>
          <FieldRow label="クーポン名">
            <input value={birthdayCouponName} onChange={e => setBirthdayCouponName(e.target.value)} placeholder="例: 誕生日ドリンク" style={fieldInput} />
          </FieldRow>
        </Section>
        <Section header="有効期限">
          <SwitchRow label="無期限" checked={birthdayCouponUnlimited} onChange={setBirthdayCouponUnlimited} />
          {!birthdayCouponUnlimited && (
            <FieldRow label="期間">
              <input type="number" inputMode="numeric" value={birthdayCouponExpiryValue} onChange={e => setBirthdayCouponExpiryValue(e.target.value)} placeholder="7" style={{ ...fieldInput, width: 64 }} className="no-spin" />
              <select value={birthdayCouponExpiryUnit} onChange={e => setBirthdayCouponExpiryUnit(e.target.value as "day" | "month")}
                style={{ height: 44, border: 'none', background: 'none', fontSize: 17, color: 'var(--label2)', fontFamily: 'inherit' }}>
                <option value="day">日</option>
                <option value="month">ヶ月</option>
              </select>
            </FieldRow>
          )}
        </Section>
        {birthdayCouponError && <FeedbackText text={birthdayCouponError} color="red" />}
        {birthdayCouponSuccess && <FeedbackText text={birthdayCouponSuccess} color="green" />}
      </AppleSheet>

      {/* ── お知らせ ── */}
      <AppleSheet open={sheet === "notice"} onClose={closeSheet} title={sheetTitle("お知らせを送る", "お気に入りに登録しているプレイヤーに届きます")}
        footer={<PrimaryButton onClick={sendNotice} disabled={noticeSending || !noticeMessage.trim()}>{noticeSending ? "送信しています…" : "送信する"}</PrimaryButton>}>
        <Section>
          <textarea value={noticeMessage} onChange={e => { setNoticeError(""); setNoticeSuccess(""); setNoticeMessage(e.target.value) }} placeholder="メッセージ" rows={5} aria-label="メッセージ"
            style={{ display: 'block', width: '100%', boxSizing: 'border-box', padding: 16, border: 'none', outline: 'none', resize: 'none', fontSize: 17, lineHeight: 1.4, color: 'var(--label)', fontFamily: 'inherit', background: 'transparent' }} />
        </Section>
        {noticeError && <FeedbackText text={noticeError} color="red" />}
        {noticeSuccess && <FeedbackText text={noticeSuccess} color="green" />}
      </AppleSheet>

      {/* ── 通貨の単位 ── */}
      <AppleSheet open={sheet === "unit"} onClose={closeSheet} title={sheetTitle("通貨の単位", "チップの数の横に表示されます")}
        footer={<PrimaryButton onClick={saveChipUnit}>保存する</PrimaryButton>}>
        <div style={{ textAlign: 'center', padding: '8px 0 24px' }}>
          <p style={{ fontSize: 13, color: 'var(--label2)', margin: 0 }}>表示の例</p>
          <p style={{ fontSize: 34, fontWeight: 700, margin: '4px 0 0', fontVariantNumeric: 'tabular-nums', color: 'var(--label)' }}>{unitPreview}</p>
        </div>
        <Section footer="例: $、pt.、chips。単位を付けないときは空欄にします。">
          <FieldRow label="単位">
            <input value={chipUnitLabel} onChange={e => setChipUnitLabel(e.target.value)} placeholder="なし" style={fieldInput} />
          </FieldRow>
        </Section>
        <Section header="表示する位置">
          <ChoiceRow label="数の前" detail="例: $500" selected={chipUnitBefore} onSelect={() => setChipUnitBefore(true)} />
          <ChoiceRow label="数の後" detail="例: 500pt." selected={!chipUnitBefore} onSelect={() => setChipUnitBefore(false)} />
        </Section>
        {chipUnitError && <FeedbackText text={chipUnitError} color="red" />}
        {chipUnitSuccess && <FeedbackText text={chipUnitSuccess} color="green" />}
      </AppleSheet>

      {/* ── チップの有効期限 ── */}
      <AppleSheet open={sheet === "expiry"} onClose={closeSheet} title={sheetTitle("チップの有効期限")}
        footer={<PrimaryButton onClick={saveChipExpiry}>保存する</PrimaryButton>}>
        <Section footer="0 にすると期限なしになります。変更すると、チップを持っているプレイヤーに通知が届きます。">
          <FieldRow label="期限">
            <input type="number" inputMode="numeric" value={chipExpiryInput} onChange={e => setChipExpiryInput(e.target.value)} placeholder="0" style={{ ...fieldInput, width: 80 }} className="no-spin" />
            <span style={{ fontSize: 17, color: 'var(--label2)' }}>ヶ月</span>
          </FieldRow>
        </Section>
        {chipExpiryError && <FeedbackText text={chipExpiryError} color="red" />}
        {chipExpirySuccess && <FeedbackText text={`${chipExpirySuccess}。通知を送信しました`} color="green" />}
      </AppleSheet>

      {/* ── 郵便番号 ── */}
      <AppleSheet open={sheet === "postal"} onClose={closeSheet} title={sheetTitle("店舗の場所")}
        footer={<PrimaryButton onClick={savePostalCode}>保存する</PrimaryButton>}>
        <Section footer="7 桁の数字(ハイフンなし)。住所から地図上の位置を調べて保存します。">
          <FieldRow label="郵便番号">
            <input inputMode="numeric" value={postalCode} onChange={e => { setPostalCode(e.target.value); setPostalCodeError(""); setPostalCodeSuccess("") }} placeholder="1500001" maxLength={8} style={fieldInput} autoComplete="postal-code" />
          </FieldRow>
        </Section>
        {postalCodeError && <FeedbackText text={postalCodeError} color="red" />}
        {postalCodeSuccess && <FeedbackText text={postalCodeSuccess} color="green" />}
      </AppleSheet>

      {/* ── レーキ ── */}
      <AppleSheet open={isRakeModalOpen} onClose={() => setIsRakeModalOpen(false)}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {rakeView !== "menu" && (
              <button type="button" onClick={() => setRakeView("menu")} aria-label="Back"
                style={{ width: 44, height: 44, borderRadius: 22, border: 'none', background: 'rgba(118,118,128,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--label)', marginLeft: -8, cursor: 'pointer' }}>
                <ChevronLeftIcon size={24} />
              </button>
            )}
            <p style={{ flex: 1, fontSize: 22, fontWeight: 700, margin: 0, color: 'var(--label)' }}>{rakeView === "add" ? "レーキを記録" : rakeView === "history" ? "レーキの履歴" : "レーキ"}</p>
            <button type="button" onClick={() => setIsRakeModalOpen(false)} aria-label="閉じる"
              style={{ width: 44, height: 44, borderRadius: 22, border: 'none', background: 'rgba(118,118,128,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--label)', marginRight: -8, cursor: 'pointer' }}>
              <XIcon size={20} />
            </button>
          </div>
        }
        footer={rakeView === "add" ? (
          <PrimaryButton onClick={async () => {
            if (!storeId) return
            const amount = Number(rakeAmount)
            if (!amount || amount < 1) { setRakeError("金額は 1 以上で入力してください"); return }
            setRakeError("")
            try {
              await addDoc(collection(db, "stores", storeId, "rakeEntries"), { amount, memo: rakeMemo.trim() || null, createdAt: serverTimestamp() })
              setRakeAmount(""); setRakeMemo(""); setRakeView("menu")
            } catch (error) {
              console.error("Failed to add rake entry:", error)
              setRakeError("記録できませんでした。権限を確認してください")
            }
          }}>記録する</PrimaryButton>
        ) : undefined}
      >
        {rakeView === "menu" && (
          <>
            <div style={{ textAlign: 'center', padding: '8px 0 24px' }}>
              <p style={{ fontSize: 13, color: 'var(--label2)', margin: 0 }}>レーキの合計</p>
              <p style={{ fontSize: 34, fontWeight: 700, margin: '4px 0 0', fontVariantNumeric: 'tabular-nums', color: 'var(--label)' }}>{rakeTotal.toLocaleString()}</p>
            </div>
            <Section>
              <NavRow icon={<PlusIcon size={20} style={{ color: '#B57F00' }} />} label="レーキを記録" onClick={() => setRakeView("add")} />
              <NavRow label="HISTORY" detail={`${sortedRakeEntries.length} 件`} onClick={() => setRakeView("history")} />
            </Section>
          </>
        )}
        {rakeView === "add" && (
          <>
            <Section>
              <FieldRow label="金額">
                <input type="number" inputMode="numeric" value={rakeAmount} onChange={e => { setRakeError(""); setRakeAmount(e.target.value) }} placeholder="0" style={fieldInput} className="no-spin" />
              </FieldRow>
              <FieldRow label="メモ">
                <input value={rakeMemo} onChange={e => setRakeMemo(e.target.value)} placeholder="任意" style={fieldInput} />
              </FieldRow>
            </Section>
            {rakeError && <FeedbackText text={rakeError} color="red" />}
          </>
        )}
        {rakeView === "history" && (
          sortedRakeEntries.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '32px 0', fontSize: 15, color: 'var(--label2)' }}>まだ記録がありません</p>
          ) : (
            <Section>
              {sortedRakeEntries.map(entry => (
                <div key={entry.id} style={{ display: 'flex', alignItems: 'center', gap: 16, minHeight: 56, padding: '8px 8px 8px 16px' }}>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 17, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: 'var(--label)' }}>+{entry.amount.toLocaleString()}</span>
                    <span style={{ display: 'block', fontSize: 13, color: 'var(--label2)', marginTop: 2 }}>
                      {formatDateTime(entry.createdAt?.seconds)}{entry.memo ? ` ・ ${entry.memo}` : ""}
                    </span>
                  </span>
                  <button type="button" aria-label="この記録を削除"
                    onClick={() => setConfirmReq({
                      title: "レーキの記録を削除", message: `+${entry.amount.toLocaleString()} の記録を削除します。元に戻せません。`, action: "削除", destructive: true,
                      run: async () => {
                        if (!storeId) return
                        try { await deleteDoc(doc(db, "stores", storeId, "rakeEntries", entry.id)) }
                        catch (error) { console.error("Failed to delete rake entry:", error); setRakeError("削除できませんでした。権限を確認してください") }
                      },
                    })}
                    style={{ width: 44, height: 44, border: 'none', background: 'none', color: '#D70015', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <Trash2Icon size={20} />
                  </button>
                </div>
              ))}
            </Section>
          )
        )}
      </AppleSheet>

      {/* ── スタンプ数の管理 ── */}
      <AppleSheet open={stampModalOpen} onClose={() => setStampModalOpen(false)} maxHeightVh={92}
        title={
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <p style={{ flex: 1, fontSize: 22, fontWeight: 700, margin: 0, color: 'var(--label)' }}>スタンプ数の管理</p>
              <button type="button" onClick={() => setStampModalOpen(false)} aria-label="閉じる"
                style={{ width: 44, height: 44, borderRadius: 22, border: 'none', background: 'rgba(118,118,128,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--label)', marginRight: -8, cursor: 'pointer' }}>
                <XIcon size={20} />
              </button>
            </div>
            <div style={{ position: 'relative', marginTop: 16 }}>
              <SearchIcon size={20} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--label2)', pointerEvents: 'none' }} />
              <input type="search" value={stampSearch} onChange={e => setStampSearch(e.target.value)} placeholder="名前で検索" aria-label="名前で検索"
                style={{ width: '100%', height: 44, borderRadius: 12, border: 'none', background: 'rgba(118,118,128,0.12)', padding: '0 16px 0 40px', fontSize: 17, outline: 'none', boxSizing: 'border-box', color: 'var(--label)', fontFamily: 'inherit' }} />
            </div>
            <div role="tablist" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, padding: 4, marginTop: 8, background: 'rgba(118,118,128,0.12)', borderRadius: 12 }}>
              {([{ key: "recent", label: "最近の入店" }, { key: "name", label: "名前" }, { key: "count", label: "スタンプ数" }] as const).map(opt => (
                <button key={opt.key} type="button" role="tab" aria-selected={stampSort === opt.key} onClick={() => setStampSort(opt.key)}
                  style={{ minHeight: 44, borderRadius: 8, border: 'none', fontSize: 15, fontWeight: stampSort === opt.key ? 600 : 500, color: 'var(--label)', fontFamily: 'inherit', cursor: 'pointer',
                    background: stampSort === opt.key ? '#fff' : 'transparent', boxShadow: stampSort === opt.key ? '0 1px 3px rgba(0,0,0,0.12)' : 'none' }}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        }
      >
        {stampLoading ? (
          <p style={{ textAlign: 'center', padding: '32px 0', fontSize: 15, color: 'var(--label2)' }}>読み込んでいます…</p>
        ) : filteredStampPlayers.length === 0 ? (
          <p style={{ textAlign: 'center', padding: '32px 0', fontSize: 15, color: 'var(--label2)' }}>
            {stampSearch ? "見つかりませんでした" : "入店したことのあるプレイヤーがいません"}
          </p>
        ) : (
          <Section>
            {filteredStampPlayers.map(player => (
              <button key={player.uid} type="button" className="gl-row"
                onClick={() => { setEditStampPlayer(player); setEditStampCount(String(player.stampCount)) }}
                style={{ display: 'flex', alignItems: 'center', gap: 16, width: '100%', minHeight: 64, padding: '8px 16px', border: 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}>
                <span style={{ width: 40, height: 40, borderRadius: 20, overflow: 'hidden', background: 'rgba(118,118,128,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {player.iconUrl
                    /* eslint-disable-next-line @next/next/no-img-element -- 小さなアイコン */
                    ? <img src={player.iconUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <UserIcon size={20} style={{ color: 'var(--label3)' }} />}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 17, color: 'var(--label)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{player.name}</span>
                  {player.lastStampAt && (
                    <span style={{ display: 'block', fontSize: 13, color: 'var(--label2)', marginTop: 2 }}>
                      最後の入店 {player.lastStampAt.toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" })}
                    </span>
                  )}
                </span>
                <span style={{ fontSize: 17, fontWeight: 600, color: 'var(--label)', fontVariantNumeric: 'tabular-nums' }}>{player.stampCount} 個</span>
                <ChevronRightIcon size={20} style={{ color: 'var(--label3)' }} />
              </button>
            ))}
          </Section>
        )}
      </AppleSheet>

      {/* ── スタンプ数の変更 ── */}
      <AppleSheet open={!!editStampPlayer} onClose={() => setEditStampPlayer(null)} zIndex={150}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ width: 48, height: 48, borderRadius: 24, overflow: 'hidden', background: 'rgba(118,118,128,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {editStampPlayer?.iconUrl
                /* eslint-disable-next-line @next/next/no-img-element -- 小さなアイコン */
                ? <img src={editStampPlayer.iconUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <UserIcon size={24} style={{ color: 'var(--label3)' }} />}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 22, fontWeight: 700, margin: 0, color: 'var(--label)' }}>{editStampPlayer?.name}</p>
              <p style={{ fontSize: 13, color: 'var(--label2)', margin: '2px 0 0' }}>スタンプ数を変更</p>
            </div>
          </div>
        }
        footer={<PrimaryButton onClick={saveStampCount} disabled={editSaving}>{editSaving ? "保存しています…" : "保存する"}</PrimaryButton>}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24, padding: '16px 0 24px' }}>
          <button type="button" aria-label="1 つ減らす" onClick={() => setEditStampCount(v => String(Math.max(0, parseInt(v || "0", 10) - 1)))}
            style={{ width: 56, height: 56, borderRadius: 28, border: 'none', background: 'rgba(118,118,128,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--label)', cursor: 'pointer' }}>
            <MinusIcon size={24} />
          </button>
          <input type="number" inputMode="numeric" value={editStampCount} onChange={e => setEditStampCount(e.target.value)} min={0} aria-label="スタンプ数" className="no-spin"
            style={{ width: 96, height: 64, borderRadius: 16, border: 'none', background: 'rgba(118,118,128,0.12)', textAlign: 'center', fontSize: 34, fontWeight: 700, color: 'var(--label)', outline: 'none', fontVariantNumeric: 'tabular-nums', fontFamily: 'inherit' }} />
          <button type="button" aria-label="1 つ増やす" onClick={() => setEditStampCount(v => String(parseInt(v || "0", 10) + 1))}
            style={{ width: 56, height: 56, borderRadius: 28, border: 'none', background: 'rgba(118,118,128,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--label)', cursor: 'pointer' }}>
            <PlusIcon size={24} />
          </button>
        </div>
      </AppleSheet>

      <ConfirmDialog request={confirmReq} onClose={() => setConfirmReq(null)} />
      <StoreBottomNav />
    </main>
  )
}
