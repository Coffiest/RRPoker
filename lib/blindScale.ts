/**
 * ブラインドの単位を一括で変える(オーナー指定・2026-11-16)。
 * 例: 100/200 で組んだ表を 1/2 にしたい → 「0 を外す」を 2 回。2/4 の表を 200/400 にしたい → 「0 を付ける」を 2 回。
 * SB・BB・アンティをすべてのレベルで同時に 10 倍 / 10 分の 1 にする。時間とブレイクは変えない。
 * 10 分の 1 は、すべての数が 10 で割り切れるときだけ(端数を出さない)。だから何回押しても逆の操作で必ず元に戻る。
 */
type AnyLevel = { type: string; smallBlind?: number | null; bigBlind?: number | null; ante?: number | null }

const nums = (ls: AnyLevel[]) => ls.flatMap(l => l.type === 'level' ? [l.smallBlind, l.bigBlind, l.ante] : []).filter((v): v is number => typeof v === 'number' && v > 0)

/** 0 を 1 つ外せるか(すべての数が 10 で割り切れ、1 つ以上ある) */
export function canShrink(ls: AnyLevel[]): boolean {
  const n = nums(ls)
  return n.length > 0 && n.every(v => v % 10 === 0)
}

/** 0 を 1 つ付けられるか(数が 1 つ以上あり、大きくなりすぎない) */
export function canGrow(ls: AnyLevel[]): boolean {
  const n = nums(ls)
  return n.length > 0 && n.every(v => v * 10 <= 1_000_000_000)
}

/** dir = 1 で 10 倍、-1 で 10 分の 1。できないときは元のまま返す */
export function scaleBlinds<T extends AnyLevel>(ls: T[], dir: 1 | -1): T[] {
  if (dir === -1 ? !canShrink(ls) : !canGrow(ls)) return ls
  const f = (v: number | null | undefined) => typeof v === 'number' && v > 0 ? (dir === 1 ? v * 10 : v / 10) : v
  return ls.map(l => l.type === 'level' ? { ...l, smallBlind: f(l.smallBlind), bigBlind: f(l.bigBlind), ante: f(l.ante) } : l)
}

/** 開いたときから何桁変えたかの表示(0 → 元のまま、2 → ×100、-2 → ÷100) */
export function shiftLabel(shift: number): string {
  if (shift === 0) return '元のまま'
  return `${shift > 0 ? '×' : '÷'}${(10 ** Math.abs(shift)).toLocaleString('ja-JP')}`
}
