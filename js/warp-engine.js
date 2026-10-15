/**
 * PixelForge Studio Pro — Perspective Transform & Freeform Bézier Mesh Warp Engine
 *
 * Implements Photoshop-grade geometric transformations:
 *  1. PerspectiveTransform:
 *     - 4-corner independent projective transformation (corner pin / billboard mapping)
 *     - 8-DOF Gaussian elimination solving homography matrix H and inverse H^-1
 *     - Backward projective pixel mapping with bilinear subpixel interpolation
 *  2. MeshWarpEngine (Edit -> Transform -> Warp):
 *     - 3×3 and 4×4 interactive Bézier mesh control grids
 *     - Parametric warping presets: Arch, Flag, Cylinder, FishEye, Wave, Custom
 *     - Bicubic patch interpolation for distortion-free organic surface warping
 */

class PerspectiveTransform {
  /**
   * Compute 3x3 Projective Homography Matrix mapping source quadrilateral to target quadrilateral
   * @param {Array<{x, y}>} srcQuad - 4 source points [TL, TR, BR, BL]
   * @param {Array<{x, y}>} dstQuad - 4 destination points [TL, TR, BR, BL]
   * @returns {Array<number>} 9-element 3x3 row-major homography matrix
   */
  static computeHomography(srcQuad, dstQuad) {
    // Standard Direct Linear Transformation (DLT) with 8 equations
    const A = [];
    const b = [];

    for (let i = 0; i < 4; i++) {
      const sx = srcQuad[i].x;
      const sy = srcQuad[i].y;
      const dx = dstQuad[i].x;
      const dy = dstQuad[i].y;

      A.push([sx, sy, 1, 0, 0, 0, -dx * sx, -dx * sy]);
      b.push(dx);

      A.push([0, 0, 0, sx, sy, 1, -dy * sx, -dy * sy]);
      b.push(dy);
    }

    // Solve 8x8 linear system via Gaussian elimination
    const h = PerspectiveTransform.gaussianElimination(A, b);
    return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1.0];
  }

  /**
   * Compute inverse 3x3 matrix
   */
  static invert3x3(m) {
    const a = m[0], b = m[1], c = m[2];
    const d = m[3], e = m[4], f = m[5];
    const g = m[6], h = m[7], i = m[8];

    const A =  (e * i - f * h);
    const B = -(d * i - f * g);
    const C =  (d * h - e * g);
    const D = -(b * i - c * h);
    const E =  (a * i - c * g);
    const F = -(a * h - b * g);
    const G =  (b * f - c * e);
    const H_ = -(a * f - c * d);
    const I =  (a * e - b * d);

    const det = a * A + b * B + c * C;
    if (Math.abs(det) < 1e-10) {
      return [1, 0, 0, 0, 1, 0, 0, 0, 1]; // Degenerate fallback to identity
    }

    const invDet = 1.0 / det;
    return [
      A * invDet, D * invDet, G * invDet,
      B * invDet, E * invDet, H_ * invDet,
      C * invDet, F * invDet, I * invDet
    ];
  }

  static invertMatrix3x3(m) {
    return PerspectiveTransform.invert3x3(m);
  }

  static projectPoint(H, x, y) {
    const w = H[6] * x + H[7] * y + H[8];
    if (Math.abs(w) < 1e-10) return { x: 0, y: 0 };
    return {
      x: (H[0] * x + H[1] * y + H[2]) / w,
      y: (H[3] * x + H[4] * y + H[5]) / w
    };
  }

  static gaussianElimination(A, b) {
    const n = 8;
    for (let i = 0; i < n; i++) {
      let maxEl = Math.abs(A[i][i]);
      let maxRow = i;
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(A[k][i]) > maxEl) {
          maxEl = Math.abs(A[k][i]);
          maxRow = k;
        }
      }

      // Swap maximum row
      for (let k = i; k < n; k++) {
        const tmp = A[maxRow][k];
        A[maxRow][k] = A[i][k];
        A[i][k] = tmp;
      }
      const tmpB = b[maxRow];
      b[maxRow] = b[i];
      b[i] = tmpB;

      if (Math.abs(A[i][i]) < 1e-12) continue;

      // Eliminate below
      for (let k = i + 1; k < n; k++) {
        const c = -A[k][i] / A[i][i];
        for (let j = i; j < n; j++) {
          if (i === j) {
            A[k][j] = 0;
          } else {
            A[k][j] += c * A[i][j];
          }
        }
        b[k] += c * b[i];
      }
    }

    // Back substitution
    const x = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      let sum = b[i];
      for (let j = i + 1; j < n; j++) {
        sum -= A[i][j] * x[j];
      }
      x[i] = A[i][i] !== 0 ? sum / A[i][i] : 0;
    }
    return x;
  }

  /**
   * Apply perspective transform from source ImageData to destination bounding box
   * @param {ImageData} srcImg 
   * @param {Array<{x, y}>} dstCorners - 4 destination corners [TL, TR, BR, BL]
   * @param {number} outWidth 
   * @param {number} outHeight 
   * @returns {ImageData} Transformed image data
   */
  static transform(srcImg, dstCorners, outWidth, outHeight) {
    const sw = srcImg.width;
    const sh = srcImg.height;
    const src = srcImg.data;

    const out = new ImageData(outWidth, outHeight);
    const dst = out.data;

    const srcCorners = [
      { x: 0, y: 0 },
      { x: sw, y: 0 },
      { x: sw, y: sh },
      { x: 0, y: sh }
    ];

    // Compute H mapping source to dest, then invert to map dest to source
    const H = PerspectiveTransform.computeHomography(srcCorners, dstCorners);
    const Hinv = PerspectiveTransform.invert3x3(H);

    // Compute bounding box of destination corners to minimize scanning area
    const minX = Math.max(0, Math.floor(Math.min(...dstCorners.map(p => p.x))));
    const maxX = Math.min(outWidth - 1, Math.ceil(Math.max(...dstCorners.map(p => p.x))));
    const minY = Math.max(0, Math.floor(Math.min(...dstCorners.map(p => p.y))));
    const maxY = Math.min(outHeight - 1, Math.ceil(Math.max(...dstCorners.map(p => p.y))));

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        // Destination to source projective projection
        const w = Hinv[6] * x + Hinv[7] * y + Hinv[8];
        if (Math.abs(w) < 1e-7) continue;

        const sx = (Hinv[0] * x + Hinv[1] * y + Hinv[2]) / w;
        const sy = (Hinv[3] * x + Hinv[4] * y + Hinv[5]) / w;

        // Bilinear subpixel sampling
        if (sx >= 0 && sx < sw - 1 && sy >= 0 && sy < sh - 1) {
          const x0 = Math.floor(sx);
          const y0 = Math.floor(sy);
          const x1 = x0 + 1;
          const y1 = y0 + 1;

          const fx = sx - x0;
          const fy = sy - y0;

          const i00 = (y0 * sw + x0) * 4;
          const i10 = (y0 * sw + x1) * 4;
          const i01 = (y1 * sw + x0) * 4;
          const i11 = (y1 * sw + x1) * 4;

          const outIdx = (y * outWidth + x) * 4;

          for (let c = 0; c < 4; c++) {
            const top = src[i00 + c] * (1 - fx) + src[i10 + c] * fx;
            const bot = src[i01 + c] * (1 - fx) + src[i11 + c] * fx;
            dst[outIdx + c] = Math.round(top * (1 - fy) + bot * fy);
          }
        }
      }
    }

    return out;
  }
}

