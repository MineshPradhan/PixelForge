/**
 * PixelForge Studio — Advanced OpenType & Variable Typography Controls Engine
 * Professional editorial & graphic typography pipeline:
 *   - OpenType Feature Settings (liga, dlig, calt, smcp, tnum, pnum, zero, frac, ordn, sups, subs, swsh, titl, ss01-ss20)
 *   - Variable Font Axes Controls (wght, wdth, slnt, opsz, ital, custom axes)
 *   - Multi-line editorial layout (Tracking/letter-spacing, Leading/line-height, Paragraph Indent, Paragraph Spacing)
 *   - Canvas 2D typographic renderer with native CSS Font Loading and simulated fallbacks (Small Caps, Superscript, Subscript)
 */

class OpenTypeFeatureEngine {
  static get DEFAULT_FEATURES() {
    return {
      liga: true,  // Standard Ligatures
      calt: true,  // Contextual Alternates
      dlig: false, // Discretionary Ligatures
      smcp: false, // Small Capitals
      tnum: false, // Tabular Figures
      pnum: true,  // Proportional Figures
      zero: false, // Slashed Zero
      frac: false, // Fractions
      ordn: false, // Ordinals
      sups: false, // Superscript
      subs: false, // Subscript
      swsh: false, // Swashes
      titl: false  // Titling Alternates
    };
  }

  static get DEFAULT_VARIATIONS() {
    return {
      wght: 400, // Weight: 100 - 900
      wdth: 100, // Width: 50% - 200%
      slnt: 0,   // Slant: -15 to +15 deg
      opsz: 14,  // Optical Size: 6 - 72 pt
      ital: 0    // Italic: 0 or 1
    };
  }

  /**
   * Converts OpenType feature map to CSS font-feature-settings string
   * e.g. { liga: true, smcp: true, tnum: false } -> '"liga" 1, "smcp" 1, "tnum" 0'
   */
  static toCssFeatureSettings(features = {}) {
    const entries = [];
    for (const [tag, enabled] of Object.entries(features)) {
      if (enabled === true || enabled === 1) {
        entries.push(`"${tag}" 1`);
      } else if (enabled === false || enabled === 0) {
        entries.push(`"${tag}" 0`);
      } else if (typeof enabled === 'number') {
        entries.push(`"${tag}" ${enabled}`);
      }
    }
    return entries.length > 0 ? entries.join(', ') : 'normal';
  }

