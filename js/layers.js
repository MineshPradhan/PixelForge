// ══════════════════════════════════════════════════════════════════════
// PixelForge Studio — Advanced Layer Engine & Compositor
// ══════════════════════════════════════════════════════════════════════

class LayerComp {
  constructor(name, state = {}, options = {}) {
    this.id = options.id || 'comp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    this.name = name || 'Layer Comp';
    this.comment = options.comment || '';
    this.captureVisibility = options.captureVisibility !== false;
    this.capturePosition = options.capturePosition !== false;
    this.captureAppearance = options.captureAppearance !== false;
    this.state = JSON.parse(JSON.stringify(state)); // map of { [layerId]: { visible, x, y, opacity, blendMode, styles } }
    this.createdAt = options.createdAt || Date.now();
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      comment: this.comment,
      captureVisibility: this.captureVisibility,
      capturePosition: this.capturePosition,
      captureAppearance: this.captureAppearance,
      state: this.state,
      createdAt: this.createdAt
    };
  }

  static fromJSON(json) {
    return new LayerComp(json.name, json.state, json);
  }
}

class Artboard {
  constructor(name, width, height, options = {}) {
    this.id = options.id || 'artboard_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    this.name = name || 'Artboard';
    this.x = options.x || 0;
    this.y = options.y || 0;
    this.width = width || 1920;
    this.height = height || 1080;
    this.bgType = options.bgType || 'white'; // 'white' | 'transparent' | 'black' | 'custom'
    this.bgColor = options.bgColor || '#ffffff';
    this.preset = options.preset || 'custom';
  }

  getBounds() {
    return {
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height,
      right: this.x + this.width,
      bottom: this.y + this.height
    };
  }

  containsPoint(px, py) {
    return px >= this.x && px <= (this.x + this.width) && py >= this.y && py <= (this.y + this.height);
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height,
      bgType: this.bgType,
      bgColor: this.bgColor,
      preset: this.preset
    };
  }

  static fromJSON(json) {
    return new Artboard(json.name, json.width, json.height, json);
  }
}

class LayerManager {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.layers = [];
    this.activeLayerId = null;
    this.selectedLayerIds = new Set();
    this.layerCounter = 0;
    this.groupCounter = 0;
    this.adjCounter = 0;
    this.textCounter = 0;
    this.onChange = null;

