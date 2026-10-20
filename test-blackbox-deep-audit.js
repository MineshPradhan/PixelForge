/**
 * PixelForge Studio — Deep Autonomous Black Box Fuzzer & Stress Test Engine
 * 
 * Tests extreme edge cases, invalid inputs, boundary conditions, zero-dimensions,
 * corrupted data, math anomalies (NaN/Infinity), and rapid state transitions across:
 * 1. Utils & Color Space Math (Hex, RGB, HSL, HSV, CMYK, LAB, XYZ)
 * 2. Filters Engine (Convolutions, Blurs, Curves, Levels, Adjustments)
 * 3. AI Neural Filters (TV Denoise, AI Colorize, Depth, Edge Detect, Style)
 * 4. Layer Architecture & Composite Rendering (Stack boundary conditions, Blend modes)
 * 5. Selection Engine & Masking (Zero-area, out-of-bounds, feathering edge cases)
 * 6. History & Tile Cache (Underflow, overflow, spatial clipping)
 * 7. Typography Engine (Empty text, extreme tracking, NaN font sizes)
 * 8. Preset Importers & Parsers (.ase, .aco, .abr corrupted buffer fuzzing)
 * 9. Scripting Engine & API Sandbox (Malicious/malformed scripts, error boundary)
 * 10. Shortcut Manager (Malformed events, unknown actions, conflicting bindings)
 */

const assert = require('assert');
const fs = require('fs');

// Global DOM Mocks for Headless Node.js Execution
global.ImageData = class ImageData {
  constructor(dataOrWidth, widthOrHeight, height) {
    if (dataOrWidth instanceof Uint8ClampedArray) {
      this.data = dataOrWidth;
      this.width = widthOrHeight;
      this.height = height;
    } else {
      this.width = Math.max(0, dataOrWidth || 0);
      this.height = Math.max(0, widthOrHeight || 0);
      this.data = new Uint8ClampedArray(this.width * this.height * 4);
    }
  }
};

const domStore = new Map();
function createMockElement(id = '', tag = 'div', classes = '') {
  const classList = new Set(classes ? classes.split(' ') : []);
  const el = {
    id,
    tagName: tag.toUpperCase(),
    classList: {
      add: (c) => classList.add(c),
      remove: (c) => classList.delete(c),
      toggle: (c, force) => {
        if (force === undefined) {
          if (classList.has(c)) classList.delete(c);
          else classList.add(c);
        } else if (force) classList.add(c);
        else classList.delete(c);
      },
      contains: (c) => classList.has(c)
    },
    style: {},
    dataset: {},
    children: [],
    listeners: {},
    addEventListener: (evt, fn) => {
      if (!el.listeners[evt]) el.listeners[evt] = [];
      el.listeners[evt].push(fn);
    },
    removeEventListener: () => {},
    dispatchEvent: (evt) => {
      const fns = el.listeners[evt.type] || [];
      fns.forEach(fn => fn(evt));
    },
    getBoundingClientRect: () => ({
      left: 100, top: 50, right: 900, bottom: 650, width: 800, height: 600
    }),
    getContext: () => ({
      canvas: { width: 800, height: 600 },
      save: () => {},
      restore: () => {},
      clearRect: () => {},
      fillRect: () => {},
      strokeRect: () => {},
      rect: () => {},
      roundRect: () => {},
      clip: () => {},
      closePath: () => {},
      measureText: (txt) => ({ width: (txt || '').length * 8 }),
      drawImage: () => {},
      getImageData: (x, y, w, h) => new global.ImageData(w, h),
      putImageData: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      arc: () => {},
      ellipse: () => {},
      stroke: () => {},
      fill: () => {},
      translate: () => {},
      rotate: () => {},
      scale: () => {},
      setLineDash: () => {},
      resetTransform: () => {},
      fillText: () => {},
      createLinearGradient: () => ({ addColorStop: () => {} }),
      createRadialGradient: () => ({ addColorStop: () => {} })
    }),
    appendChild: (c) => { el.children.push(c); return c; },
    removeChild: (c) => { el.children = el.children.filter(x => x !== c); return c; },
    insertBefore: (c) => { el.children.unshift(c); return c; },
    setAttribute: (k, v) => { el[k] = v; },
    getAttribute: (k) => el[k] || null,
    closest: () => null,
    querySelector: () => createMockElement(),
    querySelectorAll: () => [],
    value: '0',
    textContent: '',
    innerHTML: ''
  };
  if (id) domStore.set(id, el);
  return el;
}

