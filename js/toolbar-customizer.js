// js/toolbar-customizer.js
// PixelForge Studio — Toolbar Customizer & Tool Drawer Manager
// Inspired by Photoshop's "Customize Toolbar" (Parity & Enhanced Workflow)
// Provides categorized tool grouping, drag-to-add/remove, presets, and live toolbar synchronization.

(function (global) {
  'use strict';

  // 1. Master Tool Registry (All 31 Tools Categorized by Component)
  const ALL_TOOLBAR_TOOLS = [
    // ── Component 1: Selection & Navigation ──
    {
      id: 'move',
      name: 'Move Tool',
      category: 'selection-nav',
      categoryLabel: 'Selection & Navigation',
      shortcut: 'V',
      desc: 'Move layers, selections, and guides on canvas',
      iconSvg: '<svg viewBox="0 0 24 24"><path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/></svg>'
    },
    {
      id: 'select-rect',
      name: 'Rectangular Marquee',
      category: 'selection-nav',
      categoryLabel: 'Selection & Navigation',
      shortcut: 'M',
      desc: 'Create rectangular pixel selections',
      iconSvg: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="2" stroke-dasharray="3 2" fill="none"/></svg>'
    },
    {
      id: 'select-ellipse',
      name: 'Elliptical Marquee',
      category: 'selection-nav',
      categoryLabel: 'Selection & Navigation',
      shortcut: 'Shift+M',
      desc: 'Create circular and elliptical pixel selections',
      iconSvg: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" stroke-dasharray="3 2" fill="none"/></svg>'
    },
    {
      id: 'lasso-freehand',
      name: 'Lasso Tool',
      category: 'selection-nav',
      categoryLabel: 'Selection & Navigation',
      shortcut: 'L',
      desc: 'Freehand selection boundary drawing',
      iconSvg: '<svg viewBox="0 0 24 24"><path d="M4 14c-1 3 0 6 3 7s7-1 9-3 3-5 2-8-3-5-6-5-6 2-7 5c-.7 2.1-.3 4 1 5l2 1" stroke="currentColor" stroke-width="1.8" stroke-dasharray="3 2" fill="none"/></svg>'
    },
    {
      id: 'lasso-polygon',
      name: 'Polygonal Lasso',
      category: 'selection-nav',
      categoryLabel: 'Selection & Navigation',
      shortcut: 'Shift+L',
      desc: 'Straight-edged point-to-point polygon selections',
      iconSvg: '<svg viewBox="0 0 24 24"><polygon points="4 6 18 3 21 16 12 21 3 14" stroke="currentColor" stroke-width="1.8" stroke-dasharray="3 2" fill="none"/><circle cx="4" cy="6" r="1.5" fill="currentColor"/><circle cx="18" cy="3" r="1.5" fill="currentColor"/><circle cx="21" cy="16" r="1.5" fill="currentColor"/><circle cx="12" cy="21" r="1.5" fill="currentColor"/><circle cx="3" cy="14" r="1.5" fill="currentColor"/></svg>'
    },
    {
      id: 'lasso-magnetic',
      name: 'Magnetic Lasso',
      category: 'selection-nav',
      categoryLabel: 'Selection & Navigation',
      shortcut: 'Shift+L',
      desc: 'Snaps selection edge to high-contrast pixel boundaries',
      iconSvg: '<svg viewBox="0 0 24 24"><path d="M4 11a5 5 0 0 1 5-5h1v4H9a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1h1v4H9a5 5 0 0 1-5-5v-3zM14 6h1a5 5 0 0 1 5 5v3a5 5 0 0 1-5 5h-1v-4h1a1 1 0 0 0 1-1v-3a1 1 0 0 0-1-1h-1V6z" stroke="currentColor" stroke-width="1.8" fill="none"/></svg>'
    },
    {
      id: 'magic-wand',
      name: 'Magic Wand Tool',
      category: 'selection-nav',
      categoryLabel: 'Selection & Navigation',
      shortcut: 'W',
      desc: 'Select contiguous or similar color areas with tolerance',
      iconSvg: '<svg viewBox="0 0 24 24"><path d="M14.5 2.5l7 7-14 14-7-7 14-14zM18 1l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2zM4 3l.5 1 1 .5-1 .5-.5 1-.5-1-1-.5 1-.5.5-1z" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>'
    },
    {
      id: 'select-object',
      name: 'Object Selection',
      category: 'selection-nav',
      categoryLabel: 'Selection & Navigation',
      shortcut: 'W',
      desc: 'AI saliency silhouette detection & auto segmentation',
      iconSvg: '<svg viewBox="0 0 24 24"><path d="M4 4h4v2H6v2H4V4zm16 0v4h-2V6h-2V4h4zM4 20v-4h2v2h2v2H4zm16 0h-4v-2h2v-2h2v4z" fill="#38bdf8"/><circle cx="12" cy="12" r="4" stroke="#38bdf8" stroke-width="1.8" fill="none"/></svg>'
    },
    {
      id: 'eyedropper',
      name: 'Eyedropper Tool',
      category: 'selection-nav',
      categoryLabel: 'Selection & Navigation',
      shortcut: 'I',
      desc: 'Sample color values directly from canvas pixels',
      iconSvg: '<svg viewBox="0 0 24 24"><path d="M14 4l3 3-9 9-4 1 1-4 9-9zM19 7l1-1a2.12 2.12 0 0 0-3-3l-1 1 3 3z" stroke="currentColor" stroke-width="2" fill="none"/></svg>'
    },
    {
      id: 'hand',
      name: 'Hand / Pan Tool',
      category: 'selection-nav',
      categoryLabel: 'Selection & Navigation',
      shortcut: 'H / Space',
      desc: 'Pan the viewport across large canvases smoothly',
      iconSvg: '<svg viewBox="0 0 24 24"><path d="M18 11V6a2 2 0 0 0-4 0v5M14 10V4a2 2 0 0 0-4 0v7M10 10.5V6a2 2 0 0 0-4 0v8a6 6 0 0 0 12 0v-3a2 2 0 0 0-4 0" stroke="currentColor" stroke-width="2" fill="none"/></svg>'
    },
    {
      id: 'zoom',
      name: 'Zoom Tool',
      category: 'selection-nav',
      categoryLabel: 'Selection & Navigation',
      shortcut: 'Z',
      desc: 'Magnify and inspect canvas pixels with scrubby zoom',
      iconSvg: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2" fill="none"/><line x1="21" y1="21" x2="16.65" y2="16.65" stroke="currentColor" stroke-width="2"/><line x1="11" y1="8" x2="11" y2="14" stroke="currentColor" stroke-width="2"/><line x1="8" y1="11" x2="14" y2="11" stroke="currentColor" stroke-width="2"/></svg>'
    },

    // ── Component 2: Crop & Transformation ──
    {
      id: 'crop',
      name: 'Crop Tool',
      category: 'crop-transform',
      categoryLabel: 'Crop & Transformation',
      shortcut: 'C',
      desc: 'Trim canvas boundaries, straighten, and re-frame',
      iconSvg: '<svg viewBox="0 0 24 24"><path d="M6 2v14a2 2 0 0 0 2 2h14M2 6h14a2 2 0 0 1 2 2v14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>'
    },
    {
      id: 'content-aware-move',
      name: 'Content-Aware Move',
      category: 'crop-transform',
      categoryLabel: 'Crop & Transformation',
      shortcut: 'J',
      desc: 'Move or extend subject with automatic background inpainting',
      iconSvg: '<svg viewBox="0 0 24 24"><path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20" stroke="#10b981" stroke-width="2" stroke-linecap="round" fill="none"/><rect x="7" y="7" width="10" height="10" stroke="currentColor" stroke-width="1.5" stroke-dasharray="2 2" fill="none"/></svg>'
    },

    // ── Component 3: Retouching & Healing ──
    {
      id: 'spot-healing',
      name: 'Spot Healing Brush',
      category: 'retouching',
      categoryLabel: 'Retouching & Healing',
      shortcut: 'J',
      desc: 'Quickly remove blemishes, spots, and minor artifacts',
      iconSvg: '<svg viewBox="0 0 24 24"><path d="M4.5 16.5l11-11a2.12 2.12 0 0 1 3 3l-11 11a2.12 2.12 0 0 1-3-3z" stroke="currentColor" stroke-width="2" fill="none"/><line x1="8" y1="8" x2="16" y2="16" stroke="currentColor" stroke-width="1.5"/></svg>'
    },
    {
      id: 'patch',
      name: 'Patch Tool',
      category: 'retouching',
      categoryLabel: 'Retouching & Healing',
      shortcut: 'J',
      desc: 'Seamless texture healing using sampled donor regions',
      iconSvg: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" stroke-width="1.8" stroke-dasharray="3 2" fill="none"/><path d="M8 8l8 8M16 8l-8 8" stroke="#3b82f6" stroke-width="2" stroke-linecap="round"/></svg>'
    },
    {
      id: 'adjustment-brush',
      name: 'Adjustment Brush',
      category: 'retouching',
      categoryLabel: 'Retouching & Healing',
      shortcut: 'Shift+J',
      desc: 'Paint localized exposure, vibrance, and tint masks',
      iconSvg: '<svg viewBox="0 0 24 24"><path d="M12 2l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z" stroke="#38bdf8" stroke-width="1.8" fill="none"/><circle cx="18" cy="6" r="3" fill="#38bdf8"/></svg>'
    },
    {
      id: 'clone-stamp',
      name: 'Clone Stamp Tool',
      category: 'retouching',
      categoryLabel: 'Retouching & Healing',
      shortcut: 'S',
      desc: 'Clone pixels from source sample with transform support',
      iconSvg: '<svg viewBox="0 0 24 24"><path d="M16 4h4v4M18 6l-6 6M8 12H4v8h8v-4" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="17" cy="17" r="4" stroke="currentColor" stroke-width="2" fill="none"/></svg>'
    },
    {
      id: 'history-brush',
      name: 'History Brush',
      category: 'retouching',
      categoryLabel: 'Retouching & Healing',
      shortcut: 'Y',
      desc: 'Paint pixels back from a chosen historical undo state',
      iconSvg: '<svg viewBox="0 0 24 24"><path d="M12 8v4l3 3M3.05 11a9 9 0 1 1 .5 4m-.5 5v-5h5" stroke="#f59e0b" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><circle cx="18" cy="18" r="3" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>'
    },

    // ── Component 4: Painting & Erasing ──
    {
      id: 'brush',
      name: 'Paintbrush Tool',
      category: 'painting',
      categoryLabel: 'Painting & Erasing',
      shortcut: 'B',
      desc: 'Smooth raster painting with dynamics, pressure & textures',
      iconSvg: '<svg viewBox="0 0 24 24"><path d="M18 2l4 4-10 10H8v-4L18 2zM3 21c1.5 0 3-1 3-3s-1.5-3-3-3a3 3 0 0 0 0 6z" stroke="currentColor" stroke-width="2" fill="none" stroke-linejoin="round"/></svg>'
    },
    {
      id: 'mixer-brush',
      name: 'Mixer Brush',
      category: 'painting',
      categoryLabel: 'Painting & Erasing',
      shortcut: 'B',
      desc: 'Realistic digital oils with wetness, mix, and reservoir blending',
      iconSvg: '<svg viewBox="0 0 24 24"><path d="M18 2l4 4-10 10H8v-4L18 2z" stroke="currentColor" stroke-width="2" fill="none"/><path d="M2 18a4 4 0 0 0 7 0c0-2-3.5-5-3.5-5S2 16 2 18z" fill="#3b82f6" stroke="currentColor" stroke-width="1.5"/></svg>'
    },
    {
      id: 'pencil',
      name: 'Pencil Tool',
      category: 'painting',
      categoryLabel: 'Painting & Erasing',
      shortcut: 'Shift+P',
      desc: 'Hard-edged 1-bit raster pixel drawing',
      iconSvg: '<svg viewBox="0 0 24 24"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" stroke="currentColor" stroke-width="2" fill="none"/></svg>'
    },
    {
      id: 'eraser',
      name: 'Eraser Tool',
      category: 'painting',
      categoryLabel: 'Painting & Erasing',
      shortcut: 'E',
      desc: 'Erase pixels to transparency or background canvas',
      iconSvg: '<svg viewBox="0 0 24 24"><path d="M20 20H7L2 15l10-10 8 5-7 7" stroke="currentColor" stroke-width="2" fill="none"/><line x1="18" y1="13" x2="11" y2="20" stroke="currentColor" stroke-width="2"/></svg>'
    },
    {
      id: 'bucket',
      name: 'Paint Bucket Tool',
      category: 'painting',
      categoryLabel: 'Painting & Erasing',
      shortcut: 'G',
      desc: 'Fill contiguous regions with active foreground color',
      iconSvg: '<svg viewBox="0 0 24 24"><path d="M19 11l-8-8-8.5 8.5a2.12 2.12 0 0 0 0 3l5 5a2.12 2.12 0 0 0 3 0L19 11zM5 2l5 5M22 20a2 2 0 1 1-4 0c0-1.6 2-3 2-3s2 1.4 2 3z" stroke="currentColor" stroke-width="2" fill="none"/></svg>'
    },
    {
      id: 'gradient',
      name: 'Gradient Tool',
      category: 'painting',
      categoryLabel: 'Painting & Erasing',
      shortcut: 'G',
      desc: 'Draw linear, radial, angle, and reflected color gradients',
      iconSvg: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="2" fill="none"/><line x1="3" y1="21" x2="21" y2="3" stroke="currentColor" stroke-width="2"/></svg>'
    },

    // ── Component 5: Focus & Tonal Retouch ──
    {
      id: 'tool-blur',
      name: 'Blur Tool',
      category: 'tonal',
      categoryLabel: 'Focus & Tonal Retouch',
      shortcut: 'R',
      desc: 'Locally soften and smooth pixel details',
      iconSvg: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.5" stroke-dasharray="2 2" fill="none"/><circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>'
    },
    {
      id: 'tool-sharpen',
      name: 'Sharpen Tool',
      category: 'tonal',
      categoryLabel: 'Focus & Tonal Retouch',
      shortcut: 'R',
      desc: 'Enhance high-frequency edge contrast',
      iconSvg: '<svg viewBox="0 0 24 24"><polygon points="12 2 22 20 2 20" stroke="currentColor" stroke-width="2" fill="none"/></svg>'
    },
    {
      id: 'smudge',
      name: 'Smudge Tool',
      category: 'tonal',
      categoryLabel: 'Focus & Tonal Retouch',
      shortcut: 'R',
      desc: 'Drag and blend pixels like wet paint',
      iconSvg: '<svg viewBox="0 0 24 24"><path d="M12 2a4 4 0 0 0-4 4c0 3 4 8 4 8s4-5 4-8a4 4 0 0 0-4-4z" stroke="currentColor" stroke-width="2" fill="none"/><path d="M6 18c2 2 10 2 12 0" stroke="currentColor" stroke-width="2" fill="none"/></svg>'
    },
    {
      id: 'dodge',
      name: 'Dodge Tool',
      category: 'tonal',
      categoryLabel: 'Focus & Tonal Retouch',
      shortcut: 'O',
      desc: 'Lighten shadows, midtones, or highlights',
      iconSvg: '<svg viewBox="0 0 24 24"><circle cx="12" cy="9" r="6" stroke="currentColor" stroke-width="2" fill="none"/><line x1="12" y1="15" x2="12" y2="22" stroke="currentColor" stroke-width="2.5"/><line x1="9" y1="22" x2="15" y2="22" stroke="currentColor" stroke-width="2"/></svg>'
    },
    {
      id: 'burn',
      name: 'Burn Tool',
      category: 'tonal',
      categoryLabel: 'Focus & Tonal Retouch',
      shortcut: 'Shift+O',
      desc: 'Darken tones to add depth and shadow contrast',
      iconSvg: '<svg viewBox="0 0 24 24"><path d="M12 2c3 4 6 7 6 11a6 6 0 1 1-12 0c0-4 3-7 6-11z" stroke="currentColor" stroke-width="2" fill="none"/></svg>'
    },
    {
      id: 'sponge',
      name: 'Sponge Tool',
      category: 'tonal',
      categoryLabel: 'Focus & Tonal Retouch',
      shortcut: 'Shift+O',
      desc: 'Saturate or desaturate color intensity',
      iconSvg: '<svg viewBox="0 0 24 24"><rect x="4" y="6" width="16" height="12" rx="3" stroke="currentColor" stroke-width="2" fill="none"/><circle cx="8" cy="10" r="1" fill="currentColor"/><circle cx="14" cy="14" r="1" fill="currentColor"/><circle cx="16" cy="9" r="1" fill="currentColor"/><circle cx="10" cy="13" r="1" fill="currentColor"/></svg>'
    },

    // ── Component 6: Vector, Shapes & Typography ──
    {
      id: 'pen',
      name: 'Bézier Pen Tool',
      category: 'vector-shapes',
      categoryLabel: 'Vector, Shapes & Typography',
      shortcut: 'P',
      desc: 'Draw precise vector paths with cubic Bézier anchors',
      iconSvg: '<svg viewBox="0 0 24 24"><path d="M12 2l4 7-6 6-7-4 9-9zM7 11l6 6M4 20l4-1-3-3-1 4z" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linejoin="round"/><circle cx="17.5" cy="4.5" r="1.5" fill="currentColor"/></svg>'
    },
    {
      id: 'curvature-pen',
      name: 'Curvature Pen',
      category: 'vector-shapes',
      categoryLabel: 'Vector, Shapes & Typography',
      shortcut: 'P',
      desc: 'Draw smooth curved paths intuitively without direction handles',
      iconSvg: '<svg viewBox="0 0 24 24"><path d="M4 19C8 17 9 7 14 5s6 4 6 4" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="4" cy="19" r="2" fill="currentColor"/><circle cx="14" cy="5" r="2" fill="currentColor"/><circle cx="20" cy="9" r="2" fill="currentColor"/></svg>'
    },
    {
      id: 'path-select',
      name: 'Path Selection',
      category: 'vector-shapes',
      categoryLabel: 'Vector, Shapes & Typography',
      shortcut: 'A',
      desc: 'Select and transform entire vector paths (Black Arrow)',
      iconSvg: '<svg viewBox="0 0 24 24"><path d="M4 3l14 8-6 2-4 7-4-17z" stroke="currentColor" stroke-width="1.5" fill="currentColor"/></svg>'
    },
    {
      id: 'direct-select',
      name: 'Direct Selection',
      category: 'vector-shapes',
      categoryLabel: 'Vector, Shapes & Typography',
      shortcut: 'Shift+A',
      desc: 'Select and manipulate individual anchor points (White Arrow)',
      iconSvg: '<svg viewBox="0 0 24 24"><path d="M4 3l14 8-6 2-4 7-4-17z" stroke="currentColor" stroke-width="2" fill="none"/></svg>'
    },
    {
      id: 'text',
      name: 'Horizontal Type Tool',
      category: 'vector-shapes',
      categoryLabel: 'Vector, Shapes & Typography',
      shortcut: 'T',
      desc: 'Create editable vector text layers with full typography',
      iconSvg: '<svg viewBox="0 0 24 24"><polyline points="4 7 4 4 20 4 20 7" stroke="currentColor" stroke-width="2" fill="none"/><line x1="12" y1="4" x2="12" y2="20" stroke="currentColor" stroke-width="2"/><line x1="8" y1="20" x2="16" y2="20" stroke="currentColor" stroke-width="2"/></svg>'
    },
    {
      id: 'shape-rect',
      name: 'Rectangle Shape',
      category: 'vector-shapes',
      categoryLabel: 'Vector, Shapes & Typography',
      shortcut: 'U',
      desc: 'Draw vector rectangle shapes with live corner radii',
      iconSvg: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" stroke-width="2" fill="none"/></svg>'
    },
    {
      id: 'shape-rounded-rect',
      name: 'Rounded Rectangle',
      category: 'vector-shapes',
      categoryLabel: 'Vector, Shapes & Typography',
      shortcut: 'U',
      desc: 'Draw rectangles with curved corners',
      iconSvg: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="6" stroke="currentColor" stroke-width="2" fill="none"/></svg>'
    },
    {
      id: 'shape-ellipse',
      name: 'Ellipse Shape',
      category: 'vector-shapes',
      categoryLabel: 'Vector, Shapes & Typography',
      shortcut: 'U',
      desc: 'Draw vector circle and ellipse shapes',
      iconSvg: '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="12" rx="9" ry="7" stroke="currentColor" stroke-width="2" fill="none"/></svg>'
    },
    {
      id: 'shape-polygon',
      name: 'Polygon Shape',
      category: 'vector-shapes',
      categoryLabel: 'Vector, Shapes & Typography',
      shortcut: 'U',
      desc: 'Draw regular n-sided polygon vector shapes',
      iconSvg: '<svg viewBox="0 0 24 24"><polygon points="12 3 21 8.5 18 19 6 19 3 8.5" stroke="currentColor" stroke-width="2" fill="none"/></svg>'
    },
    {
      id: 'shape-star',
      name: 'Star Shape',
      category: 'vector-shapes',
      categoryLabel: 'Vector, Shapes & Typography',
      shortcut: 'U',
      desc: 'Draw multi-point star vector shapes with inner indent',
      iconSvg: '<svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" stroke="currentColor" stroke-width="1.8" fill="none"/></svg>'
    },
    {
      id: 'shape-line',
      name: 'Line Tool',
      category: 'vector-shapes',
      categoryLabel: 'Vector, Shapes & Typography',
      shortcut: 'U',
      desc: 'Draw vector strokes with arrowheads and weights',
      iconSvg: '<svg viewBox="0 0 24 24"><line x1="4" y1="20" x2="20" y2="4" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>'
    }
  ];

  const TOOL_CATEGORIES = [
    { id: 'selection-nav', name: 'Selection & Navigation', icon: '🎯' },
    { id: 'crop-transform', name: 'Crop & Transformation', icon: '✂️' },
    { id: 'retouching', name: 'Retouching & Healing', icon: '🩹' },
    { id: 'painting', name: 'Painting & Erasing', icon: '🖌️' },
    { id: 'tonal', name: 'Focus & Tonal Retouch', icon: '💡' },
    { id: 'vector-shapes', name: 'Vector, Shapes & Typography', icon: '✒️' }
  ];

  class ToolbarCustomizerManager {
    constructor(app = null) {
      this.app = app;
      this.allTools = ALL_TOOLBAR_TOOLS;
      this.categories = TOOL_CATEGORIES;
      this.storageKey = 'pf_toolbar_tools';

      // Default active tools: standard Photoshop layout with all tools
      this.defaultActiveIds = this.allTools.map(t => t.id);
      this.activeTools = [...this.defaultActiveIds];
      this.extraTools = [];

      this.searchTerm = '';
      this.draggedToolId = null;
      this.isOpen = false;

      this.loadFromStorage();
    }

    init() {
      this.bindUI();
      this.syncToolbarDOM();
    }

    // ── Persistence ──
    saveToStorage() {
      try {
        if (typeof localStorage !== 'undefined') {
          const payload = {
            activeTools: this.activeTools,
            extraTools: this.extraTools
          };
          localStorage.setItem(this.storageKey, JSON.stringify(payload));
        }
      } catch (e) {
        console.warn('ToolbarCustomizer: Could not save to localStorage', e);
      }
    }

    loadFromStorage() {
      try {
        if (typeof localStorage !== 'undefined') {
          const raw = localStorage.getItem(this.storageKey);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed.activeTools)) {
              // Filter to valid known IDs
              const validIds = this.allTools.map(t => t.id);
              this.activeTools = parsed.activeTools.filter(id => validIds.includes(id));
              
              // Calculate extra tools
              this.extraTools = validIds.filter(id => !this.activeTools.includes(id));
              return;
            }
          }
        }
      } catch (e) {
        console.warn('ToolbarCustomizer: Could not load from localStorage', e);
      }
      this.activeTools = [...this.defaultActiveIds];
      this.extraTools = [];
    }

    // ── Tool Lookup ──
    getTool(id) {
      return this.allTools.find(t => t.id === id) || null;
    }

    // ── Move to Extra / Remove from Active Toolbar ──
    moveToExtra(toolId) {
      if (!this.activeTools.includes(toolId)) return false;
      this.activeTools = this.activeTools.filter(id => id !== toolId);
      if (!this.extraTools.includes(toolId)) {
        this.extraTools.push(toolId);
      }
      this.onToolsChanged();
      return true;
    }

    // ── Move to Active Toolbar / Add from Extra ──
    moveToActive(toolId, targetToolId = null) {
      this.extraTools = this.extraTools.filter(id => id !== toolId);
      if (this.activeTools.includes(toolId)) {
        this.activeTools = this.activeTools.filter(id => id !== toolId);
      }
      if (targetToolId && this.activeTools.includes(targetToolId)) {
        const idx = this.activeTools.indexOf(targetToolId);
        this.activeTools.splice(idx, 0, toolId);
      } else {
        this.activeTools.push(toolId);
      }
      this.onToolsChanged();
      return true;
    }

    // ── Reorder within Active Toolbar ──
    reorderActive(sourceToolId, targetToolId) {
      if (!sourceToolId || !targetToolId || sourceToolId === targetToolId) return;
      const srcIdx = this.activeTools.indexOf(sourceToolId);
      const tgtIdx = this.activeTools.indexOf(targetToolId);
      if (srcIdx === -1 || tgtIdx === -1) return;

      this.activeTools.splice(srcIdx, 1);
      this.activeTools.splice(tgtIdx, 0, sourceToolId);
      this.onToolsChanged();
    }

    // ── Presets ──
    restoreDefaults() {
      this.activeTools = [...this.defaultActiveIds];
      this.extraTools = [];
      this.onToolsChanged();
    }

    showAllTools() {
      this.restoreDefaults();
    }

    clearToExtra() {
      // Keep only 'move' in active tools, move everything else to extra tools
      this.activeTools = ['move'];
      this.extraTools = this.defaultActiveIds.filter(id => id !== 'move');
      this.onToolsChanged();
    }

    applyPreset(presetName) {
      const presets = {
        photoshop: [...this.defaultActiveIds],
        painting: [
          'move', 'select-rect', 'brush', 'mixer-brush', 'pencil', 'eraser',
          'bucket', 'gradient', 'eyedropper', 'smudge', 'hand', 'zoom'
        ],
        retouching: [
          'move', 'select-rect', 'crop', 'spot-healing', 'patch',
          'adjustment-brush', 'clone-stamp', 'history-brush',
          'tool-blur', 'tool-sharpen', 'dodge', 'burn', 'sponge',
          'eyedropper', 'hand', 'zoom'
        ],
        vector: [
          'move', 'pen', 'curvature-pen', 'path-select', 'direct-select',
          'text', 'shape-rect', 'shape-rounded-rect', 'shape-ellipse',
          'shape-polygon', 'shape-star', 'shape-line', 'eyedropper',
          'hand', 'zoom'
        ],
        minimal: [
          'move', 'select-rect', 'brush', 'eraser', 'pen', 'text',
          'eyedropper', 'hand', 'zoom'
        ]
      };

      if (presets[presetName]) {
        const chosen = presets[presetName];
        this.activeTools = [...chosen];
        this.extraTools = this.defaultActiveIds.filter(id => !chosen.includes(id));
        this.onToolsChanged();
      }
    }

    onToolsChanged() {
      this.saveToStorage();
      this.syncToolbarDOM();
      if (this.isOpen) {
        this.renderCustomizer();
      }
      if (this.isDrawerOpen) {
        this.renderDrawer();
      }
      this.updateFlyout();
    }

    // ── Live Synchronization with DOM #toolbar ──
    syncToolbarDOM() {
      if (typeof document === 'undefined') return;

      const toolbar = document.getElementById('toolbar');
      if (!toolbar) return;

      // Update visibility of every tool button
      const buttons = toolbar.querySelectorAll('.tool-btn[data-tool]');
      buttons.forEach(btn => {
        const tool = btn.dataset.tool;
        const isVisible = this.activeTools.includes(tool);
        btn.style.display = isVisible ? 'flex' : 'none';
        btn.classList.toggle('tool-hidden', !isVisible);
      });

      // Hide orphaned separators
      const separators = toolbar.querySelectorAll('.toolbar-sep');
      separators.forEach(sep => {
        // Check if there are visible tool buttons immediately before and after
        let prev = sep.previousElementSibling;
        let hasPrevVisible = false;
        while (prev) {
          if (prev.classList.contains('toolbar-sep')) break;
          if (prev.classList.contains('tool-btn') && prev.style.display !== 'none') {
            hasPrevVisible = true;
            break;
          }
          prev = prev.previousElementSibling;
        }

        let next = sep.nextElementSibling;
        let hasNextVisible = false;
        while (next) {
          if (next.classList.contains('toolbar-sep') || next.classList.contains('toolbar-bottom-swatches')) break;
          if (next.classList.contains('tool-btn') && next.style.display !== 'none') {
            hasNextVisible = true;
            break;
          }
          next = next.nextElementSibling;
        }

        sep.style.display = (hasPrevVisible && hasNextVisible) ? 'block' : 'none';
      });

      // Update 3-dots button indicator badge
      const dotsBtn = document.getElementById('btn-edit-toolbar-dots');
      if (dotsBtn) {
        dotsBtn.classList.toggle('has-extra-tools', this.extraTools.length > 0);
        dotsBtn.setAttribute('title', this.extraTools.length > 0 
          ? `Edit Toolbar · ${this.extraTools.length} Extra Tools Available (...)` 
          : 'Customize Toolbar (...)');
      }

      // Check current tool fallback: if currently selected tool was removed, fallback to first active tool
      if (this.app && this.app.toolManager) {
        const currentTool = this.app.toolManager.currentTool;
        if (currentTool && !this.activeTools.includes(currentTool)) {
          const fallback = this.activeTools[0] || 'move';
          this.app.toolManager.setTool(fallback);
        }
      }
    }

    // ── Left Docked Drawer: Toggle, Open, Close, and Render ──
    toggleDrawer() {
      const panel = document.getElementById('left-tool-drawer-panel');
      if (!panel) return;
      if (panel.classList.contains('hidden')) {
        this.openDrawer();
      } else {
        this.closeDrawer();
      }
    }

    openDrawer() {
      const panel = document.getElementById('left-tool-drawer-panel');
      if (!panel) return;
      panel.classList.remove('hidden');
      this.isDrawerOpen = true;

      const knob = document.getElementById('btn-left-dock-toggle');
      const handle = document.getElementById('left-dock-handle');
      if (knob) knob.classList.add('active');
      if (handle) handle.classList.add('active');

      this.renderDrawer();

      const searchInput = document.getElementById('left-drawer-search-input');
      if (searchInput) {
        setTimeout(() => searchInput.focus(), 60);
      }

      if (this.app) {
        if (typeof this.app.renderRulers === 'function') this.app.renderRulers();
        if (this.app.colorPicker && typeof this.app.colorPicker.updateCursorPositions === 'function') {
          this.app.colorPicker.updateCursorPositions();
        }
        if (this.app.navigatorManager && typeof this.app.navigatorManager.update === 'function') {
          this.app.navigatorManager.update();
        }
      }
    }

    closeDrawer() {
      const panel = document.getElementById('left-tool-drawer-panel');
      if (!panel) return;
      panel.classList.add('hidden');
      this.isDrawerOpen = false;

      const knob = document.getElementById('btn-left-dock-toggle');
      const handle = document.getElementById('left-dock-handle');
      if (knob) knob.classList.remove('active');
      if (handle) handle.classList.remove('active');

      if (this.app) {
        if (typeof this.app.renderRulers === 'function') this.app.renderRulers();
        if (this.app.colorPicker && typeof this.app.colorPicker.updateCursorPositions === 'function') {
          this.app.colorPicker.updateCursorPositions();
        }
        if (this.app.navigatorManager && typeof this.app.navigatorManager.update === 'function') {
          this.app.navigatorManager.update();
        }
      }
    }

    renderDrawer() {
      if (typeof document === 'undefined') return;
      const container = document.getElementById('left-drawer-components-container');
      const stats = document.getElementById('left-drawer-stats');
      if (!container) return;

      if (stats) {
        stats.textContent = `${this.activeTools.length} active in toolbar · ${this.extraTools.length} hidden`;
      }

      container.innerHTML = '';
      const query = (this.drawerSearchTerm || '').toLowerCase().trim();

      this.categories.forEach(cat => {
        const catAllTools = ALL_TOOLBAR_TOOLS.filter(t => t.category === cat.id);
        const filteredTools = catAllTools.filter(tool => {
          if (!query) return true;
          return (
            tool.name.toLowerCase().includes(query) ||
            tool.shortcut.toLowerCase().includes(query) ||
            tool.categoryLabel.toLowerCase().includes(query) ||
            tool.desc.toLowerCase().includes(query)
          );
        });

        if (filteredTools.length === 0 && query) return;

        const group = document.createElement('div');
        group.className = 'drawer-category-group';

        const activeCount = filteredTools.filter(t => this.activeTools.includes(t.id)).length;

        const header = document.createElement('div');
        header.className = 'drawer-cat-header';
        header.innerHTML = `
          <div style="display:flex; align-items:center; gap:7px;">
            <span class="drawer-cat-chevron" style="font-size:9px; color:var(--text-dim); transition:transform 0.15s ease;">▼</span>
            <span>${cat.icon}</span>
            <strong>${cat.name}</strong>
          </div>
          <span class="category-count-pill">${activeCount} / ${catAllTools.length} active</span>
        `;

        const table = document.createElement('div');
        table.className = 'drawer-cat-tools-table';

        header.addEventListener('click', () => {
          const isCollapsed = table.style.display === 'none';
          table.style.display = isCollapsed ? 'flex' : 'none';
          const ch = header.querySelector('.drawer-cat-chevron');
          if (ch) ch.textContent = isCollapsed ? '▼' : '▶';
        });

        filteredTools.forEach(tool => {
          const isActive = this.activeTools.includes(tool.id);
          const row = document.createElement('div');
          row.className = `drawer-tool-row ${isActive ? 'is-active-tool' : 'is-removed-tool'}`;
          row.dataset.toolId = tool.id;
          row.draggable = true;
          row.setAttribute('title', `${tool.name} (${tool.shortcut}) — ${tool.desc}`);

          row.innerHTML = `
            <span class="drawer-drag-handle" title="Drag to reorder">⠿</span>
            <div class="drawer-tool-icon">${tool.iconSvg}</div>
            <div class="drawer-tool-meta">
              <div style="display:flex; align-items:center; gap:6px;">
                <span class="drawer-tool-name">${tool.name}</span>
                <span class="drawer-tool-shortcut">${tool.shortcut}</span>
              </div>
            </div>
            <button type="button" class="btn-drawer-tool-toggle ${isActive ? 'is-remove-btn' : 'is-add-btn'}" title="${isActive ? 'Remove tool from toolbar (Photoshop feature)' : 'Add tool back to toolbar'}">
              ${isActive ? '&minus; Remove' : '+ Add'}
            </button>
          `;

          // Toggle button handler
          const toggleBtn = row.querySelector('.btn-drawer-tool-toggle');
          toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (isActive) {
              this.moveToExtra(tool.id);
            } else {
              this.moveToActive(tool.id);
            }
          });

          // Clicking anywhere else on row activates the tool immediately
          row.addEventListener('click', () => {
            if (this.app && this.app.toolManager) {
              if (!this.activeTools.includes(tool.id)) {
                this.moveToActive(tool.id);
              }
              this.app.toolManager.setTool(tool.id);
            }
          });

          // Drag-to-reorder support
          row.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', tool.id);
            this.draggedToolId = tool.id;
          });

          row.addEventListener('dragover', (e) => {
            e.preventDefault();
            row.style.borderColor = 'var(--accent-blue)';
          });

          row.addEventListener('dragleave', () => {
            row.style.borderColor = '';
          });

          row.addEventListener('drop', (e) => {
            e.preventDefault();
            row.style.borderColor = '';
            const srcId = e.dataTransfer.getData('text/plain') || this.draggedToolId;
            if (srcId && srcId !== tool.id) {
              if (this.extraTools.includes(srcId)) {
                this.moveToActive(srcId, tool.id);
              } else {
                this.reorderActive(srcId, tool.id);
              }
            }
          });

          table.appendChild(row);
        });

        group.appendChild(header);
        group.appendChild(table);
        container.appendChild(group);
      });

      if (container.children.length === 0) {
        container.innerHTML = `
          <div style="padding:32px 16px; text-align:center; color:var(--text-dim); font-size:12px;">
            No tools found matching "${query}".
          </div>
        `;
      }
    }

    // ── DOM Binding ──
    bindUI() {
      if (typeof document === 'undefined') return;

      // 1. Left Dock Handle (between Toolbar and Workspace)
      const leftHandle = document.getElementById('left-dock-handle');
      if (leftHandle) {
        leftHandle.addEventListener('click', (e) => {
          e.stopPropagation();
          this.toggleDrawer();
        });
      }

      const leftKnob = document.getElementById('btn-left-dock-toggle');
      if (leftKnob) {
        leftKnob.addEventListener('click', (e) => {
          e.stopPropagation();
          this.toggleDrawer();
        });
      }

      // Left Drawer Panel Controls
      const btnDrawerClose = document.getElementById('btn-drawer-close');
      if (btnDrawerClose) {
        btnDrawerClose.addEventListener('click', () => this.closeDrawer());
      }

      const btnDrawerFull = document.getElementById('btn-drawer-full-customizer');
      if (btnDrawerFull) {
        btnDrawerFull.addEventListener('click', () => {
          this.closeDrawer();
          this.openModal();
        });
      }

      const drawerSearch = document.getElementById('left-drawer-search-input');
      if (drawerSearch) {
        drawerSearch.addEventListener('input', (e) => {
          this.drawerSearchTerm = e.target.value.toLowerCase().trim();
          this.renderDrawer();
        });
      }

      const btnDrawerRestore = document.getElementById('btn-drawer-restore-defaults');
      if (btnDrawerRestore) {
        btnDrawerRestore.addEventListener('click', () => this.restoreDefaults());
      }

      const btnDrawerShowAll = document.getElementById('btn-drawer-show-all');
      if (btnDrawerShowAll) {
        btnDrawerShowAll.addEventListener('click', () => this.showAllTools());
      }

      // 2. Toolbar 3-Dots Button
      const dotsBtn = document.getElementById('btn-edit-toolbar-dots');
      if (dotsBtn) {
        dotsBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (this.extraTools.length > 0) {
            this.toggleFlyout();
          } else {
            this.toggleDrawer();
          }
        });
        dotsBtn.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          this.openModal();
        });
      }

      // 3. Modal Controls
      const modal = document.getElementById('modal-toolbar-customizer');
      if (modal) {
        const closeBtns = modal.querySelectorAll('.modal-close-btn, #btn-customizer-done, .modal-cancel-btn');
        closeBtns.forEach(btn => {
          btn.addEventListener('click', () => this.closeModal());
        });

        // Search Input
        const searchInput = document.getElementById('customizer-search-input');
        if (searchInput) {
          searchInput.addEventListener('input', (e) => {
            this.searchTerm = e.target.value.toLowerCase().trim();
            this.renderCustomizer();
          });
        }

        // Preset Selector
        const presetSelect = document.getElementById('customizer-preset-select');
        if (presetSelect) {
          presetSelect.addEventListener('change', (e) => {
            this.applyPreset(e.target.value);
            presetSelect.value = '';
          });
        }

        // Quick Action Buttons
        const btnRestore = document.getElementById('btn-customizer-restore-defaults');
        if (btnRestore) {
          btnRestore.addEventListener('click', () => this.restoreDefaults());
        }

        const btnClear = document.getElementById('btn-customizer-clear-tools');
        if (btnClear) {
          btnClear.addEventListener('click', () => this.clearToExtra());
        }

        const btnShowAll = document.getElementById('btn-customizer-show-all');
        if (btnShowAll) {
          btnShowAll.addEventListener('click', () => this.showAllTools());
        }

        // Escape key to close
        document.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') {
            if (this.isOpen) this.closeModal();
            else if (this.isDrawerOpen) this.closeDrawer();
          }
        });
      }

      // 4. Flyout Close & Customize Button
      const flyoutClose = document.getElementById('btn-flyout-close');
      if (flyoutClose) {
        flyoutClose.addEventListener('click', () => this.closeFlyout());
      }

      const flyoutCustomize = document.getElementById('btn-flyout-customize');
      if (flyoutCustomize) {
        flyoutCustomize.addEventListener('click', () => {
          this.closeFlyout();
          this.toggleDrawer();
        });
      }

      // Close flyout on outside click
      document.addEventListener('click', (e) => {
        const flyout = document.getElementById('toolbar-extra-tools-flyout');
        if (flyout && !flyout.classList.contains('hidden')) {
          if (!flyout.contains(e.target) && !e.target.closest('#btn-edit-toolbar-dots')) {
            this.closeFlyout();
          }
        }
      });
    }

    // ── Open / Close Modal ──
    openModal() {
      this.closeFlyout();
      const modal = document.getElementById('modal-toolbar-customizer');
      if (!modal) return;

      this.isOpen = true;
      modal.classList.remove('hidden');
      modal.style.display = 'flex';
      this.renderCustomizer();
      
      const search = document.getElementById('customizer-search-input');
      if (search) search.focus();
    }

    closeModal() {
      const modal = document.getElementById('modal-toolbar-customizer');
      if (!modal) return;

      this.isOpen = false;
      modal.classList.add('hidden');
      modal.style.display = 'none';
    }

    // ── Flyout for Extra Hidden Tools ──
    toggleFlyout() {
      const flyout = document.getElementById('toolbar-extra-tools-flyout');
      if (!flyout) return;

      if (flyout.classList.contains('hidden')) {
        this.openFlyout();
      } else {
        this.closeFlyout();
      }
    }

    openFlyout() {
      const flyout = document.getElementById('toolbar-extra-tools-flyout');
      if (!flyout) return;

      this.updateFlyout();
      flyout.classList.remove('hidden');
    }

    closeFlyout() {
      const flyout = document.getElementById('toolbar-extra-tools-flyout');
      if (!flyout) return;
      flyout.classList.add('hidden');
    }

    updateFlyout() {
      if (typeof document === 'undefined') return;
      const list = document.getElementById('toolbar-extra-flyout-list');
      if (!list) return;

      list.innerHTML = '';
      if (this.extraTools.length === 0) {
        list.innerHTML = '<div style="padding:12px; color:var(--text-dim); font-size:11px; text-align:center;">No extra hidden tools. All tools are in the toolbar!</div>';
        return;
      }

      this.extraTools.forEach(toolId => {
        const tool = this.getTool(toolId);
        if (!tool) return;

        const row = document.createElement('div');
        row.className = 'flyout-tool-item';
        row.innerHTML = `
          <div class="flyout-tool-icon">${tool.iconSvg}</div>
          <div class="flyout-tool-info">
            <span class="flyout-tool-name">${tool.name}</span>
            <span class="flyout-tool-cat">${tool.categoryLabel}</span>
          </div>
          <span class="shortcut-badge">${tool.shortcut}</span>
        `;

        row.addEventListener('click', () => {
          if (this.app && this.app.toolManager) {
            this.app.toolManager.setTool(tool.id);
          }
          this.closeFlyout();
        });

        list.appendChild(row);
      });
    }

    // ── Render Customizer Workbench (Table & Drag-Drop Lists) ──
    renderCustomizer() {
      if (typeof document === 'undefined') return;

      const activeContainer = document.getElementById('customizer-active-tools-container');
      const extraContainer = document.getElementById('customizer-extra-tools-container');
      const statsBadge = document.getElementById('customizer-stats-badge');

      if (statsBadge) {
        statsBadge.textContent = `${this.activeTools.length} active · ${this.extraTools.length} extra / hidden`;
      }

      // Filter tools by search
      const matchesSearch = (tool) => {
        if (!this.searchTerm) return true;
        return (
          tool.name.toLowerCase().includes(this.searchTerm) ||
          tool.shortcut.toLowerCase().includes(this.searchTerm) ||
          tool.categoryLabel.toLowerCase().includes(this.searchTerm) ||
          tool.desc.toLowerCase().includes(this.searchTerm)
        );
      };

      // ── Render Active Column ──
      if (activeContainer) {
        activeContainer.innerHTML = '';

        // Group active tools by category
        this.categories.forEach(cat => {
          const catTools = this.activeTools
            .map(id => this.getTool(id))
            .filter(t => t && t.category === cat.id && matchesSearch(t));

          if (catTools.length === 0 && this.searchTerm) return;

          const groupEl = document.createElement('div');
          groupEl.className = 'customizer-category-group';
          groupEl.dataset.category = cat.id;

          const headerEl = document.createElement('div');
          headerEl.className = 'customizer-category-header';
          headerEl.innerHTML = `
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="customizer-cat-chevron" style="font-size:9px; color:var(--text-dim); transition:transform 0.15s ease;">▼</span>
              <span>${cat.icon}</span>
              <strong>${cat.name}</strong>
            </div>
            <span class="category-count-pill">${catTools.length} tools</span>
          `;

          const listEl = document.createElement('div');
          listEl.className = 'customizer-tool-list active-list-zone';
          listEl.dataset.category = cat.id;

          headerEl.addEventListener('click', () => {
            const isCollapsed = listEl.style.display === 'none';
            listEl.style.display = isCollapsed ? 'flex' : 'none';
            const ch = headerEl.querySelector('.customizer-cat-chevron');
            if (ch) ch.textContent = isCollapsed ? '▼' : '▶';
          });

          groupEl.appendChild(headerEl);

          if (catTools.length === 0) {
            const emptyEl = document.createElement('div');
            emptyEl.className = 'customizer-empty-cat';
            emptyEl.textContent = 'No tools visible in this category';
            listEl.appendChild(emptyEl);
          } else {
            catTools.forEach(tool => {
              const item = this.createToolRowElement(tool, 'active');
              listEl.appendChild(item);
            });
          }

          groupEl.appendChild(listEl);
          activeContainer.appendChild(groupEl);
        });
      }

      // ── Render Extra Tools Column ──
      if (extraContainer) {
        extraContainer.innerHTML = '';

        const visibleExtra = this.extraTools
          .map(id => this.getTool(id))
          .filter(t => t && matchesSearch(t));

        if (visibleExtra.length === 0) {
          const empty = document.createElement('div');
          empty.className = 'customizer-extra-empty';
          empty.innerHTML = `
            <div style="font-size:32px; margin-bottom:8px;">🎨</div>
            <strong>All tools are visible in your toolbar!</strong>
            <p>Drag tools here from the left or click "Remove →" to declutter your workspace and hide tools you don't use often.</p>
          `;
          extraContainer.appendChild(empty);
        } else {
          visibleExtra.forEach(tool => {
            const item = this.createToolRowElement(tool, 'extra');
            extraContainer.appendChild(item);
          });
        }
      }

      this.attachDragEvents();
    }

    // ── Create Interactive Tool Row Element ──
    createToolRowElement(tool, mode) {
      const el = document.createElement('div');
      el.className = `customizer-tool-card mode-${mode}`;
      el.draggable = true;
      el.dataset.toolId = tool.id;

      if (mode === 'active') {
        el.innerHTML = `
          <div class="tool-drag-handle" title="Drag to reorder or drag to Extra Tools to remove">⠿</div>
          <div class="tool-card-icon">${tool.iconSvg}</div>
          <div class="tool-card-meta">
            <div style="display:flex; align-items:center; gap:6px;">
              <span class="tool-card-name">${tool.name}</span>
              <kbd class="kbd-badge">${tool.shortcut}</kbd>
            </div>
            <span class="tool-card-desc">${tool.desc}</span>
          </div>
          <button class="btn-tool-action remove-btn" title="Remove tool from toolbar and place in Extra Tools">
            Remove &rarr;
          </button>
        `;

        el.querySelector('.remove-btn').addEventListener('click', (e) => {
          e.stopPropagation();
          this.moveToExtra(tool.id);
        });
      } else {
        el.innerHTML = `
          <div class="tool-drag-handle" title="Drag to Toolbar to add back">⠿</div>
          <div class="tool-card-icon">${tool.iconSvg}</div>
          <div class="tool-card-meta">
            <div style="display:flex; align-items:center; gap:6px;">
              <span class="tool-card-name">${tool.name}</span>
              <kbd class="kbd-badge">${tool.shortcut}</kbd>
            </div>
            <span class="tool-card-cat">${tool.categoryLabel}</span>
          </div>
          <button class="btn-tool-action add-btn" title="Add tool back to left toolbar">
            &larr; Add
          </button>
        `;

        el.querySelector('.add-btn').addEventListener('click', (e) => {
          e.stopPropagation();
          this.moveToActive(tool.id);
        });
      }

      return el;
    }

    // ── Drag and Drop Event Handling ──
    attachDragEvents() {
      if (typeof document === 'undefined') return;

      const cards = document.querySelectorAll('.customizer-tool-card');
      cards.forEach(card => {
        card.addEventListener('dragstart', (e) => {
          this.draggedToolId = card.dataset.toolId;
          card.classList.add('dragging');
          e.dataTransfer.setData('text/plain', card.dataset.toolId);
          e.dataTransfer.effectAllowed = 'move';
        });

        card.addEventListener('dragend', () => {
          this.draggedToolId = null;
          card.classList.remove('dragging');
          document.querySelectorAll('.drag-over, .drag-over-item').forEach(el => {
            el.classList.remove('drag-over', 'drag-over-item');
          });
        });

        // Reordering support when dropping directly onto an active card
        if (card.classList.contains('mode-active')) {
          card.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (this.draggedToolId && this.draggedToolId !== card.dataset.toolId) {
              card.classList.add('drag-over-item');
            }
          });

          card.addEventListener('dragleave', (e) => {
            e.stopPropagation();
            card.classList.remove('drag-over-item');
          });

          card.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            card.classList.remove('drag-over-item');
            const sourceId = e.dataTransfer.getData('text/plain') || this.draggedToolId;
            const targetId = card.dataset.toolId;
            if (!sourceId || !targetId || sourceId === targetId) return;

            if (this.extraTools.includes(sourceId)) {
              this.moveToActive(sourceId, targetId);
            } else {
              this.reorderActive(sourceId, targetId);
            }
          });
        }
      });

      // Active Tools Container drop zone
      const activeZone = document.getElementById('customizer-active-tools-container');
      if (activeZone) {
        activeZone.addEventListener('dragover', (e) => {
          e.preventDefault();
          activeZone.classList.add('drag-over');
        });
        activeZone.addEventListener('dragleave', () => {
          activeZone.classList.remove('drag-over');
        });
        activeZone.addEventListener('drop', (e) => {
          e.preventDefault();
          activeZone.classList.remove('drag-over');
          const toolId = e.dataTransfer.getData('text/plain') || this.draggedToolId;
          if (toolId && this.extraTools.includes(toolId)) {
            this.moveToActive(toolId);
          }
        });
      }

      // Extra Tools Container drop zone
      const extraZone = document.getElementById('customizer-extra-tools-container');
      if (extraZone) {
        extraZone.addEventListener('dragover', (e) => {
          e.preventDefault();
          extraZone.classList.add('drag-over');
        });
        extraZone.addEventListener('dragleave', () => {
          extraZone.classList.remove('drag-over');
        });
        extraZone.addEventListener('drop', (e) => {
          e.preventDefault();
          extraZone.classList.remove('drag-over');
          const toolId = e.dataTransfer.getData('text/plain') || this.draggedToolId;
          if (toolId && this.activeTools.includes(toolId)) {
            this.moveToExtra(toolId);
          }
        });
      }
    }
  }

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      ToolbarCustomizerManager,
      ALL_TOOLBAR_TOOLS,
      TOOL_CATEGORIES
    };
  }

  global.ToolbarCustomizerManager = ToolbarCustomizerManager;
  global.ALL_TOOLBAR_TOOLS = ALL_TOOLBAR_TOOLS;
  global.TOOL_CATEGORIES = TOOL_CATEGORIES;

})(typeof window !== 'undefined' ? window : global);
