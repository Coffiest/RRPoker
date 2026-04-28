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

  const [orbPhase, setOrbPhase] = useState(0)
  const animRef = useRef<number | null>(null)

  useEffect(() => {
    let t = 0
    const tick = () => {
      t += 0.005
      setOrbPhase(t)
      animRef.current = requestAnimationFrame(tick)
    }
    animRef.current = requestAnimationFrame(tick)
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current) }
  }, [])

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

  const orb1x = Math.sin(orbPhase * 0.7) * 30
  const orb1y = Math.cos(orbPhase * 0.5) * 20
  const orb2x = Math.cos(orbPhase * 0.6) * 24
  const orb2y = Math.sin(orbPhase * 0.8) * 18

  return (
    <div style={{ minHeight: '100dvh', background: '#F2F2F7', overflowX: 'hidden' }}>
      <style>{`
        :root {
          --gold: #F2A900; --gold-dk: #D4910A;
          --label: #1C1C1E; --label2: rgba(60,60,67,0.6); --label3: rgba(60,60,67,0.3);
          --sep: rgba(60,60,67,0.12); --red: #FF3B30;
        }
        @keyframes so-fade-up {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes so-orb {
          0%,100% { opacity: 0.8; }
          50%     { opacity: 1; }
        }
        @keyframes so-badge-pulse {
          0%,100% { box-shadow: 0 6px 24px rgba(242,169,0,0.35); }
          50%     { box-shadow: 0 6px 36px rgba(242,169,0,0.55); }
        }
        @keyframes so-icon-ring {
          0%,100% { box-shadow: 0 0 0 3px rgba(242,169,0,0.25), 0 4px 20px rgba(242,169,0,0.18); }
          50%     { box-shadow: 0 0 0 4px rgba(242,169,0,0.4),  0 4px 28px rgba(242,169,0,0.28); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .so-appear { opacity: 0; animation: so-fade-up .5s cubic-bezier(.22,1,.36,1) forwards; }
        .so-d1 { animation-delay: .06s; }
        .so-d2 { animation-delay: .14s; }
        .so-d3 { animation-delay: .22s; }
        .so-d4 { animation-delay: .30s; }
        .so-d5 { animation-delay: .38s; }
        .so-badge { animation: so-badge-pulse 2.4s ease-in-out 0.8s infinite; }
        .so-icon-ring { animation: so-icon-ring 3s ease-in-out infinite; }
        .so-field {
          position: relative; display: flex; align-items: center;
          background: #FAFAFA; border: 1.5px solid var(--sep);
          border-radius: 14px; transition: border-color .18s, box-shadow .18s, background .18s;
          overflow: hidden;
        }
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number] { -moz-appearance: textfield; }
        .so-field:focus-within {
          border-color: var(--gold);
          box-shadow: 0 0 0 3px rgba(242,169,0,0.12);
          background: white;
        }
        .so-field.field-error {
          border-color: var(--red) !important;
          box-shadow: 0 0 0 3px rgba(255,59,48,0.09) !important;
          background: #FFF5F5 !important;
        }
        .so-input {
          flex: 1; background: transparent; border: none; outline: none;
          font-size: 16px; color: var(--label); padding: 0 13px;
          font-family: inherit;
        }
        .so-input::placeholder { color: var(--label3); }
        .so-btn {
          width: 100%; height: 54px; border-radius: 16px; border: none; cursor: pointer;
          background: linear-gradient(135deg, #F2A900 0%, #D4910A 100%);
          font-size: 16px; font-weight: 800; color: #1a1a1a;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          box-shadow: 0 4px 18px rgba(242,169,0,0.32);
          transition: transform .13s, opacity .13s;
          font-family: inherit;
        }
        .so-btn:active { transform: scale(0.97); opacity: .88; }
        .so-btn:disabled { opacity: .55; pointer-events: none; }
        .so-spinner {
          width: 20px; height: 20px; border: 2.5px solid rgba(0,0,0,0.15);
          border-top-color: #1a1a1a; border-radius: 50%;
          animation: spin .7s linear infinite;
        }
      `}</style>

      {/* ヘッダー */}
      <header style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(242,242,247,0.92)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(60,60,67,0.08)' }}>
        <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 20px', minHeight: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <img src="/logo.png" alt="RRPoker" style={{ width: 26, height: 26, borderRadius: 8, objectFit: 'cover' }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--label)' }}>RRPOKER</span>
        </div>
      </header>

      <div
        style={{
          maxWidth: 440, margin: '0 auto', padding: '0 20px 64px',
          opacity: isExiting ? 0 : 1,
          transform: isExiting ? 'translateY(-10px)' : 'none',
          transition: 'opacity .24s, transform .24s',
        }}
      >

        {/* Hero */}
        <div className="so-appear so-d1" style={{ textAlign: 'center', padding: '28px 0 20px', position: 'relative' }}>
          <div style={{ position: 'absolute', top: 10, left: '50%', transform: `translate(calc(-50% + ${orb1x}px), ${orb1y}px)`, width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle,rgba(242,169,0,0.13) 0%,transparent 70%)', pointerEvents: 'none', animation: 'so-orb 6s ease-in-out infinite' }} />
          <div style={{ position: 'absolute', top: 40, left: '50%', transform: `translate(calc(-50% + ${orb2x}px), ${orb2y}px)`, width: 150, height: 150, borderRadius: '50%', background: 'radial-gradient(circle,rgba(242,169,0,0.08) 0%,transparent 70%)', pointerEvents: 'none', animation: 'so-orb 8s ease-in-out 2s infinite' }} />

          <div className="so-badge" style={{ width: 68, height: 68, borderRadius: 22, background: 'linear-gradient(135deg,#F2A900 0%,#D4910A 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', position: 'relative', zIndex: 1 }}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <polyline points="9,22 9,12 15,12 15,22" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(242,169,0,0.1)', border: '1px solid rgba(242,169,0,0.25)', borderRadius: 99, padding: '4px 12px', marginBottom: 12, position: 'relative', zIndex: 1 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#F2A900', display: 'inline-block' }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#D4910A', letterSpacing: '0.06em', textTransform: 'uppercase' }}>店舗プロフィール設定</span>
          </div>

          <h1 style={{ fontSize: 23, fontWeight: 900, color: 'var(--label)', letterSpacing: '-0.5px', lineHeight: 1.3, position: 'relative', zIndex: 1 }}>
            あなたの店舗を<br />RRPokerに登録しましょう
          </h1>
          <p style={{ fontSize: 13, color: 'var(--label2)', marginTop: 8, lineHeight: 1.7, position: 'relative', zIndex: 1 }}>
            プレイヤーが検索・参加できるようになります
          </p>
        </div>

        {/* アイコンピッカー */}
        <div className="so-appear so-d2" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 20 }}>
          <button
            type="button"
            onClick={handlePickImage}
            className="so-icon-ring"
            style={{
              width: 90, height: 90, borderRadius: 28,
              background: previewUrl ? 'transparent' : 'rgba(242,169,0,0.1)',
              border: 'none', cursor: 'pointer', overflow: 'hidden',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              position: 'relative',
            }}
            aria-label="店舗アイコンを選択"
          >
            {previewUrl ? (
              <img src={previewUrl} alt="store icon" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
                <path d="M7 7L9 5H15L17 7H20C21.1046 7 22 7.89543 22 9V18C22 19.1046 21.1046 20 20 20H4C2.89543 20 2 19.1046 2 18V9C2 7.89543 2.89543 7 4 7H7Z" stroke="#F2A900" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M12 16C13.6569 16 15 14.6569 15 13C15 11.3431 13.6569 10 12 10C10.3431 10 9 11.3431 9 13C9 14.6569 10.3431 16 12 16Z" stroke="#F2A900" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
            <div style={{ position: 'absolute', bottom: -3, right: -3, width: 26, height: 26, borderRadius: 10, background: 'linear-gradient(135deg,#F2A900,#D4910A)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(242,169,0,0.4)' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </button>
          <p style={{ fontSize: 11, color: 'var(--label3)', marginTop: 10, fontWeight: 600 }}>タップしてアイコンを設定（任意）</p>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
        </div>

        {/* 基本情報カード */}
        <div className="so-appear so-d3" style={{ background: 'white', borderRadius: 24, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: 12 }}>
          <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--label2)', marginBottom: 18 }}>基本情報</p>

          {/* 店舗名 */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--label2)', letterSpacing: '0.04em', marginBottom: 6 }}>
              店舗名（正式名称）<span style={{ color: 'var(--red)', marginLeft: 2 }}>*</span>
            </label>
            <div className={`so-field${missingFields.name ? ' field-error' : ''}`} style={{ height: 50 }}>
              <div style={{ paddingLeft: 14, color: 'var(--label3)', flexShrink: 0 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  <polyline points="9,22 9,12 15,12 15,22" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="例: RRポーカークラブ" className="so-input" />
            </div>
          </div>

          {/* 郵便番号 */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--label2)', letterSpacing: '0.04em', marginBottom: 6 }}>
              郵便番号<span style={{ color: 'var(--red)', marginLeft: 2 }}>*</span>
            </label>
            <div className={`so-field${missingFields.postalCode ? ' field-error' : ''}`} style={{ height: 50 }}>
              <div style={{ paddingLeft: 14, color: 'var(--label3)', flexShrink: 0 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" stroke="currentColor" strokeWidth="1.8" />
                  <circle cx="12" cy="10" r="3" stroke="currentColor" strokeWidth="1.8" />
                </svg>
              </div>
              <input type="text" value={postalCode} onChange={e => setPostalCode(e.target.value)} placeholder="例: 100-0001" className="so-input" />
            </div>
          </div>

          {/* 住所 丁目 */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--label2)', letterSpacing: '0.04em', marginBottom: 6 }}>
              住所、丁目<span style={{ color: 'var(--red)', marginLeft: 2 }}>*</span>
            </label>
            <div className={`so-field${missingFields.addressLine ? ' field-error' : ''}`} style={{ height: 50 }}>
              <div style={{ paddingLeft: 14, color: 'var(--label3)', flexShrink: 0 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <input type="text" value={addressLine} onChange={e => setAddressLine(e.target.value)} placeholder="例: 東京都千代田区丸の内1丁目" className="so-input" />
            </div>
          </div>

          {/* 番地 etc */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--label2)', letterSpacing: '0.04em', marginBottom: 6 }}>
              番地、マンション名、号室など<span style={{ color: 'var(--red)', marginLeft: 2 }}>*</span>
            </label>
            <div className={`so-field${missingFields.addressDetail ? ' field-error' : ''}`} style={{ height: 50 }}>
              <div style={{ paddingLeft: 14, color: 'var(--label3)', flexShrink: 0 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <rect x="4" y="2" width="16" height="20" rx="2" stroke="currentColor" strokeWidth="1.8" />
                  <path d="M9 7h6M9 12h6M9 17h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </div>
              <input type="text" value={addressDetail} onChange={e => setAddressDetail(e.target.value)} placeholder="例: 1-1 OOビル 201" className="so-input" />
            </div>
          </div>
        </div>

        {/* 詳細情報カード */}
        <div className="so-appear so-d4" style={{ background: 'white', borderRadius: 24, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: 12 }}>
          <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--label2)', marginBottom: 18 }}>詳細情報</p>

          {/* 説明 */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--label2)', letterSpacing: '0.04em', marginBottom: 6 }}>店舗の説明</label>
            <div className="so-field" style={{ height: 'auto', alignItems: 'flex-start', padding: '12px 14px' }}>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="定休日や、どんなお店なのかなど"
                rows={3}
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 15, color: 'var(--label)', resize: 'none', fontFamily: 'inherit', lineHeight: 1.6 }}
              />
            </div>
          </div>

          {/* リングブラインド */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--label2)', letterSpacing: '0.04em', marginBottom: 8 }}>
              リングゲームのブラインド <span style={{ fontSize: 10, fontWeight: 500 }}>（任意）</span>
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--label3)', letterSpacing: '0.08em', marginBottom: 4, textAlign: 'center' }}>SB</div>
                <div className="so-field" style={{ height: 48 }}>
                  <input type="number" min={0} value={ringBlindSb} onChange={e => setRingBlindSb(e.target.value)} placeholder="5" className="so-input" style={{ textAlign: 'center', minWidth: 0 }} />
                </div>
              </div>
              <div style={{ color: 'var(--label3)', fontSize: 18, marginTop: 18, flexShrink: 0 }}>—</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--label3)', letterSpacing: '0.08em', marginBottom: 4, textAlign: 'center' }}>BB</div>
                <div className="so-field" style={{ height: 48 }}>
                  <input type="number" min={0} value={ringBlindBb} onChange={e => setRingBlindBb(e.target.value)} placeholder="10" className="so-input" style={{ textAlign: 'center', minWidth: 0 }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* エラー */}
        {error && (
          <div style={{ background: 'rgba(255,59,48,0.06)', border: '1px solid rgba(255,59,48,0.2)', borderRadius: 14, padding: '12px 16px', marginBottom: 16 }}>
            <p style={{ fontSize: 13, color: 'var(--red)', fontWeight: 600, textAlign: 'center' }}>{error}</p>
          </div>
        )}

        {/* 送信ボタン */}
        <div className="so-appear so-d5">
          <button type="button" disabled={loading} onClick={saveProfile} className="so-btn">
            {loading ? (
              <div className="so-spinner" />
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M5 12h14M12 5l7 7-7 7" stroke="#1a1a1a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                次へ進む
              </>
            )}
          </button>
          <p style={{ fontSize: 11, color: 'var(--label3)', textAlign: 'center', marginTop: 12 }}>
            * は必須項目です
          </p>
        </div>

      </div>
    </div>
  )
}
