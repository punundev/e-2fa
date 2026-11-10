import { z } from 'zod';

export const KeyEnvelopeSchema = z.object({
  encryptedDek: z.string().min(10), // Base64
  wrappingIv: z.string().min(8), // Base64 (12 bytes)
  kdf: z.literal('PBKDF2-SHA256'),
  kdfIterations: z.number().int().min(100000),
  salt: z.string().min(16), // Base64 (32 bytes)
  keyVersion: z.number().int().positive().default(1),
  updatedAt: z.number().int().positive(),
});

export type KeyEnvelope = z.infer<typeof KeyEnvelopeSchema>;

export const EncryptedVaultPayloadSchema = z.object({
  version: z.number().int().positive().default(1),
  ciphertext: z.string().min(1), // Base64 ciphertext + tag
  iv: z.string().min(8), // Base64 (12 bytes)
  aad: z.string().optional(), // Base64 authenticated additional data
  itemCount: z.number().int().nonnegative(),
  updatedAt: z.number().int().positive(),
});

export type EncryptedVaultPayload = z.infer<typeof EncryptedVaultPayloadSchema>;

export const RegisterRequestSchema = z.object({
  email: z.string().email().max(255).toLowerCase().trim(),
  password: z.string().min(8).max(128),
  keyEnvelope: KeyEnvelopeSchema.optional(),
  initialVault: EncryptedVaultPayloadSchema.optional(),
  deviceName: z.string().min(1).max(100).optional(),
});

export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

export const LoginRequestSchema = z.object({
  email: z.string().email().max(255).toLowerCase().trim(),
  password: z.string().min(1).max(128),
  deviceName: z.string().min(1).max(100).optional(),
});

export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const RefreshTokenRequestSchema = z.object({
  refreshToken: z.string().min(1),
});

export const SyncPushRequestSchema = z.object({
  deviceId: z.string().uuid().optional(),
  baseRevision: z.number().int().nonnegative(),
  keyEnvelope: KeyEnvelopeSchema.optional(),
  vault: EncryptedVaultPayloadSchema,
  idempotencyKey: z.string().uuid().optional(),
});

export type SyncPushRequest = z.infer<typeof SyncPushRequestSchema>;

export const SyncPullRequestSchema = z.object({
  sinceRevision: z.number().int().nonnegative().default(0),
});

export type SyncPullRequest = z.infer<typeof SyncPullRequestSchema>;

export const DeviceRegisterRequestSchema = z.object({
  deviceName: z.string().min(1).max(100),
  deviceType: z.string().min(1).max(50).default('chrome-extension'),
});

export type DeviceRegisterRequest = z.infer<typeof DeviceRegisterRequestSchema>;

export const ChangePasswordRequestSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
  newKeyEnvelope: KeyEnvelopeSchema,
});

export type ChangePasswordRequest = z.infer<typeof ChangePasswordRequestSchema>;

export const DeleteAccountRequestSchema = z.object({
  confirmation: z.literal('DELETE_MY_ACCOUNT'),
  password: z.string().min(1),
});

export type DeleteAccountRequest = z.infer<typeof DeleteAccountRequestSchema>;

