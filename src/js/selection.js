// Selection manager: Pick, Reject, Maybe, Reset, Undo, and Auto-save
class SelectionManager {
  constructor() {
    this.selections = new Map(); // filename -> status ('pick' | 'reject' | 'maybe')
    this.historyStack = [];      // For Undo operation

    // DOM Elements
    this.selectionBadge = document.getElementById('selectionBadge');
    this.badgeIcon = document.getElementById('badgeIcon');
    this.badgeText = document.getElementById('badgeText');
    this.viewerArea = document.getElementById('viewerArea');
    this.btnUndo = document.getElementById('btnUndo');

    // Counters
    this.statCurrentIndex = document.getElementById('statCurrentIndex');
    this.statTotalPhotos = document.getElementById('statTotalPhotos');
    this.statPickCount = document.getElementById('statPickCount');
    this.statMaybeCount = document.getElementById('statMaybeCount');
    this.statRejectCount = document.getElementById('statRejectCount');
    this.statUnmarkedCount = document.getElementById('statUnmarkedCount');

    this.badgeTimeout = null;
  }

  loadData(savedData) {
    this.selections.clear();
    this.historyStack = [];

    if (savedData && Array.isArray(savedData.photos)) {
      for (const item of savedData.photos) {
        if (item.status) {
          this.selections.set(item.filename, item.status);
        }
      }
    }

    this.updateStats();
    this.updateUndoButton();
    if (window.sidebarManager) {
      window.sidebarManager.render();
    }
  }

  getSelection(filename) {
    return this.selections.get(filename) || null;
  }

  mark(status, autoAdvance = true) {
    const photo = window.photoManager.getCurrentPhoto();
    if (!photo) return;

    const previousStatus = this.selections.get(photo.filename) || null;

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

    // Trigger visual pop animation badge
    this.showSelectionBadge(status);

    // Update filmstrip & viewer borders
    if (window.filmstripManager) {
      window.filmstripManager.updateItemStatus(photo.filename, status);
    }
    this.updateViewerBorder();
    this.updateStats();

    // Update right sidebar
    if (window.sidebarManager) {
      window.sidebarManager.render();
    }

    // Persist data
    this.persist();

    // Auto-advance to next photo
    if (autoAdvance) {
      // Very slight delay (60ms) gives instant visual confirmation then smooth step
      setTimeout(() => {
        window.photoManager.nextPhoto();
      }, 70);
    }
  }

  undo() {
    if (this.historyStack.length === 0) {
      window.app.showToast('Tidak ada aksi yang bisa di-undo');
      return;
    }

    const lastAction = this.historyStack.pop();
    this.updateUndoButton();

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

  showSelectionBadge(status) {
    if (!this.selectionBadge) return;

    if (this.badgeTimeout) {
      clearTimeout(this.badgeTimeout);
    }

    // Reset classes
    this.selectionBadge.className = 'selection-badge';

    const badges = {
      pick: { icon: '✅', text: 'PICK', class: 'badge-pick' },
      reject: { icon: '❌', text: 'REJECT', class: 'badge-reject' },
      maybe: { icon: '🤔', text: 'MAYBE', class: 'badge-maybe' },
      null: { icon: '⚪', text: 'RESET', class: 'badge-reset' }
    };

    const config = badges[status] || badges['null'];
    this.badgeIcon.textContent = config.icon;
    this.badgeText.textContent = config.text;
    this.selectionBadge.classList.add(config.class);

    // Re-trigger animation
    this.selectionBadge.style.animation = 'none';
    this.selectionBadge.offsetHeight; // trigger reflow
    this.selectionBadge.style.animation = '';

    this.badgeTimeout = setTimeout(() => {
      this.selectionBadge.classList.add('hidden');
    }, 450);
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
    const photos = window.photoManager.photos;
    const total = photos.length;
    let pick = 0, reject = 0, maybe = 0;

    for (const [, status] of this.selections.entries()) {
      if (status === 'pick') pick++;
      else if (status === 'reject') reject++;
      else if (status === 'maybe') maybe++;
    }

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

    const data = {
      version: 1,
      folderPath: folderPath,
      lastIndex: window.photoManager.currentIndex,
      updatedAt: new Date().toISOString(),
      photos: window.photoManager.photos.map(p => ({
        filename: p.filename,
        status: this.getSelection(p.filename)
      }))
    };

    window.storageManager.saveDebounced(folderPath, data);
  }
}

window.selectionManager = new SelectionManager();
