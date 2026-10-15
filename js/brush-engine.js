/**
 * PixelForge Studio — Advanced Brush Engine & Dynamics
 *
 * Implements:
 * 1. Mixer Brush Engine (Wet, Load, Mix, Flow canvas paint pickup and physical pigment blending)
 * 2. Texture & Dual Brush Engine (Procedural grain, canvas, charcoal, watercolor, and chalk stamping)
 * 3. Brush Preset Manager (Library of professional brush presets, saving custom brushes, JSON export/import)
 */

class TextureStampEngine {
  /**
   * Generates procedural texture modulation value in range [0, 1]
   * @param {number} x Canvas X coordinate
   * @param {number} y Canvas Y coordinate
   * @param {string} preset 'canvas'|'charcoal'|'watercolor'|'chalk'|'grunge'
   * @param {number} scale Scale percentage (10 to 200)
   * @param {number} depth Depth percentage (0 to 100)
   * @returns {number} Alpha multiplier [0.0, 1.0]
   */
  static getModulation(x, y, preset = 'none', scale = 100, depth = 50) {
    if (!preset || preset === 'none' || depth <= 0) return 1.0;

    const s = (Math.max(10, Math.min(300, scale)) / 100) * 0.15;
    const nx = x * s;
    const ny = y * s;
    let val = 1.0;

    switch (preset) {
      case 'canvas': {
        // Interlaced fabric weave pattern
        const wx = Math.abs(Math.sin(nx * 1.2));
        const wy = Math.abs(Math.cos(ny * 1.2));
        val = 0.4 + 0.6 * (wx * wy);
        break;
      }
      case 'charcoal': {
        // High-frequency gritty grain hash
        const h1 = Math.sin(nx * 12.9898 + ny * 78.233) * 43758.5453;
        const n1 = h1 - Math.floor(h1);
        const h2 = Math.sin((nx + 17.1) * 37.719 + (ny + 5.3) * 91.137) * 28461.391;
        const n2 = h2 - Math.floor(h2);
        val = 0.3 + 0.7 * (n1 * 0.6 + n2 * 0.4);
        break;
      }
      case 'watercolor': {
        // Soft turbulent pigment pooling
        const wave1 = Math.sin(nx * 0.4) * Math.cos(ny * 0.4);
        const wave2 = Math.sin(nx * 0.8 + 1.5) * Math.cos(ny * 0.8 + 2.1) * 0.5;
        const wave3 = Math.sin(nx * 1.6 + 3.7) * Math.cos(ny * 1.6 + 4.2) * 0.25;
        const sum = (wave1 + wave2 + wave3) / 1.75;
        val = 0.5 + 0.5 * sum;
        break;
      }
      case 'chalk': {
        // Porous speckled stippling
        const sx = Math.floor(nx * 4);
        const sy = Math.floor(ny * 4);
        const rand = ((sx * 374761393 + sy * 668265263) ^ 0x5bf03635) >>> 0;
        const frac = (rand % 1000) / 1000;
        val = frac > 0.45 ? 1.0 : (frac / 0.45);
        break;
      }
      case 'grunge': {
        // Rough irregular blotches
        const w1 = Math.sin(nx * 0.5 + Math.sin(ny * 0.5) * 1.2);
        const w2 = Math.cos(ny * 0.7 + Math.cos(nx * 0.7) * 1.4);
        const rough = Math.abs(w1 * w2);
        val = rough > 0.6 ? 1.0 : (rough * 0.8);
        break;
      }
      default:
        return 1.0;
    }

    const dFactor = depth / 100;
    return (1.0 - dFactor) + (val * dFactor);
  }
}

class MixerBrushEngine {
  constructor() {
    this.wet = 50; // 0 to 100% (pickup from canvas)
    this.load = 75; // 0 to 100% (paint in reservoir)
    this.mix = 60; // 0 to 100% (reservoir vs canvas ratio)
    this.cleanBrush = false; // clean reservoir after stroke
    this.loadBrush = true; // refill reservoir from foreground color
    this.reservoir = null; // { r, g, b, a }
  }

  /**
   * Initializes or refreshes brush reservoir from foreground color
   */
  initializeReservoir(fgHex) {
    let r = 255, g = 255, b = 255;
    if (typeof fgHex === 'string') {
      if (fgHex.startsWith('#')) {
        const h = fgHex.slice(1);
        if (h.length === 3) {
          r = parseInt(h[0] + h[0], 16);
          g = parseInt(h[1] + h[1], 16);
          b = parseInt(h[2] + h[2], 16);
        } else if (h.length >= 6) {
          r = parseInt(h.slice(0, 2), 16);
          g = parseInt(h.slice(2, 4), 16);
          b = parseInt(h.slice(4, 6), 16);
        }
      } else if (fgHex.startsWith('rgb')) {
        const m = fgHex.match(/\d+/g);
        if (m && m.length >= 3) {
          r = parseInt(m[0], 10);
          g = parseInt(m[1], 10);
          b = parseInt(m[2], 10);
        }
      }
    }
    this.reservoir = { r, g, b, a: this.load / 100 };
    return this.reservoir;
  }

