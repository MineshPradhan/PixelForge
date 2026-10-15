/**
 * PixelForge Studio - 3D Lighting Effects Engine
 * Photoshop Parity for Filter -> Render -> Lighting Effects:
 * - Multi-source 3D light stage (Point/Omni, Spotlight with penumbra, Directional/Infinite)
 * - 3D surface material model: Ambient, Diffuse, Specular, Glossiness
 * - On-the-fly surface bump mapping using Sobel luminance gradient
 * - Interactive light positioning, target direction, and attenuation
 */

class LightingEffectsEngine {
  constructor() {
    this.lights = [
      this.createDefaultLight('spot', { x: 0.3, y: 0.3, z: 200, targetX: 0.5, targetY: 0.5, intensity: 1.0, color: '#ffffff', coneAngle: 45, penumbra: 20 }),
      this.createDefaultLight('point', { x: 0.7, y: 0.7, z: 150, intensity: 0.5, color: '#ffeedd', radius: 400 })
    ];
    this.material = {
      ambient: 0.25,
      diffuse: 0.8,
      specular: 0.5,
      glossiness: 32,
      bumpHeight: 2.0
    };
  }

  createDefaultLight(type = 'point', overrides = {}) {
    return Object.assign({
      id: 'light_' + Math.random().toString(36).substr(2, 9),
      type, // 'point', 'spot', 'directional'
      enabled: true,
      x: 0.5, // Normalized [0, 1]
      y: 0.5,
      z: 200, // Distance from canvas plane
      targetX: 0.5,
      targetY: 0.5,
      intensity: 1.0,
      color: '#ffffff',
      radius: 500,       // For point lights
      coneAngle: 45,     // For spotlights (degrees)
      penumbra: 15,      // Soft edge falloff (degrees)
      azimuth: 45,       // For directional lights (degrees)
      elevation: 45      // For directional lights (degrees)
    }, overrides);
  }

  addLight(type = 'point', config = {}) {
    const light = this.createDefaultLight(type, config);
    this.lights.push(light);
    return light;
  }

  removeLight(index) {
    if (index >= 0 && index < this.lights.length) {
      return this.lights.splice(index, 1)[0];
    }
    return null;
  }

