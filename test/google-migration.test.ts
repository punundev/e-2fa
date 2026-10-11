import { describe, it, expect } from 'vitest';
import {
  isGoogleMigrationUri,
  parseGoogleMigrationUri,
  exportGoogleMigrationUris,
} from '../src/lib/google-migration';
import { AuthenticatorAccount } from '../src/types';

describe('Google Authenticator Migration Protobuf', () => {
  const sampleAccounts: AuthenticatorAccount[] = [
    {
      id: 'acc-1',
      issuer: 'Google',
      name: 'user@gmail.com',
      secret: 'JBSWY3DPEHPK3PXP',
      type: 'totp',
      algorithm: 'SHA-1',
      digits: 6,
      period: 30,
      counter: 0,
      createdAt: 1000,
      updatedAt: 1000,
    },
    {
      id: 'acc-2',
      issuer: 'GitHub',
      name: 'octocat',
      secret: 'KRUGS4ZANFZSAYJA',
      type: 'totp',
      algorithm: 'SHA-256',
      digits: 8,
      period: 30,
      counter: 0,
      createdAt: 2000,
      updatedAt: 2000,
    },
    {
      id: 'acc-3',
      issuer: 'YubiKey',
      name: 'hardware-token',
      secret: 'GEZDGNBVGY3TQOJQ',
      type: 'hotp',
      algorithm: 'SHA-1',
      digits: 6,
      period: 30,
      counter: 15,
      createdAt: 3000,
      updatedAt: 3000,
    },
  ];

  it('correctly detects migration URIs', () => {
    expect(isGoogleMigrationUri('otpauth-migration://offline?data=CjEKC...')).toBe(true);
    expect(isGoogleMigrationUri('otpauth://totp/Test?secret=ABC')).toBe(false);
  });

  it('performs lossless roundtrip encoding and decoding', () => {
    const uris = exportGoogleMigrationUris(sampleAccounts, 10);
    expect(uris).toHaveLength(1);
    expect(uris[0]).toMatch(/^otpauth-migration:\/\/offline\?data=/);

    const parsedBatch = parseGoogleMigrationUri(uris[0]);
    expect(parsedBatch.accounts).toHaveLength(3);

    // Account 1
    const acc1 = parsedBatch.accounts[0];
    expect(acc1.issuer).toBe('Google');
    expect(acc1.name).toBe('user@gmail.com');
    expect(acc1.secret).toBe('JBSWY3DPEHPK3PXP');
    expect(acc1.type).toBe('totp');
    expect(acc1.algorithm).toBe('SHA-1');
    expect(acc1.digits).toBe(6);

    // Account 2
    const acc2 = parsedBatch.accounts[1];
    expect(acc2.issuer).toBe('GitHub');
    expect(acc2.name).toBe('octocat');
    expect(acc2.secret).toBe('KRUGS4ZANFZSAYJA');
    expect(acc2.type).toBe('totp');
    expect(acc2.algorithm).toBe('SHA-256');
    expect(acc2.digits).toBe(8);

    // Account 3 (HOTP)
    const acc3 = parsedBatch.accounts[2];
    expect(acc3.issuer).toBe('YubiKey');
    expect(acc3.name).toBe('hardware-token');
    expect(acc3.secret).toBe('GEZDGNBVGY3TQOJQ');
    expect(acc3.type).toBe('hotp');
    expect(acc3.counter).toBe(15);
  });

  it('splits large account lists into multiple batches', () => {
    const manyAccounts: AuthenticatorAccount[] = Array.from({ length: 25 }, (_, i) => ({
      id: `acc-${i}`,
      issuer: `Service${i}`,
      name: `user${i}`,
      secret: 'JBSWY3DPEHPK3PXP',
      type: 'totp',
      algorithm: 'SHA-1',
      digits: 6,
      period: 30,
      counter: 0,
      createdAt: 1000,
      updatedAt: 1000,
    }));

    const uris = exportGoogleMigrationUris(manyAccounts, 10);
    expect(uris).toHaveLength(3); // 10, 10, 5

    const batch0 = parseGoogleMigrationUri(uris[0]);
    expect(batch0.batchSize).toBe(3);
    expect(batch0.batchIndex).toBe(0);
    expect(batch0.accounts).toHaveLength(10);

    const batch2 = parseGoogleMigrationUri(uris[2]);
    expect(batch2.batchSize).toBe(3);
    expect(batch2.batchIndex).toBe(2);
    expect(batch2.accounts).toHaveLength(5);
  });

  it('throws descriptive error on malformed migration data', () => {
    expect(() =>
      parseGoogleMigrationUri('otpauth-migration://offline?data=INVALID_BASE64_!!!')
    ).toThrow();
  });
});
