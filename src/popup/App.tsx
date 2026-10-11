import React, { useState, useEffect, useMemo } from "react";
import {
  Shield,
  Plus,
  ArrowUpDown,
  Settings,
  Lock,
  PlusCircle,
  QrCode,
  Sun,
  Moon,
  CheckCircle2,
} from "lucide-react";
import { AuthenticatorAccount, AppSettings, VaultState } from "../types";
import {
  getAllAccounts,
  getSettings,
  saveSettings,
  getVaultState,
  setupVaultPassword,
  initializeWithoutPassword,
  unlockVault,
  lockVault,
  touchVaultActivity,
  saveAccount,
  saveAccounts,
  deleteAccount,
  incrementHotpCounter,
  clearAllData,
} from "../lib/database";
import { AuthenticatorCard } from "./components/AuthenticatorCard";
import { SearchBar } from "./components/SearchBar";
import { AddAccountModal } from "./components/AddAccountModal";
import { ImportModal } from "./components/ImportModal";
import { ExportModal } from "./components/ExportModal";
import { AccountDetailsModal } from "./components/AccountDetailsModal";
import { SettingsPanel } from "./components/SettingsPanel";
import { PasswordDialog } from "./components/PasswordDialog";
import { t } from "../lib/i18n";
import { getWallpaperStyle } from "../lib/wallpaper";

