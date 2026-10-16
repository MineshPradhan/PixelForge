const assert = require('assert');
const AdobePresetImporter = require('./js/adobe-importers.js');

console.log('🧪 Starting Adobe Preset Importers Test Suite (.ase, .aco, .abr)...');

// ══════════════════════════════════════════════════════════════════════════
// 1. Adobe Swatch Exchange (.ase) Tests
// ══════════════════════════════════════════════════════════════════════════
console.log('--- Testing .ase (Adobe Swatch Exchange) ---');

const sampleSwatches = [
  { name: 'Pure Red', hex: '#ff0000', rgb: [255, 0, 0], space: 'RGB ', type: 'Global' },
  { name: 'Pure Green', hex: '#00ff00', rgb: [0, 255, 0], space: 'RGB ', type: 'Global' },
  { name: 'Cyan Blue', hex: '#0080ff', rgb: [0, 128, 255], space: 'RGB ', type: 'Normal' },
  { name: 'Charcoal', hex: '#333333', rgb: [51, 51, 51], space: 'RGB ', type: 'Normal' }
];

// Test Encoding
const encodedAse = AdobePresetImporter.encodeAse(sampleSwatches, 'PixelForge Palette');
assert(encodedAse instanceof Uint8Array, 'encodeAse must return a Uint8Array');
assert(encodedAse.length > 20, 'encodeAse payload should have significant size');

// Test Decoding
const decodedSwatches = AdobePresetImporter.parseAse(encodedAse);
assert.strictEqual(decodedSwatches.length, 4, 'Should parse 4 swatches back');
assert.strictEqual(decodedSwatches[0].name, 'Pure Red');
assert.strictEqual(decodedSwatches[0].rgb[0], 255);
assert.strictEqual(decodedSwatches[0].rgb[1], 0);
assert.strictEqual(decodedSwatches[0].rgb[2], 0);
assert.strictEqual(decodedSwatches[0].group, 'PixelForge Palette');

assert.strictEqual(decodedSwatches[1].name, 'Pure Green');
assert.strictEqual(decodedSwatches[1].rgb[1], 255);

// Error on invalid header
assert.throws(() => {
  AdobePresetImporter.parseAse(new Uint8Array([0x00, 0x01, 0x02, 0x03]));
}, /Invalid ASE signature/);

console.log('✅ .ase roundtrip and header validation passed!');

// ══════════════════════════════════════════════════════════════════════════
// 2. Adobe Color Palette (.aco) Tests
// ══════════════════════════════════════════════════════════════════════════
console.log('--- Testing .aco (Adobe Color Palette) ---');

// Build a synthetic ACO v1 + v2 binary
function buildMockAco() {
  const parts = [];
  
  // Helper to push uint16 BE
  function pushU16(val) {
    parts.push((val >> 8) & 0xff, val & 0xff);
  }

  function pushU32(val) {
    parts.push((val >> 24) & 0xff, (val >> 16) & 0xff, (val >> 8) & 0xff, val & 0xff);
  }

  // Version 1 block
  pushU16(1); // v1
  pushU16(2); // 2 colors
  // Color 1: RGB (space 0) -> [65535, 0, 0, 0] = Red
  pushU16(0); pushU16(65535); pushU16(0); pushU16(0); pushU16(0);
  // Color 2: Grayscale (space 2) -> [32768, 0, 0, 0] = ~50% Gray
  pushU16(2); pushU16(5000); pushU16(0); pushU16(0); pushU16(0);

  // Version 2 block
  pushU16(2); // v2
  pushU16(2); // 2 colors
  
  // Color 1: RGB Blue with name "Ocean Blue"
  pushU16(0); pushU16(0); pushU16(0); pushU16(65535); pushU16(0);
  const name1 = "Ocean Blue\0";
  pushU32(name1.length);
  for (let i = 0; i < name1.length; i++) {
    pushU16(name1.charCodeAt(i));
  }

  // Color 2: HSB with name "Sunny Yellow"
  // HSB: H=60 deg (60 * 182.04 = 10922), S=100% (65535), B=100% (65535)
  pushU16(1); pushU16(10922); pushU16(65535); pushU16(65535); pushU16(0);
  const name2 = "Sunny Yellow\0";
  pushU32(name2.length);
  for (let i = 0; i < name2.length; i++) {
    pushU16(name2.charCodeAt(i));
  }

  return new Uint8Array(parts);
}

const mockAcoBuffer = buildMockAco();
const acoSwatches = AdobePresetImporter.parseAco(mockAcoBuffer);

assert.strictEqual(acoSwatches.length, 2, 'Should prioritize v2 entries when present');
assert.strictEqual(acoSwatches[0].name, 'Ocean Blue');
assert.strictEqual(acoSwatches[0].rgb[0], 0);
assert.strictEqual(acoSwatches[0].rgb[1], 0);
assert.strictEqual(acoSwatches[0].rgb[2], 255);

