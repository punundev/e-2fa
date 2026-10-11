import { describe, it, expect } from 'vitest';
import { parseImportString } from '../src/lib/import-export';
import { generateTotp } from '../src/lib/totp';

describe('Import Export JSON Parser', () => {
  it('parses third-party authenticator 2.0 JSON export format correctly', async () => {
    const jsonPayload = JSON.stringify({
      version: '2.0',
      exportDate: '2026-10-11T00:17:37.357Z',
      appVersion: '1.15.0',
      accountCount: 3,
      accounts: [
        {
          algorithm: 'SHA1',
          color: '#f97316',
          createdAt: 1791653174364,
          digits: 6,
          id: '17916531743640rn32d',
          issuer: 'Netlify',
          name: 'lunaharrison2a@gmail.com',
          period: 30,
          secret: '2FLCQZIT5XCQDGIHWWNOVDFNU5IHLTYN',
        },
        {
          algorithm: 'SHA1',
          color: '#10b981',
          createdAt: 1791653174365,
          digits: 6,
          id: '1791653174364135layp',
          issuer: 'Brevo',
          name: 'lunaharrison2a@gmail.com',
          period: 30,
          secret: 'JNIDCKUQRHREXB2ROGLNW76745ZTIZW636JX4DS6T25IREJMBOIQ====',
        },
        {
          algorithm: 'SHA1',
          color: '#6366f1',
          createdAt: 1791653174366,
          digits: 6,
          id: '17916531743642p5gxs',
          issuer: 'GitHub',
          name: 'nesatkroper',
          period: 30,
          secret: 'KUV72Z4QIPP3JI6I',
        },
      ],
    });

    const accounts = await parseImportString(jsonPayload);
    expect(accounts).toHaveLength(3);

    expect(accounts[0].issuer).toBe('Netlify');
    expect(accounts[0].algorithm).toBe('SHA-1');
    expect(accounts[0].type).toBe('totp');
    expect(accounts[0].digits).toBe(6);
    expect(accounts[0].period).toBe(30);

    expect(accounts[1].secret).toBe('JNIDCKUQRHREXB2ROGLNW76745ZTIZW636JX4DS6T25IREJMBOIQ');
    expect(accounts[1].algorithm).toBe('SHA-1');

    for (const acc of accounts) {
      const code = await generateTotp(acc.secret, {
        period: acc.period,
        digits: acc.digits,
        algorithm: acc.algorithm,
      });
      expect(code).toMatch(/^[0-9]{6}$/);
    }
  });

  it('parses real 43 accounts backup JSON file when present', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.resolve(__dirname, '../authenticator-backup-2026-10-11.json');
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      const accounts = await parseImportString(content);
      expect(accounts).toHaveLength(43);
      expect(accounts[0].issuer).toBe('Netlify');
      expect(accounts[1].issuer).toBe('Brevo');
      expect(accounts[42].issuer).toBe('gitlab.com');
    }
  });
});
