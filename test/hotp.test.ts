import { describe, it, expect } from 'vitest';
import { generateHotp } from '../src/lib/hotp';

describe('RFC 4226 HOTP Generator', () => {
  // Secret: "12345678901234567890" (ASCII 20 bytes)
  // Base32: GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ
  const RFC_SECRET_BASE32 = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

  const RFC_EXPECTED_CODES = [
    '755224', // Counter 0
    '287082', // Counter 1
    '359152', // Counter 2
    '969429', // Counter 3
    '338314', // Counter 4
    '254676', // Counter 5
    '287922', // Counter 6
    '162583', // Counter 7
    '399871', // Counter 8
    '520489', // Counter 9
  ];

  it('matches RFC 4226 reference test vectors for counters 0 through 9', async () => {
    for (let counter = 0; counter < RFC_EXPECTED_CODES.length; counter++) {
      const code = await generateHotp(RFC_SECRET_BASE32, counter, {
        digits: 6,
        algorithm: 'SHA-1',
      });
      expect(code).toBe(RFC_EXPECTED_CODES[counter]);
    }
  });

  it('generates correct 8-digit codes', async () => {
    const code = await generateHotp(RFC_SECRET_BASE32, 0, {
      digits: 8,
      algorithm: 'SHA-1',
    });
    expect(code).toBe('84755224');
  });

  it('handles SHA-256 and SHA-512 algorithms', async () => {
    const sha256Code = await generateHotp(RFC_SECRET_BASE32, 1, {
      digits: 6,
      algorithm: 'SHA-256',
    });
    expect(sha256Code).toHaveLength(6);

    const sha512Code = await generateHotp(RFC_SECRET_BASE32, 1, {
      digits: 6,
      algorithm: 'SHA-512',
    });
    expect(sha512Code).toHaveLength(6);
  });

  it('rejects unsupported digit lengths', async () => {
    await expect(
      generateHotp(RFC_SECRET_BASE32, 0, { digits: 7 as any })
    ).rejects.toThrow('Digits must be either 6 or 8');
  });
});
