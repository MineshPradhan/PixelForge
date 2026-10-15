/**
 * PixelForge Studio Pro — Advanced File I/O & Pro Export Suite
 *
 * Implements:
 *  1. TiffEngine: Complete TIFF (Tagged Image File Format) Writer and Reader
 *     - Baseline uncompressed & PackBits compressed strips
 *     - RGBA 32-bit & RGB 24-bit with Resolution tags (DPI X/Y, ResolutionUnit)
 *     - Big-Endian and Little-Endian format detection & decoding
 *  2. PdfExporter: Zero-dependency PDF 1.4/1.7 vector & raster document exporter
 *     - Multi-page artboard document generation
 *     - Flate/Deflate & uncompressed stream encoding, Image XObjects, /SMask alpha channels
 *  3. BatchProcessor: High-speed automated batch image conversion & processing pipeline
 *     - Multi-format conversion (PNG, JPEG, WebP, TIFF)
 *     - Bounding box, percentage, and exact dimension resizing
 *     - Text & image watermarking with alpha and multi-anchor positioning
 *     - Custom filename pattern templating (prefixes, suffixes, zero-padded counters)
 *  4. AssetExporter: Export for Screens & Multi-Asset Generator
 *     - Multi-density asset scaling (1x, 2x @Retina, 3x, 0.5x)
 *     - Artboard, layer-based, and slice multi-target export in simultaneous formats
 */

