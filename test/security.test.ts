// Security & Cryptography Regression Test Suite
import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../server/src/app';
import {
  generateVaultKey,
  encryptClientVault,
  decryptClientVault,
  ClientVaultData,
} from '../src/lib/cloud-crypto';

// Setup Mock in-memory DB for security boundaries test
vi.mock('../server/src/database', () => {
  const users: any[] = [];
  const vaults: any[] = [];
  const envelopes: any[] = [];
  const devices: any[] = [];
  const refreshTokens: any[] = [];

  return {
    query: vi.fn(async (text: string, params: any[] = []) => {
      if (text.includes('INSERT INTO refresh_tokens')) {
        refreshTokens.push({
          user_id: params[0],
          device_id: params[1],
          token_hash: params[2],
          expires_at: params[3],
          revoked_at: null,
        });
        return [];
      }
      return [];
    }),
    queryOne: vi.fn(async (text: string, params: any[] = []) => {
      if (text.includes('SELECT id FROM users WHERE email = $1')) {
        return users.find((u) => u.email === params[0]) || null;
      }
      if (text.includes('SELECT id, email, password_hash, created_at FROM users WHERE email = $1')) {
        return users.find((u) => u.email === params[0]) || null;
      }
      if (text.includes('FROM vault_key_envelopes WHERE user_id = $1')) {
        return envelopes.find((e) => e.user_id === params[0]) || null;
      }
      if (text.includes('FROM vaults WHERE user_id = $1')) {
        return vaults.find((v) => v.user_id === params[0]) || null;
      }
      return null;
    }),
    withTransaction: vi.fn(async (cb: any) => {
      const client = {
        query: vi.fn(async (text: string, params: any[] = []) => {
          if (text.includes('INSERT INTO users')) {
            const user = {
              id: `user-${users.length + 1}`,
              email: params[0],
              password_hash: params[1],
              is_verified: true,
              created_at: new Date().toISOString(),
            };
            users.push(user);
            return { rows: [user] };
          }
          if (text.includes('INSERT INTO devices')) {
            const dev = {
              id: `dev-${devices.length + 1}`,
              user_id: params[0],
              device_name: params[1],
              device_type: 'chrome-extension',
            };
            devices.push(dev);
            return { rows: [dev] };
          }
          if (text.includes('INSERT INTO vaults')) {
            vaults.push({
              user_id: params[0],
              revision: params[1],
              payload_version: params[2],
              ciphertext: params[3],
              iv: params[4],
              aad: params[5],
              item_count: params[6],
              updated_at: new Date().toISOString(),
            });
            return { rows: [] };
          }
          if (text.includes('INSERT INTO vault_key_envelopes')) {
            envelopes.push({
              user_id: params[0],
              encrypted_dek: params[1],
              wrapping_iv: params[2],
              kdf: params[3],
              kdf_iterations: params[4],
              salt: params[5],
              key_version: params[6],
              updated_at: new Date().toISOString(),
            });
            return { rows: [] };
          }
          return { rows: [] };
        }),
      };
      return cb(client);
    }),
  };
});

describe('Security & Threat Model Audit Suite', () => {
  const app = createApp();

  it('verifies that ciphertext tampering causes immediate cryptographic rejection', async () => {
    const dek = await generateVaultKey();
    const vault: ClientVaultData = {
      accounts: [
        {
          id: 'test-1',
          issuer: 'SecretCompany',
          name: 'admin@secret.com',
          secret: 'JBSWY3DPEHPK3PXP',
          type: 'totp',
          algorithm: 'SHA-1',
          digits: 6,
          period: 30,
          counter: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
      exportedAt: Date.now(),
    };

    const encrypted = await encryptClientVault(dek, vault, 'test@example.com');

    // Flip bits in the base64 ciphertext
    const tampered = {
      ...encrypted,
      ciphertext: 'B' + encrypted.ciphertext.substring(1),
    };

    await expect(decryptClientVault(dek, tampered, 'test@example.com')).rejects.toThrow();
  });

  it('verifies that cross-tenant email forgery in AAD is rejected', async () => {
    const dek = await generateVaultKey();
    const vault: ClientVaultData = {
      accounts: [],
      exportedAt: Date.now(),
    };

    const encrypted = await encryptClientVault(dek, vault, 'victim@example.com');
    // Attacker tries to decrypt with their own context/email
    await expect(decryptClientVault(dek, encrypted, 'attacker@example.com')).rejects.toThrow();
  });

  it('enforces multi-tenant user isolation: User A cannot pull User B data', async () => {
    // 1. Register User A
    const resA = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'userA@example.com', password: 'PasswordA123!' });
    const tokenA = resA.body.tokens.accessToken;

    // 2. Register User B
    const resB = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'userB@example.com', password: 'PasswordB123!' });
    const tokenB = resB.body.tokens.accessToken;

    // User A pushes data
    await request(app)
      .post('/api/v1/sync/push')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        baseRevision: 0,
        vault: {
          version: 1,
          ciphertext: 'VXNlckEtQ2lwaGVy',
          iv: 'VGVzdElWMTI=',
          itemCount: 1,
          updatedAt: Date.now(),
        },
      });

    // User B pulls: should NOT see User A's vault
    const pullB = await request(app)
      .get('/api/v1/sync/pull')
      .set('Authorization', `Bearer ${tokenB}`);

    expect(pullB.status).toBe(200);
    expect(pullB.body.vault).toBeNull();
  });

  it('rejects expired, forged, or malformed JWT tokens', async () => {
    const badTokens = [
      'Bearer invalid-token-string',
      'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.fake',
      '',
      'Basic 123456',
    ];

    for (const header of badTokens) {
      const res = await request(app)
        .get('/api/v1/vault')
        .set('Authorization', header);
      expect(res.status).toBe(401);
    }
  });

  it('rejects oversized vault payloads exceeding request limits', async () => {
    const resA = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'large@example.com', password: 'PasswordA123!' });
    const token = resA.body.tokens.accessToken;

    // Try sending a 6MB payload (limit is 5MB)
    const largeCipher = 'A'.repeat(6 * 1024 * 1024);
    const res = await request(app)
      .post('/api/v1/sync/push')
      .set('Authorization', `Bearer ${token}`)
      .send({
        baseRevision: 0,
        vault: {
          version: 1,
          ciphertext: largeCipher,
          iv: 'VGVzdElWMTI=',
          itemCount: 1,
          updatedAt: Date.now(),
        },
      });

    expect(res.status).toBe(413); // Payload Too Large
  });
});
