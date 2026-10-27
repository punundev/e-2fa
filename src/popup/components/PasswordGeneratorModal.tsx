import React, { useState, useEffect } from "react";
import {
  X,
  KeyRound,
  Copy,
  Check,
  Eye,
  EyeOff,
  RefreshCw,
  Trash2,
  ShieldCheck,
} from "lucide-react";
import {
  generatePassword,
  getSessionPassword,
  setSessionPassword,
  clearSessionPassword,
  getSessionPasswordOptions,
  setSessionPasswordOptions,
  PASSWORD_LENGTH_PRESETS,
  PasswordGeneratorOptions,
} from "../../lib/password-generator";
import { t } from "../../lib/i18n";

interface PasswordGeneratorModalProps {
  onClose: () => void;
  onToast?: (message: string) => void;
}

export const PasswordGeneratorModal: React.FC<PasswordGeneratorModalProps> = ({
  onClose,
  onToast,
}) => {
  const [options, setOptions] = useState<PasswordGeneratorOptions>(() =>
    getSessionPasswordOptions(),
  );
  const [password, setPassword] = useState<string>(() => {
    const saved = getSessionPassword();
    if (saved) return saved;
    const initialOpts = getSessionPasswordOptions();
    const initial = generatePassword(initialOpts);
    setSessionPassword(initial);
    return initial;
  });
  const [isMasked, setIsMasked] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    setSessionPasswordOptions(options);
  }, [options]);

  const handleCreateNew = (customOpts?: Partial<PasswordGeneratorOptions>) => {
    const nextOpts = { ...options, ...customOpts };
    const nextPassword = generatePassword(nextOpts);
    setPassword(nextPassword);
    setSessionPassword(nextPassword);
    setIsCopied(false);
  };

  const handleLengthPreset = (presetLength: number) => {
    const nextOpts = { ...options, length: presetLength };
    setOptions(nextOpts);
    handleCreateNew(nextOpts);
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const length = Number(e.target.value);
    const nextOpts = { ...options, length };
    setOptions(nextOpts);
    handleCreateNew(nextOpts);
  };

  const handleToggleOption = (key: keyof PasswordGeneratorOptions) => {
    const nextOpts = {
      ...options,
      [key]: !options[key],
    };

    const hasAny =
      nextOpts.uppercase ||
      nextOpts.lowercase ||
      nextOpts.numbers ||
      nextOpts.symbols;

    if (!hasAny) {
      return;
    }

    setOptions(nextOpts);
    handleCreateNew(nextOpts);
  };

  const handleCopy = async () => {
    if (!password) return;
    await navigator.clipboard.writeText(password);
    setIsCopied(true);
    if (onToast) {
      onToast(t("password_copied"));
    }
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleClear = () => {
    clearSessionPassword();
    setPassword("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 bg-black/70 backdrop-blur-xs">
      <div className="w-full max-w-sm rounded-2xl app-modal p-3 shadow-sm flex flex-col gap-2.5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2">
            <KeyRound size={17} className="app-text-accent" />
            <div>
              <h3 className="text-sm font-semibold app-text-primary">
                {t("password_generator_title")}
              </h3>
            </div>
          </div>
          <button onClick={onClose} className="app-btn-icon">
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="relative rounded-xl p-3 app-bg-subtle border border-[var(--border-subtle)] flex flex-col gap-2">
            <div className="flex items-center justify-between gap-1 text-[11px] app-text-muted">
              <span className="flex items-center gap-1 font-medium app-text-secondary">
                <ShieldCheck size={13} className="app-text-accent" />
                {t("password_length_chars", { count: password.length })}
              </span>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setIsMasked(!isMasked)}
                  className="p-1 rounded-md hover:app-bg-card app-text-muted hover:app-text-primary transition-colors"
                  title={isMasked ? t("password_show") : t("password_hide")}
                >
                  {isMasked ? <Eye size={13} /> : <EyeOff size={13} />}
                </button>
                {password && (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="p-1 rounded-md hover:app-bg-card text-red-400 hover:text-red-300 transition-colors"
                    title={t("password_clear")}
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>

            <div className="max-h-24 overflow-y-auto pr-1">
              {password ? (
                <p className="font-mono text-xs break-all select-all app-text-primary tracking-wide leading-relaxed">
                  {isMasked ? "•".repeat(password.length) : password}
                </p>
              ) : (
                <p className="text-xs italic app-text-muted text-center py-2">
                  {t("password_cleared")}
                </p>
              )}
            </div>

            <div className="pt-1 border-t border-[var(--border-subtle)] flex items-center justify-between text-[10px] app-text-muted">
              <span>{t("password_kept_notice")}</span>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            <button
              type="button"
              onClick={handleCopy}
              disabled={!password}
              className={`py-1.5 px-1 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-all shadow-xs ${
                isCopied
                  ? "bg-emerald-600 text-white"
                  : "app-btn-primary disabled:opacity-50"
              }`}
            >
              {isCopied ? <Check size={12} /> : <Copy size={12} />}
              <span>{isCopied ? t("btn_copied") : t("btn_copy")}</span>
            </button>

            <button
              type="button"
              onClick={() => handleCreateNew()}
              className="py-1.5 px-1 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 app-btn-secondary transition-all"
            >
              <RefreshCw size={12} className="app-text-accent" />
              <span>{t("btn_new")}</span>
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-1 border-t border-[var(--border-subtle)] text-xs">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="app-text-secondary font-medium">
                {t("password_length")}
              </label>
              <span className="text-[11px] font-mono app-text-accent font-semibold">
                {options.length}
              </span>
            </div>

            <div className="grid grid-cols-4 gap-1.5 mb-2">
              {PASSWORD_LENGTH_PRESETS.map((preset) => {
                const isSelected = options.length === preset;
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handleLengthPreset(preset)}
                    className={`py-1.5 px-1 rounded-lg text-xs font-semibold text-center transition-all ${
                      isSelected
                        ? "app-btn-primary shadow-xs ring-1 ring-[var(--accent)]"
                        : "app-btn-secondary opacity-80 hover:opacity-100"
                    }`}
                  >
                    {preset}
                  </button>
                );
              })}
            </div>

            <input
              type="range"
              min="32"
              max="256"
              step="1"
              value={options.length}
              onChange={handleSliderChange}
              className="w-full h-1.5 rounded-md cursor-pointer accent-[var(--accent)]"
            />
          </div>

          <div className="pt-2 border-t border-[var(--border-subtle)] flex flex-col gap-1.5">
            <div className="grid grid-cols-2 gap-1.5 text-[11px]">
              <button
                type="button"
                onClick={() => handleToggleOption("uppercase")}
                className={`p-2 rounded-lg border text-left flex items-center justify-between transition-colors ${
                  options.uppercase
                    ? "border-[var(--border-card-hover)] app-bg-subtle app-text-primary"
                    : "border-[var(--border-subtle)] opacity-60 app-text-muted"
                }`}
              >
                <span>{t("password_uppercase")}</span>
                {options.uppercase && (
                  <Check size={11} className="app-text-accent" />
                )}
              </button>

              <button
                type="button"
                onClick={() => handleToggleOption("lowercase")}
                className={`p-2 rounded-lg border text-left flex items-center justify-between transition-colors ${
                  options.lowercase
                    ? "border-[var(--border-card-hover)] app-bg-subtle app-text-primary"
                    : "border-[var(--border-subtle)] opacity-60 app-text-muted"
                }`}
              >
                <span>{t("password_lowercase")}</span>
                {options.lowercase && (
                  <Check size={11} className="app-text-accent" />
                )}
              </button>

              <button
                type="button"
                onClick={() => handleToggleOption("numbers")}
                className={`p-2 rounded-lg border text-left flex items-center justify-between transition-colors ${
                  options.numbers
                    ? "border-[var(--border-card-hover)] app-bg-subtle app-text-primary"
                    : "border-[var(--border-subtle)] opacity-60 app-text-muted"
                }`}
              >
                <span>{t("password_numbers")}</span>
                {options.numbers && (
                  <Check size={11} className="app-text-accent" />
                )}
              </button>

              <button
                type="button"
                onClick={() => handleToggleOption("symbols")}
                className={`p-2 rounded-lg border text-left flex items-center justify-between transition-colors ${
                  options.symbols
                    ? "border-[var(--border-card-hover)] app-bg-subtle app-text-primary"
                    : "border-[var(--border-subtle)] opacity-60 app-text-muted"
                }`}
              >
                <span>{t("password_symbols")}</span>
                {options.symbols && (
                  <Check size={11} className="app-text-accent" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
