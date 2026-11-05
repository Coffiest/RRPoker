'use client'

/**
 * 大会名の下に出す「開始 19:00  RC 20:05  終了 21:00」の行(オーナー指定・2026-11-05)。
 * 以前は大会名と同じ行に詰めていたため、名前の長さで改行されたりされなかったりした。
 * いつも大会名の下の行に、開始・RC・終了の順で横に並べる。
 *
 * RC ブレイクが終わると、終了はその瞬間のチップで再計算した時刻になる(lib/endEstimate.ts の rcEstimate)。
 * 店舗の画面(store)だけ、最初の終了予定 → 再計算した時刻と、「○分遅延」(赤)/「○分早まる」(緑)を出す。
 */

import type { CSSProperties } from 'react'
import { tournamentClocks } from '@/lib/endEstimate'

type Clocks = ReturnType<typeof tournamentClocks>

export default function ClockRow({ clocks, store = false, fontSize = 11, style }: {
  clocks: Clocks
  store?: boolean
  fontSize?: number
  style?: CSSProperties
}) {
  const { start, rc, end, endOriginal, delayMin, recalculated } = clocks
  if (!start && !rc && !end) return null
  const showBefore = store && recalculated && endOriginal && endOriginal !== end
  return (
    <span className="con-mono" style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', columnGap: 12, rowGap: 4, fontSize, color: 'var(--label2)', ...style }}>
      {start && <span>開始 <span style={{ color: 'var(--label)' }}>{start}</span></span>}
      {rc && <span style={{ fontWeight: 700, color: '#D4910A' }}>RC {rc}</span>}
      {end && (
        <span>
          終了 {showBefore && <span>{endOriginal} → </span>}
          <span style={{ color: 'var(--label)', fontWeight: recalculated ? 700 : 400 }}>{end}</span>
        </span>
      )}
      {store && delayMin !== null && delayMin > 0 && (
        <span style={{ fontWeight: 700, color: '#C62828' }}>{delayMin}分遅延</span>
      )}
      {store && delayMin !== null && delayMin < 0 && (
        <span style={{ fontWeight: 700, color: '#1E7B34' }}>{-delayMin}分早まる</span>
      )}
    </span>
  )
}
