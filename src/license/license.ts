// Launch-time license check: load stored token → re-verify signature/expiry/revocation/device every launch.
import { verifyToken, type VerifyResult, type LicensePayload } from './token';
import { getDeviceId, loadLicense, saveLicense, clearLicense, type StoredLicense } from './store';

export interface LicenseState { deviceId: string; stored: StoredLicense | null; result: VerifyResult | null }
export async function checkLicense(): Promise<LicenseState> {
  const deviceId = await getDeviceId();
  const stored = await loadLicense();
  if (!stored) return { deviceId, stored, result: null };
  // A stored license belongs to the device it was activated on.
  const result = await verifyToken(stored.token, deviceId);
  if (stored.deviceId !== deviceId && result.status === 'valid') return { deviceId, stored, result: { status: 'wrong-device', payload: result.payload } };
  return { deviceId, stored, result };
}
export async function activate(token: string, deviceId: string): Promise<VerifyResult> {
  const result = await verifyToken(token, deviceId);
  if (result.status === 'valid') await saveLicense({ token, deviceId, activatedAt: new Date().toISOString() });
  return result;
}
export { clearLicense };
export type { LicensePayload };
