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

import { bytesToBase64, base64ToBytes } from './validation';

let cachedDek: CryptoKey | null = null;
const SESSION_DEK_STORAGE_KEY = 'secureauth_dek_session';

export async function setMemoryDek(dek: CryptoKey | null): Promise<void> {
  cachedDek = dek;
  if (!dek) {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.session) {
      await chrome.storage.session.remove([SESSION_DEK_STORAGE_KEY]).catch(() => {});
    } else if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(SESSION_DEK_STORAGE_KEY);
    }
    return;
  }

  try {
    const raw = await crypto.subtle.exportKey('raw', dek);
    const b64 = bytesToBase64(new Uint8Array(raw));
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.session) {
      await chrome.storage.session.set({ [SESSION_DEK_STORAGE_KEY]: b64 });
    } else if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(SESSION_DEK_STORAGE_KEY, b64);
    }
  } catch {}
}

export async function getMemoryDek(): Promise<CryptoKey | null> {
  if (cachedDek) return cachedDek;

  let b64: string | null = null;
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.session) {
    try {
      const res = await chrome.storage.session.get([SESSION_DEK_STORAGE_KEY]);
      const stored = res[SESSION_DEK_STORAGE_KEY];
      b64 = typeof stored === 'string' ? stored : null;
    } catch {}
  } else if (typeof sessionStorage !== 'undefined') {
    b64 = sessionStorage.getItem(SESSION_DEK_STORAGE_KEY);
  }

  if (b64) {
    try {
      const bytes = base64ToBytes(b64);
      cachedDek = await crypto.subtle.importKey(
        'raw',
        bytes as any,
        'AES-GCM',
        true,
        ['encrypt', 'decrypt']
      );
      return cachedDek;
    } catch {}
  }

  return null;
}

export async function unlockCloudVault(password: string): Promise<CryptoKey> {
  const envelope = await apiRequest('/api/v1/vault/envelope');
  const dek = await unwrapVaultKey(envelope, password);
  setMemoryDek(dek);
  return dek;
}

/**
 * Pushes the local vault up to the cloud, automatically handling conflicts by pulling and merging first.
 */
export async function pushCloudSync(dek?: CryptoKey): Promise<{ revision: number }> {
  const session = await getStoredSession();
  if (!session || !session.syncEnabled) {
    throw new Error('Cloud sync is not enabled');
  }

  const keyToUse = dek || (await getMemoryDek());
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

  try {
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
  } catch (err: any) {
    // If conflict detected, pull latest remote changes, merge them, and retry push
    if (err.status === 409 || (err.message && err.message.includes('Conflict detected'))) {
      await pullCloudSync(keyToUse);
      const updatedSession = await getStoredSession();
      const updatedAccounts = await getAllAccounts();
      const retryVaultData: ClientVaultData = {
        accounts: updatedAccounts,
        settings,
        exportedAt: Date.now(),
      };
      const retryPayload = await encryptClientVault(keyToUse, retryVaultData, session.user.email);

      const retryRes = await apiRequest('/api/v1/sync/push', {
        method: 'POST',
        body: JSON.stringify({
          baseRevision: updatedSession?.localRevision || 0,
          deviceId: session.deviceId,
          vault: retryPayload,
        }),
      });

      if (updatedSession) {
        updatedSession.localRevision = retryRes.revision;
        updatedSession.lastSyncedAt = Date.now();
        await saveStoredSession(updatedSession);
      }

      return { revision: retryRes.revision };
    }
    throw err;
  }
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
