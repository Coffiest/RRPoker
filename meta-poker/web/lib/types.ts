import { Timestamp } from 'firebase/firestore';

export type SubscriptionPlan = 'free' | 'premium';
export type SubscriptionStatus = 'active' | 'cancelled' | 'trialing' | 'past_due';
export type TournamentStatus = 'pending' | 'running' | 'completed' | 'cancelled';
export type GameStatus = 'waiting' | 'playing' | 'ended';
export type PlayerAction = 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'allin';
export type Street = 'preflop' | 'flop' | 'turn' | 'river';
export type HandResult = 'win' | 'lose' | 'fold' | 'split';
export type Position = 'BTN' | 'SB' | 'BB' | 'UTG' | 'UTG+1' | 'UTG+2' | 'HJ' | 'CO';

export interface User {
  uid: string;
  email: string;
  username: string;
  profileImageUrl: string | null;
  bio: string;
  isPublicStats: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface UserStats {
  uid: string;
  totalHands: number;
  totalTournaments: number;
  itmCount: number; // in the money count
  itmPercentage: number;
  totalRoi: number;
  totalPrize: number; // virtual chips
  updatedAt: Timestamp;
}

export interface Subscription {
  id: string;
  userId: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripePriceId: string | null;
  trialEndsAt: Timestamp | null;
  currentPeriodStart: Timestamp | null;
  currentPeriodEnd: Timestamp | null;
  cancelAtPeriodEnd: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface BlindLevel {
  level: number;
  smallBlind: number;
  bigBlind: number;
  ante: number;
  durationMinutes: number;
}

export interface BlindStructure {
  id: string;
  name: string;
  levels: BlindLevel[];
  createdAt: Timestamp;
}

export interface PrizeDistribution {
  place: number;
  percentage: number; // 0-100
}

export interface Tournament {
  id: string;
  creatorId: string;
  name: string;
  status: TournamentStatus;
  maxPlayers: number;
  currentPlayers: number;
  startingStack: number;
  blindStructureId: string;
  blindLevels: BlindLevel[];
  currentBlindLevel: number;
  nextBlindAt: Timestamp | null;
  prizeDistribution: PrizeDistribution[];
  registeredPlayerIds: string[];
  eliminatedPlayerIds: string[];
  winnerId: string | null;
  startAt: Timestamp | null;
  endAt: Timestamp | null;
  tableIds: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface PlayerState {
  uid: string;
  username: string;
  profileImageUrl: string | null;
  stack: number;
  holeCards: [string, string] | null; // only visible to the player
  currentBet: number;
  totalBetInHand: number;
  isActive: boolean; // still in the hand
  isEliminated: boolean;
  isSittingOut: boolean;
  position: number; // seat index 0-8
  lastAction: PlayerAction | null;
}

export interface GameState {
  id: string;
  tournamentId: string;
  tableNumber: number;
  status: GameStatus;
  handNumber: number;
  dealerPosition: number; // seat index
  currentPlayerPosition: number | null;
  street: Street;
  communityCards: string[];
  pot: number;
  sidePots: { amount: number; eligiblePlayerIds: string[] }[];
  players: PlayerState[];
  currentBet: number;
  minRaise: number;
  actionHistory: ActionRecord[];
  winners: WinnerRecord[] | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ActionRecord {
  street: Street;
  playerId: string;
  action: PlayerAction;
  amount: number;
  timestamp: Timestamp;
}

export interface WinnerRecord {
  playerId: string;
  amount: number;
  handName: string;
  cards: string[];
}

export interface HandHistory {
  id: string;
  gameId: string;
  tournamentId: string;
  handNumber: number;
  playerHash: string;
  position: Position;
  holeCards: string;
  communityCards: string[];
  actions: { street: Street; action: PlayerAction; amount: number }[];
  result: HandResult;
  potAmount: number;
  netGain: number;
  handName: string | null;
  createdAt: Timestamp;
}

export interface RangeData {
  position: Position;
  vsPosition: Position | null;
  action: string;
  stackRange: string;
  hands: Record<string, 'raise' | 'call' | 'fold' | 'rfi'>;
  gtoActions: string[];
}
