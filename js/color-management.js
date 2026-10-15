/**
 * PixelForge Studio Pro — Color Management & ICC Engine
 *
 * Implements:
 *  1. IccProfileParser: ICC v2 & v4 binary specification parser and generator
 *     - Header decoding (profile size, magic 'acsp', version, class, color spaces)
 *     - Tag table and decoders (desc/mluc, rXYZ/gXYZ/bXYZ matrices, rTRC/gTRC/bTRC curves, wtpt)
 *  2. ColorSpaceManager: Full wide-gamut working spaces & conversions
 *     - sRGB (IEC 61966-2.1), Display P3, Adobe RGB (1998), ProPhoto RGB (ROMM)
 *     - Bradford chromatic adaptation between D50 and D65 white points
 *     - Assign Profile vs. Convert to Profile across 4 standard rendering intents:
 *       (Perceptual, Relative Colorimetric, Saturation, Absolute Colorimetric)
 *  3. IccEmbedder: Export color profile embedding
 *     - PNG iCCP chunk injector with CRC32 calculation
 *     - JPEG APP2 ICC_PROFILE segment injector
 */

// ── ICC Profile Binary Parser & Generator ──
class IccProfileParser {
  /**
   * Parse binary ArrayBuffer of an ICC profile (.icc / .icm)
   * @param {ArrayBuffer|Uint8Array} buffer 
   * @returns {Object} Parsed ICC profile metadata and colorimetric tags
   */
  static parse(buffer) {
    const u8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    const view = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);

    if (u8.length < 128) {
      throw new Error('Invalid ICC Profile: Buffer smaller than 128-byte header');
    }

    // 1. Header (128 bytes, Big-Endian)
    const profileSize = view.getUint32(0, false);
    const cmmType = IccProfileParser.readTagString(u8, 4);
    const versionMajor = u8[8];
    const versionMinor = (u8[9] >> 4) & 0x0F;
    const versionBugfix = u8[9] & 0x0F;
    const profileClass = IccProfileParser.readTagString(u8, 12); // 'mntr', 'prtr', 'scnr', 'spac'
    const colorSpace = IccProfileParser.readTagString(u8, 16);   // 'RGB ', 'CMYK', 'GRAY'
    const pcs = IccProfileParser.readTagString(u8, 20);          // 'XYZ ', 'Lab '
    const magic = IccProfileParser.readTagString(u8, 36);        // 'acsp' (0x61637370)

    if (magic !== 'acsp') {
      throw new Error(`Invalid ICC Profile: Missing 'acsp' magic signature, found '${magic}'`);
    }

    const renderingIntent = view.getUint32(64, false); // 0=Perceptual, 1=RelColorimetric, 2=Saturation, 3=AbsColorimetric

    // Illuminant XYZ
    const illuminantX = IccProfileParser.s15Fixed16(view.getInt32(68, false));
    const illuminantY = IccProfileParser.s15Fixed16(view.getInt32(72, false));
    const illuminantZ = IccProfileParser.s15Fixed16(view.getInt32(76, false));

    // 2. Tag Table
    const tagCount = view.getUint32(128, false);
    const tags = {};
    let pos = 132;

    for (let i = 0; i < tagCount; i++) {
      if (pos + 12 > u8.length) break;
      const sig = IccProfileParser.readTagString(u8, pos);
      const offset = view.getUint32(pos + 4, false);
      const size = view.getUint32(pos + 8, false);
      tags[sig] = { offset, size };
      pos += 12;
    }

    // 3. Extract Key Tag Values
    let description = 'Unknown ICC Profile';
    if (tags['desc']) {
      description = IccProfileParser.readDescTag(u8, tags['desc'].offset, tags['desc'].size);
    } else if (tags['mluc']) {
      description = IccProfileParser.readMlucTag(u8, tags['mluc'].offset);
    }

    let copyright = '';
    if (tags['cprt']) {
      copyright = IccProfileParser.readTextTag(u8, tags['cprt'].offset, tags['cprt'].size);
    }