    // Phase 5 Layer Architecture: Layer Comps, Artboards, Isolation Mode
    this.layerComps = [];
    this.activeCompId = null;
    this.artboards = [];
    this.activeArtboardId = null;
    this.artboardCounter = 0;
    this.isolatedLayerId = null;
    this.isolationDimOthers = false;
  }

  createLayerObject(name, type = 'raster', extraProps = {}) {
    this.layerCounter++;
    const id = 'layer_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    const canvas = Utils.createCanvas(this.width, this.height);
    const ctx = canvas.getContext('2d');
    return {
      id,
      name: name || `Layer ${this.layerCounter}`,
      type, // 'raster' | 'group' | 'adjustment' | 'text'
      isAdjustment: type === 'adjustment',
      parentId: null,
      collapsed: false,
      adjustmentType: null,
      adjustmentParams: null,
      textParams: null,
      canvas,
      ctx,
      visible: true,
      opacity: 100,
      blendMode: 'source-over',
      locked: false,
      lockAlpha: false,
      isClipped: false,
      colorTag: null, // 'red', 'orange', 'yellow', 'green', 'blue', 'purple', null
      hasMask: false,
      maskCanvas: null,
      maskCtx: null,
      isMaskActive: false,
      maskDisabled: false,
      styles: {
        dropShadow: { enabled: false, color: '#000000', opacity: 75, distance: 8, blur: 10, angle: 120 },
        stroke: { enabled: false, color: '#000000', size: 3, opacity: 100 },
        colorOverlay: { enabled: false, color: '#3b82f6', opacity: 50, blendMode: 'source-over' },
        outerGlow: { enabled: false, color: '#f59e0b', opacity: 75, blur: 12 },
        bevelEmboss: { enabled: false, style: 'inner-bevel', depth: 100, size: 5, soften: 0, angle: 120, altitude: 30, highlightColor: '#ffffff', highlightOpacity: 75, shadowColor: '#000000', shadowOpacity: 75 },
        innerShadow: { enabled: false, color: '#000000', opacity: 75, angle: 120, distance: 5, choke: 0, size: 5 },
        innerGlow: { enabled: false, color: '#ffffbe', opacity: 75, blur: 10, choke: 0, blendMode: 'screen' },
        satin: { enabled: false, color: '#000000', opacity: 50, angle: 19, distance: 11, size: 14, invert: false },
        patternOverlay: { enabled: false, pattern: 'grid', scale: 100, opacity: 100, blendMode: 'source-over' },
        gradientOverlay: { enabled: false, opacity: 100, blendMode: 'source-over', angle: 90, scale: 100, reverse: false, stops: [{ offset: 0, color: '#000000' }, { offset: 1, color: '#ffffff' }] }
      },
      x: 0,
      y: 0,
      artboardId: null,
      assetId: null,
      vectorShape: null,
      ...extraProps
    };
  }

  addLayer(name, fillStyle = null) {
    const layer = this.createLayerObject(name, 'raster');
    if (fillStyle) {
      layer.ctx.fillStyle = fillStyle;
      layer.ctx.fillRect(0, 0, this.width, this.height);
    }
    this.layers.push(layer);
    this.setActiveLayer(layer.id);
    this.notifyUpdate();
    return layer;
  }

  addGroup(name = null) {
    this.groupCounter++;
    const group = this.createLayerObject(name || `Group ${this.groupCounter}`, 'group');

    const selected = this.getSelectedLayers();
    if (selected.length > 0) {
      let maxIdx = -1;
      selected.forEach(l => {
        const idx = this.layers.findIndex(item => item.id === l.id);
        if (idx > maxIdx) maxIdx = idx;
        l.parentId = group.id;
      });
      this.layers.splice(maxIdx + 1, 0, group);
    } else {
      const activeIdx = this.layers.findIndex(l => l.id === this.activeLayerId);
      if (activeIdx !== -1) {
        this.layers.splice(activeIdx + 1, 0, group);
      } else {
        this.layers.push(group);
      }
    }

    this.setActiveLayer(group.id);
    this.notifyUpdate();
    return group;
  }

  toggleGroupCollapse(groupId) {
    const group = this.layers.find(l => l.id === groupId);
    if (!group || group.type !== 'group') return;
    group.collapsed = !group.collapsed;
    this.renderLayerStackUI();
  }

  ungroup(targetId) {
    let group = this.layers.find(l => l.id === targetId);
    if (group && group.type !== 'group' && group.parentId) {
      group = this.layers.find(l => l.id === group.parentId);
    }
    if (!group || group.type !== 'group') return;
    const groupId = group.id;

    this.layers.forEach(l => {
      if (l.parentId === groupId) {
        l.parentId = group.parentId || null;
      }
    });

    const idx = this.layers.findIndex(l => l.id === groupId);
    if (idx !== -1) {
      this.layers.splice(idx, 1);
    }
    const nextLayer = this.layers[Math.max(0, idx - 1)];
    if (nextLayer) this.setActiveLayer(nextLayer.id);
    this.notifyUpdate();
  }

  addAdjustmentLayer(adjType, initialParams = {}) {
    this.adjCounter++;
    const titleMap = {
      brightnessContrast: 'Brightness / Contrast',
      hueSaturation: 'Hue / Saturation',
      curves: 'Curves & Levels',
      colorBalance: 'Color Balance',
      vibrance: 'Vibrance',
      photoFilter: 'Photo Filter',
      threshold: 'Threshold',
      posterize: 'Posterize',
      invert: 'Invert',
      blackWhite: 'Black & White',
      gradientMap: 'Gradient Map',
      colorLookup: 'Color Lookup',
      selectiveColor: 'Selective Color',
      channelMixer: 'Channel Mixer'
    };
    const title = (titleMap[adjType] || adjType) + ` ${this.adjCounter}`;
    const adjLayer = this.createLayerObject(title, 'adjustment', {
      adjustmentType: adjType,
      adjustmentParams: { ...initialParams }
    });
    adjLayer.isAdjustment = true;

    // Default white mask (revealing adjustment across full canvas)
    adjLayer.hasMask = true;
    adjLayer.maskCanvas = Utils.createCanvas(this.width, this.height);
    adjLayer.maskCtx = adjLayer.maskCanvas.getContext('2d');
    adjLayer.maskCtx.fillStyle = '#ffffff';
    adjLayer.maskCtx.fillRect(0, 0, this.width, this.height);
    adjLayer.isMaskActive = false;

    const activeIdx = this.layers.findIndex(l => l.id === this.activeLayerId);
    if (activeIdx !== -1) {
      if (this.layers[activeIdx].parentId) {
        adjLayer.parentId = this.layers[activeIdx].parentId;
      }
      this.layers.splice(activeIdx + 1, 0, adjLayer);
    } else {
      this.layers.push(adjLayer);
    }

    this.setActiveLayer(adjLayer.id);
    this.notifyUpdate();
    return adjLayer;
  }

  addTextLayer(text = 'PixelForge Studio', x = null, y = null, params = {}) {
    this.textCounter = (this.textCounter || 0) + 1;
    const defaultParams = {
      text: text || 'PixelForge Studio',
      fontFamily: params.fontFamily || 'Inter, sans-serif',
      fontSize: params.fontSize || 48,
      fontWeight: params.fontWeight || 'bold',
      fontStyle: params.fontStyle || 'normal',
      color: params.color || '#ffffff',
      tracking: params.tracking || 0,
      leading: params.leading || 1.25,
      baselineShift: params.baselineShift || 0,
      allCaps: !!params.allCaps,
      smallCaps: !!params.smallCaps,
      superscript: !!params.superscript,
      subscript: !!params.subscript,
      underline: !!params.underline,
      strikethrough: !!params.strikethrough,
      align: params.align || 'left',
      boxWidth: params.boxWidth !== undefined ? params.boxWidth : 0,
      boxHeight: params.boxHeight !== undefined ? params.boxHeight : 0,
      firstLineIndent: params.firstLineIndent || 0,
      leftIndent: params.leftIndent || 0,
      rightIndent: params.rightIndent || 0,
      spaceBefore: params.spaceBefore || 0,
      spaceAfter: params.spaceAfter || 0,
      x: (x !== null) ? Math.round(x) : Math.round(this.width * 0.1),
      y: (y !== null) ? Math.round(y) : Math.round(this.height * 0.4),
      subpath: params.subpath || null,
      path: params.path || null,
      pathOffset: params.pathOffset || 0
    };

    const layer = this.createLayerObject(`Text Layer ${this.textCounter}`, 'text', {
      textParams: { ...defaultParams }
    });

    this.renderTextLayer(layer);

    const activeIdx = this.layers.findIndex(l => l.id === this.activeLayerId);
    if (activeIdx !== -1) {
      if (this.layers[activeIdx].parentId) {
        layer.parentId = this.layers[activeIdx].parentId;
      }
      this.layers.splice(activeIdx + 1, 0, layer);
    } else {
      this.layers.push(layer);
    }

    this.setActiveLayer(layer.id);
    this.notifyUpdate();
    return layer;
  }

  renderTextLayer(layer) {
    if (!layer || layer.type !== 'text' || !layer.textParams) return;
    const p = layer.textParams;
    const ctx = layer.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    ctx.save();
    let textToDraw = p.text || '';
    if (p.allCaps) {
      textToDraw = textToDraw.toUpperCase();
    }

    const size = Math.max(6, Math.min(600, p.fontSize || 48));
    const family = p.fontFamily || 'Inter, sans-serif';
    const weight = p.fontWeight || 'normal';
    const style = p.fontStyle || 'normal';
    const tracking = p.tracking || 0;
    const leading = (p.leading || 1.25) * size;
    const baselineShift = p.baselineShift || 0;

    // Text-on-Path support
    if (p.path || p.subpath) {
      let arcData = null;
      if (typeof PathManager !== 'undefined') {
        const dummyPm = new PathManager();
        if (p.subpath) {
          dummyPm.subpaths = [p.subpath];
        } else if (p.path && p.path.subpaths) {
          dummyPm.fromJSON(p.path);
        }
        arcData = dummyPm.getArcLengthData(0);
      }

      if (arcData && arcData.totalLength > 0) {
        ctx.font = `${style} ${weight} ${size}px ${family}`;
        ctx.fillStyle = p.color || '#ffffff';
        ctx.textBaseline = 'middle';

        let totalTextWidth = 0;
        for (let c = 0; c < textToDraw.length; c++) {
          totalTextWidth += ctx.measureText(textToDraw[c]).width + (c < textToDraw.length - 1 ? tracking : 0);
        }

        let startDist = p.pathOffset || 0;
        if (p.align === 'center') {
          startDist = (arcData.totalLength - totalTextWidth) / 2 + (p.pathOffset || 0);
        } else if (p.align === 'right') {
          startDist = arcData.totalLength - totalTextWidth + (p.pathOffset || 0);
        }

        let curDist = startDist;
        for (let c = 0; c < textToDraw.length; c++) {
          const char = textToDraw[c];
          const charW = ctx.measureText(char).width;
          const midDist = curDist + charW / 2;

          const pt = (typeof PathManager !== 'undefined') ? new PathManager().samplePointAtDistance(midDist, arcData) : null;
          if (pt) {
            ctx.save();
            ctx.translate(pt.x, pt.y);
            ctx.rotate(pt.angle);
            ctx.fillText(char, -charW / 2, baselineShift);
            ctx.restore();
          }

          curDist += charW + tracking;
        }

        ctx.restore();
        return;
      }
    }

    ctx.font = `${style} ${weight} ${size}px ${family}`;
    ctx.fillStyle = p.color || '#ffffff';
    ctx.textBaseline = 'alphabetic';

    const boxWidth = Math.max(0, p.boxWidth || 0);
    const boxHeight = Math.max(0, p.boxHeight || 0);
    const isAreaType = boxWidth > 0;
    const firstLineIndent = p.firstLineIndent || 0;
    const leftIndent = p.leftIndent || 0;
    const rightIndent = p.rightIndent || 0;
    const spaceBefore = p.spaceBefore || 0;
    const spaceAfter = p.spaceAfter || 0;

    // Helper: compute visual width of word token including tracking
    const measureWord = (word) => {
      let w = 0;
      for (let c = 0; c < word.length; c++) {
        w += ctx.measureText(word[c]).width + (c < word.length - 1 ? tracking : 0);
      }
      return w;
    };
    const spaceW = ctx.measureText(' ').width + tracking;

    // 1. Break input into paragraphs and wrap into lines
    const paragraphs = textToDraw.split('\n');
    const layoutLines = []; // { text, words, isFirstLine, isLastLine, yOffset, indent, lineWidth }

    let currentY = p.y;

    paragraphs.forEach((para, paraIdx) => {
      if (paraIdx > 0 && spaceBefore > 0) {
        currentY += spaceBefore;
      }

      if (!isAreaType) {
        // Point text mode: 1 line per paragraph
        const lineWidth = measureWord(para);
        layoutLines.push({
          text: para,
          words: para.split(' '),
          isFirstLine: true,
          isLastLine: true,
          y: currentY,
          indent: 0,
          lineWidth
        });
        currentY += leading;
      } else {
        // Area Type mode: auto-wrap words within boxWidth
        const words = para.split(' ').filter(w => w.length > 0);
        if (words.length === 0) {
          // Empty paragraph break
          layoutLines.push({
            text: '',
            words: [''],
            isFirstLine: true,
            isLastLine: true,
            y: currentY,
            indent: firstLineIndent + leftIndent,
            lineWidth: 0
          });
          currentY += leading;
        } else {
          let lineWords = [];
          let currentLineWidth = 0;
          let isFirst = true;

          for (let wIdx = 0; wIdx < words.length; wIdx++) {
            const word = words[wIdx];
            const wordWidth = measureWord(word);
            const lineIndent = (isFirst ? firstLineIndent : 0) + leftIndent;
            const availableW = Math.max(20, boxWidth - lineIndent - rightIndent);

            const testWidth = lineWords.length === 0 
              ? wordWidth 
              : currentLineWidth + spaceW + wordWidth;

            if (testWidth <= availableW || lineWords.length === 0) {
              lineWords.push(word);
              currentLineWidth = testWidth;
            } else {
              // Commit current line
              layoutLines.push({
                text: lineWords.join(' '),
                words: [...lineWords],
                isFirstLine: isFirst,
                isLastLine: false,
                y: currentY,
                indent: lineIndent,
                lineWidth: currentLineWidth
              });
              currentY += leading;
              isFirst = false;

              // Start next line
              lineWords = [word];
              currentLineWidth = wordWidth;
            }
          }

          if (lineWords.length > 0) {
            const lineIndent = (isFirst ? firstLineIndent : 0) + leftIndent;
            layoutLines.push({
              text: lineWords.join(' '),
              words: [...lineWords],
              isFirstLine: isFirst,
              isLastLine: true,
              y: currentY,
              indent: lineIndent,
              lineWidth: currentLineWidth
            });
            currentY += leading;
          }
        }
      }

      if (spaceAfter > 0) {
        currentY += spaceAfter;
      }
    });

    // 2. Render layout lines with justification & alignment
    layoutLines.forEach((l) => {
      // Optional Box Height clipping
      if (boxHeight > 0 && (l.y - p.y) > boxHeight) {
        return;
      }

      const lineY = l.y + baselineShift;
      const align = p.align || 'left';
      const availableW = isAreaType ? Math.max(20, boxWidth - l.indent - rightIndent) : l.lineWidth;

      let lineX = p.x + l.indent;
      let extraWordSpace = 0;

      // Handle Justification logic
      const isJustify = ['justify', 'justify-left', 'justify-center', 'justify-right', 'justify-all'].includes(align);

      if (isJustify) {
        const canJustify = (!l.isLastLine || align === 'justify-all') && l.words.length > 1;
        if (canJustify) {
          const slack = Math.max(0, availableW - l.lineWidth);
          extraWordSpace = slack / (l.words.length - 1);
        } else {
          // Alignment for last line of justified paragraph
          if (align === 'justify-center') {
            lineX = p.x + l.indent + (availableW - l.lineWidth) / 2;
          } else if (align === 'justify-right') {
            lineX = p.x + l.indent + (availableW - l.lineWidth);
          }
        }
      } else if (align === 'center') {
        lineX = isAreaType 
          ? p.x + l.indent + (availableW - l.lineWidth) / 2 
          : p.x - l.lineWidth / 2;
      } else if (align === 'right') {
        lineX = isAreaType 
          ? p.x + l.indent + (availableW - l.lineWidth) 
          : p.x - l.lineWidth;
      }

      // Render words and glyphs
      let curX = lineX;
      for (let w = 0; w < l.words.length; w++) {
        const word = l.words[w];

        for (let c = 0; c < word.length; c++) {
          const char = word[c];
          const charW = ctx.measureText(char).width;

          let charY = lineY;
          let charSize = size;
          if (p.superscript) {
            charY = lineY - size * 0.35;
            charSize = size * 0.65;
            ctx.font = `${style} ${weight} ${charSize}px ${family}`;
          } else if (p.subscript) {
            charY = lineY + size * 0.2;
            charSize = size * 0.65;
            ctx.font = `${style} ${weight} ${charSize}px ${family}`;
          } else if (p.smallCaps && char >= 'a' && char <= 'z') {
            charSize = size * 0.8;
            ctx.font = `${style} ${weight} ${charSize}px ${family}`;
          }

          ctx.fillText(p.smallCaps ? char.toUpperCase() : char, curX, charY);

          if (p.superscript || p.subscript || (p.smallCaps && char >= 'a' && char <= 'z')) {
            ctx.font = `${style} ${weight} ${size}px ${family}`;
          }

          curX += charW + tracking;
        }

        if (w < l.words.length - 1) {
          ctx.fillText(' ', curX, lineY);
          curX += spaceW + extraWordSpace;
        }
      }

      // Underline
      if (p.underline && l.lineWidth > 0) {
        ctx.save();
        ctx.strokeStyle = p.color || '#ffffff';
        ctx.lineWidth = Math.max(1, Math.round(size / 16));
        ctx.beginPath();
        ctx.moveTo(lineX, lineY + size * 0.15);
        ctx.lineTo(lineX + (extraWordSpace > 0 ? availableW : l.lineWidth), lineY + size * 0.15);
        ctx.stroke();
        ctx.restore();
      }

      // Strikethrough
      if (p.strikethrough && l.lineWidth > 0) {
        ctx.save();
        ctx.strokeStyle = p.color || '#ffffff';
        ctx.lineWidth = Math.max(1, Math.round(size / 16));
        ctx.beginPath();
        ctx.moveTo(lineX, lineY - size * 0.28);
        ctx.lineTo(lineX + (extraWordSpace > 0 ? availableW : l.lineWidth), lineY - size * 0.28);
        ctx.stroke();
        ctx.restore();
      }
    });

    ctx.restore();
  }

  rasterizeTextLayer(layerId = null) {
    const id = layerId || this.activeLayerId;
    const layer = this.layers.find(l => l.id === id);
    if (!layer || layer.type !== 'text') return false;

    this.renderTextLayer(layer);
    layer.type = 'raster';
    layer.textParams = null;
    this.notifyUpdate();
    return true;
  }

  // ══════════════════════════════════════════════════════════════════════
  // Live Vector Shape Layer Engine (Photoshop Parity)
  // ══════════════════════════════════════════════════════════════════════

  addShapeLayer(name = 'Shape Layer', vectorData = null) {
    this.layerCounter = (this.layerCounter || 0) + 1;
    const defaultVectorData = vectorData || {
      subpaths: [],
      fill: { enabled: true, color: '#3b82f6' },
      stroke: {
        enabled: true,
        color: '#ffffff',
        width: 2,
        dash: [],
        cap: 'round',
        join: 'round',
        align: 'center'
      }
    };

    const layer = this.createLayerObject(name || `Shape ${this.layerCounter}`, 'shape', {
      vectorShape: defaultVectorData
    });

    this.renderShapeLayer(layer);

    const activeIdx = this.layers.findIndex(l => l.id === this.activeLayerId);
    if (activeIdx !== -1) {
      if (this.layers[activeIdx].parentId) {
        layer.parentId = this.layers[activeIdx].parentId;
      }
      this.layers.splice(activeIdx + 1, 0, layer);
    } else {
      this.layers.push(layer);
    }

    this.setActiveLayer(layer.id);
    this.notifyUpdate();
    return layer;
  }

  renderShapeLayer(layer) {
    if (!layer || layer.type !== 'shape' || !layer.vectorShape) return;
    const s = layer.vectorShape;
    const ctx = layer.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    if (typeof PathManager === 'undefined') return;
    const pm = new PathManager();
    if (s.subpaths) {
      pm.subpaths = s.subpaths.map(sp => {
        if (typeof Subpath !== 'undefined' && sp instanceof Subpath) return sp.clone();
        const pts = (sp.points || []).map(p => new VectorPoint(p.x, p.y, p.cp1, p.cp2, p.type));
        return new Subpath(pts, !!sp.closed);
      });
    }

    if (pm.isEmpty()) return;

    if (s.fill && s.fill.enabled) {
      pm.fillPath(ctx, s.fill.color || '#3b82f6');
    }

    if (s.stroke && s.stroke.enabled && s.stroke.width > 0) {
      pm.strokePath(
        ctx,
        s.stroke.color || '#ffffff',
        s.stroke.width || 2,
        s.stroke.dash || [],
        s.stroke.cap || 'round',
        s.stroke.join || 'round',
        s.stroke.align || 'center'
      );
    }
  }

  rasterizeShapeLayer(layerId = null) {
    const id = layerId || this.activeLayerId;
    const layer = this.layers.find(l => l.id === id);
    if (!layer || layer.type !== 'shape') return false;

    this.renderShapeLayer(layer);
    layer.type = 'raster';
    layer.vectorShape = null;
    this.notifyUpdate();
    return true;
  }

  addLayerFromImage(img, name = 'Image') {
    const layer = this.createLayerObject(name, 'raster');
    layer.ctx.drawImage(img, 0, 0, this.width, this.height);
    this.layers.push(layer);
    this.setActiveLayer(layer.id);
    this.notifyUpdate();
    return layer;
  }

  addFillLayer(color = '#3b82f6') {
    const layer = this.createLayerObject(`Color Fill ${this.layerCounter}`, 'raster');
    layer.ctx.fillStyle = color;
    layer.ctx.fillRect(0, 0, this.width, this.height);
    this.layers.push(layer);
    this.setActiveLayer(layer.id);
    this.addLayerMask(layer.id);
    this.notifyUpdate();
    return layer;
  }

  getActiveLayer() {
    return this.layers.find(l => l.id === this.activeLayerId) || this.layers[this.layers.length - 1];
  }

  // Active drawing context: returns maskCtx if editing mask, else layer ctx
  getActiveDrawCtx() {
    const active = this.getActiveLayer();
    if (!active) return null;
    if (active.locked) return null;
    if (active.hasMask && active.isMaskActive && active.maskCtx) {
      return active.maskCtx;
    }
    return active.ctx;
  }

  get isMaskSelected() {
    const active = this.getActiveLayer();
    return !!(active && active.hasMask && active.isMaskActive);
  }

  setActiveLayer(id) {
    if (this.layers.some(l => l.id === id)) {
      this.activeLayerId = id;
      this.selectedLayerIds.clear();
      this.selectedLayerIds.add(id);
      this.syncControls();
      this.renderLayerStackUI();
      const activeLayer = this.getActiveLayer();
      if (typeof window !== 'undefined' && activeLayer?.type === 'adjustment' && window.app?.openAdjustmentLayerEditor) {
        window.app.openAdjustmentLayerEditor(activeLayer);
      }
    }
  }

  selectLayer(id, isShift = false, isCtrl = false) {
    if (!this.layers.some(l => l.id === id)) return;

    if (isShift && this.activeLayerId) {
      const fromIdx = this.layers.findIndex(l => l.id === this.activeLayerId);
      const toIdx = this.layers.findIndex(l => l.id === id);
      if (fromIdx !== -1 && toIdx !== -1) {
        const min = Math.min(fromIdx, toIdx);
        const max = Math.max(fromIdx, toIdx);
        this.selectedLayerIds.clear();
        for (let i = min; i <= max; i++) {
          this.selectedLayerIds.add(this.layers[i].id);
        }
        this.activeLayerId = id;
      }
    } else if (isCtrl) {
      if (this.selectedLayerIds.has(id)) {
        if (this.selectedLayerIds.size > 1) {
          this.selectedLayerIds.delete(id);
          if (this.activeLayerId === id) {
            this.activeLayerId = Array.from(this.selectedLayerIds)[0];
          }
        }
      } else {
        this.selectedLayerIds.add(id);
        this.activeLayerId = id;
      }
    } else {
      this.selectedLayerIds.clear();
      this.selectedLayerIds.add(id);
      this.activeLayerId = id;
    }

    this.syncControls();
    this.renderLayerStackUI();
    const activeLayer = this.getActiveLayer();
    if (typeof window !== 'undefined' && activeLayer?.type === 'adjustment' && window.app?.openAdjustmentLayerEditor) {
      window.app.openAdjustmentLayerEditor(activeLayer);
    }
  }

  getSelectedLayers() {
    return this.layers.filter(l => this.selectedLayerIds.has(l.id));
  }

  selectAllLayers() {
    this.selectedLayerIds.clear();
    this.layers.forEach(l => this.selectedLayerIds.add(l.id));
    this.renderLayerStackUI();
  }

  deselectAllLayers() {
    this.selectedLayerIds.clear();
    if (this.activeLayerId) this.selectedLayerIds.add(this.activeLayerId);
    this.renderLayerStackUI();
  }

  isLayerHiddenByCollapse(layer) {
    if (!layer.parentId) return false;
    const parent = this.layers.find(l => l.id === layer.parentId);
    if (!parent) return false;
    if (parent.collapsed) return true;
    return this.isLayerHiddenByCollapse(parent);
  }

  isLayerHiddenByGroupVisibility(layer) {
    if (!layer.parentId) return false;
    const parent = this.layers.find(l => l.id === layer.parentId);
    if (!parent) return false;
    if (!parent.visible) return true;
    return this.isLayerHiddenByGroupVisibility(parent);
  }

  getEffectiveOpacity(layer) {
    let opacity = layer.opacity;
    let pId = layer.parentId;
    while (pId) {
      const parent = this.layers.find(l => l.id === pId);
      if (parent) {
        opacity = (opacity * parent.opacity) / 100;
        pId = parent.parentId;
      } else {
        break;
      }
    }
    return opacity;
  }

  // ── Precision Bounding Box & Canvas Hit Testing ──
  getLayerContentBounds(layerId = null) {
    const id = layerId || this.activeLayerId;
    const layer = this.layers.find(l => l.id === id) || this.getActiveLayer();
    if (!layer || !layer.ctx) return null;

    const w = this.width;
    const h = this.height;
    try {
      const imgData = layer.ctx.getImageData(0, 0, w, h);
      const d = imgData.data;
      let minX = w, minY = h, maxX = -1, maxY = -1;

      for (let y = 0; y < h; y += 2) {
        for (let x = 0; x < w; x += 2) {
          if (d[(y * w + x) * 4 + 3] > 8) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }

      if (maxX === -1) {
        return { minX: 0, minY: 0, maxX: w, maxY: h, w, h };
      }

      const pad = 4;
      minX = Math.max(0, minX - pad);
      minY = Math.max(0, minY - pad);
      maxX = Math.min(w, maxX + pad + 2);
      maxY = Math.min(h, maxY + pad + 2);

      return {
        minX,
        minY,
        maxX,
        maxY,
        w: Math.max(1, maxX - minX),
        h: Math.max(1, maxY - minY)
      };
    } catch (e) {
      return { minX: 0, minY: 0, maxX: w, maxY: h, w, h };
    }
  }

  getTopVisibleLayerAt(x, y) {
    const px = Math.round(x);
    const py = Math.round(y);
    if (px < 0 || py < 0 || px >= this.width || py >= this.height) return null;

    // Scan backwards from top layer down to bottom
    for (let i = this.layers.length - 1; i >= 0; i--) {
      const layer = this.layers[i];
      if (!layer.visible || layer.isAdjustment || layer.isGroup) continue;
      if (this.isLayerHiddenByGroupVisibility(layer)) continue;

      try {
        const pixel = layer.ctx.getImageData(px, py, 1, 1).data;
        if (pixel[3] > 10) {
          return layer;
        }
      } catch (e) {
        // Fallback to active if getImageData fails
      }
    }
    return this.getActiveLayer();
  }

  scaleLayer(layerId, newW, newH, resampleMode = 'bicubic') {
    const targetLayer = this.layers.find(l => l.id === layerId) || this.getActiveLayer();
    if (!targetLayer || !targetLayer.ctx) return false;

    const bounds = this.getLayerContentBounds(targetLayer.id);
    if (!bounds || bounds.w <= 0 || bounds.h <= 0) return false;

    // Copy original cropped content
    const srcCanvas = Utils.createCanvas(bounds.w, bounds.h);
    const srcCtx = srcCanvas.getContext('2d');
    srcCtx.drawImage(targetLayer.canvas, bounds.minX, bounds.minY, bounds.w, bounds.h, 0, 0, bounds.w, bounds.h);

    // Clear original region on target layer
    targetLayer.ctx.clearRect(bounds.minX, bounds.minY, bounds.w, bounds.h);

    // Destination scaled dimensions and origin
    const destW = Math.max(1, Math.round(newW));
    const destH = Math.max(1, Math.round(newH));
    const destX = bounds.minX;
    const destY = bounds.minY;

    // Apply scaling
    targetLayer.ctx.save();
    targetLayer.ctx.imageSmoothingEnabled = resampleMode !== 'nearest';
    if (targetLayer.ctx.imageSmoothingEnabled) {
      targetLayer.ctx.imageSmoothingQuality = resampleMode === 'bicubic' ? 'high' : 'medium';
    }
    targetLayer.ctx.drawImage(srcCanvas, 0, 0, bounds.w, bounds.h, destX, destY, destW, destH);
    targetLayer.ctx.restore();

    // Scale layer mask if present
    if (targetLayer.hasMask && targetLayer.maskCanvas && targetLayer.maskCtx) {
      const maskSrc = Utils.createCanvas(bounds.w, bounds.h);
      const mCtx = maskSrc.getContext('2d');
      mCtx.drawImage(targetLayer.maskCanvas, bounds.minX, bounds.minY, bounds.w, bounds.h, 0, 0, bounds.w, bounds.h);
      targetLayer.maskCtx.clearRect(bounds.minX, bounds.minY, bounds.w, bounds.h);
      targetLayer.maskCtx.save();
      targetLayer.maskCtx.imageSmoothingEnabled = resampleMode !== 'nearest';
      targetLayer.maskCtx.drawImage(maskSrc, 0, 0, bounds.w, bounds.h, destX, destY, destW, destH);
      targetLayer.maskCtx.restore();
    }

    return true;
  }

  // ── Layer Masks ──
  addLayerMask(layerId = null) {
    const id = layerId || this.activeLayerId;
    const layer = this.layers.find(l => l.id === id);
    if (!layer || layer.hasMask) return;

    layer.hasMask = true;
    layer.maskCanvas = Utils.createCanvas(this.width, this.height);
    layer.maskCtx = layer.maskCanvas.getContext('2d');
    // Default fill white (revealing everything)
    layer.maskCtx.fillStyle = '#ffffff';
    layer.maskCtx.fillRect(0, 0, this.width, this.height);
    layer.isMaskActive = true;
    layer.maskDisabled = false;

    this.notifyUpdate();
  }

  removeLayerMask(layerId = null, apply = false) {
    const id = layerId || this.activeLayerId;
    const layer = this.layers.find(l => l.id === id);
    if (!layer || !layer.hasMask) return;

    if (apply && layer.maskCanvas && !layer.maskDisabled) {
      layer.ctx.save();
      layer.ctx.globalCompositeOperation = 'destination-in';
      layer.ctx.drawImage(layer.maskCanvas, 0, 0);
      layer.ctx.restore();
    }

    layer.hasMask = false;
    layer.maskCanvas = null;
    layer.maskCtx = null;
    layer.isMaskActive = false;
    layer.maskDisabled = false;
    this.notifyUpdate();
  }

  toggleMaskDisabled(layerId = null) {
    const id = layerId || this.activeLayerId;
    const layer = this.layers.find(l => l.id === id);
    if (!layer || !layer.hasMask) return;
    layer.maskDisabled = !layer.maskDisabled;
    this.notifyUpdate();
  }

  invertMask(layerId = null) {
    this.invertLayerMask(layerId);
  }

  invertLayerMask(layerId = null) {
    const id = layerId || this.activeLayerId;
    const layer = this.layers.find(l => l.id === id);
    if (!layer || !layer.hasMask || !layer.maskCtx) return;

    const imgData = layer.maskCtx.getImageData(0, 0, this.width, this.height);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      const inv = 255 - d[i];
      d[i] = d[i + 1] = d[i + 2] = inv;
      d[i + 3] = 255;
    }
    layer.maskCtx.putImageData(imgData, 0, 0);
    this.notifyUpdate();
  }

  // ── Clipping Masks & Locks ──
  toggleClippingMask(layerId = null) {
    const id = layerId || this.activeLayerId;
    const idx = this.layers.findIndex(l => l.id === id);
    if (idx <= 0) return; // Cannot clip bottom-most layer

    const layer = this.layers[idx];
    layer.isClipped = !layer.isClipped;
    this.notifyUpdate();
  }

  toggleLockAlpha(layerId = null) {
    const id = layerId || this.activeLayerId;
    const layer = this.layers.find(l => l.id === id);
    if (!layer) return;
    layer.lockAlpha = !layer.lockAlpha;
    this.notifyUpdate();
  }

  toggleLock(layerId = null) {
    const id = layerId || this.activeLayerId;
    const layer = this.layers.find(l => l.id === id);
    if (!layer) return;
    layer.locked = !layer.locked;
    this.notifyUpdate();
  }

  setLayerColorTag(layerId, color) {
    const layer = this.layers.find(l => l.id === layerId);
    if (!layer) return;
    layer.colorTag = color === 'none' ? null : color;
    this.notifyUpdate();
  }

  duplicateActiveLayer() {
    const active = this.getActiveLayer();
    if (!active) return null;
    const newLayer = this.createLayerObject(`${active.name} Copy`);
    newLayer.ctx.drawImage(active.canvas, 0, 0);
    newLayer.opacity = active.opacity;
    newLayer.blendMode = active.blendMode;
    newLayer.visible = active.visible;
    newLayer.locked = active.locked;
    newLayer.lockAlpha = active.lockAlpha;
    newLayer.isClipped = active.isClipped;
    newLayer.colorTag = active.colorTag;

    if (active.styles) {
      newLayer.styles = JSON.parse(JSON.stringify(active.styles));
    }

    if (active.type === 'smart-object' && active.smartObjectData) {
      newLayer.type = 'smart-object';
      newLayer.smartObjectData = active.smartObjectData.clone();
      newLayer.smartObjectData.renderToLayer(newLayer);
    }

    if (active.hasMask && active.maskCanvas) {
      newLayer.hasMask = true;
      newLayer.maskCanvas = Utils.createCanvas(this.width, this.height);
      newLayer.maskCtx = newLayer.maskCanvas.getContext('2d');
      newLayer.maskCtx.drawImage(active.maskCanvas, 0, 0);
      newLayer.maskDisabled = active.maskDisabled;
    }

    const idx = this.layers.findIndex(l => l.id === active.id);
    this.layers.splice(idx + 1, 0, newLayer);
    this.activeLayerId = newLayer.id;
    this.notifyUpdate();
    return newLayer;
  }

  deleteActiveLayer() {
    if (this.layers.length <= 1) {
      alert("Cannot delete the only remaining layer!");
      return false;
    }

    const toDelete = new Set(this.selectedLayerIds.size > 0 ? this.selectedLayerIds : [this.activeLayerId]);
    if (toDelete.size >= this.layers.length) {
      alert("Cannot delete all layers!");
      return false;
    }

    // Recursively collect all descendant layers if any groups are deleted
    let addedMore = true;
    while (addedMore) {
      addedMore = false;
      this.layers.forEach(l => {
        if (l.parentId && toDelete.has(l.parentId) && !toDelete.has(l.id)) {
          toDelete.add(l.id);
          addedMore = true;
        }
      });
    }

    this.layers = this.layers.filter(l => !toDelete.has(l.id));
    this.selectedLayerIds.clear();
    const remaining = this.layers[this.layers.length - 1];
    if (remaining) {
      this.activeLayerId = remaining.id;
      this.selectedLayerIds.add(remaining.id);
    }
    this.notifyUpdate();
    return true;
  }

  renderProceduralPattern(name, w, h, scale = 100) {
    const can = Utils.createCanvas(w, h);
    const pCtx = can.getContext('2d');
    const s = Math.max(4, Math.round((scale / 100) * 20));

    if (name === 'grid') {
      pCtx.strokeStyle = 'rgba(255,255,255,0.7)';
      pCtx.lineWidth = 1;
      for (let x = 0; x < w; x += s) {
        pCtx.beginPath(); pCtx.moveTo(x, 0); pCtx.lineTo(x, h); pCtx.stroke();
      }
      for (let y = 0; y < h; y += s) {
        pCtx.beginPath(); pCtx.moveTo(0, y); pCtx.lineTo(w, y); pCtx.stroke();
      }
    } else if (name === 'dots') {
      pCtx.fillStyle = 'rgba(255,255,255,0.8)';
      const r = Math.max(1, s / 6);
      for (let y = s / 2; y < h; y += s) {
        for (let x = s / 2; x < w; x += s) {
          pCtx.beginPath(); pCtx.arc(x, y, r, 0, Math.PI * 2); pCtx.fill();
        }
      }
    } else if (name === 'stripes') {
      pCtx.strokeStyle = 'rgba(255,255,255,0.6)';
      pCtx.lineWidth = Math.max(1, s / 3);
      for (let d = -h; d < w + h; d += s) {
        pCtx.beginPath(); pCtx.moveTo(d, 0); pCtx.lineTo(d + h, h); pCtx.stroke();
      }
    } else if (name === 'checker') {
      pCtx.fillStyle = 'rgba(255,255,255,0.6)';
      for (let y = 0; y < h; y += s) {
        for (let x = 0; x < w; x += s) {
          if ((Math.floor(x / s) + Math.floor(y / s)) % 2 === 0) {
            pCtx.fillRect(x, y, s, s);
          }
        }
      }
    } else if (name === 'noise') {
      const img = pCtx.createImageData(w, h);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = Math.floor(Math.random() * 255);
        img.data[i] = v; img.data[i+1] = v; img.data[i+2] = v; img.data[i+3] = 160;
      }
      pCtx.putImageData(img, 0, 0);
    }
    return can;
  }

  applyInnerStyles(ctx, shapeCanvas, w, h, styles) {
    if (!styles) return;

    // Pattern Overlay
    if (styles.patternOverlay?.enabled) {
      const po = styles.patternOverlay;
      const patCan = this.renderProceduralPattern(po.pattern || 'grid', w, h, po.scale || 100);
      const temp = Utils.createCanvas(w, h);
      const tCtx = temp.getContext('2d');
      tCtx.drawImage(patCan, 0, 0);
      tCtx.globalCompositeOperation = 'destination-in';
      tCtx.drawImage(shapeCanvas, 0, 0);

      ctx.save();
      ctx.globalAlpha = (po.opacity ?? 100) / 100;
      ctx.globalCompositeOperation = po.blendMode || 'source-over';
      ctx.drawImage(temp, 0, 0);
      ctx.restore();
    }

    // Satin
    if (styles.satin?.enabled) {
      const sat = styles.satin;
      const rad = ((sat.angle ?? 19) * Math.PI) / 180;
      const dist = sat.distance ?? 11;
      const offX = Math.round(Math.cos(rad) * dist);
      const offY = Math.round(Math.sin(rad) * dist);

      const temp = Utils.createCanvas(w, h);
      const tCtx = temp.getContext('2d');
      tCtx.drawImage(shapeCanvas, offX, offY);
      tCtx.globalCompositeOperation = sat.invert ? 'source-out' : 'xor';
      tCtx.drawImage(shapeCanvas, -offX, -offY);

      tCtx.globalCompositeOperation = 'source-in';
      tCtx.fillStyle = Utils.hexToRgba(sat.color || '#000000', (sat.opacity ?? 50) / 100);
      tCtx.fillRect(0, 0, w, h);

      tCtx.globalCompositeOperation = 'destination-in';
      tCtx.drawImage(shapeCanvas, 0, 0);

      ctx.save();
      ctx.drawImage(temp, 0, 0);
      ctx.restore();
    }

    // Inner Shadow
    if (styles.innerShadow?.enabled) {
      const is = styles.innerShadow;
      const rad = ((is.angle ?? 120) * Math.PI) / 180;
      const dist = is.distance ?? 5;
      const offX = Math.round(Math.cos(rad) * dist);
      const offY = Math.round(Math.sin(rad) * dist);

      const temp = Utils.createCanvas(w, h);
      const tCtx = temp.getContext('2d');
      const off = w + 10000;

      tCtx.save();
      tCtx.shadowColor = Utils.hexToRgba(is.color || '#000000', (is.opacity ?? 75) / 100);
      tCtx.shadowBlur = is.size ?? 5;
      tCtx.shadowOffsetX = off - offX;
      tCtx.shadowOffsetY = -offY;

      const cutout = Utils.createCanvas(w, h);
      const cCtx = cutout.getContext('2d');
      cCtx.fillStyle = '#000';
      cCtx.fillRect(0, 0, w, h);
      cCtx.globalCompositeOperation = 'destination-out';
      cCtx.drawImage(shapeCanvas, 0, 0);

      tCtx.drawImage(cutout, -off, 0);
      tCtx.restore();

      tCtx.globalCompositeOperation = 'destination-in';
      tCtx.drawImage(shapeCanvas, 0, 0);

      ctx.save();
      ctx.drawImage(temp, 0, 0);
      ctx.restore();
    }

    // Bevel & Emboss
    if (styles.bevelEmboss?.enabled) {
      const be = styles.bevelEmboss;
      const rad = ((be.angle ?? 120) * Math.PI) / 180;
      const size = Math.max(1, Math.min(50, be.size || 5));
      const offX = Math.round(Math.cos(rad) * size);
      const offY = Math.round(Math.sin(rad) * size);

      const hlCanvas = Utils.createCanvas(w, h);
      const hlCtx = hlCanvas.getContext('2d');
      hlCtx.drawImage(shapeCanvas, -offX, -offY);
      hlCtx.globalCompositeOperation = 'source-out';
      hlCtx.drawImage(shapeCanvas, 0, 0);
      hlCtx.globalCompositeOperation = 'source-in';
      hlCtx.fillStyle = Utils.hexToRgba(be.highlightColor || '#ffffff', (be.highlightOpacity ?? 75) / 100);
      hlCtx.fillRect(0, 0, w, h);
      hlCtx.globalCompositeOperation = 'destination-in';
      hlCtx.drawImage(shapeCanvas, 0, 0);

      const shCanvas = Utils.createCanvas(w, h);
      const shCtx = shCanvas.getContext('2d');
      shCtx.drawImage(shapeCanvas, offX, offY);
      shCtx.globalCompositeOperation = 'source-out';
      shCtx.drawImage(shapeCanvas, 0, 0);
      shCtx.globalCompositeOperation = 'source-in';
      shCtx.fillStyle = Utils.hexToRgba(be.shadowColor || '#000000', (be.shadowOpacity ?? 75) / 100);
      shCtx.fillRect(0, 0, w, h);
      shCtx.globalCompositeOperation = 'destination-in';
      shCtx.drawImage(shapeCanvas, 0, 0);

      ctx.save();
      ctx.drawImage(hlCanvas, 0, 0);
      ctx.drawImage(shCanvas, 0, 0);
      ctx.restore();
    }

    // Inner Glow
    if (styles.innerGlow?.enabled) {
      const ig = styles.innerGlow;
      const blur = Math.max(1, ig.blur || 10);
      const color = ig.color || '#ffffbe';
      const opacity = (ig.opacity ?? 75) / 100;
      const blendMode = ig.blendMode || 'screen';

      const temp = Utils.createCanvas(w, h);
      const tCtx = temp.getContext('2d');
      const off = w + 10000;

      tCtx.save();
      tCtx.shadowColor = Utils.hexToRgba(color, opacity);
      tCtx.shadowBlur = blur;
      tCtx.shadowOffsetX = off;
      tCtx.shadowOffsetY = 0;

      const cutout = Utils.createCanvas(w, h);
      const cCtx = cutout.getContext('2d');
      cCtx.fillStyle = '#000000';
      cCtx.fillRect(0, 0, w, h);
      cCtx.globalCompositeOperation = 'destination-out';
      cCtx.drawImage(shapeCanvas, 0, 0);

      tCtx.drawImage(cutout, -off, 0);
      tCtx.restore();

      tCtx.globalCompositeOperation = 'destination-in';
      tCtx.drawImage(shapeCanvas, 0, 0);

      ctx.save();
      ctx.globalCompositeOperation = blendMode;
      ctx.drawImage(temp, 0, 0);
      ctx.restore();
    }

    // Gradient Overlay
    if (styles.gradientOverlay?.enabled) {
      const go = styles.gradientOverlay;
      const angle = ((go.angle ?? 90) * Math.PI) / 180;
      const opacity = (go.opacity ?? 100) / 100;
      const blendMode = go.blendMode || 'source-over';
      const reverse = !!go.reverse;

      const temp = Utils.createCanvas(w, h);
      const tCtx = temp.getContext('2d');

      const cx = w / 2;
      const cy = h / 2;
      const scale = (go.scale ?? 100) / 100;
      const len = (Math.hypot(w, h) / 2) * scale;
      const x1 = cx - Math.cos(angle) * len;
      const y1 = cy - Math.sin(angle) * len;
      const x2 = cx + Math.cos(angle) * len;
      const y2 = cy + Math.sin(angle) * len;

      const grad = tCtx.createLinearGradient(reverse ? x2 : x1, reverse ? y2 : y1, reverse ? x1 : x2, reverse ? y1 : y2);
      if (go.stops && Array.isArray(go.stops) && go.stops.length > 0) {
        go.stops.forEach(s => grad.addColorStop(s.offset, s.color));
      } else {
        grad.addColorStop(0, '#000000');
        grad.addColorStop(1, '#ffffff');
      }

      tCtx.fillStyle = grad;
      tCtx.fillRect(0, 0, w, h);

      tCtx.globalCompositeOperation = 'destination-in';
      tCtx.drawImage(shapeCanvas, 0, 0);

      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.globalCompositeOperation = blendMode;
      ctx.drawImage(temp, 0, 0);
      ctx.restore();
    }
  }

  // Rasterize a layer with its masks, styles, and color overlay baked in
  rasterizeLayer(layer) {
    if (layer.type === 'smart-object' && layer.smartObjectData) {
      layer.smartObjectData.renderToLayer(layer);
      layer.type = 'raster';
      layer.smartObjectData = null;
    }

    const bakedCanvas = Utils.createCanvas(this.width, this.height);
    const bCtx = bakedCanvas.getContext('2d');

    const tempCanvas = Utils.createCanvas(this.width, this.height);
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(layer.canvas, 0, 0);

    // Apply Mask if present
    if (layer.hasMask && layer.maskCanvas && !layer.maskDisabled) {
      const maskAlpha = Utils.createCanvas(this.width, this.height);
      const mACtx = maskAlpha.getContext('2d');
      const mImgData = layer.maskCtx.getImageData(0, 0, this.width, this.height);
      const mData = mImgData.data;
      const aImgData = mACtx.createImageData(this.width, this.height);
      const aData = aImgData.data;
      for (let j = 0; j < mData.length; j += 4) {
        const lum = (mData[j] * 77 + mData[j + 1] * 150 + mData[j + 2] * 29) >> 8;
        aData[j] = 255;
        aData[j + 1] = 255;
        aData[j + 2] = 255;
        aData[j + 3] = (lum * mData[j + 3]) >> 8;
      }
      mACtx.putImageData(aImgData, 0, 0);
      tempCtx.save();
      tempCtx.globalCompositeOperation = 'destination-in';
      tempCtx.drawImage(maskAlpha, 0, 0);
      tempCtx.restore();
    }

    // Color Overlay
    if (layer.styles?.colorOverlay?.enabled) {
      const co = layer.styles.colorOverlay;
      const colCan = Utils.createCanvas(this.width, this.height);
      const colCtx = colCan.getContext('2d');
      colCtx.fillStyle = Utils.hexToRgba(co.color || '#3b82f6', (co.opacity ?? 50) / 100);
      colCtx.fillRect(0, 0, this.width, this.height);
      colCtx.save();
      colCtx.globalCompositeOperation = 'destination-in';
      colCtx.drawImage(tempCanvas, 0, 0);
      colCtx.restore();

      tempCtx.save();
      tempCtx.globalCompositeOperation = (co.blendMode && co.blendMode !== 'source-over') ? co.blendMode : 'source-atop';
      tempCtx.drawImage(colCan, 0, 0);
      tempCtx.restore();
    }

    // Layer Styles (Drop Shadow, Outer Glow, Stroke)
    const st = layer.styles;
    const hasStyles = st && (st.dropShadow?.enabled || st.outerGlow?.enabled || st.stroke?.enabled);

    if (hasStyles) {
      const offscreenShift = this.width + 10000;
      if (st.dropShadow?.enabled) {
        const ds = st.dropShadow;
        const rad = ((ds.angle ?? 120) * Math.PI) / 180;
        const dist = ds.distance ?? 8;
        const offX = Math.round(Math.cos(rad) * dist);
        const offY = Math.round(Math.sin(rad) * dist);
        bCtx.save();
        bCtx.shadowColor = Utils.hexToRgba(ds.color || '#000000', (ds.opacity ?? 75) / 100);
        bCtx.shadowBlur = ds.blur ?? 10;
        bCtx.shadowOffsetX = offscreenShift + offX;
        bCtx.shadowOffsetY = offY;
        bCtx.drawImage(tempCanvas, -offscreenShift, 0);
        bCtx.restore();
      }

      if (st.outerGlow?.enabled) {
        const og = st.outerGlow;
        bCtx.save();
        bCtx.shadowColor = Utils.hexToRgba(og.color || '#ffff00', (og.opacity ?? 75) / 100);
        bCtx.shadowBlur = og.blur ?? 12;
        bCtx.shadowOffsetX = offscreenShift;
        bCtx.shadowOffsetY = 0;
        bCtx.drawImage(tempCanvas, -offscreenShift, 0);
        bCtx.restore();
      }

      if (st.stroke?.enabled) {
        const str = st.stroke;
        const size = Math.max(1, Math.min(30, Math.round(str.size || 3)));
        const strokeColor = Utils.hexToRgba(str.color || '#000000', (str.opacity ?? 100) / 100);
        const strCan = Utils.createCanvas(this.width, this.height);
        const strCtx = strCan.getContext('2d');
        const steps = 16;
        for (let a = 0; a < steps; a++) {
          const theta = (a / steps) * Math.PI * 2;
          strCtx.drawImage(tempCanvas, Math.round(Math.cos(theta) * size), Math.round(Math.sin(theta) * size));
        }
        strCtx.save();
        strCtx.globalCompositeOperation = 'source-in';
        strCtx.fillStyle = strokeColor;
        strCtx.fillRect(0, 0, this.width, this.height);
        strCtx.restore();
        bCtx.drawImage(strCan, 0, 0);
      }
    }

    bCtx.drawImage(tempCanvas, 0, 0);

    // Bake Inner Styles (Pattern Overlay, Satin, Inner Shadow, Bevel & Emboss)
    this.applyInnerStyles(bCtx, tempCanvas, this.width, this.height, st);

    return bakedCanvas;
  }

  mergeDown() {
    const idx = this.layers.findIndex(l => l.id === this.activeLayerId);
    if (idx <= 0) return false;

    const top = this.layers[idx];
    const bottom = this.layers[idx - 1];

    const bakedTop = this.rasterizeLayer(top);
    this.applyBlendMode(bottom.ctx, bakedTop, top.blendMode, top.opacity);

    this.layers.splice(idx, 1);
    this.activeLayerId = bottom.id;
    this.notifyUpdate();
    return true;
  }

  mergeVisible() {
    const visibleLayers = this.layers.filter(l => l.visible);
    if (visibleLayers.length <= 1) return;

    const compCanvas = Utils.createCanvas(this.width, this.height);
    const compCtx = compCanvas.getContext('2d');
    this.compositeTo(compCtx);

    let highestIdx = -1;
    for (let i = this.layers.length - 1; i >= 0; i--) {
      if (this.layers[i].visible) {
        highestIdx = i;
        break;
      }
    }

    const mergedLayer = this.createLayerObject('Merged Visible');
    mergedLayer.ctx.drawImage(compCanvas, 0, 0);

    // Filter out visible layers and insert merged
    const newLayers = [];
    for (let i = 0; i < this.layers.length; i++) {
      if (i === highestIdx) {
        newLayers.push(mergedLayer);
      } else if (!this.layers[i].visible) {
        newLayers.push(this.layers[i]);
      }
    }

    this.layers = newLayers;
    this.activeLayerId = mergedLayer.id;
    this.notifyUpdate();
  }

  flattenImage() {
    if (this.layers.length <= 1) return;
    const flatCanvas = Utils.createCanvas(this.width, this.height);
    const flatCtx = flatCanvas.getContext('2d');

    // Fill white base
    flatCtx.fillStyle = '#ffffff';
    flatCtx.fillRect(0, 0, this.width, this.height);
    this.compositeTo(flatCtx);

    this.layers = [];
    this.layerCounter = 0;
    const bgLayer = this.addLayer('Background');
    bgLayer.ctx.drawImage(flatCanvas, 0, 0);
    this.notifyUpdate();
  }

  // ── Alignment ──
  alignLayer(layerId, alignment) {
    const id = layerId || this.activeLayerId;
    const layer = this.layers.find(l => l.id === id);
    if (!layer || layer.locked) return;

    const imgData = layer.ctx.getImageData(0, 0, this.width, this.height);
    const d = imgData.data;
    let minX = this.width, minY = this.height, maxX = -1, maxY = -1;

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const a = d[(y * this.width + x) * 4 + 3];
        if (a > 5) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (maxX === -1) return; // Layer is blank

    const contentW = maxX - minX + 1;
    const contentH = maxY - minY + 1;

    let targetX = minX;
    let targetY = minY;

    switch (alignment) {
      case 'left':
        targetX = 0;
        break;
      case 'center-h':
        targetX = Math.round((this.width - contentW) / 2);
        break;
      case 'right':
        targetX = this.width - contentW;
        break;
      case 'top':
        targetY = 0;
        break;
      case 'center-v':
        targetY = Math.round((this.height - contentH) / 2);
        break;
      case 'bottom':
        targetY = this.height - contentH;
        break;
    }

    const dx = targetX - minX;
    const dy = targetY - minY;

    if (dx === 0 && dy === 0) return;

    const temp = Utils.createCanvas(this.width, this.height);
    const tCtx = temp.getContext('2d');
    tCtx.drawImage(layer.canvas, dx, dy);

    layer.ctx.clearRect(0, 0, this.width, this.height);
    layer.ctx.drawImage(temp, 0, 0);

    if (layer.hasMask && layer.maskCanvas) {
      const mTemp = Utils.createCanvas(this.width, this.height);
      const mTCtx = mTemp.getContext('2d');
      mTCtx.drawImage(layer.maskCanvas, dx, dy);
      layer.maskCtx.clearRect(0, 0, this.width, this.height);
      layer.maskCtx.drawImage(mTemp, 0, 0);
    }

    this.notifyUpdate();
  }

  reorder(fromIdx, toIdx) {
    if (fromIdx < 0 || fromIdx >= this.layers.length || toIdx < 0 || toIdx >= this.layers.length) return;
    const [moved] = this.layers.splice(fromIdx, 1);
    this.layers.splice(toIdx, 0, moved);
    this.notifyUpdate();
  }

  resizeCanvas(newW, newH) {
    this.width = newW;
    this.height = newH;
    this.layers.forEach(layer => {
      const temp = Utils.createCanvas(newW, newH);
      const tCtx = temp.getContext('2d');
      tCtx.drawImage(layer.canvas, 0, 0);
      layer.canvas.width = newW;
      layer.canvas.height = newH;
      layer.ctx.drawImage(temp, 0, 0);

      if (layer.hasMask && layer.maskCanvas) {
        const mTemp = Utils.createCanvas(newW, newH);
        const mTCtx = mTemp.getContext('2d');
        mTCtx.fillStyle = '#ffffff';
        mTCtx.fillRect(0, 0, newW, newH);
        mTCtx.drawImage(layer.maskCanvas, 0, 0);
        layer.maskCanvas.width = newW;
        layer.maskCanvas.height = newH;
        layer.maskCtx.drawImage(mTemp, 0, 0);
      }
    });
    this.notifyUpdate();
  }

  // ── Layer Comps Architecture (Photoshop Parity) ──
  createLayerComp(name, options = {}) {
    const state = {};
    for (const layer of this.layers) {
      state[layer.id] = {
        visible: layer.visible,
        x: layer.x || 0,
        y: layer.y || 0,
        opacity: layer.opacity,
        blendMode: layer.blendMode,
        styles: layer.styles ? JSON.parse(JSON.stringify(layer.styles)) : null
      };
    }
    const comp = new LayerComp(name, state, options);
    this.layerComps.push(comp);
    this.activeCompId = comp.id;
    this.notifyUpdate();
    return comp;
  }

  applyLayerComp(compId) {
    const comp = this.layerComps.find(c => c.id === compId || c.name === compId);
    if (!comp) return false;

    for (const layer of this.layers) {
      const snap = comp.state[layer.id];
      if (!snap) continue;
      if (comp.captureVisibility !== false && snap.visible !== undefined) {
        layer.visible = snap.visible;
      }
      if (comp.capturePosition !== false) {
        if (snap.x !== undefined) layer.x = snap.x;
        if (snap.y !== undefined) layer.y = snap.y;
      }
      if (comp.captureAppearance !== false) {
        if (snap.opacity !== undefined) layer.opacity = snap.opacity;
        if (snap.blendMode !== undefined) layer.blendMode = snap.blendMode;
        if (snap.styles) {
          layer.styles = JSON.parse(JSON.stringify(snap.styles));
        }
      }
    }
    this.activeCompId = comp.id;
    this.notifyUpdate();
    return true;
  }

  updateLayerComp(compId) {
    const comp = this.layerComps.find(c => c.id === compId || c.name === compId);
    if (!comp) return false;
    for (const layer of this.layers) {
      comp.state[layer.id] = {
        visible: layer.visible,
        x: layer.x || 0,
        y: layer.y || 0,
        opacity: layer.opacity,
        blendMode: layer.blendMode,
        styles: layer.styles ? JSON.parse(JSON.stringify(layer.styles)) : null
      };
    }
    this.notifyUpdate();
    return true;
  }

  deleteLayerComp(compId) {
    const idx = this.layerComps.findIndex(c => c.id === compId || c.name === compId);
    if (idx !== -1) {
      const deletedId = this.layerComps[idx].id;
      this.layerComps.splice(idx, 1);
      if (this.activeCompId === deletedId) {
        this.activeCompId = this.layerComps.length > 0 ? this.layerComps[0].id : null;
      }
      this.notifyUpdate();
      return true;
    }
    return false;
  }

  duplicateLayerComp(compId, newName = null) {
    const orig = this.layerComps.find(c => c.id === compId || c.name === compId);
    if (!orig) return null;
    const name = newName || `${orig.name} Copy`;
    const copy = new LayerComp(name, orig.state, {
      comment: orig.comment,
      captureVisibility: orig.captureVisibility,
      capturePosition: orig.capturePosition,
      captureAppearance: orig.captureAppearance
    });
    this.layerComps.push(copy);
    this.activeCompId = copy.id;
    this.notifyUpdate();
    return copy;
  }

  nextLayerComp() {
    if (this.layerComps.length <= 1) return null;
    let idx = this.layerComps.findIndex(c => c.id === this.activeCompId);
    idx = (idx + 1) % this.layerComps.length;
    const comp = this.layerComps[idx];
    this.applyLayerComp(comp.id);
    return comp;
  }

  prevLayerComp() {
    if (this.layerComps.length <= 1) return null;
    let idx = this.layerComps.findIndex(c => c.id === this.activeCompId);
    if (idx <= 0) idx = this.layerComps.length - 1;
    else idx--;
    const comp = this.layerComps[idx];
    this.applyLayerComp(comp.id);
    return comp;
  }

  exportLayerComps() {
    return this.layerComps.map(c => c.toJSON());
  }

  importLayerComps(compsData) {
    if (!Array.isArray(compsData)) return;
    this.layerComps = compsData.map(c => LayerComp.fromJSON(c));
    this.activeCompId = this.layerComps.length > 0 ? this.layerComps[0].id : null;
    this.notifyUpdate();
  }

  // ── Artboards Architecture (Photoshop Parity) ──
  addArtboard(name, width = null, height = null, options = {}) {
    this.artboardCounter = (this.artboardCounter || 0) + 1;
    const w = width || this.width || 1920;
    const h = height || this.height || 1080;
    const ab = new Artboard(name || `Artboard ${this.artboardCounter}`, w, h, options);
    this.artboards.push(ab);
    this.activeArtboardId = ab.id;
    this.notifyUpdate();
    return ab;
  }

  deleteArtboard(artboardId) {
    const idx = this.artboards.findIndex(a => a.id === artboardId);
    if (idx !== -1) {
      this.artboards.splice(idx, 1);
      if (this.activeArtboardId === artboardId) {
        this.activeArtboardId = this.artboards.length > 0 ? this.artboards[0].id : null;
      }
      for (const l of this.layers) {
        if (l.artboardId === artboardId) {
          l.artboardId = null;
        }
      }
      this.notifyUpdate();
      return true;
    }
    return false;
  }

  resizeArtboard(artboardId, width, height) {
    const ab = this.artboards.find(a => a.id === artboardId);
    if (!ab) return false;
    ab.width = Math.max(1, width);
    ab.height = Math.max(1, height);
    this.notifyUpdate();
    return true;
  }

  moveArtboard(artboardId, x, y) {
    const ab = this.artboards.find(a => a.id === artboardId);
    if (!ab) return false;
    ab.x = x;
    ab.y = y;
    this.notifyUpdate();
    return true;
  }

  assignLayerToArtboard(layerId, artboardId) {
    const layer = this.layers.find(l => l.id === layerId);
    if (!layer) return false;
    layer.artboardId = artboardId;
    this.notifyUpdate();
    return true;
  }

  getArtboardLayers(artboardId) {
    return this.layers.filter(l => l.artboardId === artboardId);
  }

  getActiveArtboard() {
    return this.artboards.find(a => a.id === this.activeArtboardId) || (this.artboards.length > 0 ? this.artboards[0] : null);
  }

  setActiveArtboard(artboardId) {
    if (this.artboards.some(a => a.id === artboardId)) {
      this.activeArtboardId = artboardId;
      this.notifyUpdate();
      return true;
    }
    return false;
  }

  // ── Isolation Mode Architecture (Photoshop Parity) ──
  enterIsolationMode(layerId) {
    const layer = this.layers.find(l => l.id === layerId);
    if (!layer) return false;
    this.isolatedLayerId = layer.id;
    this.setActiveLayer(layer.id);
    this.notifyUpdate();
    return true;
  }

  exitIsolationMode() {
    if (this.isolatedLayerId) {
      this.isolatedLayerId = null;
      this.notifyUpdate();
      return true;
    }
    return false;
  }

  isIsolated(layerId) {
    if (!this.isolatedLayerId) return true;
    if (layerId === this.isolatedLayerId) return true;
    let l = this.layers.find(item => item.id === layerId);
    while (l && l.parentId) {
      if (l.parentId === this.isolatedLayerId) return true;
      l = this.layers.find(item => item.id === l.parentId);
    }
    return false;
  }

  toggleIsolationMode(layerId = null) {
    const id = layerId || this.activeLayerId;
    if (this.isolatedLayerId === id) {
      return this.exitIsolationMode();
    } else {
      return this.enterIsolationMode(id);
    }
  }

  // ── Master Compositor with Adjustment Layers, Groups, Styles & Clipping Masks ──
  compositeTo(targetCtx) {
    targetCtx.clearRect(0, 0, this.width, this.height);

    // If Artboards exist, fill background of artboards first
    if (this.artboards && this.artboards.length > 0) {
      for (const ab of this.artboards) {
        if (ab.bgType !== 'transparent') {
          targetCtx.save();
          targetCtx.beginPath();
          targetCtx.rect(ab.x, ab.y, ab.width, ab.height);
          targetCtx.clip();
          targetCtx.fillStyle = (ab.bgType === 'black') ? '#000000' : (ab.bgType === 'white' ? '#ffffff' : (ab.bgColor || '#ffffff'));
          targetCtx.fillRect(ab.x, ab.y, ab.width, ab.height);
          targetCtx.restore();
        }
      }
    }

    if (!this.tempCompCanvas || this.tempCompCanvas.width !== this.width || this.tempCompCanvas.height !== this.height) {
      this.tempCompCanvas = Utils.createCanvas(this.width, this.height);
      this.tempCompCtx = this.tempCompCanvas.getContext('2d');
    }
    if (!this.clipBaseCanvas || this.clipBaseCanvas.width !== this.width || this.clipBaseCanvas.height !== this.height) {
      this.clipBaseCanvas = Utils.createCanvas(this.width, this.height);
      this.clipBaseCtx = this.clipBaseCanvas.getContext('2d');
    }
    if (!this.styleCanvas || this.styleCanvas.width !== this.width || this.styleCanvas.height !== this.height) {
      this.styleCanvas = Utils.createCanvas(this.width, this.height);
      this.styleCtx = this.styleCanvas.getContext('2d');
    }

    let currentBaseAlphaCanvas = null;

    for (let i = 0; i < this.layers.length; i++) {
      const layer = this.layers[i];
      if (!layer.visible) continue;
      if (this.isLayerHiddenByGroupVisibility(layer)) continue;

      // ── Isolation Mode ──
      const isLayerIsolated = this.isIsolated(layer.id);
      if (!isLayerIsolated && !this.isolationDimOthers) {
        continue; // Hide non-isolated layers
      }

      let effectiveOpacity = this.getEffectiveOpacity(layer);
      if (!isLayerIsolated && this.isolationDimOthers) {
        effectiveOpacity *= 0.15; // Ghost dim
      }
      if (effectiveOpacity <= 0) continue;

      // ── Artboard Bounds Clipping ──
      let abClip = null;
      if (this.artboards && this.artboards.length > 0 && layer.artboardId) {
        abClip = this.artboards.find(a => a.id === layer.artboardId);
      }

      // ── Handle Adjustment Layers ──
      if (layer.type === 'adjustment') {
        if (abClip) {
          targetCtx.save();
          targetCtx.beginPath();
          targetCtx.rect(abClip.x, abClip.y, abClip.width, abClip.height);
          targetCtx.clip();
        }
        this.applyAdjustmentLayerToComposite(layer, targetCtx, currentBaseAlphaCanvas, effectiveOpacity);
        if (abClip) {
          targetCtx.restore();
        }
        continue;
      }

      // ── Handle Groups ──
      if (layer.type === 'group') {
        continue;
      }

      if (layer.type === 'text') {
        this.renderTextLayer(layer);
      } else if (layer.type === 'shape') {
        this.renderShapeLayer(layer);
      }

      // 1. Prepare layer's rendered image in tempCompCanvas (including mask and color overlay)
      this.tempCompCtx.clearRect(0, 0, this.width, this.height);
      this.tempCompCtx.drawImage(layer.canvas, 0, 0);

      // Mask: compute luminance so Black hides, White reveals, Grays feather
      if (layer.hasMask && layer.maskCanvas && !layer.maskDisabled) {
        if (!this.maskAlphaCanvas || this.maskAlphaCanvas.width !== this.width || this.maskAlphaCanvas.height !== this.height) {
          this.maskAlphaCanvas = Utils.createCanvas(this.width, this.height);
          this.maskAlphaCtx = this.maskAlphaCanvas.getContext('2d');
        }
        const mImgData = layer.maskCtx.getImageData(0, 0, this.width, this.height);
        const mData = mImgData.data;
        const aImgData = this.maskAlphaCtx.createImageData(this.width, this.height);
        const aData = aImgData.data;
        for (let j = 0; j < mData.length; j += 4) {
          const lum = (mData[j] * 77 + mData[j + 1] * 150 + mData[j + 2] * 29) >> 8;
          const alpha = (lum * mData[j + 3]) >> 8;
          aData[j] = 255;
          aData[j + 1] = 255;
          aData[j + 2] = 255;
          aData[j + 3] = alpha;
        }
        this.maskAlphaCtx.putImageData(aImgData, 0, 0);

        this.tempCompCtx.save();
        this.tempCompCtx.globalCompositeOperation = 'destination-in';
        this.tempCompCtx.drawImage(this.maskAlphaCanvas, 0, 0);
        this.tempCompCtx.restore();
      }

      // Vector Mask: non-destructive Bézier path clipping (Phase 14)
      if (layer.vectorMask && layer.vectorMask.enabled) {
        this.tempCompCtx.save();
        this.tempCompCtx.globalCompositeOperation = 'destination-in';
        this.tempCompCtx.fillStyle = '#ffffff';
        layer.vectorMask.drawPath(this.tempCompCtx);
        this.tempCompCtx.fill();
        this.tempCompCtx.restore();
      }

      // Check if layer is inside a parent group that has a group mask
      let pId = layer.parentId;
      while (pId) {
        const parentGroup = this.layers.find(l => l.id === pId);
        if (parentGroup && parentGroup.hasMask && parentGroup.maskCanvas && !parentGroup.maskDisabled) {
          this.tempCompCtx.save();
          this.tempCompCtx.globalCompositeOperation = 'destination-in';
          this.tempCompCtx.drawImage(parentGroup.maskCanvas, 0, 0);
          this.tempCompCtx.restore();
        }
        pId = parentGroup ? parentGroup.parentId : null;
      }

      // Color Overlay style (blends cleanly onto layer pixels)
      if (layer.styles?.colorOverlay?.enabled) {
        const co = layer.styles.colorOverlay;
        if (!this.overlayTempCanvas || this.overlayTempCanvas.width !== this.width || this.overlayTempCanvas.height !== this.height) {
          this.overlayTempCanvas = Utils.createCanvas(this.width, this.height);
          this.overlayTempCtx = this.overlayTempCanvas.getContext('2d');
        }
        this.overlayTempCtx.clearRect(0, 0, this.width, this.height);
        this.overlayTempCtx.fillStyle = Utils.hexToRgba(co.color || '#3b82f6', (co.opacity ?? 50) / 100);
        this.overlayTempCtx.fillRect(0, 0, this.width, this.height);
        this.overlayTempCtx.save();
        this.overlayTempCtx.globalCompositeOperation = 'destination-in';
        this.overlayTempCtx.drawImage(this.tempCompCanvas, 0, 0);
        this.overlayTempCtx.restore();

        this.tempCompCtx.save();
        this.tempCompCtx.globalCompositeOperation = (co.blendMode && co.blendMode !== 'source-over') ? co.blendMode : 'source-atop';
        this.tempCompCtx.drawImage(this.overlayTempCanvas, 0, 0);
        this.tempCompCtx.restore();
      }

      // Clipping mask check
      if (layer.isClipped && currentBaseAlphaCanvas) {
        this.tempCompCtx.save();
        this.tempCompCtx.globalCompositeOperation = 'destination-in';
        this.tempCompCtx.drawImage(currentBaseAlphaCanvas, 0, 0);
        this.tempCompCtx.restore();
      } else {
        // This unclipped layer is the new base for any subsequent clipped layers
        this.clipBaseCtx.clearRect(0, 0, this.width, this.height);
        this.clipBaseCtx.drawImage(this.tempCompCanvas, 0, 0);
        currentBaseAlphaCanvas = this.clipBaseCanvas;
      }

      // 2. Render Layer Styles (Drop Shadow, Outer Glow, Stroke)
      const st = layer.styles;
      const hasDropShadow = !!st?.dropShadow?.enabled;
      const hasOuterGlow = !!st?.outerGlow?.enabled;
      const hasStroke = !!st?.stroke?.enabled;

      this.styleCtx.clearRect(0, 0, this.width, this.height);

      const offscreenShift = this.width + 10000;

      // Drop Shadow
      if (hasDropShadow) {
        const ds = st.dropShadow;
        const rad = ((ds.angle ?? 120) * Math.PI) / 180;
        const dist = ds.distance ?? 8;
        const offX = Math.round(Math.cos(rad) * dist);
        const offY = Math.round(Math.sin(rad) * dist);
        this.styleCtx.save();
        this.styleCtx.shadowColor = Utils.hexToRgba(ds.color || '#000000', (ds.opacity ?? 75) / 100);
        this.styleCtx.shadowBlur = ds.blur ?? 10;
        this.styleCtx.shadowOffsetX = offscreenShift + offX;
        this.styleCtx.shadowOffsetY = offY;
        this.styleCtx.drawImage(this.tempCompCanvas, -offscreenShift, 0);
        this.styleCtx.restore();
      }

      // Outer Glow
      if (hasOuterGlow) {
        const og = st.outerGlow;
        this.styleCtx.save();
        this.styleCtx.shadowColor = Utils.hexToRgba(og.color || '#ffff00', (og.opacity ?? 75) / 100);
        this.styleCtx.shadowBlur = og.blur ?? 12;
        this.styleCtx.shadowOffsetX = offscreenShift;
        this.styleCtx.shadowOffsetY = 0;
        this.styleCtx.drawImage(this.tempCompCanvas, -offscreenShift, 0);
        this.styleCtx.restore();
      }

      // Stroke
      if (hasStroke) {
        const str = st.stroke;
        const size = Math.max(1, Math.min(30, Math.round(str.size || 3)));
        const strokeColor = Utils.hexToRgba(str.color || '#000000', (str.opacity ?? 100) / 100);

        if (!this.strokeTempCanvas || this.strokeTempCanvas.width !== this.width || this.strokeTempCanvas.height !== this.height) {
          this.strokeTempCanvas = Utils.createCanvas(this.width, this.height);
          this.strokeTempCtx = this.strokeTempCanvas.getContext('2d');
        }
        this.strokeTempCtx.clearRect(0, 0, this.width, this.height);

        const steps = 16;
        for (let a = 0; a < steps; a++) {
          const theta = (a / steps) * Math.PI * 2;
          const sx = Math.round(Math.cos(theta) * size);
          const sy = Math.round(Math.sin(theta) * size);
          this.strokeTempCtx.drawImage(this.tempCompCanvas, sx, sy);
        }
        this.strokeTempCtx.save();
        this.strokeTempCtx.globalCompositeOperation = 'source-in';
        this.strokeTempCtx.fillStyle = strokeColor;
        this.strokeTempCtx.fillRect(0, 0, this.width, this.height);
        this.strokeTempCtx.restore();

        this.styleCtx.drawImage(this.strokeTempCanvas, 0, 0);
      }

      // Draw the crisp layer content on top
      this.styleCtx.drawImage(this.tempCompCanvas, 0, 0);

      // Apply Inner Styles (Pattern Overlay, Satin, Inner Shadow, Bevel & Emboss)
      this.applyInnerStyles(this.styleCtx, this.tempCompCanvas, this.width, this.height, st);

      // Blit to targetCtx with effective opacity and blendMode (clipped to artboard if assigned)
      if (abClip) {
        targetCtx.save();
        targetCtx.beginPath();
        targetCtx.rect(abClip.x, abClip.y, abClip.width, abClip.height);
        targetCtx.clip();
      }

      this.applyBlendMode(targetCtx, this.styleCanvas, layer.blendMode, effectiveOpacity);

      if (abClip) {
        targetCtx.restore();
      }
    }
  }

  // ── Universal 27 Blend Modes Processor ──
  applyBlendMode(targetCtx, sourceCanvas, blendMode, effectiveOpacity) {
    const customModes = ['dissolve', 'linear-burn', 'darker-color', 'lighter-color', 'vivid-light', 'linear-light', 'pin-light', 'hard-mix', 'subtract', 'divide'];
    const mode = (blendMode === 'pass-through') ? 'source-over' : (blendMode || 'source-over');

    if (!customModes.includes(mode)) {
      targetCtx.save();
      targetCtx.globalAlpha = (effectiveOpacity ?? 100) / 100;
      targetCtx.globalCompositeOperation = mode;
      targetCtx.drawImage(sourceCanvas, 0, 0);
      targetCtx.restore();
      return;
    }

    const op = (effectiveOpacity ?? 100) / 100;
    if (op <= 0) return;

    const baseImgData = targetCtx.getImageData(0, 0, this.width, this.height);
    const srcCtx = sourceCanvas.getContext('2d');
    const srcImgData = srcCtx.getImageData(0, 0, this.width, this.height);

    const b = baseImgData.data;
    const s = srcImgData.data;
    const len = b.length;

    for (let i = 0; i < len; i += 4) {
      const sa = (s[i + 3] / 255) * op;
      if (sa <= 0) continue;

      const sr = s[i], sg = s[i + 1], sb = s[i + 2];
      const br = b[i], bg = b[i + 1], bb = b[i + 2], ba = b[i + 3] / 255;

      let rr = 0, rg = 0, rb = 0;

      switch (mode) {
        case 'dissolve': {
          const px = (i / 4) % this.width;
          const py = Math.floor((i / 4) / this.width);
          const rnd = ((Math.sin(px * 12.9898 + py * 78.233) * 43758.5453123) % 1 + 1) % 1;
          if (rnd < sa) {
            b[i] = sr; b[i + 1] = sg; b[i + 2] = sb; b[i + 3] = 255;
          }
          continue;
        }

        case 'linear-burn':
          rr = Math.max(0, br + sr - 255);
          rg = Math.max(0, bg + sg - 255);
          rb = Math.max(0, bb + sb - 255);
          break;

        case 'linear-light':
          rr = Math.max(0, Math.min(255, br + 2 * sr - 255));
          rg = Math.max(0, Math.min(255, bg + 2 * sg - 255));
          rb = Math.max(0, Math.min(255, bb + 2 * sb - 255));
          break;

        case 'vivid-light': {
          const calcVL = (bc, sc) => {
            if (sc <= 128) {
              return sc === 0 ? 0 : Math.max(0, 255 - Math.floor(((255 - bc) * 255) / (2 * sc)));
            } else {
              const d = 2 * (255 - sc);
              return d === 0 ? 255 : Math.min(255, Math.floor((bc * 255) / d));
            }
          };
          rr = calcVL(br, sr);
          rg = calcVL(bg, sg);
          rb = calcVL(bb, sb);
          break;
        }

        case 'pin-light': {
          const calcPL = (bc, sc) => sc < 128 ? Math.min(bc, 2 * sc) : Math.max(bc, 2 * (sc - 128));
          rr = calcPL(br, sr);
          rg = calcPL(bg, sg);
          rb = calcPL(bb, sb);
          break;
        }

        case 'hard-mix': {
          const calcHM = (bc, sc) => {
            let vl = 0;
            if (sc <= 128) {
              vl = sc === 0 ? 0 : Math.max(0, 255 - Math.floor(((255 - bc) * 255) / (2 * sc)));
            } else {
              const d = 2 * (255 - sc);
              vl = d === 0 ? 255 : Math.min(255, Math.floor((bc * 255) / d));
            }
            return vl >= 128 ? 255 : 0;
          };
          rr = calcHM(br, sr);
          rg = calcHM(bg, sg);
          rb = calcHM(bb, sb);
          break;
        }

        case 'subtract':
          rr = Math.max(0, br - sr);
          rg = Math.max(0, bg - sg);
          rb = Math.max(0, bb - sb);
          break;

        case 'divide':
          rr = sr === 0 ? 255 : Math.min(255, Math.floor((br * 255) / sr));
          rg = sg === 0 ? 255 : Math.min(255, Math.floor((bg * 255) / sg));
          rb = sb === 0 ? 255 : Math.min(255, Math.floor((bb * 255) / sb));
          break;

        case 'darker-color': {
          const lumB = 0.299 * br + 0.587 * bg + 0.114 * bb;
          const lumS = 0.299 * sr + 0.587 * sg + 0.114 * sb;
          if (lumS < lumB) { rr = sr; rg = sg; rb = sb; }
          else { rr = br; rg = bg; rb = bb; }
          break;
        }

        case 'lighter-color': {
          const lumB = 0.299 * br + 0.587 * bg + 0.114 * bb;
          const lumS = 0.299 * sr + 0.587 * sg + 0.114 * sb;
          if (lumS > lumB) { rr = sr; rg = sg; rb = sb; }
          else { rr = br; rg = bg; rb = bb; }
          break;
        }
      }

      const outA = ba + sa * (1 - ba);
      if (outA > 0) {
        b[i] = Math.round((br * ba * (1 - sa) + rr * sa) / outA);
        b[i + 1] = Math.round((bg * ba * (1 - sa) + rg * sa) / outA);
        b[i + 2] = Math.round((bb * ba * (1 - sa) + rb * sa) / outA);
        b[i + 3] = Math.round(outA * 255);
      }
    }

    targetCtx.putImageData(baseImgData, 0, 0);
  }

  applyAdjustmentLayerToComposite(layer, targetCtx, clipCanvas, effectiveOpacity) {
    const filters = (typeof window !== 'undefined' && window.Filters) ? window.Filters : (typeof Filters !== 'undefined' ? Filters : null);
    if (!layer.adjustmentType || !filters) return;

    const srcCtx = (layer.isClipped && clipCanvas) ? clipCanvas.getContext('2d') : targetCtx;
    const imgData = srcCtx.getImageData(0, 0, this.width, this.height);
    const p = layer.adjustmentParams || {};

    let filtered = null;
    switch (layer.adjustmentType) {
      case 'brightnessContrast':
        filtered = Filters.brightnessContrast(imgData, p.brightness || 0, p.contrast || 0);
        break;
      case 'hueSaturation':
        filtered = Filters.hueSaturation(imgData, p.hue || 0, p.saturation || 0);
        break;
      case 'colorBalance':
        filtered = Filters.colorBalance(imgData, p.shadows || { cyanRed: 0, magGreen: 0, yelBlue: 0 }, p.midtones || { cyanRed: 0, magGreen: 0, yelBlue: 0 }, p.highlights || { cyanRed: 0, magGreen: 0, yelBlue: 0 }, p.preserveLum ?? true);
        break;
      case 'vibrance':
        filtered = Filters.vibrance(imgData, p.vibrance || 0, p.saturation || 0);
        break;
      case 'photoFilter':
        filtered = Filters.photoFilter(imgData, p.r ?? 234, p.g ?? 138, p.b ?? 40, p.density ?? 25, p.preserveLum ?? true);
        break;
      case 'threshold':
        filtered = Filters.threshold(imgData, p.cutoff ?? 128);
        break;
      case 'posterize':
        filtered = Filters.posterize(imgData, p.levels ?? 4);
        break;
      case 'invert':
        filtered = Filters.invert(imgData);
        break;
      case 'blackWhite':
        filtered = Filters.grayscale(imgData);
        break;
      case 'curves':
        filtered = Utils.applyLevelsAndCurve(imgData, p.black ?? 0, p.white ?? 255, p.gamma ?? 1.0, p.lut || null);
        break;
      case 'gradientMap':
        filtered = Filters.gradientMap(imgData, p.gradientData || p.gradient || null);
        break;
      case 'colorLookup':
        if (typeof LutEngine !== 'undefined') {
          const lut = p.lut || (LutEngine.generatePresetLut ? LutEngine.generatePresetLut(p.preset || 'Teal & Orange') : null);
          filtered = LutEngine.applyLut(imgData, lut, p.intensity ?? 1.0);
        }
        break;
      case 'selectiveColor':
        if (typeof SelectiveColorEngine !== 'undefined') {
          filtered = SelectiveColorEngine.apply(imgData, p);
        }
        break;
      case 'channelMixer':
        if (typeof ChannelMixerEngine !== 'undefined') {
          filtered = ChannelMixerEngine.apply(imgData, p);
        }
        break;
      default:
        return;
    }

    if (!filtered) return;

    const originalData = imgData.data;
    const filteredData = filtered.data;
    const len = originalData.length;
    const opacityFactor = (effectiveOpacity / 100);

    if (layer.hasMask && layer.maskCanvas && !layer.maskDisabled) {
      const mData = layer.maskCtx.getImageData(0, 0, this.width, this.height).data;
      for (let j = 0; j < len; j += 4) {
        if (originalData[j + 3] === 0) continue;
        const lum = (mData[j] * 77 + mData[j + 1] * 150 + mData[j + 2] * 29) >> 8;
        const maskAlpha = ((lum * mData[j + 3]) >> 8) / 255;
        const effAlpha = maskAlpha * opacityFactor;
        const inv = 1 - effAlpha;

        originalData[j]     = Math.round(originalData[j] * inv + filteredData[j] * effAlpha);
        originalData[j + 1] = Math.round(originalData[j + 1] * inv + filteredData[j + 1] * effAlpha);
        originalData[j + 2] = Math.round(originalData[j + 2] * inv + filteredData[j + 2] * effAlpha);
      }
      srcCtx.putImageData(imgData, 0, 0);
    } else {
      if (opacityFactor >= 0.999) {
        srcCtx.putImageData(filtered, 0, 0);
      } else {
        const inv = 1 - opacityFactor;
        for (let j = 0; j < len; j += 4) {
          if (originalData[j + 3] === 0) continue;
          originalData[j]     = Math.round(originalData[j] * inv + filteredData[j] * opacityFactor);
          originalData[j + 1] = Math.round(originalData[j + 1] * inv + filteredData[j + 1] * opacityFactor);
          originalData[j + 2] = Math.round(originalData[j + 2] * inv + filteredData[j + 2] * opacityFactor);
        }
        srcCtx.putImageData(imgData, 0, 0);
      }
    }
  }

  // ── UI Synchronization ──
  syncControls() {
    if (typeof document === 'undefined') return;
    const active = this.getActiveLayer();
    if (!active) return;
    const blendSelect = document.getElementById('layer-blend-mode');
    const opacitySlider = document.getElementById('layer-opacity-slider');
    const opacityInput = document.getElementById('layer-opacity-input');
    const opacityVal = document.getElementById('layer-opacity-val');

    if (blendSelect) blendSelect.value = active.blendMode;
    if (opacitySlider) opacitySlider.value = active.opacity;
    if (opacityInput) opacityInput.value = active.opacity;
    if (opacityVal) opacityVal.textContent = active.opacity + '%';

    // Lock Alpha button state
    const btnLockAlpha = document.getElementById('btn-lock-alpha');
    if (btnLockAlpha) btnLockAlpha.classList.toggle('active', !!active.lockAlpha);

    // Lock All button state
    const btnLockAll = document.getElementById('btn-lock-all');
    if (btnLockAll) btnLockAll.classList.toggle('active', !!active.locked);

    // Sync Typography Panel
    if (typeof window !== 'undefined' && window.app?.syncTypographyPanel) {
      window.app.syncTypographyPanel(active);
    }
  }

  notifyUpdate() {
    this.syncControls();
    this.renderLayerStackUI();
    if (this.onChange) this.onChange();
  }

  renderLayerStackUI() {
    const stackEl = document.getElementById('layers-stack');
    if (!stackEl) return;
    stackEl.innerHTML = '';

    // Render in reverse order (top layer at top of UI)
    for (let i = this.layers.length - 1; i >= 0; i--) {
      const layer = this.layers[i];

      // If inside a collapsed ancestor group, hide from layer stack list
      if (this.isLayerHiddenByCollapse(layer)) continue;

      const isSelected = this.selectedLayerIds.has(layer.id) || layer.id === this.activeLayerId;
      const row = document.createElement('div');
      row.className = 'layer-item-row' +
        (isSelected ? ' selected active' : '') +
        (layer.type === 'group' ? ' is-group' : '') +
        (layer.type === 'adjustment' ? ' is-adjustment' : '') +
        (layer.type === 'smart-object' ? ' is-smart' : '') +
        (layer.isClipped ? ' is-clipped' : '') +
        (layer.colorTag ? ` tag-${layer.colorTag}` : '');
      row.draggable = true;
      row.dataset.layerId = layer.id;

      // Tree indentation
      let depth = 0;
      let pId = layer.parentId;
      while (pId) {
        depth++;
        const pLayer = this.layers.find(l => l.id === pId);
        pId = pLayer ? pLayer.parentId : null;
      }
      if (depth > 0) {
        row.style.paddingLeft = (8 + depth * 14) + 'px';
      }

      // If group: collapse/expand arrow
      if (layer.type === 'group') {
        const arrow = document.createElement('span');
        arrow.className = 'group-toggle-arrow';
        arrow.textContent = layer.collapsed ? '►' : '▼';
        arrow.title = layer.collapsed ? 'Expand Group' : 'Collapse Group';
        arrow.addEventListener('click', (e) => {
          e.stopPropagation();
          this.toggleGroupCollapse(layer.id);
        });
        row.appendChild(arrow);
      }

      // Clipping mask indicator icon
      if (layer.isClipped) {
        const clipIcon = document.createElement('span');
        clipIcon.className = 'layer-clip-indicator';
        clipIcon.innerHTML = '↳';
        clipIcon.title = 'Clipping Mask to Layer Below';
        row.appendChild(clipIcon);
      }

      // Eye visibility button
      const eyeBtn = document.createElement('button');
      eyeBtn.className = 'layer-eye-btn' + (layer.visible ? '' : ' muted');
      eyeBtn.innerHTML = layer.visible ? '👁' : '○';
      eyeBtn.title = 'Toggle Layer Visibility';
      eyeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        layer.visible = !layer.visible;
        this.notifyUpdate();
      });
      row.appendChild(eyeBtn);

      // Thumbnail Preview
      if (layer.type === 'group') {
        const folderIcon = document.createElement('span');
        folderIcon.className = 'group-folder-icon';
        folderIcon.textContent = layer.collapsed ? '📁' : '📂';
        row.appendChild(folderIcon);
      } else if (layer.type === 'adjustment') {
        const adjIcon = document.createElement('div');
        adjIcon.className = 'adj-layer-icon';
        adjIcon.textContent = '◐';
        adjIcon.title = 'Adjustment Layer (Double-click to edit settings)';
        adjIcon.addEventListener('click', (e) => {
          e.stopPropagation();
          this.setActiveLayer(layer.id);
          if (window.app?.openAdjustmentLayerEditor) {
            window.app.openAdjustmentLayerEditor(layer);
          }
        });
        row.appendChild(adjIcon);
      } else if (layer.type === 'text') {
        const textIcon = document.createElement('div');
        textIcon.className = 'text-layer-icon';
        textIcon.textContent = 'T';
        textIcon.title = 'Text Layer (Click to edit typography)';
        textIcon.addEventListener('click', (e) => {
          e.stopPropagation();
          this.setActiveLayer(layer.id);
          if (window.app?.openTypographyInspector) {
            window.app.openTypographyInspector(layer);
          }
        });
        row.appendChild(textIcon);
      } else {
        const thumbBox = document.createElement('div');
        thumbBox.className = 'layer-thumb-preview' + (!layer.isMaskActive ? ' active-target' : '');
        thumbBox.title = 'Click to select layer (Double-click for Layer Styles)';
        const thumbCanvas = document.createElement('canvas');
        thumbCanvas.width = 36;
        thumbCanvas.height = 26;
        const tCtx = thumbCanvas.getContext('2d');
        const scale = Math.min(36 / this.width, 26 / this.height);
        const dw = this.width * scale;
        const dh = this.height * scale;
        tCtx.drawImage(layer.canvas, (36 - dw) / 2, (26 - dh) / 2, dw, dh);
        thumbBox.appendChild(thumbCanvas);

        thumbBox.addEventListener('click', (e) => {
          e.stopPropagation();
          layer.isMaskActive = false;
          this.setActiveLayer(layer.id);
          if (layer.type === 'adjustment' && window.app?.openAdjustmentLayerEditor) {
            window.app.openAdjustmentLayerEditor(layer);
          }
        });
        thumbBox.addEventListener('dblclick', (e) => {
          e.stopPropagation();
          this.setActiveLayer(layer.id);
          if (layer.type === 'adjustment' && window.app?.openAdjustmentLayerEditor) {
            window.app.openAdjustmentLayerEditor(layer);
          } else if (window.app?.openLayerStylesModal) {
            window.app.openLayerStylesModal(layer.id);
          }
        });
        row.appendChild(thumbBox);
      }

      // Layer Mask Thumbnail (if present)
      if (layer.hasMask && layer.maskCanvas) {
        const maskBox = document.createElement('div');
        maskBox.className = 'layer-mask-preview' +
          (layer.isMaskActive ? ' active-mask' : '') +
          (layer.maskDisabled ? ' mask-disabled' : '');
        maskBox.title = 'Click to edit Layer Mask (Shift-click to disable/enable)';
        const maskCanvasThumb = document.createElement('canvas');
        maskCanvasThumb.width = 36;
        maskCanvasThumb.height = 26;
        const mCtx = maskCanvasThumb.getContext('2d');
        const scale = Math.min(36 / this.width, 26 / this.height);
        const dw = this.width * scale;
        const dh = this.height * scale;
        mCtx.drawImage(layer.maskCanvas, (36 - dw) / 2, (26 - dh) / 2, dw, dh);
        maskBox.appendChild(maskCanvasThumb);

        maskBox.addEventListener('click', (e) => {
          e.stopPropagation();
          if (e.shiftKey) {
            this.toggleMaskDisabled(layer.id);
          } else {
            layer.isMaskActive = true;
            this.setActiveLayer(layer.id);
          }
        });
        row.appendChild(maskBox);
      }

      // Name & Badges Container
      const nameContainer = document.createElement('div');
      nameContainer.className = 'layer-info-container';

      const nameSpan = document.createElement('span');
      nameSpan.className = 'layer-title-text';
      nameSpan.textContent = layer.name + (layer.hasMask && layer.isMaskActive ? ' [Mask]' : '');
      nameSpan.title = 'Double-click to rename';

      nameSpan.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        const input = document.createElement('input');
        input.type = 'text';
        input.value = layer.name;
        input.style.width = '100%';
        input.style.background = '#151518';
        input.style.border = '1px solid #3b82f6';
        input.style.color = '#fff';
        input.style.padding = '2px 4px';
        input.style.fontSize = '11px';

        nameSpan.replaceWith(input);
        input.focus();
        input.select();

        const save = () => {
          if (input.value.trim()) layer.name = input.value.trim();
          this.renderLayerStackUI();
        };
        input.addEventListener('blur', save);
        input.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter') input.blur();
          if (ev.key === 'Escape') this.renderLayerStackUI();
        });
      });

      nameContainer.appendChild(nameSpan);

      // Badges: Lock, FX, Adjustment
      const badgesContainer = document.createElement('div');
      badgesContainer.className = 'layer-badges';

      if (layer.type === 'adjustment') {
        const adjBadge = document.createElement('span');
        adjBadge.className = 'layer-badge adj';
        adjBadge.textContent = 'ADJ';
        adjBadge.title = 'Adjustment Layer';
        badgesContainer.appendChild(adjBadge);
      } else if (layer.type === 'text') {
        const textBadge = document.createElement('span');
        textBadge.className = 'layer-badge text';
        textBadge.textContent = 'TEXT';
        textBadge.title = 'Dynamic Text Layer';
        badgesContainer.appendChild(textBadge);
      } else if (layer.type === 'shape') {
        const shapeBadge = document.createElement('span');
        shapeBadge.className = 'layer-badge shape';
        shapeBadge.textContent = 'SHAPE';
        shapeBadge.title = 'Live Vector Shape Layer';
        badgesContainer.appendChild(shapeBadge);
      } else if (layer.type === 'smart-object') {
        const soBadge = document.createElement('span');
        soBadge.className = 'layer-badge smart';
        soBadge.textContent = 'SMART';
        soBadge.title = 'Smart Object (Click to open editor)';
        soBadge.addEventListener('click', (e) => {
          e.stopPropagation();
          this.setActiveLayer(layer.id);
          if (window.app?.smartObjectManager) {
            window.app.smartObjectManager.openSmartObjectEditor(layer);
          }
        });
        badgesContainer.appendChild(soBadge);
      }

      if (layer.locked) {
        const lockBadge = document.createElement('span');
        lockBadge.className = 'layer-badge lock';
        lockBadge.textContent = '🔒';
        lockBadge.title = 'Layer Locked';
        badgesContainer.appendChild(lockBadge);
      } else if (layer.lockAlpha) {
        const alphaBadge = document.createElement('span');
        alphaBadge.className = 'layer-badge alpha';
        alphaBadge.textContent = '⚿';
        alphaBadge.title = 'Lock Transparency (Alpha)';
        badgesContainer.appendChild(alphaBadge);
      }

      const hasActiveStyles = layer.styles && (
        layer.styles.dropShadow?.enabled ||
        layer.styles.outerGlow?.enabled ||
        layer.styles.stroke?.enabled ||
        layer.styles.colorOverlay?.enabled ||
        layer.styles.bevelEmboss?.enabled ||
        layer.styles.innerShadow?.enabled ||
        layer.styles.satin?.enabled ||
        layer.styles.patternOverlay?.enabled
      );

      if (hasActiveStyles) {
        const fxBadge = document.createElement('span');
        fxBadge.className = 'layer-badge fx';
        fxBadge.textContent = 'fx';
        fxBadge.title = 'Layer Styles Active (Click to edit)';
        fxBadge.addEventListener('click', (e) => {
          e.stopPropagation();
          this.setActiveLayer(layer.id);
          if (window.app?.openLayerStylesModal) {
            window.app.openLayerStylesModal(layer.id);
          }
        });
        badgesContainer.appendChild(fxBadge);
      }

      nameContainer.appendChild(badgesContainer);
      row.appendChild(nameContainer);

      row.addEventListener('click', (e) => {
        this.selectLayer(layer.id, e.shiftKey, e.ctrlKey || e.metaKey);
        if (layer.type === 'adjustment' && window.app?.openAdjustmentLayerEditor) {
          window.app.openAdjustmentLayerEditor(layer);
        } else if (layer.type === 'text' && window.app?.openTypographyInspector) {
          window.app.openTypographyInspector(layer);
        }
      });

      // Double click on row outside title
      row.addEventListener('dblclick', (e) => {
        if (e.target !== nameSpan && e.target.tagName !== 'INPUT') {
          this.setActiveLayer(layer.id);
          if (layer.type === 'smart-object' && window.app?.smartObjectManager) {
            window.app.smartObjectManager.openSmartObjectEditor(layer);
          } else if (layer.type === 'adjustment' && window.app?.openAdjustmentLayerEditor) {
            window.app.openAdjustmentLayerEditor(layer);
          } else if (window.app?.openLayerStylesModal) {
            window.app.openLayerStylesModal(layer.id);
          }
        }
      });

      // Right click context menu
      row.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!this.selectedLayerIds.has(layer.id)) {
          this.selectLayer(layer.id, false, false);
        }
        if (window.app?.showLayerContextMenu) {
          window.app.showLayerContextMenu(e.clientX, e.clientY, layer.id);
        }
      });

      // Drag reordering
      row.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', i.toString());
      });
      row.addEventListener('dragover', (e) => e.preventDefault());
      row.addEventListener('drop', (e) => {
        e.preventDefault();
        const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
        if (!isNaN(fromIndex) && fromIndex !== i) {
          this.reorder(fromIndex, i);
        }
      });

      stackEl.appendChild(row);

      // Expandable Smart Filter sub-rows under the Smart Object layer
      if (layer.type === 'smart-object' && layer.smartObjectData?.filters?.length > 0) {
        const sfList = document.createElement('div');
        sfList.className = 'layer-smart-filters-sublist';
        layer.smartObjectData.filters.forEach(sf => {
          const sfRow = document.createElement('div');
          sfRow.className = `layer-sf-subrow ${sf.enabled ? 'active' : 'disabled'}`;

          const sfEye = document.createElement('span');
          sfEye.className = 'layer-sf-eye';
          sfEye.textContent = sf.enabled ? '👁' : '─';
          sfEye.title = sf.enabled ? 'Disable Smart Filter' : 'Enable Smart Filter';
          sfEye.addEventListener('click', (e) => {
            e.stopPropagation();
            sf.enabled = !sf.enabled;
            layer.smartObjectData.renderToLayer(layer);
            this.notifyUpdate();
          });

          const sfName = document.createElement('span');
          sfName.className = 'layer-sf-name';
          sfName.textContent = sf.name;

          const sfDel = document.createElement('span');
          sfDel.className = 'layer-sf-del';
          sfDel.textContent = '✕';
          sfDel.title = 'Remove Smart Filter';
          sfDel.addEventListener('click', (e) => {
            e.stopPropagation();
            layer.smartObjectData.removeFilter(sf.id);
            layer.smartObjectData.renderToLayer(layer);
            this.notifyUpdate();
          });

          sfRow.appendChild(sfEye);
          sfRow.appendChild(sfName);
          sfRow.appendChild(sfDel);
          sfList.appendChild(sfRow);
        });
        stackEl.appendChild(sfList);
      }
    }
  }

  // ── Project File Serialization (.pforge) ──
  exportProjectData() {
    return {
      version: '1.3.0',
      width: this.width,
      height: this.height,
      activeLayerId: this.activeLayerId,
      activeArtboardId: this.activeArtboardId,
      activeCompId: this.activeCompId,
      artboards: (this.artboards || []).map(ab => ab.toJSON ? ab.toJSON() : { ...ab }),
      layerComps: (this.layerComps || []).map(lc => lc.toJSON ? lc.toJSON() : { ...lc }),
      layers: this.layers.map(l => ({
        id: l.id,
        name: l.name,
        type: l.type || 'raster',
        parentId: l.parentId || null,
        artboardId: l.artboardId || null,
        assetId: l.assetId || null,
        x: l.x || 0,
        y: l.y || 0,
        collapsed: !!l.collapsed,
        adjustmentType: l.adjustmentType || null,
        adjustmentParams: l.adjustmentParams ? JSON.parse(JSON.stringify(l.adjustmentParams)) : null,
        textParams: l.textParams ? JSON.parse(JSON.stringify(l.textParams)) : null,
        vectorShape: l.vectorShape ? JSON.parse(JSON.stringify(l.vectorShape)) : null,
        visible: l.visible,
        opacity: l.opacity,
        blendMode: l.blendMode,
        locked: !!l.locked,
        lockAlpha: !!l.lockAlpha,
        isClipped: !!l.isClipped,
        colorTag: l.colorTag || null,
        styles: l.styles ? JSON.parse(JSON.stringify(l.styles)) : null,
        hasMask: !!l.hasMask,
        maskDisabled: !!l.maskDisabled,
        smartObjectData: (l.type === 'smart-object' && l.smartObjectData) ? l.smartObjectData.toJSON() : null,
        dataUrl: (l.canvas && l.type !== 'group') ? l.canvas.toDataURL() : null,
        maskDataUrl: l.hasMask && l.maskCanvas ? l.maskCanvas.toDataURL() : null
      }))
    };
  }

  importProjectData(data) {
    return new Promise((resolve) => {
      this.width = data.width;
      this.height = data.height;
      this.layers = [];
      let pending = data.layers.length;

      if (data.artboards) {
        this.artboards = data.artboards.map(ab => (typeof Artboard !== 'undefined' && Artboard.fromJSON) ? Artboard.fromJSON(ab) : new Artboard(ab.name, ab.width, ab.height, ab));
        this.activeArtboardId = data.activeArtboardId || (this.artboards[0] ? this.artboards[0].id : null);
      } else {
        this.artboards = [];
        this.activeArtboardId = null;
      }

      if (data.layerComps) {
        this.layerComps = data.layerComps.map(lc => (typeof LayerComp !== 'undefined' && LayerComp.fromJSON) ? LayerComp.fromJSON(lc) : new LayerComp(lc.name, lc.state, lc));
        this.activeCompId = data.activeCompId || (this.layerComps[0] ? this.layerComps[0].id : null);
      } else {
        this.layerComps = [];
        this.activeCompId = null;
      }

      data.layers.forEach(lData => {
        const layer = this.createLayerObject(lData.name, lData.type || 'raster', {
          parentId: lData.parentId || null,
          artboardId: lData.artboardId || null,
          assetId: lData.assetId || null,
          x: lData.x || 0,
          y: lData.y || 0,
          collapsed: !!lData.collapsed,
          adjustmentType: lData.adjustmentType || null,
          adjustmentParams: lData.adjustmentParams || null,
          textParams: lData.textParams ? JSON.parse(JSON.stringify(lData.textParams)) : null,
          vectorShape: lData.vectorShape ? JSON.parse(JSON.stringify(lData.vectorShape)) : null
        });
        layer.id = lData.id;
        layer.visible = lData.visible;
        layer.opacity = lData.opacity;
        layer.blendMode = lData.blendMode;
        layer.locked = !!lData.locked;
        layer.lockAlpha = !!lData.lockAlpha;
        layer.isClipped = !!lData.isClipped;
        layer.colorTag = lData.colorTag || null;
        if (lData.styles) layer.styles = lData.styles;
        layer.hasMask = !!lData.hasMask;
        layer.maskDisabled = !!lData.maskDisabled;

        const checkDone = () => {
          if (layer.type === 'text') {
            this.renderTextLayer(layer);
          } else if (layer.type === 'shape') {
            this.renderShapeLayer(layer);
          } else if (layer.type === 'smart-object' && lData.smartObjectData && typeof SmartObjectData !== 'undefined') {
            layer.smartObjectData = SmartObjectData.fromJSON(lData.smartObjectData, (smData) => {
              smData.renderToLayer(layer);
            });
          }
          pending--;
          if (pending === 0) {
            this.activeLayerId = data.activeLayerId || this.layers[this.layers.length - 1].id;
            this.selectedLayerIds.clear();
            this.selectedLayerIds.add(this.activeLayerId);
            this.notifyUpdate();
            resolve();
          }
        };

        if (lData.dataUrl && layer.type !== 'group') {
          if (typeof Image !== 'undefined') {
            const img = new Image();
            img.onload = () => {
              layer.ctx.drawImage(img, 0, 0);

              if (layer.hasMask && lData.maskDataUrl) {
                layer.maskCanvas = Utils.createCanvas(this.width, this.height);
                layer.maskCtx = layer.maskCanvas.getContext('2d');
                const maskImg = new Image();
                maskImg.onload = () => {
                  layer.maskCtx.drawImage(maskImg, 0, 0);
                  checkDone();
                };
                maskImg.src = lData.maskDataUrl;
              } else {
                checkDone();
              }
            };
            img.src = lData.dataUrl;
          } else {
            checkDone();
          }
        } else {
          if (layer.hasMask && lData.maskDataUrl && typeof Image !== 'undefined') {
            layer.maskCanvas = Utils.createCanvas(this.width, this.height);
            layer.maskCtx = layer.maskCanvas.getContext('2d');
            const maskImg = new Image();
            maskImg.onload = () => {
              layer.maskCtx.drawImage(maskImg, 0, 0);
              checkDone();
            };
            maskImg.src = lData.maskDataUrl;
          } else {
            checkDone();
          }
        }
        this.layers.push(layer);
      });

      if (data.layers.length === 0) resolve();
    });
  }

  // Restore state from snapshot
  restoreFromSnapshot(snapshotLayers) {
    return new Promise((resolve) => {
      this.layers = [];
      const total = snapshotLayers.length;
      if (total === 0) {
        this.notifyUpdate();
        resolve();
        return;
      }
      let loaded = 0;

      snapshotLayers.forEach(lData => {
        const layer = this.createLayerObject(lData.name, lData.type || 'raster', {
          parentId: lData.parentId || null,
          collapsed: !!lData.collapsed,
          adjustmentType: lData.adjustmentType || null,
          adjustmentParams: lData.adjustmentParams ? JSON.parse(JSON.stringify(lData.adjustmentParams)) : null,
          textParams: lData.textParams ? JSON.parse(JSON.stringify(lData.textParams)) : null
        });
        layer.id = lData.id;
        layer.visible = lData.visible;
        layer.opacity = lData.opacity;
        layer.blendMode = lData.blendMode;
        layer.locked = !!lData.locked;
        layer.lockAlpha = !!lData.lockAlpha;
        layer.isClipped = !!lData.isClipped;
        layer.colorTag = lData.colorTag || null;
        layer.hasMask = !!lData.hasMask;
        layer.maskDisabled = !!lData.maskDisabled;
        layer.isMaskActive = !!lData.isMaskActive;
        if (lData.styles) layer.styles = JSON.parse(JSON.stringify(lData.styles));

        const checkDone = () => {
          if (layer.type === 'text') {
            this.renderTextLayer(layer);
          }
          loaded++;
          if (loaded === total) {
            this.notifyUpdate();
            resolve();
          }
        };

        if (lData.dataUrl && layer.type !== 'group') {
          const img = new Image();
          img.onload = () => {
            layer.ctx.drawImage(img, 0, 0);

            if (layer.hasMask && lData.maskDataUrl) {
              layer.maskCanvas = Utils.createCanvas(this.width, this.height);
              layer.maskCtx = layer.maskCanvas.getContext('2d');
              const maskImg = new Image();
              maskImg.onload = () => {
                layer.maskCtx.drawImage(maskImg, 0, 0);
                checkDone();
              };
              maskImg.src = lData.maskDataUrl;
            } else {
              checkDone();
            }
          };
          img.src = lData.dataUrl;
        } else {
          if (layer.hasMask && lData.maskDataUrl) {
            layer.maskCanvas = Utils.createCanvas(this.width, this.height);
            layer.maskCtx = layer.maskCanvas.getContext('2d');
            const maskImg = new Image();
            maskImg.onload = () => {
              layer.maskCtx.drawImage(maskImg, 0, 0);
              checkDone();
            };
            maskImg.src = lData.maskDataUrl;
          } else {
            checkDone();
          }
        }
        this.layers.push(layer);
      });
    });
  }
}

if (typeof window !== 'undefined') {
  window.LayerManager = LayerManager;
  window.LayerComp = LayerComp;
  window.Artboard = Artboard;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = LayerManager;
  module.exports.LayerManager = LayerManager;
  module.exports.LayerComp = LayerComp;
  module.exports.Artboard = Artboard;
}
