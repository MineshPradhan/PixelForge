/**
 * PixelForge Studio — Adobe Photoshop (.psd) Binary Interoperability & Pro Export Engine
 * Full specification implementation for Adobe Photoshop 8BPS format:
 *   - File Header (8BPS, Version 1, Channels, Dimensions, Depth, ColorMode)
 *   - Image Resources (ResolutionInfo DPI metadata)
 *   - Layer & Mask Information (Layer Records, Planar Channel Data, PackBits RLE, Blend Modes, Opacity, Masks)
 *   - Merged Composite Image Data (PackBits RLE Planar RGB/RGBA)
 *   - Pro Export: WebP, Scalable Vector SVG, High-Res Print DPI
 */

// ── Binary Byte Stream Helper ──
class ByteStream {
  constructor(bufferOrLength) {
    if (typeof bufferOrLength === 'number') {
      this.buffer = new ArrayBuffer(bufferOrLength);
      this.u8 = new Uint8Array(this.buffer);
      this.view = new DataView(this.buffer);
      this.pos = 0;
      this.length = bufferOrLength;
    } else {
      if (bufferOrLength instanceof ArrayBuffer) {
        this.buffer = bufferOrLength;
        this.u8 = new Uint8Array(this.buffer);
      } else if (ArrayBuffer.isView(bufferOrLength)) {
        this.buffer = bufferOrLength.buffer.slice(
          bufferOrLength.byteOffset,
          bufferOrLength.byteOffset + bufferOrLength.byteLength
        );
        this.u8 = new Uint8Array(this.buffer);
      } else {
        throw new Error('Unsupported buffer type');
      }
      this.view = new DataView(this.buffer);
      this.pos = 0;
      this.length = this.u8.length;
    }
  }

  ensureCapacity(extraBytes) {
    if (this.pos + extraBytes > this.buffer.byteLength) {
      const newCap = Math.max(this.buffer.byteLength * 2, this.pos + extraBytes + 65536);
      const newBuf = new ArrayBuffer(newCap);
      const newU8 = new Uint8Array(newBuf);
      newU8.set(this.u8);
      this.buffer = newBuf;
      this.u8 = newU8;
      this.view = new DataView(this.buffer);
    }
  }

  // ── Read Primitives ──
  readUint8() {
    return this.u8[this.pos++];
  }

  readInt8() {
    const val = this.u8[this.pos++];
    return val >= 128 ? val - 256 : val;
  }

  readUint16() {
    const val = this.view.getUint16(this.pos, false);
    this.pos += 2;
    return val;
  }

  readInt16() {
    const val = this.view.getInt16(this.pos, false);
    this.pos += 2;
    return val;
  }

  readUint32() {
    const val = this.view.getUint32(this.pos, false);
    this.pos += 4;
    return val;
  }

  readInt32() {
    const val = this.view.getInt32(this.pos, false);
    this.pos += 4;
    return val;
  }

  readUint64() {
    const val = this.view.getBigUint64(this.pos, false);
    this.pos += 8;
    return Number(val);
  }

  readString(len) {
    let str = '';
    for (let i = 0; i < len; i++) {
      str += String.fromCharCode(this.u8[this.pos++]);
    }
    return str;
  }

  readBytes(len) {
    const sub = this.u8.subarray(this.pos, this.pos + len);
    this.pos += len;
    return new Uint8Array(sub);
  }

  skip(bytes) {
    this.pos += bytes;
  }

  // ── Write Primitives ──
  writeUint8(val) {
    this.ensureCapacity(1);
    this.u8[this.pos++] = val & 0xff;
  }

  writeInt8(val) {
    this.ensureCapacity(1);
    this.u8[this.pos++] = (val < 0 ? val + 256 : val) & 0xff;
  }

  writeUint16(val) {
    this.ensureCapacity(2);
    this.view.setUint16(this.pos, val, false);
    this.pos += 2;
  }

  writeInt16(val) {
    this.ensureCapacity(2);
    this.view.setInt16(this.pos, val, false);
    this.pos += 2;
  }

  writeUint32(val) {
    this.ensureCapacity(4);
    this.view.setUint32(this.pos, val, false);
    this.pos += 4;
  }

  writeInt32(val) {
    this.ensureCapacity(4);
    this.view.setInt32(this.pos, val, false);
    this.pos += 4;
  }

  writeUint64(val) {
    this.ensureCapacity(8);
    this.view.setBigUint64(this.pos, BigInt(val), false);
    this.pos += 8;
  }

  writeString(str) {
    this.ensureCapacity(str.length);
    for (let i = 0; i < str.length; i++) {
      this.u8[this.pos++] = str.charCodeAt(i) & 0xff;
    }
  }