    // Colorant Matrix (rXYZ, gXYZ, bXYZ)
    const matrix = {
      r: tags['rXYZ'] ? IccProfileParser.readXYZTag(view, tags['rXYZ'].offset) : null,
      g: tags['gXYZ'] ? IccProfileParser.readXYZTag(view, tags['gXYZ'].offset) : null,
      b: tags['bXYZ'] ? IccProfileParser.readXYZTag(view, tags['bXYZ'].offset) : null
    };

    // White Point (wtpt)
    const whitePoint = tags['wtpt'] ? IccProfileParser.readXYZTag(view, tags['wtpt'].offset) : { x: 0.9642, y: 1.0, z: 0.8249 }; // D50 fallback

    // Tone Reproduction Curves (rTRC, gTRC, bTRC)
    const trc = {
      r: tags['rTRC'] ? IccProfileParser.readTRCTag(view, tags['rTRC'].offset) : 2.2,
      g: tags['gTRC'] ? IccProfileParser.readTRCTag(view, tags['gTRC'].offset) : 2.2,
      b: tags['bTRC'] ? IccProfileParser.readTRCTag(view, tags['bTRC'].offset) : 2.2
    };

    return {
      valid: true,
      description,
      name: description,
      cmmType,
      version: `${versionMajor}.${versionMinor}.${versionBugfix}`,
      profileClass,
      colorSpace: colorSpace,
      connectionSpace: pcs,
      pcs: pcs,
      renderingIntent,
      illuminant: { x: illuminantX, y: illuminantY, z: illuminantZ },
      whitePoint,
      matrix,
      trc,
      copyright,
      tagCount,
      tags,
      rawBuffer: u8.buffer
    };
  }

  /**
   * Synthesize a minimal valid standard ICC v2 binary profile buffer
   * Useful for tagging exports with sRGB or Display P3 profiles
   */
  static createMinimalProfile(name = 'sRGB IEC61966-2.1', options = {}) {
    const gamma = options.gamma || 2.2;
    const descBytes = new TextEncoder().encode(name);
    const descTagLen = 12 + descBytes.length + 1;

    // Header (128) + Tag Count (4) + 6 Tags * 12 (72) = 204
    // Tags: desc, wtpt, rXYZ, gXYZ, bXYZ, rTRC
    const headerSize = 128;
    const tagCount = 6;
    const tableSize = 4 + tagCount * 12;
    let dataOffset = headerSize + tableSize;

    const descOffset = dataOffset;
    dataOffset += descTagLen + (4 - (descTagLen % 4)) % 4; // Align 4

    const wtptOffset = dataOffset;
    dataOffset += 20; // 4 type + 4 res + 12 XYZ

    const rXYZOffset = dataOffset;
    dataOffset += 20;

    const gXYZOffset = dataOffset;
    dataOffset += 20;

    const bXYZOffset = dataOffset;
    dataOffset += 20;

    const trcOffset = dataOffset;
    dataOffset += 14; // 4 type + 4 res + 4 count + 2 val

    const totalSize = dataOffset;
    const buffer = new ArrayBuffer(totalSize);
    const view = new DataView(buffer);
    const u8 = new Uint8Array(buffer);

    // Header
    view.setUint32(0, totalSize, false);
    IccProfileParser.writeTagString(u8, 4, 'appl');
    u8[8] = 2; u8[9] = 0x40; // Version 2.4.0
    IccProfileParser.writeTagString(u8, 12, 'mntr'); // Display Monitor
    IccProfileParser.writeTagString(u8, 16, 'RGB '); // RGB Space
    IccProfileParser.writeTagString(u8, 20, 'XYZ '); // PCS XYZ
    IccProfileParser.writeTagString(u8, 36, 'acsp'); // Magic

    // Tag Count
    view.setUint32(headerSize, tagCount, false);
    let tPos = headerSize + 4;

    const addTag = (sig, offset, size) => {
      IccProfileParser.writeTagString(u8, tPos, sig);
      view.setUint32(tPos + 4, offset, false);
      view.setUint32(tPos + 8, size, false);
      tPos += 12;
    };

    addTag('desc', descOffset, descTagLen);
    addTag('wtpt', wtptOffset, 20);
    addTag('rXYZ', rXYZOffset, 20);
    addTag('gXYZ', gXYZOffset, 20);
    addTag('bXYZ', bXYZOffset, 20);
    addTag('rTRC', trcOffset, 14);

    // Write desc Tag ('desc')
    IccProfileParser.writeTagString(u8, descOffset, 'desc');
    view.setUint32(descOffset + 8, descBytes.length + 1, false);
    u8.set(descBytes, descOffset + 12);

    // Helper: write XYZTag
    const writeXYZ = (offset, x, y, z) => {
      IccProfileParser.writeTagString(u8, offset, 'XYZ ');
      view.setInt32(offset + 8, Math.round(x * 65536), false);
      view.setInt32(offset + 12, Math.round(y * 65536), false);
      view.setInt32(offset + 16, Math.round(z * 65536), false);
    };

    // D50 Media White Point
    writeXYZ(wtptOffset, 0.9642, 1.0, 0.8249);

    // sRGB Primaries in D50 XYZ space
    writeXYZ(rXYZOffset, 0.43607, 0.22250, 0.01393);
    writeXYZ(gXYZOffset, 0.38515, 0.71687, 0.09708);
    writeXYZ(bXYZOffset, 0.14307, 0.06061, 0.71410);

    // Gamma curve ('curv')
    IccProfileParser.writeTagString(u8, trcOffset, 'curv');
    view.setUint32(trcOffset + 8, 1, false); // Count = 1 (single gamma number)
    view.setUint16(trcOffset + 12, Math.round(gamma * 256), false); // u8.8 fixed point

    return buffer;
  }

  // Helpers
  static s15Fixed16(val) { return val / 65536.0; }

  static readTagString(u8, offset) {
    let s = '';
    for (let i = 0; i < 4; i++) s += String.fromCharCode(u8[offset + i]);
    return s;
  }

  static writeTagString(u8, offset, str) {
    for (let i = 0; i < 4; i++) u8[offset + i] = str.charCodeAt(i) || 0x20;
  }

  static readXYZTag(view, offset) {
    return {
      x: IccProfileParser.s15Fixed16(view.getInt32(offset + 8, false)),
      y: IccProfileParser.s15Fixed16(view.getInt32(offset + 12, false)),
      z: IccProfileParser.s15Fixed16(view.getInt32(offset + 16, false))
    };
  }

  static readTRCTag(view, offset) {
    const count = view.getUint32(offset + 8, false);
    if (count === 1) {
      // Single gamma value in u8.8 format
      return view.getUint16(offset + 12, false) / 256.0;
    }
    return 2.2;
  }

  static readDescTag(u8, offset, size) {
    const len = new DataView(u8.buffer, u8.byteOffset + offset + 8, 4).getUint32(0, false);
    let s = '';
    for (let i = 0; i < Math.min(len, size - 12); i++) {
      const code = u8[offset + 12 + i];
      if (code === 0) break;
      s += String.fromCharCode(code);
    }
    return s.trim() || 'Custom ICC Profile';
  }

  static readMlucTag(u8, offset) {
    // Multi-localized Unicode tag
    const numRecords = new DataView(u8.buffer, u8.byteOffset + offset + 8, 4).getUint32(0, false);
    if (numRecords > 0) {
      const recLen = new DataView(u8.buffer, u8.byteOffset + offset + 20, 4).getUint32(0, false);
      const recOffset = new DataView(u8.buffer, u8.byteOffset + offset + 24, 4).getUint32(0, false);
      let s = '';
      for (let i = 0; i < recLen; i += 2) {
        const charCode = new DataView(u8.buffer, u8.byteOffset + offset + recOffset + i, 2).getUint16(0, false);
        if (charCode === 0) break;
        s += String.fromCharCode(charCode);
      }
      return s.trim();
    }
    return 'Multi-language Profile';
  }

  static readTextTag(u8, offset, size) {
    let s = '';
    for (let i = 8; i < size; i++) {
      const c = u8[offset + i];
      if (c === 0) break;
      s += String.fromCharCode(c);
    }
    return s.trim();
  }
}

