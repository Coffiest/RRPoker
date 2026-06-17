// ── Card types ────────────────────────────────────────────────────────────────
export type Suit = 'S' | 'H' | 'D' | 'C'
export type Rank = 2|3|4|5|6|7|8|9|10|11|12|13|14 // 11=J,12=Q,13=K,14=A

export interface Card { rank: Rank; suit: Suit }

const SUIT_DISPLAY: Record<Suit, string> = { S:'♠', H:'♥', D:'♦', C:'♣' }
const RANK_DISPLAY: Record<number, string> = {
  2:'2',3:'3',4:'4',5:'5',6:'6',7:'7',8:'8',9:'9',10:'10',11:'J',12:'Q',13:'K',14:'A'
}
export const displayCard = (c: Card) =>
  `${RANK_DISPLAY[c.rank]}${SUIT_DISPLAY[c.suit]}`

export const isRed = (c: Card) => c.suit === 'H' || c.suit === 'D'

// ── Deck ──────────────────────────────────────────────────────────────────────
const SUITS: Suit[] = ['S','H','D','C']
const RANKS: Rank[] = [2,3,4,5,6,7,8,9,10,11,12,13,14]

export function createDeck(): Card[] {
  const deck: Card[] = []
  for (const suit of SUITS)
    for (const rank of RANKS)
      deck.push({ suit, rank })
  return deck
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ── Hand evaluation ───────────────────────────────────────────────────────────
export interface HandResult {
  score: number       // higher = better
  name: string        // "Full House" etc.
  cards: Card[]       // best 5 cards
}

function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]]
  if (arr.length < k) return []
  const [first, ...rest] = arr
  return [
    ...combinations(rest, k - 1).map(c => [first, ...c]),
    ...combinations(rest, k),
  ]
}

function eval5(cards: Card[]): HandResult {
  const ranks = cards.map(c => c.rank).sort((a, b) => b - a)
  const suits = cards.map(c => c.suit)
  const rankCounts: Record<number, number> = {}
  for (const r of ranks) rankCounts[r] = (rankCounts[r] ?? 0) + 1
  const counts = Object.entries(rankCounts)
    .map(([r, c]) => ({ rank: Number(r), count: c }))
    .sort((a, b) => b.count - a.count || b.rank - a.rank)

  const isFlush = suits.every(s => s === suits[0])
  const isStraight = (() => {
    const u = [...new Set(ranks)].sort((a, b) => b - a)
    if (u.length >= 5) {
      // Normal straight
      if (u[0] - u[4] === 4) return true
      // Wheel (A-2-3-4-5)
      if (u[0] === 14 && u[1] === 5 && u[2] === 4 && u[3] === 3 && u[4] === 2) return true
    }
    return false
  })()

  const topRanks = counts.map(c => c.rank)

  // Score helpers
  const s = (...vals: number[]) =>
    vals.reduce((acc, v, i) => acc + v * Math.pow(15, vals.length - 1 - i), 0)

  if (isFlush && isStraight) {
    const r = ranks[0] === 14 && ranks[1] === 5 ? [5,4,3,2,1] : ranks
    return { score: 8_000_000 + r[0], name: r[0] === 14 ? 'Royal Flush' : 'Straight Flush', cards }
  }
  if (counts[0].count === 4)
    return { score: 7_000_000 + s(counts[0].rank, counts[1].rank), name: 'Four of a Kind', cards }
  if (counts[0].count === 3 && counts[1].count === 2)
    return { score: 6_000_000 + s(counts[0].rank, counts[1].rank), name: 'Full House', cards }
  if (isFlush)
    return { score: 5_000_000 + s(...ranks), name: 'Flush', cards }
  if (isStraight) {
    const top = ranks[0] === 14 && ranks[4] === 2 ? 5 : ranks[0]
    return { score: 4_000_000 + top, name: 'Straight', cards }
  }
  if (counts[0].count === 3)
    return { score: 3_000_000 + s(counts[0].rank, counts[1].rank, counts[2].rank), name: 'Three of a Kind', cards }
  if (counts[0].count === 2 && counts[1].count === 2)
    return { score: 2_000_000 + s(counts[0].rank, counts[1].rank, counts[2].rank), name: 'Two Pair', cards }
  if (counts[0].count === 2)
    return { score: 1_000_000 + s(counts[0].rank, topRanks[1], topRanks[2], topRanks[3]), name: 'One Pair', cards }
  return { score: s(...ranks), name: 'High Card', cards }
}