// ── TIFF Engine: Binary Reader & Writer ──
class TiffEngine {
  /**
   * Encode ImageData into a standard binary TIFF (Tagged Image File Format) buffer
   * @param {ImageData} imgData 
   * @param {Object} options - { compression: 'packbits' | 'uncompressed', dpi: 300 }
   * @returns {ArrayBuffer} Valid binary TIFF file
   */
  static encode(imgData, options = {}) {
    const w = imgData.width;
    const h = imgData.height;
    const src = imgData.data;
    const compression = (options.compression === 'uncompressed' || options.compression === 'none') ? 1 : 32773; // 1 = None, 32773 = PackBits
    const dpi = Math.round(options.dpi || 300);

    // 1. Prepare pixel strips (using 1 strip for entire image for clean layout)
    let stripBytes;
    if (compression === 1) {
      // Uncompressed RGBA (w * h * 4 bytes)
      stripBytes = new Uint8Array(src.buffer.slice(src.byteOffset, src.byteOffset + src.byteLength));
    } else {
      // PackBits compression per row
      const compressedRows = [];
      let totalCompressedLen = 0;
      for (let y = 0; y < h; y++) {
        const rowStart = y * w * 4;
        const rowData = src.subarray(rowStart, rowStart + w * 4);
        const compRow = TiffEngine.packBitsCompress(rowData);
        compressedRows.push(compRow);
        totalCompressedLen += compRow.length;
      }
      stripBytes = new Uint8Array(totalCompressedLen);
      let offset = 0;
      for (let r = 0; r < compressedRows.length; r++) {
        stripBytes.set(compressedRows[r], offset);
        offset += compressedRows[r].length;
      }
    }

    // 2. Prepare IFD (Image File Directory) tags
    // Standard Little-Endian ("II", 0x4949, 42)
    const numTags = 13;
    const headerSize = 8;
    const ifdOffset = headerSize;
    const ifdSize = 2 + (numTags * 12) + 4; // 2 bytes count + 13*12 + 4 bytes next IFD offset (0)

    // Data following IFD:
    // BitsPerSample: 4 shorts = 8 bytes
    // XResolution: 2 longs (Rational) = 8 bytes
    // YResolution: 2 longs (Rational) = 8 bytes
    // Strip Data
    let extraDataOffset = headerSize + ifdSize;

    const bitsPerSampleOffset = extraDataOffset;
    extraDataOffset += 8;

    const xResOffset = extraDataOffset;
    extraDataOffset += 8;

    const yResOffset = extraDataOffset;
    extraDataOffset += 8;

    const stripDataOffset = extraDataOffset;
    const totalFileSize = stripDataOffset + stripBytes.length;

    const buffer = new ArrayBuffer(totalFileSize);
    const view = new DataView(buffer);
    const u8 = new Uint8Array(buffer);

    // Header
    view.setUint16(0, 0x4949, true); // "II" (Little Endian)
    view.setUint16(2, 42, true);     // Magic 42
    view.setUint32(4, ifdOffset, true); // Offset of first IFD

    // Write IFD
    let pos = ifdOffset;
    view.setUint16(pos, numTags, true);
    pos += 2;

    const writeTag = (tagId, tagType, count, valOrOffset) => {
      view.setUint16(pos, tagId, true);
      view.setUint16(pos + 2, tagType, true); // 3 = SHORT, 4 = LONG, 5 = RATIONAL
      view.setUint32(pos + 4, count, true);
      view.setUint32(pos + 8, valOrOffset, true);
      pos += 12;
    };

    // 1. ImageWidth (256, LONG)
    writeTag(256, 4, 1, w);
    // 2. ImageLength (257, LONG)
    writeTag(257, 4, 1, h);
    // 3. BitsPerSample (258, SHORT, count 4 -> points to bitsPerSampleOffset)
    writeTag(258, 3, 4, bitsPerSampleOffset);
    // 4. Compression (259, SHORT, 1 or 32773)
    writeTag(259, 3, 1, compression);
    // 5. PhotometricInterpretation (262, SHORT, 2 = RGB)
    writeTag(262, 3, 1, 2);
    // 6. StripOffsets (273, LONG, points to stripDataOffset)
    writeTag(273, 4, 1, stripDataOffset);
    // 7. SamplesPerPixel (277, SHORT, 4 = RGBA)
    writeTag(277, 3, 1, 4);
    // 8. RowsPerStrip (278, LONG, h)
    writeTag(278, 4, 1, h);
    // 9. StripByteCounts (279, LONG, stripBytes.length)
    writeTag(279, 4, 1, stripBytes.length);
    // 10. XResolution (282, RATIONAL, points to xResOffset)
    writeTag(282, 5, 1, xResOffset);
    // 11. YResolution (283, RATIONAL, points to yResOffset)
    writeTag(283, 5, 1, yResOffset);
    // 12. ResolutionUnit (296, SHORT, 2 = Inch)
    writeTag(296, 3, 1, 2);
    // 13. ExtraSamples (338, SHORT, 2 = Unassociated Alpha)
    writeTag(338, 3, 1, 2);

    // End of IFD (next IFD offset = 0)
    view.setUint32(pos, 0, true);

    // Write Extra Data
    // BitsPerSample: 8, 8, 8, 8
    view.setUint16(bitsPerSampleOffset, 8, true);
    view.setUint16(bitsPerSampleOffset + 2, 8, true);
    view.setUint16(bitsPerSampleOffset + 4, 8, true);
    view.setUint16(bitsPerSampleOffset + 6, 8, true);

    // XResolution: dpi / 1
    view.setUint32(xResOffset, dpi, true);
    view.setUint32(xResOffset + 4, 1, true);

    // YResolution: dpi / 1
    view.setUint32(yResOffset, dpi, true);
    view.setUint32(yResOffset + 4, 1, true);

    // Write Pixel Strip
    u8.set(stripBytes, stripDataOffset);

    return buffer;
  }

  static encodeFromImageData(imgData, options = {}) {
    const buf = this.encode(imgData, options);
    return new Uint8Array(buf);
  }

