// Lock screen — the ONLY UI mounted until a valid license verifies. Imports nothing from the app/engine.
import { h } from '../ui/dom';
import { archPadSvg } from '../ui/logo';
import { activate, type LicenseState } from './license';
import { StorePurchaseProvider } from './providers';
import { storageKind } from './store';
import type { LicensePayload } from './token';
import { extractCode, decode } from './token';

export type GateScreen = 'locked' | 'enter' | 'welcome' | 'expired' | 'revoked' | 'wrong-device' | 'paywall' | 'help';
export interface GateOpts { preview?: boolean; onClose?: () => void; prefill?: string }

const fmtDate = (s: number | null) => (s == null ? 'No end date' : new Date(s * 1000).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }));
const planName = (p: string) => ({ full: 'Full', perform: 'Perform', trial: 'Trial' } as Record<string, string>)[p] || p;

export class LockScreen {
  el: HTMLElement | null = null;
  private payload: LicensePayload | null = null;
  constructor(private st: LicenseState, private onUnlocked: (p: LicensePayload) => void, private opts: GateOpts = {}) {}

  static initialScreen(st: LicenseState): GateScreen {
    const s = st.result?.status;
    return s === 'expired' ? 'expired' : s === 'revoked' ? 'revoked' : s === 'wrong-device' ? 'wrong-device' : 'locked';
  }

  close() { this.el?.remove(); this.el = null; }

  /** Try a code (typed, pasted, or from a sanctum://activate deep link). */
  async tryCode(input: string, err?: HTMLElement): Promise<boolean> {
    const code = extractCode(input);
    if (!code) { if (err) err.textContent = 'Type or paste your code first.'; return false; }
    if (this.opts.preview) { if (err) err.textContent = 'Preview only — codes are not applied here.'; return false; }
    const r = await activate(code, this.st.deviceId);
    if (r.status === 'valid') { this.payload = r.payload; this.render('welcome'); return true; }
    if (r.status === 'expired') { this.payload = r.payload; this.render('expired'); return false; }
    if (r.status === 'revoked') { this.render('revoked'); return false; }
    if (r.status === 'wrong-device') { this.render('wrong-device'); return false; }
    const reason = r.status === 'invalid' ? r.reason : r.status;
    if (err) err.textContent = reason; else { this.render('enter'); this.el?.querySelector('.err')!.replaceChildren(reason); }
    return false;
  }

