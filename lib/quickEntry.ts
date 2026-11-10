/**
 * QR から 1 回押して確定するエントリー・リエントリー・アドオン・バスト(オーナー指定・2026-11-07)。
 * 以前は QR のシート → 別の画面(PlayerManageModal)→ ✓ で確定と手順が多く、遅かった。
 * 記録の付け方は PlayerManageModal の保存(handleSave)と同じ:
 *   参加記録(entries)と大会の合計は増分、残高は参加費を引き、取引の記録(transactions)を残す。
 *   残高が足りないときは「その場で会計した」扱いで、参加費と同じ額の購入(store_chip_purchase)も記録する。
 * 取り消しは同じ額を戻す(PlayerManageModal で −1 したときと同じ。返金の記録を残す)。
 */
import { collection, doc, increment, serverTimestamp, writeBatch } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export type QuickAction = 'entry' | 'reentry' | 'addon' | 'bust'

const FIELD = { entry: 'entryCount', reentry: 'reentryCount', addon: 'addonCount' } as const
const TOTAL = { entry: 'totalEntry', reentry: 'totalReentry', addon: 'totalAddon' } as const
const TX = { entry: 'store_tournament_entry', reentry: 'store_tournament_reentry', addon: 'store_tournament_addon' } as const

export type QuickArgs = {
  storeId: string
  balanceGroupId: string
  tournamentId: string
  playerId: string
  playerName: string
  action: QuickAction
  fee: number
  /** 残高が足りず、その場で会計したとき(参加費と同じ額の購入を記録する) */
  withPurchase?: boolean
}

/** 1 回分を確定する。sign = 1 で追加、-1 で取り消し */
export async function commitQuick(a: QuickArgs, sign: 1 | -1 = 1) {
  const batch = writeBatch(db)
  const tRef = doc(db, 'stores', a.storeId, 'tournaments', a.tournamentId)
  if (a.action === 'bust') {
    batch.update(tRef, { bustCount: increment(sign) })
    await batch.commit()
    return
  }
  batch.set(doc(db, 'stores', a.storeId, 'tournaments', a.tournamentId, 'entries', a.playerId),
    { name: a.playerName, isTemp: false, [FIELD[a.action]]: increment(sign) }, { merge: true })
  batch.update(tRef, { [TOTAL[a.action]]: increment(sign) })
  if (a.fee > 0) {
    const purchase = sign === 1 && a.withPurchase ? a.fee : 0
    batch.set(doc(db, 'users', a.playerId, 'storeBalances', a.balanceGroupId),
      { balance: increment(purchase - sign * a.fee), netGain: increment(-sign * a.fee) }, { merge: true })
    if (purchase > 0) {
      batch.set(doc(collection(db, 'transactions')), { storeId: a.storeId, playerId: a.playerId, playerName: a.playerName || null, amount: purchase, direction: 'add', type: 'store_chip_purchase', tournamentId: a.tournamentId, createdAt: serverTimestamp() })
    }
  }
  // 参加の記録は参加費が 0 でも残す(店舗の「チップ履歴」・プレイヤーの履歴に、すべての参加が出るように。2026-11-10)
  batch.set(doc(collection(db, 'transactions')), { storeId: a.storeId, playerId: a.playerId, playerName: a.playerName || null, amount: a.fee, direction: sign === 1 ? 'subtract' : 'add', type: TX[a.action], tournamentId: a.tournamentId, createdAt: serverTimestamp() })
  await batch.commit()
}