export function bestHand(hole: Card[], community: Card[]): HandResult {
  const all = [...hole, ...community]
  const combos = combinations(all, 5)
  return combos.reduce<HandResult>((best, combo) => {
    const h = eval5(combo)
    return h.score > best.score ? h : best
  }, eval5(combos[0]))
}

// ── Blind levels ──────────────────────────────────────────────────────────────
export const SNG_BLINDS = [
  [10,20],[15,30],[20,40],[30,60],[50,100],[75,150],[100,200],[150,300],[200,400],[300,600]
] as const

export const MTT_BLINDS = [
  [25,50],[50,100],[75,150],[100,200],[150,300],[200,400],[300,600],[400,800],[600,1200],[800,1600]
] as const

export const LEVEL_DURATION_MS = {
  sng: 10 * 60 * 1000,  // 10 min
  mtt: 8  * 60 * 1000,  // 8 min
} as const

// ── Game types ────────────────────────────────────────────────────────────────
export interface PokerPlayer {
  uid: string
  name: string
  iconUrl?: string
  seat: number
  stack: number
  status: 'waiting' | 'active' | 'folded' | 'allIn' | 'out'
  bet: number       // current round bet
  handBet: number   // total committed this hand
  holeCards: Card[] // for demo: stored plaintext
  isDealer: boolean
  isSB: boolean
  isBB: boolean
}

export type GameStage = 'waiting' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown'

export interface PokerRoom {
  id?: string
  type: 'sng' | 'mtt'
  name: string
  status: 'waiting' | 'active' | 'finished'
  maxPlayers: number
  startStack: number
  players: PokerPlayer[]
  // Game state
  hand: number
  stage: GameStage
  communityCards: Card[]
  deck: Card[]
  pot: number
  currentBet: number  // highest bet to match
  currentSeat: number
  dealerSeat: number
  lastAction: string
  lastActorSeat: number
  actionsInRound: number
  blindLevel: number
  smallBlind: number
  bigBlind: number
  levelStartMs: number
  winners?: { seat: number; amount: number; handName?: string }[]
  createdAt?: any
  startedAt?: any
  lastUpdated?: any
}

// ── MTT Slot scheduling ───────────────────────────────────────────────────────
export const MTT_STACK        = 20_000
export const MTT_TABLE_MAX    = 9
export const MTT_TABLE_MIN_START = 4   // min players to deal cards
export const MTT_REG_MINUTES  = 30     // registration window in minutes

/** Returns the start time (ms) of the slot that contains the given time */
export function getMttSlotTime(nowMs = Date.now()): number {
  const d = new Date(nowMs)
  const minutes = d.getMinutes()
  d.setMinutes(minutes < 30 ? 0 : 30, 0, 0)
  return d.getTime()
}

/** Slot ID string, e.g. "mtt_20260601_1430" */
export function getMttSlotId(slotTime: number): string {
  const d = new Date(slotTime)
  const YYYY = d.getFullYear()
  const MM   = String(d.getMonth() + 1).padStart(2, '0')
  const DD   = String(d.getDate()).padStart(2, '0')
  const HH   = String(d.getHours()).padStart(2, '0')
  const mm   = String(d.getMinutes()).padStart(2, '0')
  return `mtt_${YYYY}${MM}${DD}_${HH}${mm}`
}

/** Reg-close time = slot start + 30 min */
export function getMttRegCloseTime(slotTime: number): number {
  return slotTime + MTT_REG_MINUTES * 60 * 1000
}

