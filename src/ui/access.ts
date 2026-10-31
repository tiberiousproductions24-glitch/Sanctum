// UI-only mock of access-control.md (no real auth / network): lock, invite redemption, expired,
// revoked, paywall and grace states. Reached from Settings → Developer → Access preview, or ?access=<state>.
import type { App } from '../app';
import type { AccessState } from '../state';
import { h } from './dom';
import { archPadSvg } from './logo';

export class AccessGate {
  private el: HTMLElement | null = null;
  private bar: HTMLElement | null = null;
  constructor(private app: App, private openDev: () => void) {
    app.on((w) => { if (w === 'access') this.render(); });
  }
  get locked() { const s = this.app.p.access; return s !== 'owner' && s !== 'grace'; }

  render(step?: string) {
    this.el?.remove(); this.el = null; this.bar?.remove(); this.bar = null;
    const s = this.app.p.access;
    if (s === 'grace') { this.bar = h('div', { class: 'gracebar', role: 'status', onclick: this.openDev }, 'Payment issue — 5 days left. Update in Portal. (preview)'); document.body.appendChild(this.bar); return; }
    if (s === 'owner') return;
    if (this.app.started) this.app.stop();
    const dev = h('div', { class: 'devtag', role: 'button', onclick: this.openDev, title: 'Access preview (dev)' }, 'DEV PREVIEW');
    const mark = h('div', { class: 'archmark', html: archPadSvg(false) });
    const set = (v: AccessState) => { this.app.p.access = v; this.app.save(); this.render(); };
    let body: HTMLElement;
    if (s === 'locked' && step === 'enter-invite') {
      const inp = h('input', { type: 'text', placeholder: 'https://sanctum.app/i/…', 'aria-label': 'Invite link', style: { height: '48px', borderRadius: '12px', border: '1px solid var(--btn-edge)', padding: '0 12px', background: 'var(--btn)' } });
      const err = h('p', { style: { color: 'var(--bad)' } });
      body = h('div', { class: 'stack' }, h('p', {}, 'Paste the personal invite link Lawrence sent you.'), inp, err,
        h('button', { class: 'btn primary', onclick: () => {
          const v = inp.value.trim();
          if (/expired/i.test(v)) return set('expired');
          if (!/^https:\/\/sanctum\.app\/i\/[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(v) && v !== '') { err.textContent = 'That doesn\'t look like a Sanctum invite link (https://sanctum.app/i/<id>.<sig>).'; return; }
          set('invite');
        } }, 'Continue'),
        h('button', { class: 'btn', onclick: () => this.render() }, 'Back'),
        h('p', { class: 'note' }, 'Mock: any well-formed link (or empty) continues; a link containing "expired" shows the expired state.'));
    } else if (s === 'locked') {
      body = h('div', { class: 'stack' }, h('p', {}, 'A private instrument.'),
        h('button', { class: 'btn primary', onclick: () => this.render('enter-invite') }, 'I have an invite'),
        h('button', { class: 'btn', onclick: () => set('paywall') }, 'Subscribe'),
        h('div', { class: 'links' }, h('a', { onclick: () => set('owner') }, 'Sign in'), ' · ', h('a', { onclick: () => alert('Help (mock): ask Lawrence for an invite link, or subscribe on the web.') }, 'Help')));
    } else if (s === 'invite') {
      const done = step === 'signed-in';
      body = h('div', { class: 'stack' },
        h('h2', { style: { margin: 0, fontWeight: 400 } }, 'Lawrence invited you to Sanctum'),
        h('div', { class: 'paycard' }, h('div', { class: 'kv' }, h('div', {}, 'Invite'), h('div', {}, 'Praise team'), h('div', {}, 'Scope'), h('div', {}, 'Full'), h('div', {}, 'Redeem by'), h('div', {}, new Date(Date.now() + 7 * 864e5).toLocaleDateString()), h('div', {}, 'Access'), h('div', {}, '30 days'), h('div', {}, 'Seats left'), h('div', {}, '5 of 6'))),
        done ? h('p', { style: { color: 'var(--ok)', fontWeight: 700 } }, 'Device registered ✓') : null,
        done ? h('button', { class: 'btn primary', onclick: () => set('owner') }, 'Welcome — start First Beat') : [
          h('button', { class: 'btn primary', onclick: () => this.render('signed-in') }, ' Sign in with Apple'),
          h('button', { class: 'btn', onclick: () => this.render('signed-in') }, 'Sign in with Google'),
          h('button', { class: 'btn', onclick: () => this.render('signed-in') }, 'Email magic link')],
        h('p', { class: 'note' }, 'Mock only — nothing is sent, no account is created.'));
    } else if (s === 'expired') {
      body = h('div', { class: 'stack' }, h('h2', { style: { margin: 0, fontWeight: 400 } }, 'This invite has expired.'), h('p', {}, 'Ask Lawrence for a new link.'), h('button', { class: 'btn', onclick: () => set('locked') }, 'Back'));
    } else if (s === 'revoked') {
      body = h('div', { class: 'stack' }, h('h2', { style: { margin: 0, fontWeight: 400 } }, 'Your access to Sanctum has ended.'),
        h('button', { class: 'btn', onclick: () => alert('Export (mock): projects remain on this device and can be exported.') }, 'Export projects'),
        h('button', { class: 'btn primary', onclick: () => set('paywall') }, 'Subscribe'));
    } else { // paywall
      body = h('div', { class: 'stack', style: { alignItems: 'center' } },
        h('div', { class: 'paycard' }, h('h2', {}, 'Sanctum'), h('div', { class: 'note' }, 'Monthly · price TBD'),
          h('ul', {}, h('li', {}, 'All soundbanks incl. Foundation Kit & Stage FX'), h('li', {}, 'Link, MIDI clock & DAW sync'), h('li', {}, 'Updates & new banks (A-100, Choir Loft…)')),
          h('button', { class: 'btn primary', style: { width: '100%' }, disabled: true, title: 'Stripe Checkout comes in Phase B' }, 'Continue on web'),
          h('p', { class: 'note' }, 'Billing happens on the web (Stripe, Phase B). No countdowns, no dark patterns.'),
          h('div', { class: 'links' }, h('a', { onclick: () => alert('Restore purchases (mock).') }, 'Restore purchases'), ' · ', h('a', { onclick: () => set('locked') }, 'Back'))));
    }
    this.el = h('div', { class: 'overlay lock', role: 'dialog', 'aria-label': 'Sanctum access' }, dev, mark, h('h1', {}, 'SANCTUM'), body);
    document.body.appendChild(this.el);
  }
}
