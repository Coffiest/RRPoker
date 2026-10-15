import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

/**
 * 「灰色の文字が薄くて読めない」を二度と出さないための検査。
 *
 * 1. 端末のダークモードで文字色を変えない。画面は白基調で作っているので、
 *    以前 globals.css にあった「ダークなら --foreground を #ededed」の指定のせいで、
 *    色を指定していない文字が白い面の上でほぼ白になっていた。
 * 2. 灰色の文字は globals.css の --label / --label2 / --label3 だけを使う
 *    (どれも白地で 4.5:1 以上)。それより薄い灰色を color に書かない。
 * 3. Tailwind の text-gray-300 / text-gray-400(白地で 1.5〜2.5:1)を使わない。
 *    代わりに text-label3(または text-gray-500 以上)。
 *
 * 暗い面の上に置く文字など、意図して薄い色を使う行には `contrast-ok` と理由を書く。
 * 管理者画面(app/admin)は暗い配色なので対象外。
 */

const ROOT = join(__dirname, "..")
const DIRS = ["app", "components", "lib"]
const SKIP = [join("app", "admin")]

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(tsx|ts|css)$/.test(name)) out.push(p)
  }
  return out
}

const files = DIRS.flatMap(d => walk(join(ROOT, d)))
  .filter(p => !SKIP.some(s => p.includes(join(ROOT, s))))

type RGBA = [number, number, number, number]

function parseColor(v: string): RGBA | null {
  const s = v.trim().toLowerCase()
  let m = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/)
  if (m) {
    const h = m[1].length === 3 ? m[1].split("").map(c => c + c).join("") : m[1]
    return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)).concat(1) as RGBA
  }
  m = s.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/)
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3]), m[4] === undefined ? 1 : Number(m[4])]
  return null
}

function luminance([r, g, b]: number[]): number {
  const f = (x: number) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4 }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

/** 白地に置いたときのコントラスト比(透明度は白と合成する) */
export function contrastOnWhite(c: RGBA): number {
  const [r, g, b, a] = c
  const mixed = [r, g, b].map(x => a * x + (1 - a) * 255)
  return (1 + 0.05) / (luminance(mixed) + 0.05)
}

/** 白い面の上で読めない灰色か。白系(暗い面の上で使う文字)や有彩色は対象外 */
function isFaintGray(c: RGBA): boolean {
  const [r, g, b] = c
  const neutral = Math.max(r, g, b) - Math.min(r, g, b) <= 20
  return neutral && Math.max(r, g, b) < 235 && contrastOnWhite(c) < 4.5
}

const COLOR_LITERAL = /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b|rgba?\([^)]*\)/g

function findViolations(): string[] {
  const out: string[] = []
  for (const file of files) {
    const rel = file.slice(ROOT.length + 1)
    readFileSync(file, "utf8").split("\n").forEach((line, i) => {
      if (line.includes("contrast-ok")) return
      const at = `${rel}:${i + 1}`
      for (const m of line.matchAll(COLOR_LITERAL)) {
        const c = parseColor(m[0])
        if (!c || !isFaintGray(c)) continue
        const prop = line.slice(0, m.index).match(/([A-Za-z-]+)\s*:[^:;{}]*$/)
        if (prop?.[1] === "color") out.push(`${at} 薄い灰色の文字 ${m[0]}(${contrastOnWhite(c).toFixed(2)}:1)`)
      }
      for (const m of line.matchAll(/(?<![\w-])([a-z-]+:)?text-gray-(300|400)\b/g)) {
        if (!m[1]) out.push(`${at} ${m[0]} は白地で読めない(text-label3 を使う)`)
      }
      if (!rel.endsWith("globals.css") && /--(a-)?label-?[23]\s*:/.test(line)) {
        out.push(`${at} --label2/--label3 を再定義している(globals.css に一本化)`)
      }
      if (/prefers-color-scheme\s*:\s*dark/.test(line)) {
        out.push(`${at} ダークモード用の上書き(画面は明るい表示だけで作っている)`)
      }
    })
  }
  return out
}

describe("文字のコントラスト", () => {
  it("薄くて読めない灰色の文字が無い", () => {
    expect(findViolations()).toEqual([])
  })

  it("globals.css は明るい表示に固定し、灰色の3段は白地で 4.5:1 以上", () => {
    const css = readFileSync(join(ROOT, "app", "globals.css"), "utf8")
    expect(css).toMatch(/color-scheme:\s*light/)
    for (const name of ["--label", "--label2", "--label3"]) {
      const v = css.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`))?.[1]
      expect(v, name).toBeTruthy()
      expect(contrastOnWhite(parseColor(v!)!)).toBeGreaterThanOrEqual(4.5)
    }
  })

  it("検査そのものが薄い灰色を見つけられる", () => {
    expect(isFaintGray(parseColor("rgba(60,60,67,0.3)")!)).toBe(true)
    expect(isFaintGray(parseColor("#8E8E93")!)).toBe(true)
    expect(isFaintGray(parseColor("#6E6E73")!)).toBe(false)
    expect(isFaintGray(parseColor("rgba(255,255,255,0.5)")!)).toBe(false)
  })
})
