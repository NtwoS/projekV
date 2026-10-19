// Keyboard & Mouse Shortcut Handler (Supports full operation without a joystick)
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

    const isModalOpen = !document.getElementById('exportModal').classList.contains('hidden') ||
                        !document.getElementById('helpModal').classList.contains('hidden');

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

    // Undo: Ctrl + Z
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      window.selectionManager.undo();
      return;
    }

    // Open Folder: Ctrl + O or 'O'
    if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') || (e.key.toLowerCase() === 'o' && !e.ctrlKey)) {
      e.preventDefault();
      window.app.openFolderDialog();
      return;
    }

    // Help: 'H' or '?'
    if (e.key.toLowerCase() === 'h' || e.key === '?') {
      e.preventDefault();
      window.app.toggleHelpModal();
      return;
    }

    // Toggle Sidebar: Tab or 'L'
    if (e.key === 'Tab' || e.key.toLowerCase() === 'l') {
      e.preventDefault();
      if (window.sidebarManager) window.sidebarManager.toggle();
      return;
    }

    // Export: 'X' (with Ctrl) or 'P'
    if ((e.ctrlKey && e.key.toLowerCase() === 'e') || e.key.toLowerCase() === 'p') {
      e.preventDefault();
      window.exportManager.openModal();
      return;
    }

    // Don't process photo keys if no photos loaded
    if (!window.photoManager || window.photoManager.photos.length === 0) return;

    switch (e.key) {
      // Pick: Right Arrow, '1', or 'D'
      case 'ArrowRight':
      case '1':
      case 'd':
      case 'D':
        e.preventDefault();
        window.selectionManager.mark('pick', true);
        break;

      // Reject: Left Arrow, '2', or 'A'
      case 'ArrowLeft':
      case '2':
      case 'a':
      case 'A':
        e.preventDefault();
        window.selectionManager.mark('reject', true);
        break;

      // Maybe: Up Arrow, '3', or 'W'
      case 'ArrowUp':
      case '3':
      case 'w':
      case 'W':
        e.preventDefault();
        window.selectionManager.mark('maybe', true);
        break;

      // Reset / Clear status: Down Arrow, '0', 'S', Delete, Backspace
      case 'ArrowDown':
      case '0':
      case 's':
      case 'S':
      case 'Delete':
      case 'Backspace':
        e.preventDefault();
        window.selectionManager.mark(null, false);
        break;

      // Next Photo: Space, 'E', PageDown
      case ' ':
      case 'e':
      case 'E':
      case 'PageDown':
        e.preventDefault();
        window.photoManager.nextPhoto();
        break;

      // Prev Photo: 'Q', PageUp
      case 'q':
      case 'Q':
      case 'PageUp':
        e.preventDefault();
        window.photoManager.prevPhoto();
        break;

      // Zoom Controls
      case '+':
      case '=':
        e.preventDefault();
        window.photoManager.zoomIn(0.3);
        break;

      case '-':
      case '_':
        e.preventDefault();
        window.photoManager.zoomOut(0.3);
        break;

      case 'r':
      case 'R':
        e.preventDefault();
        window.photoManager.resetZoom();
        break;
    }
  }
}

window.keyboardHandler = new KeyboardHandler();
