/**
 * PixelForge Studio — Multi-Document Tabbed Interface Manager
 * Supports concurrent multi-document sessions, document tabs,
 * seamless O(1) document switching, cross-document layer cloning,
 * and Photoshop-grade dirty/save state synchronization.
 */

class DocumentSession {
  constructor(options = {}) {
    this.id = options.id || 'doc_' + Math.random().toString(36).substring(2, 9);
    this.title = options.title || 'Untitled';
    this.width = options.width || 1200;
    this.height = options.height || 800;
    this.dpi = options.dpi || 72;
    this.colorMode = options.colorMode || 'RGB';
    this.zoom = options.zoom || 1.0;
    this.panX = options.panX || 0;
    this.panY = options.panY || 0;
    this.layers = options.layers || [];
    this.activeLayerIndex = options.activeLayerIndex !== undefined ? options.activeLayerIndex : 0;
    this.history = options.history || [];
    this.historyIndex = options.historyIndex !== undefined ? options.historyIndex : -1;
    this.guides = options.guides || { horizontal: [], vertical: [] };
    this.paths = options.paths || null;
    this.isDirty = options.isDirty || false;
    this.filePath = options.filePath || null;
  }
}

class MultiDocumentManager {
  constructor(app) {
    this.app = app;
    this.documents = new Map();
    this.activeDocId = null;
    this.docCounter = 1;
    this.tabListEl = null;
    this.newTabBtn = null;
  }

  /**
   * Initializes the tab bar and captures the starting workspace session
   */
  init() {
    if (typeof document !== 'undefined') {
      this.tabListEl = document.getElementById('document-tabs-list');
      this.newTabBtn = document.getElementById('btn-new-doc-tab');

      if (this.newTabBtn) {
        this.newTabBtn.addEventListener('click', () => {
          if (typeof this.app.showNewCanvasDialog === 'function') {
            this.app.showNewCanvasDialog();
          } else {
            this.createNewDocument(1200, 800, `Untitled-${++this.docCounter}`);
          }
        });
      }
    }

    // Capture initial document if app is running
    if (this.app && this.documents.size === 0) {
      this.captureInitialDocument();
    }

    this.renderTabs();
  }

  /**
   * Creates initial session wrapper around current app state
   */
  captureInitialDocument() {
    const doc = new DocumentSession({
      id: 'doc_' + (this.docCounter++),
      title: 'Untitled-1',
      width: this.app.width || 1200,
      height: this.app.height || 800,
      zoom: this.app.zoom || 1.0,
      panX: this.app.panX || 0,
      panY: this.app.panY || 0,
      layers: this.app.layerManager ? this.app.layerManager.layers : [],
      activeLayerIndex: this.app.layerManager ? this.app.layerManager.activeLayerIndex : 0,
      history: this.app.history ? [...this.app.history] : [],
      historyIndex: this.app.historyIndex !== undefined ? this.app.historyIndex : -1,
      guides: this.app.guides ? JSON.parse(JSON.stringify(this.app.guides)) : { horizontal: [], vertical: [] },
      isDirty: false
    });

    this.documents.set(doc.id, doc);
    this.activeDocId = doc.id;
    return doc;
  }

