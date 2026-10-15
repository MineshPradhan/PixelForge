// test-milestone1.js - Comprehensive Verification Suite for Milestone 1
// Tests: Layer Groups, Hierarchy, Collapsing, Multi-selection, Adjustment Layers, Deletion, Undo/Redo

// 1. Mock DOM and Canvas environment for Node.js
class MockContext2D {
  constructor(canvas) {
    this.canvas = canvas;
    this.fillStyle = '#000000';
    this.globalAlpha = 1.0;
    this.globalCompositeOperation = 'source-over';
    this.shadowColor = 'transparent';
    this.shadowBlur = 0;
    this.shadowOffsetX = 0;
    this.shadowOffsetY = 0;
    this._stack = [];
  }
  save() {
    this._stack.push({
      fillStyle: this.fillStyle,
      globalAlpha: this.globalAlpha,
      globalCompositeOperation: this.globalCompositeOperation
    });
  }
  restore() {
    const s = this._stack.pop();
    if (s) {
      this.fillStyle = s.fillStyle;
      this.globalAlpha = s.globalAlpha;
      this.globalCompositeOperation = s.globalCompositeOperation;
    }
  }
  fillRect(x, y, w, h) {}
  clearRect(x, y, w, h) {}
  drawImage(src, ...args) {}
  getImageData(x, y, w, h) {
    return {
      width: w,
      height: h,
      data: new Uint8ClampedArray(w * h * 4)
    };
  }
  putImageData(imgData, x, y) {}
}

class MockCanvas {
  constructor(w = 100, h = 100) {
    this.width = w;
    this.height = h;
    this._ctx = new MockContext2D(this);
  }
  getContext(type) {
    return this._ctx;
  }
  toDataURL() {
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  }
}

class MockImage {
  constructor() {
    this._src = '';
    this.onload = null;
  }
  set src(val) {
    this._src = val;
    if (this.onload) {
      setTimeout(() => this.onload(), 1);
    }
  }
  get src() { return this._src; }
}

class MockElement {
  constructor(id = '', tag = 'div') {
    this.id = id;
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.classList = {
      _classes: new Set(),
      add: (c) => this.classList._classes.add(c),
      remove: (c) => this.classList._classes.delete(c),
      contains: (c) => this.classList._classes.has(c),
      toggle: (c) => {
        if (this.classList._classes.has(c)) this.classList._classes.delete(c);
        else this.classList._classes.add(c);
      }
    };
    this.style = {};
    this.value = '';
    this.textContent = '';
    this.innerHTML = '';
    this.checked = false;
    this.disabled = false;
    this.dataset = {};
  }
  addEventListener() {}
  appendChild(child) { this.children.push(child); }
  removeChild(child) {
    const idx = this.children.indexOf(child);
    if (idx !== -1) this.children.splice(idx, 1);
  }
  querySelectorAll(sel) { return []; }
  querySelector(sel) { return null; }
  closest(sel) { return null; }
}

const mockElements = new Map();
function getOrCreateMockElement(id) {
  if (!mockElements.has(id)) {
    mockElements.set(id, new MockElement(id));
  }
  return mockElements.get(id);
}

class MockImageData {
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
}
global.ImageData = MockImageData;
global.Image = MockImage;

global.document = {
  getElementById: (id) => getOrCreateMockElement(id),
  createElement: (tag) => {
    if (tag === 'canvas') return new MockCanvas();
    return new MockElement('', tag);
  },
  querySelectorAll: () => [],
  querySelector: () => null
};

global.window = {
  innerWidth: 1920,
  innerHeight: 1080
};

// Load PixelForge modules
const Utils = require('./js/utils.js');
global.Utils = Utils;
// Override Utils.createCanvas to use our MockCanvas
Utils.createCanvas = (w, h) => new MockCanvas(w, h);

const Filters = require('./js/filters.js');
global.Filters = Filters;

const HistoryManager = require('./js/history.js');
const LayerManager = require('./js/layers.js');

