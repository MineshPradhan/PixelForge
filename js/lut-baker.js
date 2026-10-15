/**
 * PixelForge Studio - 3D LUT Baker & .cube Exporter (Phase 14)
 * Bakes document color grading & adjustment layers directly into industry-standard
 * 3D Color Lookup Tables (.cube) for Hollywood film production, Premiere, DaVinci Resolve, and Unreal Engine.
 */

(function (global) {
  'use strict';

  class LutBaker {
    /**
     * Bake a color transform function into Adobe .cube format
     * 
     * @param {Function} transformFn - Function receiving [r, g, b] in [0, 1] range, returning [r, g, b] in [0, 1]
     * @param {Object} options
     *   - size: lattice dimension (17, 33, or 64. Default: 33)
     *   - title: LUT title metadata (Default: 'PixelForge Custom 3D LUT')
     * @returns {string} Standard Adobe .cube formatted text
     */
    static bakeToCube(transformFn, options = {}) {
      const size = options.size || 33;
      const title = options.title || 'PixelForge Custom 3D LUT';

      const lines = [];
      lines.push(`# Created by PixelForge Studio Pro`);
      lines.push(`TITLE "${title}"`);
      lines.push(`LUT_3D_SIZE ${size}`);
      lines.push(`DOMAIN_MIN 0.0 0.0 0.0`);
      lines.push(`DOMAIN_MAX 1.0 1.0 1.0`);

      const step = 1.0 / (size - 1);

      // In standard 3D .cube format: Red varies fastest, then Green, then Blue slowest
      for (let b = 0; b < size; b++) {
        const inB = b * step;
        for (let g = 0; g < size; g++) {
          const inG = g * step;
          for (let r = 0; r < size; r++) {
            const inR = r * step;

            // Transform input color
            const outRgb = transformFn([inR, inG, inB]) || [inR, inG, inB];
            const clampedR = Math.max(0.0, Math.min(1.0, outRgb[0]));
            const clampedG = Math.max(0.0, Math.min(1.0, outRgb[1]));
            const clampedB = Math.max(0.0, Math.min(1.0, outRgb[2]));

            lines.push(`${clampedR.toFixed(6)} ${clampedG.toFixed(6)} ${clampedB.toFixed(6)}`);
          }
        }
      }

      return lines.join('\n');
    }

    /**
     * Create a transform function by compositing active document adjustments
     */
    static createTransformFromAdjustments(adjustments = []) {
      return (rgb) => {
        let r = rgb[0] * 255;
        let g = rgb[1] * 255;
        let b = rgb[2] * 255;

        for (const adj of adjustments) {
          if (!adj || adj.enabled === false) continue;

          switch (adj.type) {
            case 'brightness_contrast': {
              const br = adj.brightness || 0; // -100 to 100
              const ct = (adj.contrast || 0) / 100; // -100 to 100
              const factor = (1.0 + ct) / (1.0 - Math.min(0.99, ct));
              r = Math.max(0, Math.min(255, (r - 128 + br) * factor + 128));
              g = Math.max(0, Math.min(255, (g - 128 + br) * factor + 128));
              b = Math.max(0, Math.min(255, (b - 128 + br) * factor + 128));
              break;
            }

            case 'invert': {
              r = 255 - r;
              g = 255 - g;
              b = 255 - b;
              break;
            }

            case 'sepia': {
              const tr = 0.393 * r + 0.769 * g + 0.189 * b;
              const tg = 0.349 * r + 0.686 * g + 0.168 * b;
              const tb = 0.272 * r + 0.534 * g + 0.131 * b;
              r = Math.min(255, tr);
              g = Math.min(255, tg);
              b = Math.min(255, tb);
              break;
            }

            case 'color_balance': {
              const cr = adj.cyan_red || 0;
              const mg = adj.magenta_green || 0;
              const yb = adj.yellow_blue || 0;
              r = Math.max(0, Math.min(255, r + cr));
              g = Math.max(0, Math.min(255, g + mg));
              b = Math.max(0, Math.min(255, b + yb));
              break;
            }
          }
        }

        return [r / 255.0, g / 255.0, b / 255.0];
      };
    }

    /**
     * Trigger browser download for generated .cube LUT
     */
    static downloadCube(cubeText, filename = 'PixelForge_Grade.cube') {
      if (typeof window === 'undefined' || typeof document === 'undefined') return;
      const blob = new Blob([cubeText], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }

  // Export
  global.LutBaker = LutBaker;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { LutBaker };
  }
})(typeof window !== 'undefined' ? window : globalThis);
