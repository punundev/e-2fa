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

  const configuredOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  const defaultOrigins = [
    'http://localhost:5000',
    'http://localhost:5173',
    'http://127.0.0.1:5000',
    'http://127.0.0.1:5173',
  ];

  const allowedOrigins = Array.from(new Set([...defaultOrigins, ...configuredOrigins]));

  app.use(
    cors({
      origin: (origin, callback) => {
        // Direct non-browser or curl/worker requests without origin
        if (!origin) {
          return callback(null, true);
        }

        const isExactAllowed = allowedOrigins.includes(origin);
        // Allow extension origins if wildcard configured or explicitly in allowedOrigins list
        const isExtensionOrigin =
          origin.startsWith('chrome-extension://') &&
          (allowedOrigins.includes('*') ||
            allowedOrigins.some(
              (ao) => ao === origin || ao.startsWith('chrome-extension://')
            ));

        // In production, reject wildcard. In dev, allow if configured
        const isWildcardAllowed =
          process.env.NODE_ENV !== 'production' && allowedOrigins.includes('*');

        if (isWildcardAllowed || isExactAllowed || isExtensionOrigin) {
          callback(null, true);
        } else {
          callback(new Error(`Origin ${origin} not allowed by CORS`));
        }
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