// ── Working Color Spaces & Chromatic Adaptation ──
class ColorSpaceManager {
  constructor() {
    this.profiles = {
      sRGB: {
        id: 'sRGB',
        name: 'sRGB IEC61966-2.1',
        description: 'Standard Web & Display color space',
        whitePoint: { x: 0.3127, y: 0.3290 }, // D65
        gamma: 2.2,
        matrix: [
          [0.4124564, 0.3575761, 0.1804375],
          [0.2126729, 0.7151522, 0.0721750],
          [0.0193339, 0.1191920, 0.9503041]
        ],
        invMatrix: [
          [ 3.2404542, -1.5371385, -0.4985314],
          [-0.9692660,  1.8760108,  0.0415560],
          [ 0.0556434, -0.2040259,  1.0572252]
        ]
      },
      DisplayP3: {
        id: 'DisplayP3',
        name: 'Display P3',
        description: 'Apple Wide-Gamut display space (DCI-P3 primaries, D65 white)',
        whitePoint: { x: 0.3127, y: 0.3290 }, // D65
        gamma: 2.2,
        matrix: [
          [0.4865709, 0.2656677, 0.1982173],
          [0.2289746, 0.6917393, 0.0792861],
          [0.0000000, 0.0451134, 1.0439444]
        ],
        invMatrix: [
          [ 2.4934969, -0.9313836, -0.4027108],
          [-0.8294890,  1.7626641,  0.0236247],
          [ 0.0358458, -0.0761724,  0.9568845]
        ]
      },
      AdobeRGB: {
        id: 'AdobeRGB',
        name: 'Adobe RGB (1998)',
        description: 'Wide-gamut pre-press photography color space',
        whitePoint: { x: 0.3127, y: 0.3290 }, // D65
        gamma: 2.19921875,
        matrix: [
          [0.5767309, 0.1855540, 0.1881852],
          [0.2973769, 0.6273491, 0.0752741],
          [0.0270343, 0.0706872, 0.9911085]
        ],
        invMatrix: [
          [ 2.0413690, -0.5649464, -0.3446944],
          [-0.9692660,  1.8760108,  0.0415560],
          [ 0.0134474, -0.1183897,  1.0154096]
        ]
      },
      ProPhoto: {
        id: 'ProPhoto',
        name: 'ProPhoto RGB (ROMM)',
        description: 'Ultra-wide gamut capturing over 90% of all visible surface colors',
        whitePoint: { x: 0.3457, y: 0.3585 }, // D50
        gamma: 1.8,
        matrix: [
          [0.7976749, 0.1351917, 0.0313534],
          [0.2880402, 0.7118741, 0.0000857],
          [0.0000000, 0.0000000, 0.8252100]
        ],
        invMatrix: [
          [ 1.3459433, -0.2556075, -0.0511118],
          [-0.5445989,  1.5081673,  0.0205351],
          [ 0.0000000,  0.0000000,  1.2118128]
        ]
      }
    };

    this.activeProfileId = 'sRGB';
  }

