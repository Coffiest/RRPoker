// 店舗の権限(オーナー指定)。
//
// プレイヤーに「店舗を操作する権限」を付けられる。付けた人はオーナーと同じことができる。
// ただし、権限の付け外し・店舗の削除・課金(解約など)・系列店の追加はオーナーだけ。
//
// - 権限は stores/{id}.managerUids(プレイヤーの uid の配列)。Firestore のルール・Cloud Functions・
//   API はここを見て判断する(firestore.rules の isStoreOwner / functions の canOperateStore)。
// - 店舗画面を開くとき、プレイヤーの users/{uid}.storeId に操作する店舗を入れる。店舗画面はどこも
//   users.storeId から店舗を決めているので、画面を作り替えずにそのまま使える。
//   users.storeId だけでは何の権限にもならない(ルールは必ず managerUids かオーナーかを見る)。
// - プレイヤー側で権限を足すときは、店舗のアカウントで一度だけログインして本人確認する。
//   ログインは別の Firebase アプリの中で行い、すぐにログアウトする。パスワードは保存しない。

import { deleteApp, getApp, initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { arrayRemove, arrayUnion, collection, connectFirestoreEmulator, doc, getDoc, getDocs, getFirestore, onSnapshot, query, updateDoc, where, type Firestore } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from './firebase'

export type ManagedStore = { id: string; name: string; iconUrl?: string }

/** 自分に権限が付いている店舗の一覧(リアルタイム)。 */
export function useManagedStores(uid: string | null): ManagedStore[] {
  const [list, setList] = useState<ManagedStore[]>([])
  useEffect(() => {
    if (!uid) { setList([]); return }
    const q = query(collection(db, 'stores'), where('managerUids', 'array-contains', uid))
    return onSnapshot(q, snap => setList(snap.docs.map(d => ({ id: d.id, name: d.data().name ?? '店舗', iconUrl: d.data().iconUrl }))), () => setList([]))
  }, [uid])
  return list
}

/** 店舗のアカウントで一度ログインして、その店舗の権限を自分に付ける。 */
export async function grantByStoreLogin(email: string, password: string, playerUid: string): Promise<{ storeId: string; name: string }> {
  const name = 'rr-grant-' + Date.now()
  const app2 = initializeApp(getApp().options, name)
  try {
    const auth2 = getAuth(app2)
    const db2 = getFirestore(app2)
    if (process.env.NEXT_PUBLIC_FIREBASE_EMULATOR === '1') {
      connectAuthEmulator(auth2, 'http://127.0.0.1:9099', { disableWarnings: true })
      connectFirestoreEmulator(db2, '127.0.0.1', 8080)
    }
    const cred = await signInWithEmailAndPassword(auth2, email.trim(), password)
    const u = (await getDoc(doc(db2, 'users', cred.user.uid))).data()
    if (u?.role !== 'store' || typeof u.storeId !== 'string') throw new Error('not_store')
    const storeRef = doc(db2, 'stores', u.storeId)
    const s = (await getDoc(storeRef)).data()
    if (!s || s.ownerUid !== cred.user.uid) throw new Error('not_owner')
    if (cred.user.uid === playerUid) throw new Error('self')
    // 権限は系列店(同じオーナーの店舗)すべてに付ける(2026-11-10。以前は 1 店舗だけで、系列店に入れなかった)
    const ids = await ownerStoreIds(cred.user.uid, db2)
    await Promise.all((ids.length ? ids : [u.storeId]).map(id => updateDoc(doc(db2, 'stores', id), { managerUids: arrayUnion(playerUid) })))
    await signOut(auth2)
    return { storeId: u.storeId, name: s.name ?? '店舗' }
  } finally {
    await deleteApp(app2).catch(() => {})
  }
}

/** 同じオーナーの店舗(本店と系列店)の id。 */
async function ownerStoreIds(ownerUid: string, database: Firestore = db): Promise<string[]> {
  const snap = await getDocs(query(collection(database, 'stores'), where('ownerUid', '==', ownerUid)))
  return snap.docs.map(d => d.id)
}

/** 店舗とその系列店すべてに同じ変更をする(権限は系列店で共通。2026-11-10) */
async function forGroup(storeId: string, data: Record<string, unknown>) {
  const owner = (await getDoc(doc(db, 'stores', storeId))).data()?.ownerUid as string | undefined
  const ids = owner ? await ownerStoreIds(owner) : []
  await Promise.all((ids.includes(storeId) ? ids : [storeId, ...ids]).map(id => updateDoc(doc(db, 'stores', id), data)))
}

/** オーナーが店舗側から権限を付ける / 外す。系列店すべてに付け外しする。 */
export const addManager = (storeId: string, uid: string) => forGroup(storeId, { managerUids: arrayUnion(uid) })
export const removeManager = (storeId: string, uid: string) => forGroup(storeId, { managerUids: arrayRemove(uid) })

/**
 * 以前に 1 店舗だけへ付けた権限を、系列店すべてにそろえる(オーナーが店舗ホームを開いたときに走る)。
 * 権限の欄はオーナーしか書けない(firestore.rules)ので、オーナーの画面から行う。
 */
export async function syncGroupManagers(ownerUid: string) {
  const snap = await getDocs(query(collection(db, 'stores'), where('ownerUid', '==', ownerUid)))
  if (snap.size < 2) return
  const all = new Set<string>()
  snap.docs.forEach(d => ((d.data().managerUids ?? []) as string[]).forEach(u => all.add(u)))
  if (all.size === 0) return
  await Promise.all(snap.docs.map(d => {
    const has = new Set((d.data().managerUids ?? []) as string[])
    const missing = [...all].filter(u => !has.has(u))
    return missing.length ? updateDoc(d.ref, { managerUids: arrayUnion(...missing) }) : null
  }))
}

/** プレイヤーが権限のある店舗の画面へ切り替える(操作する店舗を users.storeId に入れる)。 */
export const switchToStore = (uid: string, storeId: string) => updateDoc(doc(db, 'users', uid), { storeId })
