import { describe, expect, it } from "vitest"
import { filterAndSortPlayers, rankByRating, type AdminPlayer } from "../lib/adminPlayers"

const p = (o: Partial<AdminPlayer>): AdminPlayer => ({
  uid: o.uid ?? o.name ?? "u", name: "", playerId: null, email: null, iconUrl: null, createdAt: null,
  rrRating: null, plays: 0, banned: false, banReason: null, bannedAt: null, ...o,
})

const list = [
  p({ uid: "1", name: "たなか", playerId: "@tanaka", email: "t@example.com", rrRating: 55, createdAt: 3 }),
  p({ uid: "2", name: "あおき", playerId: "@aoki", rrRating: 62.5, createdAt: 1 }),
  p({ uid: "3", name: "カトウ", playerId: "@kato", rrRating: null, createdAt: 5 }),
  p({ uid: "4", name: "Bob", playerId: "@bob", rrRating: 55, createdAt: 2 }),
  p({ uid: "5", name: "", playerId: null, rrRating: null, createdAt: 4 }),
]

describe("admin players", () => {
  it("偏差値順: 高い順、同点は名前順、偏差値なしは最後", () => {
    expect(filterAndSortPlayers(list, "", "rating").map(x => x.uid)).toEqual(["2", "4", "1", "3", "5"])
  })
  it("名前順: あいうえお順(ひらがな・カタカナ混在)", () => {
    expect(filterAndSortPlayers(list, "", "name").map(x => x.uid)).toEqual(["4", "2", "3", "1", "5"])
  })
  it("登録日順: 新しい順", () => {
    expect(filterAndSortPlayers(list, "", "created").map(x => x.uid)).toEqual(["3", "5", "1", "4", "2"])
  })
  it("検索: 名前・プレイヤーID(@の有無を問わない)・メール", () => {
    expect(filterAndSortPlayers(list, "たな", "name").map(x => x.uid)).toEqual(["1"])
    expect(filterAndSortPlayers(list, "@AOKI", "name").map(x => x.uid)).toEqual(["2"])
    expect(filterAndSortPlayers(list, "kato", "name").map(x => x.uid)).toEqual(["3"])
    expect(filterAndSortPlayers(list, "example.com", "name").map(x => x.uid)).toEqual(["1"])
  })
  it("順位: 同点は同順位", () => {
    const r = rankByRating(list)
    expect([r.get("2"), r.get("1"), r.get("4"), r.get("3")]).toEqual([1, 2, 2, undefined])
  })
})
