// ══════════════════════════════════════════════════════════════════════
// PixelForge Studio — Color Picker & Swatches Engine
// ══════════════════════════════════════════════════════════════════════

class ColorPickerManager {
  constructor() {
    this.fgColor = { r: 59, g: 130, b: 246 }; // Default blue
    this.bgColor = { r: 0, g: 0, b: 0 };
    this.isEditingFg = true;

    this.currentHue = 217; // 0 - 360
    this.satValPos = { x: 0.76, y: 0.04 }; // normalized 0 - 1

    this.isDraggingSatVal = false;
    this.isDraggingHue = false;

    this.onChange = null;
  }

  init() {
    this.satValCanvas = document.getElementById('cp-sat-val');
    this.satValCtx = this.satValCanvas.getContext('2d');

    this.hueCanvas = document.getElementById('cp-hue-strip');
    this.hueCtx = this.hueCanvas.getContext('2d');

    this.satValCursor = document.getElementById('cp-cursor');
    this.hueCursor = document.getElementById('cp-hue-cursor');

    this.fgSwatch = document.getElementById('fg-color-swatch');
    this.bgSwatch = document.getElementById('bg-color-swatch');

    this.hexInput = document.getElementById('color-hex-input');
    this.rInput = document.getElementById('color-r-input');
    this.gInput = document.getElementById('color-g-input');
    this.bInput = document.getElementById('color-b-input');

    this.bindEvents();
    this.renderHueStrip();
    this.renderSatValBox();
    this.updateUI();
  }

  bindEvents() {
    // ── 2D Saturation / Value Box ──
    const onSatValMove = (e) => {
      const rect = this.satValCanvas.getBoundingClientRect();
      const nx = Utils.clamp((e.clientX - rect.left) / rect.width, 0, 1);
      const ny = Utils.clamp((e.clientY - rect.top) / rect.height, 0, 1);
      this.satValPos = { x: nx, y: ny };

      // Convert HSV to RGB
      const s = nx;
      const v = 1 - ny;
      // Convert HSV to HSL
      const l = v * (1 - s / 2);
      const sl = (l === 0 || l === 1) ? 0 : (v - l) / Math.min(l, 1 - l);

      const rgb = Utils.hslToRgb(this.currentHue, sl * 100, l * 100);
      this.setActiveColor(rgb.r, rgb.g, rgb.b);
      this.updateCursorPositions();
    };

    this.satValCanvas.addEventListener('mousedown', (e) => {
      this.isDraggingSatVal = true;
      onSatValMove(e);
    });

    // ── 1D Hue Strip ──
    const onHueMove = (e) => {
      const rect = this.hueCanvas.getBoundingClientRect();
      const nx = Utils.clamp((e.clientX - rect.left) / rect.width, 0, 1);
      this.currentHue = Math.round(nx * 360);
      this.renderSatValBox();

      // Recalculate color with same SatVal
      const s = this.satValPos.x;
      const v = 1 - this.satValPos.y;
      const l = v * (1 - s / 2);
      const sl = (l === 0 || l === 1) ? 0 : (v - l) / Math.min(l, 1 - l);
      const rgb = Utils.hslToRgb(this.currentHue, sl * 100, l * 100);

      this.setActiveColor(rgb.r, rgb.g, rgb.b);
      this.updateCursorPositions();
    };

    this.hueCanvas.addEventListener('mousedown', (e) => {
      this.isDraggingHue = true;
      onHueMove(e);
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isDraggingSatVal) onSatValMove(e);
      if (this.isDraggingHue) onHueMove(e);
    });

    window.addEventListener('mouseup', () => {
      this.isDraggingSatVal = false;
      this.isDraggingHue = false;
    });

    // ── Manual Input Fields ──
    const parseRgbInputs = () => {
      const r = parseInt(this.rInput.value, 10) || 0;
      const g = parseInt(this.gInput.value, 10) || 0;
      const b = parseInt(this.bInput.value, 10) || 0;
      this.setActiveColor(r, g, b);
      this.syncPickerFromColor(this.getActiveColor());
    };

    this.rInput.addEventListener('change', parseRgbInputs);
    this.gInput.addEventListener('change', parseRgbInputs);
    this.bInput.addEventListener('change', parseRgbInputs);

    this.hexInput.addEventListener('change', () => {
      const rgb = Utils.hexToRgb(this.hexInput.value);
      this.setActiveColor(rgb.r, rgb.g, rgb.b);
      this.syncPickerFromColor(this.getActiveColor());
    });

    // ── Swatches clicks ──
    this.fgSwatch.addEventListener('click', () => {
      this.isEditingFg = true;
      this.syncPickerFromColor(this.fgColor);
    });

    this.bgSwatch.addEventListener('click', () => {
      this.isEditingFg = false;
      this.syncPickerFromColor(this.bgColor);
    });

    document.getElementById('btn-swap-colors').addEventListener('click', () => {
      this.swapColors();
    });

    document.getElementById('btn-default-colors').addEventListener('click', () => {
      this.resetDefaultColors();
    });

