import protobuf from 'protobufjs/light';
import {
  AuthenticatorAccount,
  GoogleAlgorithm,
  GoogleDigitCount,
  GoogleOtpType,
  HashAlgorithm,
  OtpType,
} from '../types';
import {
  base32ToBytes,
  base64ToBytes,
  bytesToBase32,
  bytesToBase64,
  cleanBase32,
} from './validation';

const PROTO_DESCRIPTOR = {
  nested: {
    MigrationPayload: {
      fields: {
        otpParameters: { rule: 'repeated', type: 'OtpParameters', id: 1 },
        version: { type: 'int32', id: 2 },
        batchSize: { type: 'int32', id: 3 },
        batchIndex: { type: 'int32', id: 4 },
        batchId: { type: 'int32', id: 5 },
      },
      nested: {
        OtpParameters: {
          fields: {
            secret: { type: 'bytes', id: 1 },
            name: { type: 'string', id: 2 },
            issuer: { type: 'string', id: 3 },
            algorithm: { type: 'int32', id: 4 },
            digits: { type: 'int32', id: 5 },
            type: { type: 'int32', id: 6 },
            counter: { type: 'int64', id: 7 },
          },
        },
      },
    },
  },
};

const root = protobuf.Root.fromJSON(PROTO_DESCRIPTOR as any);
const MigrationPayloadType = root.lookupType('MigrationPayload');

export interface MigrationBatch {
  accounts: AuthenticatorAccount[];
  version: number;
  batchSize: number;
  batchIndex: number;
  batchId: number;
}

export function isGoogleMigrationUri(uriString: string): boolean {
  return uriString.trim().toLowerCase().startsWith('otpauth-migration://offline');
}

export function parseGoogleMigrationUri(uriString: string): MigrationBatch {
  const trimmed = uriString.trim();
  if (!isGoogleMigrationUri(trimmed)) {
    throw new Error('Not a valid Google Authenticator migration URI');
  }

  const url = new URL(trimmed);
  const dataParam = url.searchParams.get('data');
  if (!dataParam) {
    throw new Error('Missing data parameter in migration URI');
  }

  const decodedData = decodeURIComponent(dataParam);
  const payloadBytes = base64ToBytes(decodedData);

  const message = MigrationPayloadType.decode(payloadBytes) as any;
  const rawObj = MigrationPayloadType.toObject(message, {
    bytes: Uint8Array,
    longs: Number,
    defaults: true,
  });

  const rawParameters = rawObj.otpParameters || [];
  const accounts: AuthenticatorAccount[] = [];

  for (const item of rawParameters) {
    if (!item.secret || item.secret.length === 0) {
      continue;
    }

    const secretBase32 = bytesToBase32(new Uint8Array(item.secret));

    let algorithm: HashAlgorithm = 'SHA-1';
    if (item.algorithm === GoogleAlgorithm.ALGORITHM_SHA256) {
      algorithm = 'SHA-256';
    } else if (item.algorithm === GoogleAlgorithm.ALGORITHM_SHA512) {
      algorithm = 'SHA-512';
    }

    let digits = 6;
    if (item.digits === GoogleDigitCount.DIGIT_COUNT_EIGHT) {
      digits = 8;
    }

    let type: OtpType = 'totp';
    if (item.type === GoogleOtpType.OTP_TYPE_HOTP) {
      type = 'hotp';
    }

    let name = item.name || '';
    let issuer = item.issuer || '';

    if (name.includes(':') && !issuer) {
      const parts = name.split(':');
      issuer = parts[0].trim();
      name = parts.slice(1).join(':').trim();
    }

    if (!issuer && name) {
      issuer = name;
    }

    accounts.push({
      id: crypto.randomUUID(),
      issuer: issuer || 'Unknown',
      name: name || issuer || 'Account',
      secret: cleanBase32(secretBase32),
      type,
      algorithm,
      digits,
      period: 30,
      counter: Number(item.counter) || 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }

  return {
    accounts,
    version: rawObj.version || 1,
    batchSize: rawObj.batchSize || 1,
    batchIndex: rawObj.batchIndex || 0,
    batchId: rawObj.batchId || 0,
  };
}

export function exportGoogleMigrationUris(
  accounts: AuthenticatorAccount[],
  batchLimit = 10
): string[] {
  if (accounts.length === 0) {
    return [];
  }

  const batches: AuthenticatorAccount[][] = [];
  for (let i = 0; i < accounts.length; i += batchLimit) {
    batches.push(accounts.slice(i, i + batchLimit));
  }

  const batchId = Math.floor(Math.random() * 100000);
  const totalBatches = batches.length;
  const uris: string[] = [];

  for (let idx = 0; idx < batches.length; idx++) {
    const batchAccounts = batches[idx];
    const otpParameters = batchAccounts.map((acc) => {
      let algoNum = GoogleAlgorithm.ALGORITHM_SHA1;
      if (acc.algorithm === 'SHA-256') algoNum = GoogleAlgorithm.ALGORITHM_SHA256;
      if (acc.algorithm === 'SHA-512') algoNum = GoogleAlgorithm.ALGORITHM_SHA512;

      let digitNum = GoogleDigitCount.DIGIT_COUNT_SIX;
      if (acc.digits === 8) digitNum = GoogleDigitCount.DIGIT_COUNT_EIGHT;

      let typeNum = GoogleOtpType.OTP_TYPE_TOTP;
      if (acc.type === 'hotp') typeNum = GoogleOtpType.OTP_TYPE_HOTP;

      const secretBytes = base32ToBytes(acc.secret);

      return {
        secret: secretBytes,
        name: acc.name,
        issuer: acc.issuer,
        algorithm: algoNum,
        digits: digitNum,
        type: typeNum,
        counter: acc.counter || 0,
      };
    });

    const payloadObj = {
      otpParameters,
      version: 1,
      batchSize: totalBatches,
      batchIndex: idx,
      batchId,
    };

    const errMsg = MigrationPayloadType.verify(payloadObj);
    if (errMsg) {
      throw new Error(`Protobuf verification failed: ${errMsg}`);
    }

    const message = MigrationPayloadType.create(payloadObj);
    const encodedBuffer = MigrationPayloadType.encode(message).finish();
    const base64String = bytesToBase64(encodedBuffer);
    const uri = `otpauth-migration://offline?data=${encodeURIComponent(base64String)}`;
    uris.push(uri);
  }

  return uris;
}
