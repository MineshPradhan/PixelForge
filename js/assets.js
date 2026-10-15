/**
 * PixelForge Studio Pro — Linked & Embedded Assets Engine
 * 
 * Provides Adobe Photoshop-grade asset management:
 *  - Embedded Assets: Inlined pixel/vector data preserved inside document
 *  - Linked Assets: External reference links with live preview and status tracking
 *  - Relinking & Embedding workflow
 *  - Real-time status tracking: 'ok', 'modified', 'missing', 'embedded'
 *  - Automated Smart Object binding and propagation
 */

class Asset {
  constructor(name, uri = null, dataUrl = null, options = {}) {
    this.id = options.id || 'asset_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    this.name = name || 'Untitled Asset';
    this.type = options.type || (uri ? 'linked' : 'embedded'); // 'embedded' | 'linked'
    this.uri = uri || null;
    this.dataUrl = dataUrl || null;
    this.width = options.width || 0;
    this.height = options.height || 0;
    this.fileSize = options.fileSize || (dataUrl ? Math.round(dataUrl.length * 0.75) : 0);
    this.status = options.status || (this.type === 'embedded' ? 'embedded' : 'ok'); // 'ok' | 'modified' | 'missing' | 'embedded'
    this.lastModified = options.lastModified || Date.now();
    this.mimeType = options.mimeType || 'image/png';
  }

  getFormattedSize() {
    if (!this.fileSize) return '0 KB';
    if (this.fileSize < 1024) return this.fileSize + ' B';
    if (this.fileSize < 1024 * 1024) return (this.fileSize / 1024).toFixed(1) + ' KB';
    return (this.fileSize / (1024 * 1024)).toFixed(1) + ' MB';
  }

  embed() {
    this.type = 'embedded';
    this.status = 'embedded';
    this.uri = null;
    this.lastModified = Date.now();
  }

  relink(newUri, newDataUrl = null, width = null, height = null) {
    this.type = 'linked';
    this.uri = newUri;
    if (newDataUrl) this.dataUrl = newDataUrl;
    if (width) this.width = width;
    if (height) this.height = height;
    if (newDataUrl) this.fileSize = Math.round(newDataUrl.length * 0.75);
    this.status = 'ok';
    this.lastModified = Date.now();
  }

  markModified() {
    if (this.type === 'linked') {
      this.status = 'modified';
    }
  }

  markMissing() {
    if (this.type === 'linked') {
      this.status = 'missing';
    }
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      uri: this.uri,
      dataUrl: this.dataUrl,
      width: this.width,
      height: this.height,
      fileSize: this.fileSize,
      status: this.status,
      lastModified: this.lastModified,
      mimeType: this.mimeType
    };
  }

  static fromJSON(json) {
    return new Asset(json.name, json.uri, json.dataUrl, json);
  }
}

class AssetManager {
  constructor(app = null) {
    this.app = app;
    this.assets = new Map();
    this.assetCounter = 0;
    this.onChange = null;
  }

  notifyUpdate() {
    if (typeof this.onChange === 'function') {
      this.onChange();
    }
  }

  registerAsset(asset) {
    this.assets.set(asset.id, asset);
    this.notifyUpdate();
    return asset;
  }

  getAsset(assetId) {
    return this.assets.get(assetId) || null;
  }

  listAssets() {
    return Array.from(this.assets.values());
  }

  deleteAsset(assetId) {
    const deleted = this.assets.delete(assetId);
    if (deleted) this.notifyUpdate();
    return deleted;
  }

  /**
   * Place an Embedded Asset into the project as a new Smart Object layer.
   */
  placeEmbedded(name, dataUrl, width = null, height = null, targetX = null, targetY = null) {
    this.assetCounter++;
    const assetName = name || `Embedded Asset ${this.assetCounter}`;
    const lm = this.app ? (this.app.layerManager || this.app) : null;
    const docW = lm ? lm.width : 800;
    const docH = lm ? lm.height : 600;
    const w = width || docW;
    const h = height || docH;

    const asset = new Asset(assetName, null, dataUrl, {
      type: 'embedded',
      width: w,
      height: h,
      fileSize: dataUrl ? Math.round(dataUrl.length * 0.75) : 0,
      status: 'embedded'
    });
    this.assets.set(asset.id, asset);

    const layer = this._createSmartObjectLayerForAsset(asset, targetX, targetY);
    this.notifyUpdate();
    return { asset, layer };
  }

  /**
   * Place a Linked Asset into the project as a new Smart Object layer.
   */
  placeLinked(name, uri, previewDataUrl = null, width = null, height = null, targetX = null, targetY = null) {
    this.assetCounter++;
    const assetName = name || `Linked Asset ${this.assetCounter}`;
    const lm = this.app ? (this.app.layerManager || this.app) : null;
    const docW = lm ? lm.width : 800;
    const docH = lm ? lm.height : 600;
    const w = width || docW;
    const h = height || docH;

    const asset = new Asset(assetName, uri, previewDataUrl, {
      type: 'linked',
      width: w,
      height: h,
      fileSize: previewDataUrl ? Math.round(previewDataUrl.length * 0.75) : 0,
      status: 'ok'
    });
    this.assets.set(asset.id, asset);

    const layer = this._createSmartObjectLayerForAsset(asset, targetX, targetY);
    this.notifyUpdate();
    return { asset, layer };
  }