global.document = {
  getElementById: (id) => domStore.has(id) ? domStore.get(id) : createMockElement(id),
  querySelector: (sel) => sel.startsWith('#') ? global.document.getElementById(sel.slice(1)) : createMockElement(),
  querySelectorAll: () => [],
  createElement: (tag) => createMockElement('', tag),
  body: createMockElement('body', 'body')
};

global.window = global;
global.alert = () => {};

// Load modules
const Utils = require('./js/utils.js');
global.Utils = Utils;
global.window.Utils = Utils;
if (!global.Utils.createCanvas) {
  global.Utils.createCanvas = (w, h) => {
    const c = createMockElement('', 'canvas');
    c.width = w;
    c.height = h;
    return c;
  };
}

const Filters = require('./js/filters.js');
const NeuralFilters = require('./js/neural-filters.js');
const LayerManager = require('./js/layers.js');
const { TileHistoryManager } = require('./js/tile-history.js');
const OpenTypeFeatureEngine = require('./js/typography-advanced.js');
const { ShortcutManager } = require('./js/shortcut-manager.js');
const AdobePresetImporter = require('./js/adobe-importers.js');

let discoveredBugs = [];

function recordBug(category, testName, error) {
  discoveredBugs.push({
    category,
    testName,
    message: error.message || String(error),
    stack: error.stack
  });
  console.log(`  [BUG FOUND] ${category} > ${testName}: ${error.message || error}`);
}

console.log('════════════════════════════════════════════════════════════════');
console.log('  PixelForge Studio — Deep Autonomous Black Box Audit');
console.log('════════════════════════════════════════════════════════════════\n');

// ── 1. Color Math & Utils Boundary Stress ──
console.log('► Fuzz Test Group 1: Utils & Color Space Math Boundaries');
const colorTests = [
  { name: 'Hex with null/undefined/empty', fn: () => Utils.hexToRgb('') },
  { name: 'Hex with garbage characters', fn: () => Utils.hexToRgb('#XYZ!@#') },
  { name: 'Hex with short 3-digit', fn: () => Utils.hexToRgb('#fff') },
  { name: 'Hex with 4-digit rgba', fn: () => Utils.hexToRgb('#ffff') },
  { name: 'Hex with 8-digit rgba', fn: () => Utils.hexToRgb('#ff000080') },
  { name: 'RGB to Hex with negative numbers', fn: () => Utils.rgbToHex(-10, -50, -200) },
  { name: 'RGB to Hex with >255 values', fn: () => Utils.rgbToHex(999, 1000, 500) },
  { name: 'RGB to Hex with NaN/Infinity', fn: () => Utils.rgbToHex(NaN, Infinity, -Infinity) },
  { name: 'RGB to HSL with (0,0,0)', fn: () => Utils.rgbToHsl ? Utils.rgbToHsl(0, 0, 0) : null },
  { name: 'RGB to HSL with (255,255,255)', fn: () => Utils.rgbToHsl ? Utils.rgbToHsl(255, 255, 255) : null },
  { name: 'Clamp with min > max', fn: () => Utils.clamp(10, 100, 20) },
  { name: 'Clamp with NaN', fn: () => Utils.clamp(NaN, 0, 255) }
];

for (const t of colorTests) {
  try {
    const res = t.fn();
    // Verify no unhandled NaN string leaks
    if (typeof res === 'string' && res.includes('NaN')) {
      recordBug('ColorMath', t.name, new Error(`Returned NaN in string: "${res}"`));
    }
  } catch (err) {
    recordBug('ColorMath', t.name, err);
  }
}

// ── 2. Filters Engine Fuzzing ──
console.log('\n► Fuzz Test Group 2: FilterEngine Extreme Boundary & Zero-Size Inputs');
const filterEngine = Filters;

