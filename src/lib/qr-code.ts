import QRCode from 'qrcode';
import jsQR from 'jsqr';

export async function generateQrDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 280,
    color: {
      dark: '#0f172a',
      light: '#ffffff',
    },
  });
}

export interface CropBounds {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

export function detectWhiteCardBounds(
  data: Uint8ClampedArray,
  w: number,
  h: number
): CropBounds | null {
  let minX = w;
  let maxX = 0;
  let minY = h;
  let maxY = 0;
  let count = 0;

  const step = Math.max(1, Math.floor(Math.min(w, h) / 150));
  const startY = Math.floor(h * 0.08);
  const endY = Math.floor(h * 0.92);
  const startX = Math.floor(w * 0.02);
  const endX = Math.floor(w * 0.98);

  for (let y = startY; y < endY; y += step) {
    for (let x = startX; x < endX; x += step) {
      const idx = (y * w + x) * 4;
      if (data[idx] > 190 && data[idx + 1] > 190 && data[idx + 2] > 190) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        count++;
      }
    }
  }

  if (count > 25 && maxX > minX && maxY > minY) {
    const pad = Math.floor(Math.min(w, h) * 0.02);
    const sx = Math.max(0, minX - pad);
    const sy = Math.max(0, minY - pad);
    const sw = Math.min(w - sx, maxX - minX + pad * 2);
    const sh = Math.min(h - sy, maxY - minY + pad * 2);
    if (sw > 50 && sh > 50) {
      return { sx, sy, sw, sh };
    }
  }

  return null;
}

function cropPixels(
  data: Uint8ClampedArray,
  w: number,
  _h: number,
  sx: number,
  sy: number,
  sw: number,
  sh: number
): Uint8ClampedArray {
  const buf = new Uint8ClampedArray(sw * sh * 4);
  for (let y = 0; y < sh; y++) {
    const srcRow = ((sy + y) * w + sx) * 4;
    const dstRow = y * sw * 4;
    buf.set(data.subarray(srcRow, srcRow + sw * 4), dstRow);
  }
  return buf;
}

function downscalePixels(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  targetW: number
): { data: Uint8ClampedArray; w: number; h: number } {
  if (w <= targetW) return { data, w, h };
  const scale = targetW / w;
  const targetH = Math.round(h * scale);
  const buf = new Uint8ClampedArray(targetW * targetH * 4);
  for (let y = 0; y < targetH; y++) {
    const srcY = Math.min(h - 1, Math.floor(y / scale));
    const srcRow = srcY * w * 4;
    const dstRow = y * targetW * 4;
    for (let x = 0; x < targetW; x++) {
      const srcX = Math.min(w - 1, Math.floor(x / scale));
      const sIdx = srcRow + srcX * 4;
      const dIdx = dstRow + x * 4;
      buf[dIdx] = data[sIdx];
      buf[dIdx + 1] = data[sIdx + 1];
      buf[dIdx + 2] = data[sIdx + 2];
      buf[dIdx + 3] = data[sIdx + 3];
    }
  }
  return { data: buf, w: targetW, h: targetH };
}

export function decodeQrFromPixels(
  data: Uint8ClampedArray,
  w: number,
  h: number
): string | null {
  if (w <= 0 || h <= 0) return null;

  let code = jsQR(data, w, h);
  if (code?.data) return code.data;

  const whiteBounds = detectWhiteCardBounds(data, w, h);
  if (whiteBounds) {
    const cropped = cropPixels(
      data,
      w,
      h,
      whiteBounds.sx,
      whiteBounds.sy,
      whiteBounds.sw,
      whiteBounds.sh
    );
    code = jsQR(cropped, whiteBounds.sw, whiteBounds.sh);
    if (code?.data) return code.data;

    for (const tw of [800, 600, 500, 450]) {
      if (whiteBounds.sw > tw) {
        const sc = downscalePixels(cropped, whiteBounds.sw, whiteBounds.sh, tw);
        code = jsQR(sc.data, sc.w, sc.h);
        if (code?.data) return code.data;
      }
    }
  }

  for (const tw of [1200, 1000, 800, 600, 500, 450]) {
    if (w > tw) {
      const sc = downscalePixels(data, w, h, tw);
      code = jsQR(sc.data, sc.w, sc.h);
      if (code?.data) return code.data;
    }
  }

  const sq = Math.floor(Math.min(w, h) * 0.85);
  if (sq > 50) {
    const cx = Math.floor((w - sq) / 2);
    const cy = Math.floor((h - sq) / 2);
    const center = cropPixels(data, w, h, cx, cy, sq, sq);
    code = jsQR(center, sq, sq);
    if (code?.data) return code.data;
  }

  return null;
}

