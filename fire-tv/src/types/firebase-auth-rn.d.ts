// firebase package's bundled type declarations for 'firebase/auth' are web-only and
// don't reflect the React Native build that Metro actually resolves at runtime
// (firebase/auth/dist/esm/index.esm.js re-exports '@firebase/auth', which does provide
// this function under the "react-native" export condition). This augmentation restores
// the type for tsc, matching @firebase/auth's rn/index.rn.d.ts signature.
export {}

declare module 'firebase/auth' {
  import type { Persistence } from 'firebase/auth'

  interface ReactNativeAsyncStorage {
    setItem(key: string, value: string): Promise<void>
    getItem(key: string): Promise<string | null>
    removeItem(key: string): Promise<void>
  }

  export function getReactNativePersistence(
    storage: ReactNativeAsyncStorage
  ): Persistence
}
