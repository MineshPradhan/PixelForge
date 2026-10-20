/**
 * PixelForge Studio - Keyboard Shortcut Manager (Phase 13)
 * Full custom keyboard shortcut remapping, conflict detection, profile presets
 * (Photoshop Parity, GIMP, Clip Studio), and JSON import/export.
 */

(function (global) {
  'use strict';

  // Standard Photoshop default shortcut mapping with tiered hierarchy (Simple, Intermediate, Advanced)
  const PHOTOSHOP_DEFAULTS = {
    // ── Tools (Simple 1-Key Shortcuts) ──
    'tool.move': { key: 'v', modifiers: [], label: 'Move Tool', category: 'Tools', tier: 'Simple', desc: 'Select and move canvas layers and selections' },
    'tool.marquee': { key: 'm', modifiers: [], label: 'Rectangular Marquee', category: 'Tools', tier: 'Simple', desc: 'Make rectangular pixel selections' },
    'tool.marquee_ellipse': { key: 'm', modifiers: ['shift'], label: 'Elliptical Marquee', category: 'Tools', tier: 'Simple', desc: 'Make circular/elliptical selections' },
    'tool.lasso': { key: 'l', modifiers: [], label: 'Lasso Selection Tool', category: 'Tools', tier: 'Simple', desc: 'Draw freehand selection perimeter' },
    'tool.lasso_poly': { key: 'l', modifiers: ['shift'], label: 'Polygonal Lasso', category: 'Tools', tier: 'Intermediate', desc: 'Straight-line polygonal selection' },
    'tool.lasso_mag': { key: 'l', modifiers: ['alt'], label: 'Magnetic Lasso', category: 'Tools', tier: 'Intermediate', desc: 'Snap selection to high-contrast edges' },
    'tool.wand': { key: 'w', modifiers: [], label: 'Magic Wand Tool', category: 'Tools', tier: 'Simple', desc: 'Select contiguous pixel color regions' },
    'tool.select_object': { key: 'w', modifiers: ['shift'], label: 'Object Selection (AI)', category: 'Tools', tier: 'Intermediate', desc: 'Auto hover silhouette & subject segmentation' },
    'tool.crop': { key: 'c', modifiers: [], label: 'Crop Document Tool', category: 'Tools', tier: 'Simple', desc: 'Trim document boundaries and re-frame' },
    'tool.eyedropper': { key: 'i', modifiers: [], label: 'Eyedropper Sampler', category: 'Tools', tier: 'Simple', desc: 'Sample color values from canvas pixels' },
    'tool.spot_healing': { key: 'j', modifiers: [], label: 'Spot Healing Brush', category: 'Tools', tier: 'Simple', desc: 'Remove blemishes, dust and scratches' },
    'tool.patch': { key: 'j', modifiers: ['shift'], label: 'Patch Healing Tool', category: 'Tools', tier: 'Intermediate', desc: 'Heal selection using donor sample texture' },
    'tool.brush': { key: 'b', modifiers: [], label: 'Paintbrush Tool', category: 'Tools', tier: 'Simple', desc: 'Paint raster strokes with dynamics' },
    'tool.mixer_brush': { key: 'b', modifiers: ['shift'], label: 'Mixer Brush (Oils)', category: 'Tools', tier: 'Intermediate', desc: 'Blend canvas colors with realistic wetness' },
    'tool.pencil': { key: 'p', modifiers: ['shift'], label: 'Pencil Tool', category: 'Tools', tier: 'Simple', desc: 'Hard-edged 1-bit raster drawing' },
    'tool.clone_stamp': { key: 's', modifiers: [], label: 'Clone Stamp Tool', category: 'Tools', tier: 'Simple', desc: 'Duplicate sampled pixels with transform' },
    'tool.history_brush': { key: 'y', modifiers: [], label: 'History Brush Tool', category: 'Tools', tier: 'Intermediate', desc: 'Paint from previous undo states' },
    'tool.eraser': { key: 'e', modifiers: [], label: 'Eraser Tool', category: 'Tools', tier: 'Simple', desc: 'Erase pixels to transparency' },
    'tool.gradient': { key: 'g', modifiers: [], label: 'Gradient Tool', category: 'Tools', tier: 'Simple', desc: 'Draw linear, radial, and angle gradients' },
    'tool.bucket': { key: 'g', modifiers: ['shift'], label: 'Paint Bucket Tool', category: 'Tools', tier: 'Simple', desc: 'Fill contiguous regions with active color' },
    'tool.dodge': { key: 'o', modifiers: [], label: 'Dodge Tool (Lighten)', category: 'Tools', tier: 'Intermediate', desc: 'Selectively brighten image tones' },
    'tool.burn': { key: 'o', modifiers: ['shift'], label: 'Burn Tool (Darken)', category: 'Tools', tier: 'Intermediate', desc: 'Selectively darken shadow tones' },
    'tool.sponge': { key: 'o', modifiers: ['alt'], label: 'Sponge Tool (Saturate)', category: 'Tools', tier: 'Intermediate', desc: 'Adjust localized color saturation' },
    'tool.blur': { key: 'r', modifiers: [], label: 'Blur Tool (Soften)', category: 'Tools', tier: 'Intermediate', desc: 'Smooth and soften pixel details' },
    'tool.sharpen': { key: 'r', modifiers: ['shift'], label: 'Sharpen Tool (Contrast)', category: 'Tools', tier: 'Intermediate', desc: 'Increase local edge contrast' },
    'tool.smudge': { key: 'r', modifiers: ['alt'], label: 'Smudge Tool (Blend)', category: 'Tools', tier: 'Intermediate', desc: 'Smear and blend pixel colors' },
    'tool.pen': { key: 'p', modifiers: [], label: 'Bézier Pen Tool', category: 'Tools', tier: 'Simple', desc: 'Draw vector Bézier paths and curves' },
    'tool.path_select': { key: 'a', modifiers: [], label: 'Path Selection Tool', category: 'Tools', tier: 'Simple', desc: 'Transform entire vector paths (Black Arrow)' },
    'tool.direct_select': { key: 'a', modifiers: ['shift'], label: 'Direct Selection Tool', category: 'Tools', tier: 'Intermediate', desc: 'Select individual vector anchors (White Arrow)' },
    'tool.text': { key: 't', modifiers: [], label: 'Horizontal Type Tool', category: 'Tools', tier: 'Simple', desc: 'Create editable vector text typography' },
    'tool.shape': { key: 'u', modifiers: [], label: 'Vector Shape Tool', category: 'Tools', tier: 'Simple', desc: 'Draw rectangles, ellipses, and polygons' },
    'tool.hand': { key: 'h', modifiers: [], label: 'Hand / Pan Tool', category: 'Tools', tier: 'Simple', desc: 'Pan canvas workspace smoothly' },
    'tool.zoom': { key: 'z', modifiers: [], label: 'Zoom Tool', category: 'Tools', tier: 'Simple', desc: 'Magnify and inspect canvas pixels' },
    'tool.quick_mask': { key: 'q', modifiers: [], label: 'Quick Mask Mode Toggle', category: 'Tools', tier: 'Simple', desc: 'Paint ruby mask to sculpt selections' },

    // ── Brush Sizing & Swatches ──
    'brush.decrease': { key: '[', modifiers: [], label: 'Decrease Brush Size', category: 'Tools', tier: 'Simple', desc: 'Shrink brush diameter by 5px' },
    'brush.increase': { key: ']', modifiers: [], label: 'Increase Brush Size', category: 'Tools', tier: 'Simple', desc: 'Enlarge brush diameter by 5px' },
    'brush.soften': { key: '{', modifiers: [], label: 'Decrease Hardness', category: 'Tools', tier: 'Intermediate', desc: 'Soften brush stroke feathering' },
    'brush.harden': { key: '}', modifiers: [], label: 'Increase Hardness', category: 'Tools', tier: 'Intermediate', desc: 'Harden brush stroke edges' },
    'color.swap': { key: 'x', modifiers: [], label: 'Swap FG & BG Colors', category: 'Tools', tier: 'Simple', desc: 'Toggle foreground and background colors' },
    'color.default': { key: 'd', modifiers: [], label: 'Default B&W Colors', category: 'Tools', tier: 'Simple', desc: 'Reset to pure Black and White' },

    // ── File & Project Operations ──
    'file.new': { key: 'n', modifiers: ['ctrl'], label: 'New Canvas Document...', category: 'File', tier: 'Simple', desc: 'Create canvas with custom dimensions' },
    'file.open': { key: 'o', modifiers: ['ctrl'], label: 'Open Image / Project...', category: 'File', tier: 'Simple', desc: 'Open PSD, PForge, PNG, JPEG, SVG' },
    'file.save': { key: 's', modifiers: ['ctrl'], label: 'Quick Export PNG', category: 'File', tier: 'Simple', desc: 'Fast save active canvas as image' },
    'file.save_as': { key: 's', modifiers: ['ctrl', 'shift'], label: 'Save Native (.pforge)', category: 'File', tier: 'Intermediate', desc: 'Save all layers, masks, and metadata' },
    'file.export': { key: 'w', modifiers: ['ctrl', 'shift', 'alt'], label: 'Export As... (Multi-Asset)', category: 'File', tier: 'Advanced', desc: 'Multi-scale @1x, @2x, @3x export suite' },
    'file.batch': { key: 'b', modifiers: ['ctrl', 'alt'], label: 'Batch Processor...', category: 'File', tier: 'Advanced', desc: 'Convert and scale multiple images' },

    // ── Edit & Transformation ──
    'edit.undo': { key: 'z', modifiers: ['ctrl'], label: 'Undo Last Action', category: 'Edit', tier: 'Simple', desc: 'Step backwards in history stack' },
    'edit.redo': { key: 'z', modifiers: ['ctrl', 'shift'], label: 'Redo Action', category: 'Edit', tier: 'Simple', desc: 'Step forwards in history stack' },
    'edit.redo_alt': { key: 'y', modifiers: ['ctrl'], label: 'Redo (Secondary)', category: 'Edit', tier: 'Simple', desc: 'Windows alternate redo key' },
    'edit.cut': { key: 'x', modifiers: ['ctrl'], label: 'Cut Selection', category: 'Edit', tier: 'Simple', desc: 'Cut pixel selection to clipboard' },
    'edit.copy': { key: 'c', modifiers: ['ctrl'], label: 'Copy Selection', category: 'Edit', tier: 'Simple', desc: 'Copy selected pixels to clipboard' },
    'edit.paste': { key: 'v', modifiers: ['ctrl'], label: 'Paste Clipboard', category: 'Edit', tier: 'Simple', desc: 'Paste image data into new layer' },
    'edit.delete': { key: 'delete', modifiers: [], label: 'Clear / Delete Pixels', category: 'Edit', tier: 'Simple', desc: 'Delete active selection or clear layer' },
    'edit.transform': { key: 't', modifiers: ['ctrl'], label: 'Free Transform', category: 'Edit', tier: 'Simple', desc: 'Scale, rotate, and skew layer bounds' },
    'edit.mesh_warp': { key: 'w', modifiers: ['ctrl', 'shift'], label: 'Bézier Mesh Warp', category: 'Edit', tier: 'Intermediate', desc: 'Bend pixels using 3x3 control points' },
    'edit.split_warp': { key: 's', modifiers: ['ctrl', 'alt', 'shift'], label: 'Split Warp Subdivide', category: 'Edit', tier: 'Advanced', desc: 'Insert custom warp crosshairs and splits' },
    'edit.puppet_warp': { key: 'p', modifiers: ['ctrl', 'shift'], label: 'Puppet Warp Mesh', category: 'Edit', tier: 'Advanced', desc: 'Pin and deform subjects articulately' },
    'edit.content_aware': { key: 'f5', modifiers: ['shift'], label: 'Content-Aware Fill', category: 'Edit', tier: 'Intermediate', desc: 'Inpaint selection matching surroundings' },
    'edit.generative_fill': { key: 'g', modifiers: ['ctrl', 'alt'], label: '✨ AI Generative Fill', category: 'Edit', tier: 'Advanced', desc: 'Diffusion inpainting prompt synthesis' },
    'edit.commit': { key: 'enter', modifiers: [], label: 'Commit Transformation', category: 'Edit', tier: 'Simple', desc: 'Bake transformation or confirm dialog' },
    'edit.cancel': { key: 'escape', modifiers: [], label: 'Cancel Transformation', category: 'Edit', tier: 'Simple', desc: 'Discard transform or close overlay' },

    // ── Selection & Masking ──
    'select.all': { key: 'a', modifiers: ['ctrl'], label: 'Select All Pixels', category: 'Select', tier: 'Simple', desc: 'Set selection to entire canvas bounds' },
    'select.deselect': { key: 'd', modifiers: ['ctrl'], label: 'Deselect (Drop Marching Ants)', category: 'Select', tier: 'Simple', desc: 'Clear all active selection outlines' },
    'select.inverse': { key: 'i', modifiers: ['ctrl', 'shift'], label: 'Invert Selection', category: 'Select', tier: 'Simple', desc: 'Select unselected areas instead' },
    'select.color_range': { key: 'r', modifiers: ['ctrl', 'alt'], label: 'Color Range Selection...', category: 'Select', tier: 'Intermediate', desc: 'Select based on eyedropper and fuzziness' },
    'select.subject': { key: 's', modifiers: ['ctrl', 'alt'], label: 'Select Subject (AI)', category: 'Select', tier: 'Intermediate', desc: 'Automatic foreground subject detection' },
    'select.refine_edge': { key: 'r', modifiers: ['ctrl', 'alt', 'shift'], label: 'Select and Mask / Refine', category: 'Select', tier: 'Advanced', desc: 'Edge feathering, contrast, and decontamination' },

    // ── Layers & Hierarchy ──
    'layer.new': { key: 'n', modifiers: ['ctrl', 'shift'], label: 'Create New Layer', category: 'Layer', tier: 'Simple', desc: 'Insert blank transparent layer' },
    'layer.duplicate': { key: 'j', modifiers: ['ctrl'], label: 'Duplicate Active Layer', category: 'Layer', tier: 'Simple', desc: 'Clone active layer or selection into new layer' },
    'layer.group': { key: 'g', modifiers: ['ctrl'], label: 'Group Selected Layers', category: 'Layer', tier: 'Simple', desc: 'Organize layers into a collapsible group folder' },
    'layer.ungroup': { key: 'g', modifiers: ['ctrl', 'shift'], label: 'Ungroup Layers Folder', category: 'Layer', tier: 'Simple', desc: 'Flatten folder hierarchy' },
    'layer.clipping_mask': { key: 'g', modifiers: ['ctrl', 'alt'], label: 'Toggle Clipping Mask', category: 'Layer', tier: 'Intermediate', desc: 'Clip layer visibility to layer underneath' },
    'layer.merge_down': { key: 'e', modifiers: ['ctrl'], label: 'Merge Layer Down', category: 'Layer', tier: 'Simple', desc: 'Combine with immediate layer below' },
    'layer.merge_visible': { key: 'e', modifiers: ['ctrl', 'shift'], label: 'Merge Visible Layers', category: 'Layer', tier: 'Intermediate', desc: 'Flatten all visible layers' },
    'layer.stamp_visible': { key: 'e', modifiers: ['ctrl', 'alt', 'shift'], label: 'Stamp Visible (Stamp New)', category: 'Layer', tier: 'Advanced', desc: 'Composite visible layers into a brand new layer' },
    'layer.isolate': { key: 'i', modifiers: ['ctrl', 'alt'], label: 'Toggle Isolation Mode', category: 'Layer', tier: 'Intermediate', desc: 'Focus editing exclusively on one layer' },
    'layer.smart_object': { key: 'o', modifiers: ['ctrl', 'alt'], label: 'Convert to Smart Object', category: 'Layer', tier: 'Advanced', desc: 'Non-destructive resolution independent wrapper' },

    // ── Image Adjustments & Optics ──
    'adjust.curves': { key: 'm', modifiers: ['ctrl'], label: 'Curves & Histogram...', category: 'Image', tier: 'Intermediate', desc: 'Spline curve tone and color grading' },
    'adjust.levels': { key: 'l', modifiers: ['ctrl'], label: 'Levels Mapping...', category: 'Image', tier: 'Intermediate', desc: 'Black, gamma, and white threshold sliders' },
    'adjust.hue_sat': { key: 'u', modifiers: ['ctrl'], label: 'Hue & Saturation...', category: 'Image', tier: 'Intermediate', desc: 'Color tint, vibrance, and lightness tuning' },
    'adjust.color_balance': { key: 'b', modifiers: ['ctrl'], label: 'Color Balance...', category: 'Image', tier: 'Intermediate', desc: 'Shift cyan/red, magenta/green, yellow/blue' },
    'adjust.invert': { key: 'i', modifiers: ['ctrl'], label: 'Invert Color / Mask Pixels', category: 'Image', tier: 'Simple', desc: 'Negative film color photographic inversion' },
    'adjust.camera_raw': { key: 'a', modifiers: ['ctrl', 'shift'], label: 'Camera Raw Suite...', category: 'Image', tier: 'Advanced', desc: 'Temperature, dehaze, clarity, and film tone' },
    'adjust.lut': { key: 'l', modifiers: ['ctrl', 'alt'], label: 'Color Lookup Table (3D LUT)', category: 'Image', tier: 'Advanced', desc: 'Cinematic Hollywood 3D .CUBE grading' },
    'filter.liquify': { key: 'x', modifiers: ['ctrl', 'shift'], label: 'Liquify Mesh Distortion...', category: 'Image', tier: 'Advanced', desc: 'Push, pucker, bloat, and reconstruct facial features' },
    'filter.lens_correction': { key: 'r', modifiers: ['ctrl', 'shift'], label: 'Lens Optics & Defringing...', category: 'Image', tier: 'Advanced', desc: 'Correct barrel/pincushion and chromatic abberation' },
    'filter.lighting_effects': { key: 'e', modifiers: ['ctrl', 'alt'], label: '3D Lighting & Specular...', category: 'Image', tier: 'Advanced', desc: 'Place directional spotlights with Blinn-Phong shading' },
    'filter.focus_stack': { key: 'f', modifiers: ['ctrl', 'alt'], label: 'Auto-Blend Focus Stack...', category: 'Image', tier: 'Advanced', desc: 'Fuse depth slices into infinite depth-of-field' },

    // ── View & Canvas Controls ──
    'view.zoom_in': { key: '=', modifiers: ['ctrl'], label: 'Zoom In Viewport', category: 'View', tier: 'Simple', desc: 'Magnify canvas viewport' },
    'view.zoom_out': { key: '-', modifiers: ['ctrl'], label: 'Zoom Out Viewport', category: 'View', tier: 'Simple', desc: 'Reduce canvas viewport scale' },
    'view.fit': { key: '0', modifiers: ['ctrl'], label: 'Fit Canvas to Screen', category: 'View', tier: 'Simple', desc: 'Center and auto-scale document to fit window' },
    'view.actual': { key: '1', modifiers: ['ctrl'], label: 'Actual 100% Pixel Size', category: 'View', tier: 'Simple', desc: '1:1 screen-to-canvas pixel mapping' },
    'view.rulers': { key: 'r', modifiers: ['ctrl'], label: 'Toggle Pixel Rulers', category: 'View', tier: 'Simple', desc: 'Display precision top and left pixel tick rulers' },
    'view.grid': { key: "'", modifiers: ['ctrl'], label: 'Toggle Alignment Grid', category: 'View', tier: 'Simple', desc: 'Checkerboard overlay alignment grid' },
    'view.guides': { key: ';', modifiers: ['ctrl'], label: 'Toggle Visual Guides', category: 'View', tier: 'Simple', desc: 'Show/hide user guide lines' },
    'view.lock_guides': { key: ';', modifiers: ['ctrl', 'alt'], label: 'Lock / Unlock Guides', category: 'View', tier: 'Simple', desc: 'Prevent accidental guide dragging' },
    'view.snapping': { key: ';', modifiers: ['ctrl', 'shift'], label: 'Toggle Magnetic Snapping', category: 'View', tier: 'Simple', desc: 'Snap bounds to canvas center and guides' },
    'view.soft_proof': { key: 'y', modifiers: ['ctrl'], label: 'Toggle CMYK Soft-Proof', category: 'View', tier: 'Intermediate', desc: 'Simulate pre-press offset print color output' },
    'view.gamut_warning': { key: 'y', modifiers: ['ctrl', 'shift'], label: 'Toggle Gamut Warning', category: 'View', tier: 'Intermediate', desc: 'Highlight out-of-gamut pre-press colors' },

    // ── Window & Studio Workspaces ──
    'window.toolbar_customizer': { key: 't', modifiers: ['ctrl', 'alt'], label: 'Customize Toolbar Table...', category: 'Tools', tier: 'Simple', desc: 'Open categorized tools table and drag-to-add drawer' },
    'window.shortcuts': { key: 'k', modifiers: ['ctrl', 'alt', 'shift'], label: 'Keyboard Shortcuts Reference...', category: 'Window', tier: 'Simple', desc: 'Browse and remap all shortcut keys' },
    'window.actions': { key: 'f9', modifiers: ['alt'], label: 'Actions / Macros Palette', category: 'Window', tier: 'Intermediate', desc: 'Record and playback repetitive automation macros' },
    'window.console': { key: '`', modifiers: ['ctrl'], label: 'Scripting Console (JS)', category: 'Window', tier: 'Advanced', desc: 'Execute live JavaScript commands against document API' }
  };

  // Alternative GIMP profile mapping
  const GIMP_DEFAULTS = {
    ...PHOTOSHOP_DEFAULTS,
    'tool.marquee': { key: 'r', modifiers: [], label: 'Rectangle Select', category: 'Tools', tier: 'Simple', desc: 'GIMP rectangular selection' },
    'tool.lasso': { key: 'f', modifiers: [], label: 'Free Select', category: 'Tools', tier: 'Simple', desc: 'GIMP freehand selection' },
    'tool.brush': { key: 'p', modifiers: [], label: 'Paintbrush', category: 'Tools', tier: 'Simple', desc: 'GIMP paintbrush tool' },
    'tool.eraser': { key: 'e', modifiers: ['shift'], label: 'Eraser', category: 'Tools', tier: 'Simple', desc: 'GIMP shift-eraser' },
    'tool.gradient': { key: 'b', modifiers: ['shift'], label: 'Bucket / Gradient', category: 'Tools', tier: 'Simple', desc: 'GIMP bucket fill' },
    'tool.text': { key: 't', modifiers: [], label: 'Text', category: 'Tools', tier: 'Simple', desc: 'GIMP text tool' }
  };

  class ShortcutManager {
    constructor(options = {}) {
      if (typeof options.isMac === 'boolean') {
        this.isMac = options.isMac;
      } else if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
        // In browser or Electron renderer window environments, detect macOS from navigator
        this.isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform) || /Macintosh/.test(navigator.userAgent);
      } else {
        // In Node.js / headless CI test environments (where global.navigator exists in Node 21+),
        // default to standard representation to ensure deterministic cross-platform unit test assertions
        this.isMac = false;
      }
      this.currentProfile = 'photoshop';
      this.shortcuts = {};
      this.listeners = new Map();
      this.STORAGE_KEY = 'pixelforge_custom_shortcuts';

      this.loadProfile('photoshop');
      this.loadFromStorage();
    }

    /**
     * Format keystroke identifier (e.g., 'ctrl+shift+z' or 'v')
     */
    buildComboString(key, modifiers = []) {
      const parts = [];
      const mods = modifiers.map(m => m.toLowerCase());
      if (mods.includes('ctrl') || mods.includes('control') || mods.includes('meta')) parts.push('ctrl');
      if (mods.includes('alt')) parts.push('alt');
      if (mods.includes('shift')) parts.push('shift');
      parts.push(key.toLowerCase());
      return parts.join('+');
    }

    /**
     * Load presets profile
     */
    loadProfile(profileName) {
      this.currentProfile = profileName;
      const base = profileName === 'gimp' ? GIMP_DEFAULTS : PHOTOSHOP_DEFAULTS;
      this.shortcuts = JSON.parse(JSON.stringify(base));
    }

    /**
     * Assign or remap a shortcut with conflict checking
     */
    setShortcut(actionId, key, modifiers = []) {
      const newCombo = this.buildComboString(key, modifiers);

      // Check conflict
      const conflictAction = this.findActionByCombo(newCombo);
      let conflict = null;
      if (conflictAction && conflictAction !== actionId) {
        conflict = {
          actionId: conflictAction,
          label: this.shortcuts[conflictAction]?.label || conflictAction
        };
      }

      if (!this.shortcuts[actionId]) {
        this.shortcuts[actionId] = {
          key: key.toLowerCase(),
          modifiers: [...modifiers],
          label: actionId,
          category: 'Custom'
        };
      } else {
        this.shortcuts[actionId].key = key.toLowerCase();
        this.shortcuts[actionId].modifiers = [...modifiers];
      }

      this.saveToStorage();
      return { success: true, conflict };
    }

    /**
     * Find if any action currently uses a key combination
     */
    findActionByCombo(combo) {
      for (const [actionId, item] of Object.entries(this.shortcuts)) {
        if (this.buildComboString(item.key, item.modifiers) === combo) {
          return actionId;
        }
      }
      return null;
    }

    /**
     * Look up action from KeyboardEvent
     */
    getActionFromEvent(event) {
      const modifiers = [];
      if (event.ctrlKey || event.metaKey) modifiers.push('ctrl');
      if (event.altKey) modifiers.push('alt');
      if (event.shiftKey) modifiers.push('shift');

      const key = event.key.toLowerCase();
      const combo = this.buildComboString(key, modifiers);
      return this.findActionByCombo(combo);
    }

    /**
     * Get display text for a shortcut (e.g. "Ctrl+Shift+Z" on Windows/Linux or "⌘⇧Z" on macOS)
     */
    getShortcutDisplay(actionId, options = {}) {
      const sc = this.shortcuts[actionId];
      if (!sc) return '';
      const parts = [];
      const useMacGlyphs = options.platform === 'mac' || (options.platform === undefined && this.isMac && options.nativeSymbols !== false);
      if (useMacGlyphs) {
        if (sc.modifiers.includes('ctrl')) parts.push('⌘');
        if (sc.modifiers.includes('alt')) parts.push('⌥');
        if (sc.modifiers.includes('shift')) parts.push('⇧');
        parts.push(sc.key.toUpperCase());
        return parts.join('');
      } else {
        if (sc.modifiers.includes('ctrl')) parts.push('Ctrl');
        if (sc.modifiers.includes('alt')) parts.push('Alt');
        if (sc.modifiers.includes('shift')) parts.push('Shift');
        parts.push(sc.key.toUpperCase());
        return parts.join('+');
      }
    }

    /**
     * Get platform-canonical standard shortcut string (e.g., 'Ctrl+Shift+Z')
     */
    getStandardShortcutDisplay(actionId) {
      return this.getShortcutDisplay(actionId, { platform: 'standard' });
    }

    /**
     * Get macOS-specific glyph shortcut string (e.g., '⌘⇧Z')
     */
    getMacShortcutDisplay(actionId) {
      return this.getShortcutDisplay(actionId, { platform: 'mac' });
    }

    /**
     * Search shortcuts by query and optional category filter
     */
    search(query = '', category = 'all') {
      const q = (query || '').toLowerCase().trim();
      let entries = Object.entries(this.shortcuts);

      if (category && category !== 'all') {
        const catLower = category.toLowerCase();
        entries = entries.filter(([_, item]) => {
          if (catLower === 'advanced') return (item.tier || '').toLowerCase() === 'advanced';
          return (item.category || '').toLowerCase() === catLower;
        });
      }

      if (!q) return entries;

      return entries.filter(([actionId, item]) => {
        return actionId.toLowerCase().includes(q) ||
               (item.label || '').toLowerCase().includes(q) ||
               (item.category || '').toLowerCase().includes(q) ||
               (item.tier || '').toLowerCase().includes(q) ||
               (item.desc || '').toLowerCase().includes(q) ||
               this.buildComboString(item.key, item.modifiers).includes(q);
      });
    }

    /**
     * Export all mappings as JSON string
     */
    exportJSON() {
      return JSON.stringify({
        version: '1.0',
        profile: this.currentProfile,
        shortcuts: this.shortcuts
      }, null, 2);
    }

    /**
     * Import JSON mappings
     */
    importJSON(jsonString) {
      try {
        const parsed = JSON.parse(jsonString);
        if (parsed && parsed.shortcuts) {
          this.shortcuts = { ...this.shortcuts, ...parsed.shortcuts };
          if (parsed.profile) this.currentProfile = parsed.profile;
          this.saveToStorage();
          return true;
        }
      } catch (e) {
        console.error('Failed to import shortcuts:', e);
      }
      return false;
    }

    /**
     * Reset to default profile
     */
    resetDefaults() {
      this.loadProfile('photoshop');
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(this.STORAGE_KEY);
      }
    }

    saveToStorage() {
      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem(this.STORAGE_KEY, JSON.stringify({
            profile: this.currentProfile,
            shortcuts: this.shortcuts
          }));
        } catch (e) {}
      }
    }

    loadFromStorage() {
      if (typeof localStorage !== 'undefined') {
        try {
          const saved = localStorage.getItem(this.STORAGE_KEY);
          if (saved) {
            const data = JSON.parse(saved);
            if (data.profile) this.currentProfile = data.profile;
            const base = this.currentProfile === 'gimp' ? GIMP_DEFAULTS : PHOTOSHOP_DEFAULTS;
            this.shortcuts = { ...JSON.parse(JSON.stringify(base)), ...(data.shortcuts || {}) };
          }
        } catch (e) {}
      }
    }
  }

  // Export
  global.ShortcutManager = ShortcutManager;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ShortcutManager, PHOTOSHOP_DEFAULTS, GIMP_DEFAULTS };
  }
})(typeof window !== 'undefined' ? window : globalThis);
