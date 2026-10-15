/**
 * PixelForge Studio — CMYK Pre-Press Soft-Proofing & Gamut Warning Engine
 *
 * Implements Adobe Photoshop-grade Pre-Press proofing:
 *  1. Industry Standard Profiles: U.S. Web Coated (SWOP) v2, ISO Coated FOGRA39, Euroscale Uncoated
 *  2. GCR/UCR Undercolor Removal & Total Area Coverage (TAC) Inking simulation
 *  3. Soft-Proofing Viewport Simulation (`Ctrl+Y`)
 *  4. Out-of-Gamut Warning Engine (`Ctrl+Shift+Y`) with Delta-E color distance detection
 *  5. Separation Plate Previews (Cyan, Magenta, Yellow, Black individual plates)
 */

class CMYKProofEngine {
  constructor() {
    this.profiles = {
      SWOP: {
        name: 'U.S. Web Coated (SWOP) v2',
        tac: 300, // Total Area Coverage limit (%)
        kFactor: 0.88,
        dotGain: 1.18, // 18% dot gain
        paperWhite: { r: 252, g: 251, b: 248 }
      },
      FOGRA39: {
        name: 'Coated FOGRA39 (ISO 12647-2)',
        tac: 330,
        kFactor: 0.92,
        dotGain: 1.14,
        paperWhite: { r: 254, g: 253, b: 252 }
      },
      EUROSCALE: {
        name: 'Euroscale Uncoated v2',
        tac: 280,
        kFactor: 0.82,
        dotGain: 1.25,
        paperWhite: { r: 246, g: 244, b: 240 }
      }
    };

    this.currentProfileKey = 'SWOP';
    this.isSoftProofing = false;
    this.isGamutWarning = false;
    this.deltaEThreshold = 6.5; // Perceptual out-of-gamut threshold
    this.warningColor = { r: 180, g: 180, b: 180, a: 255 }; // Adobe PS standard gray gamut warning
    this.activePlate = 'all'; // 'all' | 'c' | 'm' | 'y' | 'k'
  }

  get currentProfile() {
    return this.profiles[this.currentProfileKey] || this.profiles.SWOP;
  }

  setProfile(profileKey) {
    if (this.profiles[profileKey]) {
      this.currentProfileKey = profileKey;
    }
  }

  /**
   * RGB (0-255) to CMYK (0-100%) conversion with Undercolor Removal (UCR)
   */
  rgbToCmyk(r, g, b, profile = null) {
    const prof = profile || this.currentProfile;
    const nr = r / 255;
    const ng = g / 255;
    const nb = b / 255;

    // Pure black edge case
    if (nr === 0 && ng === 0 && nb === 0) {
      return { c: 0, m: 0, y: 0, k: 100 };
    }

    let c = 1 - nr;
    let m = 1 - ng;
    let y = 1 - nb;

    // GCR / UCR Black Generation
    let k = Math.min(c, Math.min(m, y)) * prof.kFactor;

    if (k > 0) {
      c = (c - k) / (1 - k * 0.4);
      m = (m - k) / (1 - k * 0.4);
      y = (y - k) / (1 - k * 0.4);
    }

    // Convert to percentages 0 - 100
    let cPct = Math.max(0, Math.min(100, c * 100));
    let mPct = Math.max(0, Math.min(100, m * 100));
    let yPct = Math.max(0, Math.min(100, y * 100));
    let kPct = Math.max(0, Math.min(100, k * 100));

    // TAC (Total Area Coverage) Clamping
    const totalInk = cPct + mPct + yPct + kPct;
    if (totalInk > prof.tac) {
      const scale = prof.tac / totalInk;
      cPct *= scale;
      mPct *= scale;
      yPct *= scale;
      kPct *= scale;
    }

    return { c: cPct, m: mPct, y: yPct, k: kPct };
  }

  /**
   * CMYK (0-100%) simulation back to Proofed RGB (0-255) using
   * physical ink transmission and absorption spectra (Neugebauer/Beer-Lambert model)
   */
  cmykToRgb(c, m, y, k, profile = null) {
    const prof = profile || this.currentProfile;
    // Dot gain adjusted ink densities (0.0 - 1.0)
    const dc = Math.min(1.0, (c / 100) * prof.dotGain);
    const dm = Math.min(1.0, (m / 100) * prof.dotGain);
    const dy = Math.min(1.0, (y / 100) * prof.dotGain);
    const dk = Math.min(1.0, (k / 100) * 1.05);

    // Physical Ink Transmission Spectra:
    // Cyan ink absorbs red strongly, absorbs ~35% green
    const Tc = { r: 0.08, g: 0.65, b: 0.88 };
    // Magenta ink absorbs green strongly, absorbs ~48% blue
    const Tm = { r: 0.88, g: 0.12, b: 0.52 };
    // Yellow ink absorbs blue strongly, absorbs ~10% green
    const Ty = { r: 0.96, g: 0.90, b: 0.08 };
    // Black ink absorbs all wavelengths
    const Tk = { r: 0.04, g: 0.04, b: 0.04 };

    // Multi-layer transmission through ink film
    const trR = (1 - dc * (1 - Tc.r)) * (1 - dm * (1 - Tm.r)) * (1 - dy * (1 - Ty.r)) * (1 - dk * (1 - Tk.r));
    const trG = (1 - dc * (1 - Tc.g)) * (1 - dm * (1 - Tm.g)) * (1 - dy * (1 - Ty.g)) * (1 - dk * (1 - Tk.g));
    const trB = (1 - dc * (1 - Tc.b)) * (1 - dm * (1 - Tm.b)) * (1 - dy * (1 - Ty.b)) * (1 - dk * (1 - Tk.b));

    const r = prof.paperWhite.r * trR;
    const g = prof.paperWhite.g * trG;
    const b = prof.paperWhite.b * trB;

    return {
      r: Math.max(0, Math.min(255, Math.round(r))),
      g: Math.max(0, Math.min(255, Math.round(g))),
      b: Math.max(0, Math.min(255, Math.round(b)))
    };
  }

