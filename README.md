# SynergyKH — 2FA

A production-ready, security-focused Google Chrome extension (Manifest V3) for managing two-factor authentication (2FA) accounts, generating TOTP/HOTP verification codes, and seamlessly importing/exporting accounts with Google Authenticator.

---

## Features

- **Standard Algorithms**:
  - RFC 6238-compliant TOTP supporting SHA-1, SHA-256, SHA-512, 6 and 8 digits, configurable periods (default 30s), and leading zeros.
  - RFC 4226-compliant HOTP with persistent atomic counter management.
- **Google Authenticator Migration**:
  - Full import and export compatibility via Google's `otpauth-migration://offline?data=...` protobuf format.
  - Automatic multi-batch QR splitting for large account collections.
- **Multiple Ways to Add Accounts**:
  - Upload QR code image (processed 100% locally using `jsqr`).
  - Scan with camera (on-demand permission, stopped immediately after scan).
  - Manual entry with real-time validation and code preview.
  - Paste standard `otpauth://` or migration URIs.
- **Military-Grade Local Encryption**:
  - Vault secrets encrypted at rest with AES-256-GCM.
  - PBKDF2 with SHA-256 and 600,000 iterations for exported `.sauth` backup files.
  - Fresh random 96-bit IV generated for every encryption operation.
- **Privacy First & Offline**:
  - 100% local operation inside IndexedDB.
  - Zero external network requests, analytics, or telemetry.
  - No account registration or cloud services required.
- **Polished UI/UX**:
  - Lightweight Chrome action popup (~380px width) with smooth circular countdown animations.
  - 3-Axis Customization:
    - **Theme Mode**: Dark and Light.
    - **Accent Color**: Blue, Green, Violet, Yellow, Red, Orange, Cyan, and Rose.
    - **Design Style**: Rounded (smooth modern corners), Sharp (industrial 0px edges), Compact (dense padding), Glass (frosted glassmorphism), Clay (3D puffy claymorphism), Apple UI (Cupertino HIG squircles & hairline materials), and Neumorphic (soft extruded 3D surfaces).
  - Custom Wallpaper Presets and file upload with adjustable dimming.
  - Search by issuer and account label with category groups and favorites/pins.
  - Dedicated Options page dashboard.

---

## Technology Stack

- **Platform**: Chrome Extension Manifest V3
- **Language**: TypeScript (Strict Mode)
- **Framework**: React 19 + Vite
- **Styling**: Tailwind CSS
- **Icons**: Lucide Icons
- **Cryptography**: Web Crypto API (`crypto.subtle`)
- **Storage**: IndexedDB (Transaction-based persistence)
- **Protobuf**: `protobufjs` for Google Authenticator migration format
- **QR Engine**: `qrcode` (generation) & `jsqr` (decoding)
- **Testing**: Vitest

---

## Directory Structure

```
secureauth/
├── dist/                      # Built extension output (ready for Chrome)
├── public/
│   ├── icons/                 # Extension PNG icons (16, 32, 48, 128)
│   └── manifest.json          # Manifest V3 for distribution
├── src/
│   ├── background/
│   │   └── service-worker.ts  # Manifest V3 background service worker
│   ├── popup/
│   │   ├── App.tsx            # Main popup application
│   │   ├── main.tsx           # Popup entry point
│   │   └── components/        # UI components (cards, rings, modals)
│   ├── options/
│   │   ├── App.tsx            # Options full-page dashboard
│   │   └── main.tsx           # Options entry point
│   ├── lib/
│   │   ├── totp.ts            # RFC 6238 implementation
│   │   ├── hotp.ts            # RFC 4226 implementation
│   │   ├── otp-uri.ts         # otpauth:// URI parser & generator
│   │   ├── google-migration.ts# Protobuf migration encoder & decoder
│   │   ├── crypto.ts          # AES-256-GCM & PBKDF2 encryption
│   │   ├── database.ts        # IndexedDB storage and vault management
│   │   ├── qr-code.ts         # QR generation and decoding
│   │   ├── import-export.ts   # Backup and deduplication logic
│   │   ├── validation.ts      # Base32 validation and decoding
│   │   ├── clock.ts           # Time helpers and code formatting
│   │   └── i18n.ts            # Localization dictionary and helper
│   ├── types/                 # TypeScript interfaces and types
│   └── styles/                # Global Tailwind styles
├── test/                      # Automated unit test suite
├── Makefile                   # Developer commands
├── manifest.json              # Root manifest definition
├── package.json               # Dependencies and scripts (pnpm)
├── PRIVACY.md                 # Privacy Policy
├── SECURITY.md                # Security Threat Model
└── README.md                  # Project documentation
```

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [pnpm](https://pnpm.io/) (v9+)

### Installation

Install dependencies using `pnpm`:

```bash
pnpm install
```

Or using the Makefile:

```bash
make install
```

---

## Development & Testing

### Run Tests

Run the Vitest test suite (verifying RFC 4226, RFC 6238, AES-256-GCM, and Protobuf migration):

```bash
pnpm run test
```

Or with Makefile:

```bash
make test
```

### Type Checking

```bash
pnpm run typecheck
```

### Build for Production

Build the production extension bundle in the `dist/` directory:

```bash
pnpm run build
```

Or with Makefile:

```bash
make build
```

---

## Loading the Extension in Google Chrome

1. Open Google Chrome.
2. Navigate to `chrome://extensions`.
3. Enable **Developer mode** using the toggle switch in the upper-right corner.
4. Click the **Load unpacked** button in the upper-left.
5. Select the `dist` directory inside this project:
   ```
   /Users/nun/Desktop/extension/2fa/dist
   ```
6. The **SynergyKH — 2FA** extension will now appear in your Chrome toolbar.
7. Click the extension icon to open the popup!

---

## Chrome Web Store Preparation

Before publishing to the Chrome Web Store:

1. Run `make all` to ensure all tests, type checks, and production builds pass.
2. Verify all icons in `public/icons/` (16x16, 32x32, 48x48, 128x128).
3. Zip the contents of the `dist` directory:
   ```bash
   cd dist && zip -r ../secureauth-extension.zip . && cd ..
   ```
4. Upload `secureauth-extension.zip` to the [Chrome Developer Dashboard](https://chrome.google.com/webstore/devconsole).
5. Attach `PRIVACY.md` in the store privacy declaration.
