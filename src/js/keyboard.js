// Keyboard & Mouse Shortcut Handler (Supports full operation without a joystick)
// Powered by dynamic KeybindingsManager for full customizability
class KeyboardHandler {
  constructor() {
    this.init();
  }

  init() {
    window.addEventListener('keydown', (e) => this.handleKeyDown(e));

    // Mouse wheel zoom on main viewer
    const imageStage = document.getElementById('imageStage');
    if (imageStage) {
      imageStage.addEventListener('wheel', (e) => {
        e.preventDefault();
        if (e.deltaY < 0) {
          window.photoManager.zoomIn(0.25);
        } else {
          window.photoManager.zoomOut(0.25);
        }
      }, { passive: false });
    }
  }

  handleKeyDown(e) {
    // If typing in an input field, do not capture shortcuts
    if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

    // If Settings modal is actively recording a keypress, skip normal handling
    if (window.settingsManager && window.settingsManager.isRecording) {
      return;
    }

    const exportModal = document.getElementById('exportModal');
    const helpModal = document.getElementById('helpModal');
    const settingsModal = document.getElementById('settingsModal');

    const isModalOpen = (exportModal && !exportModal.classList.contains('hidden')) ||
                        (helpModal && !helpModal.classList.contains('hidden')) ||
                        (settingsModal && !settingsModal.classList.contains('hidden'));

    // Escape closes modals or resets zoom
    if (e.key === 'Escape') {
      if (isModalOpen) {
        window.app.closeAllModals();
      } else if (window.photoManager && window.photoManager.scale > 1.05) {
        window.photoManager.resetZoom();
      }
      return;
    }

    if (isModalOpen) return;

    // Toggle Auto-Advance shortcut (Shift + A)
    if (e.shiftKey && (e.key === 'A' || e.key === 'a')) {
      e.preventDefault();
      if (window.selectionManager) window.selectionManager.toggleAutoAdvance();
      return;
    }

    // Toggle Viewer Filter & Sort toolbar shortcut (Shift + F)
    if (e.shiftKey && (e.key === 'F' || e.key === 'f')) {
      e.preventDefault();
      if (window.photoManager) window.photoManager.toggleFilterToolbar();
      return;
    }

    // Toggle Filmstrip shortcut (Shift + B)
    if (e.shiftKey && (e.key === 'B' || e.key === 'b')) {
      e.preventDefault();
      const bottomBar = document.getElementById('bottomBar');
      if (bottomBar) {
        bottomBar.classList.toggle('hidden');
        if (window.app) {
          const isHidden = bottomBar.classList.contains('hidden');
          window.app.showToast(isHidden ? 'Filmstrip disembunyikan (Mode Ringan)' : 'Filmstrip ditampilkan');
        }
      }
      return;
    }

    // Lookup action from keybindingsManager
    const action = window.keybindingsManager
      ? window.keybindingsManager.getActionForKeyboard(e)
      : null;

    if (!action) return;

    // System & General actions (callable even when no photos loaded)
    switch (action) {
      case 'undo':
        e.preventDefault();
        if (window.selectionManager) window.selectionManager.undo();
        return;

      case 'openFolder':
        e.preventDefault();
        if (window.app) window.app.openFolderDialog();
        return;

      case 'help':
        e.preventDefault();
        if (window.app) window.app.toggleHelpModal();
        return;

      case 'settings':
        e.preventDefault();
        if (window.settingsManager) window.settingsManager.openModal();
        return;

      case 'toggleSidebar':
        e.preventDefault();
        if (window.sidebarManager) window.sidebarManager.toggle();
        return;

      case 'export':
        e.preventDefault();
        if (window.exportManager) window.exportManager.openModal();
        return;
    }

    // Photo specific actions require loaded photos
    if (!window.photoManager || window.photoManager.photos.length === 0) return;

    switch (action) {
      case 'pick':
        e.preventDefault();
        window.selectionManager.mark('pick', true);
        break;

      case 'reject':
        e.preventDefault();
        window.selectionManager.mark('reject', true);
        break;

      case 'maybe':
        e.preventDefault();
        window.selectionManager.mark('maybe', true);
        break;

      case 'reset':
        e.preventDefault();
        window.selectionManager.mark(null, false);
        break;

      case 'next':
        e.preventDefault();
        window.photoManager.nextPhoto();
        break;

      case 'prev':
        e.preventDefault();
        window.photoManager.prevPhoto();
        break;

      case 'zoomIn':
        e.preventDefault();
        window.photoManager.zoomIn(0.3);
        break;

      case 'zoomOut':
        e.preventDefault();
        window.photoManager.zoomOut(0.3);
        break;

      case 'resetZoom':
        e.preventDefault();
        window.photoManager.resetZoom();
        break;
    }
  }
}

window.keyboardHandler = new KeyboardHandler();
