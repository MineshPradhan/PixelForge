/**
 * PixelForge Studio — Smart Objects & Smart Filters Engine
 *
 * Implements Adobe Photoshop-grade Smart Objects:
 *  - Non-destructive vector/raster asset encapsulation
 *  - Resolution-independent transformations (scale down/up without degradation)
 *  - Non-destructive Smart Filters stack with per-filter visibility and re-editing
 *  - Smart Filter mask support
 *  - Nested sub-canvas isolated content editing with live propagation
 *  - Full serialization & undo/redo history support
 */

class SmartFilter {
  constructor(type, params = {}, options = {}) {
    this.id = options.id || 'sf_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    this.type = type;
    this.params = JSON.parse(JSON.stringify(params));
    this.enabled = options.enabled !== false;
    this.name = options.name || SmartFilter.getFilterTitle(type);
  }

  static getFilterTitle(type) {
    const titles = {
      gaussianBlur: 'Gaussian Blur',
      sharpen: 'Sharpen',
      brightnessContrast: 'Brightness / Contrast',
      hueSaturation: 'Hue / Saturation',
      colorBalance: 'Color Balance',
      vibrance: 'Vibrance',
      photoFilter: 'Photo Filter',
      threshold: 'Threshold',
      posterize: 'Posterize',
      invert: 'Invert',
      grayscale: 'Grayscale',
      sepia: 'Sepia Vintage',
      emboss: 'Emboss',
      edgeDetect: 'Edge Detection',
      vignette: 'Vignette',
      pixelate: 'Pixelate',
      curves: 'Curves & Levels',
      gradientMap: 'Gradient Map',
      unsharpMask: 'Unsharp Mask',
      motionBlur: 'Motion Blur',
      radialBlur: 'Radial Blur',
      cameraRaw: 'Camera Raw Filter',
      skinSmoothing: 'Skin Smoothing (Neural)',
      lensBlur: 'Depth Lens Blur (Neural)',
      colorTransfer: 'Color Transfer (Neural)',
      superResolution: 'Super Resolution (Neural)',
      skyReplacement: 'Sky Replacement (Neural)',
      denoise: 'Neural Denoise (AI)',
      colorize: 'Neural Colorize (AI)',
      colorLookup: 'Color Lookup (3D LUT)',
      offset: 'Offset Filter',
      highPass: 'High Pass Filter',
      selectiveColor: 'Selective Color',
      channelMixer: 'Channel Mixer',
      displace: 'Displace Filter',
      hdrToneMapping: 'HDR Tone Mapping',
      oilPaint: 'Oil Paint',
      halftone: 'Halftone Screen',
      chromaticAberration: 'Chromatic Aberration'
    };
    return titles[type] || type;
  }

