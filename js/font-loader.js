/**
 * PixelForge Studio - Custom Font Loader (Phase 13)
 * Dynamic drag-and-drop & file import for .ttf, .otf, .woff, and .woff2 fonts
 * Automatically registers with document.fonts and updates typography panels.
 */

(function (global) {
  'use strict';

  class CustomFontLoader {
    constructor() {
      this.loadedFonts = new Map(); // family -> { format, buffer, fontFace, url }
      this.listeners = [];
    }

    /**
     * Subscribe to font loading events
     */
    onFontLoaded(callback) {
      if (typeof callback === 'function') {
        this.listeners.push(callback);
      }
    }

    notify(fontData) {
      this.listeners.forEach(cb => {
        try { cb(fontData); } catch (e) { console.error('Font loader listener error:', e); }
      });
    }

    /**
     * Infer font family name from file name
     */
    cleanFontName(fileName) {
      return fileName
        .replace(/\.(ttf|otf|woff2|woff)$/i, '')
        .replace(/[-_]/g, ' ')
        .trim();
    }

    /**
     * Parse binary font metadata (OpenType / TrueType table parser)
     * Reads name table (Table tag 'name' = 0x6E616D65) if available to get actual Font Family
     */
    extractFontNameFromBuffer(buffer) {
      try {
        const view = new DataView(buffer);
        // Check SFNT version (0x00010000 for TrueType, 'OTTO' for OpenType)
        const sfntVersion = view.getUint32(0);
        if (sfntVersion !== 0x00010000 && sfntVersion !== 0x4F54544F && sfntVersion !== 0x774F4646) {
          return null;
        }

        const numTables = view.getUint16(4);
        let nameTableOffset = 0;

        for (let i = 0; i < numTables; i++) {
          const offset = 12 + i * 16;
          const tag = String.fromCharCode(
            view.getUint8(offset),
            view.getUint8(offset + 1),
            view.getUint8(offset + 2),
            view.getUint8(offset + 3)
          );
          if (tag === 'name') {
            nameTableOffset = view.getUint32(offset + 8);
            break;
          }
        }

        if (!nameTableOffset || nameTableOffset >= buffer.byteLength) return null;

        const count = view.getUint16(nameTableOffset + 2);
        const stringOffset = nameTableOffset + view.getUint16(nameTableOffset + 4);

        for (let i = 0; i < count; i++) {
          const recOffset = nameTableOffset + 6 + i * 12;
          const platformID = view.getUint16(recOffset);
          const nameID = view.getUint16(recOffset + 6);
          const length = view.getUint16(recOffset + 8);
          const strOffset = stringOffset + view.getUint16(recOffset + 10);

          // nameID 1 is Font Family name, nameID 4 is Full Font Name
          if (nameID === 1 || nameID === 4) {
            let name = '';
            if (platformID === 0 || platformID === 3) {
              // Unicode UTF-16BE
              for (let c = 0; c < length; c += 2) {
                if (strOffset + c + 1 < buffer.byteLength) {
                  const code = view.getUint16(strOffset + c);
                  if (code > 0) name += String.fromCharCode(code);
                }
              }
            } else {
              // Mac / Roman 8-bit
              for (let c = 0; c < length; c++) {
                if (strOffset + c < buffer.byteLength) {
                  name += String.fromCharCode(view.getUint8(strOffset + c));
                }
              }
            }
            if (name.trim()) return name.trim();
          }
        }
      } catch (e) {
        // Fallback to filename if binary parse encounters non-standard or compressed formats (like woff2)
      }
      return null;
    }

    /**
     * Load a font from a File or Blob object
     */
    async loadFontFromFile(file) {
      const buffer = await file.arrayBuffer();
      let family = this.extractFontNameFromBuffer(buffer);
      if (!family) {
        family = this.cleanFontName(file.name);
      }
      return this.loadFontFromBuffer(family, buffer, file.name.split('.').pop().toLowerCase());
    }

    /**
     * Register font into browser FontFaceSet and CSS
     */
    async loadFontFromBuffer(family, buffer, format = 'truetype') {
      const formatMap = {
        ttf: 'truetype',
        otf: 'opentype',
        woff: 'woff',
        woff2: 'woff2'
      };
      const cssFormat = formatMap[format] || format;

      let fontFace = null;
      let blobUrl = null;

      if (typeof FontFace !== 'undefined' && typeof document !== 'undefined' && document.fonts) {
        try {
          fontFace = new FontFace(family, buffer);
          await fontFace.load();
          document.fonts.add(fontFace);
        } catch (err) {
          console.warn('FontFace API direct load failed, falling back to Blob URL:', err);
          if (typeof Blob !== 'undefined' && typeof URL !== 'undefined') {
            const blob = new Blob([buffer], { type: `font/${format}` });
            blobUrl = URL.createObjectURL(blob);
            const style = document.createElement('style');
            style.textContent = `@font-face { font-family: '${family}'; src: url('${blobUrl}') format('${cssFormat}'); }`;
            document.head.appendChild(style);
          }
        }
      }

      const fontData = {
        family,
        format,
        buffer,
        fontFace,
        blobUrl,
        sizeBytes: buffer.byteLength
      };

      this.loadedFonts.set(family, fontData);
      this.updateTypographySelectors(family);
      this.notify(fontData);

      return fontData;
    }

    /**
     * Automatically append custom font to any Font dropdowns across the studio
     */
    updateTypographySelectors(family) {
      if (typeof document === 'undefined') return;

      const selectors = [
        document.getElementById('tool-font-family'),
        document.getElementById('layer-text-font'),
        document.getElementById('character-font-family')
      ];

      selectors.forEach(sel => {
        if (!sel) return;
        // Check if already in list
        let exists = false;
        for (let i = 0; i < sel.options.length; i++) {
          if (sel.options[i].value.toLowerCase() === family.toLowerCase()) {
            exists = true;
            break;
          }
        }
        if (!exists) {
          const opt = document.createElement('option');
          opt.value = family;
          opt.textContent = `${family} (Custom)`;
          // Insert at top of options
          sel.insertBefore(opt, sel.firstChild);
          sel.value = family;
        }
      });
    }

    /**
     * Get list of all custom installed fonts
     */
    getLoadedFonts() {
      return Array.from(this.loadedFonts.values());
    }
  }

  // Export
  global.CustomFontLoader = CustomFontLoader;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CustomFontLoader };
  }
})(typeof window !== 'undefined' ? window : globalThis);
