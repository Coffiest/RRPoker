'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

const FEATURES = [
  {
    emoji: '🏪',
    title: '店舗チェックイン',
    desc: '店舗コードを入力するだけで即入店。チップ残高をリアルタイム管理。',
    accent: '#F2A900',
    bg: 'rgba(242,169,0,0.08)',
  },
  {
    emoji: '💳',
    title: 'バンクロール管理',
    desc: 'チップの購入・引き出し履歴を自動記録。BB表示にも対応。',
    accent: '#007AFF',
    bg: 'rgba(0,122,255,0.07)',
  },
  {
    emoji: '📊',
    title: 'RR Rating',
    desc: 'ROI・インマネ率からトーナメントの実力を偏差値で可視化。',
    accent: '#34C759',
    bg: 'rgba(52,199,89,0.08)',
  },
  {
    emoji: '🏆',
    title: 'ランキング',
    desc: '純増ランキングで仲間と競う。店舗内の順位をリアルタイム確認。',
    accent: '#AF52DE',
    bg: 'rgba(175,82,222,0.08)',
  },
  {
    emoji: '📋',
    title: 'トーナメント履歴',
    desc: '参加トナメを自動記録。コスト・プライズ・収支をいつでも確認。',
    accent: '#FF3B30',
    bg: 'rgba(255,59,48,0.07)',
  },
]

const TIPS = [
  '店舗コードを共有するだけでプレイヤーが即入店できます',
  'チップ残高はBB表示に切り替えることができます',
  'トーナメントに参加するほどRR Ratingが実力に近づきます',
  'お気に入り店舗に登録すると素早くアクセスできます',
  '誕生日には店舗からクーポンが届くことがあります',
]

const POKER_CARDS = [
  { suit: '♠', num: 'A', dark: true },
  { suit: '♥', num: 'K', dark: false },
  { suit: '♦', num: 'Q', dark: false },
  { suit: '♣', num: 'J', dark: true },
]

