// Revocation stub. Offline tokens can't be recalled without a server, so for now revocation is an
// embedded deny list of token ids (ship a new build to revoke). TODO: fetch a signed remote deny list
// (e.g. https://sanctum.app/revoked.json signed with the license key) at launch when online, cache it.
export const REVOKED_IDS: string[] = [
  // 'token-id-hex',   // add ids from licensing-keys/issued.jsonl to revoke them in the next build
];
let remote: string[] = [];
export function setRemoteRevocations(ids: string[]) { remote = ids; }
export const isRevoked = (id: string) => REVOKED_IDS.includes(id) || remote.includes(id);
