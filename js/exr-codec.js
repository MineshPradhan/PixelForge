// ══════════════════════════════════════════════════════════════════════
// PixelForge Studio — OpenEXR (.exr) 32-Bit Linear Floating Point Codec
// ══════════════════════════════════════════════════════════════════════

/**
 * OpenExrCodec
 * 
 * Implements Industrial Light & Magic OpenEXR format encoding & decoding
 * for high-end Visual Effects (VFX), 3D CGI rendering, and ACES filmic grading:
 * 
 * 1. OpenEXR Magic 0x01312f76 & Version 2 header parsing
 * 2. IEEE 754 16-bit Half-Float (Float16) & 32-bit Float bitwise converters
 * 3. Scanline-based multi-channel (R, G, B, A) data reconstruction
 * 4. Header attributes: channels (chlist), compression, dataWindow, displayWindow, lineOrder
 * 5. Full interoperability with HDRBuffer and ACES Filmic tone mapping
 */

class OpenExrCodec {
  static MAGIC = 0x01312f76; // 0x76, 0x2f, 0x31, 0x01

  // ── IEEE 754 Float32 <-> Float16 Converters ──

  /**
   * Convert 32-bit float to 16-bit half float word.
   */
  static toHalf(val) {
    const f32 = new Float32Array(1);
    const u32 = new Uint32Array(f32.buffer);
    f32[0] = val;
    const x = u32[0];

    const sign = (x >> 16) & 0x8000;
    let exp = ((x >> 23) & 0xff) - (127 - 15);
    let mant = x & 0x007fffff;

    if (exp <= 0) {
      if (exp < -10) return sign; // Underflow to zero
      mant = (mant | 0x00800000) >> (1 - exp);
      return sign | (mant >> 13);
    } else if (exp === 0xff - (127 - 15)) {
      if (mant === 0) return sign | 0x7c00; // Infinity
      return sign | 0x7c00 | (mant >> 13);  // NaN
    } else {
      if (exp > 30) return sign | 0x7c00; // Overflow to infinity
      return sign | (exp << 10) | (mant >> 13);
    }
  }

  /**
   * Convert 16-bit half float word to 32-bit float.
   */
  static fromHalf(half) {
    const sign = (half & 0x8000) << 16;
    const exp = (half >> 10) & 0x1f;
    const mant = half & 0x03ff;

    const f32 = new Float32Array(1);
    const u32 = new Uint32Array(f32.buffer);

    if (exp === 0) {
      if (mant === 0) {
        u32[0] = sign;
      } else {
        // Subnormal
        let e = 1;
        let m = mant;
        while ((m & 0x0400) === 0) {
          m <<= 1;
          e++;
        }
        u32[0] = sign | ((127 - 15 - e + 1) << 23) | ((m & 0x03ff) << 13);
      }
    } else if (exp === 31) {
      u32[0] = sign | 0x7f800000 | (mant << 13); // Inf or NaN
    } else {
      u32[0] = sign | ((exp + (127 - 15)) << 23) | (mant << 13);
    }

    return f32[0];
  }

