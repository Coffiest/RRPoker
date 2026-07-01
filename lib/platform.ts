import { Capacitor } from "@capacitor/core"

export function isNativeIOS(): boolean {
  try {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios"
  } catch {
    return false
  }
}

export function isNativeAndroid(): boolean {
  try {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android"
  } catch {
    return false
  }
}

/** True on either native wrapper (iOS or Android) — for behavior that isn't store-specific. */
export function isNativeApp(): boolean {
  try {
    return Capacitor.isNativePlatform()
  } catch {
    return false
  }
}
