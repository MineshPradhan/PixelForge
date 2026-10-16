const assert = require('assert');
const OpenTypeFeatureEngine = require('./js/typography-advanced.js');

console.log('🧪 Running Advanced OpenType & Variable Typography Controls test suite...\n');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ ${name}:`, err);
    failed++;
  }
}

// Test 1: OpenType Feature Tags to CSS String
test('toCssFeatureSettings converts feature tags into valid CSS font-feature-settings strings', () => {
  const css = OpenTypeFeatureEngine.toCssFeatureSettings({
    liga: true,
    dlig: true,
    smcp: true,
    tnum: true,
    calt: false
  });
  assert(css.includes('"liga" 1'));
  assert(css.includes('"dlig" 1'));
  assert(css.includes('"smcp" 1'));
  assert(css.includes('"tnum" 1'));
  assert(css.includes('"calt" 0'));
});

// Test 2: Parse CSS Feature Settings back into object
test('parseCssFeatureSettings parses CSS font-feature-settings strings into structured object', () => {
  const css = '"liga" 1, "smcp" 1, "zero" 1, "frac" 0';
  const parsed = OpenTypeFeatureEngine.parseCssFeatureSettings(css);
  assert.strictEqual(parsed.liga, true);
  assert.strictEqual(parsed.smcp, true);
  assert.strictEqual(parsed.zero, true);
  assert.strictEqual(parsed.frac, false);
});

// Test 3: Variable Font Axes to CSS String
test('toCssVariationSettings serializes variable font axes (wght, wdth, slnt, opsz)', () => {
  const css = OpenTypeFeatureEngine.toCssVariationSettings({
    wght: 750,
    wdth: 125,
    slnt: -10,
    opsz: 32
  });
  assert(css.includes('"wght" 750'));
  assert(css.includes('"wdth" 125'));
  assert(css.includes('"slnt" -10'));
  assert(css.includes('"opsz" 32'));
});

// Test 4: Parse Variable Font Axes from CSS String
test('parseCssVariationSettings parses variable font axes correctly with negative values', () => {
  const css = '"wght" 600, "wdth" 90, "slnt" -7.5';
  const parsed = OpenTypeFeatureEngine.parseCssVariationSettings(css);
  assert.strictEqual(parsed.wght, 600);
  assert.strictEqual(parsed.wdth, 90);
  assert.strictEqual(parsed.slnt, -7.5);
});

// Test 5: Multi-line Layout & Word Wrap Engine
test('layoutText handles word-wrapping, tracking, leading, and paragraph indentation', () => {
  const text = "PixelForge Studio delivers uncompromising precision.\nSecond paragraph with custom indent.";
  const layout = OpenTypeFeatureEngine.layoutText(text, {
    fontSize: 20,
    tracking: 50,
    leading: 26,
    maxWidth: 200,
    paragraphIndent: 20,
    paragraphSpacing: 10
  });

  assert(layout.lines.length >= 2, 'Should wrap into multiple lines');
  assert.strictEqual(layout.lines[0].isFirstLine, true);
  assert.strictEqual(layout.lines[0].indent, 20);
  assert(layout.totalHeight > 40);
});

// Test 6: Canvas 2D Typography Rendering Bridge
test('renderToCanvas executes character layout and tracking onto Canvas 2D context', () => {
  const drawn = [];
  const mockCtx = {
    font: '',
    fillStyle: '',
    textAlign: '',
    textBaseline: '',
    save: () => {},
    restore: () => {},
    fillText: (ch, x, y) => drawn.push({ ch, x, y }),
    measureText: (ch) => ({ width: 12 })
  };

  const layout = OpenTypeFeatureEngine.renderToCanvas(mockCtx, "PRO EXPORT", 50, 100, {
    fontSize: 24,
    tracking: 100,
    color: '#ffcc00'
  });

  assert.strictEqual(drawn.length, 10); // 'PRO EXPORT' has 10 characters
  assert.strictEqual(drawn[0].ch, 'P');
  assert.strictEqual(drawn[0].x, 50);
  assert(drawn[1].x > drawn[0].x, 'Subsequent characters must advance with tracking');
});

// Test 7: Simulated Small Caps Fallback
test('renderToCanvas handles small-caps synthesis for lowercase letters', () => {
  const fontsUsed = [];
  const charsDrawn = [];
  const mockCtx = {
    _font: '',
    get font() { return this._font; },
    set font(f) { this._font = f; fontsUsed.push(f); },
    save: () => {},
    restore: () => {},
    fillText: (ch, x, y) => charsDrawn.push(ch),
    measureText: () => ({ width: 10 })
  };

  OpenTypeFeatureEngine.renderToCanvas(mockCtx, "Title", 0, 0, {
    fontSize: 30,
    features: { smcp: true }
  });

  // 'Title' should render 'T', followed by uppercase 'I', 'T', 'L', 'E' at smaller font size
  assert.strictEqual(charsDrawn.join(''), 'TITLE');
  // At least 2 different font sizes used (full size for T, smaller for itle)
  const sizes = fontsUsed.map(f => f.match(/\d+px/)?.[0]).filter(Boolean);
  const uniqueSizes = new Set(sizes);
  assert(uniqueSizes.size >= 2, 'Small caps simulation must use scaled font sizes');
});

console.log(`\n📊 Summary: ${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
