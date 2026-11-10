# REST API Reference

All requests and responses use JSON. Authenticated routes require `Authorization: Bearer <accessToken>`.

## Public Endpoints
- `GET /api/health`: Health status.
- `POST /api/v1/auth/register`: Create user account and store initial key envelope.
- `POST /api/v1/auth/login`: Authenticate with email/password and obtain JWT tokens.
- `POST /api/v1/auth/refresh`: Rotate refresh token and obtain new access token.

## Authenticated Endpoints
- `POST /api/v1/auth/logout`: Revoke active refresh tokens.
- `DELETE /api/v1/auth/account`: Permanently delete user account and all cloud data.
- `GET /api/v1/vault`: Retrieve latest encrypted vault and metadata.
- `GET /api/v1/vault/envelope`: Retrieve encrypted key envelope to unwrap DEK.
- `PUT /api/v1/vault/envelope`: Update key envelope (e.g., during password change).
- `DELETE /api/v1/vault`: Purge cloud vault backup while keeping account active.
- `POST /api/v1/sync/push`: Push new encrypted vault version with OCC conflict detection.
- `GET /api/v1/sync/pull`: Pull latest encrypted vault version.
- `GET /api/v1/devices`: List all registered devices for the authenticated user.
- `DELETE /api/v1/devices/:deviceId`: Revoke an active device.

