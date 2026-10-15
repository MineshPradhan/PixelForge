/**
 * PixelForge Studio — Milestone 5 Automated Verification Test Suite
 * Validates Advanced Retouching & Mesh Liquify:
 *  - Floating-point displacement mesh (dxField, dyField)
 *  - Liquify brushes (Forward Warp, Twirl CW/CCW, Pucker, Bloat, Push Left)
 *  - Reconstruct brush & Smooth Laplacian mesh relaxation
 *  - High-performance bilinear subpixel interpolation
 *  - Wireframe mesh grid generator
 *  - Dodge & Burn tonal targeting (Shadows, Midtones, Highlights)
 *  - Sponge saturation & desaturation engine
 *  - Spot Healing blemish inpainting with perimeter ring synthesis
 *  - History undo/redo across liquify and retouching operations
 */

const assert = require('assert');

// ── Mock DOM & HTML5 Canvas Context for Headless Node.js ──
function createMockCanvas(width, height) {
  const pixelBuffer = new Uint8ClampedArray(width * height * 4);
  const strokeCalls = [];

  const ctx = {
    canvas: null,
    width,
    height,
    fillStyle: '#000000',
    strokeStyle: '#00ffff',
    lineWidth: 1,
    globalAlpha: 1.0,
    globalCompositeOperation: 'source-over',
    font: '16px sans-serif',

    save() {},
    restore() {},
    beginPath() {},
    moveTo(x, y) { strokeCalls.push({ type: 'moveTo', x, y }); },
    lineTo(x, y) { strokeCalls.push({ type: 'lineTo', x, y }); },
    stroke() { strokeCalls.push({ type: 'stroke' }); },
    arc(x, y, r, sa, ea) {},
    fill() {},
    fillRect(x, y, w, h) {},
    clearRect(x, y, w, h) {
      const x0 = Math.max(0, Math.min(width, x));
      const y0 = Math.max(0, Math.min(height, y));
      const x1 = Math.max(0, Math.min(width, x + w));
      const y1 = Math.max(0, Math.min(height, y + h));
      for (let cy = y0; cy < y1; cy++) {
        for (let cx = x0; cx < x1; cx++) {
          const idx = (cy * width + cx) * 4;
          pixelBuffer[idx + 3] = 0;
        }
      }
    },
    drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh) {},
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
      const w = imgData.width;
      const h = imgData.height;
      const src = imgData.data;
      for (let cy = 0; cy < h; cy++) {
        for (let cx = 0; cx < w; cx++) {
          const srcIdx = (cy * w + cx) * 4;
          const dstIdx = ((y + cy) * width + (x + cx)) * 4;
          if (dstIdx >= 0 && dstIdx + 3 < pixelBuffer.length) {
            pixelBuffer[dstIdx]     = src[srcIdx];
            pixelBuffer[dstIdx + 1] = src[srcIdx + 1];
            pixelBuffer[dstIdx + 2] = src[srcIdx + 2];
            pixelBuffer[dstIdx + 3] = src[srcIdx + 3];
          }
        }
      }
    },
    createImageData(w, h) {
      return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) };
    },
    getStrokeCalls() { return strokeCalls; },
    getPixelBuffer() { return pixelBuffer; }
  };

  const canvas = {
    width,
    height,
    getContext: () => ctx,
    toDataURL: () => 'data:image/png;base64,mockPng'
  };
  ctx.canvas = canvas;
  return canvas;
}

// Global browser mocks
global.window = {
  Utils: {
    createCanvas: createMockCanvas,
    clamp: (v, min, max) => Math.max(min, Math.min(max, v)),
    lerp: (a, b, t) => a + (b - a) * t,
    dist: (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1),
    hexToRgb: (hex) => ({ r: 0, g: 0, b: 0 }),
    hexToRgba: (hex, a = 1) => `rgba(0,0,0,${a})`,
    rgbToHsl: (r, g, b) => {
      r /= 255; g /= 255; b /= 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      let h, s, l = (max + min) / 2;
      if (max === min) {
        h = s = 0;
      } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
          case r: h = (g - b) / d + (g < b ? 6 : 0); break;
          case g: h = (b - r) / d + 2; break;
          case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
      }
      return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
    },
    hslToRgb: (h, s, l) => {
      h /= 360; s /= 100; l /= 100;
      let r, g, b;
      if (s === 0) {
        r = g = b = l;
      } else {
        const hue2rgb = (p, q, t) => {
          if (t < 0) t += 1;
          if (t > 1) t -= 1;
          if (t < 1/6) return p + (q - p) * 6 * t;
          if (t < 1/2) return q;
          if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
          return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
      }
      return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
    }
  }
};
global.Utils = global.window.Utils;
global.document = {
  getElementById: (id) => null,
  createElement: (tag) => ({
    tagName: tag.toUpperCase(),
    className: '',
    style: {},
    appendChild: () => {},
    addEventListener: () => {},
    classList: { add: () => {}, remove: () => {}, toggle: () => {} },
    getContext: () => createMockCanvas(36, 26).getContext('2d')
  }),
  querySelectorAll: () => []
};

