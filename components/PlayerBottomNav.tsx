'use client'

import { useState, useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import { auth, db } from '@/lib/firebase'
import { doc, onSnapshot } from 'firebase/firestore'
import { FiHome, FiUser, FiCreditCard } from 'react-icons/fi'
import { MdQrCode2 } from 'react-icons/md'
import PlayerQRModal from '@/app/components/PlayerQRModal'
import { hapticTap } from '@/lib/haptics'

type ActiveTab = 'home' | 'action' | 'mypage'

const TOOLS_ITEMS = [
  { key: 'itm',         label: 'インマネ確率予測', event: 'rrpoker:tool:itm' },
  { key: 'hand-record', label: 'ハンド記録',       event: 'rrpoker:tool:hand-record' },
] as const

// ── レスポンシブスケーリング定数（TimerClient と同じ方式）
// 基準幅 390px（iPhone 標準）に対する比率で全要素をスケール
const DESIGN_W  = 390   // ベース設計幅
const SCALE_MAX = 1.7   // 最大スケール（これ以上は大きくしない）
const SCALE_MIN = 0.80  // 最小スケール（極小画面でも崩れない）

const GLASS: React.CSSProperties = {
  borderRadius: 9999,
  background: 'rgba(255,255,255,0.14)',
  backdropFilter: 'blur(100px) saturate(1.8) brightness(1.12)',
  WebkitBackdropFilter: 'blur(100px) saturate(1.8) brightness(1.12)',
  border: '1px solid rgba(255,255,255,0.55)',
  boxShadow: '0 20px 60px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.10), inset 0 1.5px 0 rgba(255,255,255,0.85), inset 0 -1px 0 rgba(255,255,255,0.20)',
}

function getActiveTab(pathname: string): ActiveTab {
  if (pathname.startsWith('/home/mypage') || pathname.startsWith('/home/history')) return 'mypage'
  if (
    pathname.startsWith('/home/transactions') ||
    pathname.startsWith('/home/tickets') ||
    pathname.startsWith('/home/withdraw')
  ) return 'action'
  return 'home'
}

// インジケーター中心位置を計算（flex:1×3列で各ボタン中心が 1/6, 1/2, 5/6）
function indLeftFor(tab: ActiveTab, half: number): string {
  if (tab === 'home')   return `calc(100% / 6 - ${half}px)`
  if (tab === 'action') return `calc(50% - ${half}px)`
  return `calc(5 * 100% / 6 - ${half}px)`
}

export default function PlayerBottomNav() {
  const router    = useRouter()
  const pathname  = usePathname()
  const activeTab = getActiveTab(pathname)

  const [currentStoreId, setCurrentStoreId] = useState<string | null>(null)
  const [userId,   setUserId]   = useState<string | null>(null)
  const [userName, setUserName] = useState('')
  const [userIcon, setUserIcon] = useState<string | undefined>(undefined)
  const [isQROpen,  setIsQROpen]  = useState(false)
  const [toolsOpen, setToolsOpen] = useState(false)

  // ── レスポンシブスケール state
  const [navScale, setNavScale] = useState(1)

  const [indLeft,    setIndLeft]    = useState(indLeftFor(activeTab, 17))
  const [indVisible, setIndVisible] = useState(activeTab !== 'action')
  const [transition, setTransition] = useState(false)

  // ── 画面サイズに合わせてスケールを計算（resize 対応）
  useEffect(() => {
    const compute = () => {
      const available = window.innerWidth - 16  // 8px × 両端
      const s = Math.min(Math.max(available / DESIGN_W, SCALE_MIN), SCALE_MAX)
      setNavScale(s)
    }
    compute()
    window.addEventListener('resize', compute)
    return () => window.removeEventListener('resize', compute)
  }, [])

  // ── マウント時のインジケーターアニメーション（前タブ → 現タブへスライド）
  useEffect(() => {
    const stored = sessionStorage.getItem('rrpoker.nav.player') as ActiveTab | null
    const prev   = stored ?? activeTab
    const half   = 17  // mount 時は scale=1 なので 17px 固定
    setTransition(false)
    setIndLeft(indLeftFor(prev, half))
    setIndVisible(prev !== 'action')
    requestAnimationFrame(() => requestAnimationFrame(() => {
      setTransition(true)
      setIndLeft(indLeftFor(activeTab, half))
      setIndVisible(activeTab !== 'action')
    }))
    sessionStorage.setItem('rrpoker.nav.player', activeTab)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── navScale 変更時にインジケーター位置を更新（マウント後のみ）
  const isFirstScaleUpdate = useRef(true)
  useEffect(() => {
    if (isFirstScaleUpdate.current) { isFirstScaleUpdate.current = false; return }
    const half = Math.round(17 * navScale)
    setIndLeft(indLeftFor(activeTab, half))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navScale])

  // ── スケールから派生するサイズ（すべて navScale に比例）
  const navH       = Math.round(56 * navScale)   // ピル高さ＆Toolsボタン
  const circleSize = Math.round(42 * navScale)   // センター円
  const indSize    = Math.round(34 * navScale)   // インジケーター
  const iconSize   = Math.round(20 * navScale)   // アイコン
  const labelSize  = Math.max(7, Math.round(9 * navScale))   // タブラベル
  const itemGap    = Math.max(2, Math.round(3 * navScale))   // アイコン↔ラベル間
  const navGap     = Math.max(3, Math.round(4 * navScale))   // ピル↔Tools間
  const padTop     = Math.round(6 * navScale)
  const padH       = Math.round(8 * navScale)    // Tools popup gap
  const toolsH     = Math.round(42 * navScale)
  const toolsMinW  = Math.round(140 * navScale)
  const toolsPad   = Math.round(16 * navScale)
  const toolsFont  = Math.max(10, Math.round(12 * navScale))
  const plusFont   = Math.max(13, Math.round(16 * navScale))
  const toolsLabel = Math.max(7,  Math.round(8  * navScale))

  useEffect(() => {
    let unsubSnap: (() => void) | null = null
    const unsubAuth = auth.onAuthStateChanged(user => {
      unsubSnap?.()
      if (!user) { setUserId(null); setCurrentStoreId(null); return }
      setUserId(user.uid)
      unsubSnap = onSnapshot(doc(db, 'users', user.uid), snap => {
        const d = snap.data()
        setCurrentStoreId(d?.currentStoreId ?? null)
        setUserName(d?.name ?? '')
        setUserIcon(d?.iconUrl)
      }, () => {})
    })
    return () => { unsubAuth(); unsubSnap?.() }
  }, [])

  const handleCenter = () => {
    hapticTap()
    setIsQROpen(true)
  }

  const col = (tab: ActiveTab) => ({
    color:      activeTab === tab ? '#F2A900' : '#3C3C43',
    fontWeight: activeTab === tab ? 700 : 400,
  })

  const handleToolItem = (event: string) => {
    setToolsOpen(false)
    window.dispatchEvent(new CustomEvent(event))
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
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 79 }}
          onClick={() => setToolsOpen(false)}
        />
      )}

      {/* 画面幅いっぱいに広がり、navScale に応じて高さ・サイズが比例変化 */}
      <nav style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 80,
        paddingTop: padTop,
        paddingBottom: `max(${Math.round(10 * navScale)}px, env(safe-area-inset-bottom))`,
        paddingLeft: 8,
        paddingRight: 8,
      }}>
        {/* maxWidth 廃止 → 画面幅いっぱいに配置 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: navGap }}>

          {/* ── メインピル ── */}
          <div style={{
            ...GLASS,
            flex: 1,
            minWidth: 0,
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            height: navH,
            padding: 0,
          }}>
            {/* インジケーター（スケール比例サイズ） */}
            <div style={{
              position: 'absolute',
              left: indLeft,
              top: '50%',
              transform: 'translateY(-50%)',
              width: indSize,
              height: indSize,
              borderRadius: '50%',
              background: 'rgba(242,169,0,0.14)',
              opacity: indVisible ? 1 : 0,
              transition: transition
                ? 'left 0.5s cubic-bezier(0.34,1.56,0.64,1), opacity 0.25s ease'
                : 'opacity 0.25s ease',
              pointerEvents: 'none',
            }} />

            {/* ホーム */}
            <button
              type="button"
              onClick={() => { hapticTap(); router.push('/home') }}
              style={{ flex: 1, ...col('home'), background: 'none', border: 'none', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: itemGap, padding: 0 }}
            >
              <FiHome size={iconSize} />
              <span style={{ fontSize: labelSize, fontWeight: col('home').fontWeight }}>ホーム</span>
            </button>

            {/* センター（QR / 取引） */}
            <button
              type="button"
              onClick={handleCenter}
              data-tutorial="nav-qr"
              style={{ flex: 1, background: 'none', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
            >
              <div style={{
                width: circleSize,
                height: circleSize,
                borderRadius: '50%',
                background: 'linear-gradient(135deg,#F2A900,#D4910A)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: activeTab === 'action'
                  ? '0 4px 18px rgba(242,169,0,0.70), 0 0 0 4px rgba(242,169,0,0.18)'
                  : '0 4px 14px rgba(242,169,0,0.45)',
                transition: 'box-shadow 0.35s ease',
              }}>
                <MdQrCode2 size={Math.round(22 * navScale)} style={{ color: '#fff' }} />
              </div>
            </button>

            {/* マイページ */}
            <button
              type="button"
              onClick={() => { hapticTap(); router.push('/home/mypage') }}
              style={{ flex: 1, ...col('mypage'), background: 'none', border: 'none', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: itemGap, padding: 0 }}
            >
              <FiUser size={iconSize} />
              <span style={{ fontSize: labelSize, fontWeight: col('mypage').fontWeight }}>マイページ</span>
            </button>
          </div>

          {/* ── Tools ピル（正方形、メインピルと高さ一致） ── */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            {toolsOpen && (
              <div style={{
                position: 'absolute',
                bottom: '100%',
                right: 0,
                paddingBottom: padH,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                gap: padH,
              }}>
                {TOOLS_ITEMS.map((item, i) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => handleToolItem(item.event)}
                    style={{
                      ...GLASS,
                      height: toolsH,
                      minWidth: toolsMinW,
                      padding: `0 ${toolsPad}px`,
                      border: 'none',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      animation: `toolsItemIn 0.32s cubic-bezier(0.34,1.56,0.64,1) both`,
                      animationDelay: `${i * 0.06}s`,
                    }}
                  >
                    <span style={{ fontSize: toolsFont, fontWeight: 700, color: '#1C1C1E' }}>{item.label}</span>
                  </button>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() => setToolsOpen(prev => !prev)}
              style={{
                ...GLASS,
                width: navH,
                height: navH,
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: Math.max(1, Math.round(2 * navScale)),
                boxShadow: toolsOpen
                  ? '0 20px 60px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.10), inset 0 1.5px 0 rgba(255,255,255,0.85), inset 0 -1px 0 rgba(255,255,255,0.20), 0 0 0 3px rgba(242,169,0,0.30)'
                  : GLASS.boxShadow,
                transition: 'transform 0.15s ease, box-shadow 0.2s ease',
              }}
            >
              {toolsOpen ? (
                <span style={{ fontSize: plusFont, color: '#3C3C43', fontWeight: 300 }}>✕</span>
              ) : (
                <>
                  <span style={{ fontSize: plusFont, fontWeight: 900, color: '#F2A900', lineHeight: 1 }}>+</span>
                  <span style={{ fontSize: toolsLabel, fontWeight: 700, color: '#3C3C43', letterSpacing: 0.2 }}>Tools</span>
                </>
              )}
            </button>
          </div>

        </div>
      </nav>

      {isQROpen && userId && createPortal(
        <PlayerQRModal uid={userId} name={userName} iconUrl={userIcon} onClose={() => setIsQROpen(false)} />,
        document.body
      )}
    </>
  )
}
