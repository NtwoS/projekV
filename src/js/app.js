// Main Application Coordinator
class App {
  constructor() {
    this.toastTimeout = null;

    // DOM Elements
    this.emptyState = document.getElementById('emptyState');
    this.viewerArea = document.getElementById('viewerArea');
    this.bottomBar = document.getElementById('bottomBar');
    this.statsBar = document.getElementById('statsBar');
    this.folderPathText = document.getElementById('folderPathText');
    this.toastNotification = document.getElementById('toastNotification');

    this.init();
  }

  async init() {
    this.initButtons();
    this.initDragAndDrop();
    this.initMenuListeners();

    if (window.keybindingsManager) {
      await window.keybindingsManager.init();
      this.updateToolbarKeyBadges();
      window.keybindingsManager.onChange(() => {
        this.updateToolbarKeyBadges();
      });
    }
  }

  initMenuListeners() {
    if (!window.electronAPI || !window.electronAPI.onMenuAction) return;

    window.electronAPI.onMenuAction((action) => {
      switch (action) {
        case 'open-folder':
          this.openFolderDialog();
          break;
        case 'open-export':
          if (window.exportManager) window.exportManager.openModal();
          break;
        case 'undo':
          if (window.selectionManager) window.selectionManager.undo();
          break;
        case 'mark-pick':
          if (window.selectionManager) window.selectionManager.mark('pick', true);
          break;
        case 'mark-reject':
          if (window.selectionManager) window.selectionManager.mark('reject', true);
          break;
        case 'mark-maybe':
          if (window.selectionManager) window.selectionManager.mark('maybe', true);
          break;
        case 'mark-reset':
          if (window.selectionManager) window.selectionManager.mark(null, false);
          break;
        case 'next-photo':
          if (window.photoManager) window.photoManager.nextPhoto();
          break;
        case 'prev-photo':
          if (window.photoManager) window.photoManager.prevPhoto();
          break;
        case 'zoom-in':
          if (window.photoManager) window.photoManager.zoomIn(0.3);
          break;
        case 'zoom-out':
          if (window.photoManager) window.photoManager.zoomOut(0.3);
          break;
        case 'reset-zoom':
          if (window.photoManager) window.photoManager.resetZoom();
          break;
        case 'show-help':
          this.toggleHelpModal();
          break;
        case 'open-settings':
          if (window.settingsManager) window.settingsManager.openModal();
          break;
        case 'toggle-sidebar':
          if (window.sidebarManager) window.sidebarManager.toggle();
          break;
        case 'toggle-autoadvance':
          if (window.selectionManager) window.selectionManager.toggleAutoAdvance();
          break;
        case 'toggle-viewer-filter':
          if (window.photoManager) window.photoManager.toggleFilterToolbar();
          break;
        case 'refresh-folder':
          if (window.photoManager && window.photoManager.folderPath) {
            this.loadFolder(window.photoManager.folderPath);
          }
          break;
        case 'open-in-explorer':
          if (window.photoManager && window.photoManager.folderPath && window.electronAPI && window.electronAPI.openFolderInExplorer) {
            window.electronAPI.openFolderInExplorer(window.photoManager.folderPath);
          }
          break;
        case 'filter-all':
          if (window.photoManager) {
            if (!window.photoManager.isFilterActive) window.photoManager.toggleFilterToolbar(true);
            window.photoManager.setFilter('all');
          }
          break;
        case 'filter-unmarked':
          if (window.photoManager) {
            if (!window.photoManager.isFilterActive) window.photoManager.toggleFilterToolbar(true);
            window.photoManager.setFilter('unmarked');
          }
          break;
        case 'filter-pick':
          if (window.photoManager) {
            if (!window.photoManager.isFilterActive) window.photoManager.toggleFilterToolbar(true);
            window.photoManager.setFilter('pick');
          }
          break;
        case 'filter-reject':
          if (window.photoManager) {
            if (!window.photoManager.isFilterActive) window.photoManager.toggleFilterToolbar(true);
            window.photoManager.setFilter('reject');
          }
          break;
        case 'filter-maybe':
          if (window.photoManager) {
            if (!window.photoManager.isFilterActive) window.photoManager.toggleFilterToolbar(true);
            window.photoManager.setFilter('maybe');
          }
          break;
        case 'sort-name-asc':
          if (window.photoManager) {
            if (!window.photoManager.isFilterActive) window.photoManager.toggleFilterToolbar(true);
            window.photoManager.setSort('name-asc');
          }
          break;
        case 'sort-name-desc':
          if (window.photoManager) {
            if (!window.photoManager.isFilterActive) window.photoManager.toggleFilterToolbar(true);
            window.photoManager.setSort('name-desc');
          }
          break;
        case 'sort-date-desc':
          if (window.photoManager) {
            if (!window.photoManager.isFilterActive) window.photoManager.toggleFilterToolbar(true);
            window.photoManager.setSort('date-desc');
          }
          break;
        case 'sort-date-asc':
          if (window.photoManager) {
            if (!window.photoManager.isFilterActive) window.photoManager.toggleFilterToolbar(true);
            window.photoManager.setSort('date-asc');
          }
          break;
        case 'sort-size-desc':
          if (window.photoManager) {
            if (!window.photoManager.isFilterActive) window.photoManager.toggleFilterToolbar(true);
            window.photoManager.setSort('size-desc');
          }
          break;
        case 'sort-status':
          if (window.photoManager) {
            if (!window.photoManager.isFilterActive) window.photoManager.toggleFilterToolbar(true);
            window.photoManager.setSort('status');
          }
          break;
        case 'toggle-filmstrip':
          if (this.bottomBar) {
            this.bottomBar.classList.toggle('hidden');
          }
          break;
      }
    });
  }

