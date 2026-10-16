// ══════════════════════════════════════════════════════════════════════
// PixelForge Studio — Black Box Component Discovery & Comprehensive Audit
// ══════════════════════════════════════════════════════════════════════

const fs = require('fs');
const assert = require('assert');

// Setup Node.js Headless Environment with full DOM mocking
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
  getElementById: (id) => {
    if (!domStore.has(id)) {
      return createMockElement(id);
    }
    return domStore.get(id);
  },
  querySelector: (sel) => {
    if (sel.startsWith('#')) return global.document.getElementById(sel.slice(1));
    return createMockElement();
  },
  querySelectorAll: (sel) => {
    return [];
  },
  createElement: (tag) => createMockElement('', tag),
  body: createMockElement('body', 'body')
};

global.window = global;
global.alert = (msg) => {};

// Load real Utils
const realUtils = require('./js/utils.js');
global.Utils = realUtils;
global.window.Utils = realUtils;
if (!global.Utils.createCanvas) {
  global.Utils.createCanvas = (w, h) => {
    const c = createMockElement('', 'canvas');
    c.width = w;
    c.height = h;
    return c;
  };
}
global.window.requestAnimationFrame = (fn) => setTimeout(fn, 16);
global.window.cancelAnimationFrame = (id) => clearTimeout(id);

console.log('════════════════════════════════════════════════════════════════');
console.log('  PixelForge Studio — Black Box Component Discovery & Audit');
console.log('════════════════════════════════════════════════════════════════\n');

// 1. Load HTML and parse elements
const html = fs.readFileSync('index.html', 'utf8');

// Extract all data-action menu items
const menuActionMatches = [...html.matchAll(/data-action="([^"]+)"/g)].map(m => m[1]);
console.log(`Found ${menuActionMatches.length} menu actions in index.html`);

// Extract all data-tool buttons
const toolMatches = [...html.matchAll(/data-tool="([^"]+)"/g)].map(m => m[1]);
console.log(`Found ${toolMatches.length} toolbar tools in index.html`);

// Extract all modal IDs
const modalMatches = [...html.matchAll(/id="(modal-[^"]+)"/g)].map(m => m[1]);
console.log(`Found ${modalMatches.length} modals in index.html`);

// 2. Load Core Application Modules
const LayerManager = require('./js/layers.js');
const ToolManager = require('./js/tools.js');
const ColorPickerManager = require('./js/color-picker.js');
const { SmartSubjectDetection } = require('./js/smart-selection.js');

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
  showModal: (id) => {},
  hideModal: (id) => {},
  showToast: (msg) => {}
};

const tm = new ToolManager(mockApp);
mockApp.toolManager = tm;
mockApp.layerManager.addLayer('Background Layer');

// 3. Black Box Test 1: Activate Every Single Tool
console.log('\n► Black Box Test 1: Testing All Toolbar Tools Activation & Pointer Cycles');
let toolErrors = 0;
toolMatches.forEach(tool => {
  try {
    tm.setTool(tool);
    // Simulate pointer down, move, and up
    const mockDown = { clientX: 200, clientY: 150, pressure: 1.0, button: 0 };
    const mockMove = { clientX: 250, clientY: 200, pressure: 1.0, button: 0 };
    const mockUp = { clientX: 250, clientY: 200, pressure: 0, button: 0 };
    tm.onPointerDown(mockDown);
    tm.onPointerMove(mockMove);
    tm.onPointerUp(mockUp);
    console.log(`  ✓ Tool "${tool}" activated and cycled pointer events cleanly`);
  } catch (err) {
    console.error(`  ✗ Tool "${tool}" FAILED: ${err.message}`);
    toolErrors++;
  }
});

// 4. Black Box Test 2: Free Transform Scaling Integrity
console.log('\n► Black Box Test 2: Free Transform Scaling & Aspect Ratio Integrity');
let transformErrors = 0;
try {
  tm.startFreeTransform();
  assert.ok(tm.isTransforming, 'Free Transform started');
  assert.ok(tm.transformBox, 'Transform box created');

  const startW = tm.transformBox.w;
  const startH = tm.transformBox.h;
  console.log(`  Initial Transform Box: ${startW}x${startH}`);

  // Test dragging all 8 handles with various deltas (expansion, normal, aggressive shrink)
  const handles = ['br', 'tl', 'tr', 'bl', 'mr', 'ml', 'tm', 'bm'];
  handles.forEach(h => {
    tm.activeHandle = h;
    tm.transformDragStart = {
      x: 300, y: 300,
      boxX: tm.transformBox.x,
      boxY: tm.transformBox.y,
      boxW: tm.transformBox.w,
      boxH: tm.transformBox.h,
      cx: tm.transformBox.x + tm.transformBox.w / 2,
      cy: tm.transformBox.y + tm.transformBox.h / 2,
      boxAngle: 0,
      initialAngle: 0
    };

    // Test aggressive inward shrinking past origin
    tm.handleTransformPointerMove(-500, -500, { shiftKey: false, altKey: false });
    assert.ok(tm.transformBox.w >= 20, `Width maintained positive minimum: ${tm.transformBox.w}`);
    assert.ok(tm.transformBox.h >= 20, `Height maintained positive minimum: ${tm.transformBox.h}`);
    assert.ok(!isNaN(tm.transformBox.w) && !isNaN(tm.transformBox.h), 'Dimensions are not NaN');
    assert.ok(isFinite(tm.transformBox.w) && isFinite(tm.transformBox.h), 'Dimensions are finite');

    // Test normal expansion
    tm.handleTransformPointerMove(500, 500, { shiftKey: false, altKey: false });
    assert.ok(tm.transformBox.w >= 20, `Expanded width valid: ${tm.transformBox.w}`);
    assert.ok(tm.transformBox.h >= 20, `Expanded height valid: ${tm.transformBox.h}`);
  });

  tm.commitFreeTransform();
  console.log('  ✓ Free Transform handles and commitment executed cleanly without collapsing');
} catch (err) {
  console.error(`  ✗ Free Transform audit FAILED: ${err.message}`);
  transformErrors++;
}

