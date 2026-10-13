import { Reader, Writer } from 'protobufjs/light';
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

interface RawOtpParameters {
  secret: Uint8Array;
  name?: string;
  issuer?: string;
  algorithm?: number;
  digits?: number;
  type?: number;
  counter?: number;
}

interface RawMigrationPayload {
  otpParameters: RawOtpParameters[];
  version?: number;
  batchSize?: number;
  batchIndex?: number;
  batchId?: number;
}

function decodeOtpParameters(reader: Reader, length: number): RawOtpParameters {
  const end = length !== undefined ? reader.pos + length : reader.len;
  const message: RawOtpParameters = {
    secret: new Uint8Array(0),
    name: '',
    issuer: '',
    algorithm: 0,
    digits: 0,
    type: 0,
    counter: 0,
  };
  while (reader.pos < end) {
    const tag = reader.uint32();
    switch (tag >>> 3) {
      case 1:
        message.secret = reader.bytes();
        break;
      case 2:
        message.name = reader.string();
        break;
      case 3:
        message.issuer = reader.string();
        break;
      case 4:
        message.algorithm = reader.int32();
        break;
      case 5:
        message.digits = reader.int32();
        break;
      case 6:
        message.type = reader.int32();
        break;
      case 7:
        message.counter = Number(reader.int64());
        break;
      default:
        reader.skipType(tag & 7);
        break;
    }
  }
  return message;
}

function decodeMigrationPayload(reader: Reader, length?: number): RawMigrationPayload {
  const end = length !== undefined ? reader.pos + length : reader.len;
  const message: RawMigrationPayload = {
    otpParameters: [],
    version: 0,
    batchSize: 0,
    batchIndex: 0,
    batchId: 0,
  };
  while (reader.pos < end) {
    const tag = reader.uint32();
    switch (tag >>> 3) {
      case 1:
        message.otpParameters.push(decodeOtpParameters(reader, reader.uint32()));
        break;
      case 2:
        message.version = reader.int32();
        break;
      case 3:
        message.batchSize = reader.int32();
        break;
      case 4:
        message.batchIndex = reader.int32();
        break;
      case 5:
        message.batchId = reader.int32();
        break;
      default:
        reader.skipType(tag & 7);
        break;
    }
  }
  return message;
}

function encodeOtpParameters(message: RawOtpParameters, writer: Writer = Writer.create()): Writer {
  if (message.secret && message.secret.length) {
    writer.uint32(10).bytes(message.secret);
  }
  if (message.name) {
    writer.uint32(18).string(message.name);
  }
  if (message.issuer) {
    writer.uint32(26).string(message.issuer);
  }
  if (message.algorithm) {
    writer.uint32(32).int32(message.algorithm);
  }
  if (message.digits) {
    writer.uint32(40).int32(message.digits);
  }
  if (message.type) {
    writer.uint32(48).int32(message.type);
  }
  if (message.counter) {
    writer.uint32(56).int64(message.counter);
  }
  return writer;
}

function encodeMigrationPayload(message: RawMigrationPayload, writer: Writer = Writer.create()): Writer {
  if (message.otpParameters && message.otpParameters.length) {
    for (let i = 0; i < message.otpParameters.length; ++i) {
      encodeOtpParameters(message.otpParameters[i], writer.uint32(10).fork()).ldelim();
    }
  }
  if (message.version) {
    writer.uint32(16).int32(message.version);
  }
  if (message.batchSize) {
    writer.uint32(24).int32(message.batchSize);
  }
  if (message.batchIndex) {
    writer.uint32(32).int32(message.batchIndex);
  }
  if (message.batchId) {
    writer.uint32(40).int32(message.batchId);
  }
  return writer;
}

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

  let rawData = '';
  const match = trimmed.match(/[?&]data=([^&#]+)/);
  if (match) {
    rawData = match[1];
  } else {
    const url = new URL(trimmed);
    rawData = url.searchParams.get('data') || '';
  }
  if (!rawData) {
    throw new Error('Missing data parameter in migration URI');
  }

  let decodedData: string;
  try {
    decodedData = decodeURIComponent(rawData);
  } catch {
    decodedData = rawData;
  }
  const payloadBytes = base64ToBytes(decodedData);

  const reader = Reader.create(payloadBytes);
  const rawObj = decodeMigrationPayload(reader);

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
    const otpParameters: RawOtpParameters[] = batchAccounts.map((acc) => {
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

    const payloadObj: RawMigrationPayload = {
      otpParameters,
      version: 1,
      batchSize: totalBatches,
      batchIndex: idx,
      batchId,
    };

    const encodedBuffer = encodeMigrationPayload(payloadObj).finish();
    const base64String = bytesToBase64(encodedBuffer);
    const uri = `otpauth-migration://offline?data=${encodeURIComponent(base64String)}`;
    uris.push(uri);
  }

  return uris;
}
