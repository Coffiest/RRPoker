import { createDeck, shuffle, Card } from './deck';
import { determineWinners } from './evaluator';

export type PlayerAction = 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'allin';
export type Street = 'preflop' | 'flop' | 'turn' | 'river';

export interface PlayerState {
  uid: string;
  username: string;
  profileImageUrl: string | null;
  stack: number;
  holeCards: [Card, Card] | null;
  currentBet: number;
  totalBetInHand: number;
  isActive: boolean;
  isEliminated: boolean;
  isSittingOut: boolean;
  position: number;
  lastAction: PlayerAction | null;
}

export interface GameState {
  id: string;
  tournamentId: string;
  tableNumber: number;
  status: 'waiting' | 'playing' | 'ended';
  handNumber: number;
  dealerPosition: number;
  currentPlayerPosition: number | null;
  street: Street;
  communityCards: Card[];
  deck: Card[];
  pot: number;
  sidePots: { amount: number; eligiblePlayerIds: string[] }[];
  players: PlayerState[];
  currentBet: number;
  minRaise: number;
  lastAggressorPosition: number | null;
  actionsClosed: boolean;
  winners: WinnerRecord[] | null;
  handNumber_: number;
}

export interface WinnerRecord {
  playerId: string;
  amount: number;
  handName: string;
}

export function createNewHand(prevState: Partial<GameState>, players: PlayerState[]): Partial<GameState> {
  const activePlayers = players.filter((p) => !p.isEliminated && p.stack > 0);
  if (activePlayers.length < 2) return prevState;

  const deck = shuffle(createDeck());
  const dealerPos = getNextDealerPosition(prevState.dealerPosition ?? -1, activePlayers);
  const playerCount = activePlayers.length;

  // Reset player states for new hand
  const resetPlayers: PlayerState[] = activePlayers.map((p, i) => ({
    ...p,
    holeCards: [deck[i * 2], deck[i * 2 + 1]] as [Card, Card],
    currentBet: 0,
    totalBetInHand: 0,
    isActive: true,
    lastAction: null,
  }));

  const deckAfterDeal = deck.slice(playerCount * 2);

  // Post blinds
  const sbIndex = (dealerPos + 1) % playerCount;
  const bbIndex = (dealerPos + 2) % playerCount;
  const blindLevel = prevState.currentBet ?? 50;
  const smallBlind = Math.floor(blindLevel / 2);
  const bigBlind = blindLevel;

  const postBlind = (players: PlayerState[], idx: number, amount: number) => {
    const actual = Math.min(amount, players[idx].stack);
    players[idx].stack -= actual;
    players[idx].currentBet = actual;
    players[idx].totalBetInHand = actual;
    return actual;
  };

  const sbAmount = postBlind(resetPlayers, sbIndex, smallBlind);
  const bbAmount = postBlind(resetPlayers, bbIndex, bigBlind);

  const pot = sbAmount + bbAmount;
  const firstToAct = playerCount === 2 ? sbIndex : (bbIndex + 1) % playerCount;

  return {
    ...prevState,
    status: 'playing',
    handNumber: (prevState.handNumber ?? 0) + 1,
    dealerPosition: dealerPos,
    currentPlayerPosition: firstToAct,
    street: 'preflop',
    communityCards: [],
    deck: deckAfterDeal,
    pot,
    sidePots: [],
    players: resetPlayers,
    currentBet: bigBlind,
    minRaise: bigBlind * 2,
    lastAggressorPosition: bbIndex,
    actionsClosed: false,
    winners: null,
  };
}

function getNextDealerPosition(prevDealer: number, players: PlayerState[]): number {
  return (prevDealer + 1) % players.length;
}

