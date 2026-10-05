import { GoogleAuthProvider, signInWithCredential, signInWithPopup } from "firebase/auth"
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore"
import { auth, db } from "@/lib/firebase"
import { isNativeIOS } from "@/lib/platform"

/**
 * Googleログイン。
 *
 * アプリ内(Capacitorのネイティブシェル)では signInWithPopup が使えない
 * (Googleがembedded webview内でのOAuthをポリシーで禁止しているため、
 * auth/operation-not-supported-in-this-environment や
 * disallowed_useragent で失敗する)。そのためネイティブでは
 * @capacitor-firebase/authentication 経由でOSのネイティブGoogleサインイン
 * 画面を呼び出し、返ってきたidToken/accessTokenをFirebaseの資格情報に
 * 変換してサインインする(lib/appleAuth.tsと同じ方式)。
 */
export async function signInWithGoogle(role: "player" | "store" = "player"): Promise<{
  uid: string
  role: string | null
  isNewUser: boolean
}> {
  if (isNativeIOS()) {
    return signInWithGoogleNative(role)
  }
  return signInWithGoogleWeb(role)
}

async function signInWithGoogleNative(role: "player" | "store"): Promise<{
  uid: string
  role: string | null
  isNewUser: boolean
}> {
  const { FirebaseAuthentication } = await import("@capacitor-firebase/authentication")

  const result = await FirebaseAuthentication.signInWithGoogle()
  const idToken = result.credential?.idToken
  if (!idToken) throw new Error("No idToken from Google")

  const credential = GoogleAuthProvider.credential(idToken, result.credential?.accessToken)
  const userCred = await signInWithCredential(auth, credential)

  return saveUser(userCred.user, role)
}

async function signInWithGoogleWeb(role: "player" | "store"): Promise<{
  uid: string
  role: string | null
  isNewUser: boolean
}> {
  const provider = new GoogleAuthProvider()
  const result = await signInWithPopup(auth, provider)
  return saveUser(result.user, role)
}

async function saveUser(
  user: { uid: string; email: string | null; displayName?: string | null },
  role: "player" | "store"
) {
  const snap = await getDoc(doc(db, "users", user.uid))
  if (!snap.exists()) {
    await setDoc(doc(db, "users", user.uid), {
      email: user.email,
      displayName: user.displayName ?? null,
      createdAt: serverTimestamp(),
      provider: "google",
      role,
    }, { merge: true })
    return { uid: user.uid, role, isNewUser: true }
  }
  return { uid: user.uid, role: snap.data()?.role ?? null, isNewUser: false }
}
