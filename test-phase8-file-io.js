/**
 * Test Suite: Phase 8 File I/O & Export Suite
 * Tests TIFF Encoder/Decoder, PDF Document Exporter, Batch Processor, and Asset Exporter.
 */

const assert = require('assert');

// Polyfill ImageData and Canvas for Node test environment
global.ImageData = class ImageData {
  constructor(w, h) {
    this.width = w;
    this.height = h;
    this.data = new Uint8ClampedArray(w * h * 4);
  }
};

const { TiffEngine, PdfExporter, BatchProcessor, AssetExporter } = require('./js/file-io.js');

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

async function testAsync(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
  }
}

console.log('Testing Phase 8: File I/O & Export Suite...\n');

// 1. TIFF Encoder & Decoder Tests
test('TIFF: PackBits RLE compression and decompression roundtrip', () => {
  // Test repetitive data
  const original = new Uint8Array([10, 10, 10, 10, 10, 20, 30, 40, 50, 50, 50, 50]);
  const compressed = TiffEngine.packBitsCompress(original);
  assert(compressed.length > 0, 'Compressed array should not be empty');
  const decompressed = TiffEngine.packBitsDecompress(compressed, original.length);
  assert.strictEqual(decompressed.length, original.length, 'Decompressed length must match original');
  for (let i = 0; i < original.length; i++) {
    assert.strictEqual(decompressed[i], original[i], `Byte ${i} mismatch`);
  }
});

test('TIFF: Encode uncompressed RGBA image data', () => {
  const w = 4, h = 4;
  const imgData = new ImageData(w, h);
  for (let i = 0; i < imgData.data.length; i += 4) {
    imgData.data[i]     = 255; // R
    imgData.data[i + 1] = 128; // G
    imgData.data[i + 2] = 64;  // B
    imgData.data[i + 3] = 255; // A
  }

  const tiffBytes = TiffEngine.encodeFromImageData(imgData, { compression: 'none', dpi: 300 });
  assert(tiffBytes instanceof Uint8Array, 'TIFF result must be Uint8Array');
  assert(tiffBytes.length > 100, 'TIFF file size must include headers and metadata');

  // Verify Little-Endian TIFF magic header 'II\x2a\x00'
  assert.strictEqual(tiffBytes[0], 0x49, 'TIFF header byte 0 must be I');
  assert.strictEqual(tiffBytes[1], 0x49, 'TIFF header byte 1 must be I');
  assert.strictEqual(tiffBytes[2], 0x2A, 'TIFF header byte 2 must be 42');
  assert.strictEqual(tiffBytes[3], 0x00, 'TIFF header byte 3 must be 0');
});

test('TIFF: Encode PackBits compressed RGBA image data', () => {
  const w = 8, h = 8;
  const imgData = new ImageData(w, h);
  for (let i = 0; i < imgData.data.length; i += 4) {
    imgData.data[i]     = 200;
    imgData.data[i + 1] = 100;
    imgData.data[i + 2] = 50;
    imgData.data[i + 3] = 255;
  }

  const tiffBytes = TiffEngine.encodeFromImageData(imgData, { compression: 'packbits', dpi: 600 });
  assert(tiffBytes instanceof Uint8Array, 'TIFF result must be Uint8Array');

  // Decode it back and verify
  const decoded = TiffEngine.decode(tiffBytes);
  assert.strictEqual(decoded.width, w, 'Decoded width must match');
  assert.strictEqual(decoded.height, h, 'Decoded height must match');
  assert.strictEqual(decoded.data.length, w * h * 4, 'Decoded RGBA length must match');
  assert.strictEqual(decoded.data[0], 200, 'Decoded red pixel must match');
  assert.strictEqual(decoded.data[1], 100, 'Decoded green pixel must match');
  assert.strictEqual(decoded.data[2], 50,  'Decoded blue pixel must match');
  assert.strictEqual(decoded.data[3], 255, 'Decoded alpha pixel must match');
});

test('TIFF: Resolution and DPI tag inspection', () => {
  const w = 2, h = 2;
  const imgData = new ImageData(w, h);
  const tiffBytes = TiffEngine.encodeFromImageData(imgData, { dpi: 300 });
  const view = new DataView(tiffBytes.buffer, tiffBytes.byteOffset, tiffBytes.byteLength);
  const ifdOffset = view.getUint32(4, true);
  const tagCount = view.getUint16(ifdOffset, true);
  assert(tagCount >= 10, 'IFD must contain at least 10 standard TIFF tags');
});

