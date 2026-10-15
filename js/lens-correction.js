/**
 * PixelForge Studio - Optical Lens Correction & Defringing Engine
 * Photoshop Parity for Filter -> Lens Correction:
 * 1. Geometric Distortion: Corrects Barrel (k1 < 0) and Pincushion (k1 > 0)
 *    using polynomial radial transformation: r' = r * (1 + k1*r^2 + k2*r^4)
 * 2. Chromatic Defringe: Independent radial scaling for Red/Cyan and Blue/Yellow
 *    channels to neutralize optical lens dispersion
 * 3. Optical Vignette: Radial corner brightness compensation (amount & midpoint)
 * 4. Subpixel Bilinear Resampling for razor-sharp interpolation
 */

class LensCorrectionEngine {
  constructor() {}

  /**
   * Applies complete optical lens correction to ImageData
   * @param {ImageData} srcImageData - Source RGBA image data
   * @param {Object} options - Parameter settings
   *   @param {number} options.distortion - [-100, 100] (negative = barrel, positive = pincushion)
   *   @param {number} options.redCyanDefringe - [-50, 50] lateral chromatic fringe correction
   *   @param {number} options.blueYellowDefringe - [-50, 50] lateral chromatic fringe correction
   *   @param {number} options.vignetteAmount - [-100, 100] (positive = brighten corners, negative = darken)
   *   @param {number} options.vignetteMidpoint - [0, 100] (default 50)
   *   @param {boolean} options.autoScale - Scales image to fit canvas without black borders
   * @returns {ImageData} Corrected RGBA image data
   */
  apply(srcImageData, options = {}) {
    const { width: w, height: h, data: src } = srcImageData;
    const output = new ImageData(w, h);
    const dst = output.data;

    const distortion = (options.distortion || 0) / 100; // [-1.0, 1.0]
    const k1 = distortion * 0.4;
    const k2 = (options.secondaryDistortion || 0) * 0.001;

    const redOffset = ((options.redCyanDefringe || 0) / 100) * 0.03;
    const blueOffset = ((options.blueYellowDefringe || 0) / 100) * 0.03;

    const k1Red = k1 + redOffset;
    const k1Green = k1;
    const k1Blue = k1 + blueOffset;

    const vigAmount = (options.vignetteAmount || 0) / 100;
    const vigMidpoint = Math.max(0.01, (options.vignetteMidpoint !== undefined ? options.vignetteMidpoint : 50) / 100);

    const cx = w / 2;
    const cy = h / 2;
    const maxR = Math.hypot(cx, cy);

    // Compute auto-scaling factor so corners or edges don't reveal empty gaps
    let scale = 1.0;
    if (options.autoScale && Math.abs(distortion) > 0.001) {
      const edgeR = Math.min(cx, cy) / maxR;
      const distortedEdgeR = edgeR * (1 + k1 * edgeR * edgeR);
      if (distortedEdgeR > 0.001) {
        scale = edgeR / distortedEdgeR;
      }
    }

    for (let y = 0; y < h; y++) {
      const dy = y - cy;
      for (let x = 0; x < w; x++) {
        const dx = x - cx;
        const r = Math.hypot(dx, dy) / maxR;
        const dstIdx = (y * w + x) * 4;

        if (r < 0.0001) {
          // Center pixel: copy directly
          dst[dstIdx] = src[dstIdx];
          dst[dstIdx + 1] = src[dstIdx + 1];
          dst[dstIdx + 2] = src[dstIdx + 2];
          dst[dstIdx + 3] = src[dstIdx + 3];
          continue;
        }

        const angle = Math.atan2(dy, dx);
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);

        // Radial transformation per color channel for defringing
        const rFactorR = (1 + k1Red * r * r + k2 * r * r * r * r) * scale;
        const rFactorG = (1 + k1Green * r * r + k2 * r * r * r * r) * scale;
        const rFactorB = (1 + k1Blue * r * r + k2 * r * r * r * r) * scale;

        const srcXr = cx + cosA * (r * rFactorR * maxR);
        const srcYr = cy + sinA * (r * rFactorR * maxR);

        const srcXg = cx + cosA * (r * rFactorG * maxR);
        const srcYg = cy + sinA * (r * rFactorG * maxR);

        const srcXb = cx + cosA * (r * rFactorB * maxR);
        const srcYb = cy + sinA * (r * rFactorB * maxR);

        // Bilinear subpixel sampling
        const rVal = this.sampleBilinear(src, w, h, srcXr, srcYr, 0);
        const gVal = this.sampleBilinear(src, w, h, srcXg, srcYg, 1);
        const bVal = this.sampleBilinear(src, w, h, srcXb, srcYb, 2);
        const aVal = this.sampleBilinear(src, w, h, srcXg, srcYg, 3);

        // Lens Vignetting factor: V(r) = 1 + vigAmount * ((r / vigMidpoint)^2)
        let vigFactor = 1.0;
        if (Math.abs(vigAmount) > 0.001) {
          const normVig = Math.min(1.0, r / vigMidpoint);
          const falloff = normVig * normVig;
          vigFactor = 1.0 + vigAmount * falloff;
        }

        dst[dstIdx] = Math.min(255, Math.max(0, Math.round(rVal * vigFactor)));
        dst[dstIdx + 1] = Math.min(255, Math.max(0, Math.round(gVal * vigFactor)));
        dst[dstIdx + 2] = Math.min(255, Math.max(0, Math.round(bVal * vigFactor)));
        dst[dstIdx + 3] = aVal;
      }
    }

    return output;
  }

  /**
   * Bilinear subpixel interpolation for a specific color channel
   */
  sampleBilinear(data, w, h, x, y, channel) {
    if (x < 0 || x >= w - 1 || y < 0 || y >= h - 1) {
      // Clamp to edge
      const cx = Math.max(0, Math.min(w - 1, Math.round(x)));
      const cy = Math.max(0, Math.min(h - 1, Math.round(y)));
      return data[(cy * w + cx) * 4 + channel];
    }

    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const x1 = x0 + 1;
    const y1 = y0 + 1;

    const wx1 = x - x0;
    const wx0 = 1 - wx1;
    const wy1 = y - y0;
    const wy0 = 1 - wy1;

    const idx00 = (y0 * w + x0) * 4 + channel;
    const idx10 = (y0 * w + x1) * 4 + channel;
    const idx01 = (y1 * w + x0) * 4 + channel;
    const idx11 = (y1 * w + x1) * 4 + channel;

    const v0 = data[idx00] * wx0 + data[idx10] * wx1;
    const v1 = data[idx01] * wx0 + data[idx11] * wx1;

    return v0 * wy0 + v1 * wy1;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LensCorrectionEngine };
}
