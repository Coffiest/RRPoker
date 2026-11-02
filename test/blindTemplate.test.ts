import { describe, it, expect } from "vitest";
import { nextTemplateBlind, buildTemplateLevels } from "../lib/blindTemplate";

describe("ブラインドの傾斜テンプレート", () => {
  it("1/2 から始めると 2/3, 2/4, 3/6 と続く", () => {
    let bb = 2; const seq: string[] = []
    for (let i = 0; i < 3; i++) { const n = nextTemplateBlind(bb, 2); seq.push(`${n.sb}/${n.bb}`); bb = n.bb }
    expect(seq).toEqual(["2/3", "2/4", "3/6"])
  })
  it("200/400 から始めると 300/600, 400/800 と続く", () => {
    const a = nextTemplateBlind(400, 400); const b = nextTemplateBlind(a.bb, 400)
    expect([`${a.sb}/${a.bb}`, `${b.sb}/${b.bb}`]).toEqual(["300/600", "400/800"])
  })
  it("50/100 は単位 1/10 の表の 500/1000 にあたるので、次は 60/120", () => {
    expect(nextTemplateBlind(100, 100)).toEqual({ sb: 60, bb: 120 })
  })
  it("表に無い 70/140 なら、単位を合わせた表でそれより大きい最初の段(100/150)へ", () => {
    expect(nextTemplateBlind(140, 140)).toEqual({ sb: 100, bb: 150 })
  })
  it("表の最後の先は同じ流れを 10 倍して続く", () => {
    expect(nextTemplateBlind(1000000, 200)).toEqual({ sb: 600000, bb: 1200000 })
  })
  it("テンプレートで作ると最後(500000/1000000)まで、アンティ=BB、時間は表どおり", () => {
    const ls = buildTemplateLevels(100, 200)
    expect(ls.length).toBe(35)
    expect(ls[3]).toEqual({ smallBlind: 300, bigBlind: 600, ante: 600, duration: 40 })
    expect(ls[10].duration).toBe(30)
    expect(ls[34]).toEqual({ smallBlind: 500000, bigBlind: 1000000, ante: 1000000, duration: 10 })
  })
})
