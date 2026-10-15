/**
 * PixelForge Studio — Milestone 5: Liquify Mesh Deformation Engine
 *
 * Implements Adobe Photoshop-grade Liquify tool:
 *  - Per-pixel floating point displacement vector field (dxField, dyField)
 *  - High-performance bilinear subpixel interpolation sampler
 *  - Deformation Brushes:
 *      * Forward Warp: pushes pixels in direction of cursor stroke
 *      * Reconstruct: smoothly restores deformed field toward original coordinates
 *      * Smooth: Laplacian mesh relaxation to remove creases and folds
 *      * Twirl Clockwise: vortex rotation around cursor center
 *      * Twirl Counter-Clockwise: inverse vortex rotation
 *      * Pucker: converges/shrinks pixels inward toward cursor
 *      * Bloat: expands/diverges pixels outward from cursor
 *      * Push Left: displaces pixels perpendicular to stroke vector
 *  - Interactive Deformable Mesh Grid overlay
 *  - Full modal UI with tool options, live preview, pan/zoom, and undo/redo commit
 */

class LiquifyEngine {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    const numPixels = width * height;

    // Displacement fields (sub-pixel offsets from source)
    this.dxField = new Float32Array(numPixels);
    this.dyField = new Float32Array(numPixels);

    // Initial / reset snapshot for selective reconstruction
    this.initialDx = new Float32Array(numPixels);
    this.initialDy = new Float32Array(numPixels);

    // Brush Settings
    this.tool = 'warp'; // 'warp' | 'reconstruct' | 'smooth' | 'twirl-cw' | 'twirl-ccw' | 'pucker' | 'bloat' | 'push-left'
    this.brushSize = 64;
    this.brushDensity = 50; // Hardness / core width (1-100)
    this.brushPressure = 50; // Rate / strength (1-100)

