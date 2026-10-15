// ══════════════════════════════════════════════════════════════════════
// PixelForge Studio Pro — Phase 7: Camera Raw & Photo Grading Master Filter Suite
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

const Filters = require('./js/filters.js');
global.Filters = Filters;

const { SmartFilter, SmartObjectData } = require('./js/smart-objects.js');

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
console.log('  PixelForge Studio Pro — Phase 7: Camera Raw Suite');
console.log('════════════════════════════════════════════════════════════════\n');

console.log('► Test Group 1: Neutral Pass & Exposure / Contrast Grading');

test('Camera Raw with neutral parameters (all 0) returns identical pixel values', () => {
  const w = 10, h = 10;
  const imgData = new ImageData(w, h);
  for (let i = 0; i < imgData.data.length; i += 4) {
    imgData.data[i] = 120;
    imgData.data[i + 1] = 140;
    imgData.data[i + 2] = 160;
    imgData.data[i + 3] = 255;
  }

  const out = Filters.cameraRaw(imgData, {});
  assert.strictEqual(out.data[0], 120);
  assert.strictEqual(out.data[1], 140);
  assert.strictEqual(out.data[2], 160);
  assert.strictEqual(out.data[3], 255);
});

test('Exposure parameter scales image brightness proportionally with EV stops', () => {
  const w = 4, h = 4;
  const imgData = new ImageData(w, h);
  for (let i = 0; i < imgData.data.length; i += 4) {
    imgData.data[i] = 64;
    imgData.data[i + 1] = 64;
    imgData.data[i + 2] = 64;
    imgData.data[i + 3] = 255;
  }

  // Exposure +25 = 1 stop (2x)
  const outPos = Filters.cameraRaw(imgData, { exposure: 25 });
  assert.ok(Math.abs(outPos.data[0] - 128) <= 2, `Expected ~128, got ${outPos.data[0]}`);

  // Exposure -25 = -1 stop (0.5x)
  const outNeg = Filters.cameraRaw(imgData, { exposure: -25 });
  assert.ok(Math.abs(outNeg.data[0] - 32) <= 2, `Expected ~32, got ${outNeg.data[0]}`);
});

test('Contrast parameter expands or contracts distance from midpoint 128', () => {
  const w = 2, h = 1;
  const imgData = new ImageData(w, h);
  // Pixel 0: dark (64), Pixel 1: light (192)
  imgData.data[0] = 64; imgData.data[1] = 64; imgData.data[2] = 64; imgData.data[3] = 255;
  imgData.data[4] = 192; imgData.data[5] = 192; imgData.data[6] = 192; imgData.data[7] = 255;

  const out = Filters.cameraRaw(imgData, { contrast: 30 });
  // With positive contrast, dark pixel gets darker (< 64), light pixel gets brighter (> 192)
  assert.ok(out.data[0] < 64, `Dark pixel should get darker, got ${out.data[0]}`);
  assert.ok(out.data[4] > 192, `Light pixel should get brighter, got ${out.data[4]}`);
});

console.log('\n► Test Group 2: Color Science (White Balance, Tint, Vibrance)');

test('Temperature warms or cools pixel chromatic balance (R vs B)', () => {
  const w = 2, h = 2;
  const imgData = new ImageData(w, h);
  for (let i = 0; i < imgData.data.length; i += 4) {
    imgData.data[i] = 128;
    imgData.data[i + 1] = 128;
    imgData.data[i + 2] = 128;
    imgData.data[i + 3] = 255;
  }

  // Warm temperature (+50)
  const outWarm = Filters.cameraRaw(imgData, { temperature: 50 });
  assert.ok(outWarm.data[0] > 128, `Warm R should increase, got ${outWarm.data[0]}`);
  assert.ok(outWarm.data[2] < 128, `Warm B should decrease, got ${outWarm.data[2]}`);

  // Cool temperature (-50)
  const outCool = Filters.cameraRaw(imgData, { temperature: -50 });
  assert.ok(outCool.data[0] < 128, `Cool R should decrease, got ${outCool.data[0]}`);
  assert.ok(outCool.data[2] > 128, `Cool B should increase, got ${outCool.data[2]}`);
});

