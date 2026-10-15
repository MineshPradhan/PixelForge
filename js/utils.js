// ══════════════════════════════════════════════════════════════════════
// PixelForge Studio — Core Utility Functions
// ══════════════════════════════════════════════════════════════════════

window.Utils = {
  clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  },

  lerp(a, b, t) {
    return a + (b - a) * t;
  },

  dist(x1, y1, x2, y2) {
    return Math.hypot(x2 - x1, y2 - y1);
  },

  // ── Color Space Conversions ──
  rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(x => {
      const hex = Math.round(Utils.clamp(x, 0, 255)).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('').toUpperCase();
  },

  hexToRgb(hex) {
    let clean = hex.replace('#', '').trim();
    if (clean.length === 3) {
      clean = clean.split('').map(c => c + c).join('');
    }
    const num = parseInt(clean, 16);
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255
    };
  },

  hexToRgba(hex, alpha = 1) {
    const rgb = Utils.hexToRgb(hex);
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${Utils.clamp(alpha, 0, 1)})`;
  },

  rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return {
      h: Math.round(h * 360),
      s: Math.round(s * 100),
      l: Math.round(l * 100)
    };
  },

  hslToRgb(h, s, l) {
    h = (h % 360) / 360;
    s = Utils.clamp(s, 0, 100) / 100;
    l = Utils.clamp(l, 0, 100) / 100;

    let r, g, b;
    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }

    return {
      r: Math.round(r * 255),
      g: Math.round(g * 255),
      b: Math.round(b * 255)
    };
  },

  // ── Canvas Helpers ──
  createCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    return c;
  },

  renderCheckerboard(ctx, width, height, size = 16) {
    ctx.clearRect(0, 0, width, height);
    const cols = Math.ceil(width / size);
    const rows = Math.ceil(height / size);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? '#2a2a2e' : '#1e1e22';
        ctx.fillRect(x * size, y * size, size, size);
      }
    }
  },

  // ── BFS Scanline Flood Fill ──
  floodFill(ctx, startX, startY, fillRgb, tolerance = 32) {
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    startX = Math.floor(startX);
    startY = Math.floor(startY);
    if (startX < 0 || startX >= w || startY < 0 || startY >= h) return;

    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;

    const targetIdx = (startY * w + startX) * 4;
    const tR = data[targetIdx];
    const tG = data[targetIdx + 1];
    const tB = data[targetIdx + 2];
    const tA = data[targetIdx + 3];

    const fR = fillRgb.r;
    const fG = fillRgb.g;
    const fB = fillRgb.b;
    const fA = fillRgb.a !== undefined ? fillRgb.a : 255;

    // Already target color
    if (Math.abs(tR - fR) <= tolerance &&
        Math.abs(tG - fG) <= tolerance &&
        Math.abs(tB - fB) <= tolerance &&
        Math.abs(tA - fA) <= tolerance) {
      return;
    }

    const matchesTarget = (idx) => {
      const dr = Math.abs(data[idx] - tR);
      const dg = Math.abs(data[idx + 1] - tG);
      const db = Math.abs(data[idx + 2] - tB);
      const da = Math.abs(data[idx + 3] - tA);
      return (dr + dg + db + da) / 4 <= tolerance;
    };

    const visited = new Uint8Array(w * h);
    const stack = [[startX, startY]];
    visited[startY * w + startX] = 1;

    while (stack.length > 0) {
      const [curX, curY] = stack.pop();
      const idx = (curY * w + curX) * 4;

      data[idx] = fR;
      data[idx + 1] = fG;
      data[idx + 2] = fB;
      data[idx + 3] = fA;

      const neighbors = [
        [curX + 1, curY],
        [curX - 1, curY],
        [curX, curY + 1],
        [curX, curY - 1]
      ];

      for (let i = 0; i < 4; i++) {
        const nx = neighbors[i][0];
        const ny = neighbors[i][1];
        if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
          const nPos = ny * w + nx;
          if (!visited[nPos]) {
            visited[nPos] = 1;
            if (matchesTarget(nPos * 4)) {
              stack.push([nx, ny]);
            }
          }
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);
  },

  // ── Convolution Kernel Engine ──
  applyKernel(imgData, kernel, divisor = 1, bias = 0) {
    const w = imgData.width;
    const h = imgData.height;
    const src = imgData.data;
    const output = new ImageData(w, h);
    const dst = output.data;
    const kSize = Math.round(Math.sqrt(kernel.length));
    const half = Math.floor(kSize / 2);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let r = 0, g = 0, b = 0;
        for (let ky = 0; ky < kSize; ky++) {
          for (let kx = 0; kx < kSize; kx++) {
            const px = Utils.clamp(x + kx - half, 0, w - 1);
            const py = Utils.clamp(y + ky - half, 0, h - 1);
            const idx = (py * w + px) * 4;
            const weight = kernel[ky * kSize + kx];

            r += src[idx] * weight;
            g += src[idx + 1] * weight;
            b += src[idx + 2] * weight;
          }
        }
        const outIdx = (y * w + x) * 4;
        dst[outIdx] = Utils.clamp(Math.round(r / divisor + bias), 0, 255);
        dst[outIdx + 1] = Utils.clamp(Math.round(g / divisor + bias), 0, 255);
        dst[outIdx + 2] = Utils.clamp(Math.round(b / divisor + bias), 0, 255);
        dst[outIdx + 3] = src[outIdx + 3]; // keep alpha
      }
    }

    return output;
  },

  // ── Color Histogram Calculator ──
  computeHistogram(imgData) {
    const r = new Uint32Array(256);
    const g = new Uint32Array(256);
    const b = new Uint32Array(256);
    const lum = new Uint32Array(256);
    const src = imgData.data;

    let maxCount = 0;
    for (let i = 0; i < src.length; i += 4) {
      if (src[i + 3] === 0) continue; // skip transparent
      const rv = src[i];
      const gv = src[i + 1];
      const bv = src[i + 2];
      const lv = Math.round(0.2126 * rv + 0.7152 * gv + 0.0722 * bv);

      r[rv]++;
      g[gv]++;
      b[bv]++;
      lum[lv]++;

      if (lum[lv] > maxCount) maxCount = lum[lv];
    }

    return { r, g, b, lum, max: maxCount || 1 };
  },

  // ── Magic Wand Color-Range Selection ──
  magicWandSelect(ctx, startX, startY, tolerance = 32, contiguous = true) {
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    startX = Math.floor(startX);
    startY = Math.floor(startY);
    if (startX < 0 || startX >= w || startY < 0 || startY >= h) return null;

    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;
    const targetIdx = (startY * w + startX) * 4;
    const tR = data[targetIdx];
    const tG = data[targetIdx + 1];
    const tB = data[targetIdx + 2];
    const tA = data[targetIdx + 3];

    const matches = (idx) => {
      const dr = Math.abs(data[idx] - tR);
      const dg = Math.abs(data[idx + 1] - tG);
      const db = Math.abs(data[idx + 2] - tB);
      const da = Math.abs(data[idx + 3] - tA);
      return (dr + dg + db + da) / 4 <= tolerance;
    };

    const mask = new Uint8Array(w * h);
    let minX = w, minY = h, maxX = 0, maxY = 0;
    let selectedCount = 0;

    if (contiguous) {
      const visited = new Uint8Array(w * h);
      const stack = [[startX, startY]];
      visited[startY * w + startX] = 1;

      while (stack.length > 0) {
        const [cx, cy] = stack.pop();
        const pIdx = cy * w + cx;
        mask[pIdx] = 255;
        selectedCount++;

        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;

        const neighbors = [
          [cx + 1, cy],
          [cx - 1, cy],
          [cx, cy + 1],
          [cx, cy - 1]
        ];

        for (let i = 0; i < 4; i++) {
          const nx = neighbors[i][0];
          const ny = neighbors[i][1];
          if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
            const nPos = ny * w + nx;
            if (!visited[nPos]) {
              visited[nPos] = 1;
              if (matches(nPos * 4)) {
                stack.push([nx, ny]);
              }
            }
          }
        }
      }
    } else {
      // Non-contiguous (global color select)
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const pIdx = y * w + x;
          if (matches(pIdx * 4)) {
            mask[pIdx] = 255;
            selectedCount++;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
    }

    if (selectedCount === 0) return null;
    return {
      mask,
      bounds: { minX, minY, maxX, maxY, w: maxX - minX + 1, h: maxY - minY + 1 },
      count: selectedCount
    };
  },

  // ── Tone Curves & Levels Mapping ──
  applyLevelsAndCurve(imgData, black = 0, white = 255, gamma = 1.0, curveLUT = null) {
    const w = imgData.width;
    const h = imgData.height;
    const src = imgData.data;
    const out = new ImageData(w, h);
    const dst = out.data;

    // Build levels mapping table (0 - 255)
    const lut = new Uint8Array(256);
    const range = Math.max(1, white - black);

    for (let i = 0; i < 256; i++) {
      let val = (i - black) / range;
      val = Utils.clamp(val, 0, 1);
      // Apply gamma
      if (gamma !== 1.0) {
        val = Math.pow(val, 1 / gamma);
      }
      let finalVal = Math.round(val * 255);
      // Apply custom curve LUT if provided
      if (curveLUT && curveLUT[finalVal] !== undefined) {
        finalVal = curveLUT[finalVal];
      }
      lut[i] = Utils.clamp(finalVal, 0, 255);
    }

    for (let i = 0; i < src.length; i += 4) {
      dst[i]     = lut[src[i]];
      dst[i + 1] = lut[src[i + 1]];
      dst[i + 2] = lut[src[i + 2]];
      dst[i + 3] = src[i + 3]; // keep alpha
    }

    return out;
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = window.Utils;
}
