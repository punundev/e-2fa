# Vault Recovery & Key Management

## 1. Zero-Knowledge Recovery Principles

Because SecureAuth never holds the user's master password or plaintext encryption key:
- **No Backdoor Reset:** If a user loses their master password and has no recovery key, the server **cannot** decrypt or restore their vault.
- **Local Data Preservation:** Forgetting the cloud password does **not** erase the offline local data on devices that are already unlocked.

## 2. Emergency Recovery Key
During initial setup or in the Account modal, users can generate a high-entropy 24-byte recovery key (`generateRecoveryKey()`).
- This key can serve as an alternative passphrase to wrap an additional key envelope.
- Users are advised to write down or print this key offline in a secure location.