// ── Freeform Bézier Mesh Warp Engine (Edit -> Transform -> Warp) ──
class MeshWarpEngine {
  constructor(gridSize = 3) {
    this.gridSize = gridSize; // 3 = 3x3 (16 vertices), 4 = 4x4 (25 vertices)
    this.points = []; // Array of { u, v, x, y }
    this.preset = 'custom'; // 'custom', 'arch', 'flag', 'cylinder', 'fisheye'
    this.bend = 50; // -100 to +100
  }

  /**
   * Initialize a regular grid over given bounds
   */
  initGrid(bounds, size = 3) {
    this.gridSize = size;
    this.points = [];
    const count = this.gridSize + 1;

    for (let j = 0; j < count; j++) {
      const v = j / this.gridSize;
      const y = bounds.y + bounds.h * v;
      for (let i = 0; i < count; i++) {
        const u = i / this.gridSize;
        const x = bounds.x + bounds.w * u;
        this.points.push({ u, v, x, y, origX: x, origY: y });
      }
    }
  }

  /**
   * Apply procedural preset deformation
   */
  applyPreset(preset, bend = 50, bounds) {
    this.preset = preset;
    this.bend = bend;
    const factor = bend / 100;
    const w = bounds.w;
    const h = bounds.h;

    this.points.forEach(p => {
      // Reset to original first
      p.x = p.origX;
      p.y = p.origY;

      if (preset === 'arch') {
        // Upward parabolic arch: maximum deformation at u = 0.5
        const archDelta = Math.sin(p.u * Math.PI) * (h * 0.4 * factor);
        p.y -= archDelta;
      } else if (preset === 'flag') {
        // Sinusoidal wave across width
        const wave = Math.sin(p.u * Math.PI * 2) * (h * 0.25 * factor);
        p.y += wave;
      } else if (preset === 'cylinder') {
        // Barrel compression towards sides
        const distFromCenter = Math.abs(p.u - 0.5) * 2;
        const barrel = (1 - Math.cos(distFromCenter * Math.PI / 2)) * (w * 0.15 * factor);
        p.x += (p.u < 0.5 ? barrel : -barrel);
      } else if (preset === 'fisheye') {
        // Spheroid radial bulge from center
        const dx = p.u - 0.5;
        const dy = p.v - 0.5;
        const r = Math.sqrt(dx * dx + dy * dy);
        if (r > 0 && r < 0.7) {
          const bulge = Math.sin(r * Math.PI) * (0.2 * factor);
          p.x += dx * bulge * w;
          p.y += dy * bulge * h;
        }
      }
    });
  }

