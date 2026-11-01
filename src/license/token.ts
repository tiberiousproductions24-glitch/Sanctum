// Offline-verifiable Sanctum license tokens (Ed25519). Format "S1-" + base64url(body ‖ sig64):
// body = ver(1) type(1) plan(1) flags(1) id(8) issued u32 [expiry u32] [deviceHash 8] [nameLen(1) name]
// flags: 1 = has expiry, 2 = device-bound, 4 = has name. Minted by scripts/license.mjs.
import { verifyAsync } from '@noble/ed25519';
import { LICENSE_PUBKEY_HEX } from './pubkey';
import { isRevoked } from './revocation';

export type LicenseType = 'invite' | 'purchase' | 'admin';
export type Plan = 'full' | 'perform' | 'trial';
export interface LicensePayload { type: LicenseType; id: string; issued: number; expiry: number | null; deviceBinding: string | null; plan: Plan; name: string | null }
export type VerifyResult =
  | { status: 'valid'; payload: LicensePayload }
  | { status: 'expired' | 'revoked' | 'wrong-device'; payload: LicensePayload }
  | { status: 'invalid'; reason: string };

const TYPES: LicenseType[] = ['invite', 'purchase', 'admin'];
const PLANS: Plan[] = ['full', 'perform', 'trial'];
const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
const unhex = (s: string) => new Uint8Array(s.match(/../g)!.map((x) => parseInt(x, 16)));

/** Accepts a bare code, a code with spaces/newlines, or a sanctum://activate?code=… / https link. */
export function extractCode(input: string): string {
  let s = input.trim();
  const m = s.match(/[?&]code=([^&#\s]+)/); if (m) s = decodeURIComponent(m[1]);
  return s.replace(/\s+/g, '');
}
function b64uDecode(s: string): Uint8Array {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
}
export async function deviceHash(deviceId: string): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(deviceId.trim().toUpperCase())));
  return hex(d.subarray(0, 8));
}

export function decode(code: string): { payload: LicensePayload; body: Uint8Array; sig: Uint8Array } | null {
  const c = extractCode(code);
  if (!c.startsWith('S1-')) return null;
  let raw: Uint8Array; try { raw = b64uDecode(c.slice(3)); } catch { return null; }
  if (raw.length < 16 + 64) return null;
  const body = raw.subarray(0, raw.length - 64), sig = raw.subarray(raw.length - 64);
  if (body[0] !== 1) return null;
  const type = TYPES[body[1] - 1], plan = PLANS[body[2] - 1], flags = body[3];
  if (!type || !plan) return null;
  const dv = new DataView(body.buffer, body.byteOffset, body.byteLength);
  let o = 12; const issued = dv.getUint32(o); o += 4;
  let expiry: number | null = null, deviceBinding: string | null = null, name: string | null = null;
  try {
    if (flags & 1) { expiry = dv.getUint32(o); o += 4; }
    if (flags & 2) { deviceBinding = hex(body.subarray(o, o + 8)); o += 8; }
    if (flags & 4) { const n = body[o]; name = new TextDecoder().decode(body.subarray(o + 1, o + 1 + n)); o += 1 + n; }
  } catch { return null; }
  if (o !== body.length) return null;
  return { payload: { type, id: hex(body.subarray(4, 12)), issued, expiry, deviceBinding, plan, name }, body, sig };
}

/** Full check: signature, expiry, revocation deny list, device binding. Run on every launch. */
export async function verifyToken(code: string, deviceId: string, now = Date.now()): Promise<VerifyResult> {
  const d = decode(code);
  if (!d) return { status: 'invalid', reason: 'That isn\'t a Sanctum code. Check you copied all of it.' };
  let ok = false;
  try { ok = await verifyAsync(d.sig, d.body, unhex(LICENSE_PUBKEY_HEX)); } catch { ok = false; }
  if (!ok) return { status: 'invalid', reason: 'This code isn\'t valid (signature check failed).' };
  const p = d.payload;
  if (isRevoked(p.id)) return { status: 'revoked', payload: p };
  if (p.expiry != null && now / 1000 > p.expiry) return { status: 'expired', payload: p };
  if (p.deviceBinding && p.deviceBinding !== await deviceHash(deviceId)) return { status: 'wrong-device', payload: p };
  return { status: 'valid', payload: p };
}
