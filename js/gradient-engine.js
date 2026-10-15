/**
 * PixelForge Studio — Milestone 6: Multi-Stop Gradient Engine & Editor
 *
 * Implements Adobe Photoshop-grade Gradient Science:
 *  - Multi-Stop Color & Opacity Ramps
 *  - 5 Rendering Styles: Linear, Radial, Angle (Sweep/Conical 360°), Reflected, Diamond
 *  - High-performance 256-entry RGBA Look-Up Table (LUT)
 *  - Seamless Subpixel Interpolation & Dithering
 *  - Complete Photoshop Presets Library (Foreground/Background, Rainbow, Sunset, Neon, Chrome, Pastel, Sepia)
 *  - Interactive Gradient Editor Modal with draggable color & opacity stops
 */

// Utility resolution for Node.js test environment and browser
let UtilsHelper = typeof Utils !== 'undefined' ? Utils : null;
if (!UtilsHelper && typeof require !== 'undefined') {
  try {
    UtilsHelper = require('./utils.js');
  } catch (e) {}
}
if (!UtilsHelper) {
  UtilsHelper = {
    hexToRgb(hex) {
      if (!hex) return { r: 0, g: 0, b: 0 };
      let c = hex.replace('#', '');
      if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
      const num = parseInt(c, 16);
      return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
    },
    lerp(a, b, t) {
      return a + (b - a) * t;
    }
  };
}

class GradientData {
  constructor(options = {}) {
    this.style = options.style || 'linear'; // 'linear' | 'radial' | 'angle' | 'reflected' | 'diamond'
    this.reverse = !!options.reverse;
    this.dither = options.dither !== false;

    // Color stops: { offset: 0.0..1.0, color: '#rrggbb' }
    this.colorStops = options.colorStops ? JSON.parse(JSON.stringify(options.colorStops)) : [
      { offset: 0.0, color: '#000000' },
      { offset: 1.0, color: '#ffffff' }
    ];

    // Opacity stops: { offset: 0.0..1.0, opacity: 0..100 }
    this.opacityStops = options.opacityStops ? JSON.parse(JSON.stringify(options.opacityStops)) : [
      { offset: 0.0, opacity: 100 },
      { offset: 1.0, opacity: 100 }
    ];

    this.sortStops();
  }

  sortStops() {
    this.colorStops.sort((a, b) => a.offset - b.offset);
    this.opacityStops.sort((a, b) => a.offset - b.offset);
  }

  clone() {
    return new GradientData({
      style: this.style,
      reverse: this.reverse,
      dither: this.dither,
      colorStops: this.colorStops,
      opacityStops: this.opacityStops
    });
  }

  toJSON() {
    return {
      style: this.style,
      reverse: this.reverse,
      dither: this.dither,
      colorStops: this.colorStops,
      opacityStops: this.opacityStops
    };
  }

  static fromJSON(json) {
    if (!json) return GradientData.getPreset('fg-bg');
    return new GradientData(json);
  }

