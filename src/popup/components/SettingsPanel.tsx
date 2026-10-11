import React, { useState, useRef } from "react";
import {
  X,
  Lock,
  Trash2,
  Shield,
  Image as ImageIcon,
  Upload,
  Trash,
  Sun,
  Moon,
  Palette,
  Circle,
  Square,
  Layers,
  Box,
  Command,
  Disc,
  Check,
  Download,
  ArrowUpDown,
} from "lucide-react";
import { AppSettings, VaultState, ThemeColor, ThemeDesign } from "../../types";
import { t, TranslationKey } from "../../lib/i18n";
import { WALLPAPER_PRESETS, processWallpaperUpload } from "../../lib/wallpaper";

const COLOR_OPTIONS: Array<{
  id: ThemeColor;
  nameKey: TranslationKey;
  hex: string;
}> = [
  { id: "blue", nameKey: "color_blue", hex: "#3b82f6" },
  { id: "green", nameKey: "color_green", hex: "#10b981" },
  { id: "violet", nameKey: "color_violet", hex: "#8b5cf6" },
  { id: "yellow", nameKey: "color_yellow", hex: "#f59e0b" },
  { id: "red", nameKey: "color_red", hex: "#ef4444" },
  { id: "orange", nameKey: "color_orange", hex: "#f97316" },
  { id: "cyan", nameKey: "color_cyan", hex: "#06b6d4" },
  { id: "rose", nameKey: "color_rose", hex: "#ec4899" },
];

const DESIGN_OPTIONS: Array<{
  id: ThemeDesign;
  nameKey: TranslationKey;
  descKey: TranslationKey;
  icon: typeof Circle;
}> = [
  {
    id: "rounded",
    nameKey: "design_rounded",
    descKey: "design_rounded_desc",
    icon: Circle,
  },
  {
    id: "sharp",
    nameKey: "design_sharp",
    descKey: "design_sharp_desc",
    icon: Square,
  },
  {
    id: "compact",
    nameKey: "design_compact",
    descKey: "design_compact_desc",
    icon: Layers,
  },
  {
    id: "clay",
    nameKey: "design_clay",
    descKey: "design_clay_desc",
    icon: Box,
  },
  {
    id: "apple",
    nameKey: "design_apple",
    descKey: "design_apple_desc",
    icon: Command,
  },
  {
    id: "neumorphic",
    nameKey: "design_neumorphic",
    descKey: "design_neumorphic_desc",
    icon: Disc,
  },
];

