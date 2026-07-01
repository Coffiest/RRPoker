import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics"
import { isNativeApp } from "./platform"

// No-ops on web — only the native apps (iOS/Android) have real haptic hardware feedback.

/** Light tap feedback for routine taps (nav switches, secondary buttons). */
export function hapticTap(): void {
  if (!isNativeApp()) return
  Haptics.impact({ style: ImpactStyle.Light }).catch(() => {})
}

/** Medium impact for primary actions (start timer, confirm, submit). */
export function hapticAction(): void {
  if (!isNativeApp()) return
  Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {})
}

/** Success feedback (purchase complete, deposit confirmed). */
export function hapticSuccess(): void {
  if (!isNativeApp()) return
  Haptics.notification({ type: NotificationType.Success }).catch(() => {})
}

/** Error/warning feedback (failed action, validation error). */
export function hapticError(): void {
  if (!isNativeApp()) return
  Haptics.notification({ type: NotificationType.Error }).catch(() => {})
}
