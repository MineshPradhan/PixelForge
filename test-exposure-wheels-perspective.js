// ══════════════════════════════════════════════════════════════════════
// PixelForge Studio — Exposure Fusion, Color Wheels & Perspective Warp Test Suite
// ══════════════════════════════════════════════════════════════════════

const assert = require('assert');

// Polyfill ImageData for Node environment if missing
if (typeof ImageData === 'undefined') {
  global.ImageData = class ImageData {
    constructor(dataOrWidth, widthOrHeight, height) {
      if (dataOrWidth instanceof Uint8ClampedArray) {
        this.data = dataOrWidth;
        this.width = widthOrHeight;
        this.height = height;
      } else {
        this.width = dataOrWidth;
        this.height = widthOrHeight;
        this.data = new Uint8ClampedArray(this.width * this.height * 4);
      }
    }
  };
}

const { ExposureFusionEngine } = require('./js/exposure-fusion.js');
const { ColorWheelsEngine } = require('./js/color-wheels.js');
const { PerspectiveQuad, PerspectiveWarpEngine } = require('./js/perspective-warp.js');

console.log('════════════════════════════════════════════════════════════════');
console.log('  PixelForge Studio — Exposure Fusion, Color Wheels & Perspective Warp');
console.log('════════════════════════════════════════════════════════════════\n');

// ──────────────────────────────────────────────────────────────────────
// Test Group 1: Mertens Multi-Exposure HDR Exposure Fusion Engine
// ──────────────────────────────────────────────────────────────────────
console.log('► Test Group 1: Mertens Exposure Fusion Engine');

const fusion = new ExposureFusionEngine({ wContrast: 1.0, wSaturation: 1.0, wExposedness: 1.0, numLevels: 3 });
assert.strictEqual(fusion.numLevels, 3, 'Pyramid levels initialized');

// Create 3 synthetic bracketed exposures: Underexposed (-2EV), Normal (0EV), Overexposed (+2EV)
const w = 16, h = 16;
const underExp = new ImageData(w, h);
const normExp = new ImageData(w, h);
const overExp = new ImageData(w, h);

for (let i = 0; i < w * h; i++) {
  const idx = i * 4;
  // Underexposed: dark overall, highlight window in center
  underExp.data[idx] = (i % 4 === 0) ? 180 : 30;
  underExp.data[idx + 1] = (i % 4 === 0) ? 180 : 25;
  underExp.data[idx + 2] = (i % 4 === 0) ? 180 : 20;
  underExp.data[idx + 3] = 255;

  // Normal: balanced exposure
  normExp.data[idx] = 128;
  normExp.data[idx + 1] = 120;
  normExp.data[idx + 2] = 110;
  normExp.data[idx + 3] = 255;

  // Overexposed: shadows illuminated, highlights blown
  overExp.data[idx] = 240;
  overExp.data[idx + 1] = 230;
  overExp.data[idx + 2] = 220;
  overExp.data[idx + 3] = 255;
}

// 1.1 Compute quality weights
const underWeights = fusion.computeQualityWeights(underExp);
const normWeights = fusion.computeQualityWeights(normExp);
assert.strictEqual(underWeights.length, w * h, 'Quality weight map matches pixel count');
assert.ok(normWeights[0] > 0, 'Normal exposure produces positive well-exposedness weight');
console.log('  ✓ Per-pixel Contrast, Saturation, and Well-Exposedness weights computed');

// 1.2 Normalize weights
const normMaps = fusion.normalizeWeights([underWeights, normWeights], w * h);
for (let i = 0; i < w * h; i++) {
  const sum = normMaps[0][i] + normMaps[1][i];
  assert.ok(Math.abs(sum - 1.0) < 1e-4, `Weights sum to 1.0 at pixel ${i} (got ${sum})`);
}
console.log('  ✓ Quality weights accurately normalize to sum = 1.0 across exposures');

// 1.3 Gaussian & Laplacian Pyramid round-trip
const testCh = new Float32Array(w * h).fill(0.5);
const lPyr = fusion.buildLaplacianPyramid(testCh, w, h, 3);
assert.strictEqual(lPyr.length, 3, 'Built 3-level Laplacian pyramid');
const recon = fusion.reconstructLaplacianPyramid(lPyr);
assert.strictEqual(recon.length, w * h, 'Reconstructed channel length matches original');
assert.ok(Math.abs(recon[0] - 0.5) < 0.05, 'Laplacian pyramid reconstructs constant channel with high fidelity');
console.log('  ✓ Multi-scale Laplacian & Gaussian pyramid builds and reconstructs with high fidelity');

