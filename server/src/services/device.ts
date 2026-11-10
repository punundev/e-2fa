import { query } from '../database/index';

export class DeviceService {
  static async listDevices(userId: string, currentDeviceId?: string) {
    const rows = await query(
      `SELECT id, device_name, device_type, last_seen_at, created_at, revoked_at
       FROM devices
       WHERE user_id = $1 AND revoked_at IS NULL
       ORDER BY last_seen_at DESC`,
      [userId]
    );

    return rows.map((r) => ({
      id: r.id,
      deviceName: r.device_name,
      deviceType: r.device_type,
      lastSeenAt: r.last_seen_at,
      createdAt: r.created_at,
      isCurrent: currentDeviceId ? r.id === currentDeviceId : false,
    }));
  }

  static async touchDevice(deviceId: string): Promise<void> {
    await query(
      `UPDATE devices SET last_seen_at = CURRENT_TIMESTAMP WHERE id = $1 AND revoked_at IS NULL`,
      [deviceId]
    );
  }

  static async revokeDevice(userId: string, deviceId: string): Promise<void> {
    const res = await query(
      `UPDATE devices SET revoked_at = CURRENT_TIMESTAMP WHERE id = $1 AND user_id = $2 RETURNING id`,
      [deviceId, userId]
    );

    if (res.length === 0) {
      throw new Error('Device not found or not owned by user');
    }

    // Also revoke all refresh tokens for this device
    await query(
      `UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE device_id = $1`,
      [deviceId]
    );
  }
}
