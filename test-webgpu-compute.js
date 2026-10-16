const assert = require('assert');
const WebGpuComputeEngine = require('./js/webgpu-compute.js');

console.log('🧪 Running WebGPU Hardware Compute Acceleration test suite...\n');

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

// Test 1: WGSL Shaders integrity check
test('WGSL compute shader library contains valid WGSL entry points', () => {
  assert(WebGpuComputeEngine.WGSL_SHADERS.gaussianBlur.includes('@compute @workgroup_size(16, 16)'));
  assert(WebGpuComputeEngine.WGSL_SHADERS.bilateralFilter.includes('@compute @workgroup_size(16, 16)'));
  assert(WebGpuComputeEngine.WGSL_SHADERS.unsharpMask.includes('@compute @workgroup_size(16, 16)'));
  assert(WebGpuComputeEngine.WGSL_SHADERS.bayerDemosaic.includes('@compute @workgroup_size(16, 16)'));
});

// Test 2: Separable Gaussian Blur Kernel
test('cpuGaussianBlur smooths pixel gradients symmetrically', () => {
  const width = 10;
  const height = 10;
  const data = new Uint8ClampedArray(width * height * 4);

  // Set center pixel to white, others black
  const centerIdx = (5 * width + 5) * 4;
  data[centerIdx] = 255;
  data[centerIdx + 1] = 255;
  data[centerIdx + 2] = 255;
  data[centerIdx + 3] = 255;

  const blurred = WebGpuComputeEngine.cpuGaussianBlur({ width, height, data }, 2);
  const outData = blurred.data;

  // Center should be dispersed
  assert(outData[centerIdx] < 255, 'Center peak should be dispersed');
  assert(outData[centerIdx] > 0, 'Center peak should retain energy');

  // Adjacent neighbor should receive diffused energy
  const neighborIdx = (5 * width + 6) * 4;
  assert(outData[neighborIdx] > 0, 'Neighbor must receive blurred diffusion');
  assert(outData[neighborIdx] < outData[centerIdx], 'Diffusion falls off with distance');
});

// Test 3: Bilateral Edge-Preserving Filter
test('cpuBilateralFilter preserves sharp contrast edges while smoothing flat areas', () => {
  const width = 8;
  const height = 8;
  const data = new Uint8ClampedArray(width * height * 4);

  // Left half dark (10), right half bright (240) with slight noise
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const base = x < 4 ? 10 : 240;
      const noise = (x % 2 === 0) ? 2 : -2;
      data[idx] = base + noise;
      data[idx + 1] = base + noise;
      data[idx + 2] = base + noise;
      data[idx + 3] = 255;
    }
  }

  const filtered = WebGpuComputeEngine.cpuBilateralFilter({ width, height, data }, 2, 20);
  const leftEdgePixel = filtered.data[(4 * width + 3) * 4];
  const rightEdgePixel = filtered.data[(4 * width + 4) * 4];

  // Strong edge must be preserved (left still ~10, right still ~240)
  assert(leftEdgePixel < 30, `Left edge should stay dark, got ${leftEdgePixel}`);
  assert(rightEdgePixel > 220, `Right edge should stay bright, got ${rightEdgePixel}`);
});

// Test 4: Unsharp Mask Filter
test('cpuUnsharpMask boosts local high-frequency edge contrast', () => {
  const width = 10;
  const height = 10;
  const data = new Uint8ClampedArray(width * height * 4);

  // Step transition at x = 5 (left = 50, right = 200)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const v = x < 5 ? 50 : 200;
      data[idx] = v;
      data[idx + 1] = v;
      data[idx + 2] = v;
      data[idx + 3] = 255;
    }
  }

  const sharpened = WebGpuComputeEngine.cpuUnsharpMask({ width, height, data }, 2.0, 1, 1);
  const darkEdge = sharpened.data[(5 * width + 4) * 4];
  const brightEdge = sharpened.data[(5 * width + 5) * 4];

  // Overshoot sharpening effect (dark edge becomes darker, bright edge becomes brighter)
  assert(darkEdge <= 50, `Dark edge should undergo undershoot, got ${darkEdge}`);
  assert(brightEdge >= 200, `Bright edge should undergo overshoot, got ${brightEdge}`);
});

// Test 5: Bayer RAW Demosaicing
test('cpuBayerDemosaic reconstructs full 3-channel RGBA from single-channel CFA sensor grid', () => {
  const width = 4;
  const height = 4;
  // Uniform pure green sensor response
  // In RGGB:
  // (0,0)=R(0), (1,0)=G(200)
  // (0,1)=G(200), (1,1)=B(0)
  const raw = new Uint16Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const isGreen = (x + y) % 2 === 1;
      raw[y * width + x] = isGreen ? 200 : 0;
    }
  }

  const rgba = WebGpuComputeEngine.cpuBayerDemosaic(raw, width, height, 'RGGB', 0, 255);
  assert.strictEqual(rgba.width, 4);
  assert.strictEqual(rgba.height, 4);
  assert.strictEqual(rgba.data.length, 4 * 4 * 4);

  // Center pixel (1,1) should have reconstructed high green
  const gVal = rgba.data[(1 * width + 1) * 4 + 1];
  assert(gVal > 150, `Reconstructed green should be high, got ${gVal}`);
});

console.log(`\n📊 Summary: ${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