  apply(imgData) {
    if (!this.enabled) return imgData;
    if (this.type === 'selectiveColor' && typeof SelectiveColorEngine !== 'undefined') {
      return SelectiveColorEngine.apply(imgData, this.params);
    }
    if (this.type === 'channelMixer' && typeof ChannelMixerEngine !== 'undefined') {
      return ChannelMixerEngine.apply(imgData, this.params);
    }
    if (this.type === 'displace' && typeof DisplacementFilter !== 'undefined') {
      const p = this.params;
      return DisplacementFilter.apply(imgData, p.mapImageData || p.map, p.scaleX ?? 10, p.scaleY ?? 10, p.undefinedMode || 'repeatEdge');
    }
    if (this.type === 'hdrToneMapping' && typeof HDREngine !== 'undefined') {
      const p = this.params;
      return HDREngine.applyToneMapping(imgData, p.method || 'aces', p.exposureEV || 0, p.gamma || 2.2, p.whitePoint || 1.0);
    }
    if (this.type === 'oilPaint' && typeof OilPaintFilter !== 'undefined') {
      return OilPaintFilter.apply(imgData, this.params);
    }
    if (this.type === 'halftone' && typeof HalftoneScreenFilter !== 'undefined') {
      return HalftoneScreenFilter.apply(imgData, this.params);
    }
    if (this.type === 'chromaticAberration' && typeof ChromaticAberrationFilter !== 'undefined') {
      return ChromaticAberrationFilter.apply(imgData, this.params);
    }
    if (this.type === 'colorLookup' && typeof LutEngine !== 'undefined') {
      const p = this.params;
      const lut = p.lut || (LutEngine.generatePresetLut ? LutEngine.generatePresetLut(p.preset || 'Teal & Orange') : null);
      return LutEngine.applyLut(imgData, lut, p.intensity ?? 1.0);
    }
    if (this.type === 'offset' && typeof OffsetFilter !== 'undefined') {
      const p = this.params;
      return OffsetFilter.apply(imgData, p.horizontal || 0, p.vertical || 0, p.undefinedMode || 'wrapAround');
    }
    if (this.type === 'highPass' && typeof HighPassFilter !== 'undefined') {
      const p = this.params;
      return HighPassFilter.apply(imgData, p.radius || 3.0);
    }
    const filterFn = (typeof Filters !== 'undefined' && Filters[this.type]) 
      ? Filters[this.type] 
      : (typeof window !== 'undefined' && window.Filters ? window.Filters[this.type] : null);

    if (!filterFn) {
      if (this.type === 'curves' && typeof Utils !== 'undefined' && Utils.applyLevelsAndCurve) {
        const p = this.params;
        return Utils.applyLevelsAndCurve(imgData, p.black ?? 0, p.white ?? 255, p.gamma ?? 1.0, p.lut || null);
      }
      if (typeof NeuralFilters !== 'undefined') {
        const p = this.params;
        switch (this.type) {
          case 'skinSmoothing':
            return NeuralFilters.skinSmoothing(imgData, p);
          case 'lensBlur':
            return NeuralFilters.lensBlur(imgData, p);
          case 'colorTransfer':
            return NeuralFilters.colorTransfer(imgData, p.refImgData || p.sourceData, p);
          case 'superResolution':
            return NeuralFilters.superResolution(imgData, p);
          case 'skyReplacement':
            return NeuralFilters.skyReplacement(imgData, p);
          case 'denoise':
            return NeuralFilters.denoise(imgData, p);
          case 'colorize':
            return NeuralFilters.colorize(imgData, p);
        }
      }
      return imgData;
    }

    const p = this.params;
    switch (this.type) {
      case 'cameraRaw':
        return filterFn(imgData, p);
      case 'gaussianBlur':
        return filterFn(imgData, p.radius || 2);
      case 'brightnessContrast':
        return filterFn(imgData, p.brightness || 0, p.contrast || 0);
      case 'hueSaturation':
        return filterFn(imgData, p.hue || 0, p.saturation || 0);
      case 'colorBalance':
        return filterFn(imgData, p.shadows, p.midtones, p.highlights, p.preserveLuminosity ?? true);
      case 'vibrance':
        return filterFn(imgData, p.vibrance || 0, p.saturation || 0);
      case 'photoFilter':
        return filterFn(imgData, p.r ?? 234, p.g ?? 138, p.b ?? 40, p.density ?? 25, p.preserveLuminosity ?? true);
      case 'threshold':
        return filterFn(imgData, p.cutoff ?? 128);
      case 'posterize':
        return filterFn(imgData, p.levels ?? 4);
      case 'pixelate':
        return filterFn(imgData, p.blockSize || 8);
      case 'gradientMap':
        return filterFn(imgData, p.gradientData || p.gradient || null);
      case 'unsharpMask':
        return filterFn(imgData, p.amount ?? 100, p.radius ?? 2, p.threshold ?? 0);
      case 'motionBlur':
        return filterFn(imgData, p.distance ?? 15, p.angle ?? 0);
      case 'radialBlur':
        return filterFn(imgData, p.amount ?? 10, p.mode || 'spin', p.centerX ?? 0.5, p.centerY ?? 0.5);
      default:
        // Filter functions with no extra arguments (sharpen, invert, grayscale, sepia, etc.)
        return filterFn(imgData);
    }
  }

