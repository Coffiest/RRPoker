'use client'

/**
 * スマホでタイマーを横向き全画面にする入れ物(店舗・プレイヤー共通)。
 *
 * 以前は 100vh × 100vw の箱を 90 度回していたが、iPhone の Safari では 100vh が
 * 「アドレスバーが隠れたときの高さ」で、見えている画面より大きい。回した箱の端(閉じるボタンのある側)が
 * 画面の外にはみ出し、× を押せなかった。
 * いま見えている大きさ(visualViewport、無ければ innerWidth / innerHeight)を測って、その大きさで回す。
 * 端末をすでに横に持っているときは回さない。中身はこの箱の中に収まるので、角に置いたボタンは必ず画面の中に出る。
 */

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

function measure() {
  const vv = typeof window !== 'undefined' ? window.visualViewport : null
  return {
    w: Math.round(vv?.width ?? window.innerWidth),
    h: Math.round(vv?.height ?? window.innerHeight),
  }
}

export default function RotatedFullscreen({ children, zIndex = 9999, portal = false }: {
  children: React.ReactNode
  zIndex?: number
  /** body に出す。親に transform やアニメーションのあるカードの中から開くとき(プレイヤーのホーム)に使う。
   *  出さないと、その親の中に閉じ込められて画面いっぱいにならない */
  portal?: boolean
}) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  useEffect(() => {
    const on = () => setSize(measure())
    on()
    window.addEventListener('resize', on)
    window.addEventListener('orientationchange', on)
    window.visualViewport?.addEventListener('resize', on)
    return () => {
      window.removeEventListener('resize', on)
      window.removeEventListener('orientationchange', on)
      window.visualViewport?.removeEventListener('resize', on)
    }
  }, [])
  if (!size) return null
  const portrait = size.h > size.w
  // 横長の箱: 縦持ちなら 90 度回して、見えている高さを横幅にする
  const boxW = portrait ? size.h : size.w
  const boxH = portrait ? size.w : size.h
  // 店舗の画面では body へは出さない(この上に重ねる Adjust などの画面と、同じ重なりの中に置くため)
  const node = (
    <div style={{ position: 'fixed', top: 0, left: 0, width: size.w, height: size.h, zIndex, background: '#000', overflow: 'hidden', touchAction: 'none' }}>
      <div style={{
        position: 'absolute', top: '50%', left: '50%', width: boxW, height: boxH,
        transform: `translate(-50%, -50%)${portrait ? ' rotate(90deg)' : ''}`, transformOrigin: 'center center', overflow: 'hidden',
      }}>
        {children}
      </div>
    </div>
  )
  return portal && typeof document !== 'undefined' ? createPortal(node, document.body) : node
}
