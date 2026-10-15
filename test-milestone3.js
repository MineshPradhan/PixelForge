/**
 * PixelForge Studio — Milestone 3 Automated Verification Test Suite
 * Validates the Dynamic Typography Engine:
 *  - Non-rasterized vector text layers
 *  - Parametric text styling (family, size, weight, leading, tracking, color, align)
 *  - Typographic effects (all-caps, small-caps, superscript, subscript, underline, strikethrough)
 *  - Multiline layout and tracking measurement
 *  - Non-destructive vector editing vs. bitmap rasterization
 *  - Project serialization (.pforge) and History snapshot undo/redo
 */

const assert = require('assert');

// ── Mock DOM & HTML5 Canvas Context for Headless Node.js ──
function createMockCanvas(width, height) {
  const recordedCalls = [];
  const ctx = {
    canvas: null,
    width,
    height,
    saveCalls: 0,
    restoreCalls: 0,
    font: '10px sans-serif',
    fillStyle: '#000000',
    strokeStyle: '#000000',
    lineWidth: 1,
    textBaseline: 'alphabetic',
    textAlign: 'start',
    globalAlpha: 1.0,
    globalCompositeOperation: 'source-over',
    renderedTexts: [],
    drawnLines: [],
    save() {
      this.saveCalls++;
      recordedCalls.push({ type: 'save' });
    },
    restore() {
      this.restoreCalls++;
      recordedCalls.push({ type: 'restore' });
    },
    clearRect(x, y, w, h) {
      recordedCalls.push({ type: 'clearRect', x, y, w, h });
    },
    fillRect(x, y, w, h) {
      recordedCalls.push({ type: 'fillRect', x, y, w, h, fillStyle: this.fillStyle });
    },
    beginPath() {
      recordedCalls.push({ type: 'beginPath' });
    },
    moveTo(x, y) {
      recordedCalls.push({ type: 'moveTo', x, y });
    },
    lineTo(x, y) {
      recordedCalls.push({ type: 'lineTo', x, y });
    },
    stroke() {
      recordedCalls.push({
        type: 'stroke',
        strokeStyle: this.strokeStyle,
        lineWidth: this.lineWidth
      });
      // Record lines drawn
      const moves = recordedCalls.filter(c => c.type === 'moveTo');
      const lines = recordedCalls.filter(c => c.type === 'lineTo');
      if (moves.length > 0 && lines.length > 0) {
        this.drawnLines.push({
          from: moves[moves.length - 1],
          to: lines[lines.length - 1],
          color: this.strokeStyle
        });
      }
    },
    fillText(text, x, y) {
      const call = {
        text,
        x,
        y,
        font: this.font,
        fillStyle: this.fillStyle
      };
      recordedCalls.push({ type: 'fillText', ...call });
      this.renderedTexts.push(call);
    },
    measureText(text) {
      // Predictable mock measurement: 8px per character at default size
      const sizeMatch = (this.font || '').match(/(\d+)px/);
      const fontSize = sizeMatch ? parseInt(sizeMatch[1], 10) : 16;
      const charWidth = fontSize * 0.6;
      return {
        width: text.length * charWidth
      };
    },
    drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh) {
      recordedCalls.push({ type: 'drawImage' });
    },
    getImageData(x, y, w, h) {
      return {
        width: w,
        height: h,
        data: new Uint8ClampedArray(w * h * 4)
      };
    },
    putImageData(imgData, x, y) {
      recordedCalls.push({ type: 'putImageData', x, y });
    },
    setLineDash(dash) {},
    getCalls() { return recordedCalls; },
    clearCalls() { recordedCalls.length = 0; this.renderedTexts = []; this.drawnLines = []; }
  };

  const canvas = {
    width,
    height,
    getContext: (type) => ctx,
    toDataURL: () => 'data:image/png;base64,mockTextData'
  };
  ctx.canvas = canvas;
  return canvas;
}

// Global browser mocks
global.window = {
  Utils: {
    createCanvas: createMockCanvas,
    clamp: (v, min, max) => Math.max(min, Math.min(max, v)),
    lerp: (a, b, t) => a + (b - a) * t,
    hexToRgba: (hex, a = 1) => `rgba(0,0,0,${a})`
  }
};
global.Utils = global.window.Utils;
global.document = {
  getElementById: (id) => null,
  createElement: (tag) => ({
    tagName: tag.toUpperCase(),
    className: '',
    style: {},
    appendChild: () => {},
    addEventListener: () => {},
    classList: { add: () => {}, remove: () => {}, toggle: () => {} },
    getContext: () => createMockCanvas(36, 26).getContext('2d')
  }),
  querySelectorAll: () => []
};
global.Image = function() {
  this.onload = null;
  setTimeout(() => { if (this.onload) this.onload(); }, 5);
};