let passedTests = 0;
let failedTests = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: ${testName}`);
    failedTests++;
  }
}

async function runSuite() {
  console.log('=== RUNNING MILESTONE 1 VERIFICATION SUITE ===\n');

  // ── Test 1: LayerManager Initialization & Basic Layer Creation ──
  console.log('[Suite 1: Initialization & Layers]');
  const lm = new LayerManager(200, 200);
  const l1 = lm.addLayer('Base Raster');
  assert(lm.layers.length === 1, 'Initial layer added');
  assert(l1.type === 'raster', 'Layer type is raster');
  assert(l1.parentId === null, 'Layer has no parentId initially');
  assert(lm.selectedLayerIds.has(l1.id), 'Newly added layer is automatically selected');

  // ── Test 2: Layer Group Creation & Parenting ──
  console.log('\n[Suite 2: Layer Groups & Hierarchy]');
  const l2 = lm.addLayer('Layer 2');
  const l3 = lm.addLayer('Layer 3');
  assert(lm.layers.length === 3, 'Three layers exist');

  // Select l2 and l3, group them
  lm.selectLayer(l2.id, false, false);
  lm.selectLayer(l3.id, false, true); // Ctrl-select
  assert(lm.selectedLayerIds.size === 2, 'Two layers selected via multi-selection');

  const grp1 = lm.addGroup('Folder A');
  assert(grp1.type === 'group', 'Group layer created with type "group"');
  assert(l2.parentId === grp1.id, 'l2 parentId correctly set to Folder A');
  assert(l3.parentId === grp1.id, 'l3 parentId correctly set to Folder A');

  // Check collapse hiding
  assert(!lm.isLayerHiddenByCollapse(l2), 'l2 not hidden when group is expanded');
  lm.toggleGroupCollapse(grp1.id);
  assert(grp1.collapsed === true, 'Group is collapsed after toggle');
  assert(lm.isLayerHiddenByCollapse(l2) === true, 'l2 is hidden when group is collapsed');
  assert(lm.isLayerHiddenByCollapse(l3) === true, 'l3 is hidden when group is collapsed');
  lm.toggleGroupCollapse(grp1.id);
  assert(!lm.isLayerHiddenByCollapse(l2), 'l2 visible after uncollapsing group');

  // Check group visibility inheritance
  assert(!lm.isLayerHiddenByGroupVisibility(l2), 'l2 visible when group is visible');
  grp1.visible = false;
  assert(lm.isLayerHiddenByGroupVisibility(l2) === true, 'l2 hidden by group visibility when group is invisible');
  grp1.visible = true;

  // Check effective opacity inheritance
  grp1.opacity = 50;
  l2.opacity = 80;
  assert(lm.getEffectiveOpacity(l2) === 40, 'Effective opacity calculated correctly (50% * 80% = 40%)');
  grp1.opacity = 100;
  l2.opacity = 100;

  // ── Test 3: Ungrouping ──
  console.log('\n[Suite 3: Ungrouping]');
  // Test ungrouping via child layer ID
  lm.ungroup(l2.id);
  assert(lm.layers.find(l => l.id === grp1.id) === undefined, 'Group removed from layers after ungrouping');
  assert(l2.parentId === null, 'l2 parentId reset to null after ungroup');
  assert(l3.parentId === null, 'l3 parentId reset to null after ungroup');

  // ── Test 4: Adjustment Layers ──
  console.log('\n[Suite 4: Adjustment Layers]');
  const adj1 = lm.addAdjustmentLayer('brightnessContrast', { brightness: 25, contrast: 10 });
  assert(adj1.type === 'adjustment', 'Adjustment layer created with type "adjustment"');
  assert(adj1.adjustmentType === 'brightnessContrast', 'Adjustment type is brightnessContrast');
  assert(adj1.adjustmentParams.brightness === 25, 'Initial parameters stored');
  assert(adj1.hasMask === true, 'Adjustment layer has full white mask created by default');

  const adj2 = lm.addAdjustmentLayer('curves', { curvePoints: [{x:0,y:0}, {x:128,y:140}, {x:255,y:255}] });
  assert(adj2.adjustmentType === 'curves', 'Curves adjustment layer created');
  assert(adj2.adjustmentParams.curvePoints.length === 3, 'Curves points stored');

  // ── Test 5: Multi-layer Selection & Deletion ──
  console.log('\n[Suite 5: Multi-layer Selection & Recursive Deletion]');
  const grp2 = lm.addGroup('Folder B');
  const childInGrp = lm.addLayer('Nested Child');
  childInGrp.parentId = grp2.id;

  // Select grp2 and call deleteActiveLayer
  lm.setActiveLayer(grp2.id);
  assert(lm.selectedLayerIds.has(grp2.id), 'Folder B is active & selected');
  lm.deleteActiveLayer();
  assert(lm.layers.find(l => l.id === grp2.id) === undefined, 'Folder B was deleted');
  assert(lm.layers.find(l => l.id === childInGrp.id) === undefined, 'Nested child was recursively deleted with folder');

  // ── Test 6: History Undo / Redo with Groups & Adjustments ──
  console.log('\n[Suite 6: History Undo & Redo]');
  const hm = new HistoryManager(30);
  hm.push('Initial State', lm.layers, lm.activeLayerId);

  // Add a new adjustment
  const adjTest = lm.addAdjustmentLayer('invert');
  hm.push('Add Invert Adj', lm.layers, lm.activeLayerId);

  assert(lm.layers.some(l => l.id === adjTest.id), 'Invert adjustment present');
  const undoneStep = hm.undo();
  assert(undoneStep !== null, 'Undo succeeded');
  await lm.restoreFromSnapshot(undoneStep.layers);
  assert(!lm.layers.some(l => l.id === adjTest.id), 'Invert adjustment removed after undo');

  const redoneStep = hm.redo();
  assert(redoneStep !== null, 'Redo succeeded');
  await lm.restoreFromSnapshot(redoneStep.layers);
  const restoredAdj = lm.layers.find(l => l.adjustmentType === 'invert');
  assert(restoredAdj !== undefined, 'Invert adjustment restored after redo');
  assert(restoredAdj.type === 'adjustment', 'Restored layer retained adjustment type');

  // ── Test 7: Compositor Execution ──
  console.log('\n[Suite 7: Compositor Execution]');
  let compositeSuccess = true;
  try {
    const targetCanvas = new MockCanvas(200, 200);
    lm.compositeTo(targetCanvas.getContext('2d'));
  } catch (err) {
    compositeSuccess = false;
    console.error('Composite failed with error:', err);
  }
  assert(compositeSuccess, 'compositeTo() executes cleanly through groups and adjustment layers without throwing');

  console.log(`\n========================================`);
  console.log(`TOTAL TESTS: ${passedTests + failedTests}`);
  console.log(`PASSED: ${passedTests}`);
  console.log(`FAILED: ${failedTests}`);
  console.log(`========================================`);

  if (failedTests > 0) {
    process.exit(1);
  } else {
    console.log('ALL MILESTONE 1 TESTS PASSED PERFECTLY!\n');
    process.exit(0);
  }
}

runSuite().catch(err => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
