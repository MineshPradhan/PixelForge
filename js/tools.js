// ══════════════════════════════════════════════════════════════════════
// PixelForge Studio — Advanced Tools & Retouching Engine
// ══════════════════════════════════════════════════════════════════════

class ToolManager {
  constructor(app) {
    this.app = app;
    this.currentTool = 'brush';
    this.isMouseDown = false;

    // Pointer coordinates
    this.startX = 0;
    this.startY = 0;
    this.lastX = 0;
    this.lastY = 0;
    this.currentPressure = 1.0;

    // Brush settings & Dynamics
    this.brushSize = 20;
    this.brushOpacity = 100;
    this.brushHardness = 80;
    this.usePressure = false;
    this.brushFlow = 100;
    this.brushSpacing = 25;
    this.brushScatter = 0;
    this.brushSizeJitter = 0;
    this.brushAngleJitter = 0;
    this.brushTip = 'round'; // 'round'|'soft-round'|'chisel'|'bristle'|'splatter'|'airbrush'
    this.brushTexture = 'none'; // 'none'|'canvas'|'charcoal'|'watercolor'|'chalk'|'grunge'
    this.brushTextureScale = 100;
    this.brushTextureDepth = 0;
    this.mixerWet = 50;
    this.mixerLoad = 75;
    this.mixerMix = 60;
    this.mixerCleanBrush = false;
    this.mixerLoadBrush = true;
    this.mixerEngine = (typeof MixerBrushEngine !== 'undefined') ? new MixerBrushEngine() : null;
    this.brushPresetManager = (typeof BrushPresetManager !== 'undefined') ? new BrushPresetManager() : null;

    // Retouching Suite: Patch Tool & Content-Aware Move
    this.patchMode = 'source'; // 'source' | 'destination'
    this.patchDragging = false;
    this.patchStartPt = null;
    this.contentAwareMoveMode = 'move'; // 'move' | 'extend'
    this.contentAwareMoveDragging = false;
    this.contentAwareMoveStartPt = null;

    // Lasso & Selection tool state
    this.lassoPoints = [];
    this.polyLassoPoints = [];
    this.polyLassoActive = false;

    // Clone Stamp settings
    this.cloneSource = null; // { x, y }
    this.cloneOffset = null; // { dx, dy }
    this.cloneSize = 30;
    this.cloneOpacity = 100;
    this.cloneHardness = 70;

    // Dodge & Burn settings
    this.dodgeBurnRange = 'midtones';
    this.dodgeBurnExposure = 50;
    this.dodgeBurnSize = 40;

    // Sponge settings
    this.spongeMode = 'desaturate';
    this.spongeFlow = 50;
    this.spongeSize = 40;

    // Gradient settings
    this.gradientStyle = 'linear';
    this.gradientPreset = 'rainbow';
    this.gradientStart = null;
    this.currentGradient = (typeof GradientData !== 'undefined') ? GradientData.getPreset('rainbow') : null;
    this.gradientReverse = false;
    this.gradientDither = true;

    // Blur / Sharpen / Smudge settings
    this.blurSharpenStrength = 50;
    this.blurSharpenSize = 35;
    this.smudgeColor = null;

    // Spot Healing settings
    this.healingSize = 25;

    // Bucket settings
    this.bucketTolerance = 32;

    // Magic Wand settings
    this.wandTolerance = 32;
    this.wandContiguous = true;

    // Shapes settings
    this.shapeType = 'shape-rect';
    this.shapeMode = 'shape'; // 'shape' | 'pixels' | 'path'
    this.shapeFill = true;
    this.shapeStroke = true;
    this.shapeStrokeWidth = 3;
    this.shapeRadius = 15;
    this.shapeSides = 5;
    this.shapeStarRatio = 50;

    // Vector & Bézier Path Engine
    this.pathManager = (typeof PathManager !== 'undefined') ? new PathManager(this.app) : null;

    // Text settings
    this.textFontFamily = 'Inter, sans-serif';
    this.textFontSize = 48;
    this.textBold = false;
    this.textItalic = false;

    // Selection state
    this.selection = null; // { type: 'rect'|'ellipse'|'wand'|'path', x, y, w, h, mask }
    this.marchingAntsOffset = 0;
    this.marchingAntsTimer = null;

    // Magnetic Lasso settings
    this.magneticLasso = (typeof MagneticLassoEngine !== 'undefined') ? new MagneticLassoEngine() : null;
    this.magneticPoints = [];
    this.magneticActive = false;
    this.magneticSnapRadius = 16;

    // Move tool state
    this.moveStartLayerData = null;

    // Free Transform State (Ctrl + T)
    this.isTransforming = false;
    this.transformBox = null;
    this.transformSourceCanvas = null;
    this.activeHandle = null;

    // Crop Tool state
    this.activeCropRect = null;
    this.cropDragHandle = null;
    this.cropDragStart = null;

    // Object Selection Tool state (Photoshop Parity)
    this.objSelMode = 'rectangle'; // 'rectangle' | 'lasso'
    this.objSelTolerance = 35;
    this.objSelStart = null;
    this.objSelDragging = false;
    this.objSelPoints = [];
  }

  init() {
    this.bindDOMControls();
    this.initCropControls();
    this.bindCanvasEvents();
    this.startMarchingAntsLoop();
    this.setTool('brush');
  }