  initButtons() {
    // Open folder buttons
    const btnOpenFolder = document.getElementById('btnOpenFolder');
    if (btnOpenFolder) {
      btnOpenFolder.addEventListener('click', () => this.openFolderDialog());
    }

    const folderInfo = document.getElementById('folderInfo');
    if (folderInfo) {
      folderInfo.addEventListener('click', () => this.openFolderDialog());
    }

    const btnEmptyOpenFolder = document.getElementById('btnEmptyOpenFolder');
    if (btnEmptyOpenFolder) {
      btnEmptyOpenFolder.addEventListener('click', () => this.openFolderDialog());
    }

    // Top buttons
    const btnUndo = document.getElementById('btnUndo');
    if (btnUndo) {
      btnUndo.addEventListener('click', () => window.selectionManager.undo());
    }

    const btnHelp = document.getElementById('btnHelp');
    if (btnHelp) {
      btnHelp.addEventListener('click', () => this.toggleHelpModal());
    }

    const btnExport = document.getElementById('btnExport');
    if (btnExport) {
      btnExport.addEventListener('click', () => window.exportManager.openModal());
    }

    // Help modal close buttons
    const btnCloseHelpModal = document.getElementById('btnCloseHelpModal');
    if (btnCloseHelpModal) {
      btnCloseHelpModal.addEventListener('click', () => this.closeAllModals());
    }

    const btnCloseHelpBtn = document.getElementById('btnCloseHelpBtn');
    if (btnCloseHelpBtn) {
      btnCloseHelpBtn.addEventListener('click', () => this.closeAllModals());
    }

    const btnHelpToSettings = document.getElementById('btnHelpToSettings');
    if (btnHelpToSettings) {
      btnHelpToSettings.addEventListener('click', () => {
        this.closeAllModals();
        if (window.settingsManager) window.settingsManager.openModal();
      });
    }

    // Bottom action buttons
    const btnActionPick = document.getElementById('btnActionPick');
    if (btnActionPick) {
      btnActionPick.addEventListener('click', () => window.selectionManager.mark('pick', true));
    }

    const btnActionReject = document.getElementById('btnActionReject');
    if (btnActionReject) {
      btnActionReject.addEventListener('click', () => window.selectionManager.mark('reject', true));
    }

    const btnActionMaybe = document.getElementById('btnActionMaybe');
    if (btnActionMaybe) {
      btnActionMaybe.addEventListener('click', () => window.selectionManager.mark('maybe', true));
    }

    const btnActionReset = document.getElementById('btnActionReset');
    if (btnActionReset) {
      btnActionReset.addEventListener('click', () => window.selectionManager.mark(null, false));
    }

    const btnNavPrev = document.getElementById('btnNavPrev');
    if (btnNavPrev) {
      btnNavPrev.addEventListener('click', () => window.photoManager.prevPhoto());
    }

    const btnNavNext = document.getElementById('btnNavNext');
    if (btnNavNext) {
      btnNavNext.addEventListener('click', () => window.photoManager.nextPhoto());
    }
  }

