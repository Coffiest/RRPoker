'use client'

import { ArrowLeftRight } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { FiBell, FiCreditCard } from 'react-icons/fi'
import { auth, db } from '@/lib/firebase'
import { signOut } from 'firebase/auth'
import ConfirmDialog, { type ConfirmRequest } from './ConfirmDialog'
import { collection, doc, getDoc, limit, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where, writeBatch } from 'firebase/firestore'
import PlayerQRModal from '@/app/components/PlayerQRModal'

import type { MenuItem } from './commonMenuItems'
import { getCommonMenuItems } from './commonMenuItems'
import { switchToStore, useManagedStores } from '@/lib/storeAccess'
import { GrantAccessSheet, ManageAccessSheet, StoreChooserSheet } from './StoreAccess'



type UserNotificationItem = {
	id: string
	storeId: string
	storeName: string
	message: string
	type: string
	createdAt?: { seconds?: number }
	read: boolean
}

type StoreNoticeItem = {
	id: string
	userName?: string
	amount?: number
	expiredAt?: { seconds?: number }
	message?: string
	createdAt?: { seconds?: number }
}

type HomeHeaderProps = {
	homePath: string
	myPagePath: string
	variant?: 'user' | 'store'
	showNotifications?: boolean
	menuItems?: MenuItem[]
}


