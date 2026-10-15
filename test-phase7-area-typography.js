// ══════════════════════════════════════════════════════════════════════
// PixelForge Studio Pro — Phase 7: Area Typography & Paragraph Layout Suite
// ══════════════════════════════════════════════════════════════════════

const assert = require('assert');

// ── Headless DOM & Canvas Mock Environment ──
global.ImageData = class ImageData {
  constructor(arg1, arg2, arg3) {
    if (typeof arg1 === 'number') {
      this.width = arg1;
      this.height = arg2;
      this.data = new Uint8ClampedArray(arg1 * arg2 * 4);
    } else {
      this.data = arg1;
      this.width = arg2;
      this.height = arg3;
    }
  }
};

global.window = global;
global.document = {
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => []
};

class MockCanvas {
  constructor(w = 800, h = 600) {
    this.width = w;
    this.height = h;
    this.ctx = new MockContext2D(this);
  }
  getContext(type) { return this.ctx; }
  toDataURL() { return 'data:image/png;base64,MOCK_DATA'; }
}

class MockContext2D {
  constructor(canvas) {
    this.canvas = canvas;
    this.ops = [];
    this.fillStyle = '#000000';
    this.strokeStyle = '#000000';
    this.lineWidth = 1;
    this.globalAlpha = 1.0;
    this.globalCompositeOperation = 'source-over';
    this.font = '16px sans-serif';
    this.textAlign = 'left';
    this.textBaseline = 'alphabetic';
    this.fills = [];
  }
  save() { this.ops.push(['save']); }
  restore() { this.ops.push(['restore']); }
  beginPath() { this.ops.push(['beginPath']); }
  closePath() { this.ops.push(['closePath']); }
  moveTo(x, y) { this.ops.push(['moveTo', x, y]); }
  lineTo(x, y) { this.ops.push(['lineTo', x, y]); }
  stroke() { this.ops.push(['stroke']); }
  fill() { this.ops.push(['fill']); }
  clearRect(x, y, w, h) { this.ops.push(['clearRect', x, y, w, h]); }
  fillRect(x, y, w, h) { this.ops.push(['fillRect', x, y, w, h]); }
  drawImage() { this.ops.push(['drawImage']); }
  translate(x, y) { this.ops.push(['translate', x, y]); }
  rotate(angle) { this.ops.push(['rotate', angle]); }
  scale(sx, sy) { this.ops.push(['scale', sx, sy]); }
  measureText(str) {
    // Predictable width: 10px per character, 6px for spaces
    return { width: (str === ' ' ? 6 : str.length * 10) };
  }
  fillText(text, x, y) {
    this.ops.push(['fillText', text, x, y]);
    this.fills.push({ text, x, y });
  }
  getImageData(x, y, w, h) {
    return new ImageData(w, h);
  }
  putImageData() {}
}

const Utils = require('./js/utils.js');
global.Utils = Utils;
Utils.createCanvas = (w, h) => new MockCanvas(w, h);

const { LayerManager } = require('./js/layers.js');

let passedTests = 0;
let totalTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(err);
  }
}

console.log('\n════════════════════════════════════════════════════════════════');
console.log('  PixelForge Studio Pro — Phase 7: Area Typography Suite');
console.log('════════════════════════════════════════════════════════════════\n');

console.log('► Test Group 1: Point Text vs. Area Type Auto-Wrapping');

test('Point text mode (boxWidth = 0) renders one visual line per paragraph with standard coordinates', () => {
  const lm = new LayerManager(800, 600);
  const layer = lm.addTextLayer('Hello World', 50, 100, {
    fontSize: 20,
    boxWidth: 0,
    tracking: 0
  });

  assert.strictEqual(layer.type, 'text');
  assert.strictEqual(layer.textParams.boxWidth, 0);

  // In MockContext2D, fills recorded should have the full string rendered at x = 50, y = 100
  const fills = layer.ctx.fills;
  assert.ok(fills.length > 0, 'Fills should be recorded');
  const renderedChars = fills.map(f => f.text).join('');
  assert.strictEqual(renderedChars, 'Hello World');
  assert.strictEqual(fills[0].x, 50);
  assert.strictEqual(fills[0].y, 100);
});

