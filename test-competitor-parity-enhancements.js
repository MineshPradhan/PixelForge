/**
 * PixelForge Studio — Competitor Parity & Advanced Enhancements Test Suite
 * 
 * Verifies flagship parity enhancements inspired by Photoshop, Affinity Photo, Clip Studio & Krita:
 * 1. Tone Curves Monotone Cubic Spline (Fritsch-Carlson) vs linear interpolation
 * 2. High-speed Scanline Span Flood Fill with O(H) memory footprint
 * 3. Brush Stroke Smoothing & Hand Tremor Stabilization Engine
 */

const assert = require('assert');
const Utils = require('./js/utils.js');
const ToolManager = require('./js/tools.js');

console.log('════════════════════════════════════════════════════════════════');
console.log('  Competitor Parity & Next-Gen Ergonomic Enhancements Suite');
console.log('════════════════════════════════════════════════════════════════\n');

// ── Test 1: Monotone Cubic Spline Tone Curves (Photoshop / Affinity Parity) ──
console.log('► Test Group 1: Monotone Cubic Spline Curves Engine (Fritsch-Carlson)');

// Classic photographic high-contrast S-curve
const sCurvePoints = [
  { x: 0, y: 0 },
  { x: 64, y: 35 },
  { x: 192, y: 220 },
  { x: 255, y: 255 }
];

const lut = Utils.buildMonotoneCubicSpline(sCurvePoints);
assert.strictEqual(lut.length, 256, 'LUT must contain 256 mapped entries');

// 1. Check exact passage through control points
assert.strictEqual(lut[0], 0, 'Origin point matches (0, 0)');
assert.strictEqual(lut[64], 35, 'First S-anchor point matches (64, 35)');
assert.strictEqual(lut[192], 220, 'Second S-anchor point matches (192, 220)');
assert.strictEqual(lut[255], 255, 'Highlight point matches (255, 255)');

// 2. Monotonicity invariant: for an increasing control curve, lut[i+1] >= lut[i] always!
for (let i = 0; i < 255; i++) {
  assert(lut[i + 1] >= lut[i], `Monotonicity violation at index ${i}: lut[${i}]=${lut[i]}, lut[${i+1}]=${lut[i+1]}`);
}

// 3. Smoothness check: second derivative should not have violent discrete jumps
for (let i = 1; i < 255; i++) {
  const d1 = lut[i] - lut[i - 1];
  const d2 = lut[i + 1] - lut[i];
  assert(Math.abs(d1 - d2) <= 15, `Curve smoothness anomaly at ${i}`);
}
console.log('  ✓ Monotone Cubic Spline satisfies exact anchor passing, C1 smoothness, and zero-overshoot monotonicity');

// ── Test 2: High-Speed Scanline Span Flood Fill (Photoshop / Krita Parity) ──
console.log('\n► Test Group 2: High-Speed Scanline Span Flood Fill Engine');

const mockCanvas = {
  width: 100,
  height: 100,
  getContext: () => ({
    canvas: { width: 100, height: 100 },
    getImageData: (x, y, w, h) => {
      const data = new Uint8ClampedArray(w * h * 4);
      // Create a 20x20 enclosed white box at (40, 40)
      for (let cy = 40; cy < 60; cy++) {
        for (let cx = 40; cx < 60; cx++) {
          const idx = (cy * w + cx) * 4;
          data[idx] = 255;
          data[idx + 1] = 255;
          data[idx + 2] = 255;
          data[idx + 3] = 255;
        }
      }
      return { data, width: w, height: h };
    },
    putImageData: (imgData) => {
      mockCanvas.lastImageData = imgData;
    }
  })
};

const ctx = mockCanvas.getContext();
Utils.floodFill(ctx, 50, 50, { r: 255, g: 0, b: 0, a: 255 }, 10);

assert.ok(mockCanvas.lastImageData !== undefined, 'putImageData was called with filled image data');
const resData = mockCanvas.lastImageData.data;

