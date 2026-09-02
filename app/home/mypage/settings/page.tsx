"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { auth, db } from "@/lib/firebase"
import { doc, getDoc, setDoc } from "firebase/firestore"
import { resizeImageToDataUrl } from "@/lib/image"
import HomeHeader from "@/components/HomeHeader"
import { useLanguage, type Language } from "@/lib/i18n"
import { loadGeoConsent, saveGeoConsent } from "@/lib/geoConsent"

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

  const updateGeoConsent = (value: "granted" | "declined") => {
    setGeoConsent(value)
    const uid = auth.currentUser?.uid
    if (uid) void saveGeoConsent(uid, value)
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

  return (
    <main className="min-h-screen bg-white px-5">
      <HomeHeader homePath="/home" myPagePath="/home/mypage" />
      <div className="mx-auto max-w-sm">
        <div className="pt-[56px] text-center">
          <h1 className="text-[24px] font-semibold text-gray-900">プロフィール編集</h1>
        </div>

        <div className="mt-6 rounded-[24px] border border-gray-200 p-4">
          <label className="text-[12px] text-gray-500">ユーザー名</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="mt-2 h-12 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 text-[16px]"
          />

          <div className="mt-4" />
          <label className="text-[12px] text-gray-500">アイコン画像</label>
          <input
            type="file"
            accept="image/*"
            onChange={e => setFile(e.target.files?.[0] ?? null)}
            className="mt-2 w-full text-[14px]"
          />

          <button
            type="button"
            onClick={saveProfile}
            className="mt-4 h-[48px] w-full rounded-[20px] bg-[#F2A900] text-[14px] font-semibold text-gray-900"
          >
            プロフィールを保存
          </button>
        </div>

        {error && <p className="mt-3 text-center text-[13px] text-red-500">{error}</p>}
        {success && <p className="mt-3 text-center text-[13px] text-green-600">{success}</p>}

        <div className="mt-6 rounded-[24px] border border-gray-200 p-4">
          <label className="text-[12px] text-gray-500">{t('settings.language')}</label>
          <p className="mt-0.5 text-[11px] text-gray-400">{t('settings.languageNote')}</p>
          <div className="mt-3 flex gap-2">
            {([{ v: 'ja' as Language, label: t('common.japanese') }, { v: 'en' as Language, label: t('common.english') }]).map(opt => (
              <button
                key={opt.v}
                type="button"
                onClick={() => setLanguage(opt.v)}
                className="flex-1 h-10 rounded-2xl text-[13px] font-semibold transition-all"
                style={{
                  background: language === opt.v ? '#F2A900' : '#F3F4F6',
                  color: language === opt.v ? '#1a1a1a' : '#6b7280',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 rounded-[24px] border border-gray-200 p-4">
          <label className="text-[12px] text-gray-500">位置情報の利用</label>
          <p className="mt-0.5 text-[11px] text-gray-400">近くの店舗を距離順に表示するために使用します</p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => updateGeoConsent("granted")}
              className="flex-1 h-10 rounded-2xl text-[13px] font-semibold transition-all"
              style={{ background: geoConsent === "granted" ? '#F2A900' : '#F3F4F6', color: geoConsent === "granted" ? '#1a1a1a' : '#6b7280' }}
            >
              許可する
            </button>
            <button
              type="button"
              onClick={() => updateGeoConsent("declined")}
              className="flex-1 h-10 rounded-2xl text-[13px] font-semibold transition-all"
              style={{ background: geoConsent === "declined" ? '#F2A900' : '#F3F4F6', color: geoConsent === "declined" ? '#1a1a1a' : '#6b7280' }}
            >
              許可しない
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => router.push('/home/mypage/password')}
          className="mt-6 h-[48px] w-full rounded-[20px] bg-[#F2A900] text-[14px] font-semibold text-gray-900"
        >
          パスワード変更
        </button>

        <button
          type="button"
          onClick={() => window.open('/privacy', '_blank')}
          className="mt-3 h-[48px] w-full rounded-[20px] border border-gray-200 text-[14px] font-semibold text-gray-700"
        >
          {t('common.privacyPolicy')}
        </button>

        {/* アカウント連携ボタン削除済み */}

        <button
          type="button"
          onClick={() => router.back()}
          className="mt-4 text-[13px] text-gray-500"
        >
          戻る
        </button>
      </div>
    </main>
  )
}