  /**
   * Encode an HDRBuffer or linear float channel data into a binary OpenEXR buffer.
   * 
   * @param {HDRBuffer|{width: number, height: number, data: Float32Array}} hdr
   * @param {object} options
   * @returns {ArrayBuffer} Valid binary OpenEXR file
   */
  static encode(hdr, options = {}) {
    const w = hdr.width;
    const h = hdr.height;
    const src = hdr.data; // Float32Array [r, g, b, a, ...]

    // In OpenEXR, channels are sorted alphabetically: A, B, G, R
    // We will use 16-bit Half-Float (pixelType = 1) for broad compatibility
    const pixelType = 1; // 1 = HALF (16-bit float)
    const bytesPerSample = 2;
    const numChannels = 4; // A, B, G, R
    const channelNames = ['A', 'B', 'G', 'R'];
    const channelSrcOffsets = [3, 2, 1, 0]; // Alpha, Blue, Green, Red

    const lineBytes = w * bytesPerSample * numChannels;

    // 1. Build Header
    const parts = [];

    // Magic number: 0x76, 0x2f, 0x31, 0x01
    const magicView = new DataView(new ArrayBuffer(8));
    magicView.setUint32(0, this.MAGIC, true);
    magicView.setUint8(4, 2); // Version 2
    magicView.setUint8(5, 0); // Single-part scanline
    magicView.setUint8(6, 0);
    magicView.setUint8(7, 0);
    parts.push(new Uint8Array(magicView.buffer));

    // Helper to write null-terminated string
    const strBytes = (s) => new TextEncoder().encode(s + '\0');

    // Helper to write attribute
    const writeAttr = (name, type, dataBytes) => {
      const n = strBytes(name);
      const t = strBytes(type);
      const lenView = new DataView(new ArrayBuffer(4));
      lenView.setUint32(0, dataBytes.length, true);

      parts.push(n);
      parts.push(t);
      parts.push(new Uint8Array(lenView.buffer));
      parts.push(dataBytes);
    };

    // Attribute: channels (chlist)
    // For each channel: name\0 + pixelType(int32) + pLinear(uint8) + reserved(3 bytes) + xSampling(int32) + ySampling(int32)
    const chListParts = [];
    channelNames.forEach(cn => {
      chListParts.push(strBytes(cn));
      const chView = new DataView(new ArrayBuffer(16));
      chView.setInt32(0, pixelType, true);
      chView.setUint8(4, 0); // pLinear
      chView.setUint8(5, 0);
      chView.setUint8(6, 0);
      chView.setUint8(7, 0);
      chView.setInt32(8, 1, true);  // xSampling
      chView.setInt32(12, 1, true); // ySampling
      chListParts.push(new Uint8Array(chView.buffer));
    });
    chListParts.push(new Uint8Array([0])); // End of chlist
    const totalChLen = chListParts.reduce((acc, p) => acc + p.length, 0);
    const chData = new Uint8Array(totalChLen);
    let chOff = 0;
    chListParts.forEach(p => { chData.set(p, chOff); chOff += p.length; });
    writeAttr('channels', 'chlist', chData);

    // Attribute: compression (compression = 0: NONE)
    writeAttr('compression', 'compression', new Uint8Array([0]));

    // Attribute: dataWindow (box2i: minX, minY, maxX, maxY)
    const boxView = new DataView(new ArrayBuffer(16));
    boxView.setInt32(0, 0, true);
    boxView.setInt32(4, 0, true);
    boxView.setInt32(8, w - 1, true);
    boxView.setInt32(12, h - 1, true);
    writeAttr('dataWindow', 'box2i', new Uint8Array(boxView.buffer));

    // Attribute: displayWindow (box2i)
    writeAttr('displayWindow', 'box2i', new Uint8Array(boxView.buffer));

    // Attribute: lineOrder (lineOrder = 0: INCREASING_Y)
    writeAttr('lineOrder', 'lineOrder', new Uint8Array([0]));

    // Attribute: pixelAspectRatio (float = 1.0)
    const aspView = new DataView(new ArrayBuffer(4));
    aspView.setFloat32(0, 1.0, true);
    writeAttr('pixelAspectRatio', 'float', new Uint8Array(aspView.buffer));

    // Attribute: screenWindowCenter (v2f = [0.0, 0.0])
    const scView = new DataView(new ArrayBuffer(8));
    scView.setFloat32(0, 0.0, true);
    scView.setFloat32(4, 0.0, true);
    writeAttr('screenWindowCenter', 'v2f', new Uint8Array(scView.buffer));

    // Attribute: screenWindowWidth (float = 1.0)
    writeAttr('screenWindowWidth', 'float', new Uint8Array(aspView.buffer));

    // End of Header
    parts.push(new Uint8Array([0]));

    // Compute Header Byte Length
    const headerLen = parts.reduce((acc, p) => acc + p.length, 0);

    // 2. Scanline Offset Table (h entries of 64-bit uints = h * 8 bytes)
    const offsetTableSize = h * 8;
    const scanlineBlockSize = 8 + lineBytes; // 4 bytes y + 4 bytes size + pixel data
    const firstScanlineOffset = headerLen + offsetTableSize;

    const offsetTableView = new DataView(new ArrayBuffer(offsetTableSize));
    for (let y = 0; y < h; y++) {
      const off = firstScanlineOffset + y * scanlineBlockSize;
      offsetTableView.setUint32(y * 8, off, true);
      offsetTableView.setUint32(y * 8 + 4, 0, true); // Upper 32 bits
    }
    parts.push(new Uint8Array(offsetTableView.buffer));

    // 3. Scanline Pixel Blocks
    for (let y = 0; y < h; y++) {
      const blockBuf = new ArrayBuffer(scanlineBlockSize);
      const bView = new DataView(blockBuf);
      bView.setInt32(0, y, true);
      bView.setInt32(4, lineBytes, true);

      let channelWriteOff = 8;
      // In OpenEXR, each channel's scanline row is stored contiguously: A, then B, then G, then R
      for (let c = 0; c < numChannels; c++) {
        const cOffset = channelSrcOffsets[c];
        for (let x = 0; x < w; x++) {
          const srcIdx = (y * w + x) * 4 + cOffset;
          const floatVal = src[srcIdx] !== undefined ? src[srcIdx] : 1.0;
          const halfVal = this.toHalf(floatVal);
          bView.setUint16(channelWriteOff, halfVal, true);
          channelWriteOff += 2;
        }
      }

      parts.push(new Uint8Array(blockBuf));
    }

    // 4. Assemble Final ArrayBuffer
    const totalFileSize = parts.reduce((acc, p) => acc + p.length, 0);
    const finalBuffer = new ArrayBuffer(totalFileSize);
    const finalU8 = new Uint8Array(finalBuffer);

    let curPos = 0;
    parts.forEach(p => {
      finalU8.set(p, curPos);
      curPos += p.length;
    });

    return finalBuffer;
  }

