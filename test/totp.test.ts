import { describe, it, expect } from 'vitest';
import { generateTotp, getTotpRemainingSeconds, getTotpProgress } from '../src/lib/totp';

describe('RFC 6238 TOTP Generator', () => {
  // RFC 6238 Appendix B test seed for SHA-1: "12345678901234567890" (20 bytes)
  const RFC_SECRET_BASE32 = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

  it('matches RFC 6238 reference 8-digit test vectors for SHA-1', async () => {
    const testCases = [
      { time: 59, expected: '94287082' },
      { time: 1111111109, expected: '07081804' }, // leading zero check!
      { time: 1111111111, expected: '14050471' },
      { time: 1234567890, expected: '89005924' },
      { time: 2000000000, expected: '69279037' },
    ];

    for (const { time, expected } of testCases) {
      const code = await generateTotp(RFC_SECRET_BASE32, {
        timestamp: time * 1000,
        period: 30,
        digits: 8,
        algorithm: 'SHA-1',
      });
      expect(code).toBe(expected);
    }
  });

  it('matches 6-digit TOTP codes including leading zeros', async () => {
    // 59s -> step 1 -> code 287082
    const code1 = await generateTotp(RFC_SECRET_BASE32, {
      timestamp: 59 * 1000,
      period: 30,
      digits: 6,
    });
    expect(code1).toBe('287082');

    // 1111111109s -> 081804 (leading zero preserved)
    const code2 = await generateTotp(RFC_SECRET_BASE32, {
      timestamp: 1111111109 * 1000,
      period: 30,
      digits: 6,
    });
    expect(code2).toBe('081804');
    expect(code2.startsWith('0')).toBe(true);

    // 1234567890s -> 005924 (two leading zeros preserved)
    const code3 = await generateTotp(RFC_SECRET_BASE32, {
      timestamp: 1234567890 * 1000,
      period: 30,
      digits: 6,
    });
    expect(code3).toBe('005924');
    expect(code3.startsWith('00')).toBe(true);
  });

  it('calculates remaining seconds and progress correctly', () => {
    // At 29 seconds, remaining in 30s period is 1
    const rem1 = getTotpRemainingSeconds(29 * 1000, 30);
    expect(rem1).toBe(1);

    // At 30 seconds, remaining in 30s period is 30
    const rem2 = getTotpRemainingSeconds(30 * 1000, 30);
    expect(rem2).toBe(30);

    const progress = getTotpProgress(15 * 1000, 30);
    expect(progress).toBe(50);
  });
});