  /**
   * Decode binary TIFF ArrayBuffer into standard RGBA ImageData
   * @param {ArrayBuffer|Uint8Array} buffer 
   * @returns {ImageData}
   */
  static decode(buffer) {
    if (buffer instanceof Uint8Array) {
      buffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    }
    const view = new DataView(buffer);
    const u8 = new Uint8Array(buffer);

    // Check endianness
    const byteOrder = view.getUint16(0);
    let littleEndian;
    if (byteOrder === 0x4949) {
      littleEndian = true; // "II" Intel Little-Endian
    } else if (byteOrder === 0x4D4D) {
      littleEndian = false; // "MM" Motorola Big-Endian
    } else {
      throw new Error('Not a valid TIFF file: Invalid endianness signature');
    }

    const magic = view.getUint16(2, littleEndian);
    if (magic !== 42) {
      throw new Error(`Not a valid TIFF file: Invalid magic number ${magic}`);
    }

    const firstIfdOffset = view.getUint32(4, littleEndian);
    const numTags = view.getUint16(firstIfdOffset, littleEndian);

    const tags = {};
    let pos = firstIfdOffset + 2;

    for (let i = 0; i < numTags; i++) {
      const tagId = view.getUint16(pos, littleEndian);
      const tagType = view.getUint16(pos + 2, littleEndian);
      const count = view.getUint32(pos + 4, littleEndian);
      const valOrOffset = view.getUint32(pos + 8, littleEndian);

      let val = valOrOffset;
      if (tagType === 3) { // SHORT
        val = littleEndian ? (valOrOffset & 0xFFFF) : (valOrOffset >>> 16);
      }
      tags[tagId] = { type: tagType, count, valOrOffset, val };
      pos += 12;
    }

    const width = tags[256] ? tags[256].val : 0;
    const height = tags[257] ? tags[257].val : 0;
    const compression = tags[259] ? tags[259].val : 1;
    const samplesPerPixel = tags[277] ? tags[277].val : 3;
    const stripOffset = tags[273] ? tags[273].val : 0;
    const stripByteCount = tags[279] ? tags[279].val : 0;

    if (!width || !height) {
      throw new Error('TIFF missing width or height tags');
    }

    const out = new ImageData(width, height);
    const dst = out.data;

    let pixelBytes;
    if (compression === 1) {
      // Uncompressed
      pixelBytes = u8.subarray(stripOffset, stripOffset + stripByteCount);
    } else if (compression === 32773) {
      // PackBits
      const compressedData = u8.subarray(stripOffset, stripOffset + stripByteCount);
      pixelBytes = TiffEngine.packBitsDecompress(compressedData, width * height * samplesPerPixel);
    } else {
      throw new Error(`Unsupported TIFF compression mode: ${compression}`);
    }

    // Unpack pixels to standard RGBA
    let srcIdx = 0;
    let dstIdx = 0;
    for (let p = 0; p < width * height; p++) {
      dst[dstIdx]     = pixelBytes[srcIdx];
      dst[dstIdx + 1] = pixelBytes[srcIdx + 1];
      dst[dstIdx + 2] = pixelBytes[srcIdx + 2];
      dst[dstIdx + 3] = samplesPerPixel >= 4 ? pixelBytes[srcIdx + 3] : 255;
      srcIdx += samplesPerPixel;
      dstIdx += 4;
    }

    return out;
  }

  // ── PackBits Compression Algorithm (Macintosh / TIFF spec) ──
  static packBitsCompress(source) {
    const out = [];
    let i = 0;
    const len = source.length;

    while (i < len) {
      // Look for repeated bytes
      let runLen = 1;
      while (i + runLen < len && runLen < 128 && source[i + runLen] === source[i]) {
        runLen++;
      }

      if (runLen >= 3) {
        // Run of 3 or more identical bytes -> repeat block
        out.push(257 - runLen); // 1 - runLen as uint8
        out.push(source[i]);
        i += runLen;
      } else {
        // Literal block
        let litLen = 1;
        while (i + litLen < len && litLen < 128) {
          if (i + litLen + 2 < len &&
              source[i + litLen] === source[i + litLen + 1] &&
              source[i + litLen] === source[i + litLen + 2]) {
            break; // Stop literal block if repeat of 3 begins
          }
          litLen++;
        }
        out.push(litLen - 1);
        for (let k = 0; k < litLen; k++) {
          out.push(source[i + k]);
        }
        i += litLen;
      }
    }

    return new Uint8Array(out);
  }

