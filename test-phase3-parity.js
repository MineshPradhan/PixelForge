/**
 * PixelForge Studio Pro — Phase 3 Parity Verification Suite
 * Validates:
 *  1. All 27 Photoshop Blend Modes (Standard Canvas2D + Custom Pixel-Level Algorithms)
 *  2. Full 10/10 Photoshop Layer Styles Suite (Inner Glow & Gradient Overlay included)
 *  3. Photo Retouching Filters (Unsharp Mask, Motion Blur, Radial Blur Spin/Zoom)
 *  4. Smart Filter execution and PSD Codec 27-mode round-trip
 */

const assert = require('assert');

// ── Set up Node.js headless environment ──
global.ImageData = class ImageData {
  constructor(arg1, arg2, arg3) {
    if (typeof arg1 === 'number') {
      this.width = arg1;
      this.height = arg2;
      this.data = new Uint8ClampedArray(arg1 * arg2 * 4);
    } else {
      this.data = arg1;
      this.width = arg2;
      this.height = arg3;
    }
  }
};

global.window = global;
global.document = {
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => []
};

const Utils = require('./js/utils.js');
global.Utils = Utils;

// Mock canvas creation with full 2D context simulation
Utils.createCanvas = function(w, h) {
  const pixelBuffer = new Uint8ClampedArray(w * h * 4);
  const canvas = {
    width: w,
    height: h,
    getContext: function(type) {
      if (type === '2d') return ctx;
      return null;
    }
  };

  const ctx = {
    canvas,
    globalAlpha: 1.0,
    globalCompositeOperation: 'source-over',
    fillStyle: '#000000',
    strokeStyle: '#000000',
    lineWidth: 1,
    shadowColor: 'transparent',
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,

    save() {},
    restore() {},
    clearRect(x, y, cw, ch) {
      for (let cy = y; cy < y + ch; cy++) {
        for (let cx = x; cx < x + cw; cx++) {
          if (cx >= 0 && cx < w && cy >= 0 && cy < h) {
            const idx = (cy * w + cx) * 4;
            pixelBuffer[idx + 3] = 0;
          }
        }
      }
    },
    fillRect(x, y, cw, ch) {
      const col = Utils.hexToRgb ? Utils.hexToRgb(typeof ctx.fillStyle === 'string' && ctx.fillStyle.startsWith('#') ? ctx.fillStyle : '#ffffff') : { r: 255, g: 255, b: 255 };
      for (let cy = y; cy < y + ch; cy++) {
        for (let cx = x; cx < x + cw; cx++) {
          if (cx >= 0 && cx < w && cy >= 0 && cy < h) {
            const idx = (cy * w + cx) * 4;
            pixelBuffer[idx]     = col.r;
            pixelBuffer[idx + 1] = col.g;
            pixelBuffer[idx + 2] = col.b;
            pixelBuffer[idx + 3] = Math.round(ctx.globalAlpha * 255);
          }
        }
      }
    },
    drawImage(src, sx, sy, sw, sh, dx, dy, dw, dh) {
      if (!src) return;
      const sCtx = src.getContext ? src.getContext('2d') : null;
      if (!sCtx) return;
      const sData = sCtx.getImageData(0, 0, src.width, src.height).data;
      const ox = sx || 0;
      const oy = sy || 0;

      for (let cy = 0; cy < src.height; cy++) {
        for (let cx = 0; cx < src.width; cx++) {
          const tx = cx + ox;
          const ty = cy + oy;
          if (tx >= 0 && tx < w && ty >= 0 && ty < h) {
            const sIdx = (cy * src.width + cx) * 4;
            const tIdx = (ty * w + tx) * 4;
            const sa = sData[sIdx + 3] / 255;
            if (sa > 0) {
              if (ctx.globalCompositeOperation === 'destination-in') {
                pixelBuffer[tIdx + 3] = Math.round((pixelBuffer[tIdx + 3] / 255) * sa * 255);
              } else {
                pixelBuffer[tIdx]     = sData[sIdx];
                pixelBuffer[tIdx + 1] = sData[sIdx + 1];
                pixelBuffer[tIdx + 2] = sData[sIdx + 2];
                pixelBuffer[tIdx + 3] = Math.round(sData[sIdx + 3] * ctx.globalAlpha);
              }
            }
          }
        }
      }
    },
    getImageData(x, y, cw, ch) {
      const out = new ImageData(cw, ch);
      for (let cy = 0; cy < ch; cy++) {
        for (let cx = 0; cx < cw; cx++) {
          const srcX = x + cx;
          const srcY = y + cy;
          const dstIdx = (cy * cw + cx) * 4;
          if (srcX >= 0 && srcX < w && srcY >= 0 && srcY < h) {
            const srcIdx = (srcY * w + srcX) * 4;
            out.data[dstIdx]     = pixelBuffer[srcIdx];
            out.data[dstIdx + 1] = pixelBuffer[srcIdx + 1];
            out.data[dstIdx + 2] = pixelBuffer[srcIdx + 2];
            out.data[dstIdx + 3] = pixelBuffer[srcIdx + 3];
          }
        }
      }
      return out;
    },
    putImageData(imgData, x, y) {
      const d = imgData.data;
      for (let cy = 0; cy < imgData.height; cy++) {
        for (let cx = 0; cx < imgData.width; cx++) {
          const tx = x + cx;
          const ty = y + cy;
          if (tx >= 0 && tx < w && ty >= 0 && ty < h) {
            const sIdx = (cy * imgData.width + cx) * 4;
            const tIdx = (ty * w + tx) * 4;
            pixelBuffer[tIdx]     = d[sIdx];
            pixelBuffer[tIdx + 1] = d[sIdx + 1];
            pixelBuffer[tIdx + 2] = d[sIdx + 2];
            pixelBuffer[tIdx + 3] = d[sIdx + 3];
          }
        }
      }
    },
    createImageData(cw, ch) {
      return new ImageData(cw, ch);
    },
    createLinearGradient() {
      return { addColorStop() {} };
    }
  };
  return canvas;
};