test('Area Type mode (boxWidth > 0) wraps long paragraphs across multiple lines within bounding box', () => {
  const lm = new LayerManager(800, 600);
  // 'The quick brown fox jumps over the lazy dog' -> 43 chars ~ 430px wide
  // With boxWidth = 150, it must wrap into at least 3-4 lines
  const text = 'The quick brown fox jumps over the lazy dog';
  const layer = lm.addTextLayer(text, 20, 40, {
    fontSize: 16,
    boxWidth: 150,
    boxHeight: 400,
    leading: 1.5,
    tracking: 0
  });

  const fills = layer.ctx.fills;
  assert.ok(fills.length > 0, 'Should render characters');
  
  // Find distinct Y coordinates representing wrapped lines
  const yCoordinates = [...new Set(fills.map(f => f.y))];
  assert.ok(yCoordinates.length >= 3, `Expected at least 3 wrapped lines, got ${yCoordinates.length}`);
  
  // Check that all words are present across wrapped lines
  const fullRendered = fills.map(f => f.text).join('').replace(/\s+/g, ' ').trim();
  const words = text.split(' ');
  words.forEach(w => {
    assert.ok(fullRendered.includes(w), `Rendered text must contain word: ${w}`);
  });
});

console.log('\n► Test Group 2: Margins, First Line Indent & Paragraph Spacing');

test('First Line Indent offsets the first line of each paragraph relative to subsequent lines', () => {
  const lm = new LayerManager(800, 600);
  const text = 'First line starts here and wraps to next line properly.';
  const layer = lm.addTextLayer(text, 10, 50, {
    fontSize: 16,
    boxWidth: 200,
    firstLineIndent: 30, // 30px indent on first line
    leftIndent: 10,      // 10px base left indent
    align: 'left'
  });

  const fills = layer.ctx.fills;
  const yCoords = [...new Set(fills.map(f => f.y))];
  assert.ok(yCoords.length >= 2, 'Should wrap into at least 2 lines');

  // First line should start at x = p.x + leftIndent + firstLineIndent = 10 + 10 + 30 = 50
  const firstLineFirstChar = fills.find(f => f.y === yCoords[0]);
  assert.strictEqual(firstLineFirstChar.x, 50, `First line start X should be 50, got ${firstLineFirstChar.x}`);

  // Second line should start at x = p.x + leftIndent = 10 + 10 = 20
  const secondLineFirstChar = fills.find(f => f.y === yCoords[1]);
  assert.strictEqual(secondLineFirstChar.x, 20, `Second line start X should be 20, got ${secondLineFirstChar.x}`);
});

test('Paragraph vertical spacing (spaceBefore and spaceAfter) separates multi-paragraph text', () => {
  const lm = new LayerManager(800, 600);
  const text = 'Paragraph One\nParagraph Two';
  const fontSize = 20;
  const leading = 1.25 * fontSize; // 25px
  const spaceAfter = 15;
  const spaceBefore = 5;

  const layer = lm.addTextLayer(text, 0, 50, {
    fontSize,
    boxWidth: 400,
    spaceBefore,
    spaceAfter,
    leading: 1.25
  });

  const fills = layer.ctx.fills;
  const yCoords = [...new Set(fills.map(f => f.y))];
  assert.strictEqual(yCoords.length, 2, 'Should have 2 lines for 2 single-line paragraphs');

  // Gap between line 1 and line 2 should include leading + spaceAfter + spaceBefore
  const expectedGap = leading + spaceAfter + spaceBefore;
  const actualGap = yCoords[1] - yCoords[0];
  assert.strictEqual(actualGap, expectedGap, `Vertical gap should be ${expectedGap}, got ${actualGap}`);
});

console.log('\n► Test Group 3: Paragraph Justification Suite');

test('Justify-left distributes slack space evenly between words, but leaves the last line left-aligned', () => {
  const lm = new LayerManager(800, 600);
  // Two-line paragraph
  const text = 'Alpha beta gamma delta epsilon zeta eta';
  const layer = lm.addTextLayer(text, 0, 50, {
    fontSize: 16,
    boxWidth: 220,
    align: 'justify-left'
  });

  const fills = layer.ctx.fills;
  const yCoords = [...new Set(fills.map(f => f.y))];
  assert.ok(yCoords.length >= 2, 'Should wrap');

  // The first line should fill the width up to boxWidth (220)
  const line1Fills = fills.filter(f => f.y === yCoords[0]);
  const lastCharLine1 = line1Fills[line1Fills.length - 1];
  // Last char end = x + width (10px)
  const line1End = lastCharLine1.x + 10;
  assert.strictEqual(line1End, 220, `Justified line 1 should expand precisely to boxWidth 220, got ${line1End}`);

  // The last line should start at left margin (x = 0) without expanding
  const lineLastFills = fills.filter(f => f.y === yCoords[yCoords.length - 1]);
  assert.strictEqual(lineLastFills[0].x, 0, 'Last line of justify-left should be left-aligned at x = 0');
});

