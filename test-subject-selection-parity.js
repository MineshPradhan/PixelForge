// ══════════════════════════════════════════════════════════════════════
// PixelForge Studio — Subject Selection Parity & Anti-Oval Test Suite
// ══════════════════════════════════════════════════════════════════════

const assert = require('assert');

// Setup Node.js Headless Environment
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

global.window = global;
global.document = {
  querySelectorAll: () => [],
  getElementById: () => null,
  addEventListener: () => {}
};

function createSoftwareCanvas(w, h) {
  const pixelBuffer = new Uint8ClampedArray(w * h * 4);
  let curFill = [0, 0, 0, 255];

  function hexToRgba(hex) {
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const num = parseInt(hex, 16);
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255, 255];
  }

  const ctx = {
    canvas: { width: w, height: h },
    set fillStyle(val) {
      if (typeof val === 'string' && val.startsWith('#')) {
        curFill = hexToRgba(val);
      }
    },
    fillRect(rx, ry, rw, rh) {
      for (let y = Math.max(0, ry); y < Math.min(h, ry + rh); y++) {
        for (let x = Math.max(0, rx); x < Math.min(w, rx + rw); x++) {
          const idx = (y * w + x) * 4;
          pixelBuffer[idx] = curFill[0];
          pixelBuffer[idx + 1] = curFill[1];
          pixelBuffer[idx + 2] = curFill[2];
          pixelBuffer[idx + 3] = curFill[3];
        }
      }
    },
    clearRect(rx, ry, rw, rh) {
      for (let y = Math.max(0, ry); y < Math.min(h, ry + rh); y++) {
        for (let x = Math.max(0, rx); x < Math.min(w, rx + rw); x++) {
          const idx = (y * w + x) * 4;
          pixelBuffer[idx] = 0;
          pixelBuffer[idx + 1] = 0;
          pixelBuffer[idx + 2] = 0;
          pixelBuffer[idx + 3] = 0;
        }
      }
    },
    getImageData(gx, gy, gw, gh) {
      const out = new global.ImageData(gw, gh);
      for (let y = 0; y < gh; y++) {
        for (let x = 0; x < gw; x++) {
          const sIdx = ((gy + y) * w + (gx + x)) * 4;
          const dIdx = (y * gw + x) * 4;
          out.data[dIdx] = pixelBuffer[sIdx];
          out.data[dIdx + 1] = pixelBuffer[sIdx + 1];
          out.data[dIdx + 2] = pixelBuffer[sIdx + 2];
          out.data[dIdx + 3] = pixelBuffer[sIdx + 3];
        }
      }
      return out;
    },
    putImageData() {},
    save() {},
    restore() {},
    beginPath() {},
    arc(cx, cy, r) {
      for (let y = Math.max(0, cy - r); y <= Math.min(h - 1, cy + r); y++) {
        for (let x = Math.max(0, cx - r); x <= Math.min(w - 1, cx + r); x++) {
          if (Math.hypot(x - cx, y - cy) <= r) {
            const idx = (y * w + x) * 4;
            pixelBuffer[idx] = curFill[0];
            pixelBuffer[idx + 1] = curFill[1];
            pixelBuffer[idx + 2] = curFill[2];
            pixelBuffer[idx + 3] = curFill[3];
          }
        }
      }
    },
    fill() {},
    stroke() {},
    strokeRect() {},
    setLineDash() {},
    ellipse() {}
  };

  return {
    width: w,
    height: h,
    getContext: () => ctx
  };
}

const { SmartSubjectDetection, SelectionRefinementEngine } = require('./js/smart-selection.js');

let passCount = 0;
let totalCount = 0;

function test(name, fn) {
  totalCount++;
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passCount++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    console.error(err.stack);
  }
}

console.log('════════════════════════════════════════════════════════════════');
console.log('  PixelForge Studio — Subject Selection Parity & Anti-Oval Suite');
console.log('════════════════════════════════════════════════════════════════\n');

// ── Test Group 1: SmartSubjectDetection Regional & Full Canvas ──
console.log('► Test Group 1: SmartSubjectDetection Multi-Scale Saliency');

test('detectSubject accurately detects subject across full canvas without oval distortion', () => {
  const w = 200, h = 200;
  const canvas = createSoftwareCanvas(w, h);
  const ctx = canvas.getContext('2d');

  // Fill with light gray background
  ctx.fillStyle = '#e0e0e0';
  ctx.fillRect(0, 0, w, h);

  // Draw an off-center rectangular subject at x=30, y=40, w=50, h=80 in dark blue
  ctx.fillStyle = '#1e3a8a';
  ctx.fillRect(30, 40, 50, 80);

  const res = SmartSubjectDetection.detectSubject(ctx, w, h);
  assert.ok(res, 'Returns result object');
  assert.ok(res.mask instanceof Uint8Array, 'Mask is Uint8Array');
  assert.strictEqual(res.mask.length, w * h, 'Mask matches canvas dimensions');
  assert.ok(res.selectedCount > 1000, 'Detected foreground subject has positive pixel count');

  // Verify bounding box bounds tightly capture the subject at (30, 40)
  assert.ok(res.bounds.x >= 25 && res.bounds.x <= 35, `Subject X bounded accurately: got ${res.bounds.x}`);
  assert.ok(res.bounds.y >= 35 && res.bounds.y <= 45, `Subject Y bounded accurately: got ${res.bounds.y}`);
  assert.ok(res.bounds.width >= 40 && res.bounds.width <= 60, `Subject width captured: got ${res.bounds.width}`);
  assert.ok(res.bounds.height >= 70 && res.bounds.height <= 90, `Subject height captured: got ${res.bounds.height}`);

  // Inside the subject (e.g. x=55, y=80), mask must be 255
  assert.strictEqual(res.mask[80 * w + 55], 255, 'Interior subject pixel is selected');
  // Outside the subject (e.g. x=160, y=160), mask must be 0
  assert.strictEqual(res.mask[160 * w + 160], 0, 'Exterior background pixel is NOT selected');
});