  writeBytes(bytes) {
    this.ensureCapacity(bytes.length);
    this.u8.set(bytes, this.pos);
    this.pos += bytes.length;
  }

  getTrimmedUint8Array() {
    return this.u8.subarray(0, this.pos);
  }
}

// ── PackBits RLE Compression Engine ──
const PackBits = {
  /**
   * Decompress PackBits RLE scanline into target Uint8Array
   */
  decompress(src, srcOffset, srcLen, dst, dstOffset, expectedLen) {
    let s = srcOffset;
    const end = srcOffset + srcLen;
    let d = dstOffset;
    const targetEnd = dstOffset + expectedLen;

    while (s < end && d < targetEnd) {
      let b = src[s++];
      if (b >= 128) b -= 256; // signed int8

      if (b >= 0) {
        // Copy next b + 1 bytes literally
        const count = b + 1;
        for (let i = 0; i < count && d < targetEnd && s < end; i++) {
          dst[d++] = src[s++];
        }
      } else if (b >= -127) {
        // Repeat next single byte 1 - b times
        const count = 1 - b;
        if (s >= end) break;
        const val = src[s++];
        for (let i = 0; i < count && d < targetEnd; i++) {
          dst[d++] = val;
        }
      }
      // b == -128 is a no-op
    }
    return s - srcOffset;
  },

  /**
   * Compress single channel scanline bytes using Adobe PackBits RLE
   */
  compressScanline(src, srcOffset, len) {
    const out = [];
    let i = srcOffset;
    const max = srcOffset + len;

    while (i < max) {
      // Check for run of identical bytes
      let runLen = 1;
      while (i + runLen < max && runLen < 128 && src[i + runLen] === src[i]) {
        runLen++;
      }

      if (runLen >= 3) {
        // Output RLE repeat block: -(runLen - 1) followed by byte
        out.push(1 - runLen < 0 ? (1 - runLen) + 256 : 1 - runLen);
        out.push(src[i]);
        i += runLen;
      } else {
        // Gather literal bytes until a run of 3+ identical bytes or limit 128
        let litStart = i;
        let litLen = 0;

        while (i < max && litLen < 128) {
          if (i + 2 < max && src[i] === src[i + 1] && src[i] === src[i + 2]) {
            break; // Stop literal run to allow RLE repeat
          }
          litLen++;
          i++;
        }

        if (litLen > 0) {
          // Output literal block: (litLen - 1) followed by literal bytes
          out.push(litLen - 1);
          for (let j = 0; j < litLen; j++) {
            out.push(src[litStart + j]);
          }
        }
      }
    }

    return new Uint8Array(out);
  }
};

// ── Photoshop Blend Mode Mappings (All 27 Photoshop Modes) ──
const BlendModes = {
  toPsd: {
    'source-over': 'norm',
    'dissolve': 'diss',
    'darken': 'dark',
    'multiply': 'mul ',
    'color-burn': 'idiv',
    'linear-burn': 'lbrn',
    'darker-color': 'dkCl',
    'lighten': 'lite',
    'screen': 'scrn',
    'color-dodge': 'div ',
    'lighter': 'lddg',
    'lighter-color': 'lgCl',
    'overlay': 'over',
    'soft-light': 'sLit',
    'hard-light': 'hLit',
    'vivid-light': 'vLit',
    'linear-light': 'lLit',
    'pin-light': 'pLit',
    'hard-mix': 'hMix',
    'difference': 'diff',
    'exclusion': 'smud',
    'subtract': 'fsub',
    'divide': 'fdiv',
    'hue': 'hue ',
    'saturation': 'sat ',
    'color': 'colr',
    'luminosity': 'lum ',
    'pass-through': 'pass'
  },
  fromPsd: {
    'norm': 'source-over',
    'diss': 'dissolve',
    'dark': 'darken',
    'mul ': 'multiply',
    'idiv': 'color-burn',
    'lbrn': 'linear-burn',
    'dkCl': 'darker-color',
    'lite': 'lighten',
    'scrn': 'screen',
    'div ': 'color-dodge',
    'lddg': 'lighter',
    'lgCl': 'lighter-color',
    'over': 'overlay',
    'sLit': 'soft-light',
    'hLit': 'hard-light',
    'vLit': 'vivid-light',
    'lLit': 'linear-light',
    'pLit': 'pin-light',
    'hMix': 'hard-mix',
    'diff': 'difference',
    'smud': 'exclusion',
    'fsub': 'subtract',
    'fdiv': 'divide',
    'hue ': 'hue',
    'sat ': 'saturation',
    'colr': 'color',
    'lum ': 'luminosity',
    'pass': 'pass-through'
  }
};

