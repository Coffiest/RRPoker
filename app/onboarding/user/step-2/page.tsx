'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { auth, db } from '@/lib/firebase'
import { doc, getDoc } from 'firebase/firestore'

const FEATURES = [
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="#F2A900" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        <polyline points="9,22 9,12 15,12 15,22" stroke="#F2A900" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    title: '店舗チェックイン',
    desc: '簡単に入店。チップ残高をリアルタイム管理。',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <polyline points="22,12 18,12 15,21 9,3 6,12 2,12" stroke="#F2A900" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    title: 'RR Rating',
    desc: 'ROIとインマネ率からあなたの実力を偏差値で可視化。',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="8" r="4" stroke="#F2A900" strokeWidth="1.8"/>
        <path d="M4 20c0-4 3.582-7 8-7s8 3 8 7" stroke="#F2A900" strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    ),
    title: 'ランキング',
    desc: '純増ランキングで仲間と競い、モチベーションをキープ。',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect x="2" y="5" width="20" height="14" rx="3" stroke="#F2A900" strokeWidth="1.8"/>
        <path d="M2 10h20" stroke="#F2A900" strokeWidth="1.8"/>
      </svg>
    ),
    title: 'チップ管理',
    desc: '購入・引き出し履歴を一覧管理。BBでの表示にも対応。',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" stroke="#F2A900" strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    ),
    title: 'トーナメント履歴',
    desc: '参加したトナメを自動記録。ROI・ITMを統計で確認。',
  },
]

const TIPS = [
  '店舗コードを入力すると、初回でも簡単に入店できます',
  'トーナメントに参加するほどRR Ratingが実力に近づきます',
  'チップ残高はBB表示に切り替えることができます',
  'お気に入り店舗に登録すると素早くアクセスできます',
]