// Require PixelForge core modules
const HistoryManager = require('./js/history.js');
const LayerManager = require('./js/layers.js');
const { LiquifyEngine } = require('./js/liquify.js');
const ToolManager = require('./js/tools.js');

let totalTests = 0;
let passedTests = 0;

function it(desc, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✓ PASS: ${desc}`);
  } catch (err) {
    console.error(`  ✗ FAIL: ${desc}`);
    console.error(`    ${err.message}`);
  }
}

console.log('=== RUNNING MILESTONE 5 VERIFICATION SUITE ===\n');

// ─────────────────────────────────────────────────────────────
console.log('[Suite 1: Liquify Displacement Mesh Initialization & State]');

const W = 100;
const H = 80;
const engine = new LiquifyEngine(W, H);

it('LiquifyEngine initializes displacement fields with exact pixel capacity', () => {
  assert.strictEqual(engine.dxField.length, W * H);
  assert.strictEqual(engine.dyField.length, W * H);
  assert.strictEqual(engine.initialDx.length, W * H);
  assert.strictEqual(engine.initialDy.length, W * H);
  // Initial displacement must be clean zero
  for (let i = 0; i < 50; i++) {
    assert.strictEqual(engine.dxField[i], 0);
    assert.strictEqual(engine.dyField[i], 0);
  }
});

it('Radial weight falloff calculates cosine curve adjusted by density and pressure', () => {
  const maxR = 40;
  const coreWeight = engine.getRadialWeight(0, maxR, 50, 100);
  assert.strictEqual(coreWeight, 1.0, 'Center point must have weight 1.0 at 100% pressure');

  const halfWeight = engine.getRadialWeight(maxR * 0.7, maxR, 50, 100);
  assert.ok(halfWeight > 0 && halfWeight < 1.0, 'Mid-radius weight should smoothly fall off');

  const edgeWeight = engine.getRadialWeight(maxR, maxR, 50, 100);
  assert.strictEqual(edgeWeight, 0, 'Border radius weight must be 0');
});

// ─────────────────────────────────────────────────────────────
console.log('\n[Suite 2: Liquify Brush Deformation Operators]');

it('Forward Warp displaces coordinates along cursor stroke vector', () => {
  engine.reset();
  const cx = 50, cy = 40;
  const vx = 10, vy = 5;

  engine.brushSize = 30;
  engine.brushPressure = 80;
  engine.applyForwardWarp(cx, cy, vx, vy);

  const centerIdx = cy * W + cx;
  // Backward sampling displacement moves negatively along stroke vector
  assert.ok(engine.dxField[centerIdx] < 0, 'dxField at center must be displaced backwards for sampling');
  assert.ok(engine.dyField[centerIdx] < 0, 'dyField at center must be displaced backwards for sampling');

  // Points outside brush radius must remain untouched
  const farIdx = 0;
  assert.strictEqual(engine.dxField[farIdx], 0);
  assert.strictEqual(engine.dyField[farIdx], 0);
});

it('Twirl Clockwise rotates displacement around brush center', () => {
  engine.reset();
  const cx = 50, cy = 40;
  engine.brushSize = 40;
  engine.brushPressure = 100;
  engine.applyTwirl(cx, cy, true);

  // Check top point (cx, cy - 10)
  const topIdx = (cy - 10) * W + cx;
  // Rotating clockwise pushes top point to the right (positive dx)
  assert.ok(engine.dxField[topIdx] > 0, 'Clockwise twirl at top point must produce positive dx');

  // Check bottom point (cx, cy + 10)
  const botIdx = (cy + 10) * W + cx;
  // Rotating clockwise pushes bottom point to the left (negative dx)
  assert.ok(engine.dxField[botIdx] < 0, 'Clockwise twirl at bottom point must produce negative dx');
});

it('Twirl Counter-Clockwise rotates in inverse direction', () => {
  engine.reset();
  const cx = 50, cy = 40;
  engine.brushSize = 40;
  engine.brushPressure = 100;
  engine.applyTwirl(cx, cy, false);

  const topIdx = (cy - 10) * W + cx;
  // Counter-clockwise twirl pushes top point to the left (negative dx)
  assert.ok(engine.dxField[topIdx] < 0, 'Counter-clockwise twirl at top point must produce negative dx');
});

it('Pucker contracts displacement toward brush center', () => {
  engine.reset();
  const cx = 50, cy = 40;
  engine.brushSize = 40;
  engine.brushPressure = 80;
  engine.applyPucker(cx, cy);

  // Check point to the right (cx + 10, cy)
  const rightIdx = cy * W + (cx + 10);
  // Pucker displaces sampled point outward so rendered pixels pinch inward
  assert.ok(engine.dxField[rightIdx] > 0, 'Pucker on right side must displace sample coordinate to the right');
});

it('Bloat expands displacement away from brush center', () => {
  engine.reset();
  const cx = 50, cy = 40;
  engine.brushSize = 40;
  engine.brushPressure = 80;
  engine.applyBloat(cx, cy);

  // Check point to the right (cx + 10, cy)
  const rightIdx = cy * W + (cx + 10);
  // Bloat pulls sampled point inward so rendered pixels magnify outward
  assert.ok(engine.dxField[rightIdx] < 0, 'Bloat on right side must pull sample coordinate inward');
});

it('Push Left displaces coordinates perpendicular to stroke direction', () => {
  engine.reset();
  const cx = 50, cy = 40;
  // Stroke moving straight up: vx = 0, vy = -10
  const vx = 0, vy = -10;
  engine.brushSize = 30;
  engine.brushPressure = 100;
  engine.applyPushLeft(cx, cy, vx, vy);

  const centerIdx = cy * W + cx;
  // 90 degrees left of moving up is left (negative dx)
  assert.ok(engine.dxField[centerIdx] < 0, 'Push left during upward stroke must push leftward (negative dx)');
  assert.strictEqual(Math.round(engine.dyField[centerIdx]), 0, 'Push left during upward stroke should have no vertical bias');
});

// ─────────────────────────────────────────────────────────────
console.log('\n[Suite 3: Reconstruct & Smooth Mesh Relaxation]');

it('Reconstruct brush smoothly restores deformed displacement back to 0', () => {
  engine.reset();
  const cx = 50, cy = 40;
  engine.brushSize = 30;
  engine.applyForwardWarp(cx, cy, 20, 20);

  const centerIdx = cy * W + cx;
  const deformedDx = engine.dxField[centerIdx];
  assert.ok(Math.abs(deformedDx) > 1, 'Pre-condition: displacement is deformed');

  // Apply reconstruct brush repeatedly
  engine.brushPressure = 100;
  for (let step = 0; step < 5; step++) {
    engine.applyReconstruct(cx, cy);
  }

  const restoredDx = engine.dxField[centerIdx];
  assert.ok(Math.abs(restoredDx) < Math.abs(deformedDx), 'Reconstructed displacement must move closer to 0');
});

it('Smooth brush performs Laplacian neighbor averaging to relax harsh creases', () => {
  engine.reset();
  // Create an artificial sharp spike in the displacement field
  const spikeIdx = 40 * W + 50;
  engine.dxField[spikeIdx] = 50.0;
  engine.dyField[spikeIdx] = 50.0;

  engine.brushSize = 30;
  engine.brushPressure = 100;
  engine.applySmooth(50, 40);

  assert.ok(engine.dxField[spikeIdx] < 50.0, 'Spike displacement must be smoothed down by neighbor averaging');
  assert.ok(engine.dyField[spikeIdx] < 50.0);
});

// ─────────────────────────────────────────────────────────────
console.log('\n[Suite 4: Bilinear Interpolation & Wireframe Mesh Grid]');

it('Bilinear subpixel interpolation renders fractional sampling accurately', () => {
  const w = 4, h = 4;
  const testEngine = new LiquifyEngine(w, h);

  // 4x4 image with known pixel values: top-left = 100, top-right = 200
  const srcImgData = {
    width: w,
    height: h,
    data: new Uint8ClampedArray(w * h * 4)
  };
  // Pixel (0,0) = 100
  srcImgData.data[0] = 100; srcImgData.data[3] = 255;
  // Pixel (1,0) = 200
  srcImgData.data[4] = 200; srcImgData.data[7] = 255;

  testEngine.setSourceImage(srcImgData);

  // Displace pixel (0,0) by dx = +0.5 (halfway between 100 and 200)
  testEngine.dxField[0] = 0.5;

  const dstImgData = {
    width: w,
    height: h,
    data: new Uint8ClampedArray(w * h * 4)
  };
  testEngine.renderWarped(dstImgData);

  // Bilinear interpolation at x = 0 + 0.5 should yield ~150
  assert.strictEqual(dstImgData.data[0], 150, 'Bilinear interpolation at 0.5 offset between 100 and 200 must equal 150');
  assert.strictEqual(dstImgData.data[3], 255, 'Alpha must be preserved');
});

it('Mesh Grid Generator draws horizontal and vertical deformed wireframe lines', () => {
  const mockCan = createMockCanvas(W, H);
  const mockCtx = mockCan.getContext('2d');

  engine.reset();
  engine.applyForwardWarp(50, 40, 10, 10);
  engine.renderMeshGrid(mockCtx, 20, '#00ffff');

  const calls = mockCtx.getStrokeCalls();
  assert.ok(calls.length > 0, 'Mesh grid must invoke canvas stroke path operations');
  assert.ok(calls.some(c => c.type === 'moveTo'), 'Must generate moveTo path vertices');
  assert.ok(calls.some(c => c.type === 'lineTo'), 'Must generate lineTo grid segment lines');
});

// ─────────────────────────────────────────────────────────────
console.log('\n[Suite 5: Dodge, Burn & Sponge Retouching Engine]');

// Create mock app for ToolManager
const mockApp = {
  width: W,
  height: H,
  layerManager: new LayerManager(W, H),
  historyManager: new HistoryManager(),
  overlayCtx: createMockCanvas(W, H).getContext('2d'),
  pushHistoryState(name) {
    this.historyManager.push(name, this.layerManager.layers, this.layerManager.activeLayerId);
  }
};

const tm = new ToolManager(mockApp);
const testLayer = mockApp.layerManager.addLayer('Retouch Test Layer');
const testCtx = testLayer.ctx;

it('Dodge tool brightens targeted tonal ranges', () => {
  // Fill layer with dark patch (shadows, lum ~40) and bright patch (highlights, lum ~220)
  const d = testCtx.getPixelBuffer();
  // Fill pixel at (20, 20) with shadows
  const shadowIdx = (20 * W + 20) * 4;
  d[shadowIdx] = 40; d[shadowIdx + 1] = 40; d[shadowIdx + 2] = 40; d[shadowIdx + 3] = 255;

  tm.dodgeBurnSize = 20;
  tm.dodgeBurnExposure = 100;
  tm.dodgeBurnRange = 'shadows';

  tm.applyDodgeBurn(testLayer, 20, 20, 20, 20, true); // Dodge Shadows

  const postShadow = testCtx.getImageData(20, 20, 1, 1).data[0];
  assert.ok(postShadow > 40, 'Dodging shadows must increase luminance of dark pixels');
});

it('Burn tool darkens targeted tonal ranges', () => {
  const d = testCtx.getPixelBuffer();
  const midIdx = (40 * W + 40) * 4;
  d[midIdx] = 128; d[midIdx + 1] = 128; d[midIdx + 2] = 128; d[midIdx + 3] = 255;

  tm.dodgeBurnSize = 20;
  tm.dodgeBurnExposure = 100;
  tm.dodgeBurnRange = 'midtones';

  tm.applyDodgeBurn(testLayer, 40, 40, 40, 40, false); // Burn Midtones

  const postMid = testCtx.getImageData(40, 40, 1, 1).data[0];
  assert.ok(postMid < 128, 'Burning midtones must decrease luminance of midtone pixels');
});

it('Sponge tool increases saturation in Saturate mode and decreases in Desaturate mode', () => {
  const d = testCtx.getPixelBuffer();
  // Muted reddish pixel: R=160, G=100, B=100
  const pIdx = (60 * W + 60) * 4;
  d[pIdx] = 160; d[pIdx + 1] = 100; d[pIdx + 2] = 100; d[pIdx + 3] = 255;

  const initHsl = Utils.rgbToHsl(160, 100, 100);

  tm.spongeSize = 20;
  tm.spongeFlow = 80;
  tm.spongeMode = 'saturate';
  tm.applySponge(testLayer, 60, 60, 60, 60);

  const satData = testCtx.getImageData(60, 60, 1, 1).data;
  const satHsl = Utils.rgbToHsl(satData[0], satData[1], satData[2]);
  assert.ok(satHsl.s > initHsl.s, 'Saturate mode must increase saturation component');

  tm.spongeMode = 'desaturate';
  tm.spongeFlow = 100;
  tm.applySponge(testLayer, 60, 60, 60, 60);
  tm.applySponge(testLayer, 60, 60, 60, 60);

  const desatData = testCtx.getImageData(60, 60, 1, 1).data;
  const desatHsl = Utils.rgbToHsl(desatData[0], desatData[1], desatData[2]);
  assert.ok(desatHsl.s < satHsl.s, 'Desaturate mode must decrease saturation component');
});

// ─────────────────────────────────────────────────────────────
console.log('\n[Suite 6: Spot Healing Inpainting]');

it('Spot Healing synthesizes interior blemish from perimeter ring samples', () => {
  // Surround (70, 70) with bright cyan skin tone (R=100, G=200, B=200)
  const d = testCtx.getPixelBuffer();
  for (let y = 60; y <= 80; y++) {
    for (let x = 60; x <= 80; x++) {
      const idx = (y * W + x) * 4;
      d[idx] = 100; d[idx + 1] = 200; d[idx + 2] = 200; d[idx + 3] = 255;
    }
  }

  // Inject black blemish spot at center (70, 70)
  const blemishIdx = (70 * W + 70) * 4;
  d[blemishIdx] = 0; d[blemishIdx + 1] = 0; d[blemishIdx + 2] = 0; d[blemishIdx + 3] = 255;

  assert.strictEqual(testCtx.getImageData(70, 70, 1, 1).data[0], 0, 'Pre-condition: blemish is black');

  tm.healingSize = 14;
  tm.applySpotHealing(testLayer, 70, 70);

  const healedPixel = testCtx.getImageData(70, 70, 1, 1).data;
  assert.ok(healedPixel[0] > 50, 'Healed pixel R should be interpolated towards surrounding ring');
  assert.ok(healedPixel[1] > 120, 'Healed pixel G should be interpolated towards surrounding ring');
  assert.ok(healedPixel[2] > 120, 'Healed pixel B should be interpolated towards surrounding ring');
});

// ─────────────────────────────────────────────────────────────
console.log('\n[Suite 7: Full History Snapshot & Liquify Commit]');

it('History snapshots preserve layer pixels before and after Liquify commit with clean undo/redo', () => {
  const history = mockApp.historyManager;
  history.clear();

  // 1. Initial snapshot
  mockApp.pushHistoryState('Initial Canvas');

  // 2. Perform liquify warp and commit
  const pBuffer = testCtx.getPixelBuffer();
  pBuffer[0] = 77; pBuffer[1] = 88; pBuffer[2] = 99; pBuffer[3] = 255;
  mockApp.pushHistoryState('Filter: Liquify');

  // Verify history count
  assert.strictEqual(history.steps.length, 2);

  // 3. Undo
  const undoStep = history.undo();
  assert.ok(undoStep);
  assert.strictEqual(undoStep.name, 'Initial Canvas');

  // 4. Redo
  const redoStep = history.redo();
  assert.ok(redoStep);
  assert.strictEqual(redoStep.name, 'Filter: Liquify');
});

console.log('\n========================================');
console.log(`TOTAL TESTS: ${totalTests}`);
console.log(`PASSED: ${passedTests}`);
console.log(`FAILED: ${totalTests - passedTests}`);
console.log('========================================');

if (passedTests === totalTests) {
  console.log('\nALL MILESTONE 5 TESTS PASSED PERFECTLY!\n');
  process.exit(0);
} else {
  console.error('\nSOME MILESTONE 5 TESTS FAILED!\n');
  process.exit(1);
}
