/**
 * PixelForge Studio — Adobe Preset Asset Importers (.abr, .ase, .aco)
 * High-performance, zero-dependency binary parsers and serializers:
 *   - Adobe Swatch Exchange (.ase): RGB, CMYK, LAB, Grayscale palettes
 *   - Adobe Color Palette (.aco): Version 1 & Version 2 swatches
 *   - Adobe Photoshop Brush Presets (.abr): Legacy (v1/v2) and Modern Sampled Tips (v6+)
 *   - Export Swatches to .ase binary bundle
 */

class AdobePresetImporter {
  // ══════════════════════════════════════════════════════════════════════════
  // 1. Adobe Swatch Exchange (.ase) Decoder & Encoder
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Parses an Adobe Swatch Exchange (.ase) binary file
   * @param {ArrayBuffer|Uint8Array} buffer
   * @returns {Array<{name: string, hex: string, rgb: number[], space: string, type: string}>}
   */
  static parseAse(buffer) {
    const u8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    const view = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    let pos = 0;

    // Signature: 'ASEF' (0x41534546)
    if (view.getUint32(pos, false) !== 0x41534546) {
      throw new Error('Invalid ASE signature: expected "ASEF"');
    }
    pos += 4;

    const versionMajor = view.getUint16(pos, false); pos += 2;
    const versionMinor = view.getUint16(pos, false); pos += 2;
    const blockCount = view.getUint32(pos, false); pos += 4;

    const swatches = [];
    let currentGroup = 'Default';

    while (pos < u8.length - 4) {
      const blockType = view.getUint16(pos, false); pos += 2;
      const blockLen = view.getUint32(pos, false); pos += 4;
      const blockEnd = pos + blockLen;

      if (blockType === 0xC001) {
        // Group start
        const nameLen = view.getUint16(pos, false); pos += 2;
        let groupName = '';
        for (let i = 0; i < nameLen - 1; i++) {
          groupName += String.fromCharCode(view.getUint16(pos, false));
          pos += 2;
        }
        if (nameLen > 0) pos += 2; // skip null terminator
        if (groupName) currentGroup = groupName;
      } else if (blockType === 0xC002) {
        // Group end
        currentGroup = 'Default';
      } else if (blockType === 0x0001) {
        // Color Entry
        const nameLen = view.getUint16(pos, false); pos += 2;
        let colorName = '';
        for (let i = 0; i < nameLen - 1; i++) {
          colorName += String.fromCharCode(view.getUint16(pos, false));
          pos += 2;
        }
        if (nameLen > 0) pos += 2; // skip null terminator

        let colorSpace = '';
        for (let i = 0; i < 4; i++) {
          colorSpace += String.fromCharCode(u8[pos++]);
        }

        let r = 0, g = 0, b = 0;
        let cmyk = null;

        if (colorSpace === 'RGB ') {
          const rf = view.getFloat32(pos, false); pos += 4;
          const gf = view.getFloat32(pos, false); pos += 4;
          const bf = view.getFloat32(pos, false); pos += 4;
          r = Math.round(Math.max(0, Math.min(1, rf)) * 255);
          g = Math.round(Math.max(0, Math.min(1, gf)) * 255);
          b = Math.round(Math.max(0, Math.min(1, bf)) * 255);
        } else if (colorSpace === 'CMYK') {
          const cf = view.getFloat32(pos, false); pos += 4;
          const mf = view.getFloat32(pos, false); pos += 4;
          const yf = view.getFloat32(pos, false); pos += 4;
          const kf = view.getFloat32(pos, false); pos += 4;
          cmyk = [cf, mf, yf, kf];
          // Standard CMYK to RGB naive conversion
          r = Math.round(255 * (1 - cf) * (1 - kf));
          g = Math.round(255 * (1 - mf) * (1 - kf));
          b = Math.round(255 * (1 - yf) * (1 - kf));
        } else if (colorSpace === 'LAB ') {
          const lf = view.getFloat32(pos, false); pos += 4; // 0..100
          const af = view.getFloat32(pos, false); pos += 4; // -128..127
          const bf = view.getFloat32(pos, false); pos += 4; // -128..127
          // CIELAB D65 to sRGB
          const rgb = AdobePresetImporter.labToRgb(lf, af, bf);
          r = rgb[0]; g = rgb[1]; b = rgb[2];
        } else if (colorSpace === 'Gray') {
          const gray = view.getFloat32(pos, false); pos += 4;
          const v = Math.round(Math.max(0, Math.min(1, gray)) * 255);
          r = v; g = v; b = v;
        }

        const colorTypeVal = view.getUint16(pos, false); pos += 2;
        const colorType = colorTypeVal === 0 ? 'Global' : (colorTypeVal === 1 ? 'Spot' : 'Normal');

        const hex = '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');

        swatches.push({
          name: colorName || hex,
          group: currentGroup,
          hex,
          rgb: [r, g, b],
          cmyk,
          space: colorSpace.trim(),
          type: colorType
        });
      }

      pos = blockEnd;
    }