test('detectSubject supports user-defined regional bounding box (Object Selection Tool)', () => {
  const w = 300, h = 300;
  const canvas = createSoftwareCanvas(w, h);
  const ctx = canvas.getContext('2d');

  // White background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);

  // Subject 1: Red circle at (60, 60)
  ctx.fillStyle = '#ef4444';
  ctx.arc(60, 60, 25);

  // Subject 2: Green rectangle at (200, 200)
  ctx.fillStyle = '#10b981';
  ctx.fillRect(190, 190, 50, 50);

  // User manually drags box around Subject 2 ONLY: region { x: 180, y: 180, width: 70, height: 70 }
  const region = { x: 180, y: 180, width: 70, height: 70 };
  const res = SmartSubjectDetection.detectSubject(ctx, w, h, region);

  assert.ok(res, 'Regional detection returned result');
  // Subject 2 must be selected
  assert.strictEqual(res.mask[210 * w + 210], 255, 'Subject 2 inside region is selected');
  // Subject 1 outside region must NOT be selected
  assert.strictEqual(res.mask[60 * w + 60], 0, 'Subject 1 outside region is completely unselected');
  // Region bounds match Subject 2
  assert.ok(res.bounds.x >= 185 && res.bounds.x <= 195, 'Regional X coordinates accurate');
  assert.ok(res.bounds.y >= 185 && res.bounds.y <= 195, 'Regional Y coordinates accurate');
});

test('detectSubject prioritizes alpha transparency for cutouts', () => {
  const w = 100, h = 100;
  const canvas = createSoftwareCanvas(w, h);
  const ctx = canvas.getContext('2d');

  // Transparent background (all alpha = 0)
  ctx.clearRect(0, 0, w, h);

  // Draw opaque rectangle in center
  ctx.fillStyle = '#fbbf24';
  ctx.fillRect(25, 25, 50, 50);

  const res = SmartSubjectDetection.detectSubject(ctx, w, h);
  assert.strictEqual(res.mask[50 * w + 50], 255, 'Opaque cutout pixel is selected');
  assert.strictEqual(res.mask[5 * w + 5], 0, 'Transparent border pixel is not selected');
});

// ── Test Group 2: Boundary Tracing & Anti-Oval Marching Ants ──
console.log('\n► Test Group 2: Boundary Tracing & Anti-Oval Marching Ants');

test('buildSelectionPath generates exact boundary line segments from pixel mask', () => {
  const ToolManager = require('./js/tools.js');
  const mockApp = {
    width: 100,
    height: 100,
    overlayCtx: {
      save: () => {},
      restore: () => {},
      strokeRect: () => {},
      beginPath: () => {},
      ellipse: () => { throw new Error('Ellipse called on mask selection!'); },
      stroke: () => {},
      setLineDash: () => {},
      moveTo: () => {},
      lineTo: () => {},
      clearRect: () => {}
    },
    layerManager: { getActiveLayer: () => null }
  };

  const tm = new ToolManager(mockApp);
  const w = 100, h = 100;
  const mask = new Uint8Array(w * h);

  // Draw an L-shaped subject
  for (let y = 20; y <= 80; y++) {
    for (let x = 20; x <= 40; x++) mask[y * w + x] = 255;
  }
  for (let y = 60; y <= 80; y++) {
    for (let x = 40; x <= 70; x++) mask[y * w + x] = 255;
  }

  const sel = {
    type: 'path',
    x: 20,
    y: 20,
    w: 51,
    h: 61,
    mask
  };

  tm.buildSelectionPath(sel);
  assert.ok(sel._path || (sel._segments && sel._segments.length > 0), 'Boundary path or segments successfully generated');

  if (sel._segments) {
    assert.ok(sel._segments.length >= 8, 'Generated multiple boundary segments tracing L-shape');
  }

  // Now render marching ants: it MUST NOT throw "Ellipse called on mask selection!"
  tm.selection = sel;
  let ellipseCalled = false;
  mockApp.overlayCtx.ellipse = () => { ellipseCalled = true; };
  tm.renderMarchingAnts();
  assert.strictEqual(ellipseCalled, false, 'renderMarchingAnts did NOT call ellipse on a mask selection');
});

