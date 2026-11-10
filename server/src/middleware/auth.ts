import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { queryOne } from '../database/index';

export interface AuthenticatedUser {
  id: string;
  email: string;
  deviceId?: string;
}

export interface AuthRequest extends Request {
  user?: AuthenticatedUser;
}

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET must be defined in production!');
    }
    return 'dev-insecure-jwt-secret-replace-in-production-min32chars';
  }
  return secret;
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or malformed Authorization header' });
    return;
  }

  const token = authHeader.substring(7).trim();
  try {
    const payload = jwt.verify(token, getJwtSecret()) as {
      sub: string;
      email: string;
      deviceId?: string;
      type?: string;
    };

    if (payload.type && payload.type !== 'access') {
      res.status(401).json({ error: 'Invalid token type' });
      return;
    }

    if (payload.deviceId) {
      const device = await queryOne(
        'SELECT id, revoked_at FROM devices WHERE id = $1 AND user_id = $2',
        [payload.deviceId, payload.sub]
      );
      if (!device || device.revoked_at !== null) {
        res.status(401).json({ error: 'Device has been revoked or removed' });
        return;
      }
    }

    req.user = {
      id: payload.sub,
      email: payload.email,
      deviceId: payload.deviceId,
    };
    next();
  } catch (err: any) {
    res.status(401).json({ error: 'Invalid or expired token', message: err.message });
  }
}
