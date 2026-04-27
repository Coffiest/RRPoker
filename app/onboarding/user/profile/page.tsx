'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { auth, db } from '@/lib/firebase'
import { watchAuthState } from '@/lib/auth'
import { doc, setDoc, getDoc } from 'firebase/firestore'
import { resizeImageToDataUrl } from '@/lib/image'
import { isPlayerIdAvailable, validatePlayerId } from '@/lib/playerId'

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
  const [birthday, setBirthday] = useState('')
  const [iconHovered, setIconHovered] = useState(false)

  const MAX_ICON_SIZE = 5 * 1024 * 1024
  const MAX_ICON_EDGE = 200
  const ICON_QUALITY = 0.7
  const MAX_DATA_URL_LENGTH = 900000

  useEffect(() => {
    const unsub = watchAuthState(async (user) => {
      setUserId(user?.uid ?? null)
      setAuthReady(true)
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
      if (previewUrl && previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl)
      if (idCheckTimeoutRef.current) clearTimeout(idCheckTimeoutRef.current)
    }
  }, [])

  const handlePickImage = () => fileInputRef.current?.click()

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null
    event.target.value = ''
    if (!nextFile) return
    if (nextFile.size > MAX_ICON_SIZE) {
      setError('画像サイズが大きすぎます（5MBまで）')
      return
    }
    if (previewUrl && previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl)
    setFile(nextFile)
    setPreviewUrl(nextFile ? URL.createObjectURL(nextFile) : null)
  }

  const handlePlayerIdChange = async (value: string) => {
    setPlayerId(value)
    setIdError('')
    if (!value.trim()) { setIdStatus(null); return }
    const validation = validatePlayerId(value)
    if (!validation.valid) {
      setIdError(validation.message || 'エラーが発生しました')
      setIdStatus(null)
      return
    }
    setIdStatus('checking')
    if (idCheckTimeoutRef.current) clearTimeout(idCheckTimeoutRef.current)
    idCheckTimeoutRef.current = setTimeout(async () => {
      try {
        const normalizedId = `@${value.replace(/^@/, '')}`
        if (userId) {
          const userDoc = await getDoc(doc(db, 'users', userId))
          if (userDoc.data()?.playerId === normalizedId) {
            setIdStatus('available'); setIdError(''); return
          }
        }
        const available = await isPlayerIdAvailable(value)
        if (available) { setIdStatus('available'); setIdError('') }
        else { setIdStatus('unavailable'); setIdError('このIDは既に使われています') }
      } catch { setIdError('IDの確認に失敗しました'); setIdStatus(null) }
    }, 500)
  }

  const handleNext = async () => {
    if (!name.trim()) { setError('ポーカーネームが入力されていません'); return }
    if (!playerId.trim()) { setError('プレイヤーIDが入力されていません'); return }
    const validation = validatePlayerId(playerId)
    if (!validation.valid) { setError(validation.message || 'プレイヤーIDが無効です'); return }
    if (idStatus !== 'available') { setError('利用可能なプレイヤーIDを使用してください'); return }
    if (!authReady) { setError('ログイン情報を確認中です'); return }
    if (!userId) { setError('ログイン情報が見つかりません'); return }
    setError(''); setLoading(true)
    try {
      let iconUrl: string | undefined
      if (file) {
        const dataUrl = await resizeImageToDataUrl(file, MAX_ICON_EDGE, ICON_QUALITY)
        if (dataUrl.length > MAX_DATA_URL_LENGTH) throw new Error('画像サイズが大きすぎます（小さめの画像を選択してください）')
        iconUrl = dataUrl
      }
      const finalPlayerId = `@${playerId.replace(/^@/, '')}`
      await setDoc(doc(db, 'users', userId), { name: name.trim(), playerId: finalPlayerId, birthday, ...(iconUrl ? { iconUrl } : {}) }, { merge: true })
      setIsExiting(true)
      window.setTimeout(() => router.replace('/onboarding/user/step-2'), 240)
    } catch (e: any) {
      setError(e.message || 'プロフィール登録に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const canSubmit = !loading && authReady && idStatus === 'available' && name.trim().length > 0

  return (
    <main
      style={{ background: '#FFFBF5' }}
      className={`min-h-screen px-5 pb-16 ${isExiting ? 'page-slide-out' : 'page-slide-in'}`}
    >
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .animate-slideUp-d1 { opacity:0; animation: slideUp 0.4s ease-out 0.05s forwards; }
        .animate-slideUp-d2 { opacity:0; animation: slideUp 0.4s ease-out 0.12s forwards; }
        .animate-slideUp-d3 { opacity:0; animation: slideUp 0.4s ease-out 0.20s forwards; }
        .animate-slideUp-d4 { opacity:0; animation: slideUp 0.4s ease-out 0.28s forwards; }

        .profile-card {
          background: linear-gradient(145deg, #ffffff 0%, #fefefe 100%);
          box-shadow: 0 2px 8px rgba(242,169,0,0.06), 0 8px 24px rgba(0,0,0,0.04);
        }
        .field-input {
          height: 48px;
          width: 100%;
          border-radius: 16px;
          border: 1.5px solid #e5e7eb;
          background: #f9fafb;
          padding: 0 16px;
          font-size: 16px;
          color: #111827;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
        }
        .field-input::placeholder { color: #9ca3af; }
        .field-input:focus {
          border-color: #F2A900;
          background: #fffdf7;
          box-shadow: 0 0 0 3px rgba(242,169,0,0.12);
        }
        .field-input.has-error {
          border-color: #f87171;
          background: #fff5f5;
        }
        .field-input.is-ok {
          border-color: #34d399;
          background: #f0fdf9;
        }
        .field-input.is-taken {
          border-color: #f87171;
          background: #fff5f5;
        }
        .divider-line {
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(242,169,0,0.18), transparent);
        }
        .btn-primary {
          background: linear-gradient(135deg, #F2A900 0%, #D4910A 100%);
          box-shadow: 0 4px 16px rgba(242,169,0,0.28), 0 1px 3px rgba(0,0,0,0.08);
          transition: transform 0.13s ease, box-shadow 0.13s ease, opacity 0.13s ease;
          border-radius: 20px;
          height: 54px;
          width: 100%;
          font-size: 16px;
          font-weight: 600;
          color: #1a1a1a;
        }
        .btn-primary:active { transform: scale(0.977); opacity: 0.88; }
        .btn-primary:disabled { opacity: 0.45; pointer-events: none; }
        .icon-ring {
          position: relative;
          width: 96px;
          height: 96px;
          border-radius: 9999px;
          overflow: hidden;
          border: 2.5px dashed #F2A900;
          background: #fffbf5;
          cursor: pointer;
          transition: border-color 0.15s, box-shadow 0.15s, transform 0.15s;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .icon-ring:hover, .icon-ring.hovered {
          border-color: #D4910A;
          box-shadow: 0 0 0 4px rgba(242,169,0,0.12);
          transform: scale(1.03);
        }
        .icon-ring.has-image {
          border-style: solid;
          border-color: #F2A900;
        }
        .icon-overlay {
          position: absolute;
          inset: 0;
          background: rgba(0,0,0,0.38);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 3px;
          opacity: 0;
          transition: opacity 0.18s ease;
          border-radius: 9999px;
        }
        .icon-ring:hover .icon-overlay,
        .icon-ring.hovered .icon-overlay {
          opacity: 1;
        }
        .badge-edit {
          position: absolute;
          bottom: 2px;
          right: 2px;
          width: 26px;
          height: 26px;
          border-radius: 9999px;
          background: linear-gradient(135deg, #F2A900, #D4910A);
          box-shadow: 0 2px 6px rgba(242,169,0,0.4);
          display: flex;
          align-items: center;
          justify-content: center;
        }
      `}</style>

      <div className="mx-auto max-w-sm">

        {/* Back button */}
        <div className="pt-12 animate-slideUp-d1">
          <button
            type="button"
            onClick={() => router.push('/onboarding')}
            className="flex items-center gap-1.5 text-[14px] font-medium text-gray-500 hover:text-gray-700 transition-colors"
            aria-label="戻る"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M15.75 19.5L8.25 12l7.5-7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            戻る
          </button>
        </div>

        {/* Header */}
        <div className="mt-6 text-center animate-slideUp-d1">
          <h1 className="text-[24px] font-semibold tracking-[-0.3px] text-gray-900">プロフィール設定</h1>
          <p className="mt-1.5 text-[14px] text-gray-500">あなたの情報を入力してください</p>
        </div>

        {/* Avatar picker */}
        <div className="mt-7 flex flex-col items-center gap-3 animate-slideUp-d2">
          <button
            type="button"
            onClick={handlePickImage}
            onMouseEnter={() => setIconHovered(true)}
            onMouseLeave={() => setIconHovered(false)}
            className={`icon-ring ${previewUrl ? 'has-image' : ''} ${iconHovered ? 'hovered' : ''}`}
            aria-label="アイコン画像を選択"
          >
            {previewUrl ? (
              <img src={previewUrl} alt="プレビュー" className="h-full w-full object-cover" />
            ) : (
              <div className="flex flex-col items-center gap-1.5">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="8" r="4" stroke="#F2A900" strokeWidth="1.8" strokeLinecap="round"/>
                  <path d="M4 20c0-4 3.582-7 8-7s8 3 8 7" stroke="#F2A900" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
                <span className="text-[10px] font-semibold text-[#F2A900] tracking-wide">TAP</span>
              </div>
            )}

            {/* Hover overlay (画像あり時) */}
            {previewUrl && (
              <div className="icon-overlay">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <path d="M7 7L9 5H15L17 7H20C21.1 7 22 7.9 22 9V18C22 19.1 21.1 20 20 20H4C2.9 20 2 19.1 2 18V9C2 7.9 2.9 7 4 7H7Z" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="12" cy="13" r="3" stroke="white" strokeWidth="1.8"/>
                </svg>
                <span className="text-[10px] font-semibold text-white">変更</span>
              </div>
            )}

            {/* Edit badge */}
            <div className="badge-edit">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <path d="M15.232 5.232l3.536 3.536M9 11l6.5-6.5a2 2 0 012.828 2.829L11.828 13.828 7 15l1.172-4.828z" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </button>

          <p className="text-[12px] text-gray-400">
            {previewUrl ? 'タップして画像を変更' : 'タップしてアイコンを設定'}
          </p>

          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
        </div>

        <div className="divider-line mt-6 animate-slideUp-d2" />

        {/* Form card */}
        <div className="mt-6 profile-card rounded-3xl p-5 animate-slideUp-d3">

          {/* Poker name */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[14px] font-medium text-gray-700">ポーカーネーム</label>
              <span className="text-[11px] font-semibold text-[#F2A900]">必須</span>
            </div>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="例: なおゆき"
              className={`field-input ${error && !name.trim() ? 'has-error' : ''}`}
            />
          </div>

          {/* Player ID */}
          <div className="mt-5">
            <div className="flex items-center justify-between mb-2">
              <label className="text-[14px] font-medium text-gray-700">プレイヤーID(インスタのID的なやつ)</label>
              <span className="text-[11px] font-semibold text-[#F2A900]">必須</span>
            </div>
            <div className="relative">
              <span
                className="absolute left-4 top-1/2 -translate-y-1/2 text-[16px] text-gray-400 pointer-events-none select-none"
                style={{ lineHeight: 1 }}
              >@</span>
              <input
                type="text"
                value={playerId.replace(/^@/, '')}
                onChange={e => handlePlayerIdChange(e.target.value)}
                placeholder="例: naoyuki"
                className={`field-input pl-8 pr-20 ${
                  idError ? 'has-error' :
                  idStatus === 'available' ? 'is-ok' :
                  idStatus === 'unavailable' ? 'is-taken' : ''
                }`}
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[12px] font-medium pointer-events-none">
                {idStatus === 'checking' && <span className="text-gray-400">確認中…</span>}
                {idStatus === 'available' && !idError && <span className="text-emerald-500">✓ 利用可</span>}
                {idStatus === 'unavailable' && <span className="text-red-400">✗ 使用中</span>}
              </span>
            </div>
            {idError && <p className="mt-1.5 text-[12px] text-red-400">{idError}</p>}
          </div>

          {/* Birthday */}
          <div className="mt-5">
            <div className="flex items-center justify-between mb-2">
              <label className="text-[14px] font-medium text-gray-700">誕生日</label>
              <span className="text-[11px] text-gray-400">任意</span>
            </div>
            <input
              type="date"
              value={birthday}
              onChange={e => setBirthday(e.target.value)}
              className="field-input"
            />
            <p className="mt-1.5 text-[11px] text-amber-500 flex items-center gap-1">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              誕生日は登録後に変更できません
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="mt-4 rounded-2xl bg-red-50 border border-red-200 px-4 py-3">
              <p className="text-[13px] text-red-500 text-center">{error}</p>
            </div>
          )}

          {/* Submit */}
          <button
            type="button"
            onClick={handleNext}
            disabled={!canSubmit}
            className="btn-primary mt-6 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                保存中…
              </>
            ) : '次へ'}
          </button>

        </div>

        {/* Footer */}
        <p className="mt-5 mb-8 text-center text-[12px] text-gray-400 animate-slideUp-d4">
          プロフィールはあとから編集できます
        </p>

      </div>
    </main>
  )
}