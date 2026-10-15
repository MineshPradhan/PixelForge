/**
 * PixelForge Studio - Phase 15 Ultimate Frontiers Test Suite
 * Tests:
 * 1. Quick Mask Mode Engine (rubylith selection sculpting, soft feathering, inversion)
 * 2. Clone Source Transformation Palette (5 presets, angle rotation, scale, flip, coordinate mapping)
 * 3. Optical Lens Correction & Defringing Engine (barrel/pincushion, red/cyan & blue/yellow defringe, vignetting)
 * 4. 3D Lighting Effects Engine (Point, Spot, Directional, Blinn-Phong specular, bump mapping)
 * 5. Auto-Blend Focus Stacking Engine (Laplacian edge sharpness, multi-layer depth fusion)
 */

const assert = require('assert');

// Load Phase 15 modules
const { QuickMaskEngine } = require('./js/quick-mask.js');
const { CloneSourceManager } = require('./js/clone-source.js');
const { LensCorrectionEngine } = require('./js/lens-correction.js');
const { LightingEffectsEngine } = require('./js/lighting-effects.js');
const { FocusStackingEngine } = require('./js/focus-stacking.js');

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

// Minimal ImageData mock for Node environment
if (typeof ImageData === 'undefined') {
  global.ImageData = class ImageData {
    constructor(w, h) {
      this.width = w;
      this.height = h;
      this.data = new Uint8ClampedArray(w * h * 4);
    }
  };
}

