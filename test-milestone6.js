/**
 * PixelForge Studio — Milestone 6 Automated Verification Test Suite
 * Validates Color Science & Workspace Navigation:
 *  - GradientData Multi-stop color and opacity model
 *  - 256-entry RGBA LUT generator with subpixel interpolation
 *  - All 5 gradient rendering styles: Linear, Radial, Angle 360°, Reflected, Diamond
 *  - Spatial dithering against 8-bit banding
 *  - Built-in pro presets (fg-bg, fg-trans, black-white, rainbow, sunset, neon, chrome, pastel, sepia)
 *  - Serialization toJSON / fromJSON and CSS gradient generation
 *  - Gradient Map filter & non-destructive adjustment layer luminance mapping
 *  - NavigatorManager thumbnail dimensions, viewport pan-box calculation, and coordinate mapping
 */

const assert = require('assert');

// ── Headless DOM & Canvas Mock Environment ──
function createMockCanvas(width, height) {
  const pixelBuffer = new Uint8ClampedArray(width * height * 4);

  const ctx = {
    canvas: null,
    width,
    height,
    fillStyle: '#000000',
    strokeStyle: '#000000',
    lineWidth: 1,
    globalAlpha: 1.0,
    globalCompositeOperation: 'source-over',

    save() {},
    restore() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
    fill() {},
    fillRect(x, y, w, h) {
      const col = parseHex(ctx.fillStyle);
      for (let cy = y; cy < y + h; cy++) {
        for (let cx = x; cx < x + w; cx++) {
          if (cx >= 0 && cx < width && cy >= 0 && cy < height) {
            const idx = (cy * width + cx) * 4;
            pixelBuffer[idx]     = col.r;
            pixelBuffer[idx + 1] = col.g;
            pixelBuffer[idx + 2] = col.b;
            pixelBuffer[idx + 3] = 255;
          }
        }
      }
    },
    clearRect(x, y, w, h) {
      for (let cy = y; cy < y + h; cy++) {
        for (let cx = x; cx < x + w; cx++) {
          if (cx >= 0 && cx < width && cy >= 0 && cy < height) {
            const idx = (cy * width + cx) * 4;
            pixelBuffer[idx + 3] = 0;
          }
        }
      }
    },
    drawImage(src, sx, sy, sw, sh, dx, dy, dw, dh) {
      const srcCanvas = src.canvas ? src.canvas : src;
      const srcCtx = srcCanvas.getContext ? srcCanvas.getContext('2d') : null;
      if (!srcCtx) return;
      const sW = srcCanvas.width;
      const sH = srcCanvas.height;
      const sImg = srcCtx.getImageData(0, 0, sW, sH);
      const sData = sImg.data;

      for (let y = 0; y < sH; y++) {
        for (let x = 0; x < sW; x++) {
          if (x < width && y < height) {
            const sIdx = (y * sW + x) * 4;
            const dIdx = (y * width + x) * 4;
            const srcAlpha = sData[sIdx + 3] / 255;
            if (srcAlpha > 0) {
              pixelBuffer[dIdx]     = sData[sIdx];
              pixelBuffer[dIdx + 1] = sData[sIdx + 1];
              pixelBuffer[dIdx + 2] = sData[sIdx + 2];
              pixelBuffer[dIdx + 3] = sData[sIdx + 3];
            }
          }
        }
      }
    },
    getImageData(x, y, w, h) {
      const copy = new Uint8ClampedArray(w * h * 4);
      for (let cy = 0; cy < h; cy++) {
        for (let cx = 0; cx < w; cx++) {
          const srcIdx = ((y + cy) * width + (x + cx)) * 4;
          const dstIdx = (cy * w + cx) * 4;
          if (srcIdx >= 0 && srcIdx + 3 < pixelBuffer.length) {
            copy[dstIdx]     = pixelBuffer[srcIdx];
            copy[dstIdx + 1] = pixelBuffer[srcIdx + 1];
            copy[dstIdx + 2] = pixelBuffer[srcIdx + 2];
            copy[dstIdx + 3] = pixelBuffer[srcIdx + 3];
          }
        }
      }
      return { width: w, height: h, data: copy };
    },
    putImageData(imgData, x, y) {
      const d = imgData.data;
      for (let cy = 0; cy < imgData.height; cy++) {
        for (let cx = 0; cx < imgData.width; cx++) {
          const dstIdx = ((y + cy) * width + (x + cx)) * 4;
          const srcIdx = (cy * imgData.width + cx) * 4;
          if (dstIdx >= 0 && dstIdx + 3 < pixelBuffer.length) {
            pixelBuffer[dstIdx]     = d[srcIdx];
            pixelBuffer[dstIdx + 1] = d[srcIdx + 1];
            pixelBuffer[dstIdx + 2] = d[srcIdx + 2];
            pixelBuffer[dstIdx + 3] = d[srcIdx + 3];
          }
        }
      }
    }
  };

  const canvas = {
    width,
    height,
    style: {},
    getContext: (type) => ctx,
    getBoundingClientRect: () => ({ left: 0, top: 0, width, height })
  };
  ctx.canvas = canvas;
  return { canvas, ctx, pixelBuffer };
}

