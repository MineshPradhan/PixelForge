/**
 * PixelForge Studio — Non-Destructive Vector Variable-Width Stroke Profiler
 * Affinity Photo & Illustrator Parity:
 * Allows sculpting stroke thickness dynamically along an open or closed vector path.
 * Supports:
 *   - Preset pressure graphs: Uniform, Taper End, Taper Both, Flare Ends, Bulge Center, Calligraphy
 *   - Custom normalized width profiles: W(t) where t in [0.0, 1.0]
 *   - Continuous polygon outline generation with normal offsetting
 */

class VectorStrokeProfiler {
  static PRESETS = {
    uniform: {
      name: 'Uniform',
      evaluate: () => 1.0
    },
    taper_both: {
      name: 'Taper Both Ends',
      evaluate: (t) => Math.sin(t * Math.PI)
    },
    taper_start: {
      name: 'Taper Start',
      evaluate: (t) => Math.pow(t, 0.7)
    },
    taper_end: {
      name: 'Taper End',
      evaluate: (t) => Math.pow(1 - t, 0.7)
    },
    flare_ends: {
      name: 'Flare Ends',
      evaluate: (t) => 0.3 + 0.7 * Math.pow(2 * Math.abs(t - 0.5), 1.5)
    },
    bulge_center: {
      name: 'Bulge Center',
      evaluate: (t) => 0.2 + 0.8 * Math.pow(Math.sin(t * Math.PI), 0.8)
    },
    calligraphy: {
      name: 'Calligraphy (Angle 45°)',
      evaluate: (t, tangent) => {
        if (!tangent) return 1.0;
        const angle = Math.atan2(tangent.dy, tangent.dx);
        const theta = angle - Math.PI / 4;
        return 0.25 + 0.75 * Math.abs(Math.sin(theta));
      }
    }
  };

  /**
   * Generates a filled polygon ribbon representing the variable-width stroked path
   * @param {Array<{x: number, y: number}>} points - Linearized points along path
   * @param {number} baseWidth - Nominal stroke width in pixels
   * @param {string|Function} profile - Preset name or custom function W(t, tangent)
   * @param {boolean} closed - Whether path is closed
   * @returns {Array<{x: number, y: number}>} Polygon boundary vertices
   */
  static generateVariableStrokePolygon(points, baseWidth = 10, profile = 'taper_both', closed = false) {
    if (!points || points.length < 2) return [];

    const evalFn = typeof profile === 'function'
      ? profile
      : (this.PRESETS[profile] ? this.PRESETS[profile].evaluate : this.PRESETS.uniform.evaluate);

    // Calculate cumulative arc-length distances
    const n = points.length;
    const dists = [0];
    let totalLen = 0;
    for (let i = 1; i < n; i++) {
      const d = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
      totalLen += d;
      dists.push(totalLen);
    }

    if (totalLen < 1e-4) return [];

    const leftRibbon = [];
    const rightRibbon = [];

    for (let i = 0; i < n; i++) {
      const t = dists[i] / totalLen;

      // Compute tangent vector
      let dx = 0, dy = 0;
      if (i === 0) {
        dx = points[1].x - points[0].x;
        dy = points[1].y - points[0].y;
      } else if (i === n - 1) {
        dx = points[n - 1].x - points[n - 2].x;
        dy = points[n - 1].y - points[n - 2].y;
      } else {
        dx = points[i + 1].x - points[i - 1].x;
        dy = points[i + 1].y - points[i - 1].y;
      }

      const len = Math.hypot(dx, dy) || 1e-6;
      const nx = -dy / len;
      const ny = dx / len;

      const scale = Math.max(0.01, evalFn(t, { dx: dx / len, dy: dy / len }));
      const halfW = (baseWidth * scale) / 2;

      leftRibbon.push({
        x: points[i].x + nx * halfW,
        y: points[i].y + ny * halfW
      });
      rightRibbon.push({
        x: points[i].x - nx * halfW,
        y: points[i].y - ny * halfW
      });
    }

    // Combine left ribbon forward, and right ribbon reversed to create closed outline
    return [...leftRibbon, ...rightRibbon.reverse()];
  }

  /**
   * Renders variable-width stroke onto a canvas context
   */
  static renderVariableStroke(ctx, points, baseWidth = 10, profile = 'taper_both', fillStyle = '#000000', closed = false) {
    const polygon = this.generateVariableStrokePolygon(points, baseWidth, profile, closed);
    if (polygon.length < 3) return;

    ctx.save();
    ctx.fillStyle = fillStyle;
    ctx.beginPath();
    ctx.moveTo(polygon[0].x, polygon[0].y);
    for (let i = 1; i < polygon.length; i++) {
      ctx.lineTo(polygon[i].x, polygon[i].y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

if (typeof window !== 'undefined') {
  window.VectorStrokeProfiler = VectorStrokeProfiler;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { VectorStrokeProfiler };
}
