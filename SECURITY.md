# Security Policy & Threat Model — SecureAuth 2FA

## 1. Overview

SecureAuth is designed from the ground up as a zero-trust, local-only, offline 2FA authenticator extension. It does not communicate with any external servers, collect telemetry, or synchronize secrets across external networks.

---

## 2. Threat Model Analysis

### 2.1 Device Compromise & Local Malware
- **Threat**: An adversary with root/administrative privileges or malicious background processes on the host machine.
- **Mitigation**: Secrets at rest can be encrypted with AES-256-GCM using keys derived from a master vault password via PBKDF2 (SHA-256, 100,000 iterations for vault, 600,000 iterations for exported backups).
- **Limitation**: If the host machine is fully compromised by keyloggers, kernel-level rootkits, or memory dumpers while the vault is in an unlocked state, the adversary can intercept memory contents or inputs. No browser extension can protect against full host operating system compromise.

### 2.2 Malicious Browser Extensions
- **Threat**: Other installed browser extensions attempting to read SecureAuth data.
- **Mitigation**: Under Chrome's security model, extensions run in isolated origins. IndexedDB and Chrome Storage partitions are strictly isolated per extension ID. SecureAuth requests no cross-origin permissions or external host access.
- **Limitation**: Extensions granted broad `debugger` or unrestricted file access could theoretically inspect extension processes. Users should only install trusted extensions.

### 2.3 Clipboard Exposure
- **Threat**: Third-party desktop applications reading the OS clipboard history after a verification code is copied.
- **Mitigation**: SecureAuth only places short-lived 6/8-digit verification codes onto the clipboard upon explicit user action. Account secrets are never copied automatically. An optional automatic clipboard-clearing timer is supported.
- **Limitation**: Clipboard managers or other processes with clipboard listeners may record items before clearing.

### 2.4 Weak Vault Passwords & Backup Theft
- **Threat**: Backup files (`.sauth`) intercepted or stolen, subjected to offline brute-force attacks.
- **Mitigation**: Encrypted backups use AES-256-GCM with PBKDF2-HMAC-SHA-256 using 600,000 iterations and a cryptographically secure 32-byte salt generated via `crypto.getRandomValues()`. A fresh 96-bit IV is generated for each encryption operation.

### 2.5 Malicious Imported Files & Malformed Provisioning URIs
- **Threat**: Adversaries crafting malformed `otpauth://` URIs, Google migration protobuf payloads, or corrupt `.sauth` files to trigger injection or memory safety issues.
- **Mitigation**: All input is strictly validated before processing. Protobuf schemas are validated with type-checked boundary checks. Base32 strings are strictly verified against the RFC 4648 alphabet. HTML injection is prevented via React's virtual DOM escaping. No `eval()` or remote script loading is permitted under Manifest V3 CSP (`script-src 'self'`).

### 2.6 Accidental Disclosure During Screen Sharing
- **Threat**: Showing secret keys on screen during presentations or recordings.
- **Mitigation**: Base32 secrets are masked by default (`••••••••`). Explicit user action is required to reveal or copy raw secrets, accompanied by security warnings.

### 2.7 Memory Exposure While Unlocked
- **Threat**: Retention of decrypted cryptographic keys in memory indefinitely.
- **Mitigation**: An inactivity timer automatically locks the vault and purges the session encryption key from memory after a user-configured interval (default 5 minutes). A manual "Lock Vault" button is available in the header and settings.

### 2.8 Clock Manipulation
- **Threat**: System clock desynchronization leading to generation of invalid TOTP codes.
- **Mitigation**: TOTP step calculations use standard Unix time boundaries. Countdown calculations compute remaining seconds relative to the current period modulo.

---

## 3. Cryptographic Review Checklist

- [x] Standard Web Crypto API (`crypto.subtle`) used for all cryptographic operations.
- [x] RFC 6238 TOTP reference vectors verified with unit tests.
- [x] RFC 4226 HOTP reference vectors verified with unit tests.
- [x] AES-256-GCM authenticated encryption used for backups and vault secrets.
- [x] PBKDF2 with SHA-256 and >= 600,000 iterations used for backup files.
- [x] Fresh 96-bit random IV generated via `crypto.getRandomValues()` for every encryption operation.
- [x] Authenticated data (AAD) verifies envelope header integrity against tampering.
- [x] Zero network requests, zero telemetry, zero analytics, zero external scripts.
- [x] Least privilege permissions in Manifest V3 (`storage` only).
