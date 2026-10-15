/**
 * PixelForge Studio - 3D Tangent Normal Map & Height Map Generator (Phase 14)
 * Generates industry-standard game dev & 3D tangent-space normal maps [Nx, Ny, Nz] -> RGB
 * and parallax displacement height maps from any texture or photo (Photoshop 3D Parity).
 */

(function (global) {
  'use strict';

  class NormalHeightMapEngine {
    /**
     * Generate 3D Tangent-Space Normal Map
     * 
     * @param {ImageData} srcImageData 
     * @param {Object} options
     *   - strength: intensity multiplier (default: 2.5)
     *   - invertX: invert red channel (default: false)
     *   - invertY: invert green channel (true for DirectX / Unreal, false for OpenGL / Unity, default: false)
     *   - blurRadius: low-pass noise filter radius (default: 0)
     */
    static generateNormalMap(srcImageData, options = {}) {
      const { width, height, data } = srcImageData;
      const strength = options.strength !== undefined ? options.strength : 2.5;
      const invertX = !!options.invertX;
      const invertY = !!options.invertY;
      const blurRadius = options.blurRadius || 0;

      // Calculate grayscale height field
      const heightField = new Float32Array(width * height);
      for (let i = 0; i < data.length; i += 4) {
        // Standard perceptual luminance
        heightField[i / 4] = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255.0;
      }

      // Optional blur on height field to smooth out micro-noise
      const smoothed = blurRadius > 0 ? this._blurHeightField(heightField, width, height, blurRadius) : heightField;

      const outData = new Uint8ClampedArray(width * height * 4);

      // Sobel 3x3 convolution kernels for gradient extraction
      for (let y = 0; y < height; y++) {
        const yTop = Math.max(0, y - 1);
        const yBot = Math.min(height - 1, y + 1);

        for (let x = 0; x < width; x++) {
          const xLeft = Math.max(0, x - 1);
          const xRight = Math.min(width - 1, x + 1);

          // Sample 8 neighbors
          const tl = smoothed[yTop * width + xLeft];
          const tc = smoothed[yTop * width + x];
          const tr = smoothed[yTop * width + xRight];
          const ml = smoothed[y * width + xLeft];
          const mr = smoothed[y * width + xRight];
          const bl = smoothed[yBot * width + xLeft];
          const bc = smoothed[yBot * width + x];
          const br = smoothed[yBot * width + xRight];

          // Sobel dx (Horizontal gradient)
          const dx = (tr + 2.0 * mr + br) - (tl + 2.0 * ml + bl);

          // Sobel dy (Vertical gradient)
          const dy = (bl + 2.0 * bc + br) - (tl + 2.0 * tc + tr);

          // Construct 3D normal vector
          let nx = -dx * strength;
          let ny = -dy * strength;
          let nz = 1.0;

          if (invertX) nx = -nx;
          if (invertY) ny = -ny;

          // Normalize vector: length = sqrt(nx^2 + ny^2 + nz^2)
          const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1.0;
          nx /= len;
          ny /= len;
          nz /= len;

          // Convert from [-1, 1] to [0, 255] RGB
          const idx = (y * width + x) * 4;
          outData[idx]     = Math.round((nx * 0.5 + 0.5) * 255);
          outData[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
          outData[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
          outData[idx + 3] = data[idx + 3]; // preserve alpha
        }
      }

      if (typeof ImageData !== 'undefined') {
        return new ImageData(outData, width, height);
      }
      return { data: outData, width, height };
    }

    /**
     * Generate Parallax Displacement Height Map
     * 
     * @param {ImageData} srcImageData 
     * @param {Object} options
     *   - contrast: contrast boost multiplier (default: 1.2)
     *   - invert: invert depth (white = highest, black = lowest)
     */
    static generateHeightMap(srcImageData, options = {}) {
      const { width, height, data } = srcImageData;
      const contrast = options.contrast !== undefined ? options.contrast : 1.2;
      const invert = !!options.invert;
      const outData = new Uint8ClampedArray(width * height * 4);

      for (let i = 0; i < data.length; i += 4) {
        let lum = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255.0;

        // Apply contrast curve around midtone 0.5
        lum = (lum - 0.5) * contrast + 0.5;
        lum = Math.max(0.0, Math.min(1.0, lum));

        if (invert) lum = 1.0 - lum;

        const val = Math.round(lum * 255);
        outData[i]     = val;
        outData[i + 1] = val;
        outData[i + 2] = val;
        outData[i + 3] = data[i + 3];
      }

      if (typeof ImageData !== 'undefined') {
        return new ImageData(outData, width, height);
      }
      return { data: outData, width, height };
    }

    static _blurHeightField(field, width, height, radius) {
      const r = Math.max(1, Math.round(radius));
      const out = new Float32Array(field.length);

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          let sum = 0;
          let count = 0;
          for (let dy = -r; dy <= r; dy++) {
            const ny = y + dy;
            if (ny < 0 || ny >= height) continue;
            for (let dx = -r; dx <= r; dx++) {
              const nx = x + dx;
              if (nx < 0 || nx >= width) continue;
              sum += field[ny * width + nx];
              count++;
            }
          }
          out[y * width + x] = sum / count;
        }
      }
      return out;
    }
  }

  // Export
  global.NormalHeightMapEngine = NormalHeightMapEngine;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { NormalHeightMapEngine };
  }
})(typeof window !== 'undefined' ? window : globalThis);