function parseHex(hex) {
  let c = hex.replace('#', '');
  if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
  const num = parseInt(c, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function createMockElement(tag = 'div') {
  return {
    tagName: tag.toUpperCase(),
    style: {},
    dataset: {},
    children: [],
    innerHTML: '',
    appendChild(c) { this.children.push(c); },
    removeChild(c) {
      const idx = this.children.indexOf(c);
      if (idx !== -1) this.children.splice(idx, 1);
    },
    classList: {
      _set: new Set(),
      add(c) { this._set.add(c); },
      remove(c) { this._set.delete(c); },
      contains(c) { return this._set.has(c); },
      toggle(c, f) {
        if (f !== undefined) {
          if (f) this._set.add(c); else this._set.delete(c);
        } else {
          if (this._set.has(c)) this._set.delete(c); else this._set.add(c);
        }
      }
    },
    addEventListener() {},
    clientWidth: 800,
    clientHeight: 600,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 220, height: 124 }),
    querySelectorAll: () => [],
    querySelector: () => null
  };
}

// Setup global browser mock for Node.js
if (typeof document === 'undefined') {
  global.document = {
    createElement(tag) {
      if (tag === 'canvas') return createMockCanvas(100, 100).canvas;
      return createMockElement(tag);
    },
    getElementById(id) {
      return createMockElement('div');
    },
    querySelectorAll: () => [],
    querySelector: () => null
  };
  global.window = {
    addEventListener() {},
    removeEventListener() {},
    innerWidth: 1920,
    innerHeight: 1080
  };
}

// Load Modules
const Utils = require('./js/utils.js');
global.Utils = Utils;
Utils.createCanvas = (w, h) => createMockCanvas(w, h).canvas;

const { GradientData, GradientEditorModal } = require('./js/gradient-engine.js');
const { NavigatorManager } = require('./js/navigator.js');
const { Filters } = require('./js/filters.js');
global.Filters = Filters;
const { LayerManager } = require('./js/layers.js');

let passCount = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passCount++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(err);
    process.exit(1);
  }
}

console.log('════════════════════════════════════════════════════════════════');
console.log('  PixelForge Studio — Milestone 6: Color Science & Navigation');
console.log('════════════════════════════════════════════════════════════════\n');

// ── Test Section 1: GradientData Core & LUT Generation ──
console.log('► Test Group 1: GradientData Model & 256-LUT Generation');

test('GradientData initializes with default stops and sorts correctly', () => {
  const grad = new GradientData({
    colorStops: [
      { offset: 0.8, color: '#00ff00' },
      { offset: 0.1, color: '#ff0000' },
      { offset: 0.5, color: '#0000ff' }
    ]
  });

  assert.strictEqual(grad.colorStops.length, 3);
  grad.sortStops();
  assert.strictEqual(grad.colorStops[0].offset, 0.1);
  assert.strictEqual(grad.colorStops[1].offset, 0.5);
  assert.strictEqual(grad.colorStops[2].offset, 0.8);
});

test('GradientData samples color accurately with linear interpolation', () => {
  const grad = new GradientData({
    colorStops: [
      { offset: 0.0, color: '#000000' }, // R:0, G:0, B:0
      { offset: 1.0, color: '#ffffff' }  // R:255, G:255, B:255
    ]
  });

  const c0 = grad.sample(0.0);
  assert.strictEqual(c0.r, 0);
  assert.strictEqual(c0.g, 0);
  assert.strictEqual(c0.b, 0);

  const c1 = grad.sample(1.0);
  assert.strictEqual(c1.r, 255);
  assert.strictEqual(c1.g, 255);
  assert.strictEqual(c1.b, 255);

  const cMid = grad.sample(0.5);
  assert.strictEqual(Math.round(cMid.r), 128);
  assert.strictEqual(Math.round(cMid.g), 128);
  assert.strictEqual(Math.round(cMid.b), 128);
});

