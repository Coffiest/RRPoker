import { initializeApp, getApps, cert } from "firebase-admin/app"
import { getFirestore } from "firebase-admin/firestore"
import { getAuth } from "firebase-admin/auth"

function init() {
  if (getApps().length > 0) return getApps()[0]
  const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
  if (!key) throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY is not set")
  return initializeApp({ credential: cert(JSON.parse(key)) })
}

init()

export const adminDb = getFirestore()
export const adminAuth = getAuth()
