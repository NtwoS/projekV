// Gamepad & Joystick Handler using Web Gamepad API
class GamepadHandler {
  constructor() {
    this.connectedGamepadIndex = null;
    this.prevButtons = [];
    this.isPolling = false;

    // Analog stick deadzone & sensitivity
    this.deadzone = 0.22;
    this.panSpeed = 12;
    this.filmstripScrollSpeed = 15;

    // DOM Elements
    this.gamepadBadge = document.getElementById('gamepadBadge');
    this.gamepadNameText = document.getElementById('gamepadNameText');

    this.init();
  }

  init() {
    window.addEventListener('gamepadconnected', (e) => {
      console.log('Gamepad connected:', e.gamepad.id);
      this.connectedGamepadIndex = e.gamepad.index;
      this.updateConnectionUI(e.gamepad);
      this.startPolling();
    });

    window.addEventListener('gamepaddisconnected', (e) => {
      console.log('Gamepad disconnected:', e.gamepad.id);
      if (this.connectedGamepadIndex === e.gamepad.index) {
        this.connectedGamepadIndex = null;
        this.updateConnectionUI(null);
      }
    });

    // Check if a gamepad is already connected on launch
    this.checkExistingGamepad();
  }

  checkExistingGamepad() {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const gp of gamepads) {
      if (gp && gp.connected) {
        this.connectedGamepadIndex = gp.index;
        this.updateConnectionUI(gp);
        this.startPolling();
        break;
      }
    }
  }

  updateConnectionUI(gamepad) {
    if (gamepad) {
      this.gamepadBadge.classList.remove('disconnected');
      this.gamepadBadge.classList.add('connected');

      // Simplify controller name
      let name = gamepad.id || 'Controller';
      if (name.includes('Xbox')) name = 'Xbox Controller';
      else if (name.includes('PlayStation') || name.includes('DualShock') || name.includes('DualSense')) name = 'PS Controller';
      else if (name.length > 20) name = name.substring(0, 18) + '...';

      this.gamepadNameText.textContent = name;
      window.app.showToast(`🎮 ${name} Terhubung!`);
    } else {
      this.gamepadBadge.classList.remove('connected');
      this.gamepadBadge.classList.add('disconnected');
      this.gamepadNameText.textContent = 'Controller Offline';
    }
  }

  startPolling() {
    if (this.isPolling) return;
    this.isPolling = true;

    const poll = () => {
      this.pollGamepad();
      requestAnimationFrame(poll);
    };

    requestAnimationFrame(poll);
  }

  pollGamepad() {
    if (!navigator.getGamepads) return;
    const gamepads = navigator.getGamepads();
    const gp = gamepads[this.connectedGamepadIndex];

    if (!gp || !gp.connected) {
      // Search for any active gamepad
      for (const pad of gamepads) {
        if (pad && pad.connected) {
          this.connectedGamepadIndex = pad.index;
          this.updateConnectionUI(pad);
          return;
        }
      }
      return;
    }

    // Modal open check: if modal is open, only allow modal navigation/escape
    const isModalOpen = !document.getElementById('exportModal').classList.contains('hidden') ||
                        !document.getElementById('helpModal').classList.contains('hidden');

    // 1. Process Buttons (edge-triggered: only fires on button-down transition)
    const currentButtons = gp.buttons.map(b => (typeof b === 'object' ? b.pressed : b === 1.0));

    currentButtons.forEach((isPressed, btnIndex) => {
      const wasPressed = this.prevButtons[btnIndex] || false;

      // On Press Down Event
      if (isPressed && !wasPressed) {
        this.handleButtonPress(btnIndex, isModalOpen);
      }
    });

    this.prevButtons = currentButtons;

    // 2. Process Analog Sticks (Continuous input while held)
    if (!isModalOpen) {
      this.handleAnalogSticks(gp);
    }
  }

  handleButtonPress(btnIndex, isModalOpen) {
    // If modal is open, B button closes modal
    if (isModalOpen) {
      if (btnIndex === 1) { // B button
        window.app.closeAllModals();
      }
      return;
    }

    // Don't process photo actions if no photos loaded
    if (!window.photoManager || window.photoManager.photos.length === 0) return;

    switch (btnIndex) {
      // Standard Face Buttons
      case 0: // A button (Bottom) -> Pick ✅
        window.selectionManager.mark('pick', true);
        break;

      case 1: // B button (Right) -> Reject ❌
        window.selectionManager.mark('reject', true);
        break;

      case 2: // X button (Left) -> Reset ⚪
        window.selectionManager.mark(null, false);
        break;

      case 3: // Y button (Top) -> Maybe 🤔
        window.selectionManager.mark('maybe', true);
        break;

      // Shoulder Bumpers
      case 4: // LB (Left Bumper) -> Previous Photo
        window.photoManager.prevPhoto();
        break;

      case 5: // RB (Right Bumper) -> Next Photo
        window.photoManager.nextPhoto();
        break;

      // Stick Clicks
      case 10: // L3 (Left Stick Click) -> Undo
        window.selectionManager.undo();
        break;

      case 11: // R3 (Right Stick Click) -> Reset Zoom
        window.photoManager.resetZoom();
        break;

      // Center Buttons
      case 8: // Back / View / Select -> Toggle Help Modal
        window.app.toggleHelpModal();
        break;

      case 9: // Start / Menu -> Open Export Modal
        window.exportManager.openModal();
        break;

      // D-Pad
      case 12: // D-Pad Up -> Zoom In
        window.photoManager.zoomIn(0.4);
        break;

      case 13: // D-Pad Down -> Zoom Out
        window.photoManager.zoomOut(0.4);
        break;

      case 14: // D-Pad Left -> Prev Photo
        window.photoManager.prevPhoto();
        break;

      case 15: // D-Pad Right -> Next Photo
        window.photoManager.nextPhoto();
        break;
    }
  }

  handleAnalogSticks(gp) {
    if (!gp.axes || gp.axes.length < 2) return;

    // Left Stick X (axes[0]) -> Scroll Filmstrip
    const leftStickX = gp.axes[0];
    if (Math.abs(leftStickX) > this.deadzone) {
      const scrollDelta = leftStickX * this.filmstripScrollSpeed;
      if (window.filmstripManager) {
        window.filmstripManager.scrollBy(scrollDelta);
      }
    }

    // Right Stick (axes[2], axes[3]) -> Pan Photo when zoomed
    if (gp.axes.length >= 4 && window.photoManager && window.photoManager.scale > 1.05) {
      const rightStickX = gp.axes[2];
      const rightStickY = gp.axes[3];

      let dx = 0;
      let dy = 0;

      if (Math.abs(rightStickX) > this.deadzone) {
        dx = -rightStickX * this.panSpeed;
      }
      if (Math.abs(rightStickY) > this.deadzone) {
        dy = -rightStickY * this.panSpeed;
      }

      if (dx !== 0 || dy !== 0) {
        window.photoManager.panBy(dx, dy);
      }
    }
  }
}

window.gamepadHandler = new GamepadHandler();
