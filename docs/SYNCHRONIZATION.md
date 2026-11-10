# Cloud Synchronization & Conflict Resolution

## 1. Concurrency Model: Optimistic Concurrency Control (OCC)

Every user vault in the database possesses a strictly monotonically increasing integer: `revision`.

### Push Workflow:
1. Client determines its `baseRevision` (e.g. 1).
2. Client encrypts the latest accounts list into a payload.
3. Client issues `POST /api/v1/sync/push` with `{ baseRevision: 1, vault: ... }`.
4. The server runs an atomic transaction (`SELECT ... FOR UPDATE`):
   - If server revision != baseRevision (e.g., another device synced and bumped revision to 2), the server rejects the push with HTTP 409 Conflict and returns the server's vault.
   - If server revision == baseRevision, the server stores the new vault and increments revision to 2.

## 2. Safe Conflict Merging
When two devices modify accounts concurrently:
- SecureAuth does **not** perform destructive last-write-wins at the vault level.
- `mergeAccounts` matches entries by account UUID:
  - Any new accounts created on either device are merged into the final list.
  - For conflicting updates to the same account ID, the record with the newer `updatedAt` timestamp is preserved.
  - Plaintext secrets are never exposed to the server during merging.