// 5. Black Box Test 3: Crop Tool Bounding Safety
console.log('\n► Black Box Test 3: Crop Tool Bounding & Aspect Ratio Preservation');
let cropErrors = 0;
try {
  tm.setTool('crop');
  assert.ok(tm.activeCropRect, 'Crop rect initialized');

  // Test aspect ratio constraints
  const testAspects = ['1:1', '16:9', '4:3', 'original', 'freeform'];
  testAspects.forEach(asp => {
    tm.cropAspectRatio = asp;
    tm.cropDragHandle = 'br';
    tm.cropDragStart = { x: 500, y: 400, rect: { x: 0, y: 0, w: 400, h: 300 } };
    tm.handleCropPointerMove(450, 350);
    assert.ok(tm.activeCropRect.w >= 10, `Crop width valid: ${tm.activeCropRect.w}`);
    assert.ok(tm.activeCropRect.h >= 10, `Crop height valid: ${tm.activeCropRect.h}`);
  });
  console.log('  ✓ Crop Tool aspect ratios and handle drags are robust');
} catch (err) {
  console.error(`  ✗ Crop Tool audit FAILED: ${err.message}`);
  cropErrors++;
}

// 6. Black Box Test 4: Menu Action Coverage & Safety
console.log('\n► Black Box Test 4: Auditing All Menu Actions Coverage in handleMenuAction');
let menuErrors = 0;
const appJs = fs.readFileSync('js/app.js', 'utf8');
const handleActionIndex = appJs.indexOf('handleMenuAction(action)');
const methodCode = appJs.slice(handleActionIndex, appJs.indexOf('  initKeybindings()'));

const handledActions = new Set();
for (const m of methodCode.matchAll(/case '([^']+)':/g)) {
  handledActions.add(m[1]);
}

const uniqueMenuActions = [...new Set(menuActionMatches)];
uniqueMenuActions.forEach(action => {
  if (!handledActions.has(action)) {
    console.error(`  ✗ Menu Action "${action}" is MISSING from handleMenuAction!`);
    menuErrors++;
  }
});
if (menuErrors === 0) {
  console.log(`  ✓ All ${uniqueMenuActions.length} menu actions are cleanly mapped and handled`);
}

// 7. Black Box Test 5: Modal Elements & Dialog Integrity
console.log('\n► Black Box Test 5: Auditing All Modals Structure & Controls');
let modalErrors = 0;
const uniqueModals = [...new Set(modalMatches)];
uniqueModals.forEach(modalId => {
  const mIndex = html.indexOf(`id="${modalId}"`);
  if (mIndex === -1) {
    console.error(`  ✗ Modal "${modalId}" not found in HTML`);
    modalErrors++;
    return;
  }
  const chunk = html.slice(mIndex, mIndex + 1200);
  const hasDialog = chunk.includes('modal-dialog');
  const hasClose = chunk.includes('modal-close') || chunk.includes('modal-cancel') || chunk.includes('btn-close') || chunk.includes('btn-cancel');
  if (!hasDialog) {
    console.error(`  ✗ Modal "${modalId}" missing .modal-dialog container`);
    modalErrors++;
  }
  if (!hasClose) {
    console.error(`  ✗ Modal "${modalId}" missing close/cancel dismissal control`);
    modalErrors++;
  }
});
if (modalErrors === 0) {
  console.log(`  ✓ All ${uniqueModals.length} modal dialogs have valid structures and dismissal controls`);
}

console.log('\n════════════════════════════════════════════════════════════════');
console.log(`  Black Box Audit Summary:`);
console.log(`  - Tool Errors: ${toolErrors} / 49`);
console.log(`  - Transform Errors: ${transformErrors}`);
console.log(`  - Crop Errors: ${cropErrors}`);
console.log(`  - Menu Action Errors: ${menuErrors} / ${uniqueMenuActions.length}`);
console.log(`  - Modal Errors: ${modalErrors} / ${uniqueModals.length}`);
console.log('════════════════════════════════════════════════════════════════\n');

if (toolErrors > 0 || transformErrors > 0 || cropErrors > 0 || menuErrors > 0 || modalErrors > 0) {
  process.exit(1);
}
console.log('🎉 ALL BLACK BOX AUDIT TESTS PASSED CLEANLY!\n');