    // Mesh Grid Settings
    this.showMesh = false;
    this.meshSize = 24; // Grid cell spacing in pixels
    this.meshColor = '#00ffff';
  }

  reset() {
    this.dxField.fill(0);
    this.dyField.fill(0);
  }

  setSourceImage(imageData) {
    this.sourceData = new Uint8ClampedArray(imageData.data);
    this.reset();
  }

  /**
   * Computes radial falloff weight at distance r from brush center.
   * Uses smooth cosine curve adjusted by density/hardness.
   */
  getRadialWeight(r, maxRadius, density, pressure) {
    if (r >= maxRadius) return 0;
    const normDist = r / maxRadius;
    const hardnessFactor = density / 100;
    
    // Core radius where weight is 1.0
    const core = hardnessFactor * 0.7;
    let t = 0;
    if (normDist <= core) {
      t = 1.0;
    } else {
      const edgeDist = (normDist - core) / (1.0 - core);
      t = 0.5 * (1.0 + Math.cos(edgeDist * Math.PI));
    }

    return t * (pressure / 100);
  }

  /**
   * 1. Forward Warp: Displaces coordinates in the stroke direction (vx, vy)
   */
  applyForwardWarp(cx, cy, vx, vy) {
    const r = Math.max(2, Math.round(this.brushSize / 2));
    const minX = Math.max(0, Math.floor(cx - r));
    const maxX = Math.min(this.width - 1, Math.ceil(cx + r));
    const minY = Math.max(0, Math.floor(cy - r));
    const maxY = Math.min(this.height - 1, Math.ceil(cy + r));

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dist = Math.hypot(x - cx, y - cy);
        if (dist > r) continue;

        const weight = this.getRadialWeight(dist, r, this.brushDensity, this.brushPressure);
        if (weight <= 0) continue;

        const idx = y * this.width + x;
        // Inverse displacement for backward sampling: pull from opposite direction of stroke
        this.dxField[idx] -= vx * weight;
        this.dyField[idx] -= vy * weight;
      }
    }
  }

  /**
   * 2. Reconstruct: Restores displacement back toward 0 (or initialDx/Dy)
   */
  applyReconstruct(cx, cy) {
    const r = Math.max(2, Math.round(this.brushSize / 2));
    const minX = Math.max(0, Math.floor(cx - r));
    const maxX = Math.min(this.width - 1, Math.ceil(cx + r));
    const minY = Math.max(0, Math.floor(cy - r));
    const maxY = Math.min(this.height - 1, Math.ceil(cy + r));

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dist = Math.hypot(x - cx, y - cy);
        if (dist > r) continue;

        const weight = this.getRadialWeight(dist, r, this.brushDensity, this.brushPressure);
        if (weight <= 0) continue;

        const idx = y * this.width + x;
        const targetDx = this.initialDx[idx];
        const targetDy = this.initialDy[idx];

        this.dxField[idx] += (targetDx - this.dxField[idx]) * weight;
        this.dyField[idx] += (targetDy - this.dyField[idx]) * weight;
      }
    }
  }

  /**
   * 3. Smooth: Relaxes displacement field with neighbor averaging to remove harsh peaks
   */
  applySmooth(cx, cy) {
    const r = Math.max(2, Math.round(this.brushSize / 2));
    const minX = Math.max(1, Math.floor(cx - r));
    const maxX = Math.min(this.width - 2, Math.ceil(cx + r));
    const minY = Math.max(1, Math.floor(cy - r));
    const maxY = Math.min(this.height - 2, Math.ceil(cy + r));

    const tempDx = new Float32Array(this.dxField);
    const tempDy = new Float32Array(this.dyField);

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dist = Math.hypot(x - cx, y - cy);
        if (dist > r) continue;

        const weight = this.getRadialWeight(dist, r, this.brushDensity, this.brushPressure);
        if (weight <= 0) continue;

        const idx = y * this.width + x;

        // 4-neighbor average
        const avgDx = (tempDx[idx - 1] + tempDx[idx + 1] + tempDx[idx - this.width] + tempDx[idx + this.width]) * 0.25;
        const avgDy = (tempDy[idx - 1] + tempDy[idx + 1] + tempDy[idx - this.width] + tempDy[idx + this.width]) * 0.25;

        this.dxField[idx] += (avgDx - this.dxField[idx]) * weight * 0.5;
        this.dyField[idx] += (avgDy - this.dyField[idx]) * weight * 0.5;
      }
    }
  }

  /**
   * 4 & 5. Twirl Clockwise & Counter-Clockwise
   */
  applyTwirl(cx, cy, isClockwise = true) {
    const r = Math.max(2, Math.round(this.brushSize / 2));
    const minX = Math.max(0, Math.floor(cx - r));
    const maxX = Math.min(this.width - 1, Math.ceil(cx + r));
    const minY = Math.max(0, Math.floor(cy - r));
    const maxY = Math.min(this.height - 1, Math.ceil(cy + r));

    const sign = isClockwise ? 1 : -1;
    const baseAngle = 0.25 * sign * (this.brushPressure / 100);

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const relX = x - cx;
        const relY = y - cy;
        const dist = Math.hypot(relX, relY);
        if (dist > r || dist === 0) continue;

        const weight = this.getRadialWeight(dist, r, this.brushDensity, 100);
        const theta = baseAngle * weight;
        const cosT = Math.cos(theta);
        const sinT = Math.sin(theta);

        // Current sampled coordinate before new twirl
        const idx = y * this.width + x;
        const currSampleX = relX + this.dxField[idx];
        const currSampleY = relY + this.dyField[idx];

        // Rotate sampled point around center
        const rotX = currSampleX * cosT - currSampleY * sinT;
        const rotY = currSampleX * sinT + currSampleY * cosT;

        this.dxField[idx] = rotX - relX;
        this.dyField[idx] = rotY - relY;
      }
    }
  }

  /**
   * 6. Pucker: Converges sampled coordinates towards brush center
   */
  applyPucker(cx, cy) {
    const r = Math.max(2, Math.round(this.brushSize / 2));
    const minX = Math.max(0, Math.floor(cx - r));
    const maxX = Math.min(this.width - 1, Math.ceil(cx + r));
    const minY = Math.max(0, Math.floor(cy - r));
    const maxY = Math.min(this.height - 1, Math.ceil(cy + r));

    const factor = 0.08 * (this.brushPressure / 100);

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const relX = x - cx;
        const relY = y - cy;
        const dist = Math.hypot(relX, relY);
        if (dist > r || dist === 0) continue;

        const weight = this.getRadialWeight(dist, r, this.brushDensity, 100);
        if (weight <= 0) continue;

        const idx = y * this.width + x;
        // Pucker pushes sampled points away from center so pixels appear pinched inward
        this.dxField[idx] += relX * factor * weight;
        this.dyField[idx] += relY * factor * weight;
      }
    }
  }

  /**
   * 7. Bloat: Diverges sampled coordinates away from brush center
   */
  applyBloat(cx, cy) {
    const r = Math.max(2, Math.round(this.brushSize / 2));
    const minX = Math.max(0, Math.floor(cx - r));
    const maxX = Math.min(this.width - 1, Math.ceil(cx + r));
    const minY = Math.max(0, Math.floor(cy - r));
    const maxY = Math.min(this.height - 1, Math.ceil(cy + r));

    const factor = 0.08 * (this.brushPressure / 100);

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const relX = x - cx;
        const relY = y - cy;
        const dist = Math.hypot(relX, relY);
        if (dist > r || dist === 0) continue;

        const weight = this.getRadialWeight(dist, r, this.brushDensity, 100);
        if (weight <= 0) continue;

        const idx = y * this.width + x;
        // Bloat pulls sampled points toward center so pixels appear magnified outward
        this.dxField[idx] -= relX * factor * weight;
        this.dyField[idx] -= relY * factor * weight;
      }
    }
  }

  /**
   * 8. Push Left: Displaces sampled coordinates perpendicular to the stroke vector
   */
  applyPushLeft(cx, cy, vx, vy) {
    const r = Math.max(2, Math.round(this.brushSize / 2));
    const minX = Math.max(0, Math.floor(cx - r));
    const maxX = Math.min(this.width - 1, Math.ceil(cx + r));
    const minY = Math.max(0, Math.floor(cy - r));
    const maxY = Math.min(this.height - 1, Math.ceil(cy + r));

    const vLen = Math.hypot(vx, vy);
    if (vLen === 0) return;

    // Normal vector 90 degrees to the left in screen space (where Y points down): (vy, -vx)
    const perpX = vy / vLen;
    const perpY = -vx / vLen;
    const mag = Math.min(vLen, 10) * (this.brushPressure / 100);

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dist = Math.hypot(x - cx, y - cy);
        if (dist > r) continue;

        const weight = this.getRadialWeight(dist, r, this.brushDensity, 100);
        if (weight <= 0) continue;

        const idx = y * this.width + x;
        this.dxField[idx] += perpX * mag * weight;
        this.dyField[idx] += perpY * mag * weight;
      }
    }
  }

  /**
   * High-Performance Bilinear Sampling pass
   * Deforms sourceData into target ImageData.
   */
  renderWarped(targetImageData) {
    if (!this.sourceData) return;
    const src = this.sourceData;
    const dst = targetImageData.data;
    const w = this.width;
    const h = this.height;
    const maxW = w - 1;
    const maxH = h - 1;

    for (let y = 0; y < h; y++) {
      const rowOffset = y * w;
      for (let x = 0; x < w; x++) {
        const p = rowOffset + x;
        const dstIdx = p * 4;

        // Sample coordinate with displacement
        const sx = x + this.dxField[p];
        const sy = y + this.dyField[p];

        if (sx < 0 || sx >= maxW || sy < 0 || sy >= maxH) {
          // Clamped edge handling
          const cx = Math.max(0, Math.min(maxW, Math.round(sx)));
          const cy = Math.max(0, Math.min(maxH, Math.round(sy)));
          const cIdx = (cy * w + cx) * 4;
          dst[dstIdx]     = src[cIdx];
          dst[dstIdx + 1] = src[cIdx + 1];
          dst[dstIdx + 2] = src[cIdx + 2];
          dst[dstIdx + 3] = src[cIdx + 3];
          continue;
        }

        // Bilinear sub-pixel interpolation
        const x0 = Math.floor(sx);
        const y0 = Math.floor(sy);
        const x1 = x0 + 1;
        const y1 = y0 + 1;

        const fx = sx - x0;
        const fy = sy - y0;
        const invFx = 1.0 - fx;
        const invFy = 1.0 - fy;

        const w00 = invFx * invFy;
        const w10 = fx * invFy;
        const w01 = invFx * fy;
        const w11 = fx * fy;

        const idx00 = (y0 * w + x0) * 4;
        const idx10 = (y0 * w + x1) * 4;
        const idx01 = (y1 * w + x0) * 4;
        const idx11 = (y1 * w + x1) * 4;

        dst[dstIdx] = Math.round(
          src[idx00] * w00 + src[idx10] * w10 + src[idx01] * w01 + src[idx11] * w11
        );
        dst[dstIdx + 1] = Math.round(
          src[idx00 + 1] * w00 + src[idx10 + 1] * w10 + src[idx01 + 1] * w01 + src[idx11 + 1] * w11
        );
        dst[dstIdx + 2] = Math.round(
          src[idx00 + 2] * w00 + src[idx10 + 2] * w10 + src[idx01 + 2] * w01 + src[idx11 + 2] * w11
        );
        dst[dstIdx + 3] = Math.round(
          src[idx00 + 3] * w00 + src[idx10 + 3] * w10 + src[idx01 + 3] * w01 + src[idx11 + 3] * w11
        );
      }
    }
  }

  /**
   * Renders the interactive distorted mesh wireframe over canvas
   */
  renderMeshGrid(ctx, step = 24, strokeStyle = '#00ffff') {
    ctx.save();
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.65;

    const w = this.width;
    const h = this.height;

    // Horizontal grid lines
    for (let y = 0; y < h; y += step) {
      ctx.beginPath();
      for (let x = 0; x < w; x += step) {
        const p = y * w + x;
        // The mesh shows where pixels moved to (negative offset)
        const mx = x - this.dxField[p];
        const my = y - this.dyField[p];
        if (x === 0) ctx.moveTo(mx, my);
        else ctx.lineTo(mx, my);
      }
      ctx.stroke();
    }

    // Vertical grid lines
    for (let x = 0; x < w; x += step) {
      ctx.beginPath();
      for (let y = 0; y < h; y += step) {
        const p = y * w + x;
        const mx = x - this.dxField[p];
        const my = y - this.dyField[p];
        if (y === 0) ctx.moveTo(mx, my);
        else ctx.lineTo(mx, my);
      }
      ctx.stroke();
    }

    ctx.restore();
  }
}