  initDragAndDrop() {
    window.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });

    window.addEventListener('drop', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        // In Electron, File objects have a .path property
        if (file && file.path) {
          // Check if dropped item is a folder or file in folder
          let targetPath = file.path;
          await this.loadFolder(targetPath);
        }
      }
    });
  }

  async openFolderDialog() {
    if (!window.electronAPI) return;
    try {
      const folderPath = await window.electronAPI.openDirectory();
      if (folderPath) {
        await this.loadFolder(folderPath);
      }
    } catch (err) {
      console.error('Error opening folder dialog:', err);
      this.showToast('Gagal memilih folder', 'error');
    }
  }

  async loadFolder(folderPath) {
    this.showToast('Membuka folder...');

    const success = await window.photoManager.loadFolder(folderPath);
    if (!success) return;

    // Load saved selections if available
    const savedData = await window.storageManager.load(folderPath);

    // Update selection manager
    window.selectionManager.loadData(savedData);

    // Render filmstrip
    window.filmstripManager.render(window.photoManager.photos);

    // Switch view
    this.emptyState.classList.add('hidden');
    this.viewerArea.classList.remove('hidden');
    this.bottomBar.classList.remove('hidden');
    this.statsBar.classList.remove('hidden');

    this.folderPathText.textContent = folderPath;
    this.folderPathText.title = folderPath;

    if (window.sidebarManager) {
      window.sidebarManager.show();
    }

    // Resume from saved index or start from 0
    let startIndex = 0;
    if (savedData && typeof savedData.lastIndex === 'number' && savedData.lastIndex < window.photoManager.photos.length) {
      startIndex = Math.max(0, savedData.lastIndex);
      this.showToast(`Melanjutkan dari foto #${startIndex + 1}`);
    } else {
      this.showToast(`${window.photoManager.photos.length} foto berhasil dimuat`);
    }

    window.photoManager.showPhoto(startIndex);
  }

  toggleHelpModal() {
    const helpModal = document.getElementById('helpModal');
    if (helpModal) {
      helpModal.classList.toggle('hidden');
    }
  }

  closeAllModals() {
    document.getElementById('exportModal')?.classList.add('hidden');
    document.getElementById('helpModal')?.classList.add('hidden');
    document.getElementById('settingsModal')?.classList.add('hidden');
    if (window.settingsManager) window.settingsManager.stopRecording();
  }

  updateToolbarKeyBadges() {
    const km = window.keybindingsManager;
    if (!km || !km.bindings) return;

    const bNavPrev = document.getElementById('badgeNavPrev');
    const bActionReject = document.getElementById('badgeActionReject');
    const bActionMaybe = document.getElementById('badgeActionMaybe');
    const bActionPick = document.getElementById('badgeActionPick');
    const bActionReset = document.getElementById('badgeActionReset');
    const bNavNext = document.getElementById('badgeNavNext');

    const getShortLabel = (action) => {
      const keys = (km.bindings.keyboard && km.bindings.keyboard[action]) || [];
      const primaryKey = keys.length > 0 ? km.formatKeyName(keys[0]) : '';
      const gpBtn = km.bindings.gamepad && km.bindings.gamepad[action];
      let gpLabel = '';
      if (typeof gpBtn === 'number') {
        const full = km.formatGamepadButton(gpBtn);
        gpLabel = full.split(' ')[0] || '';
      }
      if (gpLabel && primaryKey) return `${gpLabel}/${primaryKey}`;
      return gpLabel || primaryKey || '-';
    };

    if (bNavPrev) bNavPrev.textContent = getShortLabel('prev');
    if (bActionReject) bActionReject.textContent = getShortLabel('reject');
    if (bActionMaybe) bActionMaybe.textContent = getShortLabel('maybe');
    if (bActionPick) bActionPick.textContent = getShortLabel('pick');
    if (bActionReset) bActionReset.textContent = getShortLabel('reset');
    if (bNavNext) bNavNext.textContent = getShortLabel('next');
  }

  showToast(message) {
    if (!this.toastNotification) return;

    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
    }

    this.toastNotification.textContent = message;
    this.toastNotification.classList.remove('hidden');

    this.toastTimeout = setTimeout(() => {
      this.toastNotification.classList.add('hidden');
    }, 2400);
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});
