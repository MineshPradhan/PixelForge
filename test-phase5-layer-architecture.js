/**
 * PixelForge Studio Pro — Phase 5 Layer Architecture Verification Suite
 * Validates:
 *  1. Layer Comps Engine (Capture, Apply, Update, Duplicate, Next/Prev Cycling, Serialization)
 *  2. Artboards Architecture (Multi-Canvas Bounded Artboards, Dimensions, Bg Fills, Clipped Compositor)
 *  3. Linked & Embedded Assets Manager (Place Embedded, Place Linked, Embed, Relink, Status Tracking)
 *  4. Isolation Mode (Subtree Isolation, Non-isolated Hiding/Dimming, Exit Mode)
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

global.Image = class Image {
  constructor() {
    this._src = '';
    this.width = 100;
    this.height = 100;
  }
  set src(v) {
    this._src = v;
    process.nextTick(() => {
      if (typeof this.onload === 'function') this.onload();
    });
  }
  get src() { return this._src; }
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
    },
    toDataURL: function() {
      return `data:image/png;base64,mock_${w}x${h}`;
    }
  };

  const clipStack = [];

  const ctx = {
    canvas,
    lastAssignedAlpha: 1.0,
    globalCompositeOperation: 'source-over',
    fillStyle: '#000000',
    strokeStyle: '#000000',
    lineWidth: 1,
    lineDashOffset: 0,
    shadowBlur: 0,
    shadowColor: 'transparent',
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    setLineDash() {},
    save() {
      clipStack.push(ctx.currentClip ? { ...ctx.currentClip } : null);
    },
    restore() {
      ctx.currentClip = clipStack.pop() || null;
    },
    beginPath() {
      ctx.currentPathRect = null;
    },
    rect(x, y, rw, rh) {
      ctx.currentPathRect = { x, y, width: rw, height: rh };
    },
    clip() {
      ctx.currentClip = ctx.currentPathRect ? { ...ctx.currentPathRect } : null;
    },
    translate() {},
    rotate() {},
    setTransform() {},
    scale() {},
    createLinearGradient() {
      return { addColorStop() {} };
    },
    createRadialGradient() {
      return { addColorStop() {} };
    },
    createPattern() {
      return {};
    },
    fillRect(x, y, fw, fh) {
      const col = Utils.hexToRgba ? Utils.hexToRgba(ctx.fillStyle, 1.0) : ctx.fillStyle;
      // Extract RGB values
      let r = 0, g = 0, b = 0, a = 255;
      if (typeof ctx.fillStyle === 'string') {
        if (ctx.fillStyle === '#ffffff' || ctx.fillStyle === 'white') { r = 255; g = 255; b = 255; }
        else if (ctx.fillStyle === '#ff0000' || ctx.fillStyle === 'red') { r = 255; g = 0; b = 0; }
        else if (ctx.fillStyle === '#00ff00' || ctx.fillStyle === 'green') { r = 0; g = 255; b = 0; }
        else if (ctx.fillStyle === '#0000ff' || ctx.fillStyle === 'blue') { r = 0; g = 0; b = 255; }
        else if (ctx.fillStyle.startsWith('#') && ctx.fillStyle.length === 7) {
          r = parseInt(ctx.fillStyle.slice(1, 3), 16);
          g = parseInt(ctx.fillStyle.slice(3, 5), 16);
          b = parseInt(ctx.fillStyle.slice(5, 7), 16);
        }
      }

      for (let cy = y; cy < y + fh; cy++) {
        for (let cx = x; cx < x + fw; cx++) {
          if (cx >= 0 && cx < w && cy >= 0 && cy < h) {
            // Apply clip rect if active
            if (ctx.currentClip) {
              const c = ctx.currentClip;
              if (cx < c.x || cx >= c.x + c.width || cy < c.y || cy >= c.y + c.height) {
                continue;
              }
            }
            const idx = (cy * w + cx) * 4;
            pixelBuffer[idx]     = r;
            pixelBuffer[idx + 1] = g;
            pixelBuffer[idx + 2] = b;
            pixelBuffer[idx + 3] = a;
          }
        }
      }
    },
    clearRect(x, y, cw, ch) {
      for (let cy = y; cy < y + ch; cy++) {
        for (let cx = x; cx < x + cw; cx++) {
          if (cx >= 0 && cx < w && cy >= 0 && cy < h) {
            const idx = (cy * w + cx) * 4;
            pixelBuffer[idx]     = 0;
            pixelBuffer[idx + 1] = 0;
            pixelBuffer[idx + 2] = 0;
            pixelBuffer[idx + 3] = 0;
          }
        }
      }
    },
    drawImage(src, sx, sy, sw, sh, dx, dy, dw, dh) {
      const srcCanvas = src.canvas ? src.canvas : src;
      const srcCtx = srcCanvas.getContext ? srcCanvas.getContext('2d') : null;
      if (!srcCtx) return;

      const srcBuf = srcCtx.getImageData(0, 0, srcCanvas.width, srcCanvas.height).data;
      const destX = (dx !== undefined) ? dx : (sx || 0);
      const destY = (dy !== undefined) ? dy : (sy || 0);
      const destW = (dw !== undefined) ? dw : (sw || srcCanvas.width);
      const destH = (dh !== undefined) ? dh : (sh || srcCanvas.height);

      const op = ctx.globalAlpha !== undefined ? ctx.globalAlpha : 1.0;

      for (let cy = 0; cy < destH; cy++) {
        for (let cx = 0; cx < destW; cx++) {
          const targetX = destX + cx;
          const targetY = destY + cy;
          if (targetX >= 0 && targetX < w && targetY >= 0 && targetY < h) {
            if (ctx.currentClip) {
              const c = ctx.currentClip;
              if (targetX < c.x || targetX >= c.x + c.width || targetY < c.y || targetY >= c.y + c.height) {
                continue;
              }
            }
            const srcIdx = (cy * srcCanvas.width + cx) * 4;
            const dstIdx = (targetY * w + targetX) * 4;
            const srcA = srcBuf[srcIdx + 3];
            if (srcA > 0) {
              pixelBuffer[dstIdx]     = srcBuf[srcIdx];
              pixelBuffer[dstIdx + 1] = srcBuf[srcIdx + 1];
              pixelBuffer[dstIdx + 2] = srcBuf[srcIdx + 2];
              pixelBuffer[dstIdx + 3] = Math.round(srcA * op);
            }
          }
        }
      }
    },
    getImageData(x, y, gw, gh) {
      const outData = new Uint8ClampedArray(gw * gh * 4);
      for (let cy = 0; cy < gh; cy++) {
        for (let cx = 0; cx < gw; cx++) {
          const srcIdx = ((y + cy) * w + (x + cx)) * 4;
          const dstIdx = (cy * gw + cx) * 4;
          outData[dstIdx]     = pixelBuffer[srcIdx];
          outData[dstIdx + 1] = pixelBuffer[srcIdx + 1];
          outData[dstIdx + 2] = pixelBuffer[srcIdx + 2];
          outData[dstIdx + 3] = pixelBuffer[srcIdx + 3];
        }
      }
      return { width: gw, height: gh, data: outData };
    },
    putImageData(imgData, x, y) {
      for (let cy = 0; cy < imgData.height; cy++) {
        for (let cx = 0; cx < imgData.width; cx++) {
          const targetX = x + cx;
          const targetY = y + cy;
          if (targetX >= 0 && targetX < w && targetY >= 0 && targetY < h) {
            const srcIdx = (cy * imgData.width + cx) * 4;
            const dstIdx = (targetY * w + targetX) * 4;
            pixelBuffer[dstIdx]     = imgData.data[srcIdx];
            pixelBuffer[dstIdx + 1] = imgData.data[srcIdx + 1];
            pixelBuffer[dstIdx + 2] = imgData.data[srcIdx + 2];
            pixelBuffer[dstIdx + 3] = imgData.data[srcIdx + 3];
          }
        }
      }
    },
    createImageData(w, h) {
      return new global.ImageData(w, h);
    }
  };

  Object.defineProperty(ctx, 'globalAlpha', {
    get() { return _alpha; },
    set(v) { _alpha = v; ctx.lastAssignedAlpha = v; }
  });
  let _alpha = 1.0;

  return canvas;
};

// Require dependencies
const { LayerManager, LayerComp, Artboard } = require('./js/layers.js');
const { SmartFilter, SmartObjectData, SmartObjectManager } = require('./js/smart-objects.js');
global.SmartFilter = SmartFilter;
global.SmartObjectData = SmartObjectData;
global.SmartObjectManager = SmartObjectManager;

const { Asset, AssetManager } = require('./js/assets.js');
global.Asset = Asset;
global.AssetManager = AssetManager;

// Test Tracker
let testsPassed = 0;
let testsFailed = 0;

async function runTest(name, fn) {
  try {
    const res = fn();
    if (res && typeof res.then === 'function') {
      await res;
    }
    console.log(`  ✓ ${name}`);
    testsPassed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    testsFailed++;
  }
}

async function runAll() {
console.log('\n════════════════════════════════════════════════════════════════');
console.log('  PixelForge Studio Pro — Phase 5 Layer Architecture Suite');
console.log('════════════════════════════════════════════════════════════════\n');

// ══════════════════════════════════════════════════════════════════
// TEST GROUP 1: Layer Comps Engine
// ══════════════════════════════════════════════════════════════════
console.log('► Test Group 1: Layer Comps Architecture (Photoshop Parity)');

await runTest('LayerComp model creates snapshot capturing visibility, position, and appearance', () => {
  const lm = new LayerManager(400, 300);
  const l1 = lm.addLayer('Background', '#ffffff');
  const l2 = lm.addLayer('Hero Button', '#0000ff');
  l2.opacity = 80;
  l2.blendMode = 'multiply';
  l2.x = 50;
  l2.y = 100;
  l2.styles.dropShadow.enabled = true;

  const comp1 = lm.createLayerComp('Light Theme Variation', {
    comment: 'Default blue button with drop shadow',
    captureVisibility: true,
    capturePosition: true,
    captureAppearance: true
  });

  assert.strictEqual(comp1.name, 'Light Theme Variation');
  assert.strictEqual(comp1.comment, 'Default blue button with drop shadow');
  assert.ok(comp1.state[l2.id], 'Captured state must contain hero button');
  assert.strictEqual(comp1.state[l2.id].visible, true);
  assert.strictEqual(comp1.state[l2.id].opacity, 80);
  assert.strictEqual(comp1.state[l2.id].blendMode, 'multiply');
  assert.strictEqual(comp1.state[l2.id].x, 50);
  assert.strictEqual(comp1.state[l2.id].y, 100);
  assert.strictEqual(comp1.state[l2.id].styles.dropShadow.enabled, true);
});

await runTest('applyLayerComp switches layer visibility, coordinates, and layer styles seamlessly', () => {
  const lm = new LayerManager(400, 300);
  const l1 = lm.addLayer('Banner');
  const l2 = lm.addLayer('Sidebar');

  // State A: Banner visible at (0, 0), Sidebar visible
  l1.visible = true;
  l1.x = 0;
  l1.opacity = 100;
  l2.visible = true;
  const compA = lm.createLayerComp('State A');

  // Change state to State B: Banner hidden, Sidebar moved to x=200, opacity=50
  l1.visible = false;
  l1.x = 100;
  l2.opacity = 50;
  const compB = lm.createLayerComp('State B');

  // Verify State B is active
  assert.strictEqual(l1.visible, false);
  assert.strictEqual(l2.opacity, 50);

  // Apply State A
  const appliedA = lm.applyLayerComp(compA.id);
  assert.strictEqual(appliedA, true);
  assert.strictEqual(l1.visible, true, 'l1 should become visible');
  assert.strictEqual(l1.x, 0, 'l1 position should restore to 0');
  assert.strictEqual(l2.opacity, 100, 'l2 opacity should restore to 100');
  assert.strictEqual(lm.activeCompId, compA.id);

  // Apply State B
  lm.applyLayerComp(compB.id);
  assert.strictEqual(l1.visible, false);
  assert.strictEqual(l2.opacity, 50);
  assert.strictEqual(lm.activeCompId, compB.id);
});

await runTest('updateLayerComp, duplicateLayerComp, and deleteLayerComp perform full lifecycle', () => {
  const lm = new LayerManager(400, 300);
  const l1 = lm.addLayer('Layer 1');
  const comp = lm.createLayerComp('Original Comp');

  // Modify layer and update comp
  l1.opacity = 42;
  lm.updateLayerComp(comp.id);
  assert.strictEqual(comp.state[l1.id].opacity, 42, 'Updated comp must reflect new opacity');

  // Duplicate comp
  const dup = lm.duplicateLayerComp(comp.id, 'Duplicated Comp');
  assert.ok(dup);
  assert.strictEqual(dup.name, 'Duplicated Comp');
  assert.strictEqual(dup.state[l1.id].opacity, 42);
  assert.strictEqual(lm.layerComps.length, 2);

  // Delete original comp
  const deleted = lm.deleteLayerComp(comp.id);
  assert.strictEqual(deleted, true);
  assert.strictEqual(lm.layerComps.length, 1);
  assert.strictEqual(lm.layerComps[0].id, dup.id);
});

await runTest('nextLayerComp and prevLayerComp cycle through registered comps sequentially', () => {
  const lm = new LayerManager(400, 300);
  const l1 = lm.addLayer('Layer 1');

  l1.opacity = 10;
  const c1 = lm.createLayerComp('Comp 1');
  l1.opacity = 20;
  const c2 = lm.createLayerComp('Comp 2');
  l1.opacity = 30;
  const c3 = lm.createLayerComp('Comp 3');

  lm.applyLayerComp(c1.id);
  assert.strictEqual(lm.activeCompId, c1.id);

  // Next cycles c1 -> c2 -> c3 -> c1
  const n1 = lm.nextLayerComp();
  assert.strictEqual(n1.id, c2.id);
  assert.strictEqual(l1.opacity, 20);

  const n2 = lm.nextLayerComp();
  assert.strictEqual(n2.id, c3.id);
  assert.strictEqual(l1.opacity, 30);

  const n3 = lm.nextLayerComp();
  assert.strictEqual(n3.id, c1.id);
  assert.strictEqual(l1.opacity, 10);

  // Prev cycles c1 -> c3
  const p1 = lm.prevLayerComp();
  assert.strictEqual(p1.id, c3.id);
  assert.strictEqual(l1.opacity, 30);
});

// ══════════════════════════════════════════════════════════════════
// TEST GROUP 2: Artboards Architecture
// ══════════════════════════════════════════════════════════════════
console.log('\n► Test Group 2: Artboards Multi-Canvas Architecture');

await runTest('Artboard initialization, dimensions, and layer assignment', () => {
  const lm = new LayerManager(2000, 2000);
  const abDesktop = lm.addArtboard('Desktop Web', 1920, 1080, { x: 0, y: 0, bgType: 'white' });
  const abMobile = lm.addArtboard('Mobile App', 375, 812, { x: 2000, y: 0, bgType: 'custom', bgColor: '#111827' });

  assert.strictEqual(lm.artboards.length, 2);
  assert.strictEqual(abDesktop.width, 1920);
  assert.strictEqual(abDesktop.height, 1080);
  assert.strictEqual(abMobile.x, 2000);

  const layerDesk = lm.addLayer('Desktop Header');
  const layerMob = lm.addLayer('Mobile Header');

  lm.assignLayerToArtboard(layerDesk.id, abDesktop.id);
  lm.assignLayerToArtboard(layerMob.id, abMobile.id);

  assert.strictEqual(layerDesk.artboardId, abDesktop.id);
  assert.strictEqual(layerMob.artboardId, abMobile.id);

  const deskLayers = lm.getArtboardLayers(abDesktop.id);
  assert.strictEqual(deskLayers.length, 1);
  assert.strictEqual(deskLayers[0].id, layerDesk.id);
});

await runTest('Artboard resize, move, and cleanup upon deletion', () => {
  const lm = new LayerManager(1000, 1000);
  const ab = lm.addArtboard('Test Board', 500, 500);
  const l = lm.addLayer('Layer on Board');
  lm.assignLayerToArtboard(l.id, ab.id);

  lm.resizeArtboard(ab.id, 600, 700);
  assert.strictEqual(ab.width, 600);
  assert.strictEqual(ab.height, 700);

  lm.moveArtboard(ab.id, 50, 100);
  assert.strictEqual(ab.x, 50);
  assert.strictEqual(ab.y, 100);

  // Deleting artboard should detach assigned layers cleanly without destroying them
  lm.deleteArtboard(ab.id);
  assert.strictEqual(lm.artboards.length, 0);
  assert.strictEqual(l.artboardId, null, 'Layer should be unassigned when artboard is deleted');
});

await runTest('Master composite clips layer rendering strictly to artboard bounding box', () => {
  const lm = new LayerManager(400, 400);
  // Create an artboard bounded at x=50, y=50, width=100, height=100 with red background
  const ab = lm.addArtboard('Clipped Board', 100, 100, { x: 50, y: 50, bgType: 'custom', bgColor: '#ff0000' });

  // Add a layer assigned to this artboard that fills the entire 400x400 canvas green
  const l = lm.addLayer('Green Full Fill', '#00ff00');
  lm.assignLayerToArtboard(l.id, ab.id);

  const outCanvas = Utils.createCanvas(400, 400);
  const outCtx = outCanvas.getContext('2d');
  lm.compositeTo(outCtx);

  // Pixels inside artboard (e.g. at 60, 60) must have green content rendered
  const insidePixel = outCtx.getImageData(60, 60, 1, 1).data;
  assert.strictEqual(insidePixel[1], 255, 'Inside pixel must have green channel active');
  assert.strictEqual(insidePixel[3], 255, 'Inside pixel must be opaque');

  // Pixels outside artboard (e.g. at 10, 10 or 300, 300) must be clipped and empty (0, 0, 0, 0)
  const outsidePixel = outCtx.getImageData(10, 10, 1, 1).data;
  assert.strictEqual(outsidePixel[3], 0, 'Outside pixel must be completely empty due to artboard clipping');
});

// ══════════════════════════════════════════════════════════════════
// TEST GROUP 3: Linked & Embedded Assets Manager
// ══════════════════════════════════════════════════════════════════
console.log('\n► Test Group 3: Linked & Embedded Assets Manager');

await runTest('Asset model tracks embedded vs linked type, dimensions, and file size', () => {
  const assetEmb = new Asset('logo.png', null, 'data:image/png;base64,sample', {
    type: 'embedded',
    width: 200,
    height: 100,
    fileSize: 45000
  });

  assert.strictEqual(assetEmb.type, 'embedded');
  assert.strictEqual(assetEmb.status, 'embedded');
  assert.strictEqual(assetEmb.getFormattedSize(), '43.9 KB');

  const assetLnk = new Asset('external-photo.jpg', '/Users/assets/external-photo.jpg', null, {
    type: 'linked',
    width: 1920,
    height: 1080,
    fileSize: 1500000
  });

  assert.strictEqual(assetLnk.type, 'linked');
  assert.strictEqual(assetLnk.status, 'ok');
  assert.strictEqual(assetLnk.getFormattedSize(), '1.4 MB');
  assert.strictEqual(assetLnk.uri, '/Users/assets/external-photo.jpg');
});

await runTest('AssetManager places embedded asset creating Smart Object layer bound to assetId', () => {
  const lm = new LayerManager(800, 600);
  const am = new AssetManager(lm);

  const { asset, layer } = am.placeEmbedded('Badge.png', 'data:image/png;base64,mock', 300, 200);

  assert.ok(asset);
  assert.ok(layer);
  assert.strictEqual(asset.type, 'embedded');
  assert.strictEqual(layer.type, 'smart-object');
  assert.strictEqual(layer.assetId, asset.id);
  assert.ok(layer.smartObjectData);
  assert.strictEqual(layer.smartObjectData.assetId, asset.id);
  assert.strictEqual(am.listAssets().length, 1);
});

await runTest('AssetManager places linked asset and handles embedAsset conversion', () => {
  const lm = new LayerManager(800, 600);
  const am = new AssetManager(lm);

  const { asset, layer } = am.placeLinked('BrandVector.svg', 'file:///assets/BrandVector.svg', null, 500, 500);

  assert.strictEqual(asset.type, 'linked');
  assert.strictEqual(asset.status, 'ok');
  assert.strictEqual(layer.assetId, asset.id);

  // Convert linked asset to embedded
  const success = am.embedAsset(asset.id);
  assert.strictEqual(success, true);
  assert.strictEqual(asset.type, 'embedded');
  assert.strictEqual(asset.status, 'embedded');
  assert.strictEqual(asset.uri, null, 'URI should be cleared on embedding');
  assert.strictEqual(layer.smartObjectData.assetType, 'embedded');
});

await runTest('AssetManager relinkAsset updates link URI and source dimensions', () => {
  const lm = new LayerManager(800, 600);
  const am = new AssetManager(lm);

  const { asset, layer } = am.placeLinked('Model.psd', '/v1/Model.psd', null, 400, 400);

  // Relink to higher resolution v2
  am.relinkAsset(asset.id, '/v2/Model-HiRes.psd', null, 800, 800);

  assert.strictEqual(asset.uri, '/v2/Model-HiRes.psd');
  assert.strictEqual(asset.width, 800);
  assert.strictEqual(asset.height, 800);
  assert.strictEqual(layer.smartObjectData.originalWidth, 800);
  assert.strictEqual(layer.smartObjectData.originalHeight, 800);
});

// ══════════════════════════════════════════════════════════════════
// TEST GROUP 4: Isolation Mode Engine
// ══════════════════════════════════════════════════════════════════
console.log('\n► Test Group 4: Isolation Mode Engine');

await runTest('enterIsolationMode and exitIsolationMode isolate active layer and subtree', () => {
  const lm = new LayerManager(500, 500);
  const group = lm.addGroup('Vector Illustrations');
  const lChild1 = lm.addLayer('Icon Star');
  const lChild2 = lm.addLayer('Icon Circle');
  lChild1.parentId = group.id;
  lChild2.parentId = group.id;
  const lOutside = lm.addLayer('Background Graphic');

  assert.strictEqual(lm.isolatedLayerId, null);
  assert.strictEqual(lm.isIsolated(lOutside.id), true, 'When not in isolation mode, all layers are isolated/visible');

  // Isolate the group
  lm.enterIsolationMode(group.id);
  assert.strictEqual(lm.isolatedLayerId, group.id);
  assert.strictEqual(lm.isIsolated(group.id), true);
  assert.strictEqual(lm.isIsolated(lChild1.id), true, 'Group child 1 must be isolated with group');
  assert.strictEqual(lm.isIsolated(lChild2.id), true, 'Group child 2 must be isolated with group');
  assert.strictEqual(lm.isIsolated(lOutside.id), false, 'Layer outside group must NOT be isolated');

  // Exit isolation mode
  lm.exitIsolationMode();
  assert.strictEqual(lm.isolatedLayerId, null);
  assert.strictEqual(lm.isIsolated(lOutside.id), true);
});

await runTest('compositeTo strictly excludes non-isolated layers during surgical isolation', () => {
  const lm = new LayerManager(100, 100);
  const lBg = lm.addLayer('Red Layer', '#ff0000');
  const lIso = lm.addLayer('Blue Layer', '#0000ff');

  // In normal mode: Blue is on top of Red -> Canvas is blue
  const canvas1 = Utils.createCanvas(100, 100);
  const ctx1 = canvas1.getContext('2d');
  lm.compositeTo(ctx1);
  assert.strictEqual(ctx1.getImageData(50, 50, 1, 1).data[2], 255, 'Normal mode draws Blue on top');

  // Now isolate Red Layer only! Blue layer should be completely omitted from composition
  lm.enterIsolationMode(lBg.id);
  const canvas2 = Utils.createCanvas(100, 100);
  const ctx2 = canvas2.getContext('2d');
  lm.compositeTo(ctx2);

  const isolatedPixel = ctx2.getImageData(50, 50, 1, 1).data;
  assert.strictEqual(isolatedPixel[0], 255, 'Isolated composition must show Red layer');
  assert.strictEqual(isolatedPixel[2], 0, 'Blue layer must be hidden while Red is isolated');

  // Exit isolation restores Blue layer
  lm.exitIsolationMode();
  const canvas3 = Utils.createCanvas(100, 100);
  const ctx3 = canvas3.getContext('2d');
  lm.compositeTo(ctx3);
  assert.strictEqual(ctx3.getImageData(50, 50, 1, 1).data[2], 255, 'Restored composite draws Blue on top again');
});

await runTest('exportProjectData and importProjectData preserve Artboards and Layer Comps', async () => {
  const lm = new LayerManager(1920, 1080);
  const ab = lm.addArtboard('Social Feed', 1080, 1350);
  const l1 = lm.addLayer('Layer 1');
  lm.assignLayerToArtboard(l1.id, ab.id);
  l1.opacity = 75;
  const comp = lm.createLayerComp('75% Variant');

  const serialized = lm.exportProjectData();
  assert.strictEqual(serialized.version, '1.3.0');
  assert.strictEqual(serialized.artboards.length, 1);
  assert.strictEqual(serialized.artboards[0].name, 'Social Feed');
  assert.strictEqual(serialized.layerComps.length, 1);
  assert.strictEqual(serialized.layerComps[0].name, '75% Variant');
  assert.strictEqual(serialized.layers[0].artboardId, ab.id);

  // Restore into a fresh LayerManager
  const newLm = new LayerManager(100, 100);
  await newLm.importProjectData(serialized);

  assert.strictEqual(newLm.artboards.length, 1);
  assert.strictEqual(newLm.artboards[0].name, 'Social Feed');
  assert.strictEqual(newLm.artboards[0].width, 1080);
  assert.strictEqual(newLm.artboards[0].height, 1350);

  assert.strictEqual(newLm.layerComps.length, 1);
  assert.strictEqual(newLm.layerComps[0].name, '75% Variant');
  assert.strictEqual(newLm.layers[0].artboardId, newLm.artboards[0].id);
});

console.log('\n════════════════════════════════════════════════════════════════');
console.log(`  Phase 5 Layer Architecture Suite: ${testsPassed} / ${testsPassed + testsFailed} Passed (${Math.round((testsPassed / (testsPassed + testsFailed)) * 100)}%)`);
console.log('════════════════════════════════════════════════════════════════\n');

if (testsFailed > 0) {
  process.exit(1);
}
}

runAll().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