// ── Interactive Liquify Modal Controller ──
class LiquifyModal {
  constructor(app) {
    this.app = app;
    this.engine = null;
    this.isOpen = false;
    this.isDragging = false;
    this.lastX = 0;
    this.lastY = 0;

    // Viewport pan & zoom within modal
    this.zoom = 1.0;
    this.panX = 0;
    this.panY = 0;
    this.isPanning = false;
    this.startPanX = 0;
    this.startPanY = 0;

    // Canvases
    this.modalCanvas = null;
    this.modalCtx = null;
    this.previewImgData = null;

    // Animation / Throttle
    this.needsRender = false;
    this.rafId = null;
  }

  init() {
    this.bindDOM();
    this.bindKeyboard();
  }

  bindDOM() {
    const modal = document.getElementById('modal-liquify');
    if (!modal) return;

    this.modalCanvas = document.getElementById('liquify-canvas');
    if (this.modalCanvas) {
      this.modalCtx = this.modalCanvas.getContext('2d');
    }

    // Liquify Tools Switcher
    const toolBtns = modal.querySelectorAll('.liquify-tool-btn');
    toolBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        toolBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (this.engine) {
          this.engine.tool = btn.dataset.tool;
        }
      });
    });

    // Brush Settings Sliders
    const sizeSlider = document.getElementById('liquify-brush-size');
    const sizeVal = document.getElementById('val-liquify-size');
    if (sizeSlider) {
      sizeSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        if (sizeVal) sizeVal.textContent = `${val}px`;
        if (this.engine) this.engine.brushSize = val;
      });
    }

    const densitySlider = document.getElementById('liquify-brush-density');
    const densityVal = document.getElementById('val-liquify-density');
    if (densitySlider) {
      densitySlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        if (densityVal) densityVal.textContent = `${val}%`;
        if (this.engine) this.engine.brushDensity = val;
      });
    }

    const pressureSlider = document.getElementById('liquify-brush-pressure');
    const pressureVal = document.getElementById('val-liquify-pressure');
    if (pressureSlider) {
      pressureSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        if (pressureVal) pressureVal.textContent = `${val}%`;
        if (this.engine) this.engine.brushPressure = val;
      });
    }

    // View Options
    const showMeshCheck = document.getElementById('liquify-show-mesh');
    if (showMeshCheck) {
      showMeshCheck.addEventListener('change', (e) => {
        if (this.engine) {
          this.engine.showMesh = e.target.checked;
          this.requestRender();
        }
      });
    }

    const meshSizeSelect = document.getElementById('liquify-mesh-size');
    if (meshSizeSelect) {
      meshSizeSelect.addEventListener('change', (e) => {
        if (this.engine) {
          this.engine.meshSize = parseInt(e.target.value, 10) || 24;
          this.requestRender();
        }
      });
    }

    // Reconstruct Buttons
    const btnReconstructAll = document.getElementById('btn-liquify-reconstruct-all');
    if (btnReconstructAll) {
      btnReconstructAll.addEventListener('click', () => {
        if (this.engine) {
          this.engine.reset();
          this.requestRender();
        }
      });
    }

    // Commit / Cancel Buttons
    const btnApply = document.getElementById('btn-apply-liquify');
    if (btnApply) {
      btnApply.addEventListener('click', () => this.applyAndClose());
    }

    const btnCancel = document.getElementById('btn-cancel-liquify');
    if (btnCancel) {
      btnCancel.addEventListener('click', () => this.close());
    }

    const btnClose = modal.querySelector('.modal-close-btn');
    if (btnClose) {
      btnClose.addEventListener('click', () => this.close());
    }

    // Canvas Mouse / Touch Events
    if (this.modalCanvas) {
      this.modalCanvas.addEventListener('mousedown', (e) => this.onPointerDown(e));
      window.addEventListener('mousemove', (e) => this.onPointerMove(e));
      window.addEventListener('mouseup', (e) => this.onPointerUp(e));
    }
  }

  bindKeyboard() {
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'x') {
        e.preventDefault();
        this.open();
      } else if (this.isOpen && e.key === 'Escape') {
        e.preventDefault();
        this.close();
      } else if (this.isOpen && e.key === 'Enter') {
        e.preventDefault();
        this.applyAndClose();
      }
    });
  }

  open() {
    const activeLayer = this.app.layerManager.getActiveLayer();
    if (!activeLayer) {
      alert('Please select a layer to liquify.');
      return;
    }
    if (activeLayer.locked) {
      alert('Cannot liquify a locked layer.');
      return;
    }
    if (activeLayer.type === 'group') {
      alert('Cannot liquify a layer group. Select a bitmap or text layer.');
      return;
    }

    const w = this.app.width;
    const h = this.app.height;

    this.engine = new LiquifyEngine(w, h);
    const srcImgData = activeLayer.ctx.getImageData(0, 0, w, h);
    this.engine.setSourceImage(srcImgData);

    const modal = document.getElementById('modal-liquify');
    if (!modal) return;
    modal.classList.remove('hidden');
    this.isOpen = true;

    if (this.modalCanvas) {
      this.modalCanvas.width = w;
      this.modalCanvas.height = h;
      this.previewImgData = this.modalCtx.createImageData(w, h);
    }

    this.requestRender();
  }

  close() {
    const modal = document.getElementById('modal-liquify');
    if (modal) modal.classList.add('hidden');
    this.isOpen = false;
    this.engine = null;
  }

  applyAndClose() {
    if (!this.engine || !this.isOpen) return;

    const activeLayer = this.app.layerManager.getActiveLayer();
    if (!activeLayer) {
      this.close();
      return;
    }

    // Take history snapshot before applying
    if (this.app.pushHistoryState) {
      this.app.pushHistoryState(`Filter: Liquify (${this.engine.tool})`);
    }

    // Render warped pixels directly onto active layer canvas
    const imgData = activeLayer.ctx.createImageData(this.app.width, this.app.height);
    this.engine.renderWarped(imgData);
    activeLayer.ctx.putImageData(imgData, 0, 0);

    // If text layer, convert to raster so warped pixels are preserved
    if (activeLayer.type === 'text') {
      activeLayer.type = 'raster';
    }

    this.app.layerManager.notifyUpdate();
    this.close();
  }

  getCanvasCoords(e) {
    if (!this.modalCanvas) return { x: 0, y: 0 };
    const rect = this.modalCanvas.getBoundingClientRect();
    const scaleX = this.modalCanvas.width / rect.width;
    const scaleY = this.modalCanvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }

  onPointerDown(e) {
    if (!this.isOpen || !this.engine) return;
    const pos = this.getCanvasCoords(e);
    this.isDragging = true;
    this.lastX = pos.x;
    this.lastY = pos.y;

    if (e.button === 0) {
      this.applyCurrentTool(pos.x, pos.y, 0, 0);
    }
  }

  onPointerMove(e) {
    if (!this.isOpen || !this.engine || !this.isDragging) return;
    const pos = this.getCanvasCoords(e);
    const vx = pos.x - this.lastX;
    const vy = pos.y - this.lastY;

    this.applyCurrentTool(pos.x, pos.y, vx, vy);

    this.lastX = pos.x;
    this.lastY = pos.y;
  }

  onPointerUp(e) {
    this.isDragging = false;
  }

  applyCurrentTool(x, y, vx, vy) {
    if (!this.engine) return;

    switch (this.engine.tool) {
      case 'warp':
        this.engine.applyForwardWarp(x, y, vx, vy);
        break;
      case 'reconstruct':
        this.engine.applyReconstruct(x, y);
        break;
      case 'smooth':
        this.engine.applySmooth(x, y);
        break;
      case 'twirl-cw':
        this.engine.applyTwirl(x, y, true);
        break;
      case 'twirl-ccw':
        this.engine.applyTwirl(x, y, false);
        break;
      case 'pucker':
        this.engine.applyPucker(x, y);
        break;
      case 'bloat':
        this.engine.applyBloat(x, y);
        break;
      case 'push-left':
        this.engine.applyPushLeft(x, y, vx, vy);
        break;
    }

    this.requestRender();
  }

  requestRender() {
    if (!this.isOpen || !this.modalCtx || !this.engine) return;
    if (this.needsRender) return;
    this.needsRender = true;

    requestAnimationFrame(() => {
      this.needsRender = false;
      if (!this.isOpen || !this.modalCtx || !this.engine) return;

      // Render deformed image
      this.engine.renderWarped(this.previewImgData);
      this.modalCtx.putImageData(this.previewImgData, 0, 0);

      // Render optional mesh grid overlay
      if (this.engine.showMesh) {
        this.engine.renderMeshGrid(this.modalCtx, this.engine.meshSize, this.engine.meshColor);
      }
    });
  }
}

// Export for Node.js test environment and browser window
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LiquifyEngine, LiquifyModal };
} else if (typeof window !== 'undefined') {
  window.LiquifyEngine = LiquifyEngine;
  window.LiquifyModal = LiquifyModal;
}
