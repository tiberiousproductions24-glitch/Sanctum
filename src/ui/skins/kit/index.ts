// Acrylic Kit pad skin — apply/remove instrument art on pads; theme-agnostic.
import type { SoundDef } from '../../../audio/kits';
import { instrumentEl, type KitInstrument } from './instruments';
import { instrumentForSound, motionClass } from './mapping';

export type PadSkin = 'hardware' | 'acrylic';
export const PAD_SKINS: { v: PadSkin; label: string; note: string }[] = [
  { v: 'acrylic', label: 'Acrylic Kit', note: 'Clear stage-head instruments (recommended)' },
  { v: 'hardware', label: 'Hardware', note: 'Raised neon rubber caps' },
];

export { instrumentForSound, motionClass, instrumentEl };
export type { KitInstrument };

/** Set document pad-skin dataset + localStorage mirror (for pre-paint). */
export function applyPadSkin(skin: PadSkin) {
  document.documentElement.dataset.padSkin = skin;
  try { localStorage.setItem('sanctum.padSkin', skin); } catch {}
}

/** Ensure a pad cap has a .kit slot and paint the right instrument for the sound. */
export function paintPadInstrument(pad: HTMLElement, sound: SoundDef | null | undefined) {
  const cap = pad.querySelector('.cap') as HTMLElement | null;
  if (!cap) return;
  let slot = cap.querySelector('.kit') as HTMLElement | null;
  if (!slot) {
    slot = document.createElement('span');
    slot.className = 'kit';
    slot.setAttribute('aria-hidden', 'true');
    cap.appendChild(slot); // after flash/ring/led — keeps existing child indices stable
  }
  const inst = instrumentForSound(sound);
  if (slot.dataset.inst === inst && slot.firstElementChild) {
    pad.dataset.instrument = inst;
    pad.dataset.motion = motionClass(inst);
    return;
  }
  slot.dataset.inst = inst;
  slot.replaceChildren(instrumentEl(inst));
  pad.dataset.instrument = inst;
  pad.dataset.motion = motionClass(inst);
}

/** Extra acrylic hit motion on the .kit art (transform/opacity only). */
export function acrylicHit(pad: HTMLElement, vel: number, reduce: boolean) {
  if (document.documentElement.dataset.padSkin !== 'acrylic') return;
  if (reduce) return;
  const kit = pad.querySelector('.kit') as HTMLElement | null;
  if (!kit) return;
  const k = vel / 127;
  const motion = pad.dataset.motion || 'soft';
  kit.getAnimations().forEach((a) => a.cancel());
  if (motion === 'head') {
    kit.animate(
      [{ transform: 'scale(1)' }, { transform: `scale(${0.965 - 0.02 * k})` }, { transform: 'scale(1)' }],
      { duration: 160 + 80 * k, easing: 'cubic-bezier(.2,.8,.3,1)' },
    );
  } else if (motion === 'cymbal') {
    const deg = 1.2 + 1.4 * k;
    kit.animate(
      [
        { transform: 'rotate(0deg) scale(1)', opacity: 1 },
        { transform: `rotate(${deg}deg) scale(1.03)`, opacity: 0.92 },
        { transform: `rotate(-${deg * 0.7}deg) scale(1.01)`, opacity: 1 },
        { transform: 'rotate(0deg) scale(1)', opacity: 1 },
      ],
      { duration: 280 + 160 * k, easing: 'cubic-bezier(.15,.7,.3,1)' },
    );
  } else if (motion === 'shake') {
    kit.animate(
      [
        { transform: 'translate(0,0)' },
        { transform: `translate(${2 + 2 * k}px, ${-1 * k}px)` },
        { transform: `translate(${-2 - 2 * k}px, ${1 * k}px)` },
        { transform: 'translate(0,0)' },
      ],
      { duration: 180 + 60 * k, easing: 'ease-out' },
    );
  } else if (motion === 'metal') {
    kit.animate(
      [{ transform: 'scale(1)' }, { transform: `scale(${1.04 + 0.03 * k})` }, { transform: 'scale(1)' }],
      { duration: 120 + 40 * k, easing: 'cubic-bezier(.2,.9,.3,1)' },
    );
  } else if (motion === 'soft') {
    kit.animate(
      [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0.85, transform: `scale(${1.02 + 0.02 * k})` }, { opacity: 1, transform: 'scale(1)' }],
      { duration: 200 + 100 * k, easing: 'ease-out' },
    );
  }
}
