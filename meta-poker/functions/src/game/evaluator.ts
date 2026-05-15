import { Card, Rank, Suit, rankValue } from './deck';

export type HandRank =
  | 'Royal Flush'
  | 'Straight Flush'
  | 'Four of a Kind'
  | 'Full House'
  | 'Flush'
  | 'Straight'
  | 'Three of a Kind'
  | 'Two Pair'
  | 'One Pair'
  | 'High Card';

export interface HandResult {
  rank: HandRank;
  score: number; // higher = better
  cards: Card[]; // best 5 cards
}

function parseCard(card: Card): { rank: Rank; suit: Suit; value: number } {
  const rank = card.slice(0, -1) as Rank;
  const suit = card.slice(-1) as Suit;
  return { rank, suit, value: rankValue(rank) };
}

function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const [first, ...rest] = arr;
  return [
    ...combinations(rest, k - 1).map((c) => [first, ...c]),
    ...combinations(rest, k),
  ];
}

function evalFive(cards: Card[]): { rank: HandRank; score: number } {
  const parsed = cards.map(parseCard).sort((a, b) => b.value - a.value);
  const values = parsed.map((c) => c.value);
  const suits = parsed.map((c) => c.suit);

  const isFlush = suits.every((s) => s === suits[0]);
  const isStraight = (() => {
    if (values[0] - values[4] === 4 && new Set(values).size === 5) return true;
    // Wheel: A-2-3-4-5
    if (values[0] === 12 && values[1] === 3 && values[2] === 2 && values[3] === 1 && values[4] === 0) return true;
    return false;
  })();

  const counts: Record<number, number> = {};
  for (const v of values) counts[v] = (counts[v] ?? 0) + 1;
  const freq = Object.values(counts).sort((a, b) => b - a);
  const byFreq = Object.entries(counts)
    .sort((a, b) => b[1] - a[1] || Number(b[0]) - Number(a[0]))
    .map(([v]) => Number(v));

  const score = (base: number, ...kickers: number[]) =>
    kickers.reduce((acc, k, i) => acc + k * Math.pow(15, kickers.length - 1 - i), base * Math.pow(15, kickers.length));

  if (isFlush && isStraight) {
    const isRoyal = values[0] === 12 && values[4] === 8;
    return {
      rank: isRoyal ? 'Royal Flush' : 'Straight Flush',
      score: score(isRoyal ? 9 : 8, values[0]),
    };
  }
  if (freq[0] === 4) return { rank: 'Four of a Kind', score: score(7, byFreq[0], byFreq[1]) };
  if (freq[0] === 3 && freq[1] === 2) return { rank: 'Full House', score: score(6, byFreq[0], byFreq[1]) };
  if (isFlush) return { rank: 'Flush', score: score(5, ...values) };
  if (isStraight) return { rank: 'Straight', score: score(4, values[0] === 12 && values[1] === 3 ? 3 : values[0]) };
  if (freq[0] === 3) return { rank: 'Three of a Kind', score: score(3, byFreq[0], byFreq[1], byFreq[2]) };
  if (freq[0] === 2 && freq[1] === 2) return { rank: 'Two Pair', score: score(2, byFreq[0], byFreq[1], byFreq[2]) };
  if (freq[0] === 2) return { rank: 'One Pair', score: score(1, byFreq[0], byFreq[1], byFreq[2], byFreq[3]) };
  return { rank: 'High Card', score: score(0, ...values) };
}

export function evaluateBestHand(holeCards: [Card, Card], communityCards: Card[]): HandResult {
  const allCards = [...holeCards, ...communityCards];
  const combos = combinations(allCards, 5);
  let best: HandResult | null = null;

  for (const combo of combos) {
    const result = evalFive(combo);
    if (!best || result.score > best.score) {
      best = { rank: result.rank, score: result.score, cards: combo };
    }
  }

  return best!;
}

export function determineWinners(players: { id: string; holeCards: [Card, Card] }[], communityCards: Card[]): {
  winnerId: string;
  handName: HandRank;
  score: number;
}[] {
  const results = players.map((p) => {
    const hand = evaluateBestHand(p.holeCards, communityCards);
    return { winnerId: p.id, handName: hand.rank, score: hand.score };
  });

  const maxScore = Math.max(...results.map((r) => r.score));
  return results.filter((r) => r.score === maxScore);
}