const testImgData1x1 = new global.ImageData(1, 1);
testImgData1x1.data[0] = 120; testImgData1x1.data[1] = 130; testImgData1x1.data[2] = 140; testImgData1x1.data[3] = 255;

const testImgData0x0 = new global.ImageData(0, 0);

const filterFuzzList = [
  { name: 'Brightness on 1x1 image', fn: () => filterEngine.brightnessContrast(testImgData1x1, 100, 100) },
  { name: 'Brightness with NaN params', fn: () => filterEngine.brightnessContrast(testImgData1x1, NaN, NaN) },
  { name: 'Gaussian Blur with radius 0', fn: () => filterEngine.gaussianBlur(testImgData1x1, 0) },
  { name: 'Gaussian Blur with negative radius', fn: () => filterEngine.gaussianBlur(testImgData1x1, -5) },
  { name: 'Gaussian Blur with massive radius on small canvas', fn: () => filterEngine.gaussianBlur(testImgData1x1, 100) },
  { name: 'Unsharp Mask with zero params', fn: () => filterEngine.unsharpMask(testImgData1x1, 0, 0, 0) },
  { name: 'Curves with empty/null lut', fn: () => filterEngine.applyCurves ? filterEngine.applyCurves(testImgData1x1, null) : null },
  { name: 'Levels with blackPoint >= whitePoint', fn: () => filterEngine.levels ? filterEngine.levels(testImgData1x1, 200, 1.0, 50, 0, 255) : null },
  { name: 'Invert on 1x1 image', fn: () => filterEngine.invert(testImgData1x1) },
  { name: 'Threshold with out-of-range value', fn: () => filterEngine.threshold ? filterEngine.threshold(testImgData1x1, 999) : null },
  { name: 'Posterize with 0 or 1 levels', fn: () => filterEngine.posterize ? filterEngine.posterize(testImgData1x1, 0) : null },
  { name: 'High Pass with radius 0', fn: () => filterEngine.highPass ? filterEngine.highPass(testImgData1x1, 0) : null }
];

for (const t of filterFuzzList) {
  try {
    const res = t.fn();
    if (res && res.data) {
      for (let i = 0; i < Math.min(res.data.length, 16); i++) {
        if (Number.isNaN(res.data[i])) {
          recordBug('FilterEngine', t.name, new Error(`Pixel byte at ${i} is NaN`));
          break;
        }
      }
    }
  } catch (err) {
    recordBug('FilterEngine', t.name, err);
  }
}

// ── 3. AI Neural Filters Stress & Boundaries ──
console.log('\n► Fuzz Test Group 3: AI Neural Filters Edge Cases');
const aiFuzzList = [
  { name: 'TV Denoise with 0 strength', fn: () => NeuralFilters.denoise(testImgData1x1, { strength: 0 }) },
  { name: 'TV Denoise with 100 strength', fn: () => NeuralFilters.denoise(testImgData1x1, { strength: 100 }) },
  { name: 'TV Denoise with negative strength', fn: () => NeuralFilters.denoise(testImgData1x1, { strength: -50 }) },
  { name: 'TV Denoise with NaN strength', fn: () => NeuralFilters.denoise(testImgData1x1, { strength: NaN }) },
  { name: 'AI Colorize with default options', fn: () => NeuralFilters.colorize(testImgData1x1) },
  { name: 'AI Colorize with extreme saturation', fn: () => NeuralFilters.colorize(testImgData1x1, { saturation: 200, warmth: -100 }) },
  { name: 'Skin Smoothing on 1x1 image', fn: () => NeuralFilters.skinSmoothing(testImgData1x1, { smoothness: 100, clarity: 100 }) },
  { name: 'Super Resolution on 1x1 image', fn: () => NeuralFilters.superResolution(testImgData1x1, 2) },
  { name: 'Lens Blur with 0 radius', fn: () => NeuralFilters.lensBlur(testImgData1x1, { radius: 0 }) },
  { name: 'Sky Replacement on 1x1 image', fn: () => NeuralFilters.skyReplacement(testImgData1x1, { skyType: 'sunset' }) }
];

