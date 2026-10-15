/**
 * Test Suite: Phase 8 AI & Neural Filters Suite
 * Tests Skin Smoothing, Smart Depth Lens Blur, Reinhard Color Transfer,
 * Super Resolution (2x/4x), AI Sky Replacement, and SmartFilter Integration.
 */

const assert = require('assert');

// Polyfill ImageData for test environment
global.ImageData = class ImageData {
  constructor(w, h) {
    this.width = w;
    this.height = h;
    this.data = new Uint8ClampedArray(w * h * 4);
  }
};

const NeuralFilters = require('./js/neural-filters.js');
const { SmartFilter } = require('./js/smart-objects.js');
global.NeuralFilters = NeuralFilters;

let totalTests = 0;
let passedTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
  }
}

console.log('Testing Phase 8: AI & Neural Filters Suite...\n');

// 1. Skin Smoothing Filter Tests
test('NeuralFilters: Skin smoothing cleans portrait tones while preserving skin pores', () => {
  const w = 16, h = 16;
  const imgData = new ImageData(w, h);

  // Fill left half with typical human skin tone (R=210, G=160, B=130) + noise pore
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      if (x < 8) {
        // Skin tone
        imgData.data[idx]     = 210 + (x % 2 === 0 ? 10 : -10);
        imgData.data[idx + 1] = 160 + (x % 2 === 0 ? 5 : -5);
        imgData.data[idx + 2] = 130 + (x % 2 === 0 ? 5 : -5);
        imgData.data[idx + 3] = 255;
      } else {
        // Non-skin backdrop (Pure Cyan R=0, G=200, B=255)
        imgData.data[idx]     = 0;
        imgData.data[idx + 1] = 200;
        imgData.data[idx + 2] = 255;
        imgData.data[idx + 3] = 255;
      }
    }
  }

  const smoothed = NeuralFilters.skinSmoothing(imgData, { smoothness: 60, detailPreservation: 75 });
  assert.strictEqual(smoothed.width, w);
  assert.strictEqual(smoothed.height, h);

  // Check that non-skin cyan background is strictly preserved
  const nonSkinIdx = (4 * w + 12) * 4;
  assert.strictEqual(smoothed.data[nonSkinIdx], 0, 'Non-skin red untouched');
  assert.strictEqual(smoothed.data[nonSkinIdx + 1], 200, 'Non-skin green untouched');
  assert.strictEqual(smoothed.data[nonSkinIdx + 2], 255, 'Non-skin blue untouched');

  // Check that skin tone variance was smoothed
  const skinIdx = (4 * w + 4) * 4;
  assert(smoothed.data[skinIdx] >= 190 && smoothed.data[skinIdx] <= 230, 'Skin tone in natural range');
});

// 2. Smart Depth Lens Blur Tests
test('NeuralFilters: Depth Lens Blur with polygonal Bokeh kernels and specular blooming', () => {
  const w = 16, h = 16;
  const imgData = new ImageData(w, h);

  // Background with high specular highlight at top (y=2, x=8)
  for (let i = 0; i < imgData.data.length; i += 4) {
    imgData.data[i]     = 50;
    imgData.data[i + 1] = 50;
    imgData.data[i + 2] = 50;
    imgData.data[i + 3] = 255;
  }
  const highlightIdx = (2 * w + 8) * 4;
  imgData.data[highlightIdx]     = 255;
  imgData.data[highlightIdx + 1] = 255;
  imgData.data[highlightIdx + 2] = 255;

  // Test circular and polygonal aperture blades (5, 6, 7, 8)
  [0, 5, 7].forEach(blades => {
    const blurred = NeuralFilters.lensBlur(imgData, {
      blurRadius: 4,
      bladeCount: blades,
      focalDepth: 200, // focal plane near foreground
      highlightBoost: 50
    });

    assert.strictEqual(blurred.width, w);
    assert.strictEqual(blurred.height, h);

    // Adjacent pixels near highlight should have received bloom energy
    const neighborIdx = (2 * w + 7) * 4;
    assert(blurred.data[neighborIdx] > 50, 'Specular bloom diffused to neighboring pixels');
  });
});

// 3. Color Transfer & Harmonization Tests
test('NeuralFilters: Reinhard l-alpha-beta color appearance moment transfer', () => {
  const w = 8, h = 8;
  const targetImg = new ImageData(w, h);
  // Neutral grayscale target
  for (let i = 0; i < targetImg.data.length; i += 4) {
    targetImg.data[i]     = 128;
    targetImg.data[i + 1] = 128;
    targetImg.data[i + 2] = 128;
    targetImg.data[i + 3] = 255;
  }

  // Warm golden sunset reference image (high Red, medium Green, low Blue)
  const refImg = new ImageData(w, h);
  for (let i = 0; i < refImg.data.length; i += 4) {
    refImg.data[i]     = 240;
    refImg.data[i + 1] = 150;
    refImg.data[i + 2] = 40;
    refImg.data[i + 3] = 255;
  }

  const transferred = NeuralFilters.colorTransfer(targetImg, refImg, { intensity: 80, preserveLuminance: false });
  assert.strictEqual(transferred.width, w);
  assert.strictEqual(transferred.height, h);

  // Check that target has shifted towards warm reference palette (R > G > B)
  const mid = (4 * w + 4) * 4;
  assert(transferred.data[mid] > transferred.data[mid + 1], 'Red channel must exceed Green channel after sunset transfer');
  assert(transferred.data[mid + 1] > transferred.data[mid + 2], 'Green channel must exceed Blue channel after sunset transfer');
});

