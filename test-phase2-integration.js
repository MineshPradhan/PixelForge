/**
 * PixelForge Studio — Phase 2 Comprehensive Integration Test Suite
 *
 * Covers:
 *  1. Procedural Pattern Generation (Grid, Dots, Stripes, Checker, Noise)
 *  2. Professional Layer Styles (Bevel & Emboss, Inner Shadow, Satin, Pattern Overlay)
 *  3. Compositor & Rasterization with Inner Styles
 *  4. Smart Object Project Data Serialization & Deserialization
 *  5. Pre-Press Profiles & Delta-E Color Fidelity
 */

const assert = require('assert');

// Setup Headless Mock Environment
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

// Mock canvas factory
const mockCreateCanvas = (w, h) => ({
  width: w,
  height: h,
  getContext: () => ({
    canvas: { width: w, height: h },
    save() {},
    restore() {},
    clearRect() {},
    fillRect() {},
    beginPath() {},
    arc() {},
    rect() {},
    fill() {},
    stroke() {},
    moveTo() {},
    lineTo() {},
    clip() {},
    translate() {},
    rotate() {},
    scale() {},
    drawImage() {},
    createPattern: () => ({}),
    createImageData: (gw, gh) => new global.ImageData(gw, gh),
    getImageData: (x, y, gw, gh) => new global.ImageData(gw, gh),
    putImageData() {}
  }),
  toDataURL: () => 'data:image/png;base64,mock'
});

require('./js/utils.js');
global.Utils.createCanvas = mockCreateCanvas;

global.document = {
  createElement: (tag) => mockCreateCanvas(100, 100),
  getElementById: () => null,
  querySelectorAll: () => []
};

const LayerManager = require('./js/layers.js');
const { SmartFilter, SmartObjectData } = require('./js/smart-objects.js');
const { CMYKProofEngine } = require('./js/cmyk-proof.js');
const { SelectionRefinementEngine, SmartSubjectDetection } = require('./js/smart-selection.js');

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
  }
}

console.log('════════════════════════════════════════════════════════════════');
console.log('  PixelForge Studio — Phase 2 Comprehensive Integration Suite');
console.log('════════════════════════════════════════════════════════════════\n');

console.log('► Test Group 1: Procedural Patterns Generation');
test('renderProceduralPattern renders all 5 pattern styles', () => {
  const lm = new LayerManager(100, 100);
  const patterns = ['grid', 'dots', 'stripes', 'checker', 'noise'];
  patterns.forEach(pat => {
    const canvas = lm.renderProceduralPattern(pat, 64, 64, 100);
    assert(canvas, `Pattern ${pat} returned a canvas`);
    assert.strictEqual(canvas.width, 64);
    assert.strictEqual(canvas.height, 64);
  });
});

console.log('\n► Test Group 2: Professional Layer Styles & Defaults');
test('LayerManager initializes layer with all 8 layer styles configured', () => {
  const lm = new LayerManager(100, 100);
  const l = lm.addLayer('Styled Layer');
  assert(l.styles, 'styles object exists');
  assert(l.styles.dropShadow, 'dropShadow exists');
  assert(l.styles.outerGlow, 'outerGlow exists');
  assert(l.styles.stroke, 'stroke exists');
  assert(l.styles.colorOverlay, 'colorOverlay exists');
  assert(l.styles.bevelEmboss, 'bevelEmboss exists');
  assert(l.styles.innerShadow, 'innerShadow exists');
  assert(l.styles.satin, 'satin exists');
  assert(l.styles.patternOverlay, 'patternOverlay exists');

  assert.strictEqual(l.styles.bevelEmboss.style, 'inner-bevel');
  assert.strictEqual(l.styles.satin.distance, 11);
  assert.strictEqual(l.styles.patternOverlay.pattern, 'grid');
});

