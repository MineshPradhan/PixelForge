// ══════════════════════════════════════════════════════════════════════
// PixelForge Studio — Phase 2 Verification Suite
// (Smart Objects, Smart Selection, CMYK Proofing & Gamut Warning)
// ══════════════════════════════════════════════════════════════════════

const assert = require('assert');

// Setup Headless Node Mock Environment
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

global.Utils = {
  createCanvas(w, h) {
    return {
      width: w,
      height: h,
      getContext: () => ({
        canvas: { width: w, height: h },
        save() {},
        restore() {},
        translate() {},
        rotate() {},
        clearRect() {},
        drawImage() {},
        putImageData() {},
        getImageData: (x, y, gw, gh) => {
          const img = new global.ImageData(gw, gh);
          // Default white/gray background
          for (let i = 0; i < img.data.length; i += 4) {
            img.data[i] = 240;
            img.data[i + 1] = 240;
            img.data[i + 2] = 240;
            img.data[i + 3] = 255;
          }
          // Center dark circle as subject / edge
          const cx = Math.floor(gw / 2);
          const cy = Math.floor(gh / 2);
          const r = Math.floor(Math.min(gw, gh) / 4);
          for (let cyIdx = 0; cyIdx < gh; cyIdx++) {
            for (let cxIdx = 0; cxIdx < gw; cxIdx++) {
              const dist = Math.hypot(cxIdx - cx, cyIdx - cy);
              if (dist <= r) {
                const idx = (cyIdx * gw + cxIdx) * 4;
                img.data[idx] = 20;
                img.data[idx + 1] = 50;
                img.data[idx + 2] = 180;
                img.data[idx + 3] = 255;
              }
            }
          }
          return img;
        }
      })
    };
  }
};

// Require our modules
const { MagneticLassoEngine, SmartSubjectDetection, SelectionRefinementEngine } = require('./js/smart-selection.js');
const { CMYKProofEngine } = require('./js/cmyk-proof.js');
const { SmartFilter, SmartObjectData, SmartObjectManager } = require('./js/smart-objects.js');

let passCount = 0;
let totalCount = 0;

function test(description, fn) {
  totalCount++;
  try {
    fn();
    console.log(`  ✓ ${description}`);
    passCount++;
  } catch (err) {
    console.error(`  ✕ ${description}`);
    console.error(`    ${err.message}`);
  }
}

console.log('════════════════════════════════════════════════════════════════');
console.log('  PixelForge Studio — Phase 2 Verification Suite');
console.log('════════════════════════════════════════════════════════════════\n');

// ── Test Group 1: Magnetic Lasso & Edge Snapping ──
console.log('► Test Group 1: Magnetic Lasso & Edge Snapping');

test('MagneticLassoEngine computes normalized Sobel edge gradients', () => {
  const engine = new MagneticLassoEngine();
  const canvas = Utils.createCanvas(100, 100);
  const ctx = canvas.getContext('2d');
  const edgeMap = engine.computeEdgeMap(ctx, 100, 100);

  assert.strictEqual(edgeMap.length, 100 * 100, 'Edge map should match pixel dimensions');
  assert.ok(edgeMap.some(v => v > 0.5), 'Edge map should detect sharp contrast circle boundary');
});

test('MagneticLassoEngine snaps cursor coordinate to strongest local edge', () => {
  const engine = new MagneticLassoEngine();
  const canvas = Utils.createCanvas(100, 100);
  const ctx = canvas.getContext('2d');
  engine.computeEdgeMap(ctx, 100, 100);

  // Near the circle boundary at x=50, y=25 (center is 50, 50, radius is 25)
  const snapped = engine.findSnapPoint(50, 27, 8);
  assert.strictEqual(snapped.snapped, true, 'Cursor near circle boundary should snap');
  assert.ok(Math.abs(snapped.y - 25) <= 2, `Snapped y should be close to 25, got ${snapped.y}`);
});

test('MagneticLassoEngine traces continuous contour path', () => {
  const engine = new MagneticLassoEngine();
  const canvas = Utils.createCanvas(100, 100);
  const ctx = canvas.getContext('2d');
  engine.computeEdgeMap(ctx, 100, 100);

  const p1 = { x: 50, y: 25 };
  const p2 = { x: 75, y: 50 };
  const path = engine.traceContour(p1, p2, 8);

  assert.ok(path.length >= 2, 'Contour path should contain intermediate anchor points');
  assert.strictEqual(path[0].x, 50);
  assert.strictEqual(path[path.length - 1].x, 75);
});

// ── Test Group 2: One-Click Smart Subject Detection ──
console.log('\n► Test Group 2: Smart Subject Detection');

test('SmartSubjectDetection segments dominant foreground subject using saliency', () => {
  const canvas = Utils.createCanvas(120, 120);
  const ctx = canvas.getContext('2d');
  const res = SmartSubjectDetection.detectSubject(ctx, 120, 120);

  assert.ok(res.mask instanceof Uint8Array, 'Returns mask Uint8Array');
  assert.strictEqual(res.mask.length, 120 * 120);
  assert.ok(res.selectedCount > 100, 'Detected foreground subject should have positive pixel count');
  assert.ok(res.bounds.width > 20 && res.bounds.height > 20, 'Bounding box captures subject');
});

