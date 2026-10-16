/**
 * PixelForge Studio — Advanced Smart Selection Suite
 *
 * Implements Adobe Photoshop-grade intelligent selection tools:
 *  1. Magnetic Lasso Tool (Sobel edge-gradient detection, contour snapping)
 *  2. One-Click Smart Subject Detection (Saliency analysis, boundary prior, Otsu segmentation)
 *  3. Select and Mask / Refine Edge Engine (Smooth, Feather, Contrast, Shift Edge, Multi-mode preview)
 */

class MagneticLassoEngine {
  constructor() {
    this.edgeMap = null;
    this.edgeWidth = 0;
    this.edgeHeight = 0;
    this.snapRadius = 16;
  }

  /**
   * Computes Sobel edge gradient magnitude map from a 2D canvas context
   */
  computeEdgeMap(ctx, width, height) {
    this.edgeWidth = width;
    this.edgeHeight = height;
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;
    const gray = new Uint8Array(width * height);

    // 1. Grayscale luminance
    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
      gray[j] = (data[i] * 77 + data[i + 1] * 150 + data[i + 2] * 29) >> 8;
    }

    // 2. Sobel 3x3 Gradient Filters
    const edges = new Float32Array(width * height);
    let maxGrad = 0.001;

    for (let y = 1; y < height - 1; y++) {
      const rowPrev = (y - 1) * width;
      const rowCur = y * width;
      const rowNext = (y + 1) * width;

      for (let x = 1; x < width - 1; x++) {
        // Gx: [-1 0 1; -2 0 2; -1 0 1]
        const gx = -gray[rowPrev + x - 1] + gray[rowPrev + x + 1]
                   - 2 * gray[rowCur + x - 1] + 2 * gray[rowCur + x + 1]
                   - gray[rowNext + x - 1] + gray[rowNext + x + 1];

        // Gy: [-1 -2 -1; 0 0 0; 1 2 1]
        const gy = -gray[rowPrev + x - 1] - 2 * gray[rowPrev + x] - gray[rowPrev + x + 1]
                   + gray[rowNext + x - 1] + 2 * gray[rowNext + x] + gray[rowNext + x + 1];

        const mag = Math.sqrt(gx * gx + gy * gy);
        edges[rowCur + x] = mag;
        if (mag > maxGrad) maxGrad = mag;
      }
    }

    // Normalize edge map to 0.0 - 1.0 range
    for (let i = 0; i < edges.length; i++) {
      edges[i] /= maxGrad;
    }

    this.edgeMap = edges;
    return this.edgeMap;
  }

  /**
   * Snaps a mouse coordinate to the nearest strong edge within snapRadius
   */
  findSnapPoint(x, y, radius = null) {
    if (!this.edgeMap) return { x, y, snapped: false };
    const r = radius || this.snapRadius;
    const w = this.edgeWidth;
    const h = this.edgeHeight;

    const startX = Math.max(1, Math.floor(x - r));
    const endX = Math.min(w - 2, Math.ceil(x + r));
    const startY = Math.max(1, Math.floor(y - r));
    const endY = Math.min(h - 2, Math.ceil(y + r));

    let bestScore = -1;
    let bestX = x;
    let bestY = y;

    for (let cy = startY; cy <= endY; cy++) {
      for (let cx = startX; cx <= endX; cx++) {
        const dx = cx - x;
        const dy = cy - y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > r) continue;

        const edgeStrength = this.edgeMap[cy * w + cx];
        // Score favors strong edges closer to the cursor
        const proximityWeight = 1.0 - (dist / r) * 0.45;
        const score = edgeStrength * proximityWeight;

        if (score > bestScore && edgeStrength > 0.12) {
          bestScore = score;
          bestX = cx;
          bestY = cy;
        }
      }
    }

    return {
      x: bestScore > 0.1 ? bestX : x,
      y: bestScore > 0.1 ? bestY : y,
      snapped: bestScore > 0.1,
      strength: bestScore
    };
  }

  /**
   * Traces optimal contour line connecting two points with edge attraction
   */
  traceContour(p1, p2, steps = 12) {
    if (!this.edgeMap) return [p1, p2];
    const path = [p1];
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const dist = Math.hypot(dx, dy);
    const count = Math.max(2, Math.min(steps, Math.floor(dist / 4)));

    for (let i = 1; i < count; i++) {
      const t = i / count;
      const lx = p1.x + dx * t;
      const ly = p1.y + dy * t;
      const snapped = this.findSnapPoint(lx, ly, Math.min(8, this.snapRadius / 2));
      path.push({ x: snapped.x, y: snapped.y });
    }

    path.push(p2);
    return path;
  }
}