export function decodeQrFromImageData(imageData: ImageData): string | null {
  return decodeQrFromPixels(imageData.data, imageData.width, imageData.height);
}

export async function decodeQrFromImageFile(file: File): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = async () => {
        try {
          if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
            try {
              const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
              const results = await detector.detect(img);
              if (results && results.length > 0 && results[0]?.rawValue) {
                resolve(results[0].rawValue);
                return;
              }
            } catch {
              // Fallback to canvas
            }
          }

          const origW = img.naturalWidth || img.width;
          const origH = img.naturalHeight || img.height;

          const canvas = document.createElement('canvas');
          canvas.width = origW;
          canvas.height = origH;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) {
            resolve(null);
            return;
          }
          ctx.drawImage(img, 0, 0);

          const origImageData = ctx.getImageData(0, 0, origW, origH);

          let code = jsQR(origImageData.data, origW, origH);
          if (code?.data) {
            resolve(code.data);
            return;
          }

          const whiteBounds = detectWhiteCardBounds(origImageData.data, origW, origH);
          if (whiteBounds) {
            const cropCanvas = document.createElement('canvas');
            cropCanvas.width = whiteBounds.sw;
            cropCanvas.height = whiteBounds.sh;
            const cropCtx = cropCanvas.getContext('2d', { willReadFrequently: true });
            if (cropCtx) {
              cropCtx.drawImage(
                img,
                whiteBounds.sx,
                whiteBounds.sy,
                whiteBounds.sw,
                whiteBounds.sh,
                0,
                0,
                whiteBounds.sw,
                whiteBounds.sh
              );
              const cropData = cropCtx.getImageData(0, 0, whiteBounds.sw, whiteBounds.sh);
              code = jsQR(cropData.data, whiteBounds.sw, whiteBounds.sh);
              if (code?.data) {
                resolve(code.data);
                return;
              }

              for (const targetW of [800, 600, 500, 450]) {
                if (whiteBounds.sw > targetW) {
                  const targetH = Math.round((whiteBounds.sh * targetW) / whiteBounds.sw);
                  cropCanvas.width = targetW;
                  cropCanvas.height = targetH;
                  cropCtx.drawImage(
                    img,
                    whiteBounds.sx,
                    whiteBounds.sy,
                    whiteBounds.sw,
                    whiteBounds.sh,
                    0,
                    0,
                    targetW,
                    targetH
                  );
                  const scaledCropData = cropCtx.getImageData(0, 0, targetW, targetH);
                  code = jsQR(scaledCropData.data, targetW, targetH);
                  if (code?.data) {
                    resolve(code.data);
                    return;
                  }
                }
              }
            }
          }

          for (const targetW of [1200, 1000, 800, 600, 500, 450]) {
            if (origW > targetW) {
              const targetH = Math.round((origH * targetW) / origW);
              canvas.width = targetW;
              canvas.height = targetH;
              ctx.drawImage(img, 0, 0, targetW, targetH);
              const scaledData = ctx.getImageData(0, 0, targetW, targetH);
              code = jsQR(scaledData.data, targetW, targetH);
              if (code?.data) {
                resolve(code.data);
                return;
              }
            }
          }

          const sq = Math.floor(Math.min(origW, origH) * 0.85);
          if (sq > 50) {
            const cx = Math.floor((origW - sq) / 2);
            const cy = Math.floor((origH - sq) / 2);
            canvas.width = sq;
            canvas.height = sq;
            ctx.drawImage(img, cx, cy, sq, sq, 0, 0, sq, sq);
            const centerData = ctx.getImageData(0, 0, sq, sq);
            code = jsQR(centerData.data, sq, sq);
            if (code?.data) {
              resolve(code.data);
              return;
            }
          }

          const fallback = decodeQrFromPixels(origImageData.data, origW, origH);
          resolve(fallback);
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = () => reject(new Error('Failed to load image file'));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}
