/**
 * PixelForge Studio - Split Mesh Warp Engine with Custom Subdivisions (Phase 14)
 * Advanced mesh deformation with arbitrary horizontal/vertical grid line insertion
 * and 3x3, 4x4, 5x5, 8x8 subdivisions (Photoshop 2024 Split Warp Parity).
 */

(function (global) {
  'use strict';

  class SplitWarpEngine {
    constructor(width = 1000, height = 1000) {
      this.width = width;
      this.height = height;
      this.rows = 3; // number of cell rows (rows + 1 point rows)
      this.cols = 3; // number of cell cols (cols + 1 point cols)
      this.active = false;
      this.points = []; // 2D array of control points [row][col] -> { x, y, origX, origY }
      this.selectedPoint = null;

      this.initGrid(3, 3);
    }

    /**
     * Initialize grid with specific number of rows and columns
     */
    initGrid(cellRows = 3, cellCols = 3) {
      this.rows = cellRows;
      this.cols = cellCols;
      this.points = [];

      for (let r = 0; r <= this.rows; r++) {
        const row = [];
        const normY = r / this.rows;
        const y = normY * this.height;

        for (let c = 0; c <= this.cols; c++) {
          const normX = c / this.cols;
          const x = normX * this.width;

          row.push({
            x,
            y,
            origX: x,
            origY: y,
            normX,
            normY
          });
        }
        this.points.push(row);
      }
    }

    /**
     * Insert a custom horizontal grid line at normalized coordinate yNorm (0.0 to 1.0)
     */
    splitHorizontal(yNorm) {
      if (yNorm <= 0.05 || yNorm >= 0.95) return false;

      // Find insertion index
      let insertIdx = -1;
      for (let r = 0; r < this.points.length - 1; r++) {
        const currY = this.points[r][0].normY;
        const nextY = this.points[r + 1][0].normY;
        if (yNorm > currY && yNorm < nextY) {
          insertIdx = r + 1;
          break;
        }
      }

      if (insertIdx === -1) return false;

      const prevRow = this.points[insertIdx - 1];
      const nextRow = this.points[insertIdx];
      const t = (yNorm - prevRow[0].normY) / (nextRow[0].normY - prevRow[0].normY);

      const newRow = [];
      for (let c = 0; c <= this.cols; c++) {
        const p1 = prevRow[c];
        const p2 = nextRow[c];

        // Linear interpolation of position & original coords
        const x = p1.x + (p2.x - p1.x) * t;
        const y = p1.y + (p2.y - p1.y) * t;
        const origX = p1.origX + (p2.origX - p1.origX) * t;
        const origY = p1.origY + (p2.origY - p1.origY) * t;

        newRow.push({
          x,
          y,
          origX,
          origY,
          normX: p1.normX,
          normY: yNorm
        });
      }

      this.points.splice(insertIdx, 0, newRow);
      this.rows++;
      return true;
    }

    /**
     * Insert a custom vertical grid line at normalized coordinate xNorm (0.0 to 1.0)
     */
    splitVertical(xNorm) {
      if (xNorm <= 0.05 || xNorm >= 0.95) return false;

      // Find insertion column
      let insertIdx = -1;
      for (let c = 0; c < this.cols; c++) {
        const currX = this.points[0][c].normX;
        const nextX = this.points[0][c + 1].normX;
        if (xNorm > currX && xNorm < nextX) {
          insertIdx = c + 1;
          break;
        }
      }

      if (insertIdx === -1) return false;

      for (let r = 0; r <= this.rows; r++) {
        const p1 = this.points[r][insertIdx - 1];
        const p2 = this.points[r][insertIdx];
        const t = (xNorm - p1.normX) / (p2.normX - p1.normX);

        const x = p1.x + (p2.x - p1.x) * t;
        const y = p1.y + (p2.y - p1.y) * t;
        const origX = p1.origX + (p2.origX - p1.origX) * t;
        const origY = p1.origY + (p2.origY - p1.origY) * t;

        this.points[r].splice(insertIdx, 0, {
          x,
          y,
          origX,
          origY,
          normX: xNorm,
          normY: p1.normY
        });
      }

      this.cols++;
      return true;
    }

    /**
     * Split grid both horizontally and vertically at point (x, y)
     */
    splitCross(x, y) {
      const normX = Math.max(0.05, Math.min(0.95, x / this.width));
      const normY = Math.max(0.05, Math.min(0.95, y / this.height));
      const okH = this.splitHorizontal(normY);
      const okV = this.splitVertical(normX);
      return okH || okV;
    }

    /**
     * Find nearest control point to coordinate
     */
    hitTest(x, y, radius = 15) {
      let closest = null;
      let minDst = radius * radius;

      for (let r = 0; r <= this.rows; r++) {
        for (let c = 0; c <= this.cols; c++) {
          const pt = this.points[r][c];
          const dx = pt.x - x;
          const dy = pt.y - y;
          const d2 = dx * dx + dy * dy;
          if (d2 <= minDst) {
            minDst = d2;
            closest = { row: r, col: c, point: pt };
          }
        }
      }
      return closest;
    }

    /**
     * Render grid overlay and control handles
     */
    renderOverlay(ctx) {
      if (!ctx || this.points.length === 0) return;

      ctx.save();
      ctx.strokeStyle = '#38bdf8'; // Electric cyan
      ctx.lineWidth = 1;

      // Draw horizontal lines
      for (let r = 0; r <= this.rows; r++) {
        ctx.beginPath();
        for (let c = 0; c <= this.cols; c++) {
          const pt = this.points[r][c];
          if (c === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();
      }

      // Draw vertical lines
      for (let c = 0; c <= this.cols; c++) {
        ctx.beginPath();
        for (let r = 0; r <= this.rows; r++) {
          const pt = this.points[r][c];
          if (r === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();
      }

      // Draw control point handles
      for (let r = 0; r <= this.rows; r++) {
        for (let c = 0; c <= this.cols; c++) {
          const pt = this.points[r][c];
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = '#0284c7';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      }

      ctx.restore();
    }
  }

  // Export
  global.SplitWarpEngine = SplitWarpEngine;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SplitWarpEngine };
  }
})(typeof window !== 'undefined' ? window : globalThis);
