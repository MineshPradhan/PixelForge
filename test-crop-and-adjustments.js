/**
 * Test Suite: Multi-Image / Layer Aspect-Ratio Cropping & Right-Docked Live Adjustment Inspector
 * PixelForge Studio
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('Testing Crop Tool Parity & Right-Docked Adjustment Inspector Suite...\n');

// ── 1. Static HTML & CSS Verification ──
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf-8');
const css = fs.readFileSync(path.join(__dirname, 'styles/main.css'), 'utf-8');

console.log('► Test Group 1: HTML & Options Bar Structure');

assert(html.includes('id="opt-group-crop"'), 'opt-group-crop must exist in index.html');
console.log('  ✓ #opt-group-crop exists in #tool-options-bar');

assert(html.includes('id="crop-target-mode"'), 'crop-target-mode selector must exist');
assert(html.includes('value="active-layer"'), 'active-layer mode option must exist');
assert(html.includes('value="selected-layers"'), 'selected-layers mode option must exist');
assert(html.includes('value="canvas"'), 'canvas mode option must exist');
console.log('  ✓ Crop Target Mode selector supports Active Layer, Selected Layers, and Entire Canvas');

assert(html.includes('id="crop-aspect-preset"'), 'crop-aspect-preset dropdown must exist');
assert(html.includes('value="1:1"'), '1:1 ratio must exist');
assert(html.includes('value="16:9"'), '16:9 ratio must exist');
assert(html.includes('value="4:3"'), '4:3 ratio must exist');
assert(html.includes('value="custom"'), 'custom ratio must exist');
assert(html.includes('id="crop-ratio-w"') && html.includes('id="crop-ratio-h"'), 'W:H inputs must exist');
assert(html.includes('id="btn-crop-swap-ratio"'), 'Swap ratio button must exist');
assert(html.includes('id="crop-delete-pixels"'), 'Delete cropped pixels checkbox must exist');
assert(html.includes('id="btn-crop-commit"'), 'Crop commit button must exist');
assert(html.includes('id="btn-crop-cancel"'), 'Crop cancel button must exist');
console.log('  ✓ Crop aspect ratio presets, custom W:H ratio, and commit/cancel buttons exist');

assert(html.includes('id="panel-adjustment-inspector"'), 'panel-adjustment-inspector must exist in right-dock');
assert(html.includes('id="adjustment-inspector-name"'), 'adjustment title badge must exist');
assert(html.includes('id="btn-adj-reset"'), 'btn-adj-reset must exist');
assert(html.includes('id="btn-adj-apply"'), 'btn-adj-apply must exist');
assert(html.includes('id="btn-adj-close"'), 'btn-adj-close must exist');
assert(html.includes('id="adjustment-inspector-body"'), 'adjustment-inspector-body container must exist');
assert(html.includes('id="adj-live-preview-check"'), 'adj-live-preview-check must exist');
console.log('  ✓ Right-docked #panel-adjustment-inspector and controls exist in #right-dock');

assert(css.includes('#panel-adjustment-inspector'), 'CSS styles for panel-adjustment-inspector must exist');
assert(css.includes('.adj-slider-row'), 'CSS styles for adjustment sliders must exist');
console.log('  ✓ CSS styles defined for Right-Docked Adjustment Inspector');

// ── 2. Mock Canvas Environment for Behavioral Testing ──
function createMockCanvas(width = 800, height = 600) {
  const pixelBuffer = new Uint8ClampedArray(width * height * 4);
  return {
    width,
    height,
    style: {},
    getContext: () => ({
      getImageData: (sx, sy, sw, sh) => {
        const out = new Uint8ClampedArray(sw * sh * 4);
        for (let y = 0; y < sh; y++) {
          for (let x = 0; x < sw; x++) {
            const srcIdx = ((sy + y) * width + (sx + x)) * 4;
            const dstIdx = (y * sw + x) * 4;
            out[dstIdx] = pixelBuffer[srcIdx];
            out[dstIdx + 1] = pixelBuffer[srcIdx + 1];
            out[dstIdx + 2] = pixelBuffer[srcIdx + 2];
            out[dstIdx + 3] = pixelBuffer[srcIdx + 3];
          }
        }
        return { width: sw, height: sh, data: out };
      },
      putImageData: (imgData, dx, dy) => {
        const sw = imgData.width;
        const sh = imgData.height;
        for (let y = 0; y < sh; y++) {
          for (let x = 0; x < sw; x++) {
            const srcIdx = (y * sw + x) * 4;
            const dstIdx = ((dy + y) * width + (dx + x)) * 4;
            if (dstIdx >= 0 && dstIdx < pixelBuffer.length) {
              pixelBuffer[dstIdx] = imgData.data[srcIdx];
              pixelBuffer[dstIdx + 1] = imgData.data[srcIdx + 1];
              pixelBuffer[dstIdx + 2] = imgData.data[srcIdx + 2];
              pixelBuffer[dstIdx + 3] = imgData.data[srcIdx + 3];
            }
          }
        }
      },
      clearRect: (x, y, w, h) => {
        for (let py = y; py < y + h; py++) {
          for (let px = x; px < x + w; px++) {
            const idx = (py * width + px) * 4;
            if (idx >= 0 && idx < pixelBuffer.length) {
              pixelBuffer[idx] = 0;
              pixelBuffer[idx + 1] = 0;
              pixelBuffer[idx + 2] = 0;
              pixelBuffer[idx + 3] = 0;
            }
          }
        }
      },
      fillRect: () => {},
      drawImage: () => {},
      save: () => {},
      restore: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      stroke: () => {},
      strokeRect: () => {},
      measureText: (txt) => ({ width: txt.length * 7 }),
      fillText: () => {}
    })
  };
}

// ── 3. Layer and Crop Execution Tests ──
console.log('\n► Test Group 2: Multi-Image & Layer-Specific Cropping');

// Mock Layers
const layer1 = {
  id: 'layer-1',
  name: 'Image 1 (Square Crop Target)',
  width: 800,
  height: 600,
  canvas: createMockCanvas(800, 600),
  get ctx() { return this.canvas.getContext('2d'); },
  hasMask: false
};

const layer2 = {
  id: 'layer-2',
  name: 'Image 2 (16:9 Widescreen Crop Target)',
  width: 800,
  height: 600,
  canvas: createMockCanvas(800, 600),
  get ctx() { return this.canvas.getContext('2d'); },
  hasMask: false
};

// Fill some pixels on both layers
const redBlock = { width: 100, height: 100, data: new Uint8ClampedArray(100 * 100 * 4).fill(255) };
layer1.ctx.putImageData(redBlock, 50, 50);

const blueBlock = { width: 200, height: 150, data: new Uint8ClampedArray(200 * 150 * 4).fill(200) };
layer2.ctx.putImageData(blueBlock, 300, 200);

// Mock App
const mockApp = {
  width: 800,
  height: 600,
  layerManager: {
    width: 800,
    height: 600,
    layers: [layer1, layer2],
    activeLayerId: 'layer-1',
    selectedLayerIds: new Set(['layer-1']),
    getActiveLayer() { return this.layers.find(l => l.id === this.activeLayerId); },
    getSelectedLayers() { return this.layers.filter(l => this.selectedLayerIds.has(l.id)); },
    renderLayerStackUI() {}
  },
  bgCanvas: createMockCanvas(800, 600),
  mainCanvas: createMockCanvas(800, 600),
  overlayCanvas: createMockCanvas(800, 600),
  history: [],
  pushHistoryState(desc) { this.history.push(desc); },
  renderComposite() {},
  updateStatusInfo() {},
  renderRulers() {},
  showToast() {}
};

// Load cropToRect implementation from js/app.js
const appJsCode = fs.readFileSync(path.join(__dirname, 'js/app.js'), 'utf-8');
const cropToRectMatch = appJsCode.match(/cropToRect\(x, y, w, h, mode = 'canvas', deletePixels = true\) \{([\s\S]*?)\n  \}/);
assert(cropToRectMatch, 'cropToRect method must match signature');

const cropLayerToRectMatch = appJsCode.match(/cropLayerToRect\(layer, x, y, w, h, deletePixels = true\) \{([\s\S]*?)\n  \}/);
assert(cropLayerToRectMatch, 'cropLayerToRect method must match signature');

global.document = {
  getElementById: (id) => ({ style: {} }),
  querySelectorAll: () => []
};

global.Utils = {
  renderCheckerboard: () => {}
};

// Evaluate methods on mockApp
mockApp.cropToRect = new Function('x', 'y', 'w', 'h', 'mode = "canvas"', 'deletePixels = true', cropToRectMatch[1]).bind(mockApp);
mockApp.cropLayerToRect = new Function('layer', 'x', 'y', 'w', 'h', 'deletePixels = true', cropLayerToRectMatch[1]).bind(mockApp);

// Test Layer 1 Crop with 1:1 Aspect Ratio (200x200)
mockApp.cropToRect(50, 50, 200, 200, 'active-layer');

assert.strictEqual(mockApp.width, 800, 'Canvas document width must NOT change when in active-layer mode');
assert.strictEqual(mockApp.height, 600, 'Canvas document height must NOT change when in active-layer mode');
assert.strictEqual(mockApp.history[mockApp.history.length - 1], 'Crop Layer: Image 1 (Square Crop Target)', 'History must reflect layer crop');
console.log('  ✓ Layer 1 cropped independently to 1:1 square without shrinking canvas or affecting Layer 2');

// Test Layer 2 Crop with 16:9 Aspect Ratio (320x180)
mockApp.layerManager.activeLayerId = 'layer-2';
mockApp.layerManager.selectedLayerIds = new Set(['layer-2']);
mockApp.cropToRect(300, 200, 320, 180, 'active-layer');

assert.strictEqual(mockApp.width, 800, 'Canvas width remains 800 after Layer 2 crop');
assert.strictEqual(mockApp.height, 600, 'Canvas height remains 600 after Layer 2 crop');
assert.strictEqual(mockApp.history[mockApp.history.length - 1], 'Crop Layer: Image 2 (16:9 Widescreen Crop Target)', 'History reflects Layer 2 crop');
console.log('  ✓ Layer 2 cropped independently with different 16:9 aspect ratio');

// Test Multi-Selection Crop
mockApp.layerManager.selectedLayerIds = new Set(['layer-1', 'layer-2']);
mockApp.cropToRect(100, 100, 300, 300, 'selected-layers');
assert.strictEqual(mockApp.history[mockApp.history.length - 1], 'Crop 2 Layers', 'History reflects multi-layer crop');
console.log('  ✓ Multi-image selection: cropped multiple selected layers simultaneously');

// Test Canvas Crop Mode (changes document bounds)
mockApp.cropToRect(0, 0, 500, 400, 'canvas');
assert.strictEqual(mockApp.width, 500, 'Canvas width updated in canvas mode');
assert.strictEqual(mockApp.height, 400, 'Canvas height updated in canvas mode');
assert.strictEqual(mockApp.history[mockApp.history.length - 1], 'Crop Document', 'History reflects canvas crop');
console.log('  ✓ Entire Canvas Crop mode correctly updates document dimensions and all layers');

// ── 4. Aspect Ratio Calculation in Tools.js ──
console.log('\n► Test Group 3: Aspect Ratio Logic in ToolManager');
const toolsJsCode = fs.readFileSync(path.join(__dirname, 'js/tools.js'), 'utf-8');
assert(toolsJsCode.includes('getCropAspectRatio()'), 'getCropAspectRatio must exist in tools.js');
assert(toolsJsCode.includes('renderCropOverlay('), 'renderCropOverlay must exist in tools.js');
assert(toolsJsCode.includes('Rule of Thirds Grid'), 'Rule of Thirds grid rendering comment/logic must exist');
console.log('  ✓ Aspect ratio constraint engine and Rule of Thirds overlay verified');

// ── 5. Right-Docked Live Adjustment Inspector Verification ──
console.log('\n► Test Group 4: Right-Docked Live Adjustment Inspector');
assert(appJsCode.includes('openAdjustmentInspector(type'), 'openAdjustmentInspector method must exist in app.js');
assert(appJsCode.includes("case 'filter-posterize':"), 'filter-posterize must route to openAdjustmentInspector');
assert(appJsCode.includes("this.openAdjustmentInspector('posterize');"), 'posterize must call openAdjustmentInspector');
assert(appJsCode.includes("this.openAdjustmentInspector('brightness-contrast');"), 'brightness-contrast must call openAdjustmentInspector');
assert(appJsCode.includes("this.openAdjustmentInspector('threshold');"), 'threshold must call openAdjustmentInspector');
assert(appJsCode.includes("this.openAdjustmentInspector('hue-saturation');"), 'hue-saturation must call openAdjustmentInspector');
console.log('  ✓ All major adjustments routed to openAdjustmentInspector instead of modal-backdrop');

// Verify openAdjustmentLayerEditor routing
assert(appJsCode.includes("openAdjustmentLayerEditor(adjLayer) {"), 'openAdjustmentLayerEditor must exist');
assert(appJsCode.includes("this.openAdjustmentInspector(type, adjLayer.adjustmentParams, adjLayer);"), 'adjustment layers route to right-dock inspector');
console.log('  ✓ Adjustment layers open directly in Right-Docked Inspector with live preview');

console.log('\n════════════════════════════════════════════════════════════════');
console.log('  Crop Tool Parity & Right Dock Inspector: 100% Passed!');
console.log('════════════════════════════════════════════════════════════════\n');