// 2. PDF Document Exporter Tests
test('PDF: Generate valid single-page PDF with image XObject and SMask', () => {
  const w = 4, h = 4;
  const imgData = new ImageData(w, h);
  // Fill sample image with varying alpha
  for (let i = 0; i < imgData.data.length; i += 4) {
    imgData.data[i]     = 255;
    imgData.data[i + 1] = 0;
    imgData.data[i + 2] = 0;
    imgData.data[i + 3] = 128; // semi-transparent
  }

  const page = { width: w, height: h, imgData };
  const pdfBytes = PdfExporter.exportDocument([page], { title: 'Test PDF Document' });

  assert(pdfBytes instanceof Uint8Array, 'PDF output must be Uint8Array');
  const pdfStr = Buffer.from(pdfBytes).toString('binary');

  assert(pdfStr.startsWith('%PDF-1.4'), 'PDF must start with %PDF-1.4 header');
  assert(pdfStr.includes('/Type /Catalog'), 'PDF must contain Catalog object');
  assert(pdfStr.includes('/Type /Pages'), 'PDF must contain Pages object');
  assert(pdfStr.includes('/Type /Page'), 'PDF must contain Page object');
  assert(pdfStr.includes('/Subtype /Image'), 'PDF must contain Image XObject');
  assert(pdfStr.includes('/SMask'), 'PDF must contain SMask for alpha channel transparency');
  assert(pdfStr.includes('/ASCIIHexDecode'), 'PDF stream must use ASCIIHexDecode filter');
  assert(pdfStr.includes('xref'), 'PDF must contain xref cross-reference table');
  assert(pdfStr.includes('trailer'), 'PDF must contain trailer dictionary');
  assert(pdfStr.includes('%%EOF'), 'PDF must terminate with %%EOF marker');
});

test('PDF: Multi-page artboards document compilation', () => {
  const p1 = { width: 10, height: 10, imgData: new ImageData(10, 10) };
  const p2 = { width: 20, height: 20, imgData: new ImageData(20, 20) };
  const p3 = { width: 30, height: 30, imgData: new ImageData(30, 30) };

  const pdfBytes = PdfExporter.exportDocument([p1, p2, p3], { title: 'Multi-Artboards Portfolio' });
  const pdfStr = Buffer.from(pdfBytes).toString('binary');

  // Verify page count is 3
  assert(pdfStr.includes('/Count 3'), 'Pages tree must declare Count 3');
  // Verify 3 Page objects exist
  const pageMatches = pdfStr.match(/\/Type \/Page\b/g);
  assert.strictEqual(pageMatches.length, 3, 'Must contain exactly 3 Page objects');
});

// 3. Batch Image Processor Tests
(async () => {
  await testAsync('BatchProcessor: Process multi-format conversion and renaming', async () => {
    const mockFiles = [
      { name: 'photo_alpha', width: 2, height: 2 },
      { name: 'photo_beta', width: 2, height: 2 }
    ];

    const results = await BatchProcessor.processBatch(mockFiles, {
      format: 'png',
      scale: 1.0,
      namingTemplate: 'custom_{name}_{index}'
    });

    assert.strictEqual(results.length, 2, 'Should produce 2 processed assets');
    assert.strictEqual(results[0].filename, 'custom_photo_alpha_001.png', 'Filename 1 matches template');
    assert.strictEqual(results[1].filename, 'custom_photo_beta_002.png', 'Filename 2 matches template');
  });

  await testAsync('BatchProcessor: Multi-format PDF compilation batch', async () => {
    const mockFiles = [
      { name: 'slide1', width: 4, height: 4 },
      { name: 'slide2', width: 4, height: 4 }
    ];

    const results = await BatchProcessor.processBatch(mockFiles, {
      format: 'pdf',
      namingTemplate: 'Consolidated_Portfolio'
    });

    assert.strictEqual(results.length, 1, 'PDF batch should compile all pages into 1 document');
    assert.strictEqual(results[0].filename, 'Consolidated_Portfolio.pdf');
    assert(results[0].data instanceof Uint8Array, 'PDF data must be binary');
  });

  // 4. Multi-Asset (Export for Screens) Tests
  await testAsync('AssetExporter: Multi-density scale and format generation', async () => {
    const mockCanvas = {
      width: 100,
      height: 100,
      getContext: () => ({
        drawImage: () => {},
        imageSmoothingEnabled: true
      }),
      toDataURL: (mime) => `data:${mime};base64,mock`
    };

    const scales = [
      { scale: 1, suffix: '@1x' },
      { scale: 2, suffix: '@2x' },
      { scale: 0.5, suffix: '@0.5x' }
    ];
    const formats = ['png', 'webp'];

    const assets = await AssetExporter.exportMultiScale(mockCanvas, scales, formats, 'Icon');
    assert.strictEqual(assets.length, 6, '3 scales * 2 formats should yield 6 assets');

    const filenames = assets.map(a => a.filename);
    assert(filenames.includes('Icon@1x.png'), 'Contains Icon@1x.png');
    assert(filenames.includes('Icon@2x.png'), 'Contains Icon@2x.png');
    assert(filenames.includes('Icon@0.5x.png'), 'Contains Icon@0.5x.png');
    assert(filenames.includes('Icon@1x.webp'), 'Contains Icon@1x.webp');
    assert(filenames.includes('Icon@2x.webp'), 'Contains Icon@2x.webp');
    assert(filenames.includes('Icon@0.5x.webp'), 'Contains Icon@0.5x.webp');
  });

  console.log(`\nPhase 8 File I/O Tests Completed: ${passedTests}/${totalTests} Passed.`);
  if (passedTests !== totalTests) {
    process.exit(1);
  }
})();
