import { Router, Request, Response } from 'express';
import { AuthService } from '../services/auth';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { rateLimiter } from '../middleware/rate-limit';
import {
  RegisterRequestSchema,
  LoginRequestSchema,
  RefreshTokenRequestSchema,
  DeleteAccountRequestSchema,
} from '../../../shared/schemas/index';

export const authRouter = Router();

const authLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: 'Too many authentication attempts. Please try again later.',
});

authRouter.post('/register', authLimiter, async (req: Request, res: Response) => {
  try {
    const parsed = RegisterRequestSchema.parse(req.body);
    const result = await AuthService.registerUser(
      parsed.email,
      parsed.password,
      parsed.deviceName,
      parsed.keyEnvelope,
      parsed.initialVault
    );
    res.status(201).json(result);
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    res.status(400).json({ error: err.message || 'Registration failed' });
  }
});

authRouter.post('/login', authLimiter, async (req: Request, res: Response) => {
  try {
    const parsed = LoginRequestSchema.parse(req.body);
    const result = await AuthService.login(parsed.email, parsed.password, parsed.deviceName);
    res.json(result);
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    res.status(401).json({ error: err.message || 'Authentication failed' });
  }
});

authRouter.post('/refresh', async (req: Request, res: Response) => {
  try {
    const parsed = RefreshTokenRequestSchema.parse(req.body);
    const tokens = await AuthService.refresh(parsed.refreshToken);
    res.json({ tokens });
  } catch (err: any) {
    res.status(401).json({ error: err.message || 'Token refresh failed' });
  }
});

authRouter.post('/logout', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const refreshToken = req.body?.refreshToken;
    await AuthService.logout(refreshToken, req.user?.id);
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Logout failed' });
  }
});

authRouter.delete('/account', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const parsed = DeleteAccountRequestSchema.parse(req.body);
    await AuthService.deleteAccount(req.user!.id, parsed.password);
    res.json({ success: true, message: 'Account and all associated cloud data deleted permanently' });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    res.status(400).json({ error: err.message || 'Account deletion failed' });
  }
});