  /**
   * Fast Perceptual CIE76 Delta-E Calculation between two RGB triplets
   */
  calculateDeltaE(r1, g1, b1, r2, g2, b2) {
    // RGB to approximate CIE Lab
    const lab1 = this.rgbToLab(r1, g1, b1);
    const lab2 = this.rgbToLab(r2, g2, b2);

    const dL = lab1.L - lab2.L;
    const da = lab1.a - lab2.a;
    const db = lab1.b - lab2.b;

    return Math.sqrt(dL * dL + da * da + db * db);
  }

  /**
   * Helper: RGB to CIE Lab
   */
  rgbToLab(r, g, b) {
    // sRGB companding to linear RGB
    let R = r / 255, G = g / 255, B = b / 255;
    R = R > 0.04045 ? Math.pow((R + 0.055) / 1.055, 2.4) : R / 12.92;
    G = G > 0.04045 ? Math.pow((G + 0.055) / 1.055, 2.4) : G / 12.92;
    B = B > 0.04045 ? Math.pow((B + 0.055) / 1.055, 2.4) : B / 12.92;

    // Linear RGB to XYZ (D65 standard observer)
    let X = (R * 0.4124564 + G * 0.3575761 + B * 0.1804375) / 0.95047;
    let Y = (R * 0.2126729 + G * 0.7151522 + B * 0.0721750) / 1.00000;
    let Z = (R * 0.0193339 + G * 0.1191920 + B * 0.9503041) / 1.08883;

    const f = (t) => t > 0.008856 ? Math.cbrt(t) : (7.787 * t) + (16 / 116);

    const fX = f(X);
    const fY = f(Y);
    const fZ = f(Z);

    return {
      L: Math.max(0, 116 * fY - 16),
      a: 500 * (fX - fY),
      b: 200 * (fY - fZ)
    };
  }

  /**
   * Processes composite ImageData in-place or copies with Soft-Proof or Gamut Warning applied
   */
  processImageData(sourceImgData, options = {}) {
    const isSoftProof = options.softProof !== undefined ? options.softProof : this.isSoftProofing;
    const isGamut = options.gamutWarning !== undefined ? options.gamutWarning : this.isGamutWarning;
    const plate = options.plate || this.activePlate;
    const prof = this.currentProfile;

    if (!isSoftProof && !isGamut && plate === 'all') {
      return sourceImgData;
    }

    const data = sourceImgData.data;
    const len = data.length;
    const outData = new Uint8ClampedArray(data);

    for (let i = 0; i < len; i += 4) {
      const a = outData[i + 3];
      if (a === 0) continue;

      const r = outData[i];
      const g = outData[i + 1];
      const b = outData[i + 2];

      const cmyk = this.rgbToCmyk(r, g, b, prof);
      const proofed = this.cmykToRgb(cmyk.c, cmyk.m, cmyk.y, cmyk.k, prof);

      // 1. Separation Plate Previews
      if (plate !== 'all') {
        let plateVal = 0;
        switch (plate) {
          case 'c': plateVal = Math.round((cmyk.c / 100) * 255); break;
          case 'm': plateVal = Math.round((cmyk.m / 100) * 255); break;
          case 'y': plateVal = Math.round((cmyk.y / 100) * 255); break;
          case 'k': plateVal = Math.round((cmyk.k / 100) * 255); break;
        }
        // Invert plate: ink is black on white paper
        const paperTone = 255 - plateVal;
        outData[i] = paperTone;
        outData[i + 1] = paperTone;
        outData[i + 2] = paperTone;
        continue;
      }

      // 2. Gamut Warning Overlay
      if (isGamut) {
        const deltaE = this.calculateDeltaE(r, g, b, proofed.r, proofed.g, proofed.b);
        if (deltaE >= this.deltaEThreshold) {
          // Out-of-gamut pixel! Paint with standard warning color
          outData[i]     = this.warningColor.r;
          outData[i + 1] = this.warningColor.g;
          outData[i + 2] = this.warningColor.b;
          continue;
        }
      }

      // 3. Soft-Proof Viewport
      if (isSoftProof) {
        outData[i]     = proofed.r;
        outData[i + 1] = proofed.g;
        outData[i + 2] = proofed.b;
      }
    }

    return new ImageData(outData, sourceImgData.width, sourceImgData.height);
  }
}

// Module export for Node.js test environment and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CMYKProofEngine };
} else if (typeof window !== 'undefined') {
  window.CMYKProofEngine = CMYKProofEngine;
}