  _createSmartObjectLayerForAsset(asset, targetX = null, targetY = null) {
    const lm = this.app ? (this.app.layerManager || this.app) : null;
    if (!lm) return null;

    const w = asset.width || lm.width || 800;
    const h = asset.height || lm.height || 600;

    // Create source canvas for Smart Object
    const canvasFactory = (typeof Utils !== 'undefined' && Utils.createCanvas)
      ? Utils.createCanvas
      : (cw, ch) => {
          if (typeof document !== 'undefined') {
            const c = document.createElement('canvas');
            c.width = cw; c.height = ch;
            return c;
          }
          return { width: cw, height: ch, getContext: () => ({ drawImage() {}, clearRect() {}, getImageData() { return { width: cw, height: ch, data: new Uint8ClampedArray(cw * ch * 4) }; }, putImageData() {} }) };
        };

    const sourceCanvas = canvasFactory(w, h);
    const sourceCtx = sourceCanvas.getContext('2d');

    const layer = lm.createLayerObject(asset.name, 'smart-object');
    layer.assetId = asset.id;

    if (asset.dataUrl && typeof Image !== 'undefined') {
      const img = new Image();
      img.onload = () => {
        sourceCtx.drawImage(img, 0, 0);
        if (layer.smartObjectData) {
          layer.smartObjectData.renderToLayer(layer);
          if (this.app && typeof this.app.renderComposite === 'function') {
            this.app.renderComposite();
          }
        }
      };
      img.src = asset.dataUrl;
    }

    // Bind SmartObjectData if engine is available
    const SmartDataClass = (typeof SmartObjectData !== 'undefined') 
      ? SmartObjectData 
      : (typeof window !== 'undefined' && window.SmartObjectData ? window.SmartObjectData : null);

    if (SmartDataClass) {
      layer.smartObjectData = new SmartDataClass(sourceCanvas, w, h, {
        assetId: asset.id,
        assetType: asset.type
      });

      const posX = targetX !== null ? targetX : Math.round((lm.width - w) / 2);
      const posY = targetY !== null ? targetY : Math.round((lm.height - h) / 2);
      layer.smartObjectData.setTransform(posX, posY, w, h, 0);
      layer.smartObjectData.renderToLayer(layer);
    }

    lm.layers.push(layer);
    lm.setActiveLayer(layer.id);
    if (this.app && typeof this.app.renderComposite === 'function') {
      this.app.renderComposite();
    }
    return layer;
  }

  /**
   * Embed a previously Linked Asset.
   */
  embedAsset(assetId) {
    const asset = this.getAsset(assetId);
    if (!asset) return false;
    asset.embed();

    const lm = this.app ? (this.app.layerManager || this.app) : null;
    if (lm) {
      for (const l of lm.layers) {
        if (l.assetId === assetId && l.smartObjectData) {
          l.smartObjectData.assetType = 'embedded';
        }
      }
    }
    this.notifyUpdate();
    return true;
  }

  /**
   * Relink a Linked Asset to a new file URI / data URL and update all dependent layers.
   */
  relinkAsset(assetId, newUri, newDataUrl = null, width = null, height = null) {
    const asset = this.getAsset(assetId);
    if (!asset) return false;
    asset.relink(newUri, newDataUrl, width, height);

    const lm = this.app ? (this.app.layerManager || this.app) : null;
    if (lm) {
      const canvasFactory = (typeof Utils !== 'undefined' && Utils.createCanvas) ? Utils.createCanvas : (w, h) => ({ width: w, height: h, getContext: () => ({ drawImage() {}, clearRect() {} }) });
      for (const l of lm.layers) {
        if (l.assetId === assetId && l.smartObjectData) {
          if (width) l.smartObjectData.originalWidth = width;
          if (height) l.smartObjectData.originalHeight = height;

          if (newDataUrl) {
            const newCanvas = canvasFactory(l.smartObjectData.originalWidth, l.smartObjectData.originalHeight);
            const nCtx = newCanvas.getContext('2d');
            if (typeof Image !== 'undefined') {
              const img = new Image();
              img.onload = () => {
                nCtx.drawImage(img, 0, 0);
                l.smartObjectData.sourceCanvas = newCanvas;
                l.smartObjectData.sourceCtx = nCtx;
                l.smartObjectData.renderToLayer(l);
                if (this.app && typeof this.app.renderComposite === 'function') {
                  this.app.renderComposite();
                }
              };
              img.src = newDataUrl;
            } else {
              l.smartObjectData.sourceCanvas = newCanvas;
              l.smartObjectData.sourceCtx = nCtx;
              l.smartObjectData.renderToLayer(l);
            }
          } else {
            l.smartObjectData.renderToLayer(l);
          }
        }
      }
      if (this.app && typeof this.app.renderComposite === 'function') {
        this.app.renderComposite();
      }
    }
    this.notifyUpdate();
    return true;
  }

  checkAssetStatus(assetId) {
    const asset = this.getAsset(assetId);
    if (!asset) return null;
    return asset.status;
  }

  toJSON() {
    return Array.from(this.assets.values()).map(a => a.toJSON());
  }

  fromJSON(data) {
    this.assets.clear();
    if (Array.isArray(data)) {
      data.forEach(item => {
        const a = Asset.fromJSON(item);
        this.assets.set(a.id, a);
      });
    }
    this.notifyUpdate();
  }
}

// Module export for Node.js test environment and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Asset, AssetManager };
} else if (typeof window !== 'undefined') {
  window.Asset = Asset;
  window.AssetManager = AssetManager;
}
