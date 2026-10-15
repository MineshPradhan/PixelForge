/**
 * PixelForge Studio Pro — Guides, Grid & Magnetic Snapping Engine
 *
 * Implements:
 *  1. GuideManager:
 *     - Horizontal and Vertical ruler guides
 *     - Drag-out from Top & Left rulers into document space
 *     - Guide lock (Ctrl+Alt+;), Guide visibility toggle (Ctrl+;), Guide clear
 *     - Document Grid (Ctrl+') with customizable spacing and color
 *  2. SnappingEngine:
 *     - Magnetic snapping to canvas edges (0, W, H), center axes (W/2, H/2)
 *     - Magnetic snapping to user ruler guides
 *     - Magnetic snapping to other visible layer boundaries & center points
 *     - Smart Guide visual alignment overlay lines (magenta #ff007f / #ec4899)
 *     - Equidistant distribution spacing hints
 */

class GuideManager {
  constructor(app = null) {
    this.app = app;
    this.guides = []; // Array<{ id, type: 'h'|'v', pos: number }>
    this.showGuides = true;
    this.lockGuides = false;
    this.showGrid = false;
    this.gridSize = 20; // 20px default grid cells
    this.gridSubdivisions = 4;
    this.snapToGuides = true;
    this.snapToGrid = false;
    this.snapToLayers = true;
    this.snapToCanvas = true;
    this.snapThreshold = 8; // Screen pixels threshold for magnetic attraction

    // Active dragging state
    this.draggedGuide = null;
    this.isCreatingFromRuler = false;
  }

  get locked() {
    return this.lockGuides;
  }

  // ── Guide CRUD ──
  addGuide(type, pos) {
    if (this.lockGuides) return null;
    const isH = type === 'horizontal' || type === 'h';
    const guide = {
      id: 'guide_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      type: isH ? 'h' : 'v',
      orientation: isH ? 'horizontal' : 'vertical',
      pos: Math.round(pos),
      position: Math.round(pos)
    };
    this.guides.push(guide);
    return guide;
  }

  toJSON() {
    return {
      guides: this.guides.map(g => ({ ...g })),
      locked: this.lockGuides,
      showGuides: this.showGuides,
      showGrid: this.showGrid
    };
  }

  loadJSON(data) {
    if (!data) return;
    this.guides = (data.guides || []).map(g => ({
      ...g,
      orientation: g.orientation || (g.type === 'h' ? 'horizontal' : 'vertical'),
      position: g.position !== undefined ? g.position : g.pos
    }));
    if (data.locked !== undefined) this.lockGuides = data.locked;
    if (data.showGuides !== undefined) this.showGuides = data.showGuides;
    if (data.showGrid !== undefined) this.showGrid = data.showGrid;
  }

  removeGuide(id) {
    if (this.lockGuides) return false;
    const idx = this.guides.findIndex(g => g.id === id);
    if (idx !== -1) {
      this.guides.splice(idx, 1);
      return true;
    }
    return false;
  }

  clearGuides(force = false) {
    if (this.lockGuides && !force) return false;
    this.guides = [];
    return true;
  }

  toggleGuides() {
    this.showGuides = !this.showGuides;
    return this.showGuides;
  }

  toggleLock() {
    this.lockGuides = !this.lockGuides;
    return this.lockGuides;
  }

  toggleGrid() {
    this.showGrid = !this.showGrid;
    return this.showGrid;
  }

