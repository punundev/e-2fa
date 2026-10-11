import { HashAlgorithm } from '../types';
import { generateHotp } from './hotp';

export interface TotpOptions {
  period?: number;
  digits?: number;
  algorithm?: HashAlgorithm;
  timestamp?: number;
}

export function getTotpCounter(timestamp: number, period: number): number {
  return Math.floor(timestamp / 1000 / period);
}

export function getTotpRemainingSeconds(timestamp: number, period: number): number {
  const seconds = Math.floor(timestamp / 1000);
  const elapsed = seconds % period;
  return period - elapsed;
}

export function getTotpProgress(timestamp: number, period: number): number {
  const remaining = getTotpRemainingSeconds(timestamp, period);
  return (remaining / period) * 100;
}

export async function generateTotp(
  secretBase32: string,
  options: TotpOptions = {}
): Promise<string> {
  const period = options.period ?? 30;
  const digits = options.digits ?? 6;
  const algorithm = options.algorithm ?? 'SHA-1';
  const timestamp = options.timestamp ?? Date.now();

  const counter = getTotpCounter(timestamp, period);

  return generateHotp(secretBase32, counter, {
    digits,
    algorithm,
  });
}
