import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { query, queryOne, withTransaction } from '../database/index';
import { getJwtSecret } from '../middleware/auth';
import { ACCESS_TOKEN_EXPIRY, REFRESH_TOKEN_EXPIRY_DAYS } from '../../../shared/constants/index';
import { KeyEnvelope, EncryptedVaultPayload } from '../../../shared/schemas/index';

const SALT_ROUNDS = 12;

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

export class AuthService {
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
  }

  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  static generateTokens(userId: string, email: string, deviceId?: string): TokenPair {
    const secret = getJwtSecret();
    const accessToken = jwt.sign(
      { sub: userId, email, deviceId, type: 'access' },
      secret,
      { expiresIn: ACCESS_TOKEN_EXPIRY }
    );

    const refreshTokenRaw = crypto.randomBytes(40).toString('hex');
    return {
      accessToken,
      refreshToken: refreshTokenRaw,
      expiresIn: ACCESS_TOKEN_EXPIRY,
    };
  }

  static async storeRefreshToken(userId: string, deviceId: string | undefined, rawToken: string): Promise<void> {
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    await query(
      `INSERT INTO refresh_tokens (user_id, device_id, token_hash, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [userId, deviceId || null, tokenHash, expiresAt.toISOString()]
    );
  }

  static async registerUser(
    email: string,
    password: string,
    deviceName?: string,
    keyEnvelope?: KeyEnvelope,
    initialVault?: EncryptedVaultPayload
  ) {
    const existing = await queryOne('SELECT id FROM users WHERE email = $1', [email]);
    if (existing) {
      throw new Error('An account with this email address already exists');
    }

    const passwordHash = await this.hashPassword(password);

    return withTransaction(async (client) => {
      const userRes = await client.query(
        `INSERT INTO users (email, password_hash, is_verified)
         VALUES ($1, $2, true)
         RETURNING id, email, created_at`,
        [email, passwordHash]
      );
      const user = userRes.rows[0];

      let deviceId: string | undefined;
      if (deviceName) {
        const deviceRes = await client.query(
          `INSERT INTO devices (user_id, device_name, device_type)
           VALUES ($1, $2, 'chrome-extension')
           RETURNING id`,
          [user.id, deviceName]
        );
        deviceId = deviceRes.rows[0].id;
      }

      if (keyEnvelope) {
        await client.query(
          `INSERT INTO vault_key_envelopes 
           (user_id, encrypted_dek, wrapping_iv, kdf, kdf_iterations, salt, key_version)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            user.id,
            keyEnvelope.encryptedDek,
            keyEnvelope.wrappingIv,
            keyEnvelope.kdf,
            keyEnvelope.kdfIterations,
            keyEnvelope.salt,
            keyEnvelope.keyVersion || 1,
          ]
        );
      }

      if (initialVault) {
        await client.query(
          `INSERT INTO vaults
           (user_id, revision, payload_version, ciphertext, iv, aad, item_count)
           VALUES ($1, 1, $2, $3, $4, $5, $6)`,
          [
            user.id,
            initialVault.version || 1,
            initialVault.ciphertext,
            initialVault.iv,
            initialVault.aad || null,
            initialVault.itemCount,
          ]
        );
      }

      const tokens = this.generateTokens(user.id, user.email, deviceId);
      const tokenHash = crypto.createHash('sha256').update(tokens.refreshToken).digest('hex');
      const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

      await client.query(
        `INSERT INTO refresh_tokens (user_id, device_id, token_hash, expires_at)
         VALUES ($1, $2, $3, $4)`,
        [user.id, deviceId || null, tokenHash, expiresAt.toISOString()]
      );

      return {
        user: {
          id: user.id,
          email: user.email,
          createdAt: user.created_at,
        },
        deviceId,
        tokens,
      };
    });
  }

  static async login(email: string, password: string, deviceName?: string) {
    const user = await queryOne(
      'SELECT id, email, password_hash, created_at FROM users WHERE email = $1',
      [email]
    );

    if (!user) {
      throw new Error('Invalid email or password');
    }

    const matches = await this.verifyPassword(password, user.password_hash);
    if (!matches) {
      throw new Error('Invalid email or password');
    }

    let deviceId: string | undefined;
    if (deviceName) {
      const dev = await queryOne(
        `INSERT INTO devices (user_id, device_name, device_type)
         VALUES ($1, $2, 'chrome-extension')
         RETURNING id`,
        [user.id, deviceName]
      );
      deviceId = dev.id;
    }

    const tokens = this.generateTokens(user.id, user.email, deviceId);
    await this.storeRefreshToken(user.id, deviceId, tokens.refreshToken);

    return {
      user: {
        id: user.id,
        email: user.email,
        createdAt: user.created_at,
      },
      deviceId,
      tokens,
    };
  }

  static async refresh(rawRefreshToken: string) {
    const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');
    const record = await queryOne(
      `SELECT rt.id, rt.user_id, rt.device_id, rt.expires_at, rt.revoked_at, u.email
       FROM refresh_tokens rt
       JOIN users u ON rt.user_id = u.id
       WHERE rt.token_hash = $1`,
      [tokenHash]
    );

    if (!record || record.revoked_at !== null) {
      throw new Error('Invalid or revoked refresh token');
    }

    if (new Date(record.expires_at).getTime() < Date.now()) {
      throw new Error('Refresh token expired');
    }

    if (record.device_id) {
      const dev = await queryOne('SELECT revoked_at FROM devices WHERE id = $1', [record.device_id]);
      if (!dev || dev.revoked_at !== null) {
        throw new Error('Device revoked');
      }
    }

    // Revoke old refresh token (rotation)
    await query('UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE id = $1', [record.id]);

    const tokens = this.generateTokens(record.user_id, record.email, record.device_id);
    await this.storeRefreshToken(record.user_id, record.device_id, tokens.refreshToken);

    return tokens;
  }

  static async logout(rawRefreshToken?: string, userId?: string): Promise<void> {
    if (rawRefreshToken) {
      const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');
      await query('UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE token_hash = $1', [tokenHash]);
    } else if (userId) {
      await query('UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = $1', [userId]);
    }
  }

  static async deleteAccount(userId: string, password: string): Promise<void> {
    const user = await queryOne('SELECT password_hash FROM users WHERE id = $1', [userId]);
    if (!user) {
      throw new Error('User not found');
    }

    const matches = await this.verifyPassword(password, user.password_hash);
    if (!matches) {
      throw new Error('Incorrect password');
    }

    await query('DELETE FROM users WHERE id = $1', [userId]);
  }
}