  /**
   * Samples exact RGBA color at normalized position t [0.0, 1.0]
   */
  sample(t) {
    let pos = Math.max(0.0, Math.min(1.0, t));
    if (this.reverse) pos = 1.0 - pos;

    // Interpolate Color
    let r = 0, g = 0, b = 0;
    if (this.colorStops.length === 1) {
      const rgb = UtilsHelper.hexToRgb(this.colorStops[0].color);
      r = rgb.r; g = rgb.g; b = rgb.b;
    } else {
      if (pos <= this.colorStops[0].offset) {
        const rgb = UtilsHelper.hexToRgb(this.colorStops[0].color);
        r = rgb.r; g = rgb.g; b = rgb.b;
      } else if (pos >= this.colorStops[this.colorStops.length - 1].offset) {
        const rgb = UtilsHelper.hexToRgb(this.colorStops[this.colorStops.length - 1].color);
        r = rgb.r; g = rgb.g; b = rgb.b;
      } else {
        for (let i = 0; i < this.colorStops.length - 1; i++) {
          const s0 = this.colorStops[i];
          const s1 = this.colorStops[i + 1];
          if (pos >= s0.offset && pos <= s1.offset) {
            const range = s1.offset - s0.offset;
            const factor = range === 0 ? 0 : (pos - s0.offset) / range;
            const rgb0 = UtilsHelper.hexToRgb(s0.color);
            const rgb1 = UtilsHelper.hexToRgb(s1.color);
            r = Math.round(UtilsHelper.lerp(rgb0.r, rgb1.r, factor));
            g = Math.round(UtilsHelper.lerp(rgb0.g, rgb1.g, factor));
            b = Math.round(UtilsHelper.lerp(rgb0.b, rgb1.b, factor));
            break;
          }
        }
      }
    }

    // Interpolate Opacity
    let a = 255;
    if (this.opacityStops.length === 1) {
      a = Math.round((this.opacityStops[0].opacity / 100) * 255);
    } else {
      if (pos <= this.opacityStops[0].offset) {
        a = Math.round((this.opacityStops[0].opacity / 100) * 255);
      } else if (pos >= this.opacityStops[this.opacityStops.length - 1].offset) {
        a = Math.round((this.opacityStops[this.opacityStops.length - 1].opacity / 100) * 255);
      } else {
        for (let i = 0; i < this.opacityStops.length - 1; i++) {
          const s0 = this.opacityStops[i];
          const s1 = this.opacityStops[i + 1];
          if (pos >= s0.offset && pos <= s1.offset) {
            const range = s1.offset - s0.offset;
            const factor = range === 0 ? 0 : (pos - s0.offset) / range;
            const op = UtilsHelper.lerp(s0.opacity, s1.opacity, factor);
            a = Math.round((op / 100) * 255);
            break;
          }
        }
      }
    }

    return { r, g, b, a };
  }

  /**
   * Generates a 256-entry Look-Up Table (Uint8ClampedArray) for rapid gradient mapping
   */
  generateLut256() {
    const lut = new Uint8ClampedArray(256 * 4);
    for (let i = 0; i < 256; i++) {
      const t = i / 255;
      const rgba = this.sample(t);
      const idx = i * 4;
      lut[idx]     = rgba.r;
      lut[idx + 1] = rgba.g;
      lut[idx + 2] = rgba.b;
      lut[idx + 3] = rgba.a;
    }
    return lut;
  }

