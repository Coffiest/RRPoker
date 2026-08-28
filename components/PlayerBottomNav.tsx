'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { usePathname, useRouter } from 'next/navigation'
import { auth, db } from '@/lib/firebase'
import { doc, onSnapshot } from 'firebase/firestore'
import { FiHome, FiUser, FiDatabase, FiClock } from 'react-icons/fi'
import { MdStyle } from 'react-icons/md'
import PlayerQRModal from '@/app/components/PlayerQRModal'
import { hapticTap } from '@/lib/haptics'
import { computeNavLayout, indicatorCenterRatio } from '@/lib/navLayout'

/**
 * プレイヤー用のフッターメニュー。
 *
 * ライブポーカー(RRPoker本体)とオンライン(Poker ART)の両方の入口をここに集約する。
 * 中央の「プレイ」は Poker ART の卓へ入る導線で、以前のQRボタンと同じ強調にしている。
 * 中央を明け渡した入店QRは右の「ツール」へ移した。従来どおり1タップで出せる
 * (ホーム画面の入店導線もそのまま残っている)。
 *
 * 寸法は lib/navLayout.ts の純粋な計算に委ねる。画面幅とタブ本数の両方から
 * 「入る大きさ」を逆算するので、タブを増やしても狭い画面でも収まる。
 */

type TabKey = 'home' | 'database' | 'play' | 'history' | 'mypage'

interface TabDef {
  key: TabKey
  label: string
  href: string
  /** この配下のパスにいるときもこのタブを選択状態にする。 */
  match: string[]
  icon: typeof FiHome
}

const TABS: TabDef[] = [
  { key: 'home',     label: 'ホーム',     href: '/home',              match: ['/home'], icon: FiHome },
  { key: 'database', label: 'データベース', href: '/home/art/database', match: ['/home/art/database'], icon: FiDatabase },
  { key: 'play',     label: 'プレイ',     href: '/home/art/table',    match: ['/home/art/table'], icon: MdStyle },
  { key: 'history',  label: 'ヒストリー',  href: '/home/art/hands',    match: ['/home/art/hands', '/home/history'], icon: FiClock },
  { key: 'mypage',   label: 'マイページ',  href: '/home/mypage',       match: ['/home/mypage', '/home/transactions', '/home/tickets', '/home/withdraw'], icon: FiUser },
]

/** 中央で強調するタブ(以前のQRボタンと同じ見せ方)。 */
const CENTER_INDEX = TABS.findIndex((t) => t.key === 'play')

/** ツールの中身。`event` を持つものはグローバルイベントを飛ばし、
 *  `action: 'qr'` は入店QRを開く。 */
const TOOLS_ITEMS = [
  { key: 'qr',          label: '入店QRを表示',     action: 'qr' as const },
  { key: 'itm',         label: 'インマネ確率予測', event: 'rrpoker:tool:itm' },
  { key: 'hand-record', label: 'ハンド記録',       event: 'rrpoker:tool:hand-record' },
] as const

const GLASS: React.CSSProperties = {
  borderRadius: 9999,
  background: 'rgba(255,255,255,0.14)',
  backdropFilter: 'blur(100px) saturate(1.8) brightness(1.12)',
  WebkitBackdropFilter: 'blur(100px) saturate(1.8) brightness(1.12)',
  border: '1px solid rgba(255,255,255,0.55)',
  boxShadow: '0 20px 60px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.10), inset 0 1.5px 0 rgba(255,255,255,0.85), inset 0 -1px 0 rgba(255,255,255,0.20)',
}

/** パスから選択中のタブを決める。長いパスから順に見て、より具体的な一致を優先する。 */
export function activeTabFor(pathname: string): TabKey {
  let best: { key: TabKey; length: number } | null = null
  for (const tab of TABS) {
    for (const prefix of tab.match) {
      if (pathname === prefix || pathname.startsWith(prefix + '/')) {
        if (!best || prefix.length > best.length) best = { key: tab.key, length: prefix.length }
      }
    }
  }
  return best?.key ?? 'home'
}