/// ── PSD Parser & Reader ──
class PsdReader {
  static parse(buffer) {
    const stream = new ByteStream(buffer);

    // 1. Header
    const signature = stream.readString(4);
    if (signature !== '8BPS') {
      throw new Error(`Invalid PSD signature: "${signature}". Expected "8BPS".`);
    }

    const version = stream.readUint16();
    if (version !== 1 && version !== 2) {
      throw new Error(`Unsupported PSD/PSB version: ${version}. Expected 1 (PSD) or 2 (PSB).`);
    }
    const isPsb = (version === 2);

    stream.skip(6); // Reserved bytes
    const channels = stream.readUint16();
    const height = stream.readUint32();
    const width = stream.readUint32();
    const depth = stream.readUint16();
    const colorMode = stream.readUint16();

    if (depth !== 8) {
      throw new Error(`Unsupported bit depth: ${depth}-bit. PixelForge supports 8-bit PSDs.`);
    }
    if (colorMode !== 3 && colorMode !== 1) {
      // 3 = RGB, 1 = Grayscale
      console.warn(`Color mode is ${colorMode}. Attempting to parse as RGB.`);
    }

    // 2. Color Mode Data
    const colorModeLen = stream.readUint32();
    stream.skip(colorModeLen);

    // 3. Image Resources
    const imgResLen = stream.readUint32();
    const imgResEnd = stream.pos + imgResLen;
    let dpi = 72;

    while (stream.pos < imgResEnd - 4) {
      const resSig = stream.readString(4);
      if (resSig !== '8BIM') break;
      const resId = stream.readUint16();
      const nameLen = stream.readUint8();
      stream.skip(nameLen);
      if ((nameLen + 1) % 2 !== 0) stream.skip(1); // Even padding
      const resDataSize = stream.readUint32();
      const resDataEnd = stream.pos + resDataSize;

      if (resId === 0x03ED && resDataSize >= 16) {
        // ResolutionInfo: Fixed-point 16.16
        const hRes = stream.readUint32() >> 16;
        if (hRes > 0) dpi = hRes;
      }

      stream.pos = resDataEnd + (resDataSize % 2 !== 0 ? 1 : 0);
    }
    stream.pos = imgResEnd;

    // 4. Layer and Mask Information Section
    const layerMaskLen = isPsb ? stream.readUint64() : stream.readUint32();
    const layerMaskEnd = stream.pos + layerMaskLen;
    const layers = [];

    if (layerMaskLen > 0) {
      const layerInfoLen = isPsb ? stream.readUint64() : stream.readUint32();
      const layerInfoEnd = stream.pos + layerInfoLen;

      if (layerInfoLen > 0) {
        const rawLayerCount = stream.readInt16();
        const layerCount = Math.abs(rawLayerCount);

        const layerRecords = [];

        // Parse Layer Records
        for (let i = 0; i < layerCount; i++) {
          const top = stream.readInt32();
          const left = stream.readInt32();
          const bottom = stream.readInt32();
          const right = stream.readInt32();
          const numChannels = stream.readUint16();

          const channelInfo = [];
          for (let ch = 0; ch < numChannels; ch++) {
            const chId = stream.readInt16();
            const chLen = isPsb ? stream.readUint64() : stream.readUint32();
            channelInfo.push({ id: chId, length: chLen });
          }

          const blendSig = stream.readString(4);
          const blendKey = stream.readString(4);
          const opacity = stream.readUint8();
          const clipping = stream.readUint8();
          const flags = stream.readUint8();
          const visible = (flags & 2) === 0;
          stream.skip(1); // filler

          const extraLen = stream.readUint32();
          const extraEnd = stream.pos + extraLen;

          // Mask data size
          let hasMask = false;
          let maskBounds = null;
          const maskLen = stream.readUint32();
          if (maskLen > 0) {
            hasMask = true;
            maskBounds = {
              top: stream.readInt32(),
              left: stream.readInt32(),
              bottom: stream.readInt32(),
              right: stream.readInt32(),
              defaultColor: stream.readUint8()
            };
            stream.skip(maskLen - 17);
          }

          // Blending ranges size
          const blendRangesLen = stream.readUint32();
          stream.skip(blendRangesLen);

          // Layer Name (Pascal string)
          const nameLen = stream.readUint8();
          let layerName = stream.readString(nameLen);
          const namePadding = (4 - ((nameLen + 1) % 4)) % 4;
          stream.skip(namePadding);

          // Additional Layer Information (Tagged blocks: luni, lsct, etc.)
          let isGroup = false;
          let groupCollapsed = false;

          while (stream.pos < extraEnd - 8) {
            const tagSig = stream.readString(4);
            if (tagSig !== '8BIM' && tagSig !== '8B64') break;
            const tagKey = stream.readString(4);
            const tagLen = stream.readUint32();
            const tagDataEnd = stream.pos + tagLen;

            if (tagKey === 'luni') {
              // Unicode layer name
              const charCount = stream.readUint32();
              let uName = '';
              for (let c = 0; c < charCount; c++) {
                uName += String.fromCharCode(stream.readUint16());
              }
              if (uName) layerName = uName;
            } else if (tagKey === 'lsct') {
              // Section divider (Group folder)
              const type = stream.readUint32();
              if (type === 1 || type === 2) {
                isGroup = true;
                groupCollapsed = (type === 2);
              }
            }

            stream.pos = tagDataEnd + (tagLen % 2 !== 0 ? 1 : 0);
          }

          stream.pos = extraEnd;

          const lWidth = Math.max(0, right - left);
          const lHeight = Math.max(0, bottom - top);

          layerRecords.push({
            top,
            left,
            bottom,
            right,
            width: lWidth,
            height: lHeight,
            numChannels,
            channelInfo,
            blendMode: BlendModes.fromPsd[blendKey] || 'source-over',
            opacity: Math.round((opacity / 255) * 100),
            clipping: clipping === 1,
            visible,
            hasMask,
            maskBounds,
            name: layerName || `Layer ${i + 1}`,
            isGroup,
            groupCollapsed
          });
        }

        // Parse Channel Image Data for each layer record
        for (let i = 0; i < layerCount; i++) {
          const rec = layerRecords[i];
          const lW = rec.width;
          const lH = rec.height;
          const numPixels = lW * lH;

          const planarChannels = new Map();

          for (let ch = 0; ch < rec.channelInfo.length; ch++) {
            const chMeta = rec.channelInfo[ch];
            const chId = chMeta.id;
            const chLen = chMeta.length;
            if (chLen <= 2 || numPixels === 0) {
              stream.skip(chLen);
              continue;
            }

            const compMode = stream.readUint16();
            const rawChannelBuf = new Uint8Array(numPixels);

            if (compMode === 0) {
              // Raw data
              const chunk = stream.readBytes(numPixels);
              rawChannelBuf.set(chunk);
            } else if (compMode === 1) {
              // PackBits RLE
              // Line lengths array (2 bytes * lH in PSD, 4 bytes * lH in PSB)
              const lineLens = [];
              for (let row = 0; row < lH; row++) {
                lineLens.push(isPsb ? stream.readUint32() : stream.readUint16());
              }

              // Decompress each row
              let dstOff = 0;
              for (let row = 0; row < lH; row++) {
                const rleRowLen = lineLens[row];
                const rleRow = stream.readBytes(rleRowLen);
                PackBits.decompress(rleRow, 0, rleRowLen, rawChannelBuf, dstOff, lW);
                dstOff += lW;
              }
            } else {
              // Unsupported compression (ZIP), skip
              stream.skip(chLen - 2);
            }

            planarChannels.set(chId, rawChannelBuf);
          }

          // Synthesize RGBA ImageData from planar R (0), G (1), B (2), A (-1)
          let rgbaData = null;
          if (numPixels > 0) {
            rgbaData = new Uint8ClampedArray(numPixels * 4);
            const rChan = planarChannels.get(0);
            const gChan = planarChannels.get(1);
            const bChan = planarChannels.get(2);
            const aChan = planarChannels.get(-1);

            for (let p = 0; p < numPixels; p++) {
              const idx = p * 4;
              rgbaData[idx]     = rChan ? rChan[p] : 0;
              rgbaData[idx + 1] = gChan ? gChan[p] : 0;
              rgbaData[idx + 2] = bChan ? bChan[p] : 0;
              rgbaData[idx + 3] = aChan ? aChan[p] : 255;
            }
          }

          // User Layer Mask (-2)
          let maskData = null;
          const maskChan = planarChannels.get(-2);
          if (maskChan && numPixels > 0) {
            maskData = maskChan;
          }

          layers.push({
            name: rec.name,
            top: rec.top,
            left: rec.left,
            width: rec.width,
            height: rec.height,
            opacity: rec.opacity,
            blendMode: rec.blendMode,
            visible: rec.visible,
            clipping: rec.clipping,
            hasMask: rec.hasMask || !!maskData,
            isGroup: rec.isGroup,
            groupCollapsed: rec.groupCollapsed,
            rgbaData,
            maskData
          });
        }
      }
    }

    stream.pos = layerMaskEnd;

    // 5. Composite Image Data (at EOF)
    let compositeRgba = null;
    if (stream.pos < stream.length) {
      const compMode = stream.readUint16();
      const numCompPixels = width * height;
      const compChannels = channels >= 3 ? channels : 3;

      if (compMode === 0) {
        // Raw planar
        const rawPlanar = stream.readBytes(numCompPixels * compChannels);
        compositeRgba = new Uint8ClampedArray(numCompPixels * 4);
        for (let p = 0; p < numCompPixels; p++) {
          const idx = p * 4;
          compositeRgba[idx]     = rawPlanar[p];
          compositeRgba[idx + 1] = rawPlanar[numCompPixels + p];
          compositeRgba[idx + 2] = rawPlanar[numCompPixels * 2 + p];
          compositeRgba[idx + 3] = compChannels >= 4 ? rawPlanar[numCompPixels * 3 + p] : 255;
        }
      } else if (compMode === 1) {
        // PackBits RLE planar
        const scanlineLens = [];
        for (let ch = 0; ch < compChannels; ch++) {
          for (let row = 0; row < height; row++) {
            scanlineLens.push(isPsb ? stream.readUint32() : stream.readUint16());
          }
        }

        const planarBuf = new Uint8Array(numCompPixels * compChannels);
        let dstOff = 0;
        let lineIdx = 0;

        for (let ch = 0; ch < compChannels; ch++) {
          for (let row = 0; row < height; row++) {
            const rleLen = scanlineLens[lineIdx++];
            const rleBytes = stream.readBytes(rleLen);
            PackBits.decompress(rleBytes, 0, rleLen, planarBuf, dstOff, width);
            dstOff += width;
          }
        }

        compositeRgba = new Uint8ClampedArray(numCompPixels * 4);
        for (let p = 0; p < numCompPixels; p++) {
          const idx = p * 4;
          compositeRgba[idx]     = planarBuf[p];
          compositeRgba[idx + 1] = planarBuf[numCompPixels + p];
          compositeRgba[idx + 2] = planarBuf[numCompPixels * 2 + p];
          compositeRgba[idx + 3] = compChannels >= 4 ? planarBuf[numCompPixels * 3 + p] : 255;
        }
      }
    }

    return {
      width,
      height,
      channels,
      dpi,
      layers,
      compositeRgba,
      version,
      isPsb
    };
  }
}

