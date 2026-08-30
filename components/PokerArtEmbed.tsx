'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { auth } from '@/lib/firebase'
import { computeNavLayout, navInsetCss } from '@/lib/navLayout'
import { PLAYER_NAV_TAB_COUNT } from '@/components/PlayerBottomNav'

/**
 * Poker ART を RRPoker の中に埋め込んで表示する。
 *
 * 卓のUIは Poker ART 側の実物をそのまま使う。複製もフレームワークの移行もしないので、
 * Poker ART を直したときに二重に直す必要がない。
 *
 * 認証は「親(ここ)が Firebase の IDトークンを postMessage で渡す」方式。
 * URLには載せない —— URLは履歴・リファラ・ログに残るうえ、iOSのストレージ分離で
 * 埋め込み側の Cookie / localStorage は当てにできないため。
 * Poker ART 側は受け取り口で origin を照合し、許可したオリジン以外からは受け取らない。
 */

/** 埋め込む Poker ART の起点。未設定なら本番を使う。 */
const POKER_ART_ORIGIN =
  process.env.NEXT_PUBLIC_POKERART_ORIGIN ?? 'https://meta-geo-poker.vercel.app'

/** 子→親: 準備ができたのでトークンを送ってほしい。 */
const READY_MESSAGE = 'pokerart:ready'
/** 親→子: アクセストークンの受け渡し。 */
const TOKEN_MESSAGE = 'pokerart:token'

export interface PokerArtEmbedProps {
  /** Poker ART 側のパス(例: '/', '/geo')。`embed=1` は自動で付ける。 */
  path: string
}

export default function PokerArtEmbed({ path }: PokerArtEmbedProps) {
  const frameRef = useRef<HTMLIFrameElement>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'signedOut'>('loading')

  // 下端はフッターに合わせる。固定値で持つとフッターの寸法を変えたときに必ずズレるので、
  // フッターと同じ計算から導く。
  const [viewportWidth, setViewportWidth] = useState(390)
  useEffect(() => {
    const measure = () => setViewportWidth(window.innerWidth)
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])
  const bottomInset = navInsetCss(computeNavLayout(viewportWidth, PLAYER_NAV_TAB_COUNT))

  const src = (() => {
    const url = new URL(path, POKER_ART_ORIGIN)
    url.searchParams.set('embed', '1')
    return url.toString()
  })()

  /** いまのIDトークンを子へ送る。送信先オリジンは必ず明示する(ワイルドカードにしない)。 */
  const sendToken = useCallback(async () => {
    const user = auth.currentUser
    const frame = frameRef.current
    if (!frame?.contentWindow) return
    if (!user) { setStatus('signedOut'); return }
    try {
      const token = await user.getIdToken()
      frame.contentWindow.postMessage({ type: TOKEN_MESSAGE, token }, POKER_ART_ORIGIN)
      setStatus('ready')
    } catch {
      // 取得に失敗しても壊さない。子からの ready 再送か、下の定期更新で復帰する。
    }
  }, [])

  // 子から「準備できた」と言われたらトークンを渡す。
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== POKER_ART_ORIGIN) return
      const data = event.data as { type?: unknown } | null
      if (data && data.type === READY_MESSAGE) void sendToken()
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [sendToken])

  // ログイン状態が変わったら渡し直す。
  useEffect(() => auth.onAuthStateChanged(() => { void sendToken() }), [sendToken])

  // FirebaseのIDトークンは1時間で失効するので、余裕をもって定期的に送り直す。
  // 子は受け取るたびに差し替えるので、遊んでいる最中に切れることがない。
  useEffect(() => {
    const timer = setInterval(() => { void sendToken() }, 30 * 60 * 1000)
    return () => clearInterval(timer)
  }, [sendToken])

  return (
    <div style={{ position: 'fixed', inset: 0, bottom: bottomInset, background: '#F2F2F7' }}>
      {status === 'signedOut' && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 24, textAlign: 'center', color: '#3C3C43', fontSize: 14,
        }}>
          ログインするとご利用いただけます。
        </div>
      )}
      <iframe
        ref={frameRef}
        src={src}
        title="Poker ART"
        onLoad={() => { void sendToken() }}
        allow="clipboard-write"
        style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
      />
    </div>
  )
}
