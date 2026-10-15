/**
 * PixelForge Studio Pro — Phase 7: Advanced Brush Engine Verification Suite
 * Validates:
 *  1. Texture & Dual Brush Engine (procedural grain, canvas, charcoal, watercolor, chalk, grunge)
 *  2. Mixer Brush Engine (reservoir management, canvas pigment sampling, physical wet/mix blending, clean/load)
 *  3. Brush Preset Manager (library of presets, save custom preset, apply to ToolManager, JSON export/import)
 */

const assert = require('assert');

// ── Headless Mock Environment ──
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

const { TextureStampEngine, MixerBrushEngine, BrushPresetManager } = require('./js/brush-engine.js');
global.TextureStampEngine = TextureStampEngine;
global.MixerBrushEngine = MixerBrushEngine;
global.BrushPresetManager = BrushPresetManager;

const ToolManager = require('./js/tools.js');

let passedTests = 0;
let totalTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✕ ${name}`);
    console.error(err);
  }
}

console.log('\n════════════════════════════════════════════════════════════════');
console.log('  PixelForge Studio Pro — Phase 7: Advanced Brush Engine Suite');
console.log('════════════════════════════════════════════════════════════════\n');

// ── Test Group 1: Texture & Dual Brush Engine ──
console.log('► Test Group 1: Texture & Dual Brush Engine');

test('Texture modulation returns 1.0 when texture is none or depth is 0', () => {
  assert.strictEqual(TextureStampEngine.getModulation(50, 50, 'none', 100, 50), 1.0);
  assert.strictEqual(TextureStampEngine.getModulation(50, 50, 'canvas', 100, 0), 1.0);
});

test('Procedural textures (canvas, charcoal, watercolor, chalk, grunge) generate bounded modulations', () => {
  const presets = ['canvas', 'charcoal', 'watercolor', 'chalk', 'grunge'];
  for (const p of presets) {
    for (let x = 0; x < 50; x += 10) {
      for (let y = 0; y < 50; y += 10) {
        const mod = TextureStampEngine.getModulation(x, y, p, 100, 60);
        assert(mod >= 0.0 && mod <= 1.0, `Texture ${p} at (${x},${y}) out of range: ${mod}`);
      }
    }
  }
});

test('Texture scale and depth alter modulation depth dynamically', () => {
  const m1 = TextureStampEngine.getModulation(25, 25, 'charcoal', 100, 20);
  const m2 = TextureStampEngine.getModulation(25, 25, 'charcoal', 100, 100);
  // Higher depth produces stronger deviation from 1.0
  assert(Math.abs(1.0 - m2) >= Math.abs(1.0 - m1));
});

// ── Test Group 2: Mixer Brush Engine ──
console.log('\n► Test Group 2: Mixer Brush Engine & Wet Blending');

test('MixerBrushEngine initializes reservoir correctly from hex color', () => {
  const mixer = new MixerBrushEngine();
  mixer.load = 80;
  const res = mixer.initializeReservoir('#ff0000');
  assert.strictEqual(res.r, 255);
  assert.strictEqual(res.g, 0);
  assert.strictEqual(res.b, 0);
  assert.strictEqual(res.a, 0.8);
});

test('MixerBrushEngine blends reservoir paint with sampled canvas pigment', () => {
  const mixer = new MixerBrushEngine();
  mixer.wet = 50;
  mixer.mix = 50;
  mixer.initializeReservoir('#0000ff'); // Blue reservoir

  // Canvas has Yellow (255, 255, 0)
  const sampled = { r: 255, g: 255, b: 0, a: 1.0 };
  const dab = mixer.blendDab(sampled);

  // Dab should blend toward yellow/green
  assert(dab.r > 0 && dab.r < 255, `Expected mixed R, got ${dab.r}`);
  assert(dab.b > 0 && dab.b < 255, `Expected mixed B, got ${dab.b}`);
  assert.strictEqual(typeof dab.css, 'string');
});

test('MixerBrushEngine picks up canvas color into reservoir across successive strokes', () => {
  const mixer = new MixerBrushEngine();
  mixer.wet = 80;
  mixer.mix = 60;
  mixer.initializeReservoir('#ffffff'); // White reservoir

  const sampled = { r: 0, g: 0, b: 0, a: 1.0 }; // Black canvas
  const dab1 = mixer.blendDab(sampled);
  const dab2 = mixer.blendDab(sampled);

  // Successive dabs should darken as reservoir picks up black
  assert(dab2.r <= dab1.r);
  assert(mixer.reservoir.r < 255, 'Reservoir should have picked up canvas pigment');
});

test('MixerBrushEngine endStroke cleans or refills reservoir based on options', () => {
  const mixer = new MixerBrushEngine();
  mixer.cleanBrush = true;
  mixer.initializeReservoir('#ff0000');
  mixer.endStroke('#00ff00');
  assert.strictEqual(mixer.reservoir.a, 0, 'Clean brush should empty reservoir');

  mixer.cleanBrush = false;
  mixer.loadBrush = true;
  mixer.endStroke('#00ff00');
  assert.strictEqual(mixer.reservoir.g, 255, 'Load brush should reload foreground color');
});

// ── Test Group 3: Brush Preset Manager ──
console.log('\n► Test Group 3: Brush Preset Manager');

test('BrushPresetManager initializes with built-in presets covering multiple categories', () => {
  const mgr = new BrushPresetManager();
  const presets = mgr.getPresets();
  assert(presets.length >= 10, `Expected at least 10 presets, got ${presets.length}`);

  const hardRound = mgr.getPreset('hard-round-19');
  assert(hardRound !== null);
  assert.strictEqual(hardRound.hardness, 100);

  const oilBristle = mgr.getPreset('oil-bristle-paint');
  assert(oilBristle !== null);
  assert.strictEqual(oilBristle.tool, 'mixer-brush');
  assert.strictEqual(oilBristle.texture, 'canvas');
});

test('BrushPresetManager can create custom preset and serialize/deserialize JSON', () => {
  const mgr = new BrushPresetManager();
  const custom = mgr.addPreset({
    name: 'Custom Watercolor Fan',
    size: 45,
    tip: 'bristle',
    texture: 'watercolor',
    textureDepth: 60
  });

  assert(custom.id);
  assert.strictEqual(mgr.getPreset(custom.id).name, 'Custom Watercolor Fan');

  const json = mgr.exportJSON();
  assert(typeof json === 'string');

  const newMgr = new BrushPresetManager();
  newMgr.presets = [];
  const count = newMgr.importJSON(json);
  assert(count >= 11, `Expected imported presets, got ${count}`);
  assert(newMgr.getPreset(custom.id) !== null);
});

test('BrushPresetManager applies preset settings directly to ToolManager instance', () => {
  const mgr = new BrushPresetManager();
  const mockToolMgr = {
    brushTip: 'round',
    brushSize: 20,
    brushHardness: 50,
    brushOpacity: 100,
    brushFlow: 100,
    brushSpacing: 25,
    brushTexture: 'none',
    brushTextureScale: 100,
    brushTextureDepth: 0,
    mixerWet: 50,
    mixerLoad: 75,
    mixerMix: 60,
    currentTool: 'brush',
    setTool(t) { this.currentTool = t; }
  };

  const ok = mgr.applyToToolManager('oil-bristle-paint', mockToolMgr);
  assert.strictEqual(ok, true);
  assert.strictEqual(mockToolMgr.brushTip, 'bristle');
  assert.strictEqual(mockToolMgr.brushTexture, 'canvas');
  assert.strictEqual(mockToolMgr.currentTool, 'mixer-brush');
  assert.strictEqual(mockToolMgr.mixerWet, 65);
});

// ── Summary ──
console.log('\n════════════════════════════════════════════════════════════════');
console.log(`  Phase 7 Advanced Brush Suite: ${passedTests} / ${totalTests} Passed (${Math.round((passedTests / totalTests) * 100)}%)`);
console.log('════════════════════════════════════════════════════════════════\n');

if (passedTests !== totalTests) {
  process.exit(1);
}
