// Selection manager: Pick, Reject, Maybe, Reset, Undo, and Auto-save
// Optimized: cached counters, no full-map iteration per action, no dead badge code
class SelectionManager {
  constructor() {
    this.selections = new Map(); // filename -> status ('pick' | 'reject' | 'maybe')
    this.historyStack = [];      // For Undo operation

    // Cached stat counters — avoid iterating the entire map every press
    this._pickCount = 0;
    this._rejectCount = 0;
    this._maybeCount = 0;

    // Auto-advance preference (persisted to localStorage)
    this.autoAdvance = localStorage.getItem('photoSelector_autoAdvance') !== 'false';

    // DOM Elements (cached once)
    this.viewerArea = document.getElementById('viewerArea');
    this.btnUndo = document.getElementById('btnUndo');

    // Stat display elements
    this.statCurrentIndex = document.getElementById('statCurrentIndex');
    this.statTotalPhotos = document.getElementById('statTotalPhotos');
    this.statPickCount = document.getElementById('statPickCount');
    this.statMaybeCount = document.getElementById('statMaybeCount');
    this.statRejectCount = document.getElementById('statRejectCount');
    this.statUnmarkedCount = document.getElementById('statUnmarkedCount');

    // Progress bar elements
    this.cullingProgressPercent = document.getElementById('cullingProgressPercent');
    this.cullingProgressBarPick = document.getElementById('cullingProgressBarPick');
    this.cullingProgressBarMaybe = document.getElementById('cullingProgressBarMaybe');
    this.cullingProgressBarReject = document.getElementById('cullingProgressBarReject');
    this.topProgressBar = document.getElementById('topProgressBar');
    this.topProgressFillPick = document.getElementById('topProgressFillPick');
    this.topProgressFillMaybe = document.getElementById('topProgressFillMaybe');
    this.topProgressFillReject = document.getElementById('topProgressFillReject');

    // Auto-Advance elements
    this.btnToggleAutoAdvance = document.getElementById('btnToggleAutoAdvance');
    this.autoAdvanceStatusText = document.getElementById('autoAdvanceStatusText');

    this.initAutoAdvanceUI();
  }

  initAutoAdvanceUI() {
    this.updateAutoAdvanceUI();
    if (this.btnToggleAutoAdvance) {
      this.btnToggleAutoAdvance.addEventListener('click', () => this.toggleAutoAdvance());
    }
  }

  toggleAutoAdvance() {
    this.setAutoAdvance(!this.autoAdvance);
    if (window.app) {
      window.app.showToast(this.autoAdvance ? '⏭ Auto-Advance Aktif' : '⏸ Auto-Advance Dinonaktifkan');
    }
  }

  setAutoAdvance(enabled) {
    this.autoAdvance = !!enabled;
    try {
      localStorage.setItem('photoSelector_autoAdvance', this.autoAdvance ? 'true' : 'false');
    } catch {
      // Ignore localStorage errors
    }
    this.updateAutoAdvanceUI();

    const chkSettings = document.getElementById('chkSettingsAutoAdvance');
    if (chkSettings) {
      chkSettings.checked = this.autoAdvance;
    }
  }

  updateAutoAdvanceUI() {
    if (this.btnToggleAutoAdvance) {
      this.btnToggleAutoAdvance.classList.toggle('active', this.autoAdvance);
    }
    if (this.autoAdvanceStatusText) {
      this.autoAdvanceStatusText.textContent = this.autoAdvance ? 'ON' : 'OFF';
    }
  }

  loadData(savedData) {
    this.selections.clear();
    this.historyStack = [];
    this._pickCount = 0;
    this._rejectCount = 0;
    this._maybeCount = 0;

    if (savedData && Array.isArray(savedData.photos)) {
      for (const item of savedData.photos) {
        if (item.status) {
          this.selections.set(item.filename, item.status);
          this._incrementCounter(item.status);
        }
      }
    }

    this.updateStats();
    this.updateUndoButton();
    if (window.sidebarManager) {
      window.sidebarManager.render();
    }
  }

  // Internal counter helpers — O(1) instead of iterating the entire map
  _incrementCounter(status) {
    if (status === 'pick') this._pickCount++;
    else if (status === 'reject') this._rejectCount++;
    else if (status === 'maybe') this._maybeCount++;
  }

  _decrementCounter(status) {
    if (status === 'pick') this._pickCount--;
    else if (status === 'reject') this._rejectCount--;
    else if (status === 'maybe') this._maybeCount--;
  }

  getSelection(filename) {
    return this.selections.get(filename) || null;
  }

  mark(status, autoAdvance = true) {
    const photo = window.photoManager.getCurrentPhoto();
    if (!photo) return;

    const previousStatus = this.selections.get(photo.filename) || null;

    // Update counters: decrement old, increment new
    if (previousStatus) this._decrementCounter(previousStatus);
    if (status) this._incrementCounter(status);

    // Set new status or remove if reset (status === null)
    if (status) {
      this.selections.set(photo.filename, status);
    } else {
      this.selections.delete(photo.filename);
    }

    // Push to undo stack
    this.historyStack.push({
      index: window.photoManager.currentIndex,
      filename: photo.filename,
      previousStatus: previousStatus,
      newStatus: status
    });
    this.updateUndoButton();

    // Update filmstrip & viewer borders instantly
    if (window.filmstripManager) {
      window.filmstripManager.updateItemStatus(photo.filename, status);
    }
    this.updateViewerBorder();
    this.updateStats();

    // Update right sidebar efficiently without full DOM wipe
    if (window.sidebarManager) {
      window.sidebarManager.updateItem(photo, window.photoManager.currentIndex, status);
    }

    // Persist data (debounced — won't block UI)
    this.persist();

    // Auto-advance to next photo immediately (if enabled & status is not null)
    if (autoAdvance && this.autoAdvance && status !== null) {
      if (window.photoManager && window.photoManager.isFilterActive) {
        window.photoManager.onPhotoMarked(photo, status);
      } else {
        window.photoManager.nextPhoto();
      }
    }
  }