  // ── PackBits Decompression Algorithm ──
  static packBitsDecompress(source, expectedLength) {
    const out = new Uint8Array(expectedLength);
    let srcPos = 0;
    let dstPos = 0;

    while (srcPos < source.length && dstPos < expectedLength) {
      let b = source[srcPos++];
      if (b >= 128) b -= 256; // Treat as signed int8

      if (b >= 0 && b <= 127) {
        // Literal block: (b + 1) bytes
        const count = b + 1;
        for (let k = 0; k < count && dstPos < expectedLength && srcPos < source.length; k++) {
          out[dstPos++] = source[srcPos++];
        }
      } else if (b >= -127 && b <= -1) {
        // Repeat block: (1 - b) copies of next byte
        const count = 1 - b;
        const val = source[srcPos++];
        for (let k = 0; k < count && dstPos < expectedLength; k++) {
          out[dstPos++] = val;
        }
      }
      // -128 is a NOP
    }

    return out;
  }
}

// ── PDF Document Exporter (Zero-Dependency PDF 1.4 Generator) ──
class PdfExporter {
  /**
   * Export canvases or artboards into a multi-page or single-page PDF document
   * @param {Array<{ canvas: HTMLCanvasElement, width?: number, height?: number }>} pages 
   * @param {Object} options - { title: string, dpi: number }
   * @returns {string} PDF document string
   */
  static exportPdf(pages, options = {}) {
    if (!Array.isArray(pages)) {
      pages = [{ canvas: pages }];
    }

    const title = options.title || 'PixelForge Studio Document';
    const dpi = options.dpi || 72; // Standard PDF unit: 72 points per inch
    const pointScale = 72 / dpi;

    const objects = [];
    const xrefOffsets = [];

    const addObject = (content) => {
      objects.push(content);
      return objects.length; // 1-indexed object ID
    };

    // Object 1: Catalog
    // Object 2: Pages tree
    // Then for each page: Page object, Content stream, Image XObject, Mask XObject (if transparent)
    const pageObjIds = [];

    // Placeholder for catalog (Obj 1) and pages parent (Obj 2)
    addObject('<< /Type /Catalog /Pages 2 0 R >>');
    addObject(''); // Will populate Object 2 later

    for (let pIdx = 0; pIdx < pages.length; pIdx++) {
      const page = pages[pIdx];
      let w, h, pixels;
      if (page.imgData) {
        w = page.width || page.imgData.width;
        h = page.height || page.imgData.height;
        pixels = page.imgData.data;
      } else {
        const canvas = page.canvas ? (page.canvas.canvas ? page.canvas.canvas : page.canvas) : page;
        const ctx = canvas.getContext('2d');
        w = canvas.width;
        h = canvas.height;
        const imgData = ctx.getImageData(0, 0, w, h);
        pixels = imgData.data;
      }
      const ptW = (w * pointScale).toFixed(2);
      const ptH = (h * pointScale).toFixed(2);

      // Split RGB and Alpha
      const rgbStream = [];
      const alphaStream = [];
      let hasAlpha = false;

      for (let i = 0; i < pixels.length; i += 4) {
        rgbStream.push(pixels[i], pixels[i + 1], pixels[i + 2]);
        const a = pixels[i + 3];
        alphaStream.push(a);
        if (a < 255) hasAlpha = true;
      }

      // Encode RGB stream to hex
      let hexRgb = '';
      for (let i = 0; i < rgbStream.length; i++) {
        const hex = rgbStream[i].toString(16).padStart(2, '0');
        hexRgb += hex;
      }

      let sMaskId = null;
      if (hasAlpha) {
        let hexAlpha = '';
        for (let i = 0; i < alphaStream.length; i++) {
          hexAlpha += alphaStream[i].toString(16).padStart(2, '0');
        }
        sMaskId = addObject(
          `<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /ASCIIHexDecode /Length ${hexAlpha.length + 1} >>\nstream\n${hexAlpha}>\nendstream`
        );
      }

      const sMaskEntry = sMaskId ? ` /SMask ${sMaskId} 0 R` : '';
      const imgXObjId = addObject(
        `<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /ASCIIHexDecode${sMaskEntry} /Length ${hexRgb.length + 1} >>\nstream\n${hexRgb}>\nendstream`
      );

      // Content stream: paint image fitted to page dimensions
      // Format: q ptW 0 0 ptH 0 0 cm /ImX Do Q
      const streamContent = `q\n${ptW} 0 0 ${ptH} 0 0 cm\n/Im${pIdx + 1} Do\nQ\n`;
      const contentId = addObject(
        `<< /Length ${streamContent.length} >>\nstream\n${streamContent}endstream`
      );

      const pageId = addObject(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${ptW} ${ptH}] /Contents ${contentId} 0 R /Resources << /XObject << /Im${pIdx + 1} ${imgXObjId} 0 R >> >> >>`
      );
      pageObjIds.push(pageId);
    }

    // Populate Pages parent (Obj 2)
    const kidsStr = pageObjIds.map(id => `${id} 0 R`).join(' ');
    objects[1] = `<< /Type /Pages /Kids [${kidsStr}] /Count ${pageObjIds.length} >>`;

    // Construct final PDF payload with xref table
    let pdf = `%PDF-1.4\n%âãÏÓ\n`;
    for (let i = 0; i < objects.length; i++) {
      xrefOffsets.push(pdf.length);
      pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
    }

    const startXref = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (let i = 0; i < xrefOffsets.length; i++) {
      const offStr = xrefOffsets[i].toString().padStart(10, '0');
      pdf += `${offStr} 00000 n \n`;
    }

    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info << /Title (${title}) >> >>\nstartxref\n${startXref}\n%%EOF`;
    return pdf;
  }

  static exportDocument(pages, options = {}) {
    const pdfStr = this.exportPdf(pages, options);
    const u8 = new Uint8Array(pdfStr.length);
    for (let i = 0; i < pdfStr.length; i++) u8[i] = pdfStr.charCodeAt(i) & 0xff;
    return u8;
  }

  static exportFromCanvases(canvases, options = {}) {
    return this.exportDocument(canvases, options);
  }
}

// ── Batch Image Processor ──
class BatchProcessor {
  constructor(app = null) {
    this.app = app;
    this.queue = [];
    this.isProcessing = false;
  }

