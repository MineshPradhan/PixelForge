// ══════════════════════════════════════════════════════════════════════
// PixelForge Studio Pro — Phase 7: Retouching Suite (Patch & Content-Aware Move)
// ══════════════════════════════════════════════════════════════════════

const assert = require('assert');

// ── Headless DOM & Canvas Mock Environment ──
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

const Filters = require('./js/filters.js');
global.Filters = Filters;

const Utils = require('./js/utils.js');
global.Utils = Utils;

let passedTests = 0;
let totalTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(err);
  }
}

console.log('\n════════════════════════════════════════════════════════════════');
console.log('  PixelForge Studio Pro — Phase 7: Retouching Suite');
console.log('════════════════════════════════════════════════════════════════\n');

console.log('► Test Group 1: Patch Tool Engine (Source & Destination Modes)');

test('applyPatch returns original ImageData untouched when offset is (0, 0)', () => {
  const w = 40, h = 40;
  const imgData = new ImageData(w, h);
  for (let i = 0; i < imgData.data.length; i += 4) {
    imgData.data[i] = 120;
    imgData.data[i + 1] = 130;
    imgData.data[i + 2] = 140;
    imgData.data[i + 3] = 255;
  }
  const mask = new Uint8Array(w * h);
  mask.fill(255); // Full mask

  const result = Filters.applyPatch(imgData, mask, { dx: 0, dy: 0 }, 'source');
  assert.strictEqual(result.data[0], 120);
  assert.strictEqual(result.data[1], 130);
  assert.strictEqual(result.data[2], 140);
});

test('applyPatch in source mode replaces target hole with sample patch and harmonizes illumination delta', () => {
  const w = 50, h = 50;
  const imgData = new ImageData(w, h);
  // Fill background with grey (100, 100, 100)
  for (let i = 0; i < imgData.data.length; i += 4) {
    imgData.data[i] = 100;
    imgData.data[i + 1] = 100;
    imgData.data[i + 2] = 100;
    imgData.data[i + 3] = 255;
  }

  // Place a blemish (black spot) in the target area (x: 10..20, y: 10..20)
  const mask = new Uint8Array(w * h);
  for (let y = 10; y < 20; y++) {
    for (let x = 10; x < 20; x++) {
      const idx = y * w + x;
      mask[idx] = 255;
      imgData.data[idx * 4] = 0;
      imgData.data[idx * 4 + 1] = 0;
      imgData.data[idx * 4 + 2] = 0;
    }
  }

  // Clean texture source area is at dx: +25, dy: 0 (x: 35..45, y: 10..20) which is grey 100
  // Patch source mode: sample from target + dx and replace target
  const result = Filters.applyPatch(imgData, mask, { dx: 25, dy: 0 }, 'source');

  // Verify that inside the target area (e.g. x: 15, y: 15), the black spot has been patched with grey ~100
  const centerIdx = (15 * w + 15) * 4;
  assert.ok(result.data[centerIdx] > 80, `Expected patched pixel R > 80, got ${result.data[centerIdx]}`);
  assert.ok(result.data[centerIdx + 1] > 80, `Expected patched pixel G > 80, got ${result.data[centerIdx + 1]}`);
  assert.ok(result.data[centerIdx + 2] > 80, `Expected patched pixel B > 80, got ${result.data[centerIdx + 2]}`);
});

test('applyPatch in destination mode stamps current selection onto target offset with seamless boundary blending', () => {
  const w = 50, h = 50;
  const imgData = new ImageData(w, h);
  // Background is white
  imgData.data.fill(255);

  // In source selection (x: 5..15, y: 5..15), create a blue feature
  const mask = new Uint8Array(w * h);
  for (let y = 5; y < 15; y++) {
    for (let x = 5; x < 15; x++) {
      const idx = y * w + x;
      mask[idx] = 255;
      imgData.data[idx * 4] = 20;
      imgData.data[idx * 4 + 1] = 50;
      imgData.data[idx * 4 + 2] = 200; // Blue
    }
  }

  // Stamp to destination at dx: +20, dy: +20 (target is x: 25..35, y: 25..35)
  const result = Filters.applyPatch(imgData, mask, { dx: 20, dy: 20 }, 'destination');

  // Check destination center (x: 30, y: 30) receives blue stamp
  const destCenterIdx = (30 * w + 30) * 4;
  assert.ok(result.data[destCenterIdx + 2] > 150, `Destination B should be high, got ${result.data[destCenterIdx + 2]}`);
  
  // Check original source (x: 10, y: 10) remains intact in destination mode
  const srcCenterIdx = (10 * w + 10) * 4;
  assert.strictEqual(result.data[srcCenterIdx + 2], 200, 'Original source selection remains intact');
});

