import React, { useState, useEffect } from "react";
import {
  MoreVertical,
  Star,
  Trash2,
  Edit2,
  Info,
  Link,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { AuthenticatorAccount } from "../../types";
import { generateTotp, getTotpRemainingSeconds } from "../../lib/totp";
import { generateHotp } from "../../lib/hotp";
import { formatOtpUri } from "../../lib/otp-uri";
import { CountdownRing } from "./CountdownRing";
import { CodeDisplay } from "./CodeDisplay";
import { BrandLogo } from "./BrandLogo";
import { t } from "../../lib/i18n";

interface AuthenticatorCardProps {
  account: AuthenticatorAccount;
  grouping?: "grouped" | "plain";
  onTogglePin: (account: AuthenticatorAccount) => void;
  onEdit: (account: AuthenticatorAccount) => void;
  onViewDetails: (account: AuthenticatorAccount) => void;
  onDelete: (id: string) => void;
  onIncrementHotp: (id: string) => Promise<number>;
}

export const AuthenticatorCard: React.FC<AuthenticatorCardProps> = ({
  account,
  grouping = "grouped",
  onTogglePin,
  onEdit,
  onViewDetails,
  onDelete,
  onIncrementHotp,
}) => {
  const [code, setCode] = useState<string>("------");
  const [remaining, setRemaining] = useState<number>(30);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isGeneratingHotp, setIsGeneratingHotp] = useState(false);
  const [uriCopiedWarning, setUriCopiedWarning] = useState(false);

  useEffect(() => {
    let active = true;

    if (account.type === "totp") {
      const updateCode = async () => {
        try {
          const generated = await generateTotp(account.secret, {
            period: account.period,
            digits: account.digits,
            algorithm: account.algorithm,
          });
          if (active) setCode(generated);
        } catch {
          if (active) setCode("ERROR");
        }
      };

      const tick = () => {
        const rem = getTotpRemainingSeconds(Date.now(), account.period);
        setRemaining(rem);
        if (rem === account.period || code === "------") {
          updateCode();
        }
      };

      tick();
      updateCode();
      const interval = setInterval(tick, 1000);
      return () => {
        active = false;
        clearInterval(interval);
      };
    } else {
      // HOTP
      const updateHotp = async () => {
        try {
          const generated = await generateHotp(
            account.secret,
            account.counter,
            {
              digits: account.digits,
              algorithm: account.algorithm,
            },
          );
          if (active) setCode(generated);
        } catch {
          if (active) setCode("ERROR");
        }
      };
      updateHotp();
      return () => {
        active = false;
      };
    }
  }, [account]);

  const handleNextHotp = async () => {
    setIsGeneratingHotp(true);
    try {
      const nextCounter = await onIncrementHotp(account.id);
      const nextCode = await generateHotp(account.secret, nextCounter, {
        digits: account.digits,
        algorithm: account.algorithm,
      });
      setCode(nextCode);
    } finally {
      setIsGeneratingHotp(false);
    }
  };

  const handleCopyUri = async () => {
    try {
      const uri = formatOtpUri(account);
      await navigator.clipboard.writeText(uri);
      setUriCopiedWarning(true);
      setTimeout(() => setUriCopiedWarning(false), 3000);
      setMenuOpen(false);
    } catch {
      setMenuOpen(false);
    }
  };

  return (
    <div className="relative p-2 rounded-xl app-card">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <BrandLogo issuer={account.issuer} name={account.name} size={28} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-semibold truncate leading-snug">
                {account.issuer}
              </h3>
              {account.group && (
                <span className="text-[10px] px-1.5 py-0.5 rounded app-badge font-medium">
                  {account.group}
                </span>
              )}
            </div>
            <p className="text-xs app-text-secondary truncate mt-0.5">
              {account.name}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onTogglePin(account)}
            className={`p-1 rounded transition-colors ${
              account.isPinned
                ? "text-amber-400 hover:bg-[var(--bg-subtle)]"
                : "app-text-muted hover:app-text-primary hover:bg-[var(--bg-subtle)]"
            }`}
            title={account.isPinned ? t("menu_unpin") : t("menu_pin")}
          >
            <Star size={15} fill={account.isPinned ? "currentColor" : "none"} />
          </button>

          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-1 rounded app-text-muted hover:app-text-primary hover:bg-[var(--bg-subtle)] transition-colors"
            >
              <MoreVertical size={16} />
            </button>

            {menuOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setMenuOpen(false)}
                />
                <div className="absolute right-0 top-7 z-20 w-44 rounded-lg app-modal py-1 text-xs shadow-sm">
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onViewDetails(account);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[var(--bg-subtle-hover)] text-left transition-colors"
                  >
                    <Info size={14} className="app-text-accent" />
                    <span>{t("menu_view_details")}</span>
                  </button>
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onEdit(account);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[var(--bg-subtle-hover)] text-left"
                  >
                    <Edit2 size={14} className="text-emerald-400" />
                    <span>{t("menu_edit")}</span>
                  </button>
                  <button
                    onClick={handleCopyUri}
                    className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[var(--bg-subtle-hover)] text-left"
                  >
                    <Link size={14} className="text-amber-400" />
                    <span>{t("menu_copy_uri")}</span>
                  </button>
                  <div className="my-1 border-t border-[var(--border-subtle)]" />
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      setShowDeleteConfirm(true);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-red-500/10 text-red-400 text-left"
                  >
                    <Trash2 size={14} />
                    <span>{t("menu_delete")}</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex-1">
          <CodeDisplay code={code} grouping={grouping} />
        </div>

        {account.type === "totp" ? (
          <CountdownRing remaining={remaining} period={account.period} />
        ) : (
          <button
            onClick={handleNextHotp}
            disabled={isGeneratingHotp}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg app-btn-primary text-xs font-medium transition-transform active:scale-95"
            title={t("hotp_next")}
          >
            <RefreshCw
              size={13}
              className={isGeneratingHotp ? "animate-spin" : ""}
            />
            <span>#{account.counter}</span>
          </button>
        )}
      </div>

      {uriCopiedWarning && (
        <div className="mt-2 p-1.5 rounded bg-amber-950/60 border border-amber-800/80 text-[11px] text-amber-200 flex items-center gap-1.5">
          <AlertTriangle size={13} className="shrink-0 text-amber-400" />
          <span>{t("copied_uri")}</span>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-xs rounded-xl app-modal p-4 shadow-sm">
            <h4 className="text-sm font-semibold app-text-primary mb-1">
              {t("delete_confirm_title")}
            </h4>
            <p className="text-xs app-text-secondary mb-2">
              {t("delete_confirm_desc", {
                issuer: account.issuer,
                name: account.name,
              })}
            </p>
            <p className="text-[11px] text-amber-400 mb-4 bg-amber-950/40 p-2 rounded border border-amber-900/50">
              {t("delete_confirm_warning")}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3 py-1.5 text-xs rounded-lg app-btn-secondary"
              >
                {t("cancel")}
              </button>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  onDelete(account.id);
                }}
                className="px-3 py-1.5 text-xs rounded-lg bg-red-600 text-white font-medium hover:bg-red-500"
              >
                {t("confirm_delete")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
