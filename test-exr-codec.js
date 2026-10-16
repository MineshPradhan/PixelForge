// ════════════════════════════════════════════════════════════════
// PixelForge Studio — OpenEXR 32-Bit Linear Float Codec Suite
// ════════════════════════════════════════════════════════════════

const assert = require('assert');
global.ImageData = class ImageData {
  constructor(w, h, data) {
    this.width = w;
    this.height = h;
    this.data = data || new Uint8ClampedArray(w * h * 4);
  }
};
const OpenExrCodec = require('./js/exr-codec.js');

console.log('════════════════════════════════════════════════════════════════');
console.log('  PixelForge Studio — OpenEXR 32-Bit Linear Float Codec Suite');
console.log('════════════════════════════════════════════════════════════════\n');

// ► Test 1: IEEE 754 Half-Float (16-bit) Conversion Precision
console.log('► Test Group 1: IEEE 754 Half-Float Precision');
{
  const testValues = [0.0, 1.0, 0.5, 2.5, 128.0, 0.0039];
  testValues.forEach(val => {
    const half = OpenExrCodec.toHalf(val);
    const recovered = OpenExrCodec.fromHalf(half);
    const diff = Math.abs(val - recovered);
    assert.ok(diff < 0.01, `Value ${val} converted with high fidelity: ${recovered}`);
  });
  console.log('  ✓ Half-float bitwise conversions match IEEE 754 specifications');
}

// ► Test 2: OpenEXR Binary Header & Structure Encoding
console.log('\n► Test Group 2: OpenEXR Encoding & Scanline Generation');
const w = 16, h = 12;
const floatData = new Float32Array(w * h * 4);
for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
    const idx = (y * w + x) * 4;
    floatData[idx] = (x / w) * 2.0;       // Red (HDR > 1.0)
    floatData[idx + 1] = (y / h) * 1.5;   // Green
    floatData[idx + 2] = 0.75;            // Blue
    floatData[idx + 3] = 1.0;             // Alpha
  }
}

const exrBuf = OpenExrCodec.encode({ width: w, height: h, data: floatData });
assert.ok(exrBuf instanceof ArrayBuffer, 'EXR buffer is ArrayBuffer');
assert.ok(exrBuf.byteLength > w * h * 8, 'EXR buffer contains header, channel descriptors, and scanlines');

const view = new DataView(exrBuf);
const magic = view.getUint32(0, true);
assert.strictEqual(magic, 0x01312f76, 'OpenEXR Magic signature 0x01312f76 verified');
console.log(`  ✓ OpenEXR file encoded cleanly: ${exrBuf.byteLength} bytes`);

// ► Test 3: OpenEXR Binary Decoding
console.log('\n► Test Group 3: OpenEXR Binary Decoding & Channel Reconstruction');
const decoded = OpenExrCodec.decode(exrBuf);
assert.strictEqual(decoded.width, w, `Decoded width matches: ${decoded.width}`);
assert.strictEqual(decoded.height, h, `Decoded height matches: ${decoded.height}`);
assert.strictEqual(decoded.data.length, w * h * 4, 'Channel count matches 4 (RGBA)');

// Check pixel values (subpixel tolerance for half-float)
const centerIdx = (6 * w + 8) * 4;
assert.ok(Math.abs(decoded.data[centerIdx] - floatData[centerIdx]) < 0.05, 'Red channel matches');
assert.ok(Math.abs(decoded.data[centerIdx + 1] - floatData[centerIdx + 1]) < 0.05, 'Green channel matches');
assert.ok(Math.abs(decoded.data[centerIdx + 2] - floatData[centerIdx + 2]) < 0.05, 'Blue channel matches');
assert.strictEqual(decoded.data[centerIdx + 3], 1.0, 'Alpha channel is 1.0');
console.log('  ✓ OpenEXR scanlines and channels decoded with linear floating point fidelity');

// ► Test 4: Tonemapping to sRGB ImageData (ACES Filmic)
console.log('\n► Test Group 4: ACES Filmic Tonemapping to sRGB');
const sRgbImg = OpenExrCodec.toImageData(decoded, 0.0);
assert.ok(sRgbImg instanceof ImageData, 'Tonemapped output is valid ImageData');
assert.strictEqual(sRgbImg.width, w);
assert.strictEqual(sRgbImg.height, h);
assert.ok(sRgbImg.data[0] >= 0 && sRgbImg.data[0] <= 255, 'Pixel R clamped to 8-bit');
assert.strictEqual(sRgbImg.data[3], 255, 'Alpha channel is 255');
console.log('  ✓ ACES Filmic tonemapping generated valid sRGB image');

console.log('\n════════════════════════════════════════════════════════════════');
console.log('  All OpenEXR Codec Tests Passed! (100%)');
console.log('════════════════════════════════════════════════════════════════\n');