export default function PlayerBottomNav() {
  const router   = useRouter()
  const pathname = usePathname()
  const activeKey  = activeTabFor(pathname)
  const activeIndex = Math.max(0, TABS.findIndex((t) => t.key === activeKey))

  const [userId,   setUserId]   = useState<string | null>(null)
  const [userName, setUserName] = useState('')
  const [userIcon, setUserIcon] = useState<string | undefined>(undefined)
  const [isQROpen,  setIsQROpen]  = useState(false)
  const [toolsOpen, setToolsOpen] = useState(false)

  // 画面幅から寸法を決める。初期値は設計幅にしておき、マウント後に実寸で置き換える。
  const [viewportWidth, setViewportWidth] = useState(390)
  useEffect(() => {
    const measure = () => setViewportWidth(window.innerWidth)
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  const L = computeNavLayout(viewportWidth, TABS.length)

  // インジケーターは初回だけアニメーションさせずに置く(前タブからのスライドは維持)。
  const [transition, setTransition] = useState(false)
  const firstRender = useRef(true)
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      requestAnimationFrame(() => requestAnimationFrame(() => setTransition(true)))
    }
  }, [])

  useEffect(() => {
    let unsubSnap: (() => void) | null = null
    const unsubAuth = auth.onAuthStateChanged(user => {
      unsubSnap?.()
      if (!user) { setUserId(null); return }
      setUserId(user.uid)
      unsubSnap = onSnapshot(doc(db, 'users', user.uid), snap => {
        const d = snap.data()
        setUserName(d?.name ?? '')
        setUserIcon(d?.iconUrl)
      }, () => {})
    })
    return () => { unsubAuth(); unsubSnap?.() }
  }, [])

  const handleToolItem = (item: (typeof TOOLS_ITEMS)[number]) => {
    setToolsOpen(false)
    if ('action' in item && item.action === 'qr') { setIsQROpen(true); return }
    if ('event' in item) window.dispatchEvent(new CustomEvent(item.event))
  }

  const go = (href: string) => { hapticTap(); router.push(href) }

  return (
    <>
      <style>{`
        @keyframes toolsItemIn {
          from { opacity:0; transform:translateY(16px) scale(0.88); }
          to   { opacity:1; transform:translateY(0) scale(1); }
        }
      `}</style>

      {toolsOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 79 }} onClick={() => setToolsOpen(false)} />
      )}

      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 80,
        paddingTop: L.padTop,
        paddingBottom: `max(${L.padBottom}px, env(safe-area-inset-bottom))`,
        paddingLeft: 8, paddingRight: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: L.navGap }}>

          {/* ── メインピル ── */}
          <div style={{
            ...GLASS,
            flex: 1,
            minWidth: 0,
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            height: L.navH,
            padding: 0,
            overflow: 'hidden',
          }}>
            {/* 選択中タブの背後の円 */}
            <div style={{
              position: 'absolute',
              left: `calc(${indicatorCenterRatio(activeIndex, TABS.length) * 100}% - ${L.indicatorSize / 2}px)`,
              top: '50%',
              transform: 'translateY(-50%)',
              width: L.indicatorSize,
              height: L.indicatorSize,
              borderRadius: '50%',
              background: 'rgba(242,169,0,0.14)',
              opacity: activeIndex === CENTER_INDEX ? 0 : 1,
              transition: transition
                ? 'left 0.5s cubic-bezier(0.34,1.56,0.64,1), opacity 0.25s ease'
                : 'opacity 0.25s ease',
              pointerEvents: 'none',
            }} />

            {TABS.map((tab, i) => {
              const isActive = i === activeIndex
              const IconComponent = tab.icon

              // 中央のタブは以前のQRボタンと同じ強調(金色の円)にする。
              if (i === CENTER_INDEX) {
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => go(tab.href)}
                    aria-label={tab.label}
                    data-tutorial="nav-play"
                    style={{
                      flex: 1, minWidth: 0, background: 'none', border: 'none', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                    }}
                  >
                    <div style={{
                      width: L.circleSize, height: L.circleSize, borderRadius: '50%',
                      background: 'linear-gradient(135deg,#F2A900,#D4910A)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                      boxShadow: isActive
                        ? '0 4px 18px rgba(242,169,0,0.70), 0 0 0 4px rgba(242,169,0,0.18)'
                        : '0 4px 14px rgba(242,169,0,0.45)',
                      transition: 'box-shadow 0.35s ease',
                    }}>
                      <IconComponent size={Math.round(L.iconSize * 1.1)} style={{ color: '#fff' }} />
                    </div>
                  </button>
                )
              }

              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => go(tab.href)}
                  style={{
                    flex: 1, minWidth: 0, background: 'none', border: 'none', cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: L.itemGap,
                    padding: 0, overflow: 'hidden',
                    color: isActive ? '#F2A900' : '#3C3C43',
                    fontWeight: isActive ? 700 : 400,
                  }}
                >
                  <IconComponent size={L.iconSize} style={{ flexShrink: 0 }} />
                  {/* ラベルは絶対に折り返さない。列に入りきらなければ末尾を省略する。
                      折り返すとピルの高さを超えて外へあふれるため。 */}
                  <span style={{
                    fontSize: L.labelSize,
                    fontWeight: isActive ? 700 : 400,
                    // main のテック基調刷新に合わせた字送り。
                    letterSpacing: '0.06em',
                    maxWidth: '100%',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    lineHeight: 1.1,
                  }}>{tab.label}</span>
                </button>
              )
            })}
          </div>

          {/* ── Tools ピル(正方形、メインピルと高さ一致) ── */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            {toolsOpen && (
              <div style={{
                position: 'absolute', bottom: '100%', right: 0,
                paddingBottom: Math.round(8 * L.scale),
                display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
                gap: Math.round(8 * L.scale),
              }}>
                {TOOLS_ITEMS.map((item, i) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => handleToolItem(item)}
                    style={{
                      ...GLASS,
                      height: Math.round(42 * L.scale),
                      minWidth: Math.min(Math.round(140 * L.scale), Math.max(120, viewportWidth - 32)),
                      padding: `0 ${Math.round(16 * L.scale)}px`,
                      border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      animation: `toolsItemIn 0.32s cubic-bezier(0.34,1.56,0.64,1) both`,
                      animationDelay: `${i * 0.06}s`,
                    }}
                  >
                    <span style={{ fontSize: Math.max(10, Math.round(12 * L.scale)), fontWeight: 700, color: '#1C1C1E' }}>{item.label}</span>
                  </button>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() => { hapticTap(); setToolsOpen(v => !v) }}
              aria-label="ツール"
              style={{
                ...GLASS,
                width: L.navH, height: L.navH,
                border: 'none', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 1, padding: 0,
              }}
            >
              <span style={{ fontSize: Math.max(13, Math.round(16 * L.scale)), fontWeight: 300, color: '#3C3C43', lineHeight: 1 }}>
                {toolsOpen ? '×' : '+'}
              </span>
              <span style={{ fontSize: Math.max(7, Math.round(8 * L.scale)), color: '#3C3C43', lineHeight: 1 }}>ツール</span>
            </button>
          </div>
        </div>
      </nav>

      {isQROpen && userId && typeof document !== 'undefined' && createPortal(
        <PlayerQRModal uid={userId} name={userName} iconUrl={userIcon} onClose={() => setIsQROpen(false)} />,
        document.body
      )}
    </>
  )
}