  parseHexColor(hex) {
    let clean = (hex || '#ffffff').replace('#', '');
    if (clean.length === 3) {
      clean = clean.split('').map(c => c + c).join('');
    }
    const num = parseInt(clean, 16);
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255
    };
  }

  /**
   * Renders 3D lighting onto ImageData
   * @param {ImageData} srcImageData - Source layer pixels
   * @param {Object} options - Material & lighting options
   */
  render(srcImageData, options = {}) {
    const { width: w, height: h, data: src } = srcImageData;
    const output = new ImageData(w, h);
    const dst = output.data;

    const mat = Object.assign({}, this.material, options.material || {});
    const activeLights = (options.lights || this.lights).filter(l => l.enabled);

    // Parse light colors
    const preparedLights = activeLights.map(l => {
      const rgb = this.parseHexColor(l.color);
      const posX = l.x * w;
      const posY = l.y * h;
      const posZ = l.z || 200;

      let dirX = 0, dirY = 0, dirZ = -1;
      let cosInner = 0, cosOuter = 0;

      if (l.type === 'spot') {
        const tgX = l.targetX * w;
        const tgY = l.targetY * h;
        const vdx = tgX - posX;
        const vdy = tgY - posY;
        const vdz = -posZ;
        const len = Math.hypot(vdx, vdy, vdz) || 1;
        dirX = vdx / len;
        dirY = vdy / len;
        dirZ = vdz / len;

        const halfAngleRad = ((l.coneAngle || 45) * 0.5 * Math.PI) / 180;
        const penumbraRad = ((l.penumbra || 15) * 0.5 * Math.PI) / 180;
        cosInner = Math.cos(halfAngleRad);
        cosOuter = Math.cos(halfAngleRad + penumbraRad);
      } else if (l.type === 'directional') {
        const azRad = ((l.azimuth || 45) * Math.PI) / 180;
        const elRad = ((l.elevation || 45) * Math.PI) / 180;
        dirX = Math.cos(elRad) * Math.cos(azRad);
        dirY = Math.cos(elRad) * Math.sin(azRad);
        dirZ = Math.sin(elRad);
      }

      return {
        type: l.type,
        posX, posY, posZ,
        dirX, dirY, dirZ,
        intensity: l.intensity || 1.0,
        r: rgb.r / 255,
        g: rgb.g / 255,
        b: rgb.b / 255,
        radius: l.radius || 500,
        cosInner, cosOuter
      };
    });

    // Compute luminance map for bump mapping
    const lum = new Float32Array(w * h);
    for (let i = 0; i < lum.length; i++) {
      const idx = i * 4;
      lum[i] = 0.299 * src[idx] + 0.587 * src[idx + 1] + 0.114 * src[idx + 2];
    }

    const bumpScale = mat.bumpHeight * 0.05;

    // View direction vector (orthogonal viewer straight on: [0, 0, 1])
    const viewZ = 1.0;

    for (let y = 0; y < h; y++) {
      const y0 = Math.max(0, y - 1);
      const y1 = Math.min(h - 1, y + 1);

      for (let x = 0; x < w; x++) {
        const x0 = Math.max(0, x - 1);
        const x1 = Math.min(w - 1, x + 1);
        const idx = (y * w + x) * 4;

        // Sobel gradient for bump surface normal
        let nx = 0, ny = 0, nz = 1.0;
        if (mat.bumpHeight > 0.01) {
          const lX1 = lum[y * w + x1];
          const lX0 = lum[y * w + x0];
          const lY1 = lum[y1 * w + x];
          const lY0 = lum[y0 * w + x];

          nx = -(lX1 - lX0) * bumpScale;
          ny = -(lY1 - lY0) * bumpScale;
          const len = Math.hypot(nx, ny, 1.0);
          nx /= len;
          ny /= len;
          nz = 1.0 / len;
        }

        // Initialize with ambient illumination
        let litR = mat.ambient;
        let litG = mat.ambient;
        let litB = mat.ambient;
        let specR = 0, specG = 0, specB = 0;

        for (let li = 0; li < preparedLights.length; li++) {
          const l = preparedLights[li];
          let lx = 0, ly = 0, lz = 1.0, att = 1.0;

          if (l.type === 'directional') {
            lx = l.dirX;
            ly = l.dirY;
            lz = l.dirZ;
          } else {
            // Point or Spot
            const dx = l.posX - x;
            const dy = l.posY - y;
            const dz = l.posZ;
            const dist = Math.hypot(dx, dy, dz);
            if (dist < 0.001) continue;

            lx = dx / dist;
            ly = dy / dist;
            lz = dz / dist;

            // Distance falloff
            att = Math.max(0, 1.0 - dist / l.radius);

            // Spot cone angle falloff
            if (l.type === 'spot') {
              const spotDot = -(lx * l.dirX + ly * l.dirY + lz * l.dirZ);
              if (spotDot < l.cosOuter) {
                att = 0;
              } else if (spotDot < l.cosInner) {
                const factor = (spotDot - l.cosOuter) / (l.cosInner - l.cosOuter);
                att *= factor * factor; // Smooth quadratic penumbra
              }
            }
          }

          if (att <= 0) continue;

          // Lambertian diffuse: N . L
          const nDotL = Math.max(0, nx * lx + ny * ly + nz * lz);
          const diffFactor = nDotL * mat.diffuse * l.intensity * att;

          litR += diffFactor * l.r;
          litG += diffFactor * l.g;
          litB += diffFactor * l.b;

          // Blinn-Phong specular: N . H
          if (mat.specular > 0.01 && nDotL > 0) {
            const hx = lx;
            const hy = ly;
            const hz = lz + viewZ;
            const hLen = Math.hypot(hx, hy, hz) || 1;
            const nDotH = Math.max(0, (nx * hx + ny * hy + nz * hz) / hLen);
            const specFactor = Math.pow(nDotH, mat.glossiness) * mat.specular * l.intensity * att;

            specR += specFactor * l.r * 255;
            specG += specFactor * l.g * 255;
            specB += specFactor * l.b * 255;
          }
        }

        dst[idx] = Math.min(255, Math.max(0, Math.round(src[idx] * litR + specR)));
        dst[idx + 1] = Math.min(255, Math.max(0, Math.round(src[idx + 1] * litG + specG)));
        dst[idx + 2] = Math.min(255, Math.max(0, Math.round(src[idx + 2] * litB + specB)));
        dst[idx + 3] = src[idx + 3];
      }
    }

    return output;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LightingEffectsEngine };
}
