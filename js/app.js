// ══════════════════════════════════════════════════════════════════════
// PixelForge Studio — Main Application Controller
// ══════════════════════════════════════════════════════════════════════

class PixelForgeApp {
  constructor() {
    this.width = 1920;
    this.height = 1080;

    // Viewport transform (zoom & pan)
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
    this.showRulers = true;

    // Canvas elements & contexts
    this.bgCanvas = null;
    this.bgCtx = null;
    this.mainCanvas = null;
    this.mainCtx = null;
    this.overlayCanvas = null;
    this.overlayCtx = null;

    // Rulers
    this.rulerTopCanvas = null;
    this.rulerTopCtx = null;
    this.rulerLeftCanvas = null;
    this.rulerLeftCtx = null;

    // Subsystems
    this.layerManager = null;
    this.colorPicker = null;
    this.toolManager = null;
    this.historyManager = null;
    this.smartObjectManager = null;
    this.assetManager = null;
    this.cmykProof = null;
    this.highPassFilter = null;
    this.frequencySeparationEngine = null;
    this.channelsEngine = null;
    this.historyBrushEngine = null;
    this.puppetWarpEngine = null;
    this.timelineManager = null;
    this.vanishingPointEngine = null;

    // Curves modal state
    this.curvesPoints = [
      { x: 0, y: 0 },
      { x: 128, y: 128 },
      { x: 255, y: 255 }
    ];
    this.activeCurvePointIdx = -1;

    // Electron IPC bridge (if running under Electron)
    this.ipc = null;
    if (typeof window.require !== 'undefined') {
      try {
        const electron = window.require('electron');
        this.ipc = electron.ipcRenderer;
      } catch (e) {
        this.ipc = null;
      }
    }

    this.isDirty = false;
    this.documentName = 'Untitled Project';
    this.documentPath = null;
    this.recentProjectsManager = null;
  }

  init() {
    // Acquire canvases
    this.bgCanvas = document.getElementById('bg-grid-canvas');
    this.bgCtx = this.bgCanvas.getContext('2d');

    this.mainCanvas = document.getElementById('main-view-canvas');
    this.mainCtx = this.mainCanvas.getContext('2d');

    this.overlayCanvas = document.getElementById('overlay-canvas');
    this.overlayCtx = this.overlayCanvas.getContext('2d');

    // Acquire rulers
    this.rulerTopCanvas = document.getElementById('ruler-top');
    if (this.rulerTopCanvas) this.rulerTopCtx = this.rulerTopCanvas.getContext('2d');
    this.rulerLeftCanvas = document.getElementById('ruler-left');
    if (this.rulerLeftCanvas) this.rulerLeftCtx = this.rulerLeftCanvas.getContext('2d');

    // Initialize subsystems
    this.historyManager = new HistoryManager();
    this.colorPicker = new ColorPickerManager();
    this.colorPicker.init();

    this.layerManager = new LayerManager(this.width, this.height);
    this.layerManager.onChange = () => this.renderComposite();

    this.toolManager = new ToolManager(this);
    this.toolManager.init();

    // Setup initial project (in background without hiding the welcome screen)
    this.createDocument(1920, 1080, 'white', false);

    // Setup UI bindings
    this.bindMenuBar();
    this.bindDialogModals();
    this.bindKeyboardShortcuts();
    this.bindZoomAndPan();
    this.bindWelcomeScreen();
    this.bindLayerControls();
    this.bindTypographyPanel();
    this.bindCurvesModal();
    this.bindDockPanels();
    this.bindDockResizer();
    this.bindToolOptionsBarScroll();
    this.bindHistoryControls();
    this.bindDragAndDrop();
    this.bindClipboardEvents();

    if (typeof LiquifyModal !== 'undefined') {
      this.liquifyModal = new LiquifyModal(this);
      this.liquifyModal.init();
    }

    if (typeof GradientEditorModal !== 'undefined') {
      this.gradientEditorModal = new GradientEditorModal(this);
      this.gradientEditorModal.init();
    }

    if (typeof NavigatorManager !== 'undefined') {
      this.navigatorManager = new NavigatorManager(this);
      this.navigatorManager.init();
    }

    if (typeof SmartObjectManager !== 'undefined') {
      this.smartObjectManager = new SmartObjectManager(this);
    }

    if (typeof AssetManager !== 'undefined') {
      this.assetManager = new AssetManager(this);
    }

    if (typeof CMYKProofEngine !== 'undefined') {
      this.cmykProof = new CMYKProofEngine();
      this.updateProofUI();
    }

    if (typeof GuideManager !== 'undefined') {
      this.guideManager = new GuideManager(this);
    }
    if (typeof SnappingEngine !== 'undefined') {
      this.snappingEngine = new SnappingEngine(this, this.guideManager);
    }
    if (typeof MeshWarpEngine !== 'undefined') {
      this.warpEngine = new MeshWarpEngine(this);
    }
    if (typeof LutEngine !== 'undefined') {
      this.lutEngine = new LutEngine();
    }
    if (typeof ActionsEngine !== 'undefined') {
      this.actionsEngine = new ActionsEngine(this);
    }
    if (typeof PatternManager !== 'undefined') {
      this.patternManager = new PatternManager();
    }
    if (typeof HighPassFilter !== 'undefined') {
      this.highPassFilter = HighPassFilter;
      this.frequencySeparationEngine = (typeof FrequencySeparationEngine !== 'undefined') ? new FrequencySeparationEngine(this) : null;
    }
    if (typeof ChannelsEngine !== 'undefined') {
      this.channelsEngine = new ChannelsEngine(this);
    }
    if (typeof HistoryBrushEngine !== 'undefined') {
      this.historyBrushEngine = new HistoryBrushEngine(this);
    }
    if (typeof PuppetWarpEngine !== 'undefined') {
      this.puppetWarpEngine = new PuppetWarpEngine(this);
    }
    if (typeof TimelineManager !== 'undefined') {
      this.timelineManager = new TimelineManager(this);
    }
    if (typeof VanishingPointEngine !== 'undefined') {
      this.vanishingPointEngine = new VanishingPointEngine(this);
    }
    if (typeof ContextualTaskBar !== 'undefined') {
      this.contextualTaskBar = new ContextualTaskBar(this);
    }
    if (typeof AdjustmentBrushEngine !== 'undefined') {
      this.adjustmentBrushEngine = new AdjustmentBrushEngine(this);
    }
    if (typeof ObjectFinderEngine !== 'undefined') {
      this.objectFinderEngine = new ObjectFinderEngine(this);
    }
    if (typeof ScriptingConsole !== 'undefined') {
      this.scriptingConsole = new ScriptingConsole(this);
      if (typeof this.scriptingConsole.bindUI === 'function') {
        this.scriptingConsole.bindUI();
      }
    }
    if (typeof GlyphsPanel !== 'undefined') {
      this.glyphsPanel = new GlyphsPanel(this);
    }
    if (typeof GenerativeFillEngine !== 'undefined') {
      this.generativeFillEngine = new GenerativeFillEngine(this);
    }
    // ── Phase 13 Engines ──
    if (typeof FilterWorkerPool !== 'undefined') {
      this.filterWorkerPool = new FilterWorkerPool();
    }
    if (typeof TileHistoryManager !== 'undefined') {
      this.tileHistoryManager = new TileHistoryManager(this);
    }
    if (typeof GPUFilterEngine !== 'undefined') {
      this.gpuFilterEngine = new GPUFilterEngine();
    }
    if (typeof CustomFontLoader !== 'undefined') {
      this.customFontLoader = new CustomFontLoader();
    }
    if (typeof VideoExportEngine !== 'undefined') {
      this.videoExportEngine = new VideoExportEngine(this.timelineEngine);
    }
    if (typeof ShortcutManager !== 'undefined') {
      this.shortcutManager = new ShortcutManager();
    }
    if (typeof WorkspaceManager !== 'undefined') {
      this.workspaceManager = new WorkspaceManager();
      this.workspaceManager.applyPreset(this.workspaceManager.currentPresetId || 'essentials');
    }
    // ── Phase 14 Engines ──
    if (typeof SymmetryEngine !== 'undefined') {
      this.symmetryEngine = new SymmetryEngine(this.width, this.height);
      const symSelect = document.getElementById('brush-symmetry-select');
      if (symSelect) {
        symSelect.addEventListener('change', () => {
          if (symSelect.value === 'off') {
            this.symmetryEngine.enabled = false;
          } else {
            this.symmetryEngine.enabled = true;
            this.symmetryEngine.setMode(symSelect.value);
          }
          this.renderGuidesAndOverlays();
        });
      }
    }
    if (typeof SplitWarpEngine !== 'undefined') {
      this.splitWarpEngine = new SplitWarpEngine(this.width, this.height);
    }
    // ── Phase 15 Engines ──
    if (typeof QuickMaskEngine !== 'undefined') {
      this.quickMaskEngine = new QuickMaskEngine(this);
      const btnQuickMask = document.getElementById('btn-quick-mask');
      const btnExitQuickMask = document.getElementById('btn-exit-quickmask');
      if (btnQuickMask) {
        btnQuickMask.addEventListener('click', () => this.toggleQuickMask());
      }
      if (btnExitQuickMask) {
        btnExitQuickMask.addEventListener('click', () => this.toggleQuickMask());
      }
    }
    if (typeof CloneSourceManager !== 'undefined') {
      this.cloneSourceManager = new CloneSourceManager(this);
    }
    if (typeof LensCorrectionEngine !== 'undefined') {
      this.lensCorrectionEngine = new LensCorrectionEngine();
    }
    if (typeof LightingEffectsEngine !== 'undefined') {
      this.lightingEffectsEngine = new LightingEffectsEngine();
    }
    if (typeof FocusStackingEngine !== 'undefined') {
      this.focusStackingEngine = new FocusStackingEngine();
    }
    if (typeof ToolbarCustomizerManager !== 'undefined') {
      this.toolbarCustomizer = new ToolbarCustomizerManager(this);
      this.toolbarCustomizer.init();
    }
    this.bindRulerGuideInteractions();

    const psdInput = document.getElementById('browser-psd-input');
    if (psdInput) {
      psdInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          this.loadProjectFromPsd(ev.target.result, file.name);
        };
        reader.readAsArrayBuffer(file);
      });
    }

    const hdrInput = document.getElementById('browser-hdr-input');
    if (hdrInput) {
      hdrInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          this.loadHdrFromArrayBuffer(ev.target.result, file.name);
        };
        reader.readAsArrayBuffer(file);
      });
    }

    const fontInput = document.getElementById('browser-font-input');
    if (fontInput) {
      fontInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file || !this.customFontLoader) return;
        try {
          const fontData = await this.customFontLoader.loadFontFromFile(file);
          this.showToast(`Custom Font "${fontData.family}" Installed!`);
        } catch (err) {
          console.error(err);
          this.showToast('Failed to load font file: ' + err.message, 'error');
        }
      });
    }

    const shortcutsJsonInput = document.getElementById('browser-shortcuts-json-input');
    if (shortcutsJsonInput) {
      shortcutsJsonInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file || !this.shortcutManager) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          const ok = this.shortcutManager.importJSON(ev.target.result);
          if (ok) {
            this.showToast('Keyboard shortcuts imported successfully!');
            this.renderShortcutsUI();
          } else {
            this.showToast('Failed to parse shortcuts JSON', 'error');
          }
        };
        reader.readAsText(file);
      });
    }

    if (typeof RecentProjectsManager !== 'undefined') {
      this.recentProjectsManager = new RecentProjectsManager(this);
    }

    if (this.ipc) {
      this.ipc.on('app:request-close', () => {
        this.requestCloseDocument('exit');
      });
    }

    window.addEventListener('beforeunload', (e) => {
      if (this.isDirty && this.historyManager && this.historyManager.steps.length > 1) {
        e.preventDefault();
        e.returnValue = '';
        this.requestCloseDocument('exit');
      }
    });

    window.addEventListener('resize', () => this.renderRulers());

    // Fit canvas initially in viewport
    setTimeout(() => {
      this.zoomFit();
      this.renderRulers();
    }, 100);

    // Ensure Studio Home Screen / Welcome Hub is visible on launch
    this.showWelcomeOverlay();
  }

  // ── Document Lifecycle ──
  createDocument(w, h, bgFill = 'white', hideOverlay = true) {
    this.width = w;
    this.height = h;

    [this.bgCanvas, this.mainCanvas, this.overlayCanvas].forEach(c => {
      c.width = w;
      c.height = h;
    });

    const wrapper = document.getElementById('canvas-wrapper');
    wrapper.style.width = w + 'px';
    wrapper.style.height = h + 'px';

    Utils.renderCheckerboard(this.bgCtx, w, h);

    this.layerManager = new LayerManager(w, h);
    this.layerManager.onChange = () => this.renderComposite();

    const fillColor = bgFill === 'white' ? '#ffffff' : bgFill === 'black' ? '#000000' : null;
    this.layerManager.addLayer('Background', fillColor);

    this.historyManager.clear();
    this.pushHistoryState('New Document');
    this.isDirty = false;
    this.documentName = 'Untitled Project';
    this.documentPath = null;

    this.renderComposite();
    this.updateStatusInfo();
    if (hideOverlay) {
      this.hideWelcomeOverlay();
    }
    this.renderRulers();
  }

  renderComposite() {
    this.layerManager.compositeTo(this.mainCtx);
    if (this.cmykProof && (this.cmykProof.isSoftProofing || this.cmykProof.isGamutWarning || this.cmykProof.activePlate !== 'all')) {
      const imgData = this.mainCtx.getImageData(0, 0, this.width, this.height);
      const proofed = this.cmykProof.processImageData(imgData);
      this.mainCtx.putImageData(proofed, 0, 0);
    }
    this.layerManager.renderLayerStackUI();
    if (this.navigatorManager) {
      this.navigatorManager.update();
    }
    if (this.contextualTaskBar) {
      this.contextualTaskBar.update();
    }
  }

  updateProofUI() {
    if (!this.cmykProof) return;
    const pill = document.getElementById('proof-status-indicator');
    if (pill) {
      if (this.cmykProof.isGamutWarning) {
        pill.textContent = 'GAMUT WARNING';
        pill.classList.remove('hidden');
      } else if (this.cmykProof.isSoftProofing) {
        pill.textContent = `CMYK PROOF (${this.cmykProof.currentProfileKey})`;
        pill.classList.remove('hidden');
      } else {
        pill.classList.add('hidden');
      }
    }

    const swopLbl = document.getElementById('lbl-proof-swop');
    const fograLbl = document.getElementById('lbl-proof-fogra39');
    const euroLbl = document.getElementById('lbl-proof-euroscale');

    if (swopLbl) swopLbl.innerHTML = (this.cmykProof.currentProfileKey === 'SWOP' ? '✓ ' : '&nbsp;&nbsp;&nbsp;') + 'U.S. Web Coated (SWOP) v2';
    if (fograLbl) fograLbl.innerHTML = (this.cmykProof.currentProfileKey === 'FOGRA39' ? '✓ ' : '&nbsp;&nbsp;&nbsp;') + 'ISO Coated FOGRA39 (Europe)';
    if (euroLbl) euroLbl.innerHTML = (this.cmykProof.currentProfileKey === 'EUROSCALE' ? '✓ ' : '&nbsp;&nbsp;&nbsp;') + 'Euroscale Uncoated v2';
  }

  pushHistoryState(name) {
    this.historyManager.push(name, this.layerManager.layers, this.layerManager.activeLayerId);
    if (name !== 'New Document') {
      this.isDirty = true;
    }
  }

  restoreState(state) {
    this.layerManager.restoreFromSnapshot(state.layers).then(() => {
      this.layerManager.setActiveLayer(state.activeLayerId);
      this.renderComposite();
    });
  }

  // ── Viewport Navigation & Rulers ──
  applyViewportTransform() {
    const wrapper = document.getElementById('canvas-wrapper');
    wrapper.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;

    const zoomEl = document.getElementById('status-zoom');
    if (zoomEl) zoomEl.textContent = `${Math.round(this.zoom * 100)}%`;

    if (this.navigatorManager) {
      this.navigatorManager.updatePanBox();
    }

    this.renderRulers();
  }

  renderRulers() {
    if (!this.showRulers || !this.rulerTopCanvas || !this.rulerLeftCanvas) return;

    const viewport = document.getElementById('viewport-container');
    const vw = viewport.clientWidth;
    const vh = viewport.clientHeight;

    this.rulerTopCanvas.width = vw;
    this.rulerTopCanvas.height = 20;
    this.rulerLeftCanvas.width = 20;
    this.rulerLeftCanvas.height = vh;

    const tCtx = this.rulerTopCtx;
    const lCtx = this.rulerLeftCtx;

    tCtx.fillStyle = '#1a1a1e';
    tCtx.fillRect(0, 0, vw, 20);
    lCtx.fillStyle = '#1a1a1e';
    lCtx.fillRect(0, 0, 20, vh);

    tCtx.strokeStyle = '#3e3e46';
    tCtx.fillStyle = '#888890';
    tCtx.font = '9px Inter, sans-serif';

    lCtx.strokeStyle = '#3e3e46';
    lCtx.fillStyle = '#888890';
    lCtx.font = '9px Inter, sans-serif';

    // Canvas center offset in viewport
    const originX = (vw / 2) + this.panX - (this.width * this.zoom / 2);
    const originY = (vh / 2) + this.panY - (this.height * this.zoom / 2);

    // Step size based on zoom
    let step = 100;
    if (this.zoom > 2) step = 20;
    else if (this.zoom > 0.8) step = 50;
    else if (this.zoom < 0.25) step = 500;
    else if (this.zoom < 0.5) step = 200;

    // Top horizontal ruler ticks
    for (let docX = -2000; docX <= this.width + 2000; docX += step) {
      const screenX = originX + (docX * this.zoom);
      if (screenX >= 0 && screenX <= vw) {
        tCtx.beginPath();
        tCtx.moveTo(screenX, 10);
        tCtx.lineTo(screenX, 20);
        tCtx.stroke();
        tCtx.fillText(docX.toString(), screenX + 2, 9);
      }
    }

    // Left vertical ruler ticks
    for (let docY = -2000; docY <= this.height + 2000; docY += step) {
      const screenY = originY + (docY * this.zoom);
      if (screenY >= 0 && screenY <= vh) {
        lCtx.beginPath();
        lCtx.moveTo(10, screenY);
        lCtx.lineTo(20, screenY);
        lCtx.stroke();
        lCtx.save();
        lCtx.translate(9, screenY - 2);
        lCtx.rotate(-Math.PI / 2);
        lCtx.fillText(docY.toString(), 0, 0);
        lCtx.restore();
      }
    }
  }

  toggleRulers() {
    this.showRulers = !this.showRulers;
    const wrapper = document.getElementById('workspace-wrapper');
    if (this.showRulers) {
      wrapper.style.gridTemplateColumns = '20px 1fr';
      wrapper.style.gridTemplateRows = '20px 1fr';
      this.renderRulers();
    } else {
      wrapper.style.gridTemplateColumns = '0px 1fr';
      wrapper.style.gridTemplateRows = '0px 1fr';
    }
  }

  zoomIn() {
    this.zoom = Math.min(10, this.zoom * 1.25);
    this.applyViewportTransform();
  }

  zoomOut() {
    this.zoom = Math.max(0.05, this.zoom / 1.25);
    this.applyViewportTransform();
  }

  zoom100() {
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
    this.applyViewportTransform();
  }

  zoomFit() {
    const viewport = document.getElementById('viewport-container');
    const vw = viewport.clientWidth - 80;
    const vh = viewport.clientHeight - 80;

    const scaleW = vw / this.width;
    const scaleH = vh / this.height;
    this.zoom = Math.min(scaleW, scaleH, 1.5);
    this.panX = 0;
    this.panY = 0;
    this.applyViewportTransform();
  }

  zoomAt(clientX, clientY, factor) {
    const viewport = document.getElementById('viewport-container');
    const vRect = viewport.getBoundingClientRect();
    const vx = clientX - vRect.left;
    const vy = clientY - vRect.top;

    const oldZoom = this.zoom;
    const newZoom = Math.min(10, Math.max(0.05, oldZoom * factor));

    this.panX = vx - (vx - this.panX) * (newZoom / oldZoom);
    this.panY = vy - (vy - this.panY) * (newZoom / oldZoom);
    this.zoom = newZoom;
    this.applyViewportTransform();
  }

  bindZoomAndPan() {
    const viewport = document.getElementById('viewport-container');

    viewport.addEventListener('wheel', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.2 : 0.833;
        this.zoomAt(e.clientX, e.clientY, factor);
      } else {
        this.panX -= e.deltaX;
        this.panY -= e.deltaY;
        this.applyViewportTransform();
      }
    }, { passive: false });

    document.getElementById('btn-zoom-in').addEventListener('click', () => this.zoomIn());
    document.getElementById('btn-zoom-out').addEventListener('click', () => this.zoomOut());
    document.getElementById('btn-zoom-fit').addEventListener('click', () => this.zoomFit());
    document.getElementById('btn-zoom-100').addEventListener('click', () => this.zoom100());
  }

  // ── Project File Operations (.pforge) ──
  async saveProjectFile() {
    return await this.promptSaveProjectAs('pforge');
  }

  downloadBlob(content, defaultName, mimeType = 'application/json') {
    const blob = new Blob([content], { type: mimeType });
    const link = document.createElement('a');
    link.download = defaultName;
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
  }

  async promptSaveProjectAs(defaultFormat = 'pforge') {
    const projectData = this.layerManager.exportProjectData();
    const content = JSON.stringify(projectData, null, 2);
    const baseName = this.documentName ? this.documentName.replace(/\.[^.]+$/, '') : 'Untitled Project';
    const defaultName = `${baseName}.${defaultFormat}`;

    let savedPath = null;
    let savedFilename = defaultName;

    if (this.ipc) {
      savedPath = await this.ipc.invoke('dialog:saveFile', {
        content,
        defaultName,
        format: defaultFormat
      });

      if (!savedPath) {
        // User clicked cancel in native save dialog
        return false;
      }
      savedFilename = savedPath.split(/[\\/]/).pop();
      this.documentPath = savedPath;
      this.documentName = savedFilename.replace(/\.[^.]+$/, '');
    } else if (typeof window !== 'undefined' && window.showSaveFilePicker) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: defaultName,
          types: [{
            description: 'PixelForge Project (*.pforge)',
            accept: { 'application/json': ['.pforge'] }
          }]
        });
        const writable = await handle.createWritable();
        await writable.write(content);
        await writable.close();
        savedFilename = handle.name || defaultName;
        this.documentName = savedFilename.replace(/\.[^.]+$/, '');
      } catch (err) {
        if (err.name === 'AbortError') return false;
        // Fallback to blob download
        this.downloadBlob(content, defaultName, 'application/json');
      }
    } else {
      this.downloadBlob(content, defaultName, 'application/json');
    }

    // Generate downsampled thumbnail preview
    let thumbnail = '';
    try {
      const thumbCanvas = document.createElement('canvas');
      const maxDim = 320;
      const scale = Math.min(maxDim / this.width, (maxDim * 0.6) / this.height);
      thumbCanvas.width = Math.max(1, Math.round(this.width * scale));
      thumbCanvas.height = Math.max(1, Math.round(this.height * scale));
      const tCtx = thumbCanvas.getContext('2d');
      tCtx.drawImage(this.mainCanvas, 0, 0, thumbCanvas.width, thumbCanvas.height);
      thumbnail = thumbCanvas.toDataURL('image/jpeg', 0.85);
    } catch (e) {}

    // Add to Recent Projects Manager
    if (this.recentProjectsManager) {
      this.recentProjectsManager.addProject({
        name: savedFilename,
        filePath: savedPath || '',
        width: this.width,
        height: this.height,
        layersCount: this.layerManager.layers.length,
        thumbnail,
        timestamp: Date.now(),
        projectData
      });
    }

    this.isDirty = false;
    this.showToast(`Saved project: ${savedFilename}`);
    return true;
  }

  recordOpenedProjectToRecents(name, filePath = '', projectData = null) {
    if (!this.recentProjectsManager) return;
    let thumbnail = '';
    try {
      const thumbCanvas = document.createElement('canvas');
      const maxDim = 320;
      const scale = Math.min(maxDim / this.width, (maxDim * 0.6) / this.height);
      thumbCanvas.width = Math.max(1, Math.round(this.width * scale));
      thumbCanvas.height = Math.max(1, Math.round(this.height * scale));
      const tCtx = thumbCanvas.getContext('2d');
      tCtx.drawImage(this.mainCanvas, 0, 0, thumbCanvas.width, thumbCanvas.height);
      thumbnail = thumbCanvas.toDataURL('image/jpeg', 0.85);
    } catch (e) {}

    this.recentProjectsManager.addProject({
      name,
      filePath: filePath || '',
      width: this.width,
      height: this.height,
      layersCount: this.layerManager?.layers?.length || 1,
      thumbnail,
      timestamp: Date.now(),
      projectData
    });
  }

  requestCloseDocument(targetAction = 'close') {
    // Check if document has unsaved edits
    const hasUnsavedChanges = this.isDirty && (this.historyManager && this.historyManager.steps.length > 1);

    if (!hasUnsavedChanges) {
      this.executeCloseTarget(targetAction);
      return;
    }

    // Unsaved changes detected! Show Photoshop-parity Save Prompt Modal
    const modal = document.getElementById('modal-save-prompt');
    if (!modal) {
      this.executeCloseTarget(targetAction);
      return;
    }

    const titleEl = document.getElementById('save-prompt-title');
    const descEl = document.getElementById('save-prompt-desc');
    const name = this.documentName || 'Untitled Project';

    if (titleEl) {
      titleEl.textContent = `Save changes to "${name}" before closing?`;
    }
    if (descEl) {
      descEl.textContent = `Do you want to save changes to the document before closing? The project will be saved in PixelForge format (.pforge) with prompt to choose location so all layers and history are preserved.`;
    }

    modal.classList.remove('hidden');

    const btnSave = document.getElementById('btn-save-prompt-save');
    const btnDontSave = document.getElementById('btn-save-prompt-dont-save');
    const btnCancel = document.getElementById('btn-save-prompt-cancel');
    const btnX = document.getElementById('btn-save-prompt-x');

    const freshBtnSave = btnSave.cloneNode(true);
    const freshBtnDontSave = btnDontSave.cloneNode(true);
    const freshBtnCancel = btnCancel.cloneNode(true);
    btnSave.replaceWith(freshBtnSave);
    btnDontSave.replaceWith(freshBtnDontSave);
    btnCancel.replaceWith(freshBtnCancel);
    let freshBtnX = null;
    if (btnX) {
      freshBtnX = btnX.cloneNode(true);
      btnX.replaceWith(freshBtnX);
    }

    freshBtnSave.addEventListener('click', async () => {
      modal.classList.add('hidden');
      const saved = await this.promptSaveProjectAs('pforge');
      if (saved) {
        this.executeCloseTarget(targetAction);
      }
    });

    freshBtnDontSave.addEventListener('click', () => {
      this.isDirty = false;
      modal.classList.add('hidden');
      this.executeCloseTarget(targetAction);
    });

    const onCancel = () => {
      modal.classList.add('hidden');
    };

    freshBtnCancel.addEventListener('click', onCancel);
    if (freshBtnX) freshBtnX.addEventListener('click', onCancel);
  }

  executeCloseTarget(targetAction) {
    if (targetAction === 'exit') {
      if (this.ipc) {
        this.ipc.send('app:force-close');
      } else {
        window.close();
      }
    } else if (targetAction === 'close' || targetAction === 'home') {
      this.showWelcomeOverlay();
    }
  }

  openProjectFile() {
    const input = document.getElementById('browser-project-input');
    input.value = '';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target.result);
          this.documentName = file.name.replace(/\.[^.]+$/, '');
          this.documentPath = file.path || '';
          this.loadProjectFromData(data);
          this.recordOpenedProjectToRecents(file.name, file.path || '', data);
        } catch (err) {
          alert("Error parsing project file: " + err.message);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  loadProjectFromData(data) {
    this.width = data.width;
    this.height = data.height;

    [this.bgCanvas, this.mainCanvas, this.overlayCanvas].forEach(c => {
      c.width = data.width;
      c.height = data.height;
    });

    const wrapper = document.getElementById('canvas-wrapper');
    wrapper.style.width = data.width + 'px';
    wrapper.style.height = data.height + 'px';

    Utils.renderCheckerboard(this.bgCtx, data.width, data.height);

    this.layerManager.importProjectData(data).then(() => {
      this.historyManager.clear();
      this.pushHistoryState('Open Project');
      this.isDirty = false;
      this.renderComposite();
      this.updateStatusInfo();
      this.hideWelcomeOverlay();
      this.zoomFit();
    });
  }

  // ── Photoshop (.psd) & Standard File Operations ──
  async openPsdDialog() {
    if (this.ipc) {
      const res = await this.ipc.invoke('dialog:openFile');
      if (res) {
        if (res.rawBuffer) {
          this.loadProjectFromPsd(res.rawBuffer, res.filename);
        } else if (res.dataUrl) {
          const b64 = res.dataUrl.split(',')[1];
          const bin = atob(b64);
          const u8 = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
          this.loadProjectFromPsd(u8.buffer, res.filename);
        }
      }
    } else {
      const psdInput = document.getElementById('browser-psd-input');
      if (psdInput) {
        psdInput.value = '';
        psdInput.click();
      }
    }
  }

  async openImageFile() {
    if (this.ipc) {
      const res = await this.ipc.invoke('dialog:openFile');
      if (res) {
        if (res.ext === 'psd' || res.filename.toLowerCase().endsWith('.psd')) {
          if (res.rawBuffer) {
            this.loadProjectFromPsd(res.rawBuffer, res.filename);
          } else if (res.dataUrl) {
            const b64 = res.dataUrl.split(',')[1];
            const bin = atob(b64);
            const u8 = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
            this.loadProjectFromPsd(u8.buffer, res.filename);
          }
          return;
        }
        if (res.ext === 'pforge' || res.filename.toLowerCase().endsWith('.pforge')) {
          const content = atob(res.dataUrl.split(',')[1]);
          this.loadProjectFromData(JSON.parse(content));
          return;
        }
        if (res.dataUrl) {
          this.loadImageFromDataUrl(res.dataUrl, res.filename);
        }
      }
    } else {
      const fileInput = document.getElementById('browser-file-input');
      fileInput.value = '';
      fileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.name.toLowerCase().endsWith('.psd')) {
          const reader = new FileReader();
          reader.onload = (ev) => {
            this.loadProjectFromPsd(ev.target.result, file.name);
          };
          reader.readAsArrayBuffer(file);
          return;
        }
        if (file.name.toLowerCase().endsWith('.pforge')) {
          const reader = new FileReader();
          reader.onload = (ev) => {
            try {
              this.loadProjectFromData(JSON.parse(ev.target.result));
            } catch (err) {
              alert("Error parsing project file: " + err.message);
            }
          };
          reader.readAsText(file);
          return;
        }
        const reader = new FileReader();
        reader.onload = (ev) => {
          this.loadImageFromDataUrl(ev.target.result, file.name);
        };
        reader.readAsDataURL(file);
      };
      fileInput.click();
    }
  }

  loadProjectFromPsd(buffer, filename = 'Photoshop Document') {
    try {
      const parsed = PsdEngine.PsdReader.parse(buffer);
      if (!parsed || parsed.width <= 0 || parsed.height <= 0) {
        throw new Error('Invalid PSD document dimensions');
      }

      this.width = parsed.width;
      this.height = parsed.height;

      [this.bgCanvas, this.mainCanvas, this.overlayCanvas].forEach(c => {
        c.width = parsed.width;
        c.height = parsed.height;
      });

      const wrapper = document.getElementById('canvas-wrapper');
      if (wrapper) {
        wrapper.style.width = parsed.width + 'px';
        wrapper.style.height = parsed.height + 'px';
      }

      Utils.renderCheckerboard(this.bgCtx, parsed.width, parsed.height);

      this.layerManager.width = parsed.width;
      this.layerManager.height = parsed.height;
      this.layerManager.layers = [];

      if (parsed.layers && parsed.layers.length > 0) {
        parsed.layers.forEach((lData, idx) => {
          if (lData.isGroup) {
            const group = this.layerManager.createLayerObject(lData.name || `Group ${idx + 1}`, 'group', {
              collapsed: !!lData.groupCollapsed
            });
            group.opacity = lData.opacity ?? 100;
            group.blendMode = lData.blendMode || 'source-over';
            group.visible = lData.visible !== false;
            this.layerManager.layers.push(group);
            return;
          }

          const layer = this.layerManager.createLayerObject(lData.name || `Layer ${idx + 1}`, 'raster');
          layer.opacity = lData.opacity ?? 100;
          layer.blendMode = lData.blendMode || 'source-over';
          layer.visible = lData.visible !== false;
          layer.isClipped = !!lData.clipping;

          if (lData.rgbaData && lData.width > 0 && lData.height > 0) {
            const tCan = Utils.createCanvas(lData.width, lData.height);
            const tCtx = tCan.getContext('2d');
            const imgData = tCtx.createImageData(lData.width, lData.height);
            imgData.data.set(lData.rgbaData);
            tCtx.putImageData(imgData, 0, 0);

            layer.ctx.drawImage(tCan, lData.left, lData.top);
          }

          if (lData.hasMask && lData.maskData && lData.width > 0 && lData.height > 0) {
            layer.hasMask = true;
            layer.maskCanvas = Utils.createCanvas(parsed.width, parsed.height);
            layer.maskCtx = layer.maskCanvas.getContext('2d');
            layer.maskCtx.fillStyle = '#ffffff';
            layer.maskCtx.fillRect(0, 0, parsed.width, parsed.height);

            const mCan = Utils.createCanvas(lData.width, lData.height);
            const mCtx = mCan.getContext('2d');
            const mImgData = mCtx.createImageData(lData.width, lData.height);
            const mData = mImgData.data;
            for (let p = 0; p < lData.maskData.length; p++) {
              const lum = lData.maskData[p];
              const pIdx = p * 4;
              mData[pIdx] = lum;
              mData[pIdx + 1] = lum;
              mData[pIdx + 2] = lum;
              mData[pIdx + 3] = 255;
            }
            mCtx.putImageData(mImgData, 0, 0);
            layer.maskCtx.drawImage(mCan, lData.left, lData.top);
          }

          this.layerManager.layers.push(layer);
        });
      } else if (parsed.compositeRgba) {
        const layer = this.layerManager.createLayerObject('Background', 'raster');
        const imgData = layer.ctx.createImageData(parsed.width, parsed.height);
        imgData.data.set(parsed.compositeRgba);
        layer.ctx.putImageData(imgData, 0, 0);
        this.layerManager.layers.push(layer);
      } else {
        this.layerManager.addLayer('Layer 1', '#ffffff');
      }

      const activeLayer = this.layerManager.layers[this.layerManager.layers.length - 1];
      if (activeLayer) {
        this.layerManager.setActiveLayer(activeLayer.id);
      }

      this.historyManager.clear();
      this.pushHistoryState('Open PSD: ' + filename);
      this.documentName = filename.replace(/\.[^.]+$/, '');
      this.isDirty = false;
      this.renderComposite();
      this.layerManager.renderLayerStackUI();
      this.recordOpenedProjectToRecents(filename);
      this.updateStatusInfo();
      this.hideWelcomeOverlay();
      this.zoomFit();
      this.renderRulers();
    } catch (err) {
      console.error('Failed to parse PSD:', err);
      alert('Error opening PSD: ' + err.message);
    }
  }

  async savePsdFile(defaultName = 'Project.psd') {
    try {
      const psdBytes = PsdEngine.PsdWriter.write({
        width: this.width,
        height: this.height,
        layers: this.layerManager.layers
      });

      if (this.ipc) {
        let binaryStr = '';
        const chunkSz = 32768;
        for (let i = 0; i < psdBytes.length; i += chunkSz) {
          const chunk = psdBytes.subarray(i, i + chunkSz);
          binaryStr += String.fromCharCode.apply(null, chunk);
        }
        const rawBase64 = btoa(binaryStr);

        const savedPath = await this.ipc.invoke('dialog:saveFile', {
          rawBase64,
          defaultName,
          format: 'psd'
        });
        if (savedPath) {
          const fname = savedPath.split(/[\\/]/).pop();
          this.recordOpenedProjectToRecents(fname, savedPath);
          this.isDirty = false;
          this.showToast(`Saved PSD: ${fname}`);
        }
      } else {
        const blob = new Blob([psdBytes], { type: 'image/vnd.adobe.photoshop' });
        const link = document.createElement('a');
        link.download = defaultName.endsWith('.psd') ? defaultName : `${defaultName}.psd`;
        link.href = URL.createObjectURL(blob);
        link.click();
        URL.revokeObjectURL(link.href);
        this.recordOpenedProjectToRecents(defaultName);
        this.isDirty = false;
      }
    } catch (err) {
      console.error('Failed to write PSD:', err);
      alert('Error exporting PSD: ' + err.message);
    }
  }

  async exportSvgFile(defaultName = 'Vector_Export.svg') {
    try {
      const svgStr = PsdEngine.SvgExporter.exportSvg(this.layerManager.layers, this.width, this.height);

      if (this.ipc) {
        const rawBase64 = btoa(unescape(encodeURIComponent(svgStr)));
        await this.ipc.invoke('dialog:saveFile', {
          rawBase64,
          defaultName,
          format: 'svg'
        });
      } else {
        const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
        const link = document.createElement('a');
        link.download = defaultName.endsWith('.svg') ? defaultName : `${defaultName}.svg`;
        link.href = URL.createObjectURL(blob);
        link.click();
        URL.revokeObjectURL(link.href);
      }
    } catch (err) {
      console.error('Failed to export SVG:', err);
      alert('Error exporting SVG: ' + err.message);
    }
  }

  loadImageFromDataUrl(dataUrl, filename = 'Image') {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const iw = img.naturalWidth || img.width;
        const ih = img.naturalHeight || img.height;
        if (iw > 0 && ih > 0) {
          this.createDocument(iw, ih, 'transparent');
          const active = this.layerManager.getActiveLayer();
          if (active) {
            active.name = filename;
            active.ctx.drawImage(img, 0, 0, iw, ih);
          }
          this.renderComposite();
          this.updateStatusInfo();
          this.pushHistoryState('Open: ' + filename);
          this.documentName = filename.replace(/\.[^.]+$/, '');
          this.isDirty = false;
          this.hideWelcomeOverlay();
          this.zoomFit();
        }
        resolve(true);
      };
      img.onerror = (err) => {
        console.error('Failed to load image data URL:', err);
        resolve(false);
      };
      img.src = dataUrl;
    });
  }

  async exportImage(format = 'png') {
    const exportCanvas = Utils.createCanvas(this.width, this.height);
    const eCtx = exportCanvas.getContext('2d');
    this.layerManager.compositeTo(eCtx);

    let mime = 'image/png';
    let quality = 0.95;
    if (format === 'jpg' || format === 'jpeg') {
      mime = 'image/jpeg';
      quality = 0.92;
    } else if (format === 'webp') {
      mime = 'image/webp';
      quality = 0.92;
    }

    let dataUrl = exportCanvas.toDataURL(mime, quality);

    // Embed ICC profile if enabled and format is PNG
    if (format === 'png' && (this.embedIccProfile !== false) && typeof IccEmbedder !== 'undefined' && typeof ColorSpaceManager !== 'undefined') {
      try {
        const binStr = atob(dataUrl.split(',')[1]);
        const bytes = new Uint8Array(binStr.length);
        for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
        const profileName = this.activeColorProfile || 'sRGB';
        const profileBytes = ColorSpaceManager.generateStandardProfile(profileName);
        const taggedPng = IccEmbedder.embedIccInPng(bytes, profileBytes, profileName);
        const blob = new Blob([taggedPng], { type: 'image/png' });
        dataUrl = URL.createObjectURL(blob);
      } catch (err) {
        console.warn('Could not embed ICC profile in PNG export:', err);
      }
    }

    if (this.ipc) {
      await this.ipc.invoke('dialog:saveFile', {
        dataUrl,
        defaultName: `PixelForge_Export.${format}`,
        format
      });
    } else {
      const link = document.createElement('a');
      link.download = `PixelForge_Export.${format}`;
      link.href = dataUrl;
      link.click();
    }
  }

  // ── Image Transformations ──
  rotateImage(clockwise = true) {
    const newW = this.height;
    const newH = this.width;

    this.layerManager.layers.forEach(layer => {
      const temp = Utils.createCanvas(newW, newH);
      const tCtx = temp.getContext('2d');
      tCtx.translate(newW / 2, newH / 2);
      tCtx.rotate(clockwise ? Math.PI / 2 : -Math.PI / 2);
      tCtx.drawImage(layer.canvas, -this.width / 2, -this.height / 2);

      layer.canvas.width = newW;
      layer.canvas.height = newH;
      layer.ctx.drawImage(temp, 0, 0);

      if (layer.hasMask && layer.maskCanvas) {
        const mTemp = Utils.createCanvas(newW, newH);
        const mTCtx = mTemp.getContext('2d');
        mTCtx.translate(newW / 2, newH / 2);
        mTCtx.rotate(clockwise ? Math.PI / 2 : -Math.PI / 2);
        mTCtx.drawImage(layer.maskCanvas, -this.width / 2, -this.height / 2);

        layer.maskCanvas.width = newW;
        layer.maskCanvas.height = newH;
        layer.maskCtx.drawImage(mTemp, 0, 0);
      }
    });

    this.width = newW;
    this.height = newH;
    this.layerManager.width = newW;
    this.layerManager.height = newH;

    [this.bgCanvas, this.mainCanvas, this.overlayCanvas].forEach(c => {
      c.width = newW;
      c.height = newH;
    });

    const wrapper = document.getElementById('canvas-wrapper');
    wrapper.style.width = newW + 'px';
    wrapper.style.height = newH + 'px';

    Utils.renderCheckerboard(this.bgCtx, newW, newH);
    this.renderComposite();
    this.updateStatusInfo();
    this.pushHistoryState('Rotate ' + (clockwise ? '90° CW' : '90° CCW'));
    this.renderRulers();
  }

  flipImage(horizontal = true) {
    const active = this.layerManager.getActiveLayer();
    if (!active) return;

    const temp = Utils.createCanvas(this.width, this.height);
    const tCtx = temp.getContext('2d');
    tCtx.translate(horizontal ? this.width : 0, horizontal ? 0 : this.height);
    tCtx.scale(horizontal ? -1 : 1, horizontal ? 1 : -1);
    tCtx.drawImage(active.canvas, 0, 0);

    active.ctx.clearRect(0, 0, this.width, this.height);
    active.ctx.drawImage(temp, 0, 0);

    this.renderComposite();
    this.pushHistoryState('Flip ' + (horizontal ? 'Horizontal' : 'Vertical'));
  }

  cropToRect(x, y, w, h, mode = 'canvas', deletePixels = true) {
    if (mode === 'canvas') {
      this.layerManager.layers.forEach(layer => {
        const cropped = layer.ctx.getImageData(x, y, w, h);
        layer.canvas.width = w;
        layer.canvas.height = h;
        layer.ctx.putImageData(cropped, 0, 0);

        if (layer.hasMask && layer.maskCanvas) {
          const mCropped = layer.maskCtx.getImageData(x, y, w, h);
          layer.maskCanvas.width = w;
          layer.maskCanvas.height = h;
          layer.maskCtx.putImageData(mCropped, 0, 0);
        }
      });

      this.width = w;
      this.height = h;
      this.layerManager.width = w;
      this.layerManager.height = h;

      [this.bgCanvas, this.mainCanvas, this.overlayCanvas].forEach(c => {
        c.width = w;
        c.height = h;
      });

      const wrapper = document.getElementById('canvas-wrapper');
      if (wrapper) {
        wrapper.style.width = w + 'px';
        wrapper.style.height = h + 'px';
      }

      if (typeof Utils !== 'undefined' && Utils.renderCheckerboard) {
        Utils.renderCheckerboard(this.bgCtx, w, h);
      }
      this.renderComposite();
      this.updateStatusInfo();
      this.pushHistoryState('Crop Document');
      this.renderRulers();
      this.showToast(`Cropped Document Canvas to ${w} × ${h}`);
    } else {
      // mode === 'active-layer' or 'selected-layers' or layer-specific
      const targetLayers = (mode === 'selected-layers')
        ? this.layerManager.getSelectedLayers()
        : [this.layerManager.getActiveLayer()].filter(Boolean);

      if (!targetLayers.length) return;

      targetLayers.forEach(layer => {
        this.cropLayerToRect(layer, x, y, w, h, deletePixels);
      });

      this.renderComposite();
      this.layerManager.renderLayerStackUI();
      const desc = targetLayers.length > 1 ? `Crop ${targetLayers.length} Layers` : `Crop Layer: ${targetLayers[0].name}`;
      this.pushHistoryState(desc);
      this.showToast(desc);
    }
  }

  cropLayerToRect(layer, x, y, w, h, deletePixels = true) {
    if (!layer || !layer.ctx || w <= 0 || h <= 0) return;
    const safeX = Math.max(0, Math.min(this.width - 1, Math.round(x)));
    const safeY = Math.max(0, Math.min(this.height - 1, Math.round(y)));
    const safeW = Math.max(1, Math.min(this.width - safeX, Math.round(w)));
    const safeH = Math.max(1, Math.min(this.height - safeY, Math.round(h)));

    const cropped = layer.ctx.getImageData(safeX, safeY, safeW, safeH);
    layer.ctx.clearRect(0, 0, this.width, this.height);
    layer.ctx.putImageData(cropped, safeX, safeY);

    if (layer.hasMask && layer.maskCanvas) {
      const mCropped = layer.maskCtx.getImageData(safeX, safeY, safeW, safeH);
      layer.maskCtx.clearRect(0, 0, this.width, this.height);
      layer.maskCtx.putImageData(mCropped, safeX, safeY);
    }
  }

  // ── Curves & Levels Modal Controller ──
  bindCurvesModal() {
    const graphCanvas = document.getElementById('curves-graph-canvas');
    const histCanvas = document.getElementById('curves-hist-canvas');
    if (!graphCanvas || !histCanvas) return;

    const gCtx = graphCanvas.getContext('2d');
    const hCtx = histCanvas.getContext('2d');

    const redrawCurveUI = () => {
      // Clear graph
      gCtx.clearRect(0, 0, 256, 256);

      // Grid lines
      gCtx.strokeStyle = '#2d2d33';
      gCtx.lineWidth = 1;
      for (let i = 64; i < 256; i += 64) {
        gCtx.beginPath();
        gCtx.moveTo(i, 0); gCtx.lineTo(i, 256);
        gCtx.moveTo(0, i); gCtx.lineTo(256, i);
        gCtx.stroke();
      }

      // Draw curve line
      gCtx.strokeStyle = '#3b82f6';
      gCtx.lineWidth = 2;
      gCtx.beginPath();
      this.curvesPoints.forEach((p, idx) => {
        const canvasY = 255 - p.y;
        if (idx === 0) gCtx.moveTo(p.x, canvasY);
        else gCtx.lineTo(p.x, canvasY);
      });
      gCtx.stroke();

      // Draw anchor points
      this.curvesPoints.forEach(p => {
        const canvasY = 255 - p.y;
        gCtx.fillStyle = '#ffffff';
        gCtx.beginPath();
        gCtx.arc(p.x, canvasY, 5, 0, Math.PI * 2);
        gCtx.fill();
        gCtx.strokeStyle = '#2563eb';
        gCtx.lineWidth = 1.5;
        gCtx.stroke();
      });
    };

    // Preset selector
    const presetSel = document.getElementById('curves-preset');
    presetSel.addEventListener('change', () => {
      const mode = presetSel.value;
      if (mode === 'linear') {
        this.curvesPoints = [{ x: 0, y: 0 }, { x: 128, y: 128 }, { x: 255, y: 255 }];
      } else if (mode === 'contrast-s') {
        this.curvesPoints = [{ x: 0, y: 0 }, { x: 64, y: 35 }, { x: 192, y: 220 }, { x: 255, y: 255 }];
      } else if (mode === 'brighten') {
        this.curvesPoints = [{ x: 0, y: 0 }, { x: 128, y: 165 }, { x: 255, y: 255 }];
      } else if (mode === 'deep-shadows') {
        this.curvesPoints = [{ x: 0, y: 0 }, { x: 80, y: 40 }, { x: 255, y: 255 }];
      } else if (mode === 'vintage-matte') {
        this.curvesPoints = [{ x: 0, y: 35 }, { x: 128, y: 128 }, { x: 255, y: 225 }];
      } else if (mode === 'invert') {
        this.curvesPoints = [{ x: 0, y: 255 }, { x: 255, y: 0 }];
      }
      redrawCurveUI();
    });

    // Sliders
    const blackSlider = document.getElementById('levels-black');
    const whiteSlider = document.getElementById('levels-white');
    const gammaSlider = document.getElementById('levels-gamma');

    blackSlider.addEventListener('input', () => document.getElementById('val-levels-black').textContent = blackSlider.value);
    whiteSlider.addEventListener('input', () => document.getElementById('val-levels-white').textContent = whiteSlider.value);
    gammaSlider.addEventListener('input', () => document.getElementById('val-levels-gamma').textContent = (gammaSlider.value / 100).toFixed(1));

    // Dragging points on curve graph
    let isDragging = false;
    graphCanvas.addEventListener('mousedown', (e) => {
      const rect = graphCanvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = 255 - (e.clientY - rect.top);

      const hit = this.curvesPoints.findIndex(p => Math.hypot(p.x - mx, p.y - my) <= 12);
      if (hit !== -1) {
        this.activeCurvePointIdx = hit;
        isDragging = true;
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging || this.activeCurvePointIdx === -1) return;
      const rect = graphCanvas.getBoundingClientRect();
      const mx = Utils.clamp(Math.round(e.clientX - rect.left), 0, 255);
      const my = Utils.clamp(Math.round(255 - (e.clientY - rect.top)), 0, 255);

      this.curvesPoints[this.activeCurvePointIdx] = { x: mx, y: my };
      this.curvesPoints.sort((a, b) => a.x - b.x);
      redrawCurveUI();
    });

    window.addEventListener('mouseup', () => { isDragging = false; });

    // Apply button
    document.getElementById('btn-apply-curves').addEventListener('click', () => {
      const active = this.layerManager.getActiveLayer();
      if (!active) return;

      const black = parseInt(blackSlider.value, 10) || 0;
      const white = parseInt(whiteSlider.value, 10) || 255;
      const gamma = (parseInt(gammaSlider.value, 10) || 100) / 100;

      // Construct LUT from curves points
      const lut = new Uint8Array(256);
      for (let i = 0; i < 256; i++) {
        // Find segment
        let y = i;
        for (let j = 0; j < this.curvesPoints.length - 1; j++) {
          const p1 = this.curvesPoints[j];
          const p2 = this.curvesPoints[j + 1];
          if (i >= p1.x && i <= p2.x) {
            const t = (i - p1.x) / Math.max(1, p2.x - p1.x);
            y = Math.round(Utils.lerp(p1.y, p2.y, t));
            break;
          }
        }
        lut[i] = Utils.clamp(y, 0, 255);
      }

      const imgData = active.ctx.getImageData(0, 0, this.width, this.height);
      const output = Utils.applyLevelsAndCurve(imgData, black, white, gamma, lut);
      active.ctx.putImageData(output, 0, 0);

      this.renderComposite();
      this.pushHistoryState('Curves & Levels');
      this.hideModal('modal-curves');
    });

    this.renderCurvesModal = () => {
      const active = this.layerManager.getActiveLayer();
      if (!active) return;

      // Draw Histogram
      const imgData = active.ctx.getImageData(0, 0, this.width, this.height);
      const hist = Utils.computeHistogram(imgData);

      hCtx.clearRect(0, 0, 256, 256);
      hCtx.fillStyle = '#60a5fa';

      for (let i = 0; i < 256; i++) {
        const barH = (hist.lum[i] / hist.max) * 256;
        hCtx.fillRect(i, 256 - barH, 1, barH);
      }

      redrawCurveUI();
    };
  }

  // ── Menu Bar Action Dispatcher ──
  bindMenuBar() {
    let isMenuLocked = false;
    const menuItems = document.querySelectorAll('.menu-item');

    const closeAllMenus = () => {
      isMenuLocked = false;
      menuItems.forEach(item => item.classList.remove('menu-open'));
    };

    menuItems.forEach(item => {
      // Click top-level menu label (File, Edit, etc.) to toggle lock open
      item.addEventListener('click', (e) => {
        // If clicked on an action inside the dropdown, don't toggle
        if (e.target.closest('.menu-row')) return;

        e.stopPropagation();
        const wasOpen = item.classList.contains('menu-open');
        closeAllMenus();
        if (!wasOpen) {
          item.classList.add('menu-open');
          isMenuLocked = true;
        }
      });

      // When a menu is already locked open, hovering switches to other menus
      item.addEventListener('mouseenter', () => {
        if (isMenuLocked) {
          menuItems.forEach(m => m.classList.remove('menu-open'));
          item.classList.add('menu-open');
        }
      });
    });

    // Handle clicking actions inside the dropdown
    document.querySelectorAll('.menu-row').forEach(row => {
      row.addEventListener('click', (e) => {
        e.stopPropagation();
        closeAllMenus();
        const action = row.dataset.action;
        if (!action) return;
        this.handleMenuAction(action);
      });
    });

    // Clicking anywhere outside closes menu
    window.addEventListener('click', () => {
      closeAllMenus();
    });

    // Escape closes open menu
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeAllMenus();
    });

    document.getElementById('btn-quick-new').addEventListener('click', () => {
      this.showModal('modal-new-canvas');
    });

    document.getElementById('btn-quick-open').addEventListener('click', () => {
      this.openImageFile();
    });

    document.getElementById('btn-quick-export').addEventListener('click', () => {
      this.exportImage('png');
    });
  }

  handleMenuAction(action) {
    const active = this.layerManager.getActiveLayer();

    switch (action) {
      // File
      case 'new-file':
        this.showModal('modal-new-canvas');
        break;
      case 'open-file':
        this.openImageFile();
        break;
      case 'open-psd':
        this.openPsdDialog();
        break;
      case 'save-psd':
        this.savePsdFile();
        break;
      case 'save-project':
        this.saveProjectFile();
        break;
      case 'open-project':
        this.openProjectFile();
        break;
      case 'place-embedded':
        document.getElementById('browser-place-embedded-input')?.click();
        break;
      case 'place-linked':
        document.getElementById('browser-place-linked-input')?.click();
        break;
      case 'export-dialog':
        this.openProExportModal();
        break;
      case 'export-screens':
        this.openScreensExportModal();
        break;
      case 'export-tiff':
        this.exportTiffFile();
        break;
      case 'export-pdf':
        this.exportPdfFile();
        break;
      case 'batch-process':
        this.openBatchProcessModal();
        break;
      case 'open-hdr-file':
        document.getElementById('browser-hdr-input')?.click();
        break;
      case 'export-hdr-file':
        this.exportHdrFile();
        break;
      case 'export-video':
        this.openVideoExportModal();
        break;
      case 'export-lut-cube':
        this.openLutBakerModal();
        break;
      case 'load-custom-font':
        document.getElementById('browser-font-input')?.click();
        break;
      case 'export-webp':
        this.exportImage('webp');
        break;
      case 'export-svg':
        this.exportSvgFile();
        break;
      case 'save-file':
      case 'export-png':
        this.exportImage('png');
        break;
      case 'export-jpg':
        this.exportImage('jpg');
        break;
      case 'home-screen':
        if (this.isDirty && this.historyManager && this.historyManager.steps.length > 1) {
          this.requestCloseDocument('home');
        } else {
          this.showWelcomeOverlay();
        }
        break;
      case 'close-project':
        this.requestCloseDocument('close');
        break;
      case 'exit-app':
        this.requestCloseDocument('exit');
        break;

      // Edit
      case 'undo':
        const undoState = this.historyManager.undo();
        if (undoState) this.restoreState(undoState);
        break;
      case 'redo':
        const redoState = this.historyManager.redo();
        if (redoState) this.restoreState(redoState);
        break;
      case 'free-transform':
        this.toolManager.startFreeTransform();
        break;
      case 'transform-perspective':
        this.startPerspectiveTransform();
        break;
      case 'transform-warp':
        this.startMeshWarp();
        break;
      case 'transform-split-warp':
        this.startSplitWarp();
        break;
      case 'transform-puppet-warp':
        this.startPuppetWarp();
        break;
      case 'define-pattern':
        this.openDefinePatternModal();
        break;
      case 'cut':
        this.cutSelection();
        break;
      case 'copy':
        this.copySelection();
        break;
      case 'paste':
        this.pasteClipboard();
        break;
      case 'clear-layer':
        if (active) {
          const drawCtx = this.layerManager.getActiveDrawCtx();
          if (drawCtx) {
            if (this.toolManager.selection) {
              const s = this.toolManager.selection;
              if (s.mask) {
                const imgData = drawCtx.getImageData(0, 0, this.width, this.height);
                const d = imgData.data;
                const endY = Math.min(this.height, s.y + s.h);
                const endX = Math.min(this.width, s.x + s.w);
                for (let y = Math.max(0, s.y); y < endY; y++) {
                  for (let x = Math.max(0, s.x); x < endX; x++) {
                    if (s.mask[y * this.width + x]) {
                      d[(y * this.width + x) * 4 + 3] = 0;
                    }
                  }
                }
                drawCtx.putImageData(imgData, 0, 0);
              } else {
                drawCtx.save();
                drawCtx.beginPath();
                if (s.type === 'ellipse') {
                  drawCtx.ellipse(s.x + s.w / 2, s.y + s.h / 2, s.w / 2, s.h / 2, 0, 0, Math.PI * 2);
                } else {
                  drawCtx.rect(s.x, s.y, s.w, s.h);
                }
                drawCtx.clip();
                drawCtx.clearRect(s.x - 2, s.y - 2, s.w + 4, s.h + 4);
                drawCtx.restore();
              }
            } else {
              drawCtx.clearRect(0, 0, this.width, this.height);
            }
            this.renderComposite();
            this.pushHistoryState('Clear');
          }
        }
        break;
      case 'select-all':
        this.toolManager.selection = { type: 'rect', x: 0, y: 0, w: this.width, h: this.height };
        if (this.toolManager.renderMarchingAnts) this.toolManager.renderMarchingAnts();
        break;
      case 'deselect':
        this.toolManager.clearSelection();
        break;
      case 'invert-selection':
        if (this.toolManager && this.toolManager.invertSelection) {
          this.toolManager.invertSelection();
        }
        break;
      case 'content-aware-fill':
        if (this.toolManager && this.toolManager.selection) {
          this.showModal('modal-content-aware-fill');
        } else {
          alert('Please create a selection first to use Content-Aware Fill.');
        }
        break;
      case 'generative-fill':
        this.openGenerativeFillModal();
        break;
      case 'color-range-selection':
        this.openColorRangeModal();
        break;
      case 'select-subject':
        if (this.toolManager && this.toolManager.selectSubject) {
          this.toolManager.selectSubject();
        }
        break;
      case 'select-object-tool':
        if (this.toolManager && this.toolManager.setTool) {
          this.toolManager.setTool('select-object');
        }
        break;
      case 'refine-edge':
        this.openRefineEdgeModal();
        break;
      case 'open-keyboard-shortcuts':
        this.openKeyboardShortcutsModal();
        break;
      case 'open-toolbar-customizer':
        if (this.toolbarCustomizer) {
          this.toolbarCustomizer.openModal();
        }
        break;

      // Image
      case 'filter-curves':
        if (this.renderCurvesModal) this.renderCurvesModal();
        this.showModal('modal-curves');
        break;
      case 'resize-canvas':
        this.showModal('modal-resize-canvas');
        break;
      case 'rotate-cw':
        this.rotateImage(true);
        break;
      case 'rotate-ccw':
        this.rotateImage(false);
        break;
      case 'flip-horizontal':
        this.flipImage(true);
        break;
      case 'flip-vertical':
        this.flipImage(false);
        break;
      case 'crop-to-selection':
        if (this.toolManager.selection) {
          const s = this.toolManager.selection;
          this.cropToRect(s.x, s.y, s.w, s.h);
          this.toolManager.clearSelection();
        }
        break;
      case 'assign-profile':
        this.openColorProfileModal('assign');
        break;
      case 'convert-profile':
        this.openColorProfileModal('convert');
        break;

      // Layer
      case 'new-layer':
        this.layerManager.addLayer();
        this.pushHistoryState('New Layer');
        break;
      case 'new-fill-layer':
        this.layerManager.addFillLayer(this.colorPicker.getFgHex());
        this.pushHistoryState('New Fill Layer');
        break;
      case 'duplicate-layer':
        this.layerManager.duplicateActiveLayer();
        this.pushHistoryState('Duplicate Layer');
        break;
      case 'delete-layer':
        if (this.layerManager.deleteActiveLayer()) {
          this.pushHistoryState('Delete Layer');
        }
        break;
      case 'layer-styles':
        this.openLayerStylesModal();
        break;
      case 'convert-to-smart-object':
        if (this.smartObjectManager) {
          this.smartObjectManager.convertToSmartObject();
        }
        break;
      case 'edit-smart-object':
        if (this.smartObjectManager && active) {
          this.smartObjectManager.openSmartObjectEditor(active);
        }
        break;
      case 'rasterize-smart-object':
        if (this.smartObjectManager && active) {
          this.smartObjectManager.rasterizeSmartObject(active);
        }
        break;
      case 'toggle-clipping-mask':
        this.layerManager.toggleClippingMask();
        this.pushHistoryState('Toggle Clipping Mask');
        break;
      case 'toggle-lock-alpha':
        this.layerManager.toggleLockAlpha();
        this.pushHistoryState('Toggle Lock Alpha');
        break;
      case 'toggle-lock-layer':
        this.layerManager.toggleLock();
        this.pushHistoryState('Toggle Lock Layer');
        break;
      case 'add-mask':
        this.layerManager.addLayerMask();
        this.pushHistoryState('Add Layer Mask');
        break;
      case 'apply-mask':
        this.layerManager.removeLayerMask(null, true);
        this.pushHistoryState('Apply Layer Mask');
        break;
      case 'invert-mask':
        this.layerManager.invertMask();
        this.pushHistoryState('Invert Layer Mask');
        break;
      case 'add-vector-mask':
        this.addVectorMaskToActiveLayer();
        break;
      case 'merge-down':
        if (this.layerManager.mergeDown()) {
          this.pushHistoryState('Merge Down');
        }
        break;
      case 'merge-visible':
        this.layerManager.mergeVisible();
        this.pushHistoryState('Merge Visible');
        break;
      case 'flatten-image':
        this.layerManager.flattenImage();
        this.pushHistoryState('Flatten Image');
        break;
      case 'new-artboard':
      case 'open-artboards-manager':
        this.openArtboardsModal();
        break;
      case 'toggle-isolation':
      case 'isolate-layer':
        this.toggleIsolationMode();
        break;
      case 'open-layer-comps':
        this.openLayerCompsModal();
        break;
      case 'open-assets-manager':
        this.openAssetsManagerModal();
        break;
      case 'open-paths-panel':
        this.openPathsModal();
        break;

      // Adjustments & Filters
      case 'filter-neural':
        this.openNeuralFiltersModal();
        break;
      case 'filter-camera-raw':
        this.openCameraRawDialog();
        break;
      case 'filter-liquify':
        if (this.liquifyModal) {
          this.liquifyModal.open();
        }
        break;
      case 'filter-gradient-map':
        const activeLayer = this.layerManager.getActiveLayer();
        if (!activeLayer || activeLayer.isGroup) return;
        const initialGrad = this.toolManager && this.toolManager.currentGradient 
          ? this.toolManager.currentGradient.clone() 
          : (typeof GradientData !== 'undefined' ? GradientData.getPreset('black-white') : null);
        if (this.gradientEditorModal && initialGrad) {
          this.gradientEditorModal.open(initialGrad, (chosenGrad) => {
            const ctx = activeLayer.ctx;
            const imgData = ctx.getImageData(0, 0, activeLayer.width, activeLayer.height);
            Filters.gradientMap(imgData, chosenGrad);
            ctx.putImageData(imgData, 0, 0);
            this.pushHistoryState('Filter: Gradient Map');
            this.renderComposite();
          });
        }
        break;
      case 'filter-color-balance':
        this.openAdjustmentInspector('color-balance');
        break;
      case 'filter-vibrance':
        this.openAdjustmentInspector('vibrance');
        break;
      case 'filter-photo-filter':
        this.openAdjustmentInspector('photo-filter');
        break;
      case 'filter-auto-contrast':
        this.applyFilter('autoContrast');
        break;
      case 'filter-auto-tone':
        this.applyFilter('autoTone');
        break;
      case 'filter-threshold':
        this.openAdjustmentInspector('threshold');
        break;
      case 'filter-posterize':
        this.openAdjustmentInspector('posterize');
        break;
      case 'filter-brightness-contrast':
        this.openAdjustmentInspector('brightness-contrast');
        break;
      case 'filter-hue-saturation':
        this.openAdjustmentInspector('hue-saturation');
        break;
      case 'filter-gaussian-blur':
        this.openAdjustmentInspector('gaussian-blur');
        break;
      case 'filter-motion-blur':
        this.startFilterPreview();
        this.showModal('modal-motion-blur');
        break;
      case 'filter-radial-blur':
        this.startFilterPreview();
        this.showModal('modal-radial-blur');
        break;
      case 'filter-sharpen':
        this.applyFilter('sharpen');
        break;
      case 'filter-unsharp-mask':
        this.startFilterPreview();
        this.showModal('modal-unsharp-mask');
        break;
      case 'filter-grayscale':
        this.applyFilter('grayscale');
        break;
      case 'filter-sepia':
        this.applyFilter('sepia');
        break;
      case 'filter-invert':
        this.applyFilter('invert');
        break;
      case 'filter-emboss':
        this.applyFilter('emboss');
        break;
      case 'filter-edge-detect':
        this.applyFilter('edgeDetect');
        break;
      case 'filter-vignette':
        this.applyFilter('vignette');
        break;
      case 'filter-pixelate':
        this.applyFilter('pixelate');
        break;
      case 'filter-color-lookup':
        this.openColorLookupModal();
        break;
      case 'filter-offset':
        this.openOffsetFilterModal();
        break;
      case 'filter-high-pass':
        this.openHighPassModal();
        break;
      case 'filter-oil-paint':
        this.openOilPaintModal();
        break;
      case 'filter-halftone':
        this.openHalftoneModal();
        break;
      case 'filter-chromatic':
        this.openChromaticModal();
        break;
      case 'run-frequency-separation':
        this.openFrequencySeparationModal();
        break;
      case 'adjustment-selective-color':
        this.openSelectiveColorModal();
        break;
      case 'adjustment-channel-mixer':
        this.openChannelMixerModal();
        break;
      case 'image-hdr-toning':
        this.openHdrToningModal();
        break;
      case 'filter-displace':
        this.openDisplaceModal();
        break;
      case 'filter-vanishing-point':
        this.openVanishingPointModal();
        break;
      case 'filter-normal-map':
        this.openNormalMapModal();
        break;
      case 'filter-height-map':
        this.applyHeightMap();
        break;
      case 'filter-lens-correction':
        this.openLensCorrectionModal();
        break;
      case 'filter-lighting-effects':
        this.openLightingEffectsModal();
        break;
      case 'auto-blend-focus-stack':
        this.openFocusStackModal();
        break;
      case 'open-clone-source':
        this.openCloneSourceModal();
        break;
      case 'toggle-quick-mask':
        this.toggleQuickMask();
        break;

      // View
      case 'zoom-in':
        this.zoomIn();
        break;
      case 'zoom-out':
        this.zoomOut();
        break;
      case 'zoom-100':
        this.zoom100();
        break;
      case 'zoom-fit':
        this.zoomFit();
        break;
      case 'toggle-rulers':
        this.toggleRulers();
        break;
      case 'toggle-grid':
        if (this.guideManager) this.guideManager.toggleGrid();
        break;
      case 'toggle-guides':
        if (this.guideManager) this.guideManager.toggleGuides();
        break;
      case 'lock-guides':
        if (this.guideManager) this.guideManager.toggleLock();
        break;
      case 'clear-guides':
        if (this.guideManager) {
          this.guideManager.clearGuides();
          this.renderGuidesAndOverlays();
        }
        break;
      case 'toggle-snapping':
        if (this.snappingEngine) this.snappingEngine.toggleSnapping();
        break;

      // Window
      case 'open-actions-panel':
        this.openActionsPalette();
        break;
      case 'open-patterns-panel':
        this.openPatternsLibrary();
        break;
      case 'open-channels-panel':
        this.openChannelsPaletteModal();
        break;
      case 'open-timeline-panel':
        this.openTimelinePaletteModal();
        break;
      case 'open-scripting-console':
        this.openScriptingConsole();
        break;
      case 'open-glyphs-panel':
        this.openGlyphsPanel();
        break;
      case 'workspace-essentials':
        if (this.workspaceManager) this.workspaceManager.applyPreset('essentials');
        this.showToast('Workspace: Essentials');
        break;
      case 'workspace-photography':
        if (this.workspaceManager) this.workspaceManager.applyPreset('photography');
        this.showToast('Workspace: Photography');
        break;
      case 'workspace-painting':
        if (this.workspaceManager) this.workspaceManager.applyPreset('painting');
        this.showToast('Workspace: Digital Painting');
        break;
      case 'workspace-design':
        if (this.workspaceManager) this.workspaceManager.applyPreset('graphic_design');
        this.showToast('Workspace: Graphic Design & Typography');
        break;
      case 'workspace-motion':
        if (this.workspaceManager) this.workspaceManager.applyPreset('motion');
        this.showToast('Workspace: Motion & Animation');
        break;
      case 'toggle-proof-colors':
        if (this.cmykProof) {
          this.cmykProof.isSoftProofing = !this.cmykProof.isSoftProofing;
          this.updateProofUI();
          this.renderComposite();
        }
        break;
      case 'toggle-gamut-warning':
        if (this.cmykProof) {
          this.cmykProof.isGamutWarning = !this.cmykProof.isGamutWarning;
          this.updateProofUI();
          this.renderComposite();
        }
        break;
      case 'proof-profile-swop':
        if (this.cmykProof) {
          this.cmykProof.setProfile('SWOP');
          this.updateProofUI();
          this.renderComposite();
        }
        break;
      case 'proof-profile-fogra39':
        if (this.cmykProof) {
          this.cmykProof.setProfile('FOGRA39');
          this.updateProofUI();
          this.renderComposite();
        }
        break;
      case 'proof-profile-euroscale':
        if (this.cmykProof) {
          this.cmykProof.setProfile('EUROSCALE');
          this.updateProofUI();
          this.renderComposite();
        }
        break;

      // Help
      case 'shortcuts-guide':
        this.openKeyboardShortcutsModal();
        break;
      case 'about-app':
        alert("PixelForge Studio Pro\nHigh-Performance Photoshop Alternative for Windows.");
        break;
    }
  }

  startFilterPreview() {
    const active = this.layerManager.getActiveLayer();
    if (!active) return;
    this.filterBackupCanvas = document.createElement('canvas');
    this.filterBackupCanvas.width = active.canvas.width;
    this.filterBackupCanvas.height = active.canvas.height;
    const bCtx = this.filterBackupCanvas.getContext('2d');
    bCtx.drawImage(active.canvas, 0, 0);
  }

  applyFilterPreview(filterFn) {
    if (!this.filterBackupCanvas) return;
    const active = this.layerManager.getActiveLayer();
    if (!active) return;

    const bCtx = this.filterBackupCanvas.getContext('2d');
    const imgData = bCtx.getImageData(0, 0, this.width, this.height);
    const filtered = filterFn(imgData);
    active.ctx.putImageData(filtered, 0, 0);
    this.renderComposite();
  }

  cancelFilterPreview() {
    if (!this.filterBackupCanvas) return;
    const active = this.layerManager.getActiveLayer();
    if (active) {
      active.ctx.clearRect(0, 0, this.width, this.height);
      active.ctx.drawImage(this.filterBackupCanvas, 0, 0);
      this.renderComposite();
    }
    this.filterBackupCanvas = null;
  }

  commitFilterPreview(historyName) {
    if (!this.filterBackupCanvas) return;
    this.filterBackupCanvas = null;
    this.renderComposite();
    if (this.layerManager) {
      this.layerManager.renderLayerStackUI();
    }
    this.pushHistoryState(historyName || 'Apply Filter');
  }

  applyFilter(filterType, ...args) {
    const active = this.layerManager.getActiveLayer();
    if (!active) return;

    if (active.type === 'smart-object' && active.smartObjectData) {
      active.smartObjectData.addFilter(filterType, args);
      active.smartObjectData.renderToLayer(active);
      this.renderComposite();
      this.pushHistoryState('Smart Filter: ' + filterType);
      return;
    }

    this.filterBackupCanvas = null;
    const imgData = active.ctx.getImageData(0, 0, this.width, this.height);
    const filtered = Filters[filterType](imgData, ...args);
    active.ctx.putImageData(filtered, 0, 0);
    this.renderComposite();
    this.pushHistoryState('Filter: ' + filterType);
  }

  // ── Layer Controls UI ──
  bindLayerControls() {
    document.getElementById('btn-add-layer').addEventListener('click', () => {
      this.layerManager.addLayer();
      this.pushHistoryState('New Layer');
    });

    const btnAddFill = document.getElementById('btn-add-fill-layer');
    if (btnAddFill) {
      btnAddFill.addEventListener('click', () => {
        this.layerManager.addFillLayer(this.colorPicker.getFgHex());
        this.pushHistoryState('New Fill Layer');
      });
    }

    const btnAddGroup = document.getElementById('btn-add-group');
    if (btnAddGroup) {
      btnAddGroup.addEventListener('click', () => {
        this.layerManager.addGroup();
        this.pushHistoryState('New Layer Group');
      });
    }

    const btnAddAdj = document.getElementById('btn-add-adj-layer');
    const menuAdj = document.getElementById('menu-adj-layers');
    if (btnAddAdj && menuAdj) {
      btnAddAdj.addEventListener('click', (e) => {
        e.stopPropagation();
        const rect = btnAddAdj.getBoundingClientRect();
        menuAdj.style.top = Math.max(10, rect.top - 280) + 'px';
        menuAdj.style.left = Math.max(10, rect.left - 160) + 'px';
        menuAdj.classList.remove('hidden');
      });

      menuAdj.querySelectorAll('.context-item').forEach(item => {
        item.addEventListener('click', () => {
          const adjType = item.dataset.adj;
          menuAdj.classList.add('hidden');
          if (adjType) {
            this.createAdjustmentLayer(adjType);
          }
        });
      });
    }

    const btnFx = document.getElementById('btn-layer-fx');
    if (btnFx) {
      btnFx.addEventListener('click', () => {
        this.openLayerStylesModal();
      });
    }

    const btnClip = document.getElementById('btn-clip-layer');
    if (btnClip) {
      btnClip.addEventListener('click', () => {
        this.layerManager.toggleClippingMask();
        this.pushHistoryState('Toggle Clipping Mask');
      });
    }

    document.getElementById('btn-add-mask').addEventListener('click', () => {
      this.layerManager.addLayerMask();
      this.pushHistoryState('Add Layer Mask');
    });

    document.getElementById('btn-duplicate-layer').addEventListener('click', () => {
      this.layerManager.duplicateActiveLayer();
      this.pushHistoryState('Duplicate Layer');
    });

    document.getElementById('btn-merge-layer').addEventListener('click', () => {
      if (this.layerManager.mergeDown()) {
        this.pushHistoryState('Merge Down');
      }
    });

    document.getElementById('btn-delete-layer').addEventListener('click', () => {
      if (this.layerManager.deleteActiveLayer()) {
        this.pushHistoryState('Delete Layer');
      }
    });

    const btnLockAlpha = document.getElementById('btn-lock-alpha');
    if (btnLockAlpha) {
      btnLockAlpha.addEventListener('click', () => {
        this.layerManager.toggleLockAlpha();
        this.pushHistoryState('Toggle Lock Alpha');
      });
    }

    const btnLockAll = document.getElementById('btn-lock-all');
    if (btnLockAll) {
      btnLockAll.addEventListener('click', () => {
        this.layerManager.toggleLock();
        this.pushHistoryState('Toggle Lock Layer');
      });
    }

    document.querySelectorAll('.layer-align-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const align = btn.dataset.align;
        if (align) {
          this.layerManager.alignLayer(null, align);
          this.pushHistoryState('Align Layer ' + align);
        }
      });
    });

    const blendSelect = document.getElementById('layer-blend-mode');
    blendSelect.addEventListener('change', () => {
      const active = this.layerManager.getActiveLayer();
      if (active) {
        active.blendMode = blendSelect.value;
        this.renderComposite();
      }
    });

    const opSlider = document.getElementById('layer-opacity-slider');
    const opInput = document.getElementById('layer-opacity-input');
    const opVal = document.getElementById('layer-opacity-val');

    const updateLayerOpacity = (val, fromInput = false) => {
      const active = this.layerManager.getActiveLayer();
      if (!active) return;
      let op = parseInt(val, 10);
      if (isNaN(op)) op = 100;
      op = Math.max(0, Math.min(100, op));
      active.opacity = op;
      if (opSlider) opSlider.value = op;
      if (opInput && !fromInput) opInput.value = op;
      if (opVal) opVal.textContent = op + '%';
      this.renderComposite();
    };

    if (opSlider) {
      opSlider.addEventListener('input', () => updateLayerOpacity(opSlider.value, false));
    }
    if (opInput) {
      opInput.addEventListener('focus', () => opInput.select());
      opInput.addEventListener('input', () => {
        let op = parseInt(opInput.value, 10);
        if (!isNaN(op)) updateLayerOpacity(op, true);
      });
      opInput.addEventListener('change', () => updateLayerOpacity(opInput.value, false));
      opInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') opInput.blur();
      });
    }

    // Close layer context menu, adjustment menu, and history context menu on click outside
    window.addEventListener('click', () => {
      const ctxMenu = document.getElementById('layer-context-menu');
      if (ctxMenu) ctxMenu.classList.add('hidden');
      const adjMenu = document.getElementById('menu-adj-layers');
      if (adjMenu) adjMenu.classList.add('hidden');
      const histMenu = document.getElementById('history-context-menu');
      if (histMenu) histMenu.classList.add('hidden');
    });
  }

  createAdjustmentLayer(adjType) {
    const adjLayer = this.layerManager.addAdjustmentLayer(adjType);
    this.pushHistoryState('New Adjustment Layer: ' + adjLayer.name);
    this.openAdjustmentLayerEditor(adjLayer);
  }

  openAdjustmentLayerEditor(adjLayer) {
    if (!adjLayer) return;
    const type = adjLayer.adjustmentType;
    const norm = (type || '').replace(/[^a-zA-Z]/g, '').toLowerCase();
    const inspectorTypes = [
      'posterize', 'threshold', 'brightnesscontrast', 
      'huesaturation', 'vibrance', 'colorbalance', 
      'photofilter', 'gaussianblur'
    ];
    if (inspectorTypes.includes(norm)) {
      this.openAdjustmentInspector(type, adjLayer.adjustmentParams, adjLayer);
      return;
    }

    this.editingAdjustmentLayer = adjLayer;
    this.adjustmentBackupParams = JSON.parse(JSON.stringify(adjLayer.adjustmentParams || {}));

    switch (type) {
      case 'curves':
        if (this.renderCurvesModal) this.renderCurvesModal();
        this.showModal('modal-curves');
        break;

      case 'gradientMap':
        const currentGrad = adjLayer.adjustmentParams && adjLayer.adjustmentParams.gradientData
          ? (adjLayer.adjustmentParams.gradientData instanceof GradientData 
              ? adjLayer.adjustmentParams.gradientData 
              : GradientData.fromJSON(adjLayer.adjustmentParams.gradientData))
          : (this.toolManager && this.toolManager.currentGradient 
              ? this.toolManager.currentGradient.clone() 
              : (typeof GradientData !== 'undefined' ? GradientData.getPreset('black-white') : null));
        
        if (this.gradientEditorModal && currentGrad) {
          this.gradientEditorModal.open(currentGrad, (updatedGrad) => {
            adjLayer.adjustmentParams = { gradientData: updatedGrad };
            this.pushHistoryState('Edit Adjustment: Gradient Map');
            this.renderComposite();
          });
        }
        break;

      default:
        this.openAdjustmentInspector(type, adjLayer.adjustmentParams, adjLayer);
        break;
    }
  }

  // ── Layer Right-Click Context Menu ──
  showLayerContextMenu(x, y, layerId) {
    const menu = document.getElementById('layer-context-menu');
    if (!menu) return;

    const menuW = 220;
    const menuH = 340;
    const posX = Math.min(x, window.innerWidth - menuW - 10);
    const posY = Math.min(y, window.innerHeight - menuH - 10);

    menu.style.left = `${posX}px`;
    menu.style.top = `${posY}px`;
    menu.classList.remove('hidden');

    menu.querySelectorAll('.context-item').forEach(item => {
      item.onclick = (e) => {
        e.stopPropagation();
        menu.classList.add('hidden');
        const action = item.dataset.action;
        if (!action) return;

        switch (action) {
          case 'crop-layer':
            if (layerId) this.layerManager.setActiveLayer(layerId);
            if (this.toolManager && this.toolManager.startManualCrop) {
              this.toolManager.startManualCrop(this.layerManager.getActiveLayer());
            }
            break;
          case 'free-transform':
            if (layerId) this.layerManager.setActiveLayer(layerId);
            if (this.toolManager && this.toolManager.startFreeTransform) {
              this.toolManager.startFreeTransform();
            }
            break;
          case 'scale-layer':
            if (layerId) this.layerManager.setActiveLayer(layerId);
            this.openLayerScaleModal(layerId);
            break;
          case 'layer-styles':
            this.openLayerStylesModal(layerId);
            break;
          case 'convert-to-smart-object':
            if (this.smartObjectManager) {
              this.smartObjectManager.convertToSmartObject(layerId);
            }
            break;
          case 'edit-smart-object':
            const soLayer = this.layerManager.layers.find(l => l.id === layerId);
            if (this.smartObjectManager && soLayer) {
              this.smartObjectManager.openSmartObjectEditor(soLayer);
            }
            break;
          case 'rasterize-smart-object':
            const smL = this.layerManager.layers.find(l => l.id === layerId);
            if (this.smartObjectManager && smL) {
              this.smartObjectManager.rasterizeSmartObject(smL);
            }
            break;
          case 'rasterize-type':
            if (this.layerManager.rasterizeTextLayer(layerId)) {
              this.pushHistoryState('Rasterize Type Layer');
            }
            break;
          case 'isolate-layer':
            this.toggleIsolationMode(layerId);
            break;
          case 'duplicate-layer':
            this.layerManager.duplicateActiveLayer();
            this.pushHistoryState('Duplicate Layer');
            break;
          case 'delete-layer':
            if (this.layerManager.deleteActiveLayer()) {
              this.pushHistoryState('Delete Layer');
            }
            break;
          case 'group-layers':
            this.layerManager.addGroup();
            this.pushHistoryState('Group Layers');
            break;
          case 'ungroup-layers':
            this.layerManager.ungroup(layerId);
            this.pushHistoryState('Ungroup Layers');
            break;
          case 'toggle-clipping-mask':
            this.layerManager.toggleClippingMask(layerId);
            this.pushHistoryState('Toggle Clipping Mask');
            break;
          case 'add-mask':
            const layer = this.layerManager.layers.find(l => l.id === layerId);
            if (layer && layer.hasMask) {
              this.layerManager.removeLayerMask(layerId, true);
              this.pushHistoryState('Apply Layer Mask');
            } else {
              this.layerManager.addLayerMask(layerId);
              this.pushHistoryState('Add Layer Mask');
            }
            break;
          case 'invert-mask':
            this.layerManager.invertMask(layerId);
            this.pushHistoryState('Invert Layer Mask');
            break;
          case 'merge-down':
            if (this.layerManager.mergeDown()) {
              this.pushHistoryState('Merge Down');
            }
            break;
          case 'merge-visible':
            this.layerManager.mergeVisible();
            this.pushHistoryState('Merge Visible');
            break;
          case 'flatten-image':
            this.layerManager.flattenImage();
            this.pushHistoryState('Flatten Image');
            break;
        }
      };
    });

    menu.querySelectorAll('.ctx-color-dot').forEach(dot => {
      dot.onclick = (e) => {
        e.stopPropagation();
        menu.classList.add('hidden');
        this.layerManager.setLayerColorTag(layerId, dot.dataset.color);
        this.pushHistoryState('Layer Color Tag');
      };
    });
  }

  // ── History Panel Controls & Confirmation Modals ──
  bindHistoryControls() {
    const btnClearAll = document.getElementById('btn-clear-history-all');
    if (btnClearAll) {
      btnClearAll.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openHistoryConfirmModal('clear-all', null, -1);
      });
    }

    // Dismiss history context menu on outside pointerdown
    window.addEventListener('pointerdown', (e) => {
      const histMenu = document.getElementById('history-context-menu');
      if (histMenu && !e.target.closest('#history-context-menu')) {
        histMenu.classList.add('hidden');
      }
    });

    window.addEventListener('scroll', () => {
      const histMenu = document.getElementById('history-context-menu');
      if (histMenu) histMenu.classList.add('hidden');
    }, true);
  }

  showHistoryContextMenu(x, y, index, step) {
    const menu = document.getElementById('history-context-menu');
    if (!menu) return;

    const deleteStateItem = document.getElementById('ctx-history-delete-state');
    const deleteSubsequentItem = document.getElementById('ctx-history-delete-subsequent');
    const clearAllItem = document.getElementById('ctx-history-clear-all');

    if (index < 0 || !step) {
      // Clicked on empty space
      if (deleteStateItem) deleteStateItem.style.display = 'none';
      if (deleteSubsequentItem) deleteSubsequentItem.style.display = 'none';
    } else {
      if (deleteStateItem) deleteStateItem.style.display = 'flex';
      // If last item, no subsequent states exist to delete
      const hasSubsequent = index < this.historyManager.steps.length - 1;
      if (deleteSubsequentItem) deleteSubsequentItem.style.display = hasSubsequent ? 'flex' : 'none';
    }

    const menuW = 230;
    const menuH = 150;
    const posX = Math.min(x, window.innerWidth - menuW - 10);
    const posY = Math.min(y, window.innerHeight - menuH - 10);

    menu.style.left = `${posX}px`;
    menu.style.top = `${posY}px`;
    menu.classList.remove('hidden');

    menu.querySelectorAll('.context-item').forEach(item => {
      item.onclick = (e) => {
        e.stopPropagation();
        menu.classList.add('hidden');
        const action = item.dataset.action;
        if (!action) return;

        switch (action) {
          case 'delete-state':
            this.openHistoryConfirmModal('delete-single', step, index);
            break;
          case 'delete-subsequent':
            this.openHistoryConfirmModal('delete-subsequent', step, index);
            break;
          case 'clear-all':
            this.openHistoryConfirmModal('clear-all', null, -1);
            break;
        }
      };
    });
  }

  openHistoryConfirmModal(type, step, index) {
    const modal = document.getElementById('modal-history-confirm');
    if (!modal) return;

    const titleEl = document.getElementById('history-confirm-title');
    const msgEl = document.getElementById('history-confirm-message');
    const targetEl = document.getElementById('history-confirm-target-name');
    const btnConfirm = document.getElementById('btn-confirm-history-delete');

    if (type === 'delete-single' && step) {
      if (titleEl) titleEl.textContent = 'Delete History State';
      if (msgEl) msgEl.textContent = `Do you really want to delete the history state "${step.name}"? This action cannot be undone.`;
      if (targetEl) targetEl.textContent = `${step.name} (Step #${index + 1})`;
      if (btnConfirm) btnConfirm.textContent = 'Delete State';

      if (btnConfirm) {
        btnConfirm.onclick = () => {
          modal.classList.add('hidden');
          const res = this.historyManager.deleteStep(index);
          if (res?.stateToRestore) {
            this.restoreState(res.stateToRestore);
          }
          this.showToast('History state deleted');
        };
      }
    } else if (type === 'delete-subsequent' && step) {
      const count = this.historyManager.steps.length - 1 - index;
      if (titleEl) titleEl.textContent = 'Delete Subsequent States';
      if (msgEl) msgEl.textContent = `Do you really want to delete all states following "${step.name}"?`;
      if (targetEl) targetEl.textContent = `${count} following ${count === 1 ? 'state' : 'states'} will be removed`;
      if (btnConfirm) btnConfirm.textContent = 'Delete States';

      if (btnConfirm) {
        btnConfirm.onclick = () => {
          modal.classList.add('hidden');
          const targetState = this.historyManager.deleteSubsequentSteps(index);
          if (targetState) {
            this.restoreState(targetState);
          }
          this.showToast(`Removed ${count} subsequent states`);
        };
      }
    } else {
      // clear-all
      const total = this.historyManager.steps.length;
      if (titleEl) titleEl.textContent = 'Clear All History';
      if (msgEl) msgEl.textContent = 'Do you really want to clear all history states? This will purge the entire undo/redo stack and cannot be undone.';
      if (targetEl) targetEl.textContent = `${total} history ${total === 1 ? 'state' : 'states'} will be purged`;
      if (btnConfirm) btnConfirm.textContent = 'Clear All History';

      if (btnConfirm) {
        btnConfirm.onclick = () => {
          modal.classList.add('hidden');
          const baseline = this.historyManager.createSnapshot('Current State', this.layerManager.layers, this.layerManager.activeLayerId);
          this.historyManager.clearAll(baseline);
          this.showToast('All history states cleared');
        };
      }
    }

    modal.classList.remove('hidden');
  }

  // ── Scale & Resize Layer Modal ──
  openLayerScaleModal(layerId = null) {
    const id = layerId || this.layerManager.activeLayerId;
    const layer = this.layerManager.layers.find(l => l.id === id);
    if (!layer) {
      this.showToast('Please select a valid layer to scale');
      return;
    }

    const titleEl = document.getElementById('scale-layer-title');
    const dimsEl = document.getElementById('scale-layer-current-dims');
    const widthInput = document.getElementById('scale-layer-width');
    const heightInput = document.getElementById('scale-layer-height');
    const unitSelect = document.getElementById('scale-layer-unit');
    const hUnitSpan = document.getElementById('scale-layer-h-unit');
    const constrainCheck = document.getElementById('scale-layer-constrain');
    const resampleSelect = document.getElementById('scale-layer-resample');
    const btnApply = document.getElementById('btn-apply-scale-layer');

    if (titleEl) titleEl.textContent = layer.name;

    const bounds = this.layerManager.getLayerContentBounds(layer.id) || { w: this.width, h: this.height };
    const origW = bounds.w;
    const origH = bounds.h;
    const origRatio = origW / Math.max(1, origH);

    if (dimsEl) dimsEl.textContent = `Current Dimensions: ${origW} × ${origH} px`;
    if (widthInput) widthInput.value = origW;
    if (heightInput) heightInput.value = origH;
    if (unitSelect) unitSelect.value = 'px';
    if (hUnitSpan) hUnitSpan.textContent = 'px';

    const onUnitChange = () => {
      const isPercent = unitSelect.value === 'percent';
      if (hUnitSpan) hUnitSpan.textContent = isPercent ? '%' : 'px';
      if (isPercent) {
        widthInput.value = 100;
        heightInput.value = 100;
      } else {
        widthInput.value = origW;
        heightInput.value = origH;
      }
    };

    if (unitSelect) unitSelect.onchange = onUnitChange;

    if (widthInput) {
      widthInput.oninput = () => {
        if (constrainCheck && constrainCheck.checked) {
          const val = parseFloat(widthInput.value) || 0;
          if (unitSelect.value === 'percent') {
            heightInput.value = Math.round(val);
          } else {
            heightInput.value = Math.max(1, Math.round(val / origRatio));
          }
        }
      };
    }

    if (heightInput) {
      heightInput.oninput = () => {
        if (constrainCheck && constrainCheck.checked) {
          const val = parseFloat(heightInput.value) || 0;
          if (unitSelect.value === 'percent') {
            widthInput.value = Math.round(val);
          } else {
            widthInput.value = Math.max(1, Math.round(val * origRatio));
          }
        }
      };
    }

    if (btnApply) {
      btnApply.onclick = () => {
        const isPercent = unitSelect?.value === 'percent';
        let targetW = parseFloat(widthInput.value) || origW;
        let targetH = parseFloat(heightInput.value) || origH;

        if (isPercent) {
          targetW = Math.round(origW * (targetW / 100));
          targetH = Math.round(origH * (targetH / 100));
        }

        targetW = Math.max(1, Math.round(targetW));
        targetH = Math.max(1, Math.round(targetH));
        const resample = resampleSelect?.value || 'bicubic';

        const isMulti = this.layerManager.selectedLayerIds.size > 1;
        const targetLayers = isMulti ? this.layerManager.getSelectedLayers() : [layer];

        targetLayers.forEach(l => {
          if (isMulti && l.id !== layer.id) {
            const lBounds = this.layerManager.getLayerContentBounds(l.id) || { w: this.width, h: this.height };
            const scaleX = targetW / Math.max(1, origW);
            const scaleY = targetH / Math.max(1, origH);
            this.layerManager.scaleLayer(l.id, lBounds.w * scaleX, lBounds.h * scaleY, resample);
          } else {
            this.layerManager.scaleLayer(l.id, targetW, targetH, resample);
          }
        });

        this.renderComposite();
        this.layerManager.renderLayerStackUI();
        const desc = isMulti ? `Scale ${targetLayers.length} Layers to ${targetW}×${targetH}` : `Scale Layer: ${layer.name} (${targetW}×${targetH})`;
        this.pushHistoryState(desc);
        this.showToast(desc);
        this.hideModal('modal-scale-layer');
      };
    }

    this.showModal('modal-scale-layer');
  }

  // ── Layer Styles Modal Controller ──
  openLayerStylesModal(layerId = null) {
    const id = layerId || this.layerManager.activeLayerId;
    const layer = this.layerManager.layers.find(l => l.id === id);
    if (!layer) return;

    document.getElementById('layer-styles-title').textContent = layer.name;

    if (!layer.styles) layer.styles = {};
    if (!layer.styles.dropShadow) layer.styles.dropShadow = { enabled: false, color: '#000000', opacity: 75, distance: 8, blur: 10, angle: 120 };
    if (!layer.styles.stroke) layer.styles.stroke = { enabled: false, color: '#000000', size: 3, opacity: 100 };
    if (!layer.styles.colorOverlay) layer.styles.colorOverlay = { enabled: false, color: '#3b82f6', opacity: 50, blendMode: 'source-over' };
    if (!layer.styles.outerGlow) layer.styles.outerGlow = { enabled: false, color: '#f59e0b', opacity: 75, blur: 12 };
    if (!layer.styles.bevelEmboss) layer.styles.bevelEmboss = { enabled: false, style: 'inner-bevel', size: 5, angle: 120, highlightColor: '#ffffff', highlightOpacity: 75, shadowColor: '#000000', shadowOpacity: 75 };
    if (!layer.styles.innerShadow) layer.styles.innerShadow = { enabled: false, color: '#000000', opacity: 75, angle: 120, distance: 5, size: 5 };
    if (!layer.styles.innerGlow) layer.styles.innerGlow = { enabled: false, color: '#ffffbe', opacity: 75, blur: 10, choke: 0, blendMode: 'screen' };
    if (!layer.styles.satin) layer.styles.satin = { enabled: false, color: '#000000', opacity: 50, angle: 19, distance: 11, invert: true };
    if (!layer.styles.patternOverlay) layer.styles.patternOverlay = { enabled: false, pattern: 'grid', scale: 100, opacity: 100, blendMode: 'source-over' };
    if (!layer.styles.gradientOverlay) layer.styles.gradientOverlay = { enabled: false, opacity: 100, blendMode: 'source-over', angle: 90, scale: 100, reverse: false, preset: 'black-white', stops: [{ offset: 0, color: '#000000' }, { offset: 1, color: '#ffffff' }] };

    const initialStyles = JSON.parse(JSON.stringify(layer.styles));
    const st = layer.styles;

    // Checkboxes
    const chkShadow = document.getElementById('ls-check-drop-shadow');
    const chkGlow = document.getElementById('ls-check-outer-glow');
    const chkStroke = document.getElementById('ls-check-stroke');
    const chkOverlay = document.getElementById('ls-check-color-overlay');
    const chkBevel = document.getElementById('ls-check-bevel-emboss');
    const chkInShadow = document.getElementById('ls-check-inner-shadow');
    const chkInGlow = document.getElementById('ls-check-inner-glow');
    const chkSatin = document.getElementById('ls-check-satin');
    const chkPattern = document.getElementById('ls-check-pattern-overlay');
    const chkGradOverlay = document.getElementById('ls-check-gradient-overlay');

    if (chkShadow) chkShadow.checked = !!st.dropShadow?.enabled;
    if (chkGlow) chkGlow.checked = !!st.outerGlow?.enabled;
    if (chkStroke) chkStroke.checked = !!st.stroke?.enabled;
    if (chkOverlay) chkOverlay.checked = !!st.colorOverlay?.enabled;
    if (chkBevel) chkBevel.checked = !!st.bevelEmboss?.enabled;
    if (chkInShadow) chkInShadow.checked = !!st.innerShadow?.enabled;
    if (chkInGlow) chkInGlow.checked = !!st.innerGlow?.enabled;
    if (chkSatin) chkSatin.checked = !!st.satin?.enabled;
    if (chkPattern) chkPattern.checked = !!st.patternOverlay?.enabled;
    if (chkGradOverlay) chkGradOverlay.checked = !!st.gradientOverlay?.enabled;

    // Drop Shadow
    const shadowCol = document.getElementById('ls-shadow-color');
    const shadowOp = document.getElementById('ls-shadow-opacity');
    const shadowOpVal = document.getElementById('val-ls-shadow-opacity');
    const shadowAng = document.getElementById('ls-shadow-angle');
    const shadowAngVal = document.getElementById('val-ls-shadow-angle');
    const shadowDist = document.getElementById('ls-shadow-dist');
    const shadowDistVal = document.getElementById('val-ls-shadow-dist');
    const shadowBlur = document.getElementById('ls-shadow-blur');
    const shadowBlurVal = document.getElementById('val-ls-shadow-blur');

    if (shadowCol) shadowCol.value = st.dropShadow?.color || '#000000';
    if (shadowOp) { shadowOp.value = st.dropShadow?.opacity ?? 75; shadowOpVal.textContent = shadowOp.value + '%'; }
    if (shadowAng) { shadowAng.value = st.dropShadow?.angle ?? 120; shadowAngVal.textContent = shadowAng.value + '°'; }
    if (shadowDist) { shadowDist.value = st.dropShadow?.distance ?? 8; shadowDistVal.textContent = shadowDist.value + 'px'; }
    if (shadowBlur) { shadowBlur.value = st.dropShadow?.blur ?? 10; shadowBlurVal.textContent = shadowBlur.value + 'px'; }

    // Outer Glow
    const glowCol = document.getElementById('ls-glow-color');
    const glowOp = document.getElementById('ls-glow-opacity');
    const glowOpVal = document.getElementById('val-ls-glow-opacity');
    const glowBlur = document.getElementById('ls-glow-blur');
    const glowBlurVal = document.getElementById('val-ls-glow-blur');

    if (glowCol) glowCol.value = st.outerGlow?.color || '#f59e0b';
    if (glowOp) { glowOp.value = st.outerGlow?.opacity ?? 75; glowOpVal.textContent = glowOp.value + '%'; }
    if (glowBlur) { glowBlur.value = st.outerGlow?.blur ?? 12; glowBlurVal.textContent = glowBlur.value + 'px'; }

    // Stroke
    const strokeSz = document.getElementById('ls-stroke-size');
    const strokeSzVal = document.getElementById('val-ls-stroke-size');
    const strokeCol = document.getElementById('ls-stroke-color');
    const strokeOp = document.getElementById('ls-stroke-opacity');
    const strokeOpVal = document.getElementById('val-ls-stroke-opacity');

    if (strokeSz) { strokeSz.value = st.stroke?.size ?? 3; strokeSzVal.textContent = strokeSz.value + 'px'; }
    if (strokeCol) strokeCol.value = st.stroke?.color || '#000000';
    if (strokeOp) { strokeOp.value = st.stroke?.opacity ?? 100; strokeOpVal.textContent = strokeOp.value + '%'; }

    // Color Overlay
    const overCol = document.getElementById('ls-overlay-color');
    const overBlend = document.getElementById('ls-overlay-blend');
    const overOp = document.getElementById('ls-overlay-opacity');
    const overOpVal = document.getElementById('val-ls-overlay-opacity');

    if (overCol) overCol.value = st.colorOverlay?.color || '#3b82f6';
    if (overBlend) overBlend.value = st.colorOverlay?.blendMode || 'source-over';
    if (overOp) { overOp.value = st.colorOverlay?.opacity ?? 50; overOpVal.textContent = overOp.value + '%'; }

    // Bevel & Emboss
    const bevelStyle = document.getElementById('ls-bevel-style');
    const bevelSize = document.getElementById('ls-bevel-size');
    const bevelSizeVal = document.getElementById('val-ls-bevel-size');
    const bevelAngle = document.getElementById('ls-bevel-angle');
    const bevelAngleVal = document.getElementById('val-ls-bevel-angle');
    const bevelHlCol = document.getElementById('ls-bevel-hl-color');
    const bevelHlOp = document.getElementById('ls-bevel-hl-opacity');
    const bevelHlOpVal = document.getElementById('val-ls-bevel-hl-opacity');
    const bevelShCol = document.getElementById('ls-bevel-sh-color');
    const bevelShOp = document.getElementById('ls-bevel-sh-opacity');
    const bevelShOpVal = document.getElementById('val-ls-bevel-sh-opacity');

    if (bevelStyle) bevelStyle.value = st.bevelEmboss?.style || 'inner-bevel';
    if (bevelSize) { bevelSize.value = st.bevelEmboss?.size ?? 5; if (bevelSizeVal) bevelSizeVal.textContent = bevelSize.value + 'px'; }
    if (bevelAngle) { bevelAngle.value = st.bevelEmboss?.angle ?? 120; if (bevelAngleVal) bevelAngleVal.textContent = bevelAngle.value + '°'; }
    if (bevelHlCol) bevelHlCol.value = st.bevelEmboss?.highlightColor || '#ffffff';
    if (bevelHlOp) { bevelHlOp.value = st.bevelEmboss?.highlightOpacity ?? 75; if (bevelHlOpVal) bevelHlOpVal.textContent = bevelHlOp.value + '%'; }
    if (bevelShCol) bevelShCol.value = st.bevelEmboss?.shadowColor || '#000000';
    if (bevelShOp) { bevelShOp.value = st.bevelEmboss?.shadowOpacity ?? 75; if (bevelShOpVal) bevelShOpVal.textContent = bevelShOp.value + '%'; }

    // Inner Shadow
    const inCol = document.getElementById('ls-inshadow-color');
    const inOp = document.getElementById('ls-inshadow-opacity');
    const inOpVal = document.getElementById('val-ls-inshadow-opacity');
    const inAng = document.getElementById('ls-inshadow-angle');
    const inAngVal = document.getElementById('val-ls-inshadow-angle');
    const inDist = document.getElementById('ls-inshadow-dist');
    const inDistVal = document.getElementById('val-ls-inshadow-dist');
    const inSize = document.getElementById('ls-inshadow-size');
    const inSizeVal = document.getElementById('val-ls-inshadow-size');

    if (inCol) inCol.value = st.innerShadow?.color || '#000000';
    if (inOp) { inOp.value = st.innerShadow?.opacity ?? 75; if (inOpVal) inOpVal.textContent = inOp.value + '%'; }
    if (inAng) { inAng.value = st.innerShadow?.angle ?? 120; if (inAngVal) inAngVal.textContent = inAng.value + '°'; }
    if (inDist) { inDist.value = st.innerShadow?.distance ?? 5; if (inDistVal) inDistVal.textContent = inDist.value + 'px'; }
    if (inSize) { inSize.value = st.innerShadow?.size ?? 5; if (inSizeVal) inSizeVal.textContent = inSize.value + 'px'; }

    // Satin
    const satCol = document.getElementById('ls-satin-color');
    const satOp = document.getElementById('ls-satin-opacity');
    const satOpVal = document.getElementById('val-ls-satin-opacity');
    const satAng = document.getElementById('ls-satin-angle');
    const satAngVal = document.getElementById('val-ls-satin-angle');
    const satDist = document.getElementById('ls-satin-dist');
    const satDistVal = document.getElementById('val-ls-satin-dist');
    const satInv = document.getElementById('ls-satin-invert');

    if (satCol) satCol.value = st.satin?.color || '#000000';
    if (satOp) { satOp.value = st.satin?.opacity ?? 50; if (satOpVal) satOpVal.textContent = satOp.value + '%'; }
    if (satAng) { satAng.value = st.satin?.angle ?? 19; if (satAngVal) satAngVal.textContent = satAng.value + '°'; }
    if (satDist) { satDist.value = st.satin?.distance ?? 11; if (satDistVal) satDistVal.textContent = satDist.value + 'px'; }
    if (satInv) satInv.checked = st.satin?.invert !== false;

    // Pattern Overlay
    const patType = document.getElementById('ls-pattern-type');
    const patScale = document.getElementById('ls-pattern-scale');
    const patScaleVal = document.getElementById('val-ls-pattern-scale');
    const patBlend = document.getElementById('ls-pattern-blend');
    const patOp = document.getElementById('ls-pattern-opacity');
    const patOpVal = document.getElementById('val-ls-pattern-opacity');

    if (patType) patType.value = st.patternOverlay?.pattern || 'grid';
    if (patScale) { patScale.value = st.patternOverlay?.scale ?? 100; if (patScaleVal) patScaleVal.textContent = patScale.value + '%'; }
    if (patBlend) patBlend.value = st.patternOverlay?.blendMode || 'source-over';
    if (patOp) { patOp.value = st.patternOverlay?.opacity ?? 100; if (patOpVal) patOpVal.textContent = patOp.value + '%'; }

    // Inner Glow
    const inGlowCol = document.getElementById('ls-inglow-color');
    const inGlowBlend = document.getElementById('ls-inglow-blend');
    const inGlowOp = document.getElementById('ls-inglow-opacity');
    const inGlowOpVal = document.getElementById('val-ls-inglow-opacity');
    const inGlowBlur = document.getElementById('ls-inglow-blur');
    const inGlowBlurVal = document.getElementById('val-ls-inglow-blur');

    if (inGlowCol) inGlowCol.value = st.innerGlow?.color || '#ffffbe';
    if (inGlowBlend) inGlowBlend.value = st.innerGlow?.blendMode || 'screen';
    if (inGlowOp) { inGlowOp.value = st.innerGlow?.opacity ?? 75; if (inGlowOpVal) inGlowOpVal.textContent = inGlowOp.value + '%'; }
    if (inGlowBlur) { inGlowBlur.value = st.innerGlow?.blur ?? 10; if (inGlowBlurVal) inGlowBlurVal.textContent = inGlowBlur.value + 'px'; }

    // Gradient Overlay
    const gradBlend = document.getElementById('ls-grad-blend');
    const gradOp = document.getElementById('ls-grad-opacity');
    const gradOpVal = document.getElementById('val-ls-grad-opacity');
    const gradPreset = document.getElementById('ls-grad-preset');
    const gradAngle = document.getElementById('ls-grad-angle');
    const gradAngleVal = document.getElementById('val-ls-grad-angle');
    const gradScale = document.getElementById('ls-grad-scale');
    const gradScaleVal = document.getElementById('val-ls-grad-scale');
    const gradRev = document.getElementById('ls-grad-reverse');

    const gradPresetMap = {
      'black-white': [{ offset: 0, color: '#000000' }, { offset: 1, color: '#ffffff' }],
      'rainbow': [{ offset: 0, color: '#ff0000' }, { offset: 0.17, color: '#ff7f00' }, { offset: 0.33, color: '#ffff00' }, { offset: 0.5, color: '#00ff00' }, { offset: 0.67, color: '#0000ff' }, { offset: 0.83, color: '#4b0082' }, { offset: 1, color: '#8f00ff' }],
      'sunset': [{ offset: 0, color: '#ff4e50' }, { offset: 0.5, color: '#f9d423' }, { offset: 1, color: '#2b1055' }],
      'neon': [{ offset: 0, color: '#00f2fe' }, { offset: 0.5, color: '#4facfe' }, { offset: 1, color: '#f093fb' }],
      'chrome': [{ offset: 0, color: '#29323c' }, { offset: 0.5, color: '#485563' }, { offset: 1, color: '#93a5cf' }],
      'sepia': [{ offset: 0, color: '#2b1b17' }, { offset: 0.5, color: '#704214' }, { offset: 1, color: '#f5deb3' }]
    };

    if (gradBlend) gradBlend.value = st.gradientOverlay?.blendMode || 'source-over';
    if (gradOp) { gradOp.value = st.gradientOverlay?.opacity ?? 100; if (gradOpVal) gradOpVal.textContent = gradOp.value + '%'; }
    if (gradPreset) gradPreset.value = st.gradientOverlay?.preset || 'black-white';
    if (gradAngle) { gradAngle.value = st.gradientOverlay?.angle ?? 90; if (gradAngleVal) gradAngleVal.textContent = gradAngle.value + '°'; }
    if (gradScale) { gradScale.value = st.gradientOverlay?.scale ?? 100; if (gradScaleVal) gradScaleVal.textContent = gradScale.value + '%'; }
    if (gradRev) gradRev.checked = !!st.gradientOverlay?.reverse;

    const updateLiveStyles = () => {
      const livePrev = document.getElementById('ls-live-preview-check');
      if (livePrev && !livePrev.checked) return;

      st.dropShadow = {
        enabled: chkShadow ? chkShadow.checked : false,
        color: shadowCol ? shadowCol.value : '#000000',
        opacity: shadowOp ? parseInt(shadowOp.value, 10) : 75,
        angle: shadowAng ? parseInt(shadowAng.value, 10) : 120,
        distance: shadowDist ? parseInt(shadowDist.value, 10) : 8,
        blur: shadowBlur ? parseInt(shadowBlur.value, 10) : 10
      };
      st.outerGlow = {
        enabled: chkGlow ? chkGlow.checked : false,
        color: glowCol ? glowCol.value : '#f59e0b',
        opacity: glowOp ? parseInt(glowOp.value, 10) : 75,
        blur: glowBlur ? parseInt(glowBlur.value, 10) : 12
      };
      st.stroke = {
        enabled: chkStroke ? chkStroke.checked : false,
        size: strokeSz ? parseInt(strokeSz.value, 10) : 3,
        color: strokeCol ? strokeCol.value : '#000000',
        opacity: strokeOp ? parseInt(strokeOp.value, 10) : 100
      };
      st.colorOverlay = {
        enabled: chkOverlay ? chkOverlay.checked : false,
        color: overCol ? overCol.value : '#3b82f6',
        blendMode: overBlend ? overBlend.value : 'source-over',
        opacity: overOp ? parseInt(overOp.value, 10) : 50
      };
      if (chkBevel && bevelStyle && bevelSize && bevelAngle && bevelHlCol && bevelHlOp && bevelShCol && bevelShOp) {
        st.bevelEmboss = {
          enabled: chkBevel.checked,
          style: bevelStyle.value,
          size: parseInt(bevelSize.value, 10),
          angle: parseInt(bevelAngle.value, 10),
          highlightColor: bevelHlCol.value,
          highlightOpacity: parseInt(bevelHlOp.value, 10),
          shadowColor: bevelShCol.value,
          shadowOpacity: parseInt(bevelShOp.value, 10)
        };
      }
      if (chkInShadow && inCol && inOp && inAng && inDist && inSize) {
        st.innerShadow = {
          enabled: chkInShadow.checked,
          color: inCol.value,
          opacity: parseInt(inOp.value, 10),
          angle: parseInt(inAng.value, 10),
          distance: parseInt(inDist.value, 10),
          size: parseInt(inSize.value, 10)
        };
      }
      if (chkInGlow && inGlowCol && inGlowBlend && inGlowOp && inGlowBlur) {
        st.innerGlow = {
          enabled: chkInGlow.checked,
          color: inGlowCol.value,
          blendMode: inGlowBlend.value,
          opacity: parseInt(inGlowOp.value, 10),
          blur: parseInt(inGlowBlur.value, 10)
        };
      }
      if (chkSatin && satCol && satOp && satAng && satDist && satInv) {
        st.satin = {
          enabled: chkSatin.checked,
          color: satCol.value,
          opacity: parseInt(satOp.value, 10),
          angle: parseInt(satAng.value, 10),
          distance: parseInt(satDist.value, 10),
          invert: satInv.checked
        };
      }
      if (chkPattern && patType && patScale && patBlend && patOp) {
        st.patternOverlay = {
          enabled: chkPattern.checked,
          pattern: patType.value,
          scale: parseInt(patScale.value, 10),
          blendMode: patBlend.value,
          opacity: parseInt(patOp.value, 10)
        };
      }
      if (chkGradOverlay && gradBlend && gradOp && gradPreset && gradAngle && gradScale && gradRev) {
        const stops = gradPresetMap[gradPreset.value] || gradPresetMap['black-white'];
        st.gradientOverlay = {
          enabled: chkGradOverlay.checked,
          blendMode: gradBlend.value,
          opacity: parseInt(gradOp.value, 10),
          preset: gradPreset.value,
          stops: stops,
          angle: parseInt(gradAngle.value, 10),
          scale: parseInt(gradScale.value, 10),
          reverse: gradRev.checked
        };
      }

      this.renderComposite();
      this.layerManager.renderLayerStackUI();
    };

    [chkShadow, chkGlow, chkStroke, chkOverlay, chkBevel, chkInShadow, chkInGlow, chkSatin, chkPattern, chkGradOverlay].filter(Boolean).forEach(c => c.onchange = updateLiveStyles);

    const onShadowChange = () => { if (chkShadow && !chkShadow.checked) chkShadow.checked = true; updateLiveStyles(); };
    if (shadowCol) shadowCol.oninput = onShadowChange;
    if (shadowOp) shadowOp.oninput = () => { shadowOpVal.textContent = shadowOp.value + '%'; onShadowChange(); };
    if (shadowAng) shadowAng.oninput = () => { shadowAngVal.textContent = shadowAng.value + '°'; onShadowChange(); };
    if (shadowDist) shadowDist.oninput = () => { shadowDistVal.textContent = shadowDist.value + 'px'; onShadowChange(); };
    if (shadowBlur) shadowBlur.oninput = () => { shadowBlurVal.textContent = shadowBlur.value + 'px'; onShadowChange(); };

    const onGlowChange = () => { if (chkGlow && !chkGlow.checked) chkGlow.checked = true; updateLiveStyles(); };
    if (glowCol) glowCol.oninput = onGlowChange;
    if (glowOp) glowOp.oninput = () => { glowOpVal.textContent = glowOp.value + '%'; onGlowChange(); };
    if (glowBlur) glowBlur.oninput = () => { glowBlurVal.textContent = glowBlur.value + 'px'; onGlowChange(); };

    const onStrokeChange = () => { if (chkStroke && !chkStroke.checked) chkStroke.checked = true; updateLiveStyles(); };
    if (strokeSz) strokeSz.oninput = () => { strokeSzVal.textContent = strokeSz.value + 'px'; onStrokeChange(); };
    if (strokeCol) strokeCol.oninput = onStrokeChange;
    if (strokeOp) strokeOp.oninput = () => { strokeOpVal.textContent = strokeOp.value + '%'; onStrokeChange(); };

    const onOverlayChange = () => { if (chkOverlay && !chkOverlay.checked) chkOverlay.checked = true; updateLiveStyles(); };
    if (overCol) overCol.oninput = onOverlayChange;
    if (overBlend) overBlend.onchange = onOverlayChange;
    if (overOp) overOp.oninput = () => { overOpVal.textContent = overOp.value + '%'; onOverlayChange(); };

    const onBevelChange = () => { if (chkBevel && !chkBevel.checked) chkBevel.checked = true; updateLiveStyles(); };
    if (bevelStyle) bevelStyle.onchange = onBevelChange;
    if (bevelSize) bevelSize.oninput = () => { if (bevelSizeVal) bevelSizeVal.textContent = bevelSize.value + 'px'; onBevelChange(); };
    if (bevelAngle) bevelAngle.oninput = () => { if (bevelAngleVal) bevelAngleVal.textContent = bevelAngle.value + '°'; onBevelChange(); };
    if (bevelHlCol) bevelHlCol.oninput = onBevelChange;
    if (bevelHlOp) bevelHlOp.oninput = () => { if (bevelHlOpVal) bevelHlOpVal.textContent = bevelHlOp.value + '%'; onBevelChange(); };
    if (bevelShCol) bevelShCol.oninput = onBevelChange;
    if (bevelShOp) bevelShOp.oninput = () => { if (bevelShOpVal) bevelShOpVal.textContent = bevelShOp.value + '%'; onBevelChange(); };

    const onInShadowChange = () => { if (chkInShadow && !chkInShadow.checked) chkInShadow.checked = true; updateLiveStyles(); };
    if (inCol) inCol.oninput = onInShadowChange;
    if (inOp) inOp.oninput = () => { if (inOpVal) inOpVal.textContent = inOp.value + '%'; onInShadowChange(); };
    if (inAng) inAng.oninput = () => { if (inAngVal) inAngVal.textContent = inAng.value + '°'; onInShadowChange(); };
    if (inDist) inDist.oninput = () => { if (inDistVal) inDistVal.textContent = inDist.value + 'px'; onInShadowChange(); };
    if (inSize) inSize.oninput = () => { if (inSizeVal) inSizeVal.textContent = inSize.value + 'px'; onInShadowChange(); };

    const onInGlowChange = () => { if (chkInGlow && !chkInGlow.checked) chkInGlow.checked = true; updateLiveStyles(); };
    if (inGlowCol) inGlowCol.oninput = onInGlowChange;
    if (inGlowBlend) inGlowBlend.onchange = onInGlowChange;
    if (inGlowOp) inGlowOp.oninput = () => { if (inGlowOpVal) inGlowOpVal.textContent = inGlowOp.value + '%'; onInGlowChange(); };
    if (inGlowBlur) inGlowBlur.oninput = () => { if (inGlowBlurVal) inGlowBlurVal.textContent = inGlowBlur.value + 'px'; onInGlowChange(); };

    const onSatinChange = () => { if (chkSatin && !chkSatin.checked) chkSatin.checked = true; updateLiveStyles(); };
    if (satCol) satCol.oninput = onSatinChange;
    if (satOp) satOp.oninput = () => { if (satOpVal) satOpVal.textContent = satOp.value + '%'; onSatinChange(); };
    if (satAng) satAng.oninput = () => { if (satAngVal) satAngVal.textContent = satAng.value + '°'; onSatinChange(); };
    if (satDist) satDist.oninput = () => { if (satDistVal) satDistVal.textContent = satDist.value + 'px'; onSatinChange(); };
    if (satInv) satInv.onchange = onSatinChange;

    const onPatternChange = () => { if (chkPattern && !chkPattern.checked) chkPattern.checked = true; updateLiveStyles(); };
    if (patType) patType.onchange = onPatternChange;
    if (patScale) patScale.oninput = () => { if (patScaleVal) patScaleVal.textContent = patScale.value + '%'; onPatternChange(); };
    if (patBlend) patBlend.onchange = onPatternChange;
    if (patOp) patOp.oninput = () => { if (patOpVal) patOpVal.textContent = patOp.value + '%'; onPatternChange(); };

    const onGradOverlayChange = () => { if (chkGradOverlay && !chkGradOverlay.checked) chkGradOverlay.checked = true; updateLiveStyles(); };
    if (gradBlend) gradBlend.onchange = onGradOverlayChange;
    if (gradOp) gradOp.oninput = () => { if (gradOpVal) gradOpVal.textContent = gradOp.value + '%'; onGradOverlayChange(); };
    if (gradPreset) gradPreset.onchange = onGradOverlayChange;
    if (gradAngle) gradAngle.oninput = () => { if (gradAngleVal) gradAngleVal.textContent = gradAngle.value + '°'; onGradOverlayChange(); };
    if (gradScale) gradScale.oninput = () => { if (gradScaleVal) gradScaleVal.textContent = gradScale.value + '%'; onGradOverlayChange(); };
    if (gradRev) gradRev.onchange = onGradOverlayChange;

    document.querySelectorAll('.style-tab-item').forEach(tab => {
      tab.onclick = (e) => {
        const tabName = tab.dataset.tab;
        document.querySelectorAll('.style-tab-item').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        document.querySelectorAll('.style-panel').forEach(p => p.classList.add('hidden'));
        const panel = document.getElementById(`panel-style-${tabName}`);
        if (panel) {
          panel.classList.remove('hidden');
          const contentArea = document.querySelector('#modal-layer-styles .styles-tab-content');
          if (contentArea) contentArea.scrollTop = 0;
        }

        // Auto-check style when tab row is clicked (unless clicking directly on checkbox)
        if (e.target.tagName !== 'INPUT') {
          const chk = tab.querySelector('input[type="checkbox"]');
          if (chk && !chk.checked) {
            chk.checked = true;
          }
        }
        updateLiveStyles();
      };
    });

    const chkLivePreview = document.getElementById('ls-live-preview-check');
    if (chkLivePreview) {
      chkLivePreview.checked = true;
      chkLivePreview.onchange = () => {
        if (chkLivePreview.checked) {
          updateLiveStyles();
        } else {
          layer.styles = JSON.parse(JSON.stringify(initialStyles));
          this.renderComposite();
          this.layerManager.renderLayerStackUI();
        }
      };
    }

    let applied = false;
    const modalEl = document.getElementById('modal-layer-styles');
    modalEl.querySelectorAll('.modal-close-btn, .modal-cancel-btn').forEach(b => {
      b.onclick = () => {
        if (!applied) {
          layer.styles = initialStyles;
          this.renderComposite();
          this.layerManager.renderLayerStackUI();
        }
        this.hideModal('modal-layer-styles');
      };
    });

    const btnApply = document.getElementById('btn-apply-layer-styles');
    btnApply.onclick = () => {
      const anyChecked = [chkShadow, chkGlow, chkStroke, chkOverlay, chkBevel, chkInShadow, chkInGlow, chkSatin, chkPattern, chkGradOverlay].some(c => c && c.checked);
      if (!anyChecked) {
        const activeTab = document.querySelector('.style-tab-item.active');
        if (activeTab) {
          const chk = activeTab.querySelector('input[type="checkbox"]');
          if (chk) chk.checked = true;
        }
      }
      applied = true;
      updateLiveStyles();
      this.pushHistoryState('Layer Styles: ' + layer.name);
      this.hideModal('modal-layer-styles');
    };

    // If modal opens and active tab style is not enabled, switch to first enabled style if any
    const checkedInput = document.querySelector('.style-tab-item input[type="checkbox"]:checked');
    if (checkedInput) {
      const parentTab = checkedInput.closest('.style-tab-item');
      if (parentTab) {
        document.querySelectorAll('.style-tab-item').forEach(t => t.classList.remove('active'));
        parentTab.classList.add('active');
        const tabName = parentTab.dataset.tab;
        document.querySelectorAll('.style-panel').forEach(p => p.classList.add('hidden'));
        const panel = document.getElementById(`panel-style-${tabName}`);
        if (panel) {
          panel.classList.remove('hidden');
          const contentArea = document.querySelector('#modal-layer-styles .styles-tab-content');
          if (contentArea) contentArea.scrollTop = 0;
        }
      }
    } else {
      // If no style is enabled, ensure active or first tab is cleanly selected and its panel visible
      const firstTab = document.querySelector('.style-tab-item.active') || document.querySelector('.style-tab-item');
      if (firstTab) {
        document.querySelectorAll('.style-tab-item').forEach(t => t.classList.remove('active'));
        firstTab.classList.add('active');
        const tabName = firstTab.dataset.tab;
        document.querySelectorAll('.style-panel').forEach(p => p.classList.add('hidden'));
        const panel = document.getElementById(`panel-style-${tabName}`);
        if (panel) {
          panel.classList.remove('hidden');
          const contentArea = document.querySelector('#modal-layer-styles .styles-tab-content');
          if (contentArea) contentArea.scrollTop = 0;
        }
      }
    }

    // Trigger initial live preview if any styles are active
    updateLiveStyles();

    this.showModal('modal-layer-styles');
  }

  // ── Right-Docked Adjustment Inspector (Photoshop Parity Live Editing) ──
  openAdjustmentInspector(type, initialParams = null, targetAdjLayer = null) {
    const active = this.layerManager.getActiveLayer();
    if (!active && !targetAdjLayer) {
      this.showToast('Please select a layer to apply adjustments');
      return;
    }

    const panel = document.getElementById('panel-adjustment-inspector');
    const titleEl = document.getElementById('adjustment-inspector-name');
    const bodyEl = document.getElementById('adjustment-inspector-body');
    const btnReset = document.getElementById('btn-adj-reset');
    const btnApplyHeader = document.getElementById('btn-adj-apply');
    const btnCloseHeader = document.getElementById('btn-adj-close');
    const btnApplyBottom = document.getElementById('btn-adj-apply-bottom');
    const btnCancelBottom = document.getElementById('btn-adj-cancel-bottom');
    const chkLivePreview = document.getElementById('adj-live-preview-check');

    if (!panel || !bodyEl) return;

    // Normalizing type name
    const normalizedType = type.replace('filter-', '').replace('adjustment-', '');

    // Setup adjustment state
    const isAdjLayer = !!(targetAdjLayer || (active && (active.type === 'adjustment' || active.isAdjustment)));
    const adjLayer = targetAdjLayer || ((active && (active.type === 'adjustment' || active.isAdjustment)) ? active : null);

    if (isAdjLayer && adjLayer) {
      this.editingAdjustmentLayer = adjLayer;
      this.adjustmentBackupParams = JSON.parse(JSON.stringify(adjLayer.adjustmentParams || {}));
    } else {
      this.editingAdjustmentLayer = null;
      this.adjustmentBackupParams = null;
      this.startFilterPreview();
    }

    // Un-collapse right dock if collapsed
    const rightDock = document.getElementById('right-dock');
    if (rightDock && rightDock.style.display === 'none') {
      rightDock.style.display = 'flex';
    }

    // Title mapping
    const titles = {
      'posterize': 'Posterize',
      'threshold': 'Threshold (B&W)',
      'brightness-contrast': 'Brightness / Contrast',
      'brightnessContrast': 'Brightness / Contrast',
      'hue-saturation': 'Hue / Saturation',
      'hueSaturation': 'Hue / Saturation',
      'vibrance': 'Vibrance & Saturation',
      'color-balance': 'Color Balance',
      'colorBalance': 'Color Balance',
      'photo-filter': 'Photo Filter',
      'photoFilter': 'Photo Filter',
      'gaussian-blur': 'Gaussian Blur',
      'unsharp-mask': 'Unsharp Mask'
    };

    const title = titles[normalizedType] || normalizedType.toUpperCase();
    if (titleEl) titleEl.textContent = title;

    // Active params tracking
    let currentParams = {};
    let defaultParams = {};
    let liveUpdateFn = () => {};

    // Generate controls based on adjustment type
    switch (normalizedType) {
      case 'posterize': {
        defaultParams = { levels: 4 };
        currentParams = Object.assign({}, defaultParams, initialParams || (adjLayer ? adjLayer.adjustmentParams : {}));

        bodyEl.innerHTML = `
          <div class="adj-control-row">
            <div class="adj-control-header">
              <strong>Tonal Levels:</strong>
              <span class="adj-val-badge" id="val-adj-posterize">${currentParams.levels}</span>
            </div>
            <div class="adj-slider-row">
              <input type="range" id="slider-adj-posterize" min="2" max="32" value="${currentParams.levels}">
              <input type="number" id="num-adj-posterize" class="adj-num-input" min="2" max="32" value="${currentParams.levels}">
            </div>
            <div class="adj-desc-hint">Specifies number of tonal levels per color channel (2 = 8 colors, 32 = smooth gradation).</div>
          </div>
        `;

        const s = document.getElementById('slider-adj-posterize');
        const n = document.getElementById('num-adj-posterize');
        const v = document.getElementById('val-adj-posterize');

        liveUpdateFn = () => {
          const lvl = parseInt(s.value, 10) || 4;
          currentParams.levels = lvl;
          v.textContent = lvl;
          n.value = lvl;

          if (chkLivePreview && !chkLivePreview.checked) return;

          if (isAdjLayer && adjLayer) {
            adjLayer.adjustmentParams = { levels: lvl };
            this.renderComposite();
          } else {
            this.applyFilterPreview((imgData) => Filters.posterize(imgData, lvl));
          }
        };

        s.oninput = liveUpdateFn;
        n.oninput = () => {
          s.value = Math.max(2, Math.min(32, parseInt(n.value, 10) || 4));
          liveUpdateFn();
        };
        break;
      }

      case 'threshold': {
        defaultParams = { cutoff: 128 };
        currentParams = Object.assign({}, defaultParams, initialParams || (adjLayer ? adjLayer.adjustmentParams : {}));

        bodyEl.innerHTML = `
          <div class="adj-control-row">
            <div class="adj-control-header">
              <strong>Threshold Level:</strong>
              <span class="adj-val-badge" id="val-adj-threshold">${currentParams.cutoff}</span>
            </div>
            <div class="adj-slider-row">
              <input type="range" id="slider-adj-threshold" min="1" max="255" value="${currentParams.cutoff}">
              <input type="number" id="num-adj-threshold" class="adj-num-input" min="1" max="255" value="${currentParams.cutoff}">
            </div>
            <div class="adj-desc-hint">Converts grayscale/color pixels to high-contrast black and white based on luminance threshold.</div>
          </div>
        `;

        const s = document.getElementById('slider-adj-threshold');
        const n = document.getElementById('num-adj-threshold');
        const v = document.getElementById('val-adj-threshold');

        liveUpdateFn = () => {
          const cut = parseInt(s.value, 10) || 128;
          currentParams.cutoff = cut;
          v.textContent = cut;
          n.value = cut;

          if (chkLivePreview && !chkLivePreview.checked) return;

          if (isAdjLayer && adjLayer) {
            adjLayer.adjustmentParams = { cutoff: cut };
            this.renderComposite();
          } else {
            this.applyFilterPreview((imgData) => Filters.threshold(imgData, cut));
          }
        };

        s.oninput = liveUpdateFn;
        n.oninput = () => {
          s.value = Math.max(1, Math.min(255, parseInt(n.value, 10) || 128));
          liveUpdateFn();
        };
        break;
      }

      case 'brightness-contrast':
      case 'brightnessContrast': {
        defaultParams = { brightness: 0, contrast: 0 };
        currentParams = Object.assign({}, defaultParams, initialParams || (adjLayer ? adjLayer.adjustmentParams : {}));

        bodyEl.innerHTML = `
          <div class="adj-control-row">
            <div class="adj-control-header">
              <strong>Brightness:</strong>
              <span class="adj-val-badge" id="val-adj-brightness">${currentParams.brightness}</span>
            </div>
            <div class="adj-slider-row">
              <input type="range" id="slider-adj-brightness" min="-100" max="100" value="${currentParams.brightness}">
              <input type="number" id="num-adj-brightness" class="adj-num-input" min="-100" max="100" value="${currentParams.brightness}">
            </div>
          </div>
          <div class="adj-control-row">
            <div class="adj-control-header">
              <strong>Contrast:</strong>
              <span class="adj-val-badge" id="val-adj-contrast">${currentParams.contrast}</span>
            </div>
            <div class="adj-slider-row">
              <input type="range" id="slider-adj-contrast" min="-100" max="100" value="${currentParams.contrast}">
              <input type="number" id="num-adj-contrast" class="adj-num-input" min="-100" max="100" value="${currentParams.contrast}">
            </div>
          </div>
        `;

        const sB = document.getElementById('slider-adj-brightness');
        const nB = document.getElementById('num-adj-brightness');
        const vB = document.getElementById('val-adj-brightness');
        const sC = document.getElementById('slider-adj-contrast');
        const nC = document.getElementById('num-adj-contrast');
        const vC = document.getElementById('val-adj-contrast');

        liveUpdateFn = () => {
          const b = parseInt(sB.value, 10) || 0;
          const c = parseInt(sC.value, 10) || 0;
          currentParams.brightness = b;
          currentParams.contrast = c;
          vB.textContent = b;
          nB.value = b;
          vC.textContent = c;
          nC.value = c;

          if (chkLivePreview && !chkLivePreview.checked) return;

          if (isAdjLayer && adjLayer) {
            adjLayer.adjustmentParams = { brightness: b, contrast: c };
            this.renderComposite();
          } else {
            this.applyFilterPreview((imgData) => Filters.brightnessContrast(imgData, b, c));
          }
        };

        sB.oninput = liveUpdateFn;
        nB.oninput = () => { sB.value = Math.max(-100, Math.min(100, parseInt(nB.value, 10) || 0)); liveUpdateFn(); };
        sC.oninput = liveUpdateFn;
        nC.oninput = () => { sC.value = Math.max(-100, Math.min(100, parseInt(nC.value, 10) || 0)); liveUpdateFn(); };
        break;
      }

      case 'hue-saturation':
      case 'hueSaturation': {
        defaultParams = { hue: 0, saturation: 0, lightness: 0 };
        currentParams = Object.assign({}, defaultParams, initialParams || (adjLayer ? adjLayer.adjustmentParams : {}));

        bodyEl.innerHTML = `
          <div class="adj-control-row">
            <div class="adj-control-header">
              <strong>Hue:</strong>
              <span class="adj-val-badge" id="val-adj-hue">${currentParams.hue}°</span>
            </div>
            <div class="adj-slider-row">
              <input type="range" id="slider-adj-hue" min="-180" max="180" value="${currentParams.hue}">
              <input type="number" id="num-adj-hue" class="adj-num-input" min="-180" max="180" value="${currentParams.hue}">
            </div>
          </div>
          <div class="adj-control-row">
            <div class="adj-control-header">
              <strong>Saturation:</strong>
              <span class="adj-val-badge" id="val-adj-sat">${currentParams.saturation}%</span>
            </div>
            <div class="adj-slider-row">
              <input type="range" id="slider-adj-sat" min="-100" max="100" value="${currentParams.saturation}">
              <input type="number" id="num-adj-sat" class="adj-num-input" min="-100" max="100" value="${currentParams.saturation}">
            </div>
          </div>
          <div class="adj-control-row">
            <div class="adj-control-header">
              <strong>Lightness:</strong>
              <span class="adj-val-badge" id="val-adj-lightness">${currentParams.lightness}%</span>
            </div>
            <div class="adj-slider-row">
              <input type="range" id="slider-adj-lightness" min="-100" max="100" value="${currentParams.lightness}">
              <input type="number" id="num-adj-lightness" class="adj-num-input" min="-100" max="100" value="${currentParams.lightness}">
            </div>
          </div>
        `;

        const sH = document.getElementById('slider-adj-hue');
        const nH = document.getElementById('num-adj-hue');
        const vH = document.getElementById('val-adj-hue');
        const sS = document.getElementById('slider-adj-sat');
        const nS = document.getElementById('num-adj-sat');
        const vS = document.getElementById('val-adj-sat');
        const sL = document.getElementById('slider-adj-lightness');
        const nL = document.getElementById('num-adj-lightness');
        const vL = document.getElementById('val-adj-lightness');

        liveUpdateFn = () => {
          const h = parseInt(sH.value, 10) || 0;
          const sat = parseInt(sS.value, 10) || 0;
          const l = parseInt(sL.value, 10) || 0;
          currentParams.hue = h;
          currentParams.saturation = sat;
          currentParams.lightness = l;
          vH.textContent = h + '°';
          nH.value = h;
          vS.textContent = sat + '%';
          nS.value = sat;
          vL.textContent = l + '%';
          nL.value = l;

          if (chkLivePreview && !chkLivePreview.checked) return;

          if (isAdjLayer && adjLayer) {
            adjLayer.adjustmentParams = { hue: h, saturation: sat, lightness: l };
            this.renderComposite();
          } else {
            this.applyFilterPreview((imgData) => Filters.hueSaturation(imgData, h, sat, l));
          }
        };

        sH.oninput = liveUpdateFn;
        nH.oninput = () => { sH.value = Math.max(-180, Math.min(180, parseInt(nH.value, 10) || 0)); liveUpdateFn(); };
        sS.oninput = liveUpdateFn;
        nS.oninput = () => { sS.value = Math.max(-100, Math.min(100, parseInt(nS.value, 10) || 0)); liveUpdateFn(); };
        sL.oninput = liveUpdateFn;
        nL.oninput = () => { sL.value = Math.max(-100, Math.min(100, parseInt(nL.value, 10) || 0)); liveUpdateFn(); };
        break;
      }

      case 'vibrance': {
        defaultParams = { vibrance: 0, saturation: 0 };
        currentParams = Object.assign({}, defaultParams, initialParams || (adjLayer ? adjLayer.adjustmentParams : {}));

        bodyEl.innerHTML = `
          <div class="adj-control-row">
            <div class="adj-control-header">
              <strong>Vibrance:</strong>
              <span class="adj-val-badge" id="val-adj-vib">${currentParams.vibrance}</span>
            </div>
            <div class="adj-slider-row">
              <input type="range" id="slider-adj-vib" min="-100" max="100" value="${currentParams.vibrance}">
              <input type="number" id="num-adj-vib" class="adj-num-input" min="-100" max="100" value="${currentParams.vibrance}">
            </div>
          </div>
          <div class="adj-control-row">
            <div class="adj-control-header">
              <strong>Saturation:</strong>
              <span class="adj-val-badge" id="val-adj-vib-sat">${currentParams.saturation}</span>
            </div>
            <div class="adj-slider-row">
              <input type="range" id="slider-adj-vib-sat" min="-100" max="100" value="${currentParams.saturation}">
              <input type="number" id="num-adj-vib-sat" class="adj-num-input" min="-100" max="100" value="${currentParams.saturation}">
            </div>
          </div>
        `;

        const sV = document.getElementById('slider-adj-vib');
        const nV = document.getElementById('num-adj-vib');
        const vV = document.getElementById('val-adj-vib');
        const sS = document.getElementById('slider-adj-vib-sat');
        const nS = document.getElementById('num-adj-vib-sat');
        const vS = document.getElementById('val-adj-vib-sat');

        liveUpdateFn = () => {
          const vib = parseInt(sV.value, 10) || 0;
          const sat = parseInt(sS.value, 10) || 0;
          currentParams.vibrance = vib;
          currentParams.saturation = sat;
          vV.textContent = vib;
          nV.value = vib;
          vS.textContent = sat;
          nS.value = sat;

          if (chkLivePreview && !chkLivePreview.checked) return;

          if (isAdjLayer && adjLayer) {
            adjLayer.adjustmentParams = { vibrance: vib, saturation: sat };
            this.renderComposite();
          } else {
            this.applyFilterPreview((imgData) => Filters.vibrance(imgData, vib, sat));
          }
        };

        sV.oninput = liveUpdateFn;
        nV.oninput = () => { sV.value = Math.max(-100, Math.min(100, parseInt(nV.value, 10) || 0)); liveUpdateFn(); };
        sS.oninput = liveUpdateFn;
        nS.oninput = () => { sS.value = Math.max(-100, Math.min(100, parseInt(nS.value, 10) || 0)); liveUpdateFn(); };
        break;
      }

      case 'color-balance':
      case 'colorBalance': {
        defaultParams = {
          tone: 'midtones',
          shadows: { cyanRed: 0, magentaGreen: 0, yellowBlue: 0 },
          midtones: { cyanRed: 0, magentaGreen: 0, yellowBlue: 0 },
          highlights: { cyanRed: 0, magentaGreen: 0, yellowBlue: 0 },
          preserveLuminosity: true
        };
        currentParams = Object.assign({}, defaultParams, initialParams || (adjLayer ? adjLayer.adjustmentParams : {}));

        let activeTone = 'midtones';

        bodyEl.innerHTML = `
          <div class="adj-tones-tabs">
            <button class="adj-tone-tab" data-tone="shadows">Shadows</button>
            <button class="adj-tone-tab active" data-tone="midtones">Midtones</button>
            <button class="adj-tone-tab" data-tone="highlights">Highlights</button>
          </div>
          <div class="adj-control-row">
            <div class="adj-control-header">
              <span>Cyan ⇄ Red</span>
              <span class="adj-val-badge" id="val-adj-cb-cr">0</span>
            </div>
            <div class="adj-slider-row">
              <input type="range" id="slider-adj-cb-cr" min="-100" max="100" value="0">
            </div>
          </div>
          <div class="adj-control-row">
            <div class="adj-control-header">
              <span>Magenta ⇄ Green</span>
              <span class="adj-val-badge" id="val-adj-cb-mg">0</span>
            </div>
            <div class="adj-slider-row">
              <input type="range" id="slider-adj-cb-mg" min="-100" max="100" value="0">
            </div>
          </div>
          <div class="adj-control-row">
            <div class="adj-control-header">
              <span>Yellow ⇄ Blue</span>
              <span class="adj-val-badge" id="val-adj-cb-yb">0</span>
            </div>
            <div class="adj-slider-row">
              <input type="range" id="slider-adj-cb-yb" min="-100" max="100" value="0">
            </div>
          </div>
          <div style="margin-top:6px;">
            <label class="checkbox-label">
              <input type="checkbox" id="chk-adj-cb-lum" ${currentParams.preserveLuminosity ? 'checked' : ''}> Preserve Luminosity
            </label>
          </div>
        `;

        const sCR = document.getElementById('slider-adj-cb-cr');
        const vCR = document.getElementById('val-adj-cb-cr');
        const sMG = document.getElementById('slider-adj-cb-mg');
        const vMG = document.getElementById('val-adj-cb-mg');
        const sYB = document.getElementById('slider-adj-cb-yb');
        const vYB = document.getElementById('val-adj-cb-yb');
        const chkLum = document.getElementById('chk-adj-cb-lum');

        const syncToneInputs = () => {
          const t = currentParams[activeTone] || { cyanRed: 0, magentaGreen: 0, yellowBlue: 0 };
          sCR.value = t.cyanRed; vCR.textContent = t.cyanRed;
          sMG.value = t.magentaGreen; vMG.textContent = t.magentaGreen;
          sYB.value = t.yellowBlue; vYB.textContent = t.yellowBlue;
        };

        bodyEl.querySelectorAll('.adj-tone-tab').forEach(tab => {
          tab.onclick = () => {
            bodyEl.querySelectorAll('.adj-tone-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            activeTone = tab.dataset.tone;
            syncToneInputs();
          };
        });

        liveUpdateFn = () => {
          if (!currentParams[activeTone]) currentParams[activeTone] = {};
          currentParams[activeTone].cyanRed = parseInt(sCR.value, 10) || 0;
          currentParams[activeTone].magentaGreen = parseInt(sMG.value, 10) || 0;
          currentParams[activeTone].yellowBlue = parseInt(sYB.value, 10) || 0;
          currentParams.preserveLuminosity = chkLum ? chkLum.checked : true;

          vCR.textContent = sCR.value;
          vMG.textContent = sMG.value;
          vYB.textContent = sYB.value;

          if (chkLivePreview && !chkLivePreview.checked) return;

          if (isAdjLayer && adjLayer) {
            adjLayer.adjustmentParams = JSON.parse(JSON.stringify(currentParams));
            this.renderComposite();
          } else {
            this.applyFilterPreview((imgData) => Filters.colorBalance(imgData, currentParams));
          }
        };

        sCR.oninput = liveUpdateFn;
        sMG.oninput = liveUpdateFn;
        sYB.oninput = liveUpdateFn;
        if (chkLum) chkLum.onchange = liveUpdateFn;
        syncToneInputs();
        break;
      }

      case 'photo-filter':
      case 'photoFilter': {
        defaultParams = { color: '#ec800d', density: 25, preserveLuminosity: true };
        currentParams = Object.assign({}, defaultParams, initialParams || (adjLayer ? adjLayer.adjustmentParams : {}));

        bodyEl.innerHTML = `
          <div class="adj-control-row">
            <div class="adj-control-header">
              <strong>Filter Tint:</strong>
              <input type="color" id="adj-pf-color" value="${currentParams.color}" style="width:36px; height:24px; border:none; border-radius:4px; cursor:pointer;">
            </div>
            <select id="adj-pf-preset" style="background:var(--bg-canvas); border:1px solid var(--border-color); color:var(--text-main); padding:3px 6px; border-radius:4px; font-size:11px;">
              <option value="#ec800d">Warming Filter (85)</option>
              <option value="#e69624">Warming Filter (LBA)</option>
              <option value="#1c86ee">Cooling Filter (80)</option>
              <option value="#a85124">Sepia</option>
              <option value="#22c55e">Emerald Green</option>
              <option value="#ef4444">Deep Red</option>
              <option value="custom">Custom Color</option>
            </select>
          </div>
          <div class="adj-control-row">
            <div class="adj-control-header">
              <strong>Density:</strong>
              <span class="adj-val-badge" id="val-adj-pf-density">${currentParams.density}%</span>
            </div>
            <div class="adj-slider-row">
              <input type="range" id="slider-adj-pf-density" min="1" max="100" value="${currentParams.density}">
              <input type="number" id="num-adj-pf-density" class="adj-num-input" min="1" max="100" value="${currentParams.density}">
            </div>
          </div>
          <div style="margin-top:4px;">
            <label class="checkbox-label">
              <input type="checkbox" id="chk-adj-pf-lum" ${currentParams.preserveLuminosity ? 'checked' : ''}> Preserve Luminosity
            </label>
          </div>
        `;

        const colEl = document.getElementById('adj-pf-color');
        const preEl = document.getElementById('adj-pf-preset');
        const sD = document.getElementById('slider-adj-pf-density');
        const nD = document.getElementById('num-adj-pf-density');
        const vD = document.getElementById('val-adj-pf-density');
        const chkL = document.getElementById('chk-adj-pf-lum');

        liveUpdateFn = () => {
          const col = colEl.value;
          const dens = parseInt(sD.value, 10) || 25;
          const lum = chkL ? chkL.checked : true;
          currentParams.color = col;
          currentParams.density = dens;
          currentParams.preserveLuminosity = lum;

          vD.textContent = dens + '%';
          nD.value = dens;

          if (chkLivePreview && !chkLivePreview.checked) return;

          if (isAdjLayer && adjLayer) {
            adjLayer.adjustmentParams = { color: col, density: dens, preserveLuminosity: lum };
            this.renderComposite();
          } else {
            this.applyFilterPreview((imgData) => Filters.photoFilter(imgData, col, dens, lum));
          }
        };

        colEl.oninput = () => { preEl.value = 'custom'; liveUpdateFn(); };
        preEl.onchange = () => {
          if (preEl.value !== 'custom') {
            colEl.value = preEl.value;
            liveUpdateFn();
          }
        };
        sD.oninput = liveUpdateFn;
        nD.oninput = () => { sD.value = Math.max(1, Math.min(100, parseInt(nD.value, 10) || 25)); liveUpdateFn(); };
        if (chkL) chkL.onchange = liveUpdateFn;
        break;
      }

      case 'gaussian-blur': {
        defaultParams = { radius: 5 };
        currentParams = Object.assign({}, defaultParams, initialParams || {});

        bodyEl.innerHTML = `
          <div class="adj-control-row">
            <div class="adj-control-header">
              <strong>Radius:</strong>
              <span class="adj-val-badge" id="val-adj-blur">${currentParams.radius} px</span>
            </div>
            <div class="adj-slider-row">
              <input type="range" id="slider-adj-blur" min="1" max="100" value="${currentParams.radius}">
              <input type="number" id="num-adj-blur" class="adj-num-input" min="1" max="100" value="${currentParams.radius}">
            </div>
          </div>
        `;

        const s = document.getElementById('slider-adj-blur');
        const n = document.getElementById('num-adj-blur');
        const v = document.getElementById('val-adj-blur');

        liveUpdateFn = () => {
          const r = parseInt(s.value, 10) || 5;
          currentParams.radius = r;
          v.textContent = r + ' px';
          n.value = r;

          if (chkLivePreview && !chkLivePreview.checked) return;
          this.applyFilterPreview((imgData) => Filters.gaussianBlur(imgData, r));
        };

        s.oninput = liveUpdateFn;
        n.oninput = () => { s.value = Math.max(1, Math.min(100, parseInt(n.value, 10) || 5)); liveUpdateFn(); };
        break;
      }

      default: {
        bodyEl.innerHTML = `<div class="adj-desc-hint">Adjusting parameters for ${title}. Live preview is active.</div>`;
        break;
      }
    }

    // Live preview checkbox listener
    if (chkLivePreview) {
      chkLivePreview.onchange = () => {
        if (chkLivePreview.checked) {
          liveUpdateFn();
        } else {
          if (isAdjLayer && adjLayer) {
            adjLayer.adjustmentParams = this.adjustmentBackupParams;
            this.renderComposite();
          } else {
            this.cancelFilterPreview();
            this.startFilterPreview();
          }
        }
      };
    }

    // Reset button
    const handleReset = () => {
      Object.assign(currentParams, defaultParams);
      this.openAdjustmentInspector(normalizedType, defaultParams, targetAdjLayer);
      liveUpdateFn();
    };
    if (btnReset) btnReset.onclick = handleReset;

    // Apply & Commit handler
    const handleCommit = () => {
      if (isAdjLayer && adjLayer) {
        adjLayer.adjustmentParams = JSON.parse(JSON.stringify(currentParams));
        this.pushHistoryState('Edit Adjustment: ' + (adjLayer.name || title));
        this.editingAdjustmentLayer = null;
        this.adjustmentBackupParams = null;
        this.renderComposite();
      } else {
        this.commitFilterPreview(title);
      }
      panel.style.display = 'none';
      this.activeAdjustmentInspectorType = null;
    };
    if (btnApplyHeader) btnApplyHeader.onclick = handleCommit;
    if (btnApplyBottom) btnApplyBottom.onclick = handleCommit;

    // Cancel & Close handler
    const handleCancel = () => {
      if (isAdjLayer && adjLayer) {
        adjLayer.adjustmentParams = this.adjustmentBackupParams;
        this.renderComposite();
        this.editingAdjustmentLayer = null;
        this.adjustmentBackupParams = null;
      } else {
        this.cancelFilterPreview();
      }
      panel.style.display = 'none';
      this.activeAdjustmentInspectorType = null;
    };
    if (btnCloseHeader) btnCloseHeader.onclick = handleCancel;
    if (btnCancelBottom) btnCancelBottom.onclick = handleCancel;

    // Hotkeys handler
    const handleKeydown = (e) => {
      if (panel.style.display !== 'none') {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleCommit();
          window.removeEventListener('keydown', handleKeydown);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          handleCancel();
          window.removeEventListener('keydown', handleKeydown);
        }
      }
    };
    window.addEventListener('keydown', handleKeydown);

    // Initial Live Preview invocation
    liveUpdateFn();

    // Show Panel
    panel.style.display = 'flex';
    this.activeAdjustmentInspectorType = normalizedType;
  }

  // ── Dialog Modals ──
  showModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove('hidden');
  }

  // ── Camera Raw & Photo Grading Filter Controller ──
  openCameraRawDialog() {
    const active = this.layerManager.getActiveLayer();
    if (!active || active.isGroup) {
      alert('Please select a valid raster or smart object layer for Camera Raw filtering.');
      return;
    }

    const modal = document.getElementById('modal-camera-raw');
    const previewCanvas = document.getElementById('camera-raw-preview-canvas');
    if (!modal || !previewCanvas) return;

    const pCtx = previewCanvas.getContext('2d');
    const pw = previewCanvas.width;
    const ph = previewCanvas.height;

    // Grab pristine snapshot for preview
    const sourceCanvas = active.type === 'smart-object' && active.smartObjectData 
      ? active.smartObjectData.sourceCanvas 
      : active.canvas;

    const origPreviewCanvas = Utils.createCanvas(pw, ph);
    const origCtx = origPreviewCanvas.getContext('2d');
    origCtx.drawImage(sourceCanvas, 0, 0, pw, ph);

    let isSplitView = false;
    const params = {
      temperature: 0,
      tint: 0,
      exposure: 0,
      contrast: 0,
      highlights: 0,
      shadows: 0,
      whites: 0,
      blacks: 0,
      clarity: 0,
      dehaze: 0,
      vibrance: 0,
      saturation: 0,
      vignette: 0
    };

    // If active layer is smart-object, check if cameraRaw filter already exists in stack
    if (active.type === 'smart-object' && active.smartObjectData) {
      const existingFilter = active.smartObjectData.filterStack.find(f => f.type === 'cameraRaw');
      if (existingFilter && existingFilter.params) {
        Object.assign(params, existingFilter.params);
      }
    }

    const controls = [
      { id: 'cr-temperature', valId: 'val-cr-temp', prop: 'temperature', fmt: v => v > 0 ? `+${v}` : `${v}` },
      { id: 'cr-tint', valId: 'val-cr-tint', prop: 'tint', fmt: v => v > 0 ? `+${v}` : `${v}` },
      { id: 'cr-exposure', valId: 'val-cr-exp', prop: 'exposure', fmt: v => `${(v / 25).toFixed(1)} EV` },
      { id: 'cr-contrast', valId: 'val-cr-contrast', prop: 'contrast', fmt: v => v > 0 ? `+${v}` : `${v}` },
      { id: 'cr-highlights', valId: 'val-cr-highlights', prop: 'highlights', fmt: v => v > 0 ? `+${v}` : `${v}` },
      { id: 'cr-shadows', valId: 'val-cr-shadows', prop: 'shadows', fmt: v => v > 0 ? `+${v}` : `${v}` },
      { id: 'cr-whites', valId: 'val-cr-whites', prop: 'whites', fmt: v => v > 0 ? `+${v}` : `${v}` },
      { id: 'cr-blacks', valId: 'val-cr-blacks', prop: 'blacks', fmt: v => v > 0 ? `+${v}` : `${v}` },
      { id: 'cr-clarity', valId: 'val-cr-clarity', prop: 'clarity', fmt: v => v > 0 ? `+${v}` : `${v}` },
      { id: 'cr-dehaze', valId: 'val-cr-dehaze', prop: 'dehaze', fmt: v => v > 0 ? `+${v}` : `${v}` },
      { id: 'cr-vibrance', valId: 'val-cr-vibrance', prop: 'vibrance', fmt: v => v > 0 ? `+${v}` : `${v}` },
      { id: 'cr-saturation', valId: 'val-cr-saturation', prop: 'saturation', fmt: v => v > 0 ? `+${v}` : `${v}` },
      { id: 'cr-vignette', valId: 'val-cr-vignette', prop: 'vignette', fmt: v => v > 0 ? `+${v}` : `${v}` }
    ];

    const updatePreview = () => {
      const baseImg = origCtx.getImageData(0, 0, pw, ph);
      const graded = Filters.cameraRaw(baseImg, params);

      pCtx.clearRect(0, 0, pw, ph);
      if (!isSplitView) {
        pCtx.putImageData(graded, 0, 0);
      } else {
        const halfW = Math.round(pw / 2);
        pCtx.drawImage(origPreviewCanvas, 0, 0);
        const tempC = Utils.createCanvas(pw, ph);
        tempC.getContext('2d').putImageData(graded, 0, 0);
        pCtx.drawImage(tempC, halfW, 0, pw - halfW, ph, halfW, 0, pw - halfW, ph);
        pCtx.strokeStyle = '#3b82f6';
        pCtx.lineWidth = 1;
        pCtx.beginPath();
        pCtx.moveTo(halfW, 0);
        pCtx.lineTo(halfW, ph);
        pCtx.stroke();
      }
    };

    controls.forEach(c => {
      const el = document.getElementById(c.id);
      const valEl = document.getElementById(c.valId);
      if (el) {
        el.value = params[c.prop] || 0;
        if (valEl) valEl.textContent = c.fmt ? c.fmt(el.value) : el.value;
        el.oninput = () => {
          params[c.prop] = parseFloat(el.value);
          if (valEl) valEl.textContent = c.fmt ? c.fmt(el.value) : el.value;
          updatePreview();
        };
      }
    });

    const btnSplit = document.getElementById('btn-camera-raw-split');
    if (btnSplit) {
      btnSplit.onclick = () => {
        isSplitView = !isSplitView;
        btnSplit.classList.toggle('active', isSplitView);
        updatePreview();
      };
    }

    const btnReset = document.getElementById('btn-camera-raw-reset');
    if (btnReset) {
      btnReset.onclick = () => {
        controls.forEach(c => {
          params[c.prop] = 0;
          const el = document.getElementById(c.id);
          const valEl = document.getElementById(c.valId);
          if (el) el.value = 0;
          if (valEl) valEl.textContent = c.fmt ? c.fmt(0) : '0';
        });
        updatePreview();
      };
    }

    const btnApply = document.getElementById('btn-camera-raw-apply');
    if (btnApply) {
      btnApply.onclick = () => {
        modal.classList.add('hidden');
        if (active.type === 'smart-object' && active.smartObjectData) {
          active.smartObjectData.addFilter(new SmartFilter('cameraRaw', params));
          active.smartObjectData.renderToLayer(active);
        } else {
          const fullImg = active.ctx.getImageData(0, 0, this.width, this.height);
          const gradedFull = Filters.cameraRaw(fullImg, params);
          active.ctx.putImageData(gradedFull, 0, 0);
        }
        this.renderComposite();
        this.pushHistoryState('Camera Raw Filter');
      };
    }

    updatePreview();
    modal.classList.remove('hidden');
  }

  bindDialogModals() {
    document.querySelectorAll('.modal-close-btn, .modal-cancel-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (this.editingAdjustmentLayer) {
          this.editingAdjustmentLayer.adjustmentParams = this.adjustmentBackupParams;
          this.editingAdjustmentLayer = null;
          this.adjustmentBackupParams = null;
          this.renderComposite();
        } else {
          this.cancelFilterPreview();
        }
        btn.closest('.modal-backdrop').classList.add('hidden');
      });
    });

    // Smart Object Editor Done Button
    const btnSoDone = document.getElementById('btn-close-smart-object-editor');
    if (btnSoDone) {
      btnSoDone.addEventListener('click', () => {
        const modal = document.getElementById('modal-smart-object-editor');
        if (modal) modal.classList.add('hidden');
        if (this.smartObjectManager && this.smartObjectManager.editingLayer) {
          const l = this.smartObjectManager.editingLayer;
          if (l.smartObjectData) {
            l.smartObjectData.renderToLayer(l);
            this.renderComposite();
          }
          this.smartObjectManager.editingLayer = null;
        }
      });
    }

    // New Canvas Modal
    const presetSelect = document.getElementById('new-preset-select');
    const wInput = document.getElementById('new-canvas-width');
    const hInput = document.getElementById('new-canvas-height');
    const bgSelect = document.getElementById('new-canvas-bg');

    presetSelect.addEventListener('change', () => {
      const val = presetSelect.value;
      if (val !== 'custom') {
        const [w, h] = val.split('x').map(Number);
        wInput.value = w;
        hInput.value = h;
      }
    });

    document.getElementById('btn-create-canvas').addEventListener('click', () => {
      const w = parseInt(wInput.value, 10) || 1920;
      const h = parseInt(hInput.value, 10) || 1080;
      this.createDocument(w, h, bgSelect.value);
      this.hideModal('modal-new-canvas');
      this.zoomFit();
    });

    // Color Balance Modal
    const cbState = {
      shadows: { cyanRed: 0, magGreen: 0, yelBlue: 0 },
      midtones: { cyanRed: 0, magGreen: 0, yelBlue: 0 },
      highlights: { cyanRed: 0, magGreen: 0, yelBlue: 0 }
    };
    let cbCurrentRange = 'midtones';

    const cbSliderCR = document.getElementById('cb-cyan-red');
    const cbSliderMG = document.getElementById('cb-mag-green');
    const cbSliderYB = document.getElementById('cb-yel-blue');
    const cbValCR = document.getElementById('val-cb-cyan-red');
    const cbValMG = document.getElementById('val-cb-mag-green');
    const cbValYB = document.getElementById('val-cb-yel-blue');
    const cbPreserveLum = document.getElementById('cb-preserve-lum');

    const syncCbSliders = () => {
      const cur = cbState[cbCurrentRange];
      cbSliderCR.value = cur.cyanRed;
      cbValCR.textContent = cur.cyanRed;
      cbSliderMG.value = cur.magGreen;
      cbValMG.textContent = cur.magGreen;
      cbSliderYB.value = cur.yelBlue;
      cbValYB.textContent = cur.yelBlue;
    };

    const updateCBPreview = () => {
      if (this.editingAdjustmentLayer) {
        this.editingAdjustmentLayer.adjustmentParams = {
          shadows: { ...cbState.shadows },
          midtones: { ...cbState.midtones },
          highlights: { ...cbState.highlights },
          preserveLum: cbPreserveLum ? cbPreserveLum.checked : true
        };
        this.renderComposite();
      } else {
        this.applyFilterPreview((imgData) =>
          Filters.colorBalance(imgData, cbState.shadows, cbState.midtones, cbState.highlights, cbPreserveLum ? cbPreserveLum.checked : true)
        );
      }
    };

    document.querySelectorAll('.cb-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.cb-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        cbCurrentRange = tab.dataset.range;
        syncCbSliders();
      });
    });

    if (cbSliderCR) {
      cbSliderCR.addEventListener('input', () => {
        cbState[cbCurrentRange].cyanRed = parseInt(cbSliderCR.value, 10);
        cbValCR.textContent = cbSliderCR.value;
        updateCBPreview();
      });
    }
    if (cbSliderMG) {
      cbSliderMG.addEventListener('input', () => {
        cbState[cbCurrentRange].magGreen = parseInt(cbSliderMG.value, 10);
        cbValMG.textContent = cbSliderMG.value;
        updateCBPreview();
      });
    }
    if (cbSliderYB) {
      cbSliderYB.addEventListener('input', () => {
        cbState[cbCurrentRange].yelBlue = parseInt(cbSliderYB.value, 10);
        cbValYB.textContent = cbSliderYB.value;
        updateCBPreview();
      });
    }
    if (cbPreserveLum) {
      cbPreserveLum.addEventListener('change', updateCBPreview);
    }

    const btnApplyCB = document.getElementById('btn-apply-color-balance');
    if (btnApplyCB) {
      btnApplyCB.addEventListener('click', () => {
        if (this.editingAdjustmentLayer) {
          this.pushHistoryState('Edit Adjustment: ' + this.editingAdjustmentLayer.name);
          this.editingAdjustmentLayer = null;
          this.adjustmentBackupParams = null;
        } else {
          this.commitFilterPreview('Color Balance');
        }
        this.hideModal('modal-color-balance');
      });
    }

    // Vibrance Modal
    const vibVib = document.getElementById('vib-vibrance');
    const vibSat = document.getElementById('vib-saturation');
    const updateVibPreview = () => {
      const v = parseInt(vibVib.value, 10) || 0;
      const s = parseInt(vibSat.value, 10) || 0;
      if (this.editingAdjustmentLayer) {
        this.editingAdjustmentLayer.adjustmentParams = { vibrance: v, saturation: s };
        this.renderComposite();
      } else {
        this.applyFilterPreview((imgData) => Filters.vibrance(imgData, v, s));
      }
    };
    if (vibVib) {
      vibVib.addEventListener('input', () => {
        document.getElementById('val-vib-vibrance').textContent = vibVib.value;
        updateVibPreview();
      });
    }
    if (vibSat) {
      vibSat.addEventListener('input', () => {
        document.getElementById('val-vib-saturation').textContent = vibSat.value;
        updateVibPreview();
      });
    }
    const btnApplyVib = document.getElementById('btn-apply-vibrance');
    if (btnApplyVib) {
      btnApplyVib.addEventListener('click', () => {
        if (this.editingAdjustmentLayer) {
          this.pushHistoryState('Edit Adjustment: ' + this.editingAdjustmentLayer.name);
          this.editingAdjustmentLayer = null;
          this.adjustmentBackupParams = null;
        } else {
          this.commitFilterPreview('Vibrance');
        }
        this.hideModal('modal-vibrance');
      });
    }

    // Photo Filter Modal
    const pfPreset = document.getElementById('pf-preset');
    const pfColorRow = document.getElementById('pf-color-row');
    const pfColor = document.getElementById('pf-color');
    const pfDensity = document.getElementById('pf-density');
    const pfPreserveLum = document.getElementById('pf-preserve-lum');

    const updatePhotoFilterPreview = () => {
      const density = parseInt(pfDensity ? pfDensity.value : 25, 10) || 25;
      const presLum = pfPreserveLum ? pfPreserveLum.checked : true;
      let r = 234, g = 138, b = 40;

      const preset = pfPreset ? pfPreset.value : 'warm-85';
      switch (preset) {
        case 'warm-85': r = 234; g = 138; b = 40; break;
        case 'warm-81': r = 235; g = 178; b = 43; break;
        case 'cool-80': r = 0; g = 109; b = 255; break;
        case 'cool-82': r = 0; g = 181; b = 255; break;
        case 'sepia': r = 162; g = 138; b = 101; break;
        case 'emerald': r = 34; g = 197; b = 94; break;
        case 'deep-blue': r = 30; g = 58; b = 138; break;
        case 'custom':
          if (pfColor) {
            const rgb = Utils.hexToRgb(pfColor.value);
            r = rgb.r; g = rgb.g; b = rgb.b;
          }
          break;
      }

      if (this.editingAdjustmentLayer) {
        this.editingAdjustmentLayer.adjustmentParams = { r, g, b, density, preserveLum: presLum };
        this.renderComposite();
      } else {
        this.applyFilterPreview((imgData) => Filters.photoFilter(imgData, r, g, b, density, presLum));
      }
    };

    if (pfPreset) {
      pfPreset.addEventListener('change', () => {
        if (pfColorRow) pfColorRow.style.display = pfPreset.value === 'custom' ? 'flex' : 'none';
        updatePhotoFilterPreview();
      });
    }
    if (pfColor) {
      pfColor.addEventListener('input', updatePhotoFilterPreview);
    }
    if (pfDensity) {
      pfDensity.addEventListener('input', () => {
        document.getElementById('val-pf-density').textContent = pfDensity.value + '%';
        updatePhotoFilterPreview();
      });
    }
    if (pfPreserveLum) {
      pfPreserveLum.addEventListener('change', updatePhotoFilterPreview);
    }
    const btnApplyPF = document.getElementById('btn-apply-photo-filter');
    if (btnApplyPF) {
      btnApplyPF.addEventListener('click', () => {
        if (this.editingAdjustmentLayer) {
          this.pushHistoryState('Edit Adjustment: ' + this.editingAdjustmentLayer.name);
          this.editingAdjustmentLayer = null;
          this.adjustmentBackupParams = null;
        } else {
          this.commitFilterPreview('Photo Filter');
        }
        this.hideModal('modal-photo-filter');
      });
    }

    // Threshold Modal
    const threshCut = document.getElementById('threshold-cutoff');
    const updateThreshPreview = () => {
      const cutoff = parseInt(threshCut ? threshCut.value : 128, 10) || 128;
      if (this.editingAdjustmentLayer) {
        this.editingAdjustmentLayer.adjustmentParams = { cutoff };
        this.renderComposite();
      } else {
        this.applyFilterPreview((imgData) => Filters.threshold(imgData, cutoff));
      }
    };
    if (threshCut) {
      threshCut.addEventListener('input', () => {
        document.getElementById('val-threshold-cutoff').textContent = threshCut.value;
        updateThreshPreview();
      });
    }
    const btnApplyThresh = document.getElementById('btn-apply-threshold');
    if (btnApplyThresh) {
      btnApplyThresh.addEventListener('click', () => {
        if (this.editingAdjustmentLayer) {
          this.pushHistoryState('Edit Adjustment: ' + this.editingAdjustmentLayer.name);
          this.editingAdjustmentLayer = null;
          this.adjustmentBackupParams = null;
        } else {
          this.commitFilterPreview('Threshold');
        }
        this.hideModal('modal-threshold');
      });
    }

    // Posterize Modal
    const postLevels = document.getElementById('posterize-levels');
    const updatePostPreview = () => {
      const levels = parseInt(postLevels ? postLevels.value : 4, 10) || 4;
      if (this.editingAdjustmentLayer) {
        this.editingAdjustmentLayer.adjustmentParams = { levels };
        this.renderComposite();
      } else {
        this.applyFilterPreview((imgData) => Filters.posterize(imgData, levels));
      }
    };
    if (postLevels) {
      postLevels.addEventListener('input', () => {
        document.getElementById('val-posterize-levels').textContent = postLevels.value;
        updatePostPreview();
      });
    }
    const btnApplyPost = document.getElementById('btn-apply-posterize');
    if (btnApplyPost) {
      btnApplyPost.addEventListener('click', () => {
        if (this.editingAdjustmentLayer) {
          this.pushHistoryState('Edit Adjustment: ' + this.editingAdjustmentLayer.name);
          this.editingAdjustmentLayer = null;
          this.adjustmentBackupParams = null;
        } else {
          this.commitFilterPreview('Posterize');
        }
        this.hideModal('modal-posterize');
      });
    }

    // Brightness / Contrast Modal
    const bSlider = document.getElementById('filter-brightness');
    const cSlider = document.getElementById('filter-contrast');
    const updateBCPreview = () => {
      const b = parseInt(bSlider.value, 10) || 0;
      const c = parseInt(cSlider.value, 10) || 0;
      if (this.editingAdjustmentLayer) {
        this.editingAdjustmentLayer.adjustmentParams = { brightness: b, contrast: c };
        this.renderComposite();
      } else {
        this.applyFilterPreview((imgData) => Filters.brightnessContrast(imgData, b, c));
      }
    };
    if (bSlider) {
      bSlider.addEventListener('input', () => {
        document.getElementById('val-filter-brightness').textContent = bSlider.value;
        updateBCPreview();
      });
    }
    if (cSlider) {
      cSlider.addEventListener('input', () => {
        document.getElementById('val-filter-contrast').textContent = cSlider.value;
        updateBCPreview();
      });
    }

    document.getElementById('btn-apply-brightness-contrast').addEventListener('click', () => {
      if (this.editingAdjustmentLayer) {
        this.pushHistoryState('Edit Adjustment: ' + this.editingAdjustmentLayer.name);
        this.editingAdjustmentLayer = null;
        this.adjustmentBackupParams = null;
      } else {
        this.commitFilterPreview('Brightness / Contrast');
      }
      this.hideModal('modal-brightness-contrast');
    });

    // Hue / Saturation Modal
    const hSlider = document.getElementById('filter-hue');
    const sSlider = document.getElementById('filter-sat');
    const updateHueSatPreview = () => {
      const h = parseInt(hSlider.value, 10) || 0;
      const s = parseInt(sSlider.value, 10) || 0;
      if (this.editingAdjustmentLayer) {
        this.editingAdjustmentLayer.adjustmentParams = { hue: h, saturation: s };
        this.renderComposite();
      } else {
        this.applyFilterPreview((imgData) => Filters.hueSaturation(imgData, h, s));
      }
    };
    if (hSlider) {
      hSlider.addEventListener('input', () => {
        document.getElementById('val-filter-hue').textContent = hSlider.value + '°';
        updateHueSatPreview();
      });
    }
    if (sSlider) {
      sSlider.addEventListener('input', () => {
        document.getElementById('val-filter-sat').textContent = sSlider.value + '%';
        updateHueSatPreview();
      });
    }

    document.getElementById('btn-apply-hue-saturation').addEventListener('click', () => {
      if (this.editingAdjustmentLayer) {
        this.pushHistoryState('Edit Adjustment: ' + this.editingAdjustmentLayer.name);
        this.editingAdjustmentLayer = null;
        this.adjustmentBackupParams = null;
      } else {
        this.commitFilterPreview('Hue / Saturation');
      }
      this.hideModal('modal-hue-saturation');
    });

    // Gaussian Blur Modal
    const blurSlider = document.getElementById('filter-blur');
    const updateBlurPreview = () => {
      const r = parseInt(blurSlider.value, 10) || 0;
      if (r <= 0) {
        if (this.filterBackupCanvas) {
          const active = this.layerManager.getActiveLayer();
          if (active) {
            active.ctx.clearRect(0, 0, this.width, this.height);
            active.ctx.drawImage(this.filterBackupCanvas, 0, 0);
            this.renderComposite();
          }
        }
        return;
      }
      this.applyFilterPreview((imgData) => Filters.gaussianBlur(imgData, r));
    };
    if (blurSlider) {
      blurSlider.addEventListener('input', () => {
        document.getElementById('val-filter-blur').textContent = blurSlider.value + 'px';
        updateBlurPreview();
      });
    }

    document.getElementById('btn-apply-gaussian-blur').addEventListener('click', () => {
      this.commitFilterPreview('Gaussian Blur');
      this.hideModal('modal-gaussian-blur');
    });

    // Motion Blur Modal
    const mbDist = document.getElementById('motion-distance');
    const mbAngle = document.getElementById('motion-angle');
    const updateMotionBlurPreview = () => {
      const d = parseInt(mbDist.value, 10) || 15;
      const a = parseInt(mbAngle.value, 10) || 0;
      this.applyFilterPreview((imgData) => Filters.motionBlur(imgData, d, a));
    };
    if (mbDist) {
      mbDist.addEventListener('input', () => {
        document.getElementById('val-motion-distance').textContent = mbDist.value + 'px';
        updateMotionBlurPreview();
      });
    }
    if (mbAngle) {
      mbAngle.addEventListener('input', () => {
        document.getElementById('val-motion-angle').textContent = mbAngle.value + '°';
        updateMotionBlurPreview();
      });
    }
    const btnApplyMB = document.getElementById('btn-apply-motion-blur');
    if (btnApplyMB) {
      btnApplyMB.addEventListener('click', () => {
        this.commitFilterPreview('Motion Blur');
        this.hideModal('modal-motion-blur');
      });
    }

    // Radial Blur Modal
    const rbAmount = document.getElementById('radial-amount');
    const rbMode = document.getElementById('radial-mode');
    const updateRadialBlurPreview = () => {
      const amt = parseInt(rbAmount.value, 10) || 10;
      const m = rbMode ? rbMode.value : 'spin';
      this.applyFilterPreview((imgData) => Filters.radialBlur(imgData, amt, m));
    };
    if (rbAmount) {
      rbAmount.addEventListener('input', () => {
        document.getElementById('val-radial-amount').textContent = rbAmount.value;
        updateRadialBlurPreview();
      });
    }
    if (rbMode) {
      rbMode.addEventListener('change', updateRadialBlurPreview);
    }
    const btnApplyRB = document.getElementById('btn-apply-radial-blur');
    if (btnApplyRB) {
      btnApplyRB.addEventListener('click', () => {
        this.commitFilterPreview('Radial Blur');
        this.hideModal('modal-radial-blur');
      });
    }

    // Unsharp Mask Modal
    const usmAmount = document.getElementById('unsharp-amount');
    const usmRadius = document.getElementById('unsharp-radius');
    const usmThreshold = document.getElementById('unsharp-threshold');
    const updateUnsharpPreview = () => {
      const a = parseInt(usmAmount.value, 10) || 100;
      const r = parseFloat(usmRadius.value) || 2;
      const t = parseInt(usmThreshold.value, 10) || 0;
      this.applyFilterPreview((imgData) => Filters.unsharpMask(imgData, a, r, t));
    };
    if (usmAmount) {
      usmAmount.addEventListener('input', () => {
        document.getElementById('val-unsharp-amount').textContent = usmAmount.value + '%';
        updateUnsharpPreview();
      });
    }
    if (usmRadius) {
      usmRadius.addEventListener('input', () => {
        document.getElementById('val-unsharp-radius').textContent = usmRadius.value + 'px';
        updateUnsharpPreview();
      });
    }
    if (usmThreshold) {
      usmThreshold.addEventListener('input', () => {
        document.getElementById('val-unsharp-threshold').textContent = usmThreshold.value;
        updateUnsharpPreview();
      });
    }
    const btnApplyUSM = document.getElementById('btn-apply-unsharp-mask');
    if (btnApplyUSM) {
      btnApplyUSM.addEventListener('click', () => {
        this.commitFilterPreview('Unsharp Mask');
        this.hideModal('modal-unsharp-mask');
      });
    }

    // Resize Canvas Modal
    document.getElementById('btn-apply-canvas-resize').addEventListener('click', () => {
      const rw = parseInt(document.getElementById('resize-canvas-width').value, 10);
      const rh = parseInt(document.getElementById('resize-canvas-height').value, 10);
      if (rw > 0 && rh > 0) {
        this.layerManager.resizeCanvas(rw, rh);
        this.width = rw;
        this.height = rh;
        [this.bgCanvas, this.mainCanvas, this.overlayCanvas].forEach(c => {
          c.width = rw;
          c.height = rh;
        });
        const wrapper = document.getElementById('canvas-wrapper');
        wrapper.style.width = rw + 'px';
        wrapper.style.height = rh + 'px';
        Utils.renderCheckerboard(this.bgCtx, rw, rh);
        this.renderComposite();
        this.updateStatusInfo();
        this.pushHistoryState('Resize Canvas');
        this.renderRulers();
      }
      this.hideModal('modal-resize-canvas');
    });

    this.bindProExportModal();
  }

  // ── Pro Export Suite Modal Controller ──
  openProExportModal() {
    const wIn = document.getElementById('export-width');
    const hIn = document.getElementById('export-height');
    const fmt = document.getElementById('export-format');
    const scale = document.getElementById('export-scale-preset');
    const qRow = document.getElementById('export-quality-row');

    if (wIn) wIn.value = this.width;
    if (hIn) hIn.value = this.height;
    if (scale) scale.value = '1';
    if (fmt && qRow) {
      qRow.style.display = ['jpeg', 'webp'].includes(fmt.value) ? 'flex' : 'none';
    }

    this.updateExportSummary();
    this.showModal('modal-pro-export');
  }

  updateExportSummary() {
    const sumEl = document.getElementById('export-summary-text');
    if (!sumEl) return;
    const fmt = document.getElementById('export-format')?.value || 'png';
    const w = parseInt(document.getElementById('export-width')?.value, 10) || this.width;
    const h = parseInt(document.getElementById('export-height')?.value, 10) || this.height;
    const dpi = parseInt(document.getElementById('export-dpi')?.value, 10) || 300;

    const inW = (w / dpi).toFixed(2);
    const inH = (h / dpi).toFixed(2);
    const cmW = ((w / dpi) * 2.54).toFixed(1);
    const cmH = ((h / dpi) * 2.54).toFixed(1);

    const descMap = {
      'png': `Exporting 24-bit PNG with transparency. Output: ${w} × ${h} px (${inW}" × ${inH}" / ${cmW} × ${cmH} cm @ ${dpi} DPI).`,
      'psd': `Exporting Adobe Photoshop .psd document preserving all ${this.layerManager.layers.length} layers, masks, and blend modes.`,
      'webp': `Exporting modern WebP format with alpha channel. Resolution: ${w} × ${h} px. Ideal for high performance web delivery.`,
      'jpeg': `Exporting high-quality compressed JPEG photo without alpha. Resolution: ${w} × ${h} px.`,
      'svg': `Exporting Scalable Vector Graphics (.svg) preserving vector text, fonts, paths, and raster bitmap image elements.`
    };

    sumEl.textContent = descMap[fmt] || `Ready to export ${fmt.toUpperCase()}.`;
  }

  bindProExportModal() {
    const fmtSel = document.getElementById('export-format');
    const qRow = document.getElementById('export-quality-row');
    const qSlider = document.getElementById('export-quality');
    const qVal = document.getElementById('val-export-quality');
    const scaleSel = document.getElementById('export-scale-preset');
    const wIn = document.getElementById('export-width');
    const hIn = document.getElementById('export-height');
    const dpiSel = document.getElementById('export-dpi');

    if (fmtSel) {
      fmtSel.addEventListener('change', () => {
        if (qRow) qRow.style.display = ['jpeg', 'webp'].includes(fmtSel.value) ? 'flex' : 'none';
        this.updateExportSummary();
      });
    }

    if (qSlider && qVal) {
      qSlider.addEventListener('input', () => {
        qVal.textContent = qSlider.value + '%';
      });
    }

    if (scaleSel && wIn && hIn) {
      scaleSel.addEventListener('change', () => {
        const factor = parseFloat(scaleSel.value) || 1.0;
        wIn.value = Math.round(this.width * factor);
        hIn.value = Math.round(this.height * factor);
        this.updateExportSummary();
      });
    }

    if (wIn) wIn.addEventListener('input', () => this.updateExportSummary());
    if (hIn) hIn.addEventListener('input', () => this.updateExportSummary());
    if (dpiSel) dpiSel.addEventListener('change', () => this.updateExportSummary());

    const btnExport = document.getElementById('btn-perform-pro-export');
    if (btnExport) {
      btnExport.addEventListener('click', async () => {
        const fmt = fmtSel ? fmtSel.value : 'png';
        const targetW = parseInt(wIn?.value, 10) || this.width;
        const targetH = parseInt(hIn?.value, 10) || this.height;
        const quality = qSlider ? parseInt(qSlider.value, 10) / 100 : 0.92;
        const dpi = parseInt(dpiSel?.value, 10) || 300;

        this.hideModal('modal-pro-export');

        if (fmt === 'psd') {
          await this.savePsdFile();
          return;
        }

        if (fmt === 'svg') {
          await this.exportSvgFile();
          return;
        }

        // Render composite to target dimensions
        const outCan = Utils.createCanvas(targetW, targetH);
        const oCtx = outCan.getContext('2d');
        const comp = Utils.createCanvas(this.width, this.height);
        this.layerManager.compositeTo(comp.getContext('2d'));
        oCtx.drawImage(comp, 0, 0, targetW, targetH);

        let dataUrl;
        if (fmt === 'webp') {
          dataUrl = PsdEngine.ProExportSuite.exportWebP(outCan, quality);
        } else if (fmt === 'jpeg') {
          dataUrl = outCan.toDataURL('image/jpeg', quality);
        } else {
          dataUrl = outCan.toDataURL('image/png');
          if (dpi !== 72 && PsdEngine.ProExportSuite.setPngDpi) {
            dataUrl = PsdEngine.ProExportSuite.setPngDpi(dataUrl, dpi);
          }
        }

        const extMap = { 'jpeg': 'jpg', 'webp': 'webp', 'png': 'png' };
        const ext = extMap[fmt] || fmt;
        const defName = `PixelForge_Export_${targetW}x${targetH}.${ext}`;

        if (this.ipc) {
          await this.ipc.invoke('dialog:saveFile', {
            dataUrl,
            defaultName: defName,
            format: ext
          });
        } else {
          const link = document.createElement('a');
          link.download = defName;
          link.href = dataUrl;
          link.click();
        }
      });
    }

    // Color Range Modal
    const crSample = document.getElementById('cr-sample-color');
    const crHex = document.getElementById('cr-sample-hex');
    const crFuzz = document.getElementById('cr-fuzziness');
    const crValFuzz = document.getElementById('val-cr-fuzziness');
    const crInvert = document.getElementById('cr-invert');
    const btnApplyCR = document.getElementById('btn-apply-color-range');

    if (crSample && crHex) {
      crSample.addEventListener('input', () => {
        crHex.textContent = crSample.value;
      });
    }
    if (crFuzz && crValFuzz) {
      crFuzz.addEventListener('input', () => {
        crValFuzz.textContent = crFuzz.value;
      });
    }
    if (btnApplyCR) {
      btnApplyCR.addEventListener('click', () => {
        const hex = crSample ? crSample.value : '#ffffff';
        const rgb = Utils.hexToRgb(hex);
        const fuzz = parseInt(crFuzz ? crFuzz.value : '40', 10);
        const inv = crInvert ? crInvert.checked : false;
        if (this.toolManager && this.toolManager.selectColorRange) {
          this.toolManager.selectColorRange(rgb, fuzz, inv);
        }
        this.hideModal('modal-color-range');
      });
    }

    // Content-Aware Fill Modal
    const cafPatch = document.getElementById('caf-patch-size');
    const cafRadius = document.getElementById('caf-search-radius');
    const valCafPatch = document.getElementById('val-caf-patch');
    const valCafRadius = document.getElementById('val-caf-radius');
    const btnApplyCAF = document.getElementById('btn-apply-content-aware-fill');

    if (cafPatch && valCafPatch) {
      cafPatch.addEventListener('input', () => valCafPatch.textContent = cafPatch.value);
    }
    if (cafRadius && valCafRadius) {
      cafRadius.addEventListener('input', () => valCafRadius.textContent = cafRadius.value + 'px');
    }
    if (btnApplyCAF) {
      btnApplyCAF.addEventListener('click', () => {
        const patchSize = parseInt(cafPatch ? cafPatch.value : '3', 10);
        const searchRadius = parseInt(cafRadius ? cafRadius.value : '36', 10);
        if (this.toolManager && this.toolManager.applyContentAwareFill) {
          this.toolManager.applyContentAwareFill({ patchSize, searchRadius });
        }
        this.hideModal('modal-content-aware-fill');
      });
    }

    // ── Phase 5 Layer Architecture: Event Bindings ──
    document.getElementById('btn-exit-isolation')?.addEventListener('click', () => {
      this.exitIsolationMode();
    });

    const placeEmbInput = document.getElementById('browser-place-embedded-input');
    if (placeEmbInput) {
      placeEmbInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          if (this.assetManager) {
            const img = new Image();
            img.onload = () => {
              this.assetManager.placeEmbedded(file.name, ev.target.result, img.width, img.height);
              this.renderComposite();
              this.layerManager.renderLayerStackUI();
              this.pushHistoryState(`Place Embedded: ${file.name}`);
            };
            img.src = ev.target.result;
          }
        };
        reader.readAsDataURL(file);
        placeEmbInput.value = '';
      });
    }

    const placeLnkInput = document.getElementById('browser-place-linked-input');
    if (placeLnkInput) {
      placeLnkInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const uri = file.path || file.name;
        const reader = new FileReader();
        reader.onload = (ev) => {
          if (this.assetManager) {
            const img = new Image();
            img.onload = () => {
              this.assetManager.placeLinked(file.name, uri, ev.target.result, img.width, img.height);
              this.renderComposite();
              this.layerManager.renderLayerStackUI();
              this.pushHistoryState(`Place Linked: ${file.name}`);
            };
            img.src = ev.target.result;
          }
        };
        reader.readAsDataURL(file);
        placeLnkInput.value = '';
      });
    }

    // Layer Comps Modal Buttons
    const btnCompToggle = document.getElementById('btn-comp-create-toggle');
    const compForm = document.getElementById('comp-create-form');
    if (btnCompToggle && compForm) {
      btnCompToggle.addEventListener('click', () => {
        compForm.classList.toggle('hidden');
      });
    }
    document.getElementById('btn-comp-cancel')?.addEventListener('click', () => {
      compForm?.classList.add('hidden');
    });
    document.getElementById('btn-comp-save')?.addEventListener('click', () => {
      const name = document.getElementById('new-comp-name')?.value || 'Layer Comp';
      const capVis = document.getElementById('comp-cap-vis')?.checked;
      const capPos = document.getElementById('comp-cap-pos')?.checked;
      const capApp = document.getElementById('comp-cap-app')?.checked;
      const comment = document.getElementById('new-comp-comment')?.value || '';

      this.layerManager.createLayerComp(name, {
        captureVisibility: capVis,
        capturePosition: capPos,
        captureAppearance: capApp,
        comment
      });
      compForm?.classList.add('hidden');
      this.renderLayerCompsList();
      this.pushHistoryState(`Create Layer Comp: ${name}`);
    });

    document.getElementById('btn-comp-update')?.addEventListener('click', () => {
      if (this.layerManager?.activeCompId) {
        this.layerManager.updateLayerComp(this.layerManager.activeCompId);
        this.renderLayerCompsList();
        this.pushHistoryState('Update Layer Comp');
      }
    });

    document.getElementById('btn-comp-duplicate')?.addEventListener('click', () => {
      if (this.layerManager?.activeCompId) {
        this.layerManager.duplicateLayerComp(this.layerManager.activeCompId);
        this.renderLayerCompsList();
        this.pushHistoryState('Duplicate Layer Comp');
      }
    });

    document.getElementById('btn-comp-delete')?.addEventListener('click', () => {
      if (this.layerManager?.activeCompId) {
        this.layerManager.deleteLayerComp(this.layerManager.activeCompId);
        this.renderLayerCompsList();
        this.pushHistoryState('Delete Layer Comp');
      }
    });

    document.getElementById('btn-comp-next')?.addEventListener('click', () => {
      const comp = this.layerManager?.nextLayerComp();
      if (comp) {
        this.renderComposite();
        this.renderLayerCompsList();
        this.pushHistoryState(`Next Comp: ${comp.name}`);
      }
    });

    document.getElementById('btn-comp-prev')?.addEventListener('click', () => {
      const comp = this.layerManager?.prevLayerComp();
      if (comp) {
        this.renderComposite();
        this.renderLayerCompsList();
        this.pushHistoryState(`Prev Comp: ${comp.name}`);
      }
    });

    // Assets Modal Buttons
    document.getElementById('btn-asset-place-embedded')?.addEventListener('click', () => {
      this.hideModal('modal-assets-manager');
      document.getElementById('browser-place-embedded-input')?.click();
    });
    document.getElementById('btn-asset-place-linked')?.addEventListener('click', () => {
      this.hideModal('modal-assets-manager');
      document.getElementById('browser-place-linked-input')?.click();
    });
    document.getElementById('btn-asset-refresh')?.addEventListener('click', () => {
      this.renderAssetsList();
    });
    document.getElementById('btn-asset-embed')?.addEventListener('click', () => {
      const selectedTr = document.querySelector('#tbody-assets tr.selected');
      const assetId = selectedTr?.dataset?.assetId;
      if (assetId && this.assetManager) {
        this.assetManager.embedAsset(assetId);
        this.renderAssetsList();
        this.pushHistoryState('Embed Linked Asset');
      }
    });

    // Artboards Modal Buttons
    const abPreset = document.getElementById('artboard-preset');
    const abW = document.getElementById('artboard-width');
    const abH = document.getElementById('artboard-height');
    if (abPreset && abW && abH) {
      abPreset.addEventListener('change', () => {
        const presets = {
          desktop: [1920, 1080],
          '4k': [3840, 2160],
          iphone14: [1179, 2556],
          ipadpro: [2048, 2732],
          instagram_post: [1080, 1080],
          instagram_story: [1080, 1920]
        };
        const dim = presets[abPreset.value];
        if (dim) {
          abW.value = dim[0];
          abH.value = dim[1];
        }
      });
    }

    const abBgType = document.getElementById('artboard-bg-type');
    const abColorRow = document.getElementById('artboard-custom-color-row');
    if (abBgType && abColorRow) {
      abBgType.addEventListener('change', () => {
        if (abBgType.value === 'custom') {
          abColorRow.classList.remove('hidden');
        } else {
          abColorRow.classList.add('hidden');
        }
      });
    }

    document.getElementById('btn-add-artboard')?.addEventListener('click', () => {
      const name = document.getElementById('artboard-name')?.value || 'Artboard';
      const w = parseInt(abW ? abW.value : '1920', 10);
      const h = parseInt(abH ? abH.value : '1080', 10);
      const bgType = abBgType ? abBgType.value : 'white';
      const bgColor = document.getElementById('artboard-bg-color')?.value || '#ffffff';

      this.layerManager.addArtboard(name, w, h, { bgType, bgColor });
      this.renderComposite();
      this.renderArtboardsList();
      this.pushHistoryState(`Add Artboard: ${name}`);
    });

    // Paths Panel modal buttons
    document.getElementById('btn-save-work-path')?.addEventListener('click', () => {
      if (this.toolManager && this.toolManager.pathManager) {
        this.toolManager.pathManager.saveWorkPath();
        this.renderPathsList();
        this.pushHistoryState('Save Work Path');
      }
    });

    document.getElementById('btn-path-panel-fill')?.addEventListener('click', () => {
      const active = this.layerManager.getActiveLayer();
      if (active && this.toolManager && this.toolManager.pathManager && !this.toolManager.pathManager.isEmpty()) {
        this.toolManager.pathManager.fillPath(active.ctx, this.colorPicker.getFgCss());
        this.renderComposite();
        this.pushHistoryState('Fill Path');
      }
    });

    document.getElementById('btn-path-panel-stroke')?.addEventListener('click', () => {
      const active = this.layerManager.getActiveLayer();
      if (active && this.toolManager && this.toolManager.pathManager && !this.toolManager.pathManager.isEmpty()) {
        const pm = this.toolManager.pathManager;
        pm.strokePath(active.ctx, this.colorPicker.getFgCss(), this.toolManager.brushSize, pm.lineDash, pm.lineCap, pm.lineJoin, pm.strokeAlign);
        this.renderComposite();
        this.pushHistoryState('Stroke Path');
      }
    });

    document.getElementById('btn-path-panel-to-sel')?.addEventListener('click', () => {
      if (this.toolManager && this.toolManager.pathManager && !this.toolManager.pathManager.isEmpty()) {
        const sel = this.toolManager.pathManager.makeSelection(this.width, this.height);
        if (sel) {
          this.toolManager.selection = sel;
          this.toolManager.renderMarchingAnts();
          this.pushHistoryState('Path to Selection');
        }
      }
    });

    document.getElementById('btn-path-panel-from-sel')?.addEventListener('click', () => {
      if (this.toolManager) {
        this.toolManager.makeWorkPathFromSelection(2.0);
        this.renderPathsList();
      }
    });

    document.getElementById('btn-path-panel-svg')?.addEventListener('click', () => {
      if (this.toolManager && this.toolManager.pathManager && !this.toolManager.pathManager.isEmpty()) {
        const svg = this.toolManager.pathManager.exportSVG(this.width, this.height);
        const blob = new Blob([svg], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'vector-path.svg';
        a.click();
        URL.revokeObjectURL(url);
      }
    });
  }

  // ── Keyboard Shortcuts ──
  bindKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        return;
      }

      if (e.shiftKey && e.key === 'F5') {
        e.preventDefault();
        this.handleMenuAction('content-aware-fill');
        return;
      }

      if (e.altKey && (e.key === 'F9' || e.code === 'F9')) {
        e.preventDefault();
        this.openActionsPalette();
        return;
      }

      if (e.key === 'Enter') {
        if (this.puppetWarpEngine && this.puppetWarpEngine.active) {
          e.preventDefault();
          this.commitPuppetWarp();
          return;
        }
        if (this.warpEngine && this.warpEngine.active) {
          e.preventDefault();
          this.commitMeshWarp();
          return;
        }
        if (this.toolManager.isTransforming) {
          e.preventDefault();
          this.toolManager.commitFreeTransform();
          return;
        }
        if ((e.ctrlKey || e.metaKey) && this.toolManager.pathManager && !this.toolManager.pathManager.isEmpty()) {
          e.preventDefault();
          const sel = this.toolManager.pathManager.makeSelection(this.width, this.height);
          if (sel) {
            this.toolManager.selection = sel;
            this.toolManager.renderMarchingAnts();
            this.pushHistoryState('Path to Selection');
          }
          return;
        }
      }

      if (e.key === 'Escape') {
        if (this.puppetWarpEngine && this.puppetWarpEngine.active) {
          e.preventDefault();
          this.cancelPuppetWarp();
          return;
        }
        if (this.warpEngine && this.warpEngine.active) {
          e.preventDefault();
          this.cancelMeshWarp();
          return;
        }
        if (this.layerManager && this.layerManager.isolatedLayerId) {
          e.preventDefault();
          this.exitIsolationMode();
          return;
        }
        if (this.toolManager.isTransforming) {
          e.preventDefault();
          this.toolManager.cancelFreeTransform();
          return;
        }
        if (this.editingAdjustmentLayer) {
          e.preventDefault();
          if (this.adjustmentBackupParams) {
            this.editingAdjustmentLayer.adjustmentParams = JSON.parse(JSON.stringify(this.adjustmentBackupParams));
          }
          this.editingAdjustmentLayer = null;
          this.adjustmentBackupParams = null;
          this.renderComposite();
          document.querySelectorAll('.modal-backdrop:not(.hidden)').forEach(m => m.classList.add('hidden'));
          return;
        }
        if (this.filterBackupCanvas) {
          e.preventDefault();
          this.cancelFilterPreview();
          document.querySelectorAll('.modal-backdrop:not(.hidden)').forEach(m => m.classList.add('hidden'));
          return;
        }
      }

      if (e.ctrlKey || e.metaKey) {
        if (e.key === ';' || e.code === 'Semicolon') {
          e.preventDefault();
          if (e.altKey) {
            this.handleMenuAction('lock-guides');
          } else if (e.shiftKey) {
            this.handleMenuAction('toggle-snapping');
          } else {
            this.handleMenuAction('toggle-guides');
          }
          return;
        }

        if (e.key === "'" || e.code === 'Quote') {
          e.preventDefault();
          this.handleMenuAction('toggle-grid');
          return;
        }

        // Ctrl + Alt combinations
        if (e.altKey) {
          switch (e.key.toLowerCase()) {
            case 'l':
              e.preventDefault();
              this.openColorLookupModal();
              return;
            case 'i':
              e.preventDefault();
              this.toggleIsolationMode();
              return;
            case 'g':
              e.preventDefault();
              this.layerManager.toggleClippingMask();
              this.renderComposite();
              this.pushHistoryState('Toggle Clipping Mask');
              return;
            case 'w':
              e.preventDefault();
              this.openProExportModal();
              return;
          }
        }

        if (e.shiftKey) {
          if (e.key.toLowerCase() === 'w') {
            e.preventDefault();
            this.startMeshWarp();
            return;
          }
        }

        switch (e.key.toLowerCase()) {
          case 'g':
            e.preventDefault();
            if (e.shiftKey) {
              const active = this.layerManager.getActiveLayer();
              if (active) {
                this.layerManager.ungroup(active.id);
                this.renderComposite();
                this.pushHistoryState('Ungroup Layers');
              }
            } else {
              const group = this.layerManager.addGroup();
              if (group) {
                this.renderComposite();
                this.pushHistoryState('Group Layers');
              }
            }
            break;
          case 'z':
            e.preventDefault();
            if (e.shiftKey) {
              const redo = this.historyManager.redo();
              if (redo) this.restoreState(redo);
            } else {
              const undo = this.historyManager.undo();
              if (undo) this.restoreState(undo);
            }
            break;
          case 'y':
            e.preventDefault();
            if (e.shiftKey) {
              if (this.cmykProof) {
                this.cmykProof.isGamutWarning = !this.cmykProof.isGamutWarning;
                this.updateProofUI();
                this.renderComposite();
              }
            } else {
              if (this.cmykProof) {
                this.cmykProof.isSoftProofing = !this.cmykProof.isSoftProofing;
                this.updateProofUI();
                this.renderComposite();
              }
            }
            break;
          case 'a':
            if (e.shiftKey) {
              e.preventDefault();
              this.openCameraRawDialog();
            }
            break;
          case 't':
            e.preventDefault();
            this.toolManager.startFreeTransform();
            break;
          case 'm':
            e.preventDefault();
            if (this.renderCurvesModal) this.renderCurvesModal();
            this.showModal('modal-curves');
            break;
          case 'b':
            e.preventDefault();
            this.openAdjustmentInspector('color-balance');
            break;
          case 'i':
            e.preventDefault();
            if (this.layerManager.isMaskSelected) {
              this.layerManager.invertMask();
              this.renderComposite();
              this.layerManager.renderLayerStackUI();
              this.pushHistoryState('Invert Mask');
            } else {
              this.applyFilter('invert');
            }
            break;
          case 'r':
            e.preventDefault();
            this.toggleRulers();
            break;
          case 's':
            e.preventDefault();
            if (e.shiftKey) {
              this.saveProjectFile();
            } else {
              this.exportImage('png');
            }
            break;
          case 'c':
            e.preventDefault();
            this.copySelection();
            break;
          case 'x':
            e.preventDefault();
            if (e.shiftKey) {
              if (this.liquifyModal) this.liquifyModal.open();
            } else {
              this.cutSelection();
            }
            break;
          case 'v':
            e.preventDefault();
            this.pasteClipboard();
            break;
          case 'o':
            e.preventDefault();
            this.openImageFile();
            break;
          case 'n':
            e.preventDefault();
            this.showModal('modal-new-canvas');
            break;
          case 'a':
            e.preventDefault();
            this.toolManager.selection = { type: 'rect', x: 0, y: 0, w: this.width, h: this.height };
            break;
          case 'd':
            e.preventDefault();
            this.toolManager.clearSelection();
            break;
          case 'j':
            e.preventDefault();
            this.layerManager.duplicateActiveLayer();
            this.pushHistoryState('Duplicate Layer');
            break;
          case 'e':
            e.preventDefault();
            if (e.shiftKey) {
              this.layerManager.mergeVisible();
              this.pushHistoryState('Merge Visible');
            } else {
              if (this.layerManager.mergeDown()) {
                this.pushHistoryState('Merge Down');
              }
            }
            break;
        }
      } else {
        if (this.shortcutManager) {
          const action = this.shortcutManager.getActionFromEvent(e);
          if (action && action.startsWith('tool.')) {
            const toolName = action.replace('tool.', '');
            const toolMap = {
              move: 'move', marquee: 'select-rect', lasso: 'lasso', wand: 'magic-wand',
              crop: 'crop', eyedropper: 'eyedropper', spot_healing: 'spot-healing',
              brush: 'brush', clone_stamp: 'clone-stamp', history_brush: 'history-brush',
              eraser: 'eraser', gradient: 'gradient', dodge: 'dodge', pen: 'pen',
              text: 'text', shape: 'rectangle', hand: 'hand', zoom: 'zoom'
            };
            const mapped = toolMap[toolName] || toolName;
            this.toolManager.setTool(mapped);
            return;
          }
        }
        switch (e.key.toLowerCase()) {
          case 'v': this.toolManager.setTool('move'); break;
          case 'm': this.toolManager.setTool('select-rect'); break;
          case 'w': this.toolManager.setTool('magic-wand'); break;
          case 'c': this.toolManager.setTool('crop'); break;
          case 'b': this.toolManager.setTool('brush'); break;
          case 'y': this.toolManager.setTool('history-brush'); break;
          case 'p':
            if (e.shiftKey) {
              this.toolManager.setTool(this.toolManager.currentTool === 'pen' ? 'pencil' : 'pen');
            } else {
              this.toolManager.setTool('pen');
            }
            break;
          case 'a':
            this.toolManager.setTool('path-select');
            break;
          case 's': this.toolManager.setTool('clone-stamp'); break;
          case 'j': this.toolManager.setTool('spot-healing'); break;
          case 'o':
            if (e.shiftKey) {
              const tonalTools = ['dodge', 'burn', 'sponge'];
              const curIdx = tonalTools.indexOf(this.toolManager.currentTool);
              const nextIdx = (curIdx + 1) % tonalTools.length;
              this.toolManager.setTool(tonalTools[nextIdx]);
            } else {
              this.toolManager.setTool('dodge');
            }
            break;
          case 'e': this.toolManager.setTool('eraser'); break;
          case 'g':
            this.toolManager.setTool(this.toolManager.currentTool === 'gradient' ? 'bucket' : 'gradient');
            break;
          case 't': this.toolManager.setTool('text'); break;
          case 'u':
            if (e.shiftKey) {
              const shapes = ['shape-rect', 'shape-rounded-rect', 'shape-ellipse', 'shape-polygon', 'shape-star', 'shape-line'];
              const curIdx = shapes.indexOf(this.toolManager.currentTool);
              const nextIdx = (curIdx + 1) % shapes.length;
              this.toolManager.setTool(shapes[nextIdx]);
            } else {
              this.toolManager.setTool('shape-rect');
            }
            break;
          case 'r': this.toolManager.setTool('tool-blur'); break;
          case 'i': this.toolManager.setTool('eyedropper'); break;
          case 'h': this.toolManager.setTool('hand'); break;
          case 'z': this.toolManager.setTool('zoom'); break;
          case 'q': this.toggleQuickMask(); break;
          case 'x': this.colorPicker.swapColors(); break;
          case 'd':
            this.colorPicker.resetDefaultColors();
            break;
          case '[':
            const sDown = Math.max(1, this.toolManager.brushSize - 4);
            document.getElementById('brush-size').value = sDown;
            const bInDown = document.getElementById('brush-size-input');
            if (bInDown) bInDown.value = sDown;
            document.getElementById('brush-size-val').textContent = sDown + 'px';
            this.toolManager.brushSize = sDown;
            break;
          case ']':
            const sUp = Math.min(250, this.toolManager.brushSize + 4);
            document.getElementById('brush-size').value = sUp;
            const bInUp = document.getElementById('brush-size-input');
            if (bInUp) bInUp.value = sUp;
            document.getElementById('brush-size-val').textContent = sUp + 'px';
            this.toolManager.brushSize = sUp;
            break;
          case 'delete':
          case 'backspace':
            if (['pen', 'path-select'].includes(this.toolManager.currentTool) && this.toolManager.pathManager) {
              if (this.toolManager.pathManager.deleteActivePoint()) {
                this.toolManager.clearOverlay();
                this.toolManager.pathManager.renderOverlay(this.overlayCtx, this.zoom, this.panX, this.panY);
                this.pushHistoryState('Delete Anchor Point');
                break;
              }
            }
            this.handleMenuAction('clear-layer');
            break;
        }
      }
    });
  }

  // ── Welcome Screen (Studio Home Screen) ──
  bindWelcomeScreen() {
    const welcomeOverlay = document.getElementById('welcome-overlay');
    const btnNew = document.getElementById('btn-welcome-new');
    const btnOpen = document.getElementById('btn-welcome-open');
    const btnBack = document.getElementById('btn-welcome-back-to-canvas');
    const brandHome = document.getElementById('btn-brand-home');
    const dropZone = document.getElementById('welcome-drop-zone');

    if (btnNew) {
      btnNew.addEventListener('click', () => {
        this.showModal('modal-new-canvas');
      });
    }

    if (btnOpen) {
      btnOpen.addEventListener('click', () => {
        this.openImageFile();
      });
    }

    if (btnBack) {
      btnBack.addEventListener('click', () => {
        this.hideWelcomeOverlay();
      });
    }

    if (brandHome) {
      brandHome.addEventListener('click', (e) => {
        // Prevent accidental menu triggers
        e.stopPropagation();
        if (welcomeOverlay && !welcomeOverlay.classList.contains('hidden')) {
          this.hideWelcomeOverlay();
        } else {
          if (this.isDirty && this.historyManager && this.historyManager.steps.length > 1) {
            this.requestCloseDocument('home');
          } else {
            this.showWelcomeOverlay();
          }
        }
      });
    }

    const btnClearRecents = document.getElementById('btn-clear-recent-projects');
    if (btnClearRecents) {
      btnClearRecents.addEventListener('click', () => {
        if (confirm('Do you want to clear all recent projects history?')) {
          if (this.recentProjectsManager) {
            this.recentProjectsManager.clearAll();
            this.showToast('Recent projects cleared');
          }
        }
      });
    }

    // Category Tabs Filtering
    const tabs = document.querySelectorAll('.welcome-cat-tab');
    const templateCards = document.querySelectorAll('.template-card');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const selectedCat = tab.dataset.cat;
        templateCards.forEach(card => {
          if (selectedCat === 'all' || card.dataset.cat === selectedCat) {
            card.style.display = 'flex';
          } else {
            card.style.display = 'none';
          }
        });
      });
    });

    // Template Cards Selection
    templateCards.forEach(card => {
      card.addEventListener('click', () => {
        const w = parseInt(card.dataset.w, 10);
        const h = parseInt(card.dataset.h, 10);
        const name = card.dataset.name || 'New Canvas';
        this.createDocument(w, h, 'white', true);
        this.zoomFit();
        this.showToast(`Workspace initialized: ${name} (${w} × ${h} px)`);
      });
    });

    // Fallback preset pills if present
    document.querySelectorAll('.preset-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        const w = parseInt(btn.dataset.w, 10);
        const h = parseInt(btn.dataset.h, 10);
        this.createDocument(w, h, 'white', true);
        this.zoomFit();
      });
    });

    // Dedicated Drag & Drop Zone on Home Screen
    if (dropZone) {
      dropZone.addEventListener('click', () => {
        this.openImageFile();
      });

      ['dragenter', 'dragover'].forEach(eventType => {
        dropZone.addEventListener(eventType, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropZone.classList.add('drag-active');
          if (e.dataTransfer) {
            e.dataTransfer.dropEffect = 'copy';
          }
        });
      });

      ['dragleave', 'dragend'].forEach(eventType => {
        dropZone.addEventListener(eventType, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropZone.classList.remove('drag-active');
        });
      });

      dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('drag-active');

        const files = [];
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          for (let i = 0; i < e.dataTransfer.files.length; i++) {
            files.push(e.dataTransfer.files[i]);
          }
        } else if (e.dataTransfer && e.dataTransfer.items && e.dataTransfer.items.length > 0) {
          for (let i = 0; i < e.dataTransfer.items.length; i++) {
            const item = e.dataTransfer.items[i];
            if (item.kind === 'file') {
              const f = item.getAsFile();
              if (f) files.push(f);
            }
          }
        }

        if (files.length > 0) {
          this.handleDroppedFiles(files);
          return;
        }

        const uri = e.dataTransfer ? (e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain')) : null;
        if (uri && (uri.startsWith('http://') || uri.startsWith('https://') || uri.startsWith('data:image/'))) {
          this.loadImageFromDataUrl(uri, 'Dropped Image');
        }
      });
    }

    // Escape Key to Return to Workspace if canvas exists
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && welcomeOverlay && !welcomeOverlay.classList.contains('hidden')) {
        // If no modal or flyout is currently open, toggle back to workspace
        const activeModal = document.querySelector('.modal-container:not(.hidden)');
        if (!activeModal) {
          this.hideWelcomeOverlay();
        }
      }
    });
  }

  // ── Dock Panels Collapsible / Dropdown ──
  bindDockPanels() {
    document.querySelectorAll('.dock-panel .panel-header').forEach(header => {
      header.addEventListener('click', (e) => {
        // If clicking action buttons inside header (excluding the toggle button itself), don't collapse
        if (e.target.closest('.panel-actions') && !e.target.closest('.panel-toggle')) return;
        const panel = header.closest('.dock-panel');
        if (panel) {
          panel.classList.toggle('collapsed');
          const toggleBtn = panel.querySelector('.panel-toggle');
          if (toggleBtn) {
            toggleBtn.textContent = panel.classList.contains('collapsed') ? '▸' : '▾';
          }
        }
      });
    });
  }

  // ── Top Tool Options Bar Horizontal Scroll ──
  bindToolOptionsBarScroll() {
    const bar = document.getElementById('tool-options-bar');
    if (!bar) return;

    bar.addEventListener('wheel', (e) => {
      // Map vertical scroll wheel into smooth horizontal scroll
      if (e.deltaY !== 0) {
        e.preventDefault();
        bar.scrollLeft += e.deltaY;
      }
    }, { passive: false });
  }

  // ── Right Dock Draggable Splitter Handle ──
  bindDockResizer() {
    const resizer = document.getElementById('right-dock-resizer');
    if (!resizer) return;

    // Restore persisted width from localStorage
    try {
      const savedWidth = parseInt(localStorage.getItem('pf_dock_width'), 10);
      if (savedWidth && savedWidth >= 180 && savedWidth <= window.innerWidth * 0.7) {
        document.documentElement.style.setProperty('--dock-width', `${savedWidth}px`);
      }
    } catch (e) {
      // Ignore storage errors in restricted contexts
    }

    let isResizing = false;

    const onPointerMove = (e) => {
      if (!isResizing) return;
      const minWidth = 180;
      const maxWidth = Math.round(window.innerWidth * 0.65);
      const newWidth = Math.min(Math.max(minWidth, window.innerWidth - e.clientX), maxWidth);

      document.documentElement.style.setProperty('--dock-width', `${newWidth}px`);

      if (this.renderRulers) this.renderRulers();
      if (this.colorPicker && typeof this.colorPicker.updateCursorPositions === 'function') {
        this.colorPicker.updateCursorPositions();
      }
      if (this.navigatorManager && typeof this.navigatorManager.update === 'function') {
        this.navigatorManager.update();
      }
    };

    const onPointerUp = (e) => {
      if (!isResizing) return;
      isResizing = false;
      resizer.classList.remove('dragging');
      document.body.classList.remove('dock-resizing');

      try {
        resizer.releasePointerCapture(e.pointerId);
      } catch (err) {}

      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);

      // Persist chosen width
      try {
        const currentWidth = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--dock-width'), 10);
        if (currentWidth) {
          localStorage.setItem('pf_dock_width', currentWidth);
        }
      } catch (err) {}

      if (this.renderRulers) this.renderRulers();
      if (this.colorPicker && typeof this.colorPicker.updateCursorPositions === 'function') {
        this.colorPicker.updateCursorPositions();
      }
      if (this.navigatorManager && typeof this.navigatorManager.update === 'function') {
        this.navigatorManager.update();
      }
    };

    resizer.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      isResizing = true;
      resizer.classList.add('dragging');
      document.body.classList.add('dock-resizing');

      try {
        resizer.setPointerCapture(e.pointerId);
      } catch (err) {}

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerUp);
    });

    // Double-click to reset to standard 280px default width
    resizer.addEventListener('dblclick', () => {
      document.documentElement.style.setProperty('--dock-width', '280px');
      try {
        localStorage.removeItem('pf_dock_width');
      } catch (err) {}
      if (this.renderRulers) this.renderRulers();
      if (this.colorPicker && typeof this.colorPicker.updateCursorPositions === 'function') {
        this.colorPicker.updateCursorPositions();
      }
      if (this.navigatorManager && typeof this.navigatorManager.update === 'function') {
        this.navigatorManager.update();
      }
    });
  }

  // ── Character & Paragraph Typography Panel Controller ──
  bindTypographyPanel() {
    const btnNewText = document.getElementById('btn-typo-new-text');
    if (btnNewText) {
      btnNewText.addEventListener('click', () => {
        const fgHex = this.colorPicker ? this.colorPicker.getFgHex() : '#ffffff';
        const layer = this.layerManager.addTextLayer('PixelForge Typography', Math.round(this.width / 2), Math.round(this.height / 2), {
          color: fgHex
        });
        this.renderComposite();
        this.pushHistoryState('Add Text Layer');
        this.openTypographyInspector(layer);
      });
    }

    const txtContent = document.getElementById('typo-text-content');
    if (txtContent) {
      txtContent.addEventListener('input', () => {
        const active = this.layerManager.getActiveLayer();
        if (active && active.type === 'text' && active.textParams) {
          active.textParams.text = txtContent.value;
          this.layerManager.renderTextLayer(active);
          this.renderComposite();
        }
      });
      txtContent.addEventListener('change', () => {
        this.pushHistoryState('Edit Text Content');
      });
    }

    const fontFamilySel = document.getElementById('typo-font-family');
    if (fontFamilySel) {
      fontFamilySel.addEventListener('change', () => {
        const active = this.layerManager.getActiveLayer();
        if (active && active.type === 'text' && active.textParams) {
          active.textParams.fontFamily = fontFamilySel.value;
          this.layerManager.renderTextLayer(active);
          this.renderComposite();
          this.pushHistoryState('Change Font Family');
        }
      });
    }

    const fontWeightSel = document.getElementById('typo-font-weight');
    if (fontWeightSel) {
      fontWeightSel.addEventListener('change', () => {
        const active = this.layerManager.getActiveLayer();
        if (active && active.type === 'text' && active.textParams) {
          active.textParams.fontWeight = fontWeightSel.value;
          this.layerManager.renderTextLayer(active);
          this.renderComposite();
          this.pushHistoryState('Change Font Weight');
        }
      });
    }

    const fontSizeInput = document.getElementById('typo-font-size');
    if (fontSizeInput) {
      const updateSize = (fromChange = false) => {
        const active = this.layerManager.getActiveLayer();
        if (active && active.type === 'text' && active.textParams) {
          active.textParams.fontSize = Math.max(6, Math.min(600, parseInt(fontSizeInput.value, 10) || 48));
          this.layerManager.renderTextLayer(active);
          this.renderComposite();
          if (fromChange) this.pushHistoryState('Change Font Size');
        }
      };
      fontSizeInput.addEventListener('input', () => updateSize(false));
      fontSizeInput.addEventListener('change', () => updateSize(true));
    }

    const leadingInput = document.getElementById('typo-leading');
    if (leadingInput) {
      const updateLeading = (fromChange = false) => {
        const active = this.layerManager.getActiveLayer();
        if (active && active.type === 'text' && active.textParams) {
          active.textParams.leading = Math.max(0.5, Math.min(4.0, parseFloat(leadingInput.value) || 1.25));
          this.layerManager.renderTextLayer(active);
          this.renderComposite();
          if (fromChange) this.pushHistoryState('Change Line Leading');
        }
      };
      leadingInput.addEventListener('input', () => updateLeading(false));
      leadingInput.addEventListener('change', () => updateLeading(true));
    }

    const trackingInput = document.getElementById('typo-tracking');
    if (trackingInput) {
      const updateTracking = (fromChange = false) => {
        const active = this.layerManager.getActiveLayer();
        if (active && active.type === 'text' && active.textParams) {
          active.textParams.tracking = Math.max(-50, Math.min(200, parseInt(trackingInput.value, 10) || 0));
          this.layerManager.renderTextLayer(active);
          this.renderComposite();
          if (fromChange) this.pushHistoryState('Change Letter Tracking');
        }
      };
      trackingInput.addEventListener('input', () => updateTracking(false));
      trackingInput.addEventListener('change', () => updateTracking(true));
    }

    const colorPicker = document.getElementById('typo-color-picker');
    const colorHex = document.getElementById('typo-color-hex');
    if (colorPicker && colorHex) {
      const updateColor = (hex, fromChange = false) => {
        const active = this.layerManager.getActiveLayer();
        if (active && active.type === 'text' && active.textParams) {
          active.textParams.color = hex;
          colorPicker.value = hex;
          colorHex.value = hex;
          this.layerManager.renderTextLayer(active);
          this.renderComposite();
          if (fromChange) this.pushHistoryState('Change Text Color');
        }
      };
      colorPicker.addEventListener('input', () => updateColor(colorPicker.value, false));
      colorPicker.addEventListener('change', () => updateColor(colorPicker.value, true));
      colorHex.addEventListener('change', () => {
        let val = colorHex.value.trim();
        if (!val.startsWith('#')) val = '#' + val;
        if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
          updateColor(val, true);
        }
      });
    }

    document.querySelectorAll('.typo-align-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const active = this.layerManager.getActiveLayer();
        if (active && active.type === 'text' && active.textParams) {
          active.textParams.align = btn.dataset.align || 'left';
          document.querySelectorAll('.typo-align-btn').forEach(b => b.classList.toggle('active', b === btn));
          this.layerManager.renderTextLayer(active);
          this.renderComposite();
          this.pushHistoryState('Change Text Alignment');
        }
      });
    });

    const bindToggle = (id, propName, historyLabel, mutator = null) => {
      const btn = document.getElementById(id);
      if (!btn) return;
      btn.addEventListener('click', () => {
        const active = this.layerManager.getActiveLayer();
        if (active && active.type === 'text' && active.textParams) {
          if (mutator) {
            mutator(active.textParams, btn);
          } else {
            active.textParams[propName] = !active.textParams[propName];
            btn.classList.toggle('active', !!active.textParams[propName]);
          }
          this.layerManager.renderTextLayer(active);
          this.renderComposite();
          this.pushHistoryState(historyLabel);
        }
      });
    };

    bindToggle('typo-btn-allcaps', 'allCaps', 'Toggle All Caps');
    bindToggle('typo-btn-smallcaps', 'smallCaps', 'Toggle Small Caps');
    bindToggle('typo-btn-underline', 'underline', 'Toggle Underline');
    bindToggle('typo-btn-strike', 'strikethrough', 'Toggle Strikethrough');
    bindToggle('typo-btn-italic', 'fontStyle', 'Toggle Italic', (p, btn) => {
      p.fontStyle = p.fontStyle === 'italic' ? 'normal' : 'italic';
      btn.classList.toggle('active', p.fontStyle === 'italic');
    });
    bindToggle('typo-btn-superscript', 'superscript', 'Toggle Superscript', (p, btn) => {
      p.superscript = !p.superscript;
      if (p.superscript) p.subscript = false;
      btn.classList.toggle('active', !!p.superscript);
      const subBtn = document.getElementById('typo-btn-subscript');
      if (subBtn) subBtn.classList.remove('active');
    });
    bindToggle('typo-btn-subscript', 'subscript', 'Toggle Subscript', (p, btn) => {
      p.subscript = !p.subscript;
      if (p.subscript) p.superscript = false;
      btn.classList.toggle('active', !!p.subscript);
      const superBtn = document.getElementById('typo-btn-superscript');
      if (superBtn) superBtn.classList.remove('active');
    });

    // Area Type & Paragraph Bounds
    const bindTypoNum = (id, prop, min, max, isFloat = false) => {
      const el = document.getElementById(id);
      if (!el) return;
      const update = (fromChange = false) => {
        const active = this.layerManager.getActiveLayer();
        if (active && active.type === 'text' && active.textParams) {
          const val = isFloat ? parseFloat(el.value) : parseInt(el.value, 10);
          active.textParams[prop] = Math.max(min, Math.min(max, isNaN(val) ? 0 : val));
          this.layerManager.renderTextLayer(active);
          this.renderComposite();
          if (fromChange) this.pushHistoryState(`Change Text ${prop}`);
        }
      };
      el.addEventListener('input', () => update(false));
      el.addEventListener('change', () => update(true));
    };

    bindTypoNum('typo-box-width', 'boxWidth', 0, 4000);
    bindTypoNum('typo-first-indent', 'firstLineIndent', -100, 300);
    bindTypoNum('typo-left-indent', 'leftIndent', 0, 300);
    bindTypoNum('typo-space-after', 'spaceAfter', 0, 150);

    const btnRasterize = document.getElementById('btn-rasterize-type');
    if (btnRasterize) {
      btnRasterize.addEventListener('click', () => {
        if (this.layerManager.rasterizeTextLayer()) {
          this.pushHistoryState('Rasterize Type Layer');
        }
      });
    }
  }

  syncTypographyPanel(layer = null) {
    const active = layer || this.layerManager.getActiveLayer();
    const info = document.getElementById('typo-target-info');
    const isText = active && active.type === 'text' && active.textParams;

    if (info) {
      info.textContent = isText ? `Active: ${active.name}` : 'No text layer selected';
      info.style.color = isText ? '#93c5fd' : 'var(--text-muted)';
      info.style.borderColor = isText ? 'rgba(59, 130, 246, 0.4)' : 'transparent';
    }

    if (!isText) return;
    const p = active.textParams;

    const txtContent = document.getElementById('typo-text-content');
    if (txtContent && document.activeElement !== txtContent) {
      txtContent.value = p.text || '';
    }

    const fontFamilySel = document.getElementById('typo-font-family');
    if (fontFamilySel) fontFamilySel.value = p.fontFamily || 'Inter, sans-serif';

    const fontWeightSel = document.getElementById('typo-font-weight');
    if (fontWeightSel) fontWeightSel.value = p.fontWeight || 'normal';

    const fontSizeInput = document.getElementById('typo-font-size');
    if (fontSizeInput && document.activeElement !== fontSizeInput) fontSizeInput.value = p.fontSize || 48;

    const leadingInput = document.getElementById('typo-leading');
    if (leadingInput && document.activeElement !== leadingInput) leadingInput.value = p.leading || 1.25;

    const trackingInput = document.getElementById('typo-tracking');
    if (trackingInput && document.activeElement !== trackingInput) trackingInput.value = p.tracking || 0;

    const boxW = document.getElementById('typo-box-width');
    if (boxW && document.activeElement !== boxW) boxW.value = p.boxWidth || 0;

    const firstInd = document.getElementById('typo-first-indent');
    if (firstInd && document.activeElement !== firstInd) firstInd.value = p.firstLineIndent || 0;

    const leftInd = document.getElementById('typo-left-indent');
    if (leftInd && document.activeElement !== leftInd) leftInd.value = p.leftIndent || 0;

    const spaceAft = document.getElementById('typo-space-after');
    if (spaceAft && document.activeElement !== spaceAft) spaceAft.value = p.spaceAfter || 0;

    const colorPicker = document.getElementById('typo-color-picker');
    const colorHex = document.getElementById('typo-color-hex');
    const col = p.color || '#ffffff';
    if (colorPicker) colorPicker.value = col.startsWith('#') && col.length === 7 ? col : '#ffffff';
    if (colorHex && document.activeElement !== colorHex) colorHex.value = col;

    document.querySelectorAll('.typo-align-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.align === (p.align || 'left'));
    });

    const setToggleState = (id, activeState) => {
      const btn = document.getElementById(id);
      if (btn) btn.classList.toggle('active', !!activeState);
    };

    setToggleState('typo-btn-allcaps', p.allCaps);
    setToggleState('typo-btn-smallcaps', p.smallCaps);
    setToggleState('typo-btn-italic', p.fontStyle === 'italic');
    setToggleState('typo-btn-underline', p.underline);
    setToggleState('typo-btn-strike', p.strikethrough);
    setToggleState('typo-btn-superscript', p.superscript);
    setToggleState('typo-btn-subscript', p.subscript);
  }

  openTypographyInspector(layer = null) {
    const active = layer || this.layerManager.getActiveLayer();
    const panel = document.getElementById('panel-typography');
    if (panel) {
      panel.classList.remove('collapsed');
      const toggleBtn = panel.querySelector('.panel-toggle');
      if (toggleBtn) toggleBtn.textContent = '▾';
    }
    this.syncTypographyPanel(active);
    const txtContent = document.getElementById('typo-text-content');
    if (txtContent && active && active.type === 'text') {
      txtContent.focus();
      txtContent.select();
    }
  }

  // ── Drag & Drop Photo Engine ──
  bindDragAndDrop() {
    const overlay = document.getElementById('drag-drop-overlay');
    let dragCounter = 0;

    const showOverlay = () => {
      if (overlay) overlay.classList.remove('hidden');
    };
    const hideOverlay = () => {
      if (overlay) overlay.classList.add('hidden');
    };

    window.addEventListener('dragenter', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter++;
      if (e.dataTransfer && e.dataTransfer.types && (e.dataTransfer.types.includes('Files') || e.dataTransfer.types.includes('text/uri-list'))) {
        showOverlay();
      }
    });

    window.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
    });

    window.addEventListener('dragleave', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter--;
      if (dragCounter <= 0) {
        dragCounter = 0;
        hideOverlay();
      }
    });

    window.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter = 0;
      hideOverlay();

      const files = [];
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        for (let i = 0; i < e.dataTransfer.files.length; i++) {
          files.push(e.dataTransfer.files[i]);
        }
      } else if (e.dataTransfer && e.dataTransfer.items && e.dataTransfer.items.length > 0) {
        for (let i = 0; i < e.dataTransfer.items.length; i++) {
          const item = e.dataTransfer.items[i];
          if (item.kind === 'file') {
            const f = item.getAsFile();
            if (f) files.push(f);
          }
        }
      }

      if (files.length > 0) {
        this.handleDroppedFiles(files);
        return;
      }

      // Check if image URL was dragged from browser
      const uri = e.dataTransfer ? (e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain')) : null;
      if (uri && (uri.startsWith('http://') || uri.startsWith('https://') || uri.startsWith('data:image/'))) {
        this.loadImageFromDataUrl(uri, 'Web Image');
      }
    });
  }

  // Safe file reader converting dropped File/path to dataUrl
  async getFileDataUrl(file) {
    if (file.path) {
      try {
        const fs = require('fs');
        const path = require('path');
        const buffer = fs.readFileSync(file.path);
        const ext = path.extname(file.path).slice(1).toLowerCase();
        const mimeMap = {
          'jpg': 'image/jpeg', 'jpeg': 'image/jpeg',
          'png': 'image/png', 'webp': 'image/webp',
          'gif': 'image/gif', 'svg': 'image/svg+xml',
          'bmp': 'image/bmp', 'ico': 'image/x-icon',
          'jfif': 'image/jpeg', 'avif': 'image/avif',
          'tif': 'image/tiff', 'tiff': 'image/tiff'
        };
        const mime = mimeMap[ext] || 'image/png';
        return `data:${mime};base64,${buffer.toString('base64')}`;
      } catch (err) {
        console.warn('Native fs read error, falling back to FileReader:', err);
      }
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  }

  async handleDroppedFiles(files) {
    if (!files || files.length === 0) return;

    // Check for dropped Adobe Photoshop (.psd) files
    const psdFile = files.find(f => {
      const name = f.name || (f.path ? f.path.split(/[\\/]/).pop() : '') || '';
      return name.toLowerCase().endsWith('.psd');
    });

    if (psdFile) {
      try {
        let buffer;
        if (psdFile.path && typeof window.require !== 'undefined') {
          const fs = window.require('fs');
          buffer = fs.readFileSync(psdFile.path);
        } else {
          buffer = await new Promise((res, rej) => {
            const r = new FileReader();
            r.onload = (e) => res(e.target.result);
            r.onerror = rej;
            r.readAsArrayBuffer(psdFile);
          });
        }
        const name = psdFile.name || (psdFile.path ? psdFile.path.split(/[\\/]/).pop() : '') || 'Photoshop Document';
        this.loadProjectFromPsd(buffer, name);
      } catch (err) {
        console.error('Failed to parse dropped PSD file:', err);
      }
      return;
    }

    // Filter project files (.pforge)
    const projectFiles = files.filter(f => {
      const name = f.name || (f.path ? f.path.split(/[\\/]/).pop() : '') || '';
      return name.toLowerCase().endsWith('.pforge');
    });

    if (projectFiles.length > 0) {
      const pf = projectFiles[0];
      try {
        let content;
        if (pf.path) {
          const fs = require('fs');
          content = fs.readFileSync(pf.path, 'utf8');
        } else {
          content = await new Promise((res, rej) => {
            const r = new FileReader();
            r.onload = (e) => res(e.target.result);
            r.onerror = rej;
            r.readAsText(pf);
          });
        }
        const data = JSON.parse(content);
        this.loadProjectFromData(data);
      } catch (err) {
        console.error('Failed to parse dropped project:', err);
      }
      return;
    }

    // Filter image files safely without throwing on missing properties
    const imageFiles = files.filter(f => {
      const name = f.name || (f.path ? f.path.split(/[\\/]/).pop() : '') || '';
      const type = f.type || '';
      if (type.startsWith('image/')) return true;
      const ext = name.toLowerCase().split('.').pop();
      return ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif', 'svg', 'ico', 'jfif', 'tif', 'tiff', 'avif'].includes(ext);
    });

    if (imageFiles.length === 0) return;

    const isWelcome = !document.getElementById('welcome-overlay').classList.contains('hidden');
    const isDefaultBlank = this.layerManager.layers.length === 1 &&
      this.layerManager.layers[0].name === 'Background' &&
      this.historyManager.steps.length <= 1;

    for (let i = 0; i < imageFiles.length; i++) {
      const file = imageFiles[i];
      const filename = file.name || (file.path ? file.path.split(/[\\/]/).pop() : '') || `Image ${i + 1}`;
      try {
        const dataUrl = await this.getFileDataUrl(file);
        if (i === 0 && (isWelcome || isDefaultBlank)) {
          await this.loadImageFromDataUrl(dataUrl, filename);
        } else {
          await this.addDroppedImageAsLayer(dataUrl, filename);
        }
      } catch (err) {
        console.error(`Failed to load dropped file ${filename}:`, err);
      }
    }
  }

  addDroppedImageAsLayer(dataUrl, filename = 'Image') {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const layer = this.layerManager.addLayer(filename);
        if (!layer) {
          resolve(null);
          return;
        }

        const cw = this.width;
        const ch = this.height;
        const iw = img.naturalWidth || img.width;
        const ih = img.naturalHeight || img.height;

        let dw = iw;
        let dh = ih;

        // If image is larger than canvas, scale down proportionally to fit
        if (iw > cw || ih > ch) {
          const scale = Math.min(cw / iw, ch / ih);
          dw = Math.round(iw * scale);
          dh = Math.round(ih * scale);
        }

        const dx = Math.round((cw - dw) / 2);
        const dy = Math.round((ch - dh) / 2);

        layer.ctx.drawImage(img, dx, dy, dw, dh);
        this.renderComposite();
        this.updateStatusInfo();
        this.pushHistoryState('Add Layer: ' + filename);
        resolve(layer);
      };
      img.onerror = (err) => {
        console.error('Failed to render dropped image to layer:', err);
        resolve(null);
      };
      img.src = dataUrl;
    });
  }

  // ── System & Internal Clipboard Engine (Copy / Cut / Paste) ──
  bindClipboardEvents() {
    window.addEventListener('paste', (e) => this.handleGlobalPaste(e));
  }

  copySelection() {
    const active = this.layerManager.getActiveLayer();
    if (!active) return;

    let clipCan;
    const s = this.toolManager.selection;

    if (s && s.w > 0 && s.h > 0) {
      clipCan = Utils.createCanvas(s.w, s.h);
      const cCtx = clipCan.getContext('2d');

      cCtx.save();
      cCtx.beginPath();
      if (s.type === 'ellipse') {
        cCtx.ellipse(s.w / 2, s.h / 2, s.w / 2, s.h / 2, 0, 0, Math.PI * 2);
      } else {
        cCtx.rect(0, 0, s.w, s.h);
      }
      cCtx.clip();
      cCtx.drawImage(active.canvas, s.x, s.y, s.w, s.h, 0, 0, s.w, s.h);
      cCtx.restore();

      // If wand selection mask exists, clip alpha precisely
      if (s.mask) {
        const imgData = cCtx.getImageData(0, 0, s.w, s.h);
        const d = imgData.data;
        for (let y = 0; y < s.h; y++) {
          for (let x = 0; x < s.w; x++) {
            const srcIdx = (s.y + y) * this.width + (s.x + x);
            if (srcIdx >= 0 && srcIdx < s.mask.length && !s.mask[srcIdx]) {
              d[(y * s.w + x) * 4 + 3] = 0;
            }
          }
        }
        cCtx.putImageData(imgData, 0, 0);
      }
    } else {
      // Copy entire active layer
      clipCan = Utils.createCanvas(this.width, this.height);
      clipCan.getContext('2d').drawImage(active.canvas, 0, 0);
    }

    this.internalClipboard = clipCan;

    // Write to OS clipboard
    try {
      if (window.require) {
        const { clipboard, nativeImage } = window.require('electron');
        const img = nativeImage.createFromDataURL(clipCan.toDataURL());
        clipboard.writeImage(img);
      } else if (navigator.clipboard?.write) {
        clipCan.toBlob((blob) => {
          if (blob) {
            navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]).catch(() => {});
          }
        });
      }
    } catch (err) {
      console.warn('System clipboard write skipped:', err);
    }
  }

  cutSelection() {
    this.copySelection();
    this.handleMenuAction('clear-layer');
  }

  async pasteClipboard() {
    // 1. Try reading from Electron native clipboard
    try {
      if (window.require) {
        const { clipboard } = window.require('electron');
        const nativeImg = clipboard.readImage();
        if (!nativeImg.isEmpty()) {
          const dataUrl = nativeImg.toDataURL();
          this.pasteImageFromDataUrl(dataUrl, 'Pasted Layer');
          return;
        }
      }
    } catch (e) {}

    // 2. Try reading from Web navigator.clipboard
    try {
      if (navigator.clipboard?.read) {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          const imgType = item.types.find(t => t.startsWith('image/'));
          if (imgType) {
            const blob = await item.getType(imgType);
            const reader = new FileReader();
            reader.onload = (ev) => this.pasteImageFromDataUrl(ev.target.result, 'Pasted Layer');
            reader.readAsDataURL(blob);
            return;
          }
        }
      }
    } catch (e) {}

    // 3. Fallback to internal clipboard buffer
    if (this.internalClipboard) {
      this.pasteImageFromDataUrl(this.internalClipboard.toDataURL(), 'Pasted Layer');
    }
  }

  pasteImageFromDataUrl(dataUrl, layerName = 'Pasted Layer') {
    if (!dataUrl) return;
    const img = new Image();
    img.onload = () => {
      const iw = img.naturalWidth || img.width;
      const ih = img.naturalHeight || img.height;
      if (iw <= 0 || ih <= 0) return;

      const newLayer = this.layerManager.addLayer(layerName);
      if (!newLayer) return;

      let dw = iw;
      let dh = ih;
      // If pasted image is larger than canvas, scale down proportionally
      if (iw > this.width || ih > this.height) {
        const scale = Math.min(this.width / iw, this.height / ih);
        dw = Math.round(iw * scale);
        dh = Math.round(ih * scale);
      }

      const dx = Math.round((this.width - dw) / 2);
      const dy = Math.round((this.height - dh) / 2);

      newLayer.ctx.drawImage(img, dx, dy, dw, dh);
      this.renderComposite();
      this.layerManager.renderLayerStackUI();
      this.pushHistoryState('Paste Layer');
    };
    img.src = dataUrl;
  }

  handleGlobalPaste(e) {
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;

    if (e.clipboardData && e.clipboardData.items) {
      for (let i = 0; i < e.clipboardData.items.length; i++) {
        const item = e.clipboardData.items[i];
        if (item.type.indexOf('image') !== -1) {
          e.preventDefault();
          const file = item.getAsFile();
          const reader = new FileReader();
          reader.onload = (ev) => this.pasteImageFromDataUrl(ev.target.result, 'Pasted Image');
          reader.readAsDataURL(file);
          return;
        }
      }
    }
  }

  hideWelcomeOverlay() {
    document.getElementById('welcome-overlay').classList.add('hidden');
  }

  showWelcomeOverlay() {
    const el = document.getElementById('welcome-overlay');
    if (el) el.classList.remove('hidden');
    if (this.recentProjectsManager) {
      this.recentProjectsManager.renderUI();
    }
  }

  // ── Phase 5 Layer Architecture: Isolation Mode ──
  enterIsolationMode(layerId = null) {
    const id = layerId || this.layerManager?.activeLayerId;
    if (!id || !this.layerManager) return;
    this.layerManager.enterIsolationMode(id);
    this.updateIsolationUI();
    this.renderComposite();
    this.pushHistoryState('Enter Isolation Mode');
  }

  exitIsolationMode() {
    if (!this.layerManager || !this.layerManager.isolatedLayerId) return;
    this.layerManager.exitIsolationMode();
    this.updateIsolationUI();
    this.renderComposite();
    this.pushHistoryState('Exit Isolation Mode');
  }

  toggleIsolationMode(layerId = null) {
    if (this.layerManager?.isolatedLayerId) {
      this.exitIsolationMode();
    } else {
      this.enterIsolationMode(layerId);
    }
  }

  updateIsolationUI() {
    const banner = document.getElementById('isolation-banner');
    const nameEl = document.getElementById('isolation-target-name');
    if (!banner || !this.layerManager) return;

    if (this.layerManager.isolatedLayerId) {
      const layer = this.layerManager.layers.find(l => l.id === this.layerManager.isolatedLayerId);
      if (nameEl) nameEl.textContent = layer ? layer.name : 'Layer';
      banner.classList.remove('hidden');
    } else {
      banner.classList.add('hidden');
    }
  }

  // ── Phase 5 Layer Architecture: Layer Comps ──
  openLayerCompsModal() {
    this.renderLayerCompsList();
    this.showModal('modal-layer-comps');
  }

  renderLayerCompsList() {
    const tbody = document.getElementById('tbody-layer-comps');
    if (!tbody || !this.layerManager) return;
    tbody.innerHTML = '';

    const comps = this.layerManager.layerComps;
    if (comps.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="4" style="text-align:center; color:var(--text-muted); padding:16px;">No layer comps created yet. Click "+ New Comp" to capture state.</td>`;
      tbody.appendChild(tr);
      return;
    }

    comps.forEach(comp => {
      const tr = document.createElement('tr');
      if (comp.id === this.layerManager.activeCompId) {
        tr.classList.add('selected');
      }

      const captures = [];
      if (comp.captureVisibility) captures.push('Vis');
      if (comp.capturePosition) captures.push('Pos');
      if (comp.captureAppearance) captures.push('App');

      tr.innerHTML = `
        <td style="text-align:center;">
          <input type="radio" name="active-layer-comp" ${comp.id === this.layerManager.activeCompId ? 'checked' : ''} style="cursor:pointer;">
        </td>
        <td style="font-weight:600; cursor:pointer;">${comp.name}</td>
        <td><span style="font-size:10px; background:var(--bg-dark); padding:2px 6px; border-radius:3px;">${captures.join(' · ') || 'None'}</span></td>
        <td style="color:var(--text-muted); font-size:11px;">${comp.comment || '-'}</td>
      `;

      tr.addEventListener('click', () => {
        this.layerManager.applyLayerComp(comp.id);
        this.renderComposite();
        this.renderLayerCompsList();
        this.pushHistoryState(`Apply Comp: ${comp.name}`);
      });

      tbody.appendChild(tr);
    });
  }

  // ── Phase 5 Layer Architecture: Links & Assets Manager ──
  openAssetsManagerModal() {
    this.renderAssetsList();
    this.showModal('modal-assets-manager');
  }

  renderAssetsList() {
    const tbody = document.getElementById('tbody-assets');
    if (!tbody || !this.assetManager) return;
    tbody.innerHTML = '';

    const assets = this.assetManager.listAssets();
    if (assets.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="5" style="text-align:center; color:var(--text-muted); padding:16px;">No linked or embedded assets in document.</td>`;
      tbody.appendChild(tr);
      return;
    }

    assets.forEach(asset => {
      const tr = document.createElement('tr');
      tr.dataset.assetId = asset.id;
      tr.innerHTML = `
        <td><span class="status-pill ${asset.status}">${asset.status.toUpperCase()}</span></td>
        <td style="font-weight:600;">${asset.name}</td>
        <td style="text-transform:capitalize;">${asset.type}</td>
        <td>${asset.width} × ${asset.height}</td>
        <td>${asset.getFormattedSize()}</td>
      `;
      tr.addEventListener('click', () => {
        tbody.querySelectorAll('tr').forEach(r => r.classList.remove('selected'));
        tr.classList.add('selected');
      });
      tbody.appendChild(tr);
    });
  }

  // ── Phase 5 Layer Architecture: Artboards ──
  openArtboardsModal() {
    this.renderArtboardsList();
    this.showModal('modal-artboards');
  }

  renderArtboardsList() {
    const tbody = document.getElementById('tbody-artboards');
    if (!tbody || !this.layerManager) return;
    tbody.innerHTML = '';

    const artboards = this.layerManager.artboards;
    if (artboards.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="4" style="text-align:center; color:var(--text-muted); padding:12px;">No artboards defined. Document uses single master canvas.</td>`;
      tbody.appendChild(tr);
      return;
    }

    artboards.forEach(ab => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-weight:600;">${ab.name}</td>
        <td>${ab.width} × ${ab.height}</td>
        <td style="text-transform:capitalize;">${ab.bgType}</td>
        <td><button class="btn-ghost-sm btn-del-ab" data-id="${ab.id}" title="Delete Artboard">✕</button></td>
      `;

      tr.querySelector('.btn-del-ab').addEventListener('click', (e) => {
        e.stopPropagation();
        this.layerManager.deleteArtboard(ab.id);
        this.renderComposite();
        this.renderArtboardsList();
        this.pushHistoryState(`Delete Artboard: ${ab.name}`);
      });

      tbody.appendChild(tr);
    });
  }

  // ── Phase 6 Vector & Pen Engine: Paths Panel ──
  openPathsModal() {
    this.renderPathsList();
    this.showModal('modal-paths-panel');
  }

  renderPathsList() {
    const tbody = document.getElementById('tbody-paths');
    if (!tbody || !this.toolManager || !this.toolManager.pathManager) return;
    tbody.innerHTML = '';

    const pm = this.toolManager.pathManager;

    // 1. Work Path row
    const workTr = document.createElement('tr');
    const isWorkEmpty = pm.isEmpty();
    const subpathCount = pm.subpaths.length;
    const ptCount = pm.subpaths.reduce((acc, sp) => acc + sp.points.length, 0);

    workTr.innerHTML = `
      <td><strong>Work Path</strong></td>
      <td>${subpathCount}</td>
      <td>${isWorkEmpty ? '<span class="status-pill modified">Empty</span>' : `<span class="status-pill ok">${ptCount} pts</span>`}</td>
      <td>
        <button class="btn-xs btn-ghost" id="btn-activate-work-path" title="Activate Work Path">Select</button>
      </td>
    `;
    const btnActWork = workTr.querySelector('#btn-activate-work-path');
    if (btnActWork) {
      btnActWork.addEventListener('click', () => {
        pm.activeSavedPathId = null;
        this.clearOverlay();
        pm.renderOverlay(this.overlayCtx, this.zoom, this.panX, this.panY);
        this.renderPathsList();
      });
    }
    tbody.appendChild(workTr);

    // 2. Saved Paths rows
    pm.savedPaths.forEach(spItem => {
      const tr = document.createElement('tr');
      const isAct = pm.activeSavedPathId === spItem.id;
      const count = spItem.subpaths.reduce((acc, sp) => acc + sp.points.length, 0);

      tr.innerHTML = `
        <td><span style="color:${isAct ? 'var(--accent)' : 'inherit'}; font-weight:${isAct ? '600' : 'normal'};">${spItem.name}</span></td>
        <td>${spItem.subpaths.length}</td>
        <td><span class="status-pill ok">${count} pts</span></td>
        <td>
          <button class="btn-xs btn-primary btn-load-saved-path" data-id="${spItem.id}" title="Load Path into Work Path">Load</button>
          <button class="btn-xs btn-danger btn-del-saved-path" data-id="${spItem.id}" title="Delete Saved Path">✕</button>
        </td>
      `;

      tr.querySelector('.btn-load-saved-path').addEventListener('click', (e) => {
        e.stopPropagation();
        pm.loadSavedPath(spItem.id);
        this.clearOverlay();
        pm.renderOverlay(this.overlayCtx, this.zoom, this.panX, this.panY);
        this.renderPathsList();
      });

      tr.querySelector('.btn-del-saved-path').addEventListener('click', (e) => {
        e.stopPropagation();
        pm.deleteSavedPath(spItem.id);
        this.renderPathsList();
      });

      tbody.appendChild(tr);
    });
  }

  // ══════════════════════════════════════════════════════════════════════
  // Phase 8: File I/O & Export Suite
  // ══════════════════════════════════════════════════════════════════════
  async exportTiffFile(defaultName = 'PixelForge_Export.tif') {
    try {
      const exportCanvas = Utils.createCanvas(this.width, this.height);
      const eCtx = exportCanvas.getContext('2d');
      this.layerManager.compositeTo(eCtx);
      const imgData = eCtx.getImageData(0, 0, this.width, this.height);

      const tiffBytes = TiffEngine.encodeFromImageData(imgData, {
        dpi: 300,
        compression: 'packbits',
        software: 'PixelForge Studio Pro'
      });

      if (this.ipc) {
        let binary = '';
        for (let i = 0; i < tiffBytes.length; i++) binary += String.fromCharCode(tiffBytes[i]);
        const rawBase64 = btoa(binary);
        await this.ipc.invoke('dialog:saveFile', {
          rawBase64,
          defaultName,
          format: 'tiff'
        });
      } else {
        const blob = new Blob([tiffBytes], { type: 'image/tiff' });
        const link = document.createElement('a');
        link.download = defaultName;
        link.href = URL.createObjectURL(blob);
        link.click();
        URL.revokeObjectURL(link.href);
      }
    } catch (err) {
      console.error('Failed to export TIFF:', err);
      alert('Error exporting TIFF: ' + err.message);
    }
  }

  async exportPdfFile(defaultName = 'PixelForge_Document.pdf') {
    try {
      let canvases = [];
      if (this.layerManager.artboards && this.layerManager.artboards.length > 0) {
        canvases = this.layerManager.artboards.map(ab => {
          const abCanvas = Utils.createCanvas(ab.width, ab.height);
          const abCtx = abCanvas.getContext('2d');
          if (ab.background && ab.background !== 'transparent') {
            abCtx.fillStyle = ab.background === 'white' ? '#ffffff' : (ab.background === 'black' ? '#000000' : (ab.bgColor || '#ffffff'));
            abCtx.fillRect(0, 0, ab.width, ab.height);
          }
          this.layerManager.compositeTo(abCtx, { artboardId: ab.id });
          return abCanvas;
        });
      } else {
        const exportCanvas = Utils.createCanvas(this.width, this.height);
        const eCtx = exportCanvas.getContext('2d');
        this.layerManager.compositeTo(eCtx);
        canvases.push(exportCanvas);
      }

      const pdfBytes = PdfExporter.exportFromCanvases(canvases, {
        title: 'PixelForge Document',
        author: 'PixelForge Studio'
      });

      if (this.ipc) {
        let binary = '';
        for (let i = 0; i < pdfBytes.length; i++) binary += String.fromCharCode(pdfBytes[i]);
        const rawBase64 = btoa(binary);
        await this.ipc.invoke('dialog:saveFile', {
          rawBase64,
          defaultName,
          format: 'pdf'
        });
      } else {
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const link = document.createElement('a');
        link.download = defaultName;
        link.href = URL.createObjectURL(blob);
        link.click();
        URL.revokeObjectURL(link.href);
      }
    } catch (err) {
      console.error('Failed to export PDF:', err);
      alert('Error exporting PDF: ' + err.message);
    }
  }

  openScreensExportModal() {
    const modal = document.getElementById('modal-screens-export');
    if (!modal) return;
    this.showModal('modal-screens-export');

    const btnRun = document.getElementById('btn-run-screens-export');
    if (btnRun) {
      btnRun.onclick = async () => {
        modal.classList.add('hidden');
        const scales = [];
        if (document.getElementById('screen-scale-1x')?.checked) scales.push({ scale: 1, suffix: '@1x' });
        if (document.getElementById('screen-scale-2x')?.checked) scales.push({ scale: 2, suffix: '@2x' });
        if (document.getElementById('screen-scale-3x')?.checked) scales.push({ scale: 3, suffix: '@3x' });
        if (document.getElementById('screen-scale-half')?.checked) scales.push({ scale: 0.5, suffix: '@0.5x' });
        if (scales.length === 0) scales.push({ scale: 1, suffix: '' });

        const format = document.getElementById('screens-export-format')?.value || 'png';
        const scope = document.getElementById('screens-export-scope')?.value || 'document';

        let targetCanvas = Utils.createCanvas(this.width, this.height);
        if (scope === 'layers') {
          const act = this.layerManager.getActiveLayer();
          if (act) targetCanvas = act.canvas;
        } else {
          this.layerManager.compositeTo(targetCanvas.getContext('2d'));
        }

        const assets = await AssetExporter.exportMultiScale(targetCanvas, scales, [format], 'Asset');
        assets.forEach(asset => {
          const link = document.createElement('a');
          link.download = asset.filename;
          link.href = asset.dataUrl;
          link.click();
        });
      };
    }
  }

  openBatchProcessModal() {
    const modal = document.getElementById('modal-batch-process');
    if (!modal) return;
    this.showModal('modal-batch-process');

    const fileInput = document.getElementById('batch-file-input');
    const countLabel = document.getElementById('batch-file-count');
    const statusBox = document.getElementById('batch-status-box');

    let selectedFiles = [];
    if (fileInput) {
      fileInput.onchange = (e) => {
        selectedFiles = Array.from(e.target.files);
        if (countLabel) countLabel.textContent = `${selectedFiles.length} file(s) chosen`;
      };
    }

    const wmOpacity = document.getElementById('batch-watermark-opacity');
    const wmVal = document.getElementById('val-batch-wm-alpha');
    if (wmOpacity && wmVal) {
      wmOpacity.oninput = () => { wmVal.textContent = wmOpacity.value; };
    }

    const btnRun = document.getElementById('btn-run-batch-process');
    if (btnRun) {
      btnRun.onclick = async () => {
        if (selectedFiles.length === 0) {
          alert('Please select at least one image to process.');
          return;
        }

        if (statusBox) {
          statusBox.style.display = 'block';
          statusBox.textContent = `Processing ${selectedFiles.length} files...`;
        }

        const targetFormat = document.getElementById('batch-target-format')?.value || 'png';
        const scaleVal = (parseInt(document.getElementById('batch-scale')?.value, 10) || 100) / 100;
        const qualityVal = (parseInt(document.getElementById('batch-quality')?.value, 10) || 90) / 100;
        const wmText = document.getElementById('batch-watermark-text')?.value || '';
        const wmAlpha = (parseInt(wmOpacity?.value, 10) || 40) / 100;
        const template = document.getElementById('batch-name-template')?.value || '{name}_processed';

        const fileItems = [];
        for (let i = 0; i < selectedFiles.length; i++) {
          const f = selectedFiles[i];
          const dataUrl = await new Promise(res => {
            const r = new FileReader();
            r.onload = ev => res(ev.target.result);
            r.readAsDataURL(f);
          });
          fileItems.push({
            name: f.name.replace(/\.[^/.]+$/, ""),
            data: dataUrl
          });
        }

        const options = {
          format: targetFormat,
          scale: scaleVal,
          quality: qualityVal,
          watermark: wmText ? { text: wmText, opacity: wmAlpha, position: 'bottom-right' } : null,
          namingTemplate: template
        };

        const results = await BatchProcessor.processBatch(fileItems, options);
        if (statusBox) {
          statusBox.textContent = `Completed ${results.length} files. Downloading...`;
        }

        results.forEach(res => {
          const link = document.createElement('a');
          link.download = res.filename;
          link.href = res.dataUrl;
          link.click();
        });

        setTimeout(() => {
          modal.classList.add('hidden');
        }, 1200);
      };
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // Phase 8: Color Management & Working Profiles
  // ══════════════════════════════════════════════════════════════════════
  openColorProfileModal(mode = 'assign') {
    const modal = document.getElementById('modal-color-profile');
    if (!modal) return;
    const title = document.getElementById('color-profile-modal-title');
    const desc = document.getElementById('color-profile-modal-desc');
    const intentRow = document.getElementById('row-rendering-intent');

    if (title) title.textContent = mode === 'assign' ? 'Assign Color Profile' : 'Convert to Color Profile';
    if (desc) {
      desc.textContent = mode === 'assign'
        ? 'Assigns the selected working profile tags to the document without altering raw pixel channel numbers.'
        : 'Converts pixel RGB values through XYZ tristimulus space to preserve exact perceptual appearance in the new gamut.';
    }
    if (intentRow) intentRow.style.display = mode === 'assign' ? 'none' : 'flex';

    this.showModal('modal-color-profile');

    const btnApply = document.getElementById('btn-apply-color-profile');
    if (btnApply) {
      btnApply.onclick = () => {
        const targetProfile = document.getElementById('select-color-profile')?.value || 'sRGB';
        const intent = document.getElementById('select-rendering-intent')?.value || 'perceptual';
        const embedProfile = document.getElementById('check-embed-profile')?.checked !== false;

        const prevProfile = this.activeColorProfile || 'sRGB';
        this.activeColorProfile = targetProfile;
        this.embedIccProfile = embedProfile;

        if (mode === 'convert' && prevProfile !== targetProfile) {
          this.layerManager.layers.forEach(layer => {
            if (layer.type === 'raster' || layer.type === 'smart-object') {
              const imgData = layer.ctx.getImageData(0, 0, layer.width, layer.height);
              const converted = ColorSpaceManager.convertProfile(imgData, prevProfile, targetProfile, intent);
              layer.ctx.putImageData(converted, 0, 0);
            }
          });
          this.renderComposite();
          this.pushHistoryState(`Convert Profile: ${targetProfile}`);
        } else {
          this.pushHistoryState(`Assign Profile: ${targetProfile}`);
        }

        modal.classList.add('hidden');
      };
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // Phase 8: AI & Neural Filters Suite Controller
  // ══════════════════════════════════════════════════════════════════════
  openNeuralFiltersModal() {
    const active = this.layerManager.getActiveLayer();
    if (!active || active.isGroup) {
      alert('Please select a valid layer to apply Neural Filters.');
      return;
    }

    const modal = document.getElementById('modal-neural-filters');
    if (!modal) return;
    this.showModal('modal-neural-filters');

    // Switch Category Tabs
    let currentFilter = 'skinSmoothing';
    const tabButtons = modal.querySelectorAll('.neural-tab-btn');
    const panes = modal.querySelectorAll('.neural-pane');

    tabButtons.forEach(btn => {
      btn.onclick = () => {
        tabButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        panes.forEach(p => p.classList.add('hidden'));
        const activePane = document.getElementById(`pane-${currentFilter}`);
        if (activePane) activePane.classList.remove('hidden');
      };
    });

    // Slider value labels
    const bindRange = (sliderId, labelId) => {
      const s = document.getElementById(sliderId);
      const l = document.getElementById(labelId);
      if (s && l) s.oninput = () => { l.textContent = s.value; };
    };
    bindRange('param-skin-smooth', 'val-skin-smooth');
    bindRange('param-skin-detail', 'val-skin-detail');
    bindRange('param-lens-radius', 'val-lens-radius');
    bindRange('param-lens-focal', 'val-lens-focal');
    bindRange('param-lens-bloom', 'val-lens-bloom');
    bindRange('param-ct-intensity', 'val-ct-intensity');
    bindRange('param-sr-edge', 'val-sr-edge');
    bindRange('param-sky-blend', 'val-sky-blend');
    bindRange('param-sky-feather', 'val-sky-feather');
    bindRange('param-sky-harmony', 'val-sky-harmony');

    // Color Transfer reference file loader
    let refImgData = null;
    const ctFileInput = document.getElementById('param-ct-file');
    if (ctFileInput) {
      ctFileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          const img = new Image();
          img.onload = () => {
            const can = Utils.createCanvas(img.naturalWidth || img.width, img.naturalHeight || img.height);
            const ctx = can.getContext('2d');
            ctx.drawImage(img, 0, 0);
            refImgData = ctx.getImageData(0, 0, can.width, can.height);
          };
          img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
      };
    }

    // Apply Button
    const btnApply = document.getElementById('btn-apply-neural-filter');
    if (btnApply) {
      btnApply.onclick = () => {
        modal.classList.add('hidden');
        let params = {};

        switch (currentFilter) {
          case 'skinSmoothing':
            params = {
              smoothness: parseInt(document.getElementById('param-skin-smooth')?.value, 10) || 50,
              detailPreservation: parseInt(document.getElementById('param-skin-detail')?.value, 10) || 75
            };
            break;
          case 'lensBlur':
            params = {
              blurRadius: parseInt(document.getElementById('param-lens-radius')?.value, 10) || 12,
              bladeCount: parseInt(document.getElementById('param-lens-blades')?.value, 10) || 7,
              focalDepth: parseInt(document.getElementById('param-lens-focal')?.value, 10) || 128,
              highlightBoost: parseInt(document.getElementById('param-lens-bloom')?.value, 10) || 40
            };
            break;
          case 'colorTransfer':
            params = {
              intensity: parseInt(document.getElementById('param-ct-intensity')?.value, 10) || 80,
              preserveLuminance: !!document.getElementById('param-ct-pres-lum')?.checked,
              refImgData: refImgData
            };
            break;
          case 'superResolution':
            params = {
              scale: parseInt(document.getElementById('param-sr-scale')?.value, 10) || 2,
              edgeEnhancement: parseInt(document.getElementById('param-sr-edge')?.value, 10) || 50
            };
            break;
          case 'skyReplacement':
            params = {
              preset: document.getElementById('param-sky-preset')?.value || 'sunset',
              skyBlend: parseInt(document.getElementById('param-sky-blend')?.value, 10) || 90,
              edgeFeather: parseInt(document.getElementById('param-sky-feather')?.value, 10) || 12,
              colorHarmony: parseInt(document.getElementById('param-sky-harmony')?.value, 10) || 50
            };
            break;
        }

        if (active.type === 'smart-object' && active.smartObjectData) {
          active.smartObjectData.addFilter(new SmartFilter(currentFilter, params));
          active.smartObjectData.renderToLayer(active);
          this.renderComposite();
          this.pushHistoryState(`Neural Filter: ${SmartFilter.getFilterTitle(currentFilter)}`);
        } else {
          const imgData = active.ctx.getImageData(0, 0, active.width, active.height);
          let filtered;
          if (currentFilter === 'colorTransfer') {
            filtered = NeuralFilters.colorTransfer(imgData, params.refImgData, params);
          } else {
            filtered = NeuralFilters[currentFilter](imgData, params);
          }

          if (currentFilter === 'superResolution') {
            active.canvas.width = filtered.width;
            active.canvas.height = filtered.height;
            active.width = filtered.width;
            active.height = filtered.height;
            active.ctx.putImageData(filtered, 0, 0);
          } else {
            active.ctx.putImageData(filtered, 0, 0);
          }

          this.renderComposite();
          this.pushHistoryState(`Neural Filter: ${SmartFilter.getFilterTitle(currentFilter)}`);
        }
      };
    }
  }

  // ── Phase 9: Guides, Grid & Smart Snapping ──
  renderGuidesAndOverlays() {
    if (!this.overlayCtx) return;
    if (this.guideManager) {
      this.guideManager.renderOverlay(this.overlayCtx, this.width, this.height);
    }
    if (this.warpEngine && this.warpEngine.active) {
      this.warpEngine.renderOverlay(this.overlayCtx);
    }
    if (this.puppetWarpEngine && this.puppetWarpEngine.active) {
      const viewport = document.getElementById('viewport-container');
      const vw = viewport ? viewport.clientWidth : 1000;
      const vh = viewport ? viewport.clientHeight : 800;
      this.puppetWarpEngine.renderOverlay(this.overlayCtx, this.zoom, this.panX, this.panY, vw, vh, this.width, this.height);
    }
    if (this.vanishingPointEngine && this.vanishingPointEngine.active) {
      const viewport = document.getElementById('viewport-container');
      const vw = viewport ? viewport.clientWidth : 1000;
      const vh = viewport ? viewport.clientHeight : 800;
      this.vanishingPointEngine.renderOverlay(this.overlayCtx, this.zoom, this.panX, this.panY, vw, vh, this.width, this.height);
    }
    if (this.objectFinderEngine && this.objectFinderEngine.active) {
      const viewport = document.getElementById('viewport-container');
      const vw = viewport ? viewport.clientWidth : 1000;
      const vh = viewport ? viewport.clientHeight : 800;
      this.objectFinderEngine.renderOverlay(this.overlayCtx, this.zoom, this.panX, this.panY, vw, vh, this.width, this.height);
    }
    if (this.symmetryEngine && this.symmetryEngine.enabled) {
      this.symmetryEngine.renderGuides(this.overlayCtx, this.width, this.height);
    }
    if (this.splitWarpEngine && this.splitWarpEngine.active) {
      this.splitWarpEngine.renderOverlay(this.overlayCtx);
    }
    if (this.quickMaskEngine && this.quickMaskEngine.active) {
      this.quickMaskEngine.renderRubylithOverlay(this.overlayCtx, this.zoom, this.panX, this.panY);
    }
  }

  bindRulerGuideInteractions() {
    if (!this.rulerTopCanvas || !this.rulerLeftCanvas) return;

    let draggingGuide = null;

    const getDocCoordsFromScreen = (clientX, clientY) => {
      const viewport = document.getElementById('viewport-container');
      const rect = viewport ? viewport.getBoundingClientRect() : { left: 0, top: 0 };
      const vw = viewport ? viewport.clientWidth : 1000;
      const vh = viewport ? viewport.clientHeight : 800;
      const originX = (vw / 2) + this.panX - (this.width * this.zoom / 2);
      const originY = (vh / 2) + this.panY - (this.height * this.zoom / 2);
      const mouseX = clientX - rect.left;
      const mouseY = clientY - rect.top;
      const docX = Math.round((mouseX - originX) / this.zoom);
      const docY = Math.round((mouseY - originY) / this.zoom);
      return { docX, docY };
    };

    this.rulerTopCanvas.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const { docY } = getDocCoordsFromScreen(e.clientX, e.clientY);
      draggingGuide = { type: 'horizontal', pos: docY };
    });

    this.rulerLeftCanvas.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const { docX } = getDocCoordsFromScreen(e.clientX, e.clientY);
      draggingGuide = { type: 'vertical', pos: docX };
    });

    window.addEventListener('mousemove', (e) => {
      if (!draggingGuide) return;
      const { docX, docY } = getDocCoordsFromScreen(e.clientX, e.clientY);
      if (draggingGuide.type === 'horizontal') {
        draggingGuide.pos = docY;
      } else {
        draggingGuide.pos = docX;
      }
      if (this.toolManager && this.toolManager.clearOverlay) {
        this.toolManager.clearOverlay();
      } else if (this.overlayCtx) {
        this.overlayCtx.clearRect(0, 0, this.width, this.height);
      }
      this.renderGuidesAndOverlays();
      if (this.overlayCtx) {
        this.overlayCtx.save();
        this.overlayCtx.strokeStyle = '#38bdf8';
        this.overlayCtx.setLineDash([4, 4]);
        this.overlayCtx.lineWidth = 1;
        this.overlayCtx.beginPath();
        if (draggingGuide.type === 'horizontal') {
          this.overlayCtx.moveTo(0, draggingGuide.pos);
          this.overlayCtx.lineTo(this.width, draggingGuide.pos);
        } else {
          this.overlayCtx.moveTo(draggingGuide.pos, 0);
          this.overlayCtx.lineTo(draggingGuide.pos, this.height);
        }
        this.overlayCtx.stroke();
        this.overlayCtx.restore();
      }
    });

    window.addEventListener('mouseup', () => {
      if (!draggingGuide) return;
      if (this.guideManager) {
        this.guideManager.addGuide(draggingGuide.type, draggingGuide.pos);
      }
      draggingGuide = null;
      if (this.toolManager && this.toolManager.clearOverlay) {
        this.toolManager.clearOverlay();
      }
      this.renderGuidesAndOverlays();
    });
  }

  // ── Phase 9: Perspective & Freeform Mesh Warp ──
  startPerspectiveTransform() {
    const active = this.layerManager.getActiveLayer();
    if (!active || active.isGroup) return;
    this.startMeshWarp('custom', 2, 2);
  }

  startMeshWarp(preset = 'custom', rows = 3, cols = 3) {
    const active = this.layerManager.getActiveLayer();
    if (!active || active.isGroup) return;
    if (this.warpEngine) {
      this.warpEngine.initGrid(active, rows, cols, preset);
      this.renderGuidesAndOverlays();
    }
  }

  commitMeshWarp() {
    const active = this.layerManager.getActiveLayer();
    if (!active || !this.warpEngine || !this.warpEngine.active) return;
    this.warpEngine.warpLayer(active);
    this.warpEngine.cancel();
    this.renderComposite();
    if (this.toolManager && this.toolManager.clearOverlay) {
      this.toolManager.clearOverlay();
    }
    this.renderGuidesAndOverlays();
    this.pushHistoryState('Warp Transform');
  }

  cancelMeshWarp() {
    if (this.warpEngine) {
      this.warpEngine.cancel();
      if (this.toolManager && this.toolManager.clearOverlay) {
        this.toolManager.clearOverlay();
      }
      this.renderGuidesAndOverlays();
    }
  }

  // ── Phase 9: 3D LUT & Cinematic Color Lookup ──
  openColorLookupModal() {
    const modal = document.getElementById('modal-color-lookup');
    if (!modal) return;
    modal.classList.remove('hidden');

    const selectPreset = document.getElementById('select-lut-preset');
    const customRow = document.getElementById('row-custom-lut-file');
    const inputCube = document.getElementById('input-custom-cube');
    const sliderInt = document.getElementById('slider-lut-intensity');
    const valInt = document.getElementById('val-lut-intensity');
    const checkAdj = document.getElementById('check-lut-adj-layer');
    const btnApply = document.getElementById('btn-apply-lut');

    let customParsedLut = null;

    if (sliderInt && valInt) {
      sliderInt.oninput = () => { valInt.textContent = sliderInt.value; };
    }

    if (selectPreset && customRow) {
      selectPreset.onchange = () => {
        if (selectPreset.value === 'custom') {
          customRow.classList.remove('hidden');
        } else {
          customRow.classList.add('hidden');
        }
      };
    }

    if (inputCube) {
      inputCube.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          try {
            customParsedLut = LutEngine.parseCube(ev.target.result);
          } catch (err) {
            alert('Failed to parse .cube file: ' + err.message);
          }
        };
        reader.readAsText(file);
      };
    }

    if (btnApply) {
      btnApply.onclick = () => {
        modal.classList.add('hidden');
        const presetName = selectPreset ? selectPreset.value : 'Teal & Orange';
        const intensity = sliderInt ? (parseInt(sliderInt.value, 10) / 100) : 1.0;
        const asAdj = checkAdj ? checkAdj.checked : true;

        let lutObj = null;
        if (presetName === 'custom' && customParsedLut) {
          lutObj = customParsedLut;
        } else if (this.lutEngine) {
          lutObj = this.lutEngine.getPreset(presetName);
        }

        if (asAdj) {
          this.layerManager.addAdjustmentLayer('colorLookup', {
            preset: presetName,
            lut: lutObj,
            intensity: intensity
          });
          this.renderComposite();
          this.pushHistoryState(`Adjustment Layer: Color Lookup (${presetName})`);
        } else {
          const active = this.layerManager.getActiveLayer();
          if (active && !active.isGroup) {
            const imgData = active.ctx.getImageData(0, 0, active.width, active.height);
            LutEngine.applyLut(imgData, lutObj, intensity);
            active.ctx.putImageData(imgData, 0, 0);
            this.renderComposite();
            this.pushHistoryState(`Color Lookup: ${presetName}`);
          }
        }
      };
    }
  }

  // ── Phase 9: Offset Filter ──
  openOffsetFilterModal() {
    const modal = document.getElementById('modal-offset-filter');
    if (!modal) return;
    const active = this.layerManager.getActiveLayer();
    if (!active || active.isGroup) {
      alert('Please select a raster layer for the Offset Filter.');
      return;
    }

    modal.classList.remove('hidden');

    const sliderX = document.getElementById('slider-offset-x');
    const valX = document.getElementById('val-offset-x');
    const sliderY = document.getElementById('slider-offset-y');
    const valY = document.getElementById('val-offset-y');
    const seamBadge = document.getElementById('offset-seam-badge');
    const btnApply = document.getElementById('btn-apply-offset');

    if (sliderX) {
      sliderX.min = -this.width;
      sliderX.max = this.width;
      sliderX.value = Math.round(this.width / 2);
      if (valX) valX.textContent = sliderX.value;
    }
    if (sliderY) {
      sliderY.min = -this.height;
      sliderY.max = this.height;
      sliderY.value = Math.round(this.height / 2);
      if (valY) valY.textContent = sliderY.value;
    }

    const updateScore = () => {
      const imgData = active.ctx.getImageData(0, 0, active.width, active.height);
      const score = OffsetFilter.calculateSeamlessScore(imgData);
      if (seamBadge) {
        seamBadge.textContent = `${score}% Seamless`;
        seamBadge.style.color = score > 85 ? '#22c55e' : score > 60 ? '#f59e0b' : '#ef4444';
      }
    };
    updateScore();

    if (sliderX && valX) sliderX.oninput = () => { valX.textContent = sliderX.value; };
    if (sliderY && valY) sliderY.oninput = () => { valY.textContent = sliderY.value; };

    if (btnApply) {
      btnApply.onclick = () => {
        modal.classList.add('hidden');
        const hShift = sliderX ? parseInt(sliderX.value, 10) : 0;
        const vShift = sliderY ? parseInt(sliderY.value, 10) : 0;
        const undefMode = document.querySelector('input[name="offset-undefined"]:checked')?.value || 'wrapAround';

        const imgData = active.ctx.getImageData(0, 0, active.width, active.height);
        const shifted = OffsetFilter.apply(imgData, hShift, vShift, undefMode);
        active.ctx.putImageData(shifted, 0, 0);
        this.renderComposite();
        this.pushHistoryState(`Filter: Offset (${hShift}px, ${vShift}px)`);
      };
    }
  }

  // ── Phase 9: Define Pattern ──
  openDefinePatternModal() {
    const modal = document.getElementById('modal-define-pattern');
    if (!modal) return;
    const active = this.layerManager.getActiveLayer();
    if (!active) return;

    modal.classList.remove('hidden');

    const thumbCanvas = document.getElementById('define-pattern-thumb');
    const inputName = document.getElementById('input-pattern-name');
    const lblDims = document.getElementById('lbl-pattern-dimensions');
    const btnSave = document.getElementById('btn-save-defined-pattern');

    const sel = this.toolManager.selection;
    const srcX = sel ? Math.max(0, sel.x) : 0;
    const srcY = sel ? Math.max(0, sel.y) : 0;
    const srcW = sel ? Math.min(this.width - srcX, sel.w) : this.width;
    const srcH = sel ? Math.min(this.height - srcY, sel.h) : this.height;

    if (lblDims) lblDims.textContent = `Dimensions: ${srcW} × ${srcH} px`;
    if (inputName) inputName.value = `Pattern ${this.patternManager ? this.patternManager.patterns.length + 1 : 1}`;

    if (thumbCanvas) {
      const tCtx = thumbCanvas.getContext('2d');
      tCtx.clearRect(0, 0, 96, 96);
      tCtx.drawImage(active.canvas, srcX, srcY, srcW, srcH, 0, 0, 96, 96);
    }

    if (btnSave) {
      btnSave.onclick = () => {
        modal.classList.add('hidden');
        const patName = inputName ? inputName.value.trim() : 'Custom Pattern';
        if (this.patternManager) {
          this.patternManager.definePattern(patName, active.canvas, { x: srcX, y: srcY, width: srcW, height: srcH });
        }
        alert(`Pattern "${patName}" added to library!`);
      };
    }
  }

  openPatternsLibrary() {
    if (!this.patternManager) return;
    const names = this.patternManager.patterns.map(p => `• ${p.name} (${p.width}×${p.height})`).join('\n');
    alert(`PixelForge Patterns Library (${this.patternManager.patterns.length} items):\n\n${names}`);
  }

  // ── Phase 9: Actions Palette ──
  openActionsPalette() {
    const modal = document.getElementById('modal-actions-palette');
    if (!modal) return;
    modal.classList.remove('hidden');
    this.refreshActionsPaletteUI();

    const btnRecord = document.getElementById('btn-act-record');
    const btnStop = document.getElementById('btn-act-stop');
    const btnPlay = document.getElementById('btn-act-play');
    const btnRunModal = document.getElementById('btn-run-action-palette');
    const btnExport = document.getElementById('btn-act-export');
    const selectAction = document.getElementById('select-active-action');

    if (selectAction) {
      selectAction.onchange = () => this.refreshActionsPaletteUI();
    }

    if (btnPlay) {
      btnPlay.onclick = () => this.runSelectedAction();
    }
    if (btnRunModal) {
      btnRunModal.onclick = () => {
        modal.classList.add('hidden');
        this.runSelectedAction();
      };
    }

    if (btnRecord && btnStop) {
      btnRecord.onclick = () => {
        const actName = prompt('Enter name for recorded action:', 'My Custom Macro');
        if (!actName) return;
        const set = this.actionsEngine.sets[0];
        const newAct = set.addAction(new Action(actName));
        this.actionsEngine.startRecording(newAct);
        btnRecord.classList.add('hidden');
        btnStop.classList.remove('hidden');
        this.refreshActionsPaletteUI();
      };
      btnStop.onclick = () => {
        this.actionsEngine.stopRecording();
        btnStop.classList.add('hidden');
        btnRecord.classList.remove('hidden');
        this.refreshActionsPaletteUI();
      };
    }

    if (btnExport) {
      btnExport.onclick = () => {
        const json = this.actionsEngine.exportSet(this.actionsEngine.sets[0]);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'pixelforge-actions.pfa';
        a.click();
        URL.revokeObjectURL(url);
      };
    }
  }

  refreshActionsPaletteUI() {
    if (!this.actionsEngine) return;
    const selectAction = document.getElementById('select-active-action');
    const stepsList = document.getElementById('actions-steps-list');
    if (!stepsList) return;

    const currentSetName = this.actionsEngine.sets[0];
    const selectedActionName = selectAction ? selectAction.value : 'Vibrant Pop';
    const action = currentSetName ? currentSetName.actions.find(a => a.name === selectedActionName) : null;

    stepsList.innerHTML = '';
    if (!action || action.steps.length === 0) {
      stepsList.innerHTML = '<div style="color:var(--text-muted); padding:4px;">No recorded steps in this action.</div>';
      return;
    }

    action.steps.forEach((step, idx) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex; align-items:center; gap:8px; padding:2px 0; border-bottom:1px solid rgba(255,255,255,0.05);';
      row.innerHTML = `
        <input type="checkbox" ${step.enabled ? 'checked' : ''} style="cursor:pointer;">
        <span style="color:var(--text-muted); font-size:11px; width:18px;">${idx + 1}.</span>
        <span style="flex:1;">${step.name}</span>
      `;
      const chk = row.querySelector('input');
      chk.onchange = () => { step.enabled = chk.checked; };
      stepsList.appendChild(row);
    });
  }

  async runSelectedAction() {
    if (!this.actionsEngine) return;
    const selectAction = document.getElementById('select-active-action');
    const selectedActionName = selectAction ? selectAction.value : 'Vibrant Pop';
    const set = this.actionsEngine.sets[0];
    const action = set ? set.actions.find(a => a.name === selectedActionName) : null;
    if (!action) return;

    const res = await this.actionsEngine.playAction(action);
    if (res.success) {
      this.pushHistoryState(`Action: ${action.name}`);
      this.renderComposite();
    } else {
      alert(`Action error: ${res.errors.join(', ')}`);
    }
  }

  // ── Phase 10: Puppet Warp Deformation Suite ──
  startPuppetWarp() {
    const active = this.layerManager.getActiveLayer();
    if (!active || active.isGroup) {
      alert('Please select a raster layer for Puppet Warp.');
      return;
    }
    if (this.puppetWarpEngine) {
      this.puppetWarpEngine.initMesh(active);
      this.renderGuidesAndOverlays();
    }
  }

  commitPuppetWarp() {
    const active = this.layerManager.getActiveLayer();
    if (!active || !this.puppetWarpEngine || !this.puppetWarpEngine.active) return;
    this.puppetWarpEngine.applyWarp(active);
    this.puppetWarpEngine.cancel();
    this.renderComposite();
    if (this.toolManager && this.toolManager.clearOverlay) {
      this.toolManager.clearOverlay();
    }
    this.renderGuidesAndOverlays();
    this.pushHistoryState('Puppet Warp');
  }

  cancelPuppetWarp() {
    if (this.puppetWarpEngine) {
      this.puppetWarpEngine.cancel();
      if (this.toolManager && this.toolManager.clearOverlay) {
        this.toolManager.clearOverlay();
      }
      this.renderGuidesAndOverlays();
    }
  }

  // ── Phase 10: High Pass Filter ──
  openHighPassModal() {
    const modal = document.getElementById('modal-high-pass');
    if (!modal) return;
    const active = this.layerManager.getActiveLayer();
    if (!active || active.isGroup) {
      alert('Please select a raster layer to apply the High Pass filter.');
      return;
    }
    modal.classList.remove('hidden');

    const slider = document.getElementById('slider-highpass-radius');
    const val = document.getElementById('val-highpass-radius');
    const btnApply = document.getElementById('btn-apply-highpass');

    if (slider && val) {
      slider.oninput = () => { val.textContent = parseFloat(slider.value).toFixed(1); };
    }

    if (btnApply) {
      btnApply.onclick = () => {
        const rad = slider ? parseFloat(slider.value) : 3.0;
        modal.classList.add('hidden');
        if (typeof HighPassFilter !== 'undefined') {
          const drawCtx = this.layerManager.getActiveDrawCtx();
          if (drawCtx) {
            const imgData = drawCtx.getImageData(0, 0, this.width, this.height);
            const filtered = HighPassFilter.apply(imgData, rad);
            drawCtx.putImageData(filtered, 0, 0);
            this.renderComposite();
            this.pushHistoryState(`High Pass Filter (${rad}px)`);
          }
        }
      };
    }
  }

  // ── Phase 10: Frequency Separation Suite ──
  openFrequencySeparationModal() {
    const modal = document.getElementById('modal-frequency-separation');
    if (!modal) return;
    const active = this.layerManager.getActiveLayer();
    if (!active || active.isGroup) {
      alert('Please select a raster layer to run Frequency Separation.');
      return;
    }
    modal.classList.remove('hidden');

    const slider = document.getElementById('slider-freqsep-radius');
    const val = document.getElementById('val-freqsep-radius');
    const btnApply = document.getElementById('btn-apply-freqsep');

    if (slider && val) {
      slider.oninput = () => { val.textContent = parseFloat(slider.value).toFixed(1); };
    }

    if (btnApply) {
      btnApply.onclick = () => {
        const rad = slider ? parseFloat(slider.value) : 3.0;
        modal.classList.add('hidden');
        if (this.frequencySeparationEngine) {
          this.frequencySeparationEngine.separate(active, rad);
          this.renderComposite();
          this.pushHistoryState(`Frequency Separation (${rad}px)`);
        }
      };
    }
  }

  // ── Phase 10: Channels Palette Engine ──
  openChannelsPaletteModal() {
    const modal = document.getElementById('modal-channels-palette');
    if (!modal) return;
    modal.classList.remove('hidden');

    this.renderChannelsPaletteList();

    const btnLoad = document.getElementById('btn-chan-load-sel');
    const btnSave = document.getElementById('btn-chan-save-sel');
    const btnDup = document.getElementById('btn-chan-dup');
    const btnDel = document.getElementById('btn-chan-del');
    const btnCalc = document.getElementById('btn-chan-calc');

    if (btnLoad) {
      btnLoad.onclick = () => {
        if (!this.channelsEngine) return;
        const sel = this.channelsEngine.loadChannelAsSelection(this.channelsEngine.activeChannelId);
        if (sel) {
          this.toolManager.selection = sel;
          this.toolManager.renderMarchingAnts();
          this.pushHistoryState('Load Channel as Selection');
        }
      };
    }

    if (btnSave) {
      btnSave.onclick = () => {
        if (!this.channelsEngine) return;
        const name = prompt('Alpha Channel Name:', `Alpha ${this.channelsEngine.channels.length - 3}`);
        if (!name) return;
        this.channelsEngine.saveSelectionAsAlpha(this.toolManager.selection, name);
        this.renderChannelsPaletteList();
        this.pushHistoryState('Save Selection to Alpha Channel');
      };
    }

    if (btnDup) {
      btnDup.onclick = () => {
        if (!this.channelsEngine) return;
        this.channelsEngine.duplicateChannel(this.channelsEngine.activeChannelId);
        this.renderChannelsPaletteList();
      };
    }

    if (btnDel) {
      btnDel.onclick = () => {
        if (!this.channelsEngine) return;
        if (['rgb', 'red', 'green', 'blue'].includes(this.channelsEngine.activeChannelId)) {
          alert('Cannot delete component color channels.');
          return;
        }
        this.channelsEngine.deleteAlphaChannel(this.channelsEngine.activeChannelId);
        this.renderChannelsPaletteList();
      };
    }

    if (btnCalc) {
      btnCalc.onclick = () => {
        if (!this.channelsEngine) return;
        const alphaCh = this.channelsEngine.calculate('red', 'green', 'multiply', 1.0);
        this.renderChannelsPaletteList();
        alert(`Created calculation channel: ${alphaCh.name}`);
      };
    }
  }

  renderChannelsPaletteList() {
    const container = document.getElementById('channels-list-container');
    if (!container || !this.channelsEngine) return;
    container.innerHTML = '';

    const list = this.channelsEngine.getChannelList();
    list.forEach(item => {
      const row = document.createElement('div');
      const isActive = item.id === this.channelsEngine.activeChannelId;
      row.style.cssText = `display:flex; align-items:center; gap:10px; padding:6px 8px; border-radius:4px; cursor:pointer; background:${isActive ? 'rgba(56,189,248,0.15)' : 'transparent'}; border:1px solid ${isActive ? '#38bdf8' : 'transparent'};`;

      row.innerHTML = `
        <span style="cursor:pointer; font-size:14px; user-select:none;" title="Toggle Visibility">${item.visible ? '👁' : ' ' }</span>
        <div style="width:36px; height:24px; background:#1e293b; border:1px solid rgba(255,255,255,0.1); border-radius:2px; display:flex; align-items:center; justify-content:center; font-size:10px; font-weight:bold; color:#94a3b8;">
          ${item.id.toUpperCase().slice(0, 3)}
        </div>
        <div style="flex:1; display:flex; flex-direction:column;">
          <span style="font-size:12px; font-weight:600; color:${isActive ? '#38bdf8' : '#f1f5f9'};">${item.name}</span>
          <span style="font-size:10px; color:var(--text-muted);">${item.type.toUpperCase()} Channel</span>
        </div>
        <span style="font-size:11px; color:var(--text-muted); font-family:monospace;">${item.shortcut || ''}</span>
      `;

      row.onclick = () => {
        this.channelsEngine.activeChannelId = item.id;
        this.renderChannelsPaletteList();
      };

      const eye = row.querySelector('span');
      eye.onclick = (e) => {
        e.stopPropagation();
        this.channelsEngine.toggleChannelVisibility(item.id);
        this.renderChannelsPaletteList();
        this.renderComposite();
      };

      container.appendChild(row);
    });
  }

  // ── Phase 10: Timeline & Animated GIF Suite ──
  openTimelinePaletteModal() {
    const modal = document.getElementById('modal-timeline-palette');
    if (!modal) return;
    modal.classList.remove('hidden');

    if (this.timelineManager && this.timelineManager.frames.length === 0) {
      this.timelineManager.createFrame(0.1);
    }

    this.renderTimelineFramesStrip();

    const btnPlay = document.getElementById('btn-timeline-play');
    const btnAdd = document.getElementById('btn-timeline-add');
    const btnDel = document.getElementById('btn-timeline-del');
    const selLoop = document.getElementById('select-timeline-loop');
    const btnExportGif = document.getElementById('btn-timeline-export-gif');

    if (btnPlay) {
      btnPlay.onclick = () => {
        if (!this.timelineManager) return;
        if (this.timelineManager.isPlaying) {
          this.timelineManager.stop();
          btnPlay.textContent = '▶ Play';
          btnPlay.style.background = '';
        } else {
          this.timelineManager.play((frameIdx) => {
            this.renderTimelineFramesStrip();
          });
          btnPlay.textContent = '⏸ Pause';
          btnPlay.style.background = '#e11d48';
        }
      };
    }

    if (btnAdd) {
      btnAdd.onclick = () => {
        if (!this.timelineManager) return;
        this.timelineManager.createFrame(0.1);
        this.renderTimelineFramesStrip();
      };
    }

    if (btnDel) {
      btnDel.onclick = () => {
        if (!this.timelineManager) return;
        this.timelineManager.deleteFrame(this.timelineManager.activeFrameIndex);
        this.renderTimelineFramesStrip();
      };
    }

    if (selLoop) {
      selLoop.onchange = () => {
        if (this.timelineManager) this.timelineManager.loop = selLoop.value;
      };
    }

    if (btnExportGif) {
      btnExportGif.onclick = async () => {
        if (!this.timelineManager) return;
        btnExportGif.textContent = 'Encoding GIF...';
        btnExportGif.disabled = true;
        try {
          const blob = await this.timelineManager.exportGif();
          if (blob) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'pixelforge-animation.gif';
            a.click();
            URL.revokeObjectURL(url);
          }
        } catch (err) {
          alert('Error exporting GIF: ' + err.message);
        } finally {
          btnExportGif.textContent = 'Export Animated GIF';
          btnExportGif.disabled = false;
        }
      };
    }
  }

  renderTimelineFramesStrip() {
    const strip = document.getElementById('timeline-frames-strip');
    if (!strip || !this.timelineManager) return;
    strip.innerHTML = '';

    const frames = this.timelineManager.frames;
    frames.forEach((frame, idx) => {
      const isCur = idx === this.timelineManager.activeFrameIndex;
      const card = document.createElement('div');
      card.style.cssText = `flex-shrink:0; width:80px; display:flex; flex-direction:column; align-items:center; gap:4px; padding:6px; border-radius:4px; background:${isCur ? 'rgba(56,189,248,0.2)' : 'var(--bg-panel)'}; border:2px solid ${isCur ? '#38bdf8' : 'rgba(255,255,255,0.08)'}; cursor:pointer;`;

      const num = document.createElement('span');
      num.style.cssText = 'font-size:10px; font-weight:bold; color:var(--text-muted); align-self:flex-start;';
      num.textContent = `${idx + 1}`;

      const thumb = document.createElement('div');
      thumb.style.cssText = 'width:68px; height:48px; background:#0f172a; border-radius:3px; display:flex; align-items:center; justify-content:center; overflow:hidden; font-size:10px; color:#64748b;';
      thumb.textContent = `Frame ${idx + 1}`;

      const delaySelect = document.createElement('select');
      delaySelect.style.cssText = 'font-size:10px; padding:1px 2px; width:100%; border-radius:2px; background:var(--bg-main); color:var(--text-main); border:1px solid rgba(255,255,255,0.1);';
      const delays = [
        { label: '0.05s', val: 0.05 },
        { label: '0.1s', val: 0.1 },
        { label: '0.2s', val: 0.2 },
        { label: '0.5s', val: 0.5 },
        { label: '1.0s', val: 1.0 },
        { label: '2.0s', val: 2.0 }
      ];
      delays.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d.val;
        opt.textContent = d.label;
        if (Math.abs(frame.delay - d.val) < 0.01) opt.selected = true;
        delaySelect.appendChild(opt);
      });

      delaySelect.onclick = (e) => e.stopPropagation();
      delaySelect.onchange = (e) => {
        frame.delay = parseFloat(e.target.value);
      };

      card.appendChild(num);
      card.appendChild(thumb);
      card.appendChild(delaySelect);

      card.onclick = () => {
        this.timelineManager.selectFrame(idx);
        this.renderTimelineFramesStrip();
      };

      strip.appendChild(card);
    });
  }

  // ── Phase 11: Elite Photoshop Parity Engines ──
  openSelectiveColorModal() {
    const modal = document.getElementById('modal-selective-color');
    if (!modal) return;
    const active = this.layerManager.getActiveLayer();
    if (!active || active.isGroup) {
      alert('Please select a raster or smart layer to apply Selective Color.');
      return;
    }
    modal.classList.remove('hidden');

    const selectColor = document.getElementById('select-sc-color');
    const sliderC = document.getElementById('slider-sc-cyan');
    const valC = document.getElementById('val-sc-cyan');
    const sliderM = document.getElementById('slider-sc-magenta');
    const valM = document.getElementById('val-sc-magenta');
    const sliderY = document.getElementById('slider-sc-yellow');
    const valY = document.getElementById('val-sc-yellow');
    const sliderK = document.getElementById('slider-sc-black');
    const valK = document.getElementById('val-sc-black');
    const btnApply = document.getElementById('btn-apply-selective-color');

    const colorAdjustments = {
      reds: { c: 0, m: 0, y: 0, k: 0 },
      yellows: { c: 0, m: 0, y: 0, k: 0 },
      greens: { c: 0, m: 0, y: 0, k: 0 },
      cyans: { c: 0, m: 0, y: 0, k: 0 },
      blues: { c: 0, m: 0, y: 0, k: 0 },
      magentas: { c: 0, m: 0, y: 0, k: 0 },
      whites: { c: 0, m: 0, y: 0, k: 0 },
      neutrals: { c: 0, m: 0, y: 0, k: 0 },
      blacks: { c: 0, m: 0, y: 0, k: 0 }
    };

    const updateSliders = () => {
      const family = selectColor ? selectColor.value : 'neutrals';
      const cur = colorAdjustments[family] || { c: 0, m: 0, y: 0, k: 0 };
      if (sliderC && valC) { sliderC.value = cur.c; valC.textContent = cur.c; }
      if (sliderM && valM) { sliderM.value = cur.m; valM.textContent = cur.m; }
      if (sliderY && valY) { sliderY.value = cur.y; valY.textContent = cur.y; }
      if (sliderK && valK) { sliderK.value = cur.k; valK.textContent = cur.k; }
    };

    if (selectColor) selectColor.onchange = updateSliders;

    const onSliderInput = () => {
      const family = selectColor ? selectColor.value : 'neutrals';
      colorAdjustments[family] = {
        c: parseInt(sliderC.value, 10),
        m: parseInt(sliderM.value, 10),
        y: parseInt(sliderY.value, 10),
        k: parseInt(sliderK.value, 10)
      };
      if (valC) valC.textContent = sliderC.value;
      if (valM) valM.textContent = sliderM.value;
      if (valY) valY.textContent = sliderY.value;
      if (valK) valK.textContent = sliderK.value;
    };

    if (sliderC) sliderC.oninput = onSliderInput;
    if (sliderM) sliderM.oninput = onSliderInput;
    if (sliderY) sliderY.oninput = onSliderInput;
    if (sliderK) sliderK.oninput = onSliderInput;

    if (btnApply) {
      btnApply.onclick = () => {
        modal.classList.add('hidden');
        const modeRadio = document.querySelector('input[name="sc-mode"]:checked');
        const method = modeRadio ? modeRadio.value : 'relative';
        const params = { method, adjustments: colorAdjustments };

        if (active.type === 'smart') {
          active.smartObject.addFilter('selectiveColor', params);
          this.renderComposite();
          this.pushHistoryState('Smart Filter: Selective Color');
        } else {
          const imgData = active.ctx.getImageData(0, 0, active.width, active.height);
          SelectiveColorEngine.apply(imgData, params);
          active.ctx.putImageData(imgData, 0, 0);
          this.renderComposite();
          this.pushHistoryState('Selective Color (CMYK)');
        }
      };
    }
  }

  openChannelMixerModal() {
    const modal = document.getElementById('modal-channel-mixer');
    if (!modal) return;
    const active = this.layerManager.getActiveLayer();
    if (!active || active.isGroup) {
      alert('Please select a raster or smart layer to apply Channel Mixer.');
      return;
    }
    modal.classList.remove('hidden');

    const selectOut = document.getElementById('select-cm-output');
    const checkMono = document.getElementById('check-cm-mono');
    const sliderR = document.getElementById('slider-cm-r');
    const valR = document.getElementById('val-cm-r');
    const sliderG = document.getElementById('slider-cm-g');
    const valG = document.getElementById('val-cm-g');
    const sliderB = document.getElementById('slider-cm-b');
    const valB = document.getElementById('val-cm-b');
    const sliderConst = document.getElementById('slider-cm-const');
    const valConst = document.getElementById('val-cm-const');
    const btnApply = document.getElementById('btn-apply-channel-mixer');

    const matrix = {
      red:   { r: 100, g: 0, b: 0, constant: 0 },
      green: { r: 0, g: 100, b: 0, constant: 0 },
      blue:  { r: 0, g: 0, b: 100, constant: 0 },
      gray:  { r: 40, g: 40, b: 20, constant: 0 }
    };

    const updateSliders = () => {
      const isMono = checkMono ? checkMono.checked : false;
      const ch = isMono ? 'gray' : (selectOut ? selectOut.value : 'red');
      const cur = matrix[ch] || { r: 100, g: 0, b: 0, constant: 0 };
      if (sliderR && valR) { sliderR.value = cur.r; valR.textContent = cur.r; }
      if (sliderG && valG) { sliderG.value = cur.g; valG.textContent = cur.g; }
      if (sliderB && valB) { sliderB.value = cur.b; valB.textContent = cur.b; }
      if (sliderConst && valConst) { sliderConst.value = cur.constant; valConst.textContent = cur.constant; }
    };

    if (selectOut) selectOut.onchange = updateSliders;
    if (checkMono) checkMono.onchange = updateSliders;

    const onSliderInput = () => {
      const isMono = checkMono ? checkMono.checked : false;
      const ch = isMono ? 'gray' : (selectOut ? selectOut.value : 'red');
      matrix[ch] = {
        r: parseInt(sliderR.value, 10),
        g: parseInt(sliderG.value, 10),
        b: parseInt(sliderB.value, 10),
        constant: parseInt(sliderConst.value, 10)
      };
      if (valR) valR.textContent = sliderR.value;
      if (valG) valG.textContent = sliderG.value;
      if (valB) valB.textContent = sliderB.value;
      if (valConst) valConst.textContent = sliderConst.value;
    };

    if (sliderR) sliderR.oninput = onSliderInput;
    if (sliderG) sliderG.oninput = onSliderInput;
    if (sliderB) sliderB.oninput = onSliderInput;
    if (sliderConst) sliderConst.oninput = onSliderInput;

    if (btnApply) {
      btnApply.onclick = () => {
        modal.classList.add('hidden');
        const params = {
          monochrome: checkMono ? checkMono.checked : false,
          red: matrix.red,
          green: matrix.green,
          blue: matrix.blue,
          gray: matrix.gray
        };

        if (active.type === 'smart') {
          active.smartObject.addFilter('channelMixer', params);
          this.renderComposite();
          this.pushHistoryState('Smart Filter: Channel Mixer');
        } else {
          const imgData = active.ctx.getImageData(0, 0, active.width, active.height);
          ChannelMixerEngine.apply(imgData, params);
          active.ctx.putImageData(imgData, 0, 0);
          this.renderComposite();
          this.pushHistoryState('Channel Mixer');
        }
      };
    }
  }

  openColorRangeModal() {
    const modal = document.getElementById('modal-color-range');
    if (!modal) return;
    const active = this.layerManager.getActiveLayer();
    if (!active) {
      alert('Please select a layer to create a Color Range selection.');
      return;
    }
    modal.classList.remove('hidden');

    const selectPreset = document.getElementById('select-cr-preset');
    const sliderFuzz = document.getElementById('slider-cr-fuzziness');
    const valFuzz = document.getElementById('val-cr-fuzziness');
    const checkInvert = document.getElementById('check-cr-invert');
    const btnApply = document.getElementById('btn-apply-color-range');

    if (sliderFuzz && valFuzz) {
      sliderFuzz.oninput = () => { valFuzz.textContent = sliderFuzz.value; };
    }

    if (btnApply) {
      btnApply.onclick = () => {
        modal.classList.add('hidden');
        const fuzziness = parseInt(sliderFuzz.value, 10) || 40;
        const invert = checkInvert ? checkInvert.checked : false;
        const preset = selectPreset ? selectPreset.value : 'sampled';

        let sample = preset;
        if (preset === 'sampled') {
          const fgHex = (this.colorPicker && this.colorPicker.getFgHex) ? this.colorPicker.getFgHex() : '#ffffff';
          sample = (typeof Utils !== 'undefined' && Utils.hexToRgb) ? Utils.hexToRgb(fgHex) : { r: 255, g: 255, b: 255 };
        }

        const imgData = active.ctx.getImageData(0, 0, active.width, active.height);
        const selection = ColorRangeEngine.createSelection(imgData, sample, fuzziness, { invert });

        if (this.toolManager) {
          this.toolManager.selection = selection;
          this.toolManager.renderMarchingAnts();
        }
        this.pushHistoryState('Color Range Selection');
      };
    }
  }

  openRefineEdgeModal() {
    const modal = document.getElementById('modal-refine-edge');
    if (!modal) return;
    if (!this.toolManager || !this.toolManager.selection) {
      alert('Please make a selection first before refining edges.');
      return;
    }
    modal.classList.remove('hidden');

    const sliderRadius = document.getElementById('slider-re-radius');
    const valRadius = document.getElementById('val-re-radius');
    const sliderSmooth = document.getElementById('slider-re-smooth');
    const valSmooth = document.getElementById('val-re-smooth');
    const sliderFeather = document.getElementById('slider-re-feather');
    const valFeather = document.getElementById('val-re-feather');
    const sliderContrast = document.getElementById('slider-re-contrast');
    const valContrast = document.getElementById('val-re-contrast');
    const sliderShift = document.getElementById('slider-re-shift');
    const valShift = document.getElementById('val-re-shift');
    const checkDecontam = document.getElementById('check-re-decontaminate');
    const btnApply = document.getElementById('btn-apply-refine-edge');

    const bindVal = (slider, span) => {
      if (slider && span) slider.oninput = () => { span.textContent = slider.value; };
    };
    bindVal(sliderRadius, valRadius);
    bindVal(sliderSmooth, valSmooth);
    bindVal(sliderFeather, valFeather);
    bindVal(sliderContrast, valContrast);
    bindVal(sliderShift, valShift);

    if (btnApply) {
      btnApply.onclick = () => {
        modal.classList.add('hidden');
        const active = this.layerManager.getActiveLayer();
        if (!active) return;
        const imgData = active.ctx.getImageData(0, 0, active.width, active.height);

        const options = {
          radius: sliderRadius ? parseInt(sliderRadius.value, 10) || 0 : 0,
          smooth: sliderSmooth ? parseInt(sliderSmooth.value, 10) || 0 : 0,
          feather: sliderFeather ? parseFloat(sliderFeather.value) || 0 : 0,
          contrast: sliderContrast ? parseInt(sliderContrast.value, 10) || 0 : 0,
          shiftEdge: sliderShift ? parseInt(sliderShift.value, 10) || 0 : 0,
          decontaminate: checkDecontam ? checkDecontam.checked : false
        };

        const refined = TrimapMattingEngine.refineEdge(imgData, this.toolManager.selection, options);
        this.toolManager.selection = refined.selection;
        if (options.decontaminate && refined.decontaminatedImgData) {
          active.ctx.putImageData(refined.decontaminatedImgData, 0, 0);
        }
        this.toolManager.renderMarchingAnts();
        this.renderComposite();
        this.pushHistoryState('Select and Mask (Refine Edge)');
      };
    }
  }

  openDisplaceModal() {
    const modal = document.getElementById('modal-displace');
    if (!modal) return;
    const active = this.layerManager.getActiveLayer();
    if (!active || active.isGroup) {
      alert('Please select a raster layer to apply Displace.');
      return;
    }
    modal.classList.remove('hidden');

    const sliderX = document.getElementById('slider-displace-x');
    const valX = document.getElementById('val-displace-x');
    const sliderY = document.getElementById('slider-displace-y');
    const valY = document.getElementById('val-displace-y');
    const selectMode = document.getElementById('select-displace-mode');
    const inputMap = document.getElementById('input-displace-map');
    const btnApply = document.getElementById('btn-apply-displace');

    if (sliderX && valX) sliderX.oninput = () => { valX.textContent = sliderX.value; };
    if (sliderY && valY) sliderY.oninput = () => { valY.textContent = sliderY.value; };

    let loadedMapImgData = null;
    if (inputMap) {
      inputMap.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          const img = new Image();
          img.onload = () => {
            const c = document.createElement('canvas');
            c.width = active.width;
            c.height = active.height;
            const ctx = c.getContext('2d');
            ctx.drawImage(img, 0, 0, active.width, active.height);
            loadedMapImgData = ctx.getImageData(0, 0, active.width, active.height);
          };
          img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
      };
    }

    if (btnApply) {
      btnApply.onclick = () => {
        modal.classList.add('hidden');
        const scaleX = sliderX ? parseInt(sliderX.value, 10) || 10 : 10;
        const scaleY = sliderY ? parseInt(sliderY.value, 10) || 10 : 10;
        const mode = selectMode ? selectMode.value : 'wrapAround';

        let map = loadedMapImgData;
        if (!map) {
          const c = document.createElement('canvas');
          c.width = active.width;
          c.height = active.height;
          const ctx = c.getContext('2d');
          const grad = ctx.createLinearGradient(0, 0, active.width, active.height);
          grad.addColorStop(0, '#000000');
          grad.addColorStop(0.5, '#808080');
          grad.addColorStop(1, '#ffffff');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, active.width, active.height);
          map = ctx.getImageData(0, 0, active.width, active.height);
        }

        const imgData = active.ctx.getImageData(0, 0, active.width, active.height);
        const displaced = DisplacementFilter.apply(imgData, map, scaleX, scaleY, mode);
        active.ctx.putImageData(displaced, 0, 0);
        this.renderComposite();
        this.pushHistoryState('Displace Filter');
      };
    }
  }

  openVanishingPointModal() {
    if (!this.vanishingPointEngine) {
      this.vanishingPointEngine = new VanishingPointEngine(this);
    }
    const active = this.layerManager.getActiveLayer();
    if (!active || active.isGroup) {
      alert('Please select a raster or smart layer for Vanishing Point.');
      return;
    }

    this.vanishingPointEngine.active = !this.vanishingPointEngine.active;
    if (this.vanishingPointEngine.active) {
      if (this.vanishingPointEngine.planes.length === 0) {
        const w = active.width;
        const h = active.height;
        this.vanishingPointEngine.createPlane([
          { x: Math.round(w * 0.15), y: Math.round(h * 0.2) },
          { x: Math.round(w * 0.85), y: Math.round(h * 0.25) },
          { x: Math.round(w * 0.9),  y: Math.round(h * 0.85) },
          { x: Math.round(w * 0.1),  y: Math.round(h * 0.8) }
        ]);
      }
      this.renderGuidesAndOverlays();
      alert('Vanishing Point 3D Perspective Grid Activated! Adjust planes or press OK to project.');
    } else {
      this.renderGuidesAndOverlays();
    }
  }

  openHdrToningModal() {
    const modal = document.getElementById('modal-hdr-toning');
    if (!modal) return;
    const active = this.layerManager.getActiveLayer();
    if (!active || active.isGroup) {
      alert('Please select a raster layer to apply HDR Toning.');
      return;
    }
    modal.classList.remove('hidden');

    const selectTone = document.getElementById('select-hdr-tonemapper');
    const sliderExp = document.getElementById('slider-hdr-exposure');
    const valExp = document.getElementById('val-hdr-exposure');
    const btnApply = document.getElementById('btn-apply-hdr-toning');

    if (sliderExp && valExp) {
      sliderExp.oninput = () => { valExp.textContent = sliderExp.value; };
    }

    if (btnApply) {
      btnApply.onclick = () => {
        modal.classList.add('hidden');
        const method = selectTone ? selectTone.value : 'aces';
        const exposureEV = sliderExp ? parseFloat(sliderExp.value) || 0 : 0;

        const imgData = active.ctx.getImageData(0, 0, active.width, active.height);
        const toned = HDREngine.applyToneMapping(imgData, method, exposureEV);
        active.ctx.putImageData(toned, 0, 0);
        this.renderComposite();
        this.pushHistoryState(`HDR Toning (${method.toUpperCase()}, ${exposureEV} EV)`);
      };
    }
  }

  // ── Phase 12: Radiance .hdr 32-Bit Floating Point Codec ──
  loadHdrFromArrayBuffer(buffer, filename = 'image.hdr') {
    try {
      const hdrBuffer = RadianceHdrCodec.decode(buffer);
      const ldrImageData = HDREngine.toImageData(hdrBuffer, 0.0, 'aces');
      const layer = this.layerManager.addLayer(filename.replace(/\.hdr$/i, ''));
      layer.ctx.putImageData(ldrImageData, 0, 0);
      layer._hdrBuffer = hdrBuffer;
      this.renderComposite();
      this.pushHistoryState(`Open Radiance HDR (${hdrBuffer.width}×${hdrBuffer.height})`);
    } catch (err) {
      alert('Error parsing Radiance .hdr file: ' + err.message);
    }
  }

  exportHdrFile() {
    const active = this.layerManager.getActiveLayer();
    if (!active || active.isGroup) {
      alert('Please select an active raster or smart layer to export as HDR.');
      return;
    }
    let hdrBuffer = active._hdrBuffer;
    if (!hdrBuffer) {
      const imgData = active.ctx.getImageData(0, 0, active.width, active.height);
      hdrBuffer = HDREngine.toHDR(imgData);
    }
    const uint8Bytes = RadianceHdrCodec.encode(hdrBuffer);
    const blob = new Blob([uint8Bytes], { type: 'image/vnd.radiance' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (active.name || 'render').replace(/\s+/g, '_') + '.hdr';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ── Phase 12: Creative Stylizers Suite ──
  openOilPaintModal() {
    const modal = document.getElementById('modal-oil-paint');
    if (!modal) return;
    const active = this.layerManager.getActiveLayer();
    if (!active || active.isGroup) {
      alert('Please select a raster or smart layer to apply Oil Paint.');
      return;
    }
    modal.classList.remove('hidden');

    const sliderRadius = document.getElementById('slider-oil-radius');
    const valRadius = document.getElementById('val-oil-radius');
    const sliderSmooth = document.getElementById('slider-oil-smooth');
    const valSmooth = document.getElementById('val-oil-smooth');
    const sliderBristle = document.getElementById('slider-oil-bristle');
    const valBristle = document.getElementById('val-oil-bristle');
    const sliderAngle = document.getElementById('slider-oil-angle');
    const valAngle = document.getElementById('val-oil-angle');

    const updateVals = () => {
      if (valRadius && sliderRadius) valRadius.textContent = sliderRadius.value;
      if (valSmooth && sliderSmooth) valSmooth.textContent = sliderSmooth.value;
      if (valBristle && sliderBristle) valBristle.textContent = sliderBristle.value;
      if (valAngle && sliderAngle) valAngle.textContent = sliderAngle.value + '°';
    };
    [sliderRadius, sliderSmooth, sliderBristle, sliderAngle].forEach(s => {
      if (s) s.oninput = updateVals;
    });
    updateVals();

    const btnApply = document.getElementById('btn-apply-oil-paint');
    if (btnApply) {
      btnApply.onclick = () => {
        modal.classList.add('hidden');
        const params = {
          radius: parseInt(sliderRadius ? sliderRadius.value : 4, 10),
          smoothness: parseInt(sliderSmooth ? sliderSmooth.value : 3, 10),
          bristleDetail: parseInt(sliderBristle ? sliderBristle.value : 2, 10),
          lightingAngle: parseInt(sliderAngle ? sliderAngle.value : 45, 10)
        };
        if (active.type === 'smart-object' && active.smartObjectData) {
          active.smartObjectData.addFilter(new SmartFilter('oilPaint', params));
          active.smartObjectData.renderToLayer(active);
          this.renderComposite();
          this.pushHistoryState('Smart Filter: Oil Paint');
        } else {
          const imgData = active.ctx.getImageData(0, 0, active.width, active.height);
          OilPaintFilter.apply(imgData, params);
          active.ctx.putImageData(imgData, 0, 0);
          this.renderComposite();
          this.pushHistoryState('Oil Paint Stylizer');
        }
      };
    }
  }

  openHalftoneModal() {
    const modal = document.getElementById('modal-halftone');
    if (!modal) return;
    const active = this.layerManager.getActiveLayer();
    if (!active || active.isGroup) {
      alert('Please select a raster or smart layer to apply Halftone Screen.');
      return;
    }
    modal.classList.remove('hidden');

    const sliderRadius = document.getElementById('slider-halftone-radius');
    const valRadius = document.getElementById('val-halftone-radius');
    const inC = document.getElementById('input-halftone-c');
    const inM = document.getElementById('input-halftone-m');
    const inY = document.getElementById('input-halftone-y');
    const inK = document.getElementById('input-halftone-k');

    if (sliderRadius && valRadius) {
      sliderRadius.oninput = () => { valRadius.textContent = sliderRadius.value + 'px'; };
      valRadius.textContent = sliderRadius.value + 'px';
    }

    const btnApply = document.getElementById('btn-apply-halftone');
    if (btnApply) {
      btnApply.onclick = () => {
        modal.classList.add('hidden');
        const params = {
          maxRadius: parseInt(sliderRadius ? sliderRadius.value : 8, 10),
          angle1: parseInt(inC ? inC.value : 15, 10),
          angle2: parseInt(inM ? inM.value : 75, 10),
          angle3: parseInt(inY ? inY.value : 0, 10),
          angle4: parseInt(inK ? inK.value : 45, 10)
        };
        if (active.type === 'smart-object' && active.smartObjectData) {
          active.smartObjectData.addFilter(new SmartFilter('halftone', params));
          active.smartObjectData.renderToLayer(active);
          this.renderComposite();
          this.pushHistoryState('Smart Filter: Halftone Screen');
        } else {
          const imgData = active.ctx.getImageData(0, 0, active.width, active.height);
          HalftoneScreenFilter.apply(imgData, params);
          active.ctx.putImageData(imgData, 0, 0);
          this.renderComposite();
          this.pushHistoryState('Halftone Screen (CMYK)');
        }
      };
    }
  }

  openChromaticModal() {
    const modal = document.getElementById('modal-chromatic');
    if (!modal) return;
    const active = this.layerManager.getActiveLayer();
    if (!active || active.isGroup) {
      alert('Please select a raster or smart layer to apply Chromatic Aberration.');
      return;
    }
    modal.classList.remove('hidden');

    const sliderRed = document.getElementById('slider-chroma-red');
    const valRed = document.getElementById('val-chroma-red');
    const sliderBlue = document.getElementById('slider-chroma-blue');
    const valBlue = document.getElementById('val-chroma-blue');

    if (sliderRed && valRed) {
      sliderRed.oninput = () => { valRed.textContent = sliderRed.value + 'px'; };
      valRed.textContent = sliderRed.value + 'px';
    }
    if (sliderBlue && valBlue) {
      sliderBlue.oninput = () => { valBlue.textContent = sliderBlue.value + 'px'; };
      valBlue.textContent = sliderBlue.value + 'px';
    }

    const btnApply = document.getElementById('btn-apply-chromatic');
    if (btnApply) {
      btnApply.onclick = () => {
        modal.classList.add('hidden');
        const params = {
          redOffset: parseFloat(sliderRed ? sliderRed.value : 4.0),
          blueOffset: parseFloat(sliderBlue ? sliderBlue.value : -4.0)
        };
        if (active.type === 'smart-object' && active.smartObjectData) {
          active.smartObjectData.addFilter(new SmartFilter('chromaticAberration', params));
          active.smartObjectData.renderToLayer(active);
          this.renderComposite();
          this.pushHistoryState('Smart Filter: Chromatic Aberration');
        } else {
          const imgData = active.ctx.getImageData(0, 0, active.width, active.height);
          ChromaticAberrationFilter.apply(imgData, params);
          active.ctx.putImageData(imgData, 0, 0);
          this.renderComposite();
          this.pushHistoryState('Chromatic Aberration');
        }
      };
    }
  }

  // ── Phase 12: Generative Fill & Inpainting Engine ──
  openGenerativeFillModal() {
    const modal = document.getElementById('modal-generative-fill');
    if (!modal) return;
    modal.classList.remove('hidden');

    const promptInput = document.getElementById('input-genfill-prompt');
    const btnGen = document.getElementById('btn-genfill-generate');
    const btnAccept = document.getElementById('btn-genfill-accept');
    const varContainer = document.getElementById('genfill-variations-container');

    let currentVariations = [];
    let selectedIdx = 0;

    if (btnGen) {
      btnGen.onclick = () => {
        const prompt = promptInput ? promptInput.value.trim() : 'natural fill';
        const active = this.layerManager.getActiveLayer();
        if (!active) {
          alert('Please select a layer to inpaint onto.');
          return;
        }

        const selection = (this.toolManager && this.toolManager.selection && this.toolManager.selection.w > 0) ? this.toolManager.selection : {
          x: Math.round(this.width * 0.25),
          y: Math.round(this.height * 0.25),
          w: Math.round(this.width * 0.5),
          h: Math.round(this.height * 0.5)
        };

        const activeImg = active.ctx.getImageData(0, 0, active.width, active.height);
        currentVariations = this.generativeFillEngine.generateVariations(activeImg, selection, prompt, 3);
        selectedIdx = 0;

        if (varContainer) {
          varContainer.innerHTML = '';
          currentVariations.forEach((v, idx) => {
            const card = document.createElement('div');
            card.style.cssText = `border: 2px solid ${idx === 0 ? '#38bdf8' : 'var(--border-color)'}; padding: 6px; border-radius: 6px; cursor: pointer; text-align: center; background: var(--bg-surface);`;
            const previewCanvas = document.createElement('canvas');
            previewCanvas.width = 120;
            previewCanvas.height = Math.round(120 * (selection.h / Math.max(1, selection.w)));
            const pctx = previewCanvas.getContext('2d');
            
            const tempC = document.createElement('canvas');
            tempC.width = active.width;
            tempC.height = active.height;
            tempC.getContext('2d').putImageData(v.imageData, 0, 0);
            pctx.drawImage(tempC, selection.x, selection.y, selection.w, selection.h, 0, 0, previewCanvas.width, previewCanvas.height);

            const title = document.createElement('div');
            title.style.fontSize = '11px';
            title.style.marginTop = '4px';
            title.textContent = `Variation ${v.index + 1}`;

            card.appendChild(previewCanvas);
            card.appendChild(title);

            card.onclick = () => {
              selectedIdx = idx;
              varContainer.querySelectorAll('div').forEach((c, cIdx) => {
                c.style.borderColor = (cIdx === idx ? '#38bdf8' : 'var(--border-color)');
              });
            };
            varContainer.appendChild(card);
          });
        }
      };
    }

    if (btnAccept) {
      btnAccept.onclick = () => {
        if (currentVariations.length > 0) {
          const chosen = currentVariations[selectedIdx] || currentVariations[0];
          const active = this.layerManager.getActiveLayer();
          if (active && chosen) {
            active.ctx.putImageData(chosen.imageData, 0, 0);
            this.renderComposite();
            this.pushHistoryState(`Generative Fill: "${promptInput ? promptInput.value : ''}"`);
          }
        }
        modal.classList.add('hidden');
      };
    }
  }

  // ── Phase 12: Developer Scripting Console & Plugin Runner ──
  openScriptingConsole() {
    const modal = document.getElementById('modal-scripting-console');
    if (!modal) return;
    modal.classList.remove('hidden');
    if (this.scriptingConsole) {
      this.scriptingConsole.bindUI();
    }
  }

  // ── Phase 12: Typographic Glyphs Browser Panel ──
  openGlyphsPanel() {
    const modal = document.getElementById('modal-glyphs-panel');
    if (!modal) return;
    modal.classList.remove('hidden');
    this.renderGlyphsUI();
  }

  renderGlyphsUI() {
    const selectCat = document.getElementById('select-glyph-category');
    const container = document.getElementById('glyphs-grid-container');
    if (!container || !this.glyphsPanel) return;

    const renderCategory = (catName) => {
      container.innerHTML = '';
      const list = (catName === 'Recent' ? this.glyphsPanel.recentGlyphs : (this.glyphsPanel.categories[catName] || []));
      list.forEach(g => {
        const btn = document.createElement('button');
        btn.className = 'glyph-cell';
        btn.textContent = g;
        btn.title = `Click to insert '${g}'`;
        btn.onclick = () => {
          this.glyphsPanel.insertGlyph(g);
        };
        container.appendChild(btn);
      });
    };

    if (selectCat) {
      if (selectCat.options.length <= 1) {
        selectCat.innerHTML = '<option value="Recent">Recent Glyphs</option>';
        Object.keys(this.glyphsPanel.categories).forEach(c => {
          const opt = document.createElement('option');
          opt.value = c;
          opt.textContent = c;
          selectCat.appendChild(opt);
        });
      }
      selectCat.onchange = () => renderCategory(selectCat.value);
      renderCategory(selectCat.value || 'Recent');
    } else {
      renderCategory('Recent');
    }
  }

  // ── Phase 13: Keyboard Shortcut Remapper & Customizer ──
  openKeyboardShortcutsModal() {
    const modal = document.getElementById('modal-keyboard-shortcuts');
    if (!modal) return;
    modal.classList.remove('hidden');

    // Guarantee ShortcutManager is initialized
    if (!this.shortcutManager) {
      if (typeof ShortcutManager !== 'undefined') {
        this.shortcutManager = new ShortcutManager();
      } else if (typeof window.ShortcutManager !== 'undefined') {
        this.shortcutManager = new window.ShortcutManager();
      }
    }

    const searchInput = document.getElementById('shortcut-search-input');
    const profileSelect = document.getElementById('shortcut-profile-select');
    const btnExport = document.getElementById('btn-export-shortcuts');
    const btnImport = document.getElementById('btn-import-shortcuts');
    const btnReset = document.getElementById('btn-reset-shortcuts');
    const filterContainer = document.getElementById('shortcuts-category-filters');

    this.activeShortcutCategory = 'all';

    // Hook category filter buttons (including "All Shortcuts")
    if (filterContainer) {
      const pills = filterContainer.querySelectorAll('.btn-shortcut-filter-pill');
      pills.forEach(pill => {
        pill.onclick = () => {
          pills.forEach(p => p.classList.remove('active'));
          pill.classList.add('active');
          this.activeShortcutCategory = pill.dataset.category || 'all';
          this.renderShortcutsUI(searchInput ? searchInput.value : '', this.activeShortcutCategory);
        };
      });
    }

    if (searchInput) {
      searchInput.value = '';
      setTimeout(() => searchInput.focus(), 60);
      searchInput.oninput = () => this.renderShortcutsUI(searchInput.value, this.activeShortcutCategory);
    }

    if (profileSelect && this.shortcutManager) {
      profileSelect.value = this.shortcutManager.currentProfile;
      profileSelect.onchange = () => {
        this.shortcutManager.loadProfile(profileSelect.value);
        this.renderShortcutsUI(searchInput ? searchInput.value : '', this.activeShortcutCategory);
        this.showToast(`Switched shortcuts profile to ${profileSelect.value}`);
      };
    }

    if (btnExport && this.shortcutManager) {
      btnExport.onclick = () => {
        const json = this.shortcutManager.exportJSON();
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pixelforge_shortcuts_${this.shortcutManager.currentProfile}.json`;
        a.click();
        URL.revokeObjectURL(url);
      };
    }

    if (btnImport) {
      btnImport.onclick = () => {
        document.getElementById('browser-shortcuts-json-input')?.click();
      };
    }

    if (btnReset && this.shortcutManager) {
      btnReset.onclick = () => {
        this.shortcutManager.resetDefaults();
        if (profileSelect) profileSelect.value = 'photoshop';
        this.activeShortcutCategory = 'all';
        if (filterContainer) {
          const pills = filterContainer.querySelectorAll('.btn-shortcut-filter-pill');
          pills.forEach(p => p.classList.remove('active'));
          document.getElementById('btn-show-all-shortcuts')?.classList.add('active');
        }
        this.renderShortcutsUI('', 'all');
        this.showToast('Reset keyboard shortcuts to default');
      };
    }

    this.renderShortcutsUI('', 'all');
  }

  formatShortcutDisplayKbd(container, displayText) {
    container.innerHTML = '';
    if (!displayText) {
      const noneSpan = document.createElement('span');
      noneSpan.style.color = 'var(--text-dim)';
      noneSpan.style.fontSize = '11px';
      noneSpan.textContent = 'None';
      container.appendChild(noneSpan);
      return;
    }

    const tokens = displayText.split('+');
    tokens.forEach((token, idx) => {
      if (idx > 0) {
        const plus = document.createElement('span');
        plus.className = 'shortcut-kbd-plus';
        plus.textContent = '+';
        container.appendChild(plus);
      }
      const kbd = document.createElement('kbd');
      kbd.className = 'shortcut-kbd';
      kbd.textContent = token;
      container.appendChild(kbd);
    });
  }

  renderShortcutsUI(query = '', category = 'all') {
    const tbody = document.getElementById('shortcuts-list-tbody');
    const conflictWarn = document.getElementById('shortcut-conflict-warning');
    const countBadge = document.getElementById('shortcuts-count-badge');

    // Auto-initialize if needed
    if (!this.shortcutManager) {
      if (typeof ShortcutManager !== 'undefined') {
        this.shortcutManager = new ShortcutManager();
      } else if (typeof window.ShortcutManager !== 'undefined') {
        this.shortcutManager = new window.ShortcutManager();
      }
    }
    if (!tbody || !this.shortcutManager) return;

    if (conflictWarn) conflictWarn.style.display = 'none';
    tbody.innerHTML = '';

    const items = this.shortcutManager.search(query, category);
    if (countBadge) {
      const totalCount = Object.keys(this.shortcutManager.shortcuts).length;
      countBadge.textContent = `${items.length} of ${totalCount}`;
    }

    if (items.length === 0) {
      const emptyTr = document.createElement('tr');
      const emptyTd = document.createElement('td');
      emptyTd.colSpan = 5;
      emptyTd.style.textAlign = 'center';
      emptyTd.style.padding = '36px 16px';
      emptyTd.style.color = 'var(--text-muted)';
      emptyTd.style.fontSize = '12px';
      emptyTd.textContent = query ? `No shortcuts found matching "${query}" in "${category}" category` : 'No shortcuts configured for this category.';
      emptyTr.appendChild(emptyTd);
      tbody.appendChild(emptyTr);
      return;
    }

    items.forEach(([actionId, item]) => {
      const tr = document.createElement('tr');

      // Category column
      const tdCat = document.createElement('td');
      const catName = item.category || 'General';
      const catClass = `cat-${catName.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
      const pill = document.createElement('span');
      pill.className = `category-pill ${catClass}`;
      pill.textContent = catName;
      tdCat.appendChild(pill);

      // Tier column
      const tdTier = document.createElement('td');
      const tierName = item.tier || 'Simple';
      const tierBadge = document.createElement('span');
      tierBadge.className = `tier-badge tier-${tierName.toLowerCase()}`;
      tierBadge.textContent = tierName;
      tdTier.appendChild(tierBadge);

      // Command / Tool column (with description underneath)
      const tdLabel = document.createElement('td');
      const labelWrap = document.createElement('div');
      labelWrap.style.display = 'flex';
      labelWrap.style.flexDirection = 'column';
      labelWrap.style.gap = '2px';

      const titleSpan = document.createElement('span');
      titleSpan.style.fontWeight = '500';
      titleSpan.textContent = item.label || actionId;
      labelWrap.appendChild(titleSpan);

      if (item.desc) {
        const descSpan = document.createElement('span');
        descSpan.style.fontSize = '11px';
        descSpan.style.color = 'var(--text-dim)';
        descSpan.textContent = item.desc;
        labelWrap.appendChild(descSpan);
      }
      tdLabel.appendChild(labelWrap);

      // Shortcut column
      const tdKey = document.createElement('td');
      const keyBadge = document.createElement('div');
      keyBadge.className = 'shortcut-badge';
      this.formatShortcutDisplayKbd(keyBadge, this.shortcutManager.getShortcutDisplay(actionId));
      tdKey.appendChild(keyBadge);

      // Action column
      const tdAction = document.createElement('td');
      tdAction.style.textAlign = 'center';
      const editBtn = document.createElement('button');
      editBtn.className = 'btn-ghost-sm';
      editBtn.textContent = 'Remap';
      editBtn.title = 'Click to assign a new key combination';
      editBtn.onclick = () => {
        keyBadge.innerHTML = '<kbd class="shortcut-kbd" style="background:#3b82f6; color:#fff; border-color:#60a5fa; box-shadow:0 0 8px rgba(59,130,246,0.6);">Press key...</kbd>';

        const keyHandler = (e) => {
          e.preventDefault();
          e.stopPropagation();
          window.removeEventListener('keydown', keyHandler, true);

          if (e.key === 'Escape') {
            this.formatShortcutDisplayKbd(keyBadge, this.shortcutManager.getShortcutDisplay(actionId));
            return;
          }

          const mods = [];
          if (e.ctrlKey || e.metaKey) mods.push('ctrl');
          if (e.altKey) mods.push('alt');
          if (e.shiftKey) mods.push('shift');

          const res = this.shortcutManager.setShortcut(actionId, e.key, mods);
          this.formatShortcutDisplayKbd(keyBadge, this.shortcutManager.getShortcutDisplay(actionId));

          if (res.conflict && conflictWarn) {
            conflictWarn.textContent = `Warning: "${res.conflict.label}" already used this key combination. It has been reassigned to "${item.label}".`;
            conflictWarn.style.display = 'block';
          }
        };
        window.addEventListener('keydown', keyHandler, true);
      };
      tdAction.appendChild(editBtn);

      tr.appendChild(tdCat);
      tr.appendChild(tdTier);
      tr.appendChild(tdLabel);
      tr.appendChild(tdKey);
      tr.appendChild(tdAction);
      tbody.appendChild(tr);
    });
  }

  // ── Phase 13: Timeline & Animation Video Exporter ──
  openVideoExportModal() {
    const modal = document.getElementById('modal-video-export');
    if (!modal) return;
    modal.classList.remove('hidden');

    const formatSelect = document.getElementById('video-export-format');
    const fpsSelect = document.getElementById('video-export-fps');
    const bitrateSelect = document.getElementById('video-export-bitrate');
    const progressWrap = document.getElementById('video-export-progress-wrap');
    const progressBar = document.getElementById('video-export-progress-bar');
    const progressPct = document.getElementById('video-export-progress-pct');
    const btnConfirm = document.getElementById('btn-confirm-video-export');

    if (progressWrap) progressWrap.style.display = 'none';

    if (btnConfirm) {
      btnConfirm.onclick = async () => {
        if (!this.videoExportEngine) {
          this.showToast('Video export engine unavailable', 'error');
          return;
        }

        btnConfirm.disabled = true;
        if (progressWrap) progressWrap.style.display = 'block';

        const format = formatSelect ? formatSelect.value : 'webm';
        const fps = parseInt(fpsSelect ? fpsSelect.value : '24', 10);
        const bitrate = parseInt(bitrateSelect ? bitrateSelect.value : '2500000', 10);

        // Gather frames from timeline if available, or generate composite frames
        let frames = [];
        if (this.timelineEngine && this.timelineEngine.frames && this.timelineEngine.frames.length > 0) {
          frames = this.timelineEngine.frames;
        } else {
          // Single or multiple layers as animation sequence
          const active = this.layerManager.getActiveLayer();
          if (active && active.ctx) {
            frames.push(active.ctx.getImageData(0, 0, this.width, this.height));
          } else {
            const temp = document.createElement('canvas');
            temp.width = this.width;
            temp.height = this.height;
            temp.getContext('2d').drawImage(this.mainCanvas, 0, 0);
            frames.push(temp);
          }
        }

        try {
          const blob = await this.videoExportEngine.exportTimelineVideo(this.mainCanvas, frames, {
            fps,
            bitrate,
            format,
            onProgress: (p) => {
              const pct = Math.round(p * 100);
              if (progressBar) progressBar.style.width = `${pct}%`;
              if (progressPct) progressPct.textContent = `${pct}%`;
            }
          });

          this.videoExportEngine.downloadVideo(blob, `pixelforge_export.${format}`);
          this.showToast(`Video successfully exported as .${format}!`);
          modal.classList.add('hidden');
        } catch (err) {
          console.error(err);
          this.showToast('Video export error: ' + err.message, 'error');
        } finally {
          btnConfirm.disabled = false;
        }
      };
    }
  }

  // ── Phase 14: 3D Normal Map & Height Map Generator ──
  openNormalMapModal() {
    const modal = document.getElementById('modal-normal-map');
    if (!modal) return;
    modal.classList.remove('hidden');

    const strengthSlider = document.getElementById('normal-map-strength');
    const strengthVal = document.getElementById('val-normal-map-strength');
    const blurSlider = document.getElementById('normal-map-blur');
    const blurVal = document.getElementById('val-normal-map-blur');
    const invertXCheck = document.getElementById('normal-map-invert-x');
    const invertYCheck = document.getElementById('normal-map-invert-y');
    const btnConfirm = document.getElementById('btn-confirm-normal-map');

    if (strengthSlider && strengthVal) {
      strengthSlider.oninput = () => { strengthVal.textContent = strengthSlider.value; };
    }
    if (blurSlider && blurVal) {
      blurSlider.oninput = () => { blurVal.textContent = `${blurSlider.value}px`; };
    }

    if (btnConfirm) {
      btnConfirm.onclick = () => {
        const active = this.layerManager.getActiveLayer();
        if (active && active.ctx) {
          const imgData = active.ctx.getImageData(0, 0, active.width, active.height);
          const strength = parseFloat(strengthSlider ? strengthSlider.value : 2.5);
          const blurRadius = parseInt(blurSlider ? blurSlider.value : 0, 10);
          const invertX = invertXCheck ? invertXCheck.checked : false;
          const invertY = invertYCheck ? invertYCheck.checked : false;

          const normalMap = NormalHeightMapEngine.generateNormalMap(imgData, {
            strength,
            blurRadius,
            invertX,
            invertY
          });

          active.ctx.putImageData(normalMap, 0, 0);
          this.renderComposite();
          this.pushHistoryState('3D: Generate Normal Map');
          this.showToast('3D Tangent Normal Map Generated!');
        }
        modal.classList.add('hidden');
      };
    }
  }

  applyHeightMap() {
    const active = this.layerManager.getActiveLayer();
    if (active && active.ctx) {
      const imgData = active.ctx.getImageData(0, 0, active.width, active.height);
      const heightMap = NormalHeightMapEngine.generateHeightMap(imgData, { contrast: 1.3 });
      active.ctx.putImageData(heightMap, 0, 0);
      this.renderComposite();
      this.pushHistoryState('3D: Generate Height Map');
      this.showToast('3D Displacement Height Map Generated!');
    }
  }

  // ── Phase 14: 3D LUT Baker & .cube Exporter ──
  openLutBakerModal() {
    const modal = document.getElementById('modal-lut-baker');
    if (!modal) return;
    modal.classList.remove('hidden');

    const sizeSelect = document.getElementById('lut-grid-size');
    const titleInput = document.getElementById('lut-title-input');
    const btnConfirm = document.getElementById('btn-confirm-lut-export');

    if (btnConfirm) {
      btnConfirm.onclick = () => {
        const size = parseInt(sizeSelect ? sizeSelect.value : 33, 10);
        const title = titleInput ? titleInput.value : 'PixelForge Custom 3D LUT';

        // Gather all adjustment layers
        const adjustments = [];
        this.layerManager.layers.forEach(layer => {
          if (layer.type === 'adjustment' && layer.visible && layer.adjustmentParams) {
            adjustments.push({
              type: layer.adjustmentType,
              ...layer.adjustmentParams
            });
          }
        });

        // If no adjustment layers present, provide a subtle cinematic contrast curve
        if (adjustments.length === 0) {
          adjustments.push({ type: 'brightness_contrast', brightness: 5, contrast: 15 });
        }

        const transform = LutBaker.createTransformFromAdjustments(adjustments);
        const cubeText = LutBaker.bakeToCube(transform, { size, title });

        LutBaker.downloadCube(cubeText, `${title.replace(/[\s\W]+/g, '_')}.cube`);
        this.showToast('3D LUT (.CUBE) exported successfully!');
        modal.classList.add('hidden');
      };
    }
  }

  // ── Phase 14: Non-Destructive Vector Mask ──
  addVectorMaskToActiveLayer() {
    const active = this.layerManager.getActiveLayer();
    if (!active) {
      this.showToast('Please select a layer first', 'error');
      return;
    }

    let points = [];
    if (this.toolManager.pathManager && !this.toolManager.pathManager.isEmpty()) {
      points = this.toolManager.pathManager.exportPoints ? this.toolManager.pathManager.exportPoints() : [];
    }

    // Default to rounded rectangular frame if no path drawn yet
    if (points.length === 0) {
      const pad = 40;
      points = [
        { type: 'M', x: pad, y: pad },
        { type: 'L', x: this.width - pad, y: pad },
        { type: 'L', x: this.width - pad, y: this.height - pad },
        { type: 'L', x: pad, y: this.height - pad }
      ];
    }

    active.vectorMask = new VectorMask({ points, closed: true });
    this.renderComposite();
    this.pushHistoryState('Add Vector Mask');
    this.showToast('Vector Mask added to active layer!');
  }

  // ── Phase 14: Split Mesh Warp Engine ──
  startSplitWarp() {
    if (!this.splitWarpEngine) {
      this.splitWarpEngine = new SplitWarpEngine(this.width, this.height);
    }
    this.splitWarpEngine.active = true;
    this.renderGuidesAndOverlays();
    this.showToast('Split Warp Active: Drag anchors or insert splits; press Enter to commit');
  }

  // ── Phase 15: Quick Mask Mode ──
  toggleQuickMask() {
    if (!this.quickMaskEngine) {
      this.quickMaskEngine = new QuickMaskEngine(this);
    }
    const btn = document.getElementById('btn-quick-mask');
    const banner = document.getElementById('quickmask-banner');

    if (!this.quickMaskEngine.active) {
      this.quickMaskEngine.enter(this.toolManager.selection, this.width, this.height);
      if (btn) btn.classList.add('active');
      if (banner) {
        banner.classList.remove('hidden');
        banner.style.display = 'flex';
      }
      this.toolManager.clearSelection();
      this.renderGuidesAndOverlays();
      this.showToast('Quick Mask Mode Active (Q)');
    } else {
      const res = this.quickMaskEngine.exit();
      if (btn) btn.classList.remove('active');
      if (banner) {
        banner.classList.add('hidden');
        banner.style.display = 'none';
      }
      if (res && res.active) {
        this.toolManager.selection = res;
        this.toolManager.renderMarchingAnts();
      }
      this.renderComposite();
      this.renderGuidesAndOverlays();
      this.showToast('Exited Quick Mask Mode');
    }
  }

  // ── Phase 15: Clone Source Transformation Palette ──
  openCloneSourceModal() {
    const modal = document.getElementById('modal-clone-source');
    if (!modal) return;
    modal.classList.remove('hidden');

    if (!this.cloneSourceManager) {
      this.cloneSourceManager = new CloneSourceManager(this);
    }
    const csm = this.cloneSourceManager;
    const preset = csm.getActivePreset();

    const presetBtns = modal.querySelectorAll('[data-clone-preset]');
    presetBtns.forEach(b => {
      b.classList.toggle('active', parseInt(b.getAttribute('data-clone-preset'), 10) === csm.activePresetId);
      b.onclick = () => {
        const id = parseInt(b.getAttribute('data-clone-preset'), 10);
        csm.selectPreset(id);
        this.openCloneSourceModal();
      };
    });

    const angleSlider = document.getElementById('clone-angle-slider');
    const angleInput = document.getElementById('clone-angle-input');
    const scaleWSlider = document.getElementById('clone-scale-w-slider');
    const scaleWInput = document.getElementById('clone-scale-w-input');
    const scaleHSlider = document.getElementById('clone-scale-h-slider');
    const scaleHInput = document.getElementById('clone-scale-h-input');
    const lockAspect = document.getElementById('clone-lock-aspect');
    const flipH = document.getElementById('clone-flip-h');
    const flipV = document.getElementById('clone-flip-v');
    const showOverlay = document.getElementById('clone-show-overlay');
    const overlayOpacity = document.getElementById('clone-overlay-opacity');
    const btnReset = document.getElementById('btn-reset-clone-preset');

    if (angleSlider && angleInput) {
      angleSlider.value = preset.angle;
      angleInput.value = preset.angle;
      angleSlider.oninput = () => {
        angleInput.value = angleSlider.value;
        csm.setAngle(angleSlider.value);
      };
      angleInput.oninput = () => {
        angleSlider.value = angleInput.value;
        csm.setAngle(angleInput.value);
      };
    }

    if (scaleWSlider && scaleWInput) {
      scaleWSlider.value = preset.scaleX;
      scaleWInput.value = preset.scaleX;
      scaleWSlider.oninput = () => {
        scaleWInput.value = scaleWSlider.value;
        csm.setScale(scaleWSlider.value, lockAspect && lockAspect.checked ? null : (scaleHSlider ? scaleHSlider.value : null));
        if (lockAspect && lockAspect.checked && scaleHSlider && scaleHInput) {
          scaleHSlider.value = scaleWSlider.value;
          scaleHInput.value = scaleWSlider.value;
        }
      };
      scaleWInput.oninput = () => {
        scaleWSlider.value = scaleWInput.value;
        csm.setScale(scaleWInput.value, lockAspect && lockAspect.checked ? null : (scaleHSlider ? scaleHSlider.value : null));
        if (lockAspect && lockAspect.checked && scaleHSlider && scaleHInput) {
          scaleHSlider.value = scaleWInput.value;
          scaleHInput.value = scaleWInput.value;
        }
      };
    }

    if (scaleHSlider && scaleHInput) {
      scaleHSlider.value = preset.scaleY;
      scaleHInput.value = preset.scaleY;
      scaleHSlider.oninput = () => {
        scaleHInput.value = scaleHSlider.value;
        csm.setScale(scaleWSlider ? scaleWSlider.value : 100, scaleHSlider.value);
      };
      scaleHInput.oninput = () => {
        scaleHSlider.value = scaleHInput.value;
        csm.setScale(scaleWSlider ? scaleWSlider.value : 100, scaleHSlider.value);
      };
    }

    if (flipH) {
      flipH.checked = !!preset.flipH;
      flipH.onchange = () => { preset.flipH = flipH.checked; };
    }
    if (flipV) {
      flipV.checked = !!preset.flipV;
      flipV.onchange = () => { preset.flipV = flipV.checked; };
    }
    if (lockAspect) {
      lockAspect.checked = !!csm.lockAspect;
      lockAspect.onchange = () => { csm.lockAspect = lockAspect.checked; };
    }
    if (showOverlay) {
      showOverlay.checked = !!csm.showOverlay;
      showOverlay.onchange = () => { csm.showOverlay = showOverlay.checked; };
    }
    if (overlayOpacity) {
      overlayOpacity.value = csm.overlayOpacity;
      overlayOpacity.oninput = () => { csm.overlayOpacity = parseInt(overlayOpacity.value, 10); };
    }
    if (btnReset) {
      btnReset.onclick = () => {
        csm.resetPreset();
        this.openCloneSourceModal();
      };
    }
  }

  // ── Phase 15: Optical Lens Correction & Defringing ──
  openLensCorrectionModal() {
    const modal = document.getElementById('modal-lens-correction');
    if (!modal) return;
    const active = this.layerManager.getActiveLayer();
    if (!active || active.isGroup) {
      this.showToast('Please select a raster layer first', 'error');
      return;
    }
    modal.classList.remove('hidden');

    if (!this.lensCorrectionEngine) {
      this.lensCorrectionEngine = new LensCorrectionEngine();
    }

    const previewCanvas = document.getElementById('lens-correction-preview');
    const pCtx = previewCanvas ? previewCanvas.getContext('2d') : null;

    const sliderDist = document.getElementById('lens-distortion-slider');
    const valDist = document.getElementById('val-lens-distortion');
    const sliderRed = document.getElementById('lens-defringe-red-slider');
    const valRed = document.getElementById('val-lens-defringe-red');
    const sliderBlue = document.getElementById('lens-defringe-blue-slider');
    const valBlue = document.getElementById('val-lens-defringe-blue');
    const sliderVigAm = document.getElementById('lens-vignette-amount-slider');
    const valVigAm = document.getElementById('val-lens-vignette-amount');
    const sliderVigMid = document.getElementById('lens-vignette-midpoint-slider');
    const valVigMid = document.getElementById('val-lens-vignette-midpoint');
    const checkScale = document.getElementById('lens-auto-scale');
    const btnConfirm = document.getElementById('btn-confirm-lens-correction');

    let previewSrc = null;
    if (previewCanvas && active.canvas) {
      const pw = previewCanvas.width;
      const ph = previewCanvas.height;
      const tempC = document.createElement('canvas');
      tempC.width = pw;
      tempC.height = ph;
      const tCtx = tempC.getContext('2d');
      tCtx.drawImage(active.canvas, 0, 0, pw, ph);
      previewSrc = tCtx.getImageData(0, 0, pw, ph);
    }

    const updatePreview = () => {
      if (!pCtx || !previewSrc) return;
      const distortion = parseFloat(sliderDist ? sliderDist.value : 0);
      const redCyan = parseFloat(sliderRed ? sliderRed.value : 0);
      const blueYellow = parseFloat(sliderBlue ? sliderBlue.value : 0);
      const vigAmount = parseFloat(sliderVigAm ? sliderVigAm.value : 0);
      const vigMid = parseFloat(sliderVigMid ? sliderVigMid.value : 50);
      const autoScale = checkScale ? checkScale.checked : true;

      if (valDist) valDist.textContent = distortion;
      if (valRed) valRed.textContent = redCyan;
      if (valBlue) valBlue.textContent = blueYellow;
      if (valVigAm) valVigAm.textContent = vigAmount;
      if (valVigMid) valVigMid.textContent = `${vigMid}%`;

      const corrected = this.lensCorrectionEngine.apply(previewSrc, {
        distortion,
        redCyanDefringe: redCyan,
        blueYellowDefringe: blueYellow,
        vignetteAmount: vigAmount,
        vignetteMidpoint: vigMid,
        autoScale
      });
      pCtx.putImageData(corrected, 0, 0);
    };

    if (sliderDist) sliderDist.oninput = updatePreview;
    if (sliderRed) sliderRed.oninput = updatePreview;
    if (sliderBlue) sliderBlue.oninput = updatePreview;
    if (sliderVigAm) sliderVigAm.oninput = updatePreview;
    if (sliderVigMid) sliderVigMid.oninput = updatePreview;
    if (checkScale) checkScale.onchange = updatePreview;

    updatePreview();

    if (btnConfirm) {
      btnConfirm.onclick = () => {
        const fullImg = active.ctx.getImageData(0, 0, active.width, active.height);
        const corrected = this.lensCorrectionEngine.apply(fullImg, {
          distortion: parseFloat(sliderDist ? sliderDist.value : 0),
          redCyanDefringe: parseFloat(sliderRed ? sliderRed.value : 0),
          blueYellowDefringe: parseFloat(sliderBlue ? sliderBlue.value : 0),
          vignetteAmount: parseFloat(sliderVigAm ? sliderVigAm.value : 0),
          vignetteMidpoint: parseFloat(sliderVigMid ? sliderVigMid.value : 50),
          autoScale: checkScale ? checkScale.checked : true
        });
        active.ctx.putImageData(corrected, 0, 0);
        this.renderComposite();
        this.pushHistoryState('Lens Correction');
        this.showToast('Optical Lens Correction Applied!');
        modal.classList.add('hidden');
      };
    }
  }

  // ── Phase 15: 3D Lighting Effects Engine ──
  openLightingEffectsModal() {
    const modal = document.getElementById('modal-lighting-effects');
    if (!modal) return;
    const active = this.layerManager.getActiveLayer();
    if (!active || active.isGroup) {
      this.showToast('Please select a raster layer first', 'error');
      return;
    }
    modal.classList.remove('hidden');

    if (!this.lightingEffectsEngine) {
      this.lightingEffectsEngine = new LightingEffectsEngine();
    }

    const previewCanvas = document.getElementById('lighting-effects-preview');
    const pCtx = previewCanvas ? previewCanvas.getContext('2d') : null;

    const typeSelect = document.getElementById('lighting-type-select');
    const colorInput = document.getElementById('lighting-color-input');
    const sliderInt = document.getElementById('lighting-intensity-slider');
    const valInt = document.getElementById('val-lighting-intensity');
    const sliderCone = document.getElementById('lighting-cone-slider');
    const valCone = document.getElementById('val-lighting-cone');
    const sliderBump = document.getElementById('lighting-bump-slider');
    const valBump = document.getElementById('val-lighting-bump');
    const sliderGloss = document.getElementById('lighting-gloss-slider');
    const valGloss = document.getElementById('val-lighting-gloss');
    const sliderAmb = document.getElementById('lighting-ambient-slider');
    const valAmb = document.getElementById('val-lighting-ambient');
    const btnConfirm = document.getElementById('btn-confirm-lighting-effects');

    let previewSrc = null;
    if (previewCanvas && active.canvas) {
      const pw = previewCanvas.width;
      const ph = previewCanvas.height;
      const tempC = document.createElement('canvas');
      tempC.width = pw;
      tempC.height = ph;
      const tCtx = tempC.getContext('2d');
      tCtx.drawImage(active.canvas, 0, 0, pw, ph);
      previewSrc = tCtx.getImageData(0, 0, pw, ph);
    }

    const updatePreview = () => {
      if (!pCtx || !previewSrc) return;
      const lType = typeSelect ? typeSelect.value : 'spot';
      const lColor = colorInput ? colorInput.value : '#ffffff';
      const lInt = parseFloat(sliderInt ? sliderInt.value : 100) / 100;
      const lCone = parseFloat(sliderCone ? sliderCone.value : 45);
      const bumpHeight = (parseFloat(sliderBump ? sliderBump.value : 25) / 100) * 8.0;
      const gloss = parseFloat(sliderGloss ? sliderGloss.value : 32);
      const ambient = parseFloat(sliderAmb ? sliderAmb.value : 25) / 100;

      if (valInt) valInt.textContent = `${Math.round(lInt * 100)}%`;
      if (valCone) valCone.textContent = `${lCone}°`;
      if (valBump) valBump.textContent = `${Math.round(sliderBump.value)}%`;
      if (valGloss) valGloss.textContent = gloss;
      if (valAmb) valAmb.textContent = `${Math.round(ambient * 100)}%`;

      const lights = [
        this.lightingEffectsEngine.createDefaultLight(lType, {
          x: 0.4, y: 0.35, z: 180,
          intensity: lInt,
          color: lColor,
          coneAngle: lCone,
          penumbra: 20
        })
      ];

      const lit = this.lightingEffectsEngine.render(previewSrc, {
        lights,
        material: {
          ambient,
          diffuse: 0.8,
          specular: 0.6,
          glossiness: gloss,
          bumpHeight
        }
      });
      pCtx.putImageData(lit, 0, 0);
    };

    if (typeSelect) typeSelect.onchange = updatePreview;
    if (colorInput) colorInput.oninput = updatePreview;
    if (sliderInt) sliderInt.oninput = updatePreview;
    if (sliderCone) sliderCone.oninput = updatePreview;
    if (sliderBump) sliderBump.oninput = updatePreview;
    if (sliderGloss) sliderGloss.oninput = updatePreview;
    if (sliderAmb) sliderAmb.oninput = updatePreview;

    updatePreview();

    if (btnConfirm) {
      btnConfirm.onclick = () => {
        const fullImg = active.ctx.getImageData(0, 0, active.width, active.height);
        const lType = typeSelect ? typeSelect.value : 'spot';
        const lColor = colorInput ? colorInput.value : '#ffffff';
        const lInt = parseFloat(sliderInt ? sliderInt.value : 100) / 100;
        const lCone = parseFloat(sliderCone ? sliderCone.value : 45);
        const bumpHeight = (parseFloat(sliderBump ? sliderBump.value : 25) / 100) * 8.0;
        const gloss = parseFloat(sliderGloss ? sliderGloss.value : 32);
        const ambient = parseFloat(sliderAmb ? sliderAmb.value : 25) / 100;

        const lights = [
          this.lightingEffectsEngine.createDefaultLight(lType, {
            x: 0.45, y: 0.4, z: 220,
            intensity: lInt,
            color: lColor,
            coneAngle: lCone,
            penumbra: 20
          })
        ];

        const lit = this.lightingEffectsEngine.render(fullImg, {
          lights,
          material: {
            ambient,
            diffuse: 0.8,
            specular: 0.6,
            glossiness: gloss,
            bumpHeight
          }
        });

        active.ctx.putImageData(lit, 0, 0);
        this.renderComposite();
        this.pushHistoryState('3D: Lighting Effects');
        this.showToast('3D Lighting Effects Applied!');
        modal.classList.add('hidden');
      };
    }
  }

  // ── Phase 15: Auto-Blend Focus Stacking ──
  openFocusStackModal() {
    const modal = document.getElementById('modal-focus-stack');
    if (!modal) return;
    const layers = this.layerManager.layers.filter(l => l.visible && !l.isGroup && l.type !== 'adjustment');
    if (layers.length < 2) {
      this.showToast('Focus Stacking requires at least 2 visible raster layers', 'error');
      return;
    }
    modal.classList.remove('hidden');

    if (!this.focusStackingEngine) {
      this.focusStackingEngine = new FocusStackingEngine();
    }

    const sliderPower = document.getElementById('focus-stack-power');
    const valPower = document.getElementById('val-focus-stack-power');
    const checkMasks = document.getElementById('focus-stack-masks');
    const btnConfirm = document.getElementById('btn-confirm-focus-stack');

    if (sliderPower && valPower) {
      sliderPower.oninput = () => { valPower.textContent = sliderPower.value; };
    }

    if (btnConfirm) {
      btnConfirm.onclick = () => {
        const imageList = layers.map(l => l.ctx.getImageData(0, 0, l.width, l.height));
        const power = parseFloat(sliderPower ? sliderPower.value : 4.0);
        const genMasks = checkMasks ? checkMasks.checked : true;

        const result = this.focusStackingEngine.stack(imageList, {
          contrastPower: power,
          generateMasks: genMasks
        });

        if (genMasks && result.layerMasks) {
          for (let i = 0; i < layers.length; i++) {
            const l = layers[i];
            l.hasMask = true;
            l.isMaskActive = true;
            if (!l.maskCanvas) {
              l.maskCanvas = document.createElement('canvas');
              l.maskCanvas.width = l.width;
              l.maskCanvas.height = l.height;
              l.maskCtx = l.maskCanvas.getContext('2d');
            }
            const maskImg = l.maskCtx.createImageData(l.width, l.height);
            const mData = result.layerMasks[i];
            for (let p = 0; p < mData.length; p++) {
              const v = mData[p];
              const pIdx = p * 4;
              maskImg.data[pIdx] = v;
              maskImg.data[pIdx + 1] = v;
              maskImg.data[pIdx + 2] = v;
              maskImg.data[pIdx + 3] = 255;
            }
            l.maskCtx.putImageData(maskImg, 0, 0);
          }
        }

        const fusedLayer = this.layerManager.createLayer('Focus Stacked Composite', this.width, this.height);
        fusedLayer.ctx.putImageData(result.composite, 0, 0);
        this.layerManager.renderLayerStackUI();
        this.renderComposite();
        this.pushHistoryState('Auto-Blend Focus Stack');
        this.showToast('Focus Stacking Complete: Infinite Depth of Field Created!');
        modal.classList.add('hidden');
      };
    }
  }

  updateStatusInfo() {
    document.getElementById('status-dims').textContent = `${this.width} × ${this.height} px`;
    const active = this.layerManager.getActiveLayer();
    if (active) {
      document.getElementById('status-layer-info').textContent = `Active: ${active.name}`;
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.app = new PixelForgeApp();
  window.app.init();
});
