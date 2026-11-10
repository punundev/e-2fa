import { query, queryOne, withTransaction } from '../database/index';
import { KeyEnvelope, EncryptedVaultPayload } from '../../../shared/schemas/index';

export class VaultService {
  static async getKeyEnvelope(userId: string): Promise<KeyEnvelope | null> {
    const row = await queryOne(
      `SELECT encrypted_dek, wrapping_iv, kdf, kdf_iterations, salt, key_version, updated_at
       FROM vault_key_envelopes
       WHERE user_id = $1`,
      [userId]
    );

    if (!row) return null;

    return {
      encryptedDek: row.encrypted_dek,
      wrappingIv: row.wrapping_iv,
      kdf: row.kdf,
      kdfIterations: row.kdf_iterations,
      salt: row.salt,
      keyVersion: row.key_version,
      updatedAt: new Date(row.updated_at).getTime(),
    };
  }

  static async setKeyEnvelope(userId: string, envelope: KeyEnvelope): Promise<void> {
    await query(
      `INSERT INTO vault_key_envelopes 
       (user_id, encrypted_dek, wrapping_iv, kdf, kdf_iterations, salt, key_version, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id) DO UPDATE SET
         encrypted_dek = EXCLUDED.encrypted_dek,
         wrapping_iv = EXCLUDED.wrapping_iv,
         kdf = EXCLUDED.kdf,
         kdf_iterations = EXCLUDED.kdf_iterations,
         salt = EXCLUDED.salt,
         key_version = EXCLUDED.key_version,
         updated_at = CURRENT_TIMESTAMP`,
      [
        userId,
        envelope.encryptedDek,
        envelope.wrappingIv,
        envelope.kdf,
        envelope.kdfIterations,
        envelope.salt,
        envelope.keyVersion || 1,
      ]
    );
  }

  static async getVault(userId: string) {
    const row = await queryOne(
      `SELECT id, revision, payload_version, ciphertext, iv, aad, item_count, updated_at
       FROM vaults
       WHERE user_id = $1`,
      [userId]
    );

    if (!row) return null;

    return {
      revision: row.revision,
      vault: {
        version: row.payload_version,
        ciphertext: row.ciphertext,
        iv: row.iv,
        aad: row.aad || undefined,
        itemCount: row.item_count,
        updatedAt: new Date(row.updated_at).getTime(),
      } as EncryptedVaultPayload,
    };
  }

  static async getMetadata(userId: string) {
    const row = await queryOne(
      `SELECT revision, payload_version, item_count, updated_at
       FROM vaults
       WHERE user_id = $1`,
      [userId]
    );

    if (!row) {
      return {
        revision: 0,
        itemCount: 0,
        payloadVersion: 1,
        updatedAt: null,
      };
    }

    return {
      revision: row.revision,
      itemCount: row.item_count,
      payloadVersion: row.payload_version,
      updatedAt: row.updated_at,
    };
  }

  static async syncPush(
    userId: string,
    deviceId: string | undefined,
    baseRevision: number,
    vault: EncryptedVaultPayload,
    keyEnvelope?: KeyEnvelope,
    idempotencyKey?: string
  ) {
    return withTransaction(async (client) => {
      if (idempotencyKey) {
        const existingSync = await client.query(
          `SELECT revision FROM sync_history WHERE idempotency_key = $1 AND user_id = $2`,
          [idempotencyKey, userId]
        );
        if (existingSync.rows.length > 0) {
          return {
            conflict: false,
            revision: existingSync.rows[0].revision,
            idempotentReplay: true,
          };
        }
      }

      const currentVaultRes = await client.query(
        `SELECT revision, payload_version, ciphertext, iv, aad, item_count, updated_at
         FROM vaults WHERE user_id = $1 FOR UPDATE`,
        [userId]
      );

      const currentVault = currentVaultRes.rows[0];
      const currentRev = currentVault ? currentVault.revision : 0;

      if (currentRev !== baseRevision) {
        return {
          conflict: true,
          currentRevision: currentRev,
          serverVault: currentVault
            ? {
                version: currentVault.payload_version,
                ciphertext: currentVault.ciphertext,
                iv: currentVault.iv,
                aad: currentVault.aad || undefined,
                itemCount: currentVault.item_count,
                updatedAt: new Date(currentVault.updated_at).getTime(),
              }
            : null,
        };
      }

      const nextRev = currentRev + 1;

      if (currentVault) {
        await client.query(
          `UPDATE vaults
           SET revision = $1, payload_version = $2, ciphertext = $3, iv = $4, aad = $5, item_count = $6, updated_at = CURRENT_TIMESTAMP
           WHERE user_id = $7`,
          [
            nextRev,
            vault.version,
            vault.ciphertext,
            vault.iv,
            vault.aad || null,
            vault.itemCount,
            userId,
          ]
        );
      } else {
        await client.query(
          `INSERT INTO vaults (user_id, revision, payload_version, ciphertext, iv, aad, item_count)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            userId,
            nextRev,
            vault.version,
            vault.ciphertext,
            vault.iv,
            vault.aad || null,
            vault.itemCount,
          ]
        );
      }

      if (keyEnvelope) {
        await client.query(
          `INSERT INTO vault_key_envelopes 
           (user_id, encrypted_dek, wrapping_iv, kdf, kdf_iterations, salt, key_version, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
           ON CONFLICT (user_id) DO UPDATE SET
             encrypted_dek = EXCLUDED.encrypted_dek,
             wrapping_iv = EXCLUDED.wrapping_iv,
             kdf = EXCLUDED.kdf,
             kdf_iterations = EXCLUDED.kdf_iterations,
             salt = EXCLUDED.salt,
             key_version = EXCLUDED.key_version,
             updated_at = CURRENT_TIMESTAMP`,
          [
            userId,
            keyEnvelope.encryptedDek,
            keyEnvelope.wrappingIv,
            keyEnvelope.kdf,
            keyEnvelope.kdfIterations,
            keyEnvelope.salt,
            keyEnvelope.keyVersion || 1,
          ]
        );
      }

      await client.query(
        `INSERT INTO sync_history (user_id, device_id, revision, idempotency_key)
         VALUES ($1, $2, $3, $4)`,
        [userId, deviceId || null, nextRev, idempotencyKey || null]
      );

      return {
        conflict: false,
        revision: nextRev,
      };
    });
  }

  static async deleteVault(userId: string): Promise<void> {
    await query('DELETE FROM vaults WHERE user_id = $1', [userId]);
    await query('DELETE FROM vault_key_envelopes WHERE user_id = $1', [userId]);
    await query('DELETE FROM sync_history WHERE user_id = $1', [userId]);
  }
}
