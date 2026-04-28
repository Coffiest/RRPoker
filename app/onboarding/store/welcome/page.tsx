'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { auth, db } from '@/lib/firebase'
import { doc, getDoc } from 'firebase/firestore'

const STORE_FEATURES = [
  { icon: '🏆', title: 'トーナメント管理', desc: 'エントリー・リエントリー・アドオンを自動集計', color: '#F2A900' },
  { icon: '💰', title: 'チップ残高管理', desc: '購入・引き出しをリアルタイムで管理', color: '#34C759' },
  { icon: '📊', title: '純増ランキング', desc: 'プレイヤーの純増を自動ランキング表示', color: '#007AFF' },
  { icon: '⏱', title: 'ブラインドタイマー', desc: 'カスタム構成を保存して即再利用', color: '#FF9500' },
  { icon: '📢', title: 'お知らせ配信', desc: 'チェックイン中の全員に一斉送信', color: '#AF52DE' },
  { icon: '🎯', title: 'RR Rating連携', desc: 'トナメ結果がプレイヤーの偏差値に反映', color: '#FF3B30' },
]

function hexToRgb(hex: string): string {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return r ? `${parseInt(r[1], 16)},${parseInt(r[2], 16)},${parseInt(r[3], 16)}` : '255,255,255'
}

