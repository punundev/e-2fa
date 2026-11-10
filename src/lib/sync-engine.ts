import { apiRequest, getStoredSession, saveStoredSession } from './api-client';
import {
  generateVaultKey,
  wrapVaultKey,
  unwrapVaultKey,
  encryptClientVault,
  decryptClientVault,
  ClientVaultData,
} from './cloud-crypto';
import { getAllAccounts, getSettings, saveAccounts } from './database';
import { AuthenticatorAccount } from '../types';

export {
  generateVaultKey,
  wrapVaultKey,
  unwrapVaultKey,
  encryptClientVault,
  decryptClientVault,
};

let cachedDek: CryptoKey | null = null;

export function setMemoryDek(dek: CryptoKey | null): void {
  cachedDek = dek;
}

export function getMemoryDek(): CryptoKey | null {
  return cachedDek;
}

export async function unlockCloudVault(password: string): Promise<CryptoKey> {
  const envelope = await apiRequest('/api/v1/vault/envelope');
  const dek = await unwrapVaultKey(envelope, password);
  setMemoryDek(dek);
  return dek;
}

/**
 * Pushes the local vault up to the cloud.
 */
export async function pushCloudSync(dek?: CryptoKey): Promise<{ revision: number }> {
  const session = await getStoredSession();
  if (!session || !session.syncEnabled) {
    throw new Error('Cloud sync is not enabled');
  }

  const keyToUse = dek || cachedDek;
  if (!keyToUse) {
    throw new Error('Vault encryption key is locked. Please re-authenticate.');
  }

  const accounts = await getAllAccounts();
  const settings = await getSettings();

  const vaultData: ClientVaultData = {
    accounts,
    settings,
    exportedAt: Date.now(),
  };

  const encryptedPayload = await encryptClientVault(keyToUse, vaultData, session.user.email);

  const res = await apiRequest('/api/v1/sync/push', {
    method: 'POST',
    body: JSON.stringify({
      baseRevision: session.localRevision || 0,
      deviceId: session.deviceId,
      vault: encryptedPayload,
    }),
  });

  session.localRevision = res.revision;
  session.lastSyncedAt = Date.now();
  await saveStoredSession(session);

  return { revision: res.revision };
}

/**
 * Merges two account lists intelligently using id and updated timestamps.
 */
export function mergeAccounts(
  localAccounts: AuthenticatorAccount[],
  remoteAccounts: AuthenticatorAccount[]
): AuthenticatorAccount[] {
  const map = new Map<string, AuthenticatorAccount>();

  for (const acc of localAccounts) {
    map.set(acc.id, acc);
  }

  for (const remote of remoteAccounts) {
    const existing = map.get(remote.id);
    if (!existing) {
      map.set(remote.id, remote);
    } else {
      if (remote.updatedAt > existing.updatedAt) {
        map.set(remote.id, remote);
      }
    }
  }

  return Array.from(map.values());
}

/**
 * Pulls down latest remote vault and merges or updates local database.
 */
export async function pullCloudSync(dek?: CryptoKey): Promise<{ revision: number; itemsMerged: number }> {
  const session = await getStoredSession();
  if (!session || !session.syncEnabled) {
    throw new Error('Cloud sync is not enabled');
  }

  const keyToUse = dek || cachedDek;
  if (!keyToUse) {
    throw new Error('Vault encryption key is locked. Please re-authenticate.');
  }

  const pullRes = await apiRequest('/api/v1/sync/pull');
  if (!pullRes.vault) {
    return { revision: 0, itemsMerged: 0 };
  }

  const decryptedVault = await decryptClientVault(keyToUse, pullRes.vault, session.user.email);
  const localAccounts = await getAllAccounts();

  const merged = mergeAccounts(localAccounts, decryptedVault.accounts);
  await saveAccounts(merged);

  session.localRevision = pullRes.revision;
  session.lastSyncedAt = Date.now();
  await saveStoredSession(session);

  return { revision: pullRes.revision, itemsMerged: merged.length };
}
