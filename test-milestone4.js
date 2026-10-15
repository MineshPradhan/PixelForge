/**
 * PixelForge Studio — Milestone 4 Automated Verification Test Suite
 * Validates Native PSD Interoperability & Pro Export Suite:
 *  - ByteStream binary serialization
 *  - Adobe PackBits RLE compression/decompression
 *  - Photoshop PSD Writer (8BPS structure, layer records, channels, composite)
 *  - Photoshop PSD Reader (full round-trip decoding)
 *  - Multi-layer, mask, opacity, and blend mode preservation
 *  - Scalable Vector Graphics (SVG) export with vector typography
 *  - High-Res Print DPI metadata injection (pHYs chunk)
 */

const assert = require('assert');

// ── Mock DOM & HTML5 Canvas Context for Headless Node.js ──
function createMockCanvas(width, height) {
  const pixelBuffer = new Uint8ClampedArray(width * height * 4);
  const ctx = {
    canvas: null,
    width,
    height,
    fillStyle: '#000000',
    globalAlpha: 1.0,
    globalCompositeOperation: 'source-over',
    fillRect(x, y, w, h) {
      // Mock fillRect with fillStyle
      let r = 0, g = 0, b = 0, a = 255;
      if (this.fillStyle === '#ff0000' || this.fillStyle === 'red') { r = 255; }
      else if (this.fillStyle === '#00ff00' || this.fillStyle === 'green') { g = 255; }
      else if (this.fillStyle === '#0000ff' || this.fillStyle === 'blue') { b = 255; }
      else if (this.fillStyle === '#ffffff' || this.fillStyle === 'white') { r = 255; g = 255; b = 255; }

      const x0 = Math.max(0, Math.min(width, x));
      const y0 = Math.max(0, Math.min(height, y));
      const x1 = Math.max(0, Math.min(width, x + w));
      const y1 = Math.max(0, Math.min(height, y + h));

      for (let cy = y0; cy < y1; cy++) {
        for (let cx = x0; cx < x1; cx++) {
          const idx = (cy * width + cx) * 4;
          pixelBuffer[idx]     = r;
          pixelBuffer[idx + 1] = g;
          pixelBuffer[idx + 2] = b;
          pixelBuffer[idx + 3] = a;
        }
      }
    },
    clearRect(x, y, w, h) {
      const x0 = Math.max(0, Math.min(width, x));
      const y0 = Math.max(0, Math.min(height, y));
      const x1 = Math.max(0, Math.min(width, x + w));
      const y1 = Math.max(0, Math.min(height, y + h));
      for (let cy = y0; cy < y1; cy++) {
        for (let cx = x0; cx < x1; cx++) {
          const idx = (cy * width + cx) * 4;
          pixelBuffer[idx + 3] = 0;
        }
      }
    },
    drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh) {
      if (img && img.getContext) {
        const srcCtx = img.getContext('2d');
        const srcData = srcCtx.getImageData(0, 0, img.width, img.height).data;
        for (let i = 0; i < pixelBuffer.length && i < srcData.length; i++) {
          pixelBuffer[i] = srcData[i];
        }
      }
    },
    getImageData(x, y, w, h) {
      const copy = new Uint8ClampedArray(w * h * 4);
      for (let cy = 0; cy < h; cy++) {
        for (let cx = 0; cx < w; cx++) {
          const srcIdx = ((y + cy) * width + (x + cx)) * 4;
          const dstIdx = (cy * w + cx) * 4;
          if (srcIdx >= 0 && srcIdx + 3 < pixelBuffer.length) {
            copy[dstIdx]     = pixelBuffer[srcIdx];
            copy[dstIdx + 1] = pixelBuffer[srcIdx + 1];
            copy[dstIdx + 2] = pixelBuffer[srcIdx + 2];
            copy[dstIdx + 3] = pixelBuffer[srcIdx + 3];
          }
        }
      }
      return { width: w, height: h, data: copy };
    },
    putImageData(imgData, x, y) {
      const w = imgData.width;
      const h = imgData.height;
      const src = imgData.data;
      for (let cy = 0; cy < h; cy++) {
        for (let cx = 0; cx < w; cx++) {
          const srcIdx = (cy * w + cx) * 4;
          const dstIdx = ((y + cy) * width + (x + cx)) * 4;
          if (dstIdx >= 0 && dstIdx + 3 < pixelBuffer.length) {
            pixelBuffer[dstIdx]     = src[srcIdx];
            pixelBuffer[dstIdx + 1] = src[srcIdx + 1];
            pixelBuffer[dstIdx + 2] = src[srcIdx + 2];
            pixelBuffer[dstIdx + 3] = src[srcIdx + 3];
          }
        }
      }
    },
    createImageData(w, h) {
      return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) };
    },
    save() {},
    restore() {},
    font: '16px sans-serif',
    measureText(text) {
      const sizeMatch = (this.font || '').match(/(\d+)px/);
      const fontSize = sizeMatch ? parseInt(sizeMatch[1], 10) : 16;
      const charWidth = fontSize * 0.6;
      return { width: (text || '').length * charWidth };
    },
    fillText(text, x, y) {},
    beginPath() {},
    moveTo(x, y) {},
    lineTo(x, y) {},
    stroke() {}
  };

  const canvas = {
    width,
    height,
    getContext: () => ctx,
    toDataURL: (mime = 'image/png') => {
      // Mock minimal 1x1 base64 PNG header
      return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    }
  };
  ctx.canvas = canvas;
  return canvas;
}