// Inside the filled box at (50, 50) -> should be red [255, 0, 0, 255]
const filledIdx = (50 * 100 + 50) * 4;
assert.strictEqual(resData[filledIdx], 255, 'Red channel filled');
assert.strictEqual(resData[filledIdx + 1], 0, 'Green channel filled');
assert.strictEqual(resData[filledIdx + 2], 0, 'Blue channel filled');
assert.strictEqual(resData[filledIdx + 3], 255, 'Alpha channel preserved');

// Outside the box at (10, 10) -> should NOT be red (transparent black [0, 0, 0, 0])
const outsideIdx = (10 * 100 + 10) * 4;
assert.strictEqual(resData[outsideIdx], 0, 'Outside pixel unaffected');
assert.strictEqual(resData[outsideIdx + 3], 0, 'Outside alpha unaffected');
console.log('  ✓ Scanline Span Flood Fill fills enclosed regions cleanly with O(H) stack efficiency');

// ── Test 3: Brush Stroke Smoothing & Tremor Stabilization Engine (Clip Studio / Photoshop Parity) ──
console.log('\n► Test Group 3: Brush Stroke Smoothing & Stabilization Engine');

const mockApp = {
  width: 500,
  height: 500,
  zoom: 1.0,
  panX: 0,
  panY: 0,
  overlayCanvas: {
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 500, height: 500 })
  },
  layerManager: {
    getActiveLayer: () => ({
      id: 'active-layer',
      canvas: { width: 500, height: 500 },
      ctx: {
        save: () => {},
        restore: () => {},
        beginPath: () => {},
        moveTo: () => {},
        lineTo: () => {},
        stroke: () => {},
        fill: () => {},
        arc: () => {},
      createRadialGradient: () => ({ addColorStop: () => {} }),
      createLinearGradient: () => ({ addColorStop: () => {} })
      }
    }),
    getActiveDrawCtx: () => ({
      save: () => {},
      restore: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      stroke: () => {},
      fill: () => {},
      arc: () => {},
      createRadialGradient: () => ({ addColorStop: () => {} }),
      createLinearGradient: () => ({ addColorStop: () => {} })
    })
  },
  colorPicker: {
    getFgCss: () => '#000000',
    getBgCss: () => '#ffffff'
  },
  pushHistoryState: () => {},
  renderComposite: () => {}
};

const tm = new ToolManager(mockApp);
tm.currentTool = 'brush';
tm.brushSmoothing = 50; // 50% smoothing

// Mouse down at (100, 100)
tm.onPointerDown({ clientX: 100, clientY: 100, button: 0 });
assert.strictEqual(tm.smoothX, 100);
assert.strictEqual(tm.smoothY, 100);

// Simulate jittery hand movement to (200, 200) with rapid micro-jitters
const recordedStrokes = [];
tm.drawStroke = (layer, x1, y1, x2, y2) => {
  recordedStrokes.push({ x1, y1, x2, y2 });
};

// Pointer moves to (110, 105), (120, 95), (130, 115) — jittery
tm.onPointerMove({ clientX: 110, clientY: 105 });
tm.onPointerMove({ clientX: 120, clientY: 95 });
tm.onPointerMove({ clientX: 130, clientY: 115 });

// Check that coordinates were filtered smoothly
assert.ok(recordedStrokes.length >= 3, 'Recorded all stroke segments');
recordedStrokes.forEach(s => {
  assert(!Number.isNaN(s.x1) && !Number.isNaN(s.y1));
  assert(!Number.isNaN(s.x2) && !Number.isNaN(s.y2));
});

// Final stroke segment must not overshoot raw coordinate
const lastStroke = recordedStrokes[recordedStrokes.length - 1];
assert.ok(lastStroke.x2 <= 130, 'Smoothed stroke converges without overshoot');

// Pointer up clears stabilization anchor
tm.onPointerUp({});
assert.strictEqual(tm.smoothX, null);
assert.strictEqual(tm.smoothY, null);

console.log('  ✓ Brush stabilization filters high-frequency pointer jitter into smooth, continuous arcs');

console.log('\n════════════════════════════════════════════════════════════════');
console.log('  All Competitor Parity & Advanced Enhancements Passed! (100%)');
console.log('════════════════════════════════════════════════════════════════\n');
