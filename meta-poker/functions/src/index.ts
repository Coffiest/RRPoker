import * as functions from 'firebase-functions';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import Stripe from 'stripe';
import { createNewHand, processAction, PlayerState, GameState } from './game/gameEngine';

initializeApp();
const db = getFirestore();
const auth = getAuth();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
  apiVersion: '2026-04-22.dahlia',
});

// ─── Auth middleware ───────────────────────────────────────────────────────────

async function verifyToken(req: functions.https.Request): Promise<string> {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) throw new functions.https.HttpsError('unauthenticated', 'No token');
  const decoded = await auth.verifyIdToken(token);
  return decoded.uid;
}

// ─── Tournament: Start ────────────────────────────────────────────────────────

export const startTournament = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.status(204).send(''); return; }

  try {
    const uid = await verifyToken(req);
    const { tournamentId } = req.body as { tournamentId: string };

    const tournamentRef = db.collection('tournaments').doc(tournamentId);
    const tournament = (await tournamentRef.get()).data();

    if (!tournament) { res.status(404).json({ error: 'Tournament not found' }); return; }
    if (tournament.creatorId !== uid) { res.status(403).json({ error: 'Not authorized' }); return; }
    if (tournament.status !== 'pending') { res.status(400).json({ error: 'Already started' }); return; }

    const playerIds: string[] = tournament.registeredPlayerIds;
    if (playerIds.length < 2) { res.status(400).json({ error: 'Need at least 2 players' }); return; }

    // Fetch user profiles
    const userDocs = await Promise.all(playerIds.map((id) => db.collection('users').doc(id).get()));
    const users = userDocs.map((d) => d.data());

    // Distribute players into tables (max 9 per table)
    const tables: string[][] = [];
    const shuffled = [...playerIds].sort(() => Math.random() - 0.5);
    for (let i = 0; i < shuffled.length; i += 9) {
      tables.push(shuffled.slice(i, Math.min(i + 9, shuffled.length)));
    }

    const tableIds: string[] = [];
    const now = FieldValue.serverTimestamp();

    for (let tableIdx = 0; tableIdx < tables.length; tableIdx++) {
      const tablePlayers = tables[tableIdx];
      const players: PlayerState[] = tablePlayers.map((pid, seatIdx) => {
        const u = users.find((u) => u?.uid === pid);
        return {
          uid: pid,
          username: u?.username ?? 'Unknown',
          profileImageUrl: u?.profileImageUrl ?? null,
          stack: tournament.startingStack,
          holeCards: null,
          currentBet: 0,
          totalBetInHand: 0,
          isActive: true,
          isEliminated: false,
          isSittingOut: false,
          position: seatIdx,
          lastAction: null,
        };
      });

      const firstBlind = tournament.blindLevels[0];
      const initialState = createNewHand(
        { currentBet: firstBlind.bigBlind, handNumber: 0, dealerPosition: -1, tournamentId },
        players
      ) as GameState;

      const gameRef = db.collection('games').doc();
      await gameRef.set({
        ...initialState,
        id: gameRef.id,
        tournamentId,
        tableNumber: tableIdx + 1,
        createdAt: now,
        updatedAt: now,
      });

      tableIds.push(gameRef.id);
    }

    // Calculate first blind advance time
    const firstBlindDuration = tournament.blindLevels[0].durationMinutes * 60 * 1000;
    const nextBlindAt = new Date(Date.now() + firstBlindDuration);

    await tournamentRef.update({
      status: 'running',
      tableIds,
      startAt: now,
      nextBlindAt: nextBlindAt,
      updatedAt: now,
    });

    // Update user stats
    await Promise.all(playerIds.map((pid) =>
      db.collection('userStats').doc(pid).update({ totalTournaments: FieldValue.increment(1) })
    ));

    res.json({ success: true, tableIds, gameId: tableIds[0] });
  } catch (err) {
    console.error('startTournament error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Game: Player Action ──────────────────────────────────────────────────────

export const playerAction = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.status(204).send(''); return; }

  try {
    const uid = await verifyToken(req);
    const { gameId, action, amount = 0 } = req.body as {
      gameId: string;
      action: string;
      amount?: number;
    };

    const gameRef = db.collection('games').doc(gameId);

    await db.runTransaction(async (tx) => {
      const gameSnap = await tx.get(gameRef);
      if (!gameSnap.exists) throw new Error('Game not found');
      const state = gameSnap.data() as GameState;

      const update = processAction(state, uid, action as Parameters<typeof processAction>[2], amount);
      const isHandOver = !!update.winners;

      tx.update(gameRef, {
        ...update,
        updatedAt: FieldValue.serverTimestamp(),
      });

      // If hand is over, save hand histories
      if (isHandOver && update.players) {
        for (const player of update.players) {
          if (!player.holeCards) continue;
          const histRef = db.collection('handHistories').doc();
          const playerHash = Buffer.from(player.uid).toString('base64').slice(0, 12);
          tx.set(histRef, {
            id: histRef.id,
            gameId,
            tournamentId: state.tournamentId,
            handNumber: state.handNumber,
            playerHash,
            position: getPositionName(player.position, update.players?.length ?? 2),
            holeCards: player.holeCards.join(''),
            communityCards: update.communityCards ?? state.communityCards ?? [],
            actions: [],
            result: update.winners?.some((w) => w.playerId === player.uid) ? 'win' : 'lose',
            potAmount: state.pot,
            netGain: (update.winners?.find((w) => w.playerId === player.uid)?.amount ?? 0) - player.totalBetInHand,
            handName: update.winners?.find((w) => w.playerId === player.uid)?.handName ?? null,
            createdAt: FieldValue.serverTimestamp(),
          });
        }
      }
    });

    res.json({ success: true });
  } catch (err) {
    console.error('playerAction error:', err);
    res.status(500).json({ error: String(err) });
  }
});

