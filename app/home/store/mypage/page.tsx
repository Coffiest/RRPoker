"use client"
import { ChevronRightIcon, GlobeIcon, InstagramIcon, TwitterIcon, UserIcon, XIcon } from 'lucide-react'
import { showToast } from "@/components/Toast"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { signOut } from "firebase/auth"
import { auth, db } from "@/lib/firebase"
import { deleteField, doc, getDoc, onSnapshot, setDoc } from "firebase/firestore"
import { resizeImageToDataUrl } from "@/lib/image"
import HomeHeader from "@/components/HomeHeader"
import AppleSheet from "@/components/AppleSheet"
import ConfirmDialog, { type ConfirmRequest } from "@/components/ConfirmDialog"
import { FieldRow, LargeTitle, NavRow, PrimaryButton, Section, fieldInput } from "@/components/GroupedList"
import StoreBottomNav from "@/components/StoreBottomNav"
import { isSubscriptionActive, subscriptionPlanLabel } from "@/lib/subscription-client"

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
  const [isDeleting, setIsDeleting] = useState(false)
  const [blindSb, setBlindSb] = useState("")
  const [blindBb, setBlindBb] = useState("")
  const [blindError, setBlindError] = useState("")
  const [blindSuccess, setBlindSuccess] = useState("")
  const [subscription, setSubscription] = useState<any>(null)
  const [billingLoading, setBillingLoading] = useState(false)
  const [billingError, setBillingError] = useState("")
  const [billingSuccess, setBillingSuccess] = useState("")

  const [draftInstagram, setDraftInstagram] = useState("")
  const [draftSnsX, setDraftSnsX] = useState("")
  const [draftSnsWeb, setDraftSnsWeb] = useState("")
  const [snsError, setSnsError] = useState("")
  const [snsSuccess, setSnsSuccess] = useState("")
  const [snsSaving, setSnsSaving] = useState(false)

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
      setDraftInstagram(data.snsInstagram ?? "")
      setDraftSnsX(data.snsX ?? "")
      setDraftSnsWeb(data.snsWeb ?? "")
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

  useEffect(() => {
    if (!storeId) return
    const unsub = onSnapshot(doc(db, "stores", storeId), snap => {
      const d: Record<string, any> = snap.data() ?? {}
      const nested = d.subscription ?? {}
      const status = nested.status ?? d["subscription.status"]
      const sub = status ? {
        status,
        plan: nested.plan ?? d["subscription.plan"],
        interval: nested.interval ?? d["subscription.interval"],
        currentPeriodEnd: nested.currentPeriodEnd ?? d["subscription.currentPeriodEnd"],
        cancelAtPeriodEnd: nested.cancelAtPeriodEnd ?? d["subscription.cancelAtPeriodEnd"],
        stripeCustomerId: nested.stripeCustomerId ?? d["subscription.stripeCustomerId"],
        stripeSubscriptionId: nested.stripeSubscriptionId ?? d["subscription.stripeSubscriptionId"],
        provider: nested.provider,
      } : null
      setSubscription(sub)
    }, () => {})
    return () => unsub()
  }, [storeId])

  const cancelSubscription = async () => {
    setBillingLoading(true)
    setBillingError("")
    setBillingSuccess("")
    try {
      const user = auth.currentUser
      if (!user) return
      const token = await user.getIdToken()
      const res = await fetch("/api/stripe/cancel-subscription", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) { setBillingError(data.error ?? "エラーが発生しました"); return }
      setBillingSuccess("キャンセルを受け付けました。期間終了まで引き続きご利用いただけます。")
    } catch {
      setBillingError("エラーが発生しました")
    } finally {
      setBillingLoading(false)
    }
  }

  const resumeSubscription = async () => {
    setBillingLoading(true)
    setBillingError("")
    setBillingSuccess("")
    try {
      const user = auth.currentUser
      if (!user) return
      const token = await user.getIdToken()
      const res = await fetch("/api/stripe/resume-subscription", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) { setBillingError(data.error ?? "エラーが発生しました"); return }
      setBillingSuccess("サブスクリプションを再開しました。")
    } catch {
      setBillingError("エラーが発生しました")
    } finally {
      setBillingLoading(false)
    }
  }

  const openPortal = async () => {
    setBillingLoading(true)
    setBillingError("")
    try {
      const user = auth.currentUser
      if (!user) return
      const token = await user.getIdToken()
      const res = await fetch("/api/stripe/create-portal-session", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) { setBillingError(data.error ?? "エラーが発生しました"); return }
      window.location.href = data.url
    } catch {
      setBillingError("エラーが発生しました")
    } finally {
      setBillingLoading(false)
    }
  }

  const saveSns = async () => {
    if (!storeId) return
    setSnsError("")
    setSnsSuccess("")
    setSnsSaving(true)
    try {
      const payload = {
        snsInstagram: draftInstagram.trim(),
        snsX: draftSnsX.trim(),
        snsWeb: draftSnsWeb.trim(),
      }
      await setDoc(doc(db, "stores", storeId), payload, { merge: true })
      setSnsSuccess("保存しました")
    } catch {
      setSnsError("保存に失敗しました")
    } finally {
      setSnsSaving(false)
    }
  }

  const logout = async () => {
    await signOut(auth)
    router.replace("/login")
  }

  const deleteAccount = async () => {
    const user = auth.currentUser

    if (!user) {
      showToast("ユーザー情報が取得できません。再ログインしてください。")
      return
    }

    try {
      setIsDeleting(true)

      await setDoc(
        doc(db, "users", user.uid),
        { deletedAt: new Date() },
        { merge: true }
      )

      await user.delete()

      showToast("削除しました", "success")
      router.replace("/login")

    } catch (e) {
      console.error("DELETE ERROR:", e)
      // 最後のログインから時間が経っていると、Firebase は削除を拒む(auth/requires-recent-login)。
      const code = (e as { code?: string })?.code
      showToast(code === "auth/requires-recent-login"
        ? "安全のため、ログインし直してから削除してください"
        : "削除できませんでした。もう一度お試しください")
    } finally {
      setIsDeleting(false)
    }
  }

  // ── 一覧で使う値 ─────────────────────────────────────────────────────
  const [sheet, setSheet] = useState<null | "field" | "blind" | "sns">(null)
  const [confirmReq, setConfirmReq] = useState<ConfirmRequest | null>(null)
  const FIELD_LABEL = { name: "店舗名", description: "店舗の説明", postalCode: "郵便番号", addressLine: "住所(丁目まで)", addressDetail: "番地・建物名" } as const
  const openField = (f: keyof typeof FIELD_LABEL) => { setError(""); setSuccess(""); setEditingField(f); setSheet("field") }
  const closeSheet = () => { setSheet(null); setEditingField(null) }
  const fieldValue = (f: keyof typeof FIELD_LABEL) => ({ name: draftName, description: draftDescription, postalCode: draftPostalCode, addressLine: draftAddressLine, addressDetail: draftAddressDetail })[f]
  const setFieldValue = (f: keyof typeof FIELD_LABEL, v: string) => ({ name: setDraftName, description: setDraftDescription, postalCode: setDraftPostalCode, addressLine: setDraftAddressLine, addressDetail: setDraftAddressDetail })[f](v)
  const shown = (v?: string) => (v && v.trim()) ? v : "未設定"
  const sub = subscription
  const subStatus = !sub ? null
    : isSubscriptionActive(sub) && !sub.cancelAtPeriodEnd ? { label: "有効", color: "#1E7B34" }
    : isSubscriptionActive(sub) && sub.cancelAtPeriodEnd ? { label: "キャンセル予定", color: "#A15C00" }
    : sub.status === "past_due" ? { label: "支払いに失敗", color: "#D70015" }
    : { label: "停止中", color: "var(--label2)" }
  const closeBtn = (onClick: () => void) => (
    <button type="button" onClick={onClick} aria-label="閉じる"
      style={{ width: 44, height: 44, borderRadius: 22, border: 'none', background: 'rgba(118,118,128,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--label)', marginRight: -8, cursor: 'pointer', flexShrink: 0 }}>
      <XIcon size={20} />
    </button>
  )
  const note = (text: string, color: string) => <p role={color === '#D70015' ? 'alert' : 'status'} style={{ fontSize: 15, color, margin: '-16px 16px 16px' }}>{text}</p>

  return (
    <main style={{ minHeight: '100dvh', background: '#F2F2F7', paddingBottom: 'calc(136px + env(safe-area-inset-bottom, 0px))' }}>
      <HomeHeader homePath="/home/store" myPagePath="/home/store/mypage" variant="store" />
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} hidden />

      <div style={{ maxWidth: 560, margin: '0 auto', padding: '0 16px' }}>
        <LargeTitle>マイページ</LargeTitle>

        {/* 店舗の顔(アイコン・名前・メール)。押すとアイコンを変える。 */}
        <Section>
          <button type="button" onClick={openIconPicker} disabled={savingIcon} className="gl-row"
            style={{ display: 'flex', alignItems: 'center', gap: 16, width: '100%', minHeight: 88, padding: '16px', border: 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}>
            <span style={{ position: 'relative', width: 64, height: 64, borderRadius: 16, overflow: 'hidden', background: 'rgba(118,118,128,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {(previewUrl || profile.iconUrl)
                /* eslint-disable-next-line @next/next/no-img-element -- 店舗アイコン */
                ? <img src={previewUrl || profile.iconUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <UserIcon size={28} style={{ color: 'var(--label3)' }} />}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 22, fontWeight: 700, color: 'var(--label)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile.name || "店舗名を設定"}</span>
              <span style={{ display: 'block', fontSize: 15, color: 'var(--label2)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email}</span>
              <span style={{ display: 'block', fontSize: 15, color: '#B57F00', marginTop: 4 }}>{savingIcon ? "アイコンを保存しています…" : "アイコンを変更"}</span>
            </span>
          </button>
        </Section>
        {error && !sheet && note(error, '#D70015')}
        {success && !sheet && note(success, '#1E7B34')}

        <Section header="店舗の情報" footer="プレイヤーの店舗詳細に表示されます。">
          <NavRow label="店舗名" detail={shown(profile.name)} onClick={() => openField("name")} />
          <NavRow label="店舗の説明" detail={profile.description ? "設定済み" : "未設定"} onClick={() => openField("description")} />
        </Section>

        <Section header="住所">
          <NavRow label="郵便番号" detail={shown(profile.postalCode)} onClick={() => openField("postalCode")} />
          <NavRow label="住所(丁目まで)" detail={shown(profile.addressLine)} onClick={() => openField("addressLine")} />
          <NavRow label="番地・建物名" detail={shown(profile.addressDetail)} onClick={() => openField("addressDetail")} />
        </Section>

        <Section header="リングゲーム" footer="プレイヤーのバンクロールを BB で表示するときに使います。">
          <NavRow label="ブラインド" detail={blindSb && blindBb ? `${blindSb} / ${blindBb}` : "未設定"} onClick={() => { setBlindError(""); setBlindSuccess(""); setSheet("blind") }} />
        </Section>

        <Section header="SNS・外部リンク" footer="プレイヤーの予定画面に表示されます。">
          <NavRow icon={<InstagramIcon size={20} style={{ color: 'var(--label2)' }} />} label="Instagram" detail={draftInstagram ? "設定済み" : "未設定"} onClick={() => { setSnsError(""); setSnsSuccess(""); setSheet("sns") }} />
          <NavRow icon={<TwitterIcon size={20} style={{ color: 'var(--label2)' }} />} label="X(旧 Twitter)" detail={draftSnsX ? "設定済み" : "未設定"} onClick={() => { setSnsError(""); setSnsSuccess(""); setSheet("sns") }} />
          <NavRow icon={<GlobeIcon size={20} style={{ color: 'var(--label2)' }} />} label="Web サイト" detail={draftSnsWeb ? "設定済み" : "未設定"} onClick={() => { setSnsError(""); setSnsSuccess(""); setSheet("sns") }} />
        </Section>

        {/* ── サブスクリプション ── */}
        <Section header="サブスクリプション"
          footer={!sub ? undefined
            : sub.provider === "admin_free" ? "運営による無料期間が適用されています。終了日を過ぎると自動的に停止します。"
            : sub.provider === "apple_iap" ? "ご契約は App Store で管理されています。変更・キャンセルは iOS の「設定」アプリまたは App Store から行えます。"
            : sub.provider === "google_play" ? "ご契約は Google Play で管理されています。変更・キャンセルは Play ストアから行えます。"
            : undefined}>
          {sub ? (
            <>
              <InfoRow label="プラン" value={`${subscriptionPlanLabel(sub)}${sub.provider !== "admin_free" ? (sub.interval === "yearly" ? "(年払い)" : "(月払い)") : ""}`} />
              {subStatus && <InfoRow label="状態" value={subStatus.label} color={subStatus.color} />}
              {sub.currentPeriodEnd && (
                <InfoRow
                  label={sub.provider === "admin_free" ? "無料期間の終了日" : sub.cancelAtPeriodEnd ? "終了日" : "次回の更新日"}
                  value={new Date(sub.currentPeriodEnd * 1000).toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" })}
                />
              )}
              {sub.provider === "apple_iap" && (
                <a href="itms-apps://apps.apple.com/account/subscriptions" className="gl-row" style={linkRow}>App Store で管理<ChevronRightIcon size={20} style={{ color: 'var(--label3)' }} /></a>
              )}
              {sub.provider === "google_play" && (
                <a href="https://play.google.com/store/account/subscriptions" target="_blank" rel="noopener noreferrer" className="gl-row" style={linkRow}>Google Play で管理<ChevronRightIcon size={20} style={{ color: 'var(--label3)' }} /></a>
              )}
              {sub.provider !== "admin_free" && sub.provider !== "apple_iap" && sub.provider !== "google_play" && (
                <>
                  <NavRow label={billingLoading ? "処理しています…" : "支払い方法(カード)を変更"} onClick={() => { if (!billingLoading) void openPortal() }} />
                  {sub.status === "active" && sub.cancelAtPeriodEnd && (
                    <NavRow label="サブスクリプションを再開" onClick={() => { if (!billingLoading) void resumeSubscription() }} />
                  )}
                  {sub.status === "active" && !sub.cancelAtPeriodEnd && (
                    <NavRow destructive label="サブスクリプションをキャンセル" onClick={() => setConfirmReq({
                      title: "サブスクリプションをキャンセル",
                      message: "期間の終了日まで引き続きご利用いただけます。終了日のあとは店舗の機能が使えなくなります。",
                      action: "キャンセルする", destructive: true, run: cancelSubscription,
                    })} />
                  )}
                </>
              )}
              {!isSubscriptionActive(sub) && <NavRow label="プランを再開する" onClick={() => router.push("/home/store/billing")} />}
            </>
          ) : (
            <NavRow label="プランを選ぶ" detail="未契約" onClick={() => router.push("/home/store/billing")} />
          )}
        </Section>
        {billingError && note(billingError, '#D70015')}
        {billingSuccess && note(billingSuccess, '#1E7B34')}

        <Section header="アカウント">
          <NavRow label="パスワード変更" onClick={() => router.push("/home/store/mypage/password")} />
          <NavRow label="ログアウト" onClick={() => setConfirmReq({ title: "ログアウト", message: "この端末からログアウトします。", action: "ログアウト", run: logout })} />
        </Section>

        <Section footer="店舗のアカウントと、保持チップ・レートなどすべてのデータが削除されます。元に戻せません。">
          <NavRow destructive label={isDeleting ? "削除しています…" : "アカウントを削除"} onClick={() => setConfirmReq({
            title: "アカウントを削除", message: "すべてのデータが完全に削除されます。この操作は取り消せません。", action: "削除", destructive: true, run: deleteAccount,
          })} />
        </Section>
      </div>

      {/* ── 項目の編集 ── */}
      <AppleSheet open={sheet === "field" && !!editingField} onClose={closeSheet}
        title={<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><p style={{ flex: 1, fontSize: 22, fontWeight: 700, margin: 0, color: 'var(--label)' }}>{editingField ? FIELD_LABEL[editingField] : ""}</p>{closeBtn(closeSheet)}</div>}
        footer={<PrimaryButton disabled={saving} onClick={async () => { await saveProfile(); }}>{saving ? "保存しています…" : "保存する"}</PrimaryButton>}>
        {editingField && (
          <Section>
            {editingField === "description" ? (
              <textarea value={fieldValue(editingField)} onChange={e => { setError(""); setFieldValue(editingField, e.target.value) }} rows={5} placeholder="定休日や、どんなお店なのかなど" aria-label="店舗の説明"
                style={{ display: 'block', width: '100%', boxSizing: 'border-box', padding: 16, border: 'none', outline: 'none', resize: 'none', fontSize: 17, lineHeight: 1.4, color: 'var(--label)', fontFamily: 'inherit', background: 'transparent' }} />
            ) : (
              <input value={fieldValue(editingField)} onChange={e => { setError(""); setFieldValue(editingField, e.target.value) }} aria-label={FIELD_LABEL[editingField]} autoFocus
                inputMode={editingField === "postalCode" ? "numeric" : undefined}
                placeholder={{ name: "例: RR ポーカークラブ", postalCode: "例: 100-0001", addressLine: "例: 東京都千代田区丸の内1丁目", addressDetail: "例: 1-1 ○○ビル 201", description: "" }[editingField]}
                style={{ display: 'block', width: '100%', boxSizing: 'border-box', height: 56, padding: '0 16px', border: 'none', outline: 'none', fontSize: 17, color: 'var(--label)', fontFamily: 'inherit', background: 'transparent' }} />
            )}
          </Section>
        )}
        {error && sheet === "field" && note(error, '#D70015')}
      </AppleSheet>

      {/* ── リングゲームのブラインド ── */}
      <AppleSheet open={sheet === "blind"} onClose={closeSheet}
        title={<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><p style={{ flex: 1, fontSize: 22, fontWeight: 700, margin: 0, color: 'var(--label)' }}>リングゲームのブラインド</p>{closeBtn(closeSheet)}</div>}
        footer={<PrimaryButton onClick={async () => { await saveBlindSettings() }}>保存する</PrimaryButton>}>
        <Section footer="両方を空欄にすると、設定を消します。">
          <FieldRow label="SB"><input type="number" inputMode="numeric" value={blindSb} onChange={e => { setBlindError(""); setBlindSuccess(""); setBlindSb(e.target.value) }} placeholder="5" style={fieldInput} className="no-spin" /></FieldRow>
          <FieldRow label="BB"><input type="number" inputMode="numeric" value={blindBb} onChange={e => { setBlindError(""); setBlindSuccess(""); setBlindBb(e.target.value) }} placeholder="10" style={fieldInput} className="no-spin" /></FieldRow>
        </Section>
        {blindError && note(blindError, '#D70015')}
        {blindSuccess && note(blindSuccess, '#1E7B34')}
      </AppleSheet>

      {/* ── SNS ── */}
      <AppleSheet open={sheet === "sns"} onClose={closeSheet}
        title={<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><p style={{ flex: 1, fontSize: 22, fontWeight: 700, margin: 0, color: 'var(--label)' }}>SNS・外部リンク</p>{closeBtn(closeSheet)}</div>}
        footer={<PrimaryButton disabled={snsSaving} onClick={saveSns}>{snsSaving ? "保存しています…" : "保存する"}</PrimaryButton>}>
        <Section>
          {([
            ["Instagram", draftInstagram, setDraftInstagram, "https://www.instagram.com/yourstore"],
            ["X", draftSnsX, setDraftSnsX, "https://x.com/yourstore"],
            ["Web サイト", draftSnsWeb, setDraftSnsWeb, "https://yourstore.com"],
          ] as const).map(([label, value, set, ph]) => (
            <div key={label} style={{ padding: '8px 16px' }}>
              <span style={{ display: 'block', fontSize: 13, color: 'var(--label2)' }}>{label}</span>
              <input type="url" inputMode="url" value={value} onChange={e => { setSnsError(""); setSnsSuccess(""); set(e.target.value) }} placeholder={ph} aria-label={`${label} の URL`}
                style={{ display: 'block', width: '100%', height: 44, border: 'none', outline: 'none', background: 'transparent', fontSize: 17, color: 'var(--label)', fontFamily: 'inherit', padding: 0 }} />
            </div>
          ))}
        </Section>
        {snsError && note(snsError, '#D70015')}
        {snsSuccess && note(snsSuccess, '#1E7B34')}
      </AppleSheet>

      <ConfirmDialog request={confirmReq} onClose={() => setConfirmReq(null)} />
      <StoreBottomNav />
    </main>
  )
}

const linkRow: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 56, padding: '8px 16px',
  fontSize: 17, color: 'var(--label)', textDecoration: 'none',
}

function InfoRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, minHeight: 56, padding: '8px 16px' }}>
      <span style={{ flex: 1, fontSize: 17, color: 'var(--label)' }}>{label}</span>
      <span style={{ fontSize: 17, color: color ?? 'var(--label2)', fontWeight: color ? 600 : 400, textAlign: 'right' }}>{value}</span>
    </div>
  )
}