  /**
   * Generates a CSS linear-gradient string for HTML UI element previews
   */
  getCssGradient(direction = 'to right') {
    const stops = this.colorStops.map(s => {
      // Find corresponding opacity at this offset
      const op = this.getOpacityAt(s.offset);
      const rgb = UtilsHelper.hexToRgb(s.color);
      const pct = (s.offset * 100).toFixed(1);
      return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${(op / 100).toFixed(2)}) ${pct}%`;
    });
    return `linear-gradient(${direction}, ${stops.join(', ')})`;
  }

  getOpacityAt(offset) {
    if (this.opacityStops.length === 0) return 100;
    if (offset <= this.opacityStops[0].offset) return this.opacityStops[0].opacity;
    if (offset >= this.opacityStops[this.opacityStops.length - 1].offset) {
      return this.opacityStops[this.opacityStops.length - 1].opacity;
    }
    for (let i = 0; i < this.opacityStops.length - 1; i++) {
      const o0 = this.opacityStops[i];
      const o1 = this.opacityStops[i + 1];
      if (offset >= o0.offset && offset <= o1.offset) {
        const range = o1.offset - o0.offset;
        const f = range === 0 ? 0 : (offset - o0.offset) / range;
        return UtilsHelper.lerp(o0.opacity, o1.opacity, f);
      }
    }
    return 100;
  }

  /**
   * Renders the gradient into target canvas context across full width & height
   * Supporting all 5 styles: linear, radial, angle, reflected, diamond
   */
  renderToCanvas(ctx, x1, y1, x2, y2, width, height, selection = null) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.hypot(dx, dy);
    if (dist === 0) return;

    const lut = this.generateLut256();

    // Render directly via pixel buffer for exact mathematical styling
    const imgData = ctx.getImageData(0, 0, width, height);
    const d = imgData.data;

    const angleStart = Math.atan2(dy, dx);
    const twoPi = Math.PI * 2;
    const invDistSq = 1.0 / (dist * dist);
    const invDist = 1.0 / dist;

    // Unit vector for reflected gradient
    const ux = dx / dist;
    const uy = dy / dist;

    for (let y = 0; y < height; y++) {
      const rowOffset = y * width;
      for (let x = 0; x < width; x++) {
        // Selection mask check
        if (selection) {
          if (selection.mask && !selection.mask[rowOffset + x]) continue;
          if (x < selection.x || x >= selection.x + selection.w || y < selection.y || y >= selection.y + selection.h) continue;
        }

        const px = x - x1;
        const py = y - y1;
        let t = 0;

        switch (this.style) {
          case 'linear':
            // Project (px, py) onto (dx, dy)
            t = (px * dx + py * dy) * invDistSq;
            break;

          case 'radial':
            // Distance from start center
            t = Math.hypot(px, py) * invDist;
            break;

          case 'angle':
            // 360 degree sweep around center point
            let ang = Math.atan2(py, px) - angleStart;
            if (ang < 0) ang += twoPi;
            t = ang / twoPi;
            break;

          case 'reflected':
            // Distance from stroke axis
            const proj = Math.abs(px * ux + py * uy);
            t = proj * invDist;
            break;

          case 'diamond':
            // L1 Manhattan distance in rotated coordinates
            const rx = px * ux + py * uy;
            const ry = -px * uy + py * ux;
            t = (Math.abs(rx) + Math.abs(ry)) * invDist;
            break;

          default:
            t = (px * dx + py * dy) * invDistSq;
            break;
        }

        // Dithering to eliminate 8-bit banding
        if (this.dither) {
          // Spatial Bayer 2x2 matrix jitter
          const ditherJitter = (((x & 1) ^ (y & 1)) ? 0.5 : -0.5) / 255;
          t += ditherJitter;
        }

        const clampedT = Math.max(0, Math.min(1, t));
        const lutIdx = Math.round(clampedT * 255) * 4;

        const idx = (rowOffset + x) * 4;
        const srcAlpha = (lut[lutIdx + 3] / 255);

        if (srcAlpha >= 1.0) {
          d[idx]     = lut[lutIdx];
          d[idx + 1] = lut[lutIdx + 1];
          d[idx + 2] = lut[lutIdx + 2];
          d[idx + 3] = 255;
        } else if (srcAlpha > 0) {
          // Alpha blending over existing background
          const bgAlpha = d[idx + 3] / 255;
          const outAlpha = srcAlpha + bgAlpha * (1 - srcAlpha);
          if (outAlpha > 0) {
            d[idx]     = Math.round((lut[lutIdx] * srcAlpha + d[idx] * bgAlpha * (1 - srcAlpha)) / outAlpha);
            d[idx + 1] = Math.round((lut[lutIdx + 1] * srcAlpha + d[idx + 1] * bgAlpha * (1 - srcAlpha)) / outAlpha);
            d[idx + 2] = Math.round((lut[lutIdx + 2] * srcAlpha + d[idx + 2] * bgAlpha * (1 - srcAlpha)) / outAlpha);
            d[idx + 3] = Math.round(outAlpha * 255);
          }
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);
  }

  /**
   * Photoshop Pro Gradient Presets
   */
  static getPreset(presetName, fgColor = '#000000', bgColor = '#ffffff') {
    switch (presetName) {
      case 'fg-bg':
        return new GradientData({
          colorStops: [{ offset: 0, color: fgColor }, { offset: 1, color: bgColor }],
          opacityStops: [{ offset: 0, opacity: 100 }, { offset: 1, opacity: 100 }]
        });

      case 'fg-trans':
        return new GradientData({
          colorStops: [{ offset: 0, color: fgColor }, { offset: 1, color: fgColor }],
          opacityStops: [{ offset: 0, opacity: 100 }, { offset: 1, opacity: 0 }]
        });

      case 'black-white':
        return new GradientData({
          colorStops: [{ offset: 0, color: '#000000' }, { offset: 1, color: '#ffffff' }],
          opacityStops: [{ offset: 0, opacity: 100 }, { offset: 1, opacity: 100 }]
        });

      case 'rainbow':
        return new GradientData({
          colorStops: [
            { offset: 0.00, color: '#ff0000' },
            { offset: 0.17, color: '#ff7700' },
            { offset: 0.33, color: '#ffff00' },
            { offset: 0.50, color: '#00ff00' },
            { offset: 0.67, color: '#00ffff' },
            { offset: 0.83, color: '#0000ff' },
            { offset: 1.00, color: '#8800ff' }
          ],
          opacityStops: [{ offset: 0, opacity: 100 }, { offset: 1, opacity: 100 }]
        });

      case 'sunset':
        return new GradientData({
          colorStops: [
            { offset: 0.00, color: '#ff3b30' },
            { offset: 0.35, color: '#ff9500' },
            { offset: 0.70, color: '#af52de' },
            { offset: 1.00, color: '#0a1128' }
          ],
          opacityStops: [{ offset: 0, opacity: 100 }, { offset: 1, opacity: 100 }]
        });

      case 'neon':
        return new GradientData({
          colorStops: [
            { offset: 0.00, color: '#00f5d4' },
            { offset: 0.50, color: '#7b2cbf' },
            { offset: 1.00, color: '#f72585' }
          ],
          opacityStops: [{ offset: 0, opacity: 100 }, { offset: 1, opacity: 100 }]
        });

      case 'chrome':
        return new GradientData({
          colorStops: [
            { offset: 0.00, color: '#334155' },
            { offset: 0.45, color: '#e2e8f0' },
            { offset: 0.50, color: '#ffffff' },
            { offset: 0.55, color: '#1e293b' },
            { offset: 0.85, color: '#94a3b8' },
            { offset: 1.00, color: '#cbd5e1' }
          ],
          opacityStops: [{ offset: 0, opacity: 100 }, { offset: 1, opacity: 100 }]
        });

      case 'pastel':
        return new GradientData({
          colorStops: [
            { offset: 0.00, color: '#bbf7d0' },
            { offset: 0.33, color: '#fef08a' },
            { offset: 0.66, color: '#fed7aa' },
            { offset: 1.00, color: '#fbcfe8' }
          ],
          opacityStops: [{ offset: 0, opacity: 100 }, { offset: 1, opacity: 100 }]
        });

      case 'sepia':
        return new GradientData({
          colorStops: [
            { offset: 0.00, color: '#2b1d0c' },
            { offset: 0.40, color: '#704f2d' },
            { offset: 0.80, color: '#c7a77d' },
            { offset: 1.00, color: '#f4ede2' }
          ],
          opacityStops: [{ offset: 0, opacity: 100 }, { offset: 1, opacity: 100 }]
        });

      default:
        return GradientData.getPreset('fg-bg', fgColor, bgColor);
    }
  }
}

// ── Interactive Gradient Editor Modal Controller ──
class GradientEditorModal {
  constructor(app) {
    this.app = app;
    this.gradient = GradientData.getPreset('rainbow');
    this.activeColorStopIdx = 0;
    this.activeOpacityStopIdx = 0;
    this.activeStopType = 'color'; // 'color' | 'opacity'
    this.isOpen = false;
    this.onApplyCallback = null;
  }

  init() {
    this.bindDOM();
  }

  bindDOM() {
    const modal = document.getElementById('modal-gradient-editor');
    if (!modal) return;

    // Track click for adding new stops
    const strip = document.getElementById('ge-gradient-strip');
    const colorStopsTrack = document.getElementById('ge-color-stops-track');
    const opacityStopsTrack = document.getElementById('ge-opacity-stops-track');

    if (colorStopsTrack) {
      colorStopsTrack.addEventListener('click', (e) => {
        if (e.target.classList.contains('ge-stop-marker')) return;
        const rect = colorStopsTrack.getBoundingClientRect();
        const offset = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const sampleCol = this.gradient.sample(offset);
        const hex = this.rgbToHex(sampleCol.r, sampleCol.g, sampleCol.b);
        this.gradient.colorStops.push({ offset, color: hex });
        this.gradient.sortStops();
        this.activeStopType = 'color';
        this.activeColorStopIdx = this.gradient.colorStops.findIndex(s => Math.abs(s.offset - offset) < 0.001);
        this.renderEditorUI();
      });
    }

    if (opacityStopsTrack) {
      opacityStopsTrack.addEventListener('click', (e) => {
        if (e.target.classList.contains('ge-stop-marker')) return;
        const rect = opacityStopsTrack.getBoundingClientRect();
        const offset = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const currentOp = this.gradient.getOpacityAt(offset);
        this.gradient.opacityStops.push({ offset, opacity: Math.round(currentOp) });
        this.gradient.sortStops();
        this.activeStopType = 'opacity';
        this.activeOpacityStopIdx = this.gradient.opacityStops.findIndex(s => Math.abs(s.offset - offset) < 0.001);
        this.renderEditorUI();
      });
    }

    // Stop Properties Controls
    const colorPicker = document.getElementById('ge-stop-color');
    if (colorPicker) {
      colorPicker.addEventListener('input', (e) => {
        if (this.activeStopType === 'color' && this.gradient.colorStops[this.activeColorStopIdx]) {
          this.gradient.colorStops[this.activeColorStopIdx].color = e.target.value;
          this.renderEditorUI();
        }
      });
    }

    const opSlider = document.getElementById('ge-stop-opacity');
    const opVal = document.getElementById('val-ge-stop-opacity');
    if (opSlider) {
      opSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        if (opVal) opVal.textContent = `${val}%`;
        if (this.activeStopType === 'opacity' && this.gradient.opacityStops[this.activeOpacityStopIdx]) {
          this.gradient.opacityStops[this.activeOpacityStopIdx].opacity = val;
          this.renderEditorUI();
        }
      });
    }

    const locInput = document.getElementById('ge-stop-location');
    if (locInput) {
      locInput.addEventListener('input', (e) => {
        const pct = Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 0));
        const offset = pct / 100;
        if (this.activeStopType === 'color' && this.gradient.colorStops[this.activeColorStopIdx]) {
          this.gradient.colorStops[this.activeColorStopIdx].offset = offset;
          this.gradient.sortStops();
          this.activeColorStopIdx = this.gradient.colorStops.findIndex(s => Math.abs(s.offset - offset) < 0.001);
        } else if (this.activeStopType === 'opacity' && this.gradient.opacityStops[this.activeOpacityStopIdx]) {
          this.gradient.opacityStops[this.activeOpacityStopIdx].offset = offset;
          this.gradient.sortStops();
          this.activeOpacityStopIdx = this.gradient.opacityStops.findIndex(s => Math.abs(s.offset - offset) < 0.001);
        }
        this.renderEditorUI();
      });
    }

    const btnDeleteStop = document.getElementById('btn-ge-delete-stop');
    if (btnDeleteStop) {
      btnDeleteStop.addEventListener('click', () => {
        if (this.activeStopType === 'color' && this.gradient.colorStops.length > 2) {
          this.gradient.colorStops.splice(this.activeColorStopIdx, 1);
          this.activeColorStopIdx = Math.max(0, this.activeColorStopIdx - 1);
          this.renderEditorUI();
        } else if (this.activeStopType === 'opacity' && this.gradient.opacityStops.length > 2) {
          this.gradient.opacityStops.splice(this.activeOpacityStopIdx, 1);
          this.activeOpacityStopIdx = Math.max(0, this.activeOpacityStopIdx - 1);
          this.renderEditorUI();
        }
      });
    }

    // Preset selector
    const presetSelect = document.getElementById('ge-preset-select');
    if (presetSelect) {
      presetSelect.addEventListener('change', () => {
        const fg = this.app.colorPicker ? this.app.colorPicker.getFgHex() : '#000000';
        const bg = this.app.colorPicker ? this.app.colorPicker.getBgHex() : '#ffffff';
        this.gradient = GradientData.getPreset(presetSelect.value, fg, bg);
        this.activeColorStopIdx = 0;
        this.activeOpacityStopIdx = 0;
        this.renderEditorUI();
      });
    }

    // Reverse & Dither Toggles
    const chkReverse = document.getElementById('ge-reverse-check');
    if (chkReverse) {
      chkReverse.addEventListener('change', (e) => {
        this.gradient.reverse = e.target.checked;
        this.renderEditorUI();
      });
    }

    const chkDither = document.getElementById('ge-dither-check');
    if (chkDither) {
      chkDither.addEventListener('change', (e) => {
        this.gradient.dither = e.target.checked;
        this.renderEditorUI();
      });
    }

    // Style dropdown
    const styleSelect = document.getElementById('ge-style-select');
    if (styleSelect) {
      styleSelect.addEventListener('change', (e) => {
        this.gradient.style = e.target.value;
      });
    }

    // Modal buttons
    const btnApply = document.getElementById('btn-apply-gradient-editor');
    if (btnApply) {
      btnApply.addEventListener('click', () => {
        if (this.onApplyCallback) {
          this.onApplyCallback(this.gradient.clone());
        }
        this.close();
      });
    }

    const btnCancel = document.getElementById('btn-cancel-gradient-editor');
    if (btnCancel) {
      btnCancel.addEventListener('click', () => this.close());
    }

    const btnClose = modal.querySelector('.modal-close-btn');
    if (btnClose) {
      btnClose.addEventListener('click', () => this.close());
    }
  }

  open(initialGradient, onApply) {
    this.gradient = initialGradient ? initialGradient.clone() : GradientData.getPreset('rainbow');
    this.onApplyCallback = onApply;
    this.activeColorStopIdx = 0;
    this.activeOpacityStopIdx = 0;
    this.activeStopType = 'color';

    const modal = document.getElementById('modal-gradient-editor');
    if (modal) modal.classList.remove('hidden');
    this.isOpen = true;

    this.renderEditorUI();
  }

  close() {
    const modal = document.getElementById('modal-gradient-editor');
    if (modal) modal.classList.add('hidden');
    this.isOpen = false;
  }

  renderEditorUI() {
    // 1. Update preview strip CSS
    const strip = document.getElementById('ge-gradient-strip');
    if (strip) {
      strip.style.background = this.gradient.getCssGradient('to right');
    }

    // 2. Render Opacity Stops (Top track)
    const opTrack = document.getElementById('ge-opacity-stops-track');
    if (opTrack) {
      opTrack.innerHTML = '';
      this.gradient.opacityStops.forEach((stop, idx) => {
        const marker = document.createElement('div');
        marker.className = `ge-stop-marker ge-stop-opacity ${this.activeStopType === 'opacity' && this.activeOpacityStopIdx === idx ? 'active' : ''}`;
        marker.style.left = `${(stop.offset * 100)}%`;
        marker.title = `Opacity Stop: ${stop.opacity}% at ${(stop.offset * 100).toFixed(0)}%`;

        marker.addEventListener('click', (e) => {
          e.stopPropagation();
          this.activeStopType = 'opacity';
          this.activeOpacityStopIdx = idx;
          this.renderEditorUI();
        });

        opTrack.appendChild(marker);
      });
    }

    // 3. Render Color Stops (Bottom track)
    const colTrack = document.getElementById('ge-color-stops-track');
    if (colTrack) {
      colTrack.innerHTML = '';
      this.gradient.colorStops.forEach((stop, idx) => {
        const marker = document.createElement('div');
        marker.className = `ge-stop-marker ge-stop-color ${this.activeStopType === 'color' && this.activeColorStopIdx === idx ? 'active' : ''}`;
        marker.style.left = `${(stop.offset * 100)}%`;
        marker.style.setProperty('--stop-color', stop.color);
        marker.title = `Color Stop: ${stop.color} at ${(stop.offset * 100).toFixed(0)}%`;

        marker.addEventListener('click', (e) => {
          e.stopPropagation();
          this.activeStopType = 'color';
          this.activeColorStopIdx = idx;
          this.renderEditorUI();
        });

        colTrack.appendChild(marker);
      });
    }

    // 4. Update inputs for active stop
    const locInput = document.getElementById('ge-stop-location');
    const colorPicker = document.getElementById('ge-stop-color');
    const opSlider = document.getElementById('ge-stop-opacity');
    const opVal = document.getElementById('val-ge-stop-opacity');

    if (this.activeStopType === 'color') {
      const activeColor = this.gradient.colorStops[this.activeColorStopIdx];
      if (activeColor) {
        if (locInput) locInput.value = Math.round(activeColor.offset * 100);
        if (colorPicker) colorPicker.value = activeColor.color;
      }
    } else {
      const activeOp = this.gradient.opacityStops[this.activeOpacityStopIdx];
      if (activeOp) {
        if (locInput) locInput.value = Math.round(activeOp.offset * 100);
        if (opSlider) opSlider.value = activeOp.opacity;
        if (opVal) opVal.textContent = `${activeOp.opacity}%`;
      }
    }

    const chkRev = document.getElementById('ge-reverse-check');
    if (chkRev) chkRev.checked = this.gradient.reverse;
    const chkDit = document.getElementById('ge-dither-check');
    if (chkDit) chkDit.checked = this.gradient.dither;
    const styleSel = document.getElementById('ge-style-select');
    if (styleSel) styleSel.value = this.gradient.style;
  }

  rgbToHex(r, g, b) {
    const toHex = (c) => ('0' + Math.max(0, Math.min(255, c)).toString(16)).slice(-2);
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }
}

// Export for Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { GradientData, GradientEditorModal };
} else if (typeof window !== 'undefined') {
  window.GradientData = GradientData;
  window.GradientEditorModal = GradientEditorModal;
}