// Require PixelForge core modules
const HistoryManager = require('./js/history.js');
const LayerManager = require('./js/layers.js');

let totalTests = 0;
let passedTests = 0;

function it(desc, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✓ PASS: ${desc}`);
  } catch (err) {
    console.error(`  ✗ FAIL: ${desc}`);
    console.error(`    ${err.message}`);
  }
}

console.log('=== RUNNING MILESTONE 3 VERIFICATION SUITE ===\n');

// ─────────────────────────────────────────────────────────────
console.log('[Suite 1: Text Layer Creation & Vector Properties]');

const lm = new LayerManager(1920, 1080);

it('addTextLayer creates a layer with type "text"', () => {
  const layer = lm.addTextLayer('Hello World', 200, 300);
  assert.ok(layer, 'Layer should be created');
  assert.strictEqual(layer.type, 'text', 'Layer type must be text');
  assert.ok(layer.textParams, 'Layer must have textParams attached');
});

it('textParams contains all required typographic parameters', () => {
  const active = lm.getActiveLayer();
  const p = active.textParams;
  assert.strictEqual(p.text, 'Hello World');
  assert.strictEqual(p.x, 200);
  assert.strictEqual(p.y, 300);
  assert.strictEqual(p.fontSize, 48);
  assert.strictEqual(p.color, '#ffffff');
  assert.strictEqual(p.align, 'left');
  assert.strictEqual(p.leading, 1.25);
  assert.strictEqual(p.tracking, 0);
  assert.strictEqual(p.allCaps, false);
  assert.strictEqual(p.smallCaps, false);
  assert.strictEqual(p.underline, false);
  assert.strictEqual(p.strikethrough, false);
});

it('custom parameters override defaults on text layer creation', () => {
  const layer = lm.addTextLayer('Custom Typo', 100, 150, {
    fontFamily: 'Montserrat, sans-serif',
    fontSize: 64,
    fontWeight: 'bold',
    fontStyle: 'italic',
    color: '#ff0055',
    tracking: 4,
    leading: 1.5,
    align: 'center',
    allCaps: true,
    underline: true
  });
  const p = layer.textParams;
  assert.strictEqual(p.text, 'Custom Typo');
  assert.strictEqual(p.fontFamily, 'Montserrat, sans-serif');
  assert.strictEqual(p.fontSize, 64);
  assert.strictEqual(p.fontWeight, 'bold');
  assert.strictEqual(p.fontStyle, 'italic');
  assert.strictEqual(p.color, '#ff0055');
  assert.strictEqual(p.tracking, 4);
  assert.strictEqual(p.leading, 1.5);
  assert.strictEqual(p.align, 'center');
  assert.strictEqual(p.allCaps, true);
  assert.strictEqual(p.underline, true);
});

// ─────────────────────────────────────────────────────────────
console.log('\n[Suite 2: Multiline Typography & Metric Layout]');

it('multiline text splits across multiple line baselines using font leading', () => {
  const layer = lm.addTextLayer('Line One\nLine Two\nLine Three', 100, 200, {
    fontSize: 50,
    leading: 1.5
  });
  layer.ctx.clearCalls();
  lm.renderTextLayer(layer);

  const texts = layer.ctx.renderedTexts;
  assert.ok(texts.length > 0, 'Should render characters');

  // Verify baselines of lines: line 0 at 200, line 1 at 200 + 50*1.5 = 275, line 2 at 200 + 100*1.5 = 350
  const baselines = [...new Set(texts.map(t => t.y))].sort((a, b) => a - b);
  assert.strictEqual(baselines.length, 3, 'Should produce 3 distinct vertical baselines');
  assert.strictEqual(baselines[0], 200, 'First baseline at y=200');
  assert.strictEqual(baselines[1], 275, 'Second baseline at y=275');
  assert.strictEqual(baselines[2], 350, 'Third baseline at y=350');
});

it('tracking (letter-spacing) increases horizontal step between characters', () => {
  const layerNoTrack = lm.addTextLayer('TEST', 100, 100, { fontSize: 40, tracking: 0 });
  layerNoTrack.ctx.clearCalls();
  lm.renderTextLayer(layerNoTrack);
  const callsNoTrack = layerNoTrack.ctx.renderedTexts;

  const layerTrack = lm.addTextLayer('TEST', 100, 100, { fontSize: 40, tracking: 15 });
  layerTrack.ctx.clearCalls();
  lm.renderTextLayer(layerTrack);
  const callsTrack = layerTrack.ctx.renderedTexts;

  const diff0_1_No = callsNoTrack[1].x - callsNoTrack[0].x;
  const diff0_1_Tr = callsTrack[1].x - callsTrack[0].x;

  assert.strictEqual(diff0_1_Tr - diff0_1_No, 15, 'Character delta should expand exactly by tracking value (15px)');
});

it('align "center" offsets lineX to center around x anchor', () => {
  const layerCenter = lm.addTextLayer('ABC', 500, 100, { fontSize: 20, align: 'center', tracking: 0 });
  layerCenter.ctx.clearCalls();
  lm.renderTextLayer(layerCenter);

  // Total width of 'ABC' = 3 * (20 * 0.6) = 36px. Center alignment shifts start to 500 - 36/2 = 482px
  const startX = layerCenter.ctx.renderedTexts[0].x;
  assert.strictEqual(startX, 482, 'Center align starts at x - (width / 2)');
});

it('align "right" offsets lineX to end at x anchor', () => {
  const layerRight = lm.addTextLayer('ABC', 500, 100, { fontSize: 20, align: 'right', tracking: 0 });
  layerRight.ctx.clearCalls();
  lm.renderTextLayer(layerRight);

  // Total width of 'ABC' = 36px. Right alignment shifts start to 500 - 36 = 464px
  const startX = layerRight.ctx.renderedTexts[0].x;
  assert.strictEqual(startX, 464, 'Right align starts at x - width');
});

// ─────────────────────────────────────────────────────────────
console.log('\n[Suite 3: Character Styling & Typographic Modifiers]');

it('allCaps transforms rendered text to uppercase', () => {
  const layer = lm.addTextLayer('hello world', 50, 50, { allCaps: true });
  layer.ctx.clearCalls();
  lm.renderTextLayer(layer);

  const renderedStr = layer.ctx.renderedTexts.map(t => t.text).join('');
  assert.strictEqual(renderedStr, 'HELLO WORLD', 'Text must be converted to uppercase');
});

it('smallCaps converts lowercase letters to uppercase glyphs with scaled down font size', () => {
  const layer = lm.addTextLayer('Abc', 50, 50, { fontSize: 40, smallCaps: true });
  layer.ctx.clearCalls();
  lm.renderTextLayer(layer);

  const chars = layer.ctx.renderedTexts;
  assert.strictEqual(chars[0].text, 'A');
  assert.strictEqual(chars[1].text, 'B', 'Lowercase b should be drawn as B in smallCaps');
  assert.strictEqual(chars[2].text, 'C', 'Lowercase c should be drawn as C in smallCaps');
  assert.ok(chars[1].font.includes('32px'), 'Small cap letters scale to 80% (40 * 0.8 = 32px)');
});

it('superscript scales font and shifts baseline upward', () => {
  const layer = lm.addTextLayer('2', 50, 100, { fontSize: 40, superscript: true });
  layer.ctx.clearCalls();
  lm.renderTextLayer(layer);

  const char = layer.ctx.renderedTexts[0];
  assert.strictEqual(char.y, 100 - (40 * 0.35), 'Baseline shifted up by size * 0.35');
  assert.ok(char.font.includes('26px'), 'Superscript font size scaled to 65% (40 * 0.65 = 26px)');
});

it('subscript scales font and shifts baseline downward', () => {
  const layer = lm.addTextLayer('2', 50, 100, { fontSize: 40, subscript: true });
  layer.ctx.clearCalls();
  lm.renderTextLayer(layer);

  const char = layer.ctx.renderedTexts[0];
  assert.strictEqual(char.y, 100 + (40 * 0.2), 'Baseline shifted down by size * 0.2');
  assert.ok(char.font.includes('26px'), 'Subscript font size scaled to 65% (40 * 0.65 = 26px)');
});

it('underline draws underline vector stroke beneath baseline', () => {
  const layer = lm.addTextLayer('UNDERLINE', 100, 100, { fontSize: 30, underline: true, color: '#3b82f6' });
  layer.ctx.clearCalls();
  lm.renderTextLayer(layer);

  assert.ok(layer.ctx.drawnLines.length > 0, 'Underline line must be drawn');
  const line = layer.ctx.drawnLines[0];
  assert.strictEqual(line.from.y, 100 + 30 * 0.15, 'Underline placed below baseline');
  assert.strictEqual(line.color, '#3b82f6', 'Underline stroke inherits text color');
});

it('strikethrough draws horizontal stroke through text waistline', () => {
  const layer = lm.addTextLayer('STRIKE', 100, 100, { fontSize: 40, strikethrough: true, color: '#ef4444' });
  layer.ctx.clearCalls();
  lm.renderTextLayer(layer);

  assert.ok(layer.ctx.drawnLines.length > 0, 'Strikethrough line must be drawn');
  const line = layer.ctx.drawnLines[0];
  assert.strictEqual(line.from.y, 100 - 40 * 0.28, 'Strikethrough placed through mid-cap height');
  assert.strictEqual(line.color, '#ef4444', 'Strikethrough stroke inherits text color');
});

// ─────────────────────────────────────────────────────────────
console.log('\n[Suite 4: Dynamic Re-rendering vs. Bitmap Rasterization]');

it('modifying textParams dynamically updates rendered text on canvas', () => {
  const layer = lm.addTextLayer('Initial Text', 50, 50, { fontSize: 32 });
  layer.ctx.clearCalls();
  lm.renderTextLayer(layer);
  assert.strictEqual(layer.ctx.renderedTexts[0].text, 'I');

  // Edit in-place
  layer.textParams.text = 'Modified Vector Text';
  layer.ctx.clearCalls();
  lm.renderTextLayer(layer);
  const fullText = layer.ctx.renderedTexts.map(t => t.text).join('');
  assert.strictEqual(fullText, 'Modified Vector Text', 'Canvas instantly reflects updated text string');
});

it('rasterizeTextLayer converts layer type to "raster" and strips textParams', () => {
  const textLayer = lm.addTextLayer('To Be Rasterized', 80, 80);
  assert.strictEqual(textLayer.type, 'text');
  assert.ok(textLayer.textParams);

  const ok = lm.rasterizeTextLayer(textLayer.id);
  assert.strictEqual(ok, true, 'Rasterize should report success');
  assert.strictEqual(textLayer.type, 'raster', 'Layer type should become raster');
  assert.strictEqual(textLayer.textParams, null, 'textParams must be cleared');
});

it('calling rasterizeTextLayer on non-text layer returns false', () => {
  const rasterLayer = lm.addLayer('Normal Bitmap');
  assert.strictEqual(lm.rasterizeTextLayer(rasterLayer.id), false);
});

// ─────────────────────────────────────────────────────────────
console.log('\n[Suite 5: Serialization & History Snapshots]');

it('history manager snapshots preserve textParams for undo/redo', () => {
  const history = new HistoryManager();
  const testLayer = lm.addTextLayer('Snapshot 1', 100, 100, { fontSize: 36, color: '#00ff00' });

  // Push Step 1
  history.push('Step 1: Text Created', lm.layers);

  // Edit text
  testLayer.textParams.text = 'Snapshot 2';
  testLayer.textParams.fontSize = 72;
  history.push('Step 2: Text Scaled', lm.layers);

  assert.strictEqual(history.steps.length, 2);
  const step1Layer = history.steps[0].layers.find(l => l.id === testLayer.id);
  const step2Layer = history.steps[1].layers.find(l => l.id === testLayer.id);

  assert.strictEqual(step1Layer.textParams.text, 'Snapshot 1');
  assert.strictEqual(step1Layer.textParams.fontSize, 36);
  assert.strictEqual(step2Layer.textParams.text, 'Snapshot 2');
  assert.strictEqual(step2Layer.textParams.fontSize, 72);
});

it('restoreFromSnapshot reconstructs dynamic text layer and textParams', async () => {
  const history = new HistoryManager();
  const tLayer = lm.addTextLayer('Undoable Text', 120, 140, {
    fontFamily: 'Georgia, serif',
    fontSize: 55,
    tracking: 8
  });

  const snapshot = history.createLayerSnapshot(lm.layers);
  const newLm = new LayerManager(1920, 1080);
  await newLm.restoreFromSnapshot(snapshot);

  const restored = newLm.layers.find(l => l.id === tLayer.id);
  assert.ok(restored, 'Restored text layer should exist');
  assert.strictEqual(restored.type, 'text');
  assert.ok(restored.textParams);
  assert.strictEqual(restored.textParams.text, 'Undoable Text');
  assert.strictEqual(restored.textParams.fontFamily, 'Georgia, serif');
  assert.strictEqual(restored.textParams.fontSize, 55);
  assert.strictEqual(restored.textParams.tracking, 8);
});

it('exportProjectData and importProjectData serialize textParams', async () => {
  const pData = lm.exportProjectData();
  assert.ok(pData.layers.some(l => l.type === 'text' && l.textParams && l.textParams.text === 'Undoable Text'));

  const cloneLm = new LayerManager(1920, 1080);
  await cloneLm.importProjectData(pData);

  const importedTextLayer = cloneLm.layers.find(l => l.textParams && l.textParams.text === 'Undoable Text');
  assert.ok(importedTextLayer, 'Imported text layer should exist');
  assert.strictEqual(importedTextLayer.type, 'text');
  assert.strictEqual(importedTextLayer.textParams.fontSize, 55);
});

// ─────────────────────────────────────────────────────────────
console.log('\n========================================');
console.log(`TOTAL TESTS: ${totalTests}`);
console.log(`PASSED: ${passedTests}`);
console.log(`FAILED: ${totalTests - passedTests}`);
console.log('========================================');

if (totalTests === passedTests) {
  console.log('ALL MILESTONE 3 TESTS PASSED PERFECTLY!\n');
  process.exit(0);
} else {
  console.error('SOME MILESTONE 3 TESTS FAILED!\n');
  process.exit(1);
}
