// ══════════════════════════════════════════════════════════════════════
// PixelForge Studio — Native 4-Channel CMYK TIFF & Prepress Plates Engine
// ══════════════════════════════════════════════════════════════════════

/**
 * CmykExportEngine
 * 
 * Provides professional commercial prepress printing parity:
 * 1. Native 4-Channel Separated CMYK TIFF Writer (PhotometricInterpretation = 5, SamplesPerPixel = 4)
 * 2. High-Fidelity RGB-to-CMYK conversion with GCR (Gray Component Replacement) & 300% TIL ink limiting
 * 3. Prepress Separation Plates generator (Cyan, Magenta, Yellow, Black film plates)
 * 4. 300 DPI resolution tags compliant with ISO 12647 / FOGRA39 / SWOP specifications
 */

class CmykExportEngine {
  /**
   * Convert RGB pixel to CMYK with GCR (Gray Component Replacement).
   * Returns values in range [0, 255] representing ink density (0 = 0% ink, 255 = 100% ink).
   * 
   * @param {number} r Red [0 - 255]
   * @param {number} g Green [0 - 255]
   * @param {number} b Blue [0 - 255]
   * @param {number} gcrStrength GCR curve strength [0.0 - 1.0] (default 0.8)
   * @param {number} maxTil Maximum Total Ink Limit (default 300%)
   * @returns {{c: number, m: number, y: number, k: number}}
   */
  static rgbToCmyk(r, g, b, gcrStrength = 0.8, maxTil = 300) {
    const normR = r / 255;
    const normG = g / 255;
    const normB = b / 255;

    // Direct CMY calculation
    let c = 1.0 - normR;
    let m = 1.0 - normG;
    let y = 1.0 - normB;

    // Common neutral gray component
    const kMin = Math.min(c, m, y);
    // Apply GCR: replace shared CMY neutral with pure black K ink
    const k = kMin * gcrStrength;

    if (k > 0) {
      c = Math.max(0, (c - k) / Math.max(0.001, 1.0 - k * 0.2));
      m = Math.max(0, (m - k) / Math.max(0.001, 1.0 - k * 0.2));
      y = Math.max(0, (y - k) / Math.max(0.001, 1.0 - k * 0.2));
    }

    // Calculate Total Area Coverage (TAC / TIL)
    let totalInk = (c + m + y + k) * 100;
    if (totalInk > maxTil) {
      const scale = (maxTil - (k * 100)) / Math.max(1, (c + m + y) * 100);
      c = Math.max(0, Math.min(1.0, c * scale));
      m = Math.max(0, Math.min(1.0, m * scale));
      y = Math.max(0, Math.min(1.0, y * scale));
    }

    return {
      c: Math.max(0, Math.min(255, Math.round(c * 255))),
      m: Math.max(0, Math.min(255, Math.round(m * 255))),
      y: Math.max(0, Math.min(255, Math.round(y * 255))),
      k: Math.max(0, Math.min(255, Math.round(k * 255)))
    };
  }

  /**
   * Convert entire RGBA ImageData into a planar or interleaved 4-channel CMYK Uint8Array buffer.
   * 
   * @param {ImageData} imgData 
   * @param {object} options 
   * @returns {Uint8Array} Interleaved CMYK bytes [C0, M0, Y0, K0, C1, M1, Y1, K1, ...]
   */
  static convertImageDataToCmykBuffer(imgData, options = {}) {
    const w = imgData.width;
    const h = imgData.height;
    const src = imgData.data;
    const cmykBuffer = new Uint8Array(w * h * 4);

    const gcr = options.gcr !== undefined ? options.gcr : 0.8;
    const til = options.til || 300;

    let dstIdx = 0;
    for (let i = 0; i < src.length; i += 4) {
      const a = src[i + 3] / 255;
      if (a === 0) {
        cmykBuffer[dstIdx++] = 0;
        cmykBuffer[dstIdx++] = 0;
        cmykBuffer[dstIdx++] = 0;
        cmykBuffer[dstIdx++] = 0;
        continue;
      }

      // Blend over white canvas background if semi-transparent
      const r = Math.round(src[i] * a + 255 * (1 - a));
      const g = Math.round(src[i + 1] * a + 255 * (1 - a));
      const b = Math.round(src[i + 2] * a + 255 * (1 - a));

      const ink = this.rgbToCmyk(r, g, b, gcr, til);
      cmykBuffer[dstIdx++] = ink.c;
      cmykBuffer[dstIdx++] = ink.m;
      cmykBuffer[dstIdx++] = ink.y;
      cmykBuffer[dstIdx++] = ink.k;
    }

    return cmykBuffer;
  }

