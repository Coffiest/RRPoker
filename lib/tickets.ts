/**
 * 店舗が作って付与するチケット(オーナー指定・2026-11-10。画面は app/home/store/tickets)。
 *
 * - 作ったチケット: stores/{店舗}/ticketTemplates/{id}
 *   名前・詳細(200 字まで)・有効期限(lib/ticketExpiry.ts)・使える店舗(系列店から選ぶ)。
 *   編集はこれから付与する分だけに効く(付与済みのチケットは変えない)。
 * - 付与したチケット: users/{プレイヤー}/tickets/{id}。お誕生日クーポンと同じ入れ物なので、
 *   プレイヤーのチケット画面(app/home/tickets)にそのまま並び、同じ流れで使う。
 *   storeId は付与した店舗(Firestore のルールはこれを見て店舗にも読み書きを許す)。
 * - 付与の記録: stores/{店舗}/ticketGrants/{id}。誰に・いつ・何枚・どのチケット id か。
 *   履歴・使用済みにする・取り消し(未使用だけ回収)はここから。
 * - 付与したらプレイヤーのお知らせ(notifications)に「○○からチケットが届きました」を出す。
 * - 作る・付与するのはオーナーと権限のある人(managerUids)。
 */
import {
  addDoc, collection, deleteDoc, doc, getDoc, serverTimestamp, Timestamp, updateDoc, writeBatch,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { expiresAtFor, type TicketExpiry } from '@/lib/ticketExpiry'

export type TicketTemplate = TicketExpiry & {
  id: string
  name: string
  description: string
  usableStoreIds: string[]
  createdAt?: Timestamp | null
}

export type TicketGrant = {
  id: string
  templateId: string
  name: string
  uid: string
  playerName: string
  playerIconUrl?: string | null
  ticketIds: string[]
  count: number
  createdAt?: Timestamp | null
  revokedIds?: string[]
}

export type GrantedTicket = { id: string; isUsed: boolean; usedAt?: Timestamp | null; expiresAt?: Timestamp | null; exists: boolean }

export type TemplateInput = Omit<TicketTemplate, 'id' | 'createdAt'>

const clean = (t: TemplateInput) => ({
  name: t.name.trim(),
  description: t.description.trim(),
  expiryMode: t.expiryMode,
  expiryValue: t.expiryMode === 'relative' ? Number(t.expiryValue) : null,
  expiryUnit: t.expiryMode === 'relative' ? (t.expiryUnit ?? 'day') : null,
  expiryDate: t.expiryMode === 'date' ? (t.expiryDate ?? null) : null,
  usableStoreIds: t.usableStoreIds,
})

export const createTemplate = (storeId: string, t: TemplateInput) =>
  addDoc(collection(db, 'stores', storeId, 'ticketTemplates'), { ...clean(t), createdAt: serverTimestamp(), updatedAt: serverTimestamp() })

export const updateTemplate = (storeId: string, id: string, t: TemplateInput) =>
  updateDoc(doc(db, 'stores', storeId, 'ticketTemplates', id), { ...clean(t), updatedAt: serverTimestamp() })

/** 一覧から消すだけ。付与済みのチケットはそのまま残る */
export const deleteTemplate = (storeId: string, id: string) => deleteDoc(doc(db, 'stores', storeId, 'ticketTemplates', id))

/** 1 人に count 枚付与する。チケット・付与の記録・お知らせを 1 回の書き込みで行う */
export async function grantTicket(args: {
  storeId: string
  storeName: string
  template: TicketTemplate
  usableStoreNames: string[]
  player: { uid: string; name: string; iconUrl?: string | null }
  count: number
  grantedBy: string
}) {
  const { storeId, storeName, template, usableStoreNames, player, grantedBy } = args
  const count = Math.max(1, Math.min(99, Math.floor(args.count)))
  const batch = writeBatch(db)
  const expires = expiresAtFor(template)
  const ticketIds: string[] = []
  for (let i = 0; i < count; i++) {
    const ref = doc(collection(db, 'users', player.uid, 'tickets'))
    ticketIds.push(ref.id)
    batch.set(ref, {
      name: template.name,
      description: template.description || null,
      storeId,
      storeName,
      usableStoreIds: template.usableStoreIds,
      usableStoreNames,
      expiresAt: expires ? Timestamp.fromDate(expires) : null,
      isUsed: false,
      source: 'store_grant',
      templateId: template.id,
      createdAt: serverTimestamp(),
    })
  }
  const grantRef = doc(collection(db, 'stores', storeId, 'ticketGrants'))
  batch.set(grantRef, {
    templateId: template.id, name: template.name,
    uid: player.uid, playerName: player.name || '', playerIconUrl: player.iconUrl ?? null,
    ticketIds, count, revokedIds: [], grantedBy, createdAt: serverTimestamp(),
  })
  batch.set(doc(collection(db, 'notifications')), {
    userId: player.uid, storeId, storeName,
    message: `${storeName} からチケット「${template.name}」${count > 1 ? `を ${count} 枚` : ''}が届きました`,
    type: 'ticket_grant', createdAt: serverTimestamp(), read: false,
  })
  await batch.commit()
}

/** 付与したチケットの今の状態(使用済みか・取り消し済みか) */
export async function loadGrantTickets(grant: TicketGrant): Promise<GrantedTicket[]> {
  return Promise.all(grant.ticketIds.map(async id => {
    const s = await getDoc(doc(db, 'users', grant.uid, 'tickets', id)).catch(() => null)
    const d = s?.data()
    return { id, exists: !!s?.exists(), isUsed: d?.isUsed === true, usedAt: d?.usedAt ?? null, expiresAt: d?.expiresAt ?? null }
  }))
}

/** 店舗から使用済みにする(プレイヤーの画面で使ったのと同じ印) */
export const markTicketUsed = (uid: string, ticketId: string) =>
  updateDoc(doc(db, 'users', uid, 'tickets', ticketId), { isUsed: true, usedAt: serverTimestamp(), usedByStore: true })

/** 未使用のチケットを回収する(使用済みは残す) */
export async function revokeTickets(storeId: string, grant: TicketGrant, ids: string[]) {
  const batch = writeBatch(db)
  ids.forEach(id => batch.delete(doc(db, 'users', grant.uid, 'tickets', id)))
  batch.update(doc(db, 'stores', storeId, 'ticketGrants', grant.id), { revokedIds: [...(grant.revokedIds ?? []), ...ids] })
  await batch.commit()
}
