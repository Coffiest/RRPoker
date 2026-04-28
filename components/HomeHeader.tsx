'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FiBell, FiTrash2, FiCreditCard } from 'react-icons/fi'
import { auth, db } from '@/lib/firebase'
import { collection, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where, writeBatch } from 'firebase/firestore'

import type { MenuItem } from './commonMenuItems'
import { getCommonMenuItems } from './commonMenuItems'



type NotificationItem = {
	id: string
	storeId: string
	storeName: string
	expiresAt: Date
}

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

const DISMISSED_NOTICE_KEY = 'rrpoker.dismissedNotices'

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

	const [notifications, setNotifications] = useState<NotificationItem[]>([])
	const [userNotifications, setUserNotifications] = useState<UserNotificationItem[]>([])
	const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())
	const [storeNotices, setStoreNotices] = useState<StoreNoticeItem[]>([])

	const [authUserId, setAuthUserId] = useState<string | null>(null)
	const [noticeFavoriteStores, setNoticeFavoriteStores] = useState<string[]>([])
	const [storeNoticeItems, setStoreNoticeItems] = useState<Array<{
		id: string; storeId: string; storeName: string; message: string; createdAt?: { seconds?: number }
	}>>([])
	const [noticeReadIds, setNoticeReadIds] = useState<Set<string>>(new Set())

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
			} catch {}
		})
		return () => unsub()
	}, [isUserVariant])

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

	const dismissNotification = (id: string) => {
		const next = new Set(dismissedIds)
		next.add(id)
		setDismissedIds(next)
		setNotifications(prev => prev.filter(item => item.id !== id))
		window.localStorage.setItem(DISMISSED_NOTICE_KEY, JSON.stringify(Array.from(next)))
	}

	const effectiveMenuItems =
		menuItems && menuItems.length > 0 ? menuItems : getCommonMenuItems(router, variant)

	return (
		<header className="sticky top-0 z-50 border-b border-gray-100 bg-white/90 backdrop-blur">
			<div className="mx-auto flex min-h-[64px] max-w-sm items-center justify-between px-5 py-3">
				<button
					type="button"
					onClick={() => router.push(homePath)}
					className="flex items-center gap-0 text-[18px] font-semibold text-gray-900"
				>
					<img src="/icon-192x192.png" alt="RRPoker logo" className="h-[60px] w-[60px]" />
					<span>RRPOKER</span>
				</button>

				<div className="flex items-center gap-2">
					{isUserVariant && (
						<button
							type="button"
							onClick={() => router.push('/home/tickets')}
							className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-gray-700 hover:border-gray-300 transition-colors"
						>
							<FiCreditCard className="text-[18px]" />
						</button>
					)}

					{showNotifications && (
						<button
							type="button"
							onClick={() => setIsNoticeOpen(prev => !prev)}
							className="relative flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-gray-700 hover:border-gray-300 transition-colors"
						>
							<FiBell className="text-[18px]" />
							{(isUserVariant
								? storeNoticeItems.some(n => !noticeReadIds.has(n.id)) || userNotifications.some(n => !n.read)
								: storeNotices.length > 0) && (
								<span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-red-500" />
							)}
						</button>
					)}

					<button
						type="button"
						onClick={() => setIsMenuOpen(prev => !prev)}
						className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-gray-700"
					>
						<span className="flex flex-col gap-1">
							<span className="h-[2px] w-5 rounded bg-gray-700" />
							<span className="h-[2px] w-5 rounded bg-gray-700" />
							<span className="h-[2px] w-5 rounded bg-gray-700" />
						</span>
					</button>
				</div>
			</div>

			{/* オーバーレイ */}
			<div
				className={`fixed inset-0 z-[999] bg-white transition-opacity ${
					isMenuOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
				}`}
				onClick={() => setIsMenuOpen(false)}
			/>

			{/* 右スライドメニュー */}
			<aside
				className={`fixed right-0 top-0 z-[1000] h-screen w-[80%] max-w-sm border-l border-gray-200 bg-white shadow-2xl transition-transform duration-300 ${
					isMenuOpen ? 'translate-x-0' : 'translate-x-full'
				}`}
			>
				<div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
					<p className="text-[14px] font-semibold text-gray-900">メニュー</p>
					<button onClick={() => setIsMenuOpen(false)} className="text-[13px] text-gray-500">
						閉じる
					</button>
				</div>

				<div className="px-5 py-4 space-y-3">
					{effectiveMenuItems.map(item => (
						<button
							key={item.label}
							onClick={() => {
								setIsMenuOpen(false)
								item.onClick()
							}}
							className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-left text-[14px] font-semibold text-gray-900"
						>
							{item.label}
						</button>
					))}

					<button
						onClick={() => goTo(myPagePath)}
						className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-left text-[14px] font-semibold text-gray-900"
					>
						マイページ
					</button>
				</div>
			</aside>

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
							<div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-gray-100">
								<p className="text-[15px] font-semibold text-gray-900">お知らせ</p>
								<button type="button" onClick={() => setIsNoticeOpen(false)} className="text-[13px] text-gray-400 font-medium">閉じる</button>
							</div>

							{/* 全て既読ボタン */}
							{(storeNoticeItems.some(n => !noticeReadIds.has(n.id)) || userNotifications.some(n => !n.read)) && (
								<div className="px-4 py-2.5 border-b border-gray-100 flex justify-end">
									<button
										type="button"
										onClick={markAllRead}
										className="text-[12px] font-semibold text-[#D4910A] bg-[#FFF8E7] rounded-full px-4 py-1.5 active:bg-[#FFE9B0] transition-colors"
									>
										すべて既読にする
									</button>
								</div>
							)}

							{/* リスト */}
							<div className="max-h-[55vh] overflow-y-auto">
								{storeNoticeItems.length === 0 && userNotifications.length === 0 ? (
									<p className="text-center text-[13px] text-gray-400 py-8">お知らせはありません</p>
								) : (
									<>
										{storeNoticeItems.map(n => {
											const isUnread = !noticeReadIds.has(n.id)
											return (
												<div
													key={n.id}
													className={`px-4 py-3.5 border-b border-gray-50 transition-colors ${isUnread ? 'bg-[#FFF8E7] active:bg-[#FFE9B0]' : 'bg-white'}`}
													onClick={() => { if (isUnread) markStoreNoticeRead(n.id) }}
												>
													<div className="flex items-center gap-2 mb-1">
														{isUnread && <span className="h-2 w-2 rounded-full bg-[#D4910A] flex-shrink-0" />}
														<span className="text-[11px] font-bold text-[#D4910A] flex-1">{n.storeName}</span>
														<span className="text-[10px] text-gray-400">{formatDateTime(n.createdAt?.seconds)}</span>
													</div>
													<p className={`text-[13px] leading-relaxed ${isUnread ? 'text-gray-800 font-medium' : 'text-gray-500'}`}>{n.message}</p>
												</div>
											)
										})}
										{userNotifications.map(n => (
											<div
												key={n.id}
												className={`px-4 py-3.5 border-b border-gray-50 transition-colors ${!n.read ? 'bg-[#FFF8E7] active:bg-[#FFE9B0]' : 'bg-white'}`}
												onClick={() => { if (!n.read) markUserNotifRead(n.id) }}
											>
												<div className="flex items-center gap-2 mb-1">
													{!n.read && <span className="h-2 w-2 rounded-full bg-[#D4910A] flex-shrink-0" />}
													<span className="text-[11px] font-bold text-[#D4910A] flex-1">{n.storeName}</span>
													<span className="text-[10px] text-gray-400">{formatDateTime(n.createdAt?.seconds)}</span>
												</div>
												<p className={`text-[13px] leading-relaxed ${!n.read ? 'text-gray-800 font-medium' : 'text-gray-500'}`}>{n.message}</p>
											</div>
										))}
									</>
								)}
							</div>

						</div>
					</div>
				</>
			)}
		</header>
	)
}
