import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { authRouter } from './routes/auth';
import { vaultRouter } from './routes/vault';
import { syncRouter } from './routes/sync';
import { deviceRouter } from './routes/device';
import { requireAuth, AuthRequest } from './middleware/auth';
import { MAX_VAULT_PAYLOAD_BYTES } from '../../shared/constants/index';

export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow all origins including chrome-extension://, file://, localhost, etc.
        callback(null, true);
      },
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
    })
  );

  app.use(express.json({ limit: MAX_VAULT_PAYLOAD_BYTES }));

  // Security Headers
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // Health check
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'secureauth-api',
      timestamp: new Date().toISOString(),
    });
  });

  // Root greeting
  app.get('/', (_req: Request, res: Response) => {
    res.json({
      name: 'SecureAuth 2FA Cloud API',
      status: 'online',
      version: '1.0.14',
      documentation: 'https://github.com/pleisvay/e-2fa',
      health: '/api/health',
    });
  });

  // API Routes
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/vault', vaultRouter);
  app.use('/api/v1/sync', syncRouter);
  app.use('/api/v1/devices', deviceRouter);

  // Account Profile
  app.get('/api/v1/account', requireAuth, (req: AuthRequest, res: Response) => {
    res.json({
      user: {
        id: req.user?.id,
        email: req.user?.email,
      },
    });
  });

  // 404 handler
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Endpoint not found' });
  });

  // Error handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    res.status(err.status || 500).json({
      error: err.message || 'Internal server error',
    });
  });

  return app;
}
