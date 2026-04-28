'use client'

import { useState, useEffect, useRef } from "react"
import { createUserWithEmailAndPassword, sendEmailVerification } from "firebase/auth"
import { doc, setDoc, serverTimestamp } from "firebase/firestore"
import { auth, db } from "@/lib/firebase"
import { useRouter } from "next/navigation"
import { getAuthErrorMessage } from "src/lib/auth-error"

export default function StoreRegisterPage() {
  const router = useRouter()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [showPw, setShowPw] = useState(false)
  const [showCPw, setShowCPw] = useState(false)
  const [success, setSuccess] = useState(false)
  const [step, setStep] = useState<'form' | 'sent'>('form')
  const [orbPhase, setOrbPhase] = useState(0)
  const animRef = useRef<number | null>(null)

  const pwStrength = (() => {
    if (!password) return 0
    let s = 0
    if (password.length >= 8) s++
    if (/[A-Z]/.test(password)) s++
    if (/[0-9]/.test(password)) s++
    if (/[^A-Za-z0-9]/.test(password)) s++
    return s
  })()
  const pwMatch = confirmPassword.length > 0 && password === confirmPassword
  const pwMismatch = confirmPassword.length > 0 && password !== confirmPassword
  const strengthColor = ['#333', '#FF3B30', '#FF9500', '#F2A900', '#34C759'][pwStrength]
  const strengthLabel = ['', '弱い', '普通', '強い', '非常に強い'][pwStrength]

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

  const handleRegister = async () => {
    if (!email || !password || !confirmPassword) { setError('すべての項目を入力してください'); return }
    if (password !== confirmPassword) { setError('パスワードが一致しません'); return }
    if (password.length < 6) { setError('パスワードは6文字以上で設定してください'); return }
    setError(''); setIsLoading(true)
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password)
      const user = credential.user
      await setDoc(doc(db, "users", user.uid), { email: user.email, role: 'store', createdAt: serverTimestamp() }, { merge: true })
      await sendEmailVerification(credential.user, {
        url: "https://rrpoker.vercel.app/verify-complete",
        handleCodeInApp: true,
      })
      setSuccess(true)
      setTimeout(() => setStep('sent'), 400)
    } catch (e: any) {
      setError(getAuthErrorMessage(e.code))
    } finally { setIsLoading(false) }
  }

  const orb1x = Math.sin(orbPhase * 0.6) * 40
  const orb1y = Math.cos(orbPhase * 0.4) * 30
  const orb2x = Math.cos(orbPhase * 0.5) * 35
  const orb2y = Math.sin(orbPhase * 0.7) * 25
  const orb3x = Math.sin(orbPhase * 0.3 + 1) * 28
  const orb3y = Math.cos(orbPhase * 0.8 + 2) * 22

  if (step === 'sent') {
    return (
      <div style={{ minHeight: '100dvh', background: '#0A0A14', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}>
        <div style={{ maxWidth: 400, width: '100%', textAlign: 'center' }}>
          <div style={{ width: 76, height: 76, borderRadius: 24, background: 'linear-gradient(135deg,#F2A900,#D4910A)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', boxShadow: '0 0 48px rgba(242,169,0,0.4)' }}>
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="white" strokeWidth="2" strokeLinecap="round" />
              <polyline points="22,6 12,13 2,6" stroke="white" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: 'white', marginBottom: 10 }}>確認メールを送信しました</h2>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', lineHeight: 1.8, marginBottom: 24 }}>
            <strong style={{ color: 'rgba(255,255,255,0.85)' }}>{email}</strong> 宛に確認メールを送信しました。<br />
            メール内のリンクをクリックしてアカウントを有効化してください。
          </p>
          <div style={{ background: 'rgba(242,169,0,0.08)', border: '1px solid rgba(242,169,0,0.2)', borderRadius: 14, padding: '14px 16px', marginBottom: 24, textAlign: 'left' }}>
            <p style={{ fontSize: 12, color: 'rgba(242,169,0,0.85)', fontWeight: 600, lineHeight: 1.7 }}>
              ✉️ メールが届かない場合は迷惑メールフォルダをご確認ください。<br />
              🏪 メール認証後、ログインすると店舗情報の登録に進みます。
            </p>
          </div>
          <button onClick={() => router.push('/login')}
            style={{ width: '100%', height: 52, borderRadius: 16, background: 'linear-gradient(135deg,#F2A900,#D4910A)', border: 'none', fontSize: 16, fontWeight: 700, color: '#1a1a1a', cursor: 'pointer', boxShadow: '0 0 32px rgba(242,169,0,0.35)' }}
          >ログイン画面へ</button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100dvh', background: '#0A0A14', overflowX: 'hidden', position: 'relative' }}>
      <style>{`
        @keyframes sr-fade-up {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes sr-glow-pulse {
          0%,100% { opacity: 0.6; }
          50%      { opacity: 1; }
        }
        @keyframes sr-badge-in {
          0%  { opacity: 0; transform: scale(0.7) rotate(-8deg); }
          70% { transform: scale(1.06) rotate(2deg); }
          100%{ opacity: 1; transform: scale(1) rotate(0); }
        }
        @keyframes sr-border-flow {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes sr-strength-fill {
          from { width: 0; }
        }
        .sr-appear { opacity: 0; animation: sr-fade-up .52s cubic-bezier(.22,1,.36,1) forwards; }
        .sr-d1 { animation-delay: .04s; }
        .sr-d2 { animation-delay: .12s; }
        .sr-d3 { animation-delay: .20s; }
        .sr-d4 { animation-delay: .28s; }
        .sr-d5 { animation-delay: .36s; }
        .sr-badge-anim { animation: sr-badge-in .6s cubic-bezier(.22,1,.36,1) .1s both; }
        .sr-field {
          position: relative; display: flex; align-items: center;
          background: rgba(255,255,255,0.06);
          border: 1.5px solid rgba(255,255,255,0.1);
          border-radius: 14px; height: 52px;
          transition: border-color .18s, box-shadow .18s, background .18s;
        }
        .sr-field:focus-within {
          border-color: #F2A900;
          box-shadow: 0 0 0 3px rgba(242,169,0,0.18), 0 0 20px rgba(242,169,0,0.08);
          background: rgba(255,255,255,0.09);
        }
        .sr-field.field-error {
          border-color: #FF3B30 !important;
          box-shadow: 0 0 0 3px rgba(255,59,48,0.15) !important;
          background: rgba(255,59,48,0.06) !important;
        }
        .sr-field.field-ok {
          border-color: #34C759 !important;
          box-shadow: 0 0 0 3px rgba(52,199,89,0.12) !important;
        }
        .sr-input {
          flex: 1; background: transparent; border: none; outline: none;
          font-size: 16px; color: white; padding: 0 13px;
          font-family: inherit;
        }
        .sr-input::placeholder { color: rgba(255,255,255,0.25); }
        .sr-btn {
          width: 100%; height: 54px; border-radius: 16px; border: none; cursor: pointer;
          background: linear-gradient(135deg, #F2A900 0%, #D4910A 100%);
          font-size: 16px; font-weight: 800; color: #0A0A14;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          box-shadow: 0 4px 24px rgba(242,169,0,0.4), 0 0 48px rgba(242,169,0,0.12);
          transition: transform .13s, opacity .13s, box-shadow .13s;
          font-family: inherit;
        }
        .sr-btn:active { transform: scale(0.97); opacity: .88; }
        .sr-btn:disabled { opacity: .45; pointer-events: none; }
        .sr-btn.success-state { background: linear-gradient(135deg,#34C759,#28A745); box-shadow: 0 4px 24px rgba(52,199,89,0.4); }
        .sr-spinner {
          width: 20px; height: 20px; border: 2.5px solid rgba(10,10,20,0.2);
          border-top-color: #0A0A14; border-radius: 50%;
          animation: spin .7s linear infinite;
        }
        .sr-divider { height: 1px; background: rgba(255,255,255,0.08); }
        button { -webkit-tap-highlight-color: transparent; }
      `}</style>

      {/* 背景 orb */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: `calc(5% + ${orb1y}px)`, right: `calc(0% + ${orb1x}px)`, width: 360, height: 360, borderRadius: '50%', background: 'radial-gradient(circle, rgba(242,169,0,0.14) 0%, transparent 65%)', animation: 'sr-glow-pulse 6s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', bottom: `calc(10% + ${orb2y}px)`, left: `calc(-5% + ${orb2x}px)`, width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle, rgba(242,169,0,0.09) 0%, transparent 65%)', animation: 'sr-glow-pulse 8s ease-in-out 2s infinite' }} />
        <div style={{ position: 'absolute', top: `calc(40% + ${orb3y}px)`, left: `calc(35% + ${orb3x}px)`, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(212,145,10,0.07) 0%, transparent 65%)', animation: 'sr-glow-pulse 10s ease-in-out 4s infinite' }} />
        {/* 上部グロー帯 */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg, transparent, rgba(242,169,0,0.3), transparent)' }} />
      </div>

      {/* ヘッダー */}
      <header style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(10,10,20,0.85)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 20px', minHeight: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button type="button" onClick={() => router.back()}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: '#F2A900', fontSize: 14, fontWeight: 700, padding: '8px 0' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            戻る
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <img src="/logo.png" alt="RRPoker" style={{ width: 26, height: 26, borderRadius: 8, objectFit: 'cover' }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>RRPOKER</span>
          </div>
          <div style={{ width: 52 }} />
        </div>
      </header>

      {/* コンテンツ */}
      <div style={{ position: 'relative', zIndex: 1, maxWidth: 440, margin: '0 auto', padding: '0 20px 64px' }}>

        {/* Hero */}
        <div className="sr-appear sr-d1" style={{ textAlign: 'center', padding: '36px 0 28px' }}>
          {/* ストアバッジ */}
          <div className="sr-badge-anim" style={{ width: 76, height: 76, borderRadius: 24, background: 'linear-gradient(135deg,#F2A900 0%,#D4910A 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', boxShadow: '0 0 0 12px rgba(242,169,0,0.08), 0 0 48px rgba(242,169,0,0.3)' }}>
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="#0A0A14" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              <polyline points="9,22 9,12 15,12 15,22" stroke="#0A0A14" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          {/* 店舗専用ラベル */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(242,169,0,0.12)', border: '1px solid rgba(242,169,0,0.3)', borderRadius: 99, padding: '5px 14px', marginBottom: 16 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#F2A900', display: 'inline-block', boxShadow: '0 0 6px rgba(242,169,0,0.8)' }} />
            <span style={{ fontSize: 11, fontWeight: 800, color: '#F2A900', letterSpacing: '0.1em', textTransform: 'uppercase' }}>店舗専用アカウント登録</span>
          </div>

          <h1 style={{ fontSize: 28, fontWeight: 900, color: 'white', letterSpacing: '-0.6px', lineHeight: 1.2, marginBottom: 10 }}>
            RRPokerで<br />あなたの店舗を登録
          </h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 1.8 }}>
            トーナメント管理・チップ残高・ランキングを<br />ひとつのシステムで。
          </p>

          {/* プレイヤー向け案内 */}
          <div style={{ marginTop: 18, display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 99, padding: '6px 14px' }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>プレイヤーとして登録する方は</span>
            <button type="button" onClick={() => router.push('/register')}
              style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.55)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'rgba(255,255,255,0.2)' }}
            >こちら →</button>
          </div>
        </div>

        {/* フォームカード */}
        <div className="sr-appear sr-d2" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 24, padding: 24, backdropFilter: 'blur(12px)', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
            <div style={{ width: 3, height: 16, borderRadius: 2, background: 'linear-gradient(#F2A900,#D4910A)' }} />
            <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)' }}>アカウント情報</p>
          </div>

          {/* メール */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 7 }}>メールアドレス</label>
            <div className="sr-field">
              <div style={{ paddingLeft: 14, color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  <polyline points="22,6 12,13 2,6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </div>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="store@example.com" className="sr-input" disabled={isLoading}
              />
            </div>
            {email.includes('icloud') && (
              <p style={{ fontSize: 10, color: '#FF9500', fontWeight: 600, marginTop: 5 }}>
                ⚠️ iCloudメールは確認メールが届かない場合があります
              </p>
            )}
          </div>

          {/* パスワード */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 7 }}>パスワード</label>
            <div className="sr-field">
              <div style={{ paddingLeft: 14, color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="1.8" />
                  <path d="M7 11V7a5 5 0 0110 0v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </div>
              <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                placeholder="6文字以上" className="sr-input" disabled={isLoading}
              />
              <button type="button" onClick={() => setShowPw(v => !v)}
                style={{ position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: 700, transition: 'color .18s' }}
              >{showPw ? '隠す' : '表示'}</button>
            </div>
            {password.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= pwStrength ? strengthColor : 'rgba(255,255,255,0.1)', transition: 'background .25s' }} />
                  ))}
                </div>
                <p style={{ fontSize: 10, fontWeight: 600, color: strengthColor, transition: 'color .25s' }}>パスワード強度: {strengthLabel}</p>
              </div>
            )}
          </div>

          {/* パスワード確認 */}
          <div style={{ marginBottom: 6 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 7 }}>パスワード（確認）</label>
            <div className={`sr-field${pwMismatch ? ' field-error' : ''}${pwMatch ? ' field-ok' : ''}`}>
              <div style={{ paddingLeft: 14, color: pwMatch ? '#34C759' : pwMismatch ? '#FF3B30' : 'rgba(255,255,255,0.3)', flexShrink: 0, transition: 'color .18s' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="1.8" />
                  <path d="M7 11V7a5 5 0 0110 0v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </div>
              <input type={showCPw ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                placeholder="••••••••" className="sr-input" disabled={isLoading}
              />
              <div style={{ position: 'absolute', right: 40, top: '50%', transform: 'translateY(-50%)' }}>
                {pwMatch && <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="#34C759" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                {pwMismatch && <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="#FF3B30" strokeWidth="2.2" strokeLinecap="round" /></svg>}
              </div>
              <button type="button" onClick={() => setShowCPw(v => !v)}
                style={{ position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: 700 }}
              >{showCPw ? '隠す' : '表示'}</button>
            </div>
            {pwMismatch && <p style={{ fontSize: 10, color: '#FF3B30', fontWeight: 600, marginTop: 5 }}>パスワードが一致しません</p>}
            {pwMatch && <p style={{ fontSize: 10, color: '#34C759', fontWeight: 600, marginTop: 5 }}>✓ パスワードが一致しました</p>}
          </div>

          <div style={{ height: 18 }} />

          {error && (
            <div style={{ background: 'rgba(255,59,48,0.1)', border: '1px solid rgba(255,59,48,0.25)', borderRadius: 12, padding: '10px 14px', marginBottom: 14 }}>
              <p style={{ fontSize: 12, color: '#FF3B30', fontWeight: 600, textAlign: 'center' }}>{error}</p>
            </div>
          )}

          <button className={`sr-btn${success ? ' success-state' : ''}`} onClick={handleRegister} disabled={isLoading}>
            {isLoading ? <div className="sr-spinner" />
              : success ? (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <path d="M5 13l4 4L19 7" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                    <polyline points="9,22 9,12 15,12 15,22" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  店舗アカウントを作成
                </>
              )}
          </button>

          <div style={{ marginTop: 16, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>既にアカウントをお持ちの方は</span>
            <button type="button" onClick={() => router.push('/login')}
              style={{ fontSize: 13, fontWeight: 700, color: '#F2A900', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px' }}
            >ログイン →</button>
          </div>
        </div>

        {/* 店舗機能紹介 */}
        <div className="sr-appear sr-d3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 20, padding: '18px 20px', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <div style={{ width: 3, height: 14, borderRadius: 2, background: 'linear-gradient(#F2A900,#D4910A)' }} />
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)' }}>店舗向け機能</p>
          </div>
          {[
            { icon: '🏆', title: 'トーナメント管理', desc: 'エントリー・リエントリー・アドオンを自動集計' },
            { icon: '💰', title: 'チップ残高管理', desc: 'プレイヤーの購入・引き出し履歴をリアルタイムで管理' },
            { icon: '📊', title: 'ランキング', desc: '店舗内の純増ランキングを自動生成' },
            { icon: '⏱', title: 'ブラインドタイマー', desc: 'プリセット管理付きのスマートタイマー' },
          ].map((f, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < 3 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
              <div style={{ width: 36, height: 36, borderRadius: 11, background: 'rgba(242,169,0,0.1)', border: '1px solid rgba(242,169,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{f.icon}</div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.8)' }}>{f.title}</p>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* フッター */}
        <div className="sr-appear sr-d4" style={{ textAlign: 'center', marginTop: 8 }}>
          <div className="sr-divider" style={{ marginBottom: 16 }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, marginBottom: 10 }}>
            <img src="/logo.png" alt="RRPoker" style={{ width: 20, height: 20, borderRadius: 6, objectFit: 'cover', opacity: 0.6 }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.25)' }}>RRPOKER</span>
          </div>
          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>プレイヤーとして登録する場合は</p>
          <button type="button" onClick={() => router.push('/register')}
            style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'rgba(255,255,255,0.12)' }}
          >通常の新規登録はこちら</button>
        </div>
      </div>
    </div>
  )
}
