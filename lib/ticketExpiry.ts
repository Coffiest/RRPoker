/**
 * 店舗が作るチケットの有効期限(オーナー指定・2026-11-10)。
 * - relative: 付与した日から ○日 / ○ヶ月(お誕生日クーポンと同じ数え方)
 * - date: 決めた日付の終わり(その日の 23:59:59)まで。全員同じ
 * - none: 無期限
 */
export type ExpiryMode = 'relative' | 'date' | 'none'
export type TicketExpiry = {
  expiryMode: ExpiryMode
  expiryValue?: number | null
  expiryUnit?: 'day' | 'month' | null
  /** YYYY-MM-DD */
  expiryDate?: string | null
}

export function expiresAtFor(t: TicketExpiry, now: Date = new Date()): Date | null {
  if (t.expiryMode === 'none') return null
  if (t.expiryMode === 'date') {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t.expiryDate ?? '')
    if (!m) return null
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59, 59)
  }
  const v = Number(t.expiryValue ?? 0)
  if (!(v > 0)) return null
  if (t.expiryUnit === 'month') { const d = new Date(now); d.setMonth(d.getMonth() + v); return d }
  return new Date(now.getTime() + v * 24 * 60 * 60 * 1000)
}

/** 画面に出す期限の説明(例: 付与から 30 日 / 2026/12/31 まで / 無期限) */
export function expiryLabel(t: TicketExpiry): string {
  if (t.expiryMode === 'none') return '無期限'
  if (t.expiryMode === 'date') {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t.expiryDate ?? '')
    return m ? `${Number(m[1])}/${Number(m[2])}/${Number(m[3])} まで` : '期限の日付が未設定'
  }
  const v = Number(t.expiryValue ?? 0)
  return `付与から ${v} ${t.expiryUnit === 'month' ? 'ヶ月' : '日'}`
}

/** 入力の確かめ。問題なければ null */
export function validateTicket(t: { name: string; description: string } & TicketExpiry, usableCount: number, today: Date = new Date()): string | null {
  if (!t.name.trim()) return 'チケットの名前を入れてください'
  if (t.name.trim().length > 40) return '名前は 40 文字までです'
  if (t.description.length > 200) return '詳細は 200 文字までです'
  if (usableCount < 1) return '使える店舗を 1 つ以上選んでください'
  if (t.expiryMode === 'relative' && !(Number(t.expiryValue) > 0)) return '有効期限の日数・月数を入れてください'
  if (t.expiryMode === 'date') {
    const end = expiresAtFor(t)
    if (!end) return '有効期限の日付を選んでください'
    if (end.getTime() < today.getTime()) return '有効期限の日付が過ぎています'
  }
  return null
}
