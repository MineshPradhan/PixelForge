/**
 * PixelForge Studio Pro — Multi-Exposure HDR Exposure Fusion Engine
 * 
 * Implements the Mertens-Kautz-Van Reeth (2007) Exposure Fusion Algorithm:
 * "Exposure Fusion: A Simple and Practical Alternative to High Dynamic Range Photography"
 * 
 * Key Advantages over standard HDR Radiance tonemapping:
 * 1. Bypasses intermediate 32-bit floating-point radiance map conversion and camera response curve estimation.
 * 2. Directly fuses multiple bracketed LDR/RAW exposures (e.g., -2 EV, 0 EV, +2 EV) into a balanced output.
 * 3. Evaluates 3 distinct per-pixel image quality measures:
 *    - Contrast (C): Discrete Laplacian filter capturing edge sharpness and texture.
 *    - Saturation (S): Standard deviation across R, G, B channels preserving vivid color.
 *    - Well-Exposedness (E): Gaussian weighting (sigma=0.2) centered at 0.5 penalizing clipped shadows and blown highlights.
 * 4. Multi-scale Laplacian & Gaussian pyramid decomposition preventing edge halos and seam boundaries.
 */

class ExposureFusionEngine {
  constructor(options = {}) {
    this.wContrast = options.wContrast !== undefined ? options.wContrast : 1.0;
    this.wSaturation = options.wSaturation !== undefined ? options.wSaturation : 1.0;
    this.wExposedness = options.wExposedness !== undefined ? options.wExposedness : 1.0;
    this.sigma = options.sigma !== undefined ? options.sigma : 0.2;
    this.numLevels = options.numLevels !== undefined ? options.numLevels : 4;
  }

