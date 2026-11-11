import express, { Router } from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { Pool } from "pg";
import dotenv from "dotenv";
import { z } from "zod";
//#region server/src/database/index.ts
dotenv.config();
var pool = null;
function getDbPool() {
	if (!pool) {
		const connectionString = process.env.DATABASE_URL;
		if (!connectionString) throw new Error("DATABASE_URL environment variable is missing.");
		const isSsl = connectionString.includes("neon.tech") || process.env.PGSSLMODE === "require" || process.env.NODE_ENV === "production";
		pool = new Pool({
			connectionString,
			ssl: isSsl ? { rejectUnauthorized: false } : false,
			max: 10,
			idleTimeoutMillis: 5e4,
			connectionTimeoutMillis: 1e4
		});
	}
	return pool;
}
async function query(text, params = []) {
	return (await getDbPool().query(text, params)).rows;
}
async function queryOne(text, params = []) {
	const rows = await query(text, params);
	return rows.length > 0 ? rows[0] : null;
}
async function withTransaction(callback) {
	const client = await getDbPool().connect();
	try {
		await client.query("BEGIN");
		const result = await callback(client);
		await client.query("COMMIT");
		return result;
	} catch (err) {
		await client.query("ROLLBACK");
		throw err;
	} finally {
		client.release();
	}
}
//#endregion
//#region server/src/middleware/auth.ts
function getJwtSecret() {
	const secret = process.env.JWT_SECRET;
	if (!secret) {
		if (process.env.NODE_ENV === "production") throw new Error("JWT_SECRET must be defined in production!");
		return "dev-insecure-jwt-secret-replace-in-production-min32chars";
	}
	return secret;
}
async function requireAuth(req, res, next) {
	const authHeader = req.headers.authorization;
	if (!authHeader || !authHeader.startsWith("Bearer ")) {
		res.status(401).json({ error: "Missing or malformed Authorization header" });
		return;
	}
	const token = authHeader.substring(7).trim();
	try {
		const payload = jwt.verify(token, getJwtSecret());
		if (payload.type && payload.type !== "access") {
			res.status(401).json({ error: "Invalid token type" });
			return;
		}
		if (payload.deviceId) {
			const device = await queryOne("SELECT id, revoked_at FROM devices WHERE id = $1 AND user_id = $2", [payload.deviceId, payload.sub]);
			if (!device || device.revoked_at !== null) {
				res.status(401).json({ error: "Device has been revoked or removed" });
				return;
			}
		}
		req.user = {
			id: payload.sub,
			email: payload.email,
			deviceId: payload.deviceId
		};
		next();
	} catch (err) {
		res.status(401).json({
			error: "Invalid or expired token",
			message: err.message
		});
	}
}
//#endregion
//#region shared/constants/index.ts
var MAX_VAULT_PAYLOAD_BYTES = 5242880;
//#endregion
//#region server/src/services/auth.ts
var SALT_ROUNDS = 12;
var AuthService = class {
	static async hashPassword(password) {
		return bcrypt.hash(password, SALT_ROUNDS);
	}
	static async verifyPassword(password, hash) {
		return bcrypt.compare(password, hash);
	}
	static generateTokens(userId, email, deviceId) {
		const secret = getJwtSecret();
		return {
			accessToken: jwt.sign({
				sub: userId,
				email,
				deviceId,
				type: "access"
			}, secret, { expiresIn: "15m" }),
			refreshToken: crypto.randomBytes(40).toString("hex"),
			expiresIn: "15m"
		};
	}
	static async storeRefreshToken(userId, deviceId, rawToken) {
		const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
		const expiresAt = new Date(Date.now() + 2592e6);
		await query(`INSERT INTO refresh_tokens (user_id, device_id, token_hash, expires_at)
       VALUES ($1, $2, $3, $4)`, [
			userId,
			deviceId || null,
			tokenHash,
			expiresAt.toISOString()
		]);
	}
	static async registerUser(email, password, deviceName, keyEnvelope, initialVault) {
		if (await queryOne("SELECT id FROM users WHERE email = $1", [email])) throw new Error("An account with this email address already exists");
		const passwordHash = await this.hashPassword(password);
		return withTransaction(async (client) => {
			const user = (await client.query(`INSERT INTO users (email, password_hash, is_verified)
         VALUES ($1, $2, true)
         RETURNING id, email, created_at`, [email, passwordHash])).rows[0];
			let deviceId;
			if (deviceName) deviceId = (await client.query(`INSERT INTO devices (user_id, device_name, device_type)
           VALUES ($1, $2, 'chrome-extension')
           RETURNING id`, [user.id, deviceName])).rows[0].id;
			if (keyEnvelope) await client.query(`INSERT INTO vault_key_envelopes 
           (user_id, encrypted_dek, wrapping_iv, kdf, kdf_iterations, salt, key_version)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`, [
				user.id,
				keyEnvelope.encryptedDek,
				keyEnvelope.wrappingIv,
				keyEnvelope.kdf,
				keyEnvelope.kdfIterations,
				keyEnvelope.salt,
				keyEnvelope.keyVersion || 1
			]);
			if (initialVault) await client.query(`INSERT INTO vaults
           (user_id, revision, payload_version, ciphertext, iv, aad, item_count)
           VALUES ($1, 1, $2, $3, $4, $5, $6)`, [
				user.id,
				initialVault.version || 1,
				initialVault.ciphertext,
				initialVault.iv,
				initialVault.aad || null,
				initialVault.itemCount
			]);
			const tokens = this.generateTokens(user.id, user.email, deviceId);
			const tokenHash = crypto.createHash("sha256").update(tokens.refreshToken).digest("hex");
			const expiresAt = new Date(Date.now() + 2592e6);
			await client.query(`INSERT INTO refresh_tokens (user_id, device_id, token_hash, expires_at)
         VALUES ($1, $2, $3, $4)`, [
				user.id,
				deviceId || null,
				tokenHash,
				expiresAt.toISOString()
			]);
			return {
				user: {
					id: user.id,
					email: user.email,
					createdAt: user.created_at
				},
				deviceId,
				tokens
			};
		});
	}
	static async login(email, password, deviceName) {
		const user = await queryOne("SELECT id, email, password_hash, created_at FROM users WHERE email = $1", [email]);
		if (!user) throw new Error("Invalid email or password");
		if (!await this.verifyPassword(password, user.password_hash)) throw new Error("Invalid email or password");
		let deviceId;
		if (deviceName) deviceId = (await queryOne(`INSERT INTO devices (user_id, device_name, device_type)
         VALUES ($1, $2, 'chrome-extension')
         RETURNING id`, [user.id, deviceName])).id;
		const tokens = this.generateTokens(user.id, user.email, deviceId);
		await this.storeRefreshToken(user.id, deviceId, tokens.refreshToken);
		return {
			user: {
				id: user.id,
				email: user.email,
				createdAt: user.created_at
			},
			deviceId,
			tokens
		};
	}
	static async refresh(rawRefreshToken) {
		const record = await queryOne(`SELECT rt.id, rt.user_id, rt.device_id, rt.expires_at, rt.revoked_at, u.email
       FROM refresh_tokens rt
       JOIN users u ON rt.user_id = u.id
       WHERE rt.token_hash = $1`, [crypto.createHash("sha256").update(rawRefreshToken).digest("hex")]);
		if (!record || record.revoked_at !== null) throw new Error("Invalid or revoked refresh token");
		if (new Date(record.expires_at).getTime() < Date.now()) throw new Error("Refresh token expired");
		if (record.device_id) {
			const dev = await queryOne("SELECT revoked_at FROM devices WHERE id = $1", [record.device_id]);
			if (!dev || dev.revoked_at !== null) throw new Error("Device revoked");
		}
		await query("UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE id = $1", [record.id]);
		const tokens = this.generateTokens(record.user_id, record.email, record.device_id);
		await this.storeRefreshToken(record.user_id, record.device_id, tokens.refreshToken);
		return tokens;
	}
	static async logout(rawRefreshToken, userId) {
		if (rawRefreshToken) await query("UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE token_hash = $1", [crypto.createHash("sha256").update(rawRefreshToken).digest("hex")]);
		else if (userId) await query("UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = $1", [userId]);
	}
	static async deleteAccount(userId, password) {
		const user = await queryOne("SELECT password_hash FROM users WHERE id = $1", [userId]);
		if (!user) throw new Error("User not found");
		if (!await this.verifyPassword(password, user.password_hash)) throw new Error("Incorrect password");
		await query("DELETE FROM users WHERE id = $1", [userId]);
	}
};
//#endregion
//#region server/src/middleware/rate-limit.ts
var ipLimits = /* @__PURE__ */ new Map();
function rateLimiter(options) {
	const { windowMs, max, message = "Too many requests, please try again later." } = options;
	return (req, res, next) => {
		const ip = req.ip || req.socket.remoteAddress || "unknown";
		const now = Date.now();
		const record = ipLimits.get(ip);
		if (!record || now > record.resetAt) {
			ipLimits.set(ip, {
				count: 1,
				resetAt: now + windowMs
			});
			return next();
		}
		if (record.count >= max) {
			res.status(429).json({ error: message });
			return;
		}
		record.count++;
		next();
	};
}
//#endregion
//#region shared/schemas/index.ts
var KeyEnvelopeSchema = z.object({
	encryptedDek: z.string().min(10),
	wrappingIv: z.string().min(8),
	kdf: z.literal("PBKDF2-SHA256"),
	kdfIterations: z.number().int().min(1e5),
	salt: z.string().min(16),
	keyVersion: z.number().int().positive().default(1),
	updatedAt: z.number().int().positive()
});
var EncryptedVaultPayloadSchema = z.object({
	version: z.number().int().positive().default(1),
	ciphertext: z.string().min(1),
	iv: z.string().min(8),
	aad: z.string().optional(),
	itemCount: z.number().int().nonnegative(),
	updatedAt: z.number().int().positive()
});
var RegisterRequestSchema = z.object({
	email: z.string().email().max(255).toLowerCase().trim(),
	password: z.string().min(8).max(128),
	keyEnvelope: KeyEnvelopeSchema.optional(),
	initialVault: EncryptedVaultPayloadSchema.optional(),
	deviceName: z.string().min(1).max(100).optional()
});
var LoginRequestSchema = z.object({
	email: z.string().email().max(255).toLowerCase().trim(),
	password: z.string().min(1).max(128),
	deviceName: z.string().min(1).max(100).optional()
});
var RefreshTokenRequestSchema = z.object({ refreshToken: z.string().min(1) });
var SyncPushRequestSchema = z.object({
	deviceId: z.string().uuid().optional(),
	baseRevision: z.number().int().nonnegative(),
	keyEnvelope: KeyEnvelopeSchema.optional(),
	vault: EncryptedVaultPayloadSchema,
	idempotencyKey: z.string().uuid().optional()
});
z.object({ sinceRevision: z.number().int().nonnegative().default(0) });
z.object({
	deviceName: z.string().min(1).max(100),
	deviceType: z.string().min(1).max(50).default("chrome-extension")
});
z.object({
	currentPassword: z.string().min(1),
	newPassword: z.string().min(8).max(128),
	newKeyEnvelope: KeyEnvelopeSchema
});
var DeleteAccountRequestSchema = z.object({
	confirmation: z.literal("DELETE_MY_ACCOUNT"),
	password: z.string().min(1)
});
//#endregion
//#region server/src/routes/auth.ts
var authRouter = Router();
var authLimiter = rateLimiter({
	windowMs: 9e5,
	max: 30,
	message: "Too many authentication attempts. Please try again later."
});
authRouter.post("/register", authLimiter, async (req, res) => {
	try {
		const parsed = RegisterRequestSchema.parse(req.body);
		const result = await AuthService.registerUser(parsed.email, parsed.password, parsed.deviceName, parsed.keyEnvelope, parsed.initialVault);
		res.status(201).json(result);
	} catch (err) {
		if (err.name === "ZodError") {
			res.status(400).json({
				error: "Validation failed",
				details: err.errors
			});
			return;
		}
		res.status(400).json({ error: err.message || "Registration failed" });
	}
});
authRouter.post("/login", authLimiter, async (req, res) => {
	try {
		const parsed = LoginRequestSchema.parse(req.body);
		const result = await AuthService.login(parsed.email, parsed.password, parsed.deviceName);
		res.json(result);
	} catch (err) {
		if (err.name === "ZodError") {
			res.status(400).json({
				error: "Validation failed",
				details: err.errors
			});
			return;
		}
		res.status(401).json({ error: err.message || "Authentication failed" });
	}
});
authRouter.post("/refresh", async (req, res) => {
	try {
		const parsed = RefreshTokenRequestSchema.parse(req.body);
		const tokens = await AuthService.refresh(parsed.refreshToken);
		res.json({ tokens });
	} catch (err) {
		res.status(401).json({ error: err.message || "Token refresh failed" });
	}
});
authRouter.post("/logout", requireAuth, async (req, res) => {
	try {
		const refreshToken = req.body?.refreshToken;
		await AuthService.logout(refreshToken, req.user?.id);
		res.json({
			success: true,
			message: "Logged out successfully"
		});
	} catch (err) {
		res.status(500).json({ error: err.message || "Logout failed" });
	}
});
authRouter.delete("/account", requireAuth, async (req, res) => {
	try {
		const parsed = DeleteAccountRequestSchema.parse(req.body);
		await AuthService.deleteAccount(req.user.id, parsed.password);
		res.json({
			success: true,
			message: "Account and all associated cloud data deleted permanently"
		});
	} catch (err) {
		if (err.name === "ZodError") {
			res.status(400).json({
				error: "Validation failed",
				details: err.errors
			});
			return;
		}
		res.status(400).json({ error: err.message || "Account deletion failed" });
	}
});
//#endregion
//#region server/src/services/vault.ts
var VaultService = class {
	static async getKeyEnvelope(userId) {
		const row = await queryOne(`SELECT encrypted_dek, wrapping_iv, kdf, kdf_iterations, salt, key_version, updated_at
       FROM vault_key_envelopes
       WHERE user_id = $1`, [userId]);
		if (!row) return null;
		return {
			encryptedDek: row.encrypted_dek,
			wrappingIv: row.wrapping_iv,
			kdf: row.kdf,
			kdfIterations: row.kdf_iterations,
			salt: row.salt,
			keyVersion: row.key_version,
			updatedAt: new Date(row.updated_at).getTime()
		};
	}
	static async setKeyEnvelope(userId, envelope) {
		await query(`INSERT INTO vault_key_envelopes 
       (user_id, encrypted_dek, wrapping_iv, kdf, kdf_iterations, salt, key_version, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id) DO UPDATE SET
         encrypted_dek = EXCLUDED.encrypted_dek,
         wrapping_iv = EXCLUDED.wrapping_iv,
         kdf = EXCLUDED.kdf,
         kdf_iterations = EXCLUDED.kdf_iterations,
         salt = EXCLUDED.salt,
         key_version = EXCLUDED.key_version,
         updated_at = CURRENT_TIMESTAMP`, [
			userId,
			envelope.encryptedDek,
			envelope.wrappingIv,
			envelope.kdf,
			envelope.kdfIterations,
			envelope.salt,
			envelope.keyVersion || 1
		]);
	}
	static async getVault(userId) {
		const row = await queryOne(`SELECT id, revision, payload_version, ciphertext, iv, aad, item_count, updated_at
       FROM vaults
       WHERE user_id = $1`, [userId]);
		if (!row) return null;
		return {
			revision: row.revision,
			vault: {
				version: row.payload_version,
				ciphertext: row.ciphertext,
				iv: row.iv,
				aad: row.aad || void 0,
				itemCount: row.item_count,
				updatedAt: new Date(row.updated_at).getTime()
			}
		};
	}
	static async getMetadata(userId) {
		const row = await queryOne(`SELECT revision, payload_version, item_count, updated_at
       FROM vaults
       WHERE user_id = $1`, [userId]);
		if (!row) return {
			revision: 0,
			itemCount: 0,
			payloadVersion: 1,
			updatedAt: null
		};
		return {
			revision: row.revision,
			itemCount: row.item_count,
			payloadVersion: row.payload_version,
			updatedAt: row.updated_at
		};
	}
	static async syncPush(userId, deviceId, baseRevision, vault, keyEnvelope, idempotencyKey) {
		return withTransaction(async (client) => {
			if (idempotencyKey) {
				const existingSync = await client.query(`SELECT revision FROM sync_history WHERE idempotency_key = $1 AND user_id = $2`, [idempotencyKey, userId]);
				if (existingSync.rows.length > 0) return {
					conflict: false,
					revision: existingSync.rows[0].revision,
					idempotentReplay: true
				};
			}
			const currentVault = (await client.query(`SELECT revision, payload_version, ciphertext, iv, aad, item_count, updated_at
         FROM vaults WHERE user_id = $1 FOR UPDATE`, [userId])).rows[0];
			const currentRev = currentVault ? currentVault.revision : 0;
			if (currentRev !== baseRevision) return {
				conflict: true,
				currentRevision: currentRev,
				serverVault: currentVault ? {
					version: currentVault.payload_version,
					ciphertext: currentVault.ciphertext,
					iv: currentVault.iv,
					aad: currentVault.aad || void 0,
					itemCount: currentVault.item_count,
					updatedAt: new Date(currentVault.updated_at).getTime()
				} : null
			};
			const nextRev = currentRev + 1;
			if (currentVault) await client.query(`UPDATE vaults
           SET revision = $1, payload_version = $2, ciphertext = $3, iv = $4, aad = $5, item_count = $6, updated_at = CURRENT_TIMESTAMP
           WHERE user_id = $7`, [
				nextRev,
				vault.version,
				vault.ciphertext,
				vault.iv,
				vault.aad || null,
				vault.itemCount,
				userId
			]);
			else await client.query(`INSERT INTO vaults (user_id, revision, payload_version, ciphertext, iv, aad, item_count)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`, [
				userId,
				nextRev,
				vault.version,
				vault.ciphertext,
				vault.iv,
				vault.aad || null,
				vault.itemCount
			]);
			if (keyEnvelope) await client.query(`INSERT INTO vault_key_envelopes 
           (user_id, encrypted_dek, wrapping_iv, kdf, kdf_iterations, salt, key_version, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
           ON CONFLICT (user_id) DO UPDATE SET
             encrypted_dek = EXCLUDED.encrypted_dek,
             wrapping_iv = EXCLUDED.wrapping_iv,
             kdf = EXCLUDED.kdf,
             kdf_iterations = EXCLUDED.kdf_iterations,
             salt = EXCLUDED.salt,
             key_version = EXCLUDED.key_version,
             updated_at = CURRENT_TIMESTAMP`, [
				userId,
				keyEnvelope.encryptedDek,
				keyEnvelope.wrappingIv,
				keyEnvelope.kdf,
				keyEnvelope.kdfIterations,
				keyEnvelope.salt,
				keyEnvelope.keyVersion || 1
			]);
			await client.query(`INSERT INTO sync_history (user_id, device_id, revision, idempotency_key)
         VALUES ($1, $2, $3, $4)`, [
				userId,
				deviceId || null,
				nextRev,
				idempotencyKey || null
			]);
			return {
				conflict: false,
				revision: nextRev
			};
		});
	}
	static async deleteVault(userId) {
		await query("DELETE FROM vaults WHERE user_id = $1", [userId]);
		await query("DELETE FROM vault_key_envelopes WHERE user_id = $1", [userId]);
		await query("DELETE FROM sync_history WHERE user_id = $1", [userId]);
	}
};
//#endregion
//#region server/src/routes/vault.ts
var vaultRouter = Router();
vaultRouter.use(requireAuth);
vaultRouter.get("/", async (req, res) => {
	try {
		const data = await VaultService.getVault(req.user.id);
		if (!data) {
			res.status(404).json({ error: "Vault not found" });
			return;
		}
		res.json(data);
	} catch (err) {
		res.status(500).json({ error: err.message || "Failed to fetch vault" });
	}
});
vaultRouter.get("/metadata", async (req, res) => {
	try {
		const metadata = await VaultService.getMetadata(req.user.id);
		res.json(metadata);
	} catch (err) {
		res.status(500).json({ error: err.message || "Failed to fetch vault metadata" });
	}
});
vaultRouter.get("/envelope", async (req, res) => {
	try {
		const envelope = await VaultService.getKeyEnvelope(req.user.id);
		if (!envelope) {
			res.status(404).json({ error: "Key envelope not found" });
			return;
		}
		res.json(envelope);
	} catch (err) {
		res.status(500).json({ error: err.message || "Failed to fetch envelope" });
	}
});
vaultRouter.put("/envelope", async (req, res) => {
	try {
		const envelope = KeyEnvelopeSchema.parse(req.body);
		await VaultService.setKeyEnvelope(req.user.id, envelope);
		res.json({ success: true });
	} catch (err) {
		if (err.name === "ZodError") {
			res.status(400).json({
				error: "Validation failed",
				details: err.errors
			});
			return;
		}
		res.status(500).json({ error: err.message || "Failed to update envelope" });
	}
});
vaultRouter.delete("/", async (req, res) => {
	try {
		await VaultService.deleteVault(req.user.id);
		res.json({
			success: true,
			message: "Cloud backup deleted"
		});
	} catch (err) {
		res.status(500).json({ error: err.message || "Failed to delete vault" });
	}
});
//#endregion
//#region server/src/routes/sync.ts
var syncRouter = Router();
syncRouter.use(requireAuth);
syncRouter.post("/push", async (req, res) => {
	try {
		const parsed = SyncPushRequestSchema.parse(req.body);
		const result = await VaultService.syncPush(req.user.id, parsed.deviceId || req.user?.deviceId, parsed.baseRevision, parsed.vault, parsed.keyEnvelope, parsed.idempotencyKey);
		if (result.conflict) {
			res.status(409).json({
				error: "Conflict detected: vault revision mismatch",
				currentRevision: result.currentRevision,
				serverVault: result.serverVault
			});
			return;
		}
		res.json({
			success: true,
			revision: result.revision,
			idempotentReplay: result.idempotentReplay
		});
	} catch (err) {
		if (err.name === "ZodError") {
			res.status(400).json({
				error: "Validation failed",
				details: err.errors
			});
			return;
		}
		res.status(500).json({ error: err.message || "Push sync failed" });
	}
});
syncRouter.get("/pull", async (req, res) => {
	try {
		const data = await VaultService.getVault(req.user.id);
		const envelope = await VaultService.getKeyEnvelope(req.user.id);
		if (!data) {
			res.json({
				revision: 0,
				vault: null,
				keyEnvelope: envelope
			});
			return;
		}
		res.json({
			revision: data.revision,
			vault: data.vault,
			keyEnvelope: envelope
		});
	} catch (err) {
		res.status(500).json({ error: err.message || "Pull sync failed" });
	}
});
//#endregion
//#region server/src/services/device.ts
var DeviceService = class {
	static async listDevices(userId, currentDeviceId) {
		return (await query(`SELECT id, device_name, device_type, last_seen_at, created_at, revoked_at
       FROM devices
       WHERE user_id = $1 AND revoked_at IS NULL
       ORDER BY last_seen_at DESC`, [userId])).map((r) => ({
			id: r.id,
			deviceName: r.device_name,
			deviceType: r.device_type,
			lastSeenAt: r.last_seen_at,
			createdAt: r.created_at,
			isCurrent: currentDeviceId ? r.id === currentDeviceId : false
		}));
	}
	static async touchDevice(deviceId) {
		await query(`UPDATE devices SET last_seen_at = CURRENT_TIMESTAMP WHERE id = $1 AND revoked_at IS NULL`, [deviceId]);
	}
	static async revokeDevice(userId, deviceId) {
		if ((await query(`UPDATE devices SET revoked_at = CURRENT_TIMESTAMP WHERE id = $1 AND user_id = $2 RETURNING id`, [deviceId, userId])).length === 0) throw new Error("Device not found or not owned by user");
		await query(`UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE device_id = $1`, [deviceId]);
	}
};
//#endregion
//#region server/src/routes/device.ts
var deviceRouter = Router();
deviceRouter.use(requireAuth);
deviceRouter.get("/", async (req, res) => {
	try {
		const devices = await DeviceService.listDevices(req.user.id, req.user?.deviceId);
		res.json(devices);
	} catch (err) {
		res.status(500).json({ error: err.message || "Failed to list devices" });
	}
});
deviceRouter.delete("/:deviceId", async (req, res) => {
	try {
		const deviceId = req.params.deviceId;
		await DeviceService.revokeDevice(req.user.id, deviceId);
		res.json({
			success: true,
			message: "Device revoked successfully"
		});
	} catch (err) {
		res.status(400).json({ error: err.message || "Failed to revoke device" });
	}
});
//#endregion
//#region server/src/app.ts
function createApp() {
	const app = express();
	app.disable("x-powered-by");
	const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS ? process.env.CORS_ALLOWED_ORIGINS.split(",").map((o) => o.trim()) : "*";
	app.use(cors({
		origin: allowedOrigins,
		methods: [
			"GET",
			"POST",
			"PUT",
			"DELETE",
			"OPTIONS"
		],
		allowedHeaders: ["Content-Type", "Authorization"],
		credentials: true
	}));
	app.use(express.json({ limit: MAX_VAULT_PAYLOAD_BYTES }));
	app.use((_req, res, next) => {
		res.setHeader("X-Content-Type-Options", "nosniff");
		res.setHeader("X-Frame-Options", "DENY");
		res.setHeader("X-XSS-Protection", "1; mode=block");
		res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
		next();
	});
	app.get("/api/health", (_req, res) => {
		res.json({
			status: "ok",
			service: "secureauth-api",
			timestamp: (/* @__PURE__ */ new Date()).toISOString()
		});
	});
	app.get("/", (_req, res) => {
		res.json({
			name: "SecureAuth 2FA Cloud API",
			status: "online",
			version: "1.0.14",
			documentation: "https://github.com/pleisvay/e-2fa",
			health: "/api/health"
		});
	});
	app.use("/api/v1/auth", authRouter);
	app.use("/api/v1/vault", vaultRouter);
	app.use("/api/v1/sync", syncRouter);
	app.use("/api/v1/devices", deviceRouter);
	app.get("/api/v1/account", requireAuth, (req, res) => {
		res.json({ user: {
			id: req.user?.id,
			email: req.user?.email
		} });
	});
	app.use((_req, res) => {
		res.status(404).json({ error: "Endpoint not found" });
	});
	app.use((err, _req, res, _next) => {
		res.status(err.status || 500).json({ error: err.message || "Internal server error" });
	});
	return app;
}
//#endregion
//#region api/index.ts
var app = createApp();
//#endregion
export { app as default };