test('Vibrance selectively enhances lower-saturated pixels more than saturated ones', () => {
  const w = 2, h = 1;
  const imgData = new ImageData(w, h);
  // Pixel 0: muted grey-blue (low saturation)
  imgData.data[0] = 120; imgData.data[1] = 125; imgData.data[2] = 135; imgData.data[3] = 255;
  // Pixel 1: pure vivid blue (saturated)
  imgData.data[4] = 10; imgData.data[5] = 20; imgData.data[6] = 240; imgData.data[7] = 255;

  const out = Filters.cameraRaw(imgData, { vibrance: 50 });
  
  // Low-saturation pixel should experience a larger relative saturation boost
  const origDiffMuted = imgData.data[2] - imgData.data[0]; // 15
  const newDiffMuted = out.data[2] - out.data[0];
  const mutedGain = (newDiffMuted - origDiffMuted) / origDiffMuted;

  const origDiffVivid = imgData.data[6] - imgData.data[4]; // 230
  const newDiffVivid = out.data[6] - out.data[4];
  const vividGain = (newDiffVivid - origDiffVivid) / origDiffVivid;

  assert.ok(mutedGain > vividGain, `Vibrance gain for muted (${mutedGain}) should exceed vivid (${vividGain})`);
});

console.log('\n► Test Group 3: Tone Zones (Highlights, Shadows, Whites, Blacks)');

test('Highlights adjustments target upper midtones/brights without altering shadows', () => {
  const w = 2, h = 1;
  const imgData = new ImageData(w, h);
  // Pixel 0: shadow (40), Pixel 1: highlight (200)
  imgData.data[0] = 40; imgData.data[1] = 40; imgData.data[2] = 40; imgData.data[3] = 255;
  imgData.data[4] = 200; imgData.data[5] = 200; imgData.data[6] = 200; imgData.data[7] = 255;

  const out = Filters.cameraRaw(imgData, { highlights: -50 });
  // Shadow pixel (40) is untouched (< 128)
  assert.strictEqual(out.data[0], 40, `Shadows should be unaffected by Highlights adjustment, got ${out.data[0]}`);
  // Highlight pixel (200) is attenuated (< 200)
  assert.ok(out.data[4] < 200, `Highlights should be reduced, got ${out.data[4]}`);
});

test('Shadows adjustments target deep tones without altering highlights', () => {
  const w = 2, h = 1;
  const imgData = new ImageData(w, h);
  // Pixel 0: shadow (40), Pixel 1: highlight (200)
  imgData.data[0] = 40; imgData.data[1] = 40; imgData.data[2] = 40; imgData.data[3] = 255;
  imgData.data[4] = 200; imgData.data[5] = 200; imgData.data[6] = 200; imgData.data[7] = 255;

  const out = Filters.cameraRaw(imgData, { shadows: 50 });
  // Shadow pixel (40) is boosted (> 40)
  assert.ok(out.data[0] > 40, `Shadows should be boosted, got ${out.data[0]}`);
  // Highlight pixel (200) is untouched (> 128)
  assert.strictEqual(out.data[4], 200, `Highlights should be unaffected by Shadows adjustment, got ${out.data[4]}`);
});

console.log('\n► Test Group 4: Clarity, Dehaze & Lens Vignette');

test('Clarity boosts local micro-contrast around midtone edges', () => {
  const w = 20, h = 20;
  const imgData = new ImageData(w, h);
  // Create an image with a midtone step edge
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const v = x < 10 ? 110 : 150;
      imgData.data[idx] = v;
      imgData.data[idx + 1] = v;
      imgData.data[idx + 2] = v;
      imgData.data[idx + 3] = 255;
    }
  }

  const out = Filters.cameraRaw(imgData, { clarity: 60 });
  // Midtone micro-contrast enhances edge contrast (dark side becomes darker, light side brighter)
  const edgeDark = out.data[(10 * w + 9) * 4];
  const edgeLight = out.data[(10 * w + 10) * 4];
  assert.ok(edgeDark <= 110, `Edge dark side should be emphasized <= 110, got ${edgeDark}`);
  assert.ok(edgeLight >= 150, `Edge light side should be emphasized >= 150, got ${edgeLight}`);
});

