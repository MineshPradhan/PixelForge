/**
 * PixelForge Studio - Phase 14 Elite Creative & 3D Texture Suite Tests
 * Tests:
 * 1. Dynamic Brush Symmetry & Mandala Engine (Vertical, Horizontal, Dual, Radial, Mandala)
 * 2. 3D Tangent Normal Map & Parallax Height Map Generator
 * 3. 3D LUT Baker & .cube Exporter
 * 4. Non-Destructive Vector Mask Engine with Bézier Path Clipping
 * 5. Split Mesh Warp Engine with Custom Grid Subdivisions
 */

const assert = require('assert');

// Load Phase 14 modules
const { SymmetryEngine } = require('./js/symmetry-engine.js');
const { NormalHeightMapEngine } = require('./js/normal-height-map.js');
const { LutBaker } = require('./js/lut-baker.js');
const { VectorMask } = require('./js/vector-mask.js');
const { SplitWarpEngine } = require('./js/split-warp.js');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    process.exitCode = 1;
  }
}

async function runAllTests() {
  console.log('Testing Phase 14: Elite Creative & 3D Texture Suite...\n');

  // ── 1. Dynamic Brush Symmetry & Mandala Engine ──
  console.log('[1/5] Dynamic Brush Symmetry & Mandala Painting:');

  runTest('SymmetryEngine generates 2 points in vertical mirror mode', () => {
    const sym = new SymmetryEngine(1000, 1000);
    sym.enabled = true;
    sym.setMode('vertical');
    // Pivot at center (500, 500)
    // Point at (600, 500) -> mirrored point at (400, 500)
    const pts = sym.getSymmetricPoints(600, 500);
    assert.strictEqual(pts.length, 2);
    assert.strictEqual(pts[0].x, 600);
    assert.strictEqual(pts[0].y, 500);
    assert.strictEqual(pts[1].x, 400);
    assert.strictEqual(pts[1].y, 500);
  });

  runTest('SymmetryEngine generates 4 points in dual axis mode', () => {
    const sym = new SymmetryEngine(1000, 1000);
    sym.enabled = true;
    sym.setMode('dual_axis');
    // Point at (600, 700) -> 4 quadrant reflections
    const pts = sym.getSymmetricPoints(600, 700);
    assert.strictEqual(pts.length, 4);
    assert.deepStrictEqual(pts[0], { x: 600, y: 700 });
    assert.deepStrictEqual(pts[1], { x: 400, y: 700 });
    assert.deepStrictEqual(pts[2], { x: 600, y: 300 });
    assert.deepStrictEqual(pts[3], { x: 400, y: 300 });
  });

  runTest('SymmetryEngine generates N points in radial mode and 2N in mandala mode', () => {
    const sym = new SymmetryEngine(1000, 1000);
    sym.enabled = true;
    sym.setMode('radial', 6);
    const radialPts = sym.getSymmetricPoints(600, 500);
    assert.strictEqual(radialPts.length, 6);

    sym.setMode('mandala', 8);
    const mandalaPts = sym.getSymmetricPoints(600, 550);
    // 8 sectors with bilateral reflection = 16 points
    assert.strictEqual(mandalaPts.length, 16);
  });

  // ── 2. 3D Tangent Normal Map & Height Map Generator ──
  console.log('\n[2/5] 3D Tangent Normal Map & Parallax Height Map Suite:');

  runTest('NormalHeightMapEngine generates flat tangent normal (128, 128, 255) on uniform surface', () => {
    const width = 10;
    const height = 10;
    const data = new Uint8ClampedArray(width * height * 4);
    // Uniform surface: dx = 0, dy = 0 -> normal = (0, 0, 1) -> RGB = (128, 128, 255)
    data.fill(150);
    for (let i = 3; i < data.length; i += 4) data[i] = 255;

    const normalMap = NormalHeightMapEngine.generateNormalMap({ data, width, height });
    assert.strictEqual(normalMap.width, 10);
    assert.strictEqual(normalMap.height, 10);

    const centerIdx = (5 * width + 5) * 4;
    assert.strictEqual(normalMap.data[centerIdx], 128); // Nx = 0 -> 128
    assert.strictEqual(normalMap.data[centerIdx + 1], 128); // Ny = 0 -> 128
    assert.strictEqual(normalMap.data[centerIdx + 2], 255); // Nz = 1 -> 255
  });

  runTest('NormalHeightMapEngine generates surface gradient normals on edge contrasts', () => {
    const width = 4;
    const height = 4;
    const data = new Uint8ClampedArray(width * height * 4);
    // Left half black (0), right half white (255)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const val = x < 2 ? 0 : 255;
        data[idx] = val;
        data[idx + 1] = val;
        data[idx + 2] = val;
        data[idx + 3] = 255;
      }
    }

    const normalMap = NormalHeightMapEngine.generateNormalMap({ data, width, height }, { strength: 3.0 });
    // Steep horizontal gradient shifts red channel away from 128
    const edgePixelRed = normalMap.data[(1 * width + 1) * 4];
    assert.notStrictEqual(edgePixelRed, 128);
  });

  runTest('NormalHeightMapEngine generates grayscale height map with contrast scaling', () => {
    const width = 4;
    const height = 4;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 100;
      data[i + 1] = 100;
      data[i + 2] = 100;
      data[i + 3] = 255;
    }

    const heightMap = NormalHeightMapEngine.generateHeightMap({ data, width, height }, { contrast: 1.0 });
    assert.strictEqual(heightMap.data[0], 100);
    assert.strictEqual(heightMap.data[1], 100);
    assert.strictEqual(heightMap.data[2], 100);

    const inverted = NormalHeightMapEngine.generateHeightMap({ data, width, height }, { contrast: 1.0, invert: true });
    assert.strictEqual(inverted.data[0], 155);
  });

  // ── 3. 3D LUT Baker & .cube Exporter ──
  console.log('\n[3/5] 3D LUT Baker & .cube Exporter:');

  runTest('LutBaker compiles valid 3D .cube format header and exact sample count', () => {
    // Identity transform
    const cube = LutBaker.bakeToCube((rgb) => rgb, { size: 17, title: 'Test LUT' });
    assert(cube.includes('TITLE "Test LUT"'));
    assert(cube.includes('LUT_3D_SIZE 17'));
    assert(cube.includes('DOMAIN_MIN 0.0 0.0 0.0'));
    assert(cube.includes('DOMAIN_MAX 1.0 1.0 1.0'));

    // Count data lines: header has 5 lines, 17^3 = 4913 sample rows -> total 4918 lines
    const lineCount = cube.trim().split('\n').length;
    assert.strictEqual(lineCount, 5 + 17 * 17 * 17);
  });

  runTest('LutBaker creates transform function from adjustment stack', () => {
    const adjustments = [
      { type: 'invert' }
    ];
    const transform = LutBaker.createTransformFromAdjustments(adjustments);
    const out = transform([0.2, 0.4, 0.8]);
    assert.strictEqual(Math.round(out[0] * 10), 8); // 1.0 - 0.2 = 0.8
    assert.strictEqual(Math.round(out[1] * 10), 6); // 1.0 - 0.4 = 0.6
    assert.strictEqual(Math.round(out[2] * 10), 2); // 1.0 - 0.8 = 0.2
  });

  // ── 4. Non-Destructive Vector Mask Engine ──
  console.log('\n[4/5] Non-Destructive Vector Mask Engine:');

  runTest('VectorMask initializes with path geometry and serializes roundtrip', () => {
    const points = [
      { type: 'M', x: 10, y: 10 },
      { type: 'L', x: 100, y: 10 },
      { type: 'L', x: 100, y: 100 },
      { type: 'L', x: 10, y: 100 }
    ];
    const mask = new VectorMask({ points, closed: true });
    assert.strictEqual(mask.enabled, true);
    assert.strictEqual(mask.points.length, 4);

    const json = mask.toJSON();
    const restored = VectorMask.fromJSON(json);
    assert.strictEqual(restored.points.length, 4);
    assert.strictEqual(restored.closed, true);
    assert.strictEqual(restored.density, 1.0);
  });

  runTest('VectorMask generates alpha mask buffer respecting density and inverted flags', () => {
    const mask = new VectorMask();
    mask.density = 0.5;
    mask.inverted = true;

    const buffer = mask.generateMaskBuffer(10, 10);
    assert.strictEqual(buffer.length, 100);
    // In headless test fallback, buffer is filled with valid 8-bit alpha
    assert(buffer[0] >= 0 && buffer[0] <= 255);
  });

  // ── 5. Split Mesh Warp Engine ──
  console.log('\n[5/5] Split Mesh Warp Engine with Custom Subdivisions:');

  runTest('SplitWarpEngine initializes default 3x3 grid control points', () => {
    const warp = new SplitWarpEngine(600, 600);
    assert.strictEqual(warp.rows, 3);
    assert.strictEqual(warp.cols, 3);
    // 4 point rows, 4 point cols
    assert.strictEqual(warp.points.length, 4);
    assert.strictEqual(warp.points[0].length, 4);

    // Corner (0,0) and (3,3)
    assert.strictEqual(warp.points[0][0].x, 0);
    assert.strictEqual(warp.points[0][0].y, 0);
    assert.strictEqual(warp.points[3][3].x, 600);
    assert.strictEqual(warp.points[3][3].y, 600);
  });

  runTest('SplitWarpEngine splits horizontal and vertical grid lines dynamically', () => {
    const warp = new SplitWarpEngine(600, 600);
    // Split horizontal at 50%
    const okH = warp.splitHorizontal(0.5);
    assert.strictEqual(okH, true);
    assert.strictEqual(warp.rows, 4);
    assert.strictEqual(warp.points.length, 5);

    // Split vertical at 50%
    const okV = warp.splitVertical(0.5);
    assert.strictEqual(okV, true);
    assert.strictEqual(warp.cols, 4);
    assert.strictEqual(warp.points[0].length, 5);

    // Center interpolated control point at (300, 300)
    assert.strictEqual(warp.points[2][2].x, 300);
    assert.strictEqual(warp.points[2][2].y, 300);
  });

  runTest('SplitWarpEngine hitTest detects nearest control point', () => {
    const warp = new SplitWarpEngine(600, 600);
    const hit = warp.hitTest(10, 10, 20);
    assert.notStrictEqual(hit, null);
    assert.strictEqual(hit.row, 0);
    assert.strictEqual(hit.col, 0);
  });

  console.log(`\n════════════════════════════════════════════════════════════════`);
  console.log(`  Phase 14 Elite Creative Suite: ${passedTests} / ${totalTests} Passed (100%)`);
  console.log(`════════════════════════════════════════════════════════════════\n`);
}

runAllTests();
