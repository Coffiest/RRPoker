'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { auth, db } from '@/lib/firebase'
import { watchAuthState } from '@/lib/auth'
import { doc, setDoc, getDoc } from 'firebase/firestore'
import { resizeImageToDataUrl } from '@/lib/image'
import { isPlayerIdAvailable, validatePlayerId, getAvailablePlayerId } from '@/lib/playerId'

export default function UserProfileOnboardingPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [name, setName] = useState('')
  const [playerId, setPlayerId] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [idError, setIdError] = useState('')
  const [idStatus, setIdStatus] = useState<'checking' | 'available' | 'unavailable' | null>(null)
  const [loading, setLoading] = useState(false)
  const [isExiting, setIsExiting] = useState(false)
  const [authReady, setAuthReady] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const idCheckTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [birthday, setBirthday] = useState("")
  
  const MAX_ICON_SIZE = 5 * 1024 * 1024
  const MAX_ICON_EDGE = 200
  const ICON_QUALITY = 0.7
  const MAX_DATA_URL_LENGTH = 900000

  useEffect(() => {
    const unsub = watchAuthState(async (user) => {
      setUserId(user?.uid ?? null)
      setAuthReady(true)
      
      // Load existing profile data if available
      if (user?.uid) {
        const userDoc = await getDoc(doc(db, 'users', user.uid))
        const userData = userDoc.data()
        if (userData) {
          if (userData.name) setName(userData.name)
          if (userData.iconUrl) setPreviewUrl(userData.iconUrl)
          if (userData.playerId) {
            setPlayerId(userData.playerId.replace(/^@/, ''))
            setIdStatus('available')
          }
        }
      }
    })

    return () => {
      unsub()
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl)
      }
      if (idCheckTimeoutRef.current) {
        clearTimeout(idCheckTimeoutRef.current)
      }
    }
  }, [])

  const handlePickImage = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null
    event.target.value = ""
    if (!nextFile) return
    if (nextFile.size > MAX_ICON_SIZE) {
      setError('画像サイズが大きすぎます（5MBまで）')
      return
    }
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl)
    }
    setFile(nextFile)
    setPreviewUrl(nextFile ? URL.createObjectURL(nextFile) : null)
  }

  // プレイヤーID入力時の検証
  const handlePlayerIdChange = async (value: string) => {
    setPlayerId(value)
    setIdError('')
    
    if (!value.trim()) {
      setIdStatus(null)
      return
    }

    // バリデーション
    const validation = validatePlayerId(value)
    if (!validation.valid) {
      setIdError(validation.message || 'エラーが発生しました')
      setIdStatus(null)
      return
    }

    // 一意性チェック（デバウンス）
    setIdStatus('checking')
    if (idCheckTimeoutRef.current) {
      clearTimeout(idCheckTimeoutRef.current)
    }

    idCheckTimeoutRef.current = setTimeout(async () => {
      try {
        const normalizedId = `@${value.replace(/^@/, '')}`
        
        // Check if this is the user's current ID
        if (userId) {
          const userDoc = await getDoc(doc(db, 'users', userId))
          const currentPlayerId = userDoc.data()?.playerId
          if (currentPlayerId === normalizedId) {
            setIdStatus('available')
            setIdError('')
            return
          }
        }
        
        const available = await isPlayerIdAvailable(value)
        if (available) {
          setIdStatus('available')
          setIdError('')
        } else {
          setIdStatus('unavailable')
          setIdError('このIDは既に使われています')
        }
      } catch (e) {
        setIdError('IDの確認に失敗しました')
        setIdStatus(null)
      }
    }, 500)
  }

  const handleNext = async () => {
    if (!name.trim()) {
      setError('ポーカーネームが入力されていません')
      return
    }

    if (!playerId.trim()) {
      setError('プレイヤーIDが入力されていません')
      return
    }

    // プレイヤーIDのバリデーション
    const validation = validatePlayerId(playerId)
    if (!validation.valid) {
      setError(validation.message || 'プレイヤーIDが無効です')
      return
    }

    if (idStatus !== 'available') {
      setError('利用可能なプレイヤーIDを使用してください')
      return
    }

    if (!authReady) {
      setError('ログイン情報を確認中です')
      return
    }

    if (!userId) {
      setError('ログイン情報が見つかりません')
      return
    }

    setError('')
    setLoading(true)

    try {
      let iconUrl: string | undefined
      if (file) {
        const dataUrl = await resizeImageToDataUrl(file, MAX_ICON_EDGE, ICON_QUALITY)
        if (dataUrl.length > MAX_DATA_URL_LENGTH) {
          throw new Error('画像サイズが大きすぎます（小さめの画像を選択してください）')
        }
        iconUrl = dataUrl
      }

      const finalPlayerId = `@${playerId.replace(/^@/, '')}`

await setDoc(
  doc(db, 'users', userId),
  { 
    name: name.trim(), 
    playerId: finalPlayerId,
    birthday,
    ...(iconUrl ? { iconUrl } : {}) 
  },
  { merge: true }
)

      setIsExiting(true)
      window.setTimeout(() => {
        router.replace('/onboarding/user/step-2')
      }, 240)
    } catch (e: any) {
      setError(e.message || 'プロフィール登録に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const inputClassName = `mt-3 h-12 w-full rounded-2xl border px-4 text-[16px] text-gray-950 outline-none placeholder:text-gray-400 focus:border-gray-300 ${
    error ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-gray-50'
  }`

  return (
    <main className={`min-h-screen bg-white px-5 ${isExiting ? 'page-slide-out' : 'page-slide-in'}`}>
      <div className="mx-auto max-w-sm">
        <div className="pt-[64px] text-center">
          <div className="mx-auto h-20 w-20">
            <button
              type="button"
              onClick={handlePickImage}
              className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-gray-200 bg-gray-100"
              aria-label="アイコン画像を選択"
            >
              {previewUrl ? (
                <img src={previewUrl} alt="icon preview" className="h-full w-full object-cover" />
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

        <div className="mt-8 rounded-[24px] border border-gray-200 p-4">
          {/* Name Field */}
          <div className="flex items-center justify-between">
            <p className="text-[14px] text-gray-900">あなたのポーカーネームは？</p>
            <span className="text-[12px] font-semibold text-[#F2A900]">(※必須)</span>
          </div>
          <input
            type="text"
            value={name}
            onChange={event => setName(event.target.value)}
            className={inputClassName}
          />

          {/* Player ID Field */}
          <div className="mt-6 flex items-center justify-between">
            <p className="text-[14px] text-gray-900">プレイヤーID</p>
            <span className="text-[12px] font-semibold text-[#F2A900]">(※必須)</span>
          </div>
          <div className="mt-3 relative">
            <div className="flex items-center">
              <span className="absolute left-4 text-[16px] text-gray-500">@</span>
              <input
                type="text"
                value={playerId.replace(/^@/, '')}
                onChange={event => handlePlayerIdChange(event.target.value)}
                placeholder="例: naoyuki"
                className={`mt-0 h-12 w-full rounded-2xl border pl-8 pr-4 text-[16px] text-gray-950 outline-none placeholder:text-gray-400 focus:border-gray-300 ${
                  idError ? 'border-red-400 bg-red-50' : 
                  idStatus === 'available' ? 'border-green-400 bg-green-50' :
                  idStatus === 'unavailable' ? 'border-red-400 bg-red-50' :
                  'border-gray-200 bg-gray-50'
                }`}
              />
              {idStatus === 'checking' && (
                <span className="absolute right-4 text-[12px] text-gray-500">確認中...</span>
              )}
              {idStatus === 'available' && (
                <span className="absolute right-4 text-[12px] text-green-600">✓ 利用可能</span>
              )}
              {idStatus === 'unavailable' && (
                <span className="absolute right-4 text-[12px] text-red-500">✗ 使用中</span>
              )}
            </div>
          </div>
          {idError && <p className="mt-2 text-[12px] text-red-500">{idError}</p>}
          {idStatus === 'available' && !idError && (
            <p className="mt-2 text-[12px] text-green-600">このIDは利用可能です</p>
          )}


          <div className="mt-6">
  <p className="text-[14px] text-gray-900">誕生日</p>

  <input
    type="date"
    value={birthday}
    onChange={(e) => setBirthday(e.target.value)}
    className="mt-3 h-12 w-full rounded-2xl border border-gray-200 px-4 text-[16px]"
  />

  <p className="mt-1 text-[12px] text-red-500">
    ※誕生日は後から変更できません
  </p>
</div>

          {error && <p className="mt-3 text-center text-[13px] text-red-500">{error}</p>}

          <button
            type="button"
            onClick={handleNext}
            disabled={loading || !authReady || idStatus !== 'available'}
            className="mt-6 h-[52px] w-full rounded-[24px] bg-[#F2A900] text-[16px] font-semibold text-gray-900 shadow-sm transition-transform active:scale-[0.99] disabled:opacity-60"
          >
            次へ
          </button>
        </div>
      </div>
    </main>
  )
}