  /**
   * Samples underlying pixel patch from layer canvas
   */
  sampleCanvasPatch(ctx, x, y, radius = 2) {
    if (!ctx) return { r: 255, g: 255, b: 255, a: 0 };
    const rx = Math.round(x);
    const ry = Math.round(y);
    try {
      const img = ctx.getImageData(Math.max(0, rx - radius), Math.max(0, ry - radius), radius * 2 + 1, radius * 2 + 1);
      const data = img.data;
      let sumR = 0, sumG = 0, sumB = 0, sumA = 0, count = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] > 0) {
          sumR += data[i];
          sumG += data[i + 1];
          sumB += data[i + 2];
          sumA += data[i + 3];
          count++;
        }
      }
      if (count === 0) return { r: 255, g: 255, b: 255, a: 0 };
      return {
        r: Math.round(sumR / count),
        g: Math.round(sumG / count),
        b: Math.round(sumB / count),
        a: (sumA / count) / 255
      };
    } catch (e) {
      return { r: 255, g: 255, b: 255, a: 0 };
    }
  }

  /**
   * Computes dab color and updates reservoir state
   */
  blendDab(sampledCanvas) {
    if (!this.reservoir) {
      this.reservoir = { r: 255, g: 255, b: 255, a: 1.0 };
    }

    const wetNorm = this.wet / 100;
    const mixNorm = this.mix / 100;

    let dabR = this.reservoir.r;
    let dabG = this.reservoir.g;
    let dabB = this.reservoir.b;
    let dabA = this.reservoir.a;

    if (sampledCanvas && sampledCanvas.a > 0.05) {
      // Blend canvas paint with reservoir paint
      const canvasWeight = wetNorm * mixNorm;
      dabR = Math.round(this.reservoir.r * (1 - canvasWeight) + sampledCanvas.r * canvasWeight);
      dabG = Math.round(this.reservoir.g * (1 - canvasWeight) + sampledCanvas.g * canvasWeight);
      dabB = Math.round(this.reservoir.b * (1 - canvasWeight) + sampledCanvas.b * canvasWeight);
      dabA = Math.max(0.1, this.reservoir.a * (1 - canvasWeight * 0.5) + sampledCanvas.a * (canvasWeight * 0.5));

      // Reservoir picks up a fraction of canvas paint
      const pickupRate = wetNorm * 0.25;
      this.reservoir.r = Math.round(this.reservoir.r * (1 - pickupRate) + sampledCanvas.r * pickupRate);
      this.reservoir.g = Math.round(this.reservoir.g * (1 - pickupRate) + sampledCanvas.g * pickupRate);
      this.reservoir.b = Math.round(this.reservoir.b * (1 - pickupRate) + sampledCanvas.b * pickupRate);
    }

    return {
      r: Math.max(0, Math.min(255, dabR)),
      g: Math.max(0, Math.min(255, dabG)),
      b: Math.max(0, Math.min(255, dabB)),
      a: Math.max(0, Math.min(1.0, dabA)),
      css: `rgba(${dabR}, ${dabG}, ${dabB}, ${dabA.toFixed(3)})`
    };
  }

  /**
   * Finalize stroke
   */
  endStroke(fgHex) {
    if (this.cleanBrush) {
      this.reservoir = { r: 255, g: 255, b: 255, a: 0 };
    } else if (this.loadBrush) {
      this.initializeReservoir(fgHex);
    }
  }
}

class BrushPresetManager {
  constructor() {
    this.presets = [];
    this.initDefaultPresets();
  }

