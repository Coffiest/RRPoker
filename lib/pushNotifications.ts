import { PushNotifications } from "@capacitor/push-notifications"
import { doc, updateDoc, arrayUnion } from "firebase/firestore"
import { db } from "./firebase"
import { isNativeApp } from "./platform"

// Scaffolding only: requests permission, registers for push (APNs on iOS, FCM on
// Android — the plugin abstracts both behind the same API), and stores the device
// token on the user's Firestore doc. No notification-sending logic exists yet —
// iOS needs an APNs key from Apple Developer Program; Android needs a Firebase
// Android app + google-services.json wired into the native project. Plus a
// decision on what events should trigger a push.
let registered = false

export async function registerPushNotifications(uid: string): Promise<void> {
  if (!isNativeApp() || registered) return
  registered = true

  try {
    const perm = await PushNotifications.checkPermissions()
    let granted = perm.receive === "granted"
    if (perm.receive === "prompt" || perm.receive === "prompt-with-rationale") {
      const requested = await PushNotifications.requestPermissions()
      granted = requested.receive === "granted"
    }
    if (!granted) return

    await PushNotifications.addListener("registration", token => {
      void updateDoc(doc(db, "users", uid), {
        pushTokens: arrayUnion(token.value),
      }).catch(() => {})
    })

    await PushNotifications.addListener("registrationError", err => {
      console.error("Push registration failed:", err)
    })

    await PushNotifications.register()
  } catch (err) {
    console.error("Push notification setup failed:", err)
  }
}
