import { AuthenticatorAccount, AppSettings, VaultState } from '../types';
import {
  deriveKeyFromPassword,
  encryptData,
  decryptData,
  VAULT_KDF_ITERATIONS,
} from './crypto';
import { base64ToBytes, bytesToBase64 } from './validation';

const DB_NAME = 'secureauth_db';
const DB_VERSION = 1;
const CANARY_PLAINTEXT = 'SECUREAUTH_VAULT_CANARY_V1';

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  mode: 'dark',
  accentColor: 'blue',
  designStyle: 'rounded',
  autoLockTimeout: 5,
  clipboardClearDelay: 30,
  confirmSecretReveal: true,
  confirmPlaintextExport: true,
  codeGrouping: 'grouped',
  defaultSort: 'alphabetical',
  defaultGroup: 'All',
};

let vaultSessionKey: CryptoKey | null = null;
let vaultLockTimeoutHandle: any = null;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('accounts')) {
        const store = db.createObjectStore('accounts', { keyPath: 'id' });
        store.createIndex('issuer', 'issuer', { unique: false });
        store.createIndex('name', 'name', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains('vault_meta')) {
        db.createObjectStore('vault_meta', { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getVaultState(): Promise<VaultState> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('vault_meta', 'readonly');
    const store = tx.objectStore('vault_meta');
    const req = store.get('master');

    req.onsuccess = () => {
      const meta = req.result;
      if (!meta) {
        resolve({
          isInitialized: false,
          isLocked: false,
          hasPassword: false,
        });
      } else {
        const isLocked = meta.hasPassword ? vaultSessionKey === null : false;
        resolve({
          isInitialized: true,
          isLocked,
          hasPassword: Boolean(meta.hasPassword),
        });
      }
    };
    req.onerror = () => reject(req.error);
  });
}

export async function setupVaultPassword(password: string): Promise<void> {
  const db = await openDb();
  const salt = crypto.getRandomValues(new Uint8Array(32));
  const key = await deriveKeyFromPassword(password, salt, VAULT_KDF_ITERATIONS);

  const { iv, ciphertext } = await encryptData(key, CANARY_PLAINTEXT);

  const meta = {
    id: 'master',
    hasPassword: true,
    salt: bytesToBase64(salt),
    iterations: VAULT_KDF_ITERATIONS,
    canaryIv: bytesToBase64(iv),
    canaryData: bytesToBase64(ciphertext),
    updatedAt: Date.now(),
  };

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('vault_meta', 'readwrite');
    const store = tx.objectStore('vault_meta');
    const req = store.put(meta);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  vaultSessionKey = key;
}

export async function initializeWithoutPassword(): Promise<void> {
  const db = await openDb();
  const meta = {
    id: 'master',
    hasPassword: false,
    updatedAt: Date.now(),
  };

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('vault_meta', 'readwrite');
    const store = tx.objectStore('vault_meta');
    const req = store.put(meta);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function unlockVault(password: string): Promise<boolean> {
  const db = await openDb();
  const meta: any = await new Promise((resolve, reject) => {
    const tx = db.transaction('vault_meta', 'readonly');
    const store = tx.objectStore('vault_meta');
    const req = store.get('master');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  if (!meta || !meta.hasPassword) {
    return true;
  }

  const salt = base64ToBytes(meta.salt);
  const iv = base64ToBytes(meta.canaryIv);
  const ciphertext = base64ToBytes(meta.canaryData);

  const key = await deriveKeyFromPassword(password, salt, meta.iterations || VAULT_KDF_ITERATIONS);

  try {
    const decrypted = await decryptData(key, iv, ciphertext);
    if (decrypted === CANARY_PLAINTEXT) {
      vaultSessionKey = key;
      return true;
    }
  } catch {
    return false;
  }

  return false;
}

export function lockVault(): void {
  vaultSessionKey = null;
  if (vaultLockTimeoutHandle) {
    clearTimeout(vaultLockTimeoutHandle);
    vaultLockTimeoutHandle = null;
  }
}

export function touchVaultActivity(timeoutMinutes: number): void {
  if (vaultLockTimeoutHandle) {
    clearTimeout(vaultLockTimeoutHandle);
    vaultLockTimeoutHandle = null;
  }
  if (timeoutMinutes > 0 && vaultSessionKey !== null) {
    vaultLockTimeoutHandle = setTimeout(() => {
      lockVault();
    }, timeoutMinutes * 60 * 1000);
  }
}

interface StoredAccountRecord extends Omit<AuthenticatorAccount, 'secret'> {
  secret: string;
  isEncrypted?: boolean;
  secretIv?: string;
}

async function prepareAccountForStorage(account: AuthenticatorAccount): Promise<StoredAccountRecord> {
  if (!vaultSessionKey) {
    return {
      ...account,
      isEncrypted: false,
    };
  }

  const { iv, ciphertext } = await encryptData(vaultSessionKey, account.secret);
  return {
    ...account,
    secret: bytesToBase64(ciphertext),
    secretIv: bytesToBase64(iv),
    isEncrypted: true,
  };
}

async function decryptAccountFromStorage(record: StoredAccountRecord): Promise<AuthenticatorAccount> {
  if (!record.isEncrypted || !record.secretIv) {
    return record as AuthenticatorAccount;
  }

  if (!vaultSessionKey) {
    throw new Error('Vault is locked');
  }

  const iv = base64ToBytes(record.secretIv);
  const ciphertext = base64ToBytes(record.secret);
  const plainSecret = await decryptData(vaultSessionKey, iv, ciphertext);

  return {
    ...record,
    secret: plainSecret,
  };
}

export async function getAllAccounts(): Promise<AuthenticatorAccount[]> {
  const db = await openDb();
  const records: StoredAccountRecord[] = await new Promise((resolve, reject) => {
    const tx = db.transaction('accounts', 'readonly');
    const store = tx.objectStore('accounts');
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });

  const decryptedList: AuthenticatorAccount[] = [];
  for (const record of records) {
    const decrypted = await decryptAccountFromStorage(record);
    decryptedList.push(decrypted);
  }

  return decryptedList;
}

export async function saveAccount(account: AuthenticatorAccount): Promise<void> {
  const db = await openDb();
  const record = await prepareAccountForStorage(account);

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('accounts', 'readwrite');
    const store = tx.objectStore('accounts');
    const req = store.put(record);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function saveAccounts(accounts: AuthenticatorAccount[]): Promise<void> {
  const db = await openDb();
  const records: StoredAccountRecord[] = [];
  for (const acc of accounts) {
    const record = await prepareAccountForStorage(acc);
    records.push(record);
  }

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('accounts', 'readwrite');
    const store = tx.objectStore('accounts');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    for (const record of records) {
      store.put(record);
    }
  });
}

export async function deleteAccount(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('accounts', 'readwrite');
    const store = tx.objectStore('accounts');
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function incrementHotpCounter(id: string): Promise<number> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('accounts', 'readwrite');
    const store = tx.objectStore('accounts');
    const req = store.get(id);

    req.onsuccess = async () => {
      const record: StoredAccountRecord = req.result;
      if (!record) {
        reject(new Error('Account not found'));
        return;
      }
      record.counter = (record.counter || 0) + 1;
      record.updatedAt = Date.now();
      const putReq = store.put(record);
      putReq.onsuccess = () => resolve(record.counter);
      putReq.onerror = () => reject(putReq.error);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getSettings(): Promise<AppSettings> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('settings', 'readonly');
    const store = tx.objectStore('settings');
    const req = store.get('app_settings');

    req.onsuccess = () => {
      resolve({ ...DEFAULT_SETTINGS, ...(req.result?.value || {}) });
    };
    req.onerror = () => reject(req.error);
  });
}

export async function saveSettings(settings: Partial<AppSettings>): Promise<AppSettings> {
  const db = await openDb();
  const current = await getSettings();
  const updated = { ...current, ...settings };

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('settings', 'readwrite');
    const store = tx.objectStore('settings');
    const req = store.put({ key: 'app_settings', value: updated });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  return updated;
}

export async function clearAllData(): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(['accounts', 'settings', 'vault_meta'], 'readwrite');
    tx.objectStore('accounts').clear();
    tx.objectStore('settings').clear();
    tx.objectStore('vault_meta').clear();
    tx.oncomplete = () => {
      vaultSessionKey = null;
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}