  undo() {
    if (this.historyStack.length === 0) {
      window.app.showToast('Tidak ada aksi yang bisa di-undo');
      return;
    }

    const lastAction = this.historyStack.pop();
    this.updateUndoButton();

    // Update counters
    if (lastAction.newStatus) this._decrementCounter(lastAction.newStatus);
    if (lastAction.previousStatus) this._incrementCounter(lastAction.previousStatus);

    // Restore status
    if (lastAction.previousStatus) {
      this.selections.set(lastAction.filename, lastAction.previousStatus);
    } else {
      this.selections.delete(lastAction.filename);
    }

    // Jump to that photo if not already there
    window.photoManager.showPhoto(lastAction.index);

    // Update visuals
    if (window.filmstripManager) {
      window.filmstripManager.updateItemStatus(lastAction.filename, lastAction.previousStatus);
    }
    this.updateViewerBorder();
    this.updateStats();

    // Update right sidebar
    if (window.sidebarManager) {
      window.sidebarManager.render();
    }

    // Persist data
    this.persist();

    window.app.showToast(`Undo: status ${lastAction.filename} dikembalikan`);
  }

  updateViewerBorder() {
    const photo = window.photoManager.getCurrentPhoto();
    this.viewerArea.classList.remove('status-pick', 'status-reject', 'status-maybe');

    if (photo) {
      const status = this.getSelection(photo.filename);
      if (status) {
        this.viewerArea.classList.add(`status-${status}`);
      }
    }
  }

  updateStats() {
    const totalAll = (window.photoManager && window.photoManager.allPhotos && window.photoManager.allPhotos.length > 0)
      ? window.photoManager.allPhotos.length
      : (window.photoManager ? window.photoManager.photos.length : 0);
    const activePhotosCount = window.photoManager ? window.photoManager.photos.length : 0;

    const pick = this._pickCount;
    const reject = this._rejectCount;
    const maybe = this._maybeCount;
    const reviewed = pick + reject + maybe;
    const unmarked = Math.max(0, totalAll - reviewed);
    const percent = totalAll > 0 ? Math.round((reviewed / totalAll) * 100) : 0;

    const pickPct = totalAll > 0 ? (pick / totalAll) * 100 : 0;
    const maybePct = totalAll > 0 ? (maybe / totalAll) * 100 : 0;
    const rejectPct = totalAll > 0 ? (reject / totalAll) * 100 : 0;

    // Current position in active display list
    const curIdx = window.photoManager ? window.photoManager.currentIndex : -1;
    this.statCurrentIndex.textContent = activePhotosCount > 0 && curIdx >= 0 ? (curIdx + 1) : 0;
    this.statTotalPhotos.textContent = activePhotosCount;
    this.statPickCount.textContent = pick;
    this.statMaybeCount.textContent = maybe;
    this.statRejectCount.textContent = reject;
    this.statUnmarkedCount.textContent = unmarked;

    // Update culling progress bar
    if (this.cullingProgressPercent) {
      this.cullingProgressPercent.textContent = `${percent}%`;
    }
    if (this.cullingProgressBarPick) {
      this.cullingProgressBarPick.style.width = `${pickPct}%`;
    }
    if (this.cullingProgressBarMaybe) {
      this.cullingProgressBarMaybe.style.width = `${maybePct}%`;
    }
    if (this.cullingProgressBarReject) {
      this.cullingProgressBarReject.style.width = `${rejectPct}%`;
    }

    // Hairline top progress bar
    if (this.topProgressBar) {
      this.topProgressBar.classList.toggle('hidden', totalAll === 0);
    }
    if (this.topProgressFillPick) {
      this.topProgressFillPick.style.width = `${pickPct}%`;
    }
    if (this.topProgressFillMaybe) {
      this.topProgressFillMaybe.style.width = `${maybePct}%`;
    }
    if (this.topProgressFillReject) {
      this.topProgressFillReject.style.width = `${rejectPct}%`;
    }

    // Enable/disable export button
    const btnExport = document.getElementById('btnExport');
    if (btnExport) {
      btnExport.disabled = reviewed === 0;
    }

    // Update filter toolbar count badges if available
    if (window.photoManager && typeof window.photoManager.updateFilterCounts === 'function') {
      window.photoManager.updateFilterCounts();
    }
  }

  updateUndoButton() {
    if (this.btnUndo) {
      this.btnUndo.disabled = this.historyStack.length === 0;
    }
  }

  persist() {
    const folderPath = window.photoManager.folderPath;
    if (!folderPath) return;

    // Build only items that have a status — O(selections.size) not O(photos.length)
    const photosData = [];
    for (const [filename, status] of this.selections.entries()) {
      photosData.push({ filename, status });
    }

    const data = {
      version: 1,
      folderPath: folderPath,
      lastIndex: window.photoManager.currentIndex,
      updatedAt: new Date().toISOString(),
      photos: photosData
    };

    window.storageManager.saveDebounced(folderPath, data);
  }
}

window.selectionManager = new SelectionManager();
