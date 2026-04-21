'use client'

import { useState, useEffect, useRef } from "react"
import { createUserWithEmailAndPassword, sendEmailVerification, GoogleAuthProvider, signInWithPopup } from "firebase/auth"
import { doc, setDoc, serverTimestamp } from "firebase/firestore"
import { auth, db } from "@/lib/firebase"
import { useRouter } from "next/navigation"
import { getAuthErrorMessage } from "src/lib/auth-error"

export default function RegisterPage() {
  const router = useRouter()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [showPw, setShowPw] = useState(false)
  const [showCPw, setShowCPw] = useState(false)
  const [success, setSuccess] = useState(false)

  const [emailFocus, setEmailFocus] = useState(false)
  const [pwFocus, setPwFocus] = useState(false)
  const [cpwFocus, setCpwFocus] = useState(false)

  const [scrollY, setScrollY] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const [orbPhase, setOrbPhase] = useState(0)
  const [step, setStep] = useState<'form' | 'sent'>('form')

  // パスワード強度
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

  const animRef = useRef<number | null>(null)

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [menuOpen])

  useEffect(() => {
    let t = 0
    const tick = () => {
      t += 0.007
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
      await setDoc(doc(db, "users", user.uid), { email: user.email, createdAt: serverTimestamp() }, { merge: true })
      await sendEmailVerification(credential.user, {
        url: "https://rrpoker.vercel.app/verify-complete",
        handleCodeInApp: true,
      })
      setSuccess(true)
      await new Promise(r => setTimeout(r, 700))
      router.replace("/verify-email")
    } catch (e: any) {
      setError(getAuthErrorMessage(e.code))
    } finally { setIsLoading(false) }
  }

  const handleGoogleRegister = async () => {
    setError(''); setGoogleLoading(true)
    try {
      const provider = new GoogleAuthProvider()
      const result = await signInWithPopup(auth, provider)
      const user = result.user
      await setDoc(doc(db, "users", user.uid), { email: user.email, createdAt: serverTimestamp() }, { merge: true })
      router.replace("/onboarding")
    } catch (e: any) {
      if (e.code === "auth/popup-blocked") { setError("ポップアップがブロックされています。"); return }
      setError(getAuthErrorMessage(e.code))
    } finally { setGoogleLoading(false) }
  }

  const orb1x = Math.sin(orbPhase * 0.7) * 28
  const orb1y = Math.cos(orbPhase * 0.5) * 18
  const orb2x = Math.cos(orbPhase * 0.6) * 22
  const orb2y = Math.sin(orbPhase * 0.8) * 16
  const orb3x = Math.sin(orbPhase * 0.4 + 1) * 18
  const orb3y = Math.cos(orbPhase * 0.9 + 2) * 20
  const headerElevated = scrollY > 8

  const strengthLabel = ['', '弱い', 'まあまあ', '強い', 'とても強い'][pwStrength]
  const strengthColor = ['', '#FF3B30', '#FF9500', '#34C759', '#30D158'][pwStrength]

  return (
    <div style={{ minHeight: '100dvh', background: '#F2F2F7', overflowX: 'hidden' }}>
      <style>{`
        :root {
          --gold:#F2A900; --gold-dk:#D4910A; --gold-lt:#FFE07A;
          --label:#1C1C1E; --label2:rgba(60,60,67,0.6); --label3:rgba(60,60,67,0.3);
          --sep:rgba(60,60,67,0.12); --fill:rgba(120,120,128,0.12);
          --green:#34C759; --red:#FF3B30;
        }
        @keyframes page-in {
          from { opacity:0; transform:translateY(22px) scale(0.97); }
          to   { opacity:1; transform:translateY(0) scale(1); }
        }
        @keyframes logo-drop {
          0%  { opacity:0; transform:scale(0.62) rotate(-7deg); }
          62% { transform:scale(1.07) rotate(2deg); }
          100%{ opacity:1; transform:scale(1) rotate(0); }
        }
        @keyframes shimmer {
          0%  { background-position:-300% center; }
          100%{ background-position:300% center; }
        }
        @keyframes spin { to{ transform:rotate(360deg); } }
        @keyframes error-shake {
          0%,100%{ transform:translateX(0); }
          20%    { transform:translateX(-6px); }
          40%    { transform:translateX(6px); }
          60%    { transform:translateX(-4px); }
          80%    { transform:translateX(4px); }
        }
        @keyframes slide-in-right {
          from{ transform:translateX(100%); }
          to  { transform:translateX(0); }
        }
        @keyframes check-draw {
          from{ stroke-dashoffset:30; }
          to  { stroke-dashoffset:0; }
        }
        @keyframes strength-grow {
          from{ transform:scaleX(0); }
          to  { transform:scaleX(1); }
        }
        @keyframes field-focus-in {
          from{ box-shadow:0 0 0 0 rgba(242,169,0,0); }
          to  { box-shadow:0 0 0 3.5px rgba(242,169,0,0.15); }
        }
        @keyframes success-bounce {
          0%  { transform:scale(0.7) rotate(-5deg); opacity:0; }
          60% { transform:scale(1.1) rotate(2deg); opacity:1; }
          100%{ transform:scale(1) rotate(0); }
        }
        @keyframes envelope-float {
          0%,100%{ transform:translateY(0) rotate(-1.5deg); }
          50%    { transform:translateY(-7px) rotate(1.5deg); }
        }

        .appear{ opacity:0; animation:page-in .55s cubic-bezier(.22,1,.36,1) forwards; }
        .d0{ animation-delay:.03s; }
        .d1{ animation-delay:.11s; }
        .d2{ animation-delay:.19s; }
        .d3{ animation-delay:.27s; }
        .d4{ animation-delay:.35s; }
        .d5{ animation-delay:.43s; }
        .d6{ animation-delay:.51s; }

        .logo-wrap{ animation:logo-drop .55s cubic-bezier(.22,1,.36,1) .05s both; }

        .shimmer-text{
          background:linear-gradient(90deg,#D4910A 0%,#F2A900 30%,#FFE07A 48%,#F2A900 66%,#D4910A 100%);
          background-size:300% auto;
          -webkit-background-clip:text; -webkit-text-fill-color:transparent;
          background-clip:text; animation:shimmer 3s linear infinite;
        }

        .ios-card{
          background:#fff; border-radius:20px;
          box-shadow:0 2px 12px rgba(0,0,0,0.065), 0 1px 2px rgba(0,0,0,0.04);
        }

        .field-wrap{
          position:relative; border-radius:14px; background:#F2F2F7;
          border:1.5px solid transparent;
          transition:border-color .18s, background .18s, box-shadow .18s; overflow:hidden;
        }
        .field-wrap.focused{
          border-color:var(--gold); background:#FFFBF5;
          box-shadow:0 0 0 3.5px rgba(242,169,0,0.15);
          animation:field-focus-in .18s ease-out;
        }
        .field-wrap.has-error{ border-color:var(--red); background:#FFF5F5; }
        .field-wrap.has-ok   { border-color:var(--green); background:#F0FFF4; }

        .field-input-bare{
          width:100%; height:50px; background:transparent;
          border:none; outline:none; padding:0 44px 0 40px;
          font-size:16px; color:var(--label); box-sizing:border-box;
        }
        .field-input-bare::placeholder{ color:var(--label3); }

        .btn-gold{
          width:100%; height:54px; border-radius:16px; border:none; cursor:pointer;
          background:linear-gradient(135deg,#F2A900 0%,#D4910A 100%);
          color:#1a1a1a; font-size:16px; font-weight:800; letter-spacing:-.2px;
          box-shadow:0 4px 18px rgba(242,169,0,0.32), 0 1px 3px rgba(0,0,0,0.08);
          display:flex; align-items:center; justify-content:center; gap:8px;
          transition:transform .13s ease, opacity .13s ease, box-shadow .13s ease;
          position:relative; overflow:hidden;
        }
        .btn-gold::before{
          content:""; position:absolute; inset:0;
          background:linear-gradient(135deg,rgba(255,255,255,0.15) 0%,transparent 60%);
          pointer-events:none;
        }
        .btn-gold:active { transform:scale(0.97); opacity:.88; }
        .btn-gold:hover  { box-shadow:0 6px 24px rgba(242,169,0,0.42); }
        .btn-gold:disabled{ opacity:.5; pointer-events:none; }
        .btn-gold.success-state{
          background:linear-gradient(135deg,#34C759,#28A745) !important;
          box-shadow:0 4px 18px rgba(52,199,89,0.35) !important;
        }

        .btn-google{
          width:100%; height:50px; border-radius:14px;
          border:1.5px solid rgba(60,60,67,0.14); background:#fff;
          display:flex; align-items:center; justify-content:center; gap:9px;
          font-size:15px; font-weight:600; color:var(--label); cursor:pointer;
          box-shadow:0 1px 4px rgba(0,0,0,0.06);
          transition:transform .13s ease, box-shadow .13s ease;
        }
        .btn-google:active { transform:scale(0.97); }
        .btn-google:disabled{ opacity:.5; pointer-events:none; }

        .header-cta{
          background:linear-gradient(135deg,#F2A900,#D4910A);
          border:none; border-radius:20px; padding:7px 14px;
          color:white; font-size:13px; font-weight:700; cursor:pointer;
          box-shadow:0 2px 8px rgba(242,169,0,0.28); white-space:nowrap;
          display:flex; align-items:center; gap:4px;
          transition:transform .12s, opacity .12s;
        }
        .header-cta:active{ transform:scale(0.95); opacity:.85; }

        .error-box{
          border-radius:12px; padding:10px 14px;
          background:rgba(255,59,48,0.06); border:1px solid rgba(255,59,48,0.2);
          animation:error-shake .35s ease-out;
        }
        .spinner{
          width:20px; height:20px; border-radius:50%;
          border:2.5px solid rgba(26,26,26,0.18); border-top-color:#1a1a1a;
          animation:spin .65s linear infinite;
        }
        .spinner-dark{
          width:20px; height:20px; border-radius:50%;
          border:2.5px solid rgba(60,60,60,0.18); border-top-color:#555;
          animation:spin .65s linear infinite;
        }
        .check-path{ stroke-dasharray:30; stroke-dashoffset:30; animation:check-draw .3s ease-out .05s forwards; }
        .drawer{ animation:slide-in-right .27s cubic-bezier(.22,1,.36,1); }
        .divider-line{ height:1px; background:var(--sep); }
        .section-hd{ font-size:11px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:var(--label2); }
        .strength-bar-fill{ transform-origin:left; animation:strength-grow .25s ease-out forwards; }
        button{ -webkit-tap-highlight-color:transparent; }
      `}</style>

      {/* ── Ambient Orbs ── */}
      <div style={{ position:'fixed', inset:0, zIndex:0, overflow:'hidden', pointerEvents:'none' }}>
        <div style={{ position:'absolute', top:`calc(8% + ${orb1y}px)`, right:`calc(5% + ${orb1x}px)`, width:260, height:260, borderRadius:'50%', background:'radial-gradient(circle,rgba(242,169,0,0.11) 0%,transparent 70%)' }}/>
        <div style={{ position:'absolute', bottom:`calc(15% + ${orb2y}px)`, left:`calc(2% + ${orb2x}px)`, width:200, height:200, borderRadius:'50%', background:'radial-gradient(circle,rgba(242,169,0,0.07) 0%,transparent 70%)' }}/>
        <div style={{ position:'absolute', top:`calc(50% + ${orb3y}px)`, left:`calc(38% + ${orb3x}px)`, width:150, height:150, borderRadius:'50%', background:'radial-gradient(circle,rgba(242,169,0,0.06) 0%,transparent 70%)' }}/>
      </div>

      {/* ── Header ── */}
      <header className="sticky top-0 z-50 border-b"
        style={{ background:headerElevated?'rgba(255,255,255,0.96)':'rgba(255,255,255,0.88)', backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)', borderBottomColor:headerElevated?'rgba(60,60,67,0.12)':'rgba(60,60,67,0.05)', transition:'background .2s, border-color .2s', position:'relative', zIndex:50 }}
      >
        <div style={{ maxWidth:480, margin:'0 auto', padding:'0 20px', minHeight:64, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <button type="button" onClick={() => router.push('/')}
            style={{ display:'flex', alignItems:'center', gap:0, background:'none', border:'none', cursor:'pointer', padding:0 }}
          >
            <img src="/logo.png" alt="RRPoker" style={{ height:60, width:60 }}/>
            <span style={{ fontSize:18, fontWeight:700, color:'#1C1C1E', letterSpacing:'-0.2px' }}>RRPOKER</span>
          </button>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
           
          </div>
        </div>
      </header>

      {/* ドロワー */}
      {menuOpen && <div className="fixed inset-0 z-[999]" style={{ background:'rgba(0,0,0,0.3)', backdropFilter:'blur(3px)' }} onClick={() => setMenuOpen(false)}/>}
      <aside className={menuOpen?'drawer':''} style={{ position:'fixed', right:0, top:0, zIndex:1000, height:'100dvh', width:'80%', maxWidth:340, background:'white', borderLeft:'1px solid rgba(60,60,67,0.1)', boxShadow:'-8px 0 32px rgba(0,0,0,0.12)', transform:menuOpen?'translateX(0)':'translateX(100%)', transition:menuOpen?'none':'transform .25s cubic-bezier(.22,1,.36,1)', display:'flex', flexDirection:'column' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px', borderBottom:'1px solid rgba(60,60,67,0.08)' }}>
          <p style={{ fontSize:14, fontWeight:700, color:'var(--label)' }}>メニュー</p>
          <button onClick={() => setMenuOpen(false)} style={{ fontSize:13, color:'var(--label2)', background:'none', border:'none', cursor:'pointer', padding:'4px 8px' }}>閉じる</button>
        </div>
        <div style={{ padding:'16px 20px', display:'flex', flexDirection:'column', gap:10 }}>
          {[
            { label:'ログインはこちら', action:() => { setMenuOpen(false); router.push('/login') }, gold:false },
            { label:'新規登録', action:() => setMenuOpen(false), gold:true },
            { label:'パスワードを忘れた方', action:() => { setMenuOpen(false); router.push('/forgot-password') }, gold:false },
          ].map(item => (
            <button key={item.label} onClick={item.action}
              style={{ width:'100%', borderRadius:14, border:item.gold?'1.5px solid rgba(242,169,0,0.4)':'1px solid rgba(60,60,67,0.12)', background:item.gold?'rgba(242,169,0,0.06)':'none', padding:'13px 16px', textAlign:'left', fontSize:14, fontWeight:600, color:item.gold?'#D4910A':'var(--label)', cursor:'pointer' }}
            >{item.label}</button>
          ))}
        </div>
      </aside>

      {/* ── Main ── */}
      <div style={{ position:'relative', zIndex:1, maxWidth:480, margin:'0 auto', padding:'0 20px 60px' }}>

        {/* ── ロゴヒーロー ── */}
        <div style={{ paddingTop:40, paddingBottom:24, textAlign:'center' }}>
          <div className="logo-wrap" style={{ display:'inline-block', marginBottom:16 }}>
            <div style={{ position:'relative', display:'inline-block' }}>
              <div style={{ position:'absolute', inset:-12, borderRadius:30, background:'radial-gradient(circle,rgba(242,169,0,0.2) 0%,transparent 70%)', filter:'blur(8px)' }}/>
              <img src="/logo.png" alt="RRPoker"
                style={{ width:76, height:76, borderRadius:22, objectFit:'cover', position:'relative', zIndex:1, boxShadow:'0 8px 28px rgba(242,169,0,0.28), 0 2px 8px rgba(0,0,0,0.1)', display:'block' }}
              />
            </div>
          </div>
          <div className="appear d0">
            <h1 style={{ fontSize:28, fontWeight:900, letterSpacing:'-0.6px', color:'var(--label)', lineHeight:1.2, marginBottom:5 }}>
              <span className="shimmer-text">RRPoker</span>
            </h1>
            <p style={{ fontSize:14, color:'var(--label2)', lineHeight:1.65 }}>
              アカウントを作成して<br/>ポーカーライフをスタートしましょう。
            </p>
          </div>

          {/* ステップインジケーター */}
          <div className="appear d1" style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, marginTop:14 }}>
            {[
              { n:'1', t:'アカウント作成', active:true },
              { n:'→', t:'', active:false, arrow:true },
              { n:'2', t:'メール認証', active:false },
              { n:'→', t:'', active:false, arrow:true },
              { n:'3', t:'プロフィール設定', active:false },
            ].map((s, i) => s.arrow ? (
              <span key={i} style={{ fontSize:11, color:'var(--label3)', fontWeight:600 }}>→</span>
            ) : (
              <div key={i} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
                <div style={{ width:26, height:26, borderRadius:'50%', background:s.active?'linear-gradient(135deg,#F2A900,#D4910A)':'var(--fill)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:800, color:s.active?'white':'var(--label3)', boxShadow:s.active?'0 2px 8px rgba(242,169,0,0.35)':'none' }}>{s.n}</div>
                <span style={{ fontSize:9, fontWeight:600, color:s.active?'var(--gold-dk)':'var(--label3)', whiteSpace:'nowrap' }}>{s.t}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── 登録フォーム ── */}
        <div id="form-anchor" className="appear d2 ios-card" style={{ overflow:'hidden' }}>
          <div style={{ height:3, background:'linear-gradient(90deg,#F2A900,#FFE07A,#F2A900)', backgroundSize:'200% auto', animation:'shimmer 3.2s linear infinite' }}/>

          <div style={{ padding:'22px 20px 24px' }}>
            <div style={{ marginBottom:20 }}>
              <p style={{ fontSize:20, fontWeight:800, color:'var(--label)', letterSpacing:'-0.4px', marginBottom:3 }}>新規登録</p>
              <p style={{ fontSize:12, color:'var(--label2)' }}>無料アカウントを作成してください</p>
            </div>

            {/* Google */}
            <button className="btn-google" onClick={handleGoogleRegister} disabled={isLoading || googleLoading}>
              {googleLoading
                ? <div className="spinner-dark"/>
                : <svg width="19" height="19" viewBox="0 0 20 20" fill="none">
                    <path d="M19.6 10.23c0-.68-.06-1.36-.18-2.02H10v3.83h5.44c-.23 1.23-.93 2.27-1.98 2.96v2.46h3.2c1.87-1.73 2.94-4.28 2.94-7.23z" fill="#4285F4"/>
                    <path d="M10 20c2.7 0 4.97-.9 6.63-2.44l-3.2-2.46c-.89.6-2.03.96-3.43.96-2.63 0-4.86-1.77-5.66-4.15H1.01v2.6C2.67 17.98 6.08 20 10 20z" fill="#34A853"/>
                    <path d="M4.34 11.91A5.99 5.99 0 0 1 4 10c0-.66.11-1.3.3-1.91V5.49H1.01A9.99 9.99 0 0 0 0 10c0 1.65.4 3.21 1.01 4.51l3.33-2.6z" fill="#FBBC05"/>
                    <path d="M10 4.04c1.47 0 2.79.51 3.83 1.51l2.87-2.87C14.97 1.1 12.7 0 10 0 6.08 0 2.67 2.02 1.01 5.49l3.29 2.6C5.14 5.81 7.37 4.04 10 4.04z" fill="#EA4335"/>
                  </svg>
              }
              <span style={{ fontSize:15, fontWeight:600 }}>{googleLoading ? '処理中…' : 'Googleで新規登録'}</span>
            </button>

            <div style={{ display:'flex', alignItems:'center', gap:10, margin:'16px 0' }}>
              <div className="divider-line" style={{ flex:1 }}/>
              <span style={{ fontSize:11, fontWeight:600, color:'var(--label3)', letterSpacing:'0.03em' }}>またはメールで</span>
              <div className="divider-line" style={{ flex:1 }}/>
            </div>

            {/* メール */}
            <div style={{ marginBottom:10 }}>
              <label style={{ display:'block', fontSize:11, fontWeight:700, color:'var(--label2)', letterSpacing:'0.03em', marginBottom:6, textTransform:'uppercase' }}>メールアドレス</label>
              <div className={`field-wrap${emailFocus?' focused':''}`}>
                <div style={{ position:'absolute', left:13, top:'50%', transform:'translateY(-50%)', color:emailFocus?'var(--gold)':'var(--label3)', transition:'color .18s' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                    <polyline points="22,6 12,13 2,6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
                </div>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  onFocus={() => setEmailFocus(true)} onBlur={() => setEmailFocus(false)}
                  placeholder="name@example.com" className="field-input-bare" disabled={isLoading}
                />
              </div>
              {/* iCloud警告 */}
              {email.includes('icloud') && (
                <p style={{ fontSize:10, color:'#FF9500', fontWeight:600, marginTop:5, display:'flex', alignItems:'center', gap:4 }}>
                  <span>⚠️</span> iCloudメールは確認メールが届かない場合があります
                </p>
              )}
            </div>

            {/* パスワード */}
            <div style={{ marginBottom:10 }}>
              <label style={{ display:'block', fontSize:11, fontWeight:700, color:'var(--label2)', letterSpacing:'0.03em', marginBottom:6, textTransform:'uppercase' }}>パスワード</label>
              <div className={`field-wrap${pwFocus?' focused':''}`}>
                <div style={{ position:'absolute', left:13, top:'50%', transform:'translateY(-50%)', color:pwFocus?'var(--gold)':'var(--label3)', transition:'color .18s' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="1.8"/>
                    <path d="M7 11V7a5 5 0 0110 0v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
                </div>
                <input type={showPw?'text':'password'} value={password} onChange={e => setPassword(e.target.value)}
                  onFocus={() => setPwFocus(true)} onBlur={() => setPwFocus(false)}
                  placeholder="6文字以上" className="field-input-bare" disabled={isLoading}
                />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  style={{ position:'absolute', right:13, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:pwFocus?'var(--gold-dk)':'var(--label3)', fontSize:11, fontWeight:700, transition:'color .18s' }}
                >{showPw?'隠す':'表示'}</button>
              </div>

              {/* パスワード強度バー */}
              {password.length > 0 && (
                <div style={{ marginTop:7 }}>
                  <div style={{ display:'flex', gap:4, marginBottom:4 }}>
                    {[1,2,3,4].map(i => (
                      <div key={i} style={{ flex:1, height:3, borderRadius:2, background:i<=pwStrength?strengthColor:'var(--sep)', transition:'background .25s' }}/>
                    ))}
                  </div>
                  <p style={{ fontSize:10, fontWeight:600, color:strengthColor, transition:'color .25s' }}>
                    パスワード強度: {strengthLabel}
                  </p>
                </div>
              )}
            </div>

            {/* パスワード確認 */}
            <div style={{ marginBottom:6 }}>
              <label style={{ display:'block', fontSize:11, fontWeight:700, color:'var(--label2)', letterSpacing:'0.03em', marginBottom:6, textTransform:'uppercase' }}>パスワード（確認）</label>
              <div className={`field-wrap${cpwFocus?' focused':''}${pwMismatch?' has-error':''}${pwMatch?' has-ok':''}`}>
                <div style={{ position:'absolute', left:13, top:'50%', transform:'translateY(-50%)', color:cpwFocus?'var(--gold)':pwMatch?'var(--green)':pwMismatch?'var(--red)':'var(--label3)', transition:'color .18s' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="1.8"/>
                    <path d="M7 11V7a5 5 0 0110 0v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
                </div>
                <input type={showCPw?'text':'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                  onFocus={() => setCpwFocus(true)} onBlur={() => setCpwFocus(false)}
                  placeholder="••••••••" className="field-input-bare" disabled={isLoading}
                />
                {/* 一致/不一致インジケーター */}
                <div style={{ position:'absolute', right:36, top:'50%', transform:'translateY(-50%)' }}>
                  {pwMatch && <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="#34C759" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  {pwMismatch && <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="#FF3B30" strokeWidth="2.2" strokeLinecap="round"/></svg>}
                </div>
                <button type="button" onClick={() => setShowCPw(v => !v)}
                  style={{ position:'absolute', right:13, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:cpwFocus?'var(--gold-dk)':'var(--label3)', fontSize:11, fontWeight:700, transition:'color .18s' }}
                >{showCPw?'隠す':'表示'}</button>
              </div>
              {pwMismatch && <p style={{ fontSize:10, color:'var(--red)', fontWeight:600, marginTop:4 }}>パスワードが一致しません</p>}
              {pwMatch && <p style={{ fontSize:10, color:'var(--green)', fontWeight:600, marginTop:4 }}>✓ パスワードが一致しました</p>}
            </div>

            <div style={{ height:12 }}/>

            {/* エラー */}
            {error && (
              <div className="error-box" style={{ marginBottom:14 }}>
                <p style={{ fontSize:12, color:'var(--red)', fontWeight:600, textAlign:'center' }}>{error}</p>
              </div>
            )}

            {/* 登録ボタン */}
            <button className={`btn-gold${success?' success-state':''}`} onClick={handleRegister} disabled={isLoading || googleLoading}>
              {isLoading ? <div className="spinner"/>
              : success ? (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <path d="M5 13l4 4L19 7" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="check-path"/>
                </svg>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8zM19 8v6M22 11h-6" stroke="#1a1a1a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  アカウントを作成
                </>
              )}
            </button>

            {/* ログインへ */}
            <div style={{ marginTop:14, textAlign:'center', display:'flex', alignItems:'center', justifyContent:'center', gap:4 }}>
              <span style={{ fontSize:13, color:'var(--label2)' }}>すでにアカウントをお持ちの方は</span>
              <button type="button" onClick={() => router.push('/login')}
                style={{ fontSize:13, fontWeight:700, color:'var(--gold-dk)', background:'none', border:'none', cursor:'pointer', padding:'0 2px' }}
              >ログイン →</button>
            </div>
          </div>
        </div>

        {/* ── iCloud注意書き（カード外） ── */}
        <div className="appear d4" style={{ marginTop:12 }}>
          <div style={{ borderRadius:14, padding:'12px 14px', background:'rgba(255,149,0,0.07)', border:'1px solid rgba(255,149,0,0.2)', display:'flex', alignItems:'flex-start', gap:8 }}>
            <span style={{ fontSize:16, flexShrink:0, marginTop:1 }}>⚠️</span>
            <p style={{ fontSize:12, color:'#A05000', fontWeight:500, lineHeight:1.6 }}>
              <strong>iCloudメールは確認メールが届かない場合があります。</strong><br/>
              Gmailなどのメールアドレスのご利用を推奨します。
            </p>
          </div>
        </div>

        {/* ── フッター ── */}
        <div className="appear d6" style={{ marginTop:24, textAlign:'center' }}>
          <div className="divider-line" style={{ marginBottom:16 }}/>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:7, marginBottom:9 }}>
            <img src="/logo.png" alt="RRPoker" style={{ width:24, height:24, borderRadius:7, objectFit:'cover' }}/>
            <span style={{ fontSize:12, fontWeight:700, color:'var(--label2)' }}>RRPOKER</span>
          </div>
          <p style={{ fontSize:10, color:'var(--label3)', marginBottom:2 }}>ver 1.4.7</p>
          <p style={{ fontSize:10, color:'var(--label3)', marginBottom:2 }}>RRPoker by Runner Runner</p>
          <p style={{ fontSize:10, color:'var(--label3)' }}>協力者 : ゆうた / まいさん</p>
        </div>
      </div>
    </div>
  )
}