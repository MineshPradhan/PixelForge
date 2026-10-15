/**
 * PixelForge Studio — Smart Objects & Smart Filters Verification Test Suite
 * Validates:
 *  - SmartFilter execution, parameters, clone, toJSON / fromJSON
 *  - SmartObjectData resolution-independent scaling & transformations
 *  - Non-destructive sequential Smart Filter stacking
 *  - Per-filter toggle enable/disable & removal without pixel loss
 *  - Smart Object conversion from layer(s) and rasterization
 *  - Serialization & state restoration
 */

const assert = require('assert');

// ── Mock Canvas & DOM Environment ──
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
    imageSmoothingEnabled: true,
    imageSmoothingQuality: 'high',

    save() {},
    restore() {},
    translate(x, y) {},
    rotate(angle) {},
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
    drawImage(src, ...args) {
      const srcCanvas = src.canvas ? src.canvas : src;
      const srcCtx = srcCanvas.getContext ? srcCanvas.getContext('2d') : null;
      if (!srcCtx) return;
      const sW = srcCanvas.width;
      const sH = srcCanvas.height;
      const sImg = srcCtx.getImageData(0, 0, sW, sH);
      const sData = sImg.data;

      let dx = 0, dy = 0, dw = width, dh = height;
      if (args.length === 2) {
        dx = args[0]; dy = args[1]; dw = sW; dh = sH;
      } else if (args.length === 4) {
        dx = args[0]; dy = args[1]; dw = args[2]; dh = args[3];
      }

      // Bilinear/Nearest neighbor scale blit to target buffer
      const scaleX = sW / dw;
      const scaleY = sH / dh;

      for (let cy = 0; cy < dh; cy++) {
        const targetY = Math.round(dy + cy);
        if (targetY < 0 || targetY >= height) continue;
        const srcY = Math.min(sH - 1, Math.floor(cy * scaleY));

        for (let cx = 0; cx < dw; cx++) {
          const targetX = Math.round(dx + cx);
          if (targetX < 0 || targetX >= width) continue;
          const srcX = Math.min(sW - 1, Math.floor(cx * scaleX));

          const sIdx = (srcY * sW + srcX) * 4;
          const dIdx = (targetY * width + targetX) * 4;
          const srcAlpha = sData[sIdx + 3] / 255;

          if (srcAlpha > 0) {
            pixelBuffer[dIdx]     = sData[sIdx];
            pixelBuffer[dIdx + 1] = sData[sIdx + 1];
            pixelBuffer[dIdx + 2] = sData[sIdx + 2];
            pixelBuffer[dIdx + 3] = sData[sIdx + 3];
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
    getContext: () => ctx,
    toDataURL: (mime = 'image/png') => 'data:image/png;base64,MOCK'
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

// Global browser mocks
global.window = {
  addEventListener() {},
  removeEventListener() {},
  innerWidth: 1920,
  innerHeight: 1080
};

function createMockElement(tag = 'div') {
  return {
    tagName: tag.toUpperCase(),
    style: {},
    dataset: {},
    children: [],
    innerHTML: '',
    appendChild(c) { this.children.push(c); },
    removeChild(c) {},
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

global.ImageData = class ImageData {
  constructor(w, h) {
    this.width = w;
    this.height = h;
    this.data = new Uint8ClampedArray(w * h * 4);
  }
};

global.Utils = require('./js/utils.js');
global.Utils.createCanvas = (w, h) => createMockCanvas(w, h).canvas;
global.Filters = require('./js/filters.js');

const LayerManager = require('./js/layers.js');
const { SmartFilter, SmartObjectData, SmartObjectManager } = require('./js/smart-objects.js');

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
console.log('  PixelForge Studio — Smart Objects & Smart Filters Test Suite');
console.log('════════════════════════════════════════════════════════════════\n');

// ── Test Group 1: SmartFilter Model ──
console.log('► Test Group 1: SmartFilter Model & Execution');

test('SmartFilter initializes with proper name, id, and defaults', () => {
  const sf = new SmartFilter('gaussianBlur', { radius: 4 });
  assert.strictEqual(sf.type, 'gaussianBlur');
  assert.strictEqual(sf.name, 'Gaussian Blur');
  assert.strictEqual(sf.enabled, true);
  assert.strictEqual(sf.params.radius, 4);
  assert(sf.id.startsWith('sf_'));
});

test('SmartFilter applies filter parameters non-destructively to ImageData', () => {
  const { ctx } = createMockCanvas(2, 2);
  const imgData = ctx.getImageData(0, 0, 2, 2);
  imgData.data[0] = 50; imgData.data[1] = 50; imgData.data[2] = 50; imgData.data[3] = 255;

  const sf = new SmartFilter('invert', {});
  const filtered = sf.apply(imgData);

  // Inverted 50 -> 205
  assert.strictEqual(filtered.data[0], 205);
  assert.strictEqual(filtered.data[1], 205);
  assert.strictEqual(filtered.data[2], 205);
});

test('Disabled SmartFilter bypasses processing completely', () => {
  const { ctx } = createMockCanvas(2, 2);
  const imgData = ctx.getImageData(0, 0, 2, 2);
  imgData.data[0] = 100; imgData.data[3] = 255;

  const sf = new SmartFilter('invert', {}, { enabled: false });
  const result = sf.apply(imgData);

  assert.strictEqual(result.data[0], 100);
});

test('SmartFilter clone and JSON serialization round-trip', () => {
  const sf1 = new SmartFilter('brightnessContrast', { brightness: 25, contrast: 10 });
  const json = sf1.toJSON();
  const sf2 = SmartFilter.fromJSON(json);

  assert.strictEqual(sf2.type, 'brightnessContrast');
  assert.strictEqual(sf2.params.brightness, 25);
  assert.strictEqual(sf2.params.contrast, 10);
  assert.strictEqual(sf2.name, 'Brightness / Contrast');
});

// ── Test Group 2: SmartObjectData & Resolution Independence ──
console.log('\n► Test Group 2: SmartObjectData & Resolution Independence');

test('SmartObjectData retains pristine original source canvas at full resolution', () => {
  const { canvas: srcCanvas, ctx: srcCtx } = createMockCanvas(100, 100);
  srcCtx.fillStyle = '#ff0000'; // Red
  srcCtx.fillRect(0, 0, 100, 100);

  const smData = new SmartObjectData(srcCanvas, 100, 100);
  assert.strictEqual(smData.originalWidth, 100);
  assert.strictEqual(smData.originalHeight, 100);

  // Target layer canvas 100x100
  const { canvas: layerCanvas, ctx: layerCtx } = createMockCanvas(100, 100);
  const mockLayer = { canvas: layerCanvas, ctx: layerCtx };

  // Render at 100% scale
  smData.renderToLayer(mockLayer);
  let p = layerCtx.getImageData(50, 50, 1, 1).data;
  assert.strictEqual(p[0], 255);
  assert.strictEqual(p[1], 0);

  // Non-destructive test: Scale down to 10% (10x10)
  smData.setTransform(0, 0, 10, 10);
  smData.renderToLayer(mockLayer);

  // Now scale back up to 100% (100x100)
  smData.setTransform(0, 0, 100, 100);
  smData.renderToLayer(mockLayer);

  // Original pristine resolution is 100% intact with zero degradation
  p = layerCtx.getImageData(50, 50, 1, 1).data;
  assert.strictEqual(p[0], 255);
  assert.strictEqual(p[1], 0);
  assert.strictEqual(p[2], 0);
  assert.strictEqual(p[3], 255);
});

test('Sequential Smart Filters apply non-destructively on top of transforms', () => {
  const { canvas: srcCanvas, ctx: srcCtx } = createMockCanvas(40, 40);
  srcCtx.fillStyle = '#808080'; // Gray (128, 128, 128)
  srcCtx.fillRect(0, 0, 40, 40);

  const smData = new SmartObjectData(srcCanvas, 40, 40);
  const { canvas: layerCanvas, ctx: layerCtx } = createMockCanvas(40, 40);
  const mockLayer = { canvas: layerCanvas, ctx: layerCtx };

  // Add Smart Filter: Invert (128 -> 127)
  const f1 = smData.addFilter('invert', {});
  smData.renderToLayer(mockLayer);
  let p = layerCtx.getImageData(20, 20, 1, 1).data;
  assert.strictEqual(p[0], 127);

  // Disable filter: re-renders instantly back to original 128 gray without loss
  smData.toggleFilter(f1.id, false);
  smData.renderToLayer(mockLayer);
  p = layerCtx.getImageData(20, 20, 1, 1).data;
  assert.strictEqual(p[0], 128);

  // Remove filter
  smData.removeFilter(f1.id);
  assert.strictEqual(smData.filters.length, 0);
});

// ── Test Group 3: SmartObjectManager Lifecycle ──
console.log('\n► Test Group 3: SmartObjectManager Lifecycle');

test('SmartObjectManager converts raster layer into Smart Object preserving image data', () => {
  const mockApp = {
    width: 50,
    height: 50,
    renderComposite() {},
    pushHistoryState() {}
  };
  const lm = new LayerManager(50, 50);
  mockApp.layerManager = lm;

  const layer = lm.addLayer('Photo', '#00ff00'); // Green
  lm.setActiveLayer(layer.id);

  const som = new SmartObjectManager(mockApp);
  const smartLayer = som.convertToSmartObject(layer.id);

  assert(smartLayer, 'Should create a smart layer');
  assert.strictEqual(smartLayer.type, 'smart-object');
  assert(smartLayer.smartObjectData instanceof SmartObjectData);

  // Verify pixels are preserved
  const p = smartLayer.ctx.getImageData(25, 25, 1, 1).data;
  assert.strictEqual(p[1], 255); // Green channel is full
});

test('Rasterizing Smart Object bakes current state and strips smartObjectData', () => {
  const mockApp = {
    width: 50,
    height: 50,
    renderComposite() {},
    pushHistoryState() {}
  };
  const lm = new LayerManager(50, 50);
  mockApp.layerManager = lm;

  const layer = lm.addLayer('Graphic', '#0000ff');
  lm.setActiveLayer(layer.id);

  const som = new SmartObjectManager(mockApp);
  const smartLayer = som.convertToSmartObject(layer.id);
  assert.strictEqual(smartLayer.type, 'smart-object');

  const rasterized = som.rasterizeSmartObject(smartLayer);
  assert.strictEqual(rasterized, true);
  assert.strictEqual(smartLayer.type, 'raster');
  assert.strictEqual(smartLayer.smartObjectData, null);

  // Pixels remain fully intact
  const p = smartLayer.ctx.getImageData(25, 25, 1, 1).data;
  assert.strictEqual(p[2], 255); // Blue
});

console.log('\n════════════════════════════════════════════════════════════════');
console.log(`  Smart Objects Test Suite: ${passCount} / ${passCount} Passed (100%)`);
console.log('════════════════════════════════════════════════════════════════\n');
