'use client'

import { useState, useEffect, useRef } from "react"
import { signInWithEmailAndPassword } from "firebase/auth"
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore"
import { auth, db } from "@/lib/firebase"
import { useRouter } from "next/navigation"
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth"
import { useSearchParams } from "next/navigation"

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get("redirect")

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isUnverified, setIsUnverified] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [showPw, setShowPw] = useState(false)
  const [emailFocus, setEmailFocus] = useState(false)
  const [pwFocus, setPwFocus] = useState(false)
  const [success, setSuccess] = useState(false)
  const [scrollY, setScrollY] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const [orbPhase, setOrbPhase] = useState(0)
  

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

  // ── Orb ambient animation ──
  useEffect(() => {
    let t = 0
    const tick = () => {
      t += 0.008
      setOrbPhase(t)
      animRef.current = requestAnimationFrame(tick)
    }
    animRef.current = requestAnimationFrame(tick)
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current) }
  }, [])

  const handleLogin = async () => {
    if (!email || !password) { setError('メールアドレスとパスワードを入力してください'); return }
    setError(''); setLoading(true)
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password)
      const user = credential.user
      if (redirect === "delete") { router.replace("/home/mypage?delete=1"); return }
      if (!user.emailVerified) { setIsUnverified(true); setError("メール認証が完了していません"); setLoading(false); return }
      const snap = await getDoc(doc(db, "users", user.uid))
      setSuccess(true)
      await new Promise(r => setTimeout(r, 600))
      if (!snap.exists()) { router.replace("/onboarding"); return }
      const role = snap.data()?.role
      if (role === "player") { router.replace("/home"); return }
      if (role === "store") { router.replace("/home/store"); return }
      router.replace("/onboarding")
    } catch {
      setError("メールまたはパスワードが違います")
    } finally { setLoading(false) }
  }

  const handleGoogleLogin = async () => {
    setError(''); setGoogleLoading(true)
    try {
      const provider = new GoogleAuthProvider()
      const result = await signInWithPopup(auth, provider)
      const user = result.user
      if (redirect === "delete") { router.replace("/home/mypage?delete=1"); return }
      const snap = await getDoc(doc(db, "users", user.uid))
      if (!snap.exists()) {
        await setDoc(doc(db, "users", user.uid), { email: user.email, createdAt: serverTimestamp(), provider: "google" }, { merge: true })
        router.replace("/onboarding"); return
      }
      const role = snap.data()?.role
      if (role === "player") { router.replace("/home"); return }
      if (role === "store") { router.replace("/home/store"); return }
      router.replace("/onboarding")
    } catch (e: any) {
      if (e.code === "auth/popup-blocked") { setError("ポップアップがブロックされています。ブラウザの設定をご確認ください。"); return }
      if (e.code === "auth/network-request-failed") { setError("ネットワークエラーが発生しました。"); return }
      setError("Googleログインに失敗しました")
    } finally { setGoogleLoading(false) }
  }

  // ── Ambient orb positions ──
  const orb1x = Math.sin(orbPhase * 0.7) * 30
  const orb1y = Math.cos(orbPhase * 0.5) * 20
  const orb2x = Math.cos(orbPhase * 0.6) * 25
  const orb2y = Math.sin(orbPhase * 0.8) * 18
  const orb3x = Math.sin(orbPhase * 0.4 + 1) * 20
  const orb3y = Math.cos(orbPhase * 0.9 + 2) * 22

  const headerElevated = scrollY > 8

  return (
    <div style={{ minHeight: '100dvh', background: '#F2F2F7', overflowX: 'hidden' }}>
      <style>{`
        :root {
          --gold:#F2A900; --gold-dk:#D4910A; --gold-lt:#FFE07A;
          --label:#1C1C1E; --label2:rgba(60,60,67,0.6); --label3:rgba(60,60,67,0.3);
          --sep:rgba(60,60,67,0.12); --fill:rgba(120,120,128,0.12);
          --green:#34C759; --red:#FF3B30;
        }

        /* ── Keyframes ── */
        @keyframes page-in {
          from { opacity:0; transform:translateY(24px) scale(0.98); }
          to   { opacity:1; transform:translateY(0) scale(1); }
        }
        @keyframes logo-drop {
          0%   { opacity:0; transform:scale(0.6) rotate(-8deg); }
          60%  { transform:scale(1.08) rotate(2deg); }
          100% { opacity:1; transform:scale(1) rotate(0); }
        }
        @keyframes shimmer {
          0%   { background-position:-300% center; }
          100% { background-position:300% center; }
        }
        @keyframes spin {
          to { transform:rotate(360deg); }
        }
        @keyframes success-pop {
          0%   { transform:scale(0.6); opacity:0; }
          60%  { transform:scale(1.15); }
          100% { transform:scale(1); opacity:1; }
        }
        @keyframes field-focus-in {
          from { box-shadow:0 0 0 0 rgba(242,169,0,0); }
          to   { box-shadow:0 0 0 3.5px rgba(242,169,0,0.18); }
        }
        @keyframes error-shake {
          0%,100% { transform:translateX(0); }
          20%     { transform:translateX(-6px); }
          40%     { transform:translateX(6px); }
          60%     { transform:translateX(-4px); }
          80%     { transform:translateX(4px); }
        }
        @keyframes slide-in-right {
          from { transform:translateX(100%); }
          to   { transform:translateX(0); }
        }
        @keyframes fade-up-sm {
          from { opacity:0; transform:translateY(8px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes check-draw {
          from { stroke-dashoffset:30; }
          to   { stroke-dashoffset:0; }
        }
        @keyframes card-float {
          0%,100% { transform:translateY(0) rotate(-1deg); }
          50%      { transform:translateY(-6px) rotate(1deg); }
        }

        /* ── Delay helpers ── */
        .appear { opacity:0; animation:page-in .55s cubic-bezier(.22,1,.36,1) forwards; }
        .d0 { animation-delay:.02s; }
        .d1 { animation-delay:.10s; }
        .d2 { animation-delay:.18s; }
        .d3 { animation-delay:.26s; }
        .d4 { animation-delay:.34s; }
        .d5 { animation-delay:.42s; }
        .d6 { animation-delay:.50s; }

        /* ── Logo ── */
        .logo-wrap { animation:logo-drop .55s cubic-bezier(.22,1,.36,1) .06s both; }

        /* ── Shimmer text ── */
        .shimmer-text {
          background: linear-gradient(90deg,#D4910A 0%,#F2A900 30%,#FFE07A 48%,#F2A900 66%,#D4910A 100%);
          background-size:300% auto;
          -webkit-background-clip:text; -webkit-text-fill-color:transparent;
          background-clip:text; animation:shimmer 3s linear infinite;
        }

        /* ── Cards ── */
        .ios-card {
          background:#fff; border-radius:20px;
          box-shadow:0 2px 12px rgba(0,0,0,0.065), 0 1px 2px rgba(0,0,0,0.04);
        }

        /* ── Form fields ── */
        .field-wrap {
          position:relative; border-radius:14px;
          background:#F2F2F7;
          border:1.5px solid transparent;
          transition:border-color .18s, background .18s, box-shadow .18s;
          overflow:hidden;
        }
        .field-wrap.focused {
          border-color:var(--gold);
          background:#FFFBF5;
          box-shadow:0 0 0 3.5px rgba(242,169,0,0.15);
          animation:field-focus-in .18s ease-out;
        }
        .field-wrap.has-error { border-color:var(--red); background:#FFF5F5; }
        .field-input-bare {
          width:100%; height:50px; background:transparent;
          border:none; outline:none; padding:0 44px 0 16px;
          font-size:16px; color:var(--label); box-sizing:border-box;
        }
        .field-input-bare::placeholder { color:var(--label3); }

        /* ── Primary button ── */
        .btn-gold {
          width:100%; height:54px; border-radius:16px; border:none; cursor:pointer;
          background:linear-gradient(135deg,#F2A900 0%,#D4910A 100%);
          color:#1a1a1a; font-size:16px; font-weight:800; letter-spacing:-.2px;
          box-shadow:0 4px 18px rgba(242,169,0,0.32), 0 1px 3px rgba(0,0,0,0.08);
          display:flex; align-items:center; justify-content:center; gap:8px;
          transition:transform .13s ease, opacity .13s ease, box-shadow .13s ease;
          position:relative; overflow:hidden;
        }
        .btn-gold::before {
          content:"";
          position:absolute; inset:0;
          background:linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 60%);
          pointer-events:none;
        }
        .btn-gold:active  { transform:scale(0.97); opacity:.88; }
        .btn-gold:hover   { box-shadow:0 6px 24px rgba(242,169,0,0.42); }
        .btn-gold:disabled{ opacity:.5; pointer-events:none; }
        .btn-gold.success-state {
          background:linear-gradient(135deg,#34C759,#28A745) !important;
          box-shadow:0 4px 18px rgba(52,199,89,0.35) !important;
        }

        /* ── Google button ── */
        .btn-google {
          width:100%; height:50px; border-radius:14px;
          border:1.5px solid rgba(60,60,67,0.14); background:#fff;
          display:flex; align-items:center; justify-content:center; gap:9px;
          font-size:15px; font-weight:600; color:var(--label); cursor:pointer;
          box-shadow:0 1px 4px rgba(0,0,0,0.06);
          transition:transform .13s ease, box-shadow .13s ease, border-color .13s;
        }
        .btn-google:hover  { border-color:rgba(60,60,67,0.25); box-shadow:0 2px 8px rgba(0,0,0,0.08); }
        .btn-google:active { transform:scale(0.97); }
        .btn-google:disabled { opacity:.5; pointer-events:none; }

        /* ── Header CTA ── */
        .header-cta {
          background:linear-gradient(135deg,#F2A900,#D4910A);
          border:none; border-radius:20px; padding:7px 14px;
          color:white; font-size:13px; font-weight:700; cursor:pointer;
          box-shadow:0 2px 8px rgba(242,169,0,0.28);
          white-space:nowrap; display:flex; align-items:center; gap:4px;
          transition:transform .12s, opacity .12s;
        }
        .header-cta:active { transform:scale(0.95); opacity:.85; }

        /* ── Error ── */
        .error-box {
          border-radius:12px; padding:10px 14px;
          background:rgba(255,59,48,0.06); border:1px solid rgba(255,59,48,0.2);
          animation:error-shake .35s ease-out;
        }

        /* ── Spinner ── */
        .spinner {
          width:20px; height:20px; border-radius:50%;
          border:2.5px solid rgba(26,26,26,0.18);
          border-top-color:#1a1a1a;
          animation:spin .65s linear infinite;
        }
        .spinner-white {
          width:20px; height:20px; border-radius:50%;
          border:2.5px solid rgba(255,255,255,0.25);
          border-top-color:white;
          animation:spin .65s linear infinite;
        }

        /* ── Success check ── */
        .check-path {
          stroke-dasharray:30; stroke-dashoffset:30;
          animation:check-draw .3s ease-out .05s forwards;
        }

        /* ── Drawer ── */
        .drawer { animation:slide-in-right .27s cubic-bezier(.22,1,.36,1); }

        /* ── Feature badge ── */
        .feat-badge {
          display:inline-flex; align-items:center; gap:5px;
          border-radius:99px; padding:5px 10px;
          font-size:11px; font-weight:700; white-space:nowrap;
        }

        /* ── Divider ── */
        .divider-line { height:1px; background:var(--sep); }

        /* ── Section label ── */
        .section-hd {
          font-size:11px; font-weight:700; letter-spacing:.06em;
          text-transform:uppercase; color:var(--label2);
        }

        button { -webkit-tap-highlight-color:transparent; }
      `}</style>

      {/* ════════════════════════════════════
          AMBIENT BACKGROUND ORBS
      ════════════════════════════════════ */}
      <div style={{ position:'fixed', inset:0, zIndex:0, overflow:'hidden', pointerEvents:'none' }}>
        <div style={{ position:'absolute', top:`calc(8% + ${orb1y}px)`, right:`calc(5% + ${orb1x}px)`, width:280, height:280, borderRadius:'50%', background:'radial-gradient(circle,rgba(242,169,0,0.11) 0%,transparent 70%)', transition:'transform .1s linear' }}/>
        <div style={{ position:'absolute', bottom:`calc(15% + ${orb2y}px)`, left:`calc(2% + ${orb2x}px)`, width:220, height:220, borderRadius:'50%', background:'radial-gradient(circle,rgba(242,169,0,0.07) 0%,transparent 70%)' }}/>
        <div style={{ position:'absolute', top:`calc(45% + ${orb3y}px)`, left:`calc(40% + ${orb3x}px)`, width:160, height:160, borderRadius:'50%', background:'radial-gradient(circle,rgba(242,169,0,0.06) 0%,transparent 70%)' }}/>
      </div>

      {/* ════════════════════════════════════
          HEADER（HomeHeader完全準拠）
      ════════════════════════════════════ */}
      <header
        className="sticky top-0 z-50 border-b"
        style={{
          background: headerElevated ? 'rgba(255,255,255,0.96)' : 'rgba(255,255,255,0.88)',
          backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)',
          borderBottomColor: headerElevated ? 'rgba(60,60,67,0.12)' : 'rgba(60,60,67,0.05)',
          transition:'background .2s, border-color .2s',
          position:'relative', zIndex:50,
        }}
      >
        <div style={{ maxWidth:480, margin:'0 auto', padding:'0 20px', minHeight:64, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          {/* ロゴ */}
          <button type="button" onClick={() => router.push('/')}
            style={{ display:'flex', alignItems:'center', gap:0, background:'none', border:'none', cursor:'pointer', padding:0 }}
          >
            <img src="/logo.png" alt="RRPoker" style={{ height:60, width:60 }}/>
            <span style={{ fontSize:18, fontWeight:700, color:'#1C1C1E', letterSpacing:'-0.2px' }}>RRPOKER</span>
          </button>

          {/* 右 */}
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
           
          
          </div>
        </div>
      </header>

      {/* ドロワー */}
      {menuOpen && <div className="fixed inset-0 z-[999]" style={{ background:'rgba(0,0,0,0.3)', backdropFilter:'blur(3px)' }} onClick={() => setMenuOpen(false)}/>}
      <aside
        className={menuOpen ? 'drawer' : ''}
        style={{ position:'fixed', right:0, top:0, zIndex:1000, height:'100dvh', width:'80%', maxWidth:340, background:'white', borderLeft:'1px solid rgba(60,60,67,0.1)', boxShadow:'-8px 0 32px rgba(0,0,0,0.12)', transform:menuOpen?'translateX(0)':'translateX(100%)', transition:menuOpen?'none':'transform .25s cubic-bezier(.22,1,.36,1)', display:'flex', flexDirection:'column' }}
      >
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px', borderBottom:'1px solid rgba(60,60,67,0.08)' }}>
          <p style={{ fontSize:14, fontWeight:700, color:'var(--label)' }}>メニュー</p>
          <button onClick={() => setMenuOpen(false)} style={{ fontSize:13, color:'var(--label2)', background:'none', border:'none', cursor:'pointer', padding:'4px 8px' }}>閉じる</button>
        </div>
        <div style={{ padding:'16px 20px', display:'flex', flexDirection:'column', gap:10 }}>
          {[
            { label:'ログイン', action:() => { setMenuOpen(false); document.getElementById('form-anchor')?.scrollIntoView({ behavior:'smooth' }) }, gold:true },
            { label:'新規登録はこちら', action:() => { setMenuOpen(false); router.push('/register') }, gold:false },
            { label:'パスワードを忘れた方', action:() => { setMenuOpen(false); router.push('/forgot-password') }, gold:false },
          ].map(item => (
            <button key={item.label} onClick={item.action}
              style={{ width:'100%', borderRadius:14, border:item.gold?'1.5px solid rgba(242,169,0,0.4)':'1px solid rgba(60,60,67,0.12)', background:item.gold?'rgba(242,169,0,0.06)':'none', padding:'13px 16px', textAlign:'left', fontSize:14, fontWeight:600, color:item.gold?'#D4910A':'var(--label)', cursor:'pointer' }}
            >{item.label}</button>
          ))}
        </div>
      </aside>

      {/* ════════════════════════════════════
          MAIN CONTENT
      ════════════════════════════════════ */}
      <div style={{ position:'relative', zIndex:1, maxWidth:480, margin:'0 auto', padding:'0 20px 60px' }}>

        {/* ── ロゴヒーロー ── */}
        <div style={{ paddingTop:44, paddingBottom:28, textAlign:'center' }}>
          <div className="logo-wrap" style={{ display:'inline-block', marginBottom:18 }}>
            <div style={{ position:'relative', display:'inline-block' }}>
              {/* グロー */}
              <div style={{ position:'absolute', inset:-12, borderRadius:30, background:'radial-gradient(circle,rgba(242,169,0,0.2) 0%,transparent 70%)', filter:'blur(8px)' }}/>
              <img src="/logo.png" alt="RRPoker"
                style={{ width:80, height:80, borderRadius:24, objectFit:'cover', position:'relative', zIndex:1, boxShadow:'0 8px 28px rgba(242,169,0,0.28), 0 2px 8px rgba(0,0,0,0.1)', display:'block' }}
              />
            </div>
          </div>

          <div className="appear d0">
            <h1 style={{ fontSize:30, fontWeight:900, letterSpacing:'-0.6px', color:'var(--label)', lineHeight:1.2, marginBottom:6 }}>
              <span className="shimmer-text">RRPoker</span>
            </h1>
            <p style={{ fontSize:14, color:'var(--label2)', lineHeight:1.6 }}>
              ポーカーライフをもっとスマートに。<br/>ログインして始めましょう。
            </p>
          </div>

         
        </div>

        {/* ── ログインフォーム ── */}
        <div id="form-anchor" className="appear d2 ios-card" style={{ overflow:'hidden' }}>
          {/* アクセントバー */}
          <div style={{ height:3, background:'linear-gradient(90deg,#F2A900,#FFE07A,#F2A900)', backgroundSize:'200% auto', animation:'shimmer 3.2s linear infinite' }}/>

          <div style={{ padding:'22px 20px 24px' }}>

            {/* タイトル */}
            <div style={{ marginBottom:20 }}>
              <p style={{ fontSize:20, fontWeight:800, color:'var(--label)', letterSpacing:'-0.4px', marginBottom:3 }}>ログイン</p>
              <p style={{ fontSize:12, color:'var(--label2)' }}>アカウントにサインインしてください</p>
            </div>

            {/* Google（最上部） */}
            <button className="btn-google" onClick={handleGoogleLogin} disabled={loading || googleLoading}>
              {googleLoading
                ? <div className="spinner-white" style={{ borderTopColor:'#555' }}/>
                : <svg width="19" height="19" viewBox="0 0 20 20" fill="none">
                    <path d="M19.6 10.23c0-.68-.06-1.36-.18-2.02H10v3.83h5.44c-.23 1.23-.93 2.27-1.98 2.96v2.46h3.2c1.87-1.73 2.94-4.28 2.94-7.23z" fill="#4285F4"/>
                    <path d="M10 20c2.7 0 4.97-.9 6.63-2.44l-3.2-2.46c-.89.6-2.03.96-3.43.96-2.63 0-4.86-1.77-5.66-4.15H1.01v2.6C2.67 17.98 6.08 20 10 20z" fill="#34A853"/>
                    <path d="M4.34 11.91A5.99 5.99 0 0 1 4 10c0-.66.11-1.3.3-1.91V5.49H1.01A9.99 9.99 0 0 0 0 10c0 1.65.4 3.21 1.01 4.51l3.33-2.6z" fill="#FBBC05"/>
                    <path d="M10 4.04c1.47 0 2.79.51 3.83 1.51l2.87-2.87C14.97 1.1 12.7 0 10 0 6.08 0 2.67 2.02 1.01 5.49l3.29 2.6C5.14 5.81 7.37 4.04 10 4.04z" fill="#EA4335"/>
                  </svg>
              }
              <span style={{ fontSize:15, fontWeight:600 }}>{googleLoading ? '認証中…' : 'Googleでサインイン'}</span>
            </button>

            {/* 区切り */}
            <div style={{ display:'flex', alignItems:'center', gap:10, margin:'16px 0' }}>
              <div className="divider-line" style={{ flex:1 }}/>
              <span style={{ fontSize:11, fontWeight:600, color:'var(--label3)', letterSpacing:'0.03em' }}>またはメールで</span>
              <div className="divider-line" style={{ flex:1 }}/>
            </div>

            {/* メール */}
            <div style={{ marginBottom:10 }}>
              <label style={{ display:'block', fontSize:11, fontWeight:700, color:'var(--label2)', letterSpacing:'0.03em', marginBottom:6, textTransform:'uppercase' }}>
                メールアドレス
              </label>
              <div className={`field-wrap${emailFocus?' focused':''}${error&&!email?' has-error':''}`}>
                <div style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color:emailFocus?'var(--gold)':'var(--label3)', transition:'color .18s' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                    <polyline points="22,6 12,13 2,6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
                </div>
                <input
                  type="email" value={email}
                  onChange={e => setEmail(e.target.value)}
                  onFocus={() => setEmailFocus(true)}
                  onBlur={() => setEmailFocus(false)}
                  onKeyDown={e => e.key==='Enter' && handleLogin()}
                  placeholder="name@example.com"
                  className="field-input-bare"
                  style={{ paddingLeft:40 }}
                />
              </div>
            </div>

            {/* パスワード */}
            <div style={{ marginBottom:6 }}>
              <label style={{ display:'block', fontSize:11, fontWeight:700, color:'var(--label2)', letterSpacing:'0.03em', marginBottom:6, textTransform:'uppercase' }}>
                パスワード
              </label>
              <div className={`field-wrap${pwFocus?' focused':''}${error&&!password?' has-error':''}`}>
                <div style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color:pwFocus?'var(--gold)':'var(--label3)', transition:'color .18s' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="1.8"/>
                    <path d="M7 11V7a5 5 0 0110 0v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
                </div>
                <input
                  type={showPw ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)}
                  onFocus={() => setPwFocus(true)}
                  onBlur={() => setPwFocus(false)}
                  onKeyDown={e => e.key==='Enter' && handleLogin()}
                  placeholder="••••••••"
                  className="field-input-bare"
                  style={{ paddingLeft:40 }}
                />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  style={{ position:'absolute', right:14, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:pwFocus?'var(--gold-dk)':'var(--label3)', fontSize:11, fontWeight:700, padding:'4px 2px', transition:'color .18s' }}
                >{showPw ? '隠す' : '表示'}</button>
              </div>
            </div>

            {/* パスワード忘れ */}
            <div style={{ textAlign:'right', marginBottom:18 }}>
              <button type="button" onClick={() => router.push('/forgot-password')}
                style={{ fontSize:12, fontWeight:600, color:'var(--gold-dk)', background:'none', border:'none', cursor:'pointer', padding:'4px 0', opacity:0.85 }}
              >パスワードを忘れた方</button>
            </div>

            {/* エラー */}
            {error && (
              <div className="error-box" style={{ marginBottom:14 }}>
                <p style={{ fontSize:12, color:'var(--red)', fontWeight:600, textAlign:'center' }}>{error}</p>
                {isUnverified && <p style={{ fontSize:11, color:'var(--red)', textAlign:'center', marginTop:3, opacity:0.8 }}>メール受信ボックスをご確認ください</p>}
              </div>
            )}

            {/* ログインボタン */}
            <button
              className={`btn-gold${success?' success-state':''}`}
              onClick={handleLogin}
              disabled={loading || googleLoading}
            >
              {loading ? (
                <div className="spinner"/>
              ) : success ? (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <path d="M5 13l4 4L19 7" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="check-path"/>
                </svg>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3" stroke="#1a1a1a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  ログイン
                </>
              )}
            </button>

            {/* 新規登録 */}
            <div style={{ marginTop:14, textAlign:'center', display:'flex', alignItems:'center', justifyContent:'center', gap:4 }}>
              <span style={{ fontSize:13, color:'var(--label2)' }}>アカウントをお持ちでない方は</span>
              <button type="button" onClick={() => router.push('/register')}
                style={{ fontSize:13, fontWeight:700, color:'var(--gold-dk)', background:'none', border:'none', cursor:'pointer', padding:'0 2px' }}
              >新規登録 →</button>
            </div>
          </div>
        </div>

        {/* ── バンクロールプレビュー ── */}
        <div className="appear d4" style={{ marginTop:16 }}>
          <p className="section-hd" style={{ marginBottom:10 }}>ログイン後のホーム画面</p>
          <div style={{ borderRadius:22, padding:20, position:'relative', overflow:'hidden', background:'linear-gradient(145deg,#1C1C1E 0%,#2C2C2E 55%,#1C1C1E 100%)', boxShadow:'0 8px 28px rgba(0,0,0,0.16)', animation:'card-float 4.5s ease-in-out infinite' }}>
            <div style={{ position:'absolute', inset:0, background:'radial-gradient(ellipse at 20% 10%,rgba(242,169,0,0.16) 0%,transparent 60%)', pointerEvents:'none' }}/>
            <div style={{ position:'absolute', top:0, left:0, right:0, height:1, background:'linear-gradient(90deg,transparent,rgba(242,169,0,0.55),transparent)' }}/>
            <div style={{ position:'relative', zIndex:1 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:3 }}>
                <p style={{ fontSize:9, fontWeight:700, letterSpacing:'0.18em', textTransform:'uppercase', color:'rgba(255,255,255,0.35)' }}>Bank Roll</p>
                <span style={{ background:'rgba(52,199,89,0.18)', borderRadius:99, padding:'2px 7px', fontSize:9, fontWeight:700, color:'rgba(52,199,89,0.85)' }}>● LIVE</span>
              </div>
              <p style={{ fontSize:10, color:'rgba(255,255,255,0.28)', marginBottom:14, fontWeight:500 }}>○○ ポーカークラブ</p>
              <p style={{ fontSize:34, fontWeight:900, color:'white', letterSpacing:'-0.5px', lineHeight:1 }}> 24,500</p>
              <p style={{ fontSize:13, fontWeight:700, color:'#6EE7B7', marginTop:6 }}>+ 4,500</p>
              <div style={{ marginTop:12, height:1, background:'linear-gradient(90deg,transparent,rgba(242,169,0,0.38),transparent)' }}/>
              <p style={{ marginTop:8, fontSize:9, color:'rgba(255,255,255,0.2)', fontWeight:500 }}>※ ログイン後、実際の残高が表示されます</p>
            </div>
          </div>
        </div>

        {/* ── フッター ── */}
        <div className="appear d6" style={{ marginTop:28, textAlign:'center' }}>
          <div className="divider-line" style={{ marginBottom:18 }}/>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:7, marginBottom:10 }}>
            <img src="/logo.png" alt="RRPoker" style={{ width:24, height:24, borderRadius:7, objectFit:'cover' }}/>
            <span style={{ fontSize:12, fontWeight:700, color:'var(--label2)' }}>RRPOKER</span>
          </div>
          <p style={{ fontSize:10, color:'var(--label3)', marginBottom:2 }}>ver 1.4.8</p>
          <p style={{ fontSize:10, color:'var(--label3)', marginBottom:2 }}>RRPoker by Runner Runner</p>
          <p style={{ fontSize:10, color:'var(--label3)' }}>製作者 : Turn dead man</p>
        </div>

      </div>
    </div>
  )
}