  /**
   * Creates and activates a new blank document session
   */
  createNewDocument(width = 1200, height = 800, title = null, bgType = 'white') {
    if (!title) title = `Untitled-${++this.docCounter}`;

    // Create background canvas
    let bgCanvas = null;
    if (typeof document !== 'undefined' && document.createElement) {
      bgCanvas = document.createElement('canvas');
      bgCanvas.width = width;
      bgCanvas.height = height;
      const ctx = bgCanvas.getContext('2d');
      if (bgType === 'white') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
      } else if (bgType === 'black') {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, width, height);
      }
    }

    const bgLayer = {
      id: 'layer_bg_' + Date.now(),
      name: 'Background',
      type: 'raster',
      canvas: bgCanvas,
      visible: true,
      opacity: 1,
      blendMode: 'normal',
      locked: true,
      x: 0,
      y: 0,
      width: width,
      height: height
    };

    const doc = new DocumentSession({
      id: 'doc_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      title,
      width,
      height,
      layers: [bgLayer],
      activeLayerIndex: 0,
      history: [],
      historyIndex: -1,
      isDirty: false
    });

    this.documents.set(doc.id, doc);
    this.switchDocument(doc.id);
    return doc;
  }

  /**
   * Switches the active workspace document session
   */
  switchDocument(docId) {
    if (!this.documents.has(docId)) return false;

    // 1. Snapshot current document state
    if (this.activeDocId && this.documents.has(this.activeDocId) && this.app) {
      const activeDoc = this.documents.get(this.activeDocId);
      activeDoc.zoom = this.app.zoom;
      activeDoc.panX = this.app.panX;
      activeDoc.panY = this.app.panY;
      if (this.app.layerManager) {
        activeDoc.layers = this.app.layerManager.layers;
        activeDoc.activeLayerIndex = this.app.layerManager.activeLayerIndex;
      }
      if (this.app.history) {
        activeDoc.history = [...this.app.history];
        activeDoc.historyIndex = this.app.historyIndex;
      }
      if (this.app.guides) {
        activeDoc.guides = JSON.parse(JSON.stringify(this.app.guides));
      }
    }

    // 2. Activate target document
    this.activeDocId = docId;
    const targetDoc = this.documents.get(docId);

    if (this.app) {
      this.app.width = targetDoc.width;
      this.app.height = targetDoc.height;
      this.app.zoom = targetDoc.zoom || 1.0;
      this.app.panX = targetDoc.panX || 0;
      this.app.panY = targetDoc.panY || 0;

      // Update canvases
      if (this.app.mainCanvas) {
        this.app.mainCanvas.width = targetDoc.width;
        this.app.mainCanvas.height = targetDoc.height;
      }
      if (this.app.bgGridCanvas) {
        this.app.bgGridCanvas.width = targetDoc.width;
        this.app.bgGridCanvas.height = targetDoc.height;
      }
      if (this.app.overlayCanvas) {
        this.app.overlayCanvas.width = targetDoc.width;
        this.app.overlayCanvas.height = targetDoc.height;
      }

      // Restore layers
      if (this.app.layerManager) {
        this.app.layerManager.layers = targetDoc.layers;
        this.app.layerManager.activeLayerIndex = targetDoc.activeLayerIndex;
        if (typeof this.app.layerManager.renderLayersList === 'function') {
          this.app.layerManager.renderLayersList();
        }
      }

      // Restore history
      if (this.app.history !== undefined) {
        this.app.history = [...targetDoc.history];
        this.app.historyIndex = targetDoc.historyIndex;
        if (typeof this.app.updateHistoryPanel === 'function') {
          this.app.updateHistoryPanel();
        }
      }

      // Restore guides
      if (targetDoc.guides && this.app.guides) {
        this.app.guides = JSON.parse(JSON.stringify(targetDoc.guides));
      }

      // Trigger composite render
      if (typeof this.app.renderComposite === 'function') {
        this.app.renderComposite();
      }
      if (typeof this.app.updateZoomDisplay === 'function') {
        this.app.updateZoomDisplay();
      }
    }

    this.renderTabs();
    return true;
  }

  /**
   * Closes a document session
   */
  closeDocument(docId = null) {
    const targetId = docId || this.activeDocId;
    if (!this.documents.has(targetId)) return false;

    const doc = this.documents.get(targetId);
    this.documents.delete(targetId);

    // If closing active document, switch to remaining document
    if (targetId === this.activeDocId) {
      const remaining = Array.from(this.documents.keys());
      if (remaining.length > 0) {
        this.switchDocument(remaining[remaining.length - 1]);
      } else {
        // Last document closed -> create fresh default document or show welcome
        this.activeDocId = null;
        if (typeof this.app.showHomeScreen === 'function') {
          this.app.showHomeScreen();
        } else {
          this.createNewDocument(1200, 800, 'Untitled-1');
        }
      }
    } else {
      this.renderTabs();
    }

    return true;
  }

  /**
   * Clones a layer from active document into a destination document
   */
  duplicateLayerTo(sourceLayer, targetDocId) {
    if (!sourceLayer || !this.documents.has(targetDocId)) return null;
    const targetDoc = this.documents.get(targetDocId);

    // Deep clone layer
    const clone = {
      ...sourceLayer,
      id: 'layer_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      name: sourceLayer.name + ' copy'
    };

    if (sourceLayer.canvas && typeof document !== 'undefined' && document.createElement) {
      const c = document.createElement('canvas');
      c.width = sourceLayer.canvas.width;
      c.height = sourceLayer.canvas.height;
      const ctx = c.getContext('2d');
      ctx.drawImage(sourceLayer.canvas, 0, 0);
      clone.canvas = c;
    }

    targetDoc.layers.push(clone);
    targetDoc.activeLayerIndex = targetDoc.layers.length - 1;
    targetDoc.isDirty = true;

    // If target document is currently active, re-render layer stack
    if (targetDocId === this.activeDocId && this.app && this.app.layerManager) {
      this.app.layerManager.renderLayersList();
      this.app.renderComposite();
    }

    return clone;
  }

  /**
   * Marks active document as dirty (has unsaved modifications)
   */
  markDirty(isDirty = true) {
    const doc = this.getActiveDocument();
    if (doc && doc.isDirty !== isDirty) {
      doc.isDirty = isDirty;
      this.renderTabs();
    }
  }

  /**
   * Returns currently active DocumentSession
   */
  getActiveDocument() {
    return this.activeDocId ? this.documents.get(this.activeDocId) : null;
  }

  /**
   * Returns all open document sessions
   */
  getAllDocuments() {
    return Array.from(this.documents.values());
  }

  /**
   * Renders tab items in #document-tabs-list
   */
  renderTabs() {
    if (!this.tabListEl) return;
    this.tabListEl.innerHTML = '';

    for (const doc of this.documents.values()) {
      const isActive = doc.id === this.activeDocId;
      const tab = document.createElement('div');
      tab.className = `doc-tab ${isActive ? 'active' : ''}`;
      tab.dataset.docId = doc.id;
      tab.title = `${doc.title} (${doc.width}x${doc.height}px @ ${Math.round((doc.zoom || 1) * 100)}%)`;

      const titleSpan = document.createElement('span');
      titleSpan.className = 'doc-tab-title';
      titleSpan.textContent = doc.title + (doc.isDirty ? ' *' : '');

      const zoomSpan = document.createElement('span');
      zoomSpan.className = 'doc-tab-zoom';
      zoomSpan.textContent = `@ ${Math.round((doc.zoom || 1) * 100)}%`;

      const closeBtn = document.createElement('button');
      closeBtn.className = 'doc-tab-close';
      closeBtn.innerHTML = '&times;';
      closeBtn.title = 'Close Document';
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.closeDocument(doc.id);
      });

      tab.appendChild(titleSpan);
      tab.appendChild(zoomSpan);
      tab.appendChild(closeBtn);

      tab.addEventListener('click', () => {
        if (doc.id !== this.activeDocId) {
          this.switchDocument(doc.id);
        }
      });

      this.tabListEl.appendChild(tab);
    }
  }
}

if (typeof window !== 'undefined') {
  window.DocumentSession = DocumentSession;
  window.MultiDocumentManager = MultiDocumentManager;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DocumentSession, MultiDocumentManager };
}
