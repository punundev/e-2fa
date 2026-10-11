# Privacy Policy — SecureAuth 2FA Authenticator

**Last Updated:** October 2026

## 1. Introduction
SecureAuth is a privacy-first, local-only Google Chrome extension designed to generate two-factor authentication (2FA) time-based (TOTP) and counter-based (HOTP) codes.

## 2. Information Collection and Transmission
- **No Personal Data Collected**: SecureAuth does not collect, log, transmit, or sell any personal data, account identifiers, authentication secrets, or usage analytics.
- **Zero External Network Requests**: SecureAuth operates 100% offline. It makes zero HTTP/HTTPS requests to external servers, APIs, cloud services, or telemetry endpoints.
- **Zero Third-Party Trackers**: SecureAuth contains no third-party analytics scripts, advertising trackers, or tracking pixels.

## 3. Local Data Storage
- All authenticator account credentials, secrets, and preferences are stored exclusively on your device inside your browser's private IndexedDB storage.
- If master password protection is enabled, account secrets are encrypted at rest using AES-256-GCM authenticated encryption.
- No data is synchronized to Chrome Sync or external cloud services.

## 4. Permissions Justification
- `storage`: Used strictly to save non-sensitive user preferences (theme, code grouping, auto-lock timeout) locally within the extension storage space.
- No host permissions or browsing history permissions are requested or used.

## 5. Contact & Inquiries
For security inquiries or questions regarding this extension, please file an issue on the project repository.
