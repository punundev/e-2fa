import { HashAlgorithm } from '../types';
import { base32ToBytes } from './validation';

function counterToBytes(counter: number | bigint): Uint8Array {
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  const bigIntCounter = BigInt(counter);
  view.setBigUint64(0, bigIntCounter, false);
  return new Uint8Array(buffer);
}

export async function generateHotp(
  secretBase32: string,
  counter: number | bigint,
  options: {
    digits?: number;
    algorithm?: HashAlgorithm;
  } = {}
): Promise<string> {
  const digits = options.digits ?? 6;
  const algorithm = options.algorithm ?? 'SHA-1';

  if (digits !== 6 && digits !== 8) {
    throw new Error('Digits must be either 6 or 8');
  }

  const keyBytes = base32ToBytes(secretBase32);
  const counterBytes = counterToBytes(counter);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes as any,
    { name: 'HMAC', hash: { name: algorithm } },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, counterBytes as any);
  const hmacBytes = new Uint8Array(signature);

  const offset = hmacBytes[hmacBytes.length - 1] & 0x0f;
  const binary =
    ((hmacBytes[offset] & 0x7f) << 24) |
    ((hmacBytes[offset + 1] & 0xff) << 16) |
    ((hmacBytes[offset + 2] & 0xff) << 8) |
    (hmacBytes[offset + 3] & 0xff);

  const otp = binary % 10 ** digits;
  return otp.toString().padStart(digits, '0');
}