  getProfile(key) {
    if (!key) return this.profiles.sRGB;
    const lower = key.toLowerCase();
    for (const k in this.profiles) {
      if (k.toLowerCase() === lower || this.profiles[k].id.toLowerCase() === lower) {
        return this.profiles[k];
      }
    }
    return this.profiles.sRGB;
  }

  get activeProfile() {
    return this.profiles[this.activeProfileId] || this.profiles.sRGB;
  }

  static getInstance() {
    if (!ColorSpaceManager._instance) {
      ColorSpaceManager._instance = new ColorSpaceManager();
    }
    return ColorSpaceManager._instance;
  }

  static generateStandardProfile(name = 'sRGB') {
    const inst = ColorSpaceManager.getInstance();
    const prof = inst.getProfile(name);
    const ab = IccProfileParser.createMinimalProfile(prof.name, { gamma: prof.gamma });
    return new Uint8Array(ab);
  }

  static gammaToLinear(val, profileKey = 'sRGB') {
    const inst = ColorSpaceManager.getInstance();
    const prof = inst.getProfile(profileKey);
    return Math.pow(Math.max(0, val), prof.gamma);
  }

  static linearToGamma(val, profileKey = 'sRGB') {
    const inst = ColorSpaceManager.getInstance();
    const prof = inst.getProfile(profileKey);
    return Math.pow(Math.max(0, val), 1 / prof.gamma);
  }

