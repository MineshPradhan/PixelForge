/**
 * PixelForge Studio Pro — Contextual Task Bar HUD
 *
 * Implements Adobe Photoshop 2024–2026 Contextual Task Bar Parity:
 * 1. Floating pill HUD widget dynamically tracking active context (Selection, Text, Transform, Crop, Layer)
 * 2. Surfaces top 4-6 most statistically relevant immediate actions directly on canvas
 * 3. Smooth canvas-to-viewport coordinate tracking anchored just beneath active selection bounding box
 * 4. Draggable positioning, pin/unpin docking, and show/hide toggles
 */

class ContextualTaskBar {
    constructor(app = null) {
        this.app = app;
        this.el = null;
        this.isPinned = false;
        this.isDragging = false;
        this.isMinimized = false;
        this.dragOffset = { x: 0, y: 0 };
        this.visible = true;
        this.currentMode = 'default'; // 'selection' | 'text' | 'transform' | 'crop' | 'default'

        this.init();
    }

    init() {
        if (typeof document === 'undefined') return;

        this.el = document.getElementById('contextual-taskbar');
        if (!this.el) {
            this.el = document.createElement('div');
            this.el.id = 'contextual-taskbar';
            this.el.className = 'contextual-taskbar';
            document.body.appendChild(this.el);
        }

        this.bindDrag();
        this.update();
    }

