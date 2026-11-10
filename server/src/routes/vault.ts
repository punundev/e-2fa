import { Router, Response } from 'express';
import { VaultService } from '../services/vault';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { KeyEnvelopeSchema } from '../../../shared/schemas/index';

export const vaultRouter = Router();

vaultRouter.use(requireAuth);

vaultRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const data = await VaultService.getVault(req.user!.id);
    if (!data) {
      res.status(404).json({ error: 'Vault not found' });
      return;
    }
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch vault' });
  }
});

vaultRouter.get('/metadata', async (req: AuthRequest, res: Response) => {
  try {
    const metadata = await VaultService.getMetadata(req.user!.id);
    res.json(metadata);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch vault metadata' });
  }
});

vaultRouter.get('/envelope', async (req: AuthRequest, res: Response) => {
  try {
    const envelope = await VaultService.getKeyEnvelope(req.user!.id);
    if (!envelope) {
      res.status(404).json({ error: 'Key envelope not found' });
      return;
    }
    res.json(envelope);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch envelope' });
  }
});

vaultRouter.put('/envelope', async (req: AuthRequest, res: Response) => {
  try {
    const envelope = KeyEnvelopeSchema.parse(req.body);
    await VaultService.setKeyEnvelope(req.user!.id, envelope);
    res.json({ success: true });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    res.status(500).json({ error: err.message || 'Failed to update envelope' });
  }
});

vaultRouter.delete('/', async (req: AuthRequest, res: Response) => {
  try {
    await VaultService.deleteVault(req.user!.id);
    res.json({ success: true, message: 'Cloud backup deleted' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to delete vault' });
  }
});