test('GradientData evaluates opacity stops correctly', () => {
  const grad = new GradientData({
    opacityStops: [
      { offset: 0.0, opacity: 100 },
      { offset: 0.5, opacity: 50 },
      { offset: 1.0, opacity: 0 }
    ]
  });

  assert.strictEqual(grad.getOpacityAt(0.0), 100);
  assert.strictEqual(grad.getOpacityAt(0.5), 50);
  assert.strictEqual(grad.getOpacityAt(1.0), 0);
  assert.strictEqual(Math.round(grad.getOpacityAt(0.25)), 75);
});

test('generateLut256 generates a 1024-byte table with accurate RGBA values', () => {
  const grad = new GradientData({
    colorStops: [
      { offset: 0.0, color: '#ff0000' },
      { offset: 1.0, color: '#0000ff' }
    ],
    opacityStops: [
      { offset: 0.0, opacity: 100 },
      { offset: 1.0, opacity: 0 }
    ]
  });

  const lut = grad.generateLut256();
  assert.strictEqual(lut.length, 256 * 4);

  // Offset 0: pure red, full alpha
  assert.strictEqual(lut[0], 255);
  assert.strictEqual(lut[1], 0);
  assert.strictEqual(lut[2], 0);
  assert.strictEqual(lut[3], 255);

  // Offset 255: pure blue, zero alpha
  assert.strictEqual(lut[255 * 4], 0);
  assert.strictEqual(lut[255 * 4 + 1], 0);
  assert.strictEqual(lut[255 * 4 + 2], 255);
  assert.strictEqual(lut[255 * 4 + 3], 0);

  // Offset 128: midpoint violet, ~50% alpha
  const midIdx = 128 * 4;
  assert(lut[midIdx] > 100 && lut[midIdx] < 150);
  assert(lut[midIdx + 2] > 100 && lut[midIdx + 2] < 150);
  assert(lut[midIdx + 3] >= 126 && lut[midIdx + 3] <= 129);
});

test('GradientData clone creates a fully decoupled copy', () => {
  const grad1 = GradientData.getPreset('rainbow');
  const grad2 = grad1.clone();

  assert.strictEqual(grad1.colorStops.length, grad2.colorStops.length);
  grad2.colorStops[0].color = '#123456';
  assert.notStrictEqual(grad1.colorStops[0].color, grad2.colorStops[0].color);
});

test('GradientData toJSON and fromJSON preserve all stops, styles, and flags', () => {
  const orig = new GradientData({
    colorStops: [
      { offset: 0.0, color: '#112233' },
      { offset: 0.4, color: '#445566' },
      { offset: 1.0, color: '#778899' }
    ],
    opacityStops: [
      { offset: 0.0, opacity: 80 },
      { offset: 1.0, opacity: 20 }
    ],
    style: 'radial',
    reverse: true,
    dither: false
  });

  const json = orig.toJSON();
  const restored = GradientData.fromJSON(json);

  assert.strictEqual(restored.style, 'radial');
  assert.strictEqual(restored.reverse, true);
  assert.strictEqual(restored.dither, false);
  assert.strictEqual(restored.colorStops.length, 3);
  assert.strictEqual(restored.colorStops[1].color, '#445566');
  assert.strictEqual(restored.opacityStops.length, 2);
  assert.strictEqual(restored.opacityStops[0].opacity, 80);
});

test('GradientData generates valid CSS linear-gradient string', () => {
  const grad = GradientData.getPreset('black-white');
  const css = grad.getCssGradient('to right');
  assert(css.startsWith('linear-gradient(to right,'));
  assert(css.includes('rgba(0, 0, 0'));
  assert(css.includes('rgba(255, 255, 255'));
});

// ── Test Section 2: Pro Presets & All 5 Rendering Styles ──
console.log('\n► Test Group 2: All 5 Gradient Styles & Pro Presets');

test('GradientData.getPreset loads all 9 built-in pro presets', () => {
  const presets = ['fg-bg', 'fg-trans', 'black-white', 'rainbow', 'sunset', 'neon', 'chrome', 'pastel', 'sepia'];
  for (const p of presets) {
    const g = GradientData.getPreset(p, '#ff0000', '#00ff00');
    assert(g instanceof GradientData, `Preset ${p} should return GradientData`);
    assert(g.colorStops.length >= 2, `Preset ${p} should have at least 2 color stops`);
    assert(g.opacityStops.length >= 2, `Preset ${p} should have at least 2 opacity stops`);
  }
});