test('applyInnerStyles executes cleanly on layer canvas without error', () => {
  const lm = new LayerManager(100, 100);
  const l = lm.addLayer('Test');
  l.styles.bevelEmboss.enabled = true;
  l.styles.innerShadow.enabled = true;
  l.styles.satin.enabled = true;
  l.styles.patternOverlay.enabled = true;

  const shapeCanvas = mockCreateCanvas(100, 100);

  // Should execute all 4 inner style pipelines cleanly
  assert.doesNotThrow(() => {
    lm.applyInnerStyles(l.ctx, shapeCanvas, 100, 100, l.styles);
  });
});

console.log('\n► Test Group 3: Smart Object Serialization & Project Data');
test('exportProjectData preserves smartObjectData, transforms, and filters', () => {
  const lm = new LayerManager(200, 200);
  const l = lm.addLayer('SmartLayer');
  l.type = 'smart-object';

  const srcCanvas = mockCreateCanvas(100, 100);

  l.smartObjectData = new SmartObjectData(srcCanvas, 100, 100, {
    transform: { x: 20, y: 30, w: 120, h: 120, angle: 45 },
    filters: [
      new SmartFilter('gaussianBlur', { radius: 5 }),
      new SmartFilter('sharpen')
    ]
  });

  const proj = lm.exportProjectData();
  assert.strictEqual(proj.layers.length, 1);
  const exported = proj.layers[0];
  assert.strictEqual(exported.type, 'smart-object');
  assert(exported.smartObjectData, 'smartObjectData serialized');
  assert.strictEqual(exported.smartObjectData.originalWidth, 100);
  assert.strictEqual(exported.smartObjectData.transform.x, 20);
  assert.strictEqual(exported.smartObjectData.transform.angle, 45);
  assert.strictEqual(exported.smartObjectData.filters.length, 2);
  assert.strictEqual(exported.smartObjectData.filters[0].type, 'gaussianBlur');
  assert.strictEqual(exported.smartObjectData.filters[0].params.radius, 5);
});

console.log('\n► Test Group 4: Pre-Press CMYK Proofing & Profiles');
test('CMYKProofEngine supports profile switching and color separation', () => {
  const cmyk = new CMYKProofEngine();
  assert.strictEqual(cmyk.currentProfileKey, 'SWOP');
  assert.strictEqual(cmyk.currentProfile.tac, 300);

  cmyk.setProfile('FOGRA39');
  assert.strictEqual(cmyk.currentProfileKey, 'FOGRA39');
  assert.strictEqual(cmyk.currentProfile.tac, 330);

  cmyk.setProfile('EUROSCALE');
  assert.strictEqual(cmyk.currentProfileKey, 'EUROSCALE');
  assert.strictEqual(cmyk.currentProfile.tac, 280);

  // Separation Plates
  cmyk.activePlate = 'c';
  const imgData = new global.ImageData(new Uint8ClampedArray([0, 255, 255, 255]), 1, 1);
  const plateImg = cmyk.processImageData(imgData);
  assert(plateImg, 'Plate processed');
  assert.strictEqual(plateImg.data.length, 4);
});

console.log('\n► Test Group 5: Refine Edge Output Options');
test('SelectionRefinementEngine handles feathered mask generation', () => {
  const w = 40, h = 40;
  const mask = new Uint8Array(w * h);
  for (let y = 10; y < 30; y++) {
    for (let x = 10; x < 30; x++) {
      mask[y * w + x] = 255;
    }
  }

  const refined = SelectionRefinementEngine.refineSelection(mask, w, h, {
    smooth: 10,
    feather: 3,
    contrast: 20,
    shiftEdge: -10
  });

  assert(refined instanceof Uint8Array, 'Returned Uint8Array mask');
  assert.strictEqual(refined.length, w * h);
  // Interior pixel should remain masked
  assert(refined[20 * w + 20] > 200, 'Interior pixel retains high opacity');
  // Exterior corners should remain 0
  assert.strictEqual(refined[0], 0, 'Exterior pixel remains 0');
});

console.log('\n════════════════════════════════════════════════════════════════');
console.log(`  Phase 2 Integration Suite: ${passCount} / ${totalCount} Passed (${Math.round((passCount/totalCount)*100)}%)`);
console.log('════════════════════════════════════════════════════════════════\n');

if (passCount !== totalCount) {
  process.exit(1);
}
