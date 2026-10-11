import React from 'react';
import { TranslationKey } from './i18n';

export interface WallpaperPreset {
  id: string;
  nameKey: TranslationKey;
  previewGradient: string;
  cssBackground?: string;
  backgroundSize?: string;
}

export const WALLPAPER_PRESETS: WallpaperPreset[] = [
  {
    id: 'none',
    nameKey: 'wallpaper_preset_none',
    previewGradient: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
  },
  {
    id: 'preset-aurora',
    nameKey: 'wallpaper_preset_aurora',
    previewGradient: 'radial-gradient(circle at 10% 20%, #38bdf8 0%, #a855f7 50%, #10b981 100%)',
    cssBackground:
      'radial-gradient(at 0% 0%, rgba(56, 189, 248, 0.45) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(168, 85, 247, 0.45) 0px, transparent 50%), radial-gradient(at 50% 50%, rgba(16, 185, 129, 0.3) 0px, transparent 50%)',
  },
  {
    id: 'preset-nebula',
    nameKey: 'wallpaper_preset_nebula',
    previewGradient: 'radial-gradient(circle at 50% 50%, #7e22ce 0%, #1e1b4b 60%, #0369a1 100%)',
    cssBackground:
      'radial-gradient(circle at 20% 30%, rgba(99, 102, 241, 0.5) 0%, transparent 45%), radial-gradient(circle at 80% 70%, rgba(168, 85, 247, 0.5) 0%, transparent 50%), radial-gradient(circle at 50% 50%, rgba(14, 165, 233, 0.35) 0%, transparent 60%)',
  },
  {
    id: 'preset-grid',
    nameKey: 'wallpaper_preset_grid',
    previewGradient: 'linear-gradient(135deg, #090d16 0%, #1e293b 100%)',
    cssBackground:
      'radial-gradient(circle, rgba(59, 130, 246, 0.25) 1.5px, transparent 1.5px), linear-gradient(to right, rgba(30, 41, 59, 0.3) 1px, transparent 1px)',
    backgroundSize: '24px 24px, 24px 24px',
  },
  {
    id: 'preset-carbon',
    nameKey: 'wallpaper_preset_carbon',
    previewGradient: 'linear-gradient(45deg, #111827 25%, #1f2937 25%, #1f2937 50%, #111827 50%)',
    cssBackground:
      'repeating-linear-gradient(45deg, rgba(255, 255, 255, 0.04) 0px, rgba(255, 255, 255, 0.04) 2px, transparent 2px, transparent 6px)',
    backgroundSize: '12px 12px',
  },
];

export function getWallpaperStyle(wallpaper?: string): React.CSSProperties {
  if (!wallpaper || wallpaper === 'none') {
    return {};
  }

  const preset = WALLPAPER_PRESETS.find((p) => p.id === wallpaper);
  if (preset && preset.cssBackground) {
    return {
      backgroundImage: preset.cssBackground,
      backgroundSize: preset.backgroundSize || 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: preset.backgroundSize ? 'repeat' : 'no-repeat',
    };
  }

  if (wallpaper.startsWith('data:image/') || wallpaper.startsWith('http')) {
    return {
      backgroundImage: `url("${wallpaper}")`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
    };
  }

  return {};
}

export function processWallpaperUpload(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 800;
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(reader.result as string);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => reject(new Error('Invalid image file'));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}
