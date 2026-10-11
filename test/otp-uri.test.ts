import { describe, it, expect } from 'vitest';
import { parseOtpUri, formatOtpUri } from '../src/lib/otp-uri';
import { AuthenticatorAccount } from '../src/types';

describe('OTP URI Parser and Formatter', () => {
  it('parses standard otpauth TOTP URI', () => {
    const uri = 'otpauth://totp/GitHub:alice?secret=JBSWY3DPEHPK3PXP&issuer=GitHub&algorithm=SHA1&digits=6&period=30';
    const parsed = parseOtpUri(uri);

    expect(parsed.type).toBe('totp');
    expect(parsed.issuer).toBe('GitHub');
    expect(parsed.name).toBe('alice');
    expect(parsed.secret).toBe('JBSWY3DPEHPK3PXP');
    expect(parsed.algorithm).toBe('SHA-1');
    expect(parsed.digits).toBe(6);
    expect(parsed.period).toBe(30);
  });

  it('parses HOTP URI with initial counter', () => {
    const uri = 'otpauth://hotp/Bank:bob@bank.com?secret=JBSWY3DPEHPK3PXP&issuer=Bank&counter=42&digits=8';
    const parsed = parseOtpUri(uri);

    expect(parsed.type).toBe('hotp');
    expect(parsed.issuer).toBe('Bank');
    expect(parsed.name).toBe('bob@bank.com');
    expect(parsed.digits).toBe(8);
    expect(parsed.counter).toBe(42);
  });

  it('formats account to otpauth URI and performs roundtrip', () => {
    const account: AuthenticatorAccount = {
      id: 'test-1',
      issuer: 'Acme Corp',
      name: 'john.doe',
      secret: 'JBSWY3DPEHPK3PXP',
      type: 'totp',
      algorithm: 'SHA-256',
      digits: 6,
      period: 45,
      counter: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const formatted = formatOtpUri(account);
    const parsed = parseOtpUri(formatted);

    expect(parsed.issuer).toBe('Acme Corp');
    expect(parsed.name).toBe('john.doe');
    expect(parsed.secret).toBe('JBSWY3DPEHPK3PXP');
    expect(parsed.algorithm).toBe('SHA-256');
    expect(parsed.period).toBe(45);
  });

  it('throws on missing secret parameter', () => {
    expect(() => parseOtpUri('otpauth://totp/Test:user')).toThrow('Missing secret');
  });

  it('throws on invalid scheme', () => {
    expect(() => parseOtpUri('https://example.com/totp')).toThrow('must start with otpauth://');
  });
});
