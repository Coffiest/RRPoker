// src/lib/auth.ts
import { onAuthStateChanged, User } from 'firebase/auth'
import { auth } from './firebase'

export const watchAuthState = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback)
}
