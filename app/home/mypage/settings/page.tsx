"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { auth, db } from "@/lib/firebase"
import { doc, getDoc, setDoc } from "firebase/firestore"
import { resizeImageToDataUrl } from "@/lib/image"
import HomeHeader from "@/components/HomeHeader"
import { useLanguage, type Language } from "@/lib/i18n"
import { loadGeoConsent, saveGeoConsent } from "@/lib/geoConsent"
import { ChevronRightIcon } from "lucide-react"
import { ChoiceRow, FieldRow, LargeTitle, NavRow, PageTitleBar, PrimaryButton, Section, SwitchRow, fieldInput } from "@/components/GroupedList"

export default function UserSettingsPage() {
  const router = useRouter()
  const { language, setLanguage, t } = useLanguage()
  const [name, setName] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [geoConsent, setGeoConsent] = useState<"granted" | "declined" | null>(null)
  const MAX_ICON_SIZE = 5 * 1024 * 1024
  const MAX_ICON_EDGE = 200
  const ICON_QUALITY = 0.7
  const MAX_DATA_URL_LENGTH = 900000

  // 同意の正本はアカウント側。ホーム画面の確認と必ず同じ答えを見るようにする
  // (別々に持つと、ここでオンにしてもホームがまた聞いてくる、という食い違いが起きる)。
  useEffect(() => {
    const uid = auth.currentUser?.uid
    if (!uid) return
    let cancelled = false
    void loadGeoConsent(uid).then(v => { if (!cancelled) setGeoConsent(v) })
    return () => { cancelled = true }
  }, [])

  // アプリで現在地を「使う / 使わない」の切り替え。端末(OS)の許可そのものは OS の確認で
  // 本人が決めるので、ここに「許可する / 許可しない」とは書かない(App Review 5.1.1(iv))。
  // 「使う」にしたら、その場で OS の確認へ進める(未回答なら確認が出る)。
  const updateGeoConsent = (value: "granted" | "declined") => {
    setGeoConsent(value)
    const uid = auth.currentUser?.uid
    if (uid) void saveGeoConsent(uid, value)
    if (value === "granted" && typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(() => {}, () => {}, { timeout: 10000 })
    }
  }

  useEffect(() => {
    const fetchProfile = async () => {
      const user = auth.currentUser
      if (!user) return
      const snap = await getDoc(doc(db, "users", user.uid))
      const data = snap.data()
      setName(data?.name ?? "")
    }

    fetchProfile()
  }, [])

  const saveProfile = async () => {
    const user = auth.currentUser
    if (!user) return
    setError("")
    setSuccess("")

    try {
      let iconUrl: string | undefined
      if (file) {
        if (file.size > MAX_ICON_SIZE) {
          throw new Error("画像サイズが大きすぎます（5MBまで）")
        }
        const dataUrl = await resizeImageToDataUrl(file, MAX_ICON_EDGE, ICON_QUALITY)
        if (dataUrl.length > MAX_DATA_URL_LENGTH) {
          throw new Error("画像サイズが大きすぎます（小さめの画像を選択してください）")
        }
        iconUrl = dataUrl
      }

      await setDoc(
        doc(db, "users", user.uid),
        { name, ...(iconUrl ? { iconUrl } : {}) },
        { merge: true }
      )

      setSuccess("保存しました")
    } catch (e: any) {
      setError(e.message)
    }
  }

  const [saving, setSaving] = useState(false)
  const iconPreview = file ? URL.createObjectURL(file) : null

  return (
    <main style={{ minHeight: '100dvh', background: '#F2F2F7', paddingBottom: 48 }}>
      <HomeHeader homePath="/home" myPagePath="/home/mypage" />
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '0 16px' }}>
        <PageTitleBar title="" onBack={() => router.back()} />
        <LargeTitle>Settings</LargeTitle>

        <Section header="プロフィール" footer="名前とアイコンは、店舗やほかのプレイヤーに表示されます。">
          <FieldRow label="名前">
            <input type="text" value={name} onChange={e => { setSuccess(""); setName(e.target.value) }} placeholder="名前" className="gl-input" style={fieldInput} autoComplete="nickname" />
          </FieldRow>
          <label className="gl-row" style={{ display: 'flex', alignItems: 'center', gap: 16, minHeight: 56, padding: '8px 16px', cursor: 'pointer' }}>
            <span style={{ flex: 1, fontSize: 17, color: 'var(--label)' }}>アイコン画像</span>
            {iconPreview
              ? /* eslint-disable-next-line @next/next/no-img-element -- 選んだ画像のプレビュー */
                <img src={iconPreview} alt="選んだアイコン" style={{ width: 40, height: 40, borderRadius: 20, objectFit: 'cover' }} />
              : <span style={{ fontSize: 17, color: 'var(--label2)' }}>選ぶ</span>}
            <ChevronRightIcon size={20} style={{ color: 'var(--label3)' }} />
            <input type="file" accept="image/*" hidden onChange={e => { setSuccess(""); setFile(e.target.files?.[0] ?? null) }} />
          </label>
        </Section>
        {error && <p role="alert" style={{ fontSize: 15, color: '#D70015', margin: '-16px 16px 16px' }}>{error}</p>}
        {success && <p role="status" style={{ fontSize: 15, color: '#1E7B34', margin: '-16px 16px 16px' }}>{success}</p>}
        <div style={{ marginBottom: 32 }}>
          <PrimaryButton disabled={saving} onClick={async () => { setSaving(true); try { await saveProfile() } finally { setSaving(false) } }}>
            {saving ? "保存しています…" : "プロフィールを保存"}
          </PrimaryButton>
        </div>

        <Section header={t('settings.language')} footer={t('settings.languageNote')}>
          {([{ v: 'ja' as Language, label: t('common.japanese') }, { v: 'en' as Language, label: t('common.english') }]).map(opt => (
            <ChoiceRow key={opt.v} label={opt.label} selected={language === opt.v} onSelect={() => setLanguage(opt.v)} />
          ))}
        </Section>

        <Section header="位置情報" footer="近くの店舗を距離の近い順に並べるために、現在地を一度だけ使います。保存はしません。">
          <SwitchRow label="現在地を使う" checked={geoConsent === "granted"} onChange={v => updateGeoConsent(v ? "granted" : "declined")} />
        </Section>

        <Section header="アカウント">
          <NavRow label="パスワード変更" onClick={() => router.push('/home/mypage/password')} />
          <NavRow label={t('common.privacyPolicy')} onClick={() => router.push('/privacy')} />
        </Section>
      </div>
    </main>
  )
}
