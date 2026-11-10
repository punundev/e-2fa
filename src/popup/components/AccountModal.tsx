import React, { useState, useEffect } from "react";
import {
  X,
  User,
  Cloud,
  RefreshCw,
  LogOut,
  Trash2,
  ShieldCheck,
  Smartphone,
  CheckCircle,
  AlertTriangle,
  Server,
} from "lucide-react";
import {
  AuthSession,
  getStoredSession,
  saveStoredSession,
  apiRequest,
} from "../../lib/api-client";
import { getAppConfig, saveAppConfig } from "../../lib/config";
import {
  generateVaultKey,
  wrapVaultKey,
  unwrapVaultKey,
  encryptClientVault,
  setMemoryDek,
  getMemoryDek,
  pushCloudSync,
  pullCloudSync,
} from "../../lib/sync-engine";
import { getAllAccounts, getSettings } from "../../lib/database";

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccountsUpdated: () => void;
}

export const AccountModal: React.FC<AccountModalProps> = ({
  isOpen,
  onClose,
  onAccountsUpdated,
}) => {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [activeTab, setActiveTab] = useState<
    "signin" | "register" | "settings"
  >("signin");

  // Form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [deviceName, setDeviceName] = useState("My Browser Extension");
  const [serverUrl, setServerUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Sync state
  const [syncing, setSyncing] = useState(false);
  const [devices, setDevices] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen) {
      loadInitialData();
    }
  }, [isOpen]);

  const loadInitialData = async () => {
    const s = await getStoredSession();
    const c = await getAppConfig();
    setSession(s);
    setServerUrl(c.apiBaseUrl);
    if (s) {
      setActiveTab("settings");
      fetchDevices();
    } else {
      setActiveTab("signin");
    }
  };

  const fetchDevices = async () => {
    try {
      const devs = await apiRequest("/api/v1/devices");
      setDevices(devs);
    } catch {}
  };

  if (!isOpen) return null;

  const handleSaveConfig = async () => {
    if (!serverUrl) return;
    try {
      const newConfig = {
        apiBaseUrl: serverUrl,
        isSelfHosted: !serverUrl.includes("secureauth.dev"),
      };
      await saveAppConfig(newConfig);
      setSuccess("Server endpoint updated successfully.");
      setError(null);
    } catch {
      setError("Failed to save configuration");
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // 1. Generate local DEK
      const dek = await generateVaultKey();
      // 2. Wrap DEK with user password
      const keyEnvelope = await wrapVaultKey(dek, password);
      // 3. Encrypt existing local data
      const accounts = await getAllAccounts();
      const settings = await getSettings();
      const initialVault = await encryptClientVault(
        dek,
        { accounts, settings, exportedAt: Date.now() },
        email,
      );

      // 4. Send to server
      const res = await apiRequest("/api/v1/auth/register", {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
          deviceName,
          keyEnvelope,
          initialVault,
        }),
      });

      const newSession: AuthSession = {
        accessToken: res.tokens.accessToken,
        refreshToken: res.tokens.refreshToken,
        user: res.user,
        deviceId: res.deviceId,
        syncEnabled: true,
        lastSyncedAt: Date.now(),
        localRevision: 1,
      };

      await saveStoredSession(newSession);
      setMemoryDek(dek);
      setSession(newSession);
      setActiveTab("settings");
      setSuccess("Account created and encrypted cloud backup established!");
    } catch (err: any) {
      setError(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await apiRequest("/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
          deviceName,
        }),
      });

      const newSession: AuthSession = {
        accessToken: res.tokens.accessToken,
        refreshToken: res.tokens.refreshToken,
        user: res.user,
        deviceId: res.deviceId,
        syncEnabled: true,
        lastSyncedAt: Date.now(),
        localRevision: 0,
      };

      await saveStoredSession(newSession);

      // Fetch envelope to unwrap DEK
      const envelope = await apiRequest("/api/v1/vault/envelope", {}, true);
      const dek = await unwrapVaultKey(envelope, password);
      setMemoryDek(dek);

      // Pull cloud vault
      await pullCloudSync(dek);
      onAccountsUpdated();

      setSession(newSession);
      setActiveTab("settings");
      setSuccess("Signed in successfully! Authenticator data synchronized.");
    } catch (err: any) {
      setError(err.message || "Sign in failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    setError(null);
    setSuccess(null);

    try {
      const dek = getMemoryDek();
      if (!dek) {
        throw new Error(
          "Vault is locked. Please sign in again with your password.",
        );
      }
      await pushCloudSync(dek);
      await pullCloudSync(dek);
      onAccountsUpdated();
      setSuccess("Synchronized successfully!");
    } catch (err: any) {
      setError(err.message || "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const handleSignOut = async () => {
    try {
      if (session) {
        await apiRequest("/api/v1/auth/logout", {
          method: "POST",
          body: JSON.stringify({ refreshToken: session.refreshToken }),
        }).catch(() => {});
      }
    } finally {
      await saveStoredSession(null);
      setMemoryDek(null);
      setSession(null);
      setActiveTab("signin");
      setSuccess("Signed out. Local data preserved safely on this device.");
    }
  };

  const handleDeleteAccount = async () => {
    const confirmation = prompt(
      "Type DELETE_MY_ACCOUNT to confirm permanent cloud deletion:",
    );
    if (confirmation !== "DELETE_MY_ACCOUNT") return;

    const pwd = prompt("Enter your password to authorize cloud deletion:");
    if (!pwd) return;

    setLoading(true);
    try {
      await apiRequest("/api/v1/auth/account", {
        method: "DELETE",
        body: JSON.stringify({ confirmation, password: pwd }),
      });
      await saveStoredSession(null);
      setMemoryDek(null);
      setSession(null);
      setActiveTab("signin");
      setSuccess(
        "Account and cloud backup permanently deleted. Local items kept.",
      );
    } catch (err: any) {
      setError(err.message || "Failed to delete account");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-slate-900 border border-slate-800 text-slate-100 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-semibold">
              {session ? "SecureAuth Cloud & Sync" : "SecureAuth Account"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition-colors p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-950/50 border border-red-800/80 rounded-xl text-red-200 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 p-3 bg-emerald-950/50 border border-emerald-800/80 rounded-xl text-emerald-200 text-xs">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {session ? (
            /* Logged in view */
            <div className="space-y-4">
              <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60 flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-400">Signed in as</div>
                  <div className="text-sm font-medium text-slate-200">
                    {session.user.email}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 text-xs text-emerald-400">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Zero-Knowledge Encrypted</span>
                  </div>
                </div>
                <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400 border border-indigo-500/20">
                  <Cloud className="w-6 h-6" />
                </div>
              </div>

              {/* Sync Actions */}
              <div className="flex gap-2">
                <button
                  onClick={handleSyncNow}
                  disabled={syncing}
                  className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-medium transition-all shadow-md disabled:opacity-50"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`}
                  />
                  {syncing ? "Synchronizing..." : "Sync Now"}
                </button>
                <button
                  onClick={handleSignOut}
                  className="flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium border border-slate-700"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign Out
                </button>
              </div>

              {/* Connected Devices */}
              <div>
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5" />
                  Connected Devices
                </h4>
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {devices.map((d) => (
                    <div
                      key={d.id}
                      className="p-2.5 bg-slate-800/40 border border-slate-800 rounded-lg flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-medium text-slate-200 flex items-center gap-1.5">
                          {d.deviceName}
                          {d.isCurrent && (
                            <span className="px-1.5 py-0.2 bg-indigo-500/20 text-indigo-300 text-[10px] rounded">
                              This device
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Last seen: {new Date(d.lastSeenAt).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Danger Zone */}
              <div className="pt-2 border-t border-slate-800">
                <button
                  onClick={handleDeleteAccount}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-2 text-xs font-medium text-red-400 hover:bg-red-950/30 rounded-xl border border-red-900/40 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Cloud Account & Backup
                </button>
              </div>
            </div>
          ) : (
            /* Auth Forms */
            <div>
              {/* Tab Selector */}
              <div className="flex border-b border-slate-800 mb-4">
                <button
                  onClick={() => setActiveTab("signin")}
                  className={`flex-1 pb-2 text-xs font-medium border-b-2 transition-colors ${
                    activeTab === "signin"
                      ? "border-indigo-500 text-indigo-400"
                      : "border-transparent text-slate-400 hover:text-slate-300"
                  }`}
                >
                  Sign In
                </button>
                <button
                  onClick={() => setActiveTab("register")}
                  className={`flex-1 pb-2 text-xs font-medium border-b-2 transition-colors ${
                    activeTab === "register"
                      ? "border-indigo-500 text-indigo-400"
                      : "border-transparent text-slate-400 hover:text-slate-300"
                  }`}
                >
                  Create Account
                </button>
              </div>

              <form
                onSubmit={
                  activeTab === "signin" ? handleSignIn : handleRegister
                }
                className="space-y-3"
              >
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                    placeholder="user@example.com"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Master Password
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                    placeholder="••••••••••••"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Your password decrypts your vault key. We never receive or
                    store it.
                  </p>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Device Name
                  </label>
                  <input
                    type="text"
                    required
                    value={deviceName}
                    onChange={(e) => setDeviceName(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md transition-all disabled:opacity-50"
                >
                  {loading
                    ? "Processing..."
                    : activeTab === "signin"
                      ? "Sign In & Sync"
                      : "Create Account & Enable Cloud"}
                </button>
              </form>
            </div>
          )}

          {/* Self-hosting Server Config */}
          <div className="pt-3 border-t border-slate-800">
            <details className="group">
              <summary className="text-[11px] font-medium text-slate-400 hover:text-slate-300 cursor-pointer flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5" />
                  Server Endpoint Configuration
                </span>
                <span className="text-[10px] text-slate-500 group-open:rotate-180 transition-transform">
                  ▼
                </span>
              </summary>
              <div className="mt-2 space-y-2">
                <input
                  type="url"
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                  placeholder="https://api.secureauth.dev or http://localhost:5000"
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={handleSaveConfig}
                  className="py-1 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] font-medium border border-slate-700 transition-colors"
                >
                  Save Endpoint
                </button>
              </div>
            </details>
          </div>
        </div>
      </div>
    </div>
  );
};
