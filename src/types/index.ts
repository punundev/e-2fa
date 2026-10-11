export type OtpType = 'totp' | 'hotp';
export type HashAlgorithm = 'SHA-1' | 'SHA-256' | 'SHA-512';

export interface AuthenticatorAccount {
  id: string;
  issuer: string;
  name: string;
  secret: string;
  type: OtpType;
  algorithm: HashAlgorithm;
  digits: number;
  period: number;
  counter: number;
  group?: string;
  isPinned?: boolean;
  color?: string;
  createdAt: number;
  updatedAt: number;
}

export type ThemeMode = 'dark' | 'light';
export type ThemeColor = 'blue' | 'green' | 'violet' | 'yellow' | 'red' | 'orange' | 'cyan' | 'rose';
export type ThemeDesign = 'rounded' | 'sharp' | 'compact' | 'glass' | 'clay' | 'apple' | 'neumorphic';

export interface AppSettings {
  theme: 'system' | 'light' | 'dark' | 'oled' | 'violet';
  mode?: ThemeMode;
  accentColor?: ThemeColor;
  designStyle?: ThemeDesign;
  customWallpaper?: string;
  wallpaperDim?: number;
  autoLockTimeout: number;
  clipboardClearDelay: number;
  confirmSecretReveal: boolean;
  confirmPlaintextExport: boolean;
  codeGrouping: 'grouped' | 'plain';
  defaultSort: 'alphabetical' | 'recent' | 'pinned';
  defaultGroup: string;
}

export interface VaultState {
  isInitialized: boolean;
  isLocked: boolean;
  hasPassword: boolean;
}

export interface EncryptedBackupEnvelope {
  version: 1;
  format: 'secureauth-backup';
  kdf: 'PBKDF2';
  kdfHash: 'SHA-256';
  kdfIterations: number;
  salt: string;
  cipher: 'AES-256-GCM';
  iv: string;
  data: string;
}

export interface PlaintextBackupPayload {
  version: 1;
  exportedAt: number;
  accounts: AuthenticatorAccount[];
  settings?: Partial<AppSettings>;
}

export enum GoogleAlgorithm {
  ALGORITHM_UNSPECIFIED = 0,
  ALGORITHM_SHA1 = 1,
  ALGORITHM_SHA256 = 2,
  ALGORITHM_SHA512 = 3,
  ALGORITHM_MD5 = 4
}

export enum GoogleDigitCount {
  DIGIT_COUNT_UNSPECIFIED = 0,
  DIGIT_COUNT_SIX = 1,
  DIGIT_COUNT_EIGHT = 2
}

export enum GoogleOtpType {
  OTP_TYPE_UNSPECIFIED = 0,
  OTP_TYPE_HOTP = 1,
  OTP_TYPE_TOTP = 2
}

export interface GoogleOtpParameters {
  secret: Uint8Array;
  name: string;
  issuer: string;
  algorithm: GoogleAlgorithm;
  digits: GoogleDigitCount;
  type: GoogleOtpType;
  counter: number | bigint;
}

export interface GoogleMigrationPayload {
  otpParameters: GoogleOtpParameters[];
  version: number;
  batchSize: number;
  batchIndex: number;
  batchId: number;
}