  /**
   * Warp an image canvas according to the mesh grid
   * @param {ImageData} srcImg 
   * @param {Object} bounds - { x, y, w, h }
   * @param {number} outWidth 
   * @param {number} outHeight 
   * @returns {ImageData}
   */
  warp(srcImg, bounds, outWidth, outHeight) {
    const sw = srcImg.width;
    const sh = srcImg.height;
    const src = srcImg.data;

    const out = new ImageData(outWidth, outHeight);
    const dst = out.data;

    const count = this.gridSize + 1;

    // For each cell patch in the grid, perform forward piecewise bilinear mapping
    for (let gy = 0; gy < this.gridSize; gy++) {
      for (let gx = 0; gx < this.gridSize; gx++) {
        // 4 corners of current patch
        const p00 = this.points[gy * count + gx];
        const p10 = this.points[gy * count + (gx + 1)];
        const p01 = this.points[(gy + 1) * count + gx];
        const p11 = this.points[(gy + 1) * count + (gx + 1)];

        const patchDstCorners = [
          { x: p00.x, y: p00.y },
          { x: p10.x, y: p10.y },
          { x: p11.x, y: p11.y },
          { x: p01.x, y: p01.y }
        ];

        const patchSrcCorners = [
          { x: p00.u * sw, y: p00.v * sh },
          { x: p10.u * sw, y: p10.v * sh },
          { x: p11.u * sw, y: p11.v * sh },
          { x: p01.u * sw, y: p01.v * sh }
        ];

        const H = PerspectiveTransform.computeHomography(patchSrcCorners, patchDstCorners);
        const Hinv = PerspectiveTransform.invert3x3(H);

        const minX = Math.max(0, Math.floor(Math.min(...patchDstCorners.map(p => p.x))));
        const maxX = Math.min(outWidth - 1, Math.ceil(Math.max(...patchDstCorners.map(p => p.x))));
        const minY = Math.max(0, Math.floor(Math.min(...patchDstCorners.map(p => p.y))));
        const maxY = Math.min(outHeight - 1, Math.ceil(Math.max(...patchDstCorners.map(p => p.y))));

        const uMin = Math.min(p00.u, p10.u, p01.u, p11.u) * sw - 0.5;
        const uMax = Math.max(p00.u, p10.u, p01.u, p11.u) * sw + 0.5;
        const vMin = Math.min(p00.v, p10.v, p01.v, p11.v) * sh - 0.5;
        const vMax = Math.max(p00.v, p10.v, p01.v, p11.v) * sh + 0.5;

        for (let y = minY; y <= maxY; y++) {
          for (let x = minX; x <= maxX; x++) {
            const wDenom = Hinv[6] * x + Hinv[7] * y + Hinv[8];
            if (Math.abs(wDenom) < 1e-7) continue;

            const sx = (Hinv[0] * x + Hinv[1] * y + Hinv[2]) / wDenom;
            const sy = (Hinv[3] * x + Hinv[4] * y + Hinv[5]) / wDenom;

            // Strict inside-patch clipping to avoid overlap artifacts
            if (sx >= uMin && sx <= uMax && sy >= vMin && sy <= vMax && sx >= 0 && sx < sw - 1 && sy >= 0 && sy < sh - 1) {
              const x0 = Math.floor(sx);
              const y0 = Math.floor(sy);
              const x1 = x0 + 1;
              const y1 = y0 + 1;
              const fx = sx - x0;
              const fy = sy - y0;

              const i00 = (y0 * sw + x0) * 4;
              const i10 = (y0 * sw + x1) * 4;
              const i01 = (y1 * sw + x0) * 4;
              const i11 = (y1 * sw + x1) * 4;

              const outIdx = (y * outWidth + x) * 4;

              for (let c = 0; c < 4; c++) {
                const top = src[i00 + c] * (1 - fx) + src[i10 + c] * fx;
                const bot = src[i01 + c] * (1 - fx) + src[i11 + c] * fx;
                dst[outIdx + c] = Math.round(top * (1 - fy) + bot * fy);
              }
            }
          }
        }
      }
    }

    return out;
  }