export function processAction(
  state: GameState,
  playerId: string,
  action: PlayerAction,
  amount: number
): Partial<GameState> {
  const playerIdx = state.players.findIndex((p) => p.uid === playerId);
  if (playerIdx === -1 || state.currentPlayerPosition !== playerIdx) {
    throw new Error('Not your turn');
  }

  const player = state.players[playerIdx];
  const newPlayers = state.players.map((p) => ({ ...p }));
  let newPot = state.pot;
  let newCurrentBet = state.currentBet;
  let newMinRaise = state.minRaise;
  let newLastAggressor = state.lastAggressorPosition;

  switch (action) {
    case 'fold':
      newPlayers[playerIdx].isActive = false;
      newPlayers[playerIdx].lastAction = 'fold';
      newPlayers[playerIdx].holeCards = null;
      break;

    case 'check':
      if (state.currentBet > player.currentBet) throw new Error('Cannot check, must call or raise');
      newPlayers[playerIdx].lastAction = 'check';
      break;

    case 'call': {
      const callAmount = Math.min(state.currentBet - player.currentBet, player.stack);
      newPot += callAmount;
      newPlayers[playerIdx].stack -= callAmount;
      newPlayers[playerIdx].currentBet += callAmount;
      newPlayers[playerIdx].totalBetInHand += callAmount;
      newPlayers[playerIdx].lastAction = callAmount < player.stack ? 'call' : 'allin';
      break;
    }

    case 'bet':
    case 'raise': {
      const addAmount = amount - player.currentBet;
      if (addAmount > player.stack) throw new Error('Insufficient chips');
      newPot += addAmount;
      newPlayers[playerIdx].stack -= addAmount;
      newPlayers[playerIdx].currentBet = amount;
      newPlayers[playerIdx].totalBetInHand += addAmount;
      newPlayers[playerIdx].lastAction = action;
      newCurrentBet = amount;
      newMinRaise = amount + (amount - (state.currentBet || 0));
      newLastAggressor = playerIdx;
      break;
    }

    case 'allin': {
      const allInAmount = player.stack;
      newPot += allInAmount;
      newPlayers[playerIdx].stack = 0;
      newPlayers[playerIdx].currentBet += allInAmount;
      newPlayers[playerIdx].totalBetInHand += allInAmount;
      newPlayers[playerIdx].lastAction = 'allin';
      if (newPlayers[playerIdx].currentBet > newCurrentBet) {
        newCurrentBet = newPlayers[playerIdx].currentBet;
        newLastAggressor = playerIdx;
      }
      break;
    }
  }

  // Determine next player
  const nextPlayerIdx = getNextActivePlayer(newPlayers, playerIdx);
  const isRoundOver = isActionRoundOver(newPlayers, newCurrentBet, nextPlayerIdx, newLastAggressor);

  if (isRoundOver) {
    return advanceStreet({ ...state, players: newPlayers, pot: newPot, currentBet: newCurrentBet, minRaise: newMinRaise, lastAggressorPosition: newLastAggressor });
  }

  return {
    players: newPlayers,
    pot: newPot,
    currentBet: newCurrentBet,
    minRaise: newMinRaise,
    lastAggressorPosition: newLastAggressor,
    currentPlayerPosition: nextPlayerIdx,
  };
}

function getNextActivePlayer(players: PlayerState[], currentIdx: number): number {
  let next = (currentIdx + 1) % players.length;
  let tries = 0;
  while ((!players[next].isActive || players[next].stack === 0) && tries < players.length) {
    next = (next + 1) % players.length;
    tries++;
  }
  return next;
}

function isActionRoundOver(players: PlayerState[], currentBet: number, nextIdx: number, lastAggressor: number | null): boolean {
  const activePlayers = players.filter((p) => p.isActive && p.stack > 0);
  if (activePlayers.length <= 1) return true;

  // Everyone has acted and either called or is all-in
  const allCalled = activePlayers.every((p) => p.currentBet >= currentBet || p.stack === 0);
  if (!allCalled) return false;

  // Action is closed when it comes back to the last aggressor
  if (lastAggressor !== null && nextIdx === lastAggressor) return true;

  return false;
}