    bindDrag() {
        if (!this.el) return;

        let startX = 0, startY = 0;
        let initialLeft = 0, initialTop = 0;

        const onMouseDown = (e) => {
            if (e.target.closest('button, select, input, .taskbar-minimized-pill')) return;
            this.isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            const rect = this.el.getBoundingClientRect();
            initialLeft = rect.left;
            initialTop = rect.top;

            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
        };

        const onMouseMove = (e) => {
            if (!this.isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            this.el.style.left = `${initialLeft + dx}px`;
            this.el.style.top = `${initialTop + dy}px`;
            this.el.style.bottom = 'auto';
            this.el.style.transform = 'none';
            this.isPinned = true;
        };

        const onMouseUp = () => {
            this.isDragging = false;
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };

        this.el.addEventListener('mousedown', onMouseDown);
    }

    update() {
        if (!this.app) return;

        const toolMgr = this.app.toolManager;
        const layerMgr = this.app.layerManager;
        const activeLayer = layerMgr ? layerMgr.getActiveLayer() : null;
        const hasSelection = toolMgr && toolMgr.selection && toolMgr.selection.w > 0 && toolMgr.selection.h > 0;
        const isTransform = toolMgr && toolMgr.isTransforming;
        const isText = (toolMgr && toolMgr.currentTool === 'text') || (activeLayer && activeLayer.type === 'text');

        let mode = 'default';
        if (isTransform) {
            mode = 'transform';
        } else if (hasSelection) {
            mode = 'selection';
        } else if (isText) {
            mode = 'text';
        }

        this.currentMode = mode;
        if (this.el) {
            this.renderContent(mode, activeLayer, toolMgr);
            this.positionBar(hasSelection ? toolMgr.selection : null);
        }
    }

    renderContent(mode, activeLayer, toolMgr) {
        if (!this.el) return;

        if (this.isMinimized) {
            this.el.classList.add('is-minimized');
            this.el.innerHTML = `
                <div class="taskbar-minimized-pill" id="tb-expand-pill" title="Click to open / expand Contextual Task Bar">
                    <span class="sparkle-icon">✨</span>
                    <span>Contextual Task Bar</span>
                    <span class="taskbar-expand-hint">▲ Expand</span>
                </div>
            `;
            const expandPill = this.el.querySelector('#tb-expand-pill');
            if (expandPill) {
                expandPill.onclick = (e) => {
                    e.stopPropagation();
                    this.isMinimized = false;
                    this.update();
                };
            }
            return;
        }

        this.el.classList.remove('is-minimized');

        let html = `<div class="taskbar-drag-handle" title="Drag to reposition">⋮⋮</div>`;

        switch (mode) {
            case 'selection':
                html += `
                    <button class="taskbar-btn taskbar-btn-primary" id="tb-gen-fill">
                        <span class="sparkle-icon">✨</span> Generative Fill
                    </button>
                    <div class="taskbar-divider"></div>
                    <button class="taskbar-btn" id="tb-refine-edge">Select & Mask</button>
                    <button class="taskbar-btn" id="tb-invert-sel">Invert</button>
                    <button class="taskbar-btn" id="tb-fill-sel">Fill...</button>
                    <button class="taskbar-btn taskbar-btn-ghost" id="tb-deselect">Deselect (Ctrl+D)</button>
                `;
                break;

            case 'text':
                const font = activeLayer && activeLayer.textParams ? activeLayer.textParams.family : 'Inter';
                const size = activeLayer && activeLayer.textParams ? activeLayer.textParams.size : 36;
                const color = activeLayer && activeLayer.textParams ? activeLayer.textParams.color : '#ffffff';
                html += `
                    <span class="taskbar-label">Text:</span>
                    <select class="taskbar-select" id="tb-text-font">
                        <option value="Inter" ${font.includes('Inter') ? 'selected' : ''}>Inter</option>
                        <option value="Arial" ${font.includes('Arial') ? 'selected' : ''}>Arial</option>
                        <option value="Georgia" ${font.includes('Georgia') ? 'selected' : ''}>Georgia</option>
                        <option value="Impact" ${font.includes('Impact') ? 'selected' : ''}>Impact</option>
                    </select>
                    <input type="number" class="taskbar-num" id="tb-text-size" value="${size}" min="8" max="250" style="width: 50px;"> px
                    <input type="color" class="taskbar-color" id="tb-text-color" value="${color}">
                    <div class="taskbar-divider"></div>
                    <button class="taskbar-btn" id="tb-text-glyphs" title="Insert Special Glyphs">Ω Glyphs</button>
                    <button class="taskbar-btn taskbar-btn-primary" id="tb-commit-text">✓ Commit</button>
                `;
                break;

            case 'transform':
                html += `
                    <span class="taskbar-label">Transform:</span>
                    <button class="taskbar-btn" id="tb-flip-h" title="Flip Horizontal">⇄ Flip H</button>
                    <button class="taskbar-btn" id="tb-flip-v" title="Flip Vertical">⇅ Flip V</button>
                    <div class="taskbar-divider"></div>
                    <button class="taskbar-btn taskbar-btn-ghost" id="tb-cancel-transform">✕ Cancel</button>
                    <button class="taskbar-btn taskbar-btn-primary" id="tb-commit-transform">✓ Commit (Enter)</button>
                `;
                break;

            case 'default':
            default:
                const name = activeLayer ? activeLayer.name : 'Canvas';
                html += `
                    <span class="taskbar-label" title="${name}">Layer: <b>${name.length > 14 ? name.substring(0, 12) + '...' : name}</b></span>
                    <div class="taskbar-divider"></div>
                    <button class="taskbar-btn taskbar-btn-primary" id="tb-select-subject" title="One-Click Dominant Subject Detection"><span class="sparkle-icon">✨</span> Select Subject</button>
                    <button class="taskbar-btn" id="tb-object-select-tool" title="Manual Area Object Selection Tool (W)">🎯 Object Select</button>
                    <div class="taskbar-divider"></div>
                    <button class="taskbar-btn" id="tb-quick-components" title="Open Tool Components Drawer">🎛️ Tool Components</button>
                    <button class="taskbar-btn" id="tb-quick-shortcuts" title="View All Keyboard Shortcuts">★ All Shortcuts</button>
                    <button class="taskbar-btn" id="tb-new-layer">+ New Layer</button>
                    <button class="taskbar-btn" id="tb-dup-layer">Duplicate</button>
                    <button class="taskbar-btn" id="tb-quick-camraw">Camera Raw</button>
                    <button class="taskbar-btn" id="tb-quick-oilpaint">Oil Paint</button>
                `;
                break;
        }

        html += `
            <div class="taskbar-divider"></div>
            <button class="taskbar-pin-btn" id="tb-pin-toggle" title="${this.isPinned ? 'Unpin (Auto-track)' : 'Pin position'}">
                ${this.isPinned ? '📌' : '📍'}
            </button>
            <button class="taskbar-pin-btn" id="tb-min-toggle" title="Minimize Bar">━</button>
        `;

        this.el.innerHTML = html;
        this.bindEvents(mode);
    }

    bindEvents(mode) {
        if (!this.el || !this.app) return;

        // Pin toggle
        const pinBtn = this.el.querySelector('#tb-pin-toggle');
        if (pinBtn) {
            pinBtn.onclick = () => {
                this.isPinned = !this.isPinned;
                if (!this.isPinned) {
                    this.el.style.left = '50%';
                    this.el.style.top = 'auto';
                    this.el.style.bottom = '40px';
                    this.el.style.transform = 'translateX(-50%)';
                }
                this.update();
            };
        }

        // Selection actions
        const genFillBtn = this.el.querySelector('#tb-gen-fill');
        if (genFillBtn) {
            genFillBtn.onclick = () => {
                if (this.app.openGenerativeFillModal) this.app.openGenerativeFillModal();
            };
        }
        const refineEdgeBtn = this.el.querySelector('#tb-refine-edge');
        if (refineEdgeBtn) {
            refineEdgeBtn.onclick = () => {
                if (this.app.openRefineEdgeModal) this.app.openRefineEdgeModal();
            };
        }
        const invertSelBtn = this.el.querySelector('#tb-invert-sel');
        if (invertSelBtn) {
            invertSelBtn.onclick = () => {
                if (this.app.toolManager && this.app.toolManager.invertSelection) {
                    this.app.toolManager.invertSelection();
                }
            };
        }
        const fillSelBtn = this.el.querySelector('#tb-fill-sel');
        if (fillSelBtn) {
            fillSelBtn.onclick = () => {
                this.app.showModal('modal-content-aware-fill');
            };
        }
        const deselectBtn = this.el.querySelector('#tb-deselect');
        if (deselectBtn) {
            deselectBtn.onclick = () => {
                if (this.app.toolManager) this.app.toolManager.clearSelection();
                this.update();
            };
        }

        // Text actions
        const textFont = this.el.querySelector('#tb-text-font');
        const textSize = this.el.querySelector('#tb-text-size');
        const textColor = this.el.querySelector('#tb-text-color');
        const textGlyphs = this.el.querySelector('#tb-text-glyphs');
        const textCommit = this.el.querySelector('#tb-commit-text');

        if (textGlyphs) {
            textGlyphs.onclick = () => {
                if (this.app.openGlyphsPanel) this.app.openGlyphsPanel();
            };
        }
        if (textCommit) {
            textCommit.onclick = () => {
                const active = this.app.layerManager.getActiveLayer();
                if (active && active.type === 'text') {
                    if (textFont) active.textParams.family = textFont.value;
                    if (textSize) active.textParams.size = parseInt(textSize.value, 10);
                    if (textColor) active.textParams.color = textColor.value;
                    this.app.renderComposite();
                    this.app.pushHistoryState('Edit Text');
                }
                this.update();
            };
        }

        // Transform actions
        const flipH = this.el.querySelector('#tb-flip-h');
        const flipV = this.el.querySelector('#tb-flip-v');
        const commitTrans = this.el.querySelector('#tb-commit-transform');
        const cancelTrans = this.el.querySelector('#tb-cancel-transform');

        if (flipH) flipH.onclick = () => this.app.flipImage(true);
        if (flipV) flipV.onclick = () => this.app.flipImage(false);
        if (commitTrans) {
            commitTrans.onclick = () => {
                if (this.app.toolManager && this.app.toolManager.commitFreeTransform) {
                    this.app.toolManager.commitFreeTransform();
                }
                this.update();
            };
        }
        if (cancelTrans) {
            cancelTrans.onclick = () => {
                if (this.app.toolManager && this.app.toolManager.cancelFreeTransform) {
                    this.app.toolManager.cancelFreeTransform();
                }
                this.update();
            };
        }

        // Default actions
        const selSubBtn = this.el.querySelector('#tb-select-subject');
        const objSelBtn = this.el.querySelector('#tb-object-select-tool');
        const newLayer = this.el.querySelector('#tb-new-layer');
        const dupLayer = this.el.querySelector('#tb-dup-layer');
        const quickCam = this.el.querySelector('#tb-quick-camraw');
        const quickOil = this.el.querySelector('#tb-quick-oilpaint');
        const quickComp = this.el.querySelector('#tb-quick-components');
        const quickShortcuts = this.el.querySelector('#tb-quick-shortcuts');
        const minBtn = this.el.querySelector('#tb-min-toggle');

        if (selSubBtn) {
            selSubBtn.onclick = () => {
                if (this.app.toolManager && this.app.toolManager.selectSubject) {
                    this.app.toolManager.selectSubject();
                }
            };
        }
        if (objSelBtn) {
            objSelBtn.onclick = () => {
                if (this.app.toolManager && this.app.toolManager.setTool) {
                    this.app.toolManager.setTool('select-object');
                }
            };
        }

        if (newLayer) newLayer.onclick = () => this.app.handleMenuAction('new-layer');
        if (dupLayer) dupLayer.onclick = () => this.app.handleMenuAction('duplicate-layer');
        if (quickCam) quickCam.onclick = () => this.app.openCameraRawDialog();
        if (quickOil) quickOil.onclick = () => this.app.openOilPaintModal();
        if (quickComp) {
            quickComp.onclick = () => {
                if (this.app.toolbarCustomizer) {
                    this.app.toolbarCustomizer.toggleDrawer();
                }
            };
        }
        if (quickShortcuts) {
            quickShortcuts.onclick = () => {
                if (this.app.openKeyboardShortcutsModal) {
                    this.app.openKeyboardShortcutsModal();
                }
            };
        }
        if (minBtn) {
            minBtn.onclick = (e) => {
                e.stopPropagation();
                this.isMinimized = true;
                this.update();
            };
        }
    }

    positionBar(selection = null) {
        if (!this.el || this.isPinned || !this.app) return;

        const viewport = document.getElementById('viewport-container');
        if (!viewport) return;

        if (selection && selection.w > 0 && selection.h > 0) {
            // Anchor beneath selection
            const vpRect = viewport.getBoundingClientRect();
            const docX = selection.x + selection.w / 2;
            const docY = selection.y + selection.h + 20;

            const zoom = this.app.zoom || 1.0;
            const panX = this.app.panX || 0;
            const panY = this.app.panY || 0;

            const screenX = vpRect.left + (vpRect.width / 2) + panX - (this.app.width * zoom / 2) + (docX * zoom);
            const screenY = vpRect.top + (vpRect.height / 2) + panY - (this.app.height * zoom / 2) + (docY * zoom);

            const clampedX = Math.max(220, Math.min(window.innerWidth - 300, screenX));
            const clampedY = Math.max(100, Math.min(window.innerHeight - 80, screenY));

            this.el.style.left = `${clampedX}px`;
            this.el.style.top = `${clampedY}px`;
            this.el.style.bottom = 'auto';
            this.el.style.transform = 'translate(-50%, 0)';
        } else {
            // Default bottom-center docking
            this.el.style.left = '50%';
            this.el.style.top = 'auto';
            this.el.style.bottom = '40px';
            this.el.style.transform = 'translateX(-50%)';
        }
    }
}

// Export for browser & Node
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ContextualTaskBar };
}
if (typeof window !== 'undefined') {
    window.ContextualTaskBar = ContextualTaskBar;
}
if (typeof global !== 'undefined') {
    global.ContextualTaskBar = ContextualTaskBar;
}