  render(screen: GateScreen = LockScreen.initialScreen(this.st)) {
    this.close();
    const mark = h('div', { class: 'archmark', html: archPadSvg(false), 'aria-hidden': 'true' });
    const title = h('h1', {}, 'SANCTUM');
    let body: HTMLElement;
    const back = (to: GateScreen = 'locked') => h('button', { class: 'btn', onclick: () => this.render(to) }, 'Back');
    if (screen === 'enter') {
      const inp = h('textarea', { class: 'codein', rows: 3, placeholder: 'Paste your code or link here', 'aria-label': 'Invite or access code', autocapitalize: 'off', autocomplete: 'off', spellcheck: false }) as HTMLTextAreaElement;
      if (this.opts.prefill) inp.value = this.opts.prefill;
      const err = h('p', { class: 'err', role: 'alert', style: { color: 'var(--bad)' } });
      const go = h('button', { class: 'btn primary', onclick: async () => { go.disabled = true; try { await this.tryCode(inp.value, err); } finally { go.disabled = false; } } }, 'Unlock');
      body = h('div', { class: 'stack' }, h('p', {}, 'Paste the code or link Lawrence sent you.'), inp, err, go, back(),
        h('p', { class: 'note' }, 'Tip: tapping the link on this phone opens Sanctum and unlocks it for you.'));
    } else if (screen === 'welcome') {
      const p = this.payload!;
      const who = p.type === 'admin' ? 'Owner access' : p.name ? `Welcome, ${p.name}` : 'Welcome to Sanctum';
      body = h('div', { class: 'stack' }, h('h2', { class: 'gate-h' }, who),
        h('div', { class: 'paycard' }, h('div', { class: 'kv' }, h('div', {}, 'Access'), h('div', {}, p.type === 'admin' ? 'Admin' : p.type === 'invite' ? 'Invite' : 'Subscription'),
          h('div', {}, 'Plan'), h('div', {}, planName(p.plan)), h('div', {}, 'Until'), h('div', {}, fmtDate(p.expiry)), h('div', {}, 'This device'), h('div', {}, 'Registered ✓'))),
        h('button', { class: 'btn primary', autofocus: true, onclick: () => { this.close(); this.onUnlocked(p); } }, 'Open Sanctum'));
    } else if (screen === 'expired') {
      const p = this.payload || (this.st.result && 'payload' in this.st.result ? this.st.result.payload : null);
      body = h('div', { class: 'stack' }, h('h2', { class: 'gate-h' }, 'Your access has expired.'),
        h('p', {}, p?.expiry ? `It ended on ${fmtDate(p.expiry)}. Ask Lawrence for a new code.` : 'Ask Lawrence for a new code.'),
        h('button', { class: 'btn primary', onclick: () => this.render('enter') }, 'I have a new code'), h('button', { class: 'btn', onclick: () => this.render('paywall') }, 'Subscribe'));
    } else if (screen === 'revoked') {
      body = h('div', { class: 'stack' }, h('h2', { class: 'gate-h' }, 'Your access to Sanctum has ended.'),
        h('p', {}, 'Your projects stay on this device.'), h('button', { class: 'btn primary', onclick: () => this.render('enter') }, 'I have a new code'), h('button', { class: 'btn', onclick: () => this.render('paywall') }, 'Subscribe'));
    } else if (screen === 'wrong-device') {
      body = h('div', { class: 'stack' }, h('h2', { class: 'gate-h' }, 'This code is for another device.'),
        h('p', {}, 'Send Lawrence this device ID and he can make you a new code:'), h('p', { class: 'mono devid' }, this.st.deviceId), back());
    } else if (screen === 'paywall') {
      const prods = StorePurchaseProvider.PRODUCTS;
      body = h('div', { class: 'stack', style: { alignItems: 'center' } },
        h('div', { class: 'paycard' }, h('h2', {}, prods[0].title), h('div', { class: 'note' }, `${prods[0].price} · or ${prods[1].title}`),
          h('ul', {}, h('li', {}, 'Every sound bank, including the church banks'), h('li', {}, 'Sync with Ableton, Logic and other music apps'), h('li', {}, 'Updates and new banks')),
          h('button', { class: 'btn primary', style: { width: '100%' }, disabled: !StorePurchaseProvider.WIRED, 'aria-disabled': 'true' }, 'Subscribe — coming soon'),
          h('p', { class: 'note' }, 'Store billing isn\'t connected yet. For now, ask Lawrence for an invite code.'),
          h('div', { class: 'links' }, h('a', { role: 'button', tabindex: 0, onclick: (e: Event) => { (e.target as HTMLElement).textContent = 'Restore isn\'t connected yet'; } }, 'Restore purchases'), ' · ', h('a', { role: 'button', tabindex: 0, onclick: () => this.render('locked') }, 'Back'))));
    } else if (screen === 'help') {
      body = h('div', { class: 'stack' }, h('p', {}, 'Sanctum is private. To get in, ask Lawrence for an invite code, then tap "I have a code".'),
        h('div', { class: 'paycard' }, h('div', { class: 'kv' }, h('div', {}, 'Device ID'), h('div', { class: 'mono devid' }, this.st.deviceId), h('div', {}, 'Stored in'), h('div', {}, storageKind()))), back());
    } else {
      body = h('div', { class: 'stack' }, h('p', {}, 'A private instrument.'),
        h('button', { class: 'btn primary', onclick: () => this.render('enter') }, 'I have a code'),
        h('button', { class: 'btn', onclick: () => this.render('paywall') }, 'Subscribe'),
        h('div', { class: 'links' }, h('a', { role: 'button', tabindex: 0, onclick: () => this.render('help') }, 'Help')));
    }
    const close = this.opts.preview ? h('button', { class: 'devtag', onclick: () => { this.close(); this.opts.onClose?.(); } }, 'CLOSE PREVIEW') : null;
    this.el = h('div', { class: 'overlay lock', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Sanctum is locked', 'data-screen': screen }, close, mark, title, body);
    document.body.appendChild(this.el);
    (this.el.querySelector('[autofocus]') as HTMLElement | null || this.el.querySelector('textarea, .btn.primary') as HTMLElement | null)?.focus();
  }
}

/** Quick decode for display only (no trust). */
export const peek = (code: string) => decode(code)?.payload ?? null;
