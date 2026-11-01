import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tiberiousproductions.sanctum',
  appName: 'Sanctum',
  webDir: 'dist',
  server: { androidScheme: 'https' },          // https://localhost → secure context (AudioWorklet, WebCrypto)
  android: {
    allowMixedContent: true,                    // ws:// to a LAN Link bridge from the https://localhost page (app restricts to private IPs)
    backgroundColor: '#07070C',
  },
  plugins: {
    SplashScreen: { launchShowDuration: 3000, launchAutoHide: false, backgroundColor: '#07070C', showSpinner: false, androidScaleType: 'CENTER_CROP' },
  },
};

export default config;
