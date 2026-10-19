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

    // Auto-advance to next photo immediately (zero input lag)
    if (autoAdvance) {
      window.photoManager.nextPhoto();
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
    const total = window.photoManager.photos.length;
    const pick = this._pickCount;
    const reject = this._rejectCount;
    const maybe = this._maybeCount;
    const unmarked = Math.max(0, total - (pick + reject + maybe));

    this.statCurrentIndex.textContent = total > 0 ? (window.photoManager.currentIndex + 1) : 0;
    this.statTotalPhotos.textContent = total;
    this.statPickCount.textContent = pick;
    this.statMaybeCount.textContent = maybe;
    this.statRejectCount.textContent = reject;
    this.statUnmarkedCount.textContent = unmarked;

    // Enable/disable export button
    const btnExport = document.getElementById('btnExport');
    if (btnExport) {
      btnExport.disabled = (pick + reject + maybe) === 0;
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
