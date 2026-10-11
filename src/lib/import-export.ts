import { AuthenticatorAccount, EncryptedBackupEnvelope, PlaintextBackupPayload } from '../types';
import { parseOtpUri, formatOtpUri } from './otp-uri';
import { isGoogleMigrationUri, parseGoogleMigrationUri } from './google-migration';
import { createEncryptedBackup, restoreEncryptedBackup } from './crypto';
import { cleanBase32 } from './validation';

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  duplicateType: 'exact' | 'conflict' | 'none';
  existingAccount?: AuthenticatorAccount;
}

export function checkDuplicate(
  candidate: AuthenticatorAccount,
  existingList: AuthenticatorAccount[]
): DuplicateCheckResult {
  const normCandidateIssuer = candidate.issuer.trim().toLowerCase();
  const normCandidateName = candidate.name.trim().toLowerCase();
  const normCandidateSecret = cleanBase32(candidate.secret);

  for (const item of existingList) {
    const normItemIssuer = item.issuer.trim().toLowerCase();
    const normItemName = item.name.trim().toLowerCase();
    const normItemSecret = cleanBase32(item.secret);

    if (
      normItemIssuer === normCandidateIssuer &&
      normItemName === normCandidateName
    ) {
      if (normItemSecret === normCandidateSecret) {
        return {
          isDuplicate: true,
          duplicateType: 'exact',
          existingAccount: item,
        };
      }
      return {
        isDuplicate: true,
        duplicateType: 'conflict',
        existingAccount: item,
      };
    }

    if (normItemSecret === normCandidateSecret) {
      return {
        isDuplicate: true,
        duplicateType: 'exact',
        existingAccount: item,
      };
    }
  }

  return {
    isDuplicate: false,
    duplicateType: 'none',
  };
}

function normalizeImportedAccount(raw: any): AuthenticatorAccount {
  const type = raw.type === 'hotp' ? 'hotp' : 'totp';
  let algorithm: 'SHA-1' | 'SHA-256' | 'SHA-512' = 'SHA-1';
  const rawAlgo = String(raw.algorithm || 'SHA-1').toUpperCase().replace(/[-_]/g, '');
  if (rawAlgo === 'SHA256') algorithm = 'SHA-256';
  else if (rawAlgo === 'SHA512') algorithm = 'SHA-512';
  else algorithm = 'SHA-1';

  const digits = raw.digits === 8 ? 8 : 6;
  const period = typeof raw.period === 'number' && raw.period > 0 ? raw.period : 30;
  const counter = typeof raw.counter === 'number' && raw.counter >= 0 ? raw.counter : 0;
  const issuer = String(raw.issuer || raw.name || 'Unknown').trim();
  const name = String(raw.name || raw.issuer || 'Account').trim();
  const secret = cleanBase32(String(raw.secret || ''));
  const id = typeof raw.id === 'string' && raw.id.trim() ? raw.id : crypto.randomUUID();
  const createdAt = typeof raw.createdAt === 'number' ? raw.createdAt : Date.now();
  const updatedAt = typeof raw.updatedAt === 'number' ? raw.updatedAt : Date.now();

  return {
    id,
    issuer,
    name,
    secret,
    type,
    algorithm,
    digits,
    period,
    counter,
    group: raw.group || undefined,
    isPinned: Boolean(raw.isPinned),
    createdAt,
    updatedAt,
  };
}

export async function parseImportString(
  input: string,
  backupPassword?: string
): Promise<AuthenticatorAccount[]> {
  const trimmed = input.trim();

  if (isGoogleMigrationUri(trimmed)) {
    const batch = parseGoogleMigrationUri(trimmed);
    return batch.accounts;
  }

  if (trimmed.toLowerCase().startsWith('otpauth://')) {
    const parsed = parseOtpUri(trimmed);
    return [
      {
        id: crypto.randomUUID(),
        issuer: parsed.issuer,
        name: parsed.name,
        secret: parsed.secret,
        type: parsed.type,
        algorithm: parsed.algorithm,
        digits: parsed.digits,
        period: parsed.period,
        counter: parsed.counter,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];
  }

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    const parsedObj = JSON.parse(trimmed);

    if (parsedObj.format === 'secureauth-backup') {
      if (!backupPassword) {
        throw new Error('PASSWORD_REQUIRED');
      }
      const decryptedJson = await restoreEncryptedBackup(
        parsedObj as EncryptedBackupEnvelope,
        backupPassword
      );
      const payload: PlaintextBackupPayload = JSON.parse(decryptedJson);
      return (payload.accounts || []).map(normalizeImportedAccount);
    }

    if (Array.isArray(parsedObj.accounts)) {
      return parsedObj.accounts.map(normalizeImportedAccount);
    }

    if (Array.isArray(parsedObj)) {
      return parsedObj.map(normalizeImportedAccount);
    }
  }

  throw new Error('Unrecognized import format');
}

export async function createBackupBlob(
  accounts: AuthenticatorAccount[],
  password: string
): Promise<Blob> {
  const payload: PlaintextBackupPayload = {
    version: 1,
    exportedAt: Date.now(),
    accounts,
  };
  const envelope = await createEncryptedBackup(JSON.stringify(payload), password);
  return new Blob([JSON.stringify(envelope, null, 2)], {
    type: 'application/json',
  });
}

export function createPlaintextJsonBlob(accounts: AuthenticatorAccount[]): Blob {
  const payload: PlaintextBackupPayload = {
    version: 1,
    exportedAt: Date.now(),
    accounts,
  };
  return new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  });
}

export function createCsvBlob(accounts: AuthenticatorAccount[], includeSecrets = false): Blob {
  const headers = ['Issuer', 'Account Name', 'Type', 'Algorithm', 'Digits', 'Period', 'Counter'];
  if (includeSecrets) {
    headers.push('Secret');
  }

  const rows = accounts.map((acc) => {
    const row = [
      `"${acc.issuer.replace(/"/g, '""')}"`,
      `"${acc.name.replace(/"/g, '""')}"`,
      acc.type,
      acc.algorithm,
      acc.digits,
      acc.period,
      acc.counter,
    ];
    if (includeSecrets) {
      row.push(`"${cleanBase32(acc.secret)}"`);
    }
    return row.join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\n');
  return new Blob([csvContent], { type: 'text/csv' });
}

export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

export function exportAsOtpAuthUris(accounts: AuthenticatorAccount[]): string[] {
  return accounts.map(formatOtpUri);
}