  clone() {
    return new SmartFilter(this.type, this.params, {
      id: this.id,
      enabled: this.enabled,
      name: this.name
    });
  }

  toJSON() {
    return {
      id: this.id,
      type: this.type,
      params: this.params,
      enabled: this.enabled,
      name: this.name
    };
  }

  static fromJSON(json) {
    return new SmartFilter(json.type, json.params, {
      id: json.id,
      enabled: json.enabled,
      name: json.name
    });
  }
}

class SmartObjectData {
  constructor(sourceCanvas, originalWidth, originalHeight, options = {}) {
    this.originalWidth = originalWidth || (sourceCanvas ? sourceCanvas.width : 100);
    this.originalHeight = originalHeight || (sourceCanvas ? sourceCanvas.height : 100);

    const canvasFactory = (typeof Utils !== 'undefined' && Utils.createCanvas)
      ? Utils.createCanvas
      : (w, h) => {
          if (typeof document !== 'undefined') {
            const c = document.createElement('canvas');
            c.width = w; c.height = h;
            return c;
          }
          return { width: w, height: h, getContext: () => ({ drawImage() {}, clearRect() {}, getImageData() { return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }; }, putImageData() {} }) };
        };

    this.sourceCanvas = canvasFactory(this.originalWidth, this.originalHeight);
    this.sourceCtx = this.sourceCanvas.getContext('2d');

    if (sourceCanvas) {
      this.sourceCtx.drawImage(sourceCanvas, 0, 0);
    }

    // Transformation parameters relative to target canvas coordinates
    this.transform = options.transform ? { ...options.transform } : {
      x: 0,
      y: 0,
      width: this.originalWidth,
      height: this.originalHeight,
      rotation: 0,
      scaleX: 1.0,
      scaleY: 1.0
    };

    // Sequential non-destructive Smart Filters stack
    this.filters = (options.filters || []).map(f => f instanceof SmartFilter ? f : SmartFilter.fromJSON(f));

    // Smart Filter localized mask
    this.filterMask = options.filterMask || {
      hasMask: false,
      canvas: null,
      ctx: null,
      enabled: true
    };

