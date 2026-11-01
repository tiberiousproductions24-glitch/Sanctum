// License providers. Path A (invite/admin codes) works offline today. Path B (store purchase) is a
// scaffold only — NOT WIRED. Real purchases must be validated server-side: the app sends the Play/App
// Store receipt to a receipt-validation backend, which checks it with Google/Apple and returns a signed
// Sanctum token (type "purchase"). That backend is not built yet.
import { verifyToken, type VerifyResult } from './token';

export interface Product { id: string; title: string; price: string; period: 'month' | 'year'; description: string }
export interface LicenseProvider {
  readonly id: string;
  readonly label: string;
  available(): Promise<boolean>;
  /** Returns a signed Sanctum token on success. */
  activate(input: string, deviceId: string): Promise<{ token: string; result: VerifyResult }>;
}

export class CodeProvider implements LicenseProvider {
  readonly id = 'code'; readonly label = 'Invite or admin code';
  async available() { return true; }
  async activate(input: string, deviceId: string) { const { extractCode } = await import('./token'); const token = extractCode(input); return { token, result: await verifyToken(token, deviceId) }; }
}

/** Stub for Google Play Billing / StoreKit 2 (planned: RevenueCat or cordova-plugin-purchase). NOT WIRED. */
export class StorePurchaseProvider implements LicenseProvider {
  readonly id = 'store'; readonly label = 'Subscription (Google Play / App Store)';
  static readonly WIRED = false;
  static readonly PRODUCTS: Product[] = [
    { id: 'sanctum.monthly', title: 'Sanctum Monthly', price: 'Price TBD', period: 'month', description: 'All banks, sync & updates' },
    { id: 'sanctum.annual', title: 'Sanctum Annual', price: 'Price TBD', period: 'year', description: 'All banks, sync & updates' },
  ];
  async available() { return StorePurchaseProvider.WIRED; }
  async products(): Promise<Product[]> { return StorePurchaseProvider.PRODUCTS; }
  async activate(_productId: string, _deviceId: string): Promise<never> {
    // TODO: 1) store SDK purchase → receipt/purchaseToken  2) POST to receipt-validation backend
    // 3) backend verifies with Google Play Developer API / App Store Server API and returns a signed token.
    throw new Error('Store purchases aren\'t connected yet.');
  }
  async restore(): Promise<never> { throw new Error('Restore isn\'t connected yet.'); }
}
