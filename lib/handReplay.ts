/**
 * ハンド記録(handHistories の文書)を、1アクションずつの盤面に組み立てる純関数。
 * PokerART(Coffiest/Meta---GEO)の apps/web/src/lib/replay.ts の考え方を移植したもの。
 * 保存形式は変えない(既存の記録をそのまま読む)。金額は BB 単位で、
 * bet/raise/call/allin の amount は「そのストリートで合計いくらまで出したか」。
 */

export type Street = "preflop" | "flop" | "turn" | "river"
export const STREETS: Street[] = ["preflop", "flop", "turn", "river"]

export type SavedAction = { street: string; position: string; action: string; amount?: number }
export type SavedHand = {
  heroPosition?: string
  heroCards?: string[]
  villainCards?: Record<string, string[]>
  playerPositions?: string[]
  board?: { flop: string[] | null; turn: string | null; river: string | null }
  actions?: SavedAction[]
}

export type SeatState = {
  position: string
  stackUsed: number          // このハンドで出した合計(BB)
  streetBet: number          // 今のストリートで出した額(BB)
  status: "active" | "folded" | "allIn"
  cards: string[]
  isHero: boolean
}

export type Snapshot = {
  street: Street
  board: string[]
  pot: number                // 場に出た合計(BB)
  toCall: number             // 今のストリートの最大額
  actingPosition: string | null
  seats: SeatState[]
}

export type ReplayStep = {
  index: number
  action: SavedAction | null // null は開始時点(ブラインドだけ出た盤面)
  snapshot: Snapshot
}

const BOARD_LEN: Record<Street, number> = { preflop: 0, flop: 3, turn: 4, river: 5 }

export function fullBoard(hand: SavedHand): string[] {
  const b = hand.board
  if (!b) return []
  const out: string[] = []
  if (b.flop && b.flop.length === 3) out.push(...b.flop)
  else return out
  if (b.turn) out.push(b.turn)
  else return out
  if (b.river) out.push(b.river)
  return out
}

function round(n: number) { return Math.round(n * 100) / 100 }

export function buildHandReplay(hand: SavedHand, opts: { ante?: number } = {}): ReplayStep[] {
  const positions = hand.playerPositions ?? []
  const board = fullBoard(hand)
  const hero = hand.heroPosition ?? ""
  const ante = opts.ante ?? 0

  const used = new Map<string, number>()
  const street = new Map<string, number>()
  const status = new Map<string, SeatState["status"]>()
  for (const p of positions) { used.set(p, 0); street.set(p, 0); status.set(p, "active") }

  const post = (p: string, amt: number) => {
    if (!used.has(p)) return
    used.set(p, (used.get(p) ?? 0) + amt)
    street.set(p, (street.get(p) ?? 0) + amt)
  }
  // ヘッズアップは BTN が SB を兼ねる
  const sbPos = positions.includes("SB") ? "SB" : positions.length === 2 ? "BTN" : null
  if (sbPos) post(sbPos, 0.5)
  if (positions.includes("BB")) post("BB", 1)
  let pot = 0
  for (const v of used.values()) pot += v
  if (ante > 0 && positions.includes("BB")) { used.set("BB", (used.get("BB") ?? 0) + ante); pot += ante }

  let cur: Street = "preflop"
  const snap = (acting: string | null): Snapshot => ({
    street: cur,
    board: board.slice(0, BOARD_LEN[cur]),
    pot: round(pot),
    toCall: round(Math.max(0, ...street.values())),
    actingPosition: acting,
    seats: positions.map(p => ({
      position: p,
      stackUsed: round(used.get(p) ?? 0),
      streetBet: round(street.get(p) ?? 0),
      status: status.get(p) ?? "active",
      cards: p === hero ? (hand.heroCards ?? []) : (hand.villainCards?.[p] ?? []),
      isHero: p === hero,
    })),
  })

  const actions = (hand.actions ?? []).filter(a => (STREETS as string[]).includes(a.street))
  const steps: ReplayStep[] = [{ index: 0, action: null, snapshot: snap(actions[0]?.position ?? null) }]

  for (const a of actions) {
    if (a.street !== cur) {
      cur = a.street as Street
      for (const p of positions) street.set(p, 0)
    }
    if (!used.has(a.position)) continue
    if (a.action === "fold") {
      status.set(a.position, "folded")
    } else if (a.action !== "check") {
      const prev = street.get(a.position) ?? 0
      const to = a.amount ?? prev
      const delta = Math.max(0, to - prev)
      street.set(a.position, prev + delta)
      used.set(a.position, (used.get(a.position) ?? 0) + delta)
      pot += delta
      if (a.action === "allin") status.set(a.position, "allIn")
    }
    steps.push({ index: steps.length, action: a, snapshot: snap(a.position) })
  }
  return steps
}