  bindDOMControls() {
    // Toolbar buttons
    document.querySelectorAll('.tool-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tool = btn.dataset.tool;
        if (tool) this.setTool(tool);
      });
    });

    // Helper to bind slider and manual numeric input seamlessly
    const bindNumericControl = (sliderId, inputId, valId, propName, min, max, unit = '') => {
      const slider = document.getElementById(sliderId);
      const input = document.getElementById(inputId);
      const val = document.getElementById(valId);
      if (!slider) return;

      const setVal = (num, fromInput = false) => {
        let v = parseInt(num, 10);
        if (isNaN(v)) v = min;
        v = Math.max(min, Math.min(max, v));
        this[propName] = v;
        if (slider) slider.value = v;
        if (input && !fromInput) input.value = v;
        if (val) val.textContent = v + unit;
      };

      slider.addEventListener('input', () => setVal(slider.value, false));

      if (input) {
        input.addEventListener('focus', () => input.select());
        input.addEventListener('input', () => {
          let v = parseInt(input.value, 10);
          if (!isNaN(v)) {
            v = Math.max(min, Math.min(max, v));
            this[propName] = v;
            if (slider) slider.value = v;
            if (val) val.textContent = v + unit;
          }
        });
        input.addEventListener('change', () => setVal(input.value, false));
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') input.blur();
        });
      }
    };

    // Brush Options (Size, Opacity, Hardness, Flow, Spacing)
    bindNumericControl('brush-size', 'brush-size-input', 'brush-size-val', 'brushSize', 1, 250, 'px');
    bindNumericControl('brush-opacity', 'brush-opacity-input', 'brush-opacity-val', 'brushOpacity', 1, 100, '%');
    bindNumericControl('brush-hardness', 'brush-hardness-input', 'brush-hardness-val', 'brushHardness', 0, 100, '%');
    bindNumericControl('brush-flow', 'brush-flow-input', 'brush-flow-val', 'brushFlow', 1, 100, '%');
    bindNumericControl('brush-spacing', 'brush-spacing-input', 'brush-spacing-val', 'brushSpacing', 1, 200, '%');

    // Brush Dynamics (Scatter, Size Jitter, Angle Jitter)
    bindNumericControl('brush-scatter', 'brush-scatter-input', 'brush-scatter-val', 'brushScatter', 0, 100, '%');
    bindNumericControl('brush-size-jitter', 'brush-size-jitter-input', 'brush-size-jitter-val', 'brushSizeJitter', 0, 100, '%');
    bindNumericControl('brush-angle-jitter', 'brush-angle-jitter-input', 'brush-angle-jitter-val', 'brushAngleJitter', 0, 100, '%');

    // Brush Tip Preset Selector
    const brushTipSel = document.getElementById('brush-tip-select');
    if (brushTipSel) {
      brushTipSel.addEventListener('change', () => {
        this.brushTip = brushTipSel.value;
      });
    }

    // Brush Texture / Dual Brush
    const brushTextureSel = document.getElementById('brush-texture-select');
    if (brushTextureSel) {
      brushTextureSel.addEventListener('change', () => this.brushTexture = brushTextureSel.value);
    }
    bindNumericControl('brush-texture-scale', 'brush-texture-scale-input', 'brush-texture-scale-val', 'brushTextureScale', 10, 300, '%');
    bindNumericControl('brush-texture-depth', 'brush-texture-depth-input', 'brush-texture-depth-val', 'brushTextureDepth', 0, 100, '%');

    // Brush Preset Selector
    const brushPresetSel = document.getElementById('brush-preset-select');
    if (brushPresetSel) {
      brushPresetSel.addEventListener('change', () => {
        if (this.brushPresetManager) {
          this.brushPresetManager.applyToToolManager(brushPresetSel.value, this);
        }
      });
    }

    // Mixer Brush Controls (Wet, Load, Mix, Clean, Load)
    bindNumericControl('mixer-wet', 'mixer-wet-input', 'mixer-wet-val', 'mixerWet', 0, 100, '%');
    bindNumericControl('mixer-load', 'mixer-load-input', 'mixer-load-val', 'mixerLoad', 0, 100, '%');
    bindNumericControl('mixer-mix', 'mixer-mix-input', 'mixer-mix-val', 'mixerMix', 0, 100, '%');

    const btnCleanBrush = document.getElementById('mixer-clean-btn');
    if (btnCleanBrush) {
      btnCleanBrush.addEventListener('click', () => {
        this.mixerCleanBrush = !this.mixerCleanBrush;
        btnCleanBrush.classList.toggle('active', this.mixerCleanBrush);
      });
    }
    const btnLoadBrush = document.getElementById('mixer-load-btn');
    if (btnLoadBrush) {
      btnLoadBrush.addEventListener('click', () => {
        this.mixerLoadBrush = !this.mixerLoadBrush;
        btnLoadBrush.classList.toggle('active', this.mixerLoadBrush);
      });
    }

    // Patch Tool Mode (Source / Destination)
    const patchModeSel = document.getElementById('patch-mode-select');
    if (patchModeSel) {
      patchModeSel.addEventListener('change', () => this.patchMode = patchModeSel.value);
    }

    // Content-Aware Move Mode (Move / Extend)
    const caMoveModeSel = document.getElementById('ca-move-mode-select');
    if (caMoveModeSel) {
      caMoveModeSel.addEventListener('change', () => this.contentAwareMoveMode = caMoveModeSel.value);
    }

    // Stylus Pressure Toggle
    const pressureBtn = document.getElementById('brush-pressure-btn');
    if (pressureBtn) {
      pressureBtn.addEventListener('click', () => {
        this.usePressure = !this.usePressure;
        pressureBtn.classList.toggle('active', this.usePressure);
      });
    }

    // Clone Stamp controls (Size, Opacity, Hardness)
    bindNumericControl('clone-size', 'clone-size-input', 'clone-size-val', 'cloneSize', 1, 250, 'px');
    bindNumericControl('clone-opacity', 'clone-opacity-input', 'clone-opacity-val', 'cloneOpacity', 1, 100, '%');
    bindNumericControl('clone-hardness', 'clone-hardness-input', 'clone-hardness-val', 'cloneHardness', 0, 100, '%');

    // Dodge & Burn controls (Exposure, Size)
    const dbRange = document.getElementById('dodge-burn-range');
    if (dbRange) dbRange.addEventListener('change', () => this.dodgeBurnRange = dbRange.value);
    bindNumericControl('dodge-burn-exposure', 'dodge-burn-exposure-input', 'dodge-burn-exposure-val', 'dodgeBurnExposure', 1, 100, '%');
    bindNumericControl('dodge-burn-size', 'dodge-burn-size-input', 'dodge-burn-size-val', 'dodgeBurnSize', 5, 250, 'px');

    // Sponge controls (Flow, Size)
    const spMode = document.getElementById('sponge-mode');
    if (spMode) spMode.addEventListener('change', () => this.spongeMode = spMode.value);
    bindNumericControl('sponge-flow', 'sponge-flow-input', 'sponge-flow-val', 'spongeFlow', 1, 100, '%');
    bindNumericControl('sponge-size', 'sponge-size-input', 'sponge-size-val', 'spongeSize', 5, 250, 'px');

    // Gradient controls
    const gradStyle = document.getElementById('gradient-style');
    const gradPreset = document.getElementById('gradient-preset');
    const gradBar = document.getElementById('gradient-bar-preview');
    const btnGradEdit = document.getElementById('btn-open-gradient-editor');
    const gradRev = document.getElementById('gradient-reverse-opt');
    const gradDith = document.getElementById('gradient-dither-opt');

    const syncGradPreview = () => {
      if (gradBar && this.currentGradient) {
        gradBar.style.background = this.currentGradient.getCssGradient('to right');
      }
    };

    if (gradStyle) {
      gradStyle.addEventListener('change', () => {
        this.gradientStyle = gradStyle.value;
        if (this.currentGradient) this.currentGradient.style = gradStyle.value;
      });
    }

    if (gradPreset) {
      gradPreset.addEventListener('change', () => {
        this.gradientPreset = gradPreset.value;
        if (typeof GradientData !== 'undefined') {
          const fg = this.app.colorPicker ? this.app.colorPicker.getFgHex() : '#000000';
          const bg = this.app.colorPicker ? this.app.colorPicker.getBgHex() : '#ffffff';
          this.currentGradient = GradientData.getPreset(gradPreset.value, fg, bg);
          syncGradPreview();
        }
      });
    }

    if (gradRev) {
      gradRev.addEventListener('change', () => {
        this.gradientReverse = gradRev.checked;
        if (this.currentGradient) {
          this.currentGradient.reverse = gradRev.checked;
          syncGradPreview();
        }
      });
    }

    if (gradDith) {
      gradDith.addEventListener('change', () => {
        this.gradientDither = gradDith.checked;
        if (this.currentGradient) this.currentGradient.dither = gradDith.checked;
      });
    }

    const openGradEditor = () => {
      if (this.app.gradientEditorModal) {
        this.app.gradientEditorModal.open(this.currentGradient, (newGrad) => {
          this.currentGradient = newGrad;
          this.gradientStyle = newGrad.style;
          if (gradStyle) gradStyle.value = newGrad.style;
          syncGradPreview();
        });
      }
    };

    if (gradBar) gradBar.addEventListener('click', openGradEditor);
    if (btnGradEdit) btnGradEdit.addEventListener('click', openGradEditor);

    syncGradPreview();

    // Blur / Sharpen / Smudge controls (Strength, Size)
    bindNumericControl('blur-sharpen-strength', 'blur-sharpen-strength-input', 'blur-sharpen-strength-val', 'blurSharpenStrength', 1, 100, '%');
    bindNumericControl('blur-sharpen-size', 'blur-sharpen-size-input', 'blur-sharpen-size-val', 'blurSharpenSize', 5, 250, 'px');

    // Spot Healing controls (Size)
    bindNumericControl('healing-size', 'healing-size-input', 'healing-size-val', 'healingSize', 5, 120, 'px');

    // Magic Wand Options (Tolerance)
    bindNumericControl('wand-tolerance', 'wand-tolerance-input', 'wand-tolerance-val', 'wandTolerance', 0, 150, '');
    const wandContig = document.getElementById('wand-contiguous');
    if (wandContig) {
      wandContig.addEventListener('change', () => {
        this.wandContiguous = wandContig.checked;
      });
    }

    // Magnetic Lasso Options
    bindNumericControl('mag-lasso-radius', 'mag-lasso-radius-input', null, 'magneticSnapRadius', 4, 40, 'px');
    if (this.magneticLasso) this.magneticLasso.snapRadius = this.magneticSnapRadius;

    // Select Subject & Refine Edge buttons
    const bindSelActions = (subId, refId) => {
      const btnSub = document.getElementById(subId);
      const btnRef = document.getElementById(refId);
      if (btnSub) btnSub.addEventListener('click', () => this.selectSubject());
      if (btnRef) btnRef.addEventListener('click', () => this.openRefineEdgeModal());
    };
    bindSelActions('btn-opt-wand-select-subject', 'btn-opt-wand-refine-edge');
    bindSelActions('btn-opt-mag-select-subject', 'btn-opt-mag-refine-edge');
    bindSelActions('btn-opt-obj-select-subject', 'btn-opt-obj-refine-edge');

    // Object Selection Tool options
    const objSelMode = document.getElementById('obj-sel-mode-select');
    if (objSelMode) objSelMode.addEventListener('change', () => this.objSelMode = objSelMode.value);
    bindNumericControl('obj-sel-tolerance', 'obj-sel-tolerance-input', null, 'objSelTolerance', 10, 80, '');

    // Free Transform Commit/Cancel buttons
    const btnCommit = document.getElementById('btn-commit-transform');
    const btnCancel = document.getElementById('btn-cancel-transform');
    if (btnCommit) btnCommit.addEventListener('click', () => this.commitFreeTransform());
    if (btnCancel) btnCancel.addEventListener('click', () => this.cancelFreeTransform());

    // Bucket tolerance
    bindNumericControl('bucket-tolerance', 'bucket-tolerance-input', 'bucket-tolerance-val', 'bucketTolerance', 0, 128, '');

    // Text controls
    const fontSel = document.getElementById('text-font-family');
    const fontSz = document.getElementById('text-font-size');
    const boldBtn = document.getElementById('text-bold-btn');
    const italicBtn = document.getElementById('text-italic-btn');

    if (fontSel) fontSel.addEventListener('change', () => this.textFontFamily = fontSel.value);
    if (fontSz) fontSz.addEventListener('change', () => this.textFontSize = parseInt(fontSz.value, 10) || 36);
    if (boldBtn) boldBtn.addEventListener('click', () => {
      this.textBold = !this.textBold;
      boldBtn.classList.toggle('active', this.textBold);
    });
    if (italicBtn) italicBtn.addEventListener('click', () => {
      this.textItalic = !this.textItalic;
      italicBtn.classList.toggle('active', this.textItalic);
    });

    // Pen Tool options
    const penModeSel = document.getElementById('pen-mode-select');
    if (penModeSel) {
      penModeSel.addEventListener('change', () => {
        if (this.pathManager) this.pathManager.mode = penModeSel.value;
      });
    }

    const penSubtoolSel = document.getElementById('pen-subtool-select');
    if (penSubtoolSel) {
      penSubtoolSel.addEventListener('change', () => {
        this.setTool(penSubtoolSel.value);
      });
    }

    // Boolean operations (Combine Shapes)
    const btnUnion = document.getElementById('btn-path-union');
    if (btnUnion) btnUnion.addEventListener('click', () => this.applyPathBoolean('union'));
    const btnSubtract = document.getElementById('btn-path-subtract');
    if (btnSubtract) btnSubtract.addEventListener('click', () => this.applyPathBoolean('subtract'));
    const btnIntersect = document.getElementById('btn-path-intersect');
    if (btnIntersect) btnIntersect.addEventListener('click', () => this.applyPathBoolean('intersect'));
    const btnExclude = document.getElementById('btn-path-exclude');
    if (btnExclude) btnExclude.addEventListener('click', () => this.applyPathBoolean('exclude'));

    // Stroke style & alignment
    const penStrokeStyle = document.getElementById('pen-stroke-style');
    if (penStrokeStyle) {
      penStrokeStyle.addEventListener('change', () => {
        if (!this.pathManager) return;
        const v = penStrokeStyle.value;
        if (v === 'dashed') this.pathManager.lineDash = [8, 4];
        else if (v === 'dotted') this.pathManager.lineDash = [2, 4];
        else this.pathManager.lineDash = [];
      });
    }

    const penStrokeAlign = document.getElementById('pen-stroke-align');
    if (penStrokeAlign) {
      penStrokeAlign.addEventListener('change', () => {
        if (this.pathManager) this.pathManager.strokeAlign = penStrokeAlign.value;
      });
    }

    const btnPenSel = document.getElementById('btn-pen-selection');
    if (btnPenSel) {
      btnPenSel.addEventListener('click', () => {
        if (!this.pathManager || this.pathManager.isEmpty()) return;
        const sel = this.pathManager.makeSelection(this.app.width, this.app.height);
        if (sel) {
          this.selection = sel;
          this.renderMarchingAnts();
          this.app.pushHistoryState('Path to Selection');
        }
      });
    }

    const btnPenFromSel = document.getElementById('btn-pen-from-selection');
    if (btnPenFromSel) {
      btnPenFromSel.addEventListener('click', () => {
        this.makeWorkPathFromSelection(2.0);
      });
    }

    const btnPenMask = document.getElementById('btn-pen-mask');
    if (btnPenMask) {
      btnPenMask.addEventListener('click', () => {
        this.createVectorMaskFromPath();
      });
    }

    const btnPenShape = document.getElementById('btn-pen-shape-layer');
    if (btnPenShape) {
      btnPenShape.addEventListener('click', () => {
        this.createShapeLayerFromPath();
      });
    }

    const btnPenTextOnPath = document.getElementById('btn-pen-text-on-path');
    if (btnPenTextOnPath) {
      btnPenTextOnPath.addEventListener('click', () => {
        this.applyTextOnPath('Path Typography');
      });
    }

    const btnPenSvg = document.getElementById('btn-pen-export-svg');
    if (btnPenSvg) {
      btnPenSvg.addEventListener('click', () => {
        if (!this.pathManager || this.pathManager.isEmpty()) return;
        const svg = this.pathManager.exportSVG(this.app.width, this.app.height);
        const blob = new Blob([svg], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'vector-path.svg';
        a.click();
        URL.revokeObjectURL(url);
      });
    }

    const btnPenStroke = document.getElementById('btn-pen-stroke');
    if (btnPenStroke) {
      btnPenStroke.addEventListener('click', () => {
        const active = this.app.layerManager.getActiveLayer();
        if (active && this.pathManager && !this.pathManager.isEmpty()) {
          this.pathManager.strokePath(
            active.ctx,
            this.app.colorPicker.getFgCss(),
            this.brushSize,
            this.pathManager.lineDash || [],
            this.pathManager.lineCap || 'round',
            this.pathManager.lineJoin || 'round',
            this.pathManager.strokeAlign || 'center'
          );
          this.app.renderComposite();
          this.app.pushHistoryState('Stroke Path');
        }
      });
    }

    const btnPenFill = document.getElementById('btn-pen-fill');
    if (btnPenFill) {
      btnPenFill.addEventListener('click', () => {
        const active = this.app.layerManager.getActiveLayer();
        if (active && this.pathManager && !this.pathManager.isEmpty()) {
          this.pathManager.fillPath(active.ctx, this.app.colorPicker.getFgCss());
          this.app.renderComposite();
          this.app.pushHistoryState('Fill Path');
        }
      });
    }

    const btnPenClear = document.getElementById('btn-pen-clear');
    if (btnPenClear) {
      btnPenClear.addEventListener('click', () => {
        if (this.pathManager) this.pathManager.clear();
        this.clearOverlay();
      });
    }

    // Shapes controls
    const shapeTypeSel = document.getElementById('shape-type-select');
    if (shapeTypeSel) {
      shapeTypeSel.addEventListener('change', () => {
        this.setTool(shapeTypeSel.value);
      });
    }

    const shapeModeSel = document.getElementById('shape-mode-select');
    if (shapeModeSel) {
      shapeModeSel.addEventListener('change', () => {
        this.shapeMode = shapeModeSel.value;
      });
    }

    const shapeFill = document.getElementById('shape-fill');
    const shapeStroke = document.getElementById('shape-stroke');
    const shapeW = document.getElementById('shape-stroke-width');
    const shapeR = document.getElementById('shape-radius');
    const shapeSides = document.getElementById('shape-sides');
    const shapeRatio = document.getElementById('shape-star-ratio');

    if (shapeFill) shapeFill.addEventListener('change', () => this.shapeFill = shapeFill.checked);
    if (shapeStroke) shapeStroke.addEventListener('change', () => this.shapeStroke = shapeStroke.checked);
    if (shapeW) shapeW.addEventListener('change', () => this.shapeStrokeWidth = parseInt(shapeW.value, 10) || 2);
    if (shapeR) shapeR.addEventListener('change', () => this.shapeRadius = parseInt(shapeR.value, 10) || 0);
    if (shapeSides) shapeSides.addEventListener('change', () => this.shapeSides = parseInt(shapeSides.value, 10) || 5);
    if (shapeRatio) shapeRatio.addEventListener('change', () => this.shapeStarRatio = parseInt(shapeRatio.value, 10) || 50);
  }

  updateShapeOptionsVisibility(toolName) {
    const rLabel = document.getElementById('shape-radius-label');
    const sLabel = document.getElementById('shape-sides-label');
    const ratLabel = document.getElementById('shape-ratio-label');

    if (rLabel) rLabel.classList.toggle('hidden', toolName !== 'shape-rounded-rect');
    if (sLabel) sLabel.classList.toggle('hidden', !['shape-polygon', 'shape-star'].includes(toolName));
    if (ratLabel) ratLabel.classList.toggle('hidden', toolName !== 'shape-star');
  }

  isPathTool(toolName = null) {
    const t = toolName || this.currentTool;
    return [
      'pen',
      'curvature-pen',
      'freeform-pen',
      'pen-add',
      'pen-delete',
      'pen-convert',
      'path-select',
      'direct-select'
    ].includes(t);
  }

  createShapeLayerFromPath() {
    if (!this.pathManager || this.pathManager.isEmpty()) return null;
    const fg = this.app.colorPicker ? this.app.colorPicker.getFgCss() : '#3b82f6';
    const bg = this.app.colorPicker ? this.app.colorPicker.getBgCss() : '#ffffff';

    let layer = null;
    if (this.app.layerManager.addShapeLayer) {
      layer = this.app.layerManager.addShapeLayer('Vector Shape ' + (this.app.layerManager.layerCounter || 1), {
        subpaths: this.pathManager.subpaths.map(sp => sp.clone()),
        fill: { enabled: this.shapeFill && this.currentTool !== 'shape-line', color: fg },
        stroke: {
          enabled: !!this.shapeStroke,
          color: bg,
          width: this.shapeStrokeWidth || 2,
          dash: this.pathManager.lineDash || [],
          cap: this.pathManager.lineCap || 'round',
          join: this.pathManager.lineJoin || 'round',
          align: this.pathManager.strokeAlign || 'center'
        }
      });
    } else {
      layer = this.app.layerManager.addLayer('Shape Layer ' + (this.app.layerManager.layerCounter));
      if (layer) {
        if (this.shapeFill && this.currentTool !== 'shape-line') {
          this.pathManager.fillPath(layer.ctx, fg);
        }
        if (this.shapeStroke) {
          this.pathManager.strokePath(layer.ctx, bg, this.shapeStrokeWidth);
        }
      }
    }

    this.app.renderComposite();
    this.app.layerManager.renderLayerStackUI();
    this.app.pushHistoryState('New Shape Layer');
    return layer;
  }

  applyPathBoolean(operation) {
    if (!this.pathManager || this.pathManager.subpaths.length < 2) return false;
    this.pathManager.combinePaths(operation);
    this.clearOverlay();
    this.pathManager.renderOverlay(this.app.overlayCtx, this.app.zoom, this.app.panX, this.app.panY);
    this.app.pushHistoryState(`Combine Paths (${operation})`);
    return true;
  }

  makeWorkPathFromSelection(tolerance = 2.0) {
    if (!this.selection || !this.pathManager) return null;
    const sp = this.pathManager.makeWorkPathFromSelection(this.selection, tolerance);
    if (sp) {
      this.clearOverlay();
      this.pathManager.renderOverlay(this.app.overlayCtx, this.app.zoom, this.app.panX, this.app.panY);
      this.app.pushHistoryState('Make Work Path from Selection');
    }
    return sp;
  }

  applyTextOnPath(text = 'Path Typography') {
    if (!this.pathManager || this.pathManager.isEmpty()) return null;
    const sp = this.pathManager.getActiveSubpath() || this.pathManager.subpaths[0];
    const fgHex = this.app.colorPicker ? this.app.colorPicker.getFgHex() : '#ffffff';
    const layer = this.app.layerManager.addTextLayer(text, 0, 0, {
      fontFamily: this.textFontFamily || 'Inter, sans-serif',
      fontSize: this.textFontSize || 36,
      fontWeight: this.textBold ? 'bold' : 'normal',
      fontStyle: this.textItalic ? 'italic' : 'normal',
      color: fgHex,
      subpath: sp.clone()
    });
    this.app.renderComposite();
    this.app.pushHistoryState('Text on Path');
    return layer;
  }

  createVectorMaskFromPath() {
    if (!this.pathManager || this.pathManager.isEmpty()) return;
    const active = this.app.layerManager.getActiveLayer();
    if (!active) return;
    if (!active.hasMask) {
      this.app.layerManager.addLayerMask(active.id);
    }
    if (active.maskCtx) {
      active.maskCtx.fillStyle = '#000000';
      active.maskCtx.fillRect(0, 0, this.app.width, this.app.height);
      this.pathManager.fillPath(active.maskCtx, '#ffffff');
      this.app.renderComposite();
      this.app.layerManager.renderLayerStackUI();
      this.app.pushHistoryState('Vector Mask from Path');
    }
  }

  // ── Crop Tool Controls & Aspect Ratio Engine ──
  initCropControls() {
    const presetSelect = document.getElementById('crop-aspect-preset');
    const customGroup = document.getElementById('crop-custom-ratio-group');
    const ratioW = document.getElementById('crop-ratio-w');
    const ratioH = document.getElementById('crop-ratio-h');
    const btnSwap = document.getElementById('btn-crop-swap-ratio');
    const btnCommit = document.getElementById('btn-crop-commit');
    const btnCancel = document.getElementById('btn-crop-cancel');

    if (presetSelect && customGroup) {
      presetSelect.addEventListener('change', () => {
        const val = presetSelect.value;
        customGroup.style.display = val === 'custom' ? 'flex' : 'none';
        if (this.currentTool === 'crop' && this.activeCropRect) {
          const ratio = this.getCropAspectRatio();
          if (ratio) {
            this.activeCropRect.h = Math.round(this.activeCropRect.w / ratio);
            this.renderCropOverlay(this.activeCropRect.x, this.activeCropRect.y, this.activeCropRect.w, this.activeCropRect.h);
          }
        }
      });
      customGroup.style.display = presetSelect.value === 'custom' ? 'flex' : 'none';
    }

    if (btnSwap && ratioW && ratioH) {
      btnSwap.addEventListener('click', () => {
        const temp = ratioW.value;
        ratioW.value = ratioH.value;
        ratioH.value = temp;
        if (this.currentTool === 'crop' && this.activeCropRect) {
          const ratio = this.getCropAspectRatio();
          if (ratio) {
            this.activeCropRect.h = Math.round(this.activeCropRect.w / ratio);
            this.renderCropOverlay(this.activeCropRect.x, this.activeCropRect.y, this.activeCropRect.w, this.activeCropRect.h);
          }
        }
      });
    }

    if (btnCommit) {
      btnCommit.addEventListener('click', () => {
        if (this.activeCropRect) {
          const { x, y, w, h } = this.activeCropRect;
          this.finalizeCropAt(x, y, w, h);
        } else {
          const targetMode = document.getElementById('crop-target-mode')?.value || 'active-layer';
          const deletePixels = document.getElementById('crop-delete-pixels')?.checked ?? true;
          this.app.cropToRect(0, 0, this.app.width, this.app.height, targetMode, deletePixels);
        }
      });
    }

    if (btnCancel) {
      btnCancel.addEventListener('click', () => {
        this.clearOverlay();
        this.activeCropRect = null;
        this.setTool('move');
      });
    }

    // Enter & Escape hotkeys for Crop Tool
    window.addEventListener('keydown', (e) => {
      if (this.currentTool === 'crop' && this.activeCropRect) {
        if (e.key === 'Enter') {
          e.preventDefault();
          const { x, y, w, h } = this.activeCropRect;
          this.finalizeCropAt(x, y, w, h);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          this.clearOverlay();
          this.activeCropRect = null;
          this.setTool('move');
        }
      }
    });
  }

  startManualCrop(targetLayer = null) {
    const layer = targetLayer || this.app.layerManager.getActiveLayer();
    if (!layer) {
      this.app.showToast('Please select a layer to crop');
      return;
    }

    this.setTool('crop');
    const targetModeSelect = document.getElementById('crop-target-mode');
    const isMulti = this.app.layerManager.selectedLayerIds.size > 1;
    if (targetModeSelect) {
      targetModeSelect.value = isMulti ? 'selected-layers' : 'active-layer';
    }

    const bounds = this.app.layerManager.getLayerContentBounds(layer.id) || {
      minX: 0,
      minY: 0,
      w: this.app.width,
      h: this.app.height
    };

    this.activeCropRect = {
      x: bounds.minX,
      y: bounds.minY,
      w: Math.max(10, bounds.w),
      h: Math.max(10, bounds.h)
    };

    this.renderCropOverlay(this.activeCropRect.x, this.activeCropRect.y, this.activeCropRect.w, this.activeCropRect.h);
    const label = isMulti ? `Crop ${this.app.layerManager.selectedLayerIds.size} Selected Layers` : `Manual Crop: ${layer.name}`;
    this.app.showToast(`${label} — Drag handles to crop, press Enter to commit`);
  }

  getCropAspectRatio() {
    const preset = document.getElementById('crop-aspect-preset')?.value || 'free';
    if (preset === 'free') return null;
    if (preset === '1:1') return 1.0;
    if (preset === '4:5') return 4 / 5;
    if (preset === '5:7') return 5 / 7;
    if (preset === '16:9') return 16 / 9;
    if (preset === '9:16') return 9 / 16;
    if (preset === '4:3') return 4 / 3;
    if (preset === '3:2') return 3 / 2;
    if (preset === 'original') {
      const active = this.app.layerManager.getActiveLayer();
      if (active && active.canvas.width && active.canvas.height) {
        return active.canvas.width / active.canvas.height;
      }
      return this.app.width / this.app.height;
    }
    if (preset === 'custom') {
      const rw = parseFloat(document.getElementById('crop-ratio-w')?.value) || 1;
      const rh = parseFloat(document.getElementById('crop-ratio-h')?.value) || 1;
      return rh > 0 ? rw / rh : 1.0;
    }
    return null;
  }

  hitTestCropHandle(x, y) {
    if (!this.activeCropRect) return null;
    const r = this.activeCropRect;
    const threshold = Math.max(8, 12 / (this.app.zoom || 1));

    const handles = {
      'tl': { x: r.x, y: r.y },
      'tc': { x: r.x + r.w / 2, y: r.y },
      'tr': { x: r.x + r.w, y: r.y },
      'ml': { x: r.x, y: r.y + r.h / 2 },
      'mr': { x: r.x + r.w, y: r.y + r.h / 2 },
      'bl': { x: r.x, y: r.y + r.h },
      'bc': { x: r.x + r.w / 2, y: r.y + r.h },
      'br': { x: r.x + r.w, y: r.y + r.h }
    };

    for (const [key, pos] of Object.entries(handles)) {
      if (Math.hypot(x - pos.x, y - pos.y) <= threshold) {
        return key;
      }
    }

    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
      return 'inside';
    }

    return null;
  }

  updateCropHoverCursor(x, y) {
    const handle = this.hitTestCropHandle(x, y);
    const overlay = this.app.overlayCanvas;
    if (!overlay) return;

    if (handle === 'tl' || handle === 'br') {
      overlay.style.cursor = 'nwse-resize';
    } else if (handle === 'tr' || handle === 'bl') {
      overlay.style.cursor = 'nesw-resize';
    } else if (handle === 'tc' || handle === 'bc') {
      overlay.style.cursor = 'ns-resize';
    } else if (handle === 'ml' || handle === 'mr') {
      overlay.style.cursor = 'ew-resize';
    } else if (handle === 'inside') {
      overlay.style.cursor = 'move';
    } else {
      overlay.style.cursor = 'crosshair';
    }
  }

  handleCropPointerDown(x, y) {
    const handle = this.hitTestCropHandle(x, y);
    if (handle) {
      this.cropDragHandle = handle;
      this.cropDragStart = {
        rect: { ...this.activeCropRect },
        x,
        y
      };
      return true;
    }
    return false;
  }

  handleCropPointerMove(x, y) {
    if (!this.cropDragHandle || !this.cropDragStart) return;

    const orig = this.cropDragStart.rect;
    const dx = x - this.cropDragStart.x;
    const dy = y - this.cropDragStart.y;

    if (this.cropDragHandle === 'inside') {
      this.activeCropRect.x = Math.round(orig.x + dx);
      this.activeCropRect.y = Math.round(orig.y + dy);
      this.renderCropOverlay(this.activeCropRect.x, this.activeCropRect.y, this.activeCropRect.w, this.activeCropRect.h);
      return;
    }

    let newX = orig.x;
    let newY = orig.y;
    let newW = orig.w;
    let newH = orig.h;
    const minSz = 10;
    const ratio = this.getCropAspectRatio();

    if (this.cropDragHandle.includes('r')) {
      newW = Math.max(minSz, Math.round(orig.w + dx));
    } else if (this.cropDragHandle.includes('l')) {
      const maxDx = orig.w - minSz;
      const clampedDx = Math.min(dx, maxDx);
      newX = Math.round(orig.x + clampedDx);
      newW = Math.round(orig.w - clampedDx);
    }

    if (this.cropDragHandle.includes('b')) {
      newH = Math.max(minSz, Math.round(orig.h + dy));
    } else if (this.cropDragHandle.includes('t')) {
      const maxDy = orig.h - minSz;
      const clampedDy = Math.min(dy, maxDy);
      newY = Math.round(orig.y + clampedDy);
      newH = Math.round(orig.h - clampedDy);
    }

    if (ratio) {
      if (['ml', 'mr'].includes(this.cropDragHandle)) {
        newH = Math.round(newW / ratio);
      } else if (['tc', 'bc'].includes(this.cropDragHandle)) {
        newW = Math.round(newH * ratio);
      } else {
        newH = Math.round(newW / ratio);
      }
    }

    this.activeCropRect = { x: newX, y: newY, w: newW, h: newH };
    this.renderCropOverlay(this.activeCropRect.x, this.activeCropRect.y, this.activeCropRect.w, this.activeCropRect.h);
  }

  finalizeCropAt(x, y, w, h) {
    this.clearOverlay();
    this.activeCropRect = null;
    const targetMode = document.getElementById('crop-target-mode')?.value || 'active-layer';
    const deletePixels = document.getElementById('crop-delete-pixels')?.checked ?? true;

    this.app.cropToRect(x, y, w, h, targetMode, deletePixels);
    this.setTool('move');
  }

  setTool(toolName) {
    if (this.isTransforming && toolName !== 'transform') {
      this.commitFreeTransform();
    }

    this.currentTool = toolName;

    document.querySelectorAll('.tool-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tool === toolName);
    });

    const titleEl = document.getElementById('active-tool-name');
    const names = {
      'move': 'Move Tool (V)',
      'select-rect': 'Rectangular Marquee (M)',
      'select-ellipse': 'Elliptical Marquee',
      'lasso-freehand': 'Lasso Tool (L) — Freehand',
      'lasso-polygon': 'Polygonal Lasso Tool',
      'magic-wand': 'Magic Wand Tool (W)',
      'lasso-magnetic': 'Magnetic Lasso Tool (L)',
      'crop': 'Crop Tool (C)',
      'brush': 'Paintbrush Tool (B)',
      'mixer-brush': 'Mixer Brush Tool (B)',
      'pencil': 'Pencil Tool',
      'clone-stamp': 'Clone Stamp Tool (S)',
      'spot-healing': 'Spot Healing Brush (J)',
      'adjustment-brush': 'Adjustment Brush Tool (Shift+J)',
      'patch': 'Patch Tool (J)',
      'content-aware-move': 'Content-Aware Move Tool (J)',
      'select-object': 'Object Selection Tool (W)',
      'eraser': 'Eraser Tool (E)',
      'bucket': 'Paint Bucket Fill (G)',
      'gradient': 'Gradient Tool (G)',
      'tool-blur': 'Blur Tool',
      'tool-sharpen': 'Sharpen Tool',
      'smudge': 'Smudge Tool',
      'dodge': 'Dodge Tool (Lightens / O)',
      'burn': 'Burn Tool (Darkens)',
      'sponge': 'Sponge Tool',
      'pen': 'Bézier Pen Tool (P)',
      'curvature-pen': 'Curvature Pen Tool',
      'freeform-pen': 'Freeform Pen Tool',
      'pen-add': 'Add Anchor Point Tool',
      'pen-delete': 'Delete Anchor Point Tool',
      'pen-convert': 'Convert Point Tool',
      'path-select': 'Path Selection Tool (Black Arrow) (A)',
      'direct-select': 'Direct Selection Tool (White Arrow)',
      'text': 'Text Tool (T)',
      'shape-rect': 'Rectangle Shape (U)',
      'shape-rounded-rect': 'Rounded Rectangle Shape',
      'shape-ellipse': 'Ellipse Shape',
      'shape-polygon': 'Polygon Shape',
      'shape-star': 'Star Shape',
      'shape-line': 'Line Tool',
      'eyedropper': 'Eyedropper Tool (I)',
      'hand': 'Hand / Pan Tool (H)',
      'zoom': 'Zoom Tool (Z)',
      'transform': 'Free Transform (Ctrl+T)'
    };
    if (titleEl) titleEl.textContent = names[toolName] || toolName;

    // Show/hide tool options
    const optBrush = document.getElementById('opt-group-brush');
    const optClone = document.getElementById('opt-group-clone');
    const optDodgeBurn = document.getElementById('opt-group-dodge-burn');
    const optSponge = document.getElementById('opt-group-sponge');
    const optGradient = document.getElementById('opt-group-gradient');
    const optBlurSharpen = document.getElementById('opt-group-blur-sharpen');
    const optHealing = document.getElementById('opt-group-healing');
    const optWand = document.getElementById('opt-group-wand');
    const optTransform = document.getElementById('opt-group-transform');
    const optPen = document.getElementById('opt-group-pen');
    const optShape = document.getElementById('opt-group-shape');
    const optText = document.getElementById('opt-group-text');
    const optBucket = document.getElementById('opt-group-bucket');
    const optMagLasso = document.getElementById('opt-group-magnetic-lasso');

    const optMixer = document.getElementById('opt-group-mixer');
    const optPatch = document.getElementById('opt-group-patch');
    const optCAMove = document.getElementById('opt-group-content-aware-move');
    const optCrop = document.getElementById('opt-group-crop');
    const optObjSel = document.getElementById('opt-group-object-selection');

    if (optBrush) optBrush.classList.toggle('hidden', !['brush', 'pencil', 'eraser', 'mixer-brush'].includes(toolName));
    if (optCrop) optCrop.classList.toggle('hidden', toolName !== 'crop');
    if (optObjSel) optObjSel.classList.toggle('hidden', toolName !== 'select-object');
    if (optMixer) optMixer.classList.toggle('hidden', toolName !== 'mixer-brush');
    if (optClone) optClone.classList.toggle('hidden', toolName !== 'clone-stamp');
    if (optDodgeBurn) optDodgeBurn.classList.toggle('hidden', !['dodge', 'burn'].includes(toolName));
    if (optSponge) optSponge.classList.toggle('hidden', toolName !== 'sponge');
    if (optGradient) optGradient.classList.toggle('hidden', toolName !== 'gradient');
    if (optBlurSharpen) optBlurSharpen.classList.toggle('hidden', !['tool-blur', 'tool-sharpen', 'smudge'].includes(toolName));
    if (optHealing) optHealing.classList.toggle('hidden', toolName !== 'spot-healing');
    if (optPatch) optPatch.classList.toggle('hidden', toolName !== 'patch');
    if (optCAMove) optCAMove.classList.toggle('hidden', toolName !== 'content-aware-move');
    if (optWand) optWand.classList.toggle('hidden', toolName !== 'magic-wand');
    if (optMagLasso) optMagLasso.classList.toggle('hidden', toolName !== 'lasso-magnetic');
    if (optTransform) optTransform.classList.toggle('hidden', toolName !== 'transform');

    const isPath = this.isPathTool(toolName);
    if (optPen) optPen.classList.toggle('hidden', !isPath);
    const penSubtoolSel = document.getElementById('pen-subtool-select');
    if (penSubtoolSel && isPath) {
      penSubtoolSel.value = toolName;
    }

    if (optShape) optShape.classList.toggle('hidden', !toolName.startsWith('shape-'));
    if (optText) optText.classList.toggle('hidden', toolName !== 'text');
    if (toolName === 'text') {
      const active = this.app.layerManager.getActiveLayer();
      if (active && active.type === 'text' && this.app.openTypographyInspector) {
        this.app.openTypographyInspector(active);
      }
    }
    if (optBucket) optBucket.classList.toggle('hidden', toolName !== 'bucket');

    if (toolName === 'lasso-magnetic') {
      const active = this.app.layerManager.getActiveLayer();
      if (active && this.magneticLasso) {
        this.magneticLasso.computeEdgeMap(active.ctx, this.app.width, this.app.height);
      }
      this.magneticPoints = [];
      this.magneticActive = false;
    }

    const shapeTypeSel = document.getElementById('shape-type-select');
    if (shapeTypeSel && toolName.startsWith('shape-')) {
      shapeTypeSel.value = toolName;
      this.updateShapeOptionsVisibility(toolName);
    }

    if (isPath && this.pathManager && !this.pathManager.isEmpty()) {
      this.clearOverlay();
      this.pathManager.renderOverlay(this.app.overlayCtx, this.app.zoom, this.app.panX, this.app.panY);
    }

    if (this.app && this.app.objectFinderEngine) {
      this.app.objectFinderEngine.active = (toolName === 'select-object');
      if (!this.app.objectFinderEngine.active) {
        this.app.objectFinderEngine.hoveredContour = null;
      }
    }

    if (this.app && this.app.contextualTaskBar) {
      this.app.contextualTaskBar.update();
    }

    if (toolName === 'crop') {
      if (!this.activeCropRect) {
        const active = this.app.layerManager.getActiveLayer();
        const bounds = active ? this.app.layerManager.getLayerContentBounds(active.id) : null;
        if (bounds && bounds.w > 0 && bounds.h > 0) {
          this.activeCropRect = {
            x: bounds.minX,
            y: bounds.minY,
            w: bounds.w,
            h: bounds.h
          };
        } else {
          this.activeCropRect = {
            x: 0,
            y: 0,
            w: this.app.width,
            h: this.app.height
          };
        }
      }
      this.renderCropOverlay(this.activeCropRect.x, this.activeCropRect.y, this.activeCropRect.w, this.activeCropRect.h);
    } else if (this.activeCropRect && toolName !== 'crop') {
      this.clearOverlay();
      this.activeCropRect = null;
    }

    this.updateCursor();
  }

  updateCursor() {
    const overlay = this.app.overlayCanvas;
    if (!overlay) return;

    if (this.currentTool === 'hand') {
      overlay.style.cursor = 'grab';
    } else if (this.currentTool === 'zoom') {
      overlay.style.cursor = 'zoom-in';
    } else if (this.currentTool === 'move') {
      overlay.style.cursor = 'move';
    } else if (this.currentTool === 'text') {
      overlay.style.cursor = 'text';
    } else if (this.currentTool === 'magic-wand') {
      overlay.style.cursor = 'cell';
    } else if (this.currentTool === 'path-select') {
      overlay.style.cursor = 'default';
    } else if (this.currentTool === 'direct-select') {
      overlay.style.cursor = 'pointer';
    } else if (this.currentTool === 'pen-delete') {
      overlay.style.cursor = 'not-allowed';
    } else if (this.currentTool === 'pen-add') {
      overlay.style.cursor = 'copy';
    } else {
      overlay.style.cursor = 'crosshair';
    }
  }

  getDocCoords(e) {
    if (!this.app || !this.app.overlayCanvas) return { x: 0, y: 0 };
    const rect = this.app.overlayCanvas.getBoundingClientRect();
    if (!rect || !rect.width || !rect.height) return { x: 0, y: 0 };
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    const scaleX = (this.app.width && rect.width) ? (this.app.width / rect.width) : 1;
    const scaleY = (this.app.height && rect.height) ? (this.app.height / rect.height) : 1;

    return {
      x: clientX * scaleX,
      y: clientY * scaleY
    };
  }

  bindCanvasEvents() {
    const overlay = this.app.overlayCanvas;
    overlay.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    window.addEventListener('pointermove', (e) => this.onPointerMove(e));
    window.addEventListener('pointerup', (e) => this.onPointerUp(e));
    overlay.addEventListener('dblclick', (e) => {
      if (this.currentTool === 'crop' && this.activeCropRect) {
        const coords = this.getDocCoords(e);
        const r = this.activeCropRect;
        if (coords.x >= r.x && coords.x <= r.x + r.w && coords.y >= r.y && coords.y <= r.y + r.h) {
          this.finalizeCropAt(r.x, r.y, r.w, r.h);
          return;
        }
      }
      if (this.currentTool === 'lasso-magnetic') {
        this.closeMagneticLasso();
      } else if (this.currentTool === 'lasso-polygon') {
        this.closePolygonalLasso();
      }
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.currentTool === 'lasso-polygon' && this.polyLassoActive) {
        this.polyLassoActive = false;
        this.polyLassoPoints = [];
        this.clearOverlay();
      }
    });

    overlay.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const coords = this.getDocCoords(e);
      const hitLayer = this.app.layerManager.getTopVisibleLayerAt(coords.x, coords.y) || this.app.layerManager.getActiveLayer();
      if (hitLayer && this.app.showLayerContextMenu) {
        if (!this.app.layerManager.selectedLayerIds.has(hitLayer.id)) {
          this.app.layerManager.setActiveLayer(hitLayer.id);
        }
        this.app.showLayerContextMenu(e.clientX, e.clientY, hitLayer.id);
      }
    });
  }

  onPointerDown(e) {
    if (e.button !== 0 && e.button !== 1) return;
    const coords = this.getDocCoords(e);
    this.startX = coords.x;
    this.startY = coords.y;
    this.lastX = coords.x;
    this.lastY = coords.y;
    this.currentPressure = (e.pressure !== undefined && e.pressure > 0) ? e.pressure : 1.0;
    this.isMouseDown = true;

    // Puppet Warp mode
    if (this.app.puppetWarpEngine && this.app.puppetWarpEngine.active) {
      const pin = this.app.puppetWarpEngine.hitTestPin(coords.x, coords.y, 14 / this.app.zoom);
      if (e.altKey && pin) {
        this.app.puppetWarpEngine.removePin(pin.id);
      } else if (pin) {
        this.app.puppetWarpEngine.selectedPin = pin;
      } else {
        this.app.puppetWarpEngine.addPin(coords.x, coords.y);
      }
      this.app.renderGuidesAndOverlays();
      return;
    }

    // Free Transform mode
    if (this.isTransforming) {
      this.handleTransformPointerDown(coords.x, coords.y);
      return;
    }

    // Crop Tool Handle mode
    if (this.currentTool === 'crop' && this.activeCropRect) {
      if (this.handleCropPointerDown(coords.x, coords.y)) {
        return;
      }
    }

    const activeLayer = this.app.layerManager.getActiveLayer();
    if (!activeLayer) return;

    // Clone Stamp source picking with Alt
    if (this.currentTool === 'clone-stamp') {
      if (e.altKey) {
        this.cloneSource = { x: Math.round(coords.x), y: Math.round(coords.y) };
        if (this.app.cloneSourceManager) {
          this.app.cloneSourceManager.setSource(this.cloneSource.x, this.cloneSource.y);
        }
        const statusEl = document.getElementById('clone-sample-status');
        if (statusEl) statusEl.textContent = `Source set: (${this.cloneSource.x}, ${this.cloneSource.y})`;
        this.isMouseDown = false;
        return;
      }
      if (!this.cloneSource) {
        alert("Hold Alt and click on the canvas to set a Clone Source point first!");
        this.isMouseDown = false;
        return;
      }
      this.cloneAnchorDest = { x: coords.x, y: coords.y };
      this.cloneOffset = {
        dx: this.cloneSource.x - coords.x,
        dy: this.cloneSource.y - coords.y
      };
      this.applyCloneStamp(activeLayer, coords.x, coords.y, coords.x, coords.y);
      this.app.renderComposite();
    }

    // Pen Tool & Vector Path Suite
    if (this.isPathTool(this.currentTool)) {
      if (this.pathManager) {
        this.pathManager.handlePointerDown(coords.x, coords.y, e.altKey, e.shiftKey, this.currentTool);
        this.clearOverlay();
        this.pathManager.renderOverlay(this.app.overlayCtx, this.app.zoom, this.app.panX, this.app.panY);
      }
      return;
    }

    switch (this.currentTool) {
      case 'eyedropper':
        this.sampleEyedropper(coords.x, coords.y);
        break;

      case 'magic-wand':
        this.applyMagicWand(coords.x, coords.y);
        break;

      case 'select-object':
        this.objSelStart = { x: coords.x, y: coords.y };
        this.objSelDragging = true;
        this.objSelPoints = [{ x: coords.x, y: coords.y }];
        break;

      case 'lasso-freehand':
        this.lassoPoints = [{ x: coords.x, y: coords.y }];
        break;

      case 'lasso-polygon':
        this.handlePolygonalMouseDown(coords.x, coords.y);
        break;

      case 'lasso-magnetic':
        this.handleMagneticMouseDown(coords.x, coords.y);
        break;

      case 'bucket':
        this.applyBucket(activeLayer, coords.x, coords.y);
        break;

      case 'text':
        this.applyTextPrompt(activeLayer, coords.x, coords.y);
        break;

      case 'zoom':
        if (e.altKey) this.app.zoomOut();
        else this.app.zoomIn();
        break;

      case 'hand':
        this.app.overlayCanvas.style.cursor = 'grabbing';
        break;

      case 'brush':
      case 'mixer-brush':
      case 'pencil':
      case 'eraser':
        if (this.app.symmetryEngine && this.app.symmetryEngine.enabled) {
          const symPoints = this.app.symmetryEngine.getSymmetricPoints(coords.x, coords.y);
          symPoints.forEach(pt => {
            this.drawStroke(activeLayer, pt.x, pt.y, pt.x, pt.y, this.currentPressure);
          });
        } else {
          this.drawStroke(activeLayer, coords.x, coords.y, coords.x, coords.y, this.currentPressure);
        }
        this.app.renderComposite();
        break;

      case 'adjustment-brush':
        if (this.app.adjustmentBrushEngine) {
          this.app.adjustmentBrushEngine.size = this.brushSize || 35;
          this.app.adjustmentBrushEngine.hardness = this.brushHardness || 50;
          this.app.adjustmentBrushEngine.opacity = this.brushOpacity || 100;
          this.app.adjustmentBrushEngine.startStroke(coords.x, coords.y);
          this.app.renderComposite();
        }
        break;

      case 'history-brush':
        if (this.app.historyBrushEngine) {
          if (!this.app.historyBrushEngine.sourceSnapshot) {
            this.app.historyBrushEngine.captureCurrentAsSnapshot('Initial Canvas');
          }
          this.applyHistoryBrush(activeLayer, coords.x, coords.y, coords.x, coords.y);
          this.app.renderComposite();
        }
        break;

      case 'patch':
        this.handlePatchPointerDown(coords.x, coords.y);
        break;

      case 'content-aware-move':
        this.handleCAMovePointerDown(coords.x, coords.y);
        break;

      case 'dodge':
      case 'burn':
        this.applyDodgeBurn(activeLayer, coords.x, coords.y, coords.x, coords.y, this.currentTool === 'dodge');
        this.app.renderComposite();
        break;

      case 'sponge':
        this.applySponge(activeLayer, coords.x, coords.y, coords.x, coords.y);
        this.app.renderComposite();
        break;

      case 'tool-blur':
      case 'tool-sharpen':
        this.applyBlurSharpen(activeLayer, coords.x, coords.y, coords.x, coords.y, this.currentTool === 'tool-blur');
        this.app.renderComposite();
        break;

      case 'smudge':
        this.startSmudge(activeLayer, coords.x, coords.y);
        break;

      case 'spot-healing':
        this.applySpotHealing(activeLayer, coords.x, coords.y);
        this.app.renderComposite();
        break;

      case 'gradient':
        this.gradientStart = { x: coords.x, y: coords.y };
        break;

      case 'move':
        const selected = this.app.layerManager.getSelectedLayers();
        const movingLayers = new Set(selected.length > 0 ? selected : [activeLayer]);
        let addedMore = true;
        while (addedMore) {
          addedMore = false;
          this.app.layerManager.layers.forEach(l => {
            if (l.parentId && Array.from(movingLayers).some(m => m.id === l.parentId) && !movingLayers.has(l)) {
              movingLayers.add(l);
              addedMore = true;
            }
          });
        }

        this.moveSources = new Map();
        movingLayers.forEach(l => {
          if (l.locked) return;
          const sCanvas = Utils.createCanvas(this.app.width, this.app.height);
          sCanvas.getContext('2d').drawImage(l.canvas, 0, 0);
          let mCanvas = null;
          if (l.hasMask && l.maskCanvas) {
            mCanvas = Utils.createCanvas(this.app.width, this.app.height);
            mCanvas.getContext('2d').drawImage(l.maskCanvas, 0, 0);
          }
          this.moveSources.set(l, { canvas: sCanvas, maskCanvas: mCanvas });
        });
        break;
    }
  }

  onPointerMove(e) {
    const coords = this.getDocCoords(e);

    const statusCoords = document.getElementById('status-coords');
    if (statusCoords) {
      statusCoords.textContent = `X: ${Math.round(coords.x)} px, Y: ${Math.round(coords.y)} px`;
    }

    if (this.isTransforming) {
      if (this.isMouseDown) {
        this.handleTransformPointerMove(coords.x, coords.y, e);
      } else {
        this.updateTransformHoverCursor(coords.x, coords.y);
      }
      return;
    }

    if (this.currentTool === 'crop' && this.activeCropRect) {
      if (this.cropDragHandle) {
        this.handleCropPointerMove(coords.x, coords.y);
        return;
      } else if (!this.isMouseDown) {
        this.updateCropHoverCursor(coords.x, coords.y);
      }
    }

    if (this.isPathTool(this.currentTool)) {
      if (this.pathManager) {
        if (this.isMouseDown) {
          this.pathManager.handlePointerMove(coords.x, coords.y, e.altKey);
          this.clearOverlay();
          this.pathManager.renderOverlay(this.app.overlayCtx, this.app.zoom, this.app.panX, this.app.panY);
        } else {
          const hit = this.pathManager.hitTest(coords.x, coords.y, 8);
          const overlay = this.app.overlayCanvas;
          if (hit) {
            if (hit.type === 'anchor') {
              overlay.style.cursor = (this.currentTool === 'pen-delete') ? 'not-allowed' : ((hit.pointIdx === 0 && !hit.isClosed) ? 'crosshair' : 'pointer');
            } else if (hit.type === 'cp1' || hit.type === 'cp2') {
              overlay.style.cursor = 'grab';
            } else if (hit.type === 'segment') {
              overlay.style.cursor = (this.currentTool === 'pen-add') ? 'copy' : 'default';
            }
          } else {
            this.updateCursor();
          }
        }
      }
      return;
    }

    if (this.currentTool === 'lasso-freehand') {
      if (this.isMouseDown && this.lassoPoints.length > 0) {
        const lastPt = this.lassoPoints[this.lassoPoints.length - 1];
        if (Math.hypot(coords.x - lastPt.x, coords.y - lastPt.y) >= 2) {
          this.lassoPoints.push({ x: coords.x, y: coords.y });
          this.renderFreehandLassoOverlay();
        }
      }
      return;
    }

    if (this.currentTool === 'lasso-polygon') {
      if (this.polyLassoActive) {
        this.renderPolygonalOverlay(coords);
      }
      return;
    }

    if (this.currentTool === 'lasso-magnetic') {
      this.handleMagneticMouseMove(coords.x, coords.y);
      return;
    }

    // Puppet Warp mode
    if (this.app.puppetWarpEngine && this.app.puppetWarpEngine.active) {
      if (this.isMouseDown && this.app.puppetWarpEngine.selectedPin) {
        this.app.puppetWarpEngine.selectedPin.x = coords.x;
        this.app.puppetWarpEngine.selectedPin.y = coords.y;
        this.app.puppetWarpEngine.solveDeformation();
        this.app.renderGuidesAndOverlays();
      }
      return;
    }

    if (this.currentTool === 'select-object') {
      if (this.isMouseDown && this.objSelDragging && this.objSelStart) {
        if (this.objSelMode === 'lasso') {
          this.objSelPoints.push({ x: coords.x, y: coords.y });
          this.renderObjectSelectionLasso(this.objSelPoints);
        } else {
          this.renderObjectSelectionBox(this.objSelStart, coords);
        }
      } else if (this.app.objectFinderEngine) {
        const compositeCtx = this.app.mainCtx;
        if (compositeCtx) {
          const imgData = compositeCtx.getImageData(0, 0, this.app.width, this.app.height);
          const tol = this.objSelTolerance || 35;
          const found = this.app.objectFinderEngine.detectObjectAt(imgData, coords.x, coords.y, tol);
          this.app.objectFinderEngine.hoveredContour = found;
          this.app.renderGuidesAndOverlays();
        }
      }
      return;
    }

    if (!this.isMouseDown) return;

    this.currentPressure = (e.pressure !== undefined && e.pressure > 0) ? e.pressure : 1.0;

    const activeLayer = this.app.layerManager.getActiveLayer();
    if (!activeLayer) return;

    switch (this.currentTool) {
      case 'brush':
      case 'mixer-brush':
      case 'pencil':
      case 'eraser':
        if (this.app.symmetryEngine && this.app.symmetryEngine.enabled) {
          const symPointsPrev = this.app.symmetryEngine.getSymmetricPoints(this.lastX, this.lastY);
          const symPointsCurr = this.app.symmetryEngine.getSymmetricPoints(coords.x, coords.y);
          for (let i = 0; i < symPointsCurr.length; i++) {
            const p1 = symPointsPrev[i] || symPointsPrev[0];
            const p2 = symPointsCurr[i];
            this.drawStroke(activeLayer, p1.x, p1.y, p2.x, p2.y, this.currentPressure);
          }
        } else {
          this.drawStroke(activeLayer, this.lastX, this.lastY, coords.x, coords.y, this.currentPressure);
        }
        this.app.renderComposite();
        break;

      case 'adjustment-brush':
        if (this.app.adjustmentBrushEngine) {
          this.app.adjustmentBrushEngine.continueStroke(coords.x, coords.y);
          this.app.renderComposite();
        }
        break;

      case 'history-brush':
        if (this.app.historyBrushEngine) {
          this.applyHistoryBrush(activeLayer, this.lastX, this.lastY, coords.x, coords.y);
          this.app.renderComposite();
        }
        break;

      case 'patch':
        this.handlePatchPointerMove(coords.x, coords.y);
        break;

      case 'content-aware-move':
        this.handleCAMovePointerMove(coords.x, coords.y);
        break;

      case 'clone-stamp':
        this.applyCloneStamp(activeLayer, this.lastX, this.lastY, coords.x, coords.y);
        this.app.renderComposite();
        break;

      case 'dodge':
      case 'burn':
        this.applyDodgeBurn(activeLayer, this.lastX, this.lastY, coords.x, coords.y, this.currentTool === 'dodge');
        this.app.renderComposite();
        break;

      case 'sponge':
        this.applySponge(activeLayer, this.lastX, this.lastY, coords.x, coords.y);
        this.app.renderComposite();
        break;

      case 'tool-blur':
      case 'tool-sharpen':
        this.applyBlurSharpen(activeLayer, this.lastX, this.lastY, coords.x, coords.y, this.currentTool === 'tool-blur');
        this.app.renderComposite();
        break;

      case 'smudge':
        this.applySmudge(activeLayer, coords.x, coords.y);
        this.app.renderComposite();
        break;

      case 'spot-healing':
        this.applySpotHealing(activeLayer, coords.x, coords.y);
        this.app.renderComposite();
        break;

      case 'gradient':
        this.renderGradientPreview(coords.x, coords.y);
        break;

      case 'hand':
        this.app.panX += e.movementX;
        this.app.panY += e.movementY;
        this.app.applyViewportTransform();
        break;

      case 'move':
        if (this.moveSources && this.moveSources.size > 0) {
          const dx = Math.round(coords.x - this.startX);
          const dy = Math.round(coords.y - this.startY);

          this.moveSources.forEach((src, l) => {
            if (l.isMaskActive && src.maskCanvas) {
              l.maskCtx.clearRect(0, 0, this.app.width, this.app.height);
              l.maskCtx.drawImage(src.maskCanvas, dx, dy);
            } else {
              l.ctx.clearRect(0, 0, this.app.width, this.app.height);
              l.ctx.drawImage(src.canvas, dx, dy);
              if (src.maskCanvas) {
                l.maskCtx.clearRect(0, 0, this.app.width, this.app.height);
                l.maskCtx.drawImage(src.maskCanvas, dx, dy);
              }
            }
          });
          this.app.renderComposite();
        }
        break;

      case 'select-rect':
      case 'select-ellipse':
      case 'shape-rect':
      case 'shape-rounded-rect':
      case 'shape-ellipse':
      case 'shape-polygon':
      case 'shape-star':
      case 'shape-line':
      case 'crop':
        this.renderToolOverlayPreview(coords.x, coords.y);
        break;
    }

    this.lastX = coords.x;
    this.lastY = coords.y;
  }

  onPointerUp(e) {
    if (this.app.puppetWarpEngine && this.app.puppetWarpEngine.active) {
      this.isMouseDown = false;
      return;
    }

    if (!this.isMouseDown) return;
    this.isMouseDown = false;

    if (this.isTransforming) {
      this.activeHandle = null;
      this.transformDragStart = null;
      return;
    }

    if (this.currentTool === 'crop' && this.cropDragHandle) {
      this.cropDragHandle = null;
      this.cropDragStart = null;
      return;
    }

    if (this.isPathTool(this.currentTool)) {
      if (this.pathManager) {
        this.pathManager.handlePointerUp();
        this.clearOverlay();
        this.pathManager.renderOverlay(this.app.overlayCtx, this.app.zoom, this.app.panX, this.app.panY);
      }
      return;
    }

    const coords = this.getDocCoords(e);
    const activeLayer = this.app.layerManager.getActiveLayer();

    switch (this.currentTool) {
      case 'brush':
      case 'pencil':
      case 'eraser':
        this.app.pushHistoryState(this.currentTool.toUpperCase() + ' Stroke');
        break;

      case 'adjustment-brush':
        if (this.app.adjustmentBrushEngine) {
          this.app.adjustmentBrushEngine.endStroke();
          this.app.pushHistoryState('Adjustment Brush Stroke');
        }
        break;

      case 'history-brush':
        this.app.pushHistoryState('History Brush Stroke');
        break;

      case 'mixer-brush':
        if (this.mixerEngine) {
          const hex = this.app.colorPicker.getFgHex ? this.app.colorPicker.getFgHex() : '#ffffff';
          this.mixerEngine.endStroke(hex);
        }
        this.app.pushHistoryState('Mixer Brush Stroke');
        break;

      case 'patch':
        this.handlePatchPointerUp(coords.x, coords.y);
        break;

      case 'content-aware-move':
        this.handleCAMovePointerUp(coords.x, coords.y);
        break;

      case 'clone-stamp':
        this.clearOverlay();
        this.app.pushHistoryState('Clone Stamp');
        break;

      case 'dodge':
        this.app.pushHistoryState('Dodge Stroke');
        break;
      case 'burn':
        this.app.pushHistoryState('Burn Stroke');
        break;
      case 'sponge':
        this.app.pushHistoryState('Sponge Stroke');
        break;
      case 'tool-blur':
        this.app.pushHistoryState('Blur Stroke');
        break;
      case 'tool-sharpen':
        this.app.pushHistoryState('Sharpen Stroke');
        break;
      case 'smudge':
        this.smudgeColor = null;
        this.app.pushHistoryState('Smudge Stroke');
        break;
      case 'spot-healing':
        this.app.pushHistoryState('Spot Healing');
        break;

      case 'gradient':
        if (this.gradientStart) {
          this.commitGradient(activeLayer, coords.x, coords.y);
          this.gradientStart = null;
          this.clearOverlay();
          this.app.renderComposite();
          this.app.pushHistoryState('Gradient Fill');
        }
        break;

      case 'move':
        if (this.moveSources) {
          this.moveSources = null;
          this.app.pushHistoryState('Move Layers');
        }
        break;

      case 'select-rect':
      case 'select-ellipse':
        this.finalizeSelection(coords.x, coords.y);
        break;

      case 'select-object':
        this.finalizeObjectSelection(coords.x, coords.y);
        break;

      case 'lasso-freehand':
        this.closeFreehandLasso();
        break;

      case 'shape-rect':
      case 'shape-rounded-rect':
      case 'shape-ellipse':
      case 'shape-polygon':
      case 'shape-star':
      case 'shape-line':
        this.commitShape(activeLayer, coords.x, coords.y);
        this.clearOverlay();
        this.app.renderComposite();
        break;

      case 'crop':
        this.finalizeCrop(coords.x, coords.y);
        break;

      case 'hand':
        this.updateCursor();
        break;
    }
  }

  // ── Painting Engine with Stylus Pressure & Lock Alpha ──
  drawStroke(layer, x1, y1, x2, y2, pressure = 1.0) {
    if (this.app.quickMaskEngine && this.app.quickMaskEngine.active) {
      let effectiveSize = this.brushSize;
      if (this.usePressure) effectiveSize = Math.max(1, this.brushSize * (0.25 + 0.75 * pressure));
      const fgHex = this.app.colorPicker.getFgHex ? this.app.colorPicker.getFgHex() : '#000000';
      const isWhite = fgHex.toLowerCase() === '#ffffff' || this.currentTool === 'eraser';
      const val = isWhite ? 0 : 255;
      const opacity = Math.min(1.0, (this.brushOpacity / 100) * ((this.brushFlow || 100) / 100));

      const distance = Utils.dist(x1, y1, x2, y2);
      const step = Math.max(1, effectiveSize * 0.25);
      const steps = Math.ceil(distance / step);
      for (let i = 0; i <= steps; i++) {
        const t = steps === 0 ? 0 : i / steps;
        const x = Utils.lerp(x1, x2, t);
        const y = Utils.lerp(y1, y2, t);
        this.app.quickMaskEngine.paint(x, y, effectiveSize / 2, this.brushHardness, val, opacity);
      }
      this.app.renderComposite();
      return;
    }

    const ctx = this.app.layerManager.getActiveDrawCtx();
    if (!ctx) return;

    ctx.save();

    // Respect Selection Bounds
    if (this.selection) {
      ctx.beginPath();
      if (this.selection.type === 'ellipse') {
        ctx.ellipse(
          this.selection.x + this.selection.w / 2,
          this.selection.y + this.selection.h / 2,
          this.selection.w / 2,
          this.selection.h / 2,
          0, 0, Math.PI * 2
        );
      } else {
        ctx.rect(this.selection.x, this.selection.y, this.selection.w, this.selection.h);
      }
      ctx.clip();
    }

    let effectiveSize = this.brushSize;
    let effectiveOpacity = this.brushOpacity;

    if (this.usePressure) {
      effectiveSize = Math.max(1, this.brushSize * (0.25 + 0.75 * pressure));
      effectiveOpacity = Math.max(5, this.brushOpacity * (0.35 + 0.65 * pressure));
    }

    const active = this.app.layerManager.getActiveLayer();

    // If lockAlpha is enabled on layer, lock transparency!
    if (active && active.lockAlpha && !active.isMaskActive) {
      ctx.globalCompositeOperation = 'source-atop';
    } else if (this.currentTool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
    } else {
      ctx.globalCompositeOperation = 'source-over';
    }

    // Brush Flow & Opacity
    const flowMult = Math.max(0.01, Math.min(1.0, (this.brushFlow !== undefined ? this.brushFlow : 100) / 100));
    ctx.globalAlpha = (effectiveOpacity / 100) * flowMult;

    let fg = this.app.colorPicker.getFgCss();

    if (this.currentTool === 'mixer-brush') {
      if (!this.mixerEngine) {
        this.mixerEngine = (typeof MixerBrushEngine !== 'undefined') ? new MixerBrushEngine() : null;
      }
      if (this.mixerEngine) {
        this.mixerEngine.wet = this.mixerWet !== undefined ? this.mixerWet : 50;
        this.mixerEngine.load = this.mixerLoad !== undefined ? this.mixerLoad : 75;
        this.mixerEngine.mix = this.mixerMix !== undefined ? this.mixerMix : 60;
        this.mixerEngine.cleanBrush = !!this.mixerCleanBrush;
        this.mixerEngine.loadBrush = !!this.mixerLoadBrush;
        if (!this.mixerEngine.reservoir) {
          const hex = this.app.colorPicker.getFgHex ? this.app.colorPicker.getFgHex() : fg;
          this.mixerEngine.initializeReservoir(hex);
        }
      }
    }

    const distance = Utils.dist(x1, y1, x2, y2);
    // Brush Spacing factor relative to diameter
    const spacingFactor = Math.max(0.05, Math.min(2.0, (this.brushSpacing !== undefined ? this.brushSpacing : 25) / 100));
    const step = Math.max(1, effectiveSize * spacingFactor);
    const steps = Math.ceil(distance / step);
    const strokeAngle = Math.atan2(y2 - y1, x2 - x1);

    for (let i = 0; i <= steps; i++) {
      const t = steps === 0 ? 0 : i / steps;
      let x = Utils.lerp(x1, x2, t);
      let y = Utils.lerp(y1, y2, t);

      // Mixer Brush sampling & physical pigment blend
      if (this.currentTool === 'mixer-brush' && this.mixerEngine) {
        const patchRad = Math.max(1, Math.round(effectiveSize / 8));
        const sampled = this.mixerEngine.sampleCanvasPatch(ctx, x, y, patchRad);
        const dabColor = this.mixerEngine.blendDab(sampled);
        fg = dabColor.css;
      }

      // Procedural Texture / Dual Brush Modulation
      let dabTextureMod = 1.0;
      if (this.brushTexture && this.brushTexture !== 'none' && this.brushTextureDepth > 0) {
        if (typeof TextureStampEngine !== 'undefined') {
          dabTextureMod = TextureStampEngine.getModulation(x, y, this.brushTexture, this.brushTextureScale || 100, this.brushTextureDepth);
        }
      }
      ctx.globalAlpha = (effectiveOpacity / 100) * flowMult * dabTextureMod;

      // ── Dynamics: Size Jitter ──
      let dabSize = effectiveSize;
      if (this.brushSizeJitter > 0) {
        const sRand = 1 - Math.random() * (this.brushSizeJitter / 100) * 0.75;
        dabSize = Math.max(1, effectiveSize * sRand);
      }

      // ── Dynamics: Scatter ──
      if (this.brushScatter > 0) {
        const scatterDist = (Math.random() - 0.5) * 2 * (this.brushScatter / 100) * effectiveSize * 1.5;
        const perpAngle = strokeAngle + Math.PI / 2;
        x += Math.cos(perpAngle) * scatterDist;
        y += Math.sin(perpAngle) * scatterDist;
      }

      // ── Dynamics: Angle Jitter ──
      let dabAngle = strokeAngle;
      if (this.brushAngleJitter > 0) {
        dabAngle += (Math.random() - 0.5) * 2 * Math.PI * (this.brushAngleJitter / 100);
      }

      if (this.currentTool === 'pencil') {
        ctx.fillStyle = fg;
        ctx.fillRect(Math.round(x - dabSize / 2), Math.round(y - dabSize / 2), dabSize, dabSize);
        continue;
      }

      const r = dabSize / 2;
      const tip = this.brushTip || 'round';

      if (tip === 'chisel') {
        // Calligraphy chisel tip (flat angle stamp)
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(dabAngle);
        ctx.scale(1, 0.35);
        ctx.fillStyle = fg;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (tip === 'bristle') {
        // Natural multi-bristle hair dab
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(dabAngle);
        const bristleCount = 8;
        const bRad = Math.max(1, r / 4);
        ctx.fillStyle = fg;
        for (let b = 0; b < bristleCount; b++) {
          const bx = (b / (bristleCount - 1) - 0.5) * dabSize * 0.9;
          const by = (Math.random() - 0.5) * bRad * 1.5;
          ctx.beginPath();
          ctx.arc(bx, by, bRad, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      } else if (tip === 'splatter') {
        // Splatter / grunge droplet tip
        ctx.fillStyle = fg;
        ctx.beginPath();
        ctx.arc(x, y, r * 0.5, 0, Math.PI * 2);
        ctx.fill();
        const dropCount = 6;
        for (let s = 0; s < dropCount; s++) {
          const sDist = r * (0.6 + Math.random() * 1.2);
          const sAngle = Math.random() * Math.PI * 2;
          const sRad = Math.max(0.75, r * (0.1 + Math.random() * 0.2));
          ctx.beginPath();
          ctx.arc(x + Math.cos(sAngle) * sDist, y + Math.sin(sAngle) * sDist, sRad, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (tip === 'airbrush') {
        // Ultra-soft airbrush with wide gaussian falloff
        const grad = ctx.createRadialGradient(x, y, 0, x, y, r * 1.4);
        if (this.currentTool === 'eraser') {
          grad.addColorStop(0, 'rgba(0,0,0,0.8)');
          grad.addColorStop(0.5, 'rgba(0,0,0,0.3)');
          grad.addColorStop(1, 'rgba(0,0,0,0)');
        } else {
          grad.addColorStop(0, fg);
          grad.addColorStop(0.5, fg.replace('rgb', 'rgba').replace(')', ', 0.35)'));
          grad.addColorStop(1, fg.replace('rgb', 'rgba').replace(')', ', 0)'));
        }
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, r * 1.4, 0, Math.PI * 2);
        ctx.fill();
      } else if (tip === 'soft-round') {
        // Smooth soft round brush
        const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
        if (this.currentTool === 'eraser') {
          grad.addColorStop(0, 'rgba(0,0,0,1)');
          grad.addColorStop(1, 'rgba(0,0,0,0)');
        } else {
          grad.addColorStop(0, fg);
          grad.addColorStop(1, fg.replace('rgb', 'rgba').replace(')', ', 0)'));
        }
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Standard round brush with adjustable hardness
        const innerR = r * (this.brushHardness / 100);
        const grad = ctx.createRadialGradient(x, y, innerR, x, y, r);
        if (this.currentTool === 'eraser') {
          grad.addColorStop(0, 'rgba(0,0,0,1)');
          grad.addColorStop(1, 'rgba(0,0,0,0)');
        } else {
          grad.addColorStop(0, fg);
          grad.addColorStop(1, fg.replace('rgb', 'rgba').replace(')', ', 0)'));
        }
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  // ── Clone Stamp Engine ──
  applyCloneStamp(layer, x1, y1, x2, y2) {
    if (!this.cloneSource || !this.cloneOffset) return;
    const ctx = this.app.layerManager.getActiveDrawCtx();
    if (!ctx) return;

    const size = this.cloneSize;
    const r = size / 2;
    const distance = Utils.dist(x1, y1, x2, y2);
    const step = Math.max(2, size / 4);
    const steps = Math.ceil(distance / step);

    // Temp buffer for clone stamp radial transfer
    if (!this.cloneStampBuffer) {
      this.cloneStampBuffer = Utils.createCanvas(300, 300);
      this.cloneStampBufCtx = this.cloneStampBuffer.getContext('2d');
    }

    const csm = this.app.cloneSourceManager;
    const preset = csm ? csm.getActivePreset() : null;
    const hasTransform = preset && (preset.angle !== 0 || preset.scaleX !== 100 || preset.scaleY !== 100 || preset.flipH || preset.flipV);

    for (let i = 0; i <= steps; i++) {
      const t = steps === 0 ? 0 : i / steps;
      const currX = Utils.lerp(x1, x2, t);
      const currY = Utils.lerp(y1, y2, t);

      let srcX = currX + this.cloneOffset.dx;
      let srcY = currY + this.cloneOffset.dy;

      if (hasTransform && this.cloneAnchorDest) {
        const pt = csm.getTransformedSamplePoint(currX, currY, this.cloneAnchorDest.x, this.cloneAnchorDest.y);
        if (pt) {
          srcX = pt.x;
          srcY = pt.y;
        }
      }

      // Prepare soft circular stamp
      this.cloneStampBufCtx.clearRect(0, 0, size, size);
      this.cloneStampBufCtx.save();
      this.cloneStampBufCtx.translate(r, r);
      if (hasTransform) {
        this.cloneStampBufCtx.rotate((preset.angle * Math.PI) / 180);
        this.cloneStampBufCtx.scale(
          (preset.scaleX / 100) * (preset.flipH ? -1 : 1),
          (preset.scaleY / 100) * (preset.flipV ? -1 : 1)
        );
      }
      this.cloneStampBufCtx.drawImage(
        layer.canvas,
        srcX - r, srcY - r, size, size,
        -r, -r, size, size
      );
      this.cloneStampBufCtx.restore();

      this.cloneStampBufCtx.save();
      this.cloneStampBufCtx.globalCompositeOperation = 'destination-in';
      const grad = this.cloneStampBufCtx.createRadialGradient(r, r, r * (this.cloneHardness / 100), r, r, r);
      grad.addColorStop(0, 'rgba(0,0,0,1)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      this.cloneStampBufCtx.fillStyle = grad;
      this.cloneStampBufCtx.fillRect(0, 0, size, size);
      this.cloneStampBufCtx.restore();

      ctx.save();
      if (layer.lockAlpha) ctx.globalCompositeOperation = 'source-atop';
      ctx.globalAlpha = this.cloneOpacity / 100;
      ctx.drawImage(this.cloneStampBuffer, 0, 0, size, size, currX - r, currY - r, size, size);
      ctx.restore();

      // Show source crosshair indicator on overlay
      this.renderCloneCrosshair(srcX, srcY);
    }
  }

  renderCloneCrosshair(x, y) {
    this.clearOverlay();
    const ctx = this.app.overlayCtx;
    ctx.save();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 3;

    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.moveTo(x - 10, y); ctx.lineTo(x + 10, y);
    ctx.moveTo(x, y - 10); ctx.lineTo(x, y + 10);
    ctx.stroke();

    ctx.restore();
  }

  // ── History Brush & Art History Engine ──
  applyHistoryBrush(layer, x1, y1, x2, y2) {
    const ctx = this.app.layerManager.getActiveDrawCtx();
    if (!ctx || !this.app.historyBrushEngine) return;

    const size = this.brushSize || 30;
    const hardness = (this.brushHardness !== undefined ? this.brushHardness : 80) / 100;
    const opacity = (this.brushOpacity !== undefined ? this.brushOpacity : 100) / 100;
    const flow = (this.brushFlow !== undefined ? this.brushFlow : 100) / 100;
    const dist = Utils.dist(x1, y1, x2, y2);
    const stepDist = Math.max(2, size / 4);
    const steps = Math.ceil(dist / stepDist);

    for (let s = 0; s <= steps; s++) {
      const t = steps === 0 ? 0 : s / steps;
      const cx = Utils.lerp(x1, x2, t);
      const cy = Utils.lerp(y1, y2, t);

      if (this.app.historyBrushEngine.style && this.app.historyBrushEngine.style !== 'standard') {
        this.app.historyBrushEngine.paintArtStroke(ctx, cx, cy, size, this.app.historyBrushEngine.style, opacity);
      } else {
        this.app.historyBrushEngine.paintStroke(ctx, cx, cy, size, hardness, opacity, flow);
      }
    }
  }

  // ── Dodge & Burn Engine ──
  applyDodgeBurn(layer, x1, y1, x2, y2, isDodge = true) {
    const ctx = this.app.layerManager.getActiveDrawCtx();
    if (!ctx) return;

    const r = Math.max(3, Math.round(this.dodgeBurnSize / 2));
    const dist = Utils.dist(x1, y1, x2, y2);
    const steps = Math.ceil(dist / Math.max(2, r / 3));

    for (let s = 0; s <= steps; s++) {
      const t = steps === 0 ? 0 : s / steps;
      const cx = Math.round(Utils.lerp(x1, x2, t));
      const cy = Math.round(Utils.lerp(y1, y2, t));

      const x = Math.max(0, cx - r);
      const y = Math.max(0, cy - r);
      const w = Math.min(this.app.width - x, r * 2);
      const h = Math.min(this.app.height - y, r * 2);
      if (w <= 0 || h <= 0) continue;

      const imgData = ctx.getImageData(x, y, w, h);
      const d = imgData.data;

      for (let py = 0; py < h; py++) {
        for (let px = 0; px < w; px++) {
          const idx = (py * w + px) * 4;
          if (d[idx + 3] === 0) continue;

          const pDist = Math.hypot(x + px - cx, y + py - cy);
          if (pDist > r) continue;

          const falloff = Math.cos((pDist / r) * (Math.PI / 2));
          const lum = 0.299 * d[idx] + 0.587 * d[idx + 1] + 0.114 * d[idx + 2];

          let weight = 1;
          if (this.dodgeBurnRange === 'shadows') {
            weight = Math.max(0, 1 - (lum / 128));
          } else if (this.dodgeBurnRange === 'highlights') {
            weight = Math.max(0, (lum - 128) / 127);
          } else {
            weight = Math.max(0, 1 - Math.abs(lum - 128) / 128);
          }

          const delta = (this.dodgeBurnExposure / 100) * falloff * weight * (isDodge ? 20 : -20);
          d[idx]     = Utils.clamp(Math.round(d[idx] + delta), 0, 255);
          d[idx + 1] = Utils.clamp(Math.round(d[idx + 1] + delta), 0, 255);
          d[idx + 2] = Utils.clamp(Math.round(d[idx + 2] + delta), 0, 255);
        }
      }
      ctx.putImageData(imgData, x, y);
    }
  }

  // ── Sponge Tool (Saturate / Desaturate) ──
  applySponge(layer, x1, y1, x2, y2) {
    const ctx = this.app.layerManager.getActiveDrawCtx();
    if (!ctx) return;

    const r = Math.max(3, Math.round(this.spongeSize / 2));
    const dist = Utils.dist(x1, y1, x2, y2);
    const steps = Math.ceil(dist / Math.max(2, r / 3));

    for (let s = 0; s <= steps; s++) {
      const t = steps === 0 ? 0 : s / steps;
      const cx = Math.round(Utils.lerp(x1, x2, t));
      const cy = Math.round(Utils.lerp(y1, y2, t));

      const x = Math.max(0, cx - r);
      const y = Math.max(0, cy - r);
      const w = Math.min(this.app.width - x, r * 2);
      const h = Math.min(this.app.height - y, r * 2);
      if (w <= 0 || h <= 0) continue;

      const imgData = ctx.getImageData(x, y, w, h);
      const d = imgData.data;

      for (let py = 0; py < h; py++) {
        for (let px = 0; px < w; px++) {
          const idx = (py * w + px) * 4;
          if (d[idx + 3] === 0) continue;

          const pDist = Math.hypot(x + px - cx, y + py - cy);
          if (pDist > r) continue;

          const falloff = Math.cos((pDist / r) * (Math.PI / 2));
          const hsl = Utils.rgbToHsl(d[idx], d[idx + 1], d[idx + 2]);
          const delta = (this.spongeMode === 'saturate' ? 1 : -1) * (this.spongeFlow / 100) * falloff * 15;
          hsl.s = Utils.clamp(hsl.s + delta, 0, 100);

          const rgb = Utils.hslToRgb(hsl.h, hsl.s, hsl.l);
          d[idx]     = rgb.r;
          d[idx + 1] = rgb.g;
          d[idx + 2] = rgb.b;
        }
      }
      ctx.putImageData(imgData, x, y);
    }
  }

  // ── Local Blur & Sharpen Brush ──
  applyBlurSharpen(layer, x1, y1, x2, y2, isBlur = true) {
    const ctx = this.app.layerManager.getActiveDrawCtx();
    if (!ctx) return;

    const r = Math.max(4, Math.round(this.blurSharpenSize / 2));
    const dist = Utils.dist(x1, y1, x2, y2);
    const steps = Math.ceil(dist / Math.max(2, r / 3));

    for (let s = 0; s <= steps; s++) {
      const t = steps === 0 ? 0 : s / steps;
      const cx = Math.round(Utils.lerp(x1, x2, t));
      const cy = Math.round(Utils.lerp(y1, y2, t));

      const x = Math.max(1, cx - r);
      const y = Math.max(1, cy - r);
      const w = Math.min(this.app.width - x - 1, r * 2);
      const h = Math.min(this.app.height - y - 1, r * 2);
      if (w <= 2 || h <= 2) continue;

      const imgData = ctx.getImageData(x, y, w, h);
      const d = imgData.data;
      const srcCopy = new Uint8ClampedArray(d);

      const strength = (this.blurSharpenStrength / 100);

      for (let py = 1; py < h - 1; py++) {
        for (let px = 1; px < w - 1; px++) {
          const idx = (py * w + px) * 4;
          if (srcCopy[idx + 3] === 0) continue;

          const pDist = Math.hypot(x + px - cx, y + py - cy);
          if (pDist > r) continue;

          const falloff = Math.cos((pDist / r) * (Math.PI / 2)) * strength;

          if (isBlur) {
            // 3x3 box blur average
            let tr = 0, tg = 0, tb = 0, count = 0;
            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                const nIdx = ((py + dy) * w + (px + dx)) * 4;
                tr += srcCopy[nIdx];
                tg += srcCopy[nIdx + 1];
                tb += srcCopy[nIdx + 2];
                count++;
              }
            }
            d[idx]     = Utils.clamp(Math.round(Utils.lerp(srcCopy[idx], tr / count, falloff)), 0, 255);
            d[idx + 1] = Utils.clamp(Math.round(Utils.lerp(srcCopy[idx + 1], tg / count, falloff)), 0, 255);
            d[idx + 2] = Utils.clamp(Math.round(Utils.lerp(srcCopy[idx + 2], tb / count, falloff)), 0, 255);
          } else {
            // Sharpen kernel
            const a = 0.5 * falloff;
            const topIdx = ((py - 1) * w + px) * 4;
            const botIdx = ((py + 1) * w + px) * 4;
            const lftIdx = (py * w + (px - 1)) * 4;
            const rgtIdx = (py * w + (px + 1)) * 4;

            const sr = (1 + 4 * a) * srcCopy[idx] - a * (srcCopy[topIdx] + srcCopy[botIdx] + srcCopy[lftIdx] + srcCopy[rgtIdx]);
            const sg = (1 + 4 * a) * srcCopy[idx + 1] - a * (srcCopy[topIdx + 1] + srcCopy[botIdx + 1] + srcCopy[lftIdx + 1] + srcCopy[rgtIdx + 1]);
            const sb = (1 + 4 * a) * srcCopy[idx + 2] - a * (srcCopy[topIdx + 2] + srcCopy[botIdx + 2] + srcCopy[lftIdx + 2] + srcCopy[rgtIdx + 2]);

            d[idx]     = Utils.clamp(Math.round(sr), 0, 255);
            d[idx + 1] = Utils.clamp(Math.round(sg), 0, 255);
            d[idx + 2] = Utils.clamp(Math.round(sb), 0, 255);
          }
        }
      }
      ctx.putImageData(imgData, x, y);
    }
  }

  // ── Smudge Tool ──
  startSmudge(layer, x, y) {
    const ctx = this.app.layerManager.getActiveDrawCtx();
    if (!ctx) return;
    const px = Utils.clamp(Math.round(x), 0, this.app.width - 1);
    const py = Utils.clamp(Math.round(y), 0, this.app.height - 1);
    const data = ctx.getImageData(px, py, 1, 1).data;
    this.smudgeColor = { r: data[0], g: data[1], b: data[2], a: data[3] };
  }

  applySmudge(layer, x, y) {
    if (!this.smudgeColor || this.smudgeColor.a === 0) return;
    const ctx = this.app.layerManager.getActiveDrawCtx();
    if (!ctx) return;

    const r = Math.max(3, Math.round(this.blurSharpenSize / 2));
    const strength = (this.blurSharpenStrength / 100) * 0.45;

    ctx.save();
    if (layer.lockAlpha) ctx.globalCompositeOperation = 'source-atop';
    ctx.globalAlpha = strength;

    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `rgb(${this.smudgeColor.r}, ${this.smudgeColor.g}, ${this.smudgeColor.b})`);
    grad.addColorStop(1, `rgba(${this.smudgeColor.r}, ${this.smudgeColor.g}, ${this.smudgeColor.b}, 0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Sample new color and blend
    const px = Utils.clamp(Math.round(x), 0, this.app.width - 1);
    const py = Utils.clamp(Math.round(y), 0, this.app.height - 1);
    const data = ctx.getImageData(px, py, 1, 1).data;
    if (data[3] > 0) {
      this.smudgeColor.r = Math.round(Utils.lerp(this.smudgeColor.r, data[0], 0.3));
      this.smudgeColor.g = Math.round(Utils.lerp(this.smudgeColor.g, data[1], 0.3));
      this.smudgeColor.b = Math.round(Utils.lerp(this.smudgeColor.b, data[2], 0.3));
    }
  }

  // ── Spot Healing Brush Tool ──
  applySpotHealing(layer, x, y) {
    const ctx = this.app.layerManager.getActiveDrawCtx();
    if (!ctx) return;

    const r = Math.max(4, Math.round(this.healingSize / 2));
    const cx = Math.round(x);
    const cy = Math.round(y);

    const minX = Math.max(0, cx - r - 6);
    const minY = Math.max(0, cy - r - 6);
    const maxX = Math.min(this.app.width - 1, cx + r + 6);
    const maxY = Math.min(this.app.height - 1, cy + r + 6);
    const w = maxX - minX + 1;
    const h = maxY - minY + 1;
    if (w <= 0 || h <= 0) return;

    const imgData = ctx.getImageData(minX, minY, w, h);
    const d = imgData.data;

    // Collect perimeter ring pixels
    const ringPixels = [];
    const innerR = r * 0.9;
    const outerR = r * 1.35;

    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const pDist = Math.hypot(minX + px - cx, minY + py - cy);
        if (pDist >= innerR && pDist <= outerR) {
          const idx = (py * w + px) * 4;
          if (d[idx + 3] > 10) {
            ringPixels.push({
              x: minX + px,
              y: minY + py,
              r: d[idx],
              g: d[idx + 1],
              b: d[idx + 2],
              a: d[idx + 3]
            });
          }
        }
      }
    }

    if (ringPixels.length === 0) return;

    // Inverse distance weighting interpolation for interior blemish
    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const realX = minX + px;
        const realY = minY + py;
        const pDist = Math.hypot(realX - cx, realY - cy);
        if (pDist < r) {
          const idx = (py * w + px) * 4;
          let weightSum = 0;
          let sumR = 0, sumG = 0, sumB = 0;

          // Pick sampled ring points
          const step = Math.max(1, Math.floor(ringPixels.length / 24));
          for (let k = 0; k < ringPixels.length; k += step) {
            const sample = ringPixels[k];
            const dSq = (realX - sample.x) ** 2 + (realY - sample.y) ** 2;
            const wVal = 1 / Math.max(1, dSq);
            sumR += sample.r * wVal;
            sumG += sample.g * wVal;
            sumB += sample.b * wVal;
            weightSum += wVal;
          }

          if (weightSum > 0) {
            const blend = 1 - (pDist / r);
            d[idx]     = Utils.clamp(Math.round(Utils.lerp(d[idx], sumR / weightSum, blend)), 0, 255);
            d[idx + 1] = Utils.clamp(Math.round(Utils.lerp(d[idx + 1], sumG / weightSum, blend)), 0, 255);
            d[idx + 2] = Utils.clamp(Math.round(Utils.lerp(d[idx + 2], sumB / weightSum, blend)), 0, 255);
          }
        }
      }
    }

    ctx.putImageData(imgData, minX, minY);
  }

  // ── Gradient Tool ──
  renderGradientPreview(curX, curY) {
    this.clearOverlay();
    if (!this.gradientStart) return;
    const ctx = this.app.overlayCtx;

    ctx.save();
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);

    ctx.beginPath();
    ctx.moveTo(this.gradientStart.x, this.gradientStart.y);
    ctx.lineTo(curX, curY);
    ctx.stroke();

    // Start point dot
    ctx.fillStyle = '#3b82f6';
    ctx.beginPath();
    ctx.arc(this.gradientStart.x, this.gradientStart.y, 4, 0, Math.PI * 2);
    ctx.fill();

    // End point arrow
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(curX, curY, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  commitGradient(layer, x2, y2) {
    if (!this.gradientStart) return;
    const ctx = this.app.layerManager.getActiveDrawCtx();
    if (!ctx) return;

    const x1 = this.gradientStart.x;
    const y1 = this.gradientStart.y;
    const dist = Utils.dist(x1, y1, x2, y2);

    ctx.save();

    if (this.selection) {
      ctx.beginPath();
      if (this.selection.type === 'rect') {
        ctx.rect(this.selection.x, this.selection.y, this.selection.w, this.selection.h);
      } else {
        ctx.ellipse(
          this.selection.x + this.selection.w / 2,
          this.selection.y + this.selection.h / 2,
          this.selection.w / 2,
          this.selection.h / 2,
          0, 0, Math.PI * 2
        );
      }
      ctx.clip();
    }

    if (!this.currentGradient && typeof GradientData !== 'undefined') {
      const fg = this.app.colorPicker ? this.app.colorPicker.getFgHex() : '#000000';
      const bg = this.app.colorPicker ? this.app.colorPicker.getBgHex() : '#ffffff';
      this.currentGradient = GradientData.getPreset(this.gradientPreset || 'rainbow', fg, bg);
    }

    if (this.currentGradient && typeof this.currentGradient.renderToCanvas === 'function') {
      this.currentGradient.style = this.gradientStyle || 'linear';
      this.currentGradient.reverse = !!this.gradientReverse;
      this.currentGradient.dither = this.gradientDither !== false;
      this.currentGradient.renderToCanvas(ctx, x1, y1, x2, y2, this.app.width, this.app.height, this.selection);
      ctx.restore();
      return;
    }

    let grad;
    if (this.gradientStyle === 'radial') {
      grad = ctx.createRadialGradient(x1, y1, 0, x1, y1, Math.max(1, dist));
    } else {
      grad = ctx.createLinearGradient(x1, y1, x2, y2);
    }

    const fg = this.app.colorPicker.getFgCss();
    const bg = this.app.colorPicker.getBgCss();

    if (this.gradientPreset === 'fg-trans') {
      grad.addColorStop(0, fg);
      grad.addColorStop(1, fg.replace('rgb', 'rgba').replace(')', ', 0)'));
    } else if (this.gradientPreset === 'rainbow') {
      grad.addColorStop(0, 'red');
      grad.addColorStop(0.17, 'orange');
      grad.addColorStop(0.33, 'yellow');
      grad.addColorStop(0.5, 'green');
      grad.addColorStop(0.67, 'blue');
      grad.addColorStop(0.83, 'indigo');
      grad.addColorStop(1, 'violet');
    } else {
      grad.addColorStop(0, fg);
      grad.addColorStop(1, bg);
    }

    if (layer.lockAlpha) ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.app.width, this.app.height);
    ctx.restore();
  }

  // ── Magic Wand Auto-Selection Tool ──
  applyMagicWand(x, y) {
    const active = this.app.layerManager.getActiveLayer();
    if (!active) return;

    const res = Utils.magicWandSelect(active.ctx, x, y, this.wandTolerance, this.wandContiguous);
    if (!res) {
      this.clearSelection();
      return;
    }

    this.selection = {
      type: 'rect',
      x: res.bbox.minX,
      y: res.bbox.minY,
      w: res.bbox.maxX - res.bbox.minX + 1,
      h: res.bbox.maxY - res.bbox.minY + 1,
      mask: res.mask
    };

    this.renderMarchingAnts();
    this.app.pushHistoryState('Magic Wand Selection');
  }

  rasterizePolygonToMask(points) {
    const w = this.app.width;
    const h = this.app.height;
    const tempCanvas = Utils.createCanvas(w, h);
    const tCtx = tempCanvas.getContext('2d');

    tCtx.fillStyle = '#ffffff';
    tCtx.beginPath();
    tCtx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      tCtx.lineTo(points[i].x, points[i].y);
    }
    tCtx.closePath();
    tCtx.fill();

    const imgData = tCtx.getImageData(0, 0, w, h);
    const data = imgData.data;
    const mask = new Uint8Array(w * h);
    let minX = w, minY = h, maxX = -1, maxY = -1;

    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
      if (data[i + 3] > 128) {
        mask[j] = 255;
        const px = j % w;
        const py = Math.floor(j / w);
        if (px < minX) minX = px;
        if (px > maxX) maxX = px;
        if (py < minY) minY = py;
        if (py > maxY) maxY = py;
      }
    }

    if (maxX === -1) return null;

    return {
      x: minX,
      y: minY,
      w: Math.max(1, maxX - minX + 1),
      h: Math.max(1, maxY - minY + 1),
      mask
    };
  }

  // ── Freehand Lasso Tool ──
  renderFreehandLassoOverlay() {
    this.clearOverlay();
    const ctx = this.app.overlayCtx;
    if (!ctx || this.lassoPoints.length === 0) return;

    ctx.save();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);

    ctx.beginPath();
    ctx.moveTo(this.lassoPoints[0].x, this.lassoPoints[0].y);
    for (let i = 1; i < this.lassoPoints.length; i++) {
      ctx.lineTo(this.lassoPoints[i].x, this.lassoPoints[i].y);
    }
    ctx.stroke();
    ctx.restore();
  }

  closeFreehandLasso() {
    if (this.lassoPoints.length < 3) {
      this.lassoPoints = [];
      this.clearOverlay();
      return;
    }

    const res = this.rasterizePolygonToMask(this.lassoPoints);
    if (!res) {
      this.lassoPoints = [];
      this.clearOverlay();
      return;
    }

    this.selection = {
      type: 'path',
      contour: [...this.lassoPoints],
      x: res.x,
      y: res.y,
      w: res.w,
      h: res.h,
      mask: res.mask
    };

    this.lassoPoints = [];
    this.renderMarchingAnts();
    this.app.pushHistoryState('Lasso Selection');
  }

  // ── Polygonal Lasso Tool ──
  handlePolygonalMouseDown(x, y) {
    const pt = { x: Math.round(x), y: Math.round(y) };
    if (!this.polyLassoActive) {
      this.polyLassoActive = true;
      this.polyLassoPoints = [pt];
    } else {
      // Check if clicking near start point (within 12px) to close contour
      const startPt = this.polyLassoPoints[0];
      if (this.polyLassoPoints.length >= 3 && Math.hypot(pt.x - startPt.x, pt.y - startPt.y) <= 12) {
        this.closePolygonalLasso();
        return;
      }
      this.polyLassoPoints.push(pt);
    }
    this.renderPolygonalOverlay(pt);
  }

  renderPolygonalOverlay(currentCursor) {
    this.clearOverlay();
    const ctx = this.app.overlayCtx;
    if (!ctx || this.polyLassoPoints.length === 0) return;

    ctx.save();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);

    ctx.beginPath();
    ctx.moveTo(this.polyLassoPoints[0].x, this.polyLassoPoints[0].y);
    for (let i = 1; i < this.polyLassoPoints.length; i++) {
      ctx.lineTo(this.polyLassoPoints[i].x, this.polyLassoPoints[i].y);
    }
    if (currentCursor) {
      ctx.lineTo(currentCursor.x, currentCursor.y);
    }
    ctx.stroke();

    // Render vertex anchor squares
    ctx.setLineDash([]);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < this.polyLassoPoints.length; i++) {
      const p = this.polyLassoPoints[i];
      const sz = i === 0 ? 8 : 6;
      ctx.fillRect(p.x - sz / 2, p.y - sz / 2, sz, sz);
      ctx.strokeRect(p.x - sz / 2, p.y - sz / 2, sz, sz);
    }

    // Origin close circle indicator if near start point
    if (currentCursor && this.polyLassoPoints.length >= 3) {
      const startPt = this.polyLassoPoints[0];
      if (Math.hypot(currentCursor.x - startPt.x, currentCursor.y - startPt.y) <= 12) {
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(startPt.x, startPt.y, 8, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  closePolygonalLasso() {
    if (!this.polyLassoActive || this.polyLassoPoints.length < 3) {
      this.polyLassoActive = false;
      this.polyLassoPoints = [];
      this.clearOverlay();
      return;
    }

    const res = this.rasterizePolygonToMask(this.polyLassoPoints);
    if (!res) {
      this.polyLassoActive = false;
      this.polyLassoPoints = [];
      this.clearOverlay();
      return;
    }

    this.selection = {
      type: 'path',
      contour: [...this.polyLassoPoints],
      x: res.x,
      y: res.y,
      w: res.w,
      h: res.h,
      mask: res.mask
    };

    this.polyLassoActive = false;
    this.polyLassoPoints = [];
    this.renderMarchingAnts();
    this.app.pushHistoryState('Polygonal Lasso Selection');
  }

  // ── Color Range Selection ──
  selectColorRange(targetRgb, fuzziness = 40, invert = false) {
    const active = this.app.layerManager.getActiveLayer();
    if (!active) return null;

    const w = this.app.width;
    const h = this.app.height;
    const imgData = active.ctx.getImageData(0, 0, w, h);
    const data = imgData.data;

    const mask = new Uint8Array(w * h);
    const tr = targetRgb.r;
    const tg = targetRgb.g;
    const tb = targetRgb.b;

    let minX = w, minY = h, maxX = -1, maxY = -1;
    let hitCount = 0;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const a = data[idx + 3];
        if (a === 0 && !invert) continue;

        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];

        // Euclidean color distance in 3D RGB space
        const dist = Math.hypot(r - tr, g - tg, b - tb);
        let matchVal = 0;
        if (dist <= fuzziness) {
          matchVal = Math.round(255 * (1 - dist / (fuzziness + 0.001)));
        }

        if (invert) {
          matchVal = 255 - matchVal;
        }

        if (a < 255) {
          matchVal = Math.round(matchVal * (a / 255));
        }

        mask[y * w + x] = matchVal;

        if (matchVal > 128) {
          hitCount++;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (hitCount === 0 || maxX === -1) {
      this.clearSelection();
      return null;
    }

    this.selection = {
      type: 'path',
      x: minX,
      y: minY,
      w: Math.max(1, maxX - minX + 1),
      h: Math.max(1, maxY - minY + 1),
      mask
    };

    this.renderMarchingAnts();
    this.app.pushHistoryState('Color Range Selection');
    return this.selection;
  }

  // ── Content-Aware Fill ──
  applyContentAwareFill(options = {}) {
    const active = this.app.layerManager.getActiveLayer();
    if (!active) return;
    if (!this.selection) {
      if (typeof alert !== 'undefined') alert("Please create a selection first to use Content-Aware Fill.");
      return;
    }

    const w = this.app.width;
    const h = this.app.height;
    let mask = this.selection.mask;

    if (!mask) {
      mask = new Uint8Array(w * h);
      const s = this.selection;
      if (s.type === 'ellipse') {
        const cx = s.x + s.w / 2;
        const cy = s.y + s.h / 2;
        const rx = s.w / 2;
        const ry = s.h / 2;
        for (let y = Math.max(0, s.y); y < Math.min(h, s.y + s.h); y++) {
          for (let x = Math.max(0, s.x); x < Math.min(w, s.x + s.w); x++) {
            const nx = (x - cx) / rx;
            const ny = (y - cy) / ry;
            if (nx * nx + ny * ny <= 1.0) mask[y * w + x] = 255;
          }
        }
      } else {
        for (let y = Math.max(0, s.y); y < Math.min(h, s.y + s.h); y++) {
          for (let x = Math.max(0, s.x); x < Math.min(w, s.x + s.w); x++) {
            mask[y * w + x] = 255;
          }
        }
      }
    }

    const drawCtx = this.app.layerManager.getActiveDrawCtx();
    if (!drawCtx) return;

    const imgData = drawCtx.getImageData(0, 0, w, h);
    if (typeof Filters !== 'undefined' && Filters.contentAwareFill) {
      const filledData = Filters.contentAwareFill(imgData, mask, options);
      drawCtx.putImageData(filledData, 0, 0);
    }

    this.app.renderComposite();
    this.app.pushHistoryState('Content-Aware Fill');
  }

  // ── Magnetic Lasso Tool (Sobel Edge-Snapping) ──
  handleMagneticMouseDown(x, y) {
    if (!this.magneticLasso) return;
    const snapped = this.magneticLasso.findSnapPoint(x, y);
    const pt = { x: snapped.x, y: snapped.y };

    if (!this.magneticActive) {
      this.magneticActive = true;
      this.magneticPoints = [pt];
    } else {
      // Check if clicking near start point (within 12px) to close contour
      const startPt = this.magneticPoints[0];
      if (this.magneticPoints.length >= 3 && Math.hypot(pt.x - startPt.x, pt.y - startPt.y) < 14) {
        this.closeMagneticLasso();
        return;
      }
      this.magneticPoints.push(pt);
    }
    this.renderMagneticOverlay(pt);
  }

  handleMagneticMouseMove(x, y) {
    if (!this.magneticActive || !this.magneticLasso) return;
    const snapped = this.magneticLasso.findSnapPoint(x, y);
    const lastPt = this.magneticPoints[this.magneticPoints.length - 1];

    // If mouse moved far enough along edge (> 16px), auto-drop edge-snapped intermediate anchor
    const dist = Math.hypot(snapped.x - lastPt.x, snapped.y - lastPt.y);
    if (dist > 18 && snapped.snapped) {
      const intermediate = this.magneticLasso.traceContour(lastPt, snapped, 4);
      intermediate.slice(1).forEach(p => this.magneticPoints.push(p));
    }

    this.renderMagneticOverlay(snapped);
  }

  renderMagneticOverlay(currentCursor) {
    this.clearOverlay();
    const ctx = this.app.overlayCtx;
    if (!ctx || this.magneticPoints.length === 0) return;

    ctx.save();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);

    ctx.beginPath();
    ctx.moveTo(this.magneticPoints[0].x, this.magneticPoints[0].y);
    for (let i = 1; i < this.magneticPoints.length; i++) {
      ctx.lineTo(this.magneticPoints[i].x, this.magneticPoints[i].y);
    }
    if (currentCursor) {
      ctx.lineTo(currentCursor.x, currentCursor.y);
    }
    ctx.stroke();

    // Render anchor squares
    ctx.setLineDash([]);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 1.5;
    for (const p of this.magneticPoints) {
      ctx.fillRect(p.x - 3, p.y - 3, 6, 6);
      ctx.strokeRect(p.x - 3, p.y - 3, 6, 6);
    }
    ctx.restore();
  }

  closeMagneticLasso() {
    if (!this.magneticActive || this.magneticPoints.length < 3) {
      this.magneticActive = false;
      this.magneticPoints = [];
      this.clearOverlay();
      return;
    }

    // Rasterize magnetic path polygon to binary selection mask
    const w = this.app.width;
    const h = this.app.height;
    const tempCanvas = Utils.createCanvas(w, h);
    const tCtx = tempCanvas.getContext('2d');

    tCtx.fillStyle = '#ffffff';
    tCtx.beginPath();
    tCtx.moveTo(this.magneticPoints[0].x, this.magneticPoints[0].y);
    for (let i = 1; i < this.magneticPoints.length; i++) {
      tCtx.lineTo(this.magneticPoints[i].x, this.magneticPoints[i].y);
    }
    tCtx.closePath();
    tCtx.fill();

    const imgData = tCtx.getImageData(0, 0, w, h);
    const data = imgData.data;
    const mask = new Uint8Array(w * h);
    let minX = w, minY = h, maxX = 0, maxY = 0;

    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
      if (data[i + 3] > 128) {
        mask[j] = 255;
        const px = j % w;
        const py = Math.floor(j / w);
        if (px < minX) minX = px;
        if (px > maxX) maxX = px;
        if (py < minY) minY = py;
        if (py > maxY) maxY = py;
      }
    }

    this.selection = {
      type: 'path',
      contour: [...this.magneticPoints],
      x: minX,
      y: minY,
      w: Math.max(1, maxX - minX + 1),
      h: Math.max(1, maxY - minY + 1),
      mask
    };

    this.magneticActive = false;
    this.magneticPoints = [];
    this.renderMarchingAnts();
    this.app.pushHistoryState('Magnetic Lasso Selection');
  }

  // ── One-Click Dominant Subject Detection (AI Saliency) ──
  selectSubject() {
    const active = this.app.layerManager.getActiveLayer();
    if (!active) return;

    if (typeof SmartSubjectDetection === 'undefined') return;
    const res = SmartSubjectDetection.detectSubject(active.ctx, this.app.width, this.app.height);
    if (!res || res.selectedCount === 0) return;

    this.selection = {
      type: 'path',
      x: res.bounds.x,
      y: res.bounds.y,
      w: res.bounds.width,
      h: res.bounds.height,
      mask: res.mask
    };

    this.renderMarchingAnts();
    this.app.pushHistoryState('Select Subject');
  }

  // ── Select and Mask / Refine Edge Engine ──
  openRefineEdgeModal() {
    const modal = document.getElementById('modal-refine-edge');
    if (!modal) return;

    let baseMask = null;
    const w = this.app.width;
    const h = this.app.height;

    if (this.selection && this.selection.mask) {
      baseMask = new Uint8Array(this.selection.mask);
    } else if (this.selection) {
      baseMask = new Uint8Array(w * h);
      const sel = this.selection;
      if (sel.type === 'ellipse') {
        const cx = sel.x + sel.w / 2;
        const cy = sel.y + sel.h / 2;
        const rx = sel.w / 2;
        const ry = sel.h / 2;
        for (let y = sel.y; y < sel.y + sel.h; y++) {
          for (let x = sel.x; x < sel.x + sel.w; x++) {
            if (x >= 0 && x < w && y >= 0 && y < h) {
              const nx = (x - cx) / rx;
              const ny = (y - cy) / ry;
              if (nx * nx + ny * ny <= 1.0) baseMask[y * w + x] = 255;
            }
          }
        }
      } else {
        for (let y = sel.y; y < sel.y + sel.h; y++) {
          for (let x = sel.x; x < sel.x + sel.w; x++) {
            if (x >= 0 && x < w && y >= 0 && y < h) baseMask[y * w + x] = 255;
          }
        }
      }
    } else {
      const active = this.app.layerManager.getActiveLayer();
      if (!active) return;
      const imgData = active.ctx.getImageData(0, 0, w, h);
      baseMask = new Uint8Array(w * h);
      for (let i = 0, j = 0; i < imgData.data.length; i += 4, j++) {
        baseMask[j] = imgData.data[i + 3] > 20 ? 255 : 0;
      }
    }

    const sSmooth = document.getElementById('re-smooth');
    const sFeather = document.getElementById('re-feather');
    const sContrast = document.getElementById('re-contrast');
    const sShift = document.getElementById('re-shift');
    const outMode = document.getElementById('re-output-mode');

    if (sSmooth) sSmooth.value = 0;
    if (sFeather) sFeather.value = 0;
    if (sContrast) sContrast.value = 0;
    if (sShift) sShift.value = 0;
    if (document.getElementById('val-re-smooth')) document.getElementById('val-re-smooth').textContent = '0';
    if (document.getElementById('val-re-feather')) document.getElementById('val-re-feather').textContent = '0px';
    if (document.getElementById('val-re-contrast')) document.getElementById('val-re-contrast').textContent = '0%';
    if (document.getElementById('val-re-shift')) document.getElementById('val-re-shift').textContent = '0%';

    let currentRefinedMask = baseMask;

    const updatePreview = () => {
      const smooth = parseInt(sSmooth?.value || 0, 10);
      const feather = parseInt(sFeather?.value || 0, 10);
      const contrast = parseInt(sContrast?.value || 0, 10);
      const shiftEdge = parseInt(sShift?.value || 0, 10);

      if (typeof SelectionRefinementEngine !== 'undefined') {
        currentRefinedMask = SelectionRefinementEngine.refineSelection(baseMask, w, h, {
          smooth, feather, contrast, shiftEdge
        });
      }

      const viewMode = document.querySelector('input[name="re-view-mode"]:checked')?.value || 'marching-ants';
      this.renderRefinePreview(currentRefinedMask, viewMode);
    };

    [sSmooth, sFeather, sContrast, sShift].filter(Boolean).forEach(s => {
      s.oninput = () => {
        const valEl = document.getElementById(`val-${s.id}`);
        if (valEl) valEl.textContent = s.id === 're-feather' ? `${s.value}px` : (s.id === 're-smooth' ? s.value : `${s.value}%`);
        updatePreview();
      };
    });

    document.querySelectorAll('input[name="re-view-mode"]').forEach(r => {
      r.onchange = updatePreview;
    });

    const btnOk = document.getElementById('btn-apply-refine-edge');
    if (btnOk) {
      btnOk.onclick = () => {
        const mode = outMode ? outMode.value : 'selection';
        const active = this.app.layerManager.getActiveLayer();

        if (mode === 'mask' && active) {
          if (!active.hasMask) this.app.layerManager.addMask(active.id);
          const mImg = active.maskCtx.createImageData(w, h);
          for (let i = 0, j = 0; i < mImg.data.length; i += 4, j++) {
            const val = currentRefinedMask[j];
            mImg.data[i] = val;
            mImg.data[i + 1] = val;
            mImg.data[i + 2] = val;
            mImg.data[i + 3] = 255;
          }
          active.maskCtx.putImageData(mImg, 0, 0);
          this.clearSelection();
        } else {
          let minX = w, minY = h, maxX = 0, maxY = 0;
          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
              if (currentRefinedMask[y * w + x] > 128) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
              }
            }
          }
          this.selection = {
            type: 'path',
            x: minX,
            y: minY,
            w: Math.max(1, maxX - minX + 1),
            h: Math.max(1, maxY - minY + 1),
            mask: currentRefinedMask
          };
        }

        this.clearOverlay();
        this.renderMarchingAnts();
        this.app.renderComposite();
        this.app.pushHistoryState('Refine Edge / Mask');
        modal.classList.add('hidden');
      };
    }

    modal.classList.remove('hidden');
    updatePreview();
  }

  renderRefinePreview(mask, viewMode) {
    this.clearOverlay();
    const ctx = this.app.overlayCtx;
    const w = this.app.width;
    const h = this.app.height;

    if (viewMode === 'marching-ants') {
      this.renderMarchingAnts();
      return;
    }

    ctx.save();
    const overlayImg = ctx.createImageData(w, h);
    const data = overlayImg.data;

    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
      const isSelected = mask[j] > 128;
      if (viewMode === 'onion-skin') {
        if (!isSelected) {
          data[i] = 220;
          data[i + 1] = 38;
          data[i + 2] = 38;
          data[i + 3] = 128; // 50% red ruby overlay
        }
      } else if (viewMode === 'on-black') {
        if (!isSelected) {
          data[i] = 0;
          data[i + 1] = 0;
          data[i + 2] = 0;
          data[i + 3] = 255;
        }
      } else if (viewMode === 'on-white') {
        if (!isSelected) {
          data[i] = 255;
          data[i + 1] = 255;
          data[i + 2] = 255;
          data[i + 3] = 255;
        }
      }
    }

    ctx.putImageData(overlayImg, 0, 0);
    ctx.restore();
  }

  clearSelection() {
    this.selection = null;
    this.clearOverlay();
  }

  finalizeSelection(endX, endY) {
    const minX = Math.round(Math.min(this.startX, endX));
    const minY = Math.round(Math.min(this.startY, endY));
    const w = Math.round(Math.abs(endX - this.startX));
    const h = Math.round(Math.abs(endY - this.startY));

    if (w < 2 || h < 2) {
      this.clearSelection();
      return;
    }

    this.selection = {
      type: this.currentTool === 'select-ellipse' ? 'ellipse' : 'rect',
      x: minX,
      y: minY,
      w,
      h
    };

    this.renderMarchingAnts();
    this.app.pushHistoryState('Select ' + (this.selection.type === 'ellipse' ? 'Ellipse' : 'Rect'));
  }

  finalizeCrop(endX, endY) {
    let w = Math.round(Math.abs(endX - this.startX));
    let h = Math.round(Math.abs(endY - this.startY));
    const ratio = this.getCropAspectRatio();
    if (ratio) {
      h = Math.round(w / ratio);
    }
    const signX = endX >= this.startX ? 1 : -1;
    const signY = endY >= this.startY ? 1 : -1;
    const minX = Math.round(signX === 1 ? this.startX : this.startX - w);
    const minY = Math.round(signY === 1 ? this.startY : this.startY - h);

    if (w < 8 || h < 8) {
      this.clearOverlay();
      this.activeCropRect = null;
      return;
    }

    this.finalizeCropAt(minX, minY, w, h);
  }

  // ── Shapes ──
  commitShape(layer, endX, endY) {
    if (!this.pathManager) return;

    const minX = Math.min(this.startX, endX);
    const minY = Math.min(this.startY, endY);
    const w = Math.max(1, Math.abs(endX - this.startX));
    const h = Math.max(1, Math.abs(endY - this.startY));
    const cx = minX + w / 2;
    const cy = minY + h / 2;

    switch (this.currentTool) {
      case 'shape-rect':
        this.pathManager.createRectangle(minX, minY, w, h, 0);
        break;
      case 'shape-rounded-rect':
        this.pathManager.createRectangle(minX, minY, w, h, this.shapeRadius);
        break;
      case 'shape-ellipse':
        this.pathManager.createEllipse(cx, cy, w / 2, h / 2);
        break;
      case 'shape-polygon':
        this.pathManager.createPolygon(cx, cy, Math.min(w, h) / 2, this.shapeSides);
        break;
      case 'shape-star':
        const outerR = Math.min(w, h) / 2;
        const innerR = outerR * (this.shapeStarRatio / 100);
        this.pathManager.createStar(cx, cy, outerR, innerR, this.shapeSides);
        break;
      case 'shape-line':
        this.pathManager.createLine(this.startX, this.startY, endX, endY);
        break;
    }

    if (this.shapeMode === 'shape') {
      this.createShapeLayerFromPath();
    } else if (this.shapeMode === 'pixels') {
      const ctx = this.app.layerManager.getActiveDrawCtx();
      if (ctx) {
        ctx.save();
        if (layer.lockAlpha) ctx.globalCompositeOperation = 'source-atop';
        if (this.shapeFill && this.currentTool !== 'shape-line') {
          this.pathManager.fillPath(ctx, this.app.colorPicker.getFgCss());
        }
        if (this.shapeStroke) {
          this.pathManager.strokePath(ctx, this.app.colorPicker.getBgCss(), this.shapeStrokeWidth);
        }
        ctx.restore();
      }
      this.pathManager.clear();
      this.app.renderComposite();
      this.app.pushHistoryState('Draw Shape Pixels');
    } else if (this.shapeMode === 'path') {
      this.clearOverlay();
      this.pathManager.renderOverlay(this.app.overlayCtx, this.app.zoom, this.app.panX, this.app.panY);
      this.app.pushHistoryState('Create Vector Path');
    }
  }

  // ── Text Tool ──
  applyTextPrompt(layer, x, y) {
    if (layer && layer.type === 'text') {
      layer.textParams.x = Math.round(x);
      layer.textParams.y = Math.round(y);
      this.app.layerManager.renderTextLayer(layer);
      this.app.renderComposite();
      this.app.pushHistoryState('Move Text Anchor');
      if (this.app.openTypographyInspector) {
        this.app.openTypographyInspector(layer);
      }
      return;
    }

    const fgHex = this.app.colorPicker ? this.app.colorPicker.getFgHex() : '#ffffff';
    const newLayer = this.app.layerManager.addTextLayer('Type Here', Math.round(x), Math.round(y), {
      fontFamily: this.textFontFamily || 'Inter, sans-serif',
      fontSize: this.textFontSize || 48,
      fontWeight: this.textBold ? 'bold' : 'normal',
      fontStyle: this.textItalic ? 'italic' : 'normal',
      color: fgHex
    });

    this.app.renderComposite();
    this.app.pushHistoryState('Add Text Layer');
    if (this.app.openTypographyInspector) {
      this.app.openTypographyInspector(newLayer);
    }
  }

  // ── Eyedropper ──
  sampleEyedropper(x, y) {
    const px = Utils.clamp(Math.round(x), 0, this.app.width - 1);
    const py = Utils.clamp(Math.round(y), 0, this.app.height - 1);

    const comp = Utils.createCanvas(1, 1);
    const cCtx = comp.getContext('2d');
    this.app.layerManager.compositeTo(cCtx);
    const data = this.app.mainCtx.getImageData(px, py, 1, 1).data;

    this.app.colorPicker.setActiveColor(data[0], data[1], data[2]);
    this.app.colorPicker.syncPickerFromColor({ r: data[0], g: data[1], b: data[2] });
  }

  // ── Paint Bucket Fill ──
  applyBucket(layer, x, y) {
    const ctx = this.app.layerManager.getActiveDrawCtx();
    if (!ctx) return;

    const rgb = Utils.hexToRgb(this.app.colorPicker.getFgHex());
    Utils.floodFill(ctx, x, y, rgb, this.bucketTolerance);

    this.app.renderComposite();
    this.app.pushHistoryState('Paint Bucket Fill');
  }

  // ── Free Transform ──
  startFreeTransform() {
    const active = this.app.layerManager.getActiveLayer();
    if (!active) return;

    // Snapshot full original layer canvas to restore cleanly on cancel
    this.transformOriginalCanvas = Utils.createCanvas(this.app.width, this.app.height);
    this.transformOriginalCanvas.getContext('2d').drawImage(active.canvas, 0, 0);

    let minX, minY, w, h;
    const isSelectionActive = !!this.selection;
    this.transformIsSelection = isSelectionActive;

    if (isSelectionActive) {
      const s = this.selection;
      minX = Math.round(s.x);
      minY = Math.round(s.y);
      w = Math.max(1, Math.round(s.w));
      h = Math.max(1, Math.round(s.h));

      this.transformSourceCanvas = Utils.createCanvas(this.app.width, this.app.height);
      const sCtx = this.transformSourceCanvas.getContext('2d');

      // Draw only the selected region into the transformSourceCanvas
      sCtx.save();
      sCtx.beginPath();
      if (s.type === 'ellipse') {
        sCtx.ellipse(s.x + s.w / 2, s.y + s.h / 2, s.w / 2, s.h / 2, 0, 0, Math.PI * 2);
      } else {
        sCtx.rect(s.x, s.y, s.w, s.h);
      }
      sCtx.clip();
      sCtx.drawImage(active.canvas, 0, 0);
      sCtx.restore();

      // Clear the selection region from active.canvas so it floats cleanly without double rendering
      if (s.mask) {
        const imgData = active.ctx.getImageData(0, 0, this.app.width, this.app.height);
        const d = imgData.data;
        const endY = Math.min(this.app.height, s.y + s.h);
        const endX = Math.min(this.app.width, s.x + s.w);
        for (let y = Math.max(0, s.y); y < endY; y++) {
          for (let x = Math.max(0, s.x); x < endX; x++) {
            if (s.mask[y * this.app.width + x]) {
              d[(y * this.app.width + x) * 4 + 3] = 0;
            }
          }
        }
        active.ctx.putImageData(imgData, 0, 0);
      } else {
        active.ctx.save();
        active.ctx.beginPath();
        if (s.type === 'ellipse') {
          active.ctx.ellipse(s.x + s.w / 2, s.y + s.h / 2, s.w / 2, s.h / 2, 0, 0, Math.PI * 2);
        } else {
          active.ctx.rect(s.x, s.y, s.w, s.h);
        }
        active.ctx.clip();
        active.ctx.clearRect(s.x - 2, s.y - 2, s.w + 4, s.h + 4);
        active.ctx.restore();
      }
    } else {
      // Full layer bounds
      const imgData = active.ctx.getImageData(0, 0, this.app.width, this.app.height);
      const d = imgData.data;
      minX = this.app.width; minY = this.app.height;
      let maxX = -1, maxY = -1;

      for (let y = 0; y < this.app.height; y++) {
        for (let x = 0; x < this.app.width; x++) {
          if (d[(y * this.app.width + x) * 4 + 3] > 5) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }

      if (maxX === -1) {
        minX = 0; minY = 0; maxX = this.app.width - 1; maxY = this.app.height - 1;
      }

      const pad = 4;
      minX = Math.max(0, minX - pad);
      minY = Math.max(0, minY - pad);
      maxX = Math.min(this.app.width, maxX + pad);
      maxY = Math.min(this.app.height, maxY + pad);

      w = maxX - minX;
      h = maxY - minY;

      this.transformSourceCanvas = Utils.createCanvas(this.app.width, this.app.height);
      this.transformSourceCanvas.getContext('2d').drawImage(active.canvas, 0, 0);

      // Temporarily clear active.canvas while transforming so preview on overlay is clean
      active.ctx.clearRect(0, 0, this.app.width, this.app.height);
    }

    this.transformBox = {
      x: minX,
      y: minY,
      w,
      h,
      origX: minX,
      origY: minY,
      origW: w,
      origH: h,
      angle: 0
    };

    this.isTransforming = true;
    this.app.renderComposite();
    this.setTool('transform');
    this.renderTransformHandles();
  }

  commitFreeTransform() {
    if (!this.isTransforming || !this.transformBox) return;

    const active = this.app.layerManager.getActiveLayer();
    if (active) {
      const tb = this.transformBox;

      if (active.type === 'smart-object' && active.smartObjectData) {
        active.smartObjectData.setTransform(tb.x, tb.y, tb.w, tb.h, (tb.angle * 180) / Math.PI);
        active.smartObjectData.renderToLayer(active);
      } else {
        if (!this.transformIsSelection) {
          active.ctx.clearRect(0, 0, this.app.width, this.app.height);
        }

        active.ctx.save();
        const cx = tb.x + tb.w / 2;
        const cy = tb.y + tb.h / 2;
        active.ctx.translate(cx, cy);
        active.ctx.rotate(tb.angle);

        active.ctx.drawImage(
          this.transformSourceCanvas,
          tb.origX, tb.origY, tb.origW, tb.origH,
          -tb.w / 2, -tb.h / 2, tb.w, tb.h
        );
        active.ctx.restore();
      }

      if (this.transformIsSelection) {
        this.clearSelection();
      }

      this.app.renderComposite();
      this.app.pushHistoryState('Free Transform');
    }

    this.isTransforming = false;
    this.transformBox = null;
    this.transformSourceCanvas = null;
    this.transformOriginalCanvas = null;
    this.clearOverlay();
    this.setTool('move');
  }

  cancelFreeTransform() {
    if (!this.isTransforming) return;
    const active = this.app.layerManager.getActiveLayer();
    if (active && this.transformOriginalCanvas) {
      active.ctx.clearRect(0, 0, this.app.width, this.app.height);
      active.ctx.drawImage(this.transformOriginalCanvas, 0, 0);
    }
    this.isTransforming = false;
    this.transformBox = null;
    this.transformSourceCanvas = null;
    this.transformOriginalCanvas = null;
    this.clearOverlay();
    this.app.renderComposite();
    this.setTool('move');
  }

  handleTransformPointerDown(x, y) {
    if (!this.transformBox) return;
    const tb = this.transformBox;
    const handleInfo = this.hitTestTransformHandlesWithAction(x, y);

    this.activeHandle = handleInfo ? handleInfo.action : null;
    const cx = tb.x + tb.w / 2;
    const cy = tb.y + tb.h / 2;

    this.transformDragStart = {
      x,
      y,
      boxX: tb.x,
      boxY: tb.y,
      boxW: tb.w,
      boxH: tb.h,
      cx,
      cy,
      boxAngle: tb.angle || 0,
      initialAngle: Math.atan2(y - cy, x - cx)
    };
    this.lastX = x;
    this.lastY = y;
  }

  handleTransformPointerMove(x, y, e = {}) {
    if (!this.activeHandle || !this.transformBox || !this.transformDragStart) return;
    const tb = this.transformBox;
    const ds = this.transformDragStart;

    const totalDx = x - ds.x;
    const totalDy = y - ds.y;

    if (this.activeHandle === 'move') {
      tb.x = ds.boxX + totalDx;
      tb.y = ds.boxY + totalDy;
      this.lastX = x;
      this.lastY = y;
      this.renderTransformHandles();
      return;
    }

    if (this.activeHandle === 'rot') {
      const currentAngle = Math.atan2(y - ds.cy, x - ds.cx);
      tb.angle = ds.boxAngle + (currentAngle - ds.initialAngle);
      this.lastX = x;
      this.lastY = y;
      this.renderTransformHandles();
      return;
    }

    // Handle scaling in local coordinate system
    const cos = Math.cos(-ds.boxAngle);
    const sin = Math.sin(-ds.boxAngle);
    const localDx = cos * totalDx - sin * totalDy;
    const localDy = sin * totalDx + cos * totalDy;

    const startW = ds.boxW;
    const startH = ds.boxH;
    const minSize = 10;

    let dLeft = 0;
    let dRight = 0;
    let dTop = 0;
    let dBottom = 0;

    switch (this.activeHandle) {
      case 'br':
        dRight = localDx;
        dBottom = localDy;
        break;
      case 'tl':
        dLeft = -localDx;
        dTop = -localDy;
        break;
      case 'tr':
        dRight = localDx;
        dTop = -localDy;
        break;
      case 'bl':
        dLeft = -localDx;
        dBottom = localDy;
        break;
      case 'mr':
        dRight = localDx;
        break;
      case 'ml':
        dLeft = -localDx;
        break;
      case 'bm':
        dBottom = localDy;
        break;
      case 'tm':
        dTop = -localDy;
        break;
    }

    let newW = Math.max(minSize, startW + dLeft + dRight);
    let newH = Math.max(minSize, startH + dTop + dBottom);

    const isCorner = ['tl', 'tr', 'bl', 'br'].includes(this.activeHandle);
    // Photoshop parity: corner handle drags maintain aspect ratio, unless holding Alt for freeform
    const keepAspect = e.shiftKey || (isCorner && !e.altKey);

    if (keepAspect && startW > 0 && startH > 0) {
      const scaleW = newW / startW;
      const scaleH = newH / startH;
      const scale = Math.abs(scaleW - 1) >= Math.abs(scaleH - 1) ? scaleW : scaleH;
      newW = Math.max(minSize, Math.round(startW * scale));
      newH = Math.max(minSize, Math.round(startH * scale));
    }

    // Compute center shift based on fixed anchor opposite to handle
    let localShiftX = 0;
    let localShiftY = 0;

    if (this.activeHandle === 'br') {
      localShiftX = (newW - startW) / 2;
      localShiftY = (newH - startH) / 2;
    } else if (this.activeHandle === 'tl') {
      localShiftX = -(newW - startW) / 2;
      localShiftY = -(newH - startH) / 2;
    } else if (this.activeHandle === 'tr') {
      localShiftX = (newW - startW) / 2;
      localShiftY = -(newH - startH) / 2;
    } else if (this.activeHandle === 'bl') {
      localShiftX = -(newW - startW) / 2;
      localShiftY = (newH - startH) / 2;
    } else if (this.activeHandle === 'mr') {
      localShiftX = (newW - startW) / 2;
    } else if (this.activeHandle === 'ml') {
      localShiftX = -(newW - startW) / 2;
    } else if (this.activeHandle === 'bm') {
      localShiftY = (newH - startH) / 2;
    } else if (this.activeHandle === 'tm') {
      localShiftY = -(newH - startH) / 2;
    }

    // Rotate local center shift back into world space
    const cosAngle = Math.cos(ds.boxAngle);
    const sinAngle = Math.sin(ds.boxAngle);
    const worldShiftX = cosAngle * localShiftX - sinAngle * localShiftY;
    const worldShiftY = sinAngle * localShiftX + cosAngle * localShiftY;

    const newCenterX = ds.cx + worldShiftX;
    const newCenterY = ds.cy + worldShiftY;

    tb.x = newCenterX - newW / 2;
    tb.y = newCenterY - newH / 2;
    tb.w = newW;
    tb.h = newH;

    this.lastX = x;
    this.lastY = y;
    this.renderTransformHandles();
  }

  updateTransformHoverCursor(x, y) {
    const handleInfo = this.hitTestTransformHandlesWithAction(x, y);
    const overlay = this.app.overlayCanvas;
    if (!handleInfo) {
      overlay.style.cursor = 'default';
      return;
    }
    const h = handleInfo.action;
    if (h === 'tl' || h === 'br') overlay.style.cursor = 'nwse-resize';
    else if (h === 'tr' || h === 'bl') overlay.style.cursor = 'nesw-resize';
    else if (h === 'tm' || h === 'bm') overlay.style.cursor = 'ns-resize';
    else if (h === 'ml' || h === 'mr') overlay.style.cursor = 'ew-resize';
    else if (h === 'move') overlay.style.cursor = 'move';
    else if (h === 'rot') overlay.style.cursor = 'crosshair';
    else overlay.style.cursor = 'default';
  }

  hitTestTransformHandlesWithAction(x, y) {
    if (!this.transformBox) return null;
    const tb = this.transformBox;
    const hs = Math.max(8, 12 / (this.app.zoom || 1));

    const cx = tb.x + tb.w / 2;
    const cy = tb.y + tb.h / 2;
    const angle = tb.angle || 0;
    const cos = Math.cos(-angle);
    const sin = Math.sin(-angle);

    // Transform (x, y) into box local space centered at (0, 0)
    const lx = cos * (x - cx) - sin * (y - cy);
    const ly = sin * (x - cx) + cos * (y - cy);

    const halfW = tb.w / 2;
    const halfH = tb.h / 2;

    const handles = {
      'tl': { x: -halfW, y: -halfH },
      'tr': { x: halfW, y: -halfH },
      'bl': { x: -halfW, y: halfH },
      'br': { x: halfW, y: halfH },
      'tm': { x: 0, y: -halfH },
      'bm': { x: 0, y: halfH },
      'ml': { x: -halfW, y: 0 },
      'mr': { x: halfW, y: 0 }
    };

    for (const [key, pt] of Object.entries(handles)) {
      if (Math.abs(lx - pt.x) <= hs && Math.abs(ly - pt.y) <= hs) {
        return { action: key };
      }
    }

    // Inside the bounding box -> move
    if (Math.abs(lx) <= halfW && Math.abs(ly) <= halfH) {
      return { action: 'move' };
    }

    // Within rotation zone outside the box (within 24px)
    const rotMargin = hs * 2.2;
    if (Math.abs(lx) <= halfW + rotMargin && Math.abs(ly) <= halfH + rotMargin) {
      return { action: 'rot' };
    }

    return null;
  }

  hitTestTransformHandles(x, y) {
    const res = this.hitTestTransformHandlesWithAction(x, y);
    return res ? res.action : null;
  }

  renderTransformHandles() {
    this.clearOverlay();
    if (!this.transformBox) return;
    const ctx = this.app.overlayCtx;
    const tb = this.transformBox;

    ctx.save();
    const cx = tb.x + tb.w / 2;
    const cy = tb.y + tb.h / 2;
    ctx.translate(cx, cy);
    ctx.rotate(tb.angle || 0);

    // Live transformed image preview
    if (this.transformSourceCanvas && tb.w > 0 && tb.h > 0) {
      ctx.drawImage(
        this.transformSourceCanvas,
        tb.origX, tb.origY, tb.origW, tb.origH,
        -tb.w / 2, -tb.h / 2, tb.w, tb.h
      );
    }

    // Transform Bounding Box
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-tb.w / 2, -tb.h / 2, tb.w, tb.h);

    // 8 Scale Handles
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#1d4ed8';
    ctx.lineWidth = 1.5;
    const hs = Math.max(6, Math.min(14, 8 / (this.app.zoom || 1)));

    const pts = [
      [-tb.w / 2, -tb.h / 2], [0, -tb.h / 2], [tb.w / 2, -tb.h / 2],
      [-tb.w / 2, 0], [tb.w / 2, 0],
      [-tb.w / 2, tb.h / 2], [0, tb.h / 2], [tb.w / 2, tb.h / 2]
    ];

    pts.forEach(([hx, hy]) => {
      ctx.fillRect(hx - hs / 2, hy - hs / 2, hs, hs);
      ctx.strokeRect(hx - hs / 2, hy - hs / 2, hs, hs);
    });

    // Center crosshair anchor
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(3, 4 / (this.app.zoom || 1)), 0, Math.PI * 2);
    ctx.strokeStyle = '#3b82f6';
    ctx.stroke();

    ctx.restore();
  }

  // ── Overlay Previews ──
  clearOverlay() {
    this.app.overlayCtx.clearRect(0, 0, this.app.width, this.app.height);
    if (this.app.renderGuidesAndOverlays) {
      this.app.renderGuidesAndOverlays();
    }
  }

  renderCropOverlay(minX, minY, w, h) {
    this.clearOverlay();
    const ctx = this.app.overlayCtx;
    ctx.save();

    // Dark translucent backdrop
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.fillRect(0, 0, this.app.width, this.app.height);
    ctx.clearRect(minX, minY, w, h);

    // Rule of Thirds Grid (Photoshop Parity)
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(minX + w / 3, minY);
    ctx.lineTo(minX + w / 3, minY + h);
    ctx.moveTo(minX + (2 * w) / 3, minY);
    ctx.lineTo(minX + (2 * w) / 3, minY + h);
    ctx.moveTo(minX, minY + h / 3);
    ctx.lineTo(minX + w, minY + h / 3);
    ctx.moveTo(minX, minY + (2 * h) / 3);
    ctx.lineTo(minX + w, minY + (2 * h) / 3);
    ctx.stroke();
    ctx.restore();

    // Outer bounding box
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(minX, minY, w, h);

    // Corner bracket handles (Photoshop style)
    const handleLen = Math.min(18, Math.min(w / 4, h / 4));
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    // TL
    ctx.moveTo(minX, minY + handleLen); ctx.lineTo(minX, minY); ctx.lineTo(minX + handleLen, minY);
    // TR
    ctx.moveTo(minX + w - handleLen, minY); ctx.lineTo(minX + w, minY); ctx.lineTo(minX + w, minY + handleLen);
    // BL
    ctx.moveTo(minX, minY + h - handleLen); ctx.lineTo(minX, minY + h); ctx.lineTo(minX + handleLen, minY + h);
    // BR
    ctx.moveTo(minX + w - handleLen, minY + h); ctx.lineTo(minX + w, minY + h); ctx.lineTo(minX + w, minY + h - handleLen);

    // Edge middle pill handles
    const midLen = Math.min(14, Math.min(w / 6, h / 6));
    if (w > 40) {
      ctx.moveTo(minX + w / 2 - midLen, minY); ctx.lineTo(minX + w / 2 + midLen, minY);
      ctx.moveTo(minX + w / 2 - midLen, minY + h); ctx.lineTo(minX + w / 2 + midLen, minY + h);
    }
    if (h > 40) {
      ctx.moveTo(minX, minY + h / 2 - midLen); ctx.lineTo(minX, minY + h / 2 + midLen);
      ctx.moveTo(minX + w, minY + h / 2 - midLen); ctx.lineTo(minX + w, minY + h / 2 + midLen);
    }
    ctx.stroke();

    // Photoshop Dimension & Target Overlay Badge
    const targetMode = document.getElementById('crop-target-mode')?.value || 'active-layer';
    const targetLabel = targetMode === 'canvas' ? 'Canvas' : (targetMode === 'selected-layers' ? 'Selected Layers' : 'Active Layer');
    const preset = document.getElementById('crop-aspect-preset')?.value || 'free';
    const badgeText = `${Math.round(w)} × ${Math.round(h)} px • ${preset !== 'free' ? preset + ' • ' : ''}${targetLabel}`;
    ctx.font = 'bold 11px Inter, sans-serif';
    const badgeW = ctx.measureText(badgeText).width + 16;
    const badgeH = 22;
    const badgeX = Math.max(4, Math.min(minX, this.app.width - badgeW - 4));
    const badgeY = minY >= 28 ? minY - 26 : minY + h + 6;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    if (ctx.roundRect) ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 4);
    else ctx.rect(badgeX, badgeY, badgeW, badgeH);
    ctx.fill();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#f8fafc';
    ctx.fillText(badgeText, badgeX + 8, badgeY + 15);

    ctx.restore();
  }

  renderToolOverlayPreview(curX, curY) {
    this.clearOverlay();
    const ctx = this.app.overlayCtx;

    if (this.currentTool === 'crop') {
      let w = Math.abs(curX - this.startX);
      let h = Math.abs(curY - this.startY);
      const ratio = this.getCropAspectRatio();
      if (ratio) {
        h = Math.round(w / ratio);
      }
      const signX = curX >= this.startX ? 1 : -1;
      const signY = curY >= this.startY ? 1 : -1;
      const minX = Math.round(signX === 1 ? this.startX : this.startX - w);
      const minY = Math.round(signY === 1 ? this.startY : this.startY - h);
      this.activeCropRect = { x: minX, y: minY, w, h };
      this.renderCropOverlay(minX, minY, w, h);
      return;
    }

    const minX = Math.min(this.startX, curX);
    const minY = Math.min(this.startY, curY);
    const w = Math.abs(curX - this.startX);
    const h = Math.abs(curY - this.startY);

    ctx.save();
    ctx.lineWidth = 1;

    if (this.currentTool === 'select-rect' || this.currentTool === 'shape-rect') {
      ctx.strokeStyle = '#ffffff';
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(minX, minY, w, h);
    } else if (this.currentTool === 'shape-rounded-rect') {
      ctx.strokeStyle = '#ffffff';
      ctx.setLineDash([4, 4]);
      const r = Math.min(this.shapeRadius, Math.min(w / 2, h / 2));
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(minX, minY, w, h, r);
      else ctx.rect(minX, minY, w, h);
      ctx.stroke();
    } else if (this.currentTool === 'select-ellipse' || this.currentTool === 'shape-ellipse') {
      ctx.strokeStyle = '#ffffff';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.ellipse(minX + w / 2, minY + h / 2, Math.max(1, w / 2), Math.max(1, h / 2), 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (this.currentTool === 'shape-polygon') {
      ctx.strokeStyle = '#ffffff';
      ctx.setLineDash([4, 4]);
      const rad = Math.min(w, h) / 2;
      const cx = minX + w / 2;
      const cy = minY + h / 2;
      ctx.beginPath();
      for (let i = 0; i < this.shapeSides; i++) {
        const ang = (i / this.shapeSides) * Math.PI * 2 - Math.PI / 2;
        const px = cx + rad * Math.cos(ang);
        const py = cy + rad * Math.sin(ang);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
    } else if (this.currentTool === 'shape-star') {
      ctx.strokeStyle = '#ffffff';
      ctx.setLineDash([4, 4]);
      const outerR = Math.min(w, h) / 2;
      const innerR = outerR * (this.shapeStarRatio / 100);
      const cx = minX + w / 2;
      const cy = minY + h / 2;
      ctx.beginPath();
      for (let i = 0; i < this.shapeSides * 2; i++) {
        const rVal = (i % 2 === 0) ? outerR : innerR;
        const ang = (i / (this.shapeSides * 2)) * Math.PI * 2 - Math.PI / 2;
        const px = cx + rVal * Math.cos(ang);
        const py = cy + rVal * Math.sin(ang);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
    } else if (this.currentTool === 'shape-line') {
      ctx.strokeStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(this.startX, this.startY);
      ctx.lineTo(curX, curY);
      ctx.stroke();
    }

    ctx.restore();
  }

  startMarchingAntsLoop() {
    const loop = () => {
      if (this.isTransforming) {
        this.renderTransformHandles();
      } else if (this.selection && !this.isMouseDown) {
        this.marchingAntsOffset = (this.marchingAntsOffset + 0.5) % 12;
        this.renderMarchingAnts();
      } else if (['pen', 'path-select'].includes(this.currentTool) && this.pathManager && !this.pathManager.isEmpty() && !this.isMouseDown) {
        this.clearOverlay();
        this.pathManager.renderOverlay(this.app.overlayCtx, this.app.zoom, this.app.panX, this.app.panY);
      }
      this.marchingAntsTimer = requestAnimationFrame(loop);
    };
    loop();
  }

  buildSelectionPath(sel) {
    if (!sel || !sel.mask) return;
    const w = this.app.width;
    const h = this.app.height;
    const mask = sel.mask;
    const minX = Math.max(0, sel.x || 0);
    const minY = Math.max(0, sel.y || 0);
    const maxX = Math.min(w - 1, (sel.x || 0) + (sel.w || w) - 1);
    const maxY = Math.min(h - 1, (sel.y || 0) + (sel.h || h) - 1);

    const hasPath2D = typeof Path2D !== 'undefined';
    const path = hasPath2D ? new Path2D() : null;
    const segments = [];

    // Horizontal boundary edges between rows
    for (let y = minY; y <= maxY + 1; y++) {
      let runStart = -1;
      for (let x = minX; x <= maxX; x++) {
        const top = (y > 0 && y - 1 < h) ? (mask[(y - 1) * w + x] > 128) : false;
        const bot = (y < h) ? (mask[y * w + x] > 128) : false;
        if (top !== bot) {
          if (runStart === -1) runStart = x;
        } else {
          if (runStart !== -1) {
            if (path) { path.moveTo(runStart, y); path.lineTo(x, y); }
            else { segments.push(runStart, y, x, y); }
            runStart = -1;
          }
        }
      }
      if (runStart !== -1) {
        if (path) { path.moveTo(runStart, y); path.lineTo(maxX + 1, y); }
        else { segments.push(runStart, y, maxX + 1, y); }
      }
    }

    // Vertical boundary edges between columns
    for (let x = minX; x <= maxX + 1; x++) {
      let runStart = -1;
      for (let y = minY; y <= maxY; y++) {
        const left = (x > 0 && x - 1 < w) ? (mask[y * w + (x - 1)] > 128) : false;
        const right = (x < w) ? (mask[y * w + x] > 128) : false;
        if (left !== right) {
          if (runStart === -1) runStart = y;
        } else {
          if (runStart !== -1) {
            if (path) { path.moveTo(x, runStart); path.lineTo(x, y); }
            else { segments.push(x, runStart, x, y); }
            runStart = -1;
          }
        }
      }
      if (runStart !== -1) {
        if (path) { path.moveTo(x, runStart); path.lineTo(x, maxY + 1); }
        else { segments.push(x, runStart, x, maxY + 1); }
      }
    }

    if (path) sel._path = path;
    else sel._segments = segments;
  }

  renderMarchingAnts() {
    this.clearOverlay();
    const ctx = this.app.overlayCtx;
    const sel = this.selection;
    if (!sel) return;

    if (sel.mask && !sel._path && !sel._segments) {
      this.buildSelectionPath(sel);
    }

    ctx.save();
    ctx.lineWidth = 1.5;

    const drawAntsShape = () => {
      if (sel.type === 'rect') {
        ctx.strokeRect(sel.x, sel.y, sel.w, sel.h);
      } else if (sel.type === 'ellipse') {
        ctx.beginPath();
        ctx.ellipse(sel.x + sel.w / 2, sel.y + sel.h / 2, Math.max(1, sel.w / 2), Math.max(1, sel.h / 2), 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (sel._path) {
        ctx.stroke(sel._path);
      } else if (sel._segments) {
        ctx.beginPath();
        const segs = sel._segments;
        for (let i = 0; i < segs.length; i += 4) {
          ctx.moveTo(segs[i], segs[i + 1]);
          ctx.lineTo(segs[i + 2], segs[i + 3]);
        }
        ctx.stroke();
      } else if (sel.contour && sel.contour.length >= 2) {
        ctx.beginPath();
        ctx.moveTo(sel.contour[0].x, sel.contour[0].y);
        for (let i = 1; i < sel.contour.length; i++) {
          ctx.lineTo(sel.contour[i].x, sel.contour[i].y);
        }
        ctx.closePath();
        ctx.stroke();
      } else {
        ctx.strokeRect(sel.x, sel.y, sel.w, sel.h);
      }
    };

    ctx.strokeStyle = '#000000';
    ctx.setLineDash([4, 4]);
    ctx.lineDashOffset = this.marchingAntsOffset;
    drawAntsShape();

    ctx.strokeStyle = '#ffffff';
    ctx.lineDashOffset = this.marchingAntsOffset + 4;
    drawAntsShape();

    ctx.restore();
  }

  renderObjectSelectionBox(start, cur) {
    this.clearOverlay();
    const ctx = this.app.overlayCtx;
    if (!ctx) return;

    const x = Math.min(start.x, cur.x);
    const y = Math.min(start.y, cur.y);
    const w = Math.abs(cur.x - start.x);
    const h = Math.abs(cur.y - start.y);

    ctx.save();
    ctx.fillStyle = 'rgba(56, 189, 248, 0.2)';
    ctx.fillRect(x, y, w, h);

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.lineDashOffset = this.marchingAntsOffset || 0;
    ctx.strokeRect(x, y, w, h);

    ctx.restore();
  }

  renderObjectSelectionLasso(points) {
    this.clearOverlay();
    const ctx = this.app.overlayCtx;
    if (!ctx || points.length < 2) return;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.closePath();

    ctx.fillStyle = 'rgba(56, 189, 248, 0.2)';
    ctx.fill();

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.lineDashOffset = this.marchingAntsOffset || 0;
    ctx.stroke();

    ctx.restore();
  }

  finalizeObjectSelection(endX, endY) {
    if (!this.objSelDragging && !this.objSelStart) return;
    this.objSelDragging = false;
    this.clearOverlay();

    const startX = this.objSelStart ? this.objSelStart.x : endX;
    const startY = this.objSelStart ? this.objSelStart.y : endY;
    const dist = Math.hypot(endX - startX, endY - startY);
    const activeLayer = this.app.layerManager.getActiveLayer();
    if (!activeLayer) return;

    const w = this.app.width;
    const h = this.app.height;

    // Single click (distance < 6px): select object directly under cursor
    if (dist < 6) {
      if (this.app.objectFinderEngine) {
        const compositeCtx = this.app.mainCtx || activeLayer.ctx;
        const imgData = compositeCtx.getImageData(0, 0, w, h);
        const tol = this.objSelTolerance || 35;
        const found = this.app.objectFinderEngine.detectObjectAt(imgData, endX, endY, tol);
        if (found && found.bounds) {
          this.selection = {
            type: 'path',
            x: found.bounds.x,
            y: found.bounds.y,
            w: found.bounds.w,
            h: found.bounds.h,
            mask: found.mask
          };
          this.renderMarchingAnts();
          this.app.renderComposite();
          if (this.app.contextualTaskBar) this.app.contextualTaskBar.update();
          this.app.pushHistoryState('Object Selection');
          return;
        }
      }
    }

    // Dragged Region (Rectangle or Lasso):
    let region = null;
    if (this.objSelMode === 'lasso' && this.objSelPoints && this.objSelPoints.length >= 3) {
      let minX = w, minY = h, maxX = 0, maxY = 0;
      for (const p of this.objSelPoints) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }
      region = {
        x: Math.max(0, Math.floor(minX)),
        y: Math.max(0, Math.floor(minY)),
        width: Math.max(1, Math.ceil(maxX - minX + 1)),
        height: Math.max(1, Math.ceil(maxY - minY + 1))
      };
    } else {
      const minX = Math.max(0, Math.min(startX, endX));
      const minY = Math.max(0, Math.min(startY, endY));
      const rw = Math.abs(endX - startX);
      const rh = Math.abs(endY - startY);
      if (rw < 4 && rh < 4) return;
      region = {
        x: Math.floor(minX),
        y: Math.floor(minY),
        width: Math.max(1, Math.ceil(rw)),
        height: Math.max(1, Math.ceil(rh))
      };
    }

    if (typeof SmartSubjectDetection !== 'undefined') {
      const res = SmartSubjectDetection.detectSubject(activeLayer.ctx, w, h, region);
      if (res && res.selectedCount > 0) {
        this.selection = {
          type: 'path',
          x: res.bounds.x,
          y: res.bounds.y,
          w: res.bounds.width,
          h: res.bounds.height,
          mask: res.mask
        };
        this.renderMarchingAnts();
        this.app.renderComposite();
        if (this.app.contextualTaskBar) this.app.contextualTaskBar.update();
        this.app.pushHistoryState('Manual Subject Selection');
      }
    }

    this.objSelStart = null;
    this.objSelPoints = [];
  }

  invertSelection() {
    const w = this.app.width;
    const h = this.app.height;
    if (!this.selection) {
      this.selection = { type: 'rect', x: 0, y: 0, w, h };
      this.renderMarchingAnts();
      this.app.pushHistoryState('Select All');
      return;
    }

    const sel = this.selection;
    const newMask = new Uint8Array(w * h);

    if (sel.mask) {
      for (let i = 0; i < w * h; i++) {
        newMask[i] = sel.mask[i] > 128 ? 0 : 255;
      }
    } else if (sel.type === 'rect') {
      newMask.fill(255);
      const endX = Math.min(w, sel.x + sel.w);
      const endY = Math.min(h, sel.y + sel.h);
      for (let y = Math.max(0, sel.y); y < endY; y++) {
        for (let x = Math.max(0, sel.x); x < endX; x++) {
          newMask[y * w + x] = 0;
        }
      }
    } else if (sel.type === 'ellipse') {
      newMask.fill(255);
      const cx = sel.x + sel.w / 2;
      const cy = sel.y + sel.h / 2;
      const rx = Math.max(1, sel.w / 2);
      const ry = Math.max(1, sel.h / 2);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const nx = (x - cx) / rx;
          const ny = (y - cy) / ry;
          if (nx * nx + ny * ny <= 1.0) newMask[y * w + x] = 0;
        }
      }
    } else {
      newMask.fill(255);
    }

    this.selection = {
      type: 'path',
      x: 0,
      y: 0,
      w,
      h,
      mask: newMask
    };
    this.renderMarchingAnts();
    this.app.pushHistoryState('Invert Selection');
    if (this.app.contextualTaskBar) this.app.contextualTaskBar.update();
  }

  // ══════════════════════════════════════════════════════════════════════
  // Retouching Suite: Patch Tool Engine
  // ══════════════════════════════════════════════════════════════════════
  handlePatchPointerDown(x, y) {
    if (this.selection && this.selection.mask) {
      const idx = Math.round(y) * this.app.width + Math.round(x);
      if (idx >= 0 && idx < this.selection.mask.length && this.selection.mask[idx] > 64) {
        this.patchDragging = true;
        this.patchStartPt = { x, y };
        this.patchOffset = { dx: 0, dy: 0 };
        return;
      }
    }
    this.patchDragging = false;
    this.lassoPoints = [{ x, y }];
    this.renderFreehandLassoOverlay();
  }

  handlePatchPointerMove(x, y) {
    if (this.patchDragging && this.patchStartPt) {
      this.patchOffset = {
        dx: Math.round(x - this.patchStartPt.x),
        dy: Math.round(y - this.patchStartPt.y)
      };
      this.renderPatchOverlay();
    } else if (this.isMouseDown && this.lassoPoints.length > 0) {
      const lastPt = this.lassoPoints[this.lassoPoints.length - 1];
      if (Math.hypot(x - lastPt.x, y - lastPt.y) >= 2) {
        this.lassoPoints.push({ x, y });
        this.renderFreehandLassoOverlay();
      }
    }
  }

  handlePatchPointerUp(x, y) {
    if (this.patchDragging && this.patchStartPt) {
      this.patchDragging = false;
      const offset = { ...this.patchOffset };
      this.patchOffset = { dx: 0, dy: 0 };
      this.clearOverlay();
      if (offset.dx !== 0 || offset.dy !== 0) {
        this.applyPatch(offset, this.patchMode || 'source');
      }
    } else if (this.lassoPoints.length >= 3) {
      this.finishFreehandLasso();
    }
  }

  renderPatchOverlay() {
    this.clearOverlay();
    if (!this.selection || !this.patchOffset || !this.patchStartPt) return;
    const ctx = this.app.overlayCtx;
    ctx.save();
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);

    const ox = this.patchOffset.dx;
    const oy = this.patchOffset.dy;

    ctx.strokeRect(this.selection.x + ox, this.selection.y + oy, this.selection.w, this.selection.h);
    ctx.beginPath();
    ctx.moveTo(this.patchStartPt.x, this.patchStartPt.y);
    ctx.lineTo(this.patchStartPt.x + ox, this.patchStartPt.y + oy);
    ctx.strokeStyle = '#60a5fa';
    ctx.stroke();
    ctx.restore();
  }

  applyPatch(offset = { dx: 0, dy: 0 }, mode = null) {
    if (!this.selection || !this.selection.mask) return false;
    const activeLayer = this.app.layerManager.getActiveLayer();
    if (!activeLayer || !activeLayer.ctx) return false;

    const patchMode = mode || this.patchMode || 'source';
    const imgData = activeLayer.ctx.getImageData(0, 0, this.app.width, this.app.height);
    const patched = Filters.applyPatch(imgData, this.selection.mask, offset, patchMode);
    activeLayer.ctx.putImageData(patched, 0, 0);
    this.app.renderComposite();
    this.app.pushHistoryState(`Patch Tool (${patchMode === 'source' ? 'Source' : 'Destination'})`);
    return true;
  }

  // ══════════════════════════════════════════════════════════════════════
  // Retouching Suite: Content-Aware Move & Extend Engine
  // ══════════════════════════════════════════════════════════════════════
  handleCAMovePointerDown(x, y) {
    if (this.selection && this.selection.mask) {
      const idx = Math.round(y) * this.app.width + Math.round(x);
      if (idx >= 0 && idx < this.selection.mask.length && this.selection.mask[idx] > 64) {
        this.contentAwareMoveDragging = true;
        this.contentAwareMoveStartPt = { x, y };
        this.contentAwareMoveOffset = { dx: 0, dy: 0 };
        return;
      }
    }
    this.contentAwareMoveDragging = false;
    this.lassoPoints = [{ x, y }];
    this.renderFreehandLassoOverlay();
  }

  handleCAMovePointerMove(x, y) {
    if (this.contentAwareMoveDragging && this.contentAwareMoveStartPt) {
      this.contentAwareMoveOffset = {
        dx: Math.round(x - this.contentAwareMoveStartPt.x),
        dy: Math.round(y - this.contentAwareMoveStartPt.y)
      };
      this.renderCAMoveOverlay();
    } else if (this.isMouseDown && this.lassoPoints.length > 0) {
      const lastPt = this.lassoPoints[this.lassoPoints.length - 1];
      if (Math.hypot(x - lastPt.x, y - lastPt.y) >= 2) {
        this.lassoPoints.push({ x, y });
        this.renderFreehandLassoOverlay();
      }
    }
  }

  handleCAMovePointerUp(x, y) {
    if (this.contentAwareMoveDragging && this.contentAwareMoveStartPt) {
      this.contentAwareMoveDragging = false;
      const offset = { ...this.contentAwareMoveOffset };
      this.contentAwareMoveOffset = { dx: 0, dy: 0 };
      this.clearOverlay();
      if (offset.dx !== 0 || offset.dy !== 0) {
        this.applyContentAwareMove(offset, this.contentAwareMoveMode || 'move');
      }
    } else if (this.lassoPoints.length >= 3) {
      this.finishFreehandLasso();
    }
  }

  renderCAMoveOverlay() {
    this.clearOverlay();
    if (!this.selection || !this.contentAwareMoveOffset) return;
    const ctx = this.app.overlayCtx;
    ctx.save();
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);

    const ox = this.contentAwareMoveOffset.dx;
    const oy = this.contentAwareMoveOffset.dy;
    ctx.strokeRect(this.selection.x + ox, this.selection.y + oy, this.selection.w, this.selection.h);
    ctx.restore();
  }

  applyContentAwareMove(offset = { dx: 0, dy: 0 }, mode = null) {
    if (!this.selection || !this.selection.mask) return false;
    const activeLayer = this.app.layerManager.getActiveLayer();
    if (!activeLayer || !activeLayer.ctx) return false;

    const moveMode = mode || this.contentAwareMoveMode || 'move';
    const imgData = activeLayer.ctx.getImageData(0, 0, this.app.width, this.app.height);
    const result = Filters.contentAwareMove(imgData, this.selection.mask, offset, moveMode);
    activeLayer.ctx.putImageData(result, 0, 0);

    // Update selection bounds and mask location
    if (this.selection) {
      this.selection.x += offset.dx;
      this.selection.y += offset.dy;
      const oldMask = this.selection.mask;
      const newMask = new Uint8Array(this.app.width * this.app.height);
      const w = this.app.width, h = this.app.height;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const idx = y * w + x;
          if (oldMask[idx] > 0) {
            const nx = x + offset.dx;
            const ny = y + offset.dy;
            if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
              newMask[ny * w + nx] = oldMask[idx];
            }
          }
        }
      }
      this.selection.mask = newMask;
    }

    this.app.renderComposite();
    this.app.pushHistoryState(`Content-Aware ${moveMode === 'move' ? 'Move' : 'Extend'}`);
    return true;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ToolManager;
} else if (typeof window !== 'undefined') {
  window.ToolManager = ToolManager;
}
