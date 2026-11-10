import { Router, Response } from 'express';
import { DeviceService } from '../services/device';
import { requireAuth, AuthRequest } from '../middleware/auth';

export const deviceRouter = Router();

deviceRouter.use(requireAuth);

deviceRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const devices = await DeviceService.listDevices(req.user!.id, req.user?.deviceId);
    res.json(devices);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to list devices' });
  }
});

deviceRouter.delete('/:deviceId', async (req: AuthRequest, res: Response) => {
  try {
    const deviceId = req.params.deviceId as string;
    await DeviceService.revokeDevice(req.user!.id, deviceId);
    res.json({ success: true, message: 'Device revoked successfully' });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to revoke device' });
  }
});

