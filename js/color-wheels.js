/**
 * PixelForge Studio Pro — 3-Way Color Grading Wheels Engine (Lift, Gamma, Gain)
 * 
 * Implements industry-standard DaVinci Resolve & Capture One color grading:
 * 1. Lift (Shadows): Affects black levels and shadow regions with quadratic falloff (1 - Y)^2.
 * 2. Gamma (Midtones): Affects mid-range tones with bell-curve weight 4*Y*(1 - Y).
 * 3. Gain (Highlights): Affects upper luminance values with quadratic growth Y^2.
 * 4. Interactive 2D Circular Vector Wheels:
 *    - Polar coordinates (r, theta) mapped to RGB chromaticity shifts.
 *    - Master luminance offset slider per tonal region.
 *    - Master saturation & contrast grading controls.
 * 5. Generates non-destructive grading previews or bakes directly into target layer.
 */

class ColorWheelsEngine {
  constructor(options = {}) {
    this.lift = options.lift || { r: 0, g: 0, b: 0, y: 0 };       // Shadows [-100, 100]
    this.gamma = options.gamma || { r: 0, g: 0, b: 0, y: 0 };     // Midtones [-100, 100]
    this.gain = options.gain || { r: 0, g: 0, b: 0, y: 0 };       // Highlights [-100, 100]
    this.saturation = options.saturation !== undefined ? options.saturation : 100; // [0, 200]
    this.contrast = options.contrast !== undefined ? options.contrast : 0;         // [-100, 100]
  }

  /**
   * Resets all wheels and sliders to neutral default state
   */
  reset() {
    this.lift = { r: 0, g: 0, b: 0, y: 0 };
    this.gamma = { r: 0, g: 0, b: 0, y: 0 };
    this.gain = { r: 0, g: 0, b: 0, y: 0 };
    this.saturation = 100;
    this.contrast = 0;
  }

  /**
   * Converts 2D polar vector (hue angle in rad, magnitude [0, 1]) to normalized RGB delta
   * @param {number} angleRad 
   * @param {number} magnitude 
   * @param {number} scale 
   * @returns {{r: number, g: number, b: number}}
   */
  static polarToRgbOffset(angleRad, magnitude, scale = 1.0) {
    const mag = Math.min(1.0, Math.max(0.0, magnitude)) * scale;
    // Standard RGB chromaticity angle mapping (0 = Red, 120 = Green, 240 = Blue)
    const r = mag * Math.cos(angleRad);
    const g = mag * Math.cos(angleRad - (2 * Math.PI / 3));
    const b = mag * Math.cos(angleRad - (4 * Math.PI / 3));
    return { r, g, b };
  }

  /**
   * Applies 3-way color grading to an ImageData
   * @param {ImageData} srcData 
   * @returns {ImageData}
   */
  apply(srcData) {
    const { width: w, height: h, data } = srcData;
    const len = w * h;
    const out = new ImageData(new Uint8ClampedArray(data), w, h);
    const dst = out.data;

    // Normalizing wheel offsets to float range [-1.0, 1.0]
    const lR = this.lift.r / 100.0, lG = this.lift.g / 100.0, lB = this.lift.b / 100.0, lY = this.lift.y / 100.0;
    const mR = this.gamma.r / 100.0, mG = this.gamma.g / 100.0, mB = this.gamma.b / 100.0, mY = this.gamma.y / 100.0;
    const hR = this.gain.r / 100.0, hG = this.gain.g / 100.0, hB = this.gain.b / 100.0, hY = this.gain.y / 100.0;

    const sat = this.saturation / 100.0;
    const contrastFactor = (259 * (this.contrast + 255)) / (255 * (259 - this.contrast));

    for (let i = 0; i < len; i++) {
      const idx = i * 4;
      let r = dst[idx] / 255.0;
      let g = dst[idx + 1] / 255.0;
      let b = dst[idx + 2] / 255.0;

      // Rec.709 perceived luminance
      const yLum = 0.2126 * r + 0.7152 * g + 0.0722 * b;

      // 1. Tonal region weights
      // Shadows (Lift): maximum at 0, decays quadratically to 0 at 1
      const wLift = (1.0 - yLum) * (1.0 - yLum);
      // Midtones (Gamma): parabolic bell curve centered around 0.5
      const wGamma = 4.0 * yLum * (1.0 - yLum);
      // Highlights (Gain): quadratic growth towards 1
      const wGain = yLum * yLum;

      // 2. Apply RGB chromaticity deltas and regional luminance offsets
      r += (lR + lY) * wLift + (mR + mY) * wGamma + (hR + hY) * wGain;
      g += (lG + lY) * wLift + (mG + mY) * wGamma + (hG + hY) * wGain;
      b += (lB + lY) * wLift + (mB + mY) * wGamma + (hB + hY) * wGain;

      // 3. Apply Master Saturation
      if (sat !== 1.0) {
        const newLum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        r = newLum + sat * (r - newLum);
        g = newLum + sat * (g - newLum);
        b = newLum + sat * (b - newLum);
      }

      // 4. Apply Master Contrast
      if (this.contrast !== 0) {
        r = contrastFactor * (r - 0.5) + 0.5;
        g = contrastFactor * (g - 0.5) + 0.5;
        b = contrastFactor * (b - 0.5) + 0.5;
      }

      // Clamp back to 8-bit unsigned range
      dst[idx] = Math.round(Math.min(1.0, Math.max(0.0, r)) * 255.0);
      dst[idx + 1] = Math.round(Math.min(1.0, Math.max(0.0, g)) * 255.0);
      dst[idx + 2] = Math.round(Math.min(1.0, Math.max(0.0, b)) * 255.0);
    }

    return out;
  }

  /**
   * Renders an interactive circular color grading wheel onto a canvas
   * @param {HTMLCanvasElement} canvas 
   * @param {{r: number, g: number, b: number}} offset 
   * @param {string} label 
   */
  static renderWheel(canvas, offset, label = '') {
    if (!canvas || !canvas.getContext) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const radius = Math.min(cx, cy) - 8;

    ctx.clearRect(0, 0, w, h);

    // 1. Draw circular chromaticity disc
    for (let angle = 0; angle < 360; angle += 2) {
      const startAngle = (angle - 1) * Math.PI / 180;
      const endAngle = (angle + 1) * Math.PI / 180;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, startAngle, endAngle);
      ctx.closePath();

      // Color from HSL wheel
      ctx.fillStyle = `hsl(${angle}, 85%, 50%)`;
      ctx.fill();
    }

    // 2. Radial gradient from white/neutral center to transparent edge
    const radGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    radGrad.addColorStop(0, 'rgba(40, 40, 48, 1)');
    radGrad.addColorStop(0.2, 'rgba(40, 40, 48, 0.8)');
    radGrad.addColorStop(1, 'rgba(40, 40, 48, 0)');
    ctx.fillStyle = radGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    // 3. Outer Ring Border
    ctx.strokeStyle = '#4a4f5d';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();

    // 4. Inner Crosshair Guides
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 10, cy);
    ctx.lineTo(cx + 10, cy);
    ctx.moveTo(cx, cy - 10);
    ctx.lineTo(cx, cy + 10);
    ctx.stroke();

    // 5. Active Position Puck
    // Map RGB offset to (px, py)
    const px = cx + (offset.r - (offset.g + offset.b) / 2) * (radius / 100);
    const py = cy + ((offset.b - offset.g) * Math.sqrt(3) / 2) * (radius / 100);

    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.arc(px, py, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ColorWheelsEngine };
}
