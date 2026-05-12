'use client'

import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import { auth, db } from '@/lib/firebase'
import { doc, onSnapshot } from 'firebase/firestore'
import { FiHome, FiUser, FiCreditCard } from 'react-icons/fi'
import { MdQrCode2 } from 'react-icons/md'
import PlayerQRModal from '@/app/components/PlayerQRModal'

type ActiveTab = 'home' | 'action' | 'mypage'

const TOOLS_ITEMS = [
  { key: 'itm',         label: 'インマネ確率予測', event: 'rrpoker:tool:itm' },
  { key: 'hand-record', label: 'ハンド記録',       event: 'rrpoker:tool:hand-record' },
] as const

const IND_LEFT: Record<ActiveTab, string> = {
  home:   'calc(100% / 6 - 2px)',
  action: 'calc(50% - 20px)',
  mypage: 'calc(5 * 100% / 6 - 38px)',
}

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

  const [indLeft,    setIndLeft]    = useState(IND_LEFT[activeTab])
  const [indVisible, setIndVisible] = useState(activeTab !== 'action')
  const [transition, setTransition] = useState(false)

  useEffect(() => {
    const stored = sessionStorage.getItem('rrpoker.nav.player') as ActiveTab | null
    const prev   = stored ?? activeTab
    setTransition(false)
    setIndLeft(IND_LEFT[prev])
    setIndVisible(prev !== 'action')
    requestAnimationFrame(() => requestAnimationFrame(() => {
      setTransition(true)
      setIndLeft(IND_LEFT[activeTab])
      setIndVisible(activeTab !== 'action')
    }))
    sessionStorage.setItem('rrpoker.nav.player', activeTab)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
    if (currentStoreId) router.push('/home/transactions')
    else setIsQROpen(true)
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

      {/* nav は padding-bottom で safe area を吸収し、自身は bottom:0 に固定 */}
      <nav style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 80,
        paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
        paddingLeft: 12,
        paddingRight: 12,
      }}>
        <div style={{ maxWidth: 390, margin: '0 auto', display: 'flex', alignItems: 'stretch', gap: 8 }}>

          {/* ── メインピル ── */}
          <div
            style={{
              ...GLASS,
              flex: 1,
              position: 'relative',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              alignItems: 'center',
              padding: '10px 20px',
            }}
          >
            {/* スライドインジケーター */}
            <div style={{
              position: 'absolute',
              left: indLeft,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 40,
              height: 40,
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
              onClick={() => router.push('/home')}
              style={{ ...col('home'), background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}
            >
              <FiHome size={20} />
              <span style={{ fontSize: 9, fontWeight: col('home').fontWeight }}>ホーム</span>
            </button>

            {/* センター（QR / チップ） */}
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={handleCenter}
                data-tutorial="nav-qr"
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg,#F2A900,#D4910A)',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: activeTab === 'action'
                    ? '0 4px 18px rgba(242,169,0,0.70), 0 0 0 4px rgba(242,169,0,0.18)'
                    : '0 4px 14px rgba(242,169,0,0.45)',
                  transition: 'box-shadow 0.35s ease',
                  flexShrink: 0,
                }}
              >
                {currentStoreId
                  ? <FiCreditCard size={20} style={{ color: '#fff' }} />
                  : <MdQrCode2    size={22} style={{ color: '#fff' }} />}
              </button>
            </div>

            {/* マイページ */}
            <button
              type="button"
              onClick={() => router.push('/home/mypage')}
              style={{ ...col('mypage'), background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}
            >
              <FiUser size={20} />
              <span style={{ fontSize: 9, fontWeight: col('mypage').fontWeight }}>マイページ</span>
            </button>
          </div>

          {/* ── Tools ピル ── */}
          <div style={{ position: 'relative', flexShrink: 0, alignSelf: 'stretch' }}>
            {/* サブメニュー */}
            {toolsOpen && (
              <div style={{
                position: 'absolute',
                bottom: '100%',
                right: 0,
                paddingBottom: 8,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                gap: 8,
              }}>
                {TOOLS_ITEMS.map((item, i) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => handleToolItem(item.event)}
                    style={{
                      ...GLASS,
                      height: 44,
                      minWidth: 150,
                      padding: '0 18px',
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
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#1C1C1E' }}>{item.label}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Tools ボタン本体 */}
            <button
              type="button"
              onClick={() => setToolsOpen(prev => !prev)}
              style={{
                ...GLASS,
                width: 'auto',
                height: '100%',
                aspectRatio: '1 / 1',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                boxShadow: toolsOpen
                  ? '0 20px 60px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.10), inset 0 1.5px 0 rgba(255,255,255,0.85), inset 0 -1px 0 rgba(255,255,255,0.20), 0 0 0 3px rgba(242,169,0,0.30)'
                  : GLASS.boxShadow,
                transition: 'transform 0.15s ease, box-shadow 0.2s ease',
              }}
            >
              {toolsOpen ? (
                <span style={{ fontSize: 16, color: '#3C3C43', fontWeight: 300 }}>✕</span>
              ) : (
                <>
                  <span style={{ fontSize: 16, fontWeight: 900, color: '#F2A900', lineHeight: 1 }}>+</span>
                  <span style={{ fontSize: 8, fontWeight: 700, color: '#3C3C43', letterSpacing: 0.2 }}>Tools</span>
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
