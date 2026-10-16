/**
 * PixelForge Studio Pro — Perspective Warp Engine (Photoshop Parity)
 * 
 * Implements two-phase Perspective Warp (Edit -> Perspective Warp):
 * 1. Layout Mode:
 *    - Define 1 or more independent or connected quadrilateral grids over 3D planar surfaces.
 *    - Corner and edge snapping: Adjacent quads automatically snap together along shared hinge edges.
 * 2. Warp Mode:
 *    - Interactive manipulation of quad corner pins.
 *    - Solves 3x3 projective homography matrix H_k for each planar quad.
 *    - Preserves coplanar surface continuity across shared hinge edges.
 *    - Backward inverse mapping with sub-pixel bilinear interpolation for seamless raster fidelity.
 */

class PerspectiveQuad {
  constructor(id, corners = null) {
    this.id = id;
    // Default 4 corners [TL, TR, BR, BL]
    this.corners = corners ? corners.map(c => ({ ...c })) : [
      { x: 100, y: 100 },
      { x: 300, y: 100 },
      { x: 300, y: 300 },
      { x: 100, y: 300 }
    ];
    this.initialCorners = this.corners.map(c => ({ ...c }));
    this.subdivisions = 4;
  }

  getBounds() {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    this.corners.forEach(c => {
      minX = Math.min(minX, c.x);
      minY = Math.min(minY, c.y);
      maxX = Math.max(maxX, c.x);
      maxY = Math.max(maxY, c.y);
    });
    return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
  }

  containsPoint(px, py) {
    // Standard point-in-polygon ray-casting test for convex/concave quad
    const pts = this.corners;
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i].x, yi = pts[i].y;
      const xj = pts[j].x, yj = pts[j].y;
      const intersect = ((yi > py) !== (yj > py)) &&
        (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }
}

class PerspectiveWarpEngine {
  constructor() {
    this.mode = 'layout'; // 'layout' or 'warp'
    this.quads = [];
    this.selectedQuad = null;
    this.activePin = null; // { quadId, cornerIdx } or shared reference
    this.snapThreshold = 16;
  }

  /**
   * Resets the engine
   */
  reset() {
    this.mode = 'layout';
    this.quads = [];
    this.selectedQuad = null;
    this.activePin = null;
  }

  /**
   * Adds a new planar quadrilateral to the layout
   * @param {Array<{x, y}>} [corners]
   * @returns {PerspectiveQuad}
   */
  addQuad(corners = null) {
    const id = 'quad_' + (this.quads.length + 1);
    const q = new PerspectiveQuad(id, corners);
    this.quads.push(q);
    this.selectedQuad = q;
    return q;
  }

  /**
   * Snaps adjacent corner pins together if within threshold distance
   */
  snapAdjacentPins() {
    const snapDistSq = this.snapThreshold * this.snapThreshold;

    for (let i = 0; i < this.quads.length; i++) {
      for (let j = i + 1; j < this.quads.length; j++) {
        const qA = this.quads[i];
        const qB = this.quads[j];

        for (let ca = 0; ca < 4; ca++) {
          for (let cb = 0; cb < 4; cb++) {
            const pA = qA.corners[ca];
            const pB = qB.corners[cb];
            const distSq = (pA.x - pB.x) ** 2 + (pA.y - pB.y) ** 2;

            if (distSq <= snapDistSq) {
              // Snap corner B to corner A
              pB.x = pA.x;
              pB.y = pA.y;
              qB.initialCorners[cb].x = qA.initialCorners[ca].x;
              qB.initialCorners[cb].y = qA.initialCorners[ca].y;
            }
          }
        }
      }
    }
  }

  /**
   * Moves a pin at (cornerIdx) on quad, propagating movement to snapped co-located pins
   */
  movePin(quadId, cornerIdx, newX, newY) {
    const q = this.quads.find(q => q.id === quadId);
    if (!q) return;

    const oldX = q.corners[cornerIdx].x;
    const oldY = q.corners[cornerIdx].y;
    const dx = newX - oldX;
    const dy = newY - oldY;

    // Move target corner
    q.corners[cornerIdx].x = newX;
    q.corners[cornerIdx].y = newY;

    // Propagate to any other quads sharing this exact point
    this.quads.forEach(otherQ => {
      if (otherQ.id === quadId) return;
      otherQ.corners.forEach((c, idx) => {
        if (Math.abs(c.x - oldX) < 1e-4 && Math.abs(c.y - oldY) < 1e-4) {
          c.x = newX;
          c.y = newY;
        }
      });
    });
  }

  /**
   * Switches to 'warp' mode and snapshots layout geometry
   */
  enterWarpMode() {
    this.snapAdjacentPins();
    this.quads.forEach(q => {
      q.initialCorners = q.corners.map(c => ({ ...c }));
    });
    this.mode = 'warp';
  }