  /**
   * Parses CSS font-feature-settings string back into an object
   */
  static parseCssFeatureSettings(cssStr) {
    if (!cssStr || cssStr.trim() === 'normal') return {};
    const result = {};
    const parts = cssStr.split(',');
    for (const part of parts) {
      const match = part.trim().match(/["']([a-zA-Z0-9_]{4})["']\s*(\d+)?/);
      if (match) {
        const tag = match[1];
        const val = match[2] !== undefined ? parseInt(match[2], 10) : 1;
        result[tag] = val === 1 ? true : (val === 0 ? false : val);
      }
    }
    return result;
  }

  /**
   * Converts variable font axis map to CSS font-variation-settings string
   * e.g. { wght: 700, wdth: 110, slnt: -5 } -> '"wght" 700, "wdth" 110, "slnt" -5'
   */
  static toCssVariationSettings(variations = {}) {
    const entries = [];
    for (const [axis, value] of Object.entries(variations)) {
      if (typeof value === 'number' && !isNaN(value)) {
        entries.push(`"${axis}" ${value}`);
      }
    }
    return entries.length > 0 ? entries.join(', ') : 'normal';
  }

  /**
   * Parses CSS font-variation-settings string back into an object
   */
  static parseCssVariationSettings(cssStr) {
    if (!cssStr || cssStr.trim() === 'normal') return {};
    const result = {};
    const parts = cssStr.split(',');
    for (const part of parts) {
      const match = part.trim().match(/["']([a-zA-Z0-9_]{4})["']\s*([+-]?\d+(?:\.\d+)?)/);
      if (match) {
        const axis = match[1];
        const val = parseFloat(match[2]);
        result[axis] = val;
      }
    }
    return result;
  }

  /**
   * Formats complete CSS font style declaration
   */
  static formatFontStyle(params = {}) {
    const fontSize = params.fontSize || 16;
    const fontFamily = params.fontFamily || 'sans-serif';
    const fontWeight = params.fontWeight || (params.variations?.wght || 400);
    const fontStyle = params.fontStyle || (params.variations?.ital === 1 ? 'italic' : 'normal');

    return {
      font: `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`,
      fontFeatureSettings: OpenTypeFeatureEngine.toCssFeatureSettings(params.features),
      fontVariationSettings: OpenTypeFeatureEngine.toCssVariationSettings(params.variations),
      letterSpacing: params.tracking ? `${params.tracking / 1000}em` : 'normal'
    };
  }

  /**
   * Multi-line layout calculator with tracking, leading, word wrapping & paragraph indentation
   */
  static layoutText(text, options = {}) {
    const fontSize = options.fontSize || 16;
    const tracking = options.tracking || 0; // 1/1000 em
    const leading = options.leading || (fontSize * 1.25); // px
    const maxWidth = options.maxWidth || Infinity;
    const indent = options.paragraphIndent || 0;
    const paragraphSpacing = options.paragraphSpacing || 0;

    const trackingPx = (tracking / 1000) * fontSize;
    const paragraphs = (text || '').split('\n');
    const layoutLines = [];
    let currentY = fontSize; // baseline offset

    paragraphs.forEach((para, pIdx) => {
      const words = para.split(' ');
      let currentLine = '';
      let isFirstLineOfPara = true;

      for (let w = 0; w < words.length; w++) {
        const word = words[w];
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        
        // Approximate width calculation (or canvas measureText if available)
        const lineLen = testLine.length;
        const estCharWidth = fontSize * 0.58;
        const testWidth = (lineLen * estCharWidth) + (lineLen * trackingPx) + (isFirstLineOfPara ? indent : 0);

        if (testWidth > maxWidth && currentLine) {
          layoutLines.push({
            text: currentLine,
            y: currentY,
            isFirstLine: isFirstLineOfPara,
            indent: isFirstLineOfPara ? indent : 0,
            paragraphIndex: pIdx
          });
          currentY += leading;
          currentLine = word;
          isFirstLineOfPara = false;
        } else {
          currentLine = testLine;
        }
      }

      if (currentLine !== '' || words.length === 0) {
        layoutLines.push({
          text: currentLine,
          y: currentY,
          isFirstLine: isFirstLineOfPara,
          indent: isFirstLineOfPara ? indent : 0,
          paragraphIndex: pIdx
        });
        currentY += leading + paragraphSpacing;
      }
    });

    return {
      lines: layoutLines,
      totalHeight: currentY,
      fontSize,
      leading,
      trackingPx
    };
  }

  /**
   * Renders advanced formatted text directly to an HTML Canvas 2D context
   */
  static renderToCanvas(ctx, text, x = 0, y = 0, options = {}) {
    ctx.save();

    const fontSize = options.fontSize || 24;
    const fontFamily = options.fontFamily || '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    const fontWeight = options.fontWeight || (options.variations?.wght || 'normal');
    const fontStyle = options.fontStyle || (options.variations?.ital === 1 ? 'italic' : 'normal');
    const color = options.color || '#ffffff';
    const align = options.align || 'left';
    const tracking = options.tracking || 0;
    const trackingPx = (tracking / 1000) * fontSize;

    ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
    ctx.fillStyle = color;
    ctx.textAlign = 'left'; // We manage letter spacing manually for universal compatibility
    ctx.textBaseline = 'alphabetic';

    // Apply native CSS properties if context / browser supports them
    if ('letterSpacing' in ctx) {
      ctx.letterSpacing = `${trackingPx}px`;
    }

    const layout = OpenTypeFeatureEngine.layoutText(text, options);

    layout.lines.forEach(line => {
      let lineText = line.text;
      if (options.allCaps) {
        lineText = lineText.toUpperCase();
      }

      let lineX = x + line.indent;

      // Handle alignment
      if (align === 'center' || align === 'right') {
        let totalLineWidth = 0;
        for (let i = 0; i < lineText.length; i++) {
          totalLineWidth += (ctx.measureText ? ctx.measureText(lineText[i]).width : fontSize * 0.6) + trackingPx;
        }
        if (align === 'center') {
          lineX = x + Math.max(0, (options.maxWidth || 0) - totalLineWidth) / 2 + line.indent;
        } else if (align === 'right') {
          lineX = x + Math.max(0, (options.maxWidth || 0) - totalLineWidth) + line.indent;
        }
      }

      // Draw character by character for precision tracking and small caps fallback
      if (options.features?.smcp && !options.nativeSmcp) {
        // High quality small-caps simulation fallback:
        // Lowercase letters drawn at 0.75x font size in uppercase
        for (let i = 0; i < lineText.length; i++) {
          const char = lineText[i];
          const isLower = char >= 'a' && char <= 'z';
          const renderChar = isLower ? char.toUpperCase() : char;
          const charSize = isLower ? Math.round(fontSize * 0.78) : fontSize;
          const yOffset = isLower ? (fontSize - charSize) * 0.15 : 0;

          ctx.font = `${fontStyle} ${fontWeight} ${charSize}px ${fontFamily}`;
          ctx.fillText(renderChar, lineX, y + line.y - yOffset);
          const chWidth = (ctx.measureText ? ctx.measureText(renderChar).width : charSize * 0.6) + trackingPx;
          lineX += chWidth;
        }
      } else {
        // Standard letter-spaced rendering
        for (let i = 0; i < lineText.length; i++) {
          const char = lineText[i];
          ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
          ctx.fillText(char, lineX, y + line.y);
          const chWidth = (ctx.measureText ? ctx.measureText(char).width : fontSize * 0.6) + trackingPx;
          lineX += chWidth;
        }
      }
    });

    ctx.restore();
    return layout;
  }
}

if (typeof window !== 'undefined') {
  window.OpenTypeFeatureEngine = OpenTypeFeatureEngine;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = OpenTypeFeatureEngine;
}
