import { initializeApp, getApps, cert, type App } from "firebase-admin/app"
import { getFirestore, type Firestore } from "firebase-admin/firestore"
import { getAuth, type Auth } from "firebase-admin/auth"
import { lazy } from "@/lib/lazy"

function init(): App {
  if (getApps().length > 0) return getApps()[0]
  const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
  if (!key) throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY is not set")
  return initializeApp({ credential: cert(JSON.parse(key)) })
}

export const adminDb = lazy<Firestore>(() => getFirestore(init()))
export const adminAuth = lazy<Auth>(() => getAuth(init()))
