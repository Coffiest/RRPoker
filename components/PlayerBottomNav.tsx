'use client'

import { useState, useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { FiHome, FiUser, FiDatabase, FiClock } from 'react-icons/fi'
import { hapticTap } from '@/lib/haptics'
import { computeNavLayout, indicatorCenterRatio } from '@/lib/navLayout'

/**
 * プレイヤー用のフッターメニュー。
 *
 * ライブポーカー(RRPoker本体)とオンライン(Poker ART)の両方の入口をここに集約する。
 * 中央の「PLAY」は Poker ART の卓に着く導線で、フッターで唯一せり上がった立体的な
 * ボタンにしている。ここが「押せばポーカーが始まる場所」だと、文字を読まなくても
 * 分かるようにするため。
 *
 * ピルの外に置く要素は無い。以前あったツールボタンは、狭い画面で右端からはみ出すうえ、
 * 中身(入店QR / インマネ確率予測 / ハンド記録)はいずれも別の場所から開ける:
 *  - 入店QR … ホーム画面のヘッダーにあるQRボタン(従来どおり)
 *  - インマネ確率予測 / ハンド記録 … マイページの「ツール」
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
  { key: 'play',     label: 'プレイ',     href: '/home/art/table',    match: ['/home/art/table'], icon: FiHome },
  { key: 'history',  label: 'ヒストリー',  href: '/home/art/hands',    match: ['/home/art/hands', '/home/history'], icon: FiClock },
  { key: 'mypage',   label: 'マイページ',  href: '/home/mypage',       match: ['/home/mypage', '/home/transactions', '/home/tickets', '/home/withdraw'], icon: FiUser },
]

/** 中央でせり上げるタブ。 */
const CENTER_INDEX = TABS.findIndex((t) => t.key === 'play')

/** タブの本数。埋め込みの下端をフッターに合わせるときに使う。 */
export const PLAYER_NAV_TAB_COUNT = TABS.length

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

/**
 * 扇状に開いた2枚のトランプ。「ここを押すとポーカーが始まる」を一目で伝えるための絵。
 * 絵文字は使わず、線だけで描いたSVGにしている(塗りは中の白のみ)。
 */
function PlayCardsGlyph({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* 後ろのカード。傾けて重ね、「1枚ではなく手札」だと分かるようにする。 */}
      <rect x="3.4" y="6.2" width="8.6" height="12.4" rx="2" transform="rotate(-18 7.7 12.4)" />
      {/* 手前のカード */}
      <rect x="11" y="4.8" width="10" height="14.4" rx="2.2" />
      {/* 手前のカードのスペード。小さく描くと潰れるので、面いっぱいに1つだけ置く。 */}
      <path d="M16 8.9c-1.5 1.4-2.5 2.3-2.5 3.4a1.6 1.6 0 0 0 2.5 1.3 1.6 1.6 0 0 0 2.5-1.3c0-1.1-1-2-2.5-3.4Z" />
    </svg>
  )
}

export default function PlayerBottomNav() {
  const router   = useRouter()
  const pathname = usePathname()
  const activeKey  = activeTabFor(pathname)
  const activeIndex = Math.max(0, TABS.findIndex((t) => t.key === activeKey))
  const isPlaying = activeKey === 'play'

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

  const go = (href: string) => { hapticTap(); router.push(href) }

  const playIcon = Math.round(L.playSize * 0.38)
  const playLabel = Math.max(8, Math.round(L.playSize * 0.145))

  return (
    <>
      <style>{`
        /* 卓が待っていることを伝える呼吸。動きを減らす設定の端末では止める。 */
        @keyframes navPlayHalo {
          0%, 100% { transform: scale(1);    opacity: 0.55; }
          50%      { transform: scale(1.18); opacity: 0;    }
        }
        @media (prefers-reduced-motion: reduce) {
          .nav-play-halo { animation: none !important; opacity: 0.35 !important; }
        }
        .nav-play-btn:active .nav-play-face { transform: scale(0.94); }
      `}</style>

      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 80,
        paddingTop: L.padTop,
        paddingBottom: `max(${L.padBottom}px, env(safe-area-inset-bottom))`,
        paddingLeft: 8, paddingRight: 8,
      }}>
        {/* ピルは行の幅いっぱい。せり上がるプレイボタンだけがこの箱の外(上)へ出る。 */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>

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
              // 中央の枠は場所だけ空けておく。実体はピルの外(下のプレイボタン)に置く。
              // ピルは overflow:hidden なので、中に入れるとせり上がった分が切れてしまう。
              if (i === CENTER_INDEX) {
                return <div key={tab.key} aria-hidden="true" style={{ flex: 1, minWidth: 0 }} />
              }

              const isActive = i === activeIndex
              const IconComponent = tab.icon

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

          {/* ── 中央のプレイボタン ──
               フッターで唯一せり上がっていて、唯一色がついている。ここだけが
               「入口」だと分かるようにするための扱い。 */}
          <button
            type="button"
            className="nav-play-btn"
            onClick={() => go(TABS[CENTER_INDEX].href)}
            aria-label="プレイ ─ 卓に着く"
            aria-current={isPlaying ? 'page' : undefined}
            data-tutorial="nav-play"
            style={{
              position: 'absolute',
              left: `${indicatorCenterRatio(CENTER_INDEX, TABS.length) * 100}%`,
              top: '50%',
              transform: `translate(-50%, -50%) translateY(-${L.playLift}px)`,
              width: L.playSize,
              height: L.playSize,
              padding: 0,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            {/* 外へ広がる光の輪。卓が開いていることを静かに知らせる。 */}
            <span
              className="nav-play-halo"
              aria-hidden="true"
              style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(242,169,0,0.55) 0%, rgba(242,169,0,0) 70%)',
                animation: 'navPlayHalo 2.6s ease-out infinite',
                pointerEvents: 'none',
              }}
            />
            {/* 本体 */}
            <span
              className="nav-play-face"
              style={{
                position: 'relative',
                width: '100%', height: '100%', borderRadius: '50%',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: Math.max(1, Math.round(L.playSize * 0.03)),
                color: '#fff',
                background: 'linear-gradient(160deg,#FFC44D 0%,#F2A900 46%,#C97F05 100%)',
                border: '2px solid rgba(255,255,255,0.9)',
                boxShadow: isPlaying
                  ? '0 10px 26px rgba(242,169,0,0.62), 0 2px 6px rgba(0,0,0,0.22), inset 0 2px 0 rgba(255,255,255,0.55)'
                  : '0 8px 20px rgba(242,169,0,0.46), 0 2px 6px rgba(0,0,0,0.20), inset 0 2px 0 rgba(255,255,255,0.45)',
                transition: 'transform 0.14s ease, box-shadow 0.35s ease',
              }}
            >
              <PlayCardsGlyph size={playIcon} />
              <span style={{
                fontSize: playLabel,
                fontWeight: 800,
                letterSpacing: '0.18em',
                // 字送りぶん右に寄るので、その半分だけ戻して光学的に中央へ置く。
                textIndent: '0.18em',
                lineHeight: 1,
                textShadow: '0 1px 2px rgba(0,0,0,0.22)',
              }}>PLAY</span>
            </span>
          </button>
        </div>
      </nav>
    </>
  )
}