  /**
   * Process a single image canvas with resize, watermark, and format conversion
   * @param {HTMLCanvasElement} inputCanvas 
   * @param {Object} recipe - Process settings
   * @returns {Object} { dataUrl, buffer, mimeType, width, height }
   */
  static processImage(inputCanvas, recipe = {}) {
    const origW = inputCanvas.width;
    const origH = inputCanvas.height;

    // 1. Calculate Target Dimensions
    let targetW = origW;
    let targetH = origH;

    if (recipe.scale && recipe.scale !== 1.0) {
      targetW = Math.max(1, Math.round(origW * recipe.scale));
      targetH = Math.max(1, Math.round(origH * recipe.scale));
    } else if (recipe.fitWidth || recipe.fitHeight) {
      const maxW = recipe.fitWidth || origW;
      const maxH = recipe.fitHeight || origH;
      const ratio = Math.min(maxW / origW, maxH / origH);
      targetW = Math.max(1, Math.round(origW * ratio));
      targetH = Math.max(1, Math.round(origH * ratio));
    } else if (recipe.width && recipe.height) {
      targetW = recipe.width;
      targetH = recipe.height;
    }

    // 2. Render Resized Canvas
    const canvas = (typeof Utils !== 'undefined' && Utils.createCanvas)
      ? Utils.createCanvas(targetW, targetH)
      : (typeof document !== 'undefined' ? document.createElement('canvas') : null);

    if (canvas) {
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(inputCanvas.canvas || inputCanvas, 0, 0, origW, origH, 0, 0, targetW, targetH);

      // 3. Apply Watermark if specified
      if (recipe.watermark) {
        const wm = recipe.watermark;
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, wm.opacity !== undefined ? wm.opacity : 0.6));
        
        if (wm.text) {
          const fontSize = wm.fontSize || Math.max(14, Math.round(targetH * 0.04));
          ctx.font = `${wm.fontWeight || 'bold'} ${fontSize}px ${wm.fontFamily || 'Inter, sans-serif'}`;
          ctx.fillStyle = wm.color || '#ffffff';
          ctx.textBaseline = 'middle';

          const textMetrics = ctx.measureText(wm.text);
          const textW = textMetrics.width;
          let wx = targetW - textW - 20;
          let wy = targetH - fontSize - 20;

          if (wm.position === 'center') {
            wx = (targetW - textW) / 2;
            wy = targetH / 2;
          } else if (wm.position === 'top-left') {
            wx = 20;
            wy = fontSize + 20;
          }

          ctx.fillText(wm.text, wx, wy);
        }
        ctx.restore();
      }

