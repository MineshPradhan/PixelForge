/**
 * PixelForge Studio - Clone Source Transformation Palette & Manager
 * Photoshop parity for Clone Source palette:
 * - 5 Clone Source Presets (1 to 5)
 * - Angle rotation (-180° to +180°)
 * - Independent or locked Width & Height Scale (10% to 400%)
 * - Horizontal and Vertical flip
 * - Semi-transparent source overlay preview under brush cursor
 */

class CloneSourceManager {
  constructor(app = null) {
    this.app = app;
    this.activePresetId = 1;
    this.presets = {
      1: this.createDefaultPreset(1),
      2: this.createDefaultPreset(2),
      3: this.createDefaultPreset(3),
      4: this.createDefaultPreset(4),
      5: this.createDefaultPreset(5)
    };
    this.showOverlay = true;
    this.overlayOpacity = 50; // percentage
    this.lockAspect = true;
  }

  createDefaultPreset(id) {
    return {
      id,
      source: null,     // { x, y, layerId }
      offset: null,     // { dx, dy }
      angle: 0,         // degrees [-180, 180]
      scaleX: 100,      // percentage [10, 400]
      scaleY: 100,      // percentage [10, 400]
      flipH: false,
      flipV: false,
      aligned: true
    };
  }

  getActivePreset() {
    return this.presets[this.activePresetId];
  }

  selectPreset(id) {
    if (this.presets[id]) {
      this.activePresetId = id;
      return this.presets[id];
    }
    return null;
  }

  setSource(x, y, layerId = null) {
    const p = this.getActivePreset();
    p.source = { x, y, layerId };
    p.offset = null; // Reset offset until first click
    return p;
  }

  setAnchorOffset(destX, destY) {
    const p = this.getActivePreset();
    if (!p.source) return;
    p.offset = {
      dx: p.source.x - destX,
      dy: p.source.y - destY
    };
  }

  setAngle(deg) {
    const p = this.getActivePreset();
    let angle = Number(deg) || 0;
    while (angle > 180) angle -= 360;
    while (angle < -180) angle += 360;
    p.angle = angle;
  }

  setScale(scaleX, scaleY = null) {
    const p = this.getActivePreset();
    p.scaleX = Math.max(10, Math.min(400, Number(scaleX) || 100));
    if (scaleY !== null) {
      p.scaleY = Math.max(10, Math.min(400, Number(scaleY) || 100));
    } else if (this.lockAspect) {
      p.scaleY = p.scaleX;
    }
  }

  toggleFlipH() {
    const p = this.getActivePreset();
    p.flipH = !p.flipH;
    return p.flipH;
  }

  toggleFlipV() {
    const p = this.getActivePreset();
    p.flipV = !p.flipV;
    return p.flipV;
  }

  /**
   * Computes transformed sample position from destination (cursor) position
   * considering angle, scale, and flip
   */
  getTransformedSamplePoint(currX, currY, anchorDestX, anchorDestY) {
    const p = this.getActivePreset();
    if (!p.source) return null;

    // Relative offset from initial stroke destination anchor
    const relX = currX - anchorDestX;
    const relY = currY - anchorDestY;

    // Apply inverse rotation
    const rad = (-p.angle * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    let rotX = relX * cos - relY * sin;
    let rotY = relX * sin + relY * cos;

    // Apply inverse scale
    const sx = (p.scaleX / 100) * (p.flipH ? -1 : 1);
    const sy = (p.scaleY / 100) * (p.flipV ? -1 : 1);

    if (Math.abs(sx) > 0.001) rotX /= sx;
    if (Math.abs(sy) > 0.001) rotY /= sy;

    return {
      x: p.source.x + rotX,
      y: p.source.y + rotY
    };
  }

  /**
   * Samples a transformed brush dab from source layer into a temporary canvas
   */
  sampleTransformedDab(sourceCanvas, srcCenterX, srcCenterY, dabSize, p) {
    const r = dabSize / 2;
    const rad = (p.angle * Math.PI) / 180;
    const sx = (p.scaleX / 100) * (p.flipH ? -1 : 1);
    const sy = (p.scaleY / 100) * (p.flipV ? -1 : 1);

    return {
      srcX: srcCenterX,
      srcY: srcCenterY,
      size: dabSize,
      angleRad: rad,
      scaleX: sx,
      scaleY: sy
    };
  }

  resetPreset(id = null) {
    const targetId = id || this.activePresetId;
    this.presets[targetId] = this.createDefaultPreset(targetId);
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CloneSourceManager };
}
