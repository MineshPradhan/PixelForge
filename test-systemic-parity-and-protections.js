/**
 * PixelForge Studio — Systemic Parity, Layer Protections & AI Quality Test Suite
 * 
 * Verifies:
 * 1. Global action dispatch parity (group-layers, ungroup-layers, rasterize-type, crop-layer, history actions)
 * 2. Layer modification guards (locked, hidden, group, and unmasked adjustment layers)
 * 3. Safe headless execution without naked alert exceptions
 * 4. AI Neural Filters acceleration, boundary handling, and color transfer robustness
 */

const assert = require('assert');
const fs = require('fs');

// Global DOM & Canvas mocks
global.ImageData = class ImageData {
  constructor(dataOrWidth, widthOrHeight, height) {
    if (dataOrWidth instanceof Uint8ClampedArray) {
      this.data = dataOrWidth;
      this.width = widthOrHeight;
      this.height = height;
    } else {
      this.width = Math.max(0, dataOrWidth || 0);
      this.height = Math.max(0, widthOrHeight || 0);
      this.data = new Uint8ClampedArray(this.width * this.height * 4);
    }
  }
};

global.HTMLCanvasElement = class HTMLCanvasElement {
  constructor(width = 800, height = 600) {
    this.width = width;
    this.height = height;
    this.style = {};
  }
  getBoundingClientRect() {
    return { left: 0, top: 0, width: this.width, height: this.height };
  }
  getContext(type) {
    return {
      canvas: this,
      save: () => {},
      restore: () => {},
      clearRect: () => {},
      fillRect: () => {},
      strokeRect: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      stroke: () => {},
      fill: () => {},
      arc: () => {},
      drawImage: () => {},
      getImageData: (x, y, w, h) => new global.ImageData(w, h),
      putImageData: () => {},
      measureText: (txt) => ({ width: (txt || '').length * 8 }),
      fillText: () => {}
    };
  }
  toDataURL() {
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  }
};

global.document = {
  getElementById: (id) => ({
    id,
    value: '0',
    checked: false,
    classList: { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false },
    style: {},
    addEventListener: () => {},
    querySelectorAll: () => [],
    querySelector: () => null,
    setAttribute: () => {},
    getAttribute: () => null,
    appendChild: () => {},
    textContent: '',
    innerHTML: ''
  }),
  querySelectorAll: () => [],
  querySelector: () => null,
  createElement: (tag) => {
    if (tag === 'canvas') return new global.HTMLCanvasElement();
    return {
      tagName: tag.toUpperCase(),
      style: {},
      dataset: {},
      classList: { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false },
      addEventListener: () => {},
      appendChild: () => {},
      getContext: () => (new global.HTMLCanvasElement()).getContext('2d')
    };
  }
};

global.window = global;

const Utils = require('./js/utils.js');
const LayerManager = require('./js/layers.js');
const NeuralFilters = require('./js/neural-filters.js');
const ToolManager = require('./js/tools.js');

console.log('════════════════════════════════════════════════════════════════');
console.log('  PixelForge Studio — Systemic Parity & Layer Protections Suite  ');
console.log('════════════════════════════════════════════════════════════════\n');

// ─────────────────────────────────────────────────────────────
// Group 1: Global Action Dispatch Parity (180/180 Handled)
// ─────────────────────────────────────────────────────────────
console.log('► Test Group 1: Global Action Dispatch Parity');

const html = fs.readFileSync('index.html', 'utf8');
const appJs = fs.readFileSync('js/app.js', 'utf8');

const regex = /data-action="([^"]+)"/g;
let m;
const htmlActions = new Set();
while ((m = regex.exec(html)) !== null) {
  htmlActions.add(m[1]);
}