interface SettingsPanelProps {
  settings: AppSettings;
  vaultState: VaultState;
  onUpdateSettings: (settings: Partial<AppSettings>) => void;
  onLockVault: () => void;
  onWipeData: () => void;
  onClose: () => void;
  onOpenImportExport?: (tab: "import" | "export") => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  settings,
  vaultState,
  onUpdateSettings,
  onLockVault,
  onWipeData,
  onClose,
  onOpenImportExport,
}) => {
  const [showWipeConfirm, setShowWipeConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleWallpaperFile = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 bg-black/70 backdrop-blur-xs">
      <div className="w-full max-w-sm rounded-2xl app-modal p-4 shadow-sm flex flex-col gap-2 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)]">
          <h3 className="text-sm font-semibold app-text-primary">
            {t("settings_title")}
          </h3>
          <button onClick={onClose} className="app-btn-icon">
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col gap-2.5 text-xs">
          {/* 1. Mode Option */}
          <div>
            <label className="app-text-secondary font-medium mb-1.5 flex items-center gap-1.5">
              <Sun size={13} className="text-amber-400" />
              <span>{t("theme_mode_title")}</span>
            </label>
            <div className="grid grid-cols-2 gap-1.5 p-0.5 rounded-md app-bg-subtle border border-[var(--border-subtle)]">
              <button
                type="button"
                onClick={() => {
                  onUpdateSettings({ mode: "dark", theme: "dark" });
                }}
                className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md font-medium transition-all ${
                  (settings.mode ||
                    (settings.theme === "light" ? "light" : "dark")) === "dark"
                    ? "app-bg-card app-text-primary shadow-xs border border-[var(--border-card)]"
                    : "app-text-muted hover:app-text-primary"
                }`}
              >
                <Moon size={13} />
                <span>{t("theme_mode_dark")}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onUpdateSettings({ mode: "light", theme: "light" });
                }}
                className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md font-medium transition-all ${
                  (settings.mode ||
                    (settings.theme === "light" ? "light" : "dark")) === "light"
                    ? "app-bg-card app-text-primary shadow-xs border border-[var(--border-card)]"
                    : "app-text-muted hover:app-text-primary"
                }`}
              >
                <Sun size={13} />
                <span>{t("theme_mode_light")}</span>
              </button>
            </div>
          </div>

          {/* 2. Color Option */}
          <div>
            <label className="app-text-secondary font-medium mb-1.5 flex items-center gap-1.5">
              <Palette size={13} className="app-text-accent" />
              <span>{t("theme_color_title")}</span>
            </label>
            <div className="grid grid-cols-8 gap-1.5 p-0.5 rounded-md app-bg-subtle border border-[var(--border-subtle)]">
              {COLOR_OPTIONS.map((color) => {
                const activeColor =
                  settings.accentColor ||
                  (settings.theme === "violet"
                    ? "violet"
                    : settings.theme === "oled"
                      ? "green"
                      : "blue");
                const isSelected = activeColor === color.id;
                return (
                  <button
                    key={color.id}
                    type="button"
                    onClick={() => onUpdateSettings({ accentColor: color.id })}
                    title={t(color.nameKey)}
                    aria-label={t(color.nameKey)}
                    style={{ backgroundColor: color.hex }}
                    className={`aspect-square rounded-md flex items-center justify-center transition-all shadow-xs ${
                      isSelected
                        ? "ring-2 ring-offset-2 ring-[var(--accent)] ring-offset-[var(--bg-main)] scale-110"
                        : "opacity-80 hover:opacity-100 hover:scale-105"
                    }`}
                  >
                    {isSelected && (
                      <Check
                        size={12}
                        className="text-white drop-shadow-xs"
                        strokeWidth={3}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Design Style Option */}
          <div>
            <label className="app-text-secondary font-medium mb-1.5 flex items-center gap-1.5">
              <Layers size={13} className="app-text-accent" />
              <span>{t("theme_design_title")}</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {DESIGN_OPTIONS.map((design) => {
                const activeDesign = settings.designStyle || "rounded";
                const isSelected = activeDesign === design.id;
                const Icon = design.icon;

                return (
                  <button
                    key={design.id}
                    type="button"
                    onClick={() => onUpdateSettings({ designStyle: design.id })}
                    className={`flex flex-col p-2.5 border text-left transition-all ${
                      design.id === "sharp"
                        ? "rounded-none"
                        : design.id === "compact"
                          ? "rounded-md"
                          : design.id === "glass"
                            ? "rounded-2xl"
                            : "rounded-xl"
                    } ${
                      isSelected
                        ? "border-[var(--accent)] app-bg-card ring-1 ring-[var(--accent)] shadow-xs"
                        : "border-[var(--border-subtle)] app-bg-subtle hover:border-[var(--border-card-hover)]"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <Icon
                        size={14}
                        className={
                          isSelected ? "app-text-accent" : "app-text-muted"
                        }
                      />
                      <span className="text-xs font-semibold app-text-primary">
                        {t(design.nameKey)}
                      </span>
                    </div>
                    <span className="text-[10px] app-text-secondary line-clamp-2 leading-tight">
                      {t(design.descKey)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Wallpaper Section */}
          <div className="pt-2 border-t border-[var(--border-subtle)]">
            <div className="flex items-center justify-between mb-1.5">
              <label className="app-text-secondary font-medium flex items-center gap-1.5">
                <ImageIcon size={13} className="app-text-accent" />
                <span>{t("wallpaper_label")}</span>
              </label>
              {settings.customWallpaper &&
                settings.customWallpaper !== "none" && (
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateSettings({ customWallpaper: "none" })
                    }
                    className="text-[11px] text-red-400 hover:text-red-300 flex items-center gap-1"
                  >
                    <Trash size={11} />
                    <span>{t("wallpaper_remove_btn")}</span>
                  </button>
                )}
            </div>

            {/* Presets Row */}
            <div className="grid grid-cols-5 gap-1.5 mb-2">
              {WALLPAPER_PRESETS.map((preset) => {
                const isSelected =
                  (settings.customWallpaper || "none") === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() =>
                      onUpdateSettings({ customWallpaper: preset.id })
                    }
                    style={{ background: preset.previewGradient }}
                    className={`h-8 rounded-md border transition-all relative overflow-hidden flex items-center justify-center ${
                      isSelected
                        ? "border-[var(--accent)] ring-2 ring-[var(--accent)] scale-105"
                        : "border-[var(--border-subtle)] opacity-70 hover:opacity-100 hover:border-[var(--border-card-hover)]"
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
              className="w-full py-1.5 px-2.5 rounded-md app-btn-secondary text-xs flex items-center justify-center gap-1.5 transition-colors"
            >
              <Upload size={13} className="app-text-accent" />
              <span>{t("wallpaper_upload_btn")}</span>
            </button>

            {/* Wallpaper Dim Slider when wallpaper is active */}
            {settings.customWallpaper &&
              settings.customWallpaper !== "none" && (
                <div className="mt-2 p-2 rounded-md app-bg-subtle border border-[var(--border-subtle)]">
                  <div className="flex items-center justify-between text-[11px] app-text-secondary mb-1">
                    <span>
                      {t("wallpaper_dim_label", {
                        val: settings.wallpaperDim ?? 70,
                      })}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="20"
                    max="90"
                    step="5"
                    value={settings.wallpaperDim ?? 70}
                    onChange={(e) =>
                      onUpdateSettings({ wallpaperDim: Number(e.target.value) })
                    }
                    className="w-full h-1.5 rounded-md cursor-pointer accent-[var(--accent)]"
                  />
                </div>
              )}
          </div>

          <div>
            <label className="app-text-secondary font-medium mb-1 block">
              {t("autolock_label")}
            </label>
            <select
              value={settings.autoLockTimeout}
              onChange={(e) =>
                onUpdateSettings({ autoLockTimeout: Number(e.target.value) })
              }
              className="w-full px-2.5 py-1.5 rounded-md app-input"
            >
              <option value={1}>{t("autolock_minutes", { minutes: 1 })}</option>
              <option value={5}>{t("autolock_minutes", { minutes: 5 })}</option>
              <option value={15}>
                {t("autolock_minutes", { minutes: 15 })}
              </option>
              <option value={30}>
                {t("autolock_minutes", { minutes: 30 })}
              </option>
              <option value={0}>{t("autolock_disabled")}</option>
            </select>
          </div>

          <div>
            <label className="app-text-secondary font-medium mb-1 block">
              {t("clipboard_clear_label")}
            </label>
            <select
              value={settings.clipboardClearDelay}
              onChange={(e) =>
                onUpdateSettings({
                  clipboardClearDelay: Number(e.target.value),
                })
              }
              className="w-full px-2.5 py-1.5 rounded-md app-input"
            >
              <option value={15}>
                {t("clipboard_clear_seconds", { seconds: 15 })}
              </option>
              <option value={30}>
                {t("clipboard_clear_seconds", { seconds: 30 })}
              </option>
              <option value={60}>
                {t("clipboard_clear_seconds", { seconds: 60 })}
              </option>
              <option value={0}>{t("clipboard_clear_disabled")}</option>
            </select>
          </div>

          <div>
            <label className="app-text-secondary font-medium mb-1 block">
              {t("code_display_label")}
            </label>
            <select
              value={settings.codeGrouping}
              onChange={(e) =>
                onUpdateSettings({ codeGrouping: e.target.value as any })
              }
              className="w-full px-2.5 py-1.5 rounded-md app-input"
            >
              <option value="grouped">{t("code_grouped")}</option>
              <option value="plain">{t("code_plain")}</option>
            </select>
          </div>

          {vaultState.hasPassword && (
            <div className="pt-1">
              <button
                onClick={() => {
                  onLockVault();
                  onClose();
                }}
                className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-md app-btn-secondary font-medium transition-colors"
              >
                <Lock size={14} className="text-amber-400" />
                <span>{t("lock_vault")}</span>
              </button>
            </div>
          )}

          <div className="pt-2 border-t border-[var(--border-subtle)]">
            <h4 className="text-[11px] font-semibold app-text-muted uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <ArrowUpDown size={12} className="app-text-accent" />
              <span>{t("export_import_center")}</span>
            </h4>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenImportExport?.("import");
                }}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-md app-btn-secondary text-xs font-medium transition-colors"
              >
                <Download size={13} />
                <span>{t("tab_import")}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenImportExport?.("export");
                }}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-md app-btn-secondary text-xs font-medium transition-colors"
              >
                <Upload size={13} />
                <span>{t("tab_export")}</span>
              </button>
            </div>
          </div>

          <div className="pt-2 border-t border-[var(--border-subtle)]">
            <h4 className="text-[11px] font-semibold app-text-muted uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Shield size={12} className="app-text-accent" />
              <span>{t("about_title")}</span>
            </h4>
            <div className="p-2.5 rounded-md app-bg-subtle border border-[var(--border-subtle)] text-[11px] app-text-secondary leading-relaxed">
              <p className="font-semibold app-text-primary">
                {t("about_version")}
              </p>
              <p className="app-text-muted mt-0.5">{t("about_offline_desc")}</p>
            </div>
          </div>

          <div className="pt-2 border-t border-[var(--border-subtle)]">
            <h4 className="text-[11px] font-semibold text-red-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Trash2 size={12} />
              <span>{t("danger_zone")}</span>
            </h4>
            <button
              onClick={() => setShowWipeConfirm(true)}
              className="w-full py-2 px-3 rounded-md bg-red-500/10 hover:bg-red-500/20 border border-red-500/40 text-red-400 font-medium transition-colors"
            >
              {t("wipe_all_title")}
            </button>
          </div>
        </div>

        {showWipeConfirm && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
            <div className="w-full max-w-xs rounded-xl app-modal border border-red-500/40 p-4 shadow-sm text-center">
              <Trash2 size={24} className="text-red-500 mx-auto mb-2" />
              <h4 className="text-sm font-bold text-red-400 mb-1">
                {t("wipe_all_title")}
              </h4>
              <p className="text-xs app-text-secondary mb-4">
                {t("wipe_all_confirm")}
              </p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowWipeConfirm(false)}
                  className="px-3 py-1.5 text-xs rounded-md app-btn-secondary"
                >
                  {t("cancel")}
                </button>
                <button
                  onClick={() => {
                    setShowWipeConfirm(false);
                    onWipeData();
                    onClose();
                  }}
                  className="px-3 py-1.5 text-xs rounded-md bg-red-600 text-white font-medium hover:bg-red-500"
                >
                  {t("wipe_all_btn")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