test('renderToCanvas accurately renders Linear Gradient', () => {
  const { canvas, ctx } = createMockCanvas(50, 50);
  const grad = new GradientData({
    colorStops: [{ offset: 0, color: '#000000' }, { offset: 1, color: '#ffffff' }],
    style: 'linear',
    dither: false
  });

  // Render from (0, 0) to (49, 0) (horizontal)
  grad.renderToCanvas(ctx, 0, 0, 49, 0, 50, 50);
  const imgData = ctx.getImageData(0, 0, 50, 50);

  // Left edge should be black (0, 0, 0)
  assert.strictEqual(imgData.data[0], 0);
  assert.strictEqual(imgData.data[1], 0);
  assert.strictEqual(imgData.data[2], 0);

  // Right edge should be white (255, 255, 255)
  const rightIdx = 49 * 4;
  assert.strictEqual(imgData.data[rightIdx], 255);
  assert.strictEqual(imgData.data[rightIdx + 1], 255);
  assert.strictEqual(imgData.data[rightIdx + 2], 255);

  // Midpoint (25, 0) should be neutral gray ~128
  const midIdx = 25 * 4;
  assert(imgData.data[midIdx] >= 125 && imgData.data[midIdx] <= 135);
});

test('renderToCanvas accurately renders Radial Gradient', () => {
  const { canvas, ctx } = createMockCanvas(60, 60);
  const grad = new GradientData({
    colorStops: [{ offset: 0, color: '#ff0000' }, { offset: 1, color: '#0000ff' }],
    style: 'radial',
    dither: false
  });

  // Center at (30, 30), radius to (60, 30) (r = 30)
  grad.renderToCanvas(ctx, 30, 30, 60, 30, 60, 60);
  const imgData = ctx.getImageData(0, 0, 60, 60);

  // Center point (30, 30) must be pure red (255, 0, 0)
  const centerIdx = (30 * 60 + 30) * 4;
  assert.strictEqual(imgData.data[centerIdx], 255);
  assert.strictEqual(imgData.data[centerIdx + 2], 0);

  // Outer point at (60, 30) should be pure blue (0, 0, 255)
  const outerIdx = (30 * 60 + 59) * 4;
  assert(imgData.data[outerIdx + 2] >= 240);
});

test('renderToCanvas accurately renders Angle (Conical Sweep) Gradient', () => {
  const { canvas, ctx } = createMockCanvas(60, 60);
  const grad = new GradientData({
    colorStops: [{ offset: 0, color: '#000000' }, { offset: 1, color: '#ffffff' }],
    style: 'angle',
    dither: false
  });

  // Center (30, 30), stroke right to (59, 30)
  grad.renderToCanvas(ctx, 30, 30, 59, 30, 60, 60);
  const imgData = ctx.getImageData(0, 0, 60, 60);

  // At angle 0 (right from center): offset is near 0 -> black
  const rightIdx = (30 * 60 + 45) * 4;
  assert(imgData.data[rightIdx] < 20);

  // At angle pi (left from center): offset is ~0.5 -> mid gray
  const leftIdx = (30 * 60 + 15) * 4;
  assert(imgData.data[leftIdx] >= 115 && imgData.data[leftIdx] <= 145);
});

test('renderToCanvas accurately renders Reflected Gradient', () => {
  const { canvas, ctx } = createMockCanvas(60, 60);
  const grad = new GradientData({
    colorStops: [{ offset: 0, color: '#ff0000' }, { offset: 1, color: '#00ff00' }],
    style: 'reflected',
    dither: false
  });

  // Center line (30, 30) with distance vector to (50, 30) (R = 20)
  grad.renderToCanvas(ctx, 30, 30, 50, 30, 60, 60);
  const imgData = ctx.getImageData(0, 0, 60, 60);

  // Center axis (30, 30) should be start color red
  const centerIdx = (30 * 60 + 30) * 4;
  assert.strictEqual(imgData.data[centerIdx], 255);
  assert.strictEqual(imgData.data[centerIdx + 1], 0);

  // Reflected points at +15px (45, 30) and -15px (15, 30) must have identical colors
  const posIdx = (30 * 60 + 45) * 4;
  const negIdx = (30 * 60 + 15) * 4;
  assert.strictEqual(imgData.data[posIdx], imgData.data[negIdx]);
  assert.strictEqual(imgData.data[posIdx + 1], imgData.data[negIdx + 1]);
});