// ── Photoshop PSD & PSB Binary Writer ──
class PsdWriter {
  /**
   * Generates a fully compliant, multi-layer Adobe Photoshop (.psd / .psb) binary buffer
   * @param {Object} projectData - { width, height, layers: [{ name, canvas, opacity, blendMode, visible, hasMask, maskCanvas }] }
   * @param {Object} [options] - { isPsb: boolean }
   */
  static write(projectData, options = {}) {
    const width = projectData.width;
    const height = projectData.height;
    const isPsb = !!(options.isPsb || projectData.isPsb || projectData.format === 'psb' || width > 30000 || height > 30000);
    const layers = projectData.layers.filter(l => l.type !== 'group'); // Non-group visual layers
    const layerCount = layers.length;

    // Estimate initial capacity (1MB minimum, will auto-grow)
    const stream = new ByteStream(1024 * 1024);

    // ── 1. File Header (26 bytes) ──
    stream.writeString('8BPS'); // Signature
    stream.writeUint16(isPsb ? 2 : 1); // Version 1 (PSD) or Version 2 (PSB)
    stream.writeBytes(new Uint8Array(6)); // Reserved
    stream.writeUint16(4);      // Channels: 4 (RGBA)
    stream.writeUint32(height); // Height (up to 300,000 for PSB)
    stream.writeUint32(width);  // Width (up to 300,000 for PSB)
    stream.writeUint16(8);      // Depth: 8 bits
    stream.writeUint16(3);      // ColorMode: 3 (RGB)

    // ── 2. Color Mode Data (4 bytes length: 0 for RGB) ──
    stream.writeUint32(0);

    // ── 3. Image Resources Section (DPI metadata) ──
    const resStream = new ByteStream(256);
    // ResolutionInfo Block (0x03ED)
    resStream.writeString('8BIM');
    resStream.writeUint16(0x03ED);
    resStream.writeUint16(0); // Empty Pascal string name (length 0 + 1 pad byte)
    resStream.writeUint32(16); // 16 bytes payload
    resStream.writeUint32(72 << 16); // 72 DPI (16.16 fixed-point)
    resStream.writeUint16(1); // Unit: inches
    resStream.writeUint16(1); // Width display unit: inches
    resStream.writeUint32(72 << 16); // 72 DPI vertical
    resStream.writeUint16(1);
    resStream.writeUint16(1);

    const resBytes = resStream.getTrimmedUint8Array();
    stream.writeUint32(resBytes.length);
    stream.writeBytes(resBytes);

    // ── 4. Layer & Mask Information Section ──
    const lmStartPos = stream.pos;
    if (isPsb) {
      stream.writeUint64(0); // 8-byte length placeholder for PSB
    } else {
      stream.writeUint32(0); // 4-byte placeholder for PSD
    }

    const layerInfoStartPos = stream.pos;
    if (isPsb) {
      stream.writeUint64(0); // 8-byte layer info length placeholder for PSB
    } else {
      stream.writeUint32(0); // 4-byte placeholder for PSD
    }

    // Layer count: negative indicates first alpha channel is transparency
    stream.writeInt16(-layerCount);

    // Prepare compressed channel buffers for each layer
    const preparedLayers = [];

    layers.forEach(layer => {
      const ctx = layer.ctx;
      const imgData = ctx.getImageData(0, 0, width, height);
      const data = imgData.data;

      const numPixels = width * height;
      const planarR = new Uint8Array(numPixels);
      const planarG = new Uint8Array(numPixels);
      const planarB = new Uint8Array(numPixels);
      const planarA = new Uint8Array(numPixels);

      for (let p = 0; p < numPixels; p++) {
        const idx = p * 4;
        planarR[p] = data[idx];
        planarG[p] = data[idx + 1];
        planarB[p] = data[idx + 2];
        planarA[p] = data[idx + 3];
      }

      // PackBits compress each channel (R, G, B, A)
      const compressChannel = (chanData) => {
        const rleRows = [];
        const lineLens = [];
        for (let row = 0; row < height; row++) {
          const rle = PackBits.compressScanline(chanData, row * width, width);
          rleRows.push(rle);
          lineLens.push(rle.length);
        }

        // Total channel size = 2 (compMode) + height * (isPsb ? 4 : 2) (row lens) + sum of row bytes
        const totalRleBytes = lineLens.reduce((a, b) => a + b, 0);
        const rowLenBytes = isPsb ? 4 : 2;
        const chBuf = new ByteStream(2 + height * rowLenBytes + totalRleBytes);
        chBuf.writeUint16(1); // Compression: RLE
        lineLens.forEach(len => isPsb ? chBuf.writeUint32(len) : chBuf.writeUint16(len));
        rleRows.forEach(rle => chBuf.writeBytes(rle));
        return chBuf.getTrimmedUint8Array();
      };

      const chR = compressChannel(planarR);
      const chG = compressChannel(planarG);
      const chB = compressChannel(planarB);
      const chA = compressChannel(planarA);

      const chList = [
        { id: 0, bytes: chR },
        { id: 1, bytes: chG },
        { id: 2, bytes: chB },
        { id: -1, bytes: chA }
      ];

      // Compress mask channel if present
      if (layer.hasMask && layer.maskCanvas && layer.maskCtx) {
        const mData = layer.maskCtx.getImageData(0, 0, width, height).data;
        const planarM = new Uint8Array(numPixels);
        for (let p = 0; p < numPixels; p++) {
          planarM[p] = mData[p * 4]; // Luminance
        }
        const chM = compressChannel(planarM);
        chList.push({ id: -2, bytes: chM });
      }

      preparedLayers.push({
        layer,
        channels: chList
      });
    });

    // Write Layer Records
    preparedLayers.forEach(item => {
      const l = item.layer;

      // Bounds (top, left, bottom, right)
      stream.writeInt32(0);
      stream.writeInt32(0);
      stream.writeInt32(height);
      stream.writeInt32(width);

      // Channel count
      stream.writeUint16(item.channels.length);

      // Channel Info headers
      item.channels.forEach(ch => {
        stream.writeInt16(ch.id);
        if (isPsb) {
          stream.writeUint64(ch.bytes.length);
        } else {
          stream.writeUint32(ch.bytes.length);
        }
      });

      // Blend Mode Signature & Key
      stream.writeString('8BIM');
      const bKey = BlendModes.toPsd[l.blendMode] || 'norm';
      stream.writeString(bKey);

      // Opacity (0-255)
      const op255 = Math.round((Math.max(0, Math.min(100, l.opacity ?? 100)) / 100) * 255);
      stream.writeUint8(op255);

      // Clipping (0 = base)
      stream.writeUint8(l.isClipped ? 1 : 0);

      // Flags (bit 1 is 1 if hidden, 0 if visible)
      const flags = l.visible === false ? 2 : 0;
      stream.writeUint8(flags | 8); // Bit 3 on
      stream.writeUint8(0); // Filler

      // Extra Data (Mask info, Blend ranges, Layer name)
      const extraStream = new ByteStream(512);

      // Layer mask data
      if (l.hasMask && l.maskCanvas && l.maskCtx) {
        extraStream.writeUint32(20); // 20 bytes payload
        extraStream.writeInt32(0); // top
        extraStream.writeInt32(0); // left
        extraStream.writeInt32(height); // bottom
        extraStream.writeInt32(width); // right
        extraStream.writeUint8(255); // default color (white)
        extraStream.writeUint8(0); // flags (relative=0, disabled=0, invert=0)
        extraStream.writeUint16(0); // 2 bytes padding
      } else {
        extraStream.writeUint32(0);
      }

      // Layer blending ranges length: 4 (empty composite ranges)
      extraStream.writeUint32(4);
      extraStream.writeUint32(0);

      // Layer name (Pascal string padded to 4 bytes)
      const name = l.name || 'Layer';
      const cleanName = name.slice(0, 63); // Max length 63
      extraStream.writeUint8(cleanName.length);
      extraStream.writeString(cleanName);
      const pad = (4 - ((cleanName.length + 1) % 4)) % 4;
      for (let p = 0; p < pad; p++) extraStream.writeUint8(0);

      const extraBytes = extraStream.getTrimmedUint8Array();
      stream.writeUint32(extraBytes.length);
      stream.writeBytes(extraBytes);
    });

    // Write Channel Image Data for each layer
    preparedLayers.forEach(item => {
      item.channels.forEach(ch => {
        stream.writeBytes(ch.bytes);
      });
    });

    // Patch Layer Info Length
    const layerInfoEndPos = stream.pos;
    const layerHeaderLen = isPsb ? 8 : 4;
    const layerInfoLength = layerInfoEndPos - (layerInfoStartPos + layerHeaderLen);
    if (isPsb) {
      stream.view.setBigUint64(layerInfoStartPos, BigInt(layerInfoLength), false);
    } else {
      stream.view.setUint32(layerInfoStartPos, layerInfoLength, false);
    }

    // Patch Layer and Mask Section Length
    const lmEndPos = stream.pos;
    const lmHeaderLen = isPsb ? 8 : 4;
    const lmTotalLength = lmEndPos - (lmStartPos + lmHeaderLen);
    if (isPsb) {
      stream.view.setBigUint64(lmStartPos, BigInt(lmTotalLength), false);
    } else {
      stream.view.setUint32(lmStartPos, lmTotalLength, false);
    }

    // ── 5. Merged Composite Flat Image Data (RLE) ──
    // Merge layers onto composite canvas
    const compCanvas = Utils.createCanvas(width, height);
    const compCtx = compCanvas.getContext('2d');
    compCtx.fillStyle = '#ffffff';
    compCtx.fillRect(0, 0, width, height);

    layers.forEach(l => {
      if (!l.visible) return;
      compCtx.save();
      compCtx.globalAlpha = (l.opacity ?? 100) / 100;
      compCtx.globalCompositeOperation = l.blendMode || 'source-over';
      compCtx.drawImage(l.canvas, 0, 0);
      compCtx.restore();
    });

    const compData = compCtx.getImageData(0, 0, width, height).data;
    const compPixels = width * height;
    const compR = new Uint8Array(compPixels);
    const compG = new Uint8Array(compPixels);
    const compB = new Uint8Array(compPixels);
    const compA = new Uint8Array(compPixels);

    for (let p = 0; p < compPixels; p++) {
      const idx = p * 4;
      compR[p] = compData[idx];
      compG[p] = compData[idx + 1];
      compB[p] = compData[idx + 2];
      compA[p] = compData[idx + 3];
    }

    // Write RLE compressed planar RGBA composite
    stream.writeUint16(1); // Compression: RLE
    const compChannels = [compR, compG, compB, compA];
    const allRleRows = [];
    const allLineLens = [];

    compChannels.forEach(chan => {
      for (let row = 0; row < height; row++) {
        const rle = PackBits.compressScanline(chan, row * width, width);
        allRleRows.push(rle);
        allLineLens.push(rle.length);
      }
    });

    if (isPsb) {
      allLineLens.forEach(len => stream.writeUint32(len));
    } else {
      allLineLens.forEach(len => stream.writeUint16(len));
    }
    allRleRows.forEach(rle => stream.writeBytes(rle));

    return stream.getTrimmedUint8Array();
  }

