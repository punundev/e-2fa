# SecureAuth 2FA — Architecture & System Design

## 1. Executive Overview

SecureAuth 2FA is a zero-knowledge, local-first authenticator extension for Chrome (Manifest V3) backed by an optional serverless Node.js/Express API and PostgreSQL database (Neon or self-hosted).

The core tenet of the system is **zero-knowledge privacy**: the server and database never receive, store, or process plaintext TOTP secrets, authentication seed keys, or encryption keys.

```
+-------------------------------------------------------------+
|                 Chrome Extension (Client)                   |
|                                                             |
|  [IndexedDB / Local-first]  <--->  [React UI / TOTP Engine] |
|              ^                                              |
|              | (Encrypted Vault Payload Only)               |
|              v                                              |
|  [Client Cryptography Module]                               |
|   - AES-256-GCM                                            |
|   - PBKDF2-SHA256 (200,000 iter)                           |
|   - Authenticated Additional Data (AAD)                     |
+-------------------------------------------------------------+
                              |
               HTTPS JSON REST API (Zero-Knowledge)
                              |
+-------------------------------------------------------------+
|               Express API Server (Vercel / Node)            |
|                                                             |
|  - Rate Limiting                                            |
|  - JWT Bearer Authentication                                |
|  - Multi-device Concurrency & Conflict Detection            |
|  - Device Management & Revocation                           |
+-------------------------------------------------------------+
                              |
+-------------------------------------------------------------+
|                  PostgreSQL Database                        |
|       (Neon Serverless Postgres / Local Postgres)           |
|                                                             |
|  - users (id, email, password_hash)                         |
|  - vault_key_envelopes (wrapped DEK, salt, IV, kdf)         |
|  - vaults (encrypted ciphertext, IV, AAD, revision)         |
|  - devices (device_name, last_seen, revoked_at)             |
|  - sync_history (revisions, idempotency keys)               |
+-------------------------------------------------------------+
```

## 2. Component Architecture

### A. Frontend (Chrome Manifest V3)
- Built with React 19, TypeScript, Tailwind CSS 4, and Vite.
- Functions **100% offline** without network connectivity.
- Authenticator accounts are saved locally in browser `IndexedDB`.
- Optional Cloud Synchronization module that automatically encrypts and packages accounts before sync.

### B. Cryptographic Subsystem (`src/lib/cloud-crypto.ts`)
1. **Data Encryption Key (DEK):** High-entropy random 256-bit AES-GCM key generated on the client device.
2. **Key Encryption Key (KEK):** Derived from the user's master password using PBKDF2 with HMAC-SHA-256 (200,000 iterations) and a 32-byte cryptographically secure random salt.
3. **Key Envelope:** The DEK wrapped with KEK via AES-256-GCM. Only this envelope is stored on the server.
4. **Ciphertext Integrity:** Vault data is serialized, bound to user email and version metadata using Authenticated Additional Data (AAD), and encrypted with AES-256-GCM.

### C. Backend API Server (`server/src/`)
- Lightweight Express application written in TypeScript.
- Compatible with Vercel Serverless Functions (`api/index.ts`) and Docker containers.
- Stateless authentication via scoped JWT access tokens (15m) and rotated refresh tokens.
- Optimistic Concurrency Control (OCC) with revisions and conflict detection.

### D. Database Layer (`migrations/001_initial_schema.sql`)
- Normalized PostgreSQL tables with cascading deletions, unique constraints, and indices on query lookups.
- Compatible with Neon PostgreSQL (including serverless pooling) and standard PostgreSQL.

