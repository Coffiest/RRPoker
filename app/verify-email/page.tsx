"use client"

import { useEffect, useRef, useState } from "react"
import { auth } from "@/lib/firebase"
import { sendEmailVerification } from "firebase/auth"
import { useRouter } from "next/navigation"

export default function VerifyEmailPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [cooldown, setCooldown] = useState(0)
  const [message, setMessage] = useState("")
  const [messageType, setMessageType] = useState<"ok" | "err" | "">("")
  const [checking, setChecking] = useState(false)
  const [resending, setResending] = useState(false)
  const [orbPhase, setOrbPhase] = useState(0)
  const animRef = useRef<number | null>(null)

  useEffect(() => {
    const user = auth.currentUser
    if (user?.email) setEmail(user.email)
  }, [])

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setInterval(() => setCooldown(p => p - 1), 1000)
    return () => clearInterval(t)
  }, [cooldown])

  // ambient orb
  useEffect(() => {
    let t = 0
    const tick = () => { t += 0.007; setOrbPhase(t); animRef.current = requestAnimationFrame(tick) }
    animRef.current = requestAnimationFrame(tick)
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current) }
  }, [])

  const handleResend = async () => {
    const user = auth.currentUser
    if (!user) { setMessage("再ログインしてください"); setMessageType("err"); return }
    setResending(true)
    try {
      await sendEmailVerification(user)
      setMessage("確認メールを再送しました ✓"); setMessageType("ok"); setCooldown(60)
    } catch {
      setMessage("再送に失敗しました。時間をおいてお試しください。"); setMessageType("err")
    } finally { setResending(false) }
  }

  const handleCheck = async () => {
    const user = auth.currentUser
    if (!user) { setMessage("再ログインしてください"); setMessageType("err"); return }
    setChecking(true)
    try {
      await user.reload()
      if (user.emailVerified) {
        router.replace("/login")
      } else {
        setMessage("まだ認証が完了していません"); setMessageType("err")
      }
    } finally { setChecking(false) }
  }

  const orb1x = Math.sin(orbPhase * 0.7) * 28
  const orb1y = Math.cos(orbPhase * 0.5) * 18
  const orb2x = Math.cos(orbPhase * 0.6) * 22
  const orb2y = Math.sin(orbPhase * 0.8) * 16

  return (
    <div style={{ minHeight: '100dvh', background: '#F2F2F7', overflowX: 'hidden' }}>
      <style>{`
        :root {
          --gold:#F2A900; --gold-dk:#D4910A;
          --label:#1C1C1E; --label2:rgba(60,60,67,0.6); --label3:rgba(60,60,67,0.3);
          --sep:rgba(60,60,67,0.12); --fill:rgba(120,120,128,0.12);
          --green:#34C759; --red:#FF3B30;
        }
        @keyframes page-in {
          from { opacity:0; transform:translateY(20px) scale(0.97); }
          to   { opacity:1; transform:translateY(0) scale(1); }
        }
        @keyframes shimmer {
          0%  { background-position:-300% center; }
          100%{ background-position:300% center; }
        }
        @keyframes spin { to{ transform:rotate(360deg); } }
        @keyframes envelope-float {
          0%,100%{ transform:translateY(0) rotate(-2deg) scale(1); }
          50%    { transform:translateY(-10px) rotate(2deg) scale(1.04); }
        }
        @keyframes pop-in {
          0%  { opacity:0; transform:scale(0.65) rotate(-6deg); }
          65% { transform:scale(1.08) rotate(2deg); }
          100%{ opacity:1; transform:scale(1) rotate(0); }
        }
        @keyframes check-draw {
          from{ stroke-dashoffset:30; }
          to  { stroke-dashoffset:0; }
        }
        @keyframes pulse-ring {
          0%  { box-shadow:0 0 0 0 rgba(242,169,0,0.4); }
          70% { box-shadow:0 0 0 14px rgba(242,169,0,0); }
          100%{ box-shadow:0 0 0 0 rgba(242,169,0,0); }
        }
        @keyframes msg-in {
          from{ opacity:0; transform:translateY(6px); }
          to  { opacity:1; transform:translateY(0); }
        }
        @keyframes dot-pulse {
          0%,80%,100%{ transform:scale(0); opacity:0.3; }
          40%        { transform:scale(1); opacity:1; }
        }

        .appear { opacity:0; animation:page-in .55s cubic-bezier(.22,1,.36,1) forwards; }
        .d0{ animation-delay:.04s; }
        .d1{ animation-delay:.12s; }
        .d2{ animation-delay:.20s; }
        .d3{ animation-delay:.28s; }
        .d4{ animation-delay:.36s; }
        .d5{ animation-delay:.44s; }

        .shimmer-text {
          background:linear-gradient(90deg,#D4910A 0%,#F2A900 30%,#FFE07A 48%,#F2A900 66%,#D4910A 100%);
          background-size:300% auto;
          -webkit-background-clip:text; -webkit-text-fill-color:transparent;
          background-clip:text; animation:shimmer 3s linear infinite;
        }
        .ios-card {
          background:#fff; border-radius:20px;
          box-shadow:0 2px 12px rgba(0,0,0,0.065), 0 1px 2px rgba(0,0,0,0.04);
        }
        .envelope-anim { animation:envelope-float 3.6s ease-in-out infinite; }
        .pop { animation:pop-in .55s cubic-bezier(.22,1,.36,1) .08s both; }
        .btn-gold {
          width:100%; height:54px; border-radius:16px; border:none; cursor:pointer;
          background:linear-gradient(135deg,#F2A900 0%,#D4910A 100%);
          color:#1a1a1a; font-size:15px; font-weight:800; letter-spacing:-.1px;
          box-shadow:0 4px 18px rgba(242,169,0,0.32);
          display:flex; align-items:center; justify-content:center; gap:7px;
          transition:transform .13s ease, opacity .13s ease;
          animation:pulse-ring 2.6s ease-in-out 1s infinite;
          position:relative; overflow:hidden;
        }
        .btn-gold::before {
          content:""; position:absolute; inset:0;
          background:linear-gradient(135deg,rgba(255,255,255,0.15) 0%,transparent 60%);
          pointer-events:none;
        }
        .btn-gold:active { transform:scale(0.97); opacity:.88; }
        .btn-gold:disabled{ opacity:.5; pointer-events:none; animation:none; }
        .btn-outline {
          width:100%; height:50px; border-radius:14px; cursor:pointer;
          background:#fff; border:1.5px solid rgba(60,60,67,0.15);
          color:var(--label); font-size:15px; font-weight:600;
          display:flex; align-items:center; justify-content:center; gap:7px;
          box-shadow:0 1px 4px rgba(0,0,0,0.05);
          transition:transform .13s ease, border-color .13s, background .13s;
        }
        .btn-outline:hover { border-color:rgba(60,60,67,0.28); background:#fafafa; }
        .btn-outline:active{ transform:scale(0.97); }
        .btn-outline:disabled{ opacity:.45; pointer-events:none; }
        .spinner {
          width:18px; height:18px; border-radius:50%;
          border:2.5px solid rgba(26,26,26,0.18); border-top-color:#1a1a1a;
          animation:spin .65s linear infinite;
        }
        .check-path { stroke-dasharray:30; stroke-dashoffset:30; animation:check-draw .3s ease-out .05s forwards; }
        .msg-box { animation:msg-in .3s ease-out; }
        .divider-line { height:1px; background:var(--sep); }
        .dot-loader span {
          display:inline-block; width:6px; height:6px; border-radius:50%; background:var(--label2); margin:0 2px;
        }
        .dot-loader span:nth-child(1){ animation:dot-pulse 1.2s ease-in-out 0s infinite; }
        .dot-loader span:nth-child(2){ animation:dot-pulse 1.2s ease-in-out .2s infinite; }
        .dot-loader span:nth-child(3){ animation:dot-pulse 1.2s ease-in-out .4s infinite; }
        button { -webkit-tap-highlight-color:transparent; }
      `}</style>

      {/* ── Ambient Orbs ── */}
      <div style={{ position:'fixed', inset:0, zIndex:0, overflow:'hidden', pointerEvents:'none' }}>
        <div style={{ position:'absolute', top:`calc(6% + ${orb1y}px)`, right:`calc(4% + ${orb1x}px)`, width:240, height:240, borderRadius:'50%', background:'radial-gradient(circle,rgba(242,169,0,0.1) 0%,transparent 70%)' }}/>
        <div style={{ position:'absolute', bottom:`calc(10% + ${orb2y}px)`, left:`calc(2% + ${orb2x}px)`, width:190, height:190, borderRadius:'50%', background:'radial-gradient(circle,rgba(242,169,0,0.07) 0%,transparent 70%)' }}/>
      </div>

      {/* ── Header（ロゴのみ・HomeHeader準拠） ── */}
      <header className="sticky top-0 z-50 border-b"
        style={{ background:'rgba(255,255,255,0.9)', backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)', borderBottomColor:'rgba(60,60,67,0.07)', position:'relative', zIndex:50 }}
      >
        <div style={{ maxWidth:480, margin:'0 auto', padding:'0 20px', minHeight:64, display:'flex', alignItems:'center' }}>
          <button type="button" onClick={() => router.push('/')}
            style={{ display:'flex', alignItems:'center', gap:0, background:'none', border:'none', cursor:'pointer', padding:0 }}
          >
            <img src="/logo.png" alt="RRPoker" style={{ height:60, width:60 }}/>
            <span style={{ fontSize:18, fontWeight:700, color:'#1C1C1E', letterSpacing:'-0.2px' }}>RRPOKER</span>
          </button>
        </div>
      </header>

      {/* ── Main ── */}
      <div style={{ position:'relative', zIndex:1, maxWidth:480, margin:'0 auto', padding:'0 20px 60px' }}>

        {/* ── エンベロープヒーロー ── */}
        <div style={{ paddingTop:40, paddingBottom:24, textAlign:'center' }}>

          {/* アニメーション封筒アイコン */}
          <div className="pop" style={{ display:'inline-block', marginBottom:20 }}>
            <div style={{ position:'relative', display:'inline-block' }}>
              <div style={{ position:'absolute', inset:-14, borderRadius:9999, background:'radial-gradient(circle,rgba(242,169,0,0.18) 0%,transparent 70%)', filter:'blur(10px)' }}/>
              <div className="envelope-anim" style={{ position:'relative', zIndex:1, width:80, height:80, borderRadius:24, background:'linear-gradient(135deg,#F2A900,#D4910A)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 8px 28px rgba(242,169,0,0.32), 0 2px 8px rgba(0,0,0,0.1)' }}>
                <svg width="38" height="38" viewBox="0 0 24 24" fill="none">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
                  <polyline points="22,6 12,13 2,6" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              </div>
              {/* バッジ */}
              <div style={{ position:'absolute', top:-4, right:-4, width:22, height:22, borderRadius:'50%', background:'#34C759', border:'2.5px solid white', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 2px 6px rgba(52,199,89,0.4)' }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                  <path d="M5 13l4 4L19 7" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>
          </div>

          <div className="appear d0">
            <p style={{ fontSize:11, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'var(--gold)', marginBottom:8 }}>Email Verification</p>
            <h1 style={{ fontSize:24, fontWeight:900, letterSpacing:'-0.5px', color:'var(--label)', lineHeight:1.25, marginBottom:8 }}>
              確認メールを<br/>
              <span className="shimmer-text">送信しました</span>
            </h1>
            {email && (
              <div style={{ display:'inline-flex', alignItems:'center', gap:6, background:'rgba(242,169,0,0.08)', border:'1px solid rgba(242,169,0,0.2)', borderRadius:99, padding:'5px 12px', marginTop:4 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="#D4910A" strokeWidth="2" strokeLinecap="round"/>
                  <polyline points="22,6 12,13 2,6" stroke="#D4910A" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                <span style={{ fontSize:12, fontWeight:600, color:'#D4910A', letterSpacing:'-0.1px' }}>{email}</span>
              </div>
            )}
          </div>
        </div>

        {/* ── メインカード ── */}
        <div className="appear d1 ios-card" style={{ overflow:'hidden' }}>
          <div style={{ height:3, background:'linear-gradient(90deg,#F2A900,#FFE07A,#F2A900)', backgroundSize:'200% auto', animation:'shimmer 3.2s linear infinite' }}/>

          <div style={{ padding:'22px 20px 24px' }}>

            {/* 手順 */}
            <p style={{ fontSize:13, color:'var(--label2)', lineHeight:1.75, marginBottom:20 }}>
              メール内の<strong style={{ color:'var(--label)', fontWeight:700 }}>確認リンク</strong>をクリックして認証を完了してください。完了後、下の「認証完了後はこちら」ボタンを押してください。
            </p>

            {/* 認証完了ボタン（メイン） */}
            <button className="btn-gold" onClick={handleCheck} disabled={checking || resending}>
              {checking ? (
                <div className="dot-loader">
                  <span/><span/><span/>
                </div>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  認証完了後はこちら
                </>
              )}
            </button>

            <div style={{ height:10 }}/>

            {/* 再送ボタン */}
            <button className="btn-outline" onClick={handleResend} disabled={cooldown > 0 || resending || checking}>
              {resending ? (
                <div className="spinner"/>
              ) : cooldown > 0 ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="var(--label3)" strokeWidth="2"/>
                    <polyline points="12,6 12,12 16,14" stroke="var(--label3)" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  <span style={{ color:'var(--label3)' }}>再送まで {cooldown} 秒</span>
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <polyline points="1,4 1,10 7,10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M3.51 15a9 9 0 102.13-9.36L1 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  確認メールを再送
                </>
              )}
            </button>

            {/* メッセージ */}
            {message && (
              <div className="msg-box" style={{ marginTop:12, borderRadius:12, padding:'10px 14px', background:messageType==='ok'?'rgba(52,199,89,0.07)':'rgba(255,59,48,0.06)', border:`1px solid ${messageType==='ok'?'rgba(52,199,89,0.22)':'rgba(255,59,48,0.2)'}` }}>
                <p style={{ fontSize:12, fontWeight:600, color:messageType==='ok'?'#28A745':'var(--red)', textAlign:'center' }}>{message}</p>
              </div>
            )}
          </div>
        </div>

        {/* ── チェックリストカード ── */}
        <div className="appear d2 ios-card" style={{ marginTop:12, overflow:'hidden' }}>
          <div style={{ padding:'18px 20px' }}>
            <p style={{ fontSize:11, fontWeight:700, letterSpacing:'0.05em', textTransform:'uppercase', color:'var(--label2)', marginBottom:12 }}>メールが届かない場合</p>
            {[
              { icon:'📁', text:'迷惑メールフォルダを確認する' },
              { icon:'✉️', text:'入力したメールアドレスが正しいか確認する' },
              { icon:'⏱️', text:'数分待ってから再送する' },
              { icon:'📧', text:'GmailなどiCloud以外のアドレスを使う' },
            ].map((item, i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 0', borderBottom:i<3?'1px solid var(--sep)':'none' }}>
                <span style={{ fontSize:18, flexShrink:0 }}>{item.icon}</span>
                <p style={{ fontSize:13, color:'var(--label)', fontWeight:500, lineHeight:1.45 }}>{item.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── iCloud注意 ── */}
        <div className="appear d3" style={{ marginTop:10 }}>
          <div style={{ borderRadius:14, padding:'12px 14px', background:'rgba(255,149,0,0.07)', border:'1px solid rgba(255,149,0,0.2)', display:'flex', alignItems:'flex-start', gap:8 }}>
            <span style={{ fontSize:16, flexShrink:0, marginTop:1 }}>⚠️</span>
            <p style={{ fontSize:12, color:'#A05000', fontWeight:500, lineHeight:1.65 }}>
              <strong>iCloudメールは確認メールが届かない</strong>または遅延する場合があります。Gmail、または別のメールアドレスの使用を推奨します。
            </p>
          </div>
        </div>

        {/* ── ログインへ戻る ── */}
        <div className="appear d4" style={{ marginTop:20, textAlign:'center' }}>
          <button type="button" onClick={() => router.replace('/login')}
            style={{ fontSize:13, color:'var(--label2)', background:'none', border:'none', cursor:'pointer', display:'inline-flex', alignItems:'center', gap:5, padding:'6px 12px', borderRadius:99, transition:'color .15s' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <path d="M19 12H5M12 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            ログイン画面へ戻る
          </button>
        </div>

        {/* ── フッター ── */}
        <div className="appear d5" style={{ marginTop:28, textAlign:'center' }}>
          <div className="divider-line" style={{ marginBottom:16 }}/>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:7, marginBottom:9 }}>
            <img src="/logo.png" alt="RRPoker" style={{ width:24, height:24, borderRadius:7, objectFit:'cover' }}/>
            <span style={{ fontSize:12, fontWeight:700, color:'var(--label2)' }}>RRPOKER</span>
          </div>
          <p style={{ fontSize:10, color:'var(--label3)', marginBottom:2 }}>ver 1.4.7</p>
          <p style={{ fontSize:10, color:'var(--label3)' }}>RRPoker by Runner Runner</p>
        </div>
      </div>
    </div>
  )
}