// ── Test Group 3: Selection Refinement Engine (Select and Mask) ──
console.log('\n► Test Group 3: Selection Refinement Engine');

test('SelectionRefinementEngine applies Smooth, Feather, and Shift Edge', () => {
  const w = 50, h = 50;
  const rawMask = new Uint8Array(w * h);
  // Center 20x20 square
  for (let y = 15; y < 35; y++) {
    for (let x = 15; x < 35; x++) {
      rawMask[y * w + x] = 255;
    }
  }

  // Shift Edge + Expand
  const expanded = SelectionRefinementEngine.refineSelection(rawMask, w, h, { shiftEdge: 50 });
  const countRaw = rawMask.filter(v => v === 255).length;
  const countExpanded = expanded.filter(v => v === 255).length;
  assert.ok(countExpanded > countRaw, 'Expanded mask should contain more pixels');

  // Shift Edge - Contract
  const contracted = SelectionRefinementEngine.refineSelection(rawMask, w, h, { shiftEdge: -50 });
  const countContracted = contracted.filter(v => v === 255).length;
  assert.ok(countContracted < countRaw, 'Contracted mask should contain fewer pixels');

  // Feather softens edges (produces intermediate alpha values between 0 and 255)
  const feathered = SelectionRefinementEngine.refineSelection(rawMask, w, h, { feather: 3 });
  const intermediateValues = feathered.filter(v => v > 10 && v < 240).length;
  assert.ok(intermediateValues > 0, 'Feathering should create smooth anti-aliased gradient falloff');
});

// ── Test Group 4: CMYK Pre-Press Soft-Proofing & Gamut Warning ──
console.log('\n► Test Group 4: CMYK Pre-Press Soft-Proofing & Gamut Warning');

test('CMYKProofEngine converts RGB to CMYK with Total Area Coverage (TAC) clamping', () => {
  const cmyk = new CMYKProofEngine();
  // Pure Red (255, 0, 0)
  const res = cmyk.rgbToCmyk(255, 0, 0);
  assert.ok(res.m > 80, 'Red has high magenta component');
  assert.ok(res.y > 80, 'Red has high yellow component');
  assert.ok(res.c < 10, 'Red has low cyan component');

  // TAC limit check
  const total = res.c + res.m + res.y + res.k;
  assert.ok(total <= cmyk.currentProfile.tac, 'Total Area Coverage must not exceed profile TAC limit');
});

test('CMYKProofEngine calculates Delta-E and identifies out-of-gamut colors', () => {
  const cmyk = new CMYKProofEngine();
  // Saturated Neon Cyan (0, 255, 255) is notoriously out of commercial CMYK print gamut
  const proofed = cmyk.cmykToRgb(cmyk.rgbToCmyk(0, 255, 255).c, cmyk.rgbToCmyk(0, 255, 255).m, cmyk.rgbToCmyk(0, 255, 255).y, cmyk.rgbToCmyk(0, 255, 255).k);
  const deltaE = cmyk.calculateDeltaE(0, 255, 255, proofed.r, proofed.g, proofed.b);

  assert.ok(deltaE >= cmyk.deltaEThreshold, `Saturated cyan should trigger out-of-gamut warning (Delta-E = ${deltaE.toFixed(2)})`);
});

test('CMYKProofEngine renders Gamut Warning overlay and Separation Plates', () => {
  const cmyk = new CMYKProofEngine();
  const testImg = new ImageData(4, 4);
  // Fill with neon out-of-gamut green (0, 255, 0)
  for (let i = 0; i < testImg.data.length; i += 4) {
    testImg.data[i] = 0;
    testImg.data[i + 1] = 255;
    testImg.data[i + 2] = 0;
    testImg.data[i + 3] = 255;
  }

  // Gamut Warning Mode
  cmyk.isGamutWarning = true;
  const processed = cmyk.processImageData(testImg);
  assert.strictEqual(processed.data[0], cmyk.warningColor.r, 'Out of gamut pixel replaced with warning color R');
  assert.strictEqual(processed.data[1], cmyk.warningColor.g, 'Out of gamut pixel replaced with warning color G');
  assert.strictEqual(processed.data[2], cmyk.warningColor.b, 'Out of gamut pixel replaced with warning color B');

  // Black (K) Plate preview
  const kPlate = cmyk.processImageData(testImg, { gamutWarning: false, softProof: false, plate: 'k' });
  assert.ok(kPlate.data[0] > 0, 'K plate renders paper tone');
});

console.log('\n════════════════════════════════════════════════════════════════');
console.log(`  Phase 2 Test Suite: ${passCount} / ${totalCount} Passed (${Math.round((passCount/totalCount)*100)}%)`);
console.log('════════════════════════════════════════════════════════════════\n');

process.exit(passCount === totalCount ? 0 : 1);
