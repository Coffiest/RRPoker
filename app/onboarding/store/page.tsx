'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { auth, db } from '@/lib/firebase'
import { collection, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { resizeImageToDataUrl } from '@/lib/image'

const generateCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < 6; i += 1) {
    result += chars[Math.floor(Math.random() * chars.length)]
  }
  return result
}

export default function StoreOnboardingPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [name, setName] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [addressLine, setAddressLine] = useState('')
  const [addressDetail, setAddressDetail] = useState('')
  const [description, setDescription] = useState('')
  const [ringBlindSb, setRingBlindSb] = useState('')
  const [ringBlindBb, setRingBlindBb] = useState('')
  const [iconDataUrl, setIconDataUrl] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [isExiting, setIsExiting] = useState(false)
  const MAX_ICON_SIZE = 5 * 1024 * 1024
  const MAX_ICON_EDGE = 200
  const ICON_QUALITY = 0.7
  const MAX_DATA_URL_LENGTH = 900000
  const [missingFields, setMissingFields] = useState({
    name: false,
    postalCode: false,
    addressLine: false,
    addressDetail: false,
    icon: false,
  })

  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  const handlePickImage = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null
    event.target.value = ''
    if (!nextFile) return
    if (nextFile.size > MAX_ICON_SIZE) {
      setError('画像サイズが大きすぎます（5MBまで）')
      return
    }
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl)
    }
    void (async () => {
      try {
        const dataUrl = await resizeImageToDataUrl(nextFile, MAX_ICON_EDGE, ICON_QUALITY)
        if (dataUrl.length > MAX_DATA_URL_LENGTH) {
          setError('画像サイズが大きすぎます（小さめの画像を選択してください）')
          return
        }
        setIconDataUrl(dataUrl)
        setPreviewUrl(dataUrl)
      } catch (e: any) {
        setError(e.message || '画像の登録に失敗しました')
      }
    })()
  }

  const validate = () => {
    const nextMissing = {
      name: !name.trim(),
      postalCode: !postalCode.trim(),
      addressLine: !addressLine.trim(),
      addressDetail: !addressDetail.trim(),
      icon: false,
    }
    setMissingFields(nextMissing)

    if (nextMissing.name || nextMissing.postalCode || nextMissing.addressLine || nextMissing.addressDetail) {
      setError('必須項目が入力されていません')
      return false
    }

    const sbRaw = ringBlindSb.trim()
    const bbRaw = ringBlindBb.trim()
    if ((sbRaw && !bbRaw) || (!sbRaw && bbRaw)) {
      setError('ブラインドのSB/BBは両方入力してください')
      return false
    }
    if (sbRaw && bbRaw) {
      const sbValue = Number(sbRaw)
      const bbValue = Number(bbRaw)
      if (!Number.isInteger(sbValue) || !Number.isInteger(bbValue) || sbValue < 0 || bbValue < 0) {
        setError('ブラインドは0以上の整数で入力してください')
        return false
      }
    }

    setError('')
    return true
  }

  const saveProfile = async () => {
    const user = auth.currentUser
    if (!user) return
    if (!validate()) return

    setLoading(true)

    try {
      let code = generateCode()
      let exists = true
      while (exists) {
        const snap = await getDoc(doc(collection(db, 'stores'), code))
        if (!snap.exists()) {
          exists = false
          break
        }
        code = generateCode()
      }

      const iconUrl = iconDataUrl ?? undefined

      const fullAddress = `${postalCode} ${addressLine} ${addressDetail}`

      const sbRaw = ringBlindSb.trim()
      const bbRaw = ringBlindBb.trim()
      const blindPayload = sbRaw && bbRaw
        ? { ringBlindSb: Number(sbRaw), ringBlindBb: Number(bbRaw) }
        : {}

      await setDoc(
        doc(db, 'stores', code),
        {
          name: name.trim(),
          postalCode: postalCode.trim(),
          addressLine: addressLine.trim(),
          addressDetail: addressDetail.trim(),
          description: description.trim(),
          address: fullAddress,
          ...(iconUrl ? { iconUrl } : {}),
          ...blindPayload,
          code,
          ownerUid: user.uid,
          createdAt: serverTimestamp(),
        },
        { merge: true }
      )

      await setDoc(
        doc(db, 'users', user.uid),
        {
          role: 'store',
          name: name.trim(),
          postalCode: postalCode.trim(),
          addressLine: addressLine.trim(),
          addressDetail: addressDetail.trim(),
          description: description.trim(),
          address: fullAddress,
          ...(iconUrl ? { iconUrl } : {}),
          storeId: code,
        },
        { merge: true }
      )

      setIsExiting(true)
      window.setTimeout(() => {
        router.replace('/onboarding/store/welcome')
      }, 240)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const inputBase = 'mt-2 h-12 w-full rounded-2xl border bg-gray-50 px-4 text-[16px] text-gray-950 outline-none placeholder:text-gray-400 focus:border-gray-300'
  const inputError = 'border-red-400 bg-red-50'
  const inputDefault = 'border-gray-200'

  return (
    <main className={`min-h-screen bg-white px-5 ${isExiting ? 'page-slide-out' : 'page-slide-in'}`}>
      <div className="mx-auto max-w-sm">
        <div className="pt-[64px] text-center">
          <p className="text-[20px] font-semibold text-gray-900">ようこそ</p>
          <p className="mt-2 text-[14px] text-gray-500">店舗情報を入力してください</p>
        </div>
        <div className="mt-4">
          <button
            type="button"
            onClick={() => router.push('/onboarding')}
            className="flex items-center gap-2 text-gray-500 hover:text-gray-700 transition-colors"
            aria-label="ロール再選択に戻る"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="currentColor"
              className="w-6 h-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 19.5L8.25 12l7.5-7.5"
              />
            </svg>
          </button>
        </div>

        <div className="mt-6">
          <div className="mx-auto h-20 w-20">
            <button
              type="button"
              onClick={handlePickImage}
              className={`relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border ${
                missingFields.icon ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-gray-100'
              }`}
              aria-label="店舗アイコンを選択"
            >
              {previewUrl ? (
                <img src={previewUrl} alt="store icon" className="h-full w-full object-cover" />
              ) : (
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M7 7L9 5H15L17 7H20C21.1046 7 22 7.89543 22 9V18C22 19.1046 21.1046 20 20 20H4C2.89543 20 2 19.1046 2 18V9C2 7.89543 2.89543 7 4 7H7Z"
                    stroke="#6B7280"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M12 16C13.6569 16 15 14.6569 15 13C15 11.3431 13.6569 10 12 10C10.3431 10 9 11.3431 9 13C9 14.6569 10.3431 16 12 16Z"
                    stroke="#6B7280"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        </div>

        <div className="mt-6 rounded-[24px] border border-gray-200 p-4">
          <label className="text-[12px] text-gray-500">店舗名（正式名称）</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className={`${inputBase} ${missingFields.name ? inputError : inputDefault}`}
          />

          <div className="mt-4" />
          <label className="text-[12px] text-gray-500">郵便番号</label>
          <input
            type="text"
            value={postalCode}
            onChange={e => setPostalCode(e.target.value)}
            className={`${inputBase} ${missingFields.postalCode ? inputError : inputDefault}`}
          />

          <div className="mt-4" />
          <label className="text-[12px] text-gray-500">住所、丁目</label>
          <input
            type="text"
            value={addressLine}
            onChange={e => setAddressLine(e.target.value)}
            className={`${inputBase} ${missingFields.addressLine ? inputError : inputDefault}`}
          />

          <div className="mt-4" />
          <label className="text-[12px] text-gray-500">番地、マンション名、号室など</label>
          <input
            type="text"
            value={addressDetail}
            onChange={e => setAddressDetail(e.target.value)}
            className={`${inputBase} ${missingFields.addressDetail ? inputError : inputDefault}`}
          />

          <div className="mt-4" />
          <label className="text-[12px] text-gray-500">店舗の説明</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="定休日や、どんなお店なのかなど"
            className="mt-2 h-24 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-[14px] text-gray-950 outline-none placeholder:text-gray-400 focus:border-gray-300"
          />

          <div className="mt-4" />
          <label className="text-[12px] text-gray-500">リングゲームのブラインド（任意）</label>
          <div className="mt-2 flex items-center gap-2">
            <div className="flex flex-1 items-center gap-2">
              <span className="text-[12px] text-gray-500">SB</span>
              <input
                type="number"
                min={0}
                value={ringBlindSb}
                onChange={e => setRingBlindSb(e.target.value)}
                className="h-10 w-full rounded-2xl border border-gray-200 bg-gray-50 px-3 text-[14px] text-gray-950 outline-none"
                placeholder="例: 5"
              />
            </div>
            <span className="text-[12px] text-gray-400">-</span>
            <div className="flex flex-1 items-center gap-2">
              <span className="text-[12px] text-gray-500">BB</span>
              <input
                type="number"
                min={0}
                value={ringBlindBb}
                onChange={e => setRingBlindBb(e.target.value)}
                className="h-10 w-full rounded-2xl border border-gray-200 bg-gray-50 px-3 text-[14px] text-gray-950 outline-none"
                placeholder="例: 10"
              />
            </div>
          </div>

          {error && <p className="mt-3 text-center text-[13px] text-red-500">{error}</p>}

          <button
            type="button"
            disabled={loading}
            onClick={saveProfile}
            className="mt-4 h-[52px] w-full rounded-[24px] bg-[#F2A900] text-[16px] font-semibold text-gray-900 shadow-sm transition-transform active:scale-[0.99] disabled:opacity-60"
          >
            次へ
          </button>
        </div>
      </div>
    </main>
  )
}