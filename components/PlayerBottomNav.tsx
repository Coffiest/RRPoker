'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { usePathname, useRouter } from 'next/navigation'
import { auth, db } from '@/lib/firebase'
import { doc, onSnapshot } from 'firebase/firestore'
import { FiHome, FiUser } from 'react-icons/fi'
import { MdQrCode2 } from 'react-icons/md'
import PlayerQRModal from '@/app/components/PlayerQRModal'
import { hapticTap } from '@/lib/haptics'
import { computeNavLayout, indicatorCenterRatio } from '@/lib/navLayout'

/**
 * プレイヤー用のフッターメニュー。
 *
 * 構成は ホーム / 入店QR / マイページ の3つ。中央のQRは金色の円で強調する。
 * 「インマネ確率予測」「ハンド記録」は右のツールから開く。
 *
 * 寸法は lib/navLayout.ts の純粋な計算に委ねる。以前は「画面幅 ÷ 設計幅」だけで
 * 決めており、タブ本数もラベルが入る幅も考慮していなかったため、狭い画面で
 * はみ出していた。幅と本数の両方から「入る大きさ」を逆算する。
 */

type TabKey = 'home' | 'action' | 'mypage'

/** ツールの中身。グローバルイベントで各画面のモーダルを開く。 */
const TOOLS_ITEMS = [
  { key: 'itm',         label: 'インマネ確率予測', event: 'rrpoker:tool:itm' },
  { key: 'hand-record', label: 'ハンド記録',       event: 'rrpoker:tool:hand-record' },
] as const

/** ピルの中に並ぶ列の数(ホーム / QR / マイページ)。 */
const TAB_COUNT = 3
/** 中央(QR)の位置。 */
const CENTER_INDEX = 1

const GLASS: React.CSSProperties = {
  borderRadius: 9999,
  background: 'rgba(255,255,255,0.14)',
  backdropFilter: 'blur(100px) saturate(1.8) brightness(1.12)',
  WebkitBackdropFilter: 'blur(100px) saturate(1.8) brightness(1.12)',
  border: '1px solid rgba(255,255,255,0.55)',
  boxShadow: '0 20px 60px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.10), inset 0 1.5px 0 rgba(255,255,255,0.85), inset 0 -1px 0 rgba(255,255,255,0.20)',
}

/** パスから選択中のタブを決める。 */
export function activeTabFor(pathname: string): TabKey {
  if (pathname.startsWith('/home/mypage') || pathname.startsWith('/home/history')) return 'mypage'
  if (
    pathname.startsWith('/home/transactions') ||
    pathname.startsWith('/home/tickets') ||
    pathname.startsWith('/home/withdraw')
  ) return 'action'
  return 'home'
}

const TAB_INDEX: Record<TabKey, number> = { home: 0, action: 1, mypage: 2 }

export default function PlayerBottomNav() {
  const router    = useRouter()
  const pathname  = usePathname()
  const activeTab = activeTabFor(pathname)
  const activeIndex = TAB_INDEX[activeTab]

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

  const L = computeNavLayout(viewportWidth, TAB_COUNT)

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

  const go = (href: string) => { hapticTap(); router.push(href) }

  const handleToolItem = (event: string) => {
    setToolsOpen(false)
    window.dispatchEvent(new CustomEvent(event))
  }

  /** アイコン+ラベルの列(ホーム / マイページ)。 */
  const sideTab = (key: TabKey, label: string, href: string, Icon: typeof FiHome) => {
    const isActive = activeTab === key
    return (
      <button
        type="button"
        onClick={() => go(href)}
        style={{
          flex: 1, minWidth: 0, background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: L.itemGap,
          padding: 0, overflow: 'hidden',
          color: isActive ? '#F2A900' : '#3C3C43',
          fontWeight: isActive ? 700 : 400,
        }}
      >
        <Icon size={L.iconSize} style={{ flexShrink: 0 }} />
        {/* ラベルは折り返さない。折り返すとピルの高さを超えて外へあふれる。 */}
        <span style={{
          fontSize: L.labelSize,
          fontWeight: isActive ? 700 : 400,
          letterSpacing: '0.06em',
          maxWidth: '100%',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          lineHeight: 1.1,
        }}>{label}</span>
      </button>
    )
  }

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
              left: `calc(${indicatorCenterRatio(activeIndex, TAB_COUNT) * 100}% - ${L.indicatorSize / 2}px)`,
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

            {sideTab('home', 'ホーム', '/home', FiHome)}

            {/* 中央: 入店QR */}
            <button
              type="button"
              onClick={() => { hapticTap(); setIsQROpen(true) }}
              aria-label="入店QRを表示"
              data-tutorial="nav-qr"
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
                boxShadow: activeTab === 'action'
                  ? '0 4px 18px rgba(242,169,0,0.70), 0 0 0 4px rgba(242,169,0,0.18)'
                  : '0 4px 14px rgba(242,169,0,0.45)',
                transition: 'box-shadow 0.35s ease',
              }}>
                <MdQrCode2 size={Math.round(L.iconSize * 1.1)} style={{ color: '#fff' }} />
              </div>
            </button>

            {sideTab('mypage', 'マイページ', '/home/mypage', FiUser)}
          </div>

          {/* ── ツール(正方形、メインピルと高さ一致) ── */}
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
                    onClick={() => handleToolItem(item.event)}
                    style={{
                      ...GLASS,
                      height: Math.round(42 * L.scale),
                      // 画面の外へ出ないよう、端末幅からも上限をかける。
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
                boxShadow: toolsOpen
                  ? '0 20px 60px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.10), inset 0 1.5px 0 rgba(255,255,255,0.85), inset 0 -1px 0 rgba(255,255,255,0.20), 0 0 0 3px rgba(242,169,0,0.30)'
                  : GLASS.boxShadow,
                transition: 'box-shadow 0.2s ease',
              }}
            >
              <span style={{ fontSize: Math.max(13, Math.round(16 * L.scale)), fontWeight: toolsOpen ? 300 : 900, color: toolsOpen ? '#3C3C43' : '#F2A900', lineHeight: 1 }}>
                {toolsOpen ? '×' : '+'}
              </span>
              <span style={{ fontSize: Math.max(7, Math.round(8 * L.scale)), fontWeight: 700, color: '#3C3C43', letterSpacing: '0.06em', lineHeight: 1 }}>ツール</span>
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
