/**
 * PixelForge Studio - Dynamic Brush Symmetry & Mandala Painting Engine (Phase 14)
 * Real-time stroke reflection and rotation across symmetry axes:
 * Vertical, Horizontal, Dual Axis, Diagonal, Radial (2-12 segments), and Mandala.
 */

(function (global) {
  'use strict';

  class SymmetryEngine {
    constructor(canvasWidth = 1000, canvasHeight = 1000) {
      this.enabled = false;
      this.mode = 'vertical'; // 'vertical', 'horizontal', 'dual_axis', 'diagonal', 'radial', 'mandala'
      this.segments = 8; // for radial and mandala (2 to 12)
      this.centerX = canvasWidth / 2;
      this.centerY = canvasHeight / 2;
      this.angle = 0; // rotation angle of symmetry axis in radians
    }

    setCanvasDimensions(width, height) {
      // Re-center if default
      if (this.centerX === 0 && this.centerY === 0) {
        this.centerX = width / 2;
        this.centerY = height / 2;
      }
    }

    setPivot(cx, cy) {
      this.centerX = cx;
      this.centerY = cy;
    }

    setMode(mode, segments = 8) {
      this.mode = mode;
      this.segments = Math.max(2, Math.min(16, segments));
    }

    /**
     * Compute all symmetric stroke points for an input coordinate (x, y)
     * Returns array of points: [{ x, y }, ...]
     */
    getSymmetricPoints(x, y) {
      if (!this.enabled) {
        return [{ x, y }];
      }

      const points = [];
      const cx = this.centerX;
      const cy = this.centerY;

      // Translate to pivot origin
      let dx = x - cx;
      let dy = y - cy;

      // Pre-rotate if axis angle is non-zero
      if (this.angle !== 0) {
        const cosA = Math.cos(-this.angle);
        const sinA = Math.sin(-this.angle);
        const rx = dx * cosA - dy * sinA;
        const ry = dx * sinA + dy * cosA;
        dx = rx;
        dy = ry;
      }

      const addPoint = (px, py) => {
        // Un-rotate if needed
        let fx = px;
        let fy = py;
        if (this.angle !== 0) {
          const cosA = Math.cos(this.angle);
          const sinA = Math.sin(this.angle);
          fx = px * cosA - py * sinA;
          fy = px * sinA + py * cosA;
        }
        points.push({
          x: Math.round(fx + cx),
          y: Math.round(fy + cy)
        });
      };

      // Always include original point
      addPoint(dx, dy);

      switch (this.mode) {
        case 'vertical':
          // Mirror across Y-axis
          addPoint(-dx, dy);
          break;

        case 'horizontal':
          // Mirror across X-axis
          addPoint(dx, -dy);
          break;

        case 'dual_axis':
          // 4-way mirror
          addPoint(-dx, dy);
          addPoint(dx, -dy);
          addPoint(-dx, -dy);
          break;

        case 'diagonal':
          // 45-degree reflection
          addPoint(dy, dx);
          break;

        case 'radial':
          // N-fold rotational symmetry without bilateral reflection
          const stepAngle = (Math.PI * 2) / this.segments;
          for (let i = 1; i < this.segments; i++) {
            const a = stepAngle * i;
            const cos = Math.cos(a);
            const sin = Math.sin(a);
            const rx = dx * cos - dy * sin;
            const ry = dx * sin + dy * cos;
            addPoint(rx, ry);
          }
          break;

        case 'mandala':
          // N-fold rotational symmetry WITH bilateral reflection in each sector
          const mandalaStep = (Math.PI * 2) / this.segments;
          for (let i = 0; i < this.segments; i++) {
            const a = mandalaStep * i;
            const cos = Math.cos(a);
            const sin = Math.sin(a);

            // Reflected dab in this sector (only for i > 0 if unrotated)
            if (i > 0) {
              const rx = dx * cos - dy * sin;
              const ry = dx * sin + dy * cos;
              addPoint(rx, ry);
            }

            // Bilateral reflection
            const refX = -dx;
            const refY = dy;
            const mx = refX * cos - refY * sin;
            const my = refX * sin + refY * cos;
            addPoint(mx, my);
          }
          break;
      }

      return points;
    }

    /**
     * Render the symmetry axes guide overlay on interactive overlay canvas
     */
    renderGuides(ctx, width, height) {
      if (!this.enabled || !ctx) return;

      ctx.save();
      ctx.strokeStyle = '#38bdf8'; // Electric cyan
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);

      const cx = this.centerX;
      const cy = this.centerY;

      ctx.translate(cx, cy);
      if (this.angle !== 0) {
        ctx.rotate(this.angle);
      }

      const maxDim = Math.max(width, height) * 2;

      ctx.beginPath();
      if (this.mode === 'vertical' || this.mode === 'dual_axis') {
        ctx.moveTo(0, -maxDim);
        ctx.lineTo(0, maxDim);
      }
      if (this.mode === 'horizontal' || this.mode === 'dual_axis') {
        ctx.moveTo(-maxDim, 0);
        ctx.lineTo(maxDim, 0);
      }
      if (this.mode === 'diagonal') {
        ctx.moveTo(-maxDim, -maxDim);
        ctx.lineTo(maxDim, maxDim);
      }
      if (this.mode === 'radial' || this.mode === 'mandala') {
        const step = (Math.PI * 2) / this.segments;
        for (let i = 0; i < this.segments; i++) {
          const a = step * i;
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(a) * maxDim, Math.sin(a) * maxDim);
        }
      }
      ctx.stroke();

      // Draw center pivot indicator
      ctx.setLineDash([]);
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  // Export
  global.SymmetryEngine = SymmetryEngine;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SymmetryEngine };
  }
})(typeof window !== 'undefined' ? window : globalThis);