test('Justify-all justifies every line including the final line of the paragraph', () => {
  const lm = new LayerManager(800, 600);
  const text = 'One two three four five six';
  const layer = lm.addTextLayer(text, 0, 50, {
    fontSize: 16,
    boxWidth: 200,
    align: 'justify-all'
  });

  const fills = layer.ctx.fills;
  const yCoords = [...new Set(fills.map(f => f.y))];
  assert.ok(yCoords.length >= 2, 'Should wrap');

  // Both first and last line must expand to 200px
  const lastLineY = yCoords[yCoords.length - 1];
  const lastLineFills = fills.filter(f => f.y === lastLineY);
  const lastChar = lastLineFills[lastLineFills.length - 1];
  const lastLineEnd = lastChar.x + 10;
  assert.strictEqual(lastLineEnd, 200, `Last line of justify-all should expand to boxWidth 200, got ${lastLineEnd}`);
});

test('Justify-center and Justify-right align the last line to center and right respectively', () => {
  const lm = new LayerManager(800, 600);
  const text = 'Alpha beta gamma delta epsilon';
  
  // Justify-center
  const layerCenter = lm.addTextLayer(text, 0, 50, {
    fontSize: 16,
    boxWidth: 200,
    align: 'justify-center'
  });
  const yCenter = [...new Set(layerCenter.ctx.fills.map(f => f.y))];
  const lastLineCenter = layerCenter.ctx.fills.filter(f => f.y === yCenter[yCenter.length - 1]);
  const startXCenter = lastLineCenter[0].x;
  assert.ok(startXCenter > 0, `Last line in justify-center should be indented toward center, got ${startXCenter}`);

  // Justify-right
  const layerRight = lm.addTextLayer(text, 0, 50, {
    fontSize: 16,
    boxWidth: 200,
    align: 'justify-right'
  });
  const yRight = [...new Set(layerRight.ctx.fills.map(f => f.y))];
  const lastLineRight = layerRight.ctx.fills.filter(f => f.y === yRight[yRight.length - 1]);
  const lastCharRight = lastLineRight[lastLineRight.length - 1];
  const endXRight = lastCharRight.x + 10;
  assert.strictEqual(endXRight, 200, `Last line in justify-right should end at boxWidth 200, got ${endXRight}`);
});

console.log('\n► Test Group 4: Serialization & Round-Trip Persistence');

test('Area Typography parameters serialize to JSON and restore completely', () => {
  const lm = new LayerManager(800, 600);
  lm.addTextLayer('Sample Area Text', 30, 60, {
    boxWidth: 350,
    boxHeight: 250,
    firstLineIndent: 24,
    leftIndent: 12,
    rightIndent: 14,
    spaceBefore: 8,
    spaceAfter: 16,
    align: 'justify-left'
  });

  const projectData = lm.exportProjectData();
  const layerData = projectData.layers[0];
  assert.ok(layerData.textParams, 'textParams must be saved in JSON');
  assert.strictEqual(layerData.textParams.boxWidth, 350);
  assert.strictEqual(layerData.textParams.boxHeight, 250);
  assert.strictEqual(layerData.textParams.firstLineIndent, 24);
  assert.strictEqual(layerData.textParams.leftIndent, 12);
  assert.strictEqual(layerData.textParams.rightIndent, 14);
  assert.strictEqual(layerData.textParams.spaceBefore, 8);
  assert.strictEqual(layerData.textParams.spaceAfter, 16);
  assert.strictEqual(layerData.textParams.align, 'justify-left');
});

console.log('\n════════════════════════════════════════════════════════════════');
console.log(`  Phase 7 Area Typography Suite: ${passedTests} / ${totalTests} Passed (${Math.round((passedTests / totalTests) * 100)}%)`);
console.log('════════════════════════════════════════════════════════════════\n');

if (passedTests < totalTests) {
  process.exit(1);
}