test('renderMarchingAnts only calls ellipse for explicit elliptical marquee selections', () => {
  const ToolManager = require('./js/tools.js');
  let ellipseCallCount = 0;
  const mockApp = {
    width: 100,
    height: 100,
    overlayCtx: {
      save: () => {},
      restore: () => {},
      strokeRect: () => {},
      beginPath: () => {},
      ellipse: () => { ellipseCallCount++; },
      moveTo: () => {},
      lineTo: () => {},
      closePath: () => {},
      stroke: () => {},
      setLineDash: () => {},
      clearRect: () => {}
    },
    layerManager: { getActiveLayer: () => null }
  };

  const tm = new ToolManager(mockApp);

  // Ellipse Marquee
  tm.selection = { type: 'ellipse', x: 10, y: 10, w: 50, h: 40 };
  tm.renderMarchingAnts();
  assert.ok(ellipseCallCount > 0, 'Elliptical marquee draws true ellipse');

  // Rectangular Marquee
  ellipseCallCount = 0;
  tm.selection = { type: 'rect', x: 10, y: 10, w: 50, h: 40 };
  tm.renderMarchingAnts();
  assert.strictEqual(ellipseCallCount, 0, 'Rect marquee does not call ellipse');

  // Subject / Path Selection
  ellipseCallCount = 0;
  tm.selection = { type: 'path', x: 10, y: 10, w: 50, h: 40, contour: [{x:10,y:10},{x:50,y:10},{x:50,y:40},{x:10,y:40}] };
  tm.renderMarchingAnts();
  assert.strictEqual(ellipseCallCount, 0, 'Contour/path selection does not call ellipse');
});

// ── Test Group 3: Invert Selection & Manual Object Selection ──
console.log('\n► Test Group 3: Invert Selection & Manual Object Selection');

test('invertSelection correctly flips binary mask across entire canvas', () => {
  const ToolManager = require('./js/tools.js');
  const mockApp = {
    width: 50,
    height: 50,
    pushHistoryState: () => {},
    overlayCtx: {
      save: () => {},
      restore: () => {},
      strokeRect: () => {},
      beginPath: () => {},
      ellipse: () => {},
      moveTo: () => {},
      lineTo: () => {},
      closePath: () => {},
      stroke: () => {},
      setLineDash: () => {},
      clearRect: () => {}
    },
    layerManager: { getActiveLayer: () => null }
  };

  const tm = new ToolManager(mockApp);
  const w = 50, h = 50;
  const mask = new Uint8Array(w * h);
  // Center 10x10 square
  for (let y = 20; y < 30; y++) {
    for (let x = 20; x < 30; x++) mask[y * w + x] = 255;
  }

  tm.selection = { type: 'path', x: 20, y: 20, w: 10, h: 10, mask };
  tm.invertSelection();

  assert.ok(tm.selection, 'Inverted selection exists');
  assert.ok(tm.selection.mask, 'Inverted mask exists');
  // Center square must now be 0
  assert.strictEqual(tm.selection.mask[25 * w + 25], 0, 'Original foreground inverted to 0');
  // Exterior corners must now be 255
  assert.strictEqual(tm.selection.mask[0], 255, 'Original background inverted to 255');
  assert.strictEqual(tm.selection.mask[49 * w + 49], 255, 'Original background inverted to 255');
});

test('finalizeObjectSelection handles regional dragging and commits selection', () => {
  const ToolManager = require('./js/tools.js');
  const canvas = createSoftwareCanvas(100, 100);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 100, 100);
  ctx.fillStyle = '#dc2626';
  ctx.fillRect(30, 30, 40, 40);

  const mockApp = {
    width: 100,
    height: 100,
    pushHistoryState: () => {},
    renderComposite: () => {},
    overlayCtx: {
      save: () => {},
      restore: () => {},
      strokeRect: () => {},
      beginPath: () => {},
      ellipse: () => {},
      moveTo: () => {},
      lineTo: () => {},
      closePath: () => {},
      stroke: () => {},
      setLineDash: () => {},
      clearRect: () => {}
    },
    layerManager: {
      getActiveLayer: () => ({ ctx, canvas })
    }
  };

  const tm = new ToolManager(mockApp);
  tm.objSelMode = 'rectangle';
  tm.objSelStart = { x: 25, y: 25 };
  tm.objSelDragging = true;

  // Release drag at (75, 75)
  tm.finalizeObjectSelection(75, 75);

  assert.ok(tm.selection, 'Selection created from dragged object box');
  assert.ok(tm.selection.mask, 'Mask was generated');
  assert.strictEqual(tm.selection.mask[50 * 100 + 50], 255, 'Object inside box is selected');
  assert.strictEqual(tm.selection.mask[5 * 100 + 5], 0, 'Background outside box is not selected');
});

console.log('\n════════════════════════════════════════════════════════════════');
console.log(`  Subject Selection Parity: ${passCount} / ${totalCount} Passed (${Math.round((passCount/totalCount)*100)}%)`);
console.log('════════════════════════════════════════════════════════════════\n');

if (passCount !== totalCount) {
  process.exit(1);
}