  /**
   * Switches back to 'layout' mode
   */
  enterLayoutMode() {
    this.mode = 'layout';
  }

  /**
   * Solves 3x3 Projective Homography Matrix mapping srcQuad to dstQuad
   * using 8-DOF Direct Linear Transformation (DLT)
   */
  static solveHomography(srcQuad, dstQuad) {
    const A = [];
    const b = [];

    for (let i = 0; i < 4; i++) {
      const sx = srcQuad[i].x, sy = srcQuad[i].y;
      const dx = dstQuad[i].x, dy = dstQuad[i].y;

      A.push([sx, sy, 1, 0, 0, 0, -dx * sx, -dx * sy]);
      b.push(dx);
      A.push([0, 0, 0, sx, sy, 1, -dy * sx, -dy * sy]);
      b.push(dy);
    }

    // 8x8 Gaussian elimination
    const h = PerspectiveWarpEngine.gaussianElimination(A, b);
    return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1.0];
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
      for (let k = i; k < n; k++) {
        const tmp = A[maxRow][k];
        A[maxRow][k] = A[i][k];
        A[i][k] = tmp;
      }
      const tmp = b[maxRow];
      b[maxRow] = b[i];
      b[i] = tmp;

      for (let k = i + 1; k < n; k++) {
        const c = -A[k][i] / (A[i][i] || 1e-12);
        for (let j = i; j < n; j++) {
          if (i === j) A[k][j] = 0;
          else A[k][j] += c * A[i][j];
        }
        b[k] += c * b[i];
      }
    }

    const x = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      let sum = b[i];
      for (let j = i + 1; j < n; j++) {
        sum -= A[i][j] * x[j];
      }
      x[i] = sum / (A[i][i] || 1e-12);
    }
    return x;
  }

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
    if (Math.abs(det) < 1e-12) return null;
    const invDet = 1.0 / det;

    return [
      A * invDet, D * invDet, G * invDet,
      B * invDet, E * invDet, H_ * invDet,
      C * invDet, F * invDet, I * invDet
    ];
  }

  /**
   * Applies the piecewise homography transformations across all defined quads
   * @param {ImageData} srcData 
   * @returns {ImageData} Warped output
   */
  applyWarp(srcData) {
    if (!this.quads.length) return srcData;

    const { width: w, height: h, data: src } = srcData;
    const outData = new Uint8ClampedArray(w * h * 4);
    // Copy base image
    outData.set(src);

    this.quads.forEach(quad => {
      const srcQuad = quad.initialCorners;
      const dstQuad = quad.corners;

      // H maps source layout quad to target warped quad
      const H = PerspectiveWarpEngine.solveHomography(srcQuad, dstQuad);
      // Inverse H^-1 maps output pixels back to source layout pixels
      const invH = PerspectiveWarpEngine.invert3x3(H);
      if (!invH) return;

      const bounds = quad.getBounds();
      const minX = Math.max(0, Math.floor(bounds.minX));
      const maxX = Math.min(w - 1, Math.ceil(bounds.maxX));
      const minY = Math.max(0, Math.floor(bounds.minY));
      const maxY = Math.min(h - 1, Math.ceil(bounds.maxY));

      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          if (!quad.containsPoint(x, y)) continue;

          // Backward projective projection: [sx, sy, sw] = invH * [x, y, 1]
          const sw = invH[6] * x + invH[7] * y + invH[8];
          if (Math.abs(sw) < 1e-12) continue;

          const sx = (invH[0] * x + invH[1] * y + invH[2]) / sw;
          const sy = (invH[3] * x + invH[4] * y + invH[5]) / sw;

          // Bilinear interpolation in source image
          if (sx >= 0 && sx < w - 1 && sy >= 0 && sy < h - 1) {
            const x0 = Math.floor(sx), y0 = Math.floor(sy);
            const x1 = x0 + 1, y1 = y0 + 1;
            const dx = sx - x0, dy = sy - y0;

            const i00 = (y0 * w + x0) * 4;
            const i10 = (y0 * w + x1) * 4;
            const i01 = (y1 * w + x0) * 4;
            const i11 = (y1 * w + x1) * 4;

            const outIdx = (y * w + x) * 4;
            for (let c = 0; c < 4; c++) {
              const val = (1 - dx) * (1 - dy) * src[i00 + c] +
                          dx * (1 - dy) * src[i10 + c] +
                          (1 - dx) * dy * src[i01 + c] +
                          dx * dy * src[i11 + c];
              outData[outIdx + c] = Math.round(val);
            }
          }
        }
      }
    });

    return new ImageData(outData, w, h);
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PerspectiveQuad, PerspectiveWarpEngine };
}