    // Linked & Embedded Asset metadata
    this.assetId = options.assetId || null;
    this.assetType = options.assetType || 'embedded';
  }

  addFilter(type, params = {}, name = null) {
    const filter = new SmartFilter(type, params, { name });
    this.filters.push(filter);
    return filter;
  }

  removeFilter(filterId) {
    const idx = this.filters.findIndex(f => f.id === filterId);
    if (idx !== -1) {
      this.filters.splice(idx, 1);
      return true;
    }
    return false;
  }

  toggleFilter(filterId, enabled = null) {
    const filter = this.filters.find(f => f.id === filterId);
    if (filter) {
      filter.enabled = enabled !== null ? enabled : !filter.enabled;
      return filter.enabled;
    }
    return false;
  }

  setTransform(x, y, width, height, rotation = 0) {
    this.transform.x = x;
    this.transform.y = y;
    this.transform.width = width;
    this.transform.height = height;
    this.transform.rotation = rotation;
    this.transform.scaleX = width / this.originalWidth;
    this.transform.scaleY = height / this.originalHeight;
  }

  /**
   * Renders the Smart Object (untouched source + resolution-independent transform + smart filters)
   * into target layer canvas.
   */
  renderToLayer(layer) {
    if (!layer || !layer.ctx || !layer.canvas) return;

    const ctx = layer.ctx;
    const w = layer.canvas.width;
    const h = layer.canvas.height;

    ctx.save();
    ctx.clearRect(0, 0, w, h);

    // Apply high-quality image smoothing
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // 1. Draw transformed source asset
    const t = this.transform;
    if (t.rotation && t.rotation !== 0) {
      const cx = t.x + t.width / 2;
      const cy = t.y + t.height / 2;
      ctx.translate(cx, cy);
      ctx.rotate((t.rotation * Math.PI) / 180);
      ctx.drawImage(this.sourceCanvas, -t.width / 2, -t.height / 2, t.width, t.height);
    } else {
      ctx.drawImage(this.sourceCanvas, t.x, t.y, t.width, t.height);
    }
    ctx.restore();

    // 2. Apply Smart Filters sequentially if any exist and are enabled
    const activeFilters = this.filters.filter(f => f.enabled);
    if (activeFilters.length > 0) {
      let imgData = ctx.getImageData(0, 0, w, h);
      let preFilteredData = null;

      if (this.filterMask && this.filterMask.hasMask && this.filterMask.enabled) {
        preFilteredData = new Uint8ClampedArray(imgData.data);
      }

      for (const filter of activeFilters) {
        const res = filter.apply(imgData);
        if (res) imgData = res;
      }

      // 3. Blend with Filter Mask if present
      if (preFilteredData && this.filterMask.canvas) {
        const maskData = this.filterMask.ctx.getImageData(0, 0, w, h).data;
        const curData = imgData.data;
        for (let i = 0; i < curData.length; i += 4) {
          if (curData[i + 3] === 0 && preFilteredData[i + 3] === 0) continue;
          const maskLum = (maskData[i] * 77 + maskData[i + 1] * 150 + maskData[i + 2] * 29) >> 8;
          const maskWeight = ((maskLum * maskData[i + 3]) >> 8) / 255;
          const invWeight = 1.0 - maskWeight;

          curData[i]     = Math.round(preFilteredData[i] * invWeight + curData[i] * maskWeight);
          curData[i + 1] = Math.round(preFilteredData[i + 1] * invWeight + curData[i + 1] * maskWeight);
          curData[i + 2] = Math.round(preFilteredData[i + 2] * invWeight + curData[i + 2] * maskWeight);
          curData[i + 3] = Math.round(preFilteredData[i + 3] * invWeight + curData[i + 3] * maskWeight);
        }
      }

      ctx.putImageData(imgData, 0, 0);
    }
  }

  clone() {
    const cloned = new SmartObjectData(this.sourceCanvas, this.originalWidth, this.originalHeight, {
      transform: { ...this.transform },
      filters: this.filters.map(f => f.clone()),
      assetId: this.assetId,
      assetType: this.assetType
    });

    if (this.filterMask.hasMask && this.filterMask.canvas) {
      const canvasFactory = (typeof Utils !== 'undefined' && Utils.createCanvas)
        ? Utils.createCanvas
        : (w, h) => {
            const c = document.createElement('canvas');
            c.width = w; c.height = h;
            return c;
          };
      const maskC = canvasFactory(this.filterMask.canvas.width, this.filterMask.canvas.height);
      const maskCtx = maskC.getContext('2d');
      maskCtx.drawImage(this.filterMask.canvas, 0, 0);
      cloned.filterMask = {
        hasMask: true,
        canvas: maskC,
        ctx: maskCtx,
        enabled: this.filterMask.enabled
      };
    }

    return cloned;
  }

  toJSON() {
    return {
      originalWidth: this.originalWidth,
      originalHeight: this.originalHeight,
      transform: this.transform,
      assetId: this.assetId,
      assetType: this.assetType,
      filters: this.filters.map(f => f.toJSON()),
      sourceDataUrl: this.sourceCanvas.toDataURL ? this.sourceCanvas.toDataURL('image/png') : null,
      filterMask: {
        hasMask: this.filterMask.hasMask,
        enabled: this.filterMask.enabled,
        maskDataUrl: (this.filterMask.canvas && this.filterMask.canvas.toDataURL)
          ? this.filterMask.canvas.toDataURL('image/png')
          : null
      }
    };
  }

  static fromJSON(json, onReadyCallback = null) {
    const canvasFactory = (typeof Utils !== 'undefined' && Utils.createCanvas)
      ? Utils.createCanvas
      : (w, h) => {
          if (typeof document !== 'undefined') {
            const c = document.createElement('canvas');
            c.width = w; c.height = h;
            return c;
          }
          return { width: w, height: h, getContext: () => ({ drawImage() {}, clearRect() {}, getImageData() { return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }; }, putImageData() {} }) };
        };

    const tempCanvas = canvasFactory(json.originalWidth || 100, json.originalHeight || 100);
    const smData = new SmartObjectData(tempCanvas, json.originalWidth, json.originalHeight, {
      transform: json.transform,
      filters: json.filters || [],
      assetId: json.assetId || null,
      assetType: json.assetType || 'embedded'
    });

    if (json.sourceDataUrl && typeof Image !== 'undefined') {
      const img = new Image();
      img.onload = () => {
        smData.sourceCtx.clearRect(0, 0, smData.originalWidth, smData.originalHeight);
        smData.sourceCtx.drawImage(img, 0, 0);
        if (onReadyCallback) onReadyCallback(smData);
      };
      img.src = json.sourceDataUrl;
    } else if (onReadyCallback) {
      onReadyCallback(smData);
    }

    return smData;
  }
}

