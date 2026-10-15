// ══════════════════════════════════════════════════════════════════════
// PixelForge Studio — History & Undo/Redo Engine
// ══════════════════════════════════════════════════════════════════════

class HistoryManager {
  constructor(maxSteps = 40) {
    this.maxSteps = maxSteps;
    this.steps = [];
    this.currentIndex = -1;
    this.onStateChange = null;
  }

  createSnapshot(actionName, layerSnapshots, activeLayerId) {
    return {
      name: actionName,
      timestamp: Date.now(),
      activeLayerId,
      layers: layerSnapshots.map(layer => ({
        id: layer.id,
        name: layer.name,
        type: layer.type || 'raster',
        parentId: layer.parentId || null,
        collapsed: !!layer.collapsed,
        adjustmentType: layer.adjustmentType || null,
        adjustmentParams: layer.adjustmentParams ? JSON.parse(JSON.stringify(layer.adjustmentParams)) : null,
        textParams: layer.textParams ? JSON.parse(JSON.stringify(layer.textParams)) : null,
        visible: layer.visible,
        opacity: layer.opacity,
        blendMode: layer.blendMode,
        locked: !!layer.locked,
        lockAlpha: !!layer.lockAlpha,
        isClipped: !!layer.isClipped,
        colorTag: layer.colorTag || null,
        styles: layer.styles ? JSON.parse(JSON.stringify(layer.styles)) : null,
        hasMask: !!layer.hasMask,
        maskDisabled: !!layer.maskDisabled,
        isMaskActive: !!layer.isMaskActive,
        dataUrl: (layer.canvas && layer.type !== 'group') ? layer.canvas.toDataURL() : null,
        maskDataUrl: layer.hasMask && layer.maskCanvas ? layer.maskCanvas.toDataURL() : null
      }))
    };
  }

  // Push a new action step
  push(actionName, layerSnapshots, activeLayerId) {
    // If we branched from an earlier step, drop following steps
    if (this.currentIndex < this.steps.length - 1) {
      this.steps = this.steps.slice(0, this.currentIndex + 1);
    }

    const step = this.createSnapshot(actionName, layerSnapshots, activeLayerId);

    this.steps.push(step);
    if (this.steps.length > this.maxSteps) {
      this.steps.shift();
    }

    this.currentIndex = this.steps.length - 1;
    this.renderUI();
    if (this.onStateChange) this.onStateChange(step);
  }

  undo() {
    if (!this.canUndo()) return null;
    this.currentIndex--;
    const targetState = this.steps[this.currentIndex];
    this.renderUI();
    return targetState;
  }

  redo() {
    if (!this.canRedo()) return null;
    this.currentIndex++;
    const targetState = this.steps[this.currentIndex];
    this.renderUI();
    return targetState;
  }

  canUndo() {
    return this.currentIndex > 0;
  }

  canRedo() {
    return this.currentIndex < this.steps.length - 1;
  }

  jumpTo(index) {
    if (index >= 0 && index < this.steps.length) {
      this.currentIndex = index;
      const targetState = this.steps[this.currentIndex];
      this.renderUI();
      return targetState;
    }
    return null;
  }

  deleteStep(index) {
    if (index < 0 || index >= this.steps.length) return null;
    const [removed] = this.steps.splice(index, 1);
    let stateToRestore = null;

    if (this.steps.length === 0) {
      this.currentIndex = -1;
    } else if (index === this.currentIndex) {
      this.currentIndex = Math.max(0, this.currentIndex - 1);
      stateToRestore = this.steps[this.currentIndex];
    } else if (index < this.currentIndex) {
      this.currentIndex--;
    }

    this.renderUI();
    if (this.onStateChange && stateToRestore) this.onStateChange(stateToRestore);
    return { removed, stateToRestore };
  }

  deleteSubsequentSteps(index) {
    if (index < 0 || index >= this.steps.length) return null;
    this.steps = this.steps.slice(0, index + 1);
    let stateToRestore = null;
    if (this.currentIndex > index) {
      this.currentIndex = index;
      stateToRestore = this.steps[this.currentIndex];
      if (this.onStateChange) this.onStateChange(stateToRestore);
    }
    this.renderUI();
    return stateToRestore;
  }

  clear() {
    this.steps = [];
    this.currentIndex = -1;
    this.renderUI();
  }

  clearAll(activeSnapshot = null) {
    if (activeSnapshot) {
      this.steps = [activeSnapshot];
      this.currentIndex = 0;
    } else {
      this.steps = [];
      this.currentIndex = -1;
    }
    this.renderUI();
  }

  renderUI() {
    if (typeof document === 'undefined') return;
    const listEl = document.getElementById('history-steps-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    if (this.steps.length === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.className = 'history-empty-msg';
      emptyMsg.style.padding = '12px 10px';
      emptyMsg.style.fontSize = '11px';
      emptyMsg.style.color = 'var(--text-dim)';
      emptyMsg.style.fontStyle = 'italic';
      emptyMsg.style.textAlign = 'center';
      emptyMsg.textContent = 'No history states recorded';
      listEl.appendChild(emptyMsg);
      return;
    }

    this.steps.forEach((step, idx) => {
      const item = document.createElement('div');
      item.className = 'history-step-item';
      if (idx === this.currentIndex) item.classList.add('active');
      if (idx > this.currentIndex) item.classList.add('undone');
      item.dataset.index = idx;
      item.title = `${step.name} (Right-click to delete)`;

      item.innerHTML = `
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="1 4 1 10 7 10"/>
          <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
        </svg>
        <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${step.name}</span>
        <button class="history-delete-quick-btn" title="Delete this state" style="background:none; border:none; color:var(--text-dim); cursor:pointer; padding:2px; display:none; align-items:center; opacity:0.7;">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      `;

      // Show quick delete on hover
      const delBtn = item.querySelector('.history-delete-quick-btn');
      item.addEventListener('mouseenter', () => {
        if (delBtn) delBtn.style.display = 'inline-flex';
      });
      item.addEventListener('mouseleave', () => {
        if (delBtn) delBtn.style.display = 'none';
      });

      if (delBtn) {
        delBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (window.app?.openHistoryConfirmModal) {
            window.app.openHistoryConfirmModal('delete-single', step, idx);
          }
        });
      }

      item.addEventListener('click', () => {
        if (window.app) {
          const state = this.jumpTo(idx);
          if (state) window.app.restoreState(state);
        }
      });

      // Right-click context menu
      item.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (window.app?.showHistoryContextMenu) {
          window.app.showHistoryContextMenu(e.clientX, e.clientY, idx, step);
        }
      });

      listEl.appendChild(item);
    });

    // Right-click on empty area of list
    listEl.oncontextmenu = (e) => {
      if (e.target === listEl || e.target.classList.contains('history-empty-msg')) {
        e.preventDefault();
        if (window.app?.showHistoryContextMenu) {
          window.app.showHistoryContextMenu(e.clientX, e.clientY, -1, null);
        }
      }
    };

    // Auto scroll to active step
    const activeEl = listEl.querySelector('.history-step-item.active');
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' });
    } else {
      listEl.scrollTop = listEl.scrollHeight;
    }
  }
}

if (typeof window !== 'undefined') {
  window.HistoryManager = HistoryManager;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = HistoryManager;
}