  /**
   * PackBits run-length compression for TIFF strips.
   */
  static packBitsCompress(input) {
    const out = [];
    const len = input.length;
    let i = 0;

    while (i < len) {
      if (i + 1 < len && input[i] === input[i + 1]) {
        let runLen = 1;
        while (i + runLen < len && input[i + runLen] === input[i] && runLen < 128) {
          runLen++;
        }
        out.push(257 - runLen); // 2-byte complement (1 - runLen)
        out.push(input[i]);
        i += runLen;
      } else {
        let litLen = 0;
        while (i + litLen < len && litLen < 128) {
          if (i + litLen + 1 < len && input[i + litLen] === input[i + litLen + 1]) {
            break;
          }
          litLen++;
        }
        out.push(litLen - 1);
        for (let j = 0; j < litLen; j++) {
          out.push(input[i + j]);
        }
        i += litLen;
      }
    }

    return new Uint8Array(out);
  }

  /**
   * Encode ImageData into a standards-compliant native 4-Channel CMYK TIFF file buffer.
   * 
   * @param {ImageData} imgData 
   * @param {object} options - { dpi: 300, compression: 'packbits' | 'uncompressed', profile: 'SWOP' }
   * @returns {ArrayBuffer}
   */
  static encodeCmykTiff(imgData, options = {}) {
    const w = imgData.width;
    const h = imgData.height;
    const compressionType = options.compression === 'uncompressed' ? 1 : 32773; // 1 = None, 32773 = PackBits
    const dpi = Math.round(options.dpi || 300);
    const profileName = options.profile || 'U.S. Web Coated (SWOP) v2';

    // 1. Generate interleaved CMYK bytes
    const cmykBytes = this.convertImageDataToCmykBuffer(imgData, options);

    // 2. Compress strips if PackBits
    let stripBytes;
    if (compressionType === 1) {
      stripBytes = cmykBytes;
    } else {
      const compressedRows = [];
      let totalCompressedLen = 0;
      for (let y = 0; y < h; y++) {
        const rowStart = y * w * 4;
        const rowData = cmykBytes.subarray(rowStart, rowStart + w * 4);
        const comp = this.packBitsCompress(rowData);
        compressedRows.push(comp);
        totalCompressedLen += comp.length;
      }
      stripBytes = new Uint8Array(totalCompressedLen);
      let offset = 0;
      for (let r = 0; r < compressedRows.length; r++) {
        stripBytes.set(compressedRows[r], offset);
        offset += compressedRows[r].length;
      }
    }

    // 3. Layout TIFF Binary Structure (Little-Endian 'II')
    const numTags = 15;
    const ifdSize = 2 + numTags * 12 + 4;
    const headerSize = 8;
    const dataSectionOffset = headerSize + ifdSize;

    // Calculate metadata payloads:
    // BitsPerSample: 4 shorts = 8 bytes
    // XResolution: 2 longs = 8 bytes
    // YResolution: 2 longs = 8 bytes
    // TargetPrinter string: len + 1 bytes
    const profileAsciiBytes = new TextEncoder().encode(profileName + '\0');
    const bitsPerSampleOffset = dataSectionOffset;
    const xResOffset = bitsPerSampleOffset + 8;
    const yResOffset = xResOffset + 8;
    const profileOffset = yResOffset + 8;
    const pixelDataOffset = profileOffset + profileAsciiBytes.length + (profileAsciiBytes.length % 2);

    const totalFileSize = pixelDataOffset + stripBytes.length;
    const buffer = new ArrayBuffer(totalFileSize);
    const view = new DataView(buffer);
    const u8 = new Uint8Array(buffer);

    // 4. Write Header
    u8[0] = 0x49; u8[1] = 0x49; // 'II'
    view.setUint16(2, 42, true); // Magic 42
    view.setUint32(4, headerSize, true); // First IFD pointer

    // 5. Write IFD
    let pos = headerSize;
    view.setUint16(pos, numTags, true);
    pos += 2;

    const writeTag = (tag, type, count, valOrOff) => {
      view.setUint16(pos, tag, true);
      view.setUint16(pos + 2, type, true);
      view.setUint32(pos + 4, count, true);
      view.setUint32(pos + 8, valOrOff, true);
      pos += 12;
    };

    writeTag(0x0100, 4, 1, w); // ImageWidth
    writeTag(0x0101, 4, 1, h); // ImageLength
    writeTag(0x0102, 3, 4, bitsPerSampleOffset); // BitsPerSample [8, 8, 8, 8]
    writeTag(0x0103, 3, 1, compressionType); // Compression
    writeTag(0x0106, 3, 1, 5); // PhotometricInterpretation: 5 (Separated CMYK)
    writeTag(0x0111, 4, 1, pixelDataOffset); // StripOffsets
    writeTag(0x0115, 3, 1, 4); // SamplesPerPixel: 4
    writeTag(0x0116, 4, 1, h); // RowsPerStrip
    writeTag(0x0117, 4, 1, stripBytes.length); // StripByteCounts
    writeTag(0x011A, 5, 1, xResOffset); // XResolution (300 DPI)
    writeTag(0x011B, 5, 1, yResOffset); // YResolution (300 DPI)
    writeTag(0x011C, 3, 1, 1); // PlanarConfiguration: 1 (Chunky / Interleaved)
    writeTag(0x0128, 3, 1, 2); // ResolutionUnit: 2 (Inch)
    writeTag(0x014E, 3, 1, 1); // InkSet: 1 (CMYK)
    writeTag(0x0152, 2, profileAsciiBytes.length, profileOffset); // TargetPrinter

    view.setUint32(pos, 0, true); // Next IFD pointer (0 = end)

    // 6. Write Values Payload
    // BitsPerSample [8, 8, 8, 8]
    view.setUint16(bitsPerSampleOffset, 8, true);
    view.setUint16(bitsPerSampleOffset + 2, 8, true);
    view.setUint16(bitsPerSampleOffset + 4, 8, true);
    view.setUint16(bitsPerSampleOffset + 6, 8, true);

    // XResolution: 300 / 1
    view.setUint32(xResOffset, dpi, true);
    view.setUint32(xResOffset + 4, 1, true);

    // YResolution: 300 / 1
    view.setUint32(yResOffset, dpi, true);
    view.setUint32(yResOffset + 4, 1, true);

    // Profile ASCII
    u8.set(profileAsciiBytes, profileOffset);

    // 7. Write Pixel Strip Bytes
    u8.set(stripBytes, pixelDataOffset);

    return buffer;
  }