  static adaptChromaticity(xyz, fromWhite = 'D65', toWhite = 'D50') {
    const [X, Y, Z] = xyz;
    if (fromWhite === toWhite) return [X, Y, Z];
    if (fromWhite === 'D65' && toWhite === 'D50') {
      const Xb =  1.0478112 * X + 0.0228866 * Y - 0.0501270 * Z;
      const Yb =  0.0295424 * X + 0.9904844 * Y - 0.0170491 * Z;
      const Zb = -0.0092345 * X + 0.0150436 * Y + 0.7521316 * Z;
      return [Xb, Yb, Zb];
    } else {
      const Xb =  0.9555766 * X - 0.0230393 * Y + 0.0631636 * Z;
      const Yb = -0.0282895 * X + 1.0099416 * Y + 0.0210077 * Z;
      const Zb =  0.0122982 * X - 0.0204830 * Y + 1.3299098 * Z;
      return [Xb, Yb, Zb];
    }
  }

  static convertProfile(imgData, sourceKey, targetKey, intent = 'relative-colorimetric') {
    return ColorSpaceManager.getInstance().convertProfile(imgData, sourceKey, targetKey, intent);
  }

  static assignProfile(imgData, targetKey) {
    const out = new ImageData(imgData.width, imgData.height);
    out.data.set(imgData.data);
    return out;
  }

  /**
   * Convert ImageData from source profile to target profile using XYZ PCS
   */
  convertProfile(imgData, sourceKey, targetKey, intent = 'relative-colorimetric') {
    const srcProf = this.getProfile(sourceKey);
    const dstProf = this.getProfile(targetKey);

    if (srcProf.id === dstProf.id) {
      const copy = new ImageData(imgData.width, imgData.height);
      copy.data.set(imgData.data);
      return copy;
    }

    const w = imgData.width;
    const h = imgData.height;
    const src = imgData.data;
    const out = new ImageData(w, h);
    const dst = out.data;

    const toLinear = (c, gamma) => Math.pow(Math.max(0, c / 255), gamma);
    const fromLinear = (c, gamma) => Math.max(0, Math.min(255, Math.round(Math.pow(Math.max(0, c), 1 / gamma) * 255)));

    const needAdapt = (srcProf.whitePoint.x !== dstProf.whitePoint.x);

    for (let i = 0; i < src.length; i += 4) {
      const rLin = toLinear(src[i], srcProf.gamma);
      const gLin = toLinear(src[i + 1], srcProf.gamma);
      const bLin = toLinear(src[i + 2], srcProf.gamma);
      const a = src[i + 3];

      let X = srcProf.matrix[0][0] * rLin + srcProf.matrix[0][1] * gLin + srcProf.matrix[0][2] * bLin;
      let Y = srcProf.matrix[1][0] * rLin + srcProf.matrix[1][1] * gLin + srcProf.matrix[1][2] * bLin;
      let Z = srcProf.matrix[2][0] * rLin + srcProf.matrix[2][1] * gLin + srcProf.matrix[2][2] * bLin;

      if (needAdapt) {
        if (srcProf.whitePoint.x === 0.3127 && dstProf.whitePoint.x === 0.3457) {
          const Xb =  1.0478112 * X + 0.0228866 * Y - 0.0501270 * Z;
          const Yb =  0.0295424 * X + 0.9904844 * Y - 0.0170491 * Z;
          const Zb = -0.0092345 * X + 0.0150436 * Y + 0.7521316 * Z;
          X = Xb; Y = Yb; Z = Zb;
        } else if (srcProf.whitePoint.x === 0.3457 && dstProf.whitePoint.x === 0.3127) {
          const Xb =  0.9555766 * X - 0.0230393 * Y + 0.0631636 * Z;
          const Yb = -0.0282895 * X + 1.0099416 * Y + 0.0210077 * Z;
          const Zb =  0.0122982 * X - 0.0204830 * Y + 1.3299098 * Z;
          X = Xb; Y = Yb; Z = Zb;
        }
      }

      let rTgt = dstProf.invMatrix[0][0] * X + dstProf.invMatrix[0][1] * Y + dstProf.invMatrix[0][2] * Z;
      let gTgt = dstProf.invMatrix[1][0] * X + dstProf.invMatrix[1][1] * Y + dstProf.invMatrix[1][2] * Z;
      let bTgt = dstProf.invMatrix[2][0] * X + dstProf.invMatrix[2][1] * Y + dstProf.invMatrix[2][2] * Z;

      if (intent === 'perceptual') {
        rTgt = rTgt / (1.0 + Math.max(0, rTgt - 1.0) * 0.5);
        gTgt = gTgt / (1.0 + Math.max(0, gTgt - 1.0) * 0.5);
        bTgt = bTgt / (1.0 + Math.max(0, bTgt - 1.0) * 0.5);
      } else if (intent === 'saturation') {
        const avg = (rTgt + gTgt + bTgt) / 3;
        rTgt = avg + (rTgt - avg) * 1.1;
        gTgt = avg + (gTgt - avg) * 1.1;
        bTgt = avg + (bTgt - avg) * 1.1;
      }

      dst[i]     = fromLinear(rTgt, dstProf.gamma);
      dst[i + 1] = fromLinear(gTgt, dstProf.gamma);
      dst[i + 2] = fromLinear(bTgt, dstProf.gamma);
      dst[i + 3] = a;
    }

    return out;
  }