export default function HomeHeader({
	homePath,
	myPagePath,
	variant = 'user',
	showNotifications = true,
	menuItems = [],
}: HomeHeaderProps) {
	const router = useRouter()

	// ---- state（重複なし・順序整理） ----
	const [isMenuOpen, setIsMenuOpen] = useState(false)
	const [toastMessage, setToastMessage] = useState<string | null>(null)
	const toastTimeoutRef = useRef<number | null>(null)
	const [isNoticeOpen, setIsNoticeOpen] = useState(false)

	const [userNotifications, setUserNotifications] = useState<UserNotificationItem[]>([])
	const [storeNotices, setStoreNotices] = useState<StoreNoticeItem[]>([])

	const [authUserId, setAuthUserId] = useState<string | null>(null)
	const [noticeFavoriteStores, setNoticeFavoriteStores] = useState<string[]>([])
	const [storeNoticeItems, setStoreNoticeItems] = useState<Array<{
		id: string; storeId: string; storeName: string; message: string; createdAt?: { seconds?: number }
	}>>([])
	const [noticeReadIds, setNoticeReadIds] = useState<Set<string>>(new Set())

	// QR / checkin
	const [isQROpen, setIsQROpen] = useState(false)
	const [userName, setUserName] = useState('')
	const [userIconUrl, setUserIconUrl] = useState<string | undefined>(undefined)
	const prevCheckinStatusRef = useRef<string | undefined>(undefined)

	// スタンプ ready バッジ
	const [hasStampReady, setHasStampReady] = useState(false)

	const isUserVariant = variant === 'user'


	// ---- auth + favoriteStores 読み込み ----
	useEffect(() => {
		if (!isUserVariant) return
		const unsub = auth.onAuthStateChanged(async user => {
			if (!user) { setAuthUserId(null); setNoticeFavoriteStores([]); return }
			setAuthUserId(user.uid)
			try {
				const userSnap = await getDoc(doc(db, 'users', user.uid))
				const data = userSnap.data()
				setNoticeFavoriteStores(Array.isArray(data?.favoriteStores) ? data.favoriteStores : [])
				setUserName(data?.name ?? '')
				setUserIconUrl(data?.iconUrl)
			} catch {}
		})
		return () => unsub()
	}, [isUserVariant])

	// ---- スタンプ ready 監視（12個以上で赤ドット）----
	useEffect(() => {
		if (!authUserId || !isUserVariant) return
		const unsub = onSnapshot(collection(db, 'users', authUserId, 'storeStamp'), snap => {
			setHasStampReady(snap.docs.some(d => (d.data().stampCount ?? 0) >= 12))
		}, () => {})
		return () => unsub()
	}, [authUserId, isUserVariant])

	// ---- 入店ステータス監視（user のみ）----
	useEffect(() => {
		if (!authUserId || !isUserVariant) return
		prevCheckinStatusRef.current = undefined
		const unsub = onSnapshot(doc(db, 'users', authUserId), snap => {
			const status = snap.data()?.checkinStatus as string | undefined
			setCheckedIn(typeof snap.data()?.currentStoreId === 'string')
			if (prevCheckinStatusRef.current === undefined) {
				prevCheckinStatusRef.current = status
				return
			}
			if (prevCheckinStatusRef.current !== 'approved' && status === 'approved') {
				setIsQROpen(false)
				sessionStorage.setItem('rrpoker.freshCheckin', '1')
				router.push('/home')
			}
			prevCheckinStatusRef.current = status
		}, () => {})
		return () => unsub()
	}, [authUserId, isUserVariant, router])

	// ---- お気に入り店舗のお知らせ読み込み ----
	useEffect(() => {
		if (!isUserVariant || noticeFavoriteStores.length === 0) { setStoreNoticeItems([]); return }
		const storeItemsMap: Record<string, any[]> = {}
		const unsubs = noticeFavoriteStores.map(storeId => {
			const q = query(collection(db, 'stores', storeId, 'notices'), orderBy('createdAt', 'desc'), limit(20))
			return onSnapshot(q, async snap => {
				try {
					const storeSnap = await getDoc(doc(db, 'stores', storeId))
					const storeName = storeSnap.data()?.name ?? '店舗'
					storeItemsMap[storeId] = snap.docs.map(d => ({
						id: `${storeId}_${d.id}`,
						storeId,
						storeName,
						message: d.data().message ?? '',
						createdAt: d.data().createdAt,
					}))
					const all = Object.values(storeItemsMap).flat()
					all.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))
					setStoreNoticeItems(all)
				} catch {}
			}, () => {})
		})
		return () => unsubs.forEach(u => u())
	}, [isUserVariant, noticeFavoriteStores])

	// ---- システム通知（チップ期限変更など）読み込み ----
	useEffect(() => {
		if (!authUserId || !isUserVariant) return
		const q = query(collection(db, 'notifications'), where('userId', '==', authUserId))
		const unsub = onSnapshot(q, snap => {
			const list: UserNotificationItem[] = []
			snap.forEach(d => {
				const data = d.data()
				list.push({ id: d.id, storeId: data.storeId, storeName: data.storeName, message: data.message, type: data.type, createdAt: data.createdAt, read: data.read ?? true })
			})
			list.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))
			setUserNotifications(list)
		})
		return () => unsub()
	}, [authUserId, isUserVariant])

	// ---- 既読ID読み込み ----
	useEffect(() => {
		if (!authUserId || !isUserVariant) return
		const unsub = onSnapshot(collection(db, 'users', authUserId, 'readNotices'), snap => {
			const ids = new Set<string>()
			snap.forEach(d => ids.add(d.id))
			setNoticeReadIds(ids)
		}, () => {})
		return () => unsub()
	}, [authUserId, isUserVariant])


	const markAllRead = async () => {
		const uid = authUserId ?? auth.currentUser?.uid
		if (!uid) return
		const batch = writeBatch(db)
		storeNoticeItems.filter(n => !noticeReadIds.has(n.id)).forEach(n => {
			batch.set(doc(db, 'users', uid, 'readNotices', n.id), { readAt: serverTimestamp() })
		})
		userNotifications.filter(n => !n.read).forEach(n => {
			batch.update(doc(db, 'notifications', n.id), { read: true })
		})
		batch.commit().catch(e => console.error('markAllRead:', e))
	}

	const markStoreNoticeRead = (noticeId: string) => {
		const uid = authUserId ?? auth.currentUser?.uid
		if (!uid) return
		const batch = writeBatch(db)
		batch.set(doc(db, 'users', uid, 'readNotices', noticeId), { readAt: serverTimestamp() })
		batch.commit().catch(e => console.error('markStoreNoticeRead:', e))
	}

	const markUserNotifRead = (notifId: string) => {
		updateDoc(doc(db, 'notifications', notifId), { read: true }).catch(e => console.error('markUserNotifRead:', e))
	}

	const goTo = (path: string) => {
		setIsMenuOpen(false)
		router.push(path)
	}

	const showToast = (message: string) => {
		if (toastMessage === message) {
			setToastMessage(null)
			if (toastTimeoutRef.current) window.clearTimeout(toastTimeoutRef.current)
			return
		}

		setToastMessage(message)
		if (toastTimeoutRef.current) window.clearTimeout(toastTimeoutRef.current)
		toastTimeoutRef.current = window.setTimeout(() => {
			setToastMessage(null)
		}, 2200)
	}

	const formatDate = (value: Date) => {
		const year = value.getFullYear()
		const month = `${value.getMonth() + 1}`.padStart(2, '0')
		const day = `${value.getDate()}`.padStart(2, '0')
		return `${year}/${month}/${day}`
	}

	const formatDateTime = (seconds?: number) => {
		if (!seconds) return ''
		const date = new Date(seconds * 1000)
		const pad = (v: number) => v.toString().padStart(2, '0')
		return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(
			date.getMinutes()
		)}`
	}

	useEffect(() => {
		return () => {
			if (toastTimeoutRef.current) window.clearTimeout(toastTimeoutRef.current)
		}
	}, [])

	useEffect(() => {
		if (!isMenuOpen) return
		const previousOverflow = document.body.style.overflow
		document.body.style.overflow = 'hidden'
		return () => {
			document.body.style.overflow = previousOverflow
		}
	}, [isMenuOpen])

	// ログアウト(プレイヤー・店舗どちらのメニューにも出す。押し間違いを防ぐため確認を挟む)
	const [logoutConfirm, setLogoutConfirm] = useState<ConfirmRequest | null>(null)
	const askLogout = () => setLogoutConfirm({
		title: 'ログアウト', message: 'ログアウトしますか？', action: 'ログアウト', destructive: true,
		run: async () => { await signOut(auth); router.replace('/login') },
	})

	// 入店中のチップ申請(引き出し)。フッター中央が入店QRになったので、ここから行う
	const [checkedIn, setCheckedIn] = useState(false)

	// ---- 店舗の権限(lib/storeAccess.ts) ----
	// me: 自分の uid / 店舗オーナーか / 操作中の店舗(users.storeId)
	const [me, setMe] = useState<{ uid: string; isOwner: boolean; storeId: string | null } | null>(null)
	useEffect(() => auth.onAuthStateChanged(async user => {
		if (!user) { setMe(null); return }
		const d = (await getDoc(doc(db, 'users', user.uid)).catch(() => null))?.data()
		setMe({ uid: user.uid, isOwner: d?.role === 'store', storeId: typeof d?.storeId === 'string' ? d.storeId : null })
	}), [])
	const managedStores = useManagedStores(me && !me.isOwner ? me.uid : null)
	const [grantOpen, setGrantOpen] = useState(false)
	const [manageOpen, setManageOpen] = useState(false)
	const [chooserOpen, setChooserOpen] = useState(false)
	const openStore = async (storeId: string) => {
		if (!me) return
		setChooserOpen(false)
		await switchToStore(me.uid, storeId)
		router.push('/home/store')
	}
	// プレイヤー ⇄ 店舗の切り替え(ワンタップ)。権限のある店舗が 1 つならすぐ開く
	const switchTarget: { label: string; onClick: () => void } | null =
		isUserVariant && managedStores.length > 0
			? { label: 'STORE', onClick: () => { if (managedStores.length === 1) void openStore(managedStores[0].id); else setChooserOpen(true) } }
			: !isUserVariant && me && !me.isOwner
				? { label: 'PLAYER', onClick: () => router.push('/home') }
				: null

	const effectiveMenuItems = [
		...(isUserVariant && checkedIn ? [{ label: 'チップ申請', onClick: () => router.push('/home/transactions?mode=withdraw') }] : []),
		...(isUserVariant ? [{ label: '権限を追加', onClick: () => setGrantOpen(true) }] : []),
		...(!isUserVariant && me?.isOwner ? [{ label: '権限を管理', onClick: () => setManageOpen(true) }] : []),
		...(menuItems && menuItems.length > 0 ? menuItems : getCommonMenuItems(router, variant)),
	]

	// ヘッダーは白のまま。方眼は背景(TechBackdrop)が受け持つ。
	// ここにも方眼を敷くと紙面がうるさくなり、白いヘッダーとの境目も消える。
	return (
		<header className="sticky top-0 z-50 border-b border-gray-100 bg-white/95 backdrop-blur-md" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
		<style>{`html { overflow-x: hidden; }`}</style>
		<ConfirmDialog request={logoutConfirm} onClose={() => setLogoutConfirm(null)} />
		<GrantAccessSheet open={grantOpen} onClose={() => setGrantOpen(false)} uid={me?.uid ?? null} />
		<ManageAccessSheet open={manageOpen} onClose={() => setManageOpen(false)} storeId={me?.storeId ?? null} />
		<StoreChooserSheet open={chooserOpen} onClose={() => setChooserOpen(false)} stores={managedStores} onPick={id => void openStore(id)} />
			<div className="pc-header-inner mx-auto flex min-h-[64px] max-w-sm items-center justify-between px-6 py-4">
				<button
					type="button"
					onClick={() => router.push(homePath)}
					className="flex min-w-0 items-center gap-0 text-left"
				>
					<img src="/icon-192x192.png" alt="RRPoker logo" className="h-[60px] w-[60px] shrink-0" />
					<span className="flex min-w-0 flex-col leading-none">
						<span className="font-display text-[18px] font-bold tracking-tight text-label truncate">RRPOKER</span>
						{/* 稼働中であることを示す計器風のサブラベル */}
						<span className="mt-[4px] flex items-center gap-2">
							<span className="tech-status-dot" />
							<span className="tech-label text-label3">{isUserVariant ? 'PLAYER' : 'STORE'}</span>
						</span>
					</span>
				</button>

				<div className="flex shrink-0 items-center gap-2">
					{/* 権限のある店舗の画面 ⇄ 自分のプレイヤー画面 */}
					{switchTarget && (
						<button type="button" onClick={switchTarget.onClick} aria-label={switchTarget.label === 'STORE' ? '店舗の画面へ切り替え' : 'プレイヤーの画面へ切り替え'}
							title={switchTarget.label === 'STORE' ? '店舗の画面へ' : 'プレイヤーの画面へ'}
							className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white"
							style={{ background: 'linear-gradient(135deg,#F2A900,#D4910A)', boxShadow: '0 3px 10px rgba(242,169,0,0.35)' }}>
							{/* 以前は「⇄ STORE」の文字入りで幅を取り、狭い画面でロゴの文字に重なっていた。ほかの丸ボタンと同じ 40px の丸にする */}
							<ArrowLeftRight size={18} strokeWidth={2} aria-hidden />
						</button>
					)}
					{/* 店舗のチケット(作る・付与する。app/home/store/tickets。2026-11-10)。プレイヤーと同じ位置・同じアイコン */}
					{!isUserVariant && (
						<button
							type="button"
							onClick={() => router.push('/home/store/tickets')}
							aria-label="チケット" title="チケット"
							className="relative flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-label hover:border-gray-300 transition-colors"
						>
							<FiCreditCard className="text-[18px]" />
						</button>
					)}
					{isUserVariant && (
						<button
							type="button"
							onClick={() => router.push('/home/tickets')}
							className="relative flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-label hover:border-gray-300 transition-colors"
						>
							<FiCreditCard className="text-[18px]" />
							{hasStampReady && (
								<span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-red-500" />
							)}
						</button>
					)}

					{showNotifications && (
						<button
							type="button"
							onClick={() => setIsNoticeOpen(prev => !prev)}
							data-tutorial="header-bell"
							className="relative flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-label hover:border-gray-300 transition-colors"
						>
							<FiBell className="text-[18px]" />
							{(isUserVariant
								? storeNoticeItems.some(n => !noticeReadIds.has(n.id)) || userNotifications.some(n => !n.read)
								: storeNotices.length > 0) && (
								<span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-red-500" />
							)}
						</button>
					)}

					{/* ハンバーガーメニュー(プレイヤー・店舗どちらも。入店QRはフッターのツールから) */}
					<button
						type="button"
						aria-label="メニュー"
						onClick={() => setIsMenuOpen(prev => !prev)}
						className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-label"
					>
						<span className="flex flex-col gap-1">
							<span className="h-[2px] w-5 rounded bg-gray-700" />
							<span className="h-[2px] w-5 rounded bg-gray-700" />
							<span className="h-[2px] w-5 rounded bg-gray-700" />
						</span>
					</button>
				</div>
			</div>

			{/* メニューは body に出す(ヘッダーの重なり順の中だとフッターの下に隠れる) */}
			{typeof document !== 'undefined' && createPortal(<>
			{/* オーバーレイ(プレイヤー・店舗どちらも) */}
			{(
				<div
					className={`fixed inset-0 z-[999] bg-white transition-opacity ${
						isMenuOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
					}`}
					onClick={() => setIsMenuOpen(false)}
				/>
			)}

			{/* 右スライドメニュー(プレイヤー・店舗どちらも) */}
			{(
				<aside
					className={`fixed right-0 top-0 z-[1000] h-screen w-[80%] max-w-sm border-l border-gray-200 bg-white shadow-2xl transition-transform duration-300 ${
						isMenuOpen ? 'translate-x-0' : 'translate-x-full'
					}`}
				>
					<div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
						<p className="term-prompt-arrow text-[14px] font-semibold text-label">メニュー</p>
						<button onClick={() => setIsMenuOpen(false)} className="text-[13px] text-label2">
							閉じる
						</button>
					</div>

					<div className="px-6 py-4 space-y-4">
						{effectiveMenuItems.map(item => (
							<button
								key={item.label}
								onClick={() => {
									setIsMenuOpen(false)
									item.onClick()
								}}
								className="w-full rounded-2xl border border-gray-200 px-4 py-4 text-left text-[14px] font-semibold text-label"
							>
								{item.label}
							</button>
						))}

						<button
							onClick={() => goTo(myPagePath)}
							className="w-full rounded-2xl border border-gray-200 px-4 py-4 text-left text-[14px] font-semibold text-label"
						>
							マイページ
						</button>

						<button
							onClick={() => { setIsMenuOpen(false); askLogout() }}
							className="w-full rounded-2xl border border-red-100 px-4 py-4 text-left text-[14px] font-semibold text-red-600"
						>
							ログアウト
						</button>
					</div>
				</aside>
			)}
			</>, document.body)}

			{toastMessage && (
				<div className="fixed left-1/2 top-[70px] z-50 -translate-x-1/2 rounded-full bg-gray-900 px-4 py-2 text-[12px] text-white shadow-lg">
					{toastMessage}
				</div>
			)}

			{/* お知らせパネル */}
			{isNoticeOpen && (
				<>
					<div className="fixed inset-0 z-[60]" onClick={() => setIsNoticeOpen(false)} />
					<div className="fixed left-0 right-0 top-[64px] z-[61] px-4">
						<div className="mx-auto max-w-sm rounded-[20px] bg-white border border-gray-100 shadow-2xl overflow-hidden">

							{/* ヘッダー */}
							<div className="flex items-center justify-between px-4 pt-4 pb-4 border-b border-gray-100">
								<p className="term-prompt-arrow text-[15px] font-semibold text-label">お知らせ</p>
								<button type="button" onClick={() => setIsNoticeOpen(false)} className="text-[13px] text-label3 font-medium">閉じる</button>
							</div>

							{/* 全て既読ボタン */}
							{(storeNoticeItems.some(n => !noticeReadIds.has(n.id)) || userNotifications.some(n => !n.read)) && (
								<div className="px-4 py-2 border-b border-gray-100 flex justify-end">
									<button
										type="button"
										onClick={markAllRead}
										className="text-[12px] font-semibold text-[#D4910A] bg-[#FFF8E7] rounded-full px-4 py-2 active:bg-[#FFE9B0] transition-colors"
									>
										すべて既読にする
									</button>
								</div>
							)}

							{/* リスト */}
							<div className="max-h-[55vh] overflow-y-auto">
								{storeNoticeItems.length === 0 && userNotifications.length === 0 ? (
									<p className="term-comment text-center text-[13px] text-label3 py-8">お知らせはありません</p>
								) : (
									<>
										{storeNoticeItems.map(n => {
											const isUnread = !noticeReadIds.has(n.id)
											return (
												<div
													key={n.id}
													className={`px-4 py-4 border-b border-gray-50 transition-colors ${isUnread ? 'bg-[#FFF8E7] active:bg-[#FFE9B0]' : 'bg-white'}`}
													onClick={() => { if (isUnread) markStoreNoticeRead(n.id) }}
												>
													<div className="flex items-center gap-2 mb-1">
														{isUnread && <span className="h-2 w-2 rounded-full bg-[#D4910A] flex-shrink-0" />}
														<span className="tech-label text-[#D4910A] flex-1 truncate">{n.storeName}</span>
														<span className="tech-num text-[10px] text-label3">{formatDateTime(n.createdAt?.seconds)}</span>
													</div>
													<p className={`text-[13px] leading-relaxed ${isUnread ? 'text-label font-medium' : 'text-label2'}`}>{n.message}</p>
												</div>
											)
										})}
										{userNotifications.map(n => (
											<div
												key={n.id}
												className={`px-4 py-4 border-b border-gray-50 transition-colors ${!n.read ? 'bg-[#FFF8E7] active:bg-[#FFE9B0]' : 'bg-white'}`}
												onClick={() => { if (!n.read) markUserNotifRead(n.id) }}
											>
												<div className="flex items-center gap-2 mb-1">
													{!n.read && <span className="h-2 w-2 rounded-full bg-[#D4910A] flex-shrink-0" />}
													<span className="tech-label text-[#D4910A] flex-1 truncate">{n.storeName}</span>
													<span className="tech-num text-[10px] text-label3">{formatDateTime(n.createdAt?.seconds)}</span>
												</div>
												<p className={`text-[13px] leading-relaxed ${!n.read ? 'text-label font-medium' : 'text-label2'}`}>{n.message}</p>
											</div>
										))}
									</>
								)}
							</div>

						</div>
					</div>
				</>
			)}

			{/* QR モーダル・入店トーストは header の stacking context 外へ */}
			{isQROpen && authUserId && createPortal(
				<PlayerQRModal
					uid={authUserId}
					name={userName}
					iconUrl={userIconUrl}
					onClose={() => setIsQROpen(false)}
				/>,
				document.body
			)}

		</header>
	)
}