  /**
   * Decode an OpenEXR binary buffer into linear Float32Array channel data.
   * 
   * @param {ArrayBuffer|Uint8Array} buffer 
   * @returns {{width: number, height: number, data: Float32Array}}
   */
  static decode(buffer) {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

    if (bytes.length < 32) {
      throw new Error('File too small to be a valid OpenEXR image.');
    }

    // 1. Verify Magic
    const magic = view.getUint32(0, true);
    if (magic !== this.MAGIC) {
      throw new Error(`Invalid OpenEXR magic signature: 0x${magic.toString(16)}. Expected 0x01312f76.`);
    }

    let pos = 8; // Skip magic and version

    // 2. Parse Header Attributes
    const readStr = () => {
      let str = '';
      while (pos < bytes.length) {
        const c = bytes[pos++];
        if (c === 0) break;
        str += String.fromCharCode(c);
      }
      return str;
    };

    let width = 0, height = 0;
    const channels = [];

    while (pos < bytes.length) {
      const attrName = readStr();
      if (!attrName) break; // End of header

      const attrType = readStr();
      const attrSize = view.getUint32(pos, true);
      pos += 4;
      const attrDataPos = pos;

      if (attrName === 'dataWindow' && attrSize >= 16) {
        const xMin = view.getInt32(attrDataPos, true);
        const yMin = view.getInt32(attrDataPos + 4, true);
        const xMax = view.getInt32(attrDataPos + 8, true);
        const yMax = view.getInt32(attrDataPos + 12, true);
        width = xMax - xMin + 1;
        height = yMax - yMin + 1;
      } else if (attrName === 'channels') {
        let chPos = attrDataPos;
        while (chPos < attrDataPos + attrSize) {
          let chName = '';
          while (chPos < bytes.length) {
            const c = bytes[chPos++];
            if (c === 0) break;
            chName += String.fromCharCode(c);
          }
          if (!chName) break;
          const pType = view.getInt32(chPos, true);
          chPos += 16; // Skip type (4) + pLinear/reserved (4) + x/ySampling (8)
          channels.push({ name: chName, type: pType });
        }
      }

      pos = attrDataPos + attrSize;
    }

    if (width <= 0 || height <= 0) {
      throw new Error('Invalid OpenEXR dimensions in dataWindow.');
    }

    // Sort channels alphabetically as per OpenEXR spec
    channels.sort((a, b) => a.name.localeCompare(b.name));

    // 3. Parse Scanline Offset Table
    const offsets = [];
    for (let y = 0; y < height; y++) {
      if (pos + 8 > bytes.length) break;
      const off = view.getUint32(pos, true);
      offsets.push(off);
      pos += 8;
    }

    // 4. Decode Scanlines into Float32Array [r, g, b, a, ...]
    const outData = new Float32Array(width * height * 4);
    // Initialize alpha to 1.0
    for (let i = 3; i < outData.length; i += 4) {
      outData[i] = 1.0;
    }

    offsets.forEach((off, rowIdx) => {
      if (off + 8 >= bytes.length) return;

      const y = view.getInt32(off, true);
      const dataSize = view.getInt32(off + 4, true);
      let pixelPos = off + 8;

      channels.forEach(ch => {
        const isFloat = ch.type === 2; // 2 = FLOAT (32-bit)
        const bytesPerPx = isFloat ? 4 : 2;

        let channelDestOffset = 0;
        if (ch.name === 'R') channelDestOffset = 0;
        else if (ch.name === 'G') channelDestOffset = 1;
        else if (ch.name === 'B') channelDestOffset = 2;
        else if (ch.name === 'A') channelDestOffset = 3;
        else {
          pixelPos += width * bytesPerPx;
          return;
        }

        for (let x = 0; x < width; x++) {
          let val = 0.0;
          if (isFloat) {
            val = view.getFloat32(pixelPos, true);
            pixelPos += 4;
          } else {
            const hVal = view.getUint16(pixelPos, true);
            val = this.fromHalf(hVal);
            pixelPos += 2;
          }

          const outIdx = (y * width + x) * 4 + channelDestOffset;
          outData[outIdx] = val;
        }
      });
    });

    return {
      width,
      height,
      data: outData
    };
  }

