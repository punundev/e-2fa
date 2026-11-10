import { describe, it, expect } from 'vitest';
import {
  generateVaultKey,
  wrapVaultKey,
  unwrapVaultKey,
  encryptClientVault,
  decryptClientVault,
  generateRecoveryKey,
  ClientVaultData,
} from '../src/lib/cloud-crypto';
import { AuthenticatorAccount } from '../src/types';

describe('Cloud Zero-Knowledge Cryptography Module', () => {
  const dummyAccount: AuthenticatorAccount = {
    id: 'acc-1',
    issuer: 'GitHub',
    name: 'test@github.com',
    secret: 'JBSWY3DPEHPK3PXP',
    type: 'totp',
    algorithm: 'SHA-1',
    digits: 6,
    period: 30,
    counter: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const sampleVault: ClientVaultData = {
    accounts: [dummyAccount],
    settings: { theme: 'dark' },
    exportedAt: Date.now(),
  };

  const userEmail = 'alice@example.com';
  const userPassword = 'CorrectHorseBatteryStaple123!';

  it('generates a key, wraps it, and unwraps it with correct password', async () => {
    const dek = await generateVaultKey();
    const envelope = await wrapVaultKey(dek, userPassword);

    expect(envelope.encryptedDek).toBeDefined();
    expect(envelope.wrappingIv).toBeDefined();
    expect(envelope.salt).toBeDefined();
    expect(envelope.kdf).toBe('PBKDF2-SHA256');

    const unwrappedDek = await unwrapVaultKey(envelope, userPassword);
    expect(unwrappedDek).toBeDefined();
  });

  it('fails to unwrap key with incorrect password', async () => {
    const dek = await generateVaultKey();
    const envelope = await wrapVaultKey(dek, userPassword);

    await expect(unwrapVaultKey(envelope, 'WrongPassword123!')).rejects.toThrow();
  });

  it('encrypts and decrypts client vault data with AAD verification', async () => {
    const dek = await generateVaultKey();
    const encryptedPayload = await encryptClientVault(dek, sampleVault, userEmail);

    expect(encryptedPayload.ciphertext).toBeDefined();
    expect(encryptedPayload.iv).toBeDefined();
    expect(encryptedPayload.itemCount).toBe(1);

    const decrypted = await decryptClientVault(dek, encryptedPayload, userEmail);
    expect(decrypted.accounts.length).toBe(1);
    expect(decrypted.accounts[0].issuer).toBe('GitHub');
    expect(decrypted.accounts[0].secret).toBe('JBSWY3DPEHPK3PXP');
  });

  it('fails decryption if user email in AAD does not match', async () => {
    const dek = await generateVaultKey();
    const encryptedPayload = await encryptClientVault(dek, sampleVault, userEmail);

    await expect(decryptClientVault(dek, encryptedPayload, 'attacker@example.com')).rejects.toThrow();
  });

  it('fails decryption if ciphertext is tampered with', async () => {
    const dek = await generateVaultKey();
    const encryptedPayload = await encryptClientVault(dek, sampleVault, userEmail);

    // Tamper with ciphertext
    const tamperedPayload = {
      ...encryptedPayload,
      ciphertext: encryptedPayload.ciphertext.slice(0, -4) + 'AAAA',
    };

    await expect(decryptClientVault(dek, tamperedPayload, userEmail)).rejects.toThrow();
  });

  it('generates high-entropy recovery keys in correct format', () => {
    const key1 = generateRecoveryKey();
    const key2 = generateRecoveryKey();

    expect(key1).not.toBe(key2);
    expect(key1.split('-').length).toBe(12);
  });
});

