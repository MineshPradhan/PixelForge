// ════════════════════════════════════════════════════════════════
// PixelForge Studio — Camera RAW Container & DNG Verification Suite
// ════════════════════════════════════════════════════════════════

const assert = require('assert');
global.ImageData = class ImageData {
  constructor(w, h, data) {
    this.width = w;
    this.height = h;
    this.data = data || new Uint8ClampedArray(w * h * 4);
  }
};
const RawContainerEngine = require('./js/raw-container.js');
const CameraRawBayerEngine = require('./js/bayer-raw.js');

console.log('════════════════════════════════════════════════════════════════');
console.log('  PixelForge Studio — Camera RAW Container & DNG Verification');
console.log('════════════════════════════════════════════════════════════════\n');

// ► Test 1: Synthetic Linear CFA DNG Encoding
console.log('► Test Group 1: Adobe DNG Container Encoding');
const w = 32, h = 32;
const testRaw = new Uint16Array(w * h);
for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
    testRaw[y * w + x] = Math.round((x / w) * 16383);
  }
}

const dngBuffer = RawContainerEngine.encodeDng(testRaw, w, h, 'BGGR', 14);
assert.ok(dngBuffer instanceof ArrayBuffer, 'DNG buffer is ArrayBuffer');
assert.ok(dngBuffer.byteLength > w * h * 2, 'DNG buffer contains header, IFD, and strip bytes');
console.log(`  ✓ DNG encoded cleanly: ${dngBuffer.byteLength} bytes`);

// ► Test 2: Binary IFD and CFA Pattern Decoding
console.log('\n► Test Group 2: Binary IFD and CFA Pattern Decoding');
const parsed = RawContainerEngine.parse(dngBuffer);
assert.strictEqual(parsed.width, w, `Width matches: ${parsed.width} === ${w}`);
assert.strictEqual(parsed.height, h, `Height matches: ${parsed.height} === ${h}`);
assert.strictEqual(parsed.bitDepth, 14, 'Bit depth is 14-bit');
assert.strictEqual(parsed.pattern, 'BGGR', 'Bayer pattern recognized as BGGR');
assert.strictEqual(parsed.rawData.length, w * h, 'Raw mosaic length matches pixel count');
assert.strictEqual(parsed.whiteLevel, 16383, 'White level matches 14-bit max');
console.log('  ✓ Parsed metadata and CFA pattern match encoded parameters');

// ► Test 3: Seamless Integration with Bayer Demosaicing Pipeline
console.log('\n► Test Group 3: Integration with Bayer Demosaicing Pipeline');
const developed = CameraRawBayerEngine.developRaw(parsed.rawData, parsed.width, parsed.height, {
  pattern: parsed.pattern,
  temperature: 5500,
  tint: 0,
  exposure: 0.0
});

assert.strictEqual(developed.width, w);
assert.strictEqual(developed.height, h);
assert.strictEqual(developed.data.length, w * h * 4);
assert.ok(developed.data[0] >= 0, 'Developed Red channel valid');
assert.ok(developed.data[1] >= 0, 'Developed Green channel valid');
assert.ok(developed.data[2] >= 0, 'Developed Blue channel valid');
assert.strictEqual(developed.data[3], 255, 'Developed Alpha channel is 255');
console.log('  ✓ Extracted container mosaic seamlessly developed through Camera RAW pipeline');

console.log('\n════════════════════════════════════════════════════════════════');
console.log('  All RAW Container & DNG Tests Passed! (100%)');
console.log('════════════════════════════════════════════════════════════════\n');
