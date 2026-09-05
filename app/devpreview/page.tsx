'use client'
// 確認用。撮影後に削除する。実画面と同じクラスを当てて見え方だけを確かめる。
import { useState } from 'react'
import AppleSwitch from '@/components/AppleSwitch'
import AppleSheet from '@/components/AppleSheet'
import { FiX, FiStar, FiChevronRight } from 'react-icons/fi'

export default function DevPreview() {
  const [tab, setTab] = useState<'home' | 'settings' | 'sheet'>('home')
  const [sw1, setSw1] = useState(true)
  const [sw2, setSw2] = useState(false)
  const [sw3, setSw3] = useState(true)
  const [sheet, setSheet] = useState(false)

  return (
    <div className="a-app-bg" style={{ minHeight: '100vh', padding: '16px 16px 40px' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(['home', 'settings', 'sheet'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`a-btn a-btn-sm ${tab === t ? 'a-btn-filled' : 'a-btn-glass'}`}>{t}</button>
        ))}
      </div>

      {tab === 'home' && (
        <>
          <p className="a-section-hd">残高</p>
          <div className="section-card" style={{ marginBottom: 16 }}>
            <p className="a-eyebrow" style={{ marginBottom: 6 }}>Runner Runner Izuka</p>
            <p className="a-display">8,944</p>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button className="gold-btn" style={{ flex: 1, height: 50, fontSize: 15, fontWeight: 700, color: '#1C1C1E', border: 'none' }}>入店する</button>
              <button className="outline-gold-btn" style={{ flex: 1, height: 50, fontSize: 14, fontWeight: 700 }}>履歴</button>
            </div>
          </div>

          <p className="a-section-hd">実施中のトナメ</p>
          <div className="section-card" style={{ marginBottom: 16 }}>
            <p className="a-title">新人王決定戦</p>
            <p className="a-display" style={{ marginTop: 8 }}>06:53</p>
            <p className="a-caption" style={{ marginTop: 4 }}>BLIND 2,000 / 4,000 · ANTE 4,000</p>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button className="a-btn a-btn-tinted" style={{ flex: 1 }}>リエントリー</button>
              <button className="a-btn a-btn-tinted" style={{ flex: 1 }}>アドオン</button>
            </div>
          </div>

          <p className="a-section-hd">お気に入り店舗</p>
          <div className="a-list">
            {['Runner Runner Izuka', 'Runner Runner 北九州', 'Poker Room Hakata'].map(n => (
              <button key={n} className="a-row" onClick={() => setSheet(true)}>
                <span className="a-body" style={{ flex: 1 }}>{n}</span>
                <FiChevronRight size={16} style={{ opacity: 0.28 }} />
              </button>
            ))}
          </div>
        </>
      )}

      {tab === 'settings' && (
        <>
          <p className="a-section-hd">店舗設定</p>
          <div className="a-list" style={{ marginBottom: 18 }}>
            <div className="a-row"><span className="a-body" style={{ flex: 1 }}>来店ボーナス</span><AppleSwitch on={sw1} onToggle={() => setSw1(v => !v)} /></div>
            <div className="a-row"><span className="a-body" style={{ flex: 1 }}>入店に承認を必要とする</span><AppleSwitch on={sw2} onToggle={() => setSw2(v => !v)} /></div>
            <div className="a-row"><span className="a-body" style={{ flex: 1 }}>誕生日クーポン</span><AppleSwitch on={sw3} onToggle={() => setSw3(v => !v)} /></div>
          </div>

          <p className="a-section-hd">アカウント</p>
          <div className="a-list" style={{ marginBottom: 18 }}>
            <button className="a-row"><span className="a-body" style={{ flex: 1 }}>パスワードを変更</span><FiChevronRight size={16} style={{ opacity: 0.28 }} /></button>
            <button className="a-row"><span className="a-body" style={{ flex: 1 }}>メールアドレス</span><span className="a-caption">hagi@example.com</span><FiChevronRight size={16} style={{ opacity: 0.28 }} /></button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button className="a-btn a-btn-filled a-btn-block">保存する</button>
            <button className="a-btn a-btn-danger a-btn-block">アカウントを削除</button>
          </div>
        </>
      )}

      {tab === 'sheet' && (
        <>
          <button className="a-btn a-btn-filled a-btn-block" onClick={() => setSheet(true)}>シートを開く</button>
          <div className="a-dialog" style={{ padding: 24, marginTop: 20, textAlign: 'center' }}>
            <p className="a-title" style={{ marginBottom: 6 }}>位置情報の利用</p>
            <p className="a-caption" style={{ marginBottom: 18 }}>近くの店舗を出すために使います</p>
            <button className="a-btn a-btn-filled a-btn-block" style={{ marginBottom: 8 }}>許可する</button>
            <button className="a-btn a-btn-bare a-btn-block">あとで</button>
          </div>
        </>
      )}

      <AppleSheet
        open={sheet}
        onClose={() => setSheet(false)}
        title={
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 34 }}>
            <button className="a-btn a-btn-glass a-btn-icon" style={{ position: 'absolute', left: 0, minHeight: 34, width: 34, color: 'var(--a-label-2)' }} onClick={() => setSheet(false)}><FiX size={17} /></button>
            <p className="a-heading">店舗詳細</p>
            <button className="a-btn a-btn-icon" style={{ position: 'absolute', right: 0, minHeight: 34, width: 34, background: 'rgba(242,169,0,0.16)', color: '#B57F00', boxShadow: 'inset 0 0 0 1px rgba(242,169,0,0.24)' }}><FiStar size={15} /></button>
          </div>
        }
        footer={
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button className="a-btn a-btn-filled a-btn-block" onClick={() => setSheet(false)}>入店する</button>
            <button className="a-btn a-btn-glass a-btn-block">現在入店中のプレイヤーを見る</button>
          </div>
        }
      >
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="a-card" style={{ padding: 16, marginBottom: 10 }}>
            <p className="a-heading">ブロック {i + 1}</p>
            <p className="a-caption">掴んで下げると閉じます</p>
          </div>
        ))}
      </AppleSheet>
    </div>
  )
}
