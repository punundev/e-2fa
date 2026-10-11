import { EncryptedBackupEnvelope } from '../types';
import { base64ToBytes, bytesToBase64 } from './validation';

export const BACKUP_KDF_ITERATIONS = 600000;
export const VAULT_KDF_ITERATIONS = 100000;

export async function deriveKeyFromPassword(
  password: string,
  salt: Uint8Array,
  iterations: number
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as any,
      iterations,
      hash: 'SHA-256',
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptData(
  key: CryptoKey,
  plaintext: string,
  additionalData?: Uint8Array
): Promise<{ iv: Uint8Array; ciphertext: Uint8Array }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);

  const algorithm: AesGcmParams = {
    name: 'AES-GCM',
    iv,
  };

  if (additionalData) {
    algorithm.additionalData = additionalData as any;
  }

  const encrypted = await crypto.subtle.encrypt(algorithm, key, data);
  return {
    iv,
    ciphertext: new Uint8Array(encrypted),
  };
}

export async function decryptData(
  key: CryptoKey,
  iv: Uint8Array,
  ciphertext: Uint8Array,
  additionalData?: Uint8Array
): Promise<string> {
  const algorithm: AesGcmParams = {
    name: 'AES-GCM',
    iv: iv as any,
  };

  if (additionalData) {
    algorithm.additionalData = additionalData as any;
  }

  const decrypted = await crypto.subtle.decrypt(algorithm, key, ciphertext as any);
  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}

export async function createEncryptedBackup(
  payloadString: string,
  password: string,
  iterations = BACKUP_KDF_ITERATIONS
): Promise<EncryptedBackupEnvelope> {
  if (iterations < 600000) {
    throw new Error('KDF iterations must be at least 600,000');
  }

  const salt = crypto.getRandomValues(new Uint8Array(32));
  const key = await deriveKeyFromPassword(password, salt, iterations);

  const headerForAad = `secureauth-backup:v1:PBKDF2:SHA-256:${iterations}:${bytesToBase64(salt)}:AES-256-GCM`;
  const aad = new TextEncoder().encode(headerForAad);

  const { iv, ciphertext } = await encryptData(key, payloadString, aad);

  return {
    version: 1,
    format: 'secureauth-backup',
    kdf: 'PBKDF2',
    kdfHash: 'SHA-256',
    kdfIterations: iterations,
    salt: bytesToBase64(salt),
    cipher: 'AES-256-GCM',
    iv: bytesToBase64(iv),
    data: bytesToBase64(ciphertext),
  };
}

export async function restoreEncryptedBackup(
  envelope: EncryptedBackupEnvelope,
  password: string
): Promise<string> {
  if (envelope.version !== 1 || envelope.format !== 'secureauth-backup') {
    throw new Error('Unsupported backup version or format');
  }
  if (envelope.cipher !== 'AES-256-GCM') {
    throw new Error('Unsupported cipher');
  }
  if (envelope.kdf !== 'PBKDF2' || envelope.kdfHash !== 'SHA-256') {
    throw new Error('Unsupported KDF parameters');
  }

  const salt = base64ToBytes(envelope.salt);
  const iv = base64ToBytes(envelope.iv);
  const ciphertext = base64ToBytes(envelope.data);

  if (iv.length !== 12) {
    throw new Error('Invalid IV length for AES-GCM');
  }

  const key = await deriveKeyFromPassword(password, salt, envelope.kdfIterations);

  const headerForAad = `secureauth-backup:v1:PBKDF2:SHA-256:${envelope.kdfIterations}:${envelope.salt}:AES-256-GCM`;
  const aad = new TextEncoder().encode(headerForAad);

  try {
    return await decryptData(key, iv, ciphertext, aad);
  } catch (err) {
    throw new Error('Decryption failed: Incorrect password or tampered backup data');
  }
}
