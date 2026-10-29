'use client'
import { ChartColumnIcon, CheckIcon, HouseIcon, MegaphoneIcon, TargetIcon, TimerIcon, TrophyIcon, WalletIcon } from 'lucide-react'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { auth, db } from '@/lib/firebase'
import { doc, getDoc } from 'firebase/firestore'
import { Section } from '@/components/GroupedList'

// アイコンの地色は iOS の標準色。文字は白い面の上の濃い灰(--label / --label2)だけを使う。
const STORE_FEATURES = [
  { icon: TrophyIcon, title: 'トーナメント管理', desc: 'エントリー・リエントリー・アドオンを自動集計', color: '#F9B318' },
  { icon: WalletIcon, title: 'チップ残高管理', desc: '購入・引き出しをリアルタイムで管理', color: '#34C759' },
  { icon: ChartColumnIcon, title: '純増ランキング', desc: 'プレイヤーの純増を自動でランキング表示', color: '#1546D9' },
  { icon: TimerIcon, title: 'ブラインドタイマー', desc: 'カスタム構成を保存してすぐに再利用', color: '#FF9500' },
  { icon: MegaphoneIcon, title: 'お知らせ配信', desc: 'チェックイン中の全員に一斉送信', color: '#AF52DE' },
  { icon: TargetIcon, title: 'RR Rating連携', desc: 'トナメ結果がプレイヤーの偏差値に反映', color: '#FF3B30' },
]

export default function StoreWelcomePage() {
  const router = useRouter()
  const [name, setName] = useState('')

  useEffect(() => {
    const fetchName = async () => {
      const user = auth.currentUser
      if (!user) return
      const snap = await getDoc(doc(db, 'users', user.uid))
      setName(snap.data()?.name ?? '')
    }
    fetchName()
  }, [])

  return (
    <main style={{ minHeight: '100dvh', background: '#EDECE6' }}>
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '0 16px calc(32px + env(safe-area-inset-bottom, 0px))' }}>

        <div className="su d0" style={{ textAlign: 'center', paddingTop: 64, paddingBottom: 32 }}>
          {/* 金の面の上は白 */}
          <div style={{ width: 80, height: 80, borderRadius: 24, background: '#F9B318', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(249,179,24,0.3)', marginBottom: 24 }}>
            <CheckIcon size={40} strokeWidth={3} color="#fff" />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.25, color: 'var(--label)', margin: 0 }}>
            {name ? `${name}さん、` : ''}ようこそ
          </h1>
          <p style={{ fontSize: 14, color: 'var(--label2)', lineHeight: 1.5, margin: '8px 0 0' }}>
            店舗の登録が終わりました。<br />次の機能がすぐに使えます。
          </p>
        </div>

        <div className="su d1">
          <Section header="店舗でできること">
            {STORE_FEATURES.map(f => {
              const Icon = f.icon
              return (
                <div key={f.title} className="gl-row" style={{ display: 'flex', alignItems: 'center', gap: 16, minHeight: 64, padding: '8px 16px' }}>
                  <span style={{ width: 32, height: 32, borderRadius: 8, background: f.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={18} color="#fff" />
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 14, color: 'var(--label)' }}>{f.title}</span>
                    <span style={{ display: 'block', fontSize: 11, color: 'var(--label2)', marginTop: 2 }}>{f.desc}</span>
                  </span>
                </div>
              )
            })}
          </Section>

          <Section header="はじめに" footer="チップ単位・店舗情報・リングゲームのブラインドは、設定画面からいつでも変えられます。">
            <div className="gl-row" style={{ padding: '16px 16px', fontSize: 13, lineHeight: 1.6, color: 'var(--label)' }}>
              プレイヤーに<strong>6桁の店舗コード</strong>を伝えるだけで、チェックインしてもらえます。コードは店舗の管理画面で確認できます。
            </div>
          </Section>
        </div>

        <div className="su d2">
          <button type="button" onClick={() => router.replace('/home/store')} className="gl-press"
            style={{ width: '100%', minHeight: 54, borderRadius: 14, border: 'none', background: '#F9B318', color: '#fff', fontSize: 14, fontWeight: 600, fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer' }}>
            <HouseIcon size={20} />
            店舗管理をはじめる
          </button>
        </div>
      </div>
    </main>
  )
}
