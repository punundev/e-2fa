import React, { useState, useEffect, useMemo } from 'react';
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
  Palette,
} from 'lucide-react';
import { AuthenticatorAccount, AppSettings, VaultState } from '../types';
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
  deleteAccount,
  incrementHotpCounter,
  clearAllData,
} from '../lib/database';
import { AuthenticatorCard } from './components/AuthenticatorCard';
import { SearchBar } from './components/SearchBar';
import { AddAccountModal } from './components/AddAccountModal';
import { ImportModal } from './components/ImportModal';
import { ExportModal } from './components/ExportModal';
import { AccountDetailsModal } from './components/AccountDetailsModal';
import { SettingsPanel } from './components/SettingsPanel';
import { PasswordDialog } from './components/PasswordDialog';
import { t } from '../lib/i18n';
import { getWallpaperStyle } from '../lib/wallpaper';

export const App: React.FC = () => {
  const [vaultState, setVaultState] = useState<VaultState>({
    isInitialized: false,
    isLocked: true,
    hasPassword: false,
  });
  const [settings, setSettings] = useState<AppSettings>({
    theme: 'dark',
    autoLockTimeout: 5,
    clipboardClearDelay: 30,
    confirmSecretReveal: true,
    confirmPlaintextExport: true,
    codeGrouping: 'grouped',
    defaultSort: 'alphabetical',
    defaultGroup: 'All',
  });
  const [accounts, setAccounts] = useState<AuthenticatorAccount[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('All');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AuthenticatorAccount | null>(null);
  const [detailsAccount, setDetailsAccount] = useState<AuthenticatorAccount | null>(null);
  const [pendingBatchImport, setPendingBatchImport] = useState<AuthenticatorAccount[] | null>(null);

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
  }, []);

  useEffect(() => {
    let themeKey = settings.theme;
    if (themeKey === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      themeKey = prefersDark ? 'dark' : 'light';
    }
    const dataTheme = themeKey === 'dark' ? 'slate' : themeKey;
    document.documentElement.setAttribute('data-theme', dataTheme);
    document.body.className = `theme-${dataTheme} ${dataTheme === 'light' ? 'light' : ''}`.trim();
  }, [settings.theme]);

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
    const updatedAccount = { ...account, isPinned: !account.isPinned, updatedAt: Date.now() };
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
    for (const acc of importedList) {
      await saveAccount(acc);
    }
    const updated = await getAllAccounts();
    setAccounts(updated);
    touchVaultActivity(settings.autoLockTimeout);
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

  const resolvedTheme = useMemo(() => {
    if (settings.theme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return settings.theme;
  }, [settings.theme]);

  const handleToggleTheme = async () => {
    const sequence: Array<'dark' | 'light' | 'oled' | 'violet'> = ['dark', 'light', 'oled', 'violet'];
    const currentIndex = sequence.indexOf(resolvedTheme as any);
    const nextTheme = sequence[(currentIndex + 1) % sequence.length];
    await handleUpdateSettings({ theme: nextTheme });
  };

  const getThemeLabel = (theme: string) => {
    if (theme === 'light') return t('theme_light');
    if (theme === 'oled') return t('theme_oled');
    if (theme === 'violet') return t('theme_violet');
    return t('theme_slate');
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
        acc.issuer.toLowerCase().includes(q) || acc.name.toLowerCase().includes(q);
      if (!matchesSearch) return false;

      if (selectedGroup === 'Pinned') return Boolean(acc.isPinned);
      if (selectedGroup !== 'All') return acc.group === selectedGroup;
      return true;
    });

    list.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;

      if (settings.defaultSort === 'recent') {
        return b.createdAt - a.createdAt;
      }
      return a.issuer.localeCompare(b.issuer);
    });

    return list;
  }, [accounts, searchQuery, selectedGroup, settings.defaultSort]);

  if (loading) {
    return (
      <div className="w-[380px] h-[520px] flex items-center justify-center bg-slate-900 text-slate-400">
        <Shield size={32} className="animate-pulse text-blue-500" />
      </div>
    );
  }

  const wallpaperStyle = getWallpaperStyle(settings.customWallpaper);
  const hasWallpaper = Boolean(settings.customWallpaper && settings.customWallpaper !== 'none');

  const themeKey = resolvedTheme === 'dark' ? 'slate' : resolvedTheme;

  return (
    <div
      data-theme={themeKey}
      className="w-[380px] min-h-[520px] max-h-[600px] flex flex-col app-shell overflow-hidden font-sans relative"
      style={wallpaperStyle}
    >
      {hasWallpaper && (
        <div
          className="absolute inset-0 pointer-events-none z-0"
          style={{
            backgroundColor:
              resolvedTheme === 'light'
                ? `rgba(248, 250, 252, ${(settings.wallpaperDim ?? 70) / 100})`
                : resolvedTheme === 'oled'
                ? `rgba(0, 0, 0, ${(settings.wallpaperDim ?? 80) / 100})`
                : resolvedTheme === 'violet'
                ? `rgba(11, 8, 22, ${(settings.wallpaperDim ?? 75) / 100})`
                : `rgba(10, 14, 23, ${(settings.wallpaperDim ?? 70) / 100})`,
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
          }}
        />
      )}
      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-3 py-2.5 app-header shrink-0">
        <div className="flex items-center gap-2">
          <img
            src="icons/logo.png"
            alt="SecureAuth Logo"
            className="w-7 h-7 rounded-lg shadow-md shadow-blue-600/30 object-contain"
          />
          <div>
            <h1 className="text-xs font-bold text-slate-100 leading-none">
              {t('app_name')}
            </h1>
            <span className="text-[10px] text-slate-400">
              {t('app_subtitle')}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {vaultState.hasPassword && !vaultState.isLocked && (
            <button
              onClick={handleLockNow}
              className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition-colors"
              title={t('lock_vault')}
            >
              <Lock size={15} />
            </button>
          )}

          {!vaultState.isLocked && (
            <>
              <button
                onClick={() => setShowImportModal(true)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                title={t('export_import_center')}
              >
                <ArrowUpDown size={15} />
              </button>
              <button
                onClick={() => {
                  setEditingAccount(null);
                  setShowAddModal(true);
                }}
                className="p-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white shadow-sm transition-colors"
                title={t('add_account')}
              >
                <Plus size={15} />
              </button>
            </>
          )}

          <button
            onClick={handleToggleTheme}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            title={t('theme_toggle', { name: getThemeLabel(resolvedTheme) })}
            aria-label={t('theme_toggle', { name: getThemeLabel(resolvedTheme) })}
          >
            {resolvedTheme === 'light' ? (
              <Sun size={15} />
            ) : resolvedTheme === 'oled' ? (
              <span className="text-[11px] font-bold text-emerald-400">OLED</span>
            ) : resolvedTheme === 'violet' ? (
              <Palette size={15} className="text-purple-400" />
            ) : (
              <Moon size={15} />
            )}
          </button>

          <button
            onClick={() => setShowSettingsModal(true)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            title={t('settings_title')}
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
              <div className="flex flex-col gap-2.5">
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
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-400 text-xs">
                <p>{t('no_accounts_found')}</p>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-4 text-center my-auto">
                <img
                  src="icons/logo.png"
                  alt="SecureAuth Logo"
                  className="w-12 h-12 rounded-2xl shadow-lg shadow-blue-500/20 mb-3 object-contain"
                />
                <h2 className="text-sm font-bold text-slate-100 mb-1">
                  {t('no_accounts_welcome')}
                </h2>
                <p className="text-xs text-slate-400 max-w-[260px] mb-4">
                  {t('no_accounts_desc')}
                </p>

                <div className="flex flex-col gap-2 w-full max-w-[260px]">
                  <button
                    onClick={() => {
                      setEditingAccount(null);
                      setShowAddModal(true);
                    }}
                    className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition-colors shadow-lg shadow-blue-600/20"
                  >
                    <PlusCircle size={15} />
                    <span>{t('btn_add_manual')}</span>
                  </button>

                  <button
                    onClick={() => setShowImportModal(true)}
                    className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors border border-slate-700/80"
                  >
                    <QrCode size={15} className="text-blue-400" />
                    <span>{t('btn_import_migration')}</span>
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
          onImportComplete={(imported) => {
            handleImportAccounts(imported);
            setPendingBatchImport(null);
          }}
          onClose={() => {
            setShowImportModal(false);
            setPendingBatchImport(null);
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
          onClose={() => setShowSettingsModal(false)}
        />
      )}
    </div>
  );
};
