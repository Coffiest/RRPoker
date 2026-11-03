'use client'

/**
 * PC 用の左サイドバー。PC と判定したとき(<html class="pc">)だけ表示する。
 *
 * スマホのフッター(StoreBottomNav / PlayerBottomNav)と同じ行き先を、縦に並べ直したもの。
 * 横に広い画面では、下に浮かぶ小さなフッターより、左に常に見えている一覧のほうが
 * 迷わず、マウスでも狙いやすい(Apple HIG の Sidebars、Material 3 の Navigation rail/drawer)。
 * 判定は app/layout.tsx の小さなスクリプト、表示の切り替えは globals.css の html.pc。
 */

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { usePathname, useRouter } from 'next/navigation'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import PlayerQRModal from '@/app/components/PlayerQRModal'
import type { LucideIcon } from 'lucide-react'
import {
  Home, Plus, User, Settings, QrCode, Calculator, NotebookPen, Users,
  History, Ticket, Trophy, Tv, ArrowLeftRight,
} from 'lucide-react'

type Item =
  | { kind: 'link'; label: string; sub: string; href: string; Icon: LucideIcon; match: (p: string) => boolean }
  | { kind: 'event'; label: string; sub: string; event: string; Icon: LucideIcon }

const STORE_ITEMS: Item[] = [
  { kind: 'link', label: 'HOME', sub: 'ホーム', href: '/home/store', Icon: Home, match: p => p === '/home/store' },
  { kind: 'link', label: 'NEW', sub: 'トーナメント作成', href: '/home/store/tournaments', Icon: Plus, match: p => p.startsWith('/home/store/tournaments') },
  { kind: 'link', label: 'MY PAGE', sub: 'マイページ', href: '/home/store/mypage', Icon: User, match: p => p.startsWith('/home/store/mypage') },
  { kind: 'link', label: 'SETTINGS', sub: '設定', href: '/home/store/settings', Icon: Settings, match: p => p.startsWith('/home/store/settings') },
  { kind: 'link', label: 'TV', sub: 'TVと連携', href: '/home/pair', Icon: Tv, match: p => p.startsWith('/home/pair') },
]

const PLAYER_ITEMS: Item[] = [
  { kind: 'link', label: 'HOME', sub: 'ホーム', href: '/home', Icon: Home, match: p => p === '/home' },
  { kind: 'event', label: 'CHECK-IN QR', sub: '入店QR', event: 'rrpoker:pc:qr', Icon: QrCode },
  { kind: 'link', label: 'TOURNAMENTS', sub: '大会', href: '/home/tournaments', Icon: Trophy, match: p => p.startsWith('/home/tournaments') },
  { kind: 'link', label: 'HISTORY', sub: '履歴', href: '/home/history', Icon: History, match: p => p.startsWith('/home/history') },
  { kind: 'link', label: 'TRANSACTIONS', sub: '取引', href: '/home/transactions', Icon: ArrowLeftRight, match: p => p.startsWith('/home/transactions') },
  { kind: 'link', label: 'TICKETS', sub: 'チケット', href: '/home/tickets', Icon: Ticket, match: p => p.startsWith('/home/tickets') },
  { kind: 'link', label: 'FRIENDS', sub: 'フレンド', href: '/home/friends', Icon: Users, match: p => p.startsWith('/home/friends') },
  { kind: 'link', label: 'MY PAGE', sub: 'マイページ', href: '/home/mypage', Icon: User, match: p => p.startsWith('/home/mypage') },
]

const PLAYER_TOOLS: Item[] = [
  { kind: 'event', label: 'ITM', sub: 'インマネ確率予測', event: 'rrpoker:tool:itm', Icon: Calculator },
  { kind: 'event', label: 'HAND LOG', sub: 'ハンド記録', event: 'rrpoker:tool:hand-record', Icon: NotebookPen },
]

export default function PcSidebar({ variant }: { variant: 'store' | 'player' }) {
  const pathname = usePathname() ?? ''
  const router = useRouter()
  const items = variant === 'store' ? STORE_ITEMS : PLAYER_ITEMS
  const [qr, setQr] = useState<{ uid: string; name: string; iconUrl?: string } | null>(null)

  const openQr = async () => {
    const u = auth.currentUser
    if (!u) return
    let name = '', iconUrl: string | undefined
    try { const d = (await getDoc(doc(db, 'users', u.uid))).data(); name = d?.name ?? ''; iconUrl = d?.iconUrl } catch {}
    setQr({ uid: u.uid, name, iconUrl })
  }

  const row = (it: Item) => {
    const active = it.kind === 'link' && it.match(pathname)
    const onClick = () => {
      if (it.kind === 'link') { router.push(it.href); return }
      if (it.event === 'rrpoker:pc:qr') { void openQr(); return }
      // ツール(ITM・ハンド記録)はホームとマイページにだけある。ほかの画面ではホームへ移ってから開く。
      const hasTools = pathname === '/home' || pathname === '/home/mypage'
      if (it.event.startsWith('rrpoker:tool:') && !hasTools) {
        try { sessionStorage.setItem('rrpoker.pendingTool', it.event) } catch {}
        router.push('/home')
        return
      }
      window.dispatchEvent(new CustomEvent(it.event))
    }
    return (
      <button key={it.label} type="button" onClick={onClick} aria-current={active ? 'page' : undefined}
        data-tutorial={it.kind === 'event' && it.event === 'rrpoker:pc:qr' ? 'nav-qr' : undefined}
        className={`pc-side-item${active ? ' is-active' : ''}`}>
        <it.Icon size={20} strokeWidth={2} aria-hidden />
        <span className="pc-side-text">
          <span className="pc-side-label">{it.label}</span>
          <span className="pc-side-sub">{it.sub}</span>
        </span>
      </button>
    )
  }

  return (
    <aside className="pc-only pc-sidebar" aria-label="メインメニュー">
      <button type="button" className="pc-side-brand" onClick={() => router.push(variant === 'store' ? '/home/store' : '/home')}>
        <img src="/icon-192x192.png" alt="" width={40} height={40} />
        <span>
          <span className="pc-side-brand-name">RRPOKER</span>
          <span className="pc-side-brand-sub tech-label">{variant === 'store' ? 'STORE' : 'PLAYER'}</span>
        </span>
      </button>
      <p className="pc-side-section term-comment">MENU</p>
      <nav className="pc-side-list">{items.map(row)}</nav>
      {variant === 'player' && (
        <>
          <p className="pc-side-section term-comment">TOOLS</p>
          <nav className="pc-side-list">{PLAYER_TOOLS.map(row)}</nav>
        </>
      )}
      {qr && typeof document !== 'undefined' && createPortal(
        <PlayerQRModal uid={qr.uid} name={qr.name} iconUrl={qr.iconUrl} onClose={() => setQr(null)} />,
        document.body,
      )}
    </aside>
  )
}
