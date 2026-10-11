import React, { useState } from "react";
import { Lock, ShieldCheck, AlertCircle } from "lucide-react";
import { t } from "../../lib/i18n";

interface PasswordDialogProps {
  mode: "setup" | "unlock";
  onUnlock?: (password: string) => Promise<boolean>;
  onSetup?: (password: string) => Promise<void>;
  onSkipSetup?: () => Promise<void>;
}

export const PasswordDialog: React.FC<PasswordDialogProps> = ({
  mode,
  onUnlock,
  onSetup,
  onSkipSetup,
}) => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setErrorMsg(t("password_empty"));
      return;
    }
    setErrorMsg(null);
    setLoading(true);
    try {
      const success = await onUnlock?.(password);
      if (!success) {
        setErrorMsg(t("invalid_password"));
      }
    } catch (err: any) {
      setErrorMsg(err.message || t("invalid_password"));
    } finally {
      setLoading(false);
    }
  };

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setErrorMsg(t("password_empty"));
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg(t("passwords_mismatch"));
      return;
    }
    setErrorMsg(null);
    setLoading(true);
    try {
      await onSetup?.(password);
    } catch (err: any) {
      setErrorMsg(err.message || "Setup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-4 min-h-[360px] text-center">
      <div className="w-12 h-12 rounded-2xl app-bg-subtle border border-[var(--border-subtle)] flex items-center justify-center app-text-accent mb-3">
        {mode === "setup" ? <ShieldCheck size={26} /> : <Lock size={26} />}
      </div>

      <h2 className="text-base font-bold app-text-primary mb-1">
        {mode === "setup" ? t("setup_password_title") : t("vault_locked")}
      </h2>
      <p className="text-xs app-text-secondary max-w-xs mb-4">
        {mode === "setup"
          ? t("setup_password_desc")
          : t("enter_vault_password")}
      </p>

      {errorMsg && (
        <div className="w-full max-w-xs mb-3 p-2 rounded-lg bg-red-950/60 border border-red-800 text-xs text-red-200 flex items-center gap-1.5 text-left">
          <AlertCircle size={14} className="shrink-0 text-red-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {mode === "unlock" ? (
        <form
          onSubmit={handleUnlock}
          className="w-full max-w-xs flex flex-col gap-2.5"
        >
          <input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("password_placeholder")}
            className="w-full px-3 py-2 rounded-xl app-input text-sm"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 rounded-xl app-btn-primary disabled:opacity-50 font-medium text-sm transition-colors shadow-sm"
          >
            {loading ? "Unlocking..." : t("unlock")}
          </button>
        </form>
      ) : (
        <form
          onSubmit={handleSetup}
          className="w-full max-w-xs flex flex-col gap-2.5 text-left"
        >
          <div>
            <label className="text-xs app-text-secondary font-medium mb-1 block">
              {t("password_placeholder")}
            </label>
            <input
              type="password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Master password..."
              className="w-full px-3 py-1.5 rounded-lg app-input text-xs"
            />
          </div>

          <div>
            <label className="text-xs app-text-secondary font-medium mb-1 block">
              Confirm Master Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter password..."
              className="w-full px-3 py-1.5 rounded-lg app-input text-xs"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-1 w-full py-2 px-4 rounded-xl app-btn-primary disabled:opacity-50 font-medium text-xs transition-colors shadow-sm"
          >
            {loading ? "Setting up..." : t("setup_password_btn")}
          </button>

          <button
            type="button"
            onClick={onSkipSetup}
            className="w-full py-1.5 px-3 rounded-lg app-text-muted hover:app-text-primary text-[11px] text-center"
          >
            {t("skip_password_btn")}
          </button>
        </form>
      )}
    </div>
  );
};
