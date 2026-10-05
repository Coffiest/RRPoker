import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.rrpoker.app',
  appName: 'RRPoker',
  webDir: 'www',
  server: {
    url: 'https://rrpoker.vercel.app',
    cleartext: false
  },
  ios: {
    contentInset: 'automatic'
  },
  plugins: {
    FirebaseAuthentication: {
      // ネイティブのFirebase Authセッションには頼らず、Appleログインと同じく
      // 明示的にidToken/accessTokenを受け取ってfirebase/authのsignInWithCredential
      // に渡す方式に統一する(二重にサインインセッションが生まれるのを避ける)。
      skipNativeAuth: true,
      providers: ['google.com'],
    },
  },
};

export default config;
