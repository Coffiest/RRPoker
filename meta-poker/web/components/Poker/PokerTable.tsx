'use client';

import { GameState, PlayerState } from '@/lib/types';
import PlayingCard from './PlayingCard';

interface PokerTableProps {
  gameState: GameState;
  myUid: string;
}

const SEAT_POSITIONS = [
  { top: '50%', left: '50%', label: 'BTN', transform: 'translate(-50%, 50%) translate(0, 140px)' },
  { top: '50%', left: '50%', label: 'SB', transform: 'translate(-50%, 50%) translate(-160px, 120px)' },
  { top: '50%', left: '50%', label: 'BB', transform: 'translate(-50%, 50%) translate(-200px, 30px)' },
  { top: '50%', left: '50%', label: 'UTG', transform: 'translate(-50%, 50%) translate(-180px, -80px)' },
  { top: '50%', left: '50%', label: 'HJ', transform: 'translate(-50%, 50%) translate(-80px, -150px)' },
  { top: '50%', left: '50%', label: 'CO', transform: 'translate(-50%, 50%) translate(80px, -150px)' },
  { top: '50%', left: '50%', label: 'CO+', transform: 'translate(-50%, 50%) translate(180px, -80px)' },
  { top: '50%', left: '50%', label: 'CO++', transform: 'translate(-50%, 50%) translate(200px, 30px)' },
  { top: '50%', left: '50%', label: 'BTN-', transform: 'translate(-50%, 50%) translate(160px, 120px)' },
];

export default function PokerTable({ gameState, myUid }: PokerTableProps) {
  const myPlayer = gameState.players.find((p) => p.uid === myUid);
  const myPosition = myPlayer?.position ?? 0;

  // Reorder players so myPlayer is at bottom
  const orderedPlayers = [...gameState.players].sort((a, b) => {
    const aOffset = (a.position - myPosition + gameState.players.length) % gameState.players.length;
    const bOffset = (b.position - myPosition + gameState.players.length) % gameState.players.length;
    return aOffset - bOffset;
  });

  return (
    <div className="relative w-full" style={{ paddingBottom: '70%' }}>
      {/* Table felt */}
      <div className="absolute inset-4 rounded-[50%] bg-[#1B5E20] border-8 border-[#4E342E] shadow-2xl overflow-hidden">
        {/* Table inner glow */}
        <div className="absolute inset-0 rounded-[50%] bg-gradient-to-b from-[#2E7D32]/30 to-transparent" />

        {/* Community Cards */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2">
          <div className="flex gap-1.5">
            {[0, 1, 2, 3, 4].map((i) => {
              const card = gameState.communityCards?.[i];
              return (
                <PlayingCard key={i} card={card ?? null} size="sm" faceDown={false} />
              );
            })}
          </div>
          {/* Pot */}
          <div className="bg-black/50 rounded-full px-4 py-1 text-white text-sm font-semibold">
            Pot: {(gameState.pot ?? 0).toLocaleString()}
          </div>
          {/* Street label */}
          <div className="text-white/40 text-xs capitalize">
            {gameState.street}
          </div>
        </div>
      </div>

      {/* Player Seats */}
      {orderedPlayers.map((player, displayIdx) => {
        const pos = SEAT_POSITIONS[displayIdx % SEAT_POSITIONS.length];
        const isMe = player.uid === myUid;
        const isCurrentTurn = gameState.currentPlayerPosition === player.position;
        const isDealer = gameState.dealerPosition === player.position;

        return (
          <PlayerSeat
            key={player.uid}
            player={player}
            isMe={isMe}
            isCurrentTurn={isCurrentTurn}
            isDealer={isDealer}
            seatPosition={pos}
            showHoleCards={isMe}
            communityCards={gameState.communityCards ?? []}
          />
        );
      })}
    </div>
  );
}

interface PlayerSeatProps {
  player: PlayerState;
  isMe: boolean;
  isCurrentTurn: boolean;
  isDealer: boolean;
  seatPosition: { top: string; left: string; label: string; transform: string };
  showHoleCards: boolean;
  communityCards: string[];
}

function PlayerSeat({ player, isMe, isCurrentTurn, isDealer, seatPosition, showHoleCards }: PlayerSeatProps) {
  const { top, left, transform } = seatPosition;

  const actionColor: Record<string, string> = {
    fold: 'text-red-400',
    check: 'text-green-400',
    call: 'text-blue-400',
    bet: 'text-yellow-400',
    raise: 'text-yellow-400',
    allin: 'text-purple-400',
  };

  return (
    <div
      className="absolute"
      style={{ top, left, transform }}
    >
      <div className={`
        flex flex-col items-center gap-1.5
        ${player.isEliminated ? 'opacity-30' : ''}
      `}>
        {/* Hole Cards */}
        {player.holeCards && (
          <div className="flex gap-0.5 mb-1">
            {showHoleCards ? (
              <>
                <PlayingCard card={player.holeCards[0]} size="xs" faceDown={false} />
                <PlayingCard card={player.holeCards[1]} size="xs" faceDown={false} />
              </>
            ) : (
              <>
                <PlayingCard card={null} size="xs" faceDown={true} />
                <PlayingCard card={null} size="xs" faceDown={true} />
              </>
            )}
          </div>
        )}

        {/* Avatar + Info */}
        <div className={`
          relative bg-[#1A1A1A] rounded-2xl px-3 py-2 min-w-20 text-center
          border-2 transition-colors
          ${isCurrentTurn ? 'border-[#F2A900] shadow-[0_0_12px_rgba(242,169,0,0.4)]' : 'border-transparent'}
          ${isMe ? 'bg-[#0D2B0D]' : ''}
        `}>
          {/* Dealer button */}
          {isDealer && (
            <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-white text-black text-xs font-bold flex items-center justify-center">
              D
            </div>
          )}

          <div className="text-white text-xs font-medium truncate max-w-16">
            {player.username}
          </div>
          <div className={`text-sm font-bold ${player.stack === 0 ? 'text-red-400' : 'text-[#F2A900]'}`}>
            {player.stack === 0 ? 'All-in' : player.stack.toLocaleString()}
          </div>

          {player.lastAction && (
            <div className={`text-xs ${actionColor[player.lastAction] ?? 'text-white/50'}`}>
              {player.lastAction.toUpperCase()}
            </div>
          )}

          {player.currentBet > 0 && (
            <div className="text-white/50 text-xs">
              bet: {player.currentBet.toLocaleString()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
