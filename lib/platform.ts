import { Capacitor } from "@capacitor/core"

export function isNativeIOS(): boolean {
  try {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios"
  } catch {
    return false
  }
}