  initDefaultPresets() {
    this.presets = [
      {
        id: 'hard-round-19',
        name: 'Hard Round 19',
        category: 'General',
        tip: 'round',
        size: 19,
        hardness: 100,
        opacity: 100,
        flow: 100,
        spacing: 25,
        scatter: 0,
        sizeJitter: 0,
        angleJitter: 0,
        texture: 'none',
        textureScale: 100,
        textureDepth: 0,
        tool: 'brush'
      },
      {
        id: 'soft-round-30',
        name: 'Soft Round 30',
        category: 'General',
        tip: 'soft-round',
        size: 30,
        hardness: 0,
        opacity: 100,
        flow: 100,
        spacing: 25,
        scatter: 0,
        sizeJitter: 0,
        angleJitter: 0,
        texture: 'none',
        textureScale: 100,
        textureDepth: 0,
        tool: 'brush'
      },
      {
        id: 'chisel-calligraphy',
        name: 'Chisel Calligraphy',
        category: 'Calligraphy',
        tip: 'chisel',
        size: 28,
        hardness: 95,
        opacity: 100,
        flow: 100,
        spacing: 12,
        scatter: 0,
        sizeJitter: 5,
        angleJitter: 12,
        texture: 'none',
        textureScale: 100,
        textureDepth: 0,
        tool: 'brush'
      },
      {
        id: 'oil-bristle-paint',
        name: 'Oil Bristle Dry-to-Wet',
        category: 'Natural Media',
        tip: 'bristle',
        size: 42,
        hardness: 85,
        opacity: 95,
        flow: 85,
        spacing: 15,
        scatter: 5,
        sizeJitter: 10,
        angleJitter: 15,
        texture: 'canvas',
        textureScale: 120,
        textureDepth: 45,
        tool: 'mixer-brush',
        mixerWet: 65,
        mixerLoad: 80,
        mixerMix: 55
      },
      {
        id: 'charcoal-gritty',
        name: 'Charcoal Rough Grain',
        category: 'Dry Media',
        tip: 'round',
        size: 24,
        hardness: 65,
        opacity: 90,
        flow: 80,
        spacing: 18,
        scatter: 12,
        sizeJitter: 15,
        angleJitter: 25,
        texture: 'charcoal',
        textureScale: 85,
        textureDepth: 65,
        tool: 'brush'
      },
      {
        id: 'rough-canvas-acrylic',
        name: 'Canvas Acrylic Thick',
        category: 'Natural Media',
        tip: 'bristle',
        size: 36,
        hardness: 90,
        opacity: 100,
        flow: 90,
        spacing: 14,
        scatter: 8,
        sizeJitter: 8,
        angleJitter: 18,
        texture: 'canvas',
        textureScale: 100,
        textureDepth: 55,
        tool: 'brush'
      },
      {
        id: 'splatter-grunge',
        name: 'Grunge Droplet Splatter',
        category: 'Special Effects',
        tip: 'splatter',
        size: 55,
        hardness: 100,
        opacity: 90,
        flow: 100,
        spacing: 45,
        scatter: 35,
        sizeJitter: 40,
        angleJitter: 50,
        texture: 'grunge',
        textureScale: 110,
        textureDepth: 40,
        tool: 'brush'
      },
      {
        id: 'soft-airbrush-flow',
        name: 'Soft Airbrush Velocity',
        category: 'Airbrush',
        tip: 'airbrush',
        size: 65,
        hardness: 0,
        opacity: 85,
        flow: 35,
        spacing: 12,
        scatter: 0,
        sizeJitter: 0,
        angleJitter: 0,
        texture: 'none',
        textureScale: 100,
        textureDepth: 0,
        tool: 'brush'
      },
      {
        id: 'watercolor-mop',
        name: 'Watercolor Wet Mop',
        category: 'Watercolor',
        tip: 'soft-round',
        size: 50,
        hardness: 20,
        opacity: 70,
        flow: 45,
        spacing: 16,
        scatter: 0,
        sizeJitter: 8,
        angleJitter: 0,
        texture: 'watercolor',
        textureScale: 140,
        textureDepth: 50,
        tool: 'mixer-brush',
        mixerWet: 85,
        mixerLoad: 60,
        mixerMix: 75
      },
      {
        id: 'wet-paint-blender',
        name: 'Wet Paint Impasto Blender',
        category: 'Mixer Blending',
        tip: 'bristle',
        size: 32,
        hardness: 75,
        opacity: 90,
        flow: 65,
        spacing: 12,
        scatter: 4,
        sizeJitter: 5,
        angleJitter: 10,
        texture: 'canvas',
        textureScale: 100,
        textureDepth: 30,
        tool: 'mixer-brush',
        mixerWet: 80,
        mixerLoad: 50,
        mixerMix: 80
      }
    ];
  }

  getPresets() {
    return [...this.presets];
  }

  getPreset(id) {
    return this.presets.find(p => p.id === id) || null;
  }

