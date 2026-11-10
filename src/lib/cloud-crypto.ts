import { base64ToBytes, bytesToBase64 } from './validation';
import { KeyEnvelope, EncryptedVaultPayload } from '../../shared/schemas';
import { AuthenticatorAccount, AppSettings } from '../types';

export const CLOUD_KDF_ITERATIONS = 200000;

export interface ClientVaultData {
  accounts: AuthenticatorAccount[];
  settings?: Partial<AppSettings>;
  exportedAt: number;
}

/**
 * Generates a high-entropy 256-bit random Vault Data Encryption Key (DEK).
 */
export async function generateVaultKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256,
    },
    true, // extractable for wrapping
    ['encrypt', 'decrypt']
  );
}

/**
 * Derives a 256-bit Key Encryption Key (KEK) from the user's password or recovery key using PBKDF2-SHA256.
 */
export async function deriveKeyEncryptionKey(
  passphrase: string,
  salt: Uint8Array,
  iterations = CLOUD_KDF_ITERATIONS
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
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
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['wrapKey', 'unwrapKey', 'encrypt', 'decrypt']
  );
}

/**
 * Wraps (encrypts) the vault DEK with the derived KEK using AES-256-GCM.
 */
export async function wrapVaultKey(
  dek: CryptoKey,
  passphrase: string,
  existingSalt?: Uint8Array
): Promise<KeyEnvelope> {
  const salt = existingSalt || crypto.getRandomValues(new Uint8Array(32));
  const kek = await deriveKeyEncryptionKey(passphrase, salt, CLOUD_KDF_ITERATIONS);
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const wrapped = await crypto.subtle.wrapKey(
    'raw',
    dek,
    kek,
    {
      name: 'AES-GCM',
      iv,
    }
  );

  return {
    encryptedDek: bytesToBase64(new Uint8Array(wrapped)),
    wrappingIv: bytesToBase64(iv),
    kdf: 'PBKDF2-SHA256',
    kdfIterations: CLOUD_KDF_ITERATIONS,
    salt: bytesToBase64(salt),
    keyVersion: 1,
    updatedAt: Date.now(),
  };
}

/**
 * Unwraps (decrypts) the vault DEK from a KeyEnvelope using the user's password.
 */
export async function unwrapVaultKey(
  envelope: KeyEnvelope,
  passphrase: string
): Promise<CryptoKey> {
  const salt = base64ToBytes(envelope.salt);
  const iv = base64ToBytes(envelope.wrappingIv);
  const wrappedDek = base64ToBytes(envelope.encryptedDek);

  const kek = await deriveKeyEncryptionKey(passphrase, salt, envelope.kdfIterations);

  const unwrapped = await crypto.subtle.unwrapKey(
    'raw',
    wrappedDek as any,
    kek,
    {
      name: 'AES-GCM',
      iv: iv as any,
    },
    {
      name: 'AES-GCM',
      length: 256,
    },
    true,
    ['encrypt', 'decrypt']
  );

  return unwrapped;
}

/**
 * Encrypts the client vault data using the DEK with AES-256-GCM and authenticated additional data.
 */
export async function encryptClientVault(
  dek: CryptoKey,
  vaultData: ClientVaultData,
  userEmail: string
): Promise<EncryptedVaultPayload> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();
  const plaintext = JSON.stringify(vaultData);
  const data = encoder.encode(plaintext);

  // Bind ciphertext to the user's email and version using AAD
  const aadString = `secureauth-vault:v1:${userEmail.toLowerCase().trim()}`;
  const aad = encoder.encode(aadString);

  const ciphertextBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
      additionalData: aad as any,
    },
    dek,
    data
  );

  return {
    version: 1,
    ciphertext: bytesToBase64(new Uint8Array(ciphertextBuffer)),
    iv: bytesToBase64(iv),
    aad: bytesToBase64(aad),
    itemCount: vaultData.accounts.length,
    updatedAt: Date.now(),
  };
}

/**
 * Decrypts the encrypted vault payload using the DEK and verifies authenticated additional data.
 */
export async function decryptClientVault(
  dek: CryptoKey,
  payload: EncryptedVaultPayload,
  userEmail: string
): Promise<ClientVaultData> {
  const iv = base64ToBytes(payload.iv);
  const ciphertext = base64ToBytes(payload.ciphertext);

  const expectedAadString = `secureauth-vault:v1:${userEmail.toLowerCase().trim()}`;
  const expectedAad = new TextEncoder().encode(expectedAadString);

  const decrypted = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv as any,
      additionalData: expectedAad as any,
    },
    dek,
    ciphertext as any
  );

  const decoder = new TextDecoder();
  const plaintext = decoder.decode(decrypted);
  return JSON.parse(plaintext) as ClientVaultData;
}

/**
 * Generates a cryptographically strong 24-word or 32-character recovery key
 */
export function generateRecoveryKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .match(/.{1,4}/g)!
    .join('-');
}