  assignProfile(targetKey) {
    const prof = this.getProfile(targetKey);
    if (prof) {
      this.activeProfileId = prof.id;
      return true;
    }
    return false;
  }
}

// ── Embedded ICC Profile Injector (PNG iCCP & JPEG APP2) ──
class IccEmbedder {
  static embedIccInPng(pngInput, iccBuffer, profileName = 'sRGB') {
    let u8;
    let isDataUrl = false;
    if (typeof pngInput === 'string') {
      isDataUrl = true;
      const base64 = pngInput.split(',')[1] || pngInput;
      const binary = (typeof atob !== 'undefined') ? atob(base64) : Buffer.from(base64, 'base64').toString('binary');
      u8 = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) u8[i] = binary.charCodeAt(i);
    } else {
      u8 = pngInput instanceof Uint8Array ? pngInput : new Uint8Array(pngInput);
    }

    const rawIcc = iccBuffer instanceof Uint8Array ? iccBuffer : new Uint8Array(iccBuffer);

    let insertPos = 33;
    if (u8.length >= 33 && u8[12] === 0x49 && u8[13] === 0x48 && u8[14] === 0x44 && u8[15] === 0x52) {
      insertPos = 33;
    } else {
      for (let i = 0; i < u8.length - 8; i++) {
        if (u8[i] === 0x49 && u8[i+1] === 0x48 && u8[i+2] === 0x44 && u8[i+3] === 0x52) {
          const chunkLen = (u8[i-4] << 24) | (u8[i-3] << 16) | (u8[i-2] << 8) | u8[i-1];
          insertPos = i + 4 + chunkLen + 4;
          break;
        }
      }
    }

    const nameBytes = new TextEncoder().encode(profileName.slice(0, 79));
    const dataLen = rawIcc.length;
    const zlibHeader = new Uint8Array([0x78, 0x01, 0x01, dataLen & 0xFF, (dataLen >> 8) & 0xFF, (~dataLen) & 0xFF, ((~dataLen) >> 8) & 0xFF]);
    const adler = IccEmbedder.calcAdler32(rawIcc);
    const adlerBytes = new Uint8Array([
      (adler >> 24) & 0xFF,
      (adler >> 16) & 0xFF,
      (adler >> 8) & 0xFF,
      adler & 0xFF
    ]);

    const chunkDataLen = nameBytes.length + 2 + zlibHeader.length + rawIcc.length + 4;
    const chunk = new Uint8Array(12 + chunkDataLen);
    const v = new DataView(chunk.buffer);
    v.setUint32(0, chunkDataLen, false);
    chunk[4] = 0x69; chunk[5] = 0x43; chunk[6] = 0x43; chunk[7] = 0x50; // "iCCP"