assert.strictEqual(acoSwatches[1].name, 'Sunny Yellow');
assert.strictEqual(acoSwatches[1].rgb[0], 255);
assert.strictEqual(acoSwatches[1].rgb[1], 255);
assert.strictEqual(acoSwatches[1].rgb[2], 0);

console.log('✅ .aco v1 & v2 parsing passed!');

// ══════════════════════════════════════════════════════════════════════════
// 3. Adobe Brush Presets (.abr) Tests
// ══════════════════════════════════════════════════════════════════════════
console.log('--- Testing .abr (Photoshop Brush Presets) ---');

// Build a synthetic Legacy ABR (version 1)
function buildMockLegacyAbr() {
  const parts = [];
  function pushU16(val) { parts.push((val >> 8) & 0xff, val & 0xff); }
  function pushU32(val) {
    parts.push((val >> 24) & 0xff, (val >> 16) & 0xff, (val >> 8) & 0xff, val & 0xff);
  }

  pushU16(1); // Version 1
  pushU16(2); // Count = 2

  // Brush 1: Computed brush (type 1)
  pushU16(1);
  pushU32(6); // sub-block length: misc(2) + spacing(2) + diameter(2)
  pushU16(0);  // misc
  pushU16(20); // spacing
  pushU16(45); // diameter

  // Brush 2: Sampled brush (type 2)
  pushU16(2);
  // Dimensions 2x2, bounds: top=0, left=0, bottom=2, right=2
  const pixels = [255, 128, 64, 0];
  const subLen = 2 + 2 + 2 + 2 + 2 + 2 + 2 + 2 + 1 + pixels.length;
  pushU32(subLen);
  pushU16(0); // misc (2 bytes)
  pushU16(25); // spacing (2 bytes)
  pushU16(0); // antialias (2 bytes)
  pushU16(0); // top (2)
  pushU16(0); // left (2)
  pushU16(2); // bottom (2)
  pushU16(2); // right (2)
  pushU16(8); // depth (2)
  parts.push(0); // comp = 0 (raw uncompressed, 1 byte)
  for (let p of pixels) parts.push(p);

  return new Uint8Array(parts);
}

const mockAbr = buildMockLegacyAbr();
const brushes = AdobePresetImporter.parseAbr(mockAbr);

assert.strictEqual(brushes.length, 2, 'Should parse 2 brushes from legacy .abr');
assert.strictEqual(brushes[0].type, 'computed');
assert.strictEqual(brushes[0].size, 45);
assert.strictEqual(brushes[0].spacing, 0.2);

assert.strictEqual(brushes[1].type, 'sampled');
assert.strictEqual(brushes[1].width, 2);
assert.strictEqual(brushes[1].height, 2);
assert.strictEqual(brushes[1].alphaData.length, 4);
assert.strictEqual(brushes[1].alphaData[0], 255);
assert.strictEqual(brushes[1].alphaData[3], 0);

console.log('✅ .abr legacy & sampled parsing passed!');

// ══════════════════════════════════════════════════════════════════════════
// 4. Color Conversion Math Tests (PackBits, HSB, LAB)
// ══════════════════════════════════════════════════════════════════════════
console.log('--- Testing PackBits & Color Math ---');

// PackBits test: literal run [0x02, 10, 20, 30] -> [10, 20, 30], repeat run [-2 (0xFE), 99] -> [99, 99, 99]
const packbitsSrc = new Uint8Array([2, 10, 20, 30, 254, 99]);
const packbitsDst = new Uint8Array(6);
AdobePresetImporter.decompressPackBits(packbitsSrc, 0, packbitsSrc.length, packbitsDst, 0, 6);
assert.deepStrictEqual(Array.from(packbitsDst), [10, 20, 30, 99, 99, 99], 'Packbits decompression matches');

// HSB -> RGB test
const rgbFromHsb = AdobePresetImporter.hsbToRgb(120, 1.0, 1.0);
assert.deepStrictEqual(rgbFromHsb, [0, 255, 0], '120deg pure green should be [0, 255, 0]');

// LAB -> RGB test: L=100, a=0, b=0 -> pure white [255, 255, 255]
const whiteRgb = AdobePresetImporter.labToRgb(100, 0, 0);
assert(Math.abs(whiteRgb[0] - 255) <= 2 && Math.abs(whiteRgb[1] - 255) <= 2 && Math.abs(whiteRgb[2] - 255) <= 2, 'L* 100 should be near 255');

console.log('✅ PackBits and Color space conversions passed!');
console.log('🎉 ALL ADOBE PRESET IMPORTER TESTS PASSED (100%)!');