  addPreset(preset) {
    if (!preset || !preset.name) return null;
    const newPreset = {
      id: preset.id || 'preset_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      name: preset.name,
      category: preset.category || 'Custom',
      tip: preset.tip || 'round',
      size: preset.size || 20,
      hardness: preset.hardness !== undefined ? preset.hardness : 80,
      opacity: preset.opacity !== undefined ? preset.opacity : 100,
      flow: preset.flow !== undefined ? preset.flow : 100,
      spacing: preset.spacing !== undefined ? preset.spacing : 25,
      scatter: preset.scatter || 0,
      sizeJitter: preset.sizeJitter || 0,
      angleJitter: preset.angleJitter || 0,
      texture: preset.texture || 'none',
      textureScale: preset.textureScale || 100,
      textureDepth: preset.textureDepth || 0,
      tool: preset.tool || 'brush',
      mixerWet: preset.mixerWet !== undefined ? preset.mixerWet : 50,
      mixerLoad: preset.mixerLoad !== undefined ? preset.mixerLoad : 75,
      mixerMix: preset.mixerMix !== undefined ? preset.mixerMix : 60
    };
    this.presets.push(newPreset);
    return newPreset;
  }

  deletePreset(id) {
    const idx = this.presets.findIndex(p => p.id === id);
    if (idx !== -1) {
      this.presets.splice(idx, 1);
      return true;
    }
    return false;
  }

  applyToToolManager(presetId, toolManager) {
    const p = this.getPreset(presetId);
    if (!p || !toolManager) return false;

    if (p.tip) toolManager.brushTip = p.tip;
    if (p.size) toolManager.brushSize = p.size;
    if (p.hardness !== undefined) toolManager.brushHardness = p.hardness;
    if (p.opacity !== undefined) toolManager.brushOpacity = p.opacity;
    if (p.flow !== undefined) toolManager.brushFlow = p.flow;
    if (p.spacing !== undefined) toolManager.brushSpacing = p.spacing;
    if (p.scatter !== undefined) toolManager.brushScatter = p.scatter;
    if (p.sizeJitter !== undefined) toolManager.brushSizeJitter = p.sizeJitter;
    if (p.angleJitter !== undefined) toolManager.brushAngleJitter = p.angleJitter;
    if (p.texture) toolManager.brushTexture = p.texture;
    if (p.textureScale) toolManager.brushTextureScale = p.textureScale;
    if (p.textureDepth !== undefined) toolManager.brushTextureDepth = p.textureDepth;

    if (p.mixerWet !== undefined) toolManager.mixerWet = p.mixerWet;
    if (p.mixerLoad !== undefined) toolManager.mixerLoad = p.mixerLoad;
    if (p.mixerMix !== undefined) toolManager.mixerMix = p.mixerMix;

    if (p.tool && toolManager.setTool) {
      toolManager.setTool(p.tool);
    }
    return true;
  }

  saveFromToolManager(name, toolManager, category = 'Custom') {
    if (!name || !toolManager) return null;
    return this.addPreset({
      name,
      category,
      tip: toolManager.brushTip || 'round',
      size: toolManager.brushSize || 20,
      hardness: toolManager.brushHardness !== undefined ? toolManager.brushHardness : 80,
      opacity: toolManager.brushOpacity !== undefined ? toolManager.brushOpacity : 100,
      flow: toolManager.brushFlow !== undefined ? toolManager.brushFlow : 100,
      spacing: toolManager.brushSpacing !== undefined ? toolManager.brushSpacing : 25,
      scatter: toolManager.brushScatter || 0,
      sizeJitter: toolManager.brushSizeJitter || 0,
      angleJitter: toolManager.brushAngleJitter || 0,
      texture: toolManager.brushTexture || 'none',
      textureScale: toolManager.brushTextureScale || 100,
      textureDepth: toolManager.brushTextureDepth || 0,
      tool: toolManager.currentTool === 'mixer-brush' ? 'mixer-brush' : 'brush',
      mixerWet: toolManager.mixerWet || 50,
      mixerLoad: toolManager.mixerLoad || 75,
      mixerMix: toolManager.mixerMix || 60
    });
  }

  exportJSON() {
    return JSON.stringify(this.presets, null, 2);
  }

  importJSON(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      if (Array.isArray(data)) {
        let imported = 0;
        data.forEach(p => {
          if (p && p.name) {
            this.addPreset(p);
            imported++;
          }
        });
        return imported;
      }
    } catch (e) {
      console.error('Failed to parse brush preset JSON:', e);
    }
    return 0;
  }
}

// Global and CommonJS export support
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    TextureStampEngine,
    MixerBrushEngine,
    BrushPresetManager
  };
} else if (typeof window !== 'undefined') {
  window.TextureStampEngine = TextureStampEngine;
  window.MixerBrushEngine = MixerBrushEngine;
  window.BrushPresetManager = BrushPresetManager;
}