/** Human-readable countdown "MM:SS" */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return '00:00'
  const totalSec = Math.floor(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/** Slot display time e.g. "14:30" */
export function formatSlotTime(slotTime: number): string {
  const d = new Date(slotTime)
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

// ── Game state helpers ────────────────────────────────────────────────────────
export function activePlayers(room: PokerRoom): PokerPlayer[] {
  return room.players.filter(p => p.status === 'active' || p.status === 'allIn')
}

export function playersInHand(room: PokerRoom): PokerPlayer[] {
  return room.players.filter(p => p.status !== 'out' && p.status !== 'waiting' && p.status !== 'folded')
}

export function nextActiveSeat(room: PokerRoom, from: number): number {
  const n = room.players.length
  for (let i = 1; i < n; i++) {
    const seat = (from + i) % n
    const p = room.players.find(p => p.seat === seat)
    if (p && p.status === 'active') return seat
  }
  return from
}

export function buildNewRoom(
  type: 'sng' | 'mtt',
  name: string,
  creatorUid: string,
  creatorName: string,
  creatorIcon?: string,
): PokerRoom {
  const maxPlayers = type === 'sng' ? 6 : 9
  const startStack = type === 'sng' ? 1000 : 5000
  const [sb, bb] = type === 'sng' ? SNG_BLINDS[0] : MTT_BLINDS[0]
  return {
    type, name, status: 'waiting', maxPlayers, startStack,
    players: [{
      uid: creatorUid, name: creatorName, iconUrl: creatorIcon,
      seat: 0, stack: startStack, status: 'waiting',
      bet: 0, handBet: 0, holeCards: [],
      isDealer: false, isSB: false, isBB: false,
    }],
    hand: 0, stage: 'waiting',
    communityCards: [], deck: [],
    pot: 0, currentBet: 0, currentSeat: 0,
    dealerSeat: 0, lastAction: '', lastActorSeat: -1, actionsInRound: 0,
    blindLevel: 0, smallBlind: sb, bigBlind: bb,
    levelStartMs: Date.now(),
  }
}

// ── Deal / start hand ─────────────────────────────────────────────────────────
export function startHand(room: PokerRoom): PokerRoom {
  const seated = room.players.filter(p => p.status !== 'out')
  if (seated.length < 2) return room

  // Rotate dealer
  const seats = seated.map(p => p.seat).sort((a, b) => a - b)
  const dIdx  = seats.indexOf(room.dealerSeat)
  const newDealerSeat = seats[(dIdx + 1) % seats.length]

  // Assign positions
  const sbIdx = (seats.indexOf(newDealerSeat) + 1) % seats.length
  const bbIdx = (seats.indexOf(newDealerSeat) + 2) % seats.length
  const sbSeat = seats[sbIdx]
  const bbSeat = seats[bbIdx]
  const utg    = seats[(bbIdx + 1) % seats.length]

  // Deck
  const deck = shuffle(createDeck())

  // Deal 2 cards each
  const newDeck = [...deck]
  const players: PokerPlayer[] = room.players.map(p => {
    if (p.status === 'out') return { ...p, holeCards: [], bet: 0, handBet: 0 }
    const cards = [newDeck.pop()!, newDeck.pop()!]
    const isSB = p.seat === sbSeat
    const isBB = p.seat === bbSeat
    const blind = isSB ? room.smallBlind : isBB ? room.bigBlind : 0
    const bet   = Math.min(blind, p.stack)
    const stack = p.stack - bet
    return {
      ...p,
      status: stack === 0 ? 'allIn' : 'active',
      holeCards: cards,
      bet, handBet: bet, stack,
      isDealer: p.seat === newDealerSeat,
      isSB, isBB,
    }
  })

  return {
    ...room,
    hand: room.hand + 1,
    stage: 'preflop',
    communityCards: [],
    deck: newDeck,
    pot: 0,
    currentBet: room.bigBlind,
    currentSeat: utg,
    dealerSeat: newDealerSeat,
    lastAction: `Hand #${room.hand + 1} started`,
    lastActorSeat: bbSeat,
    actionsInRound: 0,
    players,
    winners: undefined,
  }
}

// ── Action processing ─────────────────────────────────────────────────────────
export type ActionType = 'fold' | 'check' | 'call' | 'raise' | 'allin'

export function processAction(
  room: PokerRoom,
  seat: number,
  action: ActionType,
  raiseAmount?: number,
): PokerRoom {
  let r = { ...room, players: room.players.map(p => ({ ...p })) }
  const pIdx = r.players.findIndex(p => p.seat === seat)
  if (pIdx < 0) return r
  const p = r.players[pIdx]

  if (action === 'fold') {
    p.status = 'folded'
    r.lastAction = `${p.name} folds`
  } else if (action === 'check') {
    r.lastAction = `${p.name} checks`
  } else if (action === 'call') {
    const toCall = Math.min(r.currentBet - p.bet, p.stack)
    p.stack  -= toCall
    p.bet    += toCall
    p.handBet += toCall
    if (p.stack === 0) p.status = 'allIn'
    r.lastAction = `${p.name} calls ${toCall.toLocaleString()}`
  } else if (action === 'raise') {
    const amount = raiseAmount ?? r.currentBet * 2
    const total  = Math.min(amount, p.stack + p.bet)
    const added  = total - p.bet
    p.stack  -= added
    p.handBet += added
    p.bet     = total
    r.currentBet  = total
    r.lastActorSeat = seat
    r.actionsInRound = 0
    if (p.stack === 0) p.status = 'allIn'
    r.lastAction = `${p.name} raises to ${total.toLocaleString()}`
  } else if (action === 'allin') {
    const total = p.stack + p.bet
    if (total > r.currentBet) { r.currentBet = total; r.lastActorSeat = seat; r.actionsInRound = 0 }
    p.handBet += p.stack
    p.bet = total
    p.stack = 0
    p.status = 'allIn'
    r.lastAction = `${p.name} is all-in (${total.toLocaleString()})`
  }

  r.actionsInRound++
  r.lastActorSeat = seat

  // Collect bets to pot check + advance
  return advanceIfRoundOver(r)
}

function advanceIfRoundOver(room: PokerRoom): PokerRoom {
  const active = room.players.filter(p => p.status === 'active')
  const inHand = room.players.filter(p => p.status === 'active' || p.status === 'allIn')

  // Only 1 player remaining → award pot
  if (inHand.length === 1) {
    return awardPot(room)
  }

  // All active players have matched the bet and acted
  const allMatched = active.every(p => p.bet === room.currentBet || p.status === 'allIn')
  const minActions  = active.length

  if (allMatched && room.actionsInRound >= minActions) {
    return nextStreet(room)
  }

  // Move to next active player
  const next = nextActiveSeat(room, room.currentSeat)
  return { ...room, currentSeat: next }
}

function nextStreet(room: PokerRoom): PokerRoom {
  // Collect bets
  const pot = room.pot + room.players.reduce((s, p) => s + p.bet, 0)
  const players = room.players.map(p => ({ ...p, bet: 0 }))
  const deck = [...room.deck]

  if (room.stage === 'preflop') {
    const flop = [deck.pop()!, deck.pop()!, deck.pop()!]
    return { ...room, stage: 'flop', pot, players, deck, communityCards: flop, currentBet: 0, actionsInRound: 0,
      currentSeat: firstActiveSeat(room), lastActorSeat: -1 }
  }
  if (room.stage === 'flop') {
    const turn = [...room.communityCards, deck.pop()!]
    return { ...room, stage: 'turn', pot, players, deck, communityCards: turn, currentBet: 0, actionsInRound: 0,
      currentSeat: firstActiveSeat(room), lastActorSeat: -1 }
  }
  if (room.stage === 'turn') {
    const river = [...room.communityCards, deck.pop()!]
    return { ...room, stage: 'river', pot, players, deck, communityCards: river, currentBet: 0, actionsInRound: 0,
      currentSeat: firstActiveSeat(room), lastActorSeat: -1 }
  }
  if (room.stage === 'river') {
    return awardPot({ ...room, pot, players, deck })
  }
  return room
}

function firstActiveSeat(room: PokerRoom): number {
  const seats = room.players.filter(p => p.status !== 'out').map(p => p.seat).sort((a,b)=>a-b)
  const after = room.dealerSeat
  for (let i = 1; i <= seats.length; i++) {
    const s = seats[(seats.indexOf(after) + i) % seats.length]
    const p = room.players.find(p => p.seat === s)
    if (p && p.status === 'active') return s
  }
  return seats[0]
}

export function awardPot(room: PokerRoom): PokerRoom {
  const pot = room.pot + room.players.reduce((s, p) => s + p.bet, 0)
  const inHand = room.players.filter(p => p.status !== 'out' && p.status !== 'folded')

  let winners: { seat: number; amount: number; handName?: string }[] = []
  const players = room.players.map(p => ({ ...p, bet: 0 }))

  if (inHand.length === 1) {
    const w = inHand[0]
    players[players.findIndex(p => p.seat === w.seat)].stack += pot
    winners = [{ seat: w.seat, amount: pot }]
  } else {
    // Evaluate hands
    const hands = inHand.map(p => ({
      seat: p.seat,
      result: bestHand(p.holeCards, room.communityCards),
    }))
    hands.sort((a, b) => b.result.score - a.result.score)
    const best = hands[0].result.score
    const tied = hands.filter(h => h.result.score === best)
    const share = Math.floor(pot / tied.length)
    for (const t of tied) {
      players[players.findIndex(p => p.seat === t.seat)].stack += share
      winners.push({ seat: t.seat, amount: share, handName: t.result.name })
    }
  }

  // Mark eliminated players
  for (const p of players) {
    if (p.stack === 0 && p.status !== 'out') p.status = 'out'
  }

  return {
    ...room, stage: 'showdown', pot: 0, players, winners,
    lastAction: winners.map(w => {
      const n = players.find(p => p.seat === w.seat)?.name ?? 'Player'
      return `${n} wins ${w.amount.toLocaleString()}${w.handName ? ` (${w.handName})` : ''}`
    }).join(' · '),
  }
}

export function getValidActions(room: PokerRoom, seat: number): ActionType[] {
  const p = room.players.find(p => p.seat === seat)
  if (!p || p.status !== 'active') return []
  const toCall = room.currentBet - p.bet
  const actions: ActionType[] = ['fold']
  if (toCall === 0) actions.push('check')
  if (toCall > 0 && toCall < p.stack) actions.push('call')
  if (p.stack > toCall) actions.push('raise')
  actions.push('allin')
  return actions
}

// Bot AI: Returns next action or { action, amount } for raise
export function getBotAction(room: PokerRoom, seat: number): ActionType | { action: 'raise'; amount: number } {
  const p = room.players.find(p => p.seat === seat)
  if (!p) return 'fold'

  const validActions = getValidActions(room, seat)
  if (validActions.length === 0) return 'fold'

  const rand = Math.random()
  const isAggressive = rand < 0.55  // 55% aggressive, 45% conservative

  if (isAggressive) {
    if (validActions.includes('raise')) {
      const baseRaise = room.bigBlind * 2
      const raiseAmt = Math.min(
        baseRaise + Math.floor(Math.random() * baseRaise * 2),
        p.stack + (room.currentBet - p.bet)
      )
      return { action: 'raise', amount: raiseAmt }
    }
    if (validActions.includes('call')) return 'call'
    if (validActions.includes('check')) return 'check'
    if (validActions.includes('fold')) return 'fold'
  } else {
    if (validActions.includes('check')) return 'check'
    if (validActions.includes('call')) return 'call'
    if (validActions.includes('fold')) return 'fold'
  }

  return 'fold'
}
