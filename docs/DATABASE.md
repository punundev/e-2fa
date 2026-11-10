# Database Architecture & Migrations

SecureAuth uses PostgreSQL. It supports Neon Serverless PostgreSQL and standard PostgreSQL.

## Schema Overview

- **`users`**: Account identity records (`email`, `password_hash`, `is_verified`).
- **`vault_key_envelopes`**: Encrypted Data Encryption Keys (`encrypted_dek`, `wrapping_iv`, `kdf_iterations`, `salt`).
- **`vaults`**: Encrypted zero-knowledge client vaults (`ciphertext`, `iv`, `aad`, `revision`, `item_count`).
- **`devices`**: Authorized client extension installations with revocation capability.
- **`refresh_tokens`**: Hashed rotation tokens linked to users and devices.
- **`sync_history`**: Audit log of revision changes and idempotency keys.

## Running Migrations

```bash
DATABASE_URL="your-connection-string" pnpm run db:migrate
```

Or execute `migrations/001_initial_schema.sql` directly in Neon's SQL Editor console.

