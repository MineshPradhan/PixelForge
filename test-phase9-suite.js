/**
 * Test Suite: Phase 9 Complete Parity Suite
 * Tests:
 * 1. Precision Guides, Grid & Magnetic Smart Snapping Engine (js/guides-snap.js)
 * 2. Perspective Transform & Freeform Bézier Mesh Warp (js/warp-engine.js)
 * 3. 3D LUT & Cinematic Color Lookup Engine (js/color-lut.js)
 * 4. Actions & Macro Automation Engine (js/actions-engine.js)
 * 5. Seamless Pattern Maker & Offset Filter (js/pattern-engine.js)
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

global.HTMLCanvasElement = class HTMLCanvasElement {};

const { Guide, GuideManager, SnappingEngine } = require('./js/guides-snap.js');
const { PerspectiveTransform, BézierWarpGrid, MeshWarpEngine } = require('./js/warp-engine.js');
const { LutEngine } = require('./js/color-lut.js');
const { ActionStep, Action, ActionSet, ActionsEngine } = require('./js/actions-engine.js');
const { PatternItem, PatternManager, OffsetFilter } = require('./js/pattern-engine.js');
const { SmartFilter } = require('./js/smart-objects.js');

global.LutEngine = LutEngine;
global.OffsetFilter = OffsetFilter;

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
    process.exitCode = 1;
  }
}

async function asyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    process.exitCode = 1;
  }
}

console.log('Testing Phase 9: Photoshop Complete Parity Suite...\n');

(async () => {
  // ── 1. Guides, Grid & Snapping Engine ──
  console.log('[1/5] Precision Guides & Magnetic Smart Snapping:');

  test('GuideManager: Creates, locks, and retrieves horizontal and vertical guides', () => {
    const gm = new GuideManager({ width: 1920, height: 1080 });
    const gH = gm.addGuide('horizontal', 250);
    const gV = gm.addGuide('vertical', 480);

    assert.strictEqual(gm.guides.length, 2);
    assert.strictEqual(gH.orientation, 'horizontal');
    assert.strictEqual(gH.position, 250);
    assert.strictEqual(gV.orientation, 'vertical');
    assert.strictEqual(gV.position, 480);

    // Lock guides
    gm.toggleLock();
    assert.strictEqual(gm.locked, true);

    // Serialization
    const json = gm.toJSON();
    assert.strictEqual(json.guides.length, 2);
    assert.strictEqual(json.locked, true);

    // Clear guides (force)
    gm.clearGuides(true);
    assert.strictEqual(gm.guides.length, 0);

    // Restore from JSON
    gm.loadJSON(json);
    assert.strictEqual(gm.guides.length, 2);
  });

  test('SnappingEngine: Snaps coordinates to guides within threshold', () => {
    const gm = new GuideManager({ width: 1000, height: 1000 });
    gm.addGuide('horizontal', 200);
    gm.addGuide('vertical', 300);

    const se = new SnappingEngine({ width: 1000, height: 1000 }, gm);
    se.snapTolerance = 8;

    // Near horizontal guide (y = 204 -> should snap to 200)
    const snapH = se.snapPoint(100, 204);
    assert.strictEqual(snapH.snappedY, true);
    assert.strictEqual(snapH.y, 200);
    assert.strictEqual(snapH.snappedX, false);

    // Near vertical guide (x = 296 -> should snap to 300)
    const snapV = se.snapPoint(296, 500);
    assert.strictEqual(snapV.snappedX, true);
    assert.strictEqual(snapV.x, 300);
    assert.strictEqual(snapV.snappedY, false);
  });

  test('SnappingEngine: Snaps bounding box to canvas bounds and canvas center', () => {
    const gm = new GuideManager({ width: 1000, height: 1000 });
    const se = new SnappingEngine({ width: 1000, height: 1000 }, gm);
    se.snapTolerance = 8;

    // Moving near canvas center (Center X = 500, Center Y = 500)
    // Box width=100, height=100 => Center would be at (x + 50, y + 50)
    // If x = 453, center is 503 -> snap tolerance should align box center to 500 => x = 450
    const bounds = { x: 453, y: 448, width: 100, height: 100 };
    const snapped = se.snapBounds(bounds);

    assert.strictEqual(snapped.snappedX, true);
    assert.strictEqual(snapped.snappedY, true);
    assert.strictEqual(snapped.x, 450);
    assert.strictEqual(snapped.y, 450);
    assert.ok(se.activeSmartGuides.length >= 2, 'Should emit smart guide alignment lines');
  });

  // ── 2. Perspective Transform & Mesh Warp ──
  console.log('\n[2/5] Perspective Transform & Bézier Mesh Warp:');

  test('PerspectiveTransform: Computes 8-DOF homography and projects 4 corners', () => {
    const srcQuad = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 }
    ];
    // Slightly trapezoidal perspective destination
    const dstQuad = [
      { x: 10, y: 10 },
      { x: 90, y: 10 },
      { x: 110, y: 90 },
      { x: -10, y: 90 }
    ];

    const H = PerspectiveTransform.computeHomography(srcQuad, dstQuad);
    assert.ok(H && H.length === 9, 'Homography matrix must be 3x3 array of 9 elements');

    // Project top-left corner (0,0) -> should map exactly to dstQuad[0] (10, 10)
    const pt0 = PerspectiveTransform.projectPoint(H, 0, 0);
    assert.strictEqual(Math.round(pt0.x), 10);
    assert.strictEqual(Math.round(pt0.y), 10);

    // Inverse matrix projection maps destination back to source
    const Hinv = PerspectiveTransform.invertMatrix3x3(H);
    const srcBack = PerspectiveTransform.projectPoint(Hinv, 10, 10);
    assert.strictEqual(Math.round(srcBack.x), 0);
    assert.strictEqual(Math.round(srcBack.y), 0);
  });

  test('MeshWarpEngine: Generates 3x3 Bézier grid and applies preset deformations', () => {
    const grid = new BézierWarpGrid(100, 100, 3, 3);
    assert.strictEqual(grid.rows, 3);
    assert.strictEqual(grid.cols, 3);
    assert.strictEqual(grid.points.length, 16); // (3+1) * (3+1) = 16 grid control points

    // Apply Arch preset
    grid.applyPreset('arch', 0.5);
    // Center top points should be shifted upward (lower Y)
    const centerTop = grid.getPoint(0, 1);
    assert.ok(centerTop.y < 0, 'Arch preset must displace upper grid curve upward');

    // Test point warping interpolation inside a patch
    const warped = grid.warpPoint(50, 50);
    assert.ok(typeof warped.x === 'number' && typeof warped.y === 'number');
  });

  // ── 3. 3D LUT & Cinematic Color Lookup ──
  console.log('\n[3/5] 3D LUT & Cinematic Color Lookup:');

  test('LutEngine: Parses Adobe .cube file with metadata, domain, and 3D data', () => {
    const sampleCube = `
# Title Comment
TITLE "Test Cinema Teal"
DOMAIN_MIN 0.0 0.0 0.0
DOMAIN_MAX 1.0 1.0 1.0
LUT_3D_SIZE 2

0.0 0.0 0.0
1.0 0.0 0.0
0.0 1.0 0.0
1.0 1.0 0.0
0.0 0.0 1.0
1.0 0.0 1.0
0.0 1.0 1.0
1.0 1.0 1.0
`;
    const parsed = LutEngine.parseCube(sampleCube);
    assert.strictEqual(parsed.title, 'Test Cinema Teal');
    assert.strictEqual(parsed.size, 2);
    assert.strictEqual(parsed.type, '3D');
    assert.strictEqual(parsed.data.length, 2 * 2 * 2 * 3); // 24 floats
  });

  test('LutEngine: Generates built-in Hollywood film presets and exports .cube format', () => {
    const tealOrange = LutEngine.generatePresetLut('Teal & Orange', 8);
    assert.strictEqual(tealOrange.size, 8);
    assert.strictEqual(tealOrange.data.length, 8 * 8 * 8 * 3);

    // Export to .cube string
    const exportedStr = LutEngine.exportCube(tealOrange);
    assert.ok(exportedStr.includes('TITLE "Teal & Orange"'));
    assert.ok(exportedStr.includes('LUT_3D_SIZE 8'));

    // Re-parse exported string
    const reparsed = LutEngine.parseCube(exportedStr);
    assert.strictEqual(reparsed.size, 8);
  });

  test('LutEngine: Trilinear interpolation grades pixel colors with intensity blending', () => {
    const w = 4, h = 4;
    const imgData = new ImageData(w, h);
    // Fill with mid gray (128, 128, 128)
    for (let i = 0; i < imgData.data.length; i += 4) {
      imgData.data[i] = 128;
      imgData.data[i + 1] = 128;
      imgData.data[i + 2] = 128;
      imgData.data[i + 3] = 255;
    }

    const lut = LutEngine.generatePresetLut('Teal & Orange', 16);
    // Apply at 100%
    LutEngine.applyLut(imgData, lut, 1.0);
    // In Teal & Orange, midtones shift towards orange highlights / teal shadows
    const r = imgData.data[0];
    const b = imgData.data[2];
    assert.ok(r !== 128 || b !== 128, 'LUT must transform RGB values via trilinear lookup');
  });

  // ── 4. Actions & Macro Automation Engine ──
  console.log('\n[4/5] Actions & Macro Automation Engine:');

  test('ActionsEngine: ActionStep and Action serialization to and from JSON', () => {
    const act = new Action('Pop Color Macro');
    act.addStep('filter:brightnessContrast', { brightness: 15, contrast: 25 }, { name: 'Boost Contrast' });
    act.addStep('filter:unsharpMask', { amount: 80, radius: 1.5 }, { name: 'Sharpen Edges' });

    assert.strictEqual(act.steps.length, 2);
    const json = act.toJSON();
    assert.strictEqual(json.name, 'Pop Color Macro');
    assert.strictEqual(json.steps.length, 2);

    const restored = Action.fromJSON(json);
    assert.strictEqual(restored.name, 'Pop Color Macro');
    assert.strictEqual(restored.steps[0].command, 'filter:brightnessContrast');
    assert.strictEqual(restored.steps[0].params.brightness, 15);
  });

  await asyncTest('ActionsEngine: Records and executes sequential macro playback', async () => {
    const engine = new ActionsEngine();
    let contrastExecuted = false;
    let lutExecuted = false;

    engine.registerHandler('filter:brightnessContrast', (params) => {
      contrastExecuted = true;
      assert.strictEqual(params.brightness, 10);
    });
    engine.registerHandler('lut:apply', (params) => {
      lutExecuted = true;
      assert.strictEqual(params.preset, 'Portra 400');
    });

    const action = new Action('Test Execution');
    action.addStep('filter:brightnessContrast', { brightness: 10 });
    action.addStep('lut:apply', { preset: 'Portra 400' });

    const result = await engine.playAction(action);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.executedSteps, 2);
    assert.strictEqual(contrastExecuted, true);
    assert.strictEqual(lutExecuted, true);
  });

  // ── 5. Seamless Pattern Maker & Offset Filter ──
  console.log('\n[5/5] Seamless Pattern Maker & Offset Filter:');

  test('OffsetFilter: Toroidal wrap-around shifts pixels with periodic boundary conditions', () => {
    const w = 4, h = 4;
    const imgData = new ImageData(w, h);
    // Put a bright pixel at (0, 0)
    imgData.data[0] = 255;
    imgData.data[1] = 255;
    imgData.data[2] = 255;
    imgData.data[3] = 255;

    // Shift horizontally by +2 and vertically by +2
    const shifted = OffsetFilter.apply(imgData, 2, 2, 'wrapAround');

    // The pixel originally at (0,0) should now be at (2,2)
    const targetIdx = (2 * w + 2) * 4;
    assert.strictEqual(shifted.data[targetIdx], 255);
    assert.strictEqual(shifted.data[targetIdx + 1], 255);
    assert.strictEqual(shifted.data[targetIdx + 2], 255);
    assert.strictEqual(shifted.data[targetIdx + 3], 255);

    // Old location (0,0) should now be 0
    assert.strictEqual(shifted.data[0], 0);
  });

  test('OffsetFilter: Calculates seamless seam continuity score', () => {
    const w = 8, h = 8;
    const uniform = new ImageData(w, h);
    // Fill with solid color -> 100% seamless
    for (let i = 0; i < uniform.data.length; i += 4) {
      uniform.data[i] = 100;
      uniform.data[i + 1] = 150;
      uniform.data[i + 2] = 200;
      uniform.data[i + 3] = 255;
    }
    const scoreSolid = OffsetFilter.calculateSeamlessScore(uniform);
    assert.strictEqual(scoreSolid, 100);

    // Create high discontinuity on edges
    const broken = new ImageData(w, h);
    for (let y = 0; y < h; y++) {
      // Left edge black, right edge white
      broken.data[(y * w + 0) * 4] = 0;
      broken.data[(y * w + 0) * 4 + 3] = 255;
      broken.data[(y * w + (w - 1)) * 4] = 255;
      broken.data[(y * w + (w - 1)) * 4 + 3] = 255;
    }
    const scoreBroken = OffsetFilter.calculateSeamlessScore(broken);
    assert.ok(scoreBroken < 100, 'Edge discontinuity must lower seamless score');
  });

  test('PatternManager: Manages pattern library items and stores presets', () => {
    const pm = new PatternManager();
    const item = pm.addPattern('Custom Brick Tile', 64, 64, null);
    assert.strictEqual(pm.patterns.length, 1);
    assert.strictEqual(item.name, 'Custom Brick Tile');
    assert.strictEqual(pm.getPattern('Custom Brick Tile'), item);

    // Serialization
    const json = item.toJSON();
    assert.strictEqual(json.width, 64);
    assert.strictEqual(json.height, 64);
  });

  test('SmartFilter: Seamlessly integrates colorLookup and offset filters', () => {
    const sfLut = new SmartFilter('colorLookup', { preset: 'Teal & Orange', intensity: 0.8 });
    assert.strictEqual(SmartFilter.getFilterTitle('colorLookup'), 'Color Lookup (3D LUT)');

    const sfOffset = new SmartFilter('offset', { horizontal: 50, vertical: 50, undefinedMode: 'wrapAround' });
    assert.strictEqual(SmartFilter.getFilterTitle('offset'), 'Offset Filter');

    const testImg = new ImageData(4, 4);
    for (let i = 0; i < testImg.data.length; i += 4) {
      testImg.data[i] = 120;
      testImg.data[i + 1] = 120;
      testImg.data[i + 2] = 120;
      testImg.data[i + 3] = 255;
    }

    const lutResult = sfLut.apply(testImg);
    assert.ok(lutResult && lutResult.data.length === 64);

    const offsetResult = sfOffset.apply(testImg);
    assert.ok(offsetResult && offsetResult.data.length === 64);
  });

  console.log(`\nPhase 9 Test Results: ${passedTests} / ${totalTests} tests passed (${Math.round((passedTests / totalTests) * 100)}%).`);
  if (passedTests === totalTests) {
    console.log('🎉 ALL PHASE 9 PARITY TESTS PASSED!');
  } else {
    process.exit(1);
  }
})();