  static writePsb(projectData, options = {}) {
    return PsdWriter.write(projectData, { ...options, isPsb: true });
  }
}

// ── Scalable Vector Graphics (SVG) Export Engine ──
class SvgExporter {
  static exportSvg(layers, width, height) {
    let svg = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    svg += `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">\n`;
    svg += `  <defs>\n`;
    svg += `    <style>\n`;
    svg += `      .text-element { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }\n`;
    svg += `    </style>\n`;
    svg += `  </defs>\n`;

    layers.forEach(layer => {
      if (!layer.visible) return;
      const opacity = (layer.opacity ?? 100) / 100;
      const opacityAttr = opacity < 1.0 ? ` opacity="${opacity.toFixed(2)}"` : '';

      svg += `  <g id="${SvgExporter.escapeXml(layer.name)}"${opacityAttr}>\n`;

      if (layer.type === 'text' && layer.textParams) {
        // High fidelity vector text node
        const p = layer.textParams;
        const fill = p.color || '#ffffff';
        const fontSize = p.fontSize || 48;
        const fontFamily = p.fontFamily || 'sans-serif';
        const fontWeight = p.fontWeight || 'normal';
        const fontStyle = p.fontStyle || 'normal';
        const align = p.align === 'center' ? 'middle' : (p.align === 'right' ? 'end' : 'start');
        const letterSpacing = p.tracking ? ` letter-spacing="${p.tracking}px"` : '';

        const lines = (p.text || '').split('\n');
        const leading = (p.leading || 1.25) * fontSize;

        svg += `    <text x="${p.x}" y="${p.y}" fill="${fill}" font-size="${fontSize}" font-family="${SvgExporter.escapeXml(fontFamily)}" font-weight="${fontWeight}" font-style="${fontStyle}" text-anchor="${align}"${letterSpacing}>\n`;
        lines.forEach((line, idx) => {
          const dy = idx === 0 ? '0' : `${leading}px`;
          svg += `      <tspan x="${p.x}" dy="${dy}">${SvgExporter.escapeXml(p.allCaps ? line.toUpperCase() : line)}</tspan>\n`;
        });
        svg += `    </text>\n`;
      } else {
        // Bitmap layer: serialize as base64 data URI
        const dataUrl = layer.canvas ? layer.canvas.toDataURL('image/png') : null;
        if (dataUrl) {
          svg += `    <image x="0" y="0" width="${width}" height="${height}" href="${dataUrl}"/>\n`;
        }
      }

      svg += `  </g>\n`;
    });

    svg += `</svg>\n`;
    return svg;
  }

