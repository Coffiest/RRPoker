import { httpsCallable } from 'firebase/functions'
import { functions } from './firebase'

/**
 * Start a tournament timer (begin from current level with fresh schedule)
 */
export async function startTournamentTimer(storeId: string, tournamentId: string) {
  const fn = httpsCallable(functions, 'startTournamentTimer')
  await fn({ storeId, tournamentId })
}

/**
 * Pause a running tournament timer
 */
export async function pauseTournamentTimer(storeId: string, tournamentId: string) {
  const fn = httpsCallable(functions, 'pauseTournamentTimer')
  await fn({ storeId, tournamentId })
}

/**
 * Resume a paused tournament timer
 */
export async function resumeTournamentTimer(storeId: string, tournamentId: string) {
  const fn = httpsCallable(functions, 'resumeTournamentTimer')
  await fn({ storeId, tournamentId })
}

/**
 * Jump to a specific level index
 */
export async function setTournamentLevel(
  storeId: string,
  tournamentId: string,
  levelIndex: number
) {
  const fn = httpsCallable(functions, 'setTournamentLevel')
  await fn({ storeId, tournamentId, levelIndex })
}

/**
 * Adjust the remaining time for the current level
 */
export async function adjustTournamentTime(
  storeId: string,
  tournamentId: string,
  newSeconds: number
) {
  const fn = httpsCallable(functions, 'adjustTournamentTime')
  await fn({ storeId, tournamentId, newSeconds })
}