  /**
   * Convert OpenEXR linear float data to 8-bit sRGB ImageData with ACES Filmic tonemapping.
   */
  static toImageData(exrDecoded, exposure = 0.0) {
    const w = exrDecoded.width;
    const h = exrDecoded.height;
    const src = exrDecoded.data;
    const outImg = new ImageData(w, h);
    const dst = outImg.data;

    const expScale = Math.pow(2.0, exposure);

    for (let i = 0; i < src.length; i += 4) {
      let r = src[i] * expScale;
      let g = src[i + 1] * expScale;
      let b = src[i + 2] * expScale;
      let a = src[i + 3];

      // ACES Filmic Tone Mapping approximation
      const aces = (x) => {
        const a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
        return (x * (a * x + b)) / (x * (c * x + d) + e);
      };

      r = Math.max(0, Math.min(1.0, aces(r)));
      g = Math.max(0, Math.min(1.0, aces(g)));
      b = Math.max(0, Math.min(1.0, aces(b)));

      // sRGB Gamma
      const gamma = (x) => x <= 0.0031308 ? x * 12.92 : 1.055 * Math.pow(x, 1.0 / 2.4) - 0.055;

      dst[i]     = Math.max(0, Math.min(255, Math.round(gamma(r) * 255)));
      dst[i + 1] = Math.max(0, Math.min(255, Math.round(gamma(g) * 255)));
      dst[i + 2] = Math.max(0, Math.min(255, Math.round(gamma(b) * 255)));
      dst[i + 3] = Math.max(0, Math.min(255, Math.round(a * 255)));
    }

    return outImg;
  }
}

if (typeof window !== 'undefined') {
  window.OpenExrCodec = OpenExrCodec;
}
if (typeof global !== 'undefined') {
  global.OpenExrCodec = OpenExrCodec;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = OpenExrCodec;
}