test('renderToCanvas accurately renders Diamond Gradient', () => {
  const { canvas, ctx } = createMockCanvas(60, 60);
  const grad = new GradientData({
    colorStops: [{ offset: 0, color: '#ffffff' }, { offset: 1, color: '#000000' }],
    style: 'diamond',
    dither: false
  });

  grad.renderToCanvas(ctx, 30, 30, 50, 30, 60, 60);
  const imgData = ctx.getImageData(0, 0, 60, 60);

  // Center (30, 30) must be white (255)
  const centerIdx = (30 * 60 + 30) * 4;
  assert.strictEqual(imgData.data[centerIdx], 255);

  // Diamond boundary: equidistant Manhattan offsets (|dx| + |dy| = 10)
  // (40, 30) and (30, 40) must have identical luminance
  const pt1 = (30 * 60 + 40) * 4;
  const pt2 = (40 * 60 + 30) * 4;
  assert.strictEqual(imgData.data[pt1], imgData.data[pt2]);
});

test('Dithering applies smooth spatial variations across pixels', () => {
  const { ctx: ctxNoDither } = createMockCanvas(40, 40);
  const { ctx: ctxDither } = createMockCanvas(40, 40);

  const gradNoDither = new GradientData({
    colorStops: [{ offset: 0, color: '#000000' }, { offset: 1, color: '#ffffff' }],
    dither: false
  });
  const gradDither = new GradientData({
    colorStops: [{ offset: 0, color: '#000000' }, { offset: 1, color: '#ffffff' }],
    dither: true
  });

  gradNoDither.renderToCanvas(ctxNoDither, 0, 0, 40, 0, 40, 40);
  gradDither.renderToCanvas(ctxDither, 0, 0, 40, 0, 40, 40);

  const d1 = ctxNoDither.getImageData(0, 0, 40, 40).data;
  const d2 = ctxDither.getImageData(0, 0, 40, 40).data;

  // Dithered version should produce different, high-frequency spatial variation
  let diffCount = 0;
  for (let i = 0; i < d1.length; i += 4) {
    if (d1[i] !== d2[i]) diffCount++;
  }
  assert(diffCount > 50, 'Dithering must introduce subtle spatial variance to eliminate banding');
});

// ── Test Section 3: Gradient Map Filter & Adjustment Layer ──
console.log('\n► Test Group 3: Gradient Map Filter & Non-Destructive Adjustment Layer');

test('Filters.gradientMap maps grayscale luminance to gradient LUT colors', () => {
  const { ctx } = createMockCanvas(4, 1);
  const imgData = ctx.getImageData(0, 0, 4, 1);
  const d = imgData.data;

  // Pixel 0: Black (L = 0)
  d[0] = 0; d[1] = 0; d[2] = 0; d[3] = 255;
  // Pixel 1: Mid gray (L ~ 128)
  d[4] = 128; d[5] = 128; d[6] = 128; d[7] = 255;
  // Pixel 2: Pure White (L = 255)
  d[8] = 255; d[9] = 255; d[10] = 255; d[11] = 255;
  // Pixel 3: Primary Red (L = 0.299 * 255 ~ 76)
  d[12] = 255; d[13] = 0; d[14] = 0; d[15] = 255;

  const grad = new GradientData({
    colorStops: [
      { offset: 0.0, color: '#0000ff' }, // Black maps to Blue
      { offset: 1.0, color: '#ffff00' }  // White maps to Yellow
    ]
  });

  Filters.gradientMap(imgData, grad);

  // Pixel 0 (Black) -> Blue (R:0, G:0, B:255)
  assert.strictEqual(d[0], 0);
  assert.strictEqual(d[1], 0);
  assert.strictEqual(d[2], 255);

  // Pixel 2 (White) -> Yellow (R:255, G:255, B:0)
  assert.strictEqual(d[8], 255);
  assert.strictEqual(d[9], 255);
  assert.strictEqual(d[10], 0);

  // Pixel 1 (Mid gray) -> green-ish mix halfway between Blue and Yellow
  assert(d[4] > 100 && d[4] < 150);
  assert(d[5] > 100 && d[5] < 150);
  assert(d[6] > 100 && d[6] < 150);
});

