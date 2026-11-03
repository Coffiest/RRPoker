/**
 * ブラインド表をテキストにする(コピーして LINE や SNS に貼る用)。
 * 店舗の「+」のブラインド一覧と、プレイヤーの BLINDS のシートで同じ形を使う。
 *
 *   RR Super Turbo
 *   Lv1   2 / 4  (ante 4)  20分
 *   BREAK  5分  RC / CU 1
 */
export type TextLevel = {
  type: string
  smallBlind?: number | null
  bigBlind?: number | null
  ante?: number | null
  duration?: number | null
  comment?: string | null
}

const n = (v: number | null | undefined) => (typeof v === 'number' && Number.isFinite(v) ? v.toLocaleString('en-US') : '-')

export function blindsToText(name: string, levels: TextLevel[]): string {
  const lines: string[] = []
  if (name.trim()) lines.push(name.trim())
  let lv = 0
  for (const l of levels) {
    const min = typeof l.duration === 'number' ? `${l.duration}分` : ''
    const note = l.comment && l.comment.trim() ? `  ${l.comment.trim()}` : ''
    if (l.type === 'break') {
      lines.push(`BREAK  ${min}${note}`.trimEnd())
      continue
    }
    lv++
    const ante = typeof l.ante === 'number' && l.ante > 0 ? `  (ante ${n(l.ante)})` : ''
    lines.push(`Lv${lv}  ${n(l.smallBlind)} / ${n(l.bigBlind)}${ante}  ${min}${note}`.trimEnd())
  }
  return lines.join('\n')
}

/** クリップボードへ書く。使えない環境では false。 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return true }
  } catch {}
  try {
    const ta = document.createElement('textarea')
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0'
    document.body.appendChild(ta); ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch { return false }
}