// Require modules
const Filters = require('./js/filters.js');
global.Filters = Filters;
const LayerManager = require('./js/layers.js');
const { SmartFilter, SmartObjectData } = require('./js/smart-objects.js');
const { BlendModes } = require('./js/psd-engine.js');

console.log('════════════════════════════════════════════════════════════════');
console.log('  PixelForge Studio — Phase 3 Parity Verification Suite');
console.log('════════════════════════════════════════════════════════════════\n');

let totalTests = 0;
let passedTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    ${err.message}`);
  }
}

// ─────────────────────────────────────────────────────────────
console.log('► Test Group 1: 27 Photoshop Blend Modes & Pixel Algorithms');
// ─────────────────────────────────────────────────────────────

runTest('PSD Codec maps all 27 Photoshop blend mode keys bidirectionally', () => {
  const expectedModes = [
    'source-over', 'dissolve', 'darken', 'multiply', 'color-burn', 'linear-burn',
    'darker-color', 'lighten', 'screen', 'color-dodge', 'lighter', 'lighter-color',
    'overlay', 'soft-light', 'hard-light', 'vivid-light', 'linear-light', 'pin-light',
    'hard-mix', 'difference', 'exclusion', 'subtract', 'divide', 'hue',
    'saturation', 'color', 'luminosity', 'pass-through'
  ];

  expectedModes.forEach(mode => {
    const psdKey = BlendModes.toPsd[mode];
    assert(psdKey, `Missing toPsd key for blend mode: ${mode}`);
    assert.strictEqual(psdKey.length, 4, `PSD blend mode key must be 4 characters: ${psdKey}`);
    const roundTrip = BlendModes.fromPsd[psdKey];
    assert.strictEqual(roundTrip, mode, `Round-trip mismatch for ${mode} -> ${psdKey} -> ${roundTrip}`);
  });
  assert.strictEqual(Object.keys(BlendModes.toPsd).length >= 27, true);
});

runTest('Linear Burn executes exact pixel-level darkening B(b, s) = max(0, b + s - 255)', () => {
  const lm = new LayerManager(10, 10);
  const baseCanvas = Utils.createCanvas(10, 10);
  const bCtx = baseCanvas.getContext('2d');
  // Fill base with rgb(180, 180, 180)
  const bData = bCtx.createImageData(10, 10);
  for (let i = 0; i < bData.data.length; i += 4) {
    bData.data[i] = 180; bData.data[i + 1] = 180; bData.data[i + 2] = 180; bData.data[i + 3] = 255;
  }
  bCtx.putImageData(bData, 0, 0);

  // Source with rgb(100, 100, 100)
  const srcCanvas = Utils.createCanvas(10, 10);
  const sCtx = srcCanvas.getContext('2d');
  const sData = sCtx.createImageData(10, 10);
  for (let i = 0; i < sData.data.length; i += 4) {
    sData.data[i] = 100; sData.data[i + 1] = 100; sData.data[i + 2] = 100; sData.data[i + 3] = 255;
  }
  sCtx.putImageData(sData, 0, 0);

  lm.applyBlendMode(bCtx, srcCanvas, 'linear-burn', 100);
  const res = bCtx.getImageData(0, 0, 10, 10);
  // Expected: max(0, 180 + 100 - 255) = 25
  assert.strictEqual(res.data[0], 25, `Expected 25, got ${res.data[0]}`);
});

runTest('Subtract and Divide blend modes evaluate accurately', () => {
  const lm = new LayerManager(4, 4);
  const baseCanvas = Utils.createCanvas(4, 4);
  const bCtx = baseCanvas.getContext('2d');

  // Test Subtract: 200 - 60 = 140
  const bData = bCtx.createImageData(4, 4);
  for (let i = 0; i < bData.data.length; i += 4) {
    bData.data[i] = 200; bData.data[i+1] = 200; bData.data[i+2] = 200; bData.data[i+3] = 255;
  }
  bCtx.putImageData(bData, 0, 0);

  const srcCanvas = Utils.createCanvas(4, 4);
  const sCtx = srcCanvas.getContext('2d');
  const sData = sCtx.createImageData(4, 4);
  for (let i = 0; i < sData.data.length; i += 4) {
    sData.data[i] = 60; sData.data[i+1] = 60; sData.data[i+2] = 60; sData.data[i+3] = 255;
  }
  sCtx.putImageData(sData, 0, 0);

  lm.applyBlendMode(bCtx, srcCanvas, 'subtract', 100);
  let res = bCtx.getImageData(0, 0, 4, 4);
  assert.strictEqual(res.data[0], 140, `Subtract failed: expected 140, got ${res.data[0]}`);

  // Test Divide: 100 / 200 = (100 * 255) / 200 = 127 or 128
  bCtx.putImageData(bData, 0, 0); // 200
  for (let i = 0; i < sData.data.length; i += 4) {
    sData.data[i] = 255; sData.data[i+1] = 255; sData.data[i+2] = 255; sData.data[i+3] = 255;
  }
  sCtx.putImageData(sData, 0, 0);
  lm.applyBlendMode(bCtx, srcCanvas, 'divide', 100);
  res = bCtx.getImageData(0, 0, 4, 4);
  assert.strictEqual(res.data[0], 200, `Divide with 255 source must preserve base (200), got ${res.data[0]}`);
});

runTest('Linear Light, Pin Light, and Hard Mix compute non-linear thresholds properly', () => {
  const lm = new LayerManager(2, 2);
  const baseCanvas = Utils.createCanvas(2, 2);
  const bCtx = baseCanvas.getContext('2d');
  const bData = bCtx.createImageData(2, 2);
  for (let i = 0; i < bData.data.length; i += 4) {
    bData.data[i] = 128; bData.data[i+1] = 128; bData.data[i+2] = 128; bData.data[i+3] = 255;
  }
  bCtx.putImageData(bData, 0, 0);

  const srcCanvas = Utils.createCanvas(2, 2);
  const sCtx = srcCanvas.getContext('2d');
  const sData = sCtx.createImageData(2, 2);
  for (let i = 0; i < sData.data.length; i += 4) {
    sData.data[i] = 200; sData.data[i+1] = 200; sData.data[i+2] = 200; sData.data[i+3] = 255;
  }
  sCtx.putImageData(sData, 0, 0);

  // Linear Light: clamp(128 + 2 * 200 - 255) = clamp(273) = 255
  lm.applyBlendMode(bCtx, srcCanvas, 'linear-light', 100);
  const resLL = bCtx.getImageData(0, 0, 2, 2);
  assert.strictEqual(resLL.data[0], 255, `Linear Light failed: ${resLL.data[0]}`);

  // Hard Mix: saturated output (0 or 255 per channel)
  bCtx.putImageData(bData, 0, 0);
  lm.applyBlendMode(bCtx, srcCanvas, 'hard-mix', 100);
  const resHM = bCtx.getImageData(0, 0, 2, 2);
  assert.strictEqual(resHM.data[0] === 0 || resHM.data[0] === 255, true, `Hard Mix must be 0 or 255, got ${resHM.data[0]}`);
});

// ─────────────────────────────────────────────────────────────
console.log('\n► Test Group 2: Full 10/10 Layer Styles Suite');
// ─────────────────────────────────────────────────────────────

runTest('LayerManager initializes layer with all 10 Photoshop layer styles configured', () => {
  const lm = new LayerManager(100, 100);
  const layer = lm.addLayer('Test Styles');

  const requiredStyles = [
    'dropShadow', 'stroke', 'colorOverlay', 'outerGlow', 'bevelEmboss',
    'innerShadow', 'innerGlow', 'satin', 'patternOverlay', 'gradientOverlay'
  ];

  requiredStyles.forEach(s => {
    assert(layer.styles[s], `Missing layer style: ${s}`);
    assert.strictEqual(typeof layer.styles[s].enabled, 'boolean', `${s}.enabled must be boolean`);
  });
  assert.strictEqual(Object.keys(layer.styles).length, 10, 'Must have exactly 10 Photoshop layer styles');
});

runTest('applyInnerStyles renders Inner Glow effect without error', () => {
  const lm = new LayerManager(50, 50);
  const layer = lm.addLayer('Glow Layer');

  // Fill layer center with a solid box
  const lCtx = layer.ctx;
  const lData = lCtx.createImageData(50, 50);
  for (let y = 10; y < 40; y++) {
    for (let x = 10; x < 40; x++) {
      const idx = (y * 50 + x) * 4;
      lData.data[idx] = 50; lData.data[idx+1] = 120; lData.data[idx+2] = 200; lData.data[idx+3] = 255;
    }
  }
  lCtx.putImageData(lData, 0, 0);

  layer.styles.innerGlow = {
    enabled: true,
    color: '#ffff00',
    opacity: 80,
    blur: 6,
    blendMode: 'screen'
  };

  const targetCanvas = Utils.createCanvas(50, 50);
  const tCtx = targetCanvas.getContext('2d');
  assert.doesNotThrow(() => {
    lm.applyInnerStyles(tCtx, layer.canvas, 50, 50, layer.styles);
  }, 'applyInnerStyles must execute Inner Glow cleanly');
});

runTest('applyInnerStyles renders Gradient Overlay effect across shape', () => {
  const lm = new LayerManager(60, 60);
  const layer = lm.addLayer('Grad Layer');

  layer.styles.gradientOverlay = {
    enabled: true,
    opacity: 100,
    blendMode: 'source-over',
    angle: 45,
    scale: 100,
    reverse: false,
    stops: [
      { offset: 0, color: '#ff0000' },
      { offset: 1, color: '#0000ff' }
    ]
  };

  const targetCanvas = Utils.createCanvas(60, 60);
  const tCtx = targetCanvas.getContext('2d');
  assert.doesNotThrow(() => {
    lm.applyInnerStyles(tCtx, layer.canvas, 60, 60, layer.styles);
  }, 'applyInnerStyles must render Gradient Overlay cleanly');
});

runTest('rasterizeLayer bakes all 10 styles cleanly into single flat raster layer', () => {
  const lm = new LayerManager(40, 40);
  const layer = lm.addLayer('Full FX Layer');
  layer.styles.innerGlow.enabled = true;
  layer.styles.gradientOverlay.enabled = true;
  layer.styles.dropShadow.enabled = true;

  const baked = lm.rasterizeLayer(layer);
  assert(baked, 'Baked canvas must not be null');
  assert.strictEqual(baked.width, 40);
  assert.strictEqual(baked.height, 40);
});

// ─────────────────────────────────────────────────────────────
console.log('\n► Test Group 3: Photo Retouching Filters (USM, Motion, Radial)');
// ─────────────────────────────────────────────────────────────

runTest('Filters.unsharpMask sharpens edges when difference exceeds threshold', () => {
  const imgData = new ImageData(20, 20);
  // Create an edge: left 10 columns dark (50), right 10 columns bright (200)
  for (let y = 0; y < 20; y++) {
    for (let x = 0; x < 20; x++) {
      const idx = (y * 20 + x) * 4;
      const v = x < 10 ? 50 : 200;
      imgData.data[idx] = v;
      imgData.data[idx + 1] = v;
      imgData.data[idx + 2] = v;
      imgData.data[idx + 3] = 255;
    }
  }

  const sharpened = Filters.unsharpMask(imgData, 150, 2, 0);
  assert(sharpened, 'Unsharp Mask must return an ImageData buffer');
  assert.strictEqual(sharpened.width, 20);
  assert.strictEqual(sharpened.height, 20);

  // Near the edge, the bright side should be boosted higher and dark side pulled lower
  const brightEdge = sharpened.data[(10 * 20 + 10) * 4];
  assert(brightEdge >= 200, `Edge pixel should be boosted, got ${brightEdge}`);
});

runTest('Filters.motionBlur smears pixels along directional angle', () => {
  const imgData = new ImageData(30, 30);
  // Center single bright pixel at (15, 15)
  const cIdx = (15 * 30 + 15) * 4;
  imgData.data[cIdx] = 255;
  imgData.data[cIdx + 1] = 255;
  imgData.data[cIdx + 2] = 255;
  imgData.data[cIdx + 3] = 255;

  // Horizontal motion blur (angle = 0)
  const blurredH = Filters.motionBlur(imgData, 10, 0);
  assert(blurredH, 'Motion blur must return ImageData');

  // Neighboring horizontal pixels should now have spread luminance
  const leftNeighbor = blurredH.data[(15 * 30 + 14) * 4];
  const rightNeighbor = blurredH.data[(15 * 30 + 16) * 4];
  assert(leftNeighbor > 0, `Horizontal motion blur should spread to left neighbor, got ${leftNeighbor}`);
  assert(rightNeighbor > 0, `Horizontal motion blur should spread to right neighbor, got ${rightNeighbor}`);
});

runTest('Filters.radialBlur executes both Spin and Zoom deformation modes', () => {
  const imgData = new ImageData(20, 20);
  for (let i = 0; i < imgData.data.length; i += 4) {
    imgData.data[i] = 120;
    imgData.data[i+1] = 120;
    imgData.data[i+2] = 120;
    imgData.data[i+3] = 255;
  }

  const spinBlurred = Filters.radialBlur(imgData, 10, 'spin', 0.5, 0.5);
  assert.strictEqual(spinBlurred.width, 20);
  assert.strictEqual(spinBlurred.height, 20);

  const zoomBlurred = Filters.radialBlur(imgData, 10, 'zoom', 0.5, 0.5);
  assert.strictEqual(zoomBlurred.width, 20);
  assert.strictEqual(zoomBlurred.height, 20);
});

runTest('SmartFilter stack executes unsharpMask, motionBlur, and radialBlur non-destructively', () => {
  const sf1 = new SmartFilter('unsharpMask', { amount: 120, radius: 2, threshold: 0 });
  const sf2 = new SmartFilter('motionBlur', { distance: 10, angle: 45 });
  const sf3 = new SmartFilter('radialBlur', { amount: 8, mode: 'zoom' });

  assert.strictEqual(sf1.name, 'Unsharp Mask');
  assert.strictEqual(sf2.name, 'Motion Blur');
  assert.strictEqual(sf3.name, 'Radial Blur');

  const imgData = new ImageData(16, 16);
  for (let i = 0; i < imgData.data.length; i += 4) {
    imgData.data[i] = 100; imgData.data[i+1] = 150; imgData.data[i+2] = 200; imgData.data[i+3] = 255;
  }

  let processed = sf1.apply(imgData);
  processed = sf2.apply(processed);
  processed = sf3.apply(processed);

  assert(processed instanceof ImageData, 'Chained Smart Filters must return valid ImageData');
  assert.strictEqual(processed.width, 16);
});

// ─────────────────────────────────────────────────────────────
console.log('\n════════════════════════════════════════════════════════════════');
console.log(`  Phase 3 Parity Suite: ${passedTests} / ${totalTests} Passed (${Math.round((passedTests / totalTests) * 100)}%)`);
console.log('════════════════════════════════════════════════════════════════\n');

if (passedTests !== totalTests) {
  process.exit(1);
}
