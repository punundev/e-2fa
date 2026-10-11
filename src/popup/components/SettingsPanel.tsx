import React, { useState } from 'react';
import {
  X,
  Lock,
  Trash2,
  Shield,
  Image as ImageIcon,
  Upload,
  Trash,
} from 'lucide-react';
import { AppSettings, VaultState } from '../../types';
import { t } from '../../lib/i18n';
import { WALLPAPER_PRESETS, processWallpaperUpload } from '../../lib/wallpaper';

interface SettingsPanelProps {
  settings: AppSettings;
  vaultState: VaultState;
  onUpdateSettings: (settings: Partial<AppSettings>) => void;
  onLockVault: () => void;
  onWipeData: () => void;
  onClose: () => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  settings,
  vaultState,
  onUpdateSettings,
  onLockVault,
  onWipeData,
  onClose,
}) => {
  const [showWipeConfirm, setShowWipeConfirm] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const handleWallpaperFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const dataUrl = await processWallpaperUpload(file);
        onUpdateSettings({ customWallpaper: dataUrl });
      } catch (err) {
        console.error(err);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/70 backdrop-blur-xs">
      <div className="w-full max-w-sm rounded-2xl app-modal p-4 shadow-2xl flex flex-col gap-3 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <h3 className="text-sm font-semibold text-slate-100">{t('settings_title')}</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col gap-3 text-xs">
          <div>
            <label className="text-slate-300 font-medium mb-1.5 block">
              {t('theme_label')}
            </label>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <button
                type="button"
                onClick={() => onUpdateSettings({ theme: 'dark' })}
                className={`flex items-center gap-2 p-2 rounded-lg border text-left transition-all ${
                  settings.theme === 'dark'
                    ? 'border-blue-500 bg-slate-800 ring-1 ring-blue-500'
                    : 'border-slate-700 bg-slate-800/60 hover:border-slate-600'
                }`}
              >
                <div className="w-4 h-4 rounded-full bg-blue-600 border border-slate-700 shrink-0" />
                <span className="text-xs text-slate-200 font-medium truncate">{t('theme_slate')}</span>
              </button>

              <button
                type="button"
                onClick={() => onUpdateSettings({ theme: 'light' })}
                className={`flex items-center gap-2 p-2 rounded-lg border text-left transition-all ${
                  settings.theme === 'light'
                    ? 'border-blue-500 bg-slate-800 ring-1 ring-blue-500'
                    : 'border-slate-700 bg-slate-800/60 hover:border-slate-600'
                }`}
              >
                <div className="w-4 h-4 rounded-full bg-slate-100 border border-slate-300 shrink-0" />
                <span className="text-xs text-slate-200 font-medium truncate">{t('theme_light')}</span>
              </button>

              <button
                type="button"
                onClick={() => onUpdateSettings({ theme: 'oled' })}
                className={`flex items-center gap-2 p-2 rounded-lg border text-left transition-all ${
                  settings.theme === 'oled'
                    ? 'border-emerald-500 bg-slate-800 ring-1 ring-emerald-500'
                    : 'border-slate-700 bg-slate-800/60 hover:border-slate-600'
                }`}
              >
                <div className="w-4 h-4 rounded-full bg-black border border-emerald-500 shrink-0" />
                <span className="text-xs text-slate-200 font-medium truncate">{t('theme_oled')}</span>
              </button>

              <button
                type="button"
                onClick={() => onUpdateSettings({ theme: 'violet' })}
                className={`flex items-center gap-2 p-2 rounded-lg border text-left transition-all ${
                  settings.theme === 'violet'
                    ? 'border-purple-500 bg-slate-800 ring-1 ring-purple-500'
                    : 'border-slate-700 bg-slate-800/60 hover:border-slate-600'
                }`}
              >
                <div className="w-4 h-4 rounded-full bg-purple-700 border border-purple-400 shrink-0" />
                <span className="text-xs text-slate-200 font-medium truncate">{t('theme_violet')}</span>
              </button>
            </div>
            <select
              value={settings.theme}
              onChange={(e) => onUpdateSettings({ theme: e.target.value as any })}
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 focus:outline-none focus:border-blue-500"
            >
              <option value="system">{t('theme_system')}</option>
              <option value="dark">{t('theme_slate')}</option>
              <option value="light">{t('theme_light')}</option>
              <option value="oled">{t('theme_oled')}</option>
              <option value="violet">{t('theme_violet')}</option>
            </select>
          </div>

          {/* Custom Wallpaper Section */}
          <div className="pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-slate-300 font-medium flex items-center gap-1.5">
                <ImageIcon size={13} className="text-blue-400" />
                <span>{t('wallpaper_label')}</span>
              </label>
              {settings.customWallpaper && settings.customWallpaper !== 'none' && (
                <button
                  type="button"
                  onClick={() => onUpdateSettings({ customWallpaper: 'none' })}
                  className="text-[11px] text-red-400 hover:text-red-300 flex items-center gap-1"
                >
                  <Trash size={11} />
                  <span>{t('wallpaper_remove_btn')}</span>
                </button>
              )}
            </div>

            {/* Presets Row */}
            <div className="grid grid-cols-5 gap-1.5 mb-2">
              {WALLPAPER_PRESETS.map((preset) => {
                const isSelected = (settings.customWallpaper || 'none') === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => onUpdateSettings({ customWallpaper: preset.id })}
                    style={{ background: preset.previewGradient }}
                    className={`h-8 rounded-lg border transition-all relative overflow-hidden flex items-center justify-center ${
                      isSelected
                        ? 'border-blue-500 ring-2 ring-blue-500/80 scale-105'
                        : 'border-slate-700 opacity-70 hover:opacity-100 hover:border-slate-500'
                    }`}
                    title={t(preset.nameKey)}
                  />
                );
              })}
            </div>

            {/* Upload Custom Image Button */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleWallpaperFile}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-1.5 px-2.5 rounded-lg border border-slate-700 hover:border-blue-500 bg-slate-800/80 hover:bg-slate-800 text-slate-200 text-xs flex items-center justify-center gap-1.5 transition-colors"
            >
              <Upload size={13} className="text-blue-400" />
              <span>{t('wallpaper_upload_btn')}</span>
            </button>

            {/* Wallpaper Dim Slider when wallpaper is active */}
            {settings.customWallpaper && settings.customWallpaper !== 'none' && (
              <div className="mt-2 p-2 rounded-lg bg-slate-800/60 border border-slate-700/60">
                <div className="flex items-center justify-between text-[11px] text-slate-300 mb-1">
                  <span>{t('wallpaper_dim_label', { val: settings.wallpaperDim ?? 70 })}</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="90"
                  step="5"
                  value={settings.wallpaperDim ?? 70}
                  onChange={(e) => onUpdateSettings({ wallpaperDim: Number(e.target.value) })}
                  className="w-full accent-blue-500 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
                />
              </div>
            )}
          </div>

          <div>
            <label className="text-slate-300 font-medium mb-1 block">
              {t('autolock_label')}
            </label>
            <select
              value={settings.autoLockTimeout}
              onChange={(e) => onUpdateSettings({ autoLockTimeout: Number(e.target.value) })}
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 focus:outline-none focus:border-blue-500"
            >
              <option value={1}>{t('autolock_minutes', { minutes: 1 })}</option>
              <option value={5}>{t('autolock_minutes', { minutes: 5 })}</option>
              <option value={15}>{t('autolock_minutes', { minutes: 15 })}</option>
              <option value={30}>{t('autolock_minutes', { minutes: 30 })}</option>
              <option value={0}>{t('autolock_disabled')}</option>
            </select>
          </div>

          <div>
            <label className="text-slate-300 font-medium mb-1 block">
              {t('clipboard_clear_label')}
            </label>
            <select
              value={settings.clipboardClearDelay}
              onChange={(e) => onUpdateSettings({ clipboardClearDelay: Number(e.target.value) })}
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 focus:outline-none focus:border-blue-500"
            >
              <option value={15}>{t('clipboard_clear_seconds', { seconds: 15 })}</option>
              <option value={30}>{t('clipboard_clear_seconds', { seconds: 30 })}</option>
              <option value={60}>{t('clipboard_clear_seconds', { seconds: 60 })}</option>
              <option value={0}>{t('clipboard_clear_disabled')}</option>
            </select>
          </div>

          <div>
            <label className="text-slate-300 font-medium mb-1 block">
              {t('code_display_label')}
            </label>
            <select
              value={settings.codeGrouping}
              onChange={(e) => onUpdateSettings({ codeGrouping: e.target.value as any })}
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 focus:outline-none focus:border-blue-500"
            >
              <option value="grouped">{t('code_grouped')}</option>
              <option value="plain">{t('code_plain')}</option>
            </select>
          </div>

          {vaultState.hasPassword && (
            <div className="pt-1">
              <button
                onClick={() => {
                  onLockVault();
                  onClose();
                }}
                className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition-colors"
              >
                <Lock size={14} className="text-amber-400" />
                <span>{t('lock_vault')}</span>
              </button>
            </div>
          )}

          <div className="pt-2 border-t border-slate-800">
            <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Shield size={12} className="text-blue-400" />
              <span>{t('about_title')}</span>
            </h4>
            <div className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-[11px] text-slate-300 leading-relaxed">
              <p className="font-semibold text-slate-200">{t('about_version')}</p>
              <p className="text-slate-400 mt-0.5">{t('about_offline_desc')}</p>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800">
            <h4 className="text-[11px] font-semibold text-red-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Trash2 size={12} />
              <span>{t('danger_zone')}</span>
            </h4>
            <button
              onClick={() => setShowWipeConfirm(true)}
              className="w-full py-2 px-3 rounded-lg bg-red-950/60 hover:bg-red-900/80 border border-red-800 text-red-300 font-medium transition-colors"
            >
              {t('wipe_all_title')}
            </button>
          </div>
        </div>

        {showWipeConfirm && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
            <div className="w-full max-w-xs rounded-xl bg-slate-900 border border-red-800 p-4 shadow-2xl text-center">
              <Trash2 size={24} className="text-red-500 mx-auto mb-2" />
              <h4 className="text-sm font-bold text-red-200 mb-1">{t('wipe_all_title')}</h4>
              <p className="text-xs text-slate-300 mb-4">{t('wipe_all_confirm')}</p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowWipeConfirm(false)}
                  className="px-3 py-1.5 text-xs rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  {t('cancel')}
                </button>
                <button
                  onClick={() => {
                    setShowWipeConfirm(false);
                    onWipeData();
                    onClose();
                  }}
                  className="px-3 py-1.5 text-xs rounded-lg bg-red-600 text-white font-medium hover:bg-red-500"
                >
                  {t('wipe_all_btn')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
