import { describe, it, expect } from 'vitest';
import {
  createEncryptedBackup,
  restoreEncryptedBackup,
  BACKUP_KDF_ITERATIONS,
} from '../src/lib/crypto';

describe('AES-256-GCM and PBKDF2 Backup Encryption', () => {
  const samplePayload = JSON.stringify({
    version: 1,
    accounts: [
      {
        issuer: 'Google',
        name: 'test@gmail.com',
        secret: 'JBSWY3DPEHPK3PXP',
      },
    ],
  });
  const password = 'CorrectHorseBatteryStaple123!';

  it('creates and restores encrypted backup with correct password', async () => {
    const envelope = await createEncryptedBackup(samplePayload, password, BACKUP_KDF_ITERATIONS);

    expect(envelope.version).toBe(1);
    expect(envelope.format).toBe('secureauth-backup');
    expect(envelope.cipher).toBe('AES-256-GCM');
    expect(envelope.kdf).toBe('PBKDF2');
    expect(envelope.kdfIterations).toBe(600000);
    expect(envelope.salt).toBeTruthy();
    expect(envelope.iv).toBeTruthy();
    expect(envelope.data).toBeTruthy();

    const restoredJson = await restoreEncryptedBackup(envelope, password);
    expect(restoredJson).toBe(samplePayload);
  });

  it('fails decryption when wrong password is supplied', async () => {
    const envelope = await createEncryptedBackup(samplePayload, password, BACKUP_KDF_ITERATIONS);

    await expect(
      restoreEncryptedBackup(envelope, 'WrongPassword456!')
    ).rejects.toThrow('Decryption failed');
  });

  it('fails decryption when ciphertext is tampered with', async () => {
    const envelope = await createEncryptedBackup(samplePayload, password, BACKUP_KDF_ITERATIONS);

    // Tamper with data
    const tamperedEnvelope = {
      ...envelope,
      data: envelope.data.slice(0, -4) + 'AAAA',
    };

    await expect(
      restoreEncryptedBackup(tamperedEnvelope, password)
    ).rejects.toThrow('Decryption failed');
  });

  it('fails decryption when authenticated header metadata is tampered with', async () => {
    const envelope = await createEncryptedBackup(samplePayload, password, BACKUP_KDF_ITERATIONS);

    // Tamper with salt
    const tamperedSalt = {
      ...envelope,
      salt: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
    };

    await expect(
      restoreEncryptedBackup(tamperedSalt, password)
    ).rejects.toThrow('Decryption failed');
  });
});
