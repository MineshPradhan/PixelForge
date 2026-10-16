// ══════════════════════════════════════════════════════════════════════
// PixelForge Studio — Filters & Adjustments Suite
// ══════════════════════════════════════════════════════════════════════

const Filters = {
  brightnessContrast(imgData, brightness = 0, contrast = 0) {
    const w = imgData.width;
    const h = imgData.height;
    const src = imgData.data;
    const out = new ImageData(w, h);
    const dst = out.data;

    // Contrast factor: -100 to 100
    const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));

    for (let i = 0; i < src.length; i += 4) {
      dst[i]     = Utils.clamp(Math.round(factor * (src[i] - 128) + 128 + brightness), 0, 255);
      dst[i + 1] = Utils.clamp(Math.round(factor * (src[i + 1] - 128) + 128 + brightness), 0, 255);
      dst[i + 2] = Utils.clamp(Math.round(factor * (src[i + 2] - 128) + 128 + brightness), 0, 255);
      dst[i + 3] = src[i + 3];
    }
    return out;
  },

  hueSaturation(imgData, hueShift = 0, satShift = 0) {
    const w = imgData.width;
    const h = imgData.height;
    const src = imgData.data;
    const out = new ImageData(w, h);
    const dst = out.data;

    for (let i = 0; i < src.length; i += 4) {
      if (src[i + 3] === 0) {
        dst[i + 3] = 0;
        continue;
      }
      const hsl = Utils.rgbToHsl(src[i], src[i + 1], src[i + 2]);
      hsl.h = (hsl.h + hueShift + 360) % 360;
      hsl.s = Utils.clamp(hsl.s + satShift, 0, 100);

      const rgb = Utils.hslToRgb(hsl.h, hsl.s, hsl.l);
      dst[i]     = rgb.r;
      dst[i + 1] = rgb.g;
      dst[i + 2] = rgb.b;
      dst[i + 3] = src[i + 3];
    }
    return out;
  },

  gaussianBlur(imgData, radius = 2) {
    radius = Math.max(1, Math.min(40, Math.round(radius)));
    const w = imgData.width;
    const h = imgData.height;
    const src = imgData.data;

    // Generate 1D Gaussian kernel
    const sigma = Math.max(radius / 2, 0.5);
    const kernel = new Float32Array(radius * 2 + 1);
    let kSum = 0;
    for (let i = -radius; i <= radius; i++) {
      const v = Math.exp(-(i * i) / (2 * sigma * sigma));
      kernel[i + radius] = v;
      kSum += v;
    }
    for (let i = 0; i < kernel.length; i++) {
      kernel[i] /= kSum;
    }

    // Pass 1: Horizontal 1D convolution
    const temp = new Float32Array(src.length);
    for (let y = 0; y < h; y++) {
      const rowOffset = y * w;
      for (let x = 0; x < w; x++) {
        let r = 0, g = 0, b = 0, a = 0;
        for (let k = -radius; k <= radius; k++) {
          const px = Math.min(w - 1, Math.max(0, x + k));
          const idx = (rowOffset + px) * 4;
          const weight = kernel[k + radius];
          r += src[idx] * weight;
          g += src[idx + 1] * weight;
          b += src[idx + 2] * weight;
          a += src[idx + 3] * weight;
        }
        const outIdx = (rowOffset + x) * 4;
        temp[outIdx]     = r;
        temp[outIdx + 1] = g;
        temp[outIdx + 2] = b;
        temp[outIdx + 3] = a;
      }
    }

    // Pass 2: Vertical 1D convolution
    const out = new ImageData(w, h);
    const dst = out.data;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let r = 0, g = 0, b = 0, a = 0;
        for (let k = -radius; k <= radius; k++) {
          const py = Math.min(h - 1, Math.max(0, y + k));
          const idx = (py * w + x) * 4;
          const weight = kernel[k + radius];
          r += temp[idx] * weight;
          g += temp[idx + 1] * weight;
          b += temp[idx + 2] * weight;
          a += temp[idx + 3] * weight;
        }
        const outIdx = (y * w + x) * 4;
        dst[outIdx]     = Math.round(r);
        dst[outIdx + 1] = Math.round(g);
        dst[outIdx + 2] = Math.round(b);
        dst[outIdx + 3] = Math.round(a);
      }
    }

    return out;
  },

  sharpen(imgData, strength = 1) {
    const a = Utils.clamp(strength, 0.2, 3);
    const kernel = [
      0, -a, 0,
      -a, 1 + 4 * a, -a,
      0, -a, 0
    ];
    return Utils.applyKernel(imgData, kernel, 1);
  },

  grayscale(imgData) {
    const w = imgData.width;
    const h = imgData.height;
    const src = imgData.data;
    const out = new ImageData(w, h);
    const dst = out.data;

    for (let i = 0; i < src.length; i += 4) {
      const lum = Math.round(0.2126 * src[i] + 0.7152 * src[i + 1] + 0.0722 * src[i + 2]);
      dst[i] = dst[i + 1] = dst[i + 2] = lum;
      dst[i + 3] = src[i + 3];
    }
    return out;
  },

  sepia(imgData) {
    const w = imgData.width;
    const h = imgData.height;
    const src = imgData.data;
    const out = new ImageData(w, h);
    const dst = out.data;

    for (let i = 0; i < src.length; i += 4) {
      const r = src[i], g = src[i + 1], b = src[i + 2];
      dst[i]     = Utils.clamp(Math.round(0.393 * r + 0.769 * g + 0.189 * b), 0, 255);
      dst[i + 1] = Utils.clamp(Math.round(0.349 * r + 0.686 * g + 0.168 * b), 0, 255);
      dst[i + 2] = Utils.clamp(Math.round(0.272 * r + 0.534 * g + 0.131 * b), 0, 255);
      dst[i + 3] = src[i + 3];
    }
    return out;
  },

  invert(imgData) {
    const w = imgData.width;
    const h = imgData.height;
    const src = imgData.data;
    const out = new ImageData(w, h);
    const dst = out.data;

    for (let i = 0; i < src.length; i += 4) {
      dst[i]     = 255 - src[i];
      dst[i + 1] = 255 - src[i + 1];
      dst[i + 2] = 255 - src[i + 2];
      dst[i + 3] = src[i + 3];
    }
    return out;
  },

  emboss(imgData) {
    const kernel = [
      -2, -1,  0,
      -1,  1,  1,
       0,  1,  2
    ];
    return Utils.applyKernel(imgData, kernel, 1);
  },

  edgeDetect(imgData) {
    const kernel = [
      -1, -1, -1,
      -1,  8, -1,
      -1, -1, -1
    ];
    return Utils.applyKernel(imgData, kernel, 1);
  },

  vignette(imgData, amount = 0.6) {
    const w = imgData.width;
    const h = imgData.height;
    const src = imgData.data;
    const out = new ImageData(w, h);
    const dst = out.data;

    const cx = w / 2;
    const cy = h / 2;
    const maxDist = Math.hypot(cx, cy);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const d = Math.hypot(x - cx, y - cy);
        const factor = 1 - (d / maxDist) * amount;

        dst[idx]     = Utils.clamp(Math.round(src[idx] * factor), 0, 255);
        dst[idx + 1] = Utils.clamp(Math.round(src[idx + 1] * factor), 0, 255);
        dst[idx + 2] = Utils.clamp(Math.round(src[idx + 2] * factor), 0, 255);
        dst[idx + 3] = src[idx + 3];
      }
    }
    return out;
  },

  pixelate(imgData, blockSize = 10) {
    blockSize = Math.max(2, Math.round(blockSize));
    const w = imgData.width;
    const h = imgData.height;
    const src = imgData.data;
    const out = new ImageData(w, h);
    const dst = out.data;

    for (let y = 0; y < h; y += blockSize) {
      for (let x = 0; x < w; x += blockSize) {
        let r = 0, g = 0, b = 0, a = 0, count = 0;

        for (let dy = 0; dy < blockSize && (y + dy) < h; dy++) {
          for (let dx = 0; dx < blockSize && (x + dx) < w; dx++) {
            const idx = ((y + dy) * w + (x + dx)) * 4;
            r += src[idx];
            g += src[idx + 1];
            b += src[idx + 2];
            a += src[idx + 3];
            count++;
          }
        }

        r = Math.round(r / count);
        g = Math.round(g / count);
        b = Math.round(b / count);
        a = Math.round(a / count);

        for (let dy = 0; dy < blockSize && (y + dy) < h; dy++) {
          for (let dx = 0; dx < blockSize && (x + dx) < w; dx++) {
            const idx = ((y + dy) * w + (x + dx)) * 4;
            dst[idx]     = r;
            dst[idx + 1] = g;
            dst[idx + 2] = b;
            dst[idx + 3] = a;
          }
        }
      }
    }

    return out;
  },

  colorBalance(imgData, shadows = { cyanRed: 0, magGreen: 0, yelBlue: 0 },
               midtones = { cyanRed: 0, magGreen: 0, yelBlue: 0 },
               highlights = { cyanRed: 0, magGreen: 0, yelBlue: 0 },
               preserveLum = true) {
    const w = imgData.width;
    const h = imgData.height;
    const src = imgData.data;
    const out = new ImageData(w, h);
    const dst = out.data;

    const sCR = shadows.cyanRed || 0, sMG = shadows.magGreen || 0, sYB = shadows.yelBlue || 0;
    const mCR = midtones.cyanRed || 0, mMG = midtones.magGreen || 0, mYB = midtones.yelBlue || 0;
    const hCR = highlights.cyanRed || 0, hMG = highlights.magGreen || 0, hYB = highlights.yelBlue || 0;

    for (let i = 0; i < src.length; i += 4) {
      if (src[i + 3] === 0) {
        dst[i + 3] = 0;
        continue;
      }

      let r = src[i];
      let g = src[i + 1];
      let b = src[i + 2];
      const origLum = 0.299 * r + 0.587 * g + 0.114 * b;

      const lumNorm = origLum / 255;
      const wS = Math.max(0, 1 - lumNorm * 2);
      const wH = Math.max(0, lumNorm * 2 - 1);
      const wM = Math.max(0, 1 - Math.abs(lumNorm - 0.5) * 2);

      const dR = (wS * sCR + wM * mCR + wH * hCR) * 1.28;
      const dG = (wS * sMG + wM * mMG + wH * hMG) * 1.28;
      const dB = (wS * sYB + wM * mYB + wH * hYB) * 1.28;

      r = Utils.clamp(Math.round(r + dR), 0, 255);
      g = Utils.clamp(Math.round(g + dG), 0, 255);
      b = Utils.clamp(Math.round(b + dB), 0, 255);

      if (preserveLum) {
        const newLum = 0.299 * r + 0.587 * g + 0.114 * b;
        const lumDiff = origLum - newLum;
        r = Utils.clamp(Math.round(r + lumDiff), 0, 255);
        g = Utils.clamp(Math.round(g + lumDiff), 0, 255);
        b = Utils.clamp(Math.round(b + lumDiff), 0, 255);
      }

      dst[i] = r;
      dst[i + 1] = g;
      dst[i + 2] = b;
      dst[i + 3] = src[i + 3];
    }
    return out;
  },

  vibrance(imgData, vibranceVal = 0, satVal = 0) {
    const w = imgData.width;
    const h = imgData.height;
    const src = imgData.data;
    const out = new ImageData(w, h);
    const dst = out.data;

    const vibFactor = -vibranceVal / 100;
    const satFactor = satVal / 100;

    for (let i = 0; i < src.length; i += 4) {
      if (src[i + 3] === 0) {
        dst[i + 3] = 0;
        continue;
      }

      let r = src[i], g = src[i + 1], b = src[i + 2];
      const max = Math.max(r, g, b);
      const avg = (r + g + b) / 3;
      const amt = ((Math.abs(max - avg) * 2 / 255) * vibFactor);

      if (vibranceVal !== 0) {
        r += (max - r) * amt;
        g += (max - g) * amt;
        b += (max - b) * amt;
      }

      if (satVal !== 0) {
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        r = r + (r - gray) * satFactor;
        g = g + (g - gray) * satFactor;
        b = b + (b - gray) * satFactor;
      }

      dst[i]     = Utils.clamp(Math.round(r), 0, 255);
      dst[i + 1] = Utils.clamp(Math.round(g), 0, 255);
      dst[i + 2] = Utils.clamp(Math.round(b), 0, 255);
      dst[i + 3] = src[i + 3];
    }
    return out;
  },

  photoFilter(imgData, tintR = 234, tintG = 138, tintB = 40, density = 25, preserveLum = true) {
    const w = imgData.width;
    const h = imgData.height;
    const src = imgData.data;
    const out = new ImageData(w, h);
    const dst = out.data;
    const alpha = Utils.clamp(density / 100, 0, 1);

    for (let i = 0; i < src.length; i += 4) {
      if (src[i + 3] === 0) {
        dst[i + 3] = 0;
        continue;
      }

      const r = src[i], g = src[i + 1], b = src[i + 2];
      const origLum = 0.299 * r + 0.587 * g + 0.114 * b;

      let resR = r + ((r * tintR / 255) - r) * alpha;
      let resG = g + ((g * tintG / 255) - g) * alpha;
      let resB = b + ((b * tintB / 255) - b) * alpha;

      if (preserveLum) {
        const newLum = 0.299 * resR + 0.587 * resG + 0.114 * resB;
        const diff = origLum - newLum;
        resR += diff;
        resG += diff;
        resB += diff;
      }

      dst[i]     = Utils.clamp(Math.round(resR), 0, 255);
      dst[i + 1] = Utils.clamp(Math.round(resG), 0, 255);
      dst[i + 2] = Utils.clamp(Math.round(resB), 0, 255);
      dst[i + 3] = src[i + 3];
    }
    return out;
  },

  threshold(imgData, cutoff = 128) {
    const w = imgData.width;
    const h = imgData.height;
    const src = imgData.data;
    const out = new ImageData(w, h);
    const dst = out.data;

    for (let i = 0; i < src.length; i += 4) {
      if (src[i + 3] === 0) {
        dst[i + 3] = 0;
        continue;
      }
      const lum = 0.299 * src[i] + 0.587 * src[i + 1] + 0.114 * src[i + 2];
      const val = lum >= cutoff ? 255 : 0;
      dst[i] = dst[i + 1] = dst[i + 2] = val;
      dst[i + 3] = src[i + 3];
    }
    return out;
  },

  posterize(imgData, levels = 4) {
    levels = Utils.clamp(Math.round(levels), 2, 32);
    const w = imgData.width;
    const h = imgData.height;
    const src = imgData.data;
    const out = new ImageData(w, h);
    const dst = out.data;

    const numAreas = 256 / levels;
    const numValues = 255 / (levels - 1);

    for (let i = 0; i < src.length; i += 4) {
      if (src[i + 3] === 0) {
        dst[i + 3] = 0;
        continue;
      }
      dst[i]     = Utils.clamp(Math.round(Math.floor(src[i] / numAreas) * numValues), 0, 255);
      dst[i + 1] = Utils.clamp(Math.round(Math.floor(src[i + 1] / numAreas) * numValues), 0, 255);
      dst[i + 2] = Utils.clamp(Math.round(Math.floor(src[i + 2] / numAreas) * numValues), 0, 255);
      dst[i + 3] = src[i + 3];
    }
    return out;
  },

  autoContrast(imgData) {
    const w = imgData.width;
    const h = imgData.height;
    const src = imgData.data;
    const out = new ImageData(w, h);
    const dst = out.data;

    let min = 255, max = 0;
    for (let i = 0; i < src.length; i += 4) {
      if (src[i + 3] === 0) continue;
      const lum = Math.round(0.299 * src[i] + 0.587 * src[i + 1] + 0.114 * src[i + 2]);
      if (lum < min) min = lum;
      if (lum > max) max = lum;
    }

    if (max <= min) return imgData;
    const range = max - min;

    for (let i = 0; i < src.length; i += 4) {
      if (src[i + 3] === 0) {
        dst[i + 3] = 0;
        continue;
      }
      dst[i]     = Utils.clamp(Math.round(((src[i] - min) / range) * 255), 0, 255);
      dst[i + 1] = Utils.clamp(Math.round(((src[i + 1] - min) / range) * 255), 0, 255);
      dst[i + 2] = Utils.clamp(Math.round(((src[i + 2] - min) / range) * 255), 0, 255);
      dst[i + 3] = src[i + 3];
    }
    return out;
  },

  autoTone(imgData) {
    const w = imgData.width;
    const h = imgData.height;
    const src = imgData.data;
    const out = new ImageData(w, h);
    const dst = out.data;

    let minR = 255, maxR = 0;
    let minG = 255, maxG = 0;
    let minB = 255, maxB = 0;

    for (let i = 0; i < src.length; i += 4) {
      if (src[i + 3] === 0) continue;
      if (src[i] < minR) minR = src[i];
      if (src[i] > maxR) maxR = src[i];
      if (src[i + 1] < minG) minG = src[i + 1];
      if (src[i + 1] > maxG) maxG = src[i + 1];
      if (src[i + 2] < minB) minB = src[i + 2];
      if (src[i + 2] > maxB) maxB = src[i + 2];
    }

    const rangeR = Math.max(1, maxR - minR);
    const rangeG = Math.max(1, maxG - minG);
    const rangeB = Math.max(1, maxB - minB);

    for (let i = 0; i < src.length; i += 4) {
      if (src[i + 3] === 0) {
        dst[i + 3] = 0;
        continue;
      }
      dst[i]     = Utils.clamp(Math.round(((src[i] - minR) / rangeR) * 255), 0, 255);
      dst[i + 1] = Utils.clamp(Math.round(((src[i + 1] - minG) / rangeG) * 255), 0, 255);
      dst[i + 2] = Utils.clamp(Math.round(((src[i + 2] - minB) / rangeB) * 255), 0, 255);
      dst[i + 3] = src[i + 3];
    }
    return out;
  },

  gradientMap(imgData, gradientData) {
    const w = imgData.width;
    const h = imgData.height;
    const src = imgData.data;
    const out = (typeof ImageData !== 'undefined') 
      ? new ImageData(w, h) 
      : { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) };
    const dst = out.data;

    let lut;
    if (gradientData && typeof gradientData.generateLut256 === 'function') {
      lut = gradientData.generateLut256();
    } else if (gradientData && gradientData.lut) {
      lut = gradientData.lut;
    } else if (typeof GradientData !== 'undefined') {
      lut = GradientData.getPreset('rainbow').generateLut256();
    } else {
      lut = new Uint8ClampedArray(256 * 4);
      for (let i = 0; i < 256; i++) {
        lut[i * 4] = i; lut[i * 4 + 1] = i; lut[i * 4 + 2] = i; lut[i * 4 + 3] = 255;
      }
    }

    for (let i = 0; i < src.length; i += 4) {
      const a = src[i + 3];
      if (a === 0) {
        dst[i + 3] = 0;
        src[i + 3] = 0;
        continue;
      }

      const lum = Math.round(0.299 * src[i] + 0.587 * src[i + 1] + 0.114 * src[i + 2]);
      const lutIdx = Math.max(0, Math.min(255, lum)) * 4;

      const mapAlpha = (lut[lutIdx + 3] / 255);
      const outR = lut[lutIdx];
      const outG = lut[lutIdx + 1];
      const outB = lut[lutIdx + 2];
      const outA = Math.round(a * mapAlpha);

      dst[i]     = outR;
      dst[i + 1] = outG;
      dst[i + 2] = outB;
      dst[i + 3] = outA;

      src[i]     = outR;
      src[i + 1] = outG;
      src[i + 2] = outB;
      src[i + 3] = outA;
    }
    return out;
  },

  unsharpMask(imgData, amount = 100, radius = 2, threshold = 0) {
    const w = imgData.width;
    const h = imgData.height;
    const src = imgData.data;
    const blurFn = (this && typeof this.gaussianBlur === 'function') ? this.gaussianBlur : window.Filters.gaussianBlur;
    const blurred = blurFn.call(this || window.Filters, imgData, radius);
    const blurData = blurred.data;
    const out = new ImageData(w, h);
    const dst = out.data;

    const amt = amount / 100;
    const thresh = Math.max(0, threshold);

    for (let i = 0; i < src.length; i += 4) {
      for (let c = 0; c < 3; c++) {
        const orig = src[i + c];
        const blur = blurData[i + c];
        const diff = orig - blur;
        if (Math.abs(diff) >= thresh) {
          dst[i + c] = Utils.clamp(Math.round(orig + diff * amt), 0, 255);
        } else {
          dst[i + c] = orig;
        }
      }
      dst[i + 3] = src[i + 3];
    }
    return out;
  },

  motionBlur(imgData, distance = 15, angle = 0) {
    const w = imgData.width;
    const h = imgData.height;
    const src = imgData.data;
    const out = new ImageData(w, h);
    const dst = out.data;

    const dist = Math.max(1, Math.min(100, Math.round(distance)));
    const rad = (angle * Math.PI) / 180;
    const cosA = Math.cos(rad);
    const sinA = Math.sin(rad);

    const steps = Math.max(3, dist);
    const half = steps / 2;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let r = 0, g = 0, b = 0, a = 0, count = 0;

        for (let s = 0; s < steps; s++) {
          const offset = ((s - half) / half) * (dist / 2);
          const sx = Math.round(x + offset * cosA);
          const sy = Math.round(y + offset * sinA);

          if (sx >= 0 && sx < w && sy >= 0 && sy < h) {
            const idx = (sy * w + sx) * 4;
            r += src[idx];
            g += src[idx + 1];
            b += src[idx + 2];
            a += src[idx + 3];
            count++;
          }
        }

        const outIdx = (y * w + x) * 4;
        if (count > 0) {
          dst[outIdx]     = Math.round(r / count);
          dst[outIdx + 1] = Math.round(g / count);
          dst[outIdx + 2] = Math.round(b / count);
          dst[outIdx + 3] = Math.round(a / count);
        } else {
          dst[outIdx]     = src[outIdx];
          dst[outIdx + 1] = src[outIdx + 1];
          dst[outIdx + 2] = src[outIdx + 2];
          dst[outIdx + 3] = src[outIdx + 3];
        }
      }
    }
    return out;
  },

  radialBlur(imgData, amount = 10, mode = 'spin', centerX = 0.5, centerY = 0.5) {
    const w = imgData.width;
    const h = imgData.height;
    const src = imgData.data;
    const out = new ImageData(w, h);
    const dst = out.data;

    const cx = w * centerX;
    const cy = h * centerY;
    const amt = Math.max(1, Math.min(50, Math.round(amount)));
    const samples = 12;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let r = 0, g = 0, b = 0, a = 0, count = 0;
        const dx = x - cx;
        const dy = y - cy;

        if (mode === 'spin') {
          const baseAngle = Math.atan2(dy, dx);
          const radius = Math.hypot(dx, dy);
          const angleSpread = (amt * Math.PI) / 180;

          for (let s = 0; s < samples; s++) {
            const t = (s / (samples - 1)) - 0.5;
            const curAngle = baseAngle + t * angleSpread;
            const sx = Math.round(cx + Math.cos(curAngle) * radius);
            const sy = Math.round(cy + Math.sin(curAngle) * radius);

            if (sx >= 0 && sx < w && sy >= 0 && sy < h) {
              const idx = (sy * w + sx) * 4;
              r += src[idx];
              g += src[idx + 1];
              b += src[idx + 2];
              a += src[idx + 3];
              count++;
            }
          }
        } else {
          // Zoom mode: radial ray along direction from center
          const maxDist = (amt / 100);
          for (let s = 0; s < samples; s++) {
            const scale = 1.0 - (s / (samples - 1)) * maxDist;
            const sx = Math.round(cx + dx * scale);
            const sy = Math.round(cy + dy * scale);

            if (sx >= 0 && sx < w && sy >= 0 && sy < h) {
              const idx = (sy * w + sx) * 4;
              r += src[idx];
              g += src[idx + 1];
              b += src[idx + 2];
              a += src[idx + 3];
              count++;
            }
          }
        }

        const outIdx = (y * w + x) * 4;
        if (count > 0) {
          dst[outIdx]     = Math.round(r / count);
          dst[outIdx + 1] = Math.round(g / count);
          dst[outIdx + 2] = Math.round(b / count);
          dst[outIdx + 3] = Math.round(a / count);
        } else {
          dst[outIdx]     = src[outIdx];
          dst[outIdx + 1] = src[outIdx + 1];
          dst[outIdx + 2] = src[outIdx + 2];
          dst[outIdx + 3] = src[outIdx + 3];
        }
      }
    }
    return out;
  },

  contentAwareFill(imgData, mask, options = {}) {
    const w = imgData.width;
    const h = imgData.height;
    const src = imgData.data;
    const out = new ImageData(new Uint8ClampedArray(src), w, h);
    const dst = out.data;

    if (!mask || mask.length !== w * h) return out;

    // 1. Identify hole bounding box and known status
    const filled = new Uint8Array(w * h);
    let holeCount = 0;
    let minX = w, minY = h, maxX = -1, maxY = -1;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        if (mask[idx] > 128) {
          filled[idx] = 0; // Hole
          holeCount++;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        } else {
          filled[idx] = 1; // Known
        }
      }
    }

    if (holeCount === 0 || maxX === -1) return out;

    const patchRadius = Math.max(2, Math.min(6, options.patchSize || 3));
    const searchPad = Math.max(16, Math.min(64, options.searchRadius || 36));

    // Sampling window around hole
    const sampleMinX = Math.max(patchRadius, minX - searchPad);
    const sampleMaxX = Math.min(w - 1 - patchRadius, maxX + searchPad);
    const sampleMinY = Math.max(patchRadius, minY - searchPad);
    const sampleMaxY = Math.min(h - 1 - patchRadius, maxY + searchPad);

    // Collect candidate source patch centers (where all pixels in patch are known)
    const candidateSources = [];
    const step = 2; // Sample on a grid for performance
    for (let sy = sampleMinY; sy <= sampleMaxY; sy += step) {
      for (let sx = sampleMinX; sx <= sampleMaxX; sx += step) {
        let isFullyKnown = true;
        for (let dy = -patchRadius; dy <= patchRadius; dy++) {
          for (let dx = -patchRadius; dx <= patchRadius; dx++) {
            const sIdx = (sy + dy) * w + (sx + dx);
            if (filled[sIdx] === 0 || src[sIdx * 4 + 3] < 20) {
              isFullyKnown = false;
              break;
            }
          }
          if (!isFullyKnown) break;
        }
        if (isFullyKnown) {
          candidateSources.push({ x: sx, y: sy });
        }
      }
    }

    // Fallback: If no fully known patch in search area, collect any known exterior pixels
    if (candidateSources.length === 0) {
      for (let sy = 0; sy < h; sy += 3) {
        for (let sx = 0; sx < w; sx += 3) {
          const sIdx = sy * w + sx;
          if (filled[sIdx] === 1 && src[sIdx * 4 + 3] > 20) {
            candidateSources.push({ x: sx, y: sy });
          }
        }
      }
    }

    // 2. Multi-pass exemplar inpainting along boundary front inwards
    let remainingHoles = holeCount;
    let maxPasses = 30;

    while (remainingHoles > 0 && maxPasses > 0 && candidateSources.length > 0) {
      maxPasses--;
      // Find frontier pixels (hole pixels adjacent to at least one filled pixel)
      const frontier = [];
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const idx = y * w + x;
          if (filled[idx] === 0) {
            const hasKnownNeighbor = 
              (x > 0 && filled[idx - 1] === 1) ||
              (x < w - 1 && filled[idx + 1] === 1) ||
              (y > 0 && filled[idx - w] === 1) ||
              (y < h - 1 && filled[idx + w] === 1);
            if (hasKnownNeighbor) {
              frontier.push({ x, y });
            }
          }
        }
      }

      if (frontier.length === 0) break;

      // Inpaint frontier points
      for (const target of frontier) {
        const tx = target.x;
        const ty = target.y;

        let bestSSD = Infinity;
        let bestSource = candidateSources[0];

        // Search best matching patch among candidate sources
        for (let i = 0; i < candidateSources.length; i++) {
          const srcPt = candidateSources[i];
          let ssd = 0;
          let knownCount = 0;

          for (let dy = -patchRadius; dy <= patchRadius; dy++) {
            const curTy = ty + dy;
            const curSy = srcPt.y + dy;
            if (curTy < 0 || curTy >= h || curSy < 0 || curSy >= h) continue;

            for (let dx = -patchRadius; dx <= patchRadius; dx++) {
              const curTx = tx + dx;
              const curSx = srcPt.x + dx;
              if (curTx < 0 || curTx >= w || curSx < 0 || curSx >= w) continue;

              const tIdx = curTy * w + curTx;
              if (filled[tIdx] === 1) {
                const sIdx = curSy * w + curSx;
                const tr = dst[tIdx * 4];
                const tg = dst[tIdx * 4 + 1];
                const tb = dst[tIdx * 4 + 2];
                const sr = dst[sIdx * 4];
                const sg = dst[sIdx * 4 + 1];
                const sb = dst[sIdx * 4 + 2];

                const dr = tr - sr;
                const dg = tg - sg;
                const db = tb - sb;
                ssd += (dr * dr + dg * dg + db * db);
                knownCount++;
              }
            }
          }

          if (knownCount > 0) {
            const normSSD = ssd / knownCount;
            if (normSSD < bestSSD) {
              bestSSD = normSSD;
              bestSource = srcPt;
            }
          }
        }

        // Fill target pixel and its immediate neighbors from best matching patch
        const tPixelIdx = ty * w + tx;
        const sPixelIdx = bestSource.y * w + bestSource.x;
        dst[tPixelIdx * 4]     = dst[sPixelIdx * 4];
        dst[tPixelIdx * 4 + 1] = dst[sPixelIdx * 4 + 1];
        dst[tPixelIdx * 4 + 2] = dst[sPixelIdx * 4 + 2];
        dst[tPixelIdx * 4 + 3] = dst[sPixelIdx * 4 + 3];
        filled[tPixelIdx] = 1;
        remainingHoles--;
      }
    }

    // 3. Final pass: neighbor interpolation for any isolated leftover hole pixels
    if (remainingHoles > 0) {
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const idx = y * w + x;
          if (filled[idx] === 0) {
            let rSum = 0, gSum = 0, bSum = 0, aSum = 0, count = 0;
            for (let dy = -2; dy <= 2; dy++) {
              for (let dx = -2; dx <= 2; dx++) {
                const nx = x + dx;
                const ny = y + dy;
                if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
                  const nIdx = ny * w + nx;
                  if (filled[nIdx] === 1) {
                    rSum += dst[nIdx * 4];
                    gSum += dst[nIdx * 4 + 1];
                    bSum += dst[nIdx * 4 + 2];
                    aSum += dst[nIdx * 4 + 3];
                    count++;
                  }
                }
              }
            }
            if (count > 0) {
              dst[idx * 4]     = Math.round(rSum / count);
              dst[idx * 4 + 1] = Math.round(gSum / count);
              dst[idx * 4 + 2] = Math.round(bSum / count);
              dst[idx * 4 + 3] = Math.round(aSum / count);
              filled[idx] = 1;
            }
          }
        }
      }
    }

    return out;
  },

  // ══════════════════════════════════════════════════════════════════════
  // Retouching Suite: Patch Tool (Seamless Poisson/Boundary Harmonization)
  // ══════════════════════════════════════════════════════════════════════
  applyPatch(imgData, mask, offset = { dx: 0, dy: 0 }, mode = 'source', options = {}) {
    const w = imgData.width;
    const h = imgData.height;
    const src = imgData.data;
    const out = new ImageData(new Uint8ClampedArray(src), w, h);
    const dst = out.data;

    if (!mask || mask.length !== w * h) return out;

    const dx = Math.round(offset.dx || 0);
    const dy = Math.round(offset.dy || 0);
    if (dx === 0 && dy === 0) return out;

    // 1. Analyze boundary pixels for illumination & color matching
    let sumDstR = 0, sumDstG = 0, sumDstB = 0, dstBndCount = 0;
    let sumSrcR = 0, sumSrcG = 0, sumSrcB = 0, srcBndCount = 0;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        if (mask[idx] <= 128) continue;

        // Check outer neighbor pixels outside the mask
        for (let ny = Math.max(0, y - 1); ny <= Math.min(h - 1, y + 1); ny++) {
          for (let nx = Math.max(0, x - 1); nx <= Math.min(w - 1, x + 1); nx++) {
            const nIdx = ny * w + nx;
            if (mask[nIdx] <= 128) {
              sumDstR += src[nIdx * 4];
              sumDstG += src[nIdx * 4 + 1];
              sumDstB += src[nIdx * 4 + 2];
              dstBndCount++;

              const sx = mode === 'source' ? nx + dx : nx - dx;
              const sy = mode === 'source' ? ny + dy : ny - dy;
              if (sx >= 0 && sx < w && sy >= 0 && sy < h) {
                const sIdx = sy * w + sx;
                sumSrcR += src[sIdx * 4];
                sumSrcG += src[sIdx * 4 + 1];
                sumSrcB += src[sIdx * 4 + 2];
                srcBndCount++;
              }
            }
          }
        }
      }
    }

    const deltaR = (dstBndCount > 0 && srcBndCount > 0) ? (sumDstR / dstBndCount - sumSrcR / srcBndCount) : 0;
    const deltaG = (dstBndCount > 0 && srcBndCount > 0) ? (sumDstG / dstBndCount - sumSrcG / srcBndCount) : 0;
    const deltaB = (dstBndCount > 0 && srcBndCount > 0) ? (sumDstB / dstBndCount - sumSrcB / srcBndCount) : 0;

    // 2. Synthesize patch pixels with color harmonization
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        const mVal = mask[idx];
        if (mVal === 0) continue;

        const targetX = mode === 'source' ? x : x + dx;
        const targetY = mode === 'source' ? y : y + dy;
        const sampleX = mode === 'source' ? x + dx : x;
        const sampleY = mode === 'source' ? y + dy : y;

        if (targetX < 0 || targetX >= w || targetY < 0 || targetY >= h) continue;
        if (sampleX < 0 || sampleX >= w || sampleY < 0 || sampleY >= h) continue;

        const tIdx = targetY * w + targetX;
        const sIdx = sampleY * w + sampleX;

        const weight = mVal / 255;
        const harmR = Math.max(0, Math.min(255, src[sIdx * 4] + deltaR));
        const harmG = Math.max(0, Math.min(255, src[sIdx * 4 + 1] + deltaG));
        const harmB = Math.max(0, Math.min(255, src[sIdx * 4 + 2] + deltaB));

        dst[tIdx * 4]     = Math.round(src[tIdx * 4] * (1 - weight) + harmR * weight);
        dst[tIdx * 4 + 1] = Math.round(src[tIdx * 4 + 1] * (1 - weight) + harmG * weight);
        dst[tIdx * 4 + 2] = Math.round(src[tIdx * 4 + 2] * (1 - weight) + harmB * weight);
        dst[tIdx * 4 + 3] = Math.max(src[tIdx * 4 + 3], src[sIdx * 4 + 3]);
      }
    }

    return out;
  },

  // ══════════════════════════════════════════════════════════════════════
  // Retouching Suite: Content-Aware Move & Extend Engine
  // ══════════════════════════════════════════════════════════════════════
  contentAwareMove(imgData, mask, offset = { dx: 0, dy: 0 }, mode = 'move', options = {}) {
    const w = imgData.width;
    const h = imgData.height;
    const src = imgData.data;
    const dx = Math.round(offset.dx || 0);
    const dy = Math.round(offset.dy || 0);

    if (!mask || mask.length !== w * h || (dx === 0 && dy === 0)) {
      return new ImageData(new Uint8ClampedArray(src), w, h);
    }

    // 1. Copy original object pixels
    const objPixels = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < mask.length; i++) {
      if (mask[i] > 0) {
        objPixels[i * 4]     = src[i * 4];
        objPixels[i * 4 + 1] = src[i * 4 + 1];
        objPixels[i * 4 + 2] = src[i * 4 + 2];
        objPixels[i * 4 + 3] = src[i * 4 + 3];
      }
    }

    // 2. If 'move', inpaint original hole using content-aware fill
    let baseImgData;
    if (mode === 'move') {
      baseImgData = this.contentAwareFill(imgData, mask, options);
    } else {
      baseImgData = new ImageData(new Uint8ClampedArray(src), w, h);
    }

    const out = new ImageData(new Uint8ClampedArray(baseImgData.data), w, h);
    const dst = out.data;

    // 3. Composite object at new offset with boundary feathering
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const srcIdx = y * w + x;
        const mVal = mask[srcIdx];
        if (mVal === 0) continue;

        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;

        const dstIdx = ny * w + nx;
        const objAlpha = objPixels[srcIdx * 4 + 3] > 0 ? (objPixels[srcIdx * 4 + 3] / 255) : 1;
        const weight = (mVal / 255) * objAlpha;

        dst[dstIdx * 4]     = Math.round(dst[dstIdx * 4] * (1 - weight) + objPixels[srcIdx * 4] * weight);
        dst[dstIdx * 4 + 1] = Math.round(dst[dstIdx * 4 + 1] * (1 - weight) + objPixels[srcIdx * 4 + 1] * weight);
        dst[dstIdx * 4 + 2] = Math.round(dst[dstIdx * 4 + 2] * (1 - weight) + objPixels[srcIdx * 4 + 2] * weight);
        dst[dstIdx * 4 + 3] = Math.max(dst[dstIdx * 4 + 3], objPixels[srcIdx * 4 + 3] || 255);
      }
    }

    return out;
  },

  // ══════════════════════════════════════════════════════════════════════
  // Camera Raw & Photo Grading Master Filter
  // ══════════════════════════════════════════════════════════════════════
  cameraRaw(imgData, params = {}) {
    const w = imgData.width;
    const h = imgData.height;
    const src = imgData.data;
    const out = new ImageData(w, h);
    const dst = out.data;

    const temperature = Math.max(-100, Math.min(100, params.temperature || 0));
    const tint        = Math.max(-100, Math.min(100, params.tint || 0));
    const exposure    = Math.max(-100, Math.min(100, params.exposure || 0));
    const contrast    = Math.max(-100, Math.min(100, params.contrast || 0));
    const highlights  = Math.max(-100, Math.min(100, params.highlights || 0));
    const shadows     = Math.max(-100, Math.min(100, params.shadows || 0));
    const whites      = Math.max(-100, Math.min(100, params.whites || 0));
    const blacks      = Math.max(-100, Math.min(100, params.blacks || 0));
    const clarity     = Math.max(-100, Math.min(100, params.clarity || 0));
    const dehaze      = Math.max(-100, Math.min(100, params.dehaze || 0));
    const vibrance    = Math.max(-100, Math.min(100, params.vibrance || 0));
    const saturation  = Math.max(-100, Math.min(100, params.saturation || 0));
    const vignette    = Math.max(-100, Math.min(100, params.vignette || 0));

    // Exposure multiplier: +25 = 1 stop (2x)
    const expMult = Math.pow(2, exposure / 25);

    // Temperature & Tint deltas
    const dR_wb = temperature * 0.55 + tint * 0.25;
    const dG_wb = -tint * 0.55;
    const dB_wb = -temperature * 0.55 + tint * 0.25;

    // Contrast curve tangent
    const contrastFactor = Math.tan((45 + contrast * 0.44) * (Math.PI / 180));

    // Vignette center coordinates
    const cx = w / 2;
    const cy = h / 2;
    const maxDistSq = cx * cx + cy * cy;

    // Compute downsampled low-frequency luminance map for Clarity (if clarity != 0)
    let blurredLum = null;
    if (clarity !== 0) {
      blurredLum = new Float32Array(w * h);
      const tempLum = new Float32Array(w * h);
      for (let i = 0; i < src.length; i += 4) {
        tempLum[i / 4] = 0.299 * src[i] + 0.587 * src[i + 1] + 0.114 * src[i + 2];
      }
      // Simple fast 2-pass box blur for micro-contrast baseline
      const rad = 4;
      for (let y = 0; y < h; y++) {
        let sum = 0, count = 0;
        for (let k = -rad; k <= rad; k++) {
          if (k >= 0 && k < w) { sum += tempLum[y * w + k]; count++; }
        }
        for (let x = 0; x < w; x++) {
          if (x + rad + 1 < w) { sum += tempLum[y * w + x + rad + 1]; count++; }
          if (x - rad >= 0) { sum -= tempLum[y * w + x - rad]; count--; }
          blurredLum[y * w + x] = sum / count;
        }
      }
    }

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const a = src[i + 3];
        if (a === 0) {
          dst[i + 3] = 0;
          continue;
        }

        let r = src[i];
        let g = src[i + 1];
        let b = src[i + 2];

        // 1. Exposure
        if (exposure !== 0) {
          r *= expMult;
          g *= expMult;
          b *= expMult;
        }

        // 2. White Balance (Temperature / Tint)
        if (temperature !== 0 || tint !== 0) {
          r += dR_wb;
          g += dG_wb;
          b += dB_wb;
        }

        // 3. Contrast (around midpoint 128)
        if (contrast !== 0) {
          r = 128 + (r - 128) * contrastFactor;
          g = 128 + (g - 128) * contrastFactor;
          b = 128 + (b - 128) * contrastFactor;
        }

        // Current Luminance
        let lum = 0.299 * r + 0.587 * g + 0.114 * b;

        // 4. Highlights & Shadows
        if (highlights !== 0 && lum > 128) {
          const wH = Math.min(1.0, Math.pow((lum - 128) / 127, 1.5));
          const adjH = (highlights / 100) * 55 * wH;
          r += adjH; g += adjH; b += adjH;
        }
        if (shadows !== 0 && lum < 128) {
          const wS = Math.min(1.0, Math.pow((128 - lum) / 128, 1.5));
          const adjS = (shadows / 100) * 55 * wS;
          r += adjS; g += adjS; b += adjS;
        }

        // 5. Whites & Blacks
        if (whites !== 0 && lum > 180) {
          const wW = (lum - 180) / 75;
          const adjW = (whites / 100) * 40 * wW;
          r += adjW; g += adjW; b += adjW;
        }
        if (blacks !== 0 && lum < 80) {
          const wB = (80 - lum) / 80;
          const adjB = (blacks / 100) * 40 * wB;
          r += adjB; g += adjB; b += adjB;
        }

        // 6. Clarity (Local midtone micro-contrast)
        if (clarity !== 0 && blurredLum) {
          const bLum = blurredLum[y * w + x];
          const microDiff = lum - bLum;
          // Midtone mask: peaks at 128, zero at 0 and 255
          const midWeight = Math.max(0, 1.0 - Math.pow(Math.abs(lum - 128) / 128, 2));
          const cShift = microDiff * (clarity / 100) * midWeight * 1.5;
          r += cShift; g += cShift; b += cShift;
        }

        // 7. Dehaze (Atmospheric haze removal via dark channel radiance recovery)
        if (dehaze !== 0) {
          const dark = Math.min(r, g, b);
          const t = Math.max(0.1, 1.0 - 0.75 * (dark / 235));
          const dehazeFactor = dehaze / 100;
          if (dehazeFactor > 0) {
            r = ((r - 230 * (1 - t)) / t) * dehazeFactor + r * (1 - dehazeFactor);
            g = ((g - 230 * (1 - t)) / t) * dehazeFactor + g * (1 - dehazeFactor);
            b = ((b - 230 * (1 - t)) / t) * dehazeFactor + b * (1 - dehazeFactor);
          } else {
            // Negative dehaze adds soft atmospheric glow
            const hazeAmt = -dehazeFactor * 0.4;
            r = r * (1 - hazeAmt) + 235 * hazeAmt;
            g = g * (1 - hazeAmt) + 235 * hazeAmt;
            b = b * (1 - hazeAmt) + 235 * hazeAmt;
          }
        }

        // 8. Vibrance & Saturation
        lum = 0.299 * r + 0.587 * g + 0.114 * b;
        if (vibrance !== 0 || saturation !== 0) {
          const maxC = Math.max(r, g, b);
          const minC = Math.min(r, g, b);
          const curSat = maxC > 0 ? (maxC - minC) / maxC : 0;

          let satBoost = saturation / 100;
          if (vibrance !== 0) {
            // Vibrance targets lower saturated pixels more
            satBoost += (vibrance / 100) * (1.0 - curSat * 0.85);
          }

          r = lum + (r - lum) * (1.0 + satBoost);
          g = lum + (g - lum) * (1.0 + satBoost);
          b = lum + (b - lum) * (1.0 + satBoost);
        }

        // 9. Lens Vignette
        if (vignette !== 0) {
          const distSq = (x - cx) * (x - cx) + (y - cy) * (y - cy);
          const normDist = distSq / maxDistSq;
          const vigFactor = 1.0 - (vignette / 100) * normDist * 0.55;
          r *= vigFactor;
          g *= vigFactor;
          b *= vigFactor;
        }

        dst[i]     = Math.max(0, Math.min(255, Math.round(r)));
        dst[i + 1] = Math.max(0, Math.min(255, Math.round(g)));
        dst[i + 2] = Math.max(0, Math.min(255, Math.round(b)));
        dst[i + 3] = src[i + 3];
      }
    }
    return out;
  },

  // ── Shadows / Highlights Adjustment (Photoshop Parity) ──
  shadowsHighlights(imgData, shadowAmount = 35, highlightAmount = 0, midtoneContrast = 0) {
    const w = imgData.width;
    const h = imgData.height;
    const src = imgData.data;
    const out = new ImageData(w, h);
    const dst = out.data;

    const sAmt = (shadowAmount / 100);
    const hAmt = (highlightAmount / 100);
    const mFactor = midtoneContrast !== 0 ? (259 * (midtoneContrast + 255)) / (255 * (259 - midtoneContrast)) : 1.0;

    for (let i = 0; i < src.length; i += 4) {
      if (src[i + 3] === 0) {
        dst[i + 3] = 0;
        continue;
      }
      let r = src[i];
      let g = src[i + 1];
      let b = src[i + 2];

      const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255.0;

      // Shadow recovery: lift dark tones without washing out highlights
      if (sAmt > 0) {
        const shadowWeight = Math.pow(Math.max(0, 1.0 - lum * 2.0), 2);
        const boost = sAmt * shadowWeight * 80;
        r += boost;
        g += boost;
        b += boost;
      }

      // Highlight recovery: reduce harsh overexposed zones
      if (hAmt > 0) {
        const highlightWeight = Math.pow(Math.max(0, (lum - 0.5) * 2.0), 2);
        const reduction = hAmt * highlightWeight * 70;
        r -= reduction;
        g -= reduction;
        b -= reduction;
      }

      // Midtone contrast adjustment
      if (midtoneContrast !== 0) {
        r = mFactor * (r - 128) + 128;
        g = mFactor * (g - 128) + 128;
        b = mFactor * (b - 128) + 128;
      }

      dst[i]     = Utils.clamp(Math.round(r), 0, 255);
      dst[i + 1] = Utils.clamp(Math.round(g), 0, 255);
      dst[i + 2] = Utils.clamp(Math.round(b), 0, 255);
      dst[i + 3] = src[i + 3];
    }
    return out;
  },

  // ── Replace Color Engine (Photoshop Parity) ──
  replaceColor(imgData, targetRgb = { r: 255, g: 0, b: 0 }, fuzziness = 40, hueShift = 0, satShift = 0, lightShift = 0) {
    const w = imgData.width;
    const h = imgData.height;
    const src = imgData.data;
    const out = new ImageData(w, h);
    const dst = out.data;

    const maxDist = Math.max(1, (fuzziness / 200) * 441.67);

    const tr = targetRgb.r !== undefined ? targetRgb.r : (Array.isArray(targetRgb) ? (targetRgb[0] ?? 255) : 255);
    const tg = targetRgb.g !== undefined ? targetRgb.g : (Array.isArray(targetRgb) ? (targetRgb[1] ?? 0) : 0);
    const tb = targetRgb.b !== undefined ? targetRgb.b : (Array.isArray(targetRgb) ? (targetRgb[2] ?? 0) : 0);

    for (let i = 0; i < src.length; i += 4) {
      if (src[i + 3] === 0) {
        dst[i + 3] = 0;
        continue;
      }
      const r = src[i];
      const g = src[i + 1];
      const b = src[i + 2];

      const dr = r - tr;
      const dg = g - tg;
      const db = b - tb;
      const dist = Math.hypot(dr, dg, db);

      if (dist <= maxDist) {
        const weight = Math.pow(1.0 - (dist / maxDist), 1.5);
        const hsl = Utils.rgbToHsl(r, g, b);
        hsl.h = (hsl.h + hueShift + 360) % 360;
        hsl.s = Utils.clamp(hsl.s + satShift, 0, 100);
        hsl.l = Utils.clamp(hsl.l + lightShift, 0, 100);

        const repRgb = Utils.hslToRgb(hsl.h, hsl.s, hsl.l);

        dst[i]     = Utils.clamp(Math.round(r * (1 - weight) + repRgb.r * weight), 0, 255);
        dst[i + 1] = Utils.clamp(Math.round(g * (1 - weight) + repRgb.g * weight), 0, 255);
        dst[i + 2] = Utils.clamp(Math.round(b * (1 - weight) + repRgb.b * weight), 0, 255);
      } else {
        dst[i]     = r;
        dst[i + 1] = g;
        dst[i + 2] = b;
      }
      dst[i + 3] = src[i + 3];
    }
    return out;
  }
};

if (typeof window !== 'undefined') {
  window.Filters = Filters;
}
if (typeof global !== 'undefined') {
  global.Filters = Filters;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Filters;
  module.exports.Filters = Filters;
}