export const App: React.FC = () => {
  const [vaultState, setVaultState] = useState<VaultState>({
    isInitialized: false,
    isLocked: true,
    hasPassword: false,
  });
  const [settings, setSettings] = useState<AppSettings>({
    theme: "dark",
    autoLockTimeout: 5,
    clipboardClearDelay: 30,
    confirmSecretReveal: true,
    confirmPlaintextExport: true,
    codeGrouping: "grouped",
    defaultSort: "alphabetical",
    defaultGroup: "All",
  });
  const [accounts, setAccounts] = useState<AuthenticatorAccount[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("All");

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importModalTab, setImportModalTab] = useState<"import" | "export">("import");
  const [showExportModal, setShowExportModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [editingAccount, setEditingAccount] =
    useState<AuthenticatorAccount | null>(null);
  const [detailsAccount, setDetailsAccount] =
    useState<AuthenticatorAccount | null>(null);
  const [pendingBatchImport, setPendingBatchImport] = useState<
    AuthenticatorAccount[] | null
  >(null);
  const [autoTriggerPicker, setAutoTriggerPicker] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const refreshVault = async () => {
    try {
      const state = await getVaultState();
      setVaultState(state);
      const appSettings = await getSettings();
      setSettings(appSettings);

      if (!state.isLocked && state.isInitialized) {
        const loaded = await getAllAccounts();
        setAccounts(loaded);
        touchVaultActivity(appSettings.autoLockTimeout);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshVault();
    const params = new URLSearchParams(window.location.search);
    if (params.get("action") === "import" || params.get("import") === "1") {
      setShowImportModal(true);
      if (params.get("picker") === "1") {
        setAutoTriggerPicker(true);
      }
    }
  }, []);

  const resolvedMode = useMemo(() => {
    const mode =
      settings.mode || (settings.theme === "light" ? "light" : "dark");
    if (mode === "system") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    }
    return mode;
  }, [settings.mode, settings.theme]);

  const activeColor =
    settings.accentColor ||
    (settings.theme === "violet"
      ? "violet"
      : settings.theme === "oled"
        ? "green"
        : "blue");
  const activeDesign = settings.designStyle || "rounded";

  useEffect(() => {
    document.documentElement.setAttribute("data-mode", resolvedMode);
    document.documentElement.setAttribute("data-color", activeColor);
    document.documentElement.setAttribute("data-design", activeDesign);
    document.documentElement.setAttribute(
      "data-theme",
      resolvedMode === "dark" ? "slate" : "light",
    );
    document.documentElement.classList.toggle("dark", resolvedMode === "dark");
    document.documentElement.classList.toggle("light", resolvedMode === "light");
    document.documentElement.className =
      `mode-${resolvedMode} color-${activeColor} design-${activeDesign} ${resolvedMode}`.trim();
    document.body.className =
      `mode-${resolvedMode} color-${activeColor} design-${activeDesign} ${resolvedMode}`.trim();
  }, [resolvedMode, activeColor, activeDesign]);

  const handleUnlock = async (password: string): Promise<boolean> => {
    const success = await unlockVault(password);
    if (success) {
      await refreshVault();
      return true;
    }
    return false;
  };

  const handleSetupPassword = async (password: string) => {
    await setupVaultPassword(password);
    await refreshVault();
  };

  const handleSkipPassword = async () => {
    await initializeWithoutPassword();
    await refreshVault();
  };

  const handleLockNow = () => {
    lockVault();
    setVaultState((prev) => ({ ...prev, isLocked: true }));
  };

  const handleSaveAccount = async (account: AuthenticatorAccount) => {
    await saveAccount(account);
    const updated = await getAllAccounts();
    setAccounts(updated);
    touchVaultActivity(settings.autoLockTimeout);
  };

  const handleDeleteAccount = async (id: string) => {
    await deleteAccount(id);
    const updated = await getAllAccounts();
    setAccounts(updated);
    touchVaultActivity(settings.autoLockTimeout);
  };

  const handleTogglePin = async (account: AuthenticatorAccount) => {
    const updatedAccount = {
      ...account,
      isPinned: !account.isPinned,
      updatedAt: Date.now(),
    };
    await saveAccount(updatedAccount);
    const updated = await getAllAccounts();
    setAccounts(updated);
    touchVaultActivity(settings.autoLockTimeout);
  };

  const handleIncrementHotp = async (id: string): Promise<number> => {
    const nextCounter = await incrementHotpCounter(id);
    const updated = await getAllAccounts();
    setAccounts(updated);
    touchVaultActivity(settings.autoLockTimeout);
    return nextCounter;
  };

  const handleImportAccounts = async (importedList: AuthenticatorAccount[]) => {
    if (!vaultState.isInitialized) {
      await initializeWithoutPassword();
      setVaultState((prev) => ({
        ...prev,
        isInitialized: true,
        hasPassword: false,
      }));
    }
    await saveAccounts(importedList);
    const updated = await getAllAccounts();
    setAccounts(updated);
    touchVaultActivity(settings.autoLockTimeout);
    showToast(t("success_accounts_imported", { count: importedList.length }));
  };

  const handleUpdateSettings = async (updates: Partial<AppSettings>) => {
    const saved = await saveSettings(updates);
    setSettings(saved);
  };

  const handleWipeData = async () => {
    await clearAllData();
    setAccounts([]);
    await refreshVault();
  };

  const handleToggleTheme = async () => {
    const nextMode = resolvedMode === "dark" ? "light" : "dark";
    await handleUpdateSettings({ mode: nextMode, theme: nextMode });
  };

  const availableGroups = useMemo(() => {
    const set = new Set<string>();
    for (const a of accounts) {
      if (a.group) set.add(a.group);
    }
    return Array.from(set);
  }, [accounts]);

  const filteredAccounts = useMemo(() => {
    let list = accounts.filter((acc) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        acc.issuer.toLowerCase().includes(q) ||
        acc.name.toLowerCase().includes(q);
      if (!matchesSearch) return false;

      if (selectedGroup === "Pinned") return Boolean(acc.isPinned);
      if (selectedGroup !== "All") return acc.group === selectedGroup;
      return true;
    });

    list.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;

      if (settings.defaultSort === "recent") {
        return b.createdAt - a.createdAt;
      }
      return a.issuer.localeCompare(b.issuer);
    });

    return list;
  }, [accounts, searchQuery, selectedGroup, settings.defaultSort]);

  if (loading) {
    return (
      <div className="w-[380px] h-[520px] flex items-center justify-center app-shell">
        <Shield size={32} className="animate-pulse app-text-accent" />
      </div>
    );
  }

  const wallpaperStyle = getWallpaperStyle(settings.customWallpaper);
  const hasWallpaper = Boolean(
    settings.customWallpaper && settings.customWallpaper !== "none",
  );

  return (
    <div
      data-mode={resolvedMode}
      data-color={activeColor}
      data-design={activeDesign}
      data-theme={resolvedMode === "dark" ? "slate" : "light"}
      className={`w-[380px] min-h-[520px] max-h-[600px] flex flex-col app-shell overflow-hidden font-sans relative mode-${resolvedMode} color-${activeColor} design-${activeDesign}`}
      style={wallpaperStyle}
    >
      {toastMessage && (
        <div className="absolute top-14 left-3 right-3 z-50 p-2.5 rounded-xl bg-emerald-600 text-white text-xs font-medium shadow-lg flex items-center gap-2">
          <CheckCircle2 size={16} className="shrink-0 text-white" />
          <span className="flex-1">{toastMessage}</span>
        </div>
      )}
      {hasWallpaper && (
        <div
          className="absolute inset-0 pointer-events-none z-0"
          style={{
            backgroundColor:
              resolvedMode === "light"
                ? `rgba(248, 250, 252, ${(settings.wallpaperDim ?? 70) / 100})`
                : `rgba(0, 0, 0, ${(settings.wallpaperDim ?? 80) / 100})`,
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
          }}
        />
      )}
      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-3 py-2.5 app-header shrink-0">
        <div className="flex items-center gap-2">
          <img
            src="icons/logo.png"
            alt="SecureAuth Logo"
            className="w-7 h-7 rounded-lg shadow-sm object-contain"
          />
          <div>
            <h1 className="text-xs font-bold app-text-primary leading-none">
              {t("app_name")}
            </h1>
            <span className="text-[10px] app-text-muted">
              {t("app_subtitle")}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {vaultState.hasPassword && !vaultState.isLocked && (
            <button
              onClick={handleLockNow}
              className="app-btn-icon hover:text-amber-400"
              title={t("lock_vault")}
            >
              <Lock size={15} />
            </button>
          )}

          {!vaultState.isLocked && (
            <>
              <button
                onClick={() => setShowImportModal(true)}
                className="app-btn-icon"
                title={t("export_import_center")}
              >
                <ArrowUpDown size={15} />
              </button>
              <button
                onClick={() => {
                  setEditingAccount(null);
                  setShowAddModal(true);
                }}
                className="p-1.5 rounded-lg app-btn-primary shadow-xs transition-colors"
                title={t("add_account")}
              >
                <Plus size={15} />
              </button>
            </>
          )}

          <button
            onClick={handleToggleTheme}
            className="app-btn-icon"
            title={
              resolvedMode === "light"
                ? t("theme_toggle_dark")
                : t("theme_toggle_light")
            }
            aria-label={
              resolvedMode === "light"
                ? t("theme_toggle_dark")
                : t("theme_toggle_light")
            }
          >
            {resolvedMode === "light" ? <Sun size={15} /> : <Moon size={15} />}
          </button>

          <button
            onClick={() => setShowSettingsModal(true)}
            className="app-btn-icon"
            title={t("settings_title")}
          >
            <Settings size={15} />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 flex-1 overflow-y-auto p-3 flex flex-col">
        {!vaultState.isInitialized ? (
          <PasswordDialog
            mode="setup"
            onSetup={handleSetupPassword}
            onSkipSetup={handleSkipPassword}
          />
        ) : vaultState.isLocked ? (
          <PasswordDialog mode="unlock" onUnlock={handleUnlock} />
        ) : (
          <>
            {accounts.length > 0 && (
              <SearchBar
                query={searchQuery}
                onQueryChange={setSearchQuery}
                selectedGroup={selectedGroup}
                onGroupChange={setSelectedGroup}
                availableGroups={availableGroups}
              />
            )}

            {filteredAccounts.length > 0 ? (
              <div className="flex flex-col gap-1">
                {filteredAccounts.map((account) => (
                  <AuthenticatorCard
                    key={account.id}
                    account={account}
                    grouping={settings.codeGrouping}
                    onTogglePin={handleTogglePin}
                    onEdit={(acc) => {
                      setEditingAccount(acc);
                      setShowAddModal(true);
                    }}
                    onViewDetails={(acc) => setDetailsAccount(acc)}
                    onDelete={handleDeleteAccount}
                    onIncrementHotp={handleIncrementHotp}
                  />
                ))}
              </div>
            ) : accounts.length > 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center app-text-muted text-xs">
                <p>{t("no_accounts_found")}</p>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-4 text-center my-auto">
                <img
                  src="icons/logo.png"
                  alt="SecureAuth Logo"
                  className="w-12 h-12 rounded-2xl shadow-md mb-3 object-contain"
                />
                <h2 className="text-sm font-bold app-text-primary mb-1">
                  {t("no_accounts_welcome")}
                </h2>
                <p className="text-xs app-text-secondary max-w-[260px] mb-4">
                  {t("no_accounts_desc")}
                </p>

                <div className="flex flex-col gap-2 w-full max-w-[260px]">
                  <button
                    onClick={() => {
                      setEditingAccount(null);
                      setShowAddModal(true);
                    }}
                    className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl app-btn-primary font-medium text-xs transition-colors shadow-sm"
                  >
                    <PlusCircle size={15} />
                    <span>{t("btn_add_manual")}</span>
                  </button>

                  <button
                    onClick={() => setShowImportModal(true)}
                    className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl app-btn-secondary text-xs font-medium transition-colors"
                  >
                    <QrCode size={15} className="app-text-accent" />
                    <span>{t("btn_import_migration")}</span>
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Modals */}
      {showAddModal && (
        <AddAccountModal
          existingAccounts={accounts}
          initialAccount={editingAccount}
          onSave={handleSaveAccount}
          onBatchImport={(imported) => {
            setPendingBatchImport(imported);
            setShowImportModal(true);
          }}
          onClose={() => {
            setShowAddModal(false);
            setEditingAccount(null);
          }}
        />
      )}

      {showImportModal && (
        <ImportModal
          existingAccounts={accounts}
          preloadedAccounts={pendingBatchImport || undefined}
          autoTriggerPicker={autoTriggerPicker}
          initialTab={importModalTab}
          onImportComplete={async (imported) => {
            await handleImportAccounts(imported);
            setPendingBatchImport(null);
          }}
          onClose={() => {
            setShowImportModal(false);
            setPendingBatchImport(null);
            setAutoTriggerPicker(false);
          }}
        />
      )}

      {showExportModal && (
        <ExportModal
          accounts={accounts}
          onClose={() => setShowExportModal(false)}
        />
      )}

      {detailsAccount && (
        <AccountDetailsModal
          account={detailsAccount}
          onClose={() => setDetailsAccount(null)}
        />
      )}

      {showSettingsModal && (
        <SettingsPanel
          settings={settings}
          vaultState={vaultState}
          onUpdateSettings={handleUpdateSettings}
          onLockVault={handleLockNow}
          onWipeData={handleWipeData}
          onOpenImportExport={(tab) => {
            setImportModalTab(tab);
            setShowImportModal(true);
          }}
          onClose={() => setShowSettingsModal(false)}
        />
      )}
    </div>
  );
};
