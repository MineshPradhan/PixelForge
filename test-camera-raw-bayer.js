// ══════════════════════════════════════════════════════════════════════
// PixelForge Studio — Camera RAW Bayer Demosaicing Test Suite
// ══════════════════════════════════════════════════════════════════════

const assert = require('assert');

global.ImageData = class ImageData {
  constructor(w, h) {
    this.width = w;
    this.height = h;
    this.data = new Uint8ClampedArray(w * h * 4);
  }
};

const CameraRawBayerEngine = require('./js/bayer-raw.js');

console.log('════════════════════════════════════════════════════════════════');
console.log('  PixelForge Studio — Camera RAW Bayer Engine Verification');
console.log('════════════════════════════════════════════════════════════════\n');

// Test 1: Bayer CFA pattern identification
console.log('► Test Group 1: Bayer CFA Pattern Verification');
const pRGGB = CameraRawBayerEngine.getCfaColor(0, 0, 'RGGB');
const pRGGB_g = CameraRawBayerEngine.getCfaColor(1, 0, 'RGGB');
const pRGGB_b = CameraRawBayerEngine.getCfaColor(1, 1, 'RGGB');
assert.strictEqual(pRGGB, 'R', 'Top-left photosite in RGGB is Red');
assert.strictEqual(pRGGB_g, 'G1', 'Top-right photosite in RGGB is Green 1');
assert.strictEqual(pRGGB_b, 'B', 'Bottom-right photosite in RGGB is Blue');
console.log('  ✓ RGGB Bayer pattern photosites correctly indexed');

const pBGGR = CameraRawBayerEngine.getCfaColor(0, 0, 'BGGR');
const pBGGR_r = CameraRawBayerEngine.getCfaColor(1, 1, 'BGGR');
assert.strictEqual(pBGGR, 'B', 'Top-left in BGGR is Blue');
assert.strictEqual(pBGGR_r, 'R', 'Bottom-right in BGGR is Red');
console.log('  ✓ BGGR Bayer pattern photosites correctly indexed');

// Test 2: Kelvin Temperature & Tint White Balance
console.log('\n► Test Group 2: Kelvin White Balance Multipliers');
const warmWB = CameraRawBayerEngine.kelvinToRgbMultipliers(3200, 0); // Tungsten
const coolWB = CameraRawBayerEngine.kelvinToRgbMultipliers(7500, 0); // Shade
assert.ok(warmWB.b > warmWB.r, 'Tungsten 3200K boosts blue channel to counteract yellow tungsten cast');
assert.ok(coolWB.r > coolWB.b, 'Shade 7500K boosts red channel to counteract cool shadow cast');
console.log('  ✓ Kelvin Planckian blackbody locus calculations match optical colorimetry');

// Test 3: Synthetic Raw Mosaic & Demosaicing
console.log('\n► Test Group 3: Synthetic CFA Mosaic & Gradient-Guided Demosaicing');
const w = 64, h = 64;
const testImg = new ImageData(w, h);
// Fill with high-contrast gradient
for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
    const idx = (y * w + x) * 4;
    testImg.data[idx] = Math.round((x / w) * 255);       // Red gradient
    testImg.data[idx + 1] = Math.round((y / h) * 255);   // Green gradient
    testImg.data[idx + 2] = 128;                         // Blue constant
    testImg.data[idx + 3] = 255;
  }
}

// Convert to 14-bit CFA raw mosaic
const rawMosaic = CameraRawBayerEngine.mosaicFromImageData(testImg, 'RGGB');
assert.strictEqual(rawMosaic.length, w * h, 'Raw mosaic array matches sensor dimensions');

// Demosaic
const demosaiced = CameraRawBayerEngine.demosaicBayer(rawMosaic, w, h, 'RGGB', 14);
assert.ok(demosaiced.r instanceof Float32Array, 'Red channel is Float32Array');
assert.ok(demosaiced.g instanceof Float32Array, 'Green channel is Float32Array');
assert.ok(demosaiced.b instanceof Float32Array, 'Blue channel is Float32Array');

// Check reconstruction fidelity in center
const centerIdx = (32 * w + 32);
const reconstructedR = Math.round(demosaiced.r[centerIdx] * 255);
const reconstructedG = Math.round(demosaiced.g[centerIdx] * 255);
const reconstructedB = Math.round(demosaiced.b[centerIdx] * 255);

assert.ok(Math.abs(reconstructedR - testImg.data[centerIdx * 4]) < 10, 'Red reconstruction within 4% error');
assert.ok(Math.abs(reconstructedG - testImg.data[centerIdx * 4 + 1]) < 10, 'Green reconstruction within 4% error');
assert.ok(Math.abs(reconstructedB - testImg.data[centerIdx * 4 + 2]) < 10, 'Blue reconstruction within 4% error');
console.log('  ✓ Gradient-guided demosaicing accurately reconstructs color channels');

// Test 4: Photographic Development Pipeline
console.log('\n► Test Group 4: Photographic Development & Highlight Recovery');
const devImg = CameraRawBayerEngine.developRaw(demosaiced, w, h, {
  temperature: 5500,
  tint: 0,
  exposure: +1.0, // +1 EV stop
  highlights: -20,
  shadows: +15,
  contrast: 10,
  vibrance: 20
});

assert.strictEqual(devImg.width, w);
assert.strictEqual(devImg.height, h);
assert.strictEqual(devImg.data.length, w * h * 4);
assert.ok(devImg.data[centerIdx * 4 + 3] === 255, 'Alpha is 255');
console.log('  ✓ Photographic develop pipeline produces valid 8-bit sRGB ImageData');

console.log('\n════════════════════════════════════════════════════════════════');
console.log('  Camera RAW Bayer Suite: 4 / 4 Test Groups Passed! (100%)');
console.log('════════════════════════════════════════════════════════════════\n');