test('Dehaze removes atmospheric haze or adds atmospheric glow', () => {
  const w = 4, h = 4;
  const imgData = new ImageData(w, h);
  // Low-contrast hazy image with high dark channel (200, 200, 200)
  for (let i = 0; i < imgData.data.length; i += 4) {
    imgData.data[i] = 190;
    imgData.data[i + 1] = 190;
    imgData.data[i + 2] = 190;
    imgData.data[i + 3] = 255;
  }

  // Positive dehaze increases contrast and darkens haze
  const outDehaze = Filters.cameraRaw(imgData, { dehaze: 40 });
  assert.ok(outDehaze.data[0] < 190, `Dehaze should cut haze and recover radiance, got ${outDehaze.data[0]}`);

  // Negative dehaze adds atmospheric haze
  const outHaze = Filters.cameraRaw(imgData, { dehaze: -40 });
  assert.ok(outHaze.data[0] > 190, `Negative dehaze should add atmospheric haze, got ${outHaze.data[0]}`);
});

test('Lens Vignette darkens corners while leaving the center intact', () => {
  const w = 40, h = 40;
  const imgData = new ImageData(w, h);
  for (let i = 0; i < imgData.data.length; i += 4) {
    imgData.data[i] = 200;
    imgData.data[i + 1] = 200;
    imgData.data[i + 2] = 200;
    imgData.data[i + 3] = 255;
  }

  const out = Filters.cameraRaw(imgData, { vignette: 60 });
  const centerIdx = (20 * w + 20) * 4;
  const cornerIdx = 0; // (0, 0)

  // Center should remain unaffected (~200)
  assert.strictEqual(out.data[centerIdx], 200, 'Center pixel must remain unvignetted');
  // Corner should be noticeably darker (< 180)
  assert.ok(out.data[cornerIdx] < 180, `Corner pixel should be darkened by vignette, got ${out.data[cornerIdx]}`);
});

console.log('\n► Test Group 5: Non-Destructive Smart Filter Integration');

test('Camera Raw executes non-destructively through SmartFilter stack and preserves parameters', () => {
  const filterParams = {
    temperature: 20,
    exposure: 15,
    contrast: 25,
    highlights: -30,
    shadows: 20,
    clarity: 15,
    dehaze: 10,
    vignette: 25
  };

  const sf = new SmartFilter('cameraRaw', filterParams);
  assert.strictEqual(sf.name, 'Camera Raw Filter');
  assert.strictEqual(sf.type, 'cameraRaw');

  // Verify execution
  const w = 4, h = 4;
  const imgData = new ImageData(w, h);
  for (let i = 0; i < imgData.data.length; i += 4) {
    imgData.data[i] = 128;
    imgData.data[i + 1] = 128;
    imgData.data[i + 2] = 128;
    imgData.data[i + 3] = 255;
  }

  const result = sf.apply(imgData);
  assert.ok(result instanceof ImageData, 'SmartFilter apply must return ImageData');
  assert.notStrictEqual(result.data[0], 128, 'Camera Raw SmartFilter must grade pixel values');

  // Verify serialization round-trip
  const json = sf.toJSON();
  assert.strictEqual(json.type, 'cameraRaw');
  assert.strictEqual(json.params.temperature, 20);
  assert.strictEqual(json.params.exposure, 15);
  assert.strictEqual(json.params.contrast, 25);
  assert.strictEqual(json.params.vignette, 25);

  const restored = SmartFilter.fromJSON(json);
  assert.strictEqual(restored.name, 'Camera Raw Filter');
  assert.strictEqual(restored.params.temperature, 20);
});

console.log('\n════════════════════════════════════════════════════════════════');
console.log(`  Phase 7 Camera Raw Suite: ${passedTests} / ${totalTests} Passed (${Math.round((passedTests / totalTests) * 100)}%)`);
console.log('════════════════════════════════════════════════════════════════\n');

if (passedTests < totalTests) {
  process.exit(1);
}
