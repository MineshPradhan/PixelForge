/**
 * PixelForge Studio — Milestone 6: Interactive Navigator Palette Engine
 *
 * Implements real-time canvas overview thumbnail navigation:
 *  - Thumbnail canvas mirroring composite image stack
 *  - Interactive red Viewport Pan-Box
 *  - Real-time panning by dragging inside navigator thumbnail
 *  - Integrated Zoom slider & Quick Zoom Presets (Fit, 100%, 200%)
 */

class NavigatorManager {
  constructor(app) {
    this.app = app;
    this.thumbnailCanvas = null;
    this.thumbnailCtx = null;
    this.panBox = null;
    this.container = null;
    this.isDraggingPanBox = false;

    this.thumbWidth = 220;
    this.thumbHeight = 124;
  }

  init() {
    this.thumbnailCanvas = document.getElementById('navigator-thumb-canvas');
    if (this.thumbnailCanvas) {
      this.thumbnailCtx = this.thumbnailCanvas.getContext('2d');
    }
    this.panBox = document.getElementById('navigator-pan-box');
    this.container = document.getElementById('navigator-thumb-container');

    this.bindEvents();
    this.update();
  }

  bindEvents() {
    if (!this.container) return;

    // Click & Drag within thumbnail to pan canvas
    const handleThumbPointer = (e) => {
      if (!this.isDraggingPanBox && e.type === 'mousemove') return;
      const rect = this.thumbnailCanvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      const normX = Math.max(0, Math.min(1, clickX / rect.width));
      const normY = Math.max(0, Math.min(1, clickY / rect.height));

      // Target document center
      const docX = normX * this.app.width;
      const docY = normY * this.app.height;

      this.centerViewportOn(docX, docY);
    };

    this.container.addEventListener('mousedown', (e) => {
      this.isDraggingPanBox = true;
      handleThumbPointer(e);
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isDraggingPanBox) {
        handleThumbPointer(e);
      }
    });

    window.addEventListener('mouseup', () => {
      this.isDraggingPanBox = false;
    });

    // Navigator Zoom Slider
    const zoomSlider = document.getElementById('navigator-zoom-slider');
    const zoomVal = document.getElementById('val-navigator-zoom');

    if (zoomSlider) {
      zoomSlider.addEventListener('input', (e) => {
        const pct = parseInt(e.target.value, 10);
        if (zoomVal) zoomVal.textContent = `${pct}%`;
        this.app.zoom = Math.max(0.05, Math.min(10, pct / 100));
        this.app.applyViewportTransform();
        this.updatePanBox();
      });
    }

    // Quick Zoom Buttons
    const btnFit = document.getElementById('btn-nav-zoom-fit');
    if (btnFit) {
      btnFit.addEventListener('click', () => {
        this.app.zoomFit();
        this.update();
      });
    }

    const btn100 = document.getElementById('btn-nav-zoom-100');
    if (btn100) {
      btn100.addEventListener('click', () => {
        this.app.zoom100();
        this.update();
      });
    }

    const btn200 = document.getElementById('btn-nav-zoom-200');
    if (btn200) {
      btn200.addEventListener('click', () => {
        this.app.zoom = 2.0;
        this.app.applyViewportTransform();
        this.update();
      });
    }
  }

  centerViewportOn(docX, docY) {
    const viewport = document.getElementById('viewport-container');
    if (!viewport) return;

    const vw = viewport.clientWidth;
    const vh = viewport.clientHeight;
    const zoom = this.app.zoom;

    // Compute pan offsets so (docX, docY) is at the center of (vw, vh)
    // Screen X = (vw / 2) + panX + (docX - width / 2) * zoom
    // We want Screen X = vw / 2 => panX = -(docX - width / 2) * zoom
    this.app.panX = -(docX - this.app.width / 2) * zoom;
    this.app.panY = -(docY - this.app.height / 2) * zoom;

    this.app.applyViewportTransform();
    this.updatePanBox();
  }

  update() {
    this.updateThumbnail();
    this.updatePanBox();
  }

  getThumbnailDimensions(maxW = 220, maxH = 124) {
    const docW = this.app.width;
    const docH = this.app.height;
    if (docW <= 0 || docH <= 0) return { w: maxW, h: maxH };

    const aspect = docW / docH;
    let tw = maxW;
    let th = maxW / aspect;
    if (th > maxH) {
      th = maxH;
      tw = maxH * aspect;
    }
    return { w: tw, h: th };
  }

  calculatePanBox(vw, vh) {
    const docW = this.app.width;
    const docH = this.app.height;
    const zoom = this.app.zoom;
    const panX = this.app.panX;
    const panY = this.app.panY;

    if (docW <= 0 || docH <= 0 || zoom <= 0) return { left: 0, top: 0, w: 0, h: 0 };

    const visDocW = vw / zoom;
    const visDocH = vh / zoom;

    const centerDocX = (docW / 2) - (panX / zoom);
    const centerDocY = (docH / 2) - (panY / zoom);

    const docMinX = centerDocX - visDocW / 2;
    const docMinY = centerDocY - visDocH / 2;

    const scaleX = this.thumbWidth / docW;
    const scaleY = this.thumbHeight / docH;

    const boxX = docMinX * scaleX;
    const boxY = docMinY * scaleY;
    const boxW = visDocW * scaleX;
    const boxH = visDocH * scaleY;

    return { left: boxX, top: boxY, w: boxW, h: boxH };
  }

  updateThumbnail() {
    if (!this.thumbnailCanvas || !this.thumbnailCtx) return;

    const dims = this.getThumbnailDimensions(220, 124);
    const tw = Math.round(dims.w);
    const th = Math.round(dims.h);

    if (this.thumbnailCanvas.width !== tw || this.thumbnailCanvas.height !== th) {
      this.thumbnailCanvas.width = tw;
      this.thumbnailCanvas.height = th;
      this.thumbWidth = tw;
      this.thumbHeight = th;
    }

    this.thumbnailCtx.clearRect(0, 0, tw, th);

    // Draw miniature composite
    if (this.app.mainCanvas) {
      this.thumbnailCtx.drawImage(this.app.mainCanvas, 0, 0, tw, th);
    }
  }

  updatePanBox() {
    if (!this.panBox || !this.thumbnailCanvas) return;

    const viewport = document.getElementById('viewport-container');
    if (!viewport) return;

    const vw = viewport.clientWidth;
    const vh = viewport.clientHeight;

    const box = this.calculatePanBox(vw, vh);
    const boxX = Math.round(box.left);
    const boxY = Math.round(box.top);
    const boxW = Math.max(8, Math.round(box.w));
    const boxH = Math.max(8, Math.round(box.h));

    this.panBox.style.left = `${boxX}px`;
    this.panBox.style.top = `${boxY}px`;
    this.panBox.style.width = `${boxW}px`;
    this.panBox.style.height = `${boxH}px`;

    // Sync zoom slider & value text
    const zoomSlider = document.getElementById('navigator-zoom-slider');
    const zoomVal = document.getElementById('val-navigator-zoom');
    const zoomPct = Math.round(this.app.zoom * 100);
    if (zoomSlider && document.activeElement !== zoomSlider) {
      zoomSlider.value = zoomPct;
    }
    if (zoomVal) {
      zoomVal.textContent = `${zoomPct}%`;
    }
  }
}

// Export for Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { NavigatorManager, default: NavigatorManager };
} else if (typeof window !== 'undefined') {
  window.NavigatorManager = NavigatorManager;
}
