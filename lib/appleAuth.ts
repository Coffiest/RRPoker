import { OAuthProvider, signInWithCredential, signInWithPopup } from "firebase/auth"
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore"
import { auth, db } from "@/lib/firebase"
import { isNativeIOS } from "@/lib/platform"

export async function signInWithApple(role: "player" | "store" = "player"): Promise<{
  uid: string
  role: string | null
  isNewUser: boolean
}> {
  if (isNativeIOS()) {
    return signInWithAppleNative(role)
  }
  return signInWithAppleWeb(role)
}

async function signInWithAppleNative(role: "player" | "store"): Promise<{
  uid: string
  role: string | null
  isNewUser: boolean
}> {
  const { SignInWithApple } = await import("@capacitor-community/apple-sign-in")

  // Appleには「生のnonceをSHA256でハッシュした値」を渡す必要がある(Appleの仕様)。
  // Firebase側はidTokenの検証に「生のnonce」を必要とする。
  // 以前はハッシュせず生のnonceをそのままAppleに渡し、かつFirebaseにnonceを
  // 渡していなかったため、Appleの認証自体は成功してもFirebaseの資格情報検証で
  // 失敗していた(App Reviewでの "Sign in with Apple" エラーの原因)。
  const rawNonce = generateNonce()
  const hashedNonce = await sha256Hex(rawNonce)

  const result = await SignInWithApple.authorize({
    clientId: "com.rrpoker.app",
    redirectURI: "https://rrpoker.vercel.app",
    scopes: "email name",
    nonce: hashedNonce,
  })

  const { identityToken, givenName, familyName } = result.response
  if (!identityToken) throw new Error("No identity token from Apple")

  const provider = new OAuthProvider("apple.com")
  const credential = provider.credential({ idToken: identityToken, rawNonce })
  const userCred = await signInWithCredential(auth, credential)

  return saveUser(userCred.user, { givenName, familyName }, role)
}

async function signInWithAppleWeb(role: "player" | "store"): Promise<{
  uid: string
  role: string | null
  isNewUser: boolean
}> {
  const provider = new OAuthProvider("apple.com")
  provider.addScope("email")
  provider.addScope("name")

  const result = await signInWithPopup(auth, provider)
  const givenName = result.user.displayName?.split(" ")[0] ?? null
  const familyName = result.user.displayName?.split(" ")[1] ?? null

  return saveUser(result.user, { givenName, familyName }, role)
}

async function saveUser(
  user: { uid: string; email: string | null },
  name: { givenName: string | null; familyName: string | null },
  role: "player" | "store"
) {
  const snap = await getDoc(doc(db, "users", user.uid))
  if (!snap.exists()) {
    const displayName = [name.givenName, name.familyName].filter(Boolean).join(" ") || null
    await setDoc(doc(db, "users", user.uid), {
      email: user.email,
      displayName,
      createdAt: serverTimestamp(),
      provider: "apple",
      role,
    }, { merge: true })
    return { uid: user.uid, role, isNewUser: true }
  }
  return { uid: user.uid, role: snap.data()?.role ?? null, isNewUser: false }
}

function generateNonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  let nonce = ""
  for (let i = 0; i < 32; i++) {
    nonce += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return nonce
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const hashBuffer = await crypto.subtle.digest("SHA-256", data)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}
