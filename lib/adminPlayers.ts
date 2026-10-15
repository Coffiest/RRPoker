// 管理者画面のプレイヤー一覧の型と、検索・並び替え。副作用なしの関数だけを置く。

export type AdminPlayer = {
  uid: string
  name: string
  playerId: string | null
  email: string | null
  iconUrl: string | null
  /** アカウント作成日時(ms) */
  createdAt: number | null
  /** 偏差値。トナメ未参加・BAN 中は null(管理者には 45 未満も実際の値を出す) */
  rrRating: number | null
  plays: number
  banned: boolean
  banReason: string | null
  bannedAt: number | null
}

export type PlayerSort = "rating" | "name" | "created"

const nameCollator = new Intl.Collator("ja", { sensitivity: "base", numeric: true })

/** 名前・プレイヤーID・メールの部分一致。大文字小文字と先頭の @ は区別しない。 */
export function matchesPlayerSearch(p: AdminPlayer, query: string): boolean {
  const q = query.trim().toLowerCase().replace(/^@/, "")
  if (!q) return true
  return [p.name, p.playerId?.replace(/^@/, ""), p.email]
    .some(v => typeof v === "string" && v.toLowerCase().includes(q))
}

/**
 * 並び替え。
 * - rating: 偏差値の高い順。偏差値の無い人(未参加・BAN中)は最後に名前順で並べる
 * - name: 名前の50音順・アルファベット順(漢字は読みではなく文字コード順になる)。名前の無い人は最後
 * - created: 登録日の新しい順
 */
export function sortPlayers(list: AdminPlayer[], sort: PlayerSort): AdminPlayer[] {
  const byName = (a: AdminPlayer, b: AdminPlayer) => {
    if (!a.name && b.name) return 1
    if (a.name && !b.name) return -1
    return nameCollator.compare(a.name, b.name)
  }
  const copy = [...list]
  if (sort === "rating") {
    copy.sort((a, b) => {
      if (a.rrRating === null && b.rrRating === null) return byName(a, b)
      if (a.rrRating === null) return 1
      if (b.rrRating === null) return -1
      return b.rrRating - a.rrRating || byName(a, b)
    })
  } else if (sort === "name") {
    copy.sort(byName)
  } else {
    copy.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0) || byName(a, b))
  }
  return copy
}

export function filterAndSortPlayers(list: AdminPlayer[], query: string, sort: PlayerSort): AdminPlayer[] {
  return sortPlayers(list.filter(p => matchesPlayerSearch(p, query)), sort)
}

/** 偏差値ランキングの順位(同点は同順位)。偏差値の無い人は含めない。 */
export function rankByRating(list: AdminPlayer[]): Map<string, number> {
  const rated = list.filter(p => p.rrRating !== null).sort((a, b) => b.rrRating! - a.rrRating!)
  const ranks = new Map<string, number>()
  let last: number | null = null
  let rank = 0
  rated.forEach((p, i) => {
    if (p.rrRating !== last) { rank = i + 1; last = p.rrRating }
    ranks.set(p.uid, rank)
  })
  return ranks
}
