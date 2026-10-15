// js/recent-projects.js
// PixelForge Studio — Recent & Previous Projects Manager (Photoshop Parity)

class RecentProjectsManager {
  constructor(app = null) {
    this.app = app;
    this.storageKey = 'pixelforge_recent_projects_v1';
    this.recents = this.loadRecents();
  }

  loadRecents() {
    try {
      if (typeof localStorage === 'undefined') return [];
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.warn('Failed to parse recent projects from localStorage:', e);
      return [];
    }
  }

  saveRecents() {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.recents));
    } catch (e) {
      console.warn('Storage quota limit reached when saving recents, pruning thumbnails/oldest:', e);
      // Prune heavy thumbnail data or oldest items if localStorage quota is tight
      for (let i = this.recents.length - 1; i >= 0; i--) {
        if (this.recents[i].thumbnail && this.recents[i].thumbnail.length > 50000) {
          this.recents[i].thumbnail = '';
        }
      }
      while (this.recents.length > 6) {
        this.recents.pop();
      }
      try {
        localStorage.setItem(this.storageKey, JSON.stringify(this.recents));
      } catch (err) {}
    }
  }

  addProject(project) {
    if (!project) return;
    const id = project.id || 'proj_' + Date.now();
    const filePath = project.filePath || '';
    const name = project.name || (filePath ? filePath.split(/[\\/]/).pop() : 'Untitled Project');

    // Deduplicate existing entry by path or name
    const existingIdx = this.recents.findIndex(p => (filePath && p.filePath === filePath) || p.name === name);
    if (existingIdx !== -1) {
      this.recents.splice(existingIdx, 1);
    }

    const item = {
      id,
      name,
      filePath,
      width: project.width || 1920,
      height: project.height || 1080,
      layersCount: project.layersCount || 1,
      thumbnail: project.thumbnail || '',
      timestamp: project.timestamp || Date.now(),
      projectData: project.projectData || null
    };

    this.recents.unshift(item);
    if (this.recents.length > 20) {
      this.recents.pop();
    }
    this.saveRecents();
    this.renderUI();
  }

  removeProject(id) {
    this.recents = this.recents.filter(p => p.id !== id);
    this.saveRecents();
    this.renderUI();
  }

  clearAll() {
    this.recents = [];
    this.saveRecents();
    this.renderUI();
  }

  formatTimeAgo(timestamp) {
    if (!timestamp) return 'Recently';
    const elapsed = Math.floor((Date.now() - timestamp) / 1000);
    if (elapsed < 60) return 'Just now';
    if (elapsed < 3600) return `${Math.floor(elapsed / 60)} min ago`;
    if (elapsed < 86400) return `${Math.floor(elapsed / 3600)} hr ago`;
    const days = Math.floor(elapsed / 86400);
    if (days === 1) return 'Yesterday';
    if (days < 30) return `${days} days ago`;
    return new Date(timestamp).toLocaleDateString();
  }

  renderUI() {
    if (typeof document === 'undefined') return;
    const grid = document.getElementById('welcome-recents-grid');
    if (!grid) return;

    if (this.recents.length === 0) {
      grid.innerHTML = `
        <div class="welcome-recents-empty">
          <div class="recents-empty-icon">
            <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.6">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10 9 9 9 8 9"/>
            </svg>
          </div>
          <div class="recents-empty-text">
            <strong>No Previous Projects Yet</strong>
            <span>Projects you save or open will automatically appear here for fast one-click reopening</span>
          </div>
        </div>
      `;
      return;
    }

    grid.innerHTML = '';
    this.recents.forEach(item => {
      const card = document.createElement('div');
      card.className = 'recent-project-card';
      card.title = item.filePath ? `${item.name}\n${item.filePath}` : item.name;

      const thumbHtml = item.thumbnail
        ? `<img src="${item.thumbnail}" alt="${item.name}" class="recent-thumb-img" />`
        : `<div class="recent-thumb-placeholder">
             <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.8">
               <polygon points="12 2 2 7 12 12 22 7 12 2" fill="#3b82f6" stroke="#3b82f6"/>
               <polyline points="2 17 12 22 22 17" stroke="#60a5fa"/>
               <polyline points="2 12 12 17 22 12" stroke="#93c5fd"/>
             </svg>
           </div>`;

      const formatTag = item.name.toLowerCase().endsWith('.psd') ? 'PSD' : 'PFORGE';

      card.innerHTML = `
        <div class="recent-thumbnail-box">
          ${thumbHtml}
          <div class="recent-thumb-overlay">
            <span class="recent-open-action">Open Project</span>
          </div>
          <button class="btn-remove-recent" title="Remove from list">&times;</button>
          <span class="recent-badge-dims">${item.width} × ${item.height}</span>
        </div>
        <div class="recent-meta-box">
          <div class="recent-name-row">
            <span class="recent-title">${item.name}</span>
            <span class="recent-format-tag">${formatTag}</span>
          </div>
          <span class="recent-timestamp">${this.formatTimeAgo(item.timestamp)} • ${item.layersCount || 1} ${(item.layersCount === 1) ? 'layer' : 'layers'}</span>
        </div>
      `;

      // Remove button listener
      const removeBtn = card.querySelector('.btn-remove-recent');
      if (removeBtn) {
        removeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.removeProject(item.id);
        });
      }

      // Card click listener
      card.addEventListener('click', async () => {
        await this.openRecent(item);
      });

      grid.appendChild(card);
    });
  }

  async openRecent(item) {
    if (!this.app) return;
    try {
      // 1. Try reading from filePath if in Electron with native fs
      if (item.filePath && typeof window.require !== 'undefined') {
        const fs = window.require('fs');
        if (fs.existsSync(item.filePath)) {
          if (item.filePath.toLowerCase().endsWith('.psd')) {
            const buf = fs.readFileSync(item.filePath);
            this.app.loadProjectFromPsd(buf, item.name);
            this.app.documentName = item.name.replace(/\.[^.]+$/, '');
            this.app.documentPath = item.filePath;
            this.app.isDirty = false;
            this.app.hideWelcomeOverlay();
            this.app.showToast(`Opened recent: ${item.name}`);
            return;
          } else {
            const raw = fs.readFileSync(item.filePath, 'utf8');
            const data = JSON.parse(raw);
            this.app.loadProjectFromData(data);
            this.app.documentName = item.name.replace(/\.[^.]+$/, '');
            this.app.documentPath = item.filePath;
            this.app.isDirty = false;
            this.app.hideWelcomeOverlay();
            this.app.showToast(`Opened recent: ${item.name}`);
            return;
          }
        }
      }

      // 2. Fall back to cached projectData in item
      if (item.projectData) {
        this.app.loadProjectFromData(item.projectData);
        this.app.documentName = item.name.replace(/\.[^.]+$/, '');
        this.app.isDirty = false;
        this.app.hideWelcomeOverlay();
        this.app.showToast(`Opened recent: ${item.name}`);
        return;
      }

      this.app.showToast('Could not find project file on disk. File may have been moved or deleted.', 'error');
    } catch (err) {
      console.error('Failed to open recent project:', err);
      this.app.showToast('Failed to open project: ' + err.message, 'error');
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { RecentProjectsManager };
}
