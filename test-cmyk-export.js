// ════════════════════════════════════════════════════════════════
// PixelForge Studio — Native CMYK TIFF & Prepress Plates Suite
// ════════════════════════════════════════════════════════════════

const assert = require('assert');
global.ImageData = class ImageData {
  constructor(w, h, data) {
    this.width = w;
    this.height = h;
    this.data = data || new Uint8ClampedArray(w * h * 4);
  }
};
const CmykExportEngine = require('./js/cmyk-export.js');

console.log('════════════════════════════════════════════════════════════════');
console.log('  PixelForge Studio — Native CMYK TIFF & Prepress Plates Suite');
console.log('════════════════════════════════════════════════════════════════\n');

// ► Test 1: RGB to CMYK Ink Conversion with GCR & TIL
console.log('► Test Group 1: RGB to CMYK Ink Density & GCR Verification');
{
  // Pure White
  const whiteInk = CmykExportEngine.rgbToCmyk(255, 255, 255);
  assert.strictEqual(whiteInk.c, 0, 'White has 0% Cyan');
  assert.strictEqual(whiteInk.m, 0, 'White has 0% Magenta');
  assert.strictEqual(whiteInk.y, 0, 'White has 0% Yellow');
  assert.strictEqual(whiteInk.k, 0, 'White has 0% Black');

  // Pure Cyan (0, 255, 255)
  const cyanInk = CmykExportEngine.rgbToCmyk(0, 255, 255);
  assert.strictEqual(cyanInk.c, 255, 'Pure cyan produces 100% C');
  assert.strictEqual(cyanInk.m, 0, 'Pure cyan has 0% M');
  assert.strictEqual(cyanInk.y, 0, 'Pure cyan has 0% Y');

  // Dark Neutral Gray (30, 30, 30) - GCR should assign mostly to K ink
  const grayInk = CmykExportEngine.rgbToCmyk(30, 30, 30, 0.85);
  assert.ok(grayInk.k > 180, `GCR converts neutral shadows to K channel: K=${grayInk.k}`);

  // Total Ink Limit (TIL) check
  const richBlack = CmykExportEngine.rgbToCmyk(0, 0, 0, 0.8, 300);
  const totalInkPct = ((richBlack.c + richBlack.m + richBlack.y + richBlack.k) / 255) * 100;
  assert.ok(totalInkPct <= 300.5, `Total ink coverage clamped to <= 300%: ${totalInkPct.toFixed(1)}%`);
  console.log('  ✓ RGB to CMYK ink densities, GCR, and TIL limits verified');
}

// ► Test 2: Native 4-Channel Separated CMYK TIFF Encoding
console.log('\n► Test Group 2: Native 4-Channel CMYK TIFF Binary Structure');
{
  const w = 16, h = 16;
  const testImg = new ImageData(w, h);
  for (let i = 0; i < w * h * 4; i += 4) {
    testImg.data[i] = 180;     // R
    testImg.data[i + 1] = 60;  // G
    testImg.data[i + 2] = 220; // B
    testImg.data[i + 3] = 255;
  }

  const tiffBuf = CmykExportEngine.encodeCmykTiff(testImg, {
    dpi: 300,
    compression: 'uncompressed',
    profile: 'U.S. Web Coated (SWOP) v2'
  });

  assert.ok(tiffBuf instanceof ArrayBuffer, 'TIFF buffer is ArrayBuffer');
  assert.ok(tiffBuf.byteLength > w * h * 4, 'Buffer includes header, IFD, metadata, and 4-channel pixels');

  const view = new DataView(tiffBuf);
  // Header checks
  assert.strictEqual(view.getUint8(0), 0x49, 'TIFF Little Endian I');
  assert.strictEqual(view.getUint8(1), 0x49, 'TIFF Little Endian I');
  assert.strictEqual(view.getUint16(2, true), 42, 'TIFF Magic 42');

  const ifdOffset = view.getUint32(4, true);
  assert.strictEqual(ifdOffset, 8, 'IFD immediately follows 8-byte header');

  const numEntries = view.getUint16(ifdOffset, true);
  assert.ok(numEntries >= 14, `IFD contains standard tags: ${numEntries}`);

  // Find PhotometricInterpretation tag (0x0106)
  let foundPhoto = false;
  let foundSamples = false;
  let pos = ifdOffset + 2;
  for (let i = 0; i < numEntries; i++) {
    const tag = view.getUint16(pos, true);
    const val = view.getUint32(pos + 8, true);
    if (tag === 0x0106) {
      assert.strictEqual(val, 5, 'PhotometricInterpretation is 5 (Separated CMYK)');
      foundPhoto = true;
    }
    if (tag === 0x0115) {
      assert.strictEqual(val, 4, 'SamplesPerPixel is 4 (C, M, Y, K)');
      foundSamples = true;
    }
    pos += 12;
  }
  assert.ok(foundPhoto, 'PhotometricInterpretation tag found');
  assert.ok(foundSamples, 'SamplesPerPixel tag found');
  console.log(`  ✓ Native 4-channel Separated CMYK TIFF encoded: ${tiffBuf.byteLength} bytes`);
}

// ► Test 3: Prepress Separation Plates Generation
console.log('\n► Test Group 3: Prepress Separation Plates Generation');
{
  const w = 8, h = 8;
  const testImg = new ImageData(w, h);
  // Red color (255, 0, 0) -> Cyan=0, Magenta=255, Yellow=255, Black=0
  for (let i = 0; i < w * h * 4; i += 4) {
    testImg.data[i] = 255;
    testImg.data[i + 1] = 0;
    testImg.data[i + 2] = 0;
    testImg.data[i + 3] = 255;
  }

  const plates = CmykExportEngine.generateSeparationPlates(testImg);
  assert.ok(plates.cyan instanceof ImageData, 'Cyan plate is ImageData');
  assert.ok(plates.magenta instanceof ImageData, 'Magenta plate is ImageData');
  assert.ok(plates.yellow instanceof ImageData, 'Yellow plate is ImageData');
  assert.ok(plates.black instanceof ImageData, 'Black plate is ImageData');

  // Cyan film plate should have 0 ink (film is light/white 255)
  assert.strictEqual(plates.cyan.data[0], 255, 'Cyan film plate is clear');
  // Magenta film plate should have solid ink (film is dark/opaque 0)
  assert.ok(plates.magenta.data[0] < 50, 'Magenta film plate holds solid ink');
  // Yellow film plate should have solid ink
  assert.ok(plates.yellow.data[0] < 50, 'Yellow film plate holds solid ink');

  console.log('  ✓ Prepress film separation plates correctly generated for all 4 channels');
}

console.log('\n════════════════════════════════════════════════════════════════');
console.log('  All CMYK TIFF & Prepress Plates Tests Passed! (100%)');
console.log('════════════════════════════════════════════════════════════════\n');
