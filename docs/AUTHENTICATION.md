# Authentication & Session Architecture

## 1. Neon Auth Evaluation & Strategy

During the architectural evaluation of **Neon Auth**:
- Neon Auth is currently in development/preview with specific OAuth/OIDC and developer integrations.
- For maximum independence, Chrome Extension Manifest V3 compatibility, and self-hosting support on standard Docker/PostgreSQL, SecureAuth provides a clean, modular authentication provider abstraction:
  1. Default: Standard JWT + Token Hash Rotation backed by Neon PostgreSQL / Postgres.
  2. Neon Auth Compatible: Can integrate directly with Neon's identity provider headers or external OIDC providers via the `/server/src/middleware/auth.ts` abstraction.

## 2. Token Lifecycle

- **Access Token:** Short-lived JWT (15 minutes). Scoped to `sub` (User ID), `email`, and `deviceId`.
- **Refresh Token:** High-entropy cryptographically random 40-byte hex token.
  - Stored in the database as a SHA-256 hash.
  - Automatically rotated on every refresh operation.
  - Revoked immediately upon device revocation or user sign-out.

## 3. Chrome Manifest V3 Extension Security
- The extension communicates exclusively with authorized HTTPS origins configured in settings.
- Manifest permissions are strictly limited (`storage`).
- No backend secrets, database connection strings, or signing keys exist in frontend code or Vite builds.

