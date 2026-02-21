import { db } from './firebase'
import { collection, query, where, getDocs } from 'firebase/firestore'

/**
 * プレイヤーIDの一意性をチェック
 * @param playerId チェック対象のプレイヤーID（@なし）
 * @returns true: 利用可能, false: 既に使用中
 */
export const isPlayerIdAvailable = async (playerId: string): Promise<boolean> => {
  const normalizedId = `@${playerId.replace(/^@/, '')}`
  
  const usersRef = collection(db, 'users')
  const q = query(usersRef, where('playerId', '==', normalizedId))
  const snapshot = await getDocs(q)
  
  return snapshot.empty
}

/**
 * 利用可能なプレイヤーIDを取得（重複時は数字を付加）
 * @param baseId ベースとなるID（@なし）
 * @returns 利用可能なプレイヤーID（@付き）
 */
export const getAvailablePlayerId = async (baseId: string): Promise<string> => {
  const cleanId = baseId.replace(/^@/, '').toLowerCase().trim()
  
  // 1文字以上のチェック
  if (!cleanId) {
    throw new Error('プレイヤーIDは1文字以上必要です')
  }

  // 特殊文字チェック（英数字とアンダースコア、ハイフンのみ）
  if (!/^[a-z0-9_-]+$/.test(cleanId)) {
    throw new Error('プレイヤーIDは英数字、アンダースコア、ハイフンのみ使用可能です')
  }

  // 基本IDが利用可能か確認
  const available = await isPlayerIdAvailable(cleanId)
  if (available) {
    return `@${cleanId}`
  }

  // 重複している場合、数字を付加して複数試す
  for (let i = 1; i <= 9999; i++) {
    const candidateId = `${cleanId}${i}`
    const isAvail = await isPlayerIdAvailable(candidateId)
    if (isAvail) {
      return `@${candidateId}`
    }
  }

  throw new Error('利用可能なIDが見つかりませんでした')
}

/**
 * プレイヤーIDのバリデーション
 * @param playerId チェック対象のプレイヤーID
 * @returns バリデーション結果 { valid: boolean, message?: string }
 */
export const validatePlayerId = (playerId: string): { valid: boolean; message?: string } => {
  const cleanId = playerId.replace(/^@/, '').trim()

  if (!cleanId) {
    return { valid: false, message: 'プレイヤーIDは必須です' }
  }

  if (cleanId.length < 1 || cleanId.length > 30) {
    return { valid: false, message: 'プレイヤーIDは1文字以上30文字以下にしてください' }
  }

  if (!/^[a-z0-9_-]+$/.test(cleanId)) {
    return {
      valid: false,
      message: 'プレイヤーIDは英数字（小文字）、アンダースコア、ハイフンのみ使用可能です',
    }
  }

  return { valid: true }
}