  /**
   * Generate 4 individual prepress separation plate ImageDatas (Cyan, Magenta, Yellow, Black).
   * Each plate is an 8-bit grayscale representation suitable for burning offset printing plates or screen films.
   * 
   * @param {ImageData} imgData 
   * @param {object} options 
   * @returns {{cyan: ImageData, magenta: ImageData, yellow: ImageData, black: ImageData}}
   */
  static generateSeparationPlates(imgData, options = {}) {
    const w = imgData.width;
    const h = imgData.height;
    const cmyk = this.convertImageDataToCmykBuffer(imgData, options);

    const plateC = new ImageData(w, h);
    const plateM = new ImageData(w, h);
    const plateY = new ImageData(w, h);
    const plateK = new ImageData(w, h);

    const dC = plateC.data;
    const dM = plateM.data;
    const dY = plateY.data;
    const dK = plateK.data;

    let srcIdx = 0;
    for (let i = 0; i < w * h * 4; i += 4) {
      const c = cmyk[srcIdx++];
      const m = cmyk[srcIdx++];
      const y = cmyk[srcIdx++];
      const k = cmyk[srcIdx++];

      // In prepress, 255 ink density = solid black ink on positive film plate
      // We render film plates such that ink density maps to visual density
      dC[i] = 255 - c; dC[i + 1] = 255 - c; dC[i + 2] = 255 - c; dC[i + 3] = 255;
      dM[i] = 255 - m; dM[i + 1] = 255 - m; dM[i + 2] = 255 - m; dM[i + 3] = 255;
      dY[i] = 255 - y; dY[i + 1] = 255 - y; dY[i + 2] = 255 - y; dY[i + 3] = 255;
      dK[i] = 255 - k; dK[i + 1] = 255 - k; dK[i + 2] = 255 - k; dK[i + 3] = 255;
    }

    return {
      cyan: plateC,
      magenta: plateM,
      yellow: plateY,
      black: plateK
    };
  }
}

if (typeof window !== 'undefined') {
  window.CmykExportEngine = CmykExportEngine;
}
if (typeof global !== 'undefined') {
  global.CmykExportEngine = CmykExportEngine;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CmykExportEngine;
}