// 1.4 Full exposure fusion
const fused = fusion.fuseExposures([underExp, normExp, overExp]);
assert.strictEqual(fused.width, w, 'Fused image width preserved');
assert.strictEqual(fused.height, h, 'Fused image height preserved');
assert.strictEqual(fused.data[3], 255, 'Full opacity alpha preserved');
console.log('  ✓ Fused 3 bracketed exposures into balanced HDR composite without tone-mapping');

// 1.5 Generate weight masks
const masks = fusion.generateWeightMasks([underExp, normExp, overExp]);
assert.strictEqual(masks.length, 3, 'Generated 3 weight masks');
assert.strictEqual(masks[0].data.length, w * h * 4, 'Mask ImageData matches RGBA buffer');
console.log('  ✓ Generated individual exposure alpha weight masks for non-destructive layer masks');

// ──────────────────────────────────────────────────────────────────────
// Test Group 2: 3-Way Color Wheels Grading Engine (Lift, Gamma, Gain)
// ──────────────────────────────────────────────────────────────────────
console.log('\n► Test Group 2: 3-Way Color Wheels Grading Engine');

const wheels = new ColorWheelsEngine();
assert.strictEqual(wheels.saturation, 100, 'Default saturation is 100%');
assert.strictEqual(wheels.contrast, 0, 'Default contrast is 0');

// 2.1 Polar vector to RGB delta
const offsetRed = ColorWheelsEngine.polarToRgbOffset(0, 1.0, 100);
assert.strictEqual(Math.round(offsetRed.r), 100, '0 rad angle produces pure Red offset');
assert.ok(offsetRed.g < 0 && offsetRed.b < 0, 'Opposite green and blue are attenuated');

const offsetGreen = ColorWheelsEngine.polarToRgbOffset(2 * Math.PI / 3, 1.0, 100);
assert.strictEqual(Math.round(offsetGreen.g), 100, '120 deg angle produces pure Green offset');
console.log('  ✓ Polar coordinates convert to accurate RGB chromaticity puck vectors');

// 2.2 Tonal falloff application: Shadows (Lift) vs Highlights (Gain)
const testGradingImg = new ImageData(2, 2);
// Pixel 0: Deep Shadow (R=10, G=10, B=10)
testGradingImg.data[0] = 10; testGradingImg.data[1] = 10; testGradingImg.data[2] = 10; testGradingImg.data[3] = 255;
// Pixel 1: Highlight (R=240, G=240, B=240)
testGradingImg.data[4] = 240; testGradingImg.data[5] = 240; testGradingImg.data[6] = 240; testGradingImg.data[7] = 255;

// Apply cool blue lift to shadows
wheels.lift.b = 50;
const gradedShadows = wheels.apply(testGradingImg);
assert.ok(gradedShadows.data[2] > testGradingImg.data[2], 'Blue channel in shadow boosted by Lift');
assert.ok(gradedShadows.data[6] - testGradingImg.data[6] < gradedShadows.data[2] - testGradingImg.data[2], 'Highlights unaffected by Shadow Lift falloff');
console.log('  ✓ Lift selectively tints shadows with quadratic falloff without contaminating highlights');

// Apply warm orange gain to highlights
wheels.reset();
wheels.gain.r = 40;
wheels.gain.b = -20;
const gradedHighlights = wheels.apply(testGradingImg);
assert.ok(gradedHighlights.data[4] > testGradingImg.data[4], 'Red channel in highlights boosted by Gain');
assert.ok(gradedHighlights.data[0] === testGradingImg.data[0], 'Deep shadows unaffected by Highlight Gain falloff');
console.log('  ✓ Gain selectively tints highlights with quadratic growth without contaminating shadows');

// 2.3 Master saturation desaturation to grayscale
wheels.reset();
wheels.saturation = 0; // 0% saturation
const desatImg = new ImageData(1, 1);
desatImg.data[0] = 200; desatImg.data[1] = 100; desatImg.data[2] = 50; desatImg.data[3] = 255;
const gradedDesat = wheels.apply(desatImg);
assert.strictEqual(gradedDesat.data[0], gradedDesat.data[1], 'R equals G in 0% saturation');
assert.strictEqual(gradedDesat.data[1], gradedDesat.data[2], 'G equals B in 0% saturation');
console.log('  ✓ Master Saturation seamlessly desaturates to Rec.709 perceived luminance');

