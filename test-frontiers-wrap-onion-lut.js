// ══════════════════════════════════════════════════════════════════════
// PixelForge Studio — Frontiers Test Suite: Wrap-Around, Onion Skinning, Tetrahedral 3D LUT
// ══════════════════════════════════════════════════════════════════════

const assert = require('assert');
const fs = require('fs');

// Headless Mocking
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
function createMockElement(id = '', tag = 'div') {
  const classList = new Set();
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
    getContext: () => ({
      canvas: { width: 400, height: 300 },
      save: () => {},
      restore: () => {},
      clearRect: () => {},
      fillRect: () => {},
      drawImage: () => {},
      getImageData: (x, y, w, h) => new global.ImageData(w, h),
      putImageData: () => {},
      beginPath: () => {},
      arc: () => {},
      fill: () => {}
    }),
    appendChild: (c) => { el.children.push(c); return c; },
    removeChild: (c) => { el.children = el.children.filter(x => x !== c); return c; },
    value: '',
    textContent: '',
    innerHTML: ''
  };
  if (id) domStore.set(id, el);
  return el;
}

global.document = {
  getElementById: (id) => {
    if (!domStore.has(id)) return createMockElement(id);
    return domStore.get(id);
  },
  createElement: (tag) => createMockElement('', tag)
};
global.window = global;

const Utils = require('./js/utils.js');
global.Utils = Utils;
if (!global.Utils.createCanvas) {
  global.Utils.createCanvas = (w, h) => {
    const c = createMockElement('', 'canvas');
    c.width = w;
    c.height = h;
    return c;
  };
}

const { LutEngine } = require('./js/color-lut.js');
const { TimelineFrame, TimelineManager } = require('./js/timeline-gif.js');
const WrapAroundEngine = require('./js/wrap-around.js');
const LayerManager = require('./js/layers.js');

console.log('════════════════════════════════════════════════════════════════');
console.log('  PixelForge Studio — Frontiers: Wrap-Around, Onion Skin & LUT');
console.log('════════════════════════════════════════════════════════════════\n');

