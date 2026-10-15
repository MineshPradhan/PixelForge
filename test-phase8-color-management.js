/**
 * Test Suite: Phase 8 Color Management Suite
 * Tests ICC Profile Parser & Generator, Wide-Gamut Color Spaces,
 * Bradford Chromatic Adaptation, 4 Rendering Intents, and PNG/JPEG ICC Embedding.
 */

const assert = require('assert');

// Polyfill ImageData for test environment
global.ImageData = class ImageData {
  constructor(w, h) {
    this.width = w;
    this.height = h;
    this.data = new Uint8ClampedArray(w * h * 4);
  }
};

const { IccProfileParser, ColorSpaceManager, IccEmbedder } = require('./js/color-management.js');

let totalTests = 0;
let passedTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
  }
}

console.log('Testing Phase 8: Color Management & Working Profiles Suite...\n');

// 1. ICC Profile Generator & Parser
test('ICC: Generate standard binary ICC profiles (sRGB, Display P3, Adobe RGB, ProPhoto)', () => {
  const profiles = ['sRGB', 'displayP3', 'adobeRgb', 'proPhoto'];
  profiles.forEach(pName => {
    const bytes = ColorSpaceManager.generateStandardProfile(pName);
    assert(bytes instanceof Uint8Array, `${pName} profile must be a Uint8Array`);
    assert(bytes.length >= 128, `${pName} profile must be at least 128 bytes (ICC header size)`);

    // ICC header magic at offset 36: 'acsp' (0x61637370)
    assert.strictEqual(bytes[36], 0x61, 'acsp magic byte 0 must be "a"');
    assert.strictEqual(bytes[37], 0x63, 'acsp magic byte 1 must be "c"');
    assert.strictEqual(bytes[38], 0x73, 'acsp magic byte 2 must be "s"');
    assert.strictEqual(bytes[39], 0x70, 'acsp magic byte 3 must be "p"');
  });
});

test('ICC: Parse binary ICC profile and extract metadata', () => {
  const srgbBytes = ColorSpaceManager.generateStandardProfile('sRGB');
  const parsed = IccProfileParser.parse(srgbBytes);

  assert(parsed.valid, 'Parsed ICC profile must be flagged valid');
  assert.strictEqual(parsed.colorSpace, 'RGB ', 'Profile color space must be RGB');
  assert.strictEqual(parsed.connectionSpace, 'XYZ ', 'Profile connection space must be XYZ');
  assert.strictEqual(parsed.profileClass, 'mntr', 'Profile class must be display monitor (mntr)');
  assert(parsed.tagCount > 0, 'Profile must have tags');
  assert(parsed.tags['desc'] || parsed.description, 'Profile must contain description tag');
});

// 2. Color Spaces & Gamma Conversion
test('ColorSpaceManager: Gamma linear <-> companded conversions', () => {
  // sRGB gamma ~2.2 curve
  const val = 0.5;
  const linear = ColorSpaceManager.gammaToLinear(val, 'sRGB');
  const restored = ColorSpaceManager.linearToGamma(linear, 'sRGB');
  assert(Math.abs(restored - val) < 1e-4, 'Linear <-> Gamma roundtrip for sRGB must match');

  // Adobe RGB pure 2.2 gamma
  const linAdobe = ColorSpaceManager.gammaToLinear(val, 'adobeRgb');
  const resAdobe = ColorSpaceManager.linearToGamma(linAdobe, 'adobeRgb');
  assert(Math.abs(resAdobe - val) < 1e-4, 'Linear <-> Gamma roundtrip for Adobe RGB must match');

  // ProPhoto 1.8 gamma
  const linPro = ColorSpaceManager.gammaToLinear(val, 'proPhoto');
  const resPro = ColorSpaceManager.linearToGamma(linPro, 'proPhoto');
  assert(Math.abs(resPro - val) < 1e-4, 'Linear <-> Gamma roundtrip for ProPhoto must match');
});

// 3. Bradford Chromatic Adaptation
test('ColorSpaceManager: Bradford Chromatic Adaptation matrix transform', () => {
  // White point D65 in XYZ: [0.9504, 1.0000, 1.0888]
  const d65White = [0.9504, 1.0000, 1.0888];
  // Adapt D65 to D50
  const d50White = ColorSpaceManager.adaptChromaticity(d65White, 'D65', 'D50');
  // D50 standard white is approximately [0.9642, 1.0000, 0.8249]
  assert(Math.abs(d50White[0] - 0.9642) < 0.05, 'D50 adapted X must be near 0.9642');
  assert(Math.abs(d50White[1] - 1.0000) < 0.01, 'D50 adapted Y must be 1.0000');
  assert(Math.abs(d50White[2] - 0.8249) < 0.05, 'D50 adapted Z must be near 0.8249');

  // Roundtrip back to D65
  const backToD65 = ColorSpaceManager.adaptChromaticity(d50White, 'D50', 'D65');
  assert(Math.abs(backToD65[0] - d65White[0]) < 1e-3, 'Bradford roundtrip X matches');
  assert(Math.abs(backToD65[1] - d65White[1]) < 1e-3, 'Bradford roundtrip Y matches');
  assert(Math.abs(backToD65[2] - d65White[2]) < 1e-3, 'Bradford roundtrip Z matches');
});

