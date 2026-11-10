import { Router, Response } from 'express';
import { VaultService } from '../services/vault';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { SyncPushRequestSchema } from '../../../shared/schemas/index';

export const syncRouter = Router();

syncRouter.use(requireAuth);

syncRouter.post('/push', async (req: AuthRequest, res: Response) => {
  try {
    const parsed = SyncPushRequestSchema.parse(req.body);
    const result = await VaultService.syncPush(
      req.user!.id,
      parsed.deviceId || req.user?.deviceId,
      parsed.baseRevision,
      parsed.vault,
      parsed.keyEnvelope,
      parsed.idempotencyKey
    );

    if (result.conflict) {
      res.status(409).json({
        error: 'Conflict detected: vault revision mismatch',
        currentRevision: result.currentRevision,
        serverVault: result.serverVault,
      });
      return;
    }

    res.json({
      success: true,
      revision: result.revision,
      idempotentReplay: result.idempotentReplay,
    });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    res.status(500).json({ error: err.message || 'Push sync failed' });
  }
});

syncRouter.get('/pull', async (req: AuthRequest, res: Response) => {
  try {
    const data = await VaultService.getVault(req.user!.id);
    const envelope = await VaultService.getKeyEnvelope(req.user!.id);

    if (!data) {
      res.json({
        revision: 0,
        vault: null,
        keyEnvelope: envelope,
      });
      return;
    }

    res.json({
      revision: data.revision,
      vault: data.vault,
      keyEnvelope: envelope,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Pull sync failed' });
  }
});