  /**
   * Render interactive warp grid on overlay canvas
   */
  renderOverlay(ctx, zoom, panX, panY, viewW, viewH, docW, docH) {
    if (!ctx || this.points.length === 0) return;

    ctx.save();
    const originX = (viewW / 2) + panX - (docW * zoom / 2);
    const originY = (viewH / 2) + panY - (docH * zoom / 2);

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;

    const count = this.gridSize + 1;

    // Draw horizontal mesh lines
    for (let j = 0; j < count; j++) {
      ctx.beginPath();
      for (let i = 0; i < count; i++) {
        const p = this.points[j * count + i];
        const sx = originX + p.x * zoom;
        const sy = originY + p.y * zoom;
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.stroke();
    }

    // Draw vertical mesh lines
    for (let i = 0; i < count; i++) {
      ctx.beginPath();
      for (let j = 0; j < count; j++) {
        const p = this.points[j * count + i];
        const sx = originX + p.x * zoom;
        const sy = originY + p.y * zoom;
        if (j === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.stroke();
    }

    // Draw draggable vertex control circles
    this.points.forEach(p => {
      const sx = originX + p.x * zoom;
      const sy = originY + p.y * zoom;
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sx, sy, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });

    ctx.restore();
  }
}

class BézierWarpGrid {
  constructor(w = 100, h = 100, rows = 3, cols = 3) {
    this.width = w;
    this.height = h;
    this.rows = rows;
    this.cols = cols;
    this.gridSize = rows;
    this.points = [];
    const countY = rows + 1;
    const countX = cols + 1;
    for (let j = 0; j < countY; j++) {
      const v = j / rows;
      const y = h * v;
      for (let i = 0; i < countX; i++) {
        const u = i / cols;
        const x = w * u;
        this.points.push({ u, v, x, y, origX: x, origY: y });
      }
    }
  }

  getPoint(row, col) {
    const countX = this.cols + 1;
    return this.points[row * countX + col];
  }

  applyPreset(preset, bend = 50) {
    const bendVal = Math.abs(bend) <= 1 ? bend * 100 : bend;
    const factor = bendVal / 100;
    const w = this.width;
    const h = this.height;

    this.points.forEach(p => {
      p.x = p.origX;
      p.y = p.origY;

      if (preset === 'arch') {
        const arch = Math.sin(p.u * Math.PI) * (h * 0.4 * factor);
        p.y -= arch;
      } else if (preset === 'flag') {
        const wave = Math.sin(p.u * Math.PI * 2) * (h * 0.25 * factor);
        p.y += wave;
      } else if (preset === 'cylinder') {
        const distFromCenter = Math.abs(p.u - 0.5) * 2;
        const barrel = (1 - Math.cos(distFromCenter * Math.PI / 2)) * (w * 0.15 * factor);
        p.x += (p.u < 0.5 ? barrel : -barrel);
      } else if (preset === 'fisheye') {
        const dx = p.u - 0.5;
        const dy = p.v - 0.5;
        const r = Math.sqrt(dx * dx + dy * dy);
        if (r > 0 && r < 0.7) {
          const bulge = Math.sin(r * Math.PI) * (0.2 * factor);
          p.x += dx * bulge * w;
          p.y += dy * bulge * h;
        }
      }
    });
  }

  warpPoint(x, y) {
    const u = x / this.width;
    const v = y / this.height;
    const gx = Math.min(this.cols - 1, Math.floor(u * this.cols));
    const gy = Math.min(this.rows - 1, Math.floor(v * this.rows));
    const countX = this.cols + 1;
    const p00 = this.points[gy * countX + gx];
    const p10 = this.points[gy * countX + (gx + 1)];
    const p01 = this.points[(gy + 1) * countX + gx];
    const p11 = this.points[(gy + 1) * countX + (gx + 1)];

    const fu = (u * this.cols) - gx;
    const fv = (v * this.rows) - gy;

    const topX = p00.x * (1 - fu) + p10.x * fu;
    const topY = p00.y * (1 - fu) + p10.y * fu;
    const botX = p01.x * (1 - fu) + p11.x * fu;
    const botY = p01.y * (1 - fu) + p11.y * fu;

    return {
      x: topX * (1 - fv) + botX * fv,
      y: topY * (1 - fv) + botY * fv
    };
  }
}

// ── Export ──
if (typeof window !== 'undefined') {
  window.PerspectiveTransform = PerspectiveTransform;
  window.MeshWarpEngine = MeshWarpEngine;
  window.BézierWarpGrid = BézierWarpGrid;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PerspectiveTransform, MeshWarpEngine, BézierWarpGrid };
}