  /**
   * Evaluates per-pixel quality metric map W_k = (C^wc) * (S^ws) * (E^we) + eps
   * @param {ImageData} imgData 
   * @returns {Float32Array} Raw scalar weight map of size width * height
   */
  computeQualityWeights(imgData) {
    const { width: w, height: h, data } = imgData;
    const len = w * h;
    const weights = new Float32Array(len);
    const eps = 1e-12;

    // 1. Grayscale luminance for Laplacian contrast
    const lum = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      const idx = i * 4;
      lum[i] = (0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]) / 255.0;
    }

    // 2. Compute Contrast via discrete 3x3 Laplacian kernel
    const contrast = new Float32Array(len);
    for (let y = 0; y < h; y++) {
      const yPrev = Math.max(0, y - 1);
      const yNext = Math.min(h - 1, y + 1);
      for (let x = 0; x < w; x++) {
        const xPrev = Math.max(0, x - 1);
        const xNext = Math.min(w - 1, x + 1);

        const center = lum[y * w + x];
        const up = lum[yPrev * w + x];
        const down = lum[yNext * w + x];
        const left = lum[y * w + xPrev];
        const right = lum[y * w + xNext];

        // 4-connected discrete Laplacian absolute magnitude
        contrast[y * w + x] = Math.abs(4 * center - up - down - left - right);
      }
    }

    // 3. Compute Saturation & Well-Exposedness
    const twoSigmaSq = 2.0 * this.sigma * this.sigma;
    for (let i = 0; i < len; i++) {
      const idx = i * 4;
      const r = data[idx] / 255.0;
      const g = data[idx + 1] / 255.0;
      const b = data[idx + 2] / 255.0;

      // Saturation: standard deviation across RGB
      const mu = (r + g + b) / 3.0;
      const sat = Math.sqrt(((r - mu) ** 2 + (g - mu) ** 2 + (b - mu) ** 2) / 3.0);

      // Well-Exposedness: Gaussian penalty centered at 0.5
      const er = Math.exp(-((r - 0.5) ** 2) / twoSigmaSq);
      const eg = Math.exp(-((g - 0.5) ** 2) / twoSigmaSq);
      const eb = Math.exp(-((b - 0.5) ** 2) / twoSigmaSq);
      const expScore = er * eg * eb;

      // Combined multiplicative weight
      const cVal = Math.pow(contrast[i] + eps, this.wContrast);
      const sVal = Math.pow(sat + eps, this.wSaturation);
      const eVal = Math.pow(expScore + eps, this.wExposedness);

      weights[i] = cVal * sVal * eVal + eps;
    }

    return weights;
  }

  /**
   * Normalizes an array of quality weight maps such that sum_k W_k(x, y) = 1.0
   * @param {Array<Float32Array>} weightMaps 
   * @param {number} len 
   * @returns {Array<Float32Array>}
   */
  normalizeWeights(weightMaps, len) {
    const numMaps = weightMaps.length;
    const normalized = weightMaps.map(() => new Float32Array(len));

    for (let i = 0; i < len; i++) {
      let sum = 0;
      for (let k = 0; k < numMaps; k++) {
        sum += weightMaps[k][i];
      }
      if (sum < 1e-12) sum = 1e-12;
      for (let k = 0; k < numMaps; k++) {
        normalized[k][i] = weightMaps[k][i] / sum;
      }
    }
    return normalized;
  }

  /**
   * Downsamples a 2D float image by factor of 2 using 5x5 separable binomial filter
   */
  downsample(src, w, h) {
    const dw = Math.max(1, Math.floor(w / 2));
    const dh = Math.max(1, Math.floor(h / 2));
    const dst = new Float32Array(dw * dh);

    // Binomial kernel weights: [1, 4, 6, 4, 1] / 16
    const k = [0.0625, 0.25, 0.375, 0.25, 0.0625];

    for (let dy = 0; dy < dh; dy++) {
      const sy = dy * 2;
      for (let dx = 0; dx < dw; dx++) {
        const sx = dx * 2;
        let acc = 0;
        let wAcc = 0;

        for (let ky = -2; ky <= 2; ky++) {
          const py = Math.min(Math.max(sy + ky, 0), h - 1);
          const wy = k[ky + 2];
          for (let kx = -2; kx <= 2; kx++) {
            const px = Math.min(Math.max(sx + kx, 0), w - 1);
            const wx = k[kx + 2];
            const weight = wx * wy;
            acc += src[py * w + px] * weight;
            wAcc += weight;
          }
        }
        dst[dy * dw + dx] = wAcc > 0 ? acc / wAcc : 0;
      }
    }
    return { data: dst, width: dw, height: dh };
  }

  /**
   * Upsamples a 2D float image by factor of 2 to match target (tw, th)
   */
  upsample(src, sw, sh, tw, th) {
    const dst = new Float32Array(tw * th);
    const xRatio = sw / tw;
    const yRatio = sh / th;

    for (let ty = 0; ty < th; ty++) {
      const sy = (ty + 0.5) * yRatio - 0.5;
      const y0 = Math.max(0, Math.floor(sy));
      const y1 = Math.min(sh - 1, y0 + 1);
      const dy = sy - y0;

      for (let tx = 0; tx < tw; tx++) {
        const sx = (tx + 0.5) * xRatio - 0.5;
        const x0 = Math.max(0, Math.floor(sx));
        const x1 = Math.min(sw - 1, x0 + 1);
        const dx = sx - x0;

        const v00 = src[y0 * sw + x0];
        const v10 = src[y0 * sw + x1];
        const v01 = src[y1 * sw + x0];
        const v11 = src[y1 * sw + x1];

        const interp = (1 - dx) * (1 - dy) * v00 +
                       dx * (1 - dy) * v10 +
                       (1 - dx) * dy * v01 +
                       dx * dy * v11;
        dst[ty * tw + tx] = interp;
      }
    }
    return dst;
  }

  /**
   * Constructs a Gaussian Pyramid for a 2D float channel
   */
  buildGaussianPyramid(img, w, h, levels) {
    const pyr = [{ data: new Float32Array(img), width: w, height: h }];
    let cur = pyr[0];
    for (let l = 1; l < levels; l++) {
      if (cur.width <= 2 || cur.height <= 2) break;
      const down = this.downsample(cur.data, cur.width, cur.height);
      pyr.push(down);
      cur = down;
    }
    return pyr;
  }

  /**
   * Constructs a Laplacian Pyramid for a 2D float channel
   */
  buildLaplacianPyramid(img, w, h, levels) {
    const gPyr = this.buildGaussianPyramid(img, w, h, levels);
    const lPyr = [];
    for (let l = 0; l < gPyr.length - 1; l++) {
      const cur = gPyr[l];
      const next = gPyr[l + 1];
      const up = this.upsample(next.data, next.width, next.height, cur.width, cur.height);
      const diff = new Float32Array(cur.width * cur.height);
      for (let i = 0; i < diff.length; i++) {
        diff[i] = cur.data[i] - up[i];
      }
      lPyr.push({ data: diff, width: cur.width, height: cur.height });
    }
    // Deepest level retains base low-frequency Gaussian residual
    const deepest = gPyr[gPyr.length - 1];
    lPyr.push({ data: new Float32Array(deepest.data), width: deepest.width, height: deepest.height });
    return lPyr;
  }

  /**
   * Reconstructs an image from its Laplacian pyramid
   */
  reconstructLaplacianPyramid(lPyr) {
    let cur = lPyr[lPyr.length - 1];
    for (let l = lPyr.length - 2; l >= 0; l--) {
      const target = lPyr[l];
      const up = this.upsample(cur.data, cur.width, cur.height, target.width, target.height);
      const combined = new Float32Array(target.width * target.height);
      for (let i = 0; i < combined.length; i++) {
        combined[i] = target.data[i] + up[i];
      }
      cur = { data: combined, width: target.width, height: target.height };
    }
    return cur.data;
  }

  /**
   * Executes multi-scale Mertens Exposure Fusion across an array of ImageDatas
   * @param {Array<ImageData>} imageList - Array of 2 or more bracketed exposures
   * @returns {ImageData} Blended output composite
   */
  fuseExposures(imageList) {
    if (!imageList || imageList.length < 2) {
      throw new Error('Exposure Fusion requires at least 2 bracketed exposure images.');
    }

    const w = imageList[0].width;
    const h = imageList[0].height;
    const len = w * h;
    const numImages = imageList.length;

    // 1. Calculate and normalize quality weight maps
    const rawWeights = imageList.map(img => this.computeQualityWeights(img));
    const normWeights = this.normalizeWeights(rawWeights, len);

    // 2. Build Gaussian Pyramids for weight maps
    const weightPyramids = normWeights.map(nw => 
      this.buildGaussianPyramid(nw, w, h, this.numLevels)
    );
    const actualLevels = weightPyramids[0].length;

    // 3. Process each color channel (R, G, B) independently via multi-resolution pyramid blending
    const outData = new Uint8ClampedArray(len * 4);
    const channels = [0, 1, 2];

    channels.forEach(ch => {
      // Build Laplacian pyramids for channel ch of all images
      const imgLPyramids = imageList.map(img => {
        const chData = new Float32Array(len);
        for (let i = 0; i < len; i++) {
          chData[i] = img.data[i * 4 + ch] / 255.0;
        }
        return this.buildLaplacianPyramid(chData, w, h, actualLevels);
      });

      // Blend pyramids at each octave level: L_blend[l] = sum_k ( G_w[k][l] * L_img[k][l] )
      const fusedLPyramid = [];
      for (let l = 0; l < actualLevels; l++) {
        const lw = weightPyramids[0][l].width;
        const lh = weightPyramids[0][l].height;
        const levelLen = lw * lh;
        const fusedData = new Float32Array(levelLen);

        for (let k = 0; k < numImages; k++) {
          const wLevel = weightPyramids[k][l].data;
          const lLevel = imgLPyramids[k][l].data;
          for (let i = 0; i < levelLen; i++) {
            fusedData[i] += wLevel[i] * lLevel[i];
          }
        }
        fusedLPyramid.push({ data: fusedData, width: lw, height: lh });
      }

      // Collapse and reconstruct channel
      const reconstructed = this.reconstructLaplacianPyramid(fusedLPyramid);
      for (let i = 0; i < len; i++) {
        outData[i * 4 + ch] = Math.round(Math.min(Math.max(reconstructed[i], 0.0), 1.0) * 255.0);
      }
    });

    // Set full opacity alpha
    for (let i = 0; i < len; i++) {
      outData[i * 4 + 3] = 255;
    }

    return new ImageData(outData, w, h);
  }

  /**
   * Generates grayscale alpha mask ImageDatas representing the normalized weight of each exposure
   * @param {Array<ImageData>} imageList 
   * @returns {Array<ImageData>}
   */
  generateWeightMasks(imageList) {
    const w = imageList[0].width;
    const h = imageList[0].height;
    const len = w * h;
    const rawWeights = imageList.map(img => this.computeQualityWeights(img));
    const normWeights = this.normalizeWeights(rawWeights, len);

    return normWeights.map(nw => {
      const maskData = new Uint8ClampedArray(len * 4);
      for (let i = 0; i < len; i++) {
        const val = Math.round(nw[i] * 255.0);
        const idx = i * 4;
        maskData[idx] = val;
        maskData[idx + 1] = val;
        maskData[idx + 2] = val;
        maskData[idx + 3] = 255;
      }
      return new ImageData(maskData, w, h);
    });
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ExposureFusionEngine };
}