  static escapeXml(unsafe) {
    if (!unsafe) return '';
    return unsafe.replace(/[<>&'"]/g, (c) => {
      switch (c) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case '\'': return '&apos;';
        case '"': return '&quot;';
      }
    });
  }
}

// ── WebP & Print DPI Pro Exporter ──
class ProExportSuite {
  /**
   * Export canvas to WebP with customizable quality and lossless flag
   */
  static exportWebP(canvas, quality = 0.92, lossless = false) {
    if (lossless) {
      return canvas.toDataURL('image/webp', 1.0);
    }
    return canvas.toDataURL('image/webp', Math.max(0.01, Math.min(1.0, quality)));
  }

  /**
   * Export canvas to PNG with embedded pHYs chunk for high-res print (300 DPI, 600 DPI)
   */
  static setPngDpi(pngDataUrl, dpi = 300) {
    // 1 meter = 39.37007874 inches. dpm = Math.round(dpi * 39.37007874)
    const dpm = Math.round(dpi * 39.37007874);

    const base64 = pngDataUrl.split(',')[1];
    if (typeof atob === 'undefined') return pngDataUrl; // Node fallback

    const binary = atob(base64);
    const u8 = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) u8[i] = binary.charCodeAt(i);

    // Look for IHDR chunk (starts at index 12, length 13 bytes, ends at index 33)
    if (u8[12] === 0x49 && u8[13] === 0x48 && u8[14] === 0x44 && u8[15] === 0x52) {
      // Create pHYs chunk (9 bytes data + 4 bytes type + 4 bytes CRC = 17 bytes + 4 bytes length = 21 bytes)
      const physChunk = new Uint8Array(21);
      const v = new DataView(physChunk.buffer);
      v.setUint32(0, 9); // Length: 9
      physChunk[4] = 0x70; physChunk[5] = 0x48; physChunk[6] = 0x59; physChunk[7] = 0x73; // "pHYs"
      v.setUint32(8, dpm);  // Pixels per unit X
      v.setUint32(12, dpm); // Pixels per unit Y
      physChunk[16] = 1;    // Unit: meter

      // CRC32 calculation over type and data
      const crc32 = ProExportSuite.calcCrc32(physChunk.subarray(4, 17));
      v.setUint32(17, crc32);

      // Insert pHYs chunk right after IHDR chunk (index 33)
      const newU8 = new Uint8Array(u8.length + 21);
      newU8.set(u8.subarray(0, 33), 0);
      newU8.set(physChunk, 33);
      newU8.set(u8.subarray(33), 54);

      let newBin = '';
      for (let i = 0; i < newU8.length; i++) newBin += String.fromCharCode(newU8[i]);
      return 'data:image/png;base64,' + btoa(newBin);
    }

    return pngDataUrl;
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
}

// ── Master PsdEngine Export ──
const PsdEngine = {
  ByteStream,
  PackBits,
  BlendModes,
  PsdReader,
  PsdWriter,
  SvgExporter,
  ProExportSuite
};

if (typeof window !== 'undefined') {
  window.PsdEngine = PsdEngine;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PsdEngine;
}
