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

/**
 * True when running inside an embedded WebView rather than a real browser —
 * either our own Capacitor wrapper, or an in-app browser (LINE, Instagram, X,
 * Facebook, Gmail, ...) that opened a link to the site. Google's OAuth blocks
 * sign-in from these user agents with "disallowed_useragent" no matter what
 * the app does, so callers should hide Google sign-in and use another method.
 */
export function isEmbeddedWebView(): boolean {
  if (isNativeApp()) return true
  if (typeof navigator === "undefined") return false
  const ua = navigator.userAgent || ""
  // Android WebView reports "; wv)" (or older "Version/x.x Chrome" without a real browser token).
  if (/; ?wv\)/i.test(ua)) return true
  // Known in-app browser tokens.
  if (/FBAN|FBAV|FB_IAB|Instagram|Line\/|Twitter|MicroMessenger|KAKAOTALK/i.test(ua)) return true
  // iOS in-app browsers (WKWebView) identify as Mobile Safari-like but omit "Safari" and "CriOS/FxiOS" tokens.
  const isIOS = /iPhone|iPad|iPod/i.test(ua)
  if (isIOS && /AppleWebKit/i.test(ua) && !/Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS/i.test(ua)) return true
  return false
}
