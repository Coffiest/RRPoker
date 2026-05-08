'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { auth, db } from '@/lib/firebase'
import { arrayUnion, collection, doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { resizeImageToDataUrl } from '@/lib/image'

const generateCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < 6; i += 1) result += chars[Math.floor(Math.random() * chars.length)]
  return result
}

export default function BranchStorePage() {
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
  const [parentStoreId, setParentStoreId] = useState<string | null>(null)
  const [missingFields, setMissingFields] = useState({ name: false, postalCode: false, addressLine: false, addressDetail: false })

  const MAX_ICON_SIZE = 5 * 1024 * 1024
  const MAX_ICON_EDGE = 200
  const ICON_QUALITY = 0.7
  const MAX_DATA_URL_LENGTH = 900000

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async user => {
      if (!user) { router.replace('/'); return }
      const userSnap = await getDoc(doc(db, 'users', user.uid))
      const sid = userSnap.data()?.storeId
      if (!sid) { router.replace('/home/store'); return }
      setParentStoreId(sid)
      const storeSnap = await getDoc(doc(db, 'stores', sid))
      const data = storeSnap.data()
      if (!data) return
      setName(data.name ?? '')
      setPostalCode(data.postalCode ?? '')
      setAddressLine(data.addressLine ?? '')
      setAddressDetail(data.addressDetail ?? '')
      setDescription(data.description ?? '')
      if (typeof data.ringBlindSb === 'number') setRingBlindSb(String(data.ringBlindSb))
      if (typeof data.ringBlindBb === 'number') setRingBlindBb(String(data.ringBlindBb))
      if (data.iconUrl) { setIconDataUrl(data.iconUrl); setPreviewUrl(data.iconUrl) }
    })
    return () => unsub()
  }, [router])

  useEffect(() => {
    return () => { if (previewUrl && previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl) }
  }, [previewUrl])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    e.target.value = ''
    if (!file) return
    if (file.size > MAX_ICON_SIZE) { setError('画像サイズが大きすぎます（5MBまで）'); return }
    if (previewUrl && previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl)
    void (async () => {
      try {
        const dataUrl = await resizeImageToDataUrl(file, MAX_ICON_EDGE, ICON_QUALITY)
        if (dataUrl.length > MAX_DATA_URL_LENGTH) { setError('画像サイズが大きすぎます'); return }
        setIconDataUrl(dataUrl); setPreviewUrl(dataUrl)
      } catch (e: any) { setError(e.message || '画像の登録に失敗しました') }
    })()
  }

  const validate = () => {
    const m = { name: !name.trim(), postalCode: !postalCode.trim(), addressLine: !addressLine.trim(), addressDetail: !addressDetail.trim() }
    setMissingFields(m)
    if (m.name || m.postalCode || m.addressLine || m.addressDetail) { setError('必須項目が入力されていません'); return false }
    const sb = ringBlindSb.trim(), bb = ringBlindBb.trim()
    if ((sb && !bb) || (!sb && bb)) { setError('ブラインドのSB/BBは両方入力してください'); return false }
    if (sb && bb) {
      const sv = Number(sb), bv = Number(bb)
      if (!Number.isInteger(sv) || !Number.isInteger(bv) || sv < 0 || bv < 0) { setError('ブラインドは0以上の整数で入力してください'); return false }
    }
    setError(''); return true
  }

  const saveProfile = async () => {
    const user = auth.currentUser
    if (!user || !parentStoreId) return
    if (!validate()) return
    setLoading(true)
    try {
      // Determine the shared balance group ID
      const parentSnap = await getDoc(doc(db, 'stores', parentStoreId))
      const parentData = parentSnap.data()
      const balanceGroupId = parentData?.balanceGroupId ?? parentStoreId
      if (!parentData?.balanceGroupId) {
        await updateDoc(doc(db, 'stores', parentStoreId), { balanceGroupId })
      }

      // Generate a unique store code
      let code = generateCode()
      while ((await getDoc(doc(collection(db, 'stores'), code))).exists()) code = generateCode()

      const iconUrl = iconDataUrl ?? undefined
      const fullAddress = `${postalCode.trim()} ${addressLine.trim()} ${addressDetail.trim()}`
      const sb = ringBlindSb.trim(), bb = ringBlindBb.trim()
      const blindPayload = sb && bb ? { ringBlindSb: Number(sb), ringBlindBb: Number(bb) } : {}

      await setDoc(doc(db, 'stores', code), {
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
        balanceGroupId,
        createdAt: serverTimestamp(),
      }, { merge: true })

      await updateDoc(doc(db, 'users', user.uid), {
        ownedStoreIds: arrayUnion(parentStoreId, code),
      })

      router.replace('/home/store')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100dvh', background: '#F2F2F7', overflowX: 'hidden' }}>
      <style>{`
        :root { --gold:#F2A900; --gold-dk:#D4910A; --label:#1C1C1E; --label2:rgba(60,60,67,0.6); --label3:rgba(60,60,67,0.3); --sep:rgba(60,60,67,0.12); --red:#FF3B30; }
        @keyframes spin { to { transform:rotate(360deg); } }
        .bs-field { position:relative; display:flex; align-items:center; background:#FAFAFA; border:1.5px solid var(--sep); border-radius:14px; transition:border-color .18s,box-shadow .18s,background .18s; overflow:hidden; }
        .bs-field:focus-within { border-color:var(--gold); box-shadow:0 0 0 3px rgba(242,169,0,0.12); background:white; }
        .bs-field.field-error { border-color:var(--red)!important; box-shadow:0 0 0 3px rgba(255,59,48,0.09)!important; background:#FFF5F5!important; }
        .bs-input { flex:1; background:transparent; border:none; outline:none; font-size:16px; color:var(--label); padding:0 13px; font-family:inherit; }
        .bs-input::placeholder { color:var(--label3); }
        input[type=number]::-webkit-inner-spin-button,input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none;margin:0;}
        input[type=number]{-moz-appearance:textfield;}
        .bs-btn { width:100%; height:54px; border-radius:16px; border:none; cursor:pointer; background:linear-gradient(135deg,#F2A900 0%,#D4910A 100%); font-size:16px; font-weight:800; color:#1a1a1a; display:flex; align-items:center; justify-content:center; gap:8px; box-shadow:0 4px 18px rgba(242,169,0,0.32); transition:transform .13s,opacity .13s; font-family:inherit; }
        .bs-btn:active { transform:scale(0.97); opacity:.88; }
        .bs-btn:disabled { opacity:.55; pointer-events:none; }
      `}</style>

      <header style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(242,242,247,0.92)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(60,60,67,0.08)' }}>
        <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 20px', minHeight: 56, display: 'flex', alignItems: 'center', gap: 12 }}>
          <button type="button" onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', display: 'flex', alignItems: 'center', gap: 4 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="var(--label)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span style={{ fontSize: 14, color: 'var(--label)' }}>戻る</span>
          </button>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--label)', flex: 1, textAlign: 'center', marginRight: 60 }}>系列店を作成</span>
        </div>
      </header>

      <div style={{ maxWidth: 440, margin: '0 auto', padding: '16px 20px 64px' }}>

        {/* 説明 */}
        <div style={{ background: 'rgba(242,169,0,0.08)', border: '1px solid rgba(242,169,0,0.2)', borderRadius: 14, padding: '12px 16px', marginBottom: 20 }}>
          <p style={{ fontSize: 13, color: '#D4910A', fontWeight: 600, lineHeight: 1.6 }}>
            系列店は同一ログインアカウントで管理できます。プレイヤーの店内通貨は全系列店で共有されます。
          </p>
        </div>

        {/* アイコンピッカー */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 20 }}>
          <button type="button" onClick={() => fileInputRef.current?.click()}
            style={{ width: 90, height: 90, borderRadius: 28, background: previewUrl ? 'transparent' : 'rgba(242,169,0,0.1)', border: 'none', cursor: 'pointer', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', boxShadow: '0 0 0 3px rgba(242,169,0,0.25)' }}>
            {previewUrl ? (
              <img src={previewUrl} alt="store icon" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
            ) : (
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
                <path d="M7 7L9 5H15L17 7H20C21.1046 7 22 7.89543 22 9V18C22 19.1046 21.1046 20 20 20H4C2.89543 20 2 19.1046 2 18V9C2 7.89543 2.89543 7 4 7H7Z" stroke="#F2A900" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M12 16C13.6569 16 15 14.6569 15 13C15 11.3431 13.6569 10 12 10C10.3431 10 9 11.3431 9 13C9 14.6569 10.3431 16 12 16Z" stroke="#F2A900" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
            <div style={{ position: 'absolute', bottom: -3, right: -3, width: 26, height: 26, borderRadius: 10, background: 'linear-gradient(135deg,#F2A900,#D4910A)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(242,169,0,0.4)' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
          </button>
          <p style={{ fontSize: 11, color: 'var(--label3)', marginTop: 10, fontWeight: 600 }}>タップしてアイコンを変更（任意）</p>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }}/>
        </div>

        {/* 基本情報 */}
        <div style={{ background: 'white', borderRadius: 24, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: 12 }}>
          <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--label2)', marginBottom: 18 }}>基本情報</p>

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--label2)', letterSpacing: '0.04em', marginBottom: 6 }}>店舗名（正式名称）<span style={{ color: 'var(--red)', marginLeft: 2 }}>*</span></label>
            <div className={`bs-field${missingFields.name ? ' field-error' : ''}`} style={{ height: 50 }}>
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="例: KQ直方店" className="bs-input" style={{ paddingLeft: 14 }}/>
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--label2)', letterSpacing: '0.04em', marginBottom: 6 }}>郵便番号<span style={{ color: 'var(--red)', marginLeft: 2 }}>*</span></label>
            <div className={`bs-field${missingFields.postalCode ? ' field-error' : ''}`} style={{ height: 50 }}>
              <input type="text" value={postalCode} onChange={e => setPostalCode(e.target.value)} placeholder="例: 800-0000" className="bs-input" style={{ paddingLeft: 14 }}/>
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--label2)', letterSpacing: '0.04em', marginBottom: 6 }}>住所、丁目<span style={{ color: 'var(--red)', marginLeft: 2 }}>*</span></label>
            <div className={`bs-field${missingFields.addressLine ? ' field-error' : ''}`} style={{ height: 50 }}>
              <input type="text" value={addressLine} onChange={e => setAddressLine(e.target.value)} placeholder="例: 福岡県直方市○○" className="bs-input" style={{ paddingLeft: 14 }}/>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--label2)', letterSpacing: '0.04em', marginBottom: 6 }}>番地・マンション名など<span style={{ color: 'var(--red)', marginLeft: 2 }}>*</span></label>
            <div className={`bs-field${missingFields.addressDetail ? ' field-error' : ''}`} style={{ height: 50 }}>
              <input type="text" value={addressDetail} onChange={e => setAddressDetail(e.target.value)} placeholder="例: 1-1 ○○ビル 201" className="bs-input" style={{ paddingLeft: 14 }}/>
            </div>
          </div>
        </div>

        {/* 詳細情報 */}
        <div style={{ background: 'white', borderRadius: 24, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: 12 }}>
          <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--label2)', marginBottom: 18 }}>詳細情報</p>

          <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--label2)', letterSpacing: '0.04em', marginBottom: 6 }}>店舗の説明</label>
            <div className="bs-field" style={{ height: 'auto', alignItems: 'flex-start', padding: '12px 14px' }}>
              <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="定休日や、どんなお店なのかなど" rows={3}
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 15, color: 'var(--label)', resize: 'none', fontFamily: 'inherit', lineHeight: 1.6 }}/>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--label2)', letterSpacing: '0.04em', marginBottom: 8 }}>リングゲームのブラインド <span style={{ fontSize: 10, fontWeight: 500 }}>（任意）</span></label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--label3)', letterSpacing: '0.08em', marginBottom: 4, textAlign: 'center' }}>SB</div>
                <div className="bs-field" style={{ height: 48 }}>
                  <input type="number" min={0} value={ringBlindSb} onChange={e => setRingBlindSb(e.target.value)} placeholder="5" className="bs-input" style={{ textAlign: 'center' }}/>
                </div>
              </div>
              <div style={{ color: 'var(--label3)', fontSize: 18, marginTop: 18, flexShrink: 0 }}>—</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--label3)', letterSpacing: '0.08em', marginBottom: 4, textAlign: 'center' }}>BB</div>
                <div className="bs-field" style={{ height: 48 }}>
                  <input type="number" min={0} value={ringBlindBb} onChange={e => setRingBlindBb(e.target.value)} placeholder="10" className="bs-input" style={{ textAlign: 'center' }}/>
                </div>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div style={{ background: 'rgba(255,59,48,0.06)', border: '1px solid rgba(255,59,48,0.2)', borderRadius: 14, padding: '12px 16px', marginBottom: 16 }}>
            <p style={{ fontSize: 13, color: 'var(--red)', fontWeight: 600, textAlign: 'center' }}>{error}</p>
          </div>
        )}

        <button type="button" disabled={loading} onClick={saveProfile} className="bs-btn">
          {loading ? (
            <div style={{ width: 20, height: 20, border: '2.5px solid rgba(0,0,0,0.15)', borderTopColor: '#1a1a1a', borderRadius: '50%', animation: 'spin .7s linear infinite' }}/>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M12 5l7 7-7 7" stroke="#1a1a1a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              系列店を作成する
            </>
          )}
        </button>
        <p style={{ fontSize: 11, color: 'var(--label3)', textAlign: 'center', marginTop: 12 }}>* は必須項目です</p>
      </div>
    </div>
  )
}