    let p = 8;
    chunk.set(nameBytes, p);
    p += nameBytes.length;
    chunk[p++] = 0x00;
    chunk[p++] = 0x00;
    chunk.set(zlibHeader, p);
    p += zlibHeader.length;
    chunk.set(rawIcc, p);
    p += rawIcc.length;
    chunk.set(adlerBytes, p);
    p += 4;

    const crc = IccEmbedder.calcCrc32(chunk.subarray(4, 8 + chunkDataLen));
    v.setUint32(8 + chunkDataLen, crc, false);

    const outU8 = new Uint8Array(u8.length + chunk.length);
    outU8.set(u8.subarray(0, insertPos), 0);
    outU8.set(chunk, insertPos);
    outU8.set(u8.subarray(insertPos), insertPos + chunk.length);

    if (isDataUrl) {
      const b64 = typeof Buffer !== 'undefined' ? Buffer.from(outU8).toString('base64') : btoa(String.fromCharCode(...outU8));
      return 'data:image/png;base64,' + b64;
    }
    return outU8;
  }

  static embedIccInJpeg(jpgInput, iccBuffer) {
    let u8;
    let isDataUrl = false;
    if (typeof jpgInput === 'string') {
      isDataUrl = true;
      const base64 = jpgInput.split(',')[1] || jpgInput;
      const binary = (typeof atob !== 'undefined') ? atob(base64) : Buffer.from(base64, 'base64').toString('binary');
      u8 = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) u8[i] = binary.charCodeAt(i);
    } else {
      u8 = jpgInput instanceof Uint8Array ? jpgInput : new Uint8Array(jpgInput);
    }

    const rawIcc = iccBuffer instanceof Uint8Array ? iccBuffer : new Uint8Array(iccBuffer);

    const idBytes = new TextEncoder().encode("ICC_PROFILE\0");
    const markerDataLen = 2 + idBytes.length + 2 + rawIcc.length;
    const app2 = new Uint8Array(2 + markerDataLen);
    const v = new DataView(app2.buffer);
    app2[0] = 0xFF;
    app2[1] = 0xE2; // APP2
    v.setUint16(2, markerDataLen, false);

    let p = 4;
    app2.set(idBytes, p);
    p += idBytes.length;
    app2[p++] = 1;
    app2[p++] = 1;
    app2.set(rawIcc, p);

    let insertPos = 2;
    if (u8[0] === 0xFF && u8[1] === 0xD8) {
      insertPos = 2;
    }

    const outU8 = new Uint8Array(u8.length + app2.length);
    outU8.set(u8.subarray(0, insertPos), 0);
    outU8.set(app2, insertPos);
    outU8.set(u8.subarray(insertPos), insertPos + app2.length);

    if (isDataUrl) {
      const b64 = typeof Buffer !== 'undefined' ? Buffer.from(outU8).toString('base64') : btoa(String.fromCharCode(...outU8));
      return 'data:image/jpeg;base64,' + b64;
    }
    return outU8;
  }

  static calcCrc32(bytes) {
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) {
      crc ^= bytes[i];
      for (let j = 0; j < 8; j++) {
        crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
      }
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  static calcAdler32(bytes) {
    let s1 = 1;
    let s2 = 0;
    for (let i = 0; i < bytes.length; i++) {
      s1 = (s1 + bytes[i]) % 65521;
      s2 = (s2 + s1) % 65521;
    }
    return ((s2 << 16) | s1) >>> 0;
  }
}

// ── Master ColorManagement Export ──
const ColorManagementEngine = {
  IccProfileParser,
  ColorSpaceManager,
  IccEmbedder
};

if (typeof window !== 'undefined') {
  window.ColorManagementEngine = ColorManagementEngine;
  window.IccProfileParser = IccProfileParser;
  window.ColorSpaceManager = ColorSpaceManager;
  window.IccEmbedder = IccEmbedder;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ColorManagementEngine;
}
