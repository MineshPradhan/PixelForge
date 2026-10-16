/**
 * PixelForge Studio - Infinite Seamless Canvas Wrap-Around View & Brush Wrap Engine
 * Krita / Photoshop Parity for seamless repeatable pattern & texture design:
 * 1. Infinite toroidal canvas tiling rendering 8 surrounding quadrants around active canvas
 * 2. Seamless edge-wrapping brush engine (dabs crossing borders wrap toroidally to opposite edges)
 * 3. Bidirectional coordinate wrapping for mouse and stylus input anywhere on tiled view
 * 4. Toggle via View -> Wrap-Around Mode or Shift+W shortcut
 */

class WrapAroundEngine {
  constructor(app = null) {
    this.app = app;
    this.enabled = false;
    this.container = null;
    this.tiles = []; // Array of 8 { canvas, ctx, dx, dy }
    this.quadrants = [
      { dx: -1, dy: -1 },
      { dx: 0, dy: -1 },
      { dx: 1, dy: -1 },
      { dx: -1, dy: 0 },
      { dx: 1, dy: 0 },
      { dx: -1, dy: 1 },
      { dx: 0, dy: 1 },
      { dx: 1, dy: 1 }
    ];
  }

  setApp(app) {
    this.app = app;
  }

  /**
   * Toggle Wrap-Around mode
   * @param {boolean|null} forceState 
   * @returns {boolean}
   */
  toggleWrapAround(forceState = null) {
    const nextState = forceState !== null ? !!forceState : !this.enabled;
    this.enabled = nextState;

    if (this.enabled) {
      this.enable();
      if (this.app && this.app.showToast) {
        this.app.showToast('Wrap-Around Mode Activated (Shift+W): Seamless Tiling Active');
      }
    } else {
      this.disable();
      if (this.app && this.app.showToast) {
        this.app.showToast('Wrap-Around Mode Deactivated');
      }
    }

    if (this.app) {
      if (this.app.renderComposite) this.app.renderComposite();
      if (this.app.renderGuidesAndOverlays) this.app.renderGuidesAndOverlays();
    }
    return this.enabled;
  }

  enable() {
    this.enabled = true;
    this.createOrUpdateTiles();
    this.updateTiles();
  }

  disable() {
    this.enabled = false;
    if (this.container && this.container.style) {
      this.container.style.display = 'none';
    }
  }

  /**
   * Create or synchronize 8 canvas tiles around #canvas-wrapper
   */
  createOrUpdateTiles() {
    if (typeof document === 'undefined') return;
    const wrapper = document.getElementById('canvas-wrapper');
    if (!wrapper) return;

    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'wrap-around-tiles-container';
      this.container.style.cssText = 'position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; z-index:1;';
      wrapper.appendChild(this.container);
    }

    this.container.style.display = 'block';

    const w = this.app ? this.app.width : 800;
    const h = this.app ? this.app.height : 600;

    // Check if tiles need creation or resize
    if (this.tiles.length !== 8) {
      this.container.innerHTML = '';
      this.tiles = [];

      this.quadrants.forEach(({ dx, dy }) => {
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        c.style.cssText = `position:absolute; left:${dx * 100}%; top:${dy * 100}%; width:100%; height:100%; pointer-events:none; image-rendering:pixelated; opacity:0.92; border:1px dashed rgba(56, 189, 248, 0.25); box-sizing:border-box;`;
        this.container.appendChild(c);
        this.tiles.push({
          canvas: c,
          ctx: c.getContext('2d'),
          dx,
          dy
        });
      });
    } else {
      this.tiles.forEach(t => {
        if (t.canvas.width !== w || t.canvas.height !== h) {
          t.canvas.width = w;
          t.canvas.height = h;
        }
      });
    }
  }

  /**
   * Update pixel contents of all 8 surrounding quadrants from mainCanvas
   */
  updateTiles() {
    if (!this.enabled || !this.app || !this.app.mainCanvas) return;
    if (this.tiles.length === 0) {
      this.createOrUpdateTiles();
    }
    const w = this.app.width;
    const h = this.app.height;

    for (let i = 0; i < this.tiles.length; i++) {
      const t = this.tiles[i];
      if (t.ctx) {
        t.ctx.clearRect(0, 0, w, h);
        t.ctx.drawImage(this.app.mainCanvas, 0, 0);
      }
    }
  }

  /**
   * Toroidal coordinate wrapping for pointer events
   */
  wrapCoordinates(x, y, w = null, h = null) {
    const width = w || (this.app ? this.app.width : 1000);
    const height = h || (this.app ? this.app.height : 1000);
    return {
      x: ((x % width) + width) % width,
      y: ((y % height) + height) % height
    };
  }

  /**
   * Calculate all wrapped offsets for a brush dab with radius r at (x, y)
   * If dab intersects any canvas boundary, returns offset vectors for seams
   */
  getWrappedOffsets(x, y, r, width, height) {
    const xOffsets = [0];
    if (x - r < 0) xOffsets.push(width);
    if (x + r >= width) xOffsets.push(-width);

    const yOffsets = [0];
    if (y - r < 0) yOffsets.push(height);
    if (y + r >= height) yOffsets.push(-height);

    const offsets = [];
    for (let xi = 0; xi < xOffsets.length; xi++) {
      for (let yi = 0; yi < yOffsets.length; yi++) {
        offsets.push({ dx: xOffsets[xi], dy: yOffsets[yi] });
      }
    }
    return offsets;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = WrapAroundEngine;
}
if (typeof window !== 'undefined') {
  window.WrapAroundEngine = WrapAroundEngine;
}