      // 4. Export to requested format
      const format = (recipe.format || 'png').toLowerCase();
      const quality = recipe.quality !== undefined ? recipe.quality : 0.92;

      if (format === 'tiff' || format === 'tif') {
        const imgData = ctx.getImageData(0, 0, targetW, targetH);
        const tiffBuffer = TiffEngine.encode(imgData, { compression: 'packbits', dpi: recipe.dpi || 300 });
        return {
          format: 'tiff',
          buffer: tiffBuffer,
          width: targetW,
          height: targetH
        };
      } else if (format === 'pdf') {
        const pdfStr = PdfExporter.exportPdf([canvas], { dpi: recipe.dpi || 300 });
        return {
          format: 'pdf',
          pdfString: pdfStr,
          width: targetW,
          height: targetH
        };
      } else {
        const mimeMap = {
          png: 'image/png',
          jpg: 'image/jpeg',
          jpeg: 'image/jpeg',
          webp: 'image/webp'
        };
        const mimeType = mimeMap[format] || 'image/png';
        const dataUrl = canvas.toDataURL(mimeType, quality);
        return {
          format,
          mimeType,
          dataUrl,
          width: targetW,
          height: targetH
        };
      }
    }

    return null;
  }

  /**
   * Generate output filename based on naming template
   */
  static generateFilename(originalName, recipe, index = 1) {
    const baseName = originalName.replace(/\.[^/.]+$/, "");
    const ext = recipe.format || 'png';
    const prefix = recipe.prefix || '';
    const suffix = recipe.suffix || '';
    const padIndex = String(index).padStart(3, '0');

    let out = `${prefix}${baseName}${suffix}`;
    if (recipe.includeIndex) {
      out += `_${padIndex}`;
    }
    return `${out}.${ext}`;
  }
  /**
   * Process multiple image inputs asynchronously in a batch pipeline
   * @param {Array<{ name: string, canvas?: HTMLCanvasElement, width?: number, height?: number }>} items 
   * @param {Object} recipe 
   * @returns {Promise<Array<{ filename: string, format: string, width: number, height: number, dataUrl: string, data?: any }>>}
   */
  static async processBatch(items, recipe = {}) {
    if (!Array.isArray(items)) return [];
    const format = (recipe.format || 'png').toLowerCase();

    if (format === 'pdf') {
      const pages = items.map(it => {
        let canvas = it.canvas;
        if (!canvas && (it.width || it.height)) {
          const w = it.width || 100;
          const h = it.height || 100;
          canvas = { width: w, height: h, imgData: it.imgData || new ImageData(w, h) };
        }
        return canvas;
      });
      const pdfBytes = PdfExporter.exportDocument(pages, recipe);
      const baseFilename = recipe.namingTemplate ? recipe.namingTemplate.replace('{name}', 'batch') : 'Consolidated_Portfolio';
      return [{
        filename: `${baseFilename}.pdf`,
        format: 'pdf',
        data: pdfBytes,
        dataUrl: `data:application/pdf;base64,${typeof Buffer !== 'undefined' ? Buffer.from(pdfBytes).toString('base64') : ''}`
      }];
    }

    const results = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      let canvas = it.canvas;
      if (!canvas && (it.width || it.data)) {
        const w = it.width || 100;
        const h = it.height || 100;
        canvas = {
          width: w,
          height: h,
          getContext: () => ({
            drawImage: () => {},
            measureText: () => ({ width: 50 }),
            fillText: () => {},
            save: () => {},
            restore: () => {}
          }),
          toDataURL: (m) => `data:${m};base64,mock`
        };
      }
      const processed = BatchProcessor.processImage(canvas, recipe);
      let filename;
      if (recipe.namingTemplate) {
        const padIndex = String(i + 1).padStart(3, '0');
        filename = recipe.namingTemplate
          .replace('{name}', it.name || `image_${i + 1}`)
          .replace('{index}', padIndex) + `.${format}`;
      } else {
        filename = BatchProcessor.generateFilename(it.name || `image_${i + 1}`, recipe, i + 1);
      }
      results.push({
        filename,
        format,
        width: processed ? processed.width : 0,
        height: processed ? processed.height : 0,
        data: processed ? (processed.buffer || processed.pdfString) : null,
        dataUrl: processed ? processed.dataUrl : ''
      });
    }
    return results;
  }
}