    // Preset palette chips
    document.querySelectorAll('.swatch-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const hex = chip.dataset.color;
        const rgb = Utils.hexToRgb(hex);
        this.setActiveColor(rgb.r, rgb.g, rgb.b);
        this.syncPickerFromColor(rgb);
      });
    });
  }

  renderHueStrip() {
    if (!this.hueCanvas || !this.hueCtx) return;
    const w = this.hueCanvas.width;
    const h = this.hueCanvas.height;
    const grad = this.hueCtx.createLinearGradient(0, 0, w, 0);
    for (let i = 0; i <= 360; i += 30) {
      grad.addColorStop(i / 360, `hsl(${i}, 100%, 50%)`);
    }
    this.hueCtx.fillStyle = grad;
    this.hueCtx.fillRect(0, 0, w, h);
  }

  renderSatValBox() {
    if (!this.satValCanvas || !this.satValCtx) return;
    const w = this.satValCanvas.width;
    const h = this.satValCanvas.height;
    const ctx = this.satValCtx;

    // Pure hue base
    const pure = Utils.hslToRgb(this.currentHue, 100, 50);

    // Horizontal White to Pure Hue
    const gradH = ctx.createLinearGradient(0, 0, w, 0);
    gradH.addColorStop(0, '#ffffff');
    gradH.addColorStop(1, `rgb(${pure.r}, ${pure.g}, ${pure.b})`);
    ctx.fillStyle = gradH;
    ctx.fillRect(0, 0, w, h);

    // Vertical Transparent to Black
    const gradV = ctx.createLinearGradient(0, 0, 0, h);
    gradV.addColorStop(0, 'rgba(0,0,0,0)');
    gradV.addColorStop(1, '#000000');
    ctx.fillStyle = gradV;
    ctx.fillRect(0, 0, w, h);
  }

  updateCursorPositions() {
    if (!this.satValCanvas || !this.satValCursor || !this.hueCanvas || !this.hueCursor) return;
    const w = this.satValCanvas.offsetWidth || this.satValCanvas.width || 100;
    const h = this.satValCanvas.offsetHeight || this.satValCanvas.height || 100;
    this.satValCursor.style.left = (this.satValPos.x * w) + 'px';
    this.satValCursor.style.top = (this.satValPos.y * h) + 'px';

    const hueW = this.hueCanvas.offsetWidth || this.hueCanvas.width || 100;
    this.hueCursor.style.left = ((this.currentHue / 360) * hueW) + 'px';
  }

  syncPickerFromColor(rgb) {
    const hsl = Utils.rgbToHsl(rgb.r, rgb.g, rgb.b);
    this.currentHue = hsl.h;

    // Approximate HSV from HSL
    const l = hsl.l / 100;
    const sl = hsl.s / 100;
    const v = l + sl * Math.min(l, 1 - l);
    const s = v === 0 ? 0 : 2 * (1 - l / v);

    this.satValPos = {
      x: Utils.clamp(s, 0, 1),
      y: Utils.clamp(1 - v, 0, 1)
    };

    this.renderSatValBox();
    this.updateCursorPositions();
    this.updateUI();
  }

  setActiveColor(r, g, b) {
    const color = {
      r: Utils.clamp(r, 0, 255),
      g: Utils.clamp(g, 0, 255),
      b: Utils.clamp(b, 0, 255)
    };

    if (this.isEditingFg) {
      this.fgColor = color;
    } else {
      this.bgColor = color;
    }

    this.updateUI();
    if (this.onChange) this.onChange(this.getActiveColor());
  }

  swapColors() {
    const tmp = this.fgColor;
    this.fgColor = this.bgColor;
    this.bgColor = tmp;
    this.syncPickerFromColor(this.getActiveColor());
    this.updateUI();
    if (this.onChange) this.onChange(this.getActiveColor());
  }

  resetDefaultColors() {
    this.fgColor = { r: 0, g: 0, b: 0 };
    this.bgColor = { r: 255, g: 255, b: 255 };
    this.syncPickerFromColor(this.getActiveColor());
    this.updateUI();
    if (this.onChange) this.onChange(this.getActiveColor());
  }

  getActiveColor() {
    return this.isEditingFg ? this.fgColor : this.bgColor;
  }

  getFgHex() {
    return Utils.rgbToHex(this.fgColor.r, this.fgColor.g, this.fgColor.b);
  }

  getBgHex() {
    return Utils.rgbToHex(this.bgColor.r, this.bgColor.g, this.bgColor.b);
  }

  getFgCss() {
    return `rgb(${this.fgColor.r}, ${this.fgColor.g}, ${this.fgColor.b})`;
  }

  getBgCss() {
    return `rgb(${this.bgColor.r}, ${this.bgColor.g}, ${this.bgColor.b})`;
  }

  updateUI() {
    if (this.fgSwatch) this.fgSwatch.style.background = this.getFgCss();
    if (this.bgSwatch) this.bgSwatch.style.background = this.getBgCss();

    const active = this.getActiveColor();
    if (this.hexInput) this.hexInput.value = Utils.rgbToHex(active.r, active.g, active.b);
    if (this.rInput) this.rInput.value = active.r;
    if (this.gInput) this.gInput.value = active.g;
    if (this.bInput) this.bInput.value = active.b;

    this.updateCursorPositions();
  }
}

if (typeof window !== 'undefined') {
  window.ColorPickerManager = ColorPickerManager;
}
if (typeof global !== 'undefined') {
  global.ColorPickerManager = ColorPickerManager;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ColorPickerManager;
}