    return swatches;
  }

  /**
   * Encodes a list of swatches into Adobe Swatch Exchange (.ase) binary format
   * @param {Array<{name?: string, hex?: string, rgb?: number[]}>} swatches
   * @param {string} [groupName='PixelForge Palette']
   * @returns {Uint8Array}
   */
  static encodeAse(swatches, groupName = 'PixelForge Palette') {
    // Estimate size: header (12) + group start/end (~40) + swatches (~50 each)
    const bufSize = 128 + swatches.length * 64;
    const buffer = new ArrayBuffer(bufSize);
    const u8 = new Uint8Array(buffer);
    const view = new DataView(buffer);
    let pos = 0;

    // Header: 'ASEF', Version 1.0
    view.setUint32(pos, 0x41534546, false); pos += 4;
    view.setUint16(pos, 1, false); pos += 2;
    view.setUint16(pos, 0, false); pos += 2;
    view.setUint32(pos, swatches.length + 2, false); pos += 4; // blockCount: group start + colors + group end

    // Group Start Block (0xC001)
    view.setUint16(pos, 0xC001, false); pos += 2;
    const gNameLen = groupName.length + 1;
    view.setUint32(pos, 2 + gNameLen * 2, false); pos += 4; // block len
    view.setUint16(pos, gNameLen, false); pos += 2;
    for (let i = 0; i < groupName.length; i++) {
      view.setUint16(pos, groupName.charCodeAt(i), false); pos += 2;
    }
    view.setUint16(pos, 0, false); pos += 2; // null terminator

    // Swatch Color Blocks (0x0001)
    swatches.forEach(swatch => {
      let r = 0, g = 0, b = 0;
      if (swatch.rgb) {
        [r, g, b] = swatch.rgb;
      } else if (swatch.hex) {
        const hex = swatch.hex.replace(/^#/, '');
        r = parseInt(hex.slice(0, 2), 16) || 0;
        g = parseInt(hex.slice(2, 4), 16) || 0;
        b = parseInt(hex.slice(4, 6), 16) || 0;
      }

      const name = swatch.name || `#${[r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')}`;
      const nameLen = name.length + 1;
      const blockPayloadLen = 2 + nameLen * 2 + 4 + 12 + 2; // nameLen field + utf16 chars + 'RGB ' + 3 floats + colorType

      view.setUint16(pos, 0x0001, false); pos += 2;
      view.setUint32(pos, blockPayloadLen, false); pos += 4;
      view.setUint16(pos, nameLen, false); pos += 2;
      for (let i = 0; i < name.length; i++) {
        view.setUint16(pos, name.charCodeAt(i), false); pos += 2;
      }
      view.setUint16(pos, 0, false); pos += 2;

      // Color space: 'RGB '
      u8[pos++] = 0x52; u8[pos++] = 0x47; u8[pos++] = 0x42; u8[pos++] = 0x20;

      view.setFloat32(pos, r / 255, false); pos += 4;
      view.setFloat32(pos, g / 255, false); pos += 4;
      view.setFloat32(pos, b / 255, false); pos += 4;
      view.setUint16(pos, 2, false); pos += 2; // Normal color type
    });

    // Group End Block (0xC002)
    view.setUint16(pos, 0xC002, false); pos += 2;
    view.setUint32(pos, 0, false); pos += 4;

    return u8.subarray(0, pos);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 2. Adobe Color Palette (.aco) Decoder
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Parses an Adobe Color (.aco) file (supports Version 1 and Version 2 with Unicode names)
   */
  static parseAco(buffer) {
    const u8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    const view = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    let pos = 0;

    const version = view.getUint16(pos, false); pos += 2;
    const count = view.getUint16(pos, false); pos += 2;
    const v1Swatches = [];

    // Parse Version 1 Records
    for (let i = 0; i < count; i++) {
      const space = view.getUint16(pos, false); pos += 2;
      const w = view.getUint16(pos, false); pos += 2;
      const x = view.getUint16(pos, false); pos += 2;
      const y = view.getUint16(pos, false); pos += 2;
      const z = view.getUint16(pos, false); pos += 2;

      const rgb = AdobePresetImporter.convertAcoColor(space, w, x, y, z);
      const hex = '#' + rgb.map(c => c.toString(16).padStart(2, '0')).join('');
      v1Swatches.push({ name: `Color ${i + 1}`, hex, rgb });
    }

    // Check if Version 2 exists right after Version 1
    if (pos < u8.length - 4) {
      const ver2 = view.getUint16(pos, false); pos += 2;
      if (ver2 === 2) {
        const count2 = view.getUint16(pos, false); pos += 2;
        const v2Swatches = [];

        for (let i = 0; i < count2 && pos < u8.length; i++) {
          const space = view.getUint16(pos, false); pos += 2;
          const w = view.getUint16(pos, false); pos += 2;
          const x = view.getUint16(pos, false); pos += 2;
          const y = view.getUint16(pos, false); pos += 2;
          const z = view.getUint16(pos, false); pos += 2;

          // In ACO v2, color name is stored as a 4-byte character count followed by UTF-16 BE characters
          if (pos + 4 > u8.length) break;
          const nameLen = view.getUint32(pos, false); pos += 4;
          let name = '';
          for (let j = 0; j < nameLen - 1 && pos + 2 <= u8.length; j++) {
            name += String.fromCharCode(view.getUint16(pos, false));
            pos += 2;
          }
          if (nameLen > 0 && pos + 2 <= u8.length) pos += 2; // Skip null terminator

          const rgb = AdobePresetImporter.convertAcoColor(space, w, x, y, z);
          const hex = '#' + rgb.map(c => c.toString(16).padStart(2, '0')).join('');
          v2Swatches.push({ name: name || `Color ${i + 1}`, hex, rgb });
        }

        if (v2Swatches.length > 0) return v2Swatches;
      }
    }

    return v1Swatches;
  }

  static convertAcoColor(space, w, x, y, z) {
    if (space === 0) {
      // RGB: 0..65535 each
      return [Math.round(w / 257), Math.round(x / 257), Math.round(y / 257)];
    } else if (space === 1) {
      // HSB: H (0..65535 = 0..360), S (0..65535 = 0..1), B (0..65535 = 0..1)
      const h = (w / 65535) * 360;
      const s = x / 65535;
      const b = y / 65535;
      return AdobePresetImporter.hsbToRgb(h, s, b);
    } else if (space === 2) {
      // CMYK: 0..65535 (inverted: 0 = 100% ink)
      const c = 1 - (w / 65535);
      const m = 1 - (x / 65535);
      const yel = 1 - (y / 65535);
      const k = 1 - (z / 65535);
      return [
        Math.round(255 * (1 - c) * (1 - k)),
        Math.round(255 * (1 - m) * (1 - k)),
        Math.round(255 * (1 - yel) * (1 - k))
      ];
    } else if (space === 7) {
      // Lab: L (0..10000 = 0..100), a (-12800..12700 = -128..127), b (-12800..12700 = -128..127)
      const L = w / 100;
      const a = (x > 32767 ? x - 65536 : x) / 100;
      const b = (y > 32767 ? y - 65536 : y) / 100;
      return AdobePresetImporter.labToRgb(L, a, b);
    } else if (space === 8) {
      // Grayscale: 0..10000 = 0..100%
      const val = Math.round((w / 10000) * 255);
      return [val, val, val];
    }
    return [0, 0, 0];
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 3. Adobe Photoshop Brush Presets (.abr) Decoder
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Parses Photoshop Brush Preset (.abr) binary data
   * @param {ArrayBuffer|Uint8Array} buffer
   * @returns {Array<{name: string, size: number, spacing: number, width: number, height: number, alphaData: Uint8Array}>}
   */
  static parseAbr(buffer) {
    const u8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    const view = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    let pos = 0;

    const version = view.getUint16(pos, false); pos += 2;
    const brushes = [];

    if (version === 1 || version === 2) {
      // Legacy ABR format (Photoshop 6.0 and earlier)
      const count = view.getUint16(pos, false); pos += 2;
      for (let i = 0; i < count && pos < u8.length - 8; i++) {
        const brushType = view.getUint16(pos, false); pos += 2;
        const brushSize = view.getUint32(pos, false); pos += 4;
        const brushEnd = pos + brushSize;

        if (brushType === 1) {
          // Computed round brush
          pos += 2; // misc
          const spacing = view.getUint16(pos, false); pos += 2;
          const diameter = view.getUint16(pos, false); pos += 2;
          brushes.push({
            name: `Round ${diameter}px`,
            size: diameter,
            spacing: spacing / 100,
            width: diameter,
            height: diameter,
            type: 'computed',
            alphaData: null
          });
        } else if (brushType === 2) {
          // Sampled bitmap brush
          pos += 2; // misc
          const spacing = view.getUint16(pos, false); pos += 2;
          pos += 2; // antialiasing
          const top = view.getInt16(pos, false); pos += 2;
          const left = view.getInt16(pos, false); pos += 2;
          const bottom = view.getInt16(pos, false); pos += 2;
          const right = view.getInt16(pos, false); pos += 2;
          const w = Math.max(1, right - left);
          const h = Math.max(1, bottom - top);
          const depth = view.getUint16(pos, false); pos += 2;

          let alphaData = new Uint8Array(w * h);
          if (depth === 8) {
            const comp = view.getUint8(pos); pos += 1;
            if (comp === 0) {
              // Raw uncompressed
              alphaData = u8.subarray(pos, pos + (w * h));
            } else {
              // PackBits RLE
              const lineLens = [];
              for (let row = 0; row < h; row++) {
                lineLens.push(view.getUint16(pos, false)); pos += 2;
              }
              let dstOff = 0;
              for (let row = 0; row < h; row++) {
                const len = lineLens[row];
                AdobePresetImporter.decompressPackBits(u8, pos, len, alphaData, dstOff, w);
                pos += len;
                dstOff += w;
              }
            }
          }

          brushes.push({
            name: `Sampled Brush ${i + 1}`,
            size: Math.max(w, h),
            spacing: spacing / 100,
            width: w,
            height: h,
            type: 'sampled',
            alphaData
          });
        }

        pos = brushEnd;
      }
    } else if (version >= 6) {
      // Modern ABR format (Photoshop 7.0 - CC: 8BIM tagged blocks)
      const minorVersion = view.getUint16(pos, false); pos += 2;

      while (pos < u8.length - 8) {
        let sig = '';
        for (let i = 0; i < 4; i++) sig += String.fromCharCode(u8[pos++]);
        if (sig !== '8BIM') break;

        let tag = '';
        for (let i = 0; i < 4; i++) tag += String.fromCharCode(u8[pos++]);
        const dataLen = view.getUint32(pos, false); pos += 4;
        const tagEnd = pos + dataLen;

        if (tag === 'samp') {
          // Sampled brush tips block
          let sPos = pos;
          while (sPos < tagEnd - 16) {
            const sampleLen = view.getUint32(sPos, false); sPos += 4;
            const sEnd = sPos + sampleLen;

            // Sample header
            sPos += 4; // unknown
            const top = view.getInt32(sPos, false); sPos += 4;
            const left = view.getInt32(sPos, false); sPos += 4;
            const bottom = view.getInt32(sPos, false); sPos += 4;
            const right = view.getInt32(sPos, false); sPos += 4;
            const depth = view.getUint16(sPos, false); sPos += 2;
            const comp = view.getUint8(sPos); sPos += 1;

            const w = Math.max(1, right - left);
            const h = Math.max(1, bottom - top);
            const alphaData = new Uint8Array(w * h);

            if (comp === 0) {
              alphaData.set(u8.subarray(sPos, sPos + (w * h)));
            } else if (comp === 1) {
              const lineLens = [];
              for (let row = 0; row < h; row++) {
                lineLens.push(view.getUint16(sPos, false)); sPos += 2;
              }
              let dstOff = 0;
              for (let row = 0; row < h; row++) {
                const len = lineLens[row];
                AdobePresetImporter.decompressPackBits(u8, sPos, len, alphaData, dstOff, w);
                sPos += len;
                dstOff += w;
              }
            }

            brushes.push({
              name: `Sampled Tip ${brushes.length + 1}`,
              size: Math.max(w, h),
              spacing: 0.25,
              width: w,
              height: h,
              type: 'sampled',
              alphaData
            });

            sPos = sEnd + (sampleLen % 2 !== 0 ? 1 : 0);
          }
        }

        pos = tagEnd + (dataLen % 2 !== 0 ? 1 : 0);
      }
    }

    return brushes;
  }

  // ── Helper Color & Decompression Math ──

  static decompressPackBits(src, srcOffset, srcLen, dst, dstOffset, expectedLen) {
    let s = srcOffset;
    const end = srcOffset + srcLen;
    let d = dstOffset;
    const targetEnd = dstOffset + expectedLen;

    while (s < end && d < targetEnd) {
      let b = src[s++];
      if (b >= 128) b -= 256;

      if (b >= 0) {
        const count = b + 1;
        for (let i = 0; i < count && d < targetEnd && s < end; i++) {
          dst[d++] = src[s++];
        }
      } else if (b >= -127) {
        const count = 1 - b;
        if (s >= end) break;
        const val = src[s++];
        for (let i = 0; i < count && d < targetEnd; i++) {
          dst[d++] = val;
        }
      }
    }
  }

  static hsbToRgb(h, s, b) {
    const c = b * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = b - c;
    let r1 = 0, g1 = 0, b1 = 0;
    if (h >= 0 && h < 60) { r1 = c; g1 = x; }
    else if (h < 120) { r1 = x; g1 = c; }
    else if (h < 180) { g1 = c; b1 = x; }
    else if (h < 240) { g1 = x; b1 = c; }
    else if (h < 300) { r1 = x; b1 = c; }
    else { r1 = c; b1 = x; }
    return [
      Math.round((r1 + m) * 255),
      Math.round((g1 + m) * 255),
      Math.round((b1 + m) * 255)
    ];
  }

  static labToRgb(L, a, b) {
    // D65 Standard Illuminant
    let y = (L + 16) / 116;
    let x = a / 500 + y;
    let z = y - b / 200;

    const fInv = (t) => t > 0.20689655 ? t * t * t : (t - 16 / 116) / 7.787037;
    x = 0.95047 * fInv(x);
    y = 1.00000 * fInv(y);
    z = 1.08883 * fInv(z);

    // XYZ to linear sRGB
    let r =  3.2406 * x - 1.5372 * y - 0.4986 * z;
    let g = -0.9689 * x + 1.8758 * y + 0.0415 * z;
    let bl = 0.0557 * x - 0.2040 * y + 1.0570 * z;

    // Gamma companding
    const gamma = (c) => c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
    return [
      Math.round(Math.max(0, Math.min(1, gamma(r))) * 255),
      Math.round(Math.max(0, Math.min(1, gamma(g))) * 255),
      Math.round(Math.max(0, Math.min(1, gamma(bl))) * 255)
    ];
  }
}

if (typeof window !== 'undefined') {
  window.AdobePresetImporter = AdobePresetImporter;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = AdobePresetImporter;
}