test('LayerManager creates and applies gradientMap Adjustment Layer non-destructively', () => {
  const lm = new LayerManager(20, 20);
  const bg = lm.addLayer('Base', '#808080'); // midtone gray (128, 128, 128)

  const gradMapLayer = lm.addAdjustmentLayer('gradientMap', {
    gradientData: new GradientData({
      colorStops: [
        { offset: 0.0, color: '#ff0000' }, // Shadows -> Red
        { offset: 1.0, color: '#00ff00' }  // Highlights -> Green
      ]
    })
  });

  assert.strictEqual(gradMapLayer.type, 'adjustment');
  assert.strictEqual(gradMapLayer.adjustmentType, 'gradientMap');

  // Composite to target
  const { ctx: targetCtx } = createMockCanvas(20, 20);
  lm.compositeTo(targetCtx);

  const compData = targetCtx.getImageData(0, 0, 20, 20).data;
  // Midtone gray transformed through Red -> Green gradient map
  // Red = ~128, Green = ~128, Blue = 0
  assert(compData[0] > 100 && compData[0] < 150, 'Red channel should be intermediate');
  assert(compData[1] > 100 && compData[1] < 150, 'Green channel should be intermediate');
  assert.strictEqual(compData[2], 0, 'Blue channel should be zero');

  // Verify non-destructive: base layer remains intact gray (128, 128, 128)
  const baseData = bg.ctx.getImageData(0, 0, 20, 20).data;
  assert.strictEqual(baseData[0], 128);
  assert.strictEqual(baseData[1], 128);
  assert.strictEqual(baseData[2], 128);
});

// ── Test Section 4: NavigatorManager & Viewport Pan-Box ──
console.log('\n► Test Group 4: Navigator Palette & Viewport Pan-Box Math');

test('NavigatorManager calculates thumbnail dimensions preserving aspect ratio', () => {
  const mockApp = {
    width: 1920,
    height: 1080,
    zoom: 1.0,
    panX: 0,
    panY: 0
  };

  const nav = new NavigatorManager(mockApp);
  nav.thumbWidth = 220;
  nav.thumbHeight = 124;

  const dims = nav.getThumbnailDimensions();
  // 1920 / 1080 = 1.7778
  // Max fits in 220x124: 220 / 1.7778 = 123.75px height
  assert.strictEqual(dims.w, 220);
  assert(Math.abs(dims.h - 123.75) < 1.0);
});

test('NavigatorManager calculates pan-box coordinates and dimensions correctly', () => {
  const mockApp = {
    width: 2000,
    height: 1000,
    zoom: 2.0, // 200% zoom
    panX: 0,   // centered
    panY: 0
  };

  const nav = new NavigatorManager(mockApp);
  nav.thumbWidth = 200;
  nav.thumbHeight = 100;

  // Viewport container 1000x500
  const viewportW = 1000;
  const viewportH = 500;

  const box = nav.calculatePanBox(viewportW, viewportH);

  // At 2x zoom:
  // Visible doc width: 1000 / 2 = 500 (out of 2000 = 25%)
  // Visible doc height: 500 / 2 = 250 (out of 1000 = 25%)
  // Thumbnail is 200x100
  // Box w = 25% of 200 = 50px
  // Box h = 25% of 100 = 25px
  assert.strictEqual(Math.round(box.w), 50);
  assert.strictEqual(Math.round(box.h), 25);

  // Centered:
  // left = (200 - 50) / 2 = 75px
  // top = (100 - 25) / 2 = 37.5px
  assert.strictEqual(Math.round(box.left), 75);
  assert.strictEqual(Math.round(box.top), 38);
});

test('NavigatorManager centerViewportOn pans document center accurately', () => {
  let appliedPanX = null;
  let appliedPanY = null;

  const mockApp = {
    width: 1000,
    height: 1000,
    zoom: 1.5,
    panX: 0,
    panY: 0,
    applyViewportTransform() {
      appliedPanX = this.panX;
      appliedPanY = this.panY;
    }
  };

  const nav = new NavigatorManager(mockApp);

  // Center on document point (800, 200)
  nav.centerViewportOn(800, 200);

  // Screen X offset formula: panX = -(docX - docW / 2) * zoom
  // docX - docW / 2 = 800 - 500 = +300
  // panX = -300 * 1.5 = -450
  assert.strictEqual(appliedPanX, -450);

  // docY - docH / 2 = 200 - 500 = -300
  // panY = -(-300) * 1.5 = +450
  assert.strictEqual(appliedPanY, 450);
});

console.log('\n════════════════════════════════════════════════════════════════');
console.log(`  Milestone 6 Test Suite: ${passCount} / ${passCount} Passed (100%)`);
console.log('════════════════════════════════════════════════════════════════\n');