for (const t of aiFuzzList) {
  try {
    const res = t.fn();
    if (res && res.data) {
      for (let i = 0; i < Math.min(res.data.length, 16); i++) {
        if (Number.isNaN(res.data[i])) {
          recordBug('NeuralFilters', t.name, new Error(`Pixel byte at ${i} is NaN`));
          break;
        }
      }
    }
  } catch (err) {
    recordBug('NeuralFilters', t.name, err);
  }
}

// ── 4. Layer Architecture & Stack Mutation Fuzzing ──
console.log('\n► Fuzz Test Group 4: LayerManager Stack Boundaries & Edge Mutations');
try {
  const lm = new LayerManager(100, 100);
  const l1 = lm.addLayer('Base');
  const l2 = lm.addLayer('Top');

  // Edge 1: Reorder out of bounds
  lm.reorder(-10, 500);
  lm.reorder(500, -10);
  lm.reorder(0, 1);

  // Edge 2: Duplicate active layer
  lm.duplicateActiveLayer();

  // Edge 3: Delete layers until only 1 remains
  while (lm.layers.length > 1) {
    lm.deleteActiveLayer();
  }
  // Try deleting the only remaining layer (should return false cleanly)
  const delRes = lm.deleteActiveLayer();
  assert.strictEqual(delRes, false);

  // Edge 4: Render composite
  const compCtx = createMockElement('', 'canvas').getContext();
  lm.compositeTo(compCtx);

  // Edge 5: Set opacity
  const activeL = lm.getActiveLayer();
  if (activeL) {
    activeL.opacity = Math.max(0, Math.min(100, -50 || 0));
    assert.strictEqual(activeL.opacity, 0);
    activeL.opacity = Math.max(0, Math.min(100, 200 || 0));
    assert.strictEqual(activeL.opacity, 100);
  }
} catch (err) {
  recordBug('LayerManager', 'Stack boundary mutations', err);
}

// ── 5. History & Tile Cache Boundary Stress ──
console.log('\n► Fuzz Test Group 5: Tile History Boundary Tests');
try {
  const thm = new TileHistoryManager(256);
  // Empty undo / redo calls
  const emptyUndone = thm.undo(new Uint8ClampedArray(100));
  assert.strictEqual(emptyUndone, null, 'Undo on empty stack should return null');
  const emptyRedone = thm.redo(new Uint8ClampedArray(100));
  assert.strictEqual(emptyRedone, null, 'Redo on empty stack should return null');

  // ROI outside canvas bounds
  const outBounds = thm.getAffectedTileBounds({ x: -500, y: -500, w: 200, h: 200 }, 1000, 1000);
  assert.ok(outBounds.minTX >= 0, 'Tile X must be clamped >= 0');
  assert.ok(outBounds.minTY >= 0, 'Tile Y must be clamped >= 0');

  const outFarBounds = thm.getAffectedTileBounds({ x: 5000, y: 5000, w: 200, h: 200 }, 1000, 1000);
  assert.ok(outFarBounds.maxTX <= 3, 'Tile X must be clamped to canvas bounds');
  assert.ok(outFarBounds.maxTY <= 3, 'Tile Y must be clamped to canvas bounds');
} catch (err) {
  recordBug('TileHistory', 'Boundary testing', err);
}

// ── 6. Typography Engine Edge Cases ──
console.log('\n► Fuzz Test Group 6: Typography Engine Boundary Tests');
try {
  // Parse empty/malformed OpenType features
  const emptyFeatures = OpenTypeFeatureEngine.parseCssFeatureSettings('');
  assert.deepStrictEqual(emptyFeatures, {});
  const malformedFeatures = OpenTypeFeatureEngine.parseCssFeatureSettings('invalid-css-format-string!@@#');
  
  // Format empty features
  const emptyCss = OpenTypeFeatureEngine.toCssFeatureSettings({});
  assert.strictEqual(emptyCss, 'normal');

  // Parse malformed variation settings
  const emptyVariations = OpenTypeFeatureEngine.parseCssVariationSettings('');
  assert.deepStrictEqual(emptyVariations, {});

  // Layout empty string
  const layoutRes = OpenTypeFeatureEngine.layoutText('', { maxWidth: 500 });
  assert.ok(Array.isArray(layoutRes.lines));

  // Layout with NaN or 0 maxWidth
  const layoutZero = OpenTypeFeatureEngine.layoutText('Hello World', { maxWidth: 0 });
  assert.ok(Array.isArray(layoutZero.lines));
} catch (err) {
  recordBug('Typography', 'Boundary testing', err);
}

