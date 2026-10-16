/**
 * PixelForge Studio — Spot Color & Process Inks Manager
 * Photoshop & InDesign Prepress Parity:
 * Supports custom spot color channels alongside standard CMYK separation plates:
 *   - Custom Spot Inks with physical ink coverage percentages and preview tints
 *   - Standard Prepress Spot Libraries (White Underbase, Varnish Gloss, Metallic Gold, Silver, Neon)
 *   - CMYK + Spot separation channel export
 */

class SpotColorChannel {
  constructor(id, name, tintColorHex = '#d97706', opacity = 0.85, width = 100, height = 100) {
    this.id = id || 'spot_' + Math.random().toString(36).substr(2, 8);
    this.name = name || 'Spot Color 1';
    this.tintColorHex = tintColorHex;
    this.opacity = opacity; // [0.0 - 1.0] solid solidity
    this.width = width;
    this.height = height;
    this.visible = true;
    this.type = 'spot';
    // 8-bit density buffer [0 - 255] where 255 = 100% ink coverage
    this.data = new Uint8ClampedArray(width * height);
  }

  clone() {
    const copy = new SpotColorChannel(null, this.name + ' Copy', this.tintColorHex, this.opacity, this.width, this.height);
    copy.data.set(this.data);
    return copy;
  }

  /**
   * Clears or fills the spot channel density
   */
  fill(density = 255) {
    this.data.fill(Math.min(255, Math.max(0, density)));
  }

  /**
   * Sets ink density from a black-and-white mask or selection
   */
  setFromMask(maskBuffer) {
    if (!maskBuffer || maskBuffer.length !== this.data.length) return;
    this.data.set(maskBuffer);
  }
}

class SpotColorManager {
  static PRESETS = [
    { name: 'PANTONE Warm Red C', hex: '#f83a22', opacity: 0.9 },
    { name: 'PANTONE Reflex Blue C', hex: '#0a1172', opacity: 0.95 },
    { name: 'PANTONE 871 C (Metallic Gold)', hex: '#85714d', opacity: 0.8 },
    { name: 'PANTONE 877 C (Metallic Silver)', hex: '#8a8d8f', opacity: 0.8 },
    { name: 'White Ink (Underbase)', hex: '#f4f4f5', opacity: 1.0 },
    { name: 'Spot Clear Varnish (Gloss)', hex: '#38bdf8', opacity: 0.4 }
  ];

  constructor(app = null) {
    this.app = app;
    this.spotChannels = [];
  }

  createSpotChannel(name, hex, opacity) {
    const w = this.app ? this.app.width : 100;
    const h = this.app ? this.app.height : 100;
    const chan = new SpotColorChannel(null, name, hex, opacity, w, h);
    this.spotChannels.push(chan);
    return chan;
  }

  removeSpotChannel(id) {
    const idx = this.spotChannels.findIndex(c => c.id === id);
    if (idx !== -1) {
      return this.spotChannels.splice(idx, 1)[0];
    }
    return null;
  }

  getSpotChannels() {
    return this.spotChannels;
  }
}

if (typeof window !== 'undefined') {
  window.SpotColorChannel = SpotColorChannel;
  window.SpotColorManager = SpotColorManager;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SpotColorChannel, SpotColorManager };
}
