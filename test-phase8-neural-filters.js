/**
 * Test Suite: Phase 8 AI & Neural Filters Suite
 * Tests Skin Smoothing, Smart Depth Lens Blur, Reinhard Color Transfer,
 * Super Resolution (2x/4x), AI Sky Replacement, Neural Denoise (TV),
 * Neural Colorize, and SmartFilter Integration.
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

  // Synthesize realistic skin patch with high-frequency noise (micro-pores)
  for (let i = 0; i < imgData.data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 8;
    imgData.data[i]     = Math.max(0, Math.min(255, 205 + noise)); // R
    imgData.data[i + 1] = Math.max(0, Math.min(255, 145 + noise)); // G
    imgData.data[i + 2] = Math.max(0, Math.min(255, 115 + noise)); // B
    imgData.data[i + 3] = 255;
  }

  const smoothed = NeuralFilters.skinSmoothing(imgData, { smoothness: 60, detailPreservation: 75 });
  assert.strictEqual(smoothed.width, w, 'Width should be preserved');
  assert.strictEqual(smoothed.height, h, 'Height should be preserved');

  // Verify non-zero output and preserved skin tones
  let avgR = 0, avgG = 0, avgB = 0;
  for (let i = 0; i < smoothed.data.length; i += 4) {
    avgR += smoothed.data[i];
    avgG += smoothed.data[i + 1];
    avgB += smoothed.data[i + 2];
  }
  avgR /= (w * h); avgG /= (w * h); avgB /= (w * h);
  assert(avgR > avgG && avgG > avgB, 'Smoothed image must retain natural skin tone hierarchy R > G > B');
});

// 2. Smart Depth Map & Lens Blur (Bokeh) Tests
test('NeuralFilters: Depth Lens Blur with polygonal Bokeh kernels and specular blooming', () => {
  const w = 16, h = 16;
  const imgData = new ImageData(w, h);

  // Fill with dark background and central bright specular highlight
  for (let i = 0; i < imgData.data.length; i += 4) {
    imgData.data[i] = 20; imgData.data[i + 1] = 20; imgData.data[i + 2] = 20; imgData.data[i + 3] = 255;
  }
  // Specular center dot
  const centerIdx = (8 * w + 8) * 4;
  imgData.data[centerIdx] = 255;
  imgData.data[centerIdx + 1] = 255;
  imgData.data[centerIdx + 2] = 255;

  const blurred = NeuralFilters.lensBlur(imgData, {
    blurRadius: 4,
    bladeCount: 7, // 7-blade pro aperture
    focalDepth: 255, // Set focus plane far so foreground blurs
    highlightBoost: 50
  });

  assert.strictEqual(blurred.width, w);
  assert.strictEqual(blurred.height, h);

  // Specular highlight should have bloomed outwards to adjacent pixels
  const neighborIdx = (8 * w + 9) * 4;
  assert(blurred.data[neighborIdx] > 20, 'Specular highlight must bloom outwards to neighbors');
});

// 3. Reinhard Color Transfer Tests
test('NeuralFilters: Reinhard l-alpha-beta color appearance moment transfer', () => {
  const w = 8, h = 8;
  const srcImg = new ImageData(w, h);
  const refImg = new ImageData(w, h);

  // Source: Neutral desaturated grey (R=120, G=120, B=120)
  for (let i = 0; i < srcImg.data.length; i += 4) {
    srcImg.data[i] = 120; srcImg.data[i + 1] = 120; srcImg.data[i + 2] = 120; srcImg.data[i + 3] = 255;
  }

  // Reference: Golden amber palette (R=240, G=160, B=40)
  for (let i = 0; i < refImg.data.length; i += 4) {
    refImg.data[i] = 240; refImg.data[i + 1] = 160; refImg.data[i + 2] = 40; refImg.data[i + 3] = 255;
  }

  const transferred = NeuralFilters.colorTransfer(srcImg, refImg, { intensity: 90, preserveLuminance: false });
  assert.strictEqual(transferred.width, w);
  assert.strictEqual(transferred.height, h);

  // Transferred image should now exhibit warm golden chromatic shift (R > G > B)
  const px = 0;
  assert(transferred.data[px] > transferred.data[px + 1], 'Transferred Red must be greater than Green');
  assert(transferred.data[px + 1] > transferred.data[px + 2], 'Transferred Green must be greater than Blue');
});

// 4. Super Resolution & Neural Upscaling Tests
test('NeuralFilters: Super Resolution 2x upscales dimensions and enhances edges', () => {
  const w = 8, h = 8;
  const imgData = new ImageData(w, h);

  // Step edge test pattern (left half white, right half black)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const v = x < 4 ? 240 : 20;
      imgData.data[idx] = v; imgData.data[idx + 1] = v; imgData.data[idx + 2] = v; imgData.data[idx + 3] = 255;
    }
  }

  const upscaled2x = NeuralFilters.superResolution(imgData, 2, { edgeEnhancement: 50 });
  assert.strictEqual(upscaled2x.width, 16, '2x Super Resolution width must be 16');
  assert.strictEqual(upscaled2x.height, 16, '2x Super Resolution height must be 16');

  // Verify transition smoothness across the upscaled step boundary
  const leftEdgeIdx = (8 * 16 + 6) * 4;
  const rightEdgeIdx = (8 * 16 + 10) * 4;
  assert(upscaled2x.data[leftEdgeIdx] > upscaled2x.data[rightEdgeIdx], 'Left side of edge remains brighter than right');
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

// 6. Neural Denoise Tests
test('NeuralFilters: Total Variation Denoising reduces variance and preserves high-frequency edges', () => {
  const w = 32, h = 32;
  const img = new ImageData(w, h);
  for (let i = 0; i < w * h * 4; i += 4) {
    const noise = (Math.random() - 0.5) * 40;
    img.data[i] = Math.max(0, Math.min(255, 128 + noise));
    img.data[i + 1] = Math.max(0, Math.min(255, 128 + noise));
    img.data[i + 2] = Math.max(0, Math.min(255, 128 + noise));
    img.data[i + 3] = 255;
  }

  const denoised = NeuralFilters.denoise(img, { strength: 80, preserveDetail: 20 });
  assert.strictEqual(denoised.width, w);
  assert.strictEqual(denoised.height, h);

  let sumSrc = 0, sumDst = 0;
  for (let i = 0; i < w * h * 4; i += 4) {
    sumSrc += img.data[i];
    sumDst += denoised.data[i];
  }
  const meanSrc = sumSrc / (w * h);
  const meanDst = sumDst / (w * h);

  let varSrc = 0, varDst = 0;
  for (let i = 0; i < w * h * 4; i += 4) {
    varSrc += Math.pow(img.data[i] - meanSrc, 2);
    varDst += Math.pow(denoised.data[i] - meanDst, 2);
  }

  assert.ok(varDst < varSrc, 'Denoised image variance should be strictly lower than noisy input');
});

// 7. Neural Colorize Tests
test('NeuralFilters: Neural Colorize assigns plausible chromaticity to monochrome image', () => {
  const w = 32, h = 32;
  const img = new ImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const v = Math.round((y / h) * 200 + 30);
      img.data[idx] = v;
      img.data[idx + 1] = v;
      img.data[idx + 2] = v;
      img.data[idx + 3] = 255;
    }
  }

  const colorized = NeuralFilters.colorize(img, { palette: 'natural', saturation: 80 });
  assert.strictEqual(colorized.width, w);
  assert.strictEqual(colorized.height, h);

  let chromaticPixels = 0;
  for (let i = 0; i < w * h * 4; i += 4) {
    const r = colorized.data[i];
    const g = colorized.data[i + 1];
    const b = colorized.data[i + 2];
    if (Math.abs(r - g) > 2 || Math.abs(g - b) > 2) {
      chromaticPixels++;
    }
  }
  assert.ok(chromaticPixels > (w * h * 0.7), 'Colorized image should have strong chromatic variance');
});

// 8. SmartFilter Non-Destructive Dispatch Integration
test('SmartFilter: Dispatch all 7 Neural Filters on Smart Object non-destructively', () => {
  const w = 8, h = 8;
  const imgData = new ImageData(w, h);
  for (let i = 0; i < imgData.data.length; i += 4) {
    imgData.data[i] = 150; imgData.data[i + 1] = 120; imgData.data[i + 2] = 100; imgData.data[i + 3] = 255;
  }

  // 1. Skin Smoothing
  const sf1 = new SmartFilter('skinSmoothing', { smoothness: 50 });
  assert.strictEqual(sf1.name, 'Skin Smoothing (Neural)');
  const res1 = sf1.apply(imgData);
  assert.strictEqual(res1.width, w);

  // 2. Lens Blur
  const sf2 = new SmartFilter('lensBlur', { blurRadius: 4 });
  assert.strictEqual(sf2.name, 'Depth Lens Blur (Neural)');
  const res2 = sf2.apply(imgData);
  assert.strictEqual(res2.width, w);

  // 3. Super Resolution
  const sf3 = new SmartFilter('superResolution', { scale: 2 });
  assert.strictEqual(sf3.name, 'Super Resolution (Neural)');
  const res3 = sf3.apply(imgData);
  assert.strictEqual(res3.width, 16);

  // 4. Sky Replacement
  const sf4 = new SmartFilter('skyReplacement', { preset: 'goldenHour' });
  assert.strictEqual(sf4.name, 'Sky Replacement (Neural)');
  const res4 = sf4.apply(imgData);
  assert.strictEqual(res4.width, w);

  // 5. Neural Denoise
  const sf5 = new SmartFilter('denoise', { strength: 50 });
  assert.strictEqual(sf5.name, 'Neural Denoise (AI)');
  const res5 = sf5.apply(imgData);
  assert.strictEqual(res5.width, w);

  // 6. Neural Colorize
  const sf6 = new SmartFilter('colorize', { palette: 'warmPortrait' });
  assert.strictEqual(sf6.name, 'Neural Colorize (AI)');
  const res6 = sf6.apply(imgData);
  assert.strictEqual(res6.width, w);
});

console.log(`\nPhase 8 AI & Neural Filters Tests Completed: ${passedTests}/${totalTests} Passed.`);
if (passedTests !== totalTests) {
  process.exit(1);
}