class SmartSubjectDetection {
  /**
   * Detects the dominant subject/foreground in an image context using
  /**
   * Detects dominant subject/foreground in an image context or user-defined region.
   * Supports:
   * 1. Automatic one-click dominant subject detection across entire canvas.
   * 2. Manual user-defined regional bounding box or lasso region (Object Selection Tool).
   * 3. Robust border prior sampling with transparent alpha preservation.
   * 4. Multi-scale contrast & adaptive thresholding without artificial oval distortion.
   * Returns a binary mask Uint8Array (0 or 255) and precise bounding box.
   */
  static detectSubject(ctx, width, height, region = null) {
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;
    const totalPixels = width * height;

    // Define search region bounds
    const rx = region ? Math.max(0, Math.floor(region.x !== undefined ? region.x : (region.minX || 0))) : 0;
    const ry = region ? Math.max(0, Math.floor(region.y !== undefined ? region.y : (region.minY || 0))) : 0;
    const rw = region ? Math.max(1, Math.min(width - rx, Math.ceil(region.width !== undefined ? region.width : (region.w || (region.maxX - rx + 1) || width)))) : width;
    const rh = region ? Math.max(1, Math.min(height - ry, Math.ceil(region.height !== undefined ? region.height : (region.h || (region.maxY - ry + 1) || height)))) : height;

    // 1. Boundary Prior Sampling along region or canvas edges
    let bgR = 0, bgG = 0, bgB = 0, borderCount = 0;
    let transparentCount = 0;

    for (let x = rx; x < rx + rw; x++) {
      const topIdx = (ry * width + x) * 4;
      const botIdx = ((ry + rh - 1) * width + x) * 4;
      if (data[topIdx + 3] < 20) transparentCount++;
      else {
        bgR += data[topIdx]; bgG += data[topIdx + 1]; bgB += data[topIdx + 2]; borderCount++;
      }
      if (data[botIdx + 3] < 20) transparentCount++;
      else {
        bgR += data[botIdx]; bgG += data[botIdx + 1]; bgB += data[botIdx + 2]; borderCount++;
      }
    }
    for (let y = ry + 1; y < ry + rh - 1; y++) {
      const leftIdx = (y * width + rx) * 4;
      const rightIdx = (y * width + rx + rw - 1) * 4;
      if (data[leftIdx + 3] < 20) transparentCount++;
      else {
        bgR += data[leftIdx]; bgG += data[leftIdx + 1]; bgB += data[leftIdx + 2]; borderCount++;
      }
      if (data[rightIdx + 3] < 20) transparentCount++;
      else {
        bgR += data[rightIdx]; bgG += data[rightIdx + 1]; bgB += data[rightIdx + 2]; borderCount++;
      }
    }

    const hasTransparentBackground = transparentCount > (borderCount * 0.2);
    bgR = borderCount > 0 ? bgR / borderCount : 128;
    bgG = borderCount > 0 ? bgG / borderCount : 128;
    bgB = borderCount > 0 ? bgB / borderCount : 128;

    // 2. Compute Saliency Map within the target region
    const saliency = new Float32Array(totalPixels);
    const centerX = rx + rw / 2;
    const centerY = ry + rh / 2;
    const maxRadius = Math.max(1, Math.hypot(rw / 2, rh / 2));

    let maxSal = 0.001;
    for (let y = ry; y < ry + rh; y++) {
      const rowIdx = y * width;
      const dy = y - centerY;
      for (let x = rx; x < rx + rw; x++) {
        const pIdx = (rowIdx + x) * 4;
        const r = data[pIdx];
        const g = data[pIdx + 1];
        const b = data[pIdx + 2];
        const a = data[pIdx + 3];

        if (a < 10) {
          saliency[rowIdx + x] = 0;
          continue;
        }

        // If the layer is isolated on transparent background, visible pixels are 100% subject
        if (hasTransparentBackground && a > 30) {
          const sal = 100.0 * (a / 255);
          saliency[rowIdx + x] = sal;
          if (sal > maxSal) maxSal = sal;
          continue;
        }

        // Color difference from boundary prior
        const cDist = Math.sqrt(
          (r - bgR) * (r - bgR) +
          (g - bgG) * (g - bgG) +
          (b - bgB) * (b - bgB)
        );

        // Subtle center weight (only 5% falloff to break ties without creating an oval distortion)
        const distToCenter = Math.hypot(x - centerX, dy);
        const centerWeight = 1.0 - (distToCenter / maxRadius) * 0.05;

        // Alpha channel weight
        const alphaWeight = a / 255;

        const sal = cDist * centerWeight * alphaWeight;
        saliency[rowIdx + x] = sal;
        if (sal > maxSal) maxSal = sal;
      }
    }

    // 3. Compute Otsu threshold from active region histogram
    const hist = new Int32Array(256);
    let regionPixels = 0;
    for (let y = ry; y < ry + rh; y++) {
      const rowIdx = y * width;
      for (let x = rx; x < rx + rw; x++) {
        const val = Math.min(255, Math.floor((saliency[rowIdx + x] / maxSal) * 255));
        hist[val]++;
        regionPixels++;
      }
    }

    let sumTotal = 0;
    for (let t = 0; t < 256; t++) sumTotal += t * hist[t];

    let sumB = 0;
    let wB = 0;
    let wF = 0;
    let varMax = 0;
    let threshold = 64;

    for (let t = 0; t < 256; t++) {
      wB += hist[t];
      if (wB === 0) continue;
      wF = regionPixels - wB;
      if (wF === 0) break;

      sumB += t * hist[t];
      const mB = sumB / wB;
      const mF = (sumTotal - sumB) / wF;
      const varBetween = wB * wF * (mB - mF) * (mB - mF);

      if (varBetween > varMax) {
        varMax = varBetween;
        threshold = t;
      }
    }

    const normalizedCutoff = hasTransparentBackground
      ? 15.0
      : (Math.max(25, Math.min(130, threshold)) / 255 * maxSal);

    // 4. Generate Mask and calculate bounding box
    const mask = new Uint8Array(totalPixels);
    let minX = width, minY = height, maxX = 0, maxY = 0;
    let selectedCount = 0;

    for (let y = ry; y < ry + rh; y++) {
      const rowIdx = y * width;
      for (let x = rx; x < rx + rw; x++) {
        const i = rowIdx + x;
        if (saliency[i] >= normalizedCutoff) {
          mask[i] = 255;
          selectedCount++;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    // Morphological hole fill for solid subject selection
    if (selectedCount > 20) {
      for (let y = ry + 1; y < ry + rh - 1; y++) {
        const rowIdx = y * width;
        for (let x = rx + 1; x < rx + rw - 1; x++) {
          const idx = rowIdx + x;
          if (mask[idx] === 0 && data[idx * 4 + 3] > 20) {
            let neighborCount = 0;
            if (mask[idx - 1]) neighborCount++;
            if (mask[idx + 1]) neighborCount++;
            if (mask[idx - width]) neighborCount++;
            if (mask[idx + width]) neighborCount++;
            if (mask[idx - width - 1]) neighborCount++;
            if (mask[idx - width + 1]) neighborCount++;
            if (mask[idx + width - 1]) neighborCount++;
            if (mask[idx + width + 1]) neighborCount++;
            if (neighborCount >= 6) {
              mask[idx] = 255;
              selectedCount++;
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }
      }
    }

    // Fallback if empty within region
    if (selectedCount === 0) {
      minX = rx + Math.floor(rw * 0.15);
      minY = ry + Math.floor(rh * 0.15);
      maxX = rx + Math.floor(rw * 0.85);
      maxY = ry + Math.floor(rh * 0.85);
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          mask[y * width + x] = 255;
          selectedCount++;
        }
      }
    }

    return {
      mask,
      bounds: {
        x: minX,
        y: minY,
        width: Math.max(1, maxX - minX + 1),
        height: Math.max(1, maxY - minY + 1)
      },
      selectedCount
    };
  }
}

class SelectionRefinementEngine {
  /**
   * Refines a binary selection mask using:
   *  - smooth: boundary smoothing (box blur)
   *  - feather: Gaussian edge softening (0 - 50 px)
   *  - contrast: transition steepness / sharpness (0 - 100%)
   *  - shiftEdge: morphological dilation / erosion (-100% to +100%)
   */
  static refineSelection(sourceMask, width, height, options = {}) {
    const smooth = Math.max(0, Math.min(100, options.smooth || 0));
    const feather = Math.max(0, Math.min(50, options.feather || 0));
    const contrast = Math.max(0, Math.min(100, options.contrast || 0));
    const shiftEdge = Math.max(-100, Math.min(100, options.shiftEdge || 0));

    let current = new Float32Array(width * height);
    for (let i = 0; i < sourceMask.length; i++) {
      current[i] = sourceMask[i] / 255.0;
    }

    // 1. Shift Edge (Morphological Dilation or Erosion)
    if (Math.abs(shiftEdge) > 2) {
      const radius = Math.max(1, Math.round(Math.abs(shiftEdge) / 10));
      const shifted = new Float32Array(width * height);
      const isExpand = shiftEdge > 0;

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          let extreme = isExpand ? 0 : 1;
          for (let dy = -radius; dy <= radius; dy++) {
            const ny = y + dy;
            if (ny < 0 || ny >= height) continue;
            for (let dx = -radius; dx <= radius; dx++) {
              const nx = x + dx;
              if (nx < 0 || nx >= width) continue;
              if (dx * dx + dy * dy <= radius * radius) {
                const val = current[ny * width + nx];
                if (isExpand) {
                  if (val > extreme) extreme = val;
                } else {
                  if (val < extreme) extreme = val;
                }
              }
            }
          }
          shifted[y * width + x] = extreme;
        }
      }
      current = shifted;
    }

    // 2. Smooth (Boundary low-pass filtering)
    if (smooth > 0) {
      const sRadius = Math.max(1, Math.round((smooth / 100) * 8));
      const smoothed = new Float32Array(width * height);

      // Horizontal pass
      const tempH = new Float32Array(width * height);
      for (let y = 0; y < height; y++) {
        const row = y * width;
        for (let x = 0; x < width; x++) {
          let sum = 0, count = 0;
          for (let k = -sRadius; k <= sRadius; k++) {
            const nx = x + k;
            if (nx >= 0 && nx < width) {
              sum += current[row + nx];
              count++;
            }
          }
          tempH[row + x] = sum / count;
        }
      }

      // Vertical pass
      for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {
          let sum = 0, count = 0;
          for (let k = -sRadius; k <= sRadius; k++) {
            const ny = y + k;
            if (ny >= 0 && ny < height) {
              sum += tempH[ny * width + x];
              count++;
            }
          }
          smoothed[y * width + x] = sum / count;
        }
      }
      current = smoothed;
    }

    // 3. Feather (Soft Gaussian falloff)
    if (feather > 0) {
      const fRadius = Math.round(feather);
      const feathered = new Float32Array(width * height);

      // Approximate Gaussian with 2-pass box blur
      for (let pass = 0; pass < 2; pass++) {
        // Horizontal
        const temp = new Float32Array(width * height);
        for (let y = 0; y < height; y++) {
          const row = y * width;
          for (let x = 0; x < width; x++) {
            let sum = 0, count = 0;
            for (let k = -fRadius; k <= fRadius; k++) {
              const nx = x + k;
              if (nx >= 0 && nx < width) {
                sum += current[row + nx];
                count++;
              }
            }
            temp[row + x] = sum / count;
          }
        }
        // Vertical
        for (let x = 0; x < width; x++) {
          for (let y = 0; y < height; y++) {
            let sum = 0, count = 0;
            for (let k = -fRadius; k <= fRadius; k++) {
              const ny = y + k;
              if (ny >= 0 && ny < height) {
                sum += temp[ny * width + x];
                count++;
              }
            }
            feathered[y * width + x] = sum / count;
          }
        }
        current = feathered;
      }
    }

    // 4. Contrast (S-Curve threshold steepening)
    if (contrast > 0) {
      const factor = 1.0 + (contrast / 100) * 4.0;
      for (let i = 0; i < current.length; i++) {
        // S-curve centered around 0.5
        const val = current[i];
        current[i] = Math.max(0, Math.min(1, 0.5 + (val - 0.5) * factor));
      }
    }

    // Final Quantization to Uint8Array
    const outMask = new Uint8Array(width * height);
    for (let i = 0; i < current.length; i++) {
      outMask[i] = Math.round(Math.max(0, Math.min(1, current[i])) * 255);
    }

    return outMask;
  }
}

// Module export for Node.js test environment and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MagneticLassoEngine, SmartSubjectDetection, SelectionRefinementEngine };
}
if (typeof window !== 'undefined') {
  window.MagneticLassoEngine = MagneticLassoEngine;
  window.SmartSubjectDetection = SmartSubjectDetection;
  window.SelectionRefinementEngine = SelectionRefinementEngine;
}
if (typeof global !== 'undefined') {
  global.MagneticLassoEngine = MagneticLassoEngine;
  global.SmartSubjectDetection = SmartSubjectDetection;
  global.SelectionRefinementEngine = SelectionRefinementEngine;
}