class SmartObjectManager {
  constructor(app) {
    this.app = app;
  }

  /**
   * Converts selected layer(s) into a unified Smart Object layer
   */
  convertToSmartObject(targetLayerId = null) {
    const lm = this.app.layerManager;
    let selected = lm.getSelectedLayers();

    if (selected.length === 0) {
      const active = lm.getActiveLayer();
      if (active) selected = [active];
    }

    if (selected.length === 0) return null;

    // Filter out group containers
    const validLayers = selected.filter(l => l.type !== 'group');
    if (validLayers.length === 0) return null;

    const w = this.app.width;
    const h = this.app.height;

    // Create pristine sub-canvas capturing composite of selected layers
    const canvasFactory = (typeof Utils !== 'undefined' && Utils.createCanvas)
      ? Utils.createCanvas
      : (width, height) => {
          const c = document.createElement('canvas');
          c.width = width; c.height = height;
          return c;
        };

    const sourceCanvas = canvasFactory(w, h);
    const sourceCtx = sourceCanvas.getContext('2d');

    // Draw layers in ascending stack order
    const ordered = lm.layers.filter(l => validLayers.some(v => v.id === l.id));
    for (const l of ordered) {
      if (l.visible && l.canvas) {
        sourceCtx.save();
        sourceCtx.globalAlpha = (l.opacity || 100) / 100;
        sourceCtx.globalCompositeOperation = l.blendMode || 'source-over';
        sourceCtx.drawImage(l.canvas, 0, 0);
        sourceCtx.restore();
      }
    }

    // Determine target insertion index and parent
    const topLayer = ordered[ordered.length - 1];
    const topIdx = lm.layers.findIndex(l => l.id === topLayer.id);
    const parentId = topLayer.parentId || null;
    const name = validLayers.length === 1 ? `${validLayers[0].name} (Smart Object)` : 'Smart Object';

    // Remove selected source layers
    validLayers.forEach(l => {
      const idx = lm.layers.findIndex(item => item.id === l.id);
      if (idx !== -1) lm.layers.splice(idx, 1);
      lm.selectedLayerIds.delete(l.id);
    });

    // Create Smart Object Layer
    const smartLayer = lm.createLayerObject(name, 'smart-object');
    smartLayer.parentId = parentId;
    smartLayer.smartObjectData = new SmartObjectData(sourceCanvas, w, h);
    smartLayer.smartObjectData.renderToLayer(smartLayer);

    // Insert at previous stack location
    const insertIdx = Math.min(topIdx, lm.layers.length);
    lm.layers.splice(insertIdx, 0, smartLayer);
    lm.setActiveLayer(smartLayer.id);

    this.app.renderComposite();
    this.app.pushHistoryState(`Convert to Smart Object: ${smartLayer.name}`);
    return smartLayer;
  }

