import { httpsCallable, FunctionsError } from 'firebase/functions'
import { functions } from './firebase'

/**
 * トーナメントのリエントリー / アドオンの確定と取消。
 *
 * 中身は Cloud Functions にある(functions/src/index.ts)。ここは呼ぶだけ。
 *
 * クライアントから Firestore を直接書かない理由は、書き込み先のうち
 * 大会文書の集計値と transactions が、ルール上は店舗オーナーにしか
 * 許されていないため。プレイヤーに開くと、自分の残高を増やす・大会の集計を
 * 書き換える、が同時にできてしまう。参加費もサーバー上の大会文書から読ませ、
 * 画面から渡された金額を信用しない。
 *
 * 呼び出し側は例外を捕まえなくてよいように、失敗も戻り値で返す。
 */

export type PurchaseKind = 'reentry' | 'addon'

export type PurchaseParams = {
  storeId: string
  /**
   * 残高の置き場。系列店で残高を共有するため storeId とは別に持つ。
   * ただし実際に使う値はサーバーが店舗文書から引き直すので、ここで渡すのは
   * 呼び出し側の取り違えを防ぐための記録用でしかない。
   */
  balanceGroupId?: string
  tournamentId: string
  /**
   * 誰の操作か。サーバーはログイン中のアカウントを使うので、この値は送らない。
   * 型として残しているのは呼び出し側の見通しのため。
   */
  playerId?: string
  playerName?: string | null
  kind: PurchaseKind
}

export type PurchaseFailure = 'not_found' | 'no_fee' | 'insufficient' | 'not_active' | 'failed'

export type PurchaseResult =
  | { ok: true; transactionId: string; fee: number }
  | { ok: false; reason: PurchaseFailure }

/** Cloud Functions が投げた HttpsError から、画面に出す理由を取り出す。 */
const reasonOf = (error: unknown): string => {
  const message = (error as FunctionsError | undefined)?.message
  return typeof message === 'string' ? message : ''
}

/**
 * リエントリー / アドオンを確定する。
 *
 * 残高が足りなければ何も書かれず insufficient が返る。画面側でボタンを
 * 無効化しているが、すり抜けた場合の最後の砦はサーバーのほう。
 */
export async function applyTournamentPurchase(params: PurchaseParams): Promise<PurchaseResult> {
  const fn = httpsCallable<
    { storeId: string; tournamentId: string; kind: PurchaseKind },
    { transactionId: string; fee: number }
  >(functions, 'applyTournamentPurchase')

  try {
    const res = await fn({
      storeId: params.storeId,
      tournamentId: params.tournamentId,
      kind: params.kind,
    })
    return { ok: true, transactionId: res.data.transactionId, fee: res.data.fee }
  } catch (error) {
    const reason = reasonOf(error)
    if (reason === 'not_found' || reason === 'no_fee' || reason === 'insufficient' || reason === 'not_active') {
      return { ok: false, reason }
    }
    return { ok: false, reason: 'failed' }
  }
}

export type RevertResult =
  | { ok: true }
  | { ok: false; reason: 'not_found' | 'already_revoked' | 'wrong_type' | 'failed' }

/**
 * 確定済みの1件を取り消す。
 *
 * 反対仕訳を足すのではなく、元の1件に revokedAt を立てて数量と残高を戻す。
 * 履歴に「リエントリー」と「その取消」が2行並ぶより、1行が取消済みとして
 * 残るほうが、店員が現状を読み違えない。押せるのは店舗オーナーだけ。
 */
export async function revertTournamentPurchase(transactionId: string): Promise<RevertResult> {
  const fn = httpsCallable<{ transactionId: string }, { ok: boolean }>(
    functions,
    'revertTournamentPurchase',
  )

  try {
    await fn({ transactionId })
    return { ok: true }
  } catch (error) {
    const reason = reasonOf(error)
    if (reason === 'not_found' || reason === 'already_revoked' || reason === 'wrong_type') {
      return { ok: false, reason }
    }
    return { ok: false, reason: 'failed' }
  }
}
