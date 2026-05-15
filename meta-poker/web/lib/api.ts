const FUNCTIONS_BASE = process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_URL ?? '';

async function callFunction(path: string, body: Record<string, unknown>, token: string) {
  const res = await fetch(`${FUNCTIONS_BASE}/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error ?? 'Request failed');
  }
  return res.json();
}

export async function startTournament(tournamentId: string, token: string) {
  return callFunction('startTournament', { tournamentId }, token);
}

export async function playerAction(gameId: string, action: string, amount: number, token: string) {
  return callFunction('playerAction', { gameId, action, amount }, token);
}

export async function dealNewHand(gameId: string, token: string) {
  return callFunction('dealNewHand', { gameId }, token);
}

export async function createCheckoutSession(priceId: string, successUrl: string, cancelUrl: string, token: string) {
  return callFunction('createCheckoutSession', { priceId, successUrl, cancelUrl }, token);
}