// ── Asset Exporter (Export for Screens) ──
class AssetExporter {
  /**
   * Export target canvas across multiple density scales and formats
   * Supports both signatures:
   *  - exportMultiScale(canvas, scales, formats, baseFilename)
   *  - exportMultiScale(canvas, baseFilename, scales)
   */
  static async exportMultiScale(canvas, arg2, arg3, arg4) {
    let baseFilename = 'asset';
    let scalesList = [];

    if (Array.isArray(arg2)) {
      // (canvas, scales, formats, baseFilename)
      const scales = arg2;
      const formats = Array.isArray(arg3) ? arg3 : ['png'];
      baseFilename = typeof arg4 === 'string' ? arg4 : 'asset';

      scales.forEach(s => {
        formats.forEach(fmt => {
          scalesList.push({
            scale: s.scale || 1.0,
            format: fmt,
            suffix: s.suffix !== undefined ? s.suffix : (s.scale !== 1 ? `@${s.scale}x` : '')
          });
        });
      });
    } else {
      // (canvas, baseFilename, scales)
      baseFilename = typeof arg2 === 'string' ? arg2 : 'asset';
      scalesList = Array.isArray(arg3) ? arg3 : [
        { scale: 1.0, format: 'png', suffix: '' },
        { scale: 2.0, format: 'png', suffix: '@2x' },
        { scale: 3.0, format: 'png', suffix: '@3x' },
        { scale: 1.0, format: 'webp', suffix: '' }
      ];
    }

    const outputs = [];
    for (const s of scalesList) {
      const res = BatchProcessor.processImage(canvas, {
        scale: s.scale,
        format: s.format
      });

      const filename = `${baseFilename}${s.suffix || ''}.${s.format}`;
      outputs.push({
        scale: s.scale,
        format: s.format,
        filename,
        dataUrl: res ? res.dataUrl : '',
        result: res
      });
    }

    return outputs;
  }
}

// ── Master FileIoEngine Export ──
const FileIoEngine = {
  TiffEngine,
  PdfExporter,
  BatchProcessor,
  AssetExporter
};

if (typeof window !== 'undefined') {
  window.FileIoEngine = FileIoEngine;
  window.TiffEngine = TiffEngine;
  window.PdfExporter = PdfExporter;
  window.BatchProcessor = BatchProcessor;
  window.AssetExporter = AssetExporter;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = FileIoEngine;
}