async function runAllTests() {
  console.log('Testing Phase 15: Ultimate Photographic & 3D Optics Frontiers...\n');

  // ── 1. Quick Mask Mode Engine ──
  console.log('[1/5] Quick Mask Mode & Rubylith Selection Sculpting:');

  runTest('QuickMaskEngine enters and clears selection area in mask buffer', () => {
    const qm = new QuickMaskEngine();
    const sel = { active: true, type: 'rect', x: 20, y: 20, w: 40, h: 40 };
    qm.enter(sel, 100, 100);

    assert.strictEqual(qm.active, true);
    assert.strictEqual(qm.width, 100);
    assert.strictEqual(qm.height, 100);

    // Selected region (30, 30) should be 0 (unmasked)
    assert.strictEqual(qm.mockBuffer[30 * 100 + 30], 0);
    // Outside region (5, 5) should be 255 (masked)
    assert.strictEqual(qm.mockBuffer[5 * 100 + 5], 255);
  });

  runTest('QuickMaskEngine paints soft dab and inverts mask', () => {
    const qm = new QuickMaskEngine();
    qm.enter({ active: false }, 50, 50);

    // Entire buffer is 255
    assert.strictEqual(qm.mockBuffer[25 * 50 + 25], 255);

    // Paint a reveal spot (value 0) at center
    qm.paint(25, 25, 10, 100, 0, 1.0);
    assert.strictEqual(qm.mockBuffer[25 * 50 + 25], 0);

    // Invert mask
    qm.invert();
    assert.strictEqual(qm.mockBuffer[25 * 50 + 25], 255);
    assert.strictEqual(qm.mockBuffer[0], 0);

    // Exit and commit to selection
    const res = qm.exit();
    assert.strictEqual(qm.active, false);
    assert.strictEqual(res.active, true);
  });

  // ── 2. Clone Source Transformation Palette ──
  console.log('\n[2/5] Clone Source Transformation Palette & Manager:');

  runTest('CloneSourceManager maintains 5 presets and active selection', () => {
    const csm = new CloneSourceManager();
    assert.strictEqual(csm.activePresetId, 1);
    csm.selectPreset(3);
    assert.strictEqual(csm.activePresetId, 3);
    csm.setSource(150, 200, 'layer-abc');
    assert.strictEqual(csm.getActivePreset().source.x, 150);
  });

  runTest('CloneSourceManager rotates and scales sample coordinates accurately', () => {
    const csm = new CloneSourceManager();
    csm.selectPreset(1);
    csm.setSource(100, 100);
    csm.setAngle(90);      // 90 degrees clockwise
    csm.setScale(200);     // 200% scale

    // Sampling at anchor (dx=0, dy=0) should yield source point exactly
    const p1 = csm.getTransformedSamplePoint(50, 50, 50, 50);
    assert.strictEqual(Math.round(p1.x), 100);
    assert.strictEqual(Math.round(p1.y), 100);

    // Sampling with offset along X (+20px) under 90 deg rotation and 2x scale
    const p2 = csm.getTransformedSamplePoint(70, 50, 50, 50);
    // relX = 20, relY = 0 -> rotX = 0, rotY = -20 -> scaled / 2 = rotY -10 -> y=90
    assert.strictEqual(Math.round(p2.x), 100);
    assert.strictEqual(Math.round(p2.y), 90);
  });

  runTest('CloneSourceManager toggles horizontal and vertical flips', () => {
    const csm = new CloneSourceManager();
    assert.strictEqual(csm.toggleFlipH(), true);
    assert.strictEqual(csm.getActivePreset().flipH, true);
    assert.strictEqual(csm.toggleFlipV(), true);
    assert.strictEqual(csm.getActivePreset().flipV, true);
  });

  // ── 3. Optical Lens Correction & Defringing Engine ──
  console.log('\n[3/5] Optical Lens Correction & Defringing Suite:');

  runTest('LensCorrectionEngine applies barrel and pincushion geometric distortion', () => {
    const engine = new LensCorrectionEngine();
    const img = new ImageData(40, 40);
    // Fill with a test circle
    for (let y = 0; y < 40; y++) {
      for (let x = 0; x < 40; x++) {
        const idx = (y * 40 + x) * 4;
        const d = Math.hypot(x - 20, y - 20);
        img.data[idx] = d < 10 ? 255 : 0;
        img.data[idx + 1] = 128;
        img.data[idx + 2] = 50;
        img.data[idx + 3] = 255;
      }
    }

    const corrected = engine.apply(img, { distortion: -30, autoScale: true });
    assert.strictEqual(corrected.width, 40);
    assert.strictEqual(corrected.height, 40);
    assert.strictEqual(corrected.data.length, 40 * 40 * 4);
    // Center pixel should remain preserved
    const centerIdx = (20 * 40 + 20) * 4;
    assert.strictEqual(corrected.data[centerIdx], 255);
  });

  runTest('LensCorrectionEngine applies lateral chromatic defringe and vignetting', () => {
    const engine = new LensCorrectionEngine();
    const img = new ImageData(30, 30);
    img.data.fill(100); // Gray

    const res = engine.apply(img, {
      redCyanDefringe: 25,
      blueYellowDefringe: -25,
      vignetteAmount: 50,
      vignetteMidpoint: 40
    });

    // Corner pixel should have vignette brightness boost (> 100)
    const cornerIdx = 0;
    assert.ok(res.data[cornerIdx] > 100, 'Corner should be brightened by vignette compensation');
  });

  // ── 4. 3D Lighting Effects Engine ──
  console.log('\n[4/5] 3D Lighting Effects & Material Shading Engine:');

  runTest('LightingEffectsEngine adds and configures Point, Spot, Directional lights', () => {
    const engine = new LightingEffectsEngine();
    assert.ok(engine.lights.length >= 2);
    const spot = engine.addLight('spot', { x: 0.2, y: 0.2, coneAngle: 30 });
    assert.strictEqual(spot.type, 'spot');
    assert.strictEqual(spot.coneAngle, 30);
    const removed = engine.removeLight(engine.lights.length - 1);
    assert.strictEqual(removed.id, spot.id);
  });

  runTest('LightingEffectsEngine renders Blinn-Phong specular and bump diffuse lighting', () => {
    const engine = new LightingEffectsEngine();
    const img = new ImageData(30, 30);
    // Create base image with horizontal edge
    for (let y = 0; y < 30; y++) {
      for (let x = 0; x < 30; x++) {
        const idx = (y * 30 + x) * 4;
        const v = y < 15 ? 50 : 200;
        img.data[idx] = v;
        img.data[idx + 1] = v;
        img.data[idx + 2] = v;
        img.data[idx + 3] = 255;
      }
    }

    const lit = engine.render(img, {
      material: { ambient: 0.2, diffuse: 0.8, specular: 0.5, glossiness: 16, bumpHeight: 3.0 }
    });

    assert.strictEqual(lit.width, 30);
    assert.strictEqual(lit.height, 30);
    assert.strictEqual(lit.data[3], 255); // Alpha preserved
    assert.ok(lit.data[0] > 0, 'Pixel should receive illumination');
  });

  // ── 5. Auto-Blend Focus Stacking Engine ──
  console.log('\n[5/5] Auto-Blend Focus Stacking & Depth-of-Field Engine:');

  runTest('FocusStackingEngine calculates Laplacian sharpness maps correctly', () => {
    const engine = new FocusStackingEngine();
    const img = new ImageData(20, 20);
    // Draw high contrast edge at x=10
    for (let y = 0; y < 20; y++) {
      for (let x = 0; x < 20; x++) {
        const idx = (y * 20 + x) * 4;
        img.data[idx] = x < 10 ? 0 : 255;
        img.data[idx + 1] = x < 10 ? 0 : 255;
        img.data[idx + 2] = x < 10 ? 0 : 255;
        img.data[idx + 3] = 255;
      }
    }

    const sharpness = engine.computeSharpnessMap(img);
    assert.strictEqual(sharpness.length, 400);
    // Near the edge (x=9 or x=10), sharpness energy should be significantly higher than flat areas (x=2)
    assert.ok(sharpness[10 * 20 + 9] > sharpness[10 * 20 + 2]);
  });

  runTest('FocusStackingEngine blends multiple focus slices into sharp composite', () => {
    const engine = new FocusStackingEngine();
    // Slice 1: sharp on left half, blurry on right
    const slice1 = new ImageData(20, 20);
    // Slice 2: blurry on left half, sharp on right
    const slice2 = new ImageData(20, 20);

    for (let y = 0; y < 20; y++) {
      for (let x = 0; x < 20; x++) {
        const idx = (y * 20 + x) * 4;
        // Slice 1 has high frequency checkerboard on left
        slice1.data[idx] = (x < 10 && (x + y) % 2 === 0) ? 255 : 128;
        slice1.data[idx + 1] = slice1.data[idx];
        slice1.data[idx + 2] = slice1.data[idx];
        slice1.data[idx + 3] = 255;

        // Slice 2 has high frequency checkerboard on right
        slice2.data[idx] = (x >= 10 && (x + y) % 2 === 0) ? 255 : 128;
        slice2.data[idx + 1] = slice2.data[idx];
        slice2.data[idx + 2] = slice2.data[idx];
        slice2.data[idx + 3] = 255;
      }
    }

    const res = engine.stack([slice1, slice2], { generateMasks: true });
    assert.ok(res.composite);
    assert.strictEqual(res.composite.width, 20);
    assert.strictEqual(res.composite.height, 20);
    assert.strictEqual(res.layerMasks.length, 2);
    // Left side mask should favor slice 1; right side mask should favor slice 2
    assert.ok(res.layerMasks[0][10 * 20 + 5] > res.layerMasks[1][10 * 20 + 5]);
  });

  console.log(`\n════════════════════════════════════════════════════════════════`);
  console.log(`  Phase 15 Ultimate Suite: ${passedTests} / ${totalTests} Passed (${Math.round(passedTests/totalTests*100)}%)`);
  console.log(`════════════════════════════════════════════════════════════════\n`);

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runAllTests();
