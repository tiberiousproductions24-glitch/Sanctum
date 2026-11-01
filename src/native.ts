// Native (Capacitor) integrations: haptics, keep-awake during playback, orientation. All no-ops on the web.
import { Capacitor } from '@capacitor/core';
import type { App } from './app';

export const IS_NATIVE = Capacitor.isNativePlatform();
let haptics: typeof import('@capacitor/haptics') | null = null;

/** Velocity-scaled hit feedback. Fire-and-forget (never awaited on the audio path). */
export function hitHaptic(vel: number) {
  if (IS_NATIVE && haptics) {
    const { Haptics, ImpactStyle } = haptics;
    Haptics.impact({ style: vel > 100 ? ImpactStyle.Heavy : vel > 60 ? ImpactStyle.Medium : ImpactStyle.Light }).catch(() => {});
  } else if (navigator.vibrate) { try { navigator.vibrate(Math.round(4 + vel / 127 * 12)); } catch {} }
}

export async function initNative(app: App) {
  if (!IS_NATIVE) return;
  haptics = await import('@capacitor/haptics').catch(() => null);
  try {
    const { ScreenOrientation } = await import('@capacitor/screen-orientation');
    const phone = Math.min(screen.width, screen.height) < 600;
    if (phone) await ScreenOrientation.lock({ orientation: 'portrait' }); else await ScreenOrientation.unlock();
  } catch (e) { console.warn('orientation', e); }
  try {
    const { KeepAwake } = await import('@capacitor-community/keep-awake');
    let awake = false;
    app.on((w) => {
      if (w !== 'transport' && w !== 'started') return;
      const want = app.seq.playing || app.loops.size > 0;
      if (want !== awake) { awake = want; (want ? KeepAwake.keepAwake() : KeepAwake.allowSleep()).catch(() => {}); }
    });
  } catch (e) { console.warn('keep-awake', e); }
}