console.log('\n► Test Group 2: Content-Aware Move & Extend Engine');

test('contentAwareMove in move mode relocates object and inpaints source hole', () => {
  const w = 60, h = 60;
  const imgData = new ImageData(w, h);
  // Uniform green background (R: 30, G: 180, B: 30)
  for (let i = 0; i < imgData.data.length; i += 4) {
    imgData.data[i] = 30;
    imgData.data[i + 1] = 180;
    imgData.data[i + 2] = 30;
    imgData.data[i + 3] = 255;
  }

  // Red circle/block at (x: 10..20, y: 10..20)
  const mask = new Uint8Array(w * h);
  for (let y = 10; y < 20; y++) {
    for (let x = 10; x < 20; x++) {
      const idx = y * w + x;
      mask[idx] = 255;
      imgData.data[idx * 4] = 220;     // Red
      imgData.data[idx * 4 + 1] = 20;
      imgData.data[idx * 4 + 2] = 20;
    }
  }

  // Move offset: dx = +30, dy = +30 (destination x: 40..50, y: 40..50)
  const result = Filters.contentAwareMove(imgData, mask, { dx: 30, dy: 30 }, 'move');

  // 1. Destination (x: 45, y: 45) should now have the red object
  const destIdx = (45 * w + 45) * 4;
  assert.ok(result.data[destIdx] > 180, `Destination R should be red, got ${result.data[destIdx]}`);

  // 2. Original hole (x: 15, y: 15) should be inpainted with surrounding green background
  const origIdx = (15 * w + 15) * 4;
  assert.ok(result.data[origIdx + 1] > 120, `Original hole should be inpainted green, got G=${result.data[origIdx + 1]}`);
  assert.ok(result.data[origIdx] < 100, `Original red should be removed from hole, got R=${result.data[origIdx]}`);
});

test('contentAwareMove in extend mode clones object at offset while preserving original', () => {
  const w = 60, h = 60;
  const imgData = new ImageData(w, h);
  imgData.data.fill(200);

  // Mark an object at (10..20, 10..20)
  const mask = new Uint8Array(w * h);
  for (let y = 10; y < 20; y++) {
    for (let x = 10; x < 20; x++) {
      const idx = y * w + x;
      mask[idx] = 255;
      imgData.data[idx * 4] = 10;
      imgData.data[idx * 4 + 1] = 10;
      imgData.data[idx * 4 + 2] = 240; // Blue object
    }
  }

  // Extend offset: dx = +30, dy = 0
  const result = Filters.contentAwareMove(imgData, mask, { dx: 30, dy: 0 }, 'extend');

  // Both original (15, 15) and extended (45, 15) should have the blue object
  const origIdx = (15 * w + 15) * 4;
  const extIdx = (15 * w + 45) * 4;
  assert.ok(result.data[origIdx + 2] > 200, 'Original object still intact in extend mode');
  assert.ok(result.data[extIdx + 2] > 200, 'Extended clone synthesized at target location');
});

console.log('\n► Test Group 3: ToolManager Retouching Integration');

test('ToolManager integrates applyPatch and applyContentAwareMove workflows', () => {
  const ToolManager = require('./js/tools.js');
  
  // Mock application instance
  let historyPushed = null;
  const mockLayerCanvas = {
    getContext: () => ({
      getImageData: (x, y, w, h) => new ImageData(w, h),
      putImageData: () => {}
    })
  };
  const mockApp = {
    width: 100,
    height: 100,
    renderComposite: () => {},
    pushHistoryState: (label) => { historyPushed = label; },
    layerManager: {
      getActiveLayer: () => ({
        id: 'layer-1',
        ctx: mockLayerCanvas.getContext('2d'),
        canvas: mockLayerCanvas
      })
    }
  };

  const tm = new ToolManager(mockApp);
  tm.selection = {
    mask: new Uint8Array(100 * 100),
    active: true
  };
  tm.selection.mask.fill(255);

  // Test applyPatch
  const patchSuccess = tm.applyPatch({ dx: 10, dy: 10 }, 'source');
  assert.strictEqual(patchSuccess, true);
  assert.strictEqual(historyPushed, 'Patch Tool (Source)');

  // Test applyContentAwareMove
  const moveSuccess = tm.applyContentAwareMove({ dx: 15, dy: 15 }, 'move');
  assert.strictEqual(moveSuccess, true);
  assert.strictEqual(historyPushed, 'Content-Aware Move');
});

console.log('\n════════════════════════════════════════════════════════════════');
console.log(`  Phase 7 Retouching Suite: ${passedTests} / ${totalTests} Passed (${Math.round((passedTests / totalTests) * 100)}%)`);
console.log('════════════════════════════════════════════════════════════════\n');

if (passedTests < totalTests) {
  process.exit(1);
}
