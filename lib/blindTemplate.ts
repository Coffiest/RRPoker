// ブラインドの傾斜テンプレート(オーナー指定)。
//
// 100/200 から始まる表を基準に、初期ブラインドの「単位」(10 の何乗か)だけ合わせて使う。
//   1/2 で始めたら → 2/3, 2/4, 3/6 …
//   200/400 で始めたら → 300/600, 400/800 …
// 表に無い値(50/100 など)で始めたら、単位を合わせた表の中で、その BB より大きい最初の段から続ける。
// アンティは BB と同じ(BB アンティ)。表の最後(500000/1000000)の先は、同じ流れを 10 倍して続ける。

export type TemplateStep = { sb: number; bb: number; min: number }

const BASE: TemplateStep[] = [
  { sb: 100, bb: 200, min: 40 }, { sb: 200, bb: 300, min: 40 }, { sb: 200, bb: 400, min: 40 },
  { sb: 300, bb: 600, min: 40 }, { sb: 400, bb: 800, min: 40 }, { sb: 500, bb: 1000, min: 40 },
  { sb: 600, bb: 1200, min: 40 }, { sb: 1000, bb: 1500, min: 40 }, { sb: 1000, bb: 2000, min: 40 },
  { sb: 1500, bb: 3000, min: 40 }, { sb: 2000, bb: 4000, min: 30 }, { sb: 2500, bb: 5000, min: 30 },
  { sb: 3000, bb: 6000, min: 30 }, { sb: 4000, bb: 8000, min: 30 }, { sb: 5000, bb: 10000, min: 20 },
  { sb: 6000, bb: 12000, min: 20 }, { sb: 10000, bb: 15000, min: 20 }, { sb: 10000, bb: 20000, min: 20 },
  { sb: 12000, bb: 24000, min: 20 }, { sb: 15000, bb: 30000, min: 20 }, { sb: 20000, bb: 40000, min: 15 },
  { sb: 25000, bb: 50000, min: 15 }, { sb: 30000, bb: 60000, min: 15 }, { sb: 40000, bb: 80000, min: 15 },
  { sb: 50000, bb: 100000, min: 15 }, { sb: 60000, bb: 120000, min: 15 }, { sb: 75000, bb: 150000, min: 15 },
  { sb: 100000, bb: 150000, min: 15 }, { sb: 100000, bb: 200000, min: 10 }, { sb: 150000, bb: 300000, min: 10 },
  { sb: 200000, bb: 400000, min: 10 }, { sb: 250000, bb: 500000, min: 10 }, { sb: 300000, bb: 600000, min: 10 },
  { sb: 400000, bb: 800000, min: 10 }, { sb: 500000, bb: 1000000, min: 10 },
]
// 表の最後の先: 50000/100000 〜 500000/1000000 の流れを 10 倍ずつ繰り返す
const CYCLE = BASE.slice(BASE.findIndex(s => s.bb === 100000) + 1)

/** 表の n 段目(0 始まり)。表の先は同じ流れを 10 倍して作る。 */
function stepAt(n: number): TemplateStep {
  if (n < BASE.length) return BASE[n]
  const k = n - BASE.length
  const round = Math.floor(k / CYCLE.length) + 1
  const s = CYCLE[k % CYCLE.length]
  const f = 10 ** round
  return { sb: s.sb * f, bb: s.bb * f, min: 10 }
}

/** 初期 BB に合わせた単位(10 の何乗倍か)。100/200 の表を基準にする。 */
function unitFor(firstBb: number): number {
  if (!(firstBb > 0)) return 1
  return 10 ** Math.floor(Math.log10(firstBb / 200) + 1e-9)
}

const tidy = (v: number) => (v >= 1 ? Math.round(v) : Math.round(v * 100) / 100)

/** 今の BB の次の段(SB/BB)。単位は初期 BB(なければ今の BB)で合わせる。 */
export function nextTemplateBlind(currentBb: number, firstBb?: number): { sb: number; bb: number } {
  const unit = unitFor(firstBb && firstBb > 0 ? firstBb : currentBb)
  for (let n = 0; n < 400; n++) {
    const s = stepAt(n)
    const bb = tidy(s.bb * unit)
    if (bb > currentBb) return { sb: tidy(s.sb * unit), bb }
  }
  return { sb: tidy(currentBb), bb: tidy(currentBb * 2) }
}

/** 初期ブラインドから、表の最後まで全部のレベルを作る(時間は表どおり)。 */
export function buildTemplateLevels(sb: number, bb: number): { smallBlind: number; bigBlind: number; ante: number; duration: number }[] {
  const unit = unitFor(bb)
  const out = [{ smallBlind: sb, bigBlind: bb, ante: bb, duration: 40 }]
  let n = 0
  // 初期 BB より大きい最初の段から、表の最後(500000/1000000 の単位合わせ)まで
  while (n < BASE.length && tidy(stepAt(n).bb * unit) <= bb) n++
  // 初期ブラインドが表のどの段か(時間を合わせるため)
  const firstIdx = BASE.findIndex(s => tidy(s.bb * unit) === bb)
  if (firstIdx >= 0) out[0].duration = BASE[firstIdx].min
  for (; n < BASE.length; n++) {
    const s = stepAt(n)
    out.push({ smallBlind: tidy(s.sb * unit), bigBlind: tidy(s.bb * unit), ante: tidy(s.bb * unit), duration: s.min })
  }
  return out
}
