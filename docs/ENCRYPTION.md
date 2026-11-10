# Zero-Knowledge Encryption Specification

SecureAuth implements an end-to-end zero-knowledge security architecture.

## 1. Cryptographic Primitive Selection

| Purpose | Algorithm / Primitive | Key Length / Parameters |
|---|---|---|
| Vault Data Encryption | AES-GCM | 256 bits, 96-bit unique IV |
| Key Derivation (KEK) | PBKDF2-HMAC-SHA256 | 200,000 iterations, 32-byte salt |
| Key Wrapping | AES-GCM | 256 bits, 96-bit unique IV |
| Ciphertext Integrity & Binding | Authenticated Additional Data (AAD) | `secureauth-vault:v1:<user-email>` |
| Password Storage (Server) | bcrypt | Salt rounds: 12 |

## 2. Key Lifecycle

```
[User Master Password]
        |
        v
[PBKDF2-HMAC-SHA256 (200,000 iter, 32-byte random salt)]
        |
        v
[Key Encryption Key (KEK)]
        |
        +-----------------------------------+
        |                                   |
        v                                   v
[Wrap (AES-256-GCM)]             [Unwrap (AES-256-GCM)]
        ^                                   |
        |                                   v
[Random 256-bit DEK] <----------------------+
        |
        +-----> Encrypt / Decrypt Vault via AES-256-GCM
```

### Critical Security Properties:
- **No Plaintext Transmission:** The DEK is never transmitted to the server in plaintext.
- **Nonce Uniqueness:** A fresh 12-byte random IV (`crypto.getRandomValues`) is generated for every single encryption operation.
- **Context Binding:** Even if an attacker copies an encrypted vault ciphertext, it cannot be decrypted in another tenant's account due to AAD checking (`secureauth-vault:v1:<email>`).
- **Memory Lifetime:** Unwrapped DEK is stored exclusively in client memory (`setMemoryDek`), and discarded on lock or sign-out.

