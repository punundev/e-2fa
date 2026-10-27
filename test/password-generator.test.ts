import { describe, it, expect, beforeEach } from 'vitest';
import {
  generatePassword,
  getSessionPassword,
  setSessionPassword,
  clearSessionPassword,
  getSessionPasswordOptions,
  setSessionPasswordOptions,
  PASSWORD_LENGTH_PRESETS,
  CHARSET_UPPERCASE,
  CHARSET_LOWERCASE,
  CHARSET_NUMBERS,
  CHARSET_SYMBOLS,
} from '../src/lib/password-generator';

describe('Password Generator', () => {
  beforeEach(() => {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.clear();
    }
  });

  it('defaults to symbols unchecked and generates alphanumeric by default', () => {
    const opts = getSessionPasswordOptions();
    expect(opts.symbols).toBe(false);

    const pwd = generatePassword();
    expect(pwd.length).toBe(32);
    const hasSym = [...pwd].some((c) => CHARSET_SYMBOLS.includes(c));
    expect(hasSym).toBe(false);
  });

  it('generates passwords of default length 32', () => {
    const pwd = generatePassword();
    expect(pwd.length).toBe(32);
  });

  it('generates passwords of length presets 32, 64, 128, 256', () => {
    for (const len of PASSWORD_LENGTH_PRESETS) {
      const pwd = generatePassword({ length: len });
      expect(pwd.length).toBe(len);
    }
  });

  it('enforces minimum length of 32', () => {
    const pwd = generatePassword({ length: 16 });
    expect(pwd.length).toBe(32);
  });

  it('enforces maximum length of 256', () => {
    const pwd = generatePassword({ length: 500 });
    expect(pwd.length).toBe(256);
  });

  it('mixes strong character sets (uppercase, lowercase, numbers, symbols)', () => {
    const pwd = generatePassword({
      length: 64,
      uppercase: true,
      lowercase: true,
      numbers: true,
      symbols: true,
    });

    const hasUpper = [...pwd].some((c) => CHARSET_UPPERCASE.includes(c));
    const hasLower = [...pwd].some((c) => CHARSET_LOWERCASE.includes(c));
    const hasNum = [...pwd].some((c) => CHARSET_NUMBERS.includes(c));
    const hasSym = [...pwd].some((c) => CHARSET_SYMBOLS.includes(c));

    expect(hasUpper).toBe(true);
    expect(hasLower).toBe(true);
    expect(hasNum).toBe(true);
    expect(hasSym).toBe(true);
  });

  it('handles custom character selection', () => {
    const pwd = generatePassword({
      length: 32,
      uppercase: true,
      lowercase: false,
      numbers: false,
      symbols: false,
    });

    expect(pwd.length).toBe(32);
    const allUpper = [...pwd].every((c) => CHARSET_UPPERCASE.includes(c));
    expect(allUpper).toBe(true);
  });

  it('stores and retrieves password from session storage', () => {
    const pwd = generatePassword({ length: 64 });
    setSessionPassword(pwd);
    expect(getSessionPassword()).toBe(pwd);

    clearSessionPassword();
    expect(getSessionPassword()).toBeNull();
  });

  it('persists and retrieves options in session storage', () => {
    const options = {
      length: 128,
      uppercase: true,
      lowercase: true,
      numbers: true,
      symbols: false,
    };
    setSessionPasswordOptions(options);
    const retrieved = getSessionPasswordOptions();
    expect(retrieved.length).toBe(128);
    expect(retrieved.symbols).toBe(false);
  });
});
