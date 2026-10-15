/**
 * Test Suite: Layer Styles Modal Live Preview & Parity + Right-Click Context Menu Resize & Manual Crop
 * PixelForge Studio
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('Testing Layer Styles Visibility & Right-Click Crop/Resize Parity Suite...\n');

// ── 1. Static HTML & CSS Verification ──
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf-8');
const css = fs.readFileSync(path.join(__dirname, 'styles/main.css'), 'utf-8');

console.log('► Test Group 1: Layer Styles Modal Structure & CSS Layout');

assert(html.includes('id="modal-layer-styles"'), 'modal-layer-styles must exist in index.html');
assert(html.includes('id="ls-live-preview-check"'), 'ls-live-preview-check preview checkbox must exist');
assert(css.includes('#modal-layer-styles .modal-body'), 'CSS for modal-layer-styles .modal-body must exist');
assert(css.includes('flex-direction: row !important'), 'modal-body must be flex-direction: row to prevent vertical clipping');
assert(css.includes('#modal-layer-styles .styles-tabs-list'), 'styles-tabs-list must be styled in CSS');
assert(css.includes('#modal-layer-styles .styles-tab-content'), 'styles-tab-content must be styled in CSS');
console.log('  ✓ Layer Styles modal configured with horizontal flex-direction: row layout and live preview checkbox');

console.log('► Test Group 2: Context Menu Actions & Scale Modal');

assert(html.includes('data-action="crop-layer"'), 'crop-layer must exist in layer-context-menu');
assert(html.includes('data-action="free-transform"'), 'free-transform must exist in layer-context-menu');
assert(html.includes('data-action="scale-layer"'), 'scale-layer must exist in layer-context-menu');
assert(html.includes('id="modal-scale-layer"'), 'modal-scale-layer must exist in index.html');
assert(html.includes('id="scale-layer-width"'), 'scale-layer-width input must exist');
assert(html.includes('id="scale-layer-height"'), 'scale-layer-height input must exist');
assert(html.includes('id="scale-layer-constrain"'), 'scale-layer-constrain checkbox must exist');
assert(html.includes('id="scale-layer-resample"'), 'scale-layer-resample select must exist');
assert(html.includes('id="btn-apply-scale-layer"'), 'btn-apply-scale-layer button must exist');
console.log('  ✓ Layer context menu contains Crop Layer, Free Transform, and Scale Layer options');
console.log('  ✓ Scale & Resize Layer modal elements are correctly defined in index.html');

// ── 2. Mock DOM & Canvas Environment for Behavioral Testing ──
console.log('\n► Test Group 3: Layer Bounding Box Detection & Scaling Engine');

function createMockElement(tag = 'div') {
  return {
    tagName: tag.toUpperCase(),
    style: {},
    dataset: {},
    classList: {
      add: () => {},
      remove: () => {},
      toggle: () => {},
      contains: () => false
    },
    addEventListener: () => {},
    removeEventListener: () => {},
    appendChild: (c) => c,
    removeChild: (c) => c,
    innerHTML: '',
    textContent: '',
    value: '',
    checked: false
  };
}

function createMockCanvas(w, h) {
  const pixels = new Uint8ClampedArray(w * h * 4);
  return {
    width: w,
    height: h,
    style: {},
    getContext: () => ({
      getImageData: (sx, sy, sw, sh) => {
        const out = new Uint8ClampedArray(sw * sh * 4);
        for (let dy = 0; dy < sh; dy++) {
          for (let dx = 0; dx < sw; dx++) {
            const srcIdx = ((sy + dy) * w + (sx + dx)) * 4;
            const dstIdx = (dy * sw + dx) * 4;
            if (srcIdx >= 0 && srcIdx < pixels.length) {
              out[dstIdx] = pixels[srcIdx];
              out[dstIdx + 1] = pixels[srcIdx + 1];
              out[dstIdx + 2] = pixels[srcIdx + 2];
              out[dstIdx + 3] = pixels[srcIdx + 3];
            }
          }
        }
        return { data: out, width: sw, height: sh };
      },
      putImageData: (imgData, dx, dy) => {
        const { data, width: sw, height: sh } = imgData;
        for (let y = 0; y < sh; y++) {
          for (let x = 0; x < sw; x++) {
            const srcIdx = (y * sw + x) * 4;
            const dstIdx = ((dy + y) * w + (dx + x)) * 4;
            if (dstIdx >= 0 && dstIdx < pixels.length) {
              pixels[dstIdx] = data[srcIdx];
              pixels[dstIdx + 1] = data[srcIdx + 1];
              pixels[dstIdx + 2] = data[srcIdx + 2];
              pixels[dstIdx + 3] = data[srcIdx + 3];
            }
          }
        }
      },
      clearRect: (rx, ry, rw, rh) => {
        for (let y = ry; y < ry + rh; y++) {
          for (let x = rx; x < rx + rw; x++) {
            const idx = (y * w + x) * 4;
            if (idx >= 0 && idx < pixels.length) {
              pixels[idx] = 0;
              pixels[idx + 1] = 0;
              pixels[idx + 2] = 0;
              pixels[idx + 3] = 0;
            }
          }
        }
      },
      drawImage: () => {},
      save: () => {},
      restore: () => {},
      fillRect: () => {},
      beginPath: () => {},
      stroke: () => {},
      strokeRect: () => {},
      translate: () => {},
      rotate: () => {},
      arc: () => {}
    })
  };
}

global.document = {
  createElement: (tag) => {
    if (tag === 'canvas') return createMockCanvas(100, 100);
    return createMockElement(tag);
  },
  getElementById: (id) => createMockElement('div'),
  querySelectorAll: () => [],
  querySelector: () => null
};

global.Utils = {
  createCanvas: (w, h) => createMockCanvas(w, h),
  hexToRgba: (hex, a = 1) => `rgba(0,0,0,${a})`
};

const LayerManager = require('./js/layers.js');

const lm = new LayerManager(400, 300);
const layer = lm.addLayer('Test Image Layer');

// Stamp non-transparent pixels in rect (50, 60) -> (150, 160)
const fillW = 100, fillH = 100;
const testData = new Uint8ClampedArray(fillW * fillH * 4);
for (let i = 0; i < testData.length; i += 4) {
  testData[i] = 255;     // R
  testData[i + 1] = 100; // G
  testData[i + 2] = 50;  // B
  testData[i + 3] = 255; // Alpha
}
layer.ctx.putImageData({ data: testData, width: fillW, height: fillH }, 50, 60);

// Test getLayerContentBounds
const bounds = lm.getLayerContentBounds(layer.id);
assert(bounds, 'Bounds must not be null');
assert(bounds.minX <= 50 && bounds.maxX >= 150, `Bounds X [${bounds.minX}, ${bounds.maxX}] must encapsulate [50, 150]`);
assert(bounds.minY <= 60 && bounds.maxY >= 160, `Bounds Y [${bounds.minY}, ${bounds.maxY}] must encapsulate [60, 160]`);
console.log(`  ✓ getLayerContentBounds accurately detected content region: [${bounds.minX}, ${bounds.minY}] to [${bounds.maxX}, ${bounds.maxY}]`);

// Test getTopVisibleLayerAt
const hitLayer = lm.getTopVisibleLayerAt(100, 100);
assert(hitLayer && hitLayer.id === layer.id, 'Top visible layer at (100, 100) must be the test image layer');
console.log('  ✓ getTopVisibleLayerAt hit-tested opaque pixels successfully');

// Test scaleLayer
const scaledOk = lm.scaleLayer(layer.id, 200, 200, 'bicubic');
assert(scaledOk, 'scaleLayer must return true');
console.log('  ✓ scaleLayer executed bicubic resample scaling');

console.log('\n► Test Group 4: ToolManager Manual Crop Trigger');
const toolsCode = fs.readFileSync(path.join(__dirname, 'js/tools.js'), 'utf-8');
assert(toolsCode.includes('startManualCrop(targetLayer = null)'), 'ToolManager must define startManualCrop');
assert(toolsCode.includes('overlay.addEventListener(\'contextmenu\''), 'Overlay must listen for contextmenu for canvas right-click');
console.log('  ✓ ToolManager implements startManualCrop and binds contextmenu on canvas overlay');

console.log('\n► Test Group 5: App Context Menu & Scale Modal Handler');
const appCode = fs.readFileSync(path.join(__dirname, 'js/app.js'), 'utf-8');
assert(appCode.includes('case \'crop-layer\':'), 'app.js must handle crop-layer context action');
assert(appCode.includes('case \'free-transform\':'), 'app.js must handle free-transform context action');
assert(appCode.includes('case \'scale-layer\':'), 'app.js must handle scale-layer context action');
assert(appCode.includes('openLayerScaleModal(layerId = null)'), 'app.js must implement openLayerScaleModal');
console.log('  ✓ app.js handles crop-layer, free-transform, and scale-layer context actions with openLayerScaleModal');

console.log('\n► Test Group 6: Free Transform Stable Dragging & Proportional Scaling');
const ToolManager = require('./js/tools.js');
const mockApp = {
  width: 400,
  height: 300,
  zoom: 1.0,
  panX: 0,
  panY: 0,
  layerManager: lm,
  overlayCanvas: createMockCanvas(400, 300),
  get overlayCtx() { return this.overlayCanvas.getContext('2d'); },
  renderComposite: () => {},
  pushHistoryState: () => {},
  showToast: () => {}
};

const tm = new ToolManager(mockApp);
tm.transformBox = {
  x: 50,
  y: 60,
  w: 100,
  h: 80,
  origX: 50,
  origY: 60,
  origW: 100,
  origH: 80,
  angle: 0
};
tm.transformSourceCanvas = createMockCanvas(400, 300);
tm.isTransforming = true;

// Click on bottom-right handle 'br' at (150, 140)
tm.handleTransformPointerDown(150, 140);
assert.strictEqual(tm.activeHandle, 'br', 'Should hit bottom-right handle br');

// Simulate 30 mouse move events moving from (150, 140) to (180, 164)
for (let step = 1; step <= 30; step++) {
  const curX = 150 + step;
  const curY = 140 + Math.round(step * 0.8);
  tm.handleTransformPointerMove(curX, curY, { shiftKey: true });
}

// Ensure width and height did NOT shrink into a line or zero!
assert(tm.transformBox.w >= 120, `Width should have grown proportionally, got ${tm.transformBox.w}`);
assert(tm.transformBox.h >= 90, `Height should have grown proportionally, got ${tm.transformBox.h}`);
// Check aspect ratio preserved
const ratio = tm.transformBox.w / tm.transformBox.h;
const expectedRatio = 100 / 80;
assert(Math.abs(ratio - expectedRatio) < 0.05, `Aspect ratio must be preserved: ${ratio} vs ${expectedRatio}`);
console.log(`  ✓ Corner handle drag scaled smoothly and proportionally: ${tm.transformBox.w} × ${tm.transformBox.h} (ratio: ${ratio.toFixed(2)})`);

// Test minimum size clamp (trying to drag far into negative space)
tm.handleTransformPointerDown(180, 164);
tm.handleTransformPointerMove(-500, -500, {});
assert(tm.transformBox.w >= 10, `Width must clamp to minimum size, not shrink into line: ${tm.transformBox.w}`);
assert(tm.transformBox.h >= 10, `Height must clamp to minimum size, not shrink into line: ${tm.transformBox.h}`);
console.log('  ✓ Negative dragging clamps to minimum 10px bounding box without collapsing into a flat line');

console.log('\n════════════════════════════════════════════════════════════════');
console.log('  Layer Styles & Context Menu Parity: All 6 Test Groups Passed! (100%)');
console.log('════════════════════════════════════════════════════════════════\n');