// ── Test Group 1: 3D LUT Tetrahedral Simplex Interpolation ──
console.log('► Test Group 1: 3D LUT Tetrahedral Simplex Interpolation');
{
  const cubeText = `
TITLE "Test Identity Cube"
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
  const lut = LutEngine.parseCube(cubeText);
  assert.strictEqual(lut.size, 2, 'LUT size parsed as 2x2x2');
  assert.strictEqual(lut.type, '3D', 'LUT type is 3D');

  const imgData = new global.ImageData(4, 4);
  imgData.data[0] = 64;   // R
  imgData.data[1] = 128;  // G
  imgData.data[2] = 192;  // B
  imgData.data[3] = 255;  // A

  // Apply Tetrahedral LUT
  LutEngine.applyTetrahedralLut(imgData, lut, 1.0);
  assert.strictEqual(imgData.data[0], 64, 'Tetrahedral maintains linear R identity');
  assert.strictEqual(imgData.data[1], 128, 'Tetrahedral maintains linear G identity');
  assert.strictEqual(imgData.data[2], 192, 'Tetrahedral maintains linear B identity');
  assert.strictEqual(imgData.data[3], 255, 'Alpha channel remains intact');
  console.log('  ✓ Tetrahedral simplex interpolation accurately preserves linear identity');

  // Verify non-destructive intensity blend (50% blend)
  const blendData = new global.ImageData(2, 2);
  blendData.data[0] = 100;
  blendData.data[1] = 100;
  blendData.data[2] = 100;
  blendData.data[3] = 255;

  // Custom invert LUT
  const invertCube = `
TITLE "Invert Cube"
LUT_3D_SIZE 2
1.0 1.0 1.0
0.0 1.0 1.0
1.0 0.0 1.0
0.0 0.0 1.0
1.0 1.0 0.0
0.0 1.0 0.0
1.0 0.0 0.0
0.0 0.0 0.0
`;
  const invLut = LutEngine.parseCube(invertCube);
  LutEngine.applyLut(blendData, invLut, 0.5, 'tetrahedral');
  // 100 inverted is 155. 50% blend is 100 + (155 - 100) * 0.5 = 128
  assert.strictEqual(blendData.data[0], 128, '50% intensity blend smoothly calculated in tetrahedral mode');
  console.log('  ✓ 50% tetrahedral intensity blend calculates precise midpoint values');
}

// ── Test Group 2: Animation Timeline Onion Skinning ──
console.log('\n► Test Group 2: Animation Timeline Onion Skinning Engine');
{
  const mockApp = {
    width: 200,
    height: 150,
    layerManager: new LayerManager(200, 150),
    renderGuidesAndOverlays: () => {},
    renderComposite: () => {}
  };
  mockApp.layerManager.addLayer('Base Layer');
  mockApp.layerManager.addLayer('Keyframe 2');

  const tm = new TimelineManager(mockApp);
  tm.init();
  assert.strictEqual(tm.frames.length, 1, 'Initial frame captured');

  // Add 3 more frames
  tm.addFrame(0.1);
  tm.addFrame(0.1);
  tm.addFrame(0.1);
  assert.strictEqual(tm.frames.length, 4, 'Timeline has 4 frames');

  // Select middle frame (index 2)
  tm.selectFrame(2);
  assert.strictEqual(tm.currentFrameIndex, 2, 'Frame 2 selected as active drawing frame');

  // Test toggling onion skin
  assert.strictEqual(tm.onionSkinEnabled, false, 'Onion skin starts disabled');
  tm.toggleOnionSkin(true);
  assert.strictEqual(tm.onionSkinEnabled, true, 'Onion skin toggled on');

  // Configure settings
  tm.setOnionSkinSettings({ prevFrames: 2, nextFrames: 1, opacity: 0.4 });
  assert.strictEqual(tm.onionSkinPrevFrames, 2, 'Previous frames count set to 2');
  assert.strictEqual(tm.onionSkinNextFrames, 1, 'Next frames count set to 1');
  assert.strictEqual(tm.onionSkinOpacity, 0.4, 'Opacity set to 0.4');

  // Render onion skin onto mock target context
  let drawCount = 0;
  const mockTargetCtx = {
    save: () => {},
    restore: () => {},
    drawImage: () => { drawCount++; },
    globalAlpha: 1.0
  };
  tm.renderOnionSkin(mockTargetCtx, 200, 150);
  assert.ok(drawCount > 0, `Onion skin overlays rendered ${drawCount} passes (past and future)`);
  console.log(`  ✓ Onion skinning successfully rendered ${drawCount} semi-transparent temporal frames`);

  tm.toggleOnionSkin(false);
  assert.strictEqual(tm.onionSkinEnabled, false, 'Onion skin disabled cleanly');
  console.log('  ✓ Onion skinning state transitions and temporal layers work reliably');
}

// ── Test Group 3: Infinite Seamless Wrap-Around Engine ──
console.log('\n► Test Group 3: Infinite Seamless Wrap-Around Engine (Shift+W)');
{
  createMockElement('canvas-wrapper');
  const mockApp = {
    width: 500,
    height: 500,
    mainCanvas: createMockElement('main-canvas', 'canvas'),
    showToast: () => {},
    renderComposite: () => {},
    renderGuidesAndOverlays: () => {}
  };

  const wrap = new WrapAroundEngine(mockApp);
  assert.strictEqual(wrap.enabled, false, 'Wrap-around starts disabled');

  // Test toggle
  wrap.toggleWrapAround(true);
  assert.strictEqual(wrap.enabled, true, 'Wrap-around toggled on');
  assert.strictEqual(wrap.tiles.length, 8, '8 surrounding quadrant tiles instantiated');
  console.log('  ✓ Wrap-Around Mode instantiates 8 surrounding infinite quadrant canvases');

  // Test coordinate wrapping modulo (W, H)
  const c1 = wrap.wrapCoordinates(-50, -30, 500, 500);
  assert.strictEqual(c1.x, 450, 'Negative X (-50) toroidally wraps to 450');
  assert.strictEqual(c1.y, 470, 'Negative Y (-30) toroidally wraps to 470');

  const c2 = wrap.wrapCoordinates(550, 620, 500, 500);
  assert.strictEqual(c2.x, 50, 'Positive overflow X (550) wraps to 50');
  assert.strictEqual(c2.y, 120, 'Positive overflow Y (620) wraps to 120');
  console.log('  ✓ Toroidal coordinate mapping wraps pointer coordinates seamlessly in all directions');

  // Test brush dab seam crossing offsets
  // Dab at right edge: x = 490, r = 20, width = 500
  const rightDabOffsets = wrap.getWrappedOffsets(490, 250, 20, 500, 500);
  assert.strictEqual(rightDabOffsets.length, 2, 'Dab crossing right border produces 2 offsets (center + left seam)');
  assert.ok(rightDabOffsets.some(o => o.dx === -500 && o.dy === 0), 'Produced dx = -500 left-wrap dab');

  // Dab in top-left corner: x = 5, y = 5, r = 20
  const cornerOffsets = wrap.getWrappedOffsets(5, 5, 20, 500, 500);
  assert.strictEqual(cornerOffsets.length, 4, 'Corner dab produces 4 offsets (center, right, bottom, bottom-right diagonal)');
  assert.ok(cornerOffsets.some(o => o.dx === 500 && o.dy === 0), 'Contains right offset');
  assert.ok(cornerOffsets.some(o => o.dx === 0 && o.dy === 500), 'Contains bottom offset');
  assert.ok(cornerOffsets.some(o => o.dx === 500 && o.dy === 500), 'Contains diagonal corner offset');
  console.log('  ✓ Corner dabs generate 4-way seam wrapping offsets for seamless repeatable textures');

  // Test disable
  wrap.toggleWrapAround(false);
  assert.strictEqual(wrap.enabled, false, 'Wrap-around disabled cleanly');
  console.log('  ✓ Wrap-Around Mode disables and hides tiles container cleanly');
}

console.log('\n════════════════════════════════════════════════════════════════');
console.log('  Frontiers Suite: All 3 Test Groups Passed! (100%)');
console.log('════════════════════════════════════════════════════════════════\n');
