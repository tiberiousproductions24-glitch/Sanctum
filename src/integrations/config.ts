// Persisted settings for the live integrations (Lampstand screen + rehearsal room).
import { Capacitor } from '@capacitor/core';
import { isLanHost } from '../sync/link';

export interface RehearsalConfig { url: string; room: string; church: string; token: string; name: string; sendAudio: boolean; monitor: boolean; stemBank: number; leadMs: number; on: boolean }
export interface LiveConfig { relay: string; church: string; room: string; name: string; screenOn: boolean; autoNowPlaying: boolean; reh: RehearsalConfig }

const KEY = 'sanctum.live.v1';
export const DEFAULT_RELAY_PORT = 20810;

export function defaults(): LiveConfig {
  return { relay: '', church: 'prayer-garden', room: 'MAIN', name: 'Sanctum', screenOn: false, autoNowPlaying: true,
    reh: { url: '', room: 'sunday-choir', church: '', token: '', name: 'Sanctum (Lawrence)', sendAudio: true, monitor: false, stemBank: 7, leadMs: 60, on: false } };
}
export function loadConfig(): LiveConfig {
  const d = defaults();
  try { const s = JSON.parse(localStorage.getItem(KEY) || '{}'); return { ...d, ...s, reh: { ...d.reh, ...(s.reh || {}) } }; } catch { return d; }
}
export function saveConfig(c: LiveConfig) { try { localStorage.setItem(KEY, JSON.stringify(c)); } catch {} }

/** Pairing via URL (?relay=…&room=church/ROOM) or deep link sanctum://live?relay=…&room=… */
export function applyPairingUrl(c: LiveConfig, href: string): boolean {
  let u: URL; try { u = new URL(href.replace(/^sanctum:\/\//, 'https://x/')); } catch { return false; }
  const relay = u.searchParams.get('relay'), room = u.searchParams.get('room') || u.searchParams.get('sroom');
  const rr = u.searchParams.get('rehearsal');
  if (!relay && !room && !rr) return false;
  if (relay) c.relay = relay;
  if (room) { const r = splitRoom(room); if (r) { c.church = r.church; c.room = r.room; } }
  if (rr) c.reh.url = rr;
  if (u.searchParams.get('rroom')) c.reh.room = u.searchParams.get('rroom')!;
  return true;
}

export function slug(s: string) { return String(s || '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40); }
export function roomCode(s: string) { return String(s || '').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 12); }
export function splitRoom(s: string) { const i = s.indexOf('/'); if (i < 0) return { church: 'default', room: roomCode(s) }; return { church: slug(s.slice(0, i)) || 'default', room: roomCode(s.slice(i + 1)) }; }
export const fullRoom = (c: LiveConfig) => `${slug(c.church) || 'default'}/${roomCode(c.room) || 'MAIN'}`;

/** '192.168.1.20' | '192.168.1.20:20810' | 'ws://…' | 'wss://…' | '' (same-origin /live proxy in the browser). */
export function relayUrl(input: string): { url?: string; http?: string; error?: string } {
  let s = (input || '').trim();
  if (!s) {
    if (Capacitor.isNativePlatform()) return { error: 'Enter the relay address (the laptop running "npm run live-relay"), e.g. 192.168.1.20' };
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return { url: `${proto}//${location.host}/live`, http: `${location.protocol}//${location.host}/live` };
  }
  if (!/^wss?:\/\//i.test(s)) s = 'ws://' + s;
  let u: URL; try { u = new URL(s); } catch { return { error: 'That does not look like an address. Example: 192.168.1.20' }; }
  if (!u.port && u.protocol === 'ws:') u.port = String(DEFAULT_RELAY_PORT);
  if (u.protocol === 'ws:' && !isLanHost(u.hostname)) return { error: 'Unencrypted ws:// is only allowed to computers on your local network (192.168.x.x, 10.x.x.x, 172.16–31.x.x).' };
  const http = (u.protocol === 'wss:' ? 'https:' : 'http:') + '//' + u.host + u.pathname.replace(/\/$/, '');
  return { url: u.toString(), http };
}