export default function StoreWelcomePage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [orbPhase, setOrbPhase] = useState(0)
  const animRef = useRef<number | null>(null)

  useEffect(() => {
    const fetchName = async () => {
      const user = auth.currentUser
      if (!user) return
      const snap = await getDoc(doc(db, 'users', user.uid))
      const data = snap.data()
      setName(data?.name ?? '')
    }
    fetchName()
  }, [])

  useEffect(() => {
    let t = 0
    const tick = () => {
      t += 0.004
      setOrbPhase(t)
      animRef.current = requestAnimationFrame(tick)
    }
    animRef.current = requestAnimationFrame(tick)
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current) }
  }, [])

  const orb1x = Math.sin(orbPhase * 0.5) * 40
  const orb1y = Math.cos(orbPhase * 0.4) * 30
  const orb2x = Math.cos(orbPhase * 0.6) * 35
  const orb2y = Math.sin(orbPhase * 0.7) * 25
  const orb3x = Math.sin(orbPhase * 0.3 + 2) * 28
  const orb3y = Math.cos(orbPhase * 0.5 + 1) * 22

  return (
    <div style={{ minHeight: '100dvh', background: '#0A0A14', overflowX: 'hidden' }}>
      <style>{`
        @keyframes sw-fade-up {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes sw-badge-drop {
          0%  { opacity: 0; transform: scale(0.5) rotate(-12deg); }
          65% { transform: scale(1.1) rotate(3deg); }
          100%{ opacity: 1; transform: scale(1) rotate(0); }
        }
        @keyframes sw-glow-pulse {
          0%,100% { opacity: 0.55; }
          50%     { opacity: 1; }
        }
        @keyframes sw-check-draw {
          from { stroke-dashoffset: 50; opacity: 0; }
          to   { stroke-dashoffset: 0; opacity: 1; }
        }
        @keyframes sw-ring-expand {
          0%   { transform: scale(0.85); opacity: 0.5; }
          100% { transform: scale(2.0); opacity: 0; }
        }
        @keyframes sw-name-in {
          0%  { opacity: 0; transform: scale(0.85) translateY(12px); }
          100%{ opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes sw-btn-pulse {
          0%,100%{ box-shadow: 0 6px 28px rgba(242,169,0,0.42); }
          50%    { box-shadow: 0 6px 40px rgba(242,169,0,0.65), 0 0 0 8px rgba(242,169,0,0.07); }
        }
        @keyframes sw-dot-blink {
          0%,100% { opacity: 1; }
          50%     { opacity: 0.3; }
        }
        .sw-appear { opacity: 0; animation: sw-fade-up .55s cubic-bezier(.22,1,.36,1) forwards; }
        .sw-d1 { animation-delay: .35s; }
        .sw-d2 { animation-delay: .55s; }
        .sw-d3 { animation-delay: .75s; }
        .sw-d4 { animation-delay: .90s; }
        .sw-d5 { animation-delay: 1.05s; }
        .sw-d6 { animation-delay: 1.20s; }
        .sw-d7 { animation-delay: 1.35s; }
        .sw-d8 { animation-delay: 1.50s; }
        .sw-d9 { animation-delay: 1.65s; }
        .sw-badge-anim { animation: sw-badge-drop .72s cubic-bezier(.22,1,.36,1) .1s both; }
        .sw-name-anim  { animation: sw-name-in .55s cubic-bezier(.22,1,.36,1) .7s both; }
        .sw-ring1 { position:absolute; inset:-14px; border-radius:50%; border:1.5px solid rgba(242,169,0,0.35); animation: sw-ring-expand 2.4s ease-out .3s infinite; }
        .sw-ring2 { position:absolute; inset:-14px; border-radius:50%; border:1.5px solid rgba(242,169,0,0.2);  animation: sw-ring-expand 2.4s ease-out 1.0s infinite; }
        .sw-btn {
          width:100%; height:58px; border-radius:18px; border:none; cursor:pointer;
          background:linear-gradient(135deg,#F2A900 0%,#D4910A 100%);
          font-size:17px; font-weight:900; color:#0A0A14;
          display:flex; align-items:center; justify-content:center; gap:8px;
          animation: sw-btn-pulse 2.6s ease-in-out 1.8s infinite;
          transition:transform .13s, opacity .13s;
          font-family:inherit; letter-spacing:-.2px;
        }
        .sw-btn:active { transform:scale(0.97); opacity:.88; }
        .sw-live-dot { animation: sw-dot-blink 1.8s ease-in-out infinite; }
        button { -webkit-tap-highlight-color:transparent; }
      `}</style>

      {/* 背景 orb */}
      <div style={{ position:'fixed', inset:0, zIndex:0, overflow:'hidden', pointerEvents:'none' }}>
        <div style={{ position:'absolute', top:`calc(4% + ${orb1y}px)`, right:`calc(-5% + ${orb1x}px)`, width:400, height:400, borderRadius:'50%', background:'radial-gradient(circle,rgba(242,169,0,0.14) 0%,transparent 65%)', animation:'sw-glow-pulse 6s ease-in-out infinite' }}/>
        <div style={{ position:'absolute', bottom:`calc(12% + ${orb2y}px)`, left:`calc(-8% + ${orb2x}px)`, width:320, height:320, borderRadius:'50%', background:'radial-gradient(circle,rgba(242,169,0,0.09) 0%,transparent 65%)', animation:'sw-glow-pulse 8s ease-in-out 2s infinite' }}/>
        <div style={{ position:'absolute', top:`calc(42% + ${orb3y}px)`, left:`calc(28% + ${orb3x}px)`, width:240, height:240, borderRadius:'50%', background:'radial-gradient(circle,rgba(212,145,10,0.07) 0%,transparent 65%)', animation:'sw-glow-pulse 10s ease-in-out 4s infinite' }}/>
        <div style={{ position:'absolute', top:0, left:0, right:0, height:1, background:'linear-gradient(90deg,transparent,rgba(242,169,0,0.35),transparent)' }}/>
      </div>

      <div style={{ position:'relative', zIndex:1, maxWidth:440, margin:'0 auto', padding:'0 20px 80px' }}>

        {/* ─── Hero ─── */}
        <div style={{ textAlign:'center', paddingTop:64, paddingBottom:32 }}>

          {/* Badge with ripple */}
          <div style={{ position:'relative', display:'inline-block', marginBottom:28 }}>
            <div className="sw-ring1"/>
            <div className="sw-ring2"/>
            <div className="sw-badge-anim" style={{ width:90, height:90, borderRadius:28, background:'linear-gradient(135deg,#F2A900 0%,#D4910A 100%)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 0 0 18px rgba(242,169,0,0.06), 0 0 56px rgba(242,169,0,0.38)', position:'relative', zIndex:1 }}>
              <svg width="44" height="44" viewBox="0 0 48 48" fill="none">
                <path d="M12 24l8 8 16-16" stroke="#0A0A14" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"
                  style={{ strokeDasharray:50, strokeDashoffset:50, animation:'sw-check-draw .5s ease-out .55s forwards' }}
                />
              </svg>
            </div>
          </div>

          {/* 完了バッジ */}
          <div className="sw-appear sw-d1" style={{ display:'inline-flex', alignItems:'center', gap:6, background:'rgba(52,199,89,0.1)', border:'1px solid rgba(52,199,89,0.25)', borderRadius:99, padding:'5px 14px', marginBottom:18 }}>
            <span className="sw-live-dot" style={{ width:7, height:7, borderRadius:'50%', background:'#34C759', display:'inline-block', boxShadow:'0 0 6px rgba(52,199,89,0.9)' }}/>
            <span style={{ fontSize:11, fontWeight:800, color:'#34C759', letterSpacing:'0.08em', textTransform:'uppercase' }}>店舗登録完了</span>
          </div>

          <h1 className="sw-name-anim" style={{ fontSize:30, fontWeight:900, color:'white', letterSpacing:'-0.5px', lineHeight:1.3, marginBottom:10 }}>
            {name ? `${name}さん、` : ''}ようこそ！🎉
          </h1>
          <p className="sw-appear sw-d2" style={{ fontSize:14, color:'rgba(255,255,255,0.4)', lineHeight:1.85 }}>
            あなたの店舗がRRPokerに登録されました。<br/>
            以下の機能がすぐに使えます。
          </p>
        </div>

        {/* ─── 機能グリッド ─── */}
        <div className="sw-appear sw-d3" style={{ marginBottom:16 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
            <div style={{ width:3, height:14, borderRadius:2, background:'linear-gradient(#F2A900,#D4910A)' }}/>
            <p style={{ fontSize:11, fontWeight:800, letterSpacing:'0.1em', textTransform:'uppercase', color:'rgba(255,255,255,0.3)' }}>店舗でできること</p>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            {STORE_FEATURES.map((f, i) => (
              <div key={i} className="sw-appear" style={{ animationDelay:`${0.8 + i * 0.1}s`, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:18, padding:'16px 14px', backdropFilter:'blur(8px)' }}>
                <div style={{ width:40, height:40, borderRadius:13, background:`rgba(${hexToRgb(f.color)},0.12)`, border:`1px solid rgba(${hexToRgb(f.color)},0.2)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, marginBottom:10 }}>
                  {f.icon}
                </div>
                <p style={{ fontSize:13, fontWeight:700, color:'rgba(255,255,255,0.85)', marginBottom:5, lineHeight:1.3 }}>{f.title}</p>
                <p style={{ fontSize:10, color:'rgba(255,255,255,0.3)', lineHeight:1.6 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ─── ヒントカード ─── */}
        <div className="sw-appear sw-d8" style={{ background:'rgba(242,169,0,0.07)', border:'1px solid rgba(242,169,0,0.15)', borderRadius:16, padding:'14px 16px', marginBottom:10 }}>
          <p style={{ fontSize:12, color:'rgba(242,169,0,0.85)', fontWeight:600, lineHeight:1.75 }}>
            💡 プレイヤーに<strong style={{ color:'#F2A900' }}>6桁の店舗コード</strong>を共有するだけで、すぐにチェックインしてもらえます。コードは店舗管理画面で確認できます。
          </p>
        </div>

        <div className="sw-appear sw-d8" style={{ background:'rgba(0,122,255,0.06)', border:'1px solid rgba(0,122,255,0.12)', borderRadius:16, padding:'14px 16px', marginBottom:28 }}>
          <p style={{ fontSize:12, color:'rgba(100,180,255,0.85)', fontWeight:600, lineHeight:1.75 }}>
            🏪 設定画面からチップ単位・店舗情報・リングブラインドをいつでも変更できます。
          </p>
        </div>

        {/* ─── CTA ─── */}
        <div className="sw-appear sw-d9">
          <button type="button" onClick={() => router.replace('/home/store')} className="sw-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              <polyline points="9,22 9,12 15,12 15,22" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            店舗管理をはじめる
          </button>
          <p style={{ fontSize:11, color:'rgba(255,255,255,0.18)', textAlign:'center', marginTop:12 }}>
            各種設定はいつでも変更できます
          </p>
        </div>

      </div>
    </div>
  )
}