  /**
   * Rasterizes Smart Object, flattening its transforms and smart filters into a regular raster layer
   */
  rasterizeSmartObject(smartLayer) {
    if (!smartLayer || smartLayer.type !== 'smart-object') return false;

    smartLayer.type = 'raster';
    smartLayer.smartObjectData = null;

    this.app.renderComposite();
    this.app.pushHistoryState(`Rasterize Smart Object: ${smartLayer.name}`);
    return true;
  }

  /**
   * Opens isolated content editing session for Smart Object
   */
  openSmartObjectEditor(smartLayer) {
    if (!smartLayer || smartLayer.type !== 'smart-object' || !smartLayer.smartObjectData) return;

    const modal = document.getElementById('modal-smart-object-editor');
    if (!modal) return;

    this.editingLayer = smartLayer;
    const smData = smartLayer.smartObjectData;

    const titleEl = document.getElementById('so-editor-title');
    if (titleEl) titleEl.textContent = `Smart Object: ${smartLayer.name}`;

    const previewCanvas = document.getElementById('so-preview-canvas');
    if (previewCanvas) {
      previewCanvas.width = smData.originalWidth;
      previewCanvas.height = smData.originalHeight;
      const pCtx = previewCanvas.getContext('2d');
      pCtx.clearRect(0, 0, smData.originalWidth, smData.originalHeight);
      pCtx.drawImage(smData.sourceCanvas, 0, 0);
    }

    this.renderSmartFiltersListUI(smartLayer);
    modal.classList.remove('hidden');
  }

  /**
   * Renders the Smart Filters list inside the editor dialog and layer panel
   */
  renderSmartFiltersListUI(smartLayer) {
    const listEl = document.getElementById('so-filters-list');
    if (!listEl || !smartLayer.smartObjectData) return;

    listEl.innerHTML = '';
    const filters = smartLayer.smartObjectData.filters;

    if (filters.length === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.className = 'so-empty-filters';
      emptyMsg.textContent = 'No Smart Filters applied yet. Use any filter from the Filter menu.';
      listEl.appendChild(emptyMsg);
      return;
    }

    filters.forEach((f, idx) => {
      const row = document.createElement('div');
      row.className = `so-filter-row ${f.enabled ? 'active' : 'disabled'}`;

      const eyeBtn = document.createElement('button');
      eyeBtn.className = 'so-eye-btn';
      eyeBtn.textContent = f.enabled ? '👁' : '─';
      eyeBtn.title = f.enabled ? 'Disable Smart Filter' : 'Enable Smart Filter';
      eyeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        f.enabled = !f.enabled;
        smartLayer.smartObjectData.renderToLayer(smartLayer);
        this.app.renderComposite();
        this.renderSmartFiltersListUI(smartLayer);
        this.app.pushHistoryState(`Toggle Smart Filter: ${f.name}`);
      });

      const nameSpan = document.createElement('span');
      nameSpan.className = 'so-filter-name';
      nameSpan.textContent = f.name;

      const delBtn = document.createElement('button');
      delBtn.className = 'so-del-btn';
      delBtn.textContent = '✕';
      delBtn.title = 'Remove Smart Filter';
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        smartLayer.smartObjectData.removeFilter(f.id);
        smartLayer.smartObjectData.renderToLayer(smartLayer);
        this.app.renderComposite();
        this.renderSmartFiltersListUI(smartLayer);
        this.app.pushHistoryState(`Remove Smart Filter: ${f.name}`);
      });

      row.appendChild(eyeBtn);
      row.appendChild(nameSpan);
      row.appendChild(delBtn);
      listEl.appendChild(row);
    });
  }
}

// Module export for Node.js test environment and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SmartFilter, SmartObjectData, SmartObjectManager };
} else if (typeof window !== 'undefined') {
  window.SmartFilter = SmartFilter;
  window.SmartObjectData = SmartObjectData;
  window.SmartObjectManager = SmartObjectManager;
}