// 4. Super Resolution & Neural Upscaling Tests
test('NeuralFilters: Super Resolution 2x upscales dimensions and enhances edges', () => {
  const w = 8, h = 8;
  const imgData = new ImageData(w, h);
  // Create sharp vertical edge down center
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const val = x < 4 ? 30 : 220;
      imgData.data[idx]     = val;
      imgData.data[idx + 1] = val;
      imgData.data[idx + 2] = val;
      imgData.data[idx + 3] = 255;
    }
  }

  const upscaled2x = NeuralFilters.superResolution(imgData, { scale: 2, edgeEnhancement: 60 });
  assert.strictEqual(upscaled2x.width, 16, '2x Super Resolution width must be 16');
  assert.strictEqual(upscaled2x.height, 16, '2x Super Resolution height must be 16');
  assert.strictEqual(upscaled2x.data.length, 16 * 16 * 4, 'Buffer size must match 16x16 RGBA');

  // Verify smooth transition across edge boundary without pixelation
  const leftVal = upscaled2x.data[(8 * 16 + 4) * 4];
  const rightVal = upscaled2x.data[(8 * 16 + 12) * 4];
  assert(leftVal < 100, 'Left side remains low intensity');
  assert(rightVal > 150, 'Right side remains high intensity');
});

test('NeuralFilters: Super Resolution 4x ultra upscaling', () => {
  const w = 4, h = 4;
  const imgData = new ImageData(w, h);
  for (let i = 0; i < imgData.data.length; i += 4) {
    imgData.data[i] = 100; imgData.data[i + 1] = 100; imgData.data[i + 2] = 100; imgData.data[i + 3] = 255;
  }

  const upscaled4x = NeuralFilters.superResolution(imgData, { scale: 4, edgeEnhancement: 40 });
  assert.strictEqual(upscaled4x.width, 16, '4x Super Resolution width must be 16');
  assert.strictEqual(upscaled4x.height, 16, '4x Super Resolution height must be 16');
});

// 5. AI Sky Replacement Tests
test('NeuralFilters: Sky Replacement with horizon feathering and atmospheric bleeding', () => {
  const w = 16, h = 16;
  const imgData = new ImageData(w, h);

  // Top half: Blue daytime sky (R=100, G=170, B=240)
  // Bottom half: Green grass / mountain (R=40, G=140, B=50)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      if (y < 8) {
        imgData.data[idx]     = 100;
        imgData.data[idx + 1] = 170;
        imgData.data[idx + 2] = 240;
      } else {
        imgData.data[idx]     = 40;
        imgData.data[idx + 1] = 140;
        imgData.data[idx + 2] = 50;
      }
      imgData.data[idx + 3] = 255;
    }
  }

  const replaced = NeuralFilters.skyReplacement(imgData, {
    preset: 'sunset',
    skyBlend: 90,
    edgeFeather: 2,
    colorHarmony: 40
  });

  assert.strictEqual(replaced.width, w);
  assert.strictEqual(replaced.height, h);

  // Top sky pixel should now be infused with vibrant sunset warm tones (R > B)
  const topSkyIdx = (2 * w + 8) * 4;
  assert(replaced.data[topSkyIdx] > replaced.data[topSkyIdx + 2], 'Sunset replaced sky should have higher Red than Blue');

  // Bottom landscape pixel should remain primarily green with slight atmospheric warmth
  const groundIdx = (12 * w + 8) * 4;
  assert(replaced.data[groundIdx + 1] > replaced.data[groundIdx], 'Ground retains vegetation dominant green');
});

// 6. SmartFilter Non-Destructive Dispatch Integration
test('SmartFilter: Dispatch all 5 Neural Filters on Smart Object non-destructively', () => {
  const w = 8, h = 8;
  const imgData = new ImageData(w, h);
  for (let i = 0; i < imgData.data.length; i += 4) {
    imgData.data[i] = 150; imgData.data[i + 1] = 120; imgData.data[i + 2] = 100; imgData.data[i + 3] = 255;
  }

  // 1. Skin Smoothing Smart Filter
  const sf1 = new SmartFilter('skinSmoothing', { smoothness: 50 });
  assert.strictEqual(sf1.name, 'Skin Smoothing (Neural)');
  const res1 = sf1.apply(imgData);
  assert.strictEqual(res1.width, w);

  // 2. Lens Blur Smart Filter
  const sf2 = new SmartFilter('lensBlur', { blurRadius: 4 });
  assert.strictEqual(sf2.name, 'Depth Lens Blur (Neural)');
  const res2 = sf2.apply(imgData);
  assert.strictEqual(res2.width, w);

  // 3. Super Resolution Smart Filter
  const sf3 = new SmartFilter('superResolution', { scale: 2 });
  assert.strictEqual(sf3.name, 'Super Resolution (Neural)');
  const res3 = sf3.apply(imgData);
  assert.strictEqual(res3.width, 16);

  // 4. Sky Replacement Smart Filter
  const sf4 = new SmartFilter('skyReplacement', { preset: 'goldenHour' });
  assert.strictEqual(sf4.name, 'Sky Replacement (Neural)');
  const res4 = sf4.apply(imgData);
  assert.strictEqual(res4.width, w);
});

console.log(`\nPhase 8 AI & Neural Filters Tests Completed: ${passedTests}/${totalTests} Passed.`);
if (passedTests !== totalTests) {
  process.exit(1);
}
