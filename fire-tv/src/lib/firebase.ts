import { initializeApp } from 'firebase/app'
import { getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "AIzaSyADJmtwO7ru1vFGMFsARPbQMjwsBtpHU6Y",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "rrpoker-8f2af.firebaseapp.com",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "rrpoker-8f2af",
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "rrpoker-8f2af.appspot.com",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "373689603402",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "1:373689603402:web:8422c75633b424730b1db3",
}

const app = initializeApp(firebaseConfig)

// Web(react-native-web)ビルドでは getReactNativePersistence が存在しないため、
// ネイティブ(Android/iOS)とWebで初期化方法を分ける
export const auth = Platform.OS === 'web'
  ? getAuth(app)
  : initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) })
export const db = getFirestore(app)
