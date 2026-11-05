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
  ios: {
    contentInset: 'never',                      // edge-to-edge; the CSS handles env(safe-area-inset-*) itself
    backgroundColor: '#07070C',
    scrollEnabled: false,                       // instrument surface: no rubber-band page scroll (sheets scroll internally)
    limitsNavigationsToAppBoundDomains: false,
  },
  plugins: {
    SplashScreen: { launchShowDuration: 3000, launchAutoHide: false, backgroundColor: '#07070C', showSpinner: false, androidScaleType: 'CENTER_CROP' },
  },
};

export default config;
