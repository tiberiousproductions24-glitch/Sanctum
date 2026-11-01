// License persistence. Native (Android/iOS): @aparajita/capacitor-secure-storage — Android Keystore-
// encrypted storage / iOS Keychain. Web: IndexedDB (LESS SECURE — readable by anyone with the browser profile).
// Only the signed token is stored; the app never trusts a stored "unlocked" flag and re-verifies every launch.
import { Capacitor } from '@capacitor/core';

export interface StoredLicense { token: string; deviceId: string; activatedAt: string }
export const isNative = () => Capacitor.isNativePlatform();
export const storageKind = () => (isNative() ? (Capacitor.getPlatform() === 'ios' ? 'iOS Keychain' : 'Android Keystore (encrypted)') : 'IndexedDB (web — less secure)');

interface KV { get(k: string): Promise<string | null>; set(k: string, v: string): Promise<void>; del(k: string): Promise<void> }

const idb = (): KV => {
  const open = () => new Promise<IDBDatabase>((res, rej) => { const r = indexedDB.open('sanctum-license', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const tx = async <T>(mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest): Promise<T> => { const db = await open(); return new Promise((res, rej) => { const q = f(db.transaction('kv', mode).objectStore('kv')); q.onsuccess = () => res(q.result as T); q.onerror = () => rej(q.error); }); };
  return { get: async (k) => (await tx<string | undefined>('readonly', (s) => s.get(k))) ?? null, set: async (k, v) => { await tx('readwrite', (s) => s.put(v, k)); }, del: async (k) => { await tx('readwrite', (s) => s.delete(k)); } };
};
let kvP: Promise<KV> | null = null;
const kv = () => (kvP ??= (async () => {
  if (!isNative()) return idb();
  const { SecureStorage } = await import('@aparajita/capacitor-secure-storage');
  await SecureStorage.setKeyPrefix('sanctum_');
  return { get: (k) => SecureStorage.getItem(k), set: (k, v) => SecureStorage.setItem(k, v), del: (k) => SecureStorage.removeItem(k) } as KV;
})());

function newDeviceId() {
  const b = crypto.getRandomValues(new Uint8Array(8));
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('').toUpperCase();
  return h.match(/..../g)!.join('-');
}
/** Random per-install device id kept in secure storage (a reinstall gets a new id). */
export async function getDeviceId(): Promise<string> {
  const s = await kv(); let id = await s.get('deviceId');
  if (!id) { id = newDeviceId(); await s.set('deviceId', id); }
  return id;
}
export async function loadLicense(): Promise<StoredLicense | null> {
  try { const raw = await (await kv()).get('license'); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
export async function saveLicense(l: StoredLicense) { await (await kv()).set('license', JSON.stringify(l)); }
export async function clearLicense() { await (await kv()).del('license'); }