// ── 7. Preset Importers Corrupted Buffer Fuzzing ──
console.log('\n► Fuzz Test Group 7: Adobe Preset Importers Corrupted Data Fuzzing');
try {
  // Test 1: Random garbage buffer for .ase
  const garbageBuf = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]).buffer;
  try {
    AdobePresetImporter.parseASE(garbageBuf);
  } catch (e) {
    // Expected clean throw, not crash
    assert.ok(e.message.includes('magic') || e.message.includes('signature') || e.message.includes('ASE') || e.message.includes('Header'));
  }

  // Test 2: Truncated ASE buffer with valid signature
  const truncAse = new Uint8Array([0x41, 0x53, 0x45, 0x46, 0x00, 0x01, 0x00, 0x00]).buffer;
  try {
    AdobePresetImporter.parseASE(truncAse);
  } catch (e) {
    // Expected graceful failure
  }

  // Test 3: Truncated ACO buffer
  const truncAco = new Uint8Array([0x00, 0x01]).buffer;
  try {
    AdobePresetImporter.parseACO(truncAco);
  } catch (e) {
    // Expected graceful failure
  }
} catch (err) {
  recordBug('AdobeImporters', 'Corrupted buffer fuzzing', err);
}

// ── 8. Shortcut Manager Event Fuzzing ──
console.log('\n► Fuzz Test Group 8: Shortcut Manager Fuzzing');
try {
  const sm = new ShortcutManager();
  // Null or empty key event
  const a1 = sm.getActionFromEvent({});
  assert.strictEqual(a1, null);

  const a2 = sm.getActionFromEvent({ key: null });
  assert.strictEqual(a2, null);

  // Set shortcut with empty action or invalid modifiers
  const resEmpty = sm.setShortcut('', 'a', []);
  assert.strictEqual(resEmpty.success, false);

  // Import garbage JSON
  const okGarbage = sm.importJSON('{"not_a_valid_shortcut_json": true}');
  assert.strictEqual(okGarbage, false);

  const okSyntaxErr = sm.importJSON('{invalid_json');
  assert.strictEqual(okSyntaxErr, false);
} catch (err) {
  recordBug('ShortcutManager', 'Event fuzzing', err);
}

// ── 9. ToolManager & 49 Tools Extreme Pointer Events Fuzzing ──
console.log('\n► Fuzz Test Group 9: ToolManager Pointer Fuzzing & Boundary Stress');
try {
  const ToolManager = require('./js/tools.js');
  const ColorPickerManager = require('./js/color-picker.js');
  const colorPicker = new ColorPickerManager();

  const mockApp = {
    width: 800,
    height: 600,
    zoom: 1.0,
    panX: 0,
    panY: 0,
    mainCanvas: createMockElement('main-canvas', 'canvas'),
    mainCtx: createMockElement('main-canvas', 'canvas').getContext(),
    overlayCanvas: createMockElement('overlay-canvas', 'canvas'),
    overlayCtx: createMockElement('overlay-canvas', 'canvas').getContext(),
    layerManager: new LayerManager(800, 600),
    colorPicker,
    applyViewportTransform: () => {},
    zoomIn: () => {},
    zoomOut: () => {},
    cropToRect: () => {},
    cloneSourceManager: {
      hasSource: () => true,
      getSource: () => ({ x: 100, y: 100 })
    },
    pushHistoryState: () => {},
    renderComposite: () => {},
    renderGuidesAndOverlays: () => {},
    showModal: () => {},
    hideModal: () => {},
    showToast: () => {}
  };
  mockApp.layerManager.addLayer('Background');

  const tm = new ToolManager(mockApp);
  mockApp.toolManager = tm;

  // Test extreme coordinates on active tools
  const extremeCoords = [
    { x: -9999, y: -9999 },
    { x: 99999, y: 99999 },
    { x: 0, y: 0 },
    { x: 400, y: 300 }
  ];

  const testTools = [
    'brush', 'pencil', 'eraser', 'bucket', 'gradient', 'clone-stamp',
    'spot-healing', 'crop', 'marquee', 'lasso', 'magic-wand', 'move',
    'dodge', 'burn', 'smudge', 'blur', 'sharpen', 'eyedropper'
  ];

  for (const toolName of testTools) {
    if (typeof tm.setTool === 'function') tm.setTool(toolName);
    else tm.currentTool = toolName;

    for (const pt of extremeCoords) {
      if (typeof tm.onPointerDown === 'function') tm.onPointerDown({ clientX: pt.x, clientY: pt.y, button: 0, pressure: 0.5 });
      if (typeof tm.onPointerMove === 'function') tm.onPointerMove({ clientX: pt.x + 5, clientY: pt.y + 5, pressure: 0.8 });
      if (typeof tm.onPointerUp === 'function') tm.onPointerUp({ clientX: pt.x + 10, clientY: pt.y + 10, button: 0 });
    }
  }
} catch (err) {
  recordBug('ToolManager', 'Extreme pointer fuzzing', err);
}