// Global browser mocks
global.window = {
  Utils: {
    createCanvas: createMockCanvas,
    clamp: (v, min, max) => Math.max(min, Math.min(max, v)),
    lerp: (a, b, t) => a + (b - a) * t,
    hexToRgba: (hex, a = 1) => `rgba(0,0,0,${a})`
  }
};
global.Utils = global.window.Utils;
global.document = {
  getElementById: (id) => null,
  createElement: (tag) => ({
    tagName: tag.toUpperCase(),
    className: '',
    style: {},
    appendChild: () => {},
    addEventListener: () => {},
    classList: { add: () => {}, remove: () => {}, toggle: () => {} },
    getContext: () => createMockCanvas(36, 26).getContext('2d')
  }),
  querySelectorAll: () => []
};
global.atob = (str) => Buffer.from(str, 'base64').toString('binary');
global.btoa = (str) => Buffer.from(str, 'binary').toString('base64');

// Require PixelForge core modules
const PsdEngine = require('./js/psd-engine.js');
const LayerManager = require('./js/layers.js');

let totalTests = 0;
let passedTests = 0;

function it(desc, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✓ PASS: ${desc}`);
  } catch (err) {
    console.error(`  ✗ FAIL: ${desc}`);
    console.error(`    ${err.message}`);
  }
}

console.log('=== RUNNING MILESTONE 4 VERIFICATION SUITE ===\n');

// ─────────────────────────────────────────────────────────────
console.log('[Suite 1: ByteStream & PackBits RLE Engine]');

it('ByteStream writes and reads unsigned & signed integer primitives', () => {
  const stream = new PsdEngine.ByteStream(64);
  stream.writeUint8(250);
  stream.writeInt8(-42);
  stream.writeUint16(65500);
  stream.writeInt16(-12345);
  stream.writeUint32(3000000000);
  stream.writeInt32(-987654321);

  stream.pos = 0;
  assert.strictEqual(stream.readUint8(), 250);
  assert.strictEqual(stream.readInt8(), -42);
  assert.strictEqual(stream.readUint16(), 65500);
  assert.strictEqual(stream.readInt16(), -12345);
  assert.strictEqual(stream.readUint32(), 3000000000);
  assert.strictEqual(stream.readInt32(), -987654321);
});

it('ByteStream auto-grows when writing beyond initial capacity', () => {
  const stream = new PsdEngine.ByteStream(8);
  const bigChunk = new Uint8Array(1000).fill(77);
  stream.writeBytes(bigChunk);
  assert.ok(stream.pos >= 1000);

  stream.pos = 0;
  const readBack = stream.readBytes(1000);
  assert.strictEqual(readBack[500], 77);
});

it('PackBits compresses repeating runs with optimal RLE ratio', () => {
  const input = new Uint8Array(100).fill(42);
  const compressed = PsdEngine.PackBits.compressScanline(input, 0, 100);

  // A run of 100 identical bytes compresses to 2 bytes in PackBits: -(100 - 1) = -99 (or 157 unsigned), 42
  assert.strictEqual(compressed.length, 2, '100 identical bytes must compress to exactly 2 bytes');

  const decompressed = new Uint8Array(100);
  PsdEngine.PackBits.decompress(compressed, 0, compressed.length, decompressed, 0, 100);
  for (let i = 0; i < 100; i++) {
    assert.strictEqual(decompressed[i], 42);
  }
});

it('PackBits compresses and decompresses mixed literals and runs perfectly', () => {
  const input = new Uint8Array([
    1, 2, 3, 4, 5,          // 5 literals
    99, 99, 99, 99, 99,     // 5 repeats
    10, 20, 30,             // 3 literals
    0, 0, 0, 0, 0, 0, 0     // 7 repeats
  ]);

  const compressed = PsdEngine.PackBits.compressScanline(input, 0, input.length);
  const decompressed = new Uint8Array(input.length);
  PsdEngine.PackBits.decompress(compressed, 0, compressed.length, decompressed, 0, input.length);

  assert.deepStrictEqual(decompressed, input, 'Decompressed data must match input exactly');
});

// ─────────────────────────────────────────────────────────────
console.log('\n[Suite 2: Photoshop PSD Writer (Binary Generation)]');

const width = 100;
const height = 80;
const lm = new LayerManager(width, height);

// Layer 1: Red background
const l1 = lm.addLayer('Red Background', '#ff0000');
l1.opacity = 100;
l1.blendMode = 'source-over';

// Layer 2: Green overlay
const l2 = lm.addLayer('Green Overlay', '#00ff00');
l2.opacity = 80;
l2.blendMode = 'multiply';

// Layer 3: Layer with mask
const l3 = lm.addLayer('Masked Layer', '#0000ff');
l3.opacity = 90;
l3.blendMode = 'screen';
lm.addLayerMask(l3.id);

let psdBytes = null;

it('PsdWriter.write produces a valid binary Buffer/Uint8Array', () => {
  psdBytes = PsdEngine.PsdWriter.write({
    width,
    height,
    layers: lm.layers
  });

  assert.ok(psdBytes, 'PSD bytes must be generated');
  assert.ok(psdBytes.length > 100, 'PSD file should contain substantial header, records, and channel data');
});

it('PSD binary begins with valid 8BPS header signature and specification fields', () => {
  const stream = new PsdEngine.ByteStream(psdBytes);
  const sig = stream.readString(4);
  assert.strictEqual(sig, '8BPS', 'Signature must be 8BPS');

  const ver = stream.readUint16();
  assert.strictEqual(ver, 1, 'Version must be 1');

  stream.skip(6); // Reserved
  const channels = stream.readUint16();
  assert.strictEqual(channels, 4, 'Channels must be 4 (RGBA)');

  const docH = stream.readUint32();
  assert.strictEqual(docH, height, 'Height must match document height');

  const docW = stream.readUint32();
  assert.strictEqual(docW, width, 'Width must match document width');

  const depth = stream.readUint16();
  assert.strictEqual(depth, 8, 'Bit depth must be 8');

  const colorMode = stream.readUint16();
  assert.strictEqual(colorMode, 3, 'Color mode must be 3 (RGB)');
});

it('PSD contains Image Resources with 8BIM ResolutionInfo', () => {
  const stream = new PsdEngine.ByteStream(psdBytes);
  stream.skip(26); // Skip Header
  stream.skip(4);  // Color mode length = 0

  const resLen = stream.readUint32();
  assert.ok(resLen > 0, 'Image resources section must have positive length');

  const resSig = stream.readString(4);
  assert.strictEqual(resSig, '8BIM', 'Resource signature must be 8BIM');

  const resId = stream.readUint16();
  assert.strictEqual(resId, 0x03ED, 'Resource ID 0x03ED corresponds to ResolutionInfo');
});

// ─────────────────────────────────────────────────────────────
console.log('\n[Suite 3: Photoshop PSD Reader (Round-Trip Decoding)]');

let parsedPsd = null;

it('PsdReader.parse cleanly decodes generated PSD without errors', () => {
  parsedPsd = PsdEngine.PsdReader.parse(psdBytes);
  assert.ok(parsedPsd, 'Parsed PSD object must exist');
  assert.strictEqual(parsedPsd.width, width);
  assert.strictEqual(parsedPsd.height, height);
  assert.strictEqual(parsedPsd.channels, 4);
});

it('PsdReader correctly restores all layer records and names', () => {
  assert.strictEqual(parsedPsd.layers.length, 3, 'Should decode 3 layers');
  assert.strictEqual(parsedPsd.layers[0].name, 'Red Background');
  assert.strictEqual(parsedPsd.layers[1].name, 'Green Overlay');
  assert.strictEqual(parsedPsd.layers[2].name, 'Masked Layer');
});

it('PsdReader correctly decodes opacity, visibility, and blend modes', () => {
  const layer1 = parsedPsd.layers[0];
  const layer2 = parsedPsd.layers[1];
  const layer3 = parsedPsd.layers[2];

  assert.strictEqual(layer1.opacity, 100);
  assert.strictEqual(layer1.blendMode, 'source-over');
  assert.strictEqual(layer1.visible, true);

  assert.strictEqual(layer2.opacity, 80);
  assert.strictEqual(layer2.blendMode, 'multiply');
  assert.strictEqual(layer2.visible, true);

  assert.strictEqual(layer3.opacity, 90);
  assert.strictEqual(layer3.blendMode, 'screen');
});

it('PsdReader unpacks planar R, G, B, A channels to accurate RGBA pixel data', () => {
  const l1Data = parsedPsd.layers[0].rgbaData;
  assert.ok(l1Data, 'Layer 1 must have RGBA pixel buffer');
  assert.strictEqual(l1Data.length, width * height * 4);

  // Layer 1 was filled with #ff0000 (Red)
  assert.strictEqual(l1Data[0], 255, 'Red channel');
  assert.strictEqual(l1Data[1], 0, 'Green channel');
  assert.strictEqual(l1Data[2], 0, 'Blue channel');
  assert.strictEqual(l1Data[3], 255, 'Alpha channel');
});

it('PsdReader decodes layer mask channel (-2) when present', () => {
  const l3Data = parsedPsd.layers[2];
  assert.strictEqual(l3Data.hasMask, true, 'Layer 3 mask flag must be set');
  assert.ok(l3Data.maskData, 'Mask channel buffer must exist');
  assert.strictEqual(l3Data.maskData.length, width * height);
});

it('PsdReader decodes composite merged image data at end of file', () => {
  assert.ok(parsedPsd.compositeRgba, 'Composite RGBA buffer must be parsed at EOF');
  assert.strictEqual(parsedPsd.compositeRgba.length, width * height * 4);
});

// ─────────────────────────────────────────────────────────────
console.log('\n[Suite 4: SVG Scalable Vector & Typography Export]');

it('SvgExporter generates compliant SVG root tag with viewBox and namespace', () => {
  const svg = PsdEngine.SvgExporter.exportSvg(lm.layers, width, height);
  assert.ok(svg.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
  assert.ok(svg.includes(`viewBox="0 0 ${width} ${height}"`));
  assert.ok(svg.includes(`width="${width}"`));
  assert.ok(svg.includes(`height="${height}"`));
  assert.ok(svg.includes('</svg>'));
});

it('SvgExporter renders vector text layers as native SVG <text> elements with typography attributes', () => {
  const textLayer = lm.addTextLayer('SVG Headline\nSecond Line', 150, 200, {
    fontFamily: 'Montserrat, sans-serif',
    fontSize: 54,
    fontWeight: '700',
    color: '#ffdd00',
    tracking: 3,
    leading: 1.3,
    align: 'center'
  });

  const svg = PsdEngine.SvgExporter.exportSvg(lm.layers, width, height);

  assert.ok(svg.includes('<text'), 'SVG must include <text> node');
  assert.ok(svg.includes('font-family="Montserrat, sans-serif"'));
  assert.ok(svg.includes('font-size="54"'));
  assert.ok(svg.includes('font-weight="700"'));
  assert.ok(svg.includes('fill="#ffdd00"'));
  assert.ok(svg.includes('letter-spacing="3px"'));
  assert.ok(svg.includes('text-anchor="middle"'), 'Center align maps to text-anchor="middle"');
  assert.ok(svg.includes('SVG Headline'), 'First text line must be present');
  assert.ok(svg.includes('Second Line'), 'Second line must be present');
});

it('SvgExporter escapes special XML characters in text and layer names', () => {
  const textLayer = lm.addTextLayer('AT&T <5G> "Fast" \'Safe\'', 10, 10);
  const svg = PsdEngine.SvgExporter.exportSvg([textLayer], 100, 100);
  assert.ok(svg.includes('AT&amp;T &lt;5G&gt; &quot;Fast&quot; &apos;Safe&apos;'));
});

// ─────────────────────────────────────────────────────────────
console.log('\n[Suite 5: Pro Print DPI Metadata & WebP Export]');

it('ProExportSuite.exportWebP formats data URL with image/webp mime', () => {
  const canvas = createMockCanvas(50, 50);
  canvas.toDataURL = (mime) => `data:${mime};base64,mockWebP`;
  const res = PsdEngine.ProExportSuite.exportWebP(canvas, 0.9);
  assert.ok(res.startsWith('data:image/webp;base64,'));
});

it('ProExportSuite.setPngDpi embeds pHYs chunk into PNG header for 300 DPI print', () => {
  // Construct a minimal valid PNG with IHDR
  const fakePngHeader = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG Signature (8 bytes)
    0x00, 0x00, 0x00, 0x0d,                         // IHDR Length = 13 (4 bytes)
    0x49, 0x48, 0x44, 0x52,                         // "IHDR" (4 bytes, offset 12..15)
    0x00, 0x00, 0x00, 0x0a,                         // Width = 10
    0x00, 0x00, 0x00, 0x0a,                         // Height = 10
    0x08, 0x06, 0x00, 0x00, 0x00,                   // Bit depth, color type, compression, filter, interlace
    0x1f, 0x56, 0x51, 0x24                          // IHDR CRC (offset 29..32)
  ]);

  let binStr = '';
  for (let i = 0; i < fakePngHeader.length; i++) binStr += String.fromCharCode(fakePngHeader[i]);
  const originalDataUrl = 'data:image/png;base64,' + Buffer.from(binStr, 'binary').toString('base64');

  const modifiedDataUrl = PsdEngine.ProExportSuite.setPngDpi(originalDataUrl, 300);
  const rawModified = Buffer.from(modifiedDataUrl.split(',')[1], 'base64');

  // Verify pHYs chunk exists at offset 33
  // Length (4 bytes) = 9
  assert.strictEqual(rawModified.readUInt32BE(33), 9);
  // "pHYs" = 0x70 0x48 0x59 0x73
  assert.strictEqual(rawModified[37], 0x70);
  assert.strictEqual(rawModified[38], 0x48);
  assert.strictEqual(rawModified[39], 0x59);
  assert.strictEqual(rawModified[40], 0x73);

  // Pixels per meter for 300 DPI: Math.round(300 * 39.37007874) = 11811 (0x00002E23)
  const dpmX = rawModified.readUInt32BE(41);
  const dpmY = rawModified.readUInt32BE(45);
  assert.strictEqual(dpmX, 11811);
  assert.strictEqual(dpmY, 11811);
  assert.strictEqual(rawModified[49], 1, 'Unit is meter');
});

// ─────────────────────────────────────────────────────────────
console.log('\n========================================');
console.log(`TOTAL TESTS: ${totalTests}`);
console.log(`PASSED: ${passedTests}`);
console.log(`FAILED: ${totalTests - passedTests}`);
console.log('========================================');

if (totalTests === passedTests) {
  console.log('ALL MILESTONE 4 TESTS PASSED PERFECTLY!\n');
  process.exit(0);
} else {
  console.error('SOME MILESTONE 4 TESTS FAILED!\n');
  process.exit(1);
}