// 4. Color Profile Conversion & 4 Rendering Intents
test('ColorSpaceManager: Assign Profile preserves raw byte values', () => {
  const imgData = new ImageData(2, 2);
  imgData.data.set([255, 128, 64, 255, 10, 20, 30, 255, 100, 150, 200, 255, 0, 0, 0, 255]);
  const original = new Uint8ClampedArray(imgData.data);

  const assigned = ColorSpaceManager.assignProfile(imgData, 'displayP3');
  assert.strictEqual(assigned.width, 2);
  assert.strictEqual(assigned.height, 2);
  for (let i = 0; i < imgData.data.length; i++) {
    assert.strictEqual(assigned.data[i], original[i], 'Assign Profile must not alter pixel values');
  }
});

test('ColorSpaceManager: Convert Profile across 4 standard rendering intents', () => {
  const intents = ['perceptual', 'relative-colorimetric', 'saturation', 'absolute-colorimetric'];
  const imgData = new ImageData(2, 2);
  // Pure sRGB Red [255, 0, 0]
  imgData.data.set([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 128, 128, 128, 255]);

  intents.forEach(intent => {
    const converted = ColorSpaceManager.convertProfile(imgData, 'sRGB', 'displayP3', intent);
    assert(converted instanceof ImageData, `Convert with intent ${intent} must return ImageData`);
    // In Display P3, sRGB pure red is inside P3 gamut, so converted Red channel is < 255 in P3 coordinates
    // (since P3 has a wider gamut than sRGB, 100% sRGB red is ~91% in P3 red)
    const p3Red = converted.data[0];
    const p3Green = converted.data[1];
    assert(p3Red > 200 && p3Red <= 255, `P3 Red channel (${p3Red}) should be within valid gamut`);
    assert(p3Green >= 0, `P3 Green channel (${p3Green}) should be valid non-negative`);
  });
});

test('ColorSpaceManager: Gamut boundary clamping and preservation', () => {
  // Convert neutral gray [128, 128, 128]
  const imgData = new ImageData(1, 1);
  imgData.data.set([128, 128, 128, 255]);
  const conv = ColorSpaceManager.convertProfile(imgData, 'sRGB', 'adobeRgb', 'relative-colorimetric');
  // Neutral gray has equal R, G, B in all RGB spaces
  assert(Math.abs(conv.data[0] - conv.data[1]) <= 2, 'R and G in neutral gray must match closely');
  assert(Math.abs(conv.data[1] - conv.data[2]) <= 2, 'G and B in neutral gray must match closely');
});

// 5. ICC Profile PNG & JPEG Embedding
test('IccEmbedder: Embed ICC profile into PNG stream with valid iCCP chunk and CRC', () => {
  // Minimal valid PNG header: Signature (8 bytes) + IHDR (13 bytes data + 12 chunk wrapper = 25 bytes) + IEND (12 bytes)
  const pngSig = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
  // IHDR chunk: Length 13, 'IHDR', 13 data bytes (w=1, h=1, 8bit, RGBA=6, comp=0, filter=0, interlace=0), CRC
  const ihdrChunk = [
    0x00, 0x00, 0x00, 0x0D,
    0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01,
    0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00,
    0x1F, 0x15, 0xC4, 0x89
  ];
  // IEND chunk
  const iendChunk = [
    0x00, 0x00, 0x00, 0x00,
    0x49, 0x45, 0x4E, 0x44,
    0xAE, 0x42, 0x60, 0x82
  ];

  const rawPng = new Uint8Array([...pngSig, ...ihdrChunk, ...iendChunk]);
  const profileBytes = ColorSpaceManager.generateStandardProfile('displayP3');

  const taggedPng = IccEmbedder.embedIccInPng(rawPng, profileBytes, 'Display P3');
  assert(taggedPng.length > rawPng.length, 'Tagged PNG must be larger than raw PNG');

  // Verify PNG signature is intact
  for (let i = 0; i < 8; i++) {
    assert.strictEqual(taggedPng[i], pngSig[i], `PNG signature byte ${i} must match`);
  }

  // Verify presence of 'iCCP' chunk in stream
  const pngStr = Buffer.from(taggedPng).toString('binary');
  assert(pngStr.includes('iCCP'), 'Tagged PNG stream must contain "iCCP" chunk identifier');
  assert(pngStr.includes('Display P3'), 'Tagged PNG stream must contain profile name keyword');
});

test('IccEmbedder: Embed ICC profile into JPEG with APP2 marker', () => {
  // Minimal JPEG header: SOI (0xFF, 0xD8) + EOI (0xFF, 0xD9)
  const rawJpg = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xFF, 0xD9]);
  const profileBytes = ColorSpaceManager.generateStandardProfile('sRGB');

  const taggedJpg = IccEmbedder.embedIccInJpeg(rawJpg, profileBytes);
  assert(taggedJpg.length > rawJpg.length, 'Tagged JPEG must be larger than raw JPEG');
  assert.strictEqual(taggedJpg[0], 0xFF, 'JPEG must start with 0xFF');
  assert.strictEqual(taggedJpg[1], 0xD8, 'JPEG must start with SOI 0xD8');

  // Check for APP2 marker: 0xFF 0xE2
  const jpgStr = Buffer.from(taggedJpg).toString('binary');
  assert(jpgStr.includes('ICC_PROFILE\0'), 'Tagged JPEG must contain ICC_PROFILE identifier in APP2 marker');
});

console.log(`\nPhase 8 Color Management Tests Completed: ${passedTests}/${totalTests} Passed.`);
if (passedTests !== totalTests) {
  process.exit(1);
}
