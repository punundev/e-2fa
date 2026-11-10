import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../server/src/app';

// Mock database module
vi.mock('../server/src/database', () => {
  const usersTable: any[] = [];
  const vaultsTable: any[] = [];
  const envelopesTable: any[] = [];
  const devicesTable: any[] = [];
  const refreshTokensTable: any[] = [];
  const syncHistoryTable: any[] = [];

  return {
    query: vi.fn(async (text: string, params: any[] = []) => {
      if (text.includes('INSERT INTO refresh_tokens')) {
        refreshTokensTable.push({
          user_id: params[0],
          device_id: params[1],
          token_hash: params[2],
          expires_at: params[3],
          revoked_at: null,
        });
        return [];
      }
      if (text.includes('UPDATE refresh_tokens SET revoked_at')) {
        for (const rt of refreshTokensTable) {
          if (rt.token_hash === params[0] || rt.user_id === params[0]) {
            rt.revoked_at = new Date();
          }
        }
        return [];
      }
      if (text.includes('SELECT id, device_name')) {
        return devicesTable.filter((d) => d.user_id === params[0] && !d.revoked_at);
      }
      if (text.includes('UPDATE devices SET revoked_at')) {
        const dev = devicesTable.find((d) => d.id === params[0] && d.user_id === params[1]);
        if (dev) {
          dev.revoked_at = new Date();
          return [{ id: dev.id }];
        }
        return [];
      }
      if (text.includes('DELETE FROM users')) {
        const idx = usersTable.findIndex((u) => u.id === params[0]);
        if (idx !== -1) usersTable.splice(idx, 1);
        return [];
      }
      return [];
    }),
    queryOne: vi.fn(async (text: string, params: any[] = []) => {
      if (text.includes('SELECT id FROM users WHERE email = $1')) {
        return usersTable.find((u) => u.email === params[0]) || null;
      }
      if (text.includes('SELECT id, email, password_hash, created_at FROM users WHERE email = $1')) {
        return usersTable.find((u) => u.email === params[0]) || null;
      }
      if (text.includes('SELECT password_hash FROM users WHERE id = $1')) {
        return usersTable.find((u) => u.id === params[0]) || null;
      }
      if (text.includes('SELECT id, revoked_at FROM devices WHERE id = $1 AND user_id = $2')) {
        return devicesTable.find((d) => d.id === params[0] && d.user_id === params[1]) || null;
      }
      if (text.includes('FROM vault_key_envelopes')) {
        return envelopesTable.find((e) => e.user_id === params[0]) || null;
      }
      if (text.includes('FROM vaults')) {
        return vaultsTable.find((v) => v.user_id === params[0]) || null;
      }
      return null;
    }),
    withTransaction: vi.fn(async (callback: any) => {
      const client = {
        query: vi.fn(async (text: string, params: any[] = []) => {
          if (text.includes('INSERT INTO users')) {
            const user = {
              id: 'user-uuid-1',
              email: params[0],
              password_hash: params[1],
              is_verified: true,
              created_at: new Date().toISOString(),
            };
            usersTable.push(user);
            return { rows: [user] };
          }
          if (text.includes('INSERT INTO devices')) {
            const dev = {
              id: 'device-uuid-1',
              user_id: params[0],
              device_name: params[1],
              device_type: 'chrome-extension',
              last_seen_at: new Date().toISOString(),
              created_at: new Date().toISOString(),
              revoked_at: null,
            };
            devicesTable.push(dev);
            return { rows: [dev] };
          }
          if (text.includes('INSERT INTO vault_key_envelopes')) {
            envelopesTable.push({
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
          if (text.includes('INSERT INTO vaults')) {
            vaultsTable.push({
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
          if (text.includes('SELECT revision FROM sync_history')) {
            return { rows: [] };
          }
          if (text.includes('SELECT revision, payload_version')) {
            const v = vaultsTable.find((x) => x.user_id === params[0]);
            return { rows: v ? [v] : [] };
          }
          if (text.includes('UPDATE vaults')) {
            const v = vaultsTable.find((x) => x.user_id === params[6]);
            if (v) {
              v.revision = params[0];
              v.payload_version = params[1];
              v.ciphertext = params[2];
              v.iv = params[3];
              v.aad = params[4];
              v.item_count = params[5];
              v.updated_at = new Date().toISOString();
            }
            return { rows: [] };
          }
          if (text.includes('INSERT INTO sync_history')) {
            syncHistoryTable.push({
              user_id: params[0],
              device_id: params[1],
              revision: params[2],
              idempotency_key: params[3],
            });
            return { rows: [] };
          }
          return { rows: [] };
        }),
      };
      return callback(client);
    }),
  };
});

describe('Backend API Integration Tests', () => {
  const app = createApp();
  let authTokens: any = null;

  it('GET /api/health returns ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('secureauth-api');
  });

  it('rejects unauthorized requests to protected endpoints', async () => {
    const res = await request(app).get('/api/v1/vault');
    expect(res.status).toBe(401);
  });

  it('registers a new user and returns tokens', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'bob@example.com',
        password: 'SuperSecretPassword123!',
        deviceName: 'Work Laptop',
      });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('bob@example.com');
    expect(res.body.tokens.accessToken).toBeDefined();
    authTokens = res.body.tokens;
  });

  it('logs in an existing user with correct credentials', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'bob@example.com',
        password: 'SuperSecretPassword123!',
      });

    expect(res.status).toBe(200);
    expect(res.body.tokens.accessToken).toBeDefined();
    authTokens = res.body.tokens;
  });

  it('rejects login with invalid credentials', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'bob@example.com',
        password: 'WrongPassword!',
      });

    expect(res.status).toBe(401);
  });

  it('allows authenticated user to push and pull encrypted vault', async () => {
    const pushRes = await request(app)
      .post('/api/v1/sync/push')
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send({
        baseRevision: 0,
        vault: {
          version: 1,
          ciphertext: 'VGVzdENpcGhlcnRleHQ=',
          iv: 'VGVzdElWMTI=',
          itemCount: 1,
          updatedAt: Date.now(),
        },
      });

    expect(pushRes.status).toBe(200);
    expect(pushRes.body.revision).toBe(1);

    const pullRes = await request(app)
      .get('/api/v1/sync/pull')
      .set('Authorization', `Bearer ${authTokens.accessToken}`);

    expect(pullRes.status).toBe(200);
    expect(pullRes.body.revision).toBe(1);
    expect(pullRes.body.vault.ciphertext).toBe('VGVzdENpcGhlcnRleHQ=');
  });

  it('detects sync revision conflict when pushing with outdated baseRevision', async () => {
    const pushRes = await request(app)
      .post('/api/v1/sync/push')
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send({
        baseRevision: 0, // Outdated! Server is now at revision 1
        vault: {
          version: 1,
          ciphertext: 'T3V0ZGF0ZWQ=',
          iv: 'VGVzdElWMTI=',
          itemCount: 1,
          updatedAt: Date.now(),
        },
      });

    expect(pushRes.status).toBe(409);
    expect(pushRes.body.error).toContain('Conflict detected');
  });

  it('lists connected devices for user', async () => {
    const res = await request(app)
      .get('/api/v1/devices')
      .set('Authorization', `Bearer ${authTokens.accessToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
