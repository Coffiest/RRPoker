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
  }
};

export default config;