export default function UserWelcomePage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [tipIndex, setTipIndex] = useState(0)
  const [tipVisible, setTipVisible] = useState(true)
  const [featureIndex, setFeatureIndex] = useState(0)

  useEffect(() => {
    const fetchName = async () => {
      const user = auth.currentUser
      if (!user) return
      const snap = await getDoc(doc(db, 'users', user.uid))
      setName(snap.data()?.name ?? '')
    }
    fetchName()
  }, [])

  // Tip rotator
  useEffect(() => {
    const id = setInterval(() => {
      setTipVisible(false)
      setTimeout(() => {
        setTipIndex(i => (i + 1) % TIPS.length)
        setTipVisible(true)
      }, 350)
    }, 3400)
    return () => clearInterval(id)
  }, [])

  // Feature highlight rotator
  useEffect(() => {
    const id = setInterval(() => {
      setFeatureIndex(i => (i + 1) % FEATURES.length)
    }, 2200)
    return () => clearInterval(id)
  }, [])

  return (
    <main style={{ background: '#FFFBF5' }} className="min-h-screen px-5 pb-16">
      <style>{`
        @keyframes slideUp {
          from { opacity:0; transform:translateY(12px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity:0; }
          to   { opacity:1; }
        }
        @keyframes popIn {
          0%   { opacity:0; transform:scale(0.82); }
          70%  { transform:scale(1.06); }
          100% { opacity:1; transform:scale(1); }
        }
        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position:  200% center; }
        }
        @keyframes tipFade {
          from { opacity:0; transform:translateY(5px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes pulse-ring {
          0%   { box-shadow: 0 0 0 0 rgba(242,169,0,0.35); }
          70%  { box-shadow: 0 0 0 14px rgba(242,169,0,0); }
          100% { box-shadow: 0 0 0 0 rgba(242,169,0,0); }
        }
        .d1 { opacity:0; animation: slideUp 0.5s ease-out 0.05s forwards; }
        .d2 { opacity:0; animation: slideUp 0.5s ease-out 0.18s forwards; }
        .d3 { opacity:0; animation: slideUp 0.5s ease-out 0.30s forwards; }
        .d4 { opacity:0; animation: slideUp 0.5s ease-out 0.42s forwards; }
        .d5 { opacity:0; animation: slideUp 0.5s ease-out 0.54s forwards; }
        .d6 { opacity:0; animation: slideUp 0.5s ease-out 0.66s forwards; }
        .pop { animation: popIn 0.55s cubic-bezier(0.22,1,0.36,1) 0.08s both; }

        .profile-card {
          background: linear-gradient(145deg,#fff 0%,#fefefe 100%);
          box-shadow: 0 2px 8px rgba(242,169,0,0.06), 0 8px 24px rgba(0,0,0,0.04);
        }
        .shimmer-text {
          background: linear-gradient(90deg, #D4910A 0%, #F2A900 40%, #ffe066 55%, #F2A900 70%, #D4910A 100%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: shimmer 2.4s linear infinite;
        }
        .btn-primary {
          background: linear-gradient(135deg,#F2A900 0%,#D4910A 100%);
          box-shadow: 0 4px 18px rgba(242,169,0,0.32), 0 1px 3px rgba(0,0,0,0.08);
          transition: transform 0.13s ease, box-shadow 0.13s ease;
          animation: pulse-ring 2s ease-out 1.2s 3;
        }
        .btn-primary:active { transform:scale(0.977); opacity:0.88; }

        .feature-item {
          transition: background 0.25s, border-color 0.25s, box-shadow 0.25s;
        }
        .feature-item.active {
          background: linear-gradient(135deg,#FFF8ED 0%,#FFFBF5 100%);
          border-color: rgba(242,169,0,0.35);
          box-shadow: 0 2px 10px rgba(242,169,0,0.1);
        }
        .tip-box {
          transition: opacity 0.3s ease, transform 0.3s ease;
        }
        .tip-box.hidden-tip {
          opacity:0; transform:translateY(4px);
        }
        .tip-box.shown-tip {
          opacity:1; transform:translateY(0);
          animation: tipFade 0.35s ease-out;
        }
        .divider-line {
          height:1px;
          background: linear-gradient(90deg, transparent, rgba(242,169,0,0.18), transparent);
        }
        .dot {
          width:6px; height:6px; border-radius:9999px;
          background: rgba(242,169,0,0.25);
          transition: background 0.25s, transform 0.25s;
        }
        .dot.active { background:#F2A900; transform:scale(1.3); }
      `}</style>

      <div className="mx-auto max-w-sm">

        {/* Hero */}
        <div className="pt-14 text-center">
          {/* Trophy icon */}
          <div
            className="pop mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-[28px]"
            style={{
              background: 'linear-gradient(135deg,#F2A900 0%,#D4910A 100%)',
              boxShadow: '0 8px 28px rgba(242,169,0,0.32), inset 0 1px 0 rgba(255,255,255,0.25)',
            }}
          >
            <svg width="38" height="38" viewBox="0 0 24 24" fill="none">
              <path d="M6 2h12v8a6 6 0 01-12 0V2z" stroke="white" strokeWidth="1.8" strokeLinejoin="round"/>
              <path d="M6 4H3a1 1 0 00-1 1v2a4 4 0 004 4M18 4h3a1 1 0 011 1v2a4 4 0 01-4 4" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
              <path d="M12 16v4M8 20h8" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </div>

          <div className="d1">
            <p className="text-[13px] font-semibold uppercase tracking-[1px] text-[#F2A900] mb-2">
              Welcome
            </p>
            <h1 className="text-[26px] font-bold tracking-[-0.4px] text-gray-900 leading-tight">
              <span className="shimmer-text">{name || 'プレイヤー'}</span>
              <span className="text-gray-900"> さん、</span>
              <br />ようこそ！
            </h1>
            <p className="mt-3 text-[14px] text-gray-500 leading-relaxed">
              セットアップ完了。あなたのポーカーライフが<br />今日からはじまります🎉
            </p>
          </div>
        </div>

        <div className="divider-line mt-7 d2" />

        {/* Feature list */}
        <div className="mt-6 d3">
          <p className="text-[12px] font-semibold uppercase tracking-[0.7px] text-gray-400 mb-3">
            できること
          </p>
          <div className="profile-card rounded-3xl p-3 space-y-1">
            {FEATURES.map((f, i) => (
              <div
                key={i}
                className={`feature-item flex items-start gap-3 rounded-2xl border px-3 py-3 ${
                  i === featureIndex
                    ? 'active border-[rgba(242,169,0,0.35)]'
                    : 'border-transparent'
                }`}
              >
                <div
                  className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl"
                  style={{
                    background: i === featureIndex
                      ? 'linear-gradient(135deg,#FFF0C0,#FFF8E7)'
                      : '#f3f4f6',
                  }}
                >
                  {f.icon}
                </div>
                <div>
                  <p className="text-[14px] font-semibold text-gray-900">{f.title}</p>
                  <p className="text-[12px] text-gray-500 leading-snug mt-0.5">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Dot indicator */}
          <div className="flex justify-center gap-1.5 mt-3">
            {FEATURES.map((_, i) => (
              <div key={i} className={`dot ${i === featureIndex ? 'active' : ''}`} />
            ))}
          </div>
        </div>

        {/* Tip rotator */}
        <div className="mt-5 d4">
          <div
            className="rounded-2xl px-4 py-3 flex items-start gap-2.5"
            style={{
              background: 'linear-gradient(135deg,#FFF8ED,#FFFBF5)',
              border: '1px solid rgba(242,169,0,0.2)',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="mt-0.5 flex-shrink-0">
              <circle cx="12" cy="12" r="10" stroke="#F2A900" strokeWidth="2"/>
              <path d="M12 8v4M12 16h.01" stroke="#F2A900" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <p
              className={`text-[12px] text-[#8a6200] leading-relaxed tip-box ${tipVisible ? 'shown-tip' : 'hidden-tip'}`}
            >
              {TIPS[tipIndex]}
            </p>
          </div>
        </div>

        {/* Stats teaser */}
        <div className="mt-5 grid grid-cols-3 gap-2 d5">
          {[
            { label: 'チップ残高', value: '0', unit: '' },
            { label: 'RR Rating', value: '1000', unit: 'pt' },
            { label: 'トナメ参加', value: '0', unit: '回' },
          ].map((s, i) => (
            <div key={i} className="profile-card rounded-2xl p-3 text-center">
              <p className="text-[10px] text-gray-400 mb-1">{s.label}</p>
              <p className="text-[18px] font-bold text-gray-900">
                {s.value}
                <span className="text-[11px] font-medium text-gray-400 ml-0.5">{s.unit}</span>
              </p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-7 d6">
          <button
            type="button"
            onClick={() => router.replace('/home')}
            className="btn-primary flex h-[54px] w-full items-center justify-center gap-2 rounded-[20px] text-[16px] font-semibold text-gray-900"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M5 12h14M13 6l6 6-6 6" stroke="#1a1a1a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            はじめる
          </button>
          <p className="mt-3 text-center text-[12px] text-gray-400">
            いつでもプロフィールは編集できます
          </p>
        </div>

      </div>
    </main>
  )
}