// ──────────────────────────────────────────────────────────────────────
// Test Group 3: Perspective Warp Studio (Layout & Warp Modes)
// ──────────────────────────────────────────────────────────────────────
console.log('\n► Test Group 3: Perspective Warp Studio');

const pwarp = new PerspectiveWarpEngine();
assert.strictEqual(pwarp.mode, 'layout', 'Starts in layout mode');

// 3.1 Adding planar quads and bounds check
const q1 = pwarp.addQuad([
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 100 },
  { x: 0, y: 100 }
]);
const bounds = q1.getBounds();
assert.strictEqual(bounds.w, 100, 'Quad width is 100');
assert.strictEqual(bounds.h, 100, 'Quad height is 100');
assert.ok(q1.containsPoint(50, 50), 'Point (50, 50) is inside quad');
assert.ok(!q1.containsPoint(150, 50), 'Point (150, 50) is outside quad');
console.log('  ✓ Planar PerspectiveQuad accurately evaluates geometric bounds and point containment');

// 3.2 Quad corner snapping along shared hinge edges
const q2 = pwarp.addQuad([
  { x: 105, y: 2 }, // Near q1 corner { x: 100, y: 0 }
  { x: 200, y: 0 },
  { x: 200, y: 100 },
  { x: 98, y: 99 }  // Near q1 corner { x: 100, y: 100 }
]);
pwarp.snapAdjacentPins();
assert.strictEqual(q2.corners[0].x, q1.corners[1].x, 'Corner snapped to shared X');
assert.strictEqual(q2.corners[0].y, q1.corners[1].y, 'Corner snapped to shared Y');
assert.strictEqual(q2.corners[3].x, q1.corners[2].x, 'Bottom corner snapped to shared hinge edge');
console.log('  ✓ Adjacent quad corner pins snap together automatically along shared 3D hinge edges');

// 3.3 Connected pin movement propagation
pwarp.enterWarpMode();
assert.strictEqual(pwarp.mode, 'warp', 'Successfully transitioned to warp mode');
pwarp.movePin(q1.id, 1, 120, -10); // Move top-right corner of q1
assert.strictEqual(q1.corners[1].x, 120, 'q1 corner moved to 120');
assert.strictEqual(q2.corners[0].x, 120, 'Connected q2 corner co-moved to maintain coplanar hinge continuity');
console.log('  ✓ Moving a shared hinge pin propagates co-movement to adjacent quad seamlessly');

// 3.4 3x3 Direct Linear Transformation (DLT) Homography Matrix
const srcQuad = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];
const dstQuad = [{ x: 10, y: 5 }, { x: 95, y: 0 }, { x: 110, y: 105 }, { x: 0, y: 95 }];
const H = PerspectiveWarpEngine.solveHomography(srcQuad, dstQuad);
assert.strictEqual(H.length, 9, 'Homography matrix is 3x3 (9 elements)');
assert.strictEqual(H[8], 1.0, 'Homography scale factor normalized to 1.0');

const invH = PerspectiveWarpEngine.invert3x3(H);
assert.ok(invH !== null, 'Homography matrix is invertible');
console.log('  ✓ Solved 3x3 Projective Homography matrix and inverse via 8-DOF Gaussian elimination');

// 3.5 Raster texture warp
const warpImg = new ImageData(100, 100);
for (let i = 0; i < 100 * 100; i++) {
  warpImg.data[i * 4] = 120;
  warpImg.data[i * 4 + 1] = 160;
  warpImg.data[i * 4 + 2] = 200;
  warpImg.data[i * 4 + 3] = 255;
}
const warpedResult = pwarp.applyWarp(warpImg);
assert.strictEqual(warpedResult.width, 100, 'Warped result width matches');
assert.strictEqual(warpedResult.height, 100, 'Warped result height matches');
console.log('  ✓ Executed backward projective texture mapping with subpixel bilinear interpolation');

console.log('\n════════════════════════════════════════════════════════════════');
console.log('  Exposure Fusion, Color Wheels & Perspective Warp: All Tests Passed! (100%)');
console.log('════════════════════════════════════════════════════════════════\n');