export default function TopPage() {
  const router = useRouter()
  const [featureIndex, setFeatureIndex] = useState(0)
  const [tipIndex, setTipIndex] = useState(0)
  const [tipVisible, setTipVisible] = useState(true)
  const [featureVisible, setFeatureVisible] = useState(true)
  const [scrollY, setScrollY] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const id = setInterval(() => {
      setFeatureVisible(false)
      setTimeout(() => { setFeatureIndex(i => (i + 1) % FEATURES.length); setFeatureVisible(true) }, 300)
    }, 3200)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const id = setInterval(() => {
      setTipVisible(false)
      setTimeout(() => { setTipIndex(i => (i + 1) % TIPS.length); setTipVisible(true) }, 350)
    }, 4000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [menuOpen])

  const f = FEATURES[featureIndex]
  const headerElevated = scrollY > 10

  return (
    <div style={{ minHeight: '100dvh', background: '#F2F2F7', overflowX: 'hidden' }}>
      <style>{`
        :root {
          --gold: #F2A900; --gold-dk: #D4910A;
          --label: #1C1C1E; --label2: rgba(60,60,67,0.6); --label3: rgba(60,60,67,0.3);
          --sep: rgba(60,60,67,0.12); --fill: rgba(120,120,128,0.12);
        }

        @keyframes fade-up {
          from { opacity:0; transform:translateY(18px) scale(0.97); }
          to   { opacity:1; transform:translateY(0) scale(1); }
        }
        @keyframes pop-in {
          0%  { opacity:0; transform:scale(0.72) rotate(-5deg); }
          65% { transform:scale(1.07) rotate(1.5deg); }
          100%{ opacity:1; transform:scale(1) rotate(0); }
        }
        @keyframes shimmer {
          0%  { background-position:-200% center; }
          100%{ background-position:200% center; }
        }
        @keyframes float-a {
          0%,100%{ transform:translateY(0) rotate(-2deg); }
          50%    { transform:translateY(-10px) rotate(2deg); }
        }
        @keyframes float-b {
          0%,100%{ transform:translateY(0) rotate(3deg); }
          50%    { transform:translateY(-14px) rotate(-2deg); }
        }
        @keyframes float-c {
          0%,100%{ transform:translateY(-4px) rotate(-1deg); }
          50%    { transform:translateY(-12px) rotate(3deg); }
        }
        @keyframes float-d {
          0%,100%{ transform:translateY(0) rotate(2deg); }
          50%    { transform:translateY(-8px) rotate(-3deg); }
        }
        @keyframes pulse-glow {
          0%,100%{ box-shadow:0 4px 20px rgba(242,169,0,0.35), 0 1px 4px rgba(0,0,0,0.1); }
          50%    { box-shadow:0 4px 28px rgba(242,169,0,0.55), 0 1px 4px rgba(0,0,0,0.1); }
        }
        @keyframes card-in {
          from{ opacity:0; transform:translateY(10px) scale(0.95); }
          to  { opacity:1; transform:translateY(0) scale(1); }
        }
        @keyframes tip-in {
          from{ opacity:0; transform:translateY(6px); }
          to  { opacity:1; transform:translateY(0); }
        }
        @keyframes orb-drift {
          0%,100%{ transform:translate(0,0) scale(1); opacity:0.7; }
          33%    { transform:translate(20px,-16px) scale(1.1); opacity:1; }
          66%    { transform:translate(-14px,10px) scale(0.93); opacity:0.6; }
        }
        @keyframes bounce-x {
          0%,100%{ transform:translateX(0); }
          50%    { transform:translateX(5px); }
        }
        @keyframes slide-in-right {
          from{ transform:translateX(100%); }
          to  { transform:translateX(0); }
        }
        @keyframes count-in {
          from{ opacity:0; transform:translateY(8px); }
          to  { opacity:1; transform:translateY(0); }
        }

        .d0{ opacity:0; animation:fade-up .55s cubic-bezier(.22,1,.36,1) .04s forwards; }
        .d1{ opacity:0; animation:fade-up .55s cubic-bezier(.22,1,.36,1) .12s forwards; }
        .d2{ opacity:0; animation:fade-up .55s cubic-bezier(.22,1,.36,1) .20s forwards; }
        .d3{ opacity:0; animation:fade-up .55s cubic-bezier(.22,1,.36,1) .28s forwards; }
        .d4{ opacity:0; animation:fade-up .55s cubic-bezier(.22,1,.36,1) .36s forwards; }
        .d5{ opacity:0; animation:fade-up .55s cubic-bezier(.22,1,.36,1) .44s forwards; }
        .d6{ opacity:0; animation:fade-up .55s cubic-bezier(.22,1,.36,1) .52s forwards; }
        .d7{ opacity:0; animation:fade-up .55s cubic-bezier(.22,1,.36,1) .60s forwards; }
        .d8{ opacity:0; animation:fade-up .55s cubic-bezier(.22,1,.36,1) .68s forwards; }
        .pop{ animation:pop-in .5s cubic-bezier(.22,1,.36,1) .1s both; }

        .shimmer-text{
          background:linear-gradient(90deg,#D4910A 0%,#F2A900 35%,#FFE07A 50%,#F2A900 65%,#D4910A 100%);
          background-size:200% auto;
          -webkit-background-clip:text; -webkit-text-fill-color:transparent;
          background-clip:text; animation:shimmer 2.6s linear infinite;
        }

        .ios-card{
          background:#fff; border-radius:20px;
          box-shadow:0 2px 10px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
        }

        .feature-spotlight{
          animation:${featureVisible ? 'card-in .35s cubic-bezier(.22,1,.36,1) both' : 'none'};
        }
        .tip-txt{
          transition:opacity .3s ease, transform .3s ease;
          opacity:${tipVisible ? 1 : 0};
          transform:${tipVisible ? 'translateY(0)' : 'translateY(4px)'};
          animation:${tipVisible ? 'tip-in .35s ease-out both' : 'none'};
        }

        .cta-primary{
          background:linear-gradient(135deg,#F2A900 0%,#D4910A 100%);
          animation:pulse-glow 2.4s ease-in-out 1.4s infinite;
          transition:transform .13s ease, opacity .13s ease;
          border:none; cursor:pointer;
        }
        .cta-primary:active{ transform:scale(0.96); opacity:.88; }

        .header-cta{
          background:linear-gradient(135deg,#F2A900,#D4910A);
          border:none; border-radius:20px; padding:7px 14px;
          color:white; font-size:13px; font-weight:700;
          cursor:pointer; box-shadow:0 2px 8px rgba(242,169,0,0.3);
          white-space:nowrap; transition:transform .12s, opacity .12s;
          display:flex; align-items:center; gap:4px;
        }
        .header-cta:active{ transform:scale(0.95); opacity:.85; }

        .pcard{
          width:50px; height:70px; border-radius:10px; background:#fff;
          border:1.5px solid rgba(0,0,0,0.07);
          box-shadow:0 5px 16px rgba(0,0,0,0.13), 0 1px 3px rgba(0,0,0,0.06);
          display:flex; flex-direction:column; align-items:center; justify-content:center;
          font-weight:900; line-height:1; user-select:none;
        }
        .pcard-0{ animation:float-a 3.2s ease-in-out infinite; }
        .pcard-1{ animation:float-b 3.8s ease-in-out .5s infinite; }
        .pcard-2{ animation:float-c 3.5s ease-in-out .9s infinite; }
        .pcard-3{ animation:float-d 4.0s ease-in-out 1.3s infinite; }

        .stat-row{
          display:flex; align-items:center; justify-content:space-between;
          padding:13px 16px; background:#fff; transition:background .12s;
        }
        .stat-row:not(:last-child){ border-bottom:1px solid var(--sep); }
        .stat-row:active{ background:#F2F2F7; }

        .dot-ind{
          width:6px; height:6px; border-radius:50%;
          transition:background .25s, transform .25s;
        }

        .arrow-bounce{ display:inline-block; animation:bounce-x 1.3s ease-in-out infinite; }

        .menu-slide{ animation:slide-in-right .28s cubic-bezier(.22,1,.36,1); }

        .section-hd{
          font-size:11px; font-weight:700; letter-spacing:.06em;
          text-transform:uppercase; color:var(--label2); margin-bottom:10px; padding:0 2px;
        }
      `}</style>

      {/* ════════════════════════════════
          HEADER（HomeHeader完全準拠）
      ════════════════════════════════ */}
      <header
        className="sticky top-0 z-50 border-b border-gray-100"
        style={{
          background: headerElevated ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.9)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottomColor: headerElevated ? 'rgba(60,60,67,0.12)' : 'rgba(60,60,67,0.06)',
          transition: 'background .2s, border-color .2s',
        }}
      >
        <div style={{ maxWidth:480, margin:'0 auto', padding:'0 20px', minHeight:64, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          {/* 左：ロゴ */}
          <button type="button" onClick={() => {}}
            style={{ display:'flex', alignItems:'center', gap:0, background:'none', border:'none', cursor:'default', padding:0 }}
          >
            <img src="/logo.png" alt="RRPoker logo" style={{ height:60, width:60 }} />
            <span style={{ fontSize:18, fontWeight:700, color:'#1C1C1E', letterSpacing:'-0.2px' }}>RRPOKER</span>
          </button>

          {/* 右：ログインボタン + ハンバーガー */}
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            {/* ログインボタン（ヘッダー右） */}
            <button className="header-cta" onClick={() => router.push('/login')}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              ログイン
            </button>

          
          </div>
        </div>
      </header>

      {/* ════ ドロワーメニュー ════ */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-[999] bg-black/30"
          style={{ backdropFilter:'blur(2px)', WebkitBackdropFilter:'blur(2px)' }}
          onClick={() => setMenuOpen(false)}
        />
      )}
      <aside
        className={menuOpen ? 'menu-slide' : ''}
        style={{
          position:'fixed', right:0, top:0, zIndex:1000, height:'100dvh',
          width:'80%', maxWidth:360, background:'white',
          borderLeft:'1px solid rgba(60,60,67,0.1)',
          boxShadow:'-8px 0 32px rgba(0,0,0,0.12)',
          transform: menuOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: menuOpen ? 'none' : 'transform .25s cubic-bezier(.22,1,.36,1)',
          display:'flex', flexDirection:'column',
        }}
      >
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px', borderBottom:'1px solid rgba(60,60,67,0.08)' }}>
          <p style={{ fontSize:14, fontWeight:700, color:'var(--label)' }}>メニュー</p>
          <button onClick={() => setMenuOpen(false)} style={{ fontSize:13, color:'var(--label2)', background:'none', border:'none', cursor:'pointer', padding:'4px 8px' }}>閉じる</button>
        </div>
        <div style={{ padding:'16px 20px', display:'flex', flexDirection:'column', gap:10 }}>
          <button onClick={() => { setMenuOpen(false); router.push('/login') }}
            style={{ width:'100%', borderRadius:14, border:'1.5px solid rgba(242,169,0,0.4)', background:'rgba(242,169,0,0.06)', padding:'13px 16px', textAlign:'left', fontSize:14, fontWeight:700, color:'#D4910A', cursor:'pointer', display:'flex', alignItems:'center', gap:8 }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3" stroke="#D4910A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            ログイン / 新規登録
          </button>
          {['このアプリについて', 'RR Ratingとは？', 'よくある質問'].map(label => (
            <button key={label}
              style={{ width:'100%', borderRadius:14, border:'1px solid rgba(60,60,67,0.12)', background:'none', padding:'13px 16px', textAlign:'left', fontSize:14, fontWeight:600, color:'var(--label)', cursor:'pointer' }}
            >{label}</button>
          ))}
        </div>
      </aside>

      {/* ════════════════════════════════
          HERO
      ════════════════════════════════ */}
      <section style={{
        paddingTop:32, paddingBottom:40, paddingLeft:20, paddingRight:20,
        position:'relative', overflow:'hidden',
        background:'linear-gradient(180deg,#FFFBF0 0%,#F2F2F7 100%)',
      }}>
        {/* 背景 orb */}
        <div style={{ position:'absolute', top:-60, right:-40, width:240, height:240, borderRadius:'50%', background:'radial-gradient(circle,rgba(242,169,0,0.15) 0%,transparent 70%)', animation:'orb-drift 9s ease-in-out infinite', pointerEvents:'none' }}/>
        <div style={{ position:'absolute', bottom:-20, left:-60, width:190, height:190, borderRadius:'50%', background:'radial-gradient(circle,rgba(242,169,0,0.09) 0%,transparent 70%)', animation:'orb-drift 12s ease-in-out 3s infinite', pointerEvents:'none' }}/>

        <div style={{ maxWidth:480, margin:'0 auto', position:'relative' }}>

          {/* フローティングポーカーカード */}
          <div className="d0" style={{ display:'flex', justifyContent:'center', gap:10, marginBottom:28 }}>
            {POKER_CARDS.map((c, i) => (
              <div key={i} className={`pcard pcard-${i}`} style={{ color: c.dark ? '#1C1C1E' : '#FF3B30' }}>
                <span style={{ fontSize:13, lineHeight:1 }}>{c.suit}</span>
                <span style={{ fontSize:22, fontWeight:900, letterSpacing:'-1.5px', lineHeight:1.1 }}>{c.num}</span>
                <span style={{ fontSize:13, lineHeight:1 }}>{c.suit}</span>
              </div>
            ))}
          </div>

          {/* テキスト */}
          <div className="d1" style={{ textAlign:'center', marginBottom:6 }}>
            <p style={{ fontSize:11, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'var(--gold)', marginBottom:10 }}>
              The Poker Management App
            </p>
            <h1 style={{ fontSize:33, fontWeight:900, letterSpacing:'-0.8px', color:'var(--label)', lineHeight:1.22, marginBottom:10 }}>
              ポーカーライフを、<br/>
              <span className="shimmer-text">次のレベルへ。</span>
            </h1>
            <p style={{ fontSize:14, color:'var(--label2)', lineHeight:1.72, maxWidth:300, margin:'0 auto' }}>
              チップ管理・ランキング・<br/>トーナメント統計をひとつのアプリで。
            </p>
          </div>

          {/* CTA */}
          <div className="d2" style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8, marginTop:26 }}>
            <button className="cta-primary" onClick={() => router.push('/login')}
              style={{ width:'100%', maxWidth:320, height:56, borderRadius:18, fontSize:17, fontWeight:800, color:'#1a1a1a', display:'flex', alignItems:'center', justifyContent:'center', gap:8, letterSpacing:'-0.2px' }}
            >
              今すぐはじめる
              <span className="arrow-bounce">→</span>
            </button>
            <p style={{ fontSize:11, color:'var(--label3)', fontWeight:500 }}>無料でご利用いただけます</p>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════
          スタットストリップ
      ════════════════════════════════ */}
      <section style={{ padding:'0 20px 16px', maxWidth:480, margin:'0 auto' }}>
        <div className="d3" style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
          {[
            { icon:'⚡', label:'残高管理', sub:'リアルタイム' },
            { icon:'🏅', label:'ランキング', sub:'自動更新' },
            { icon:'📝', label:'トナメ記録', sub:'自動保存' },
          ].map((s, i) => (
            <div key={i} className="ios-card" style={{ padding:'14px 8px', textAlign:'center' }}>
              <div style={{ fontSize:22, marginBottom:5 }}>{s.icon}</div>
              <p style={{ fontSize:11, fontWeight:700, color:'var(--label)', marginBottom:2 }}>{s.label}</p>
              <p style={{ fontSize:10, color:'var(--gold-dk)', fontWeight:600 }}>{s.sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ════════════════════════════════
          機能スポットライト
      ════════════════════════════════ */}
      <section style={{ padding:'0 20px 16px', maxWidth:480, margin:'0 auto' }}>
        <p className="section-hd d3">できること</p>
        <div className="d4">
          {/* ハイライトカード */}
          <div className="ios-card feature-spotlight" style={{ overflow:'hidden', marginBottom:10 }}>
            <div style={{ height:3, background:`linear-gradient(90deg,${f.accent},${f.accent}77,transparent)` }}/>
            <div style={{ padding:20 }}>
              <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:14 }}>
                <div style={{ width:54, height:54, borderRadius:16, background:f.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:26, flexShrink:0, border:`1.5px solid ${f.accent}22` }}>
                  {f.emoji}
                </div>
                <div>
                  <p style={{ fontSize:17, fontWeight:700, color:'var(--label)', letterSpacing:'-0.2px' }}>{f.title}</p>
                  <p style={{ fontSize:13, color:'var(--label2)', marginTop:3, lineHeight:1.55 }}>{f.desc}</p>
                </div>
              </div>
              <div style={{ display:'flex', justifyContent:'center', gap:6 }}>
                {FEATURES.map((_, i) => (
                  <div key={i} className="dot-ind" style={{ background: i===featureIndex ? f.accent : 'var(--sep)', transform: i===featureIndex ? 'scale(1.4)' : 'scale(1)' }}/>
                ))}
              </div>
            </div>
          </div>

          {/* 全機能リスト */}
          <div className="ios-card" style={{ overflow:'hidden' }}>
            {FEATURES.map((feat, i) => (
              <div key={i} className="stat-row">
                <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <div style={{ width:38, height:38, borderRadius:11, background:feat.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>
                    {feat.emoji}
                  </div>
                  <div>
                    <p style={{ fontSize:14, fontWeight:600, color:'var(--label)' }}>{feat.title}</p>
                    <p style={{ fontSize:11, color:'var(--label2)', marginTop:1, lineHeight:1.4 }}>{feat.desc}</p>
                  </div>
                </div>
                <div style={{ width:8, height:8, borderRadius:'50%', background:feat.accent, flexShrink:0, marginLeft:10, opacity:0.7 }}/>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════
          バンクロールプレビュー
      ════════════════════════════════ */}
      <section style={{ padding:'0 20px 16px', maxWidth:480, margin:'0 auto' }}>
        <p className="section-hd d5">バンクロール</p>
        <div className="d5" style={{
          borderRadius:22, padding:22, position:'relative', overflow:'hidden',
          background:'linear-gradient(145deg,#1C1C1E 0%,#2C2C2E 60%,#1C1C1E 100%)',
          boxShadow:'0 8px 32px rgba(0,0,0,0.18)',
        }}>
          <div style={{ position:'absolute', inset:0, background:'radial-gradient(ellipse at 20% 10%,rgba(242,169,0,0.17) 0%,transparent 60%)', pointerEvents:'none' }}/>
          <div style={{ position:'absolute', top:0, left:0, right:0, height:1, background:'linear-gradient(90deg,transparent,rgba(242,169,0,0.6),transparent)' }}/>
          <div style={{ position:'relative', zIndex:1 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
              <p style={{ fontSize:10, fontWeight:700, letterSpacing:'0.18em', textTransform:'uppercase', color:'rgba(255,255,255,0.4)' }}>Bank Roll</p>
              <span style={{ background:'rgba(52,199,89,0.2)', borderRadius:99, padding:'2px 8px', fontSize:9, fontWeight:700, color:'rgba(52,199,89,0.9)', letterSpacing:'0.05em' }}>● LIVE</span>
            </div>
            <p style={{ fontSize:11, color:'rgba(255,255,255,0.32)', marginBottom:18, fontWeight:500 }}>○○ ポーカークラブ</p>
            <p style={{ fontSize:38, fontWeight:900, color:'white', letterSpacing:'-0.5px', lineHeight:1 }}>$ 24,500</p>
            <p style={{ fontSize:14, fontWeight:700, color:'#6EE7B7', marginTop:8 }}>+$ 4,500</p>
            <div style={{ marginTop:16, height:1, background:'linear-gradient(90deg,transparent,rgba(242,169,0,0.4),transparent)' }}/>
            <p style={{ marginTop:10, fontSize:9, color:'rgba(255,255,255,0.25)', fontWeight:500 }}>※ これはイメージです。実際の残高が表示されます。</p>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════
          RR Rating プレビュー
      ════════════════════════════════ */}
      <section style={{ padding:'0 20px 16px', maxWidth:480, margin:'0 auto' }}>
        <p className="section-hd d5">RR Rating（トナメ偏差値）</p>
        <div className="d6 ios-card" style={{ overflow:'hidden' }}>
          <div style={{ background:'linear-gradient(135deg,#F2A900,#D4910A)', padding:'20px', position:'relative', overflow:'hidden' }}>
            <div style={{ position:'absolute', top:'-40%', right:'-10%', width:160, height:160, borderRadius:'50%', background:'radial-gradient(circle,rgba(255,255,255,0.16) 0%,transparent 70%)' }}/>
            <div style={{ position:'absolute', bottom:'-20px', left:'-20px', width:100, height:100, borderRadius:'50%', background:'radial-gradient(circle,rgba(0,0,0,0.07) 0%,transparent 70%)' }}/>
            <p style={{ fontSize:10, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'rgba(255,255,255,0.72)', marginBottom:4, position:'relative', zIndex:1 }}>あなたのトナメ偏差値</p>
            <div style={{ display:'flex', alignItems:'flex-end', gap:10, position:'relative', zIndex:1 }}>
              <p style={{ fontSize:40, fontWeight:900, color:'white', letterSpacing:'-1px', lineHeight:1 }}>65.75</p>
              <div style={{ background:'rgba(255,255,255,0.22)', borderRadius:99, padding:'3px 9px', marginBottom:4 }}>
                <p style={{ fontSize:11, fontWeight:700, color:'white' }}>全国 12位</p>
              </div>
            </div>
            <p style={{ fontSize:11, color:'rgba(255,255,255,0.65)', marginTop:5, position:'relative', zIndex:1 }}>ROI: 122.4% · インマネ率: 34.2%</p>
          </div>
          <div style={{ padding:'14px 16px' }}>
            <p style={{ fontSize:12, color:'var(--label2)', lineHeight:1.65 }}>
              ROIとインマネ率から計算されるトーナメントの実力指数。参加した回数が増えるほど精度が上がります。
            </p>
            <p style={{ fontSize:10, color:'var(--gold-dk)', fontWeight:600, marginTop:6, marginBottom:4 }}>※ これはイメージです</p>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════
          Tips ローテーター
      ════════════════════════════════ */}
      <section style={{ padding:'0 20px 16px', maxWidth:480, margin:'0 auto' }}>
        <div className="d6 ios-card" style={{ padding:'14px 16px', display:'flex', alignItems:'flex-start', gap:10 }}>
          <div style={{ width:30, height:30, borderRadius:'50%', background:'rgba(242,169,0,0.1)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:1 }}>
            <span style={{ fontSize:14 }}>💡</span>
          </div>
          <p className="tip-txt" style={{ fontSize:13, color:'#8a6200', lineHeight:1.65, fontWeight:500 }}>
            {TIPS[tipIndex]}
          </p>
        </div>
      </section>

      {/* ════════════════════════════════
          Final CTA
      ════════════════════════════════ */}
      <section style={{ padding:'0 20px 48px', maxWidth:480, margin:'0 auto' }}>
        <div className="d7 ios-card" style={{ padding:24, textAlign:'center' }}>
          <div style={{ display:'flex', justifyContent:'center', marginBottom:14 }}>
            <img src="/logo.png" alt="RRPoker" className="pop" style={{ width:64, height:64, borderRadius:18, objectFit:'cover', boxShadow:'0 6px 20px rgba(242,169,0,0.28)' }}/>
          </div>
          <h2 style={{ fontSize:20, fontWeight:800, color:'var(--label)', letterSpacing:'-0.4px', marginBottom:6 }}>
            RRPokerをはじめよう
          </h2>
          <p style={{ fontSize:13, color:'var(--label2)', lineHeight:1.7, marginBottom:20 }}>
            店舗チェックイン・バンクロール管理・RR Rating・<br/>ランキングをすべて無料で。
          </p>
          <button className="cta-primary" onClick={() => router.push('/login')}
            style={{ width:'100%', height:52, borderRadius:16, fontSize:16, fontWeight:800, color:'#1a1a1a', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}
          >
            ログイン / 新規登録
            <span className="arrow-bounce">→</span>
          </button>
        </div>
      </section>

      {/* ════════════════════════════════
          フッター
      ════════════════════════════════ */}
      <footer style={{ padding:'0 20px 44px', textAlign:'center', maxWidth:480, margin:'0 auto' }}>
        <div style={{ height:1, background:'var(--sep)', marginBottom:20 }}/>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, marginBottom:12 }}>
          <img src="/logo.png" alt="RRPoker" style={{ width:28, height:28, borderRadius:8, objectFit:'cover' }}/>
          <span style={{ fontSize:13, fontWeight:700, color:'var(--label2)' }}>RRPOKER</span>
        </div>
        <p style={{ fontSize:10, color:'var(--label3)', marginBottom:3 }}>ver 1.4.9</p>
        <p style={{ fontSize:10, color:'var(--label3)', marginBottom:3 }}>RRPoker by Runner Runner</p>
        <p style={{ fontSize:10, color:'var(--label3)' }}>製作者 : なおゆき</p>
        <div style={{ marginTop:16 }}>
          <button type="button" onClick={() => router.push('/store-register')}
            style={{ fontSize:12, color:'rgba(60,60,67,0.45)', background:'rgba(60,60,67,0.05)', border:'1px solid rgba(60,60,67,0.1)', borderRadius:99, cursor:'pointer', padding:'7px 16px', display:'inline-flex', alignItems:'center', gap:5 }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><polyline points="9,22 9,12 15,12 15,22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            店舗の方はこちら
          </button>
        </div>
      </footer>
    </div>
  )
}