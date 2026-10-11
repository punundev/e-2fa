import { describe, it, expect } from 'vitest';
import { generateQrDataUrl, decodeQrFromPixels, detectWhiteCardBounds } from '../src/lib/qr-code';
import QRCode from 'qrcode';

describe('QR Code Decoding & Bounds Detection', () => {
  it('generates a valid QR data URL', async () => {
    const dataUrl = await generateQrDataUrl('otpauth://totp/Test:user?secret=JBSWY3DPEHPK3PXP');
    expect(dataUrl).toMatch(/^data:image\/png;base64,/);
  });

  it('correctly decodes a QR code embedded inside a phone-screenshot-like container with dark borders', async () => {
    const testUri = 'otpauth://totp/AcmeCorp:alice@example.com?secret=HXDMVJECJJWSRB3HWIZR4IFUGFTMXBOZ&issuer=AcmeCorp';
    
    // Generate raw QR matrix
    const qrMatrix = QRCode.create(testUri, { errorCorrectionLevel: 'M' });
    const moduleCount = qrMatrix.modules.size;
    const moduleScale = 6;
    const qrPixelSize = moduleCount * moduleScale;

    // Create a phone-like canvas: 400 wide x 800 tall, with dark red/brown background
    const screenW = 400;
    const screenH = 800;
    const pixels = new Uint8ClampedArray(screenW * screenH * 4);

    // Fill screen with dark background (rgb: 25, 10, 10)
    for (let i = 0; i < pixels.length; i += 4) {
      pixels[i] = 25;
      pixels[i + 1] = 10;
      pixels[i + 2] = 10;
      pixels[i + 3] = 255;
    }

    // Place a white square container in the middle (size: 320x320)
    const cardSize = 320;
    const cardX = Math.floor((screenW - cardSize) / 2);
    const cardY = Math.floor((screenH - cardSize) / 2);

    for (let cy = 0; cy < cardSize; cy++) {
      for (let cx = 0; cx < cardSize; cx++) {
        const pIdx = ((cardY + cy) * screenW + (cardX + cx)) * 4;
        pixels[pIdx] = 255;
        pixels[pIdx + 1] = 255;
        pixels[pIdx + 2] = 255;
        pixels[pIdx + 3] = 255;
      }
    }

    // Draw the QR code inside the white container
    const qrOffsetX = cardX + Math.floor((cardSize - qrPixelSize) / 2);
    const qrOffsetY = cardY + Math.floor((cardSize - qrPixelSize) / 2);

    for (let row = 0; row < moduleCount; row++) {
      for (let col = 0; col < moduleCount; col++) {
        const isDark = qrMatrix.modules.get(row, col);
        const color = isDark ? 0 : 255;
        for (let my = 0; my < moduleScale; my++) {
          for (let mx = 0; mx < moduleScale; mx++) {
            const px = qrOffsetX + col * moduleScale + mx;
            const py = qrOffsetY + row * moduleScale + my;
            const pIdx = (py * screenW + px) * 4;
            pixels[pIdx] = color;
            pixels[pIdx + 1] = color;
            pixels[pIdx + 2] = color;
            pixels[pIdx + 3] = 255;
          }
        }
      }
    }

    // Test detectWhiteCardBounds
    const bounds = detectWhiteCardBounds(pixels, screenW, screenH);
    expect(bounds).not.toBeNull();
    expect(bounds!.sw).toBeGreaterThanOrEqual(cardSize);
    expect(bounds!.sh).toBeGreaterThanOrEqual(cardSize);

    // Test robust decodeQrFromPixels
    const decoded = decodeQrFromPixels(pixels, screenW, screenH);
    expect(decoded).toBe(testUri);
  });
});
