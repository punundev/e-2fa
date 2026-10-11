import { AuthenticatorAccount, HashAlgorithm, OtpType } from '../types';
import { cleanBase32, isValidBase32 } from './validation';

export interface ParsedOtpUri {
  type: OtpType;
  label: string;
  issuer: string;
  name: string;
  secret: string;
  algorithm: HashAlgorithm;
  digits: number;
  period: number;
  counter: number;
}

export function parseOtpUri(uriString: string): ParsedOtpUri {
  const trimmed = uriString.trim();
  if (!trimmed.toLowerCase().startsWith('otpauth://')) {
    throw new Error('URI must start with otpauth://');
  }

  const url = new URL(trimmed);
  const typeStr = url.host.toLowerCase();
  if (typeStr !== 'totp' && typeStr !== 'hotp') {
    throw new Error(`Unsupported OTP type: ${typeStr}`);
  }
  const type: OtpType = typeStr;

  const rawLabel = decodeURIComponent(url.pathname.replace(/^\//, ''));
  let labelIssuer = '';
  let labelName = rawLabel;

  if (rawLabel.includes(':')) {
    const parts = rawLabel.split(':');
    labelIssuer = parts[0].trim();
    labelName = parts.slice(1).join(':').trim();
  }

  const secretParam = url.searchParams.get('secret');
  if (!secretParam) {
    throw new Error('Missing secret parameter in OTP URI');
  }

  const cleanedSecret = cleanBase32(secretParam);
  if (!isValidBase32(cleanedSecret)) {
    throw new Error('Invalid Base32 secret in OTP URI');
  }

  const issuerParam = url.searchParams.get('issuer')?.trim();
  const issuer = issuerParam || labelIssuer || 'Unknown';
  const name = labelName || issuer;

  const rawAlgo = (url.searchParams.get('algorithm') || 'SHA1').toUpperCase().replace('-', '');
  let algorithm: HashAlgorithm = 'SHA-1';
  if (rawAlgo === 'SHA256') {
    algorithm = 'SHA-256';
  } else if (rawAlgo === 'SHA512') {
    algorithm = 'SHA-512';
  } else if (rawAlgo === 'SHA1') {
    algorithm = 'SHA-1';
  } else {
    throw new Error(`Unsupported algorithm: ${rawAlgo}`);
  }

  const digitsParam = url.searchParams.get('digits');
  const digits = digitsParam ? parseInt(digitsParam, 10) : 6;
  if (digits !== 6 && digits !== 8) {
    throw new Error(`Unsupported digits: ${digits}`);
  }

  const periodParam = url.searchParams.get('period');
  const period = periodParam ? parseInt(periodParam, 10) : 30;
  if (isNaN(period) || period <= 0) {
    throw new Error(`Invalid period: ${periodParam}`);
  }

  const counterParam = url.searchParams.get('counter');
  const counter = counterParam ? parseInt(counterParam, 10) : 0;
  if (type === 'hotp' && (isNaN(counter) || counter < 0)) {
    throw new Error(`Invalid counter for HOTP: ${counterParam}`);
  }

  return {
    type,
    label: rawLabel,
    issuer,
    name,
    secret: cleanedSecret,
    algorithm,
    digits,
    period,
    counter,
  };
}

export function formatOtpUri(account: AuthenticatorAccount): string {
  const issuer = account.issuer.trim() || 'Unknown';
  const name = account.name.trim() || issuer;
  const label = encodeURIComponent(`${issuer}:${name}`);

  const url = new URL(`otpauth://${account.type}/${label}`);
  url.searchParams.set('secret', cleanBase32(account.secret));
  url.searchParams.set('issuer', issuer);
  url.searchParams.set('algorithm', account.algorithm.replace('-', ''));
  url.searchParams.set('digits', account.digits.toString());

  if (account.type === 'totp') {
    url.searchParams.set('period', account.period.toString());
  } else {
    url.searchParams.set('counter', account.counter.toString());
  }

  return url.toString();
}
