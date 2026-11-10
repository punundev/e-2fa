export type AuthState = 'local' | 'signed_in_sync_disabled' | 'signed_in_sync_enabled';

export interface UserProfile {
  id: string;
  email: string;
  isVerified: boolean;
  createdAt: string;
}

export interface DeviceInfo {
  id: string;
  deviceName: string;
  deviceType: string;
  lastSeenAt: string;
  createdAt: string;
  isCurrent?: boolean;
}

export interface VaultMetadata {
  revision: number;
  itemCount: number;
  payloadVersion: number;
  updatedAt: string;
}

export interface SyncStatus {
  revision: number;
  lastSyncedAt: string | null;
  serverRevision: number;
  hasConflict: boolean;
}