  // ── Renders Guides & Grid on Overlay Canvas ──
  renderOverlay(ctx, zoom, panX, panY, viewW, viewH, docW, docH) {
    if (!ctx) return;

    // 1. Render Document Grid if enabled
    if (this.showGrid && this.gridSize > 0) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1;

      const originX = (viewW / 2) + panX - (docW * zoom / 2);
      const originY = (viewH / 2) + panY - (docH * zoom / 2);
      const scaledGrid = this.gridSize * zoom;

      // Vertical grid lines
      for (let x = 0; x <= docW; x += this.gridSize) {
        const screenX = originX + x * zoom;
        if (screenX >= 0 && screenX <= viewW) {
          ctx.beginPath();
          ctx.moveTo(screenX, Math.max(0, originY));
          ctx.lineTo(screenX, Math.min(viewH, originY + docH * zoom));
          ctx.stroke();
        }
      }

      // Horizontal grid lines
      for (let y = 0; y <= docH; y += this.gridSize) {
        const screenY = originY + y * zoom;
        if (screenY >= 0 && screenY <= viewH) {
          ctx.beginPath();
          ctx.moveTo(Math.max(0, originX), screenY);
          ctx.lineTo(Math.min(viewW, originX + docW * zoom), screenY);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    // 2. Render Ruler Guides if enabled
    if (this.showGuides && this.guides.length > 0) {
      ctx.save();
      ctx.strokeStyle = '#00ffff'; // Standard Photoshop Cyan
      ctx.lineWidth = 1;

      const originX = (viewW / 2) + panX - (docW * zoom / 2);
      const originY = (viewH / 2) + panY - (docH * zoom / 2);

      this.guides.forEach(g => {
        if (g.type === 'h') {
          const sy = originY + g.pos * zoom;
          ctx.beginPath();
          ctx.moveTo(0, sy);
          ctx.lineTo(viewW, sy);
          ctx.stroke();
        } else {
          const sx = originX + g.pos * zoom;
          ctx.beginPath();
          ctx.moveTo(sx, 0);
          ctx.lineTo(sx, viewH);
          ctx.stroke();
        }
      });
      ctx.restore();
    }
  }

  // ── Serialization ──
  toJSON() {
    return {
      guides: this.guides.map(g => ({ ...g })),
      locked: this.lockGuides,
      lockGuides: this.lockGuides,
      showGuides: this.showGuides,
      showGrid: this.showGrid,
      gridSize: this.gridSize,
      snapToGuides: this.snapToGuides,
      snapToGrid: this.snapToGrid,
      snapToLayers: this.snapToLayers,
      snapToCanvas: this.snapToCanvas
    };
  }

  fromJSON(json) {
    if (!json) return;
    this.guides = (json.guides || []).map(g => ({
      ...g,
      orientation: g.orientation || (g.type === 'h' ? 'horizontal' : 'vertical'),
      position: g.position !== undefined ? g.position : g.pos
    }));
    if (json.locked !== undefined) this.lockGuides = json.locked;
    if (json.lockGuides !== undefined) this.lockGuides = json.lockGuides;
    if (json.showGuides !== undefined) this.showGuides = json.showGuides;
    if (json.showGrid !== undefined) this.showGrid = json.showGrid;
    if (json.gridSize !== undefined) this.gridSize = json.gridSize;
    if (json.snapToGuides !== undefined) this.snapToGuides = json.snapToGuides;
    if (json.snapToGrid !== undefined) this.snapToGrid = json.snapToGrid;
    if (json.snapToLayers !== undefined) this.snapToLayers = json.snapToLayers;
    if (json.snapToCanvas !== undefined) this.snapToCanvas = json.snapToCanvas;
  }

  loadJSON(json) {
    this.fromJSON(json);
  }
}

// ── Magnetic Smart Snapping Engine ──
class SnappingEngine {
  constructor(app = null, guideManager = null) {
    this.app = app;
    this.guideManager = guideManager;
    this.enabled = true;
    this.snapTolerance = 8;
    this.activeSmartGuides = [];
  }

  toggleSnapping() {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  clearSmartGuides() {
    this.activeSmartGuides = [];
  }

  snapPoint(x, y) {
    const docW = this.app ? (this.app.width || 1920) : 1920;
    const docH = this.app ? (this.app.height || 1080) : 1080;
    const zoom = this.app ? (this.app.zoom || 1.0) : 1.0;
    const tol = this.snapTolerance / zoom;
    const guides = this.guideManager ? this.guideManager.guides : [];

    let snappedX = false;
    let snappedY = false;
    let outX = x;
    let outY = y;

    guides.forEach(g => {
      const gPos = g.pos !== undefined ? g.pos : g.position;
      const isV = g.type === 'v' || g.orientation === 'vertical';
      if (isV && Math.abs(x - gPos) <= tol) {
        outX = gPos;
        snappedX = true;
      } else if (!isV && Math.abs(y - gPos) <= tol) {
        outY = gPos;
        snappedY = true;
      }
    });

    return { x: outX, y: outY, snappedX, snappedY };
  }

  snapBounds(bounds) {
    const docW = this.app ? (this.app.width || 1920) : 1920;
    const docH = this.app ? (this.app.height || 1080) : 1080;
    const zoom = this.app ? (this.app.zoom || 1.0) : 1.0;
    const context = {
      docW,
      docH,
      zoom,
      guides: this.guideManager ? this.guideManager.guides : [],
      layers: this.app && this.app.layerManager ? this.app.layerManager.layers : [],
      snapThreshold: this.snapTolerance
    };

    const res = SnappingEngine.snapBounds({
      x: bounds.x,
      y: bounds.y,
      w: bounds.width !== undefined ? bounds.width : bounds.w,
      h: bounds.height !== undefined ? bounds.height : bounds.h
    }, context);

    this.activeSmartGuides = res.snapLines || [];
    return {
      x: bounds.x + res.dx,
      y: bounds.y + res.dy,
      width: bounds.width !== undefined ? bounds.width : bounds.w,
      height: bounds.height !== undefined ? bounds.height : bounds.h,
      snappedX: res.hasSnapX,
      snappedY: res.hasSnapY,
      dx: res.dx,
      dy: res.dy,
      snapLines: res.snapLines
    };
  }

  /**
   * Calculate magnetic snap offsets for a moving or transforming bounding box
   * @param {Object} bounds - { x, y, w, h } Target box in document coordinates
   * @param {Object} context - { docW, docH, zoom, guides, layers, activeLayerId, snapThreshold }
   * @returns {Object} { snappedX, snappedY, dx, dy, snapLines: Array<{ x1, y1, x2, y2, type }> }
   */
  static snapBounds(bounds, context = {}) {
    const docW = context.docW || 1920;
    const docH = context.docH || 1080;
    const zoom = context.zoom || 1.0;
    const thresholdDoc = (context.snapThreshold || 8) / zoom; // convert screen px to doc px

    const targetLeft = bounds.x;
    const targetRight = bounds.x + bounds.w;
    const targetCenterX = bounds.x + bounds.w / 2;

    const targetTop = bounds.y;
    const targetBottom = bounds.y + bounds.h;
    const targetCenterY = bounds.y + bounds.h / 2;

    let bestDx = 0;
    let minDiffX = thresholdDoc + 1;
    let snappedLineX = null;

    let bestDy = 0;
    let minDiffY = thresholdDoc + 1;
    let snappedLineY = null;

    // Collect all candidate X & Y snap anchors
    const candidatesX = [];
    const candidatesY = [];

    // 1. Canvas Bounds & Center Snap
    if (context.snapToCanvas !== false) {
      candidatesX.push({ pos: 0, label: 'Canvas Left' });
      candidatesX.push({ pos: docW / 2, label: 'Canvas Center X' });
      candidatesX.push({ pos: docW, label: 'Canvas Right' });

      candidatesY.push({ pos: 0, label: 'Canvas Top' });
      candidatesY.push({ pos: docH / 2, label: 'Canvas Center Y' });
      candidatesY.push({ pos: docH, label: 'Canvas Bottom' });
    }

    // 2. User Guides Snap
    if (context.snapToGuides !== false && Array.isArray(context.guides)) {
      context.guides.forEach(g => {
        if (g.type === 'v') {
          candidatesX.push({ pos: g.pos, label: 'Guide V' });
        } else if (g.type === 'h') {
          candidatesY.push({ pos: g.pos, label: 'Guide H' });
        }
      });
    }

    // 3. Other Layer Bounds Snap
    if (context.snapToLayers !== false && Array.isArray(context.layers)) {
      context.layers.forEach(l => {
        if (!l.visible || l.id === context.activeLayerId || l.isGroup) return;
        const lx = l.x || 0;
        const ly = l.y || 0;
        const lw = l.width || docW;
        const lh = l.height || docH;

        candidatesX.push({ pos: lx, label: `${l.name} Left` });
        candidatesX.push({ pos: lx + lw / 2, label: `${l.name} Center X` });
        candidatesX.push({ pos: lx + lw, label: `${l.name} Right` });

        candidatesY.push({ pos: ly, label: `${l.name} Top` });
        candidatesY.push({ pos: ly + lh / 2, label: `${l.name} Center Y` });
        candidatesY.push({ pos: ly + lh, label: `${l.name} Bottom` });
      });
    }

    // 4. Test X Alignments (Left to target, Center to target, Right to target)
    candidatesX.forEach(cand => {
      // Test left edge
      let diff = cand.pos - targetLeft;
      if (Math.abs(diff) < minDiffX) {
        minDiffX = Math.abs(diff);
        bestDx = diff;
        snappedLineX = cand.pos;
      }
      // Test center
      diff = cand.pos - targetCenterX;
      if (Math.abs(diff) < minDiffX) {
        minDiffX = Math.abs(diff);
        bestDx = diff;
        snappedLineX = cand.pos;
      }
      // Test right edge
      diff = cand.pos - targetRight;
      if (Math.abs(diff) < minDiffX) {
        minDiffX = Math.abs(diff);
        bestDx = diff;
        snappedLineX = cand.pos;
      }
    });

    // 5. Test Y Alignments (Top, Center, Bottom)
    candidatesY.forEach(cand => {
      // Test top edge
      let diff = cand.pos - targetTop;
      if (Math.abs(diff) < minDiffY) {
        minDiffY = Math.abs(diff);
        bestDy = diff;
        snappedLineY = cand.pos;
      }
      // Test center
      diff = cand.pos - targetCenterY;
      if (Math.abs(diff) < minDiffY) {
        minDiffY = Math.abs(diff);
        bestDy = diff;
        snappedLineY = cand.pos;
      }
      // Test bottom edge
      diff = cand.pos - targetBottom;
      if (Math.abs(diff) < minDiffY) {
        minDiffY = Math.abs(diff);
        bestDy = diff;
        snappedLineY = cand.pos;
      }
    });

    // Prepare visual snap feedback lines
    const snapLines = [];
    if (minDiffX <= thresholdDoc && snappedLineX !== null) {
      snapLines.push({
        type: 'vertical',
        pos: snappedLineX
      });
    } else {
      bestDx = 0;
    }

    if (minDiffY <= thresholdDoc && snappedLineY !== null) {
      snapLines.push({
        type: 'horizontal',
        pos: snappedLineY
      });
    } else {
      bestDy = 0;
    }

    return {
      snappedX: bounds.x + bestDx,
      snappedY: bounds.y + bestDy,
      dx: bestDx,
      dy: bestDy,
      hasSnapX: bestDx !== 0,
      hasSnapY: bestDy !== 0,
      snapLines
    };
  }

  /**
   * Render Smart Guide magnetic alignment lines on the overlay canvas
   */
  static renderSmartGuideLines(ctx, snapLines, zoom, panX, panY, viewW, viewH, docW, docH) {
    if (!ctx || !Array.isArray(snapLines) || snapLines.length === 0) return;

    ctx.save();
    ctx.strokeStyle = '#ff007f'; // Magenta Smart Guide line
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);

    const originX = (viewW / 2) + panX - (docW * zoom / 2);
    const originY = (viewH / 2) + panY - (docH * zoom / 2);

    snapLines.forEach(line => {
      if (line.type === 'vertical') {
        const sx = originX + line.pos * zoom;
        ctx.beginPath();
        ctx.moveTo(sx, 0);
        ctx.lineTo(sx, viewH);
        ctx.stroke();
      } else if (line.type === 'horizontal') {
        const sy = originY + line.pos * zoom;
        ctx.beginPath();
        ctx.moveTo(0, sy);
        ctx.lineTo(viewW, sy);
        ctx.stroke();
      }
    });

    ctx.restore();
  }
}

// ── Export ──
if (typeof window !== 'undefined') {
  window.GuideManager = GuideManager;
  window.SnappingEngine = SnappingEngine;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { GuideManager, SnappingEngine };
}
