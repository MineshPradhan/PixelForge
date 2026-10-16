// ════════════════════════════════════════════════════════════════
// PixelForge Studio — Camera RAW Lab & Advanced Adjustments Test
// ════════════════════════════════════════════════════════════════

const assert = require('assert');
const fs = require('fs');

// Mock browser globals for Node test environment
global.window = global;

function createMockCanvas(w = 100, h = 100) {
  return {
    width: w,
    height: h,
    style: {},
    getContext: () => ({
      getImageData: () => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
      putImageData: () => {},
      clearRect: () => {},
      drawImage: () => {},
      save: () => {},
      restore: () => {},
      fillRect: () => {},
      beginPath: () => {},
      stroke: () => {}
    })
  };
}

global.document = {
  createElement: (tag) => {
    if (tag === 'canvas') return createMockCanvas(100, 100);
    return {
      style: {},
      classList: { add: () => {}, remove: () => {}, contains: () => false },
      addEventListener: () => {}
    };
  },
  getElementById: (id) => null,
  querySelectorAll: (sel) => [],
  addEventListener: () => {}
};
global.ImageData = class ImageData {
  constructor(w, h, data) {
    this.width = w;
    this.height = h;
    this.data = data || new Uint8ClampedArray(w * h * 4);
  }
};

const Utils = require('./js/utils.js');
Utils.createCanvas = (w, h) => createMockCanvas(w, h);
global.Utils = Utils;
const Filters = require('./js/filters.js');
const CameraRawBayerEngine = require('./js/bayer-raw.js');
const LayerManager = require('./js/layers.js');

console.log('════════════════════════════════════════════════════════════════');
console.log('  PixelForge Studio — Camera RAW Lab & Adjustments Verification');
console.log('════════════════════════════════════════════════════════════════\n');

// ► Test 1: Shadows & Highlights Filter Engine
console.log('► Test Group 1: Shadows & Highlights Engine');
{
  // Create an image with dark shadows (20) and bright highlights (235)
  const imgData = new ImageData(4, 1);
  const d = imgData.data;
  // Pixel 0: Deep shadow
  d[0] = 20; d[1] = 20; d[2] = 20; d[3] = 255;
  // Pixel 1: Midtone
  d[4] = 128; d[5] = 128; d[6] = 128; d[7] = 255;
  // Pixel 2: Bright highlight
  d[8] = 235; d[9] = 235; d[10] = 235; d[11] = 255;
  // Pixel 3: Transparent
  d[12] = 100; d[13] = 100; d[14] = 100; d[15] = 0;

  const result = Filters.shadowsHighlights(imgData, 50, 50, 0);
  const rd = result.data;

  // Shadow pixel should be boosted
  assert.ok(rd[0] > 20, `Shadow pixel boosted: ${rd[0]} > 20`);
  // Highlight pixel should be recovered (reduced brightness)
  assert.ok(rd[8] < 235, `Highlight pixel compressed: ${rd[8]} < 235`);
  // Alpha preserved
  assert.strictEqual(rd[3], 255, 'Opaque alpha preserved');
  assert.strictEqual(rd[15], 0, 'Transparent alpha preserved');
  console.log('  ✓ Shadows lifted and highlights recovered cleanly');
}

// ► Test 2: Replace Color Filter Engine
console.log('► Test Group 2: Replace Color Engine');
{
  // Create an image with Red target and Blue non-target
  const imgData = new ImageData(2, 1);
  const d = imgData.data;
  // Pixel 0: Pure Red (255, 0, 0)
  d[0] = 255; d[1] = 0; d[2] = 0; d[3] = 255;
  // Pixel 1: Pure Blue (0, 0, 255)
  d[4] = 0; d[5] = 0; d[6] = 255; d[7] = 255;

  // Shift red hue by 120 degrees (Green)
  const result = Filters.replaceColor(imgData, [255, 0, 0], 30, 120, 0, 0);
  const rd = result.data;

  // Pixel 0 should become Green
  assert.ok(rd[1] > 200, `Red pixel converted to green: G=${rd[1]}`);
  assert.ok(rd[0] < 50, `Red channel lowered: R=${rd[0]}`);

  // Pixel 1 (Blue) should remain untouched (outside fuzziness)
  assert.strictEqual(rd[4], 0, 'Blue pixel R unchanged');
  assert.strictEqual(rd[5], 0, 'Blue pixel G unchanged');
  assert.strictEqual(rd[6], 255, 'Blue pixel B unchanged');
  console.log('  ✓ Replace color selectively transforms target color within fuzziness');
}

// ► Test 3: Camera RAW Bayer CFA Pipeline Integration
console.log('► Test Group 3: Camera RAW Bayer CFA Pipeline Integration');
{
  const w = 16, h = 16;
  const testImg = new ImageData(w, h);
  for (let i = 0; i < w * h * 4; i += 4) {
    testImg.data[i] = 210;     // Red
    testImg.data[i + 1] = 160; // Green
    testImg.data[i + 2] = 120; // Blue
    testImg.data[i + 3] = 255;
  }

  // Generate CFA mosaic and develop through full pipeline
  const mosaic = CameraRawBayerEngine.mosaicFromImageData(testImg, 'RGGB');
  assert.strictEqual(mosaic.length, w * h, 'CFA mosaic length matches pixel count');

  const developed = CameraRawBayerEngine.developRaw(mosaic, w, h, {
    pattern: 'RGGB',
    temperature: 6500,
    tint: 5,
    exposure: 0.5,
    highlights: -20,
    shadows: 15,
    contrast: 10,
    vibrance: 15,
    saturation: 10
  });

  assert.strictEqual(developed.width, w);
  assert.strictEqual(developed.height, h);
  assert.strictEqual(developed.data.length, w * h * 4);
  assert.ok(developed.data[0] > 0, 'Developed Red channel populated');
  assert.ok(developed.data[1] > 0, 'Developed Green channel populated');
  assert.ok(developed.data[2] > 0, 'Developed Blue channel populated');
  console.log('  ✓ Camera RAW Bayer CFA mosaic and develop pipeline verified');
}

// ► Test 4: Non-Destructive Adjustment Layer Integration
console.log('► Test Group 4: Non-Destructive Adjustment Layer Integration');
{
  const lm = new LayerManager(32, 32);
  const baseLayer = lm.addLayer('Base Photo', '#808080');

  // Add Shadows/Highlights adjustment layer
  const shLayer = lm.addAdjustmentLayer('shadowsHighlights', {
    shadowAmount: 40,
    highlightAmount: 30,
    midtoneContrast: 10
  });
  assert.strictEqual(shLayer.type, 'adjustment');
  assert.strictEqual(shLayer.adjustmentType, 'shadowsHighlights');

  // Add Replace Color adjustment layer
  const rcLayer = lm.addAdjustmentLayer('replaceColor', {
    targetRgb: [128, 128, 128],
    fuzziness: 50,
    hueShift: 60
  });
  assert.strictEqual(rcLayer.type, 'adjustment');
  assert.strictEqual(rcLayer.adjustmentType, 'replaceColor');

  console.log('  ✓ Adjustment layers for Shadows/Highlights and Replace Color instantiated cleanly');
}

console.log('\n════════════════════════════════════════════════════════════════');
console.log('  All Camera RAW Lab & Adjustment Tests Passed! (100%)');
console.log('════════════════════════════════════════════════════════════════\n');
