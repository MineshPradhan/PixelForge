/**
 * PixelForge Studio Pro — Phase 4 Upgrades Verification Suite
 * Validates:
 *  1. Brush Dynamics Engine (Flow, Spacing, Scatter, Size Jitter, Angle Jitter, Tip Presets)
 *  2. Full Selection Tools Suite (Freehand Lasso, Polygonal Lasso, Color Range Selection)
 *  3. Content-Aware Fill Exemplar-based Texture Synthesis & Inpainting Engine
 */

const assert = require('assert');

// ── Node.js Headless Environment Mock ──
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

const Utils = require('./js/utils.js');
global.Utils = Utils;

// Mock canvas creation with full 2D context simulation
Utils.createCanvas = function(w, h) {
  const pixelBuffer = new Uint8ClampedArray(w * h * 4);
  const canvas = {
    width: w,
    height: h,
    style: { cursor: 'default' },
    getContext: function(type) {
      if (type === '2d') return ctx;
      return null;
    }
  };

  let _alpha = 1.0;
  let lastAssignedAlpha = 1.0;

  const ctx = {
    canvas,
    lastAssignedAlpha: 1.0,
    globalCompositeOperation: 'source-over',
    fillStyle: '#000000',
    strokeStyle: '#000000',
    lineWidth: 1,
    lineDashOffset: 0,
    setLineDash() {},
    savedStates: [],
    currentPath: [],

    save() {
      this.savedStates.push({
        alpha: _alpha,
        comp: this.globalCompositeOperation,
        fill: this.fillStyle,
        stroke: this.strokeStyle
      });
    },
    restore() {
      const s = this.savedStates.pop();
      if (s) {
        _alpha = s.alpha;
        this.globalCompositeOperation = s.comp;
        this.fillStyle = s.fill;
        this.strokeStyle = s.stroke;
      }
    },
    translate() {},
    rotate() {},
    scale() {},
    ellipse() {},
    beginPath() { this.currentPath = []; },
    closePath() {
      if (this.currentPath.length > 0) this.currentPath.push({ ...this.currentPath[0] });
    },
    moveTo(x, y) { this.currentPath.push({ x, y }); },
    lineTo(x, y) { this.currentPath.push({ x, y }); },
    arc(x, y, r) {
      const col = Utils.hexToRgb ? Utils.hexToRgb(typeof ctx.fillStyle === 'string' && ctx.fillStyle.startsWith('#') ? ctx.fillStyle : '#ffffff') : { r: 255, g: 255, b: 255 };
      const ix = Math.round(x);
      const iy = Math.round(y);
      const ir = Math.round(r);
      for (let cy = Math.max(0, iy - ir); cy <= Math.min(h - 1, iy + ir); cy++) {
        for (let cx = Math.max(0, ix - ir); cx <= Math.min(w - 1, ix + ir); cx++) {
          if ((cx - ix) ** 2 + (cy - iy) ** 2 <= ir * ir) {
            const idx = (cy * w + cx) * 4;
            pixelBuffer[idx]     = col.r;
            pixelBuffer[idx + 1] = col.g;
            pixelBuffer[idx + 2] = col.b;
            pixelBuffer[idx + 3] = Math.round(this.globalAlpha * 255);
          }
        }
      }
    },
    fill() {
      if (this.currentPath.length >= 3) {
        const pts = this.currentPath;
        let minX = w, minY = h, maxX = 0, maxY = 0;
        pts.forEach(p => {
          if (p.x < minX) minX = Math.max(0, Math.floor(p.x));
          if (p.x > maxX) maxX = Math.min(w - 1, Math.ceil(p.x));
          if (p.y < minY) minY = Math.max(0, Math.floor(p.y));
          if (p.y > maxY) maxY = Math.min(h - 1, Math.ceil(p.y));
        });

        for (let py = minY; py <= maxY; py++) {
          for (let px = minX; px <= maxX; px++) {
            let inside = false;
            for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
              const xi = pts[i].x, yi = pts[i].y;
              const xj = pts[j].x, yj = pts[j].y;
              const intersect = ((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
              if (intersect) inside = !inside;
            }
            if (inside) {
              const idx = (py * w + px) * 4;
              pixelBuffer[idx]     = 255;
              pixelBuffer[idx + 1] = 255;
              pixelBuffer[idx + 2] = 255;
              pixelBuffer[idx + 3] = 255;
            }
          }
        }
      }
    },
    stroke() {},
    strokeRect() {},
    clip() {},
    createRadialGradient() {
      return { addColorStop() {} };
    },
    clearRect(x, y, cw, ch) {
      for (let cy = y; cy < y + ch; cy++) {
        for (let cx = x; cx < x + cw; cx++) {
          if (cx >= 0 && cx < w && cy >= 0 && cy < h) {
            const idx = (cy * w + cx) * 4;
            pixelBuffer[idx + 3] = 0;
          }
        }
      }
    },
    fillRect(x, y, cw, ch) {
      const col = Utils.hexToRgb ? Utils.hexToRgb(typeof ctx.fillStyle === 'string' && ctx.fillStyle.startsWith('#') ? ctx.fillStyle : '#ffffff') : { r: 255, g: 255, b: 255 };
      for (let cy = y; cy < y + ch; cy++) {
        for (let cx = x; cx < x + cw; cx++) {
          if (cx >= 0 && cx < w && cy >= 0 && cy < h) {
            const idx = (cy * w + cx) * 4;
            pixelBuffer[idx]     = col.r;
            pixelBuffer[idx + 1] = col.g;
            pixelBuffer[idx + 2] = col.b;
            pixelBuffer[idx + 3] = Math.round(this.globalAlpha * 255);
          }
        }
      }
    },
    getImageData(x, y, sw, sh) {
      const out = new ImageData(sw, sh);
      for (let cy = 0; cy < sh; cy++) {
        for (let cx = 0; cx < sw; cx++) {
          const srcX = x + cx;
          const srcY = y + cy;
          const outIdx = (cy * sw + cx) * 4;
          if (srcX >= 0 && srcX < w && srcY >= 0 && srcY < h) {
            const srcIdx = (srcY * w + srcX) * 4;
            out.data[outIdx]     = pixelBuffer[srcIdx];
            out.data[outIdx + 1] = pixelBuffer[srcIdx + 1];
            out.data[outIdx + 2] = pixelBuffer[srcIdx + 2];
            out.data[outIdx + 3] = pixelBuffer[srcIdx + 3];
          }
        }
      }
      return out;
    },
    putImageData(imgData, x, y) {
      const sw = imgData.width;
      const sh = imgData.height;
      for (let cy = 0; cy < sh; cy++) {
        for (let cx = 0; cx < sw; cx++) {
          const dstX = x + cx;
          const dstY = y + cy;
          if (dstX >= 0 && dstX < w && dstY >= 0 && dstY < h) {
            const srcIdx = (cy * sw + cx) * 4;
            const dstIdx = (dstY * w + dstX) * 4;
            pixelBuffer[dstIdx]     = imgData.data[srcIdx];
            pixelBuffer[dstIdx + 1] = imgData.data[srcIdx + 1];
            pixelBuffer[dstIdx + 2] = imgData.data[srcIdx + 2];
            pixelBuffer[dstIdx + 3] = imgData.data[srcIdx + 3];
          }
        }
      }
    }
  };

  Object.defineProperty(ctx, 'globalAlpha', {
    get: () => _alpha,
    set: (v) => {
      _alpha = v;
      ctx.lastAssignedAlpha = v;
    }
  });

  return canvas;
};

const Filters = require('./js/filters.js');
global.Filters = Filters;

const ToolManager = require('./js/tools.js');
global.ToolManager = ToolManager;

// Mock App and LayerManager for Tool testing
function createMockApp(w = 100, h = 100) {
  const activeCanvas = Utils.createCanvas(w, h);
  const overlayCanvas = Utils.createCanvas(w, h);
  const activeLayer = {
    id: 1,
    name: 'Layer 1',
    canvas: activeCanvas,
    ctx: activeCanvas.getContext('2d'),
    width: w,
    height: h,
    opacity: 100,
    blendMode: 'normal',
    lockAlpha: false,
    isMaskActive: false
  };

  const app = {
    width: w,
    height: h,
    zoom: 1,
    panX: 0,
    panY: 0,
    historyStates: [],
    overlayCanvas,
    overlayCtx: overlayCanvas.getContext('2d'),
    colorPicker: {
      getFgCss: () => 'rgb(255, 0, 0)',
      getFgHex: () => '#ff0000',
      getBgCss: () => 'rgb(255, 255, 255)',
      getBgHex: () => '#ffffff'
    },
    layerManager: {
      getActiveLayer: () => activeLayer,
      getActiveDrawCtx: () => activeLayer.ctx,
      renderLayerStackUI: () => {}
    },
    renderComposite: () => {},
    pushHistoryState: (name) => {
      app.historyStates.push(name);
    }
  };
  return { app, activeLayer };
}

let passedTests = 0;
let totalTests = 0;

function runTest(desc, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ ${desc}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ ${desc}`);
    console.error(`    ${err.message}`);
  }
}

console.log('\n════════════════════════════════════════════════════════════════');
console.log('  PixelForge Studio — Phase 4 Upgrades Verification Suite');
console.log('════════════════════════════════════════════════════════════════\n');

// ── Test Group 1: Brush Dynamics Engine ──
console.log('► Test Group 1: Brush Dynamics Engine');

runTest('ToolManager initializes with full Photoshop brush dynamics defaults', () => {
  const { app } = createMockApp();
  const tm = new ToolManager(app);

  assert.strictEqual(tm.brushFlow, 100, 'Default flow should be 100%');
  assert.strictEqual(tm.brushSpacing, 25, 'Default spacing should be 25%');
  assert.strictEqual(tm.brushScatter, 0, 'Default scatter should be 0%');
  assert.strictEqual(tm.brushSizeJitter, 0, 'Default size jitter should be 0%');
  assert.strictEqual(tm.brushAngleJitter, 0, 'Default angle jitter should be 0%');
  assert.strictEqual(tm.brushTip, 'round', 'Default tip preset should be round');
});

runTest('Brush Flow scales stroke dab alpha proportionally', () => {
  const { app, activeLayer } = createMockApp();
  const tm = new ToolManager(app);

  tm.brushOpacity = 80;
  tm.brushFlow = 50; // Effective alpha should be (80/100) * (50/100) = 0.40
  tm.drawStroke(activeLayer, 10, 10, 30, 10);

  assert.strictEqual(Math.round(activeLayer.ctx.lastAssignedAlpha * 100), 40, 'lastAssignedAlpha should equal 0.40');
});

runTest('Brush Spacing controls stamp frequency along stroke', () => {
  const { app, activeLayer } = createMockApp();
  const tm = new ToolManager(app);

  tm.brushSize = 20;
  tm.brushSpacing = 100; // 100% spacing = step is 20px
  let arcCallCount = 0;
  const origArc = activeLayer.ctx.arc;
  activeLayer.ctx.arc = function(...args) {
    arcCallCount++;
    origArc.apply(this, args);
  };

  tm.drawStroke(activeLayer, 0, 0, 100, 0); // Distance 100px / step 20px = 5 steps + 1 = 6 dabs
  assert.strictEqual(arcCallCount, 6, 'Should stamp exactly 6 dabs with 100% spacing over 100px');
});

runTest('All 6 Brush Tip Presets execute cleanly without error', () => {
  const tips = ['round', 'soft-round', 'chisel', 'bristle', 'splatter', 'airbrush'];
  const { app, activeLayer } = createMockApp();
  const tm = new ToolManager(app);

  tips.forEach(tip => {
    tm.brushTip = tip;
    tm.drawStroke(activeLayer, 10, 10, 20, 20);
  });
  assert.ok(true, 'All 6 brush tip styles rendered smoothly');
});

// ── Test Group 2: Selection Tools Suite (Freehand, Polygonal, Color Range) ──
console.log('\n► Test Group 2: Selection Tools Suite (Freehand, Polygonal, Color Range)');

runTest('rasterizePolygonToMask computes tight bounding box and binary raster mask', () => {
  const { app } = createMockApp(100, 100);
  const tm = new ToolManager(app);

  const poly = [
    { x: 10, y: 10 },
    { x: 50, y: 10 },
    { x: 50, y: 40 },
    { x: 10, y: 40 }
  ];

  const res = tm.rasterizePolygonToMask(poly);
  assert.ok(res, 'Rasterized mask should be non-null');
  assert.strictEqual(res.x, 10, 'minX should match polygon boundary');
  assert.strictEqual(res.w >= 40 && res.w <= 41, true, 'Width should span boundary [10, 50]');
  assert.strictEqual(res.h >= 30 && res.h <= 31, true, 'Height should span boundary [10, 40]');
  assert.strictEqual(res.mask[25 * 100 + 25], 255, 'Interior coordinate must be marked selected');
});

runTest('Freehand Lasso records points and closes into path selection', () => {
  const { app } = createMockApp(100, 100);
  const tm = new ToolManager(app);

  tm.setTool('lasso-freehand');
  tm.lassoPoints = [
    { x: 20, y: 20 },
    { x: 60, y: 20 },
    { x: 60, y: 60 },
    { x: 20, y: 60 }
  ];

  tm.closeFreehandLasso();

  assert.ok(tm.selection, 'Selection should be created');
  assert.strictEqual(tm.selection.type, 'path', 'Selection type should be path');
  assert.strictEqual(tm.selection.contour.length, 4, 'Contour points preserved');
  assert.strictEqual(app.historyStates[app.historyStates.length - 1], 'Lasso Selection');
});

runTest('Polygonal Lasso handles interactive vertices and closes on contour closure', () => {
  const { app } = createMockApp(100, 100);
  const tm = new ToolManager(app);

  tm.setTool('lasso-polygon');
  tm.handlePolygonalMouseDown(15, 15);
  assert.strictEqual(tm.polyLassoActive, true, 'Lasso active on first click');
  assert.strictEqual(tm.polyLassoPoints.length, 1);

  tm.handlePolygonalMouseDown(80, 15);
  tm.handlePolygonalMouseDown(80, 80);
  assert.strictEqual(tm.polyLassoPoints.length, 3);

  // Click near start point (15, 15) to auto-close
  tm.handlePolygonalMouseDown(16, 16);
  assert.strictEqual(tm.polyLassoActive, false, 'Lasso should close and deactivate');
  assert.ok(tm.selection, 'Selection mask should be formed');
  assert.strictEqual(app.historyStates[app.historyStates.length - 1], 'Polygonal Lasso Selection');
});

runTest('Color Range Selection accurately selects target color with fuzziness', () => {
  const { app, activeLayer } = createMockApp(50, 50);
  const tm = new ToolManager(app);

  // Fill top half red, bottom half blue
  const imgData = activeLayer.ctx.getImageData(0, 0, 50, 50);
  for (let y = 0; y < 50; y++) {
    for (let x = 0; x < 50; x++) {
      const idx = (y * 50 + x) * 4;
      if (y < 25) {
        imgData.data[idx]     = 255; // Red
        imgData.data[idx + 1] = 0;
        imgData.data[idx + 2] = 0;
        imgData.data[idx + 3] = 255;
      } else {
        imgData.data[idx]     = 0;
        imgData.data[idx + 1] = 0;
        imgData.data[idx + 2] = 255; // Blue
        imgData.data[idx + 3] = 255;
      }
    }
  }
  activeLayer.ctx.putImageData(imgData, 0, 0);

  // Select Red with tolerance 30
  const sel = tm.selectColorRange({ r: 255, g: 0, b: 0 }, 30, false);
  assert.ok(sel, 'Selection should be created');
  assert.strictEqual(sel.y, 0, 'minY should be 0 (top half)');
  assert.strictEqual(sel.h, 25, 'Height should cover top 25 rows');
  assert.strictEqual(sel.mask[10 * 50 + 10] > 200, true, 'Top red area should be selected');
  assert.strictEqual(sel.mask[35 * 50 + 10], 0, 'Bottom blue area should NOT be selected');
});

runTest('Color Range Inversion reverses selection mask', () => {
  const { app, activeLayer } = createMockApp(50, 50);
  const tm = new ToolManager(app);

  const imgData = activeLayer.ctx.getImageData(0, 0, 50, 50);
  for (let y = 0; y < 50; y++) {
    for (let x = 0; x < 50; x++) {
      const idx = (y * 50 + x) * 4;
      imgData.data[idx]     = (y < 25) ? 255 : 0;
      imgData.data[idx + 1] = 0;
      imgData.data[idx + 2] = (y >= 25) ? 255 : 0;
      imgData.data[idx + 3] = 255;
    }
  }
  activeLayer.ctx.putImageData(imgData, 0, 0);

  // Select NOT-Red (Inverted)
  const selInv = tm.selectColorRange({ r: 255, g: 0, b: 0 }, 30, true);
  assert.ok(selInv, 'Inverted selection should be created');
  assert.strictEqual(selInv.mask[35 * 50 + 10] > 200, true, 'Blue area should now be selected in inverted mode');
  assert.strictEqual(selInv.mask[10 * 50 + 10], 0, 'Red area should NOT be selected in inverted mode');
});

// ── Test Group 3: Content-Aware Fill Exemplar-based Inpainting Engine ──
console.log('\n► Test Group 3: Content-Aware Fill Inpainting Engine');

runTest('Filters.contentAwareFill synthesizes texture into hole from exterior', () => {
  const w = 40;
  const h = 40;
  const imgData = new ImageData(w, h);

  // Exterior pattern: solid green (0, 200, 50, 255)
  for (let i = 0; i < w * h; i++) {
    imgData.data[i * 4]     = 0;
    imgData.data[i * 4 + 1] = 200;
    imgData.data[i * 4 + 2] = 50;
    imgData.data[i * 4 + 3] = 255;
  }

  // Create a 10x10 hole in the center with black/transparent (borked area to fill)
  const mask = new Uint8Array(w * h);
  for (let y = 15; y < 25; y++) {
    for (let x = 15; x < 25; x++) {
      const idx = y * w + x;
      mask[idx] = 255; // Hole
      imgData.data[idx * 4]     = 0;
      imgData.data[idx * 4 + 1] = 0;
      imgData.data[idx * 4 + 2] = 0;
      imgData.data[idx * 4 + 3] = 0;
    }
  }

  const filled = Filters.contentAwareFill(imgData, mask, { patchSize: 3, searchRadius: 24 });
  assert.ok(filled, 'Filled image data returned');

  // Verify center of hole (20, 20) has been inpainted with surrounding green texture
  const centerIdx = (20 * w + 20) * 4;
  assert.strictEqual(filled.data[centerIdx + 1], 200, 'Green channel should be synthesized from exterior');
  assert.strictEqual(filled.data[centerIdx + 2], 50, 'Blue channel should be synthesized from exterior');
  assert.strictEqual(filled.data[centerIdx + 3], 255, 'Alpha channel should be fully opaque');
});

runTest('ToolManager.prototype.applyContentAwareFill inpaints active selection on canvas', () => {
  const { app, activeLayer } = createMockApp(60, 60);
  const tm = new ToolManager(app);

  // Fill canvas with gold color
  const imgData = activeLayer.ctx.getImageData(0, 0, 60, 60);
  for (let i = 0; i < 60 * 60; i++) {
    imgData.data[i * 4]     = 255;
    imgData.data[i * 4 + 1] = 215;
    imgData.data[i * 4 + 2] = 0;
    imgData.data[i * 4 + 3] = 255;
  }
  activeLayer.ctx.putImageData(imgData, 0, 0);

  // Create rectangular selection in center
  tm.selection = {
    type: 'rect',
    x: 20,
    y: 20,
    w: 20,
    h: 20
  };

  tm.applyContentAwareFill();

  assert.strictEqual(app.historyStates[app.historyStates.length - 1], 'Content-Aware Fill');
  const resData = activeLayer.ctx.getImageData(30, 30, 1, 1).data;
  assert.strictEqual(resData[0], 255, 'Inpainted center red channel matches surrounding gold');
  assert.strictEqual(resData[1], 215, 'Inpainted center green channel matches surrounding gold');
  assert.strictEqual(resData[2], 0, 'Inpainted center blue channel matches surrounding gold');
});

console.log('\n════════════════════════════════════════════════════════════════');
console.log(`  Phase 4 Upgrades Suite: ${passedTests} / ${totalTests} Passed (${Math.round((passedTests / totalTests) * 100)}%)`);
console.log('════════════════════════════════════════════════════════════════\n');

if (passedTests !== totalTests) {
  process.exit(1);
}