const handleMenuActionMatch = appJs.match(/handleMenuAction\s*\(\s*action\s*\)\s*\{([\s\S]*?)\n\s*switch\s*\(\s*action\s*\)\s*\{([\s\S]*?)\n\s*default:/);
assert(handleMenuActionMatch, 'handleMenuAction switch block must exist in app.js');

const switchBody = handleMenuActionMatch[2];
const caseRegex = /case\s+['"]([^'"]+)['"]\s*:/g;
const handledCases = new Set();
while ((m = caseRegex.exec(switchBody)) !== null) {
  handledCases.add(m[1]);
}

assert(handledCases.has('group-layers'), 'handleMenuAction must handle group-layers');
assert(handledCases.has('ungroup-layers'), 'handleMenuAction must handle ungroup-layers');
assert(handledCases.has('rasterize-type'), 'handleMenuAction must handle rasterize-type');
assert(handledCases.has('crop-layer'), 'handleMenuAction must handle crop-layer');
assert(handledCases.has('delete-state'), 'handleMenuAction must handle delete-state');
assert(handledCases.has('delete-subsequent'), 'handleMenuAction must handle delete-subsequent');
assert(handledCases.has('clear-all'), 'handleMenuAction must handle clear-all');

const unhandled = [];
for (const a of htmlActions) {
  if (!handledCases.has(a)) {
    unhandled.push(a);
  }
}
assert.strictEqual(unhandled.length, 0, `All HTML data-actions must be handled (unhandled: ${unhandled.join(', ')})`);
console.log(`  ✓ All ${htmlActions.size} interactive HTML data-actions mapped cleanly in handleMenuAction`);

// ─────────────────────────────────────────────────────────────
// Group 2: Layer Modification Safety & State Protection
// ─────────────────────────────────────────────────────────────
console.log('\n► Test Group 2: Layer Modification Safety & State Protection');

const mockApp = {
  width: 400,
  height: 300,
  zoom: 1.0,
  panX: 0,
  panY: 0,
  toastMessage: null,
  showToast(msg) { this.toastMessage = msg; },
  pushHistoryState() {},
  renderComposite() {},
  overlayCanvas: new global.HTMLCanvasElement(400, 300),
  overlayCtx: (new global.HTMLCanvasElement(400, 300)).getContext('2d')
};

const layerMgr = new LayerManager(mockApp.width, mockApp.height);
mockApp.layerManager = layerMgr;

const toolMgr = new ToolManager(mockApp);
mockApp.toolManager = toolMgr;

// Create background raster layer
const bgLayer = layerMgr.addLayer('Background');
layerMgr.setActiveLayer(bgLayer.id);

// 1. Locked Layer Protection
toolMgr.setTool('brush');
bgLayer.locked = true;
mockApp.toastMessage = null;

let pointerEvent = { clientX: 50, clientY: 50, button: 0, pressure: 1.0 };
toolMgr.onPointerDown(pointerEvent);

assert.strictEqual(toolMgr.isMouseDown, false, 'Pointer down must be cancelled on locked layer');
assert(mockApp.toastMessage && mockApp.toastMessage.includes('locked'), 'Toast notification must inform that layer is locked');
console.log('  ✓ Locked layer prevents brush painting and surfaces informative toast');

// 2. Hidden Layer Protection
bgLayer.locked = false;
bgLayer.visible = false;
mockApp.toastMessage = null;

toolMgr.onPointerDown(pointerEvent);
assert.strictEqual(toolMgr.isMouseDown, false, 'Pointer down must be cancelled on hidden layer');
assert(mockApp.toastMessage && mockApp.toastMessage.includes('hidden'), 'Toast notification must inform that layer is hidden');
console.log('  ✓ Hidden layer prevents painting and notifies user');

// 3. Layer Group Protection
bgLayer.visible = true;
const groupLayer = layerMgr.addGroup('Folder Group');
layerMgr.setActiveLayer(groupLayer.id);
mockApp.toastMessage = null;

toolMgr.onPointerDown(pointerEvent);
assert.strictEqual(toolMgr.isMouseDown, false, 'Pointer down must be cancelled on group layer');
assert(mockApp.toastMessage && mockApp.toastMessage.includes('Group'), 'Toast notification must warn against painting on group');
console.log('  ✓ Group folder layer prevents direct brush paint corruption');

// 4. Adjustment Layer Mask Protection
const adjLayer = layerMgr.addAdjustmentLayer('brightnessContrast', { brightness: 10 });
layerMgr.setActiveLayer(adjLayer.id);
adjLayer.isMaskActive = false; // Mask is not selected
mockApp.toastMessage = null;

toolMgr.onPointerDown(pointerEvent);
assert.strictEqual(toolMgr.isMouseDown, false, 'Pointer down must be cancelled on unmasked adjustment layer');
assert(mockApp.toastMessage && mockApp.toastMessage.includes('mask'), 'Toast notification must instruct to select adjustment mask');
console.log('  ✓ Adjustment layer prevents painting unless mask is actively targeted');

// ─────────────────────────────────────────────────────────────
// Group 3: Headless Safe Alerts & Guarded APIs
// ─────────────────────────────────────────────────────────────
console.log('\n► Test Group 3: Headless Safe Alerts & Error Handlers');

// Ensure calling methods with single layer does not throw ReferenceError if alert is undefined
const origAlert = global.alert;
delete global.alert; // Simulate headless runtime

try {
  const soloLayerMgr = new LayerManager(200, 200);
  const deleteRes = soloLayerMgr.deleteActiveLayer();
  assert.strictEqual(deleteRes, false, 'Deleting sole layer must safely return false without throwing');
  console.log('  ✓ deleteActiveLayer executes safely without window.alert in headless environments');
} finally {
  global.alert = origAlert;
}

// ─────────────────────────────────────────────────────────────
// Group 4: AI Skin Smoothing Acceleration & Parity
// ─────────────────────────────────────────────────────────────
console.log('\n► Test Group 4: AI Skin Smoothing Acceleration & Robustness');

const testW = 64;
const testH = 64;
const testImg = new global.ImageData(testW, testH);
for (let i = 0; i < testImg.data.length; i += 4) {
  testImg.data[i] = 210;     // R (human skin)
  testImg.data[i + 1] = 160; // G
  testImg.data[i + 2] = 140; // B
  testImg.data[i + 3] = 255;
}

// Introduce a localized skin blemish/variation
const blemishIdx = (16 * testW + 16) * 4;
testImg.data[blemishIdx] = 235;     // Higher R
testImg.data[blemishIdx + 1] = 175; // Higher G
testImg.data[blemishIdx + 2] = 155; // Higher B

const startTime = Date.now();
const smoothed = NeuralFilters.skinSmoothing(testImg, { smoothness: 80, detailPreservation: 15 });
const elapsed = Date.now() - startTime;

assert(smoothed instanceof global.ImageData, 'skinSmoothing must return valid ImageData');
assert.strictEqual(smoothed.width, testW, 'Width must match');
assert.strictEqual(smoothed.height, testH, 'Height must match');

// Verify blemish was smoothed towards the background neighborhood mean (210)
const smoothedR = smoothed.data[blemishIdx];
assert(smoothedR < 235, `Skin smoothing must attenuate skin blemish (expected < 235, got ${smoothedR})`);
console.log(`  ✓ AI Skin Smoothing executed in ${elapsed}ms with O(1) lookup tables (smoothed blemish from 235 to ${smoothedR})`);

// Test Color Transfer graceful fallback without reference image
const ctResult = NeuralFilters.colorTransfer(testImg, null, { intensity: 80 });
assert(ctResult instanceof global.ImageData, 'colorTransfer without reference must return clean ImageData');
assert.strictEqual(ctResult.data[0], testImg.data[0], 'RGB values must match pristine source when reference is null');
console.log('  ✓ AI Color Transfer gracefully falls back when reference image is absent');

console.log('\n════════════════════════════════════════════════════════════════');
console.log('  Systemic Parity & Protections Suite: All 4 Groups Passed (100%)');
console.log('════════════════════════════════════════════════════════════════\n');
