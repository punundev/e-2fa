import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { createApp } from '../server/src/app';
import { copyToClipboardWithAutoClear } from '../src/lib/clipboard';
import {
  rateLimiter,
  setRateLimitStore,
  RateLimitStore,
} from '../server/src/middleware/rate-limit';

describe('Security Remediation Regression Suite', () => {
  describe('SEC-001: Git Backup Exclusion & Secret Containment', () => {
    it('verifies exposed plaintext backup is removed from working tree', () => {
      const backupPath = path.resolve(__dirname, '../authenticator-backup-2026-10-11.json');
      expect(fs.existsSync(backupPath)).toBe(false);
    });

    it('verifies .gitignore contains backup file exclusions', () => {
      const gitignore = fs.readFileSync(path.resolve(__dirname, '../.gitignore'), 'utf8');
      expect(gitignore).toContain('*backup*.json');
      expect(gitignore).toContain('*.backup');
    });
  });

  describe('SEC-002: Manifest Host Permissions', () => {
    it('verifies manifest.json only grants specific API host permissions and uses optional permissions', () => {
      const manifest = JSON.parse(
        fs.readFileSync(path.resolve(__dirname, '../manifest.json'), 'utf8')
      );
      expect(manifest.host_permissions).not.toContain('https://*/*');
      expect(manifest.host_permissions).not.toContain('http://*/*');
      expect(manifest.host_permissions).toContain('https://2fa.synergykh.site/*');
      expect(manifest.optional_host_permissions).toBeDefined();
    });

    it('verifies public/manifest.json matches hardened host permissions', () => {
      const manifest = JSON.parse(
        fs.readFileSync(path.resolve(__dirname, '../public/manifest.json'), 'utf8')
      );
      expect(manifest.host_permissions).not.toContain('https://*/*');
      expect(manifest.host_permissions).not.toContain('http://*/*');
      expect(manifest.host_permissions).toContain('https://2fa.synergykh.site/*');
    });
  });

  describe('SEC-003: Strict CORS Validation', () => {
    let originalEnv: string | undefined;

    beforeEach(() => {
      originalEnv = process.env.CORS_ALLOWED_ORIGINS;
      process.env.CORS_ALLOWED_ORIGINS = 'http://localhost:5000,http://localhost:5173,chrome-extension://testextensionid';
    });

    afterEach(() => {
      process.env.CORS_ALLOWED_ORIGINS = originalEnv;
    });

    it('allows requests from localhost dev servers', async () => {
      const app = createApp();
      const res = await request(app)
        .get('/api/health')
        .set('Origin', 'http://localhost:5173');
      expect(res.status).toBe(200);
      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    });

    it('allows requests from whitelisted Chrome extension ID', async () => {
      const app = createApp();
      const res = await request(app)
        .get('/api/health')
        .set('Origin', 'chrome-extension://testextensionid');
      expect(res.status).toBe(200);
      expect(res.headers['access-control-allow-origin']).toBe('chrome-extension://testextensionid');
    });

    it('rejects unauthorized external web origins', async () => {
      const app = createApp();
      const res = await request(app)
        .get('/api/health')
        .set('Origin', 'https://malicious-attacker-site.com');
      expect(res.status).toBe(500);
      expect(res.body.error).toContain('not allowed by CORS');
    });
  });

  describe('SEC-004: Clipboard Auto-Clearing', () => {
    let mockClipboardText = '';

    beforeEach(() => {
      vi.useFakeTimers();
      mockClipboardText = '';
      Object.defineProperty(globalThis, 'navigator', {
        value: {
          clipboard: {
            writeText: vi.fn(async (val: string) => {
              mockClipboardText = val;
            }),
            readText: vi.fn(async () => mockClipboardText),
          },
        },
        configurable: true,
        writable: true,
      });
    });

    it('automatically clears copied TOTP code after the configured delay', async () => {
      const success = await copyToClipboardWithAutoClear('123456', 5);
      expect(success).toBe(true);
      expect(mockClipboardText).toBe('123456');

      // Fast-forward 4 seconds - still present
      await vi.advanceTimersByTimeAsync(4000);
      expect(mockClipboardText).toBe('123456');

      // Fast-forward past 5 seconds - auto cleared
      await vi.advanceTimersByTimeAsync(2000);
      expect(mockClipboardText).toBe('');
    });

    it('does NOT overwrite clipboard if another application updated the clipboard', async () => {
      await copyToClipboardWithAutoClear('654321', 5);
      expect(mockClipboardText).toBe('654321');

      // Another app copies something else
      mockClipboardText = 'NewExternalClipboardContent';

      // Advance timers
      await vi.advanceTimersByTimeAsync(6000);
      expect(mockClipboardText).toBe('NewExternalClipboardContent');
    });

    it('handles multiple rapid copy events safely with new timer', async () => {
      await copyToClipboardWithAutoClear('FIRST_CODE', 5);
      await vi.advanceTimersByTimeAsync(2000);

      // Rapidly copy second code
      await copyToClipboardWithAutoClear('SECOND_CODE', 5);
      expect(mockClipboardText).toBe('SECOND_CODE');

      // After 3 more seconds (5s total from first, but only 3s from second) - must remain
      await vi.advanceTimersByTimeAsync(3000);
      expect(mockClipboardText).toBe('SECOND_CODE');

      // Advance past second timer
      await vi.advanceTimersByTimeAsync(3000);
      expect(mockClipboardText).toBe('');
    });
  });

  describe('SEC-006: Distributed Rate Limiting & Outage Resilience', () => {
    it('blocks requests exceeding limit when store reports count > max', async () => {
      const mockStore: RateLimitStore = {
        increment: vi.fn(async () => ({ count: 35, resetAt: Date.now() + 10000 })),
      };
      setRateLimitStore(mockStore);

      const limiter = rateLimiter({ windowMs: 60000, max: 30, message: 'Rate limit exceeded' });
      const req: any = { ip: '1.2.3.4', socket: {} };
      const res: any = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const next = vi.fn();

      await limiter(req, res, next);
      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith({ error: 'Rate limit exceeded' });
      expect(next).not.toHaveBeenCalled();
    });

    it('fails safely and allows request if rate limit store experiences an unexpected error', async () => {
      const failingStore: RateLimitStore = {
        increment: vi.fn(async () => {
          throw new Error('Redis connection refused');
        }),
      };
      setRateLimitStore(failingStore);

      const limiter = rateLimiter({ windowMs: 60000, max: 30 });
      const req: any = { ip: '1.2.3.4', socket: {} };
      const res: any = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const next = vi.fn();

      await limiter(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();

      // Reset store to memory
      setRateLimitStore(null);
    });
  });
});