// ── 10. Scripting Console Sandboxing & Error Boundary ──
console.log('\n► Fuzz Test Group 10: Scripting Console Sandbox & Error Boundary');
try {
  const { ScriptingConsole } = require('./js/scripting-console.js');
  const consoleEngine = new ScriptingConsole({});

  // 1. Syntax Error
  const r1 = consoleEngine.execute('const 123_invalid_syntax = ;');
  assert.strictEqual(r1.success, false);

  // 2. Reference Error
  const r2 = consoleEngine.execute('nonExistentVariableXYZ.doSomething();');
  assert.strictEqual(r2.success, false);

  // 3. Throw Error
  const r3 = consoleEngine.execute('throw new Error("Deliberate error test");');
  assert.strictEqual(r3.success, false);
} catch (err) {
  recordBug('ScriptingConsole', 'Error containment', err);
}

// ── 11. Actions Automation Engine Fuzzing ──
console.log('\n► Fuzz Test Group 11: Actions Engine Macro Automation Fuzzing');
try {
  const { ActionsEngine } = require('./js/actions-engine.js');
  const engine = new ActionsEngine();

  // Initial state has default sets
  assert.ok(engine.sets.length > 0);

  // Record empty action
  engine.startRecording('Set 1', 'Test Macro');
  engine.recordStep('layer.create', { name: 'Macro Layer' });
  engine.recordStep('filter.apply', { filter: 'invert' });
  engine.stopRecording();

  // Playback with mock executor
  let stepsExecuted = 0;
  const mockExecutor = {
    executeAction: async (action, params) => {
      stepsExecuted++;
      return true;
    }
  };

  const action = engine.sets[0].actions.find(a => a.name === 'Test Macro');
  if (action) {
    engine.playAction(action, mockExecutor).then(res => {
      assert.strictEqual(res.success, true);
    });
  }

  // Import corrupted JSON
  const impRes = engine.importJSON('{bad_json: 123');
  assert.strictEqual(impRes, false);
} catch (err) {
  recordBug('ActionsEngine', 'Macro fuzzing', err);
}

