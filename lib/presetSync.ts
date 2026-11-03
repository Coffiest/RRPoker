/**
 * ブラインドのプリセットを編集したら、そのプリセットを選んでいる大会の表もすぐ同じにする(オーナー指定・2026-11-03)。
 *
 * - 対象は終わっていない大会(開催中・予定)だけ。終わった大会の記録は変えない。
 * - Adjust でその大会だけブラインドを変えた大会(blindsCustomized)は変えない。
 * - いま動いているレベルの残り時間はそのまま(levelStartedAt・timeRemaining には触らない)。新しい分は次のレベルから効く。
 * - 自動スタートの「Waiting for start」(lib/waitingLevel.ts)が入っていれば残す(消すとレベルの位置がずれる)。
 * 大会の表(customBlindLevels)が変わると、店舗のタイマー・Adjust・プレイヤーの BLINDS はすべて即座に追従する。
 */
import { collection, getDocs, query, where, writeBatch, doc } from 'firebase/firestore'
import { db } from './firebase'
import { keepWaiting } from './waitingLevel'

export async function syncPresetToTournaments(storeId: string, presetId: string, levels: any[]): Promise<number> {
  const snap = await getDocs(query(collection(db, 'stores', storeId, 'tournaments'), where('blindPresetId', '==', presetId)))
  const batch = writeBatch(db)
  let n = 0
  snap.forEach(d => {
    const t = d.data()
    if (t.status === 'finished' || t.blindsCustomized === true) return
    batch.update(doc(db, 'stores', storeId, 'tournaments', d.id), { customBlindLevels: keepWaiting(t.customBlindLevels, levels) })
    n++
  })
  if (n > 0) await batch.commit()
  return n
}
