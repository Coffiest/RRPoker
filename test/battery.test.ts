/**
 * 電池を減らす書き方が紛れ込まないかの検査(オーナー指示・2026-11-16。決まりは docs/BATTERY.md と CLAUDE.md)。
 * - ずっと動き続けるアニメ(infinite)は、決めた例外だけ
 * - 1 秒より短い間隔の setInterval は使わない
 */
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOTS = ['app', 'components', 'lib']
const files: string[] = []
const walk = (d: string) => {
  for (const n of readdirSync(d)) {
    const p = join(d, n)
    if (statSync(p).isDirectory()) { if (!p.includes('admin') && n !== 'node_modules') walk(p) }
    else if (/\.(tsx?|css)$/.test(n)) files.push(p)
  }
}
ROOTS.forEach(walk)

// 例外: 読み込みの回転(見ている間だけ)・TV/PC のタイマー画面そのもの・並べ替え中の揺れ・手描きボタンの乗せている間だけの動き・
// QR 読み取り中の枠(カメラを使っている間だけ)。
const ALLOW = [
  /\bspin\b/, /rr-spin-pulse/, /techScan 2\.6s/, /techBarSlide/, /aAurora/,             // 読み込み・使っていない地の光(display:none)
  /colonBlink/, /newsFlash/, /prizeScroll/,                                             // タイマー画面(TimerClient)本体
  /mbJiggle/,                                                                           // 並べ替え中だけ
  /rr-hand-(hover|active|hl)/,                                                          // 押している・乗せている間だけ
  /scan-frame-pulse/, /scan-beam/, /scan-line/, /qr-scan/,                                         // QR を読んでいる間だけ
  /pulse-dot 1\.8s/,                                                                    // 店舗の在店の点(transform・opacity だけ)
  /breatheGold|goldDotPulse|shimmer 2\.4s/,                                             // 使っていない定義(class が無い)
]

describe('電池', () => {
  it('ずっと動くアニメは例外だけ', () => {
    const bad: string[] = []
    for (const f of files) {
      readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
        if (!/infinite/.test(line) || /^\s*(\/\/|\*)/.test(line)) return
        if (ALLOW.some(r => r.test(line))) return
        bad.push(`${f}:${i + 1}: ${line.trim().slice(0, 120)}`)
      })
    }
    expect(bad).toEqual([])
  })
  it('1 秒より短い setInterval を使わない', () => {
    const bad: string[] = []
    for (const f of files) {
      const s = readFileSync(f, 'utf8')
      // setInterval( の対になる ) までを数えて、最後の引数(間隔)を見る
      let at = s.indexOf('setInterval(')
      while (at >= 0) {
        let depth = 0, i = at + 'setInterval'.length
        for (; i < s.length; i++) { if (s[i] === '(') depth++; else if (s[i] === ')') { depth--; if (depth === 0) break } }
        const call = s.slice(at, i + 1)
        const ms = /,\s*([\d_]+|[A-Z_]+)\s*\)$/.exec(call)?.[1]
        if (ms && /^\d/.test(ms) && Number(ms.replace(/_/g, '')) < 1000) bad.push(`${f}: setInterval(..., ${ms})`)
        at = s.indexOf('setInterval(', i)
      }
    }
    expect(bad).toEqual([])
  })
})