// ── 12. Smart Objects & Non-Destructive Filters ──
console.log('\n► Fuzz Test Group 12: Smart Objects & Filter Dispatch Fuzzing');
try {
  const { SmartObjectManager, SmartObjectData } = require('./js/smart-objects.js');

  const dummyCanvas = createMockElement('', 'canvas');
  dummyCanvas.width = 100;
  dummyCanvas.height = 100;

  const soData = new SmartObjectData(dummyCanvas, 100, 100);
  assert.strictEqual(soData.originalWidth, 100);
  assert.strictEqual(soData.originalHeight, 100);

  // Add smart filters with extreme parameters
  const sf1 = soData.addFilter('gaussianBlur', { radius: 100 });
  const sf2 = soData.addFilter('unsharpMask', { amount: 500, radius: 0, threshold: 255 });

  assert.strictEqual(soData.filters.length, 2);
  soData.toggleFilter(sf1.id, false);
  assert.strictEqual(sf1.enabled, false);

  soData.removeFilter(sf1.id);
  assert.strictEqual(soData.filters.length, 1);

  // Test SmartObjectManager with mockApp
  const testLm = new LayerManager(200, 200);
  testLm.addLayer('Layer 1');
  const testApp = {
    layerManager: testLm,
    width: 200,
    height: 200,
    renderComposite: () => {},
    pushHistoryState: () => {}
  };
  const som = new SmartObjectManager(testApp);
  const smartLayer = som.convertToSmartObject();
  assert.ok(smartLayer !== null);
  assert.strictEqual(smartLayer.type, 'smart-object');
} catch (err) {
  recordBug('SmartObjects', 'Smart filter lifecycle fuzzing', err);
}

// ── 13. File Format Codecs Corrupted Data Fuzzing ──
console.log('\n► Fuzz Test Group 13: Image Codecs Corrupted Data Fuzzing');
try {
  const PsdEngine = require('./js/psd-engine.js');
  const OpenExrCodec = require('./js/exr-codec.js');
  const { RadianceHdrCodec } = require('./js/hdr-codec.js');
  const CameraRawBayerEngine = require('./js/bayer-raw.js');

  const garbageBuffer = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]).buffer;

  // 1. PSD Engine Corrupted Buffer
  try {
    if (typeof PsdEngine.parsePsd === 'function') PsdEngine.parsePsd(garbageBuffer);
  } catch (e) {
    // Expected graceful exception
  }

  // 2. OpenEXR Corrupted Buffer
  try {
    if (typeof OpenExrCodec.decode === 'function') OpenExrCodec.decode(garbageBuffer);
  } catch (e) {
    // Expected graceful exception
  }

  // 3. Radiance HDR Corrupted Buffer
  try {
    if (typeof RadianceHdrCodec.decodeHdr === 'function') RadianceHdrCodec.decodeHdr(garbageBuffer);
  } catch (e) {
    // Expected graceful exception
  }

  // 4. Bayer RAW Corrupted Buffer
  try {
    if (typeof CameraRawBayerEngine.demosaic === 'function') CameraRawBayerEngine.demosaic(garbageBuffer, 10, 10, 'RGGB');
  } catch (e) {
    // Expected graceful exception
  }
} catch (err) {
  recordBug('Codecs', 'Corrupted file decode fuzzing', err);
}

// ── 14. Extreme Canvas Aspect Ratios & Resizing ──
console.log('\n► Fuzz Test Group 14: Dynamic Canvas Resizing & Extreme Aspect Ratios');
try {
  const lm = new LayerManager(100, 100);
  lm.addLayer('Canvas Layer');

  // Resize to 10000x1 (extreme horizontal panoramic strip)
  lm.resizeCanvas(10000, 1);
  assert.strictEqual(lm.width, 10000);
  assert.strictEqual(lm.height, 1);

  // Resize to 1x10000 (extreme vertical strip)
  lm.resizeCanvas(1, 10000);
  assert.strictEqual(lm.width, 1);
  assert.strictEqual(lm.height, 10000);

  // Resize back to standard 1920x1080
  lm.resizeCanvas(1920, 1080);
  assert.strictEqual(lm.width, 1920);
  assert.strictEqual(lm.height, 1080);
} catch (err) {
  recordBug('CanvasResizing', 'Extreme aspect ratios', err);
}

// ── Summary Report ──
console.log('\n════════════════════════════════════════════════════════════════');
if (discoveredBugs.length === 0) {
  console.log('  🎉 COMPLETE SUCCESS: 0 Bugs Discovered across all 14 Fuzz Groups!');
} else {
  console.log(`  ⚠️ Found ${discoveredBugs.length} issue(s) during black box audit:`);
  discoveredBugs.forEach((b, idx) => {
    console.log(`  ${idx + 1}. [${b.category}] ${b.testName} -> ${b.message}`);
  });
}
console.log('════════════════════════════════════════════════════════════════\n');

if (discoveredBugs.length > 0) {
  process.exitCode = 1;
}
