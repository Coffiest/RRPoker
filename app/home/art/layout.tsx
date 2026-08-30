'use client'

import PlayerBottomNav from '@/components/PlayerBottomNav'

/**
 * Poker ART の画面(卓 / データベース / ヒストリー)の共通の枠。
 *
 * フッターをここで出す。埋め込みは画面いっぱいに広がるので、ページ側で個別に
 * 出すのを忘れると「入ったら戻れない」状態になる。まとめて1か所で持つ。
 */
export default function ArtLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <PlayerBottomNav />
    </>
  )
}