// ─── Blind Level Advance (scheduled) ──────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const advanceBlindLevel = (functions as any).pubsub.schedule('every 1 minutes').onRun(async () => {
  const now = new Date();
  const tournamentSnap = await db.collection('tournaments')
    .where('status', '==', 'running')
    .where('nextBlindAt', '<=', now)
    .get();

  for (const doc of tournamentSnap.docs) {
    const tournament = doc.data();
    const nextLevel = tournament.currentBlindLevel + 1;

    if (nextLevel >= tournament.blindLevels.length) continue;

    const nextBlindDuration = tournament.blindLevels[nextLevel].durationMinutes * 60 * 1000;
    const nextBlindAt = new Date(now.getTime() + nextBlindDuration);

    await doc.ref.update({
      currentBlindLevel: nextLevel,
      nextBlindAt,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
});

// ─── Deal New Hand ────────────────────────────────────────────────────────────

export const dealNewHand = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.status(204).send(''); return; }

  try {
    const uid = await verifyToken(req);
    const { gameId } = req.body as { gameId: string };

    const gameRef = db.collection('games').doc(gameId);
    const gameSnap = await gameRef.get();
    if (!gameSnap.exists) { res.status(404).json({ error: 'Game not found' }); return; }

    const state = gameSnap.data() as GameState;
    const isPlayer = state.players.some((p) => p.uid === uid);
    if (!isPlayer) { res.status(403).json({ error: 'Not a player' }); return; }

    // Get current blind level from tournament
    const tournamentSnap = await db.collection('tournaments').doc(state.tournamentId).get();
    const tournament = tournamentSnap.data();
    const currentBlind = tournament?.blindLevels[tournament?.currentBlindLevel ?? 0];

    const newHandState = createNewHand(
      { ...state, currentBet: currentBlind?.bigBlind ?? 50 },
      state.players.filter((p) => !p.isEliminated)
    );

    await gameRef.update({
      ...newHandState,
      updatedAt: FieldValue.serverTimestamp(),
    });

    res.json({ success: true });
  } catch (err) {
    console.error('dealNewHand error:', err);
    res.status(500).json({ error: String(err) });
  }
});

// ─── Stripe: Create Checkout Session ─────────────────────────────────────────

export const createCheckoutSession = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.status(204).send(''); return; }

  try {
    const uid = await verifyToken(req);
    const { priceId, successUrl, cancelUrl } = req.body as {
      priceId: string;
      successUrl: string;
      cancelUrl: string;
    };

    const userDoc = await db.collection('users').doc(uid).get();
    const subDoc = await db.collection('subscriptions').doc(uid).get();
    const sub = subDoc.data();

    let customerId = sub?.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: userDoc.data()?.email,
        metadata: { firebaseUid: uid },
      });
      customerId = customer.id;
      await db.collection('subscriptions').doc(uid).update({ stripeCustomerId: customerId });
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      subscription_data: sub?.trialEndsAt ? undefined : { trial_period_days: 7 },
    });

    res.json({ sessionId: session.id, url: session.url });
  } catch (err) {
    console.error('createCheckoutSession error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Stripe: Webhook ──────────────────────────────────────────────────────────

export const stripeWebhook = functions.https.onRequest(async (req, res) => {
  const sig = req.headers['stripe-signature'] as string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let event: any;

  try {
    event = stripe.webhooks.constructEvent(
      req.rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET ?? ''
    );
  } catch {
    res.status(400).send('Webhook signature verification failed');
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sub = event.data.object as any;
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;

  const subsSnap = await db.collection('subscriptions')
    .where('stripeCustomerId', '==', customerId)
    .limit(1)
    .get();

  if (subsSnap.empty) { res.json({ received: true }); return; }
  const subDocRef = subsSnap.docs[0].ref;

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const isActive = sub.status === 'active' || sub.status === 'trialing';
      await subDocRef.update({
        plan: isActive ? 'premium' : 'free',
        status: sub.status,
        stripeSubscriptionId: sub.id,
        stripePriceId: (sub.items.data[0].price.id),
        currentPeriodStart: new Date(sub.current_period_start * 1000),
        currentPeriodEnd: new Date(sub.current_period_end * 1000),
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
        updatedAt: FieldValue.serverTimestamp(),
      });
      break;
    }
    case 'customer.subscription.deleted':
      await subDocRef.update({
        plan: 'free',
        status: 'cancelled',
        cancelAtPeriodEnd: false,
        updatedAt: FieldValue.serverTimestamp(),
      });
      break;
  }

  res.json({ received: true });
});

// ─── Helper ───────────────────────────────────────────────────────────────────

function getPositionName(seatIndex: number, totalPlayers: number): string {
  if (totalPlayers === 2) return seatIndex === 0 ? 'BTN' : 'BB';
  const positions = ['BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'UTG+2', 'HJ', 'CO', 'BTN'];
  return positions[seatIndex % positions.length] ?? 'UTG';
}
