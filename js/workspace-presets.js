/**
 * PixelForge Studio - Workspace Layout Presets Manager (Phase 13)
 * Dynamic studio layout switching, panel docking states, and custom workflow presets:
 * Essentials, Photography, Digital Painting, Graphic Design, and Motion/Animation.
 */

(function (global) {
  'use strict';

  const WORKSPACE_PRESETS = {
    essentials: {
      id: 'essentials',
      name: 'Essentials (Default)',
      description: 'Balanced studio workspace for general editing, layers, and composition.',
      panels: {
        'panel-layers': true,
        'panel-history': true,
        'panel-navigator': true,
        'panel-properties': true,
        'panel-adjustments': false,
        'panel-channels': false,
        'panel-paths': false,
        'panel-brushes': false,
        'panel-swatches': true,
        'panel-timeline': false,
        'panel-glyphs': false,
        'contextual-taskbar': true
      },
      sidebarWidth: 320,
      activeRightTab: 'layers'
    },

    photography: {
      id: 'photography',
      name: 'Photography',
      description: 'Focused on photo retouching, color grading, adjustments, and histogram.',
      panels: {
        'panel-layers': true,
        'panel-history': true,
        'panel-navigator': true,
        'panel-properties': true,
        'panel-adjustments': true,
        'panel-channels': true,
        'panel-paths': false,
        'panel-brushes': false,
        'panel-swatches': false,
        'panel-timeline': false,
        'panel-glyphs': false,
        'contextual-taskbar': true
      },
      sidebarWidth: 360,
      activeRightTab: 'adjustments'
    },

    painting: {
      id: 'painting',
      name: 'Digital Painting',
      description: 'Optimized for digital painters with swatches, brush dynamics, and mixer controls.',
      panels: {
        'panel-layers': true,
        'panel-history': true,
        'panel-navigator': true,
        'panel-properties': false,
        'panel-adjustments': false,
        'panel-channels': false,
        'panel-paths': false,
        'panel-brushes': true,
        'panel-swatches': true,
        'panel-timeline': false,
        'panel-glyphs': false,
        'contextual-taskbar': true
      },
      sidebarWidth: 340,
      activeRightTab: 'brushes'
    },

    graphic_design: {
      id: 'graphic_design',
      name: 'Graphic Design & Typography',
      description: 'Tailored for vectors, shapes, glyphs, type controls, and smart objects.',
      panels: {
        'panel-layers': true,
        'panel-history': true,
        'panel-navigator': false,
        'panel-properties': true,
        'panel-adjustments': false,
        'panel-channels': false,
        'panel-paths': true,
        'panel-brushes': false,
        'panel-swatches': true,
        'panel-timeline': false,
        'panel-glyphs': true,
        'contextual-taskbar': true
      },
      sidebarWidth: 350,
      activeRightTab: 'properties'
    },

    motion: {
      id: 'motion',
      name: 'Motion & Animation',
      description: 'Maximizes timeline and frame controls for video export and animated graphics.',
      panels: {
        'panel-layers': true,
        'panel-history': false,
        'panel-navigator': true,
        'panel-properties': true,
        'panel-adjustments': false,
        'panel-channels': false,
        'panel-paths': false,
        'panel-brushes': false,
        'panel-swatches': false,
        'panel-timeline': true,
        'panel-glyphs': false,
        'contextual-taskbar': true
      },
      sidebarWidth: 300,
      activeRightTab: 'layers'
    }
  };

  class WorkspaceManager {
    constructor() {
      this.currentPresetId = 'essentials';
      this.customPresets = {};
      this.STORAGE_KEY = 'pixelforge_workspace_presets';
      this.CURRENT_KEY = 'pixelforge_active_workspace';

      this.loadFromStorage();
    }

    /**
     * Get all presets (built-in + user custom)
     */
    getAllPresets() {
      return {
        ...WORKSPACE_PRESETS,
        ...this.customPresets
      };
    }

    /**
     * Get active preset config
     */
    getActivePreset() {
      const all = this.getAllPresets();
      return all[this.currentPresetId] || WORKSPACE_PRESETS.essentials;
    }

    /**
     * Apply a workspace preset to the UI
     */
    applyPreset(presetId) {
      const all = this.getAllPresets();
      const preset = all[presetId];
      if (!preset) return false;

      this.currentPresetId = presetId;
      if (typeof localStorage !== 'undefined') {
        try { localStorage.setItem(this.CURRENT_KEY, presetId); } catch (e) {}
      }

      if (typeof document === 'undefined') return true;

      // Adjust panel visibility
      if (preset.panels) {
        for (const [panelId, visible] of Object.entries(preset.panels)) {
          const el = document.getElementById(panelId);
          if (el) {
            el.style.display = visible ? '' : 'none';
          }
        }
      }

      // Adjust sidebar width if set
      if (preset.sidebarWidth) {
        const sidebar = document.getElementById('right-dock') || document.querySelector('.right-sidebar') || document.getElementById('right-sidebar');
        if (sidebar) {
          sidebar.style.width = `${preset.sidebarWidth}px`;
        }
      }

      // Switch active tab if tab switcher exists
      if (preset.activeRightTab) {
        const tabBtn = document.querySelector(`[data-tab="${preset.activeRightTab}"]`);
        if (tabBtn && typeof tabBtn.click === 'function') {
          tabBtn.click();
        }
      }

      // Update active workspace checkmark in Window -> Workspace menu if present
      document.querySelectorAll('.workspace-preset-item').forEach(item => {
        if (item.dataset.presetId === presetId) {
          item.classList.add('active');
        } else {
          item.classList.remove('active');
        }
      });

      return true;
    }

    /**
     * Save current UI state as custom user preset
     */
    saveCurrentAsPreset(id, name, description = '') {
      const panels = {};
      if (typeof document !== 'undefined') {
        const knownPanels = [
          'panel-layers', 'panel-history', 'panel-navigator', 'panel-properties',
          'panel-adjustments', 'panel-channels', 'panel-paths', 'panel-brushes',
          'panel-swatches', 'panel-timeline', 'panel-glyphs', 'contextual-taskbar'
        ];
        knownPanels.forEach(pid => {
          const el = document.getElementById(pid);
          panels[pid] = el ? el.style.display !== 'none' : true;
        });
      }

      const preset = {
        id: id || `custom_${Date.now()}`,
        name: name || 'Custom Workspace',
        description,
        panels,
        custom: true
      };

      this.customPresets[preset.id] = preset;
      this.saveToStorage();
      return preset;
    }

    saveToStorage() {
      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.customPresets));
        } catch (e) {}
      }
    }

    loadFromStorage() {
      if (typeof localStorage !== 'undefined') {
        try {
          const saved = localStorage.getItem(this.STORAGE_KEY);
          if (saved) this.customPresets = JSON.parse(saved);
          const active = localStorage.getItem(this.CURRENT_KEY);
          if (active && (WORKSPACE_PRESETS[active] || this.customPresets[active])) {
            this.currentPresetId = active;
          }
        } catch (e) {}
      }
    }
  }

  // Export
  global.WorkspaceManager = WorkspaceManager;
  global.WORKSPACE_PRESETS = WORKSPACE_PRESETS;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { WorkspaceManager, WORKSPACE_PRESETS };
  }
})(typeof window !== 'undefined' ? window : globalThis);
