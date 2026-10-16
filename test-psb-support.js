const assert = require('assert');
const PsdEngine = require('./js/psd-engine.js');

console.log('🧪 Running Photoshop PSB Large Document Format test suite...\n');

// Mock Utils.createCanvas for Node.js environment
global.Utils = {
  createCanvas(w, h) {
    const buffer = new Uint8ClampedArray(w * h * 4);
    return {
      width: w,
      height: h,
      getContext: () => ({
        fillStyle: '#000000',
        globalAlpha: 1.0,
        globalCompositeOperation: 'source-over',
        fillRect: (x, y, width, height) => {
          // Fill buffer
          for (let i = 0; i < width * height; i++) {
            buffer[i * 4] = 255;
            buffer[i * 4 + 1] = 255;
            buffer[i * 4 + 2] = 255;
            buffer[i * 4 + 3] = 255;
          }
        },
        drawImage: () => {},
        save: () => {},
        restore: () => {},
        getImageData: (x, y, width, height) => ({
          data: buffer,
          width,
          height
        })
      }),
      toDataURL: () => 'data:image/png;base64,'
    };
  }
};

function createMockLayer(name, width, height, r, g, b, a) {
  const numPixels = width * height;
  const data = new Uint8ClampedArray(numPixels * 4);
  for (let i = 0; i < numPixels; i++) {
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = a;
  }
  return {
    name,
    visible: true,
    opacity: 100,
    blendMode: 'source-over',
    ctx: {
      getImageData: () => ({ data, width, height })
    },
    canvas: { width, height }
  };
}

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ ${name}:`, err);
    failed++;
  }
}

// Test 1: ByteStream 64-bit int read/write
test('ByteStream writeUint64 & readUint64 handles large 64-bit BigInt values', () => {
  const stream = new PsdEngine.ByteStream(32);
  stream.writeUint64(1048576);
  stream.writeUint64(BigInt('42949672960')); // > 32 bits
  stream.pos = 0;
  assert.strictEqual(stream.readUint64(), 1048576);
  assert.strictEqual(stream.readUint64(), 42949672960);
});

// Test 2: Standard PSD (version 1) roundtrip
test('PsdWriter and PsdReader roundtrip standard PSD (Version 1)', () => {
  const width = 64;
  const height = 48;
  const project = {
    width,
    height,
    layers: [
      createMockLayer('Background', width, height, 255, 0, 0, 255),
      createMockLayer('Layer 1', width, height, 0, 255, 0, 200)
    ]
  };

  const psdBuf = PsdEngine.PsdWriter.write(project, { isPsb: false });
  assert(psdBuf.length > 0);

  const parsed = PsdEngine.PsdReader.parse(psdBuf);
  assert.strictEqual(parsed.version, 1);
  assert.strictEqual(parsed.isPsb, false);
  assert.strictEqual(parsed.width, 64);
  assert.strictEqual(parsed.height, 48);
  assert.strictEqual(parsed.layers.length, 2);
  assert.strictEqual(parsed.layers[0].name, 'Background');
  assert.strictEqual(parsed.layers[1].name, 'Layer 1');
  assert.strictEqual(parsed.layers[0].rgbaData.length, 64 * 48 * 4);
});

// Test 3: Large Document PSB (version 2) roundtrip
test('PsdWriter.writePsb generates valid Photoshop PSB Version 2 format with 64-bit headers', () => {
  const width = 80;
  const height = 60;
  const project = {
    width,
    height,
    layers: [
      createMockLayer('Base Artwork', width, height, 100, 150, 200, 255),
      createMockLayer('Detail Overlay', width, height, 255, 200, 50, 180)
    ]
  };

  const psbBuf = PsdEngine.PsdWriter.writePsb(project);
  assert(psbBuf.length > 0);

  // Check header directly
  const view = new DataView(psbBuf.buffer, psbBuf.byteOffset, psbBuf.byteLength);
  const sig = String.fromCharCode(psbBuf[0], psbBuf[1], psbBuf[2], psbBuf[3]);
  const ver = view.getUint16(4, false);
  assert.strictEqual(sig, '8BPS');
  assert.strictEqual(ver, 2, 'PSB version must be 2');

  const parsed = PsdEngine.PsdReader.parse(psbBuf);
  assert.strictEqual(parsed.version, 2);
  assert.strictEqual(parsed.isPsb, true);
  assert.strictEqual(parsed.width, 80);
  assert.strictEqual(parsed.height, 60);
  assert.strictEqual(parsed.layers.length, 2);
  assert.strictEqual(parsed.layers[0].name, 'Base Artwork');
  assert.strictEqual(parsed.layers[1].name, 'Detail Overlay');
  assert.strictEqual(parsed.layers[0].rgbaData.length, 80 * 60 * 4);
});

// Test 4: Auto-detect PSB when width > 30000 or height > 30000
test('PsdWriter automatically switches to PSB when canvas dimension exceeds 30,000 px', () => {
  const project = {
    width: 32000,
    height: 10,
    layers: [
      createMockLayer('Panorama', 32000, 10, 50, 100, 150, 255)
    ]
  };

  const buf = PsdEngine.PsdWriter.write(project);
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const ver = view.getUint16(4, false);
  assert.strictEqual(ver, 2, 'Must automatically switch to Version 2 for >30k dimensions');
});

console.log(`\n📊 Summary: ${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