function advanceStreet(state: GameState): Partial<GameState> {
  const activePlayers = state.players.filter((p) => p.isActive);

  // If only one active player, they win
  if (activePlayers.length === 1) {
    return settleHand(state, activePlayers);
  }

  const newPlayers = state.players.map((p) => ({
    ...p,
    currentBet: 0,
    lastAction: null,
  }));

  const nextStreet = getNextStreet(state.street);

  if (!nextStreet) {
    // Showdown
    return settleHand({ ...state, players: newPlayers }, state.players.filter((p) => p.isActive));
  }

  let newCommunityCards = [...state.communityCards];
  let newDeck = [...state.deck];

  // Deal community cards
  if (nextStreet === 'flop') {
    newCommunityCards = [newDeck[0], newDeck[1], newDeck[2]];
    newDeck = newDeck.slice(3);
  } else if (nextStreet === 'turn' || nextStreet === 'river') {
    newCommunityCards = [...newCommunityCards, newDeck[0]];
    newDeck = newDeck.slice(1);
  }

  // First to act post-flop: first active player after dealer
  const firstToAct = getFirstPostFlopActor(newPlayers, state.dealerPosition);

  return {
    players: newPlayers,
    street: nextStreet,
    communityCards: newCommunityCards,
    deck: newDeck,
    currentBet: 0,
    minRaise: state.currentBet || 50,
    lastAggressorPosition: null,
    currentPlayerPosition: firstToAct,
  };
}

function getNextStreet(current: Street): Street | null {
  const order: Street[] = ['preflop', 'flop', 'turn', 'river'];
  const idx = order.indexOf(current);
  return idx < order.length - 1 ? order[idx + 1] : null;
}

function getFirstPostFlopActor(players: PlayerState[], dealerPos: number): number {
  let pos = (dealerPos + 1) % players.length;
  while (!players[pos].isActive || players[pos].stack === 0) {
    pos = (pos + 1) % players.length;
  }
  return pos;
}

function settleHand(state: GameState, winners: PlayerState[]): Partial<GameState> {
  const resolvedWinners: WinnerRecord[] = [];

  if (winners.length === 1) {
    // Uncontested pot
    resolvedWinners.push({
      playerId: winners[0].uid,
      amount: state.pot,
      handName: 'Uncontested',
    });
  } else {
    // Showdown: evaluate hands
    const activePlayers = winners.map((p) => ({
      id: p.uid,
      holeCards: p.holeCards as [Card, Card],
    }));

    const results = determineWinners(activePlayers, state.communityCards as Card[]);
    const splitAmount = Math.floor(state.pot / results.length);

    for (const result of results) {
      resolvedWinners.push({
        playerId: result.winnerId,
        amount: splitAmount,
        handName: result.handName,
      });
    }
  }

  // Apply winnings
  const newPlayers = state.players.map((p) => {
    const win = resolvedWinners.find((w) => w.playerId === p.uid);
    return { ...p, stack: p.stack + (win?.amount ?? 0) };
  });

  // Eliminate players with 0 chips
  const updatedPlayers = newPlayers.map((p) => ({
    ...p,
    isEliminated: p.stack === 0,
  }));

  return {
    players: updatedPlayers,
    winners: resolvedWinners,
    status: updatedPlayers.filter((p) => !p.isEliminated).length <= 1 ? 'ended' : 'playing',
    currentPlayerPosition: null,
  };
}

export function getSidePots(players: PlayerState[]): { amount: number; eligiblePlayerIds: string[] }[] {
  const allInAmounts = players
    .filter((p) => p.stack === 0 && p.isActive)
    .map((p) => p.totalBetInHand)
    .sort((a, b) => a - b);

  if (allInAmounts.length === 0) return [];

  const sidePots: { amount: number; eligiblePlayerIds: string[] }[] = [];
  let prevLevel = 0;

  for (const level of allInAmounts) {
    const potAmount = players.reduce((sum, p) => {
      const contribution = Math.min(p.totalBetInHand, level) - Math.min(p.totalBetInHand, prevLevel);
      return sum + Math.max(0, contribution);
    }, 0);

    const eligible = players
      .filter((p) => p.isActive && p.totalBetInHand >= level)
      .map((p) => p.uid);

    if (potAmount > 0) {
      sidePots.push({ amount: potAmount, eligiblePlayerIds: eligible });
    }
    prevLevel = level;
  }

  return sidePots;
}
