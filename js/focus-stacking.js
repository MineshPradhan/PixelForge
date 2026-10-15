/**
 * PixelForge Studio - Focus Stacking & Depth-of-Field Blending Engine
 * Photoshop Parity for Edit -> Auto-Blend Layers -> Stack Images:
 * - High-frequency Laplacian sharpness energy evaluation per focal slice
 * - Spatial low-pass smoothing of focus maps to prevent noise speckle
 * - Weighted soft-falloff depth fusion producing infinite depth of field
 * - Generates both merged composite and individual layer focus masks
 */

class FocusStackingEngine {
  constructor() {}

  /**
   * Computes high-frequency edge sharpness map for an image
   * @param {ImageData} imgData - Source image data
   * @returns {Float32Array} Normalized sharpness energy map
   */
  computeSharpnessMap(imgData) {
    const { width: w, height: h, data } = imgData;
    const lum = new Float32Array(w * h);
    for (let i = 0; i < lum.length; i++) {
      const idx = i * 4;
      lum[i] = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
    }

    const laplacian = new Float32Array(w * h);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const center = lum[y * w + x];
        const left = lum[y * w + (x - 1)];
        const right = lum[y * w + (x + 1)];
        const up = lum[(y - 1) * w + x];
        const down = lum[(y + 1) * w + x];

        // 4-neighborhood Laplacian edge energy
        const val = Math.abs(4 * center - left - right - up - down);
        laplacian[y * w + x] = val;
      }
    }

    // Smooth sharpness map with a 5x5 separable box filter
    const smoothed = new Float32Array(w * h);
    const radius = 3;
    for (let y = radius; y < h - radius; y++) {
      for (let x = radius; x < w - radius; x++) {
        let sum = 0;
        let count = 0;
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            sum += laplacian[(y + dy) * w + (x + dx)];
            count++;
          }
        }
        smoothed[y * w + x] = sum / count;
      }
    }

    return smoothed;
  }

  /**
   * Stacks and blends multiple bracketed focus layers
   * @param {Array<ImageData>} imageList - List of ImageData from focus-bracketed layers
   * @param {Object} options - Stacking options
   *   @param {number} options.contrastPower - Focus weight sharpness power (default 4.0)
   *   @param {boolean} options.generateMasks - Whether to generate per-layer masks
   * @returns {Object} { composite: ImageData, layerMasks: Array<Uint8Array> }
   */
  stack(imageList, options = {}) {
    if (!imageList || imageList.length < 2) {
      throw new Error('Focus stacking requires at least 2 layers');
    }

    const w = imageList[0].width;
    const h = imageList[0].height;
    const count = imageList.length;
    const p = options.contrastPower || 4.0;

    // Compute sharpness maps for all layers
    const sharpnessMaps = imageList.map(img => this.computeSharpnessMap(img));

    const composite = new ImageData(w, h);
    const dst = composite.data;
    const layerMasks = options.generateMasks ? imageList.map(() => new Uint8Array(w * h)) : null;

    const totalPixels = w * h;
    for (let i = 0; i < totalPixels; i++) {
      let maxSharpness = 0.0001;
      let sumWeights = 0;
      const weights = new Float32Array(count);

      // Find relative sharpness power weights
      for (let l = 0; l < count; l++) {
        const s = sharpnessMaps[l][i];
        if (s > maxSharpness) maxSharpness = s;
      }

      for (let l = 0; l < count; l++) {
        // Normalized power weight
        const normS = sharpnessMaps[l][i] / maxSharpness;
        const wVal = Math.pow(normS, p);
        weights[l] = wVal;
        sumWeights += wVal;
      }

      if (sumWeights < 0.0001) sumWeights = 1.0;

      // Accumulate blended color
      let r = 0, g = 0, b = 0, a = 0;
      const pixelIdx = i * 4;

      for (let l = 0; l < count; l++) {
        const normWeight = weights[l] / sumWeights;
        const srcData = imageList[l].data;

        r += srcData[pixelIdx] * normWeight;
        g += srcData[pixelIdx + 1] * normWeight;
        b += srcData[pixelIdx + 2] * normWeight;
        a += srcData[pixelIdx + 3] * normWeight;

        if (layerMasks) {
          layerMasks[l][i] = Math.min(255, Math.max(0, Math.round(normWeight * 255)));
        }
      }

      dst[pixelIdx] = Math.round(r);
      dst[pixelIdx + 1] = Math.round(g);
      dst[pixelIdx + 2] = Math.round(b);
      dst[pixelIdx + 3] = Math.round(a);
    }

    return {
      composite,
      layerMasks
    };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { FocusStackingEngine };
}
