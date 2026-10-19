// Keybindings Manager: Custom keyboard and joystick mapping configuration
// High-performance O(1) lookup tables for instant responsiveness

const DEFAULT_KEYBINDINGS = {
  keyboard: {
    pick: ['ArrowRight', '1', 'd'],
    reject: ['ArrowLeft', '2', 'a'],
    maybe: ['ArrowUp', '3', 'w'],
    reset: ['ArrowDown', '0', 's', 'Delete', 'Backspace'],
    next: [' ', 'e', 'PageDown'],
    prev: ['q', 'PageUp'],
    undo: ['ctrl+z'],
    zoomIn: ['+', '='],
    zoomOut: ['-', '_'],
    resetZoom: ['r'],
    openFolder: ['ctrl+o', 'o'],
    export: ['ctrl+e', 'p'],
    help: ['h', '?'],
    toggleSidebar: ['Tab', 'l'],
    settings: [',']
  },
  gamepad: {
    pick: 0,
    reject: 1,
    reset: 2,
    maybe: 3,
    prev: 4,
    next: 5,
    undo: 10,
    resetZoom: 11,
    help: 8,
    export: 9,
    zoomIn: 12,
    zoomOut: 13,
    dpadLeft: 14,
    dpadRight: 15
  }
};

const ACTION_METADATA = {
  pick: { label: 'Pick (Pilih Foto)', icon: '✅', category: 'action' },
  reject: { label: 'Reject (Tolak Foto)', icon: '❌', category: 'action' },
  maybe: { label: 'Maybe (Ragu-ragu)', icon: '🤔', category: 'action' },
  reset: { label: 'Reset (Hapus Status)', icon: '⚪', category: 'action' },
  next: { label: 'Foto Berikutnya (Next)', icon: '➡️', category: 'nav' },
  prev: { label: 'Foto Sebelumnya (Prev)', icon: '⬅️', category: 'nav' },
  undo: { label: 'Undo Seleksi Terakhir', icon: '↩️', category: 'action' },
  zoomIn: { label: 'Perbesar (Zoom In)', icon: '🔍+', category: 'view' },
  zoomOut: { label: 'Perkecil (Zoom Out)', icon: '🔍-', category: 'view' },
  resetZoom: { label: 'Reset Zoom Foto', icon: '🎯', category: 'view' },
  openFolder: { label: 'Buka Folder Foto', icon: '📁', category: 'system' },
  export: { label: 'Buka Menu Export', icon: '📦', category: 'system' },
  help: { label: 'Buka Panduan (Help)', icon: '❓', category: 'system' },
  toggleSidebar: { label: 'Buka/Tutup Panel Seleksi', icon: '📋', category: 'system' },
  settings: { label: 'Buka Pengaturan Tombol', icon: '⚙️', category: 'system' }
};

const GAMEPAD_BUTTON_LABELS = {
  0: 'A / ✕ (Bawah)',
  1: 'B / ○ (Kanan)',
  2: 'X / □ (Kiri)',
  3: 'Y / △ (Atas)',
  4: 'LB / L1 (Bumper Kiri)',
  5: 'RB / R1 (Bumper Kanan)',
  6: 'LT / L2 (Trigger Kiri)',
  7: 'RT / R2 (Trigger Kanan)',
  8: 'Back / Select / Share',
  9: 'Start / Menu / Options',
  10: 'L3 (Tekan Stick Kiri)',
  11: 'R3 (Tekan Stick Kanan)',
  12: 'D-Pad Atas',
  13: 'D-Pad Bawah',
  14: 'D-Pad Kiri',
  15: 'D-Pad Kanan'
};

class KeybindingsManager {
  constructor() {
    this.bindings = JSON.parse(JSON.stringify(DEFAULT_KEYBINDINGS));
    this.keyboardLookup = new Map();
    this.gamepadLookup = new Map();
    this.listeners = new Set();

    this.rebuildLookups();
  }

  async init() {
    if (!window.electronAPI || !window.electronAPI.loadKeybindings) {
      return;
    }

    try {
      const saved = await window.electronAPI.loadKeybindings();
      if (saved && typeof saved === 'object') {
        // Merge with defaults to ensure all keys and actions are present
        if (saved.keyboard && typeof saved.keyboard === 'object') {
          for (const [action, keys] of Object.entries(DEFAULT_KEYBINDINGS.keyboard)) {
            if (Array.isArray(saved.keyboard[action])) {
              this.bindings.keyboard[action] = [...saved.keyboard[action]];
            }
          }
        }
        if (saved.gamepad && typeof saved.gamepad === 'object') {
          for (const [action, btn] of Object.entries(DEFAULT_KEYBINDINGS.gamepad)) {
            if (typeof saved.gamepad[action] === 'number') {
              this.bindings.gamepad[action] = saved.gamepad[action];
            }
          }
        }
        this.rebuildLookups();
      }
    } catch (err) {
      console.warn('Gagal memuat keybindings.json, menggunakan default:', err);
    }
  }

  // Build O(1) lookup tables
  rebuildLookups() {
    this.keyboardLookup.clear();
    this.gamepadLookup.clear();

    // Rebuild keyboard lookup
    for (const [action, keys] of Object.entries(this.bindings.keyboard)) {
      if (Array.isArray(keys)) {
        for (const key of keys) {
          const normalized = this.normalizeKeyString(key);
          if (normalized) {
            this.keyboardLookup.set(normalized, action);
          }
        }
      }
    }

    // Rebuild gamepad lookup
    for (const [action, btnIndex] of Object.entries(this.bindings.gamepad)) {
      if (typeof btnIndex === 'number' && btnIndex >= 0) {
        // Map button index to action. If dpadLeft/dpadRight, map to prev/next photo action
        const effectiveAction = (action === 'dpadLeft') ? 'prev' :
                                (action === 'dpadRight') ? 'next' : action;
        this.gamepadLookup.set(btnIndex, effectiveAction);
      }
    }

    this.notifyChange();
  }

  normalizeKeyString(key) {
    if (!key) return '';
    const trimmed = key.trim();
    if (trimmed.toLowerCase().startsWith('ctrl+')) {
      return 'ctrl+' + trimmed.slice(5).toLowerCase();
    }
    if (key === ' ') return ' ';
    if (key.length === 1 && /[a-zA-Z]/.test(key)) {
      return key.toLowerCase();
    }
    return key;
  }

  // Convert KeyboardEvent to lookup key string
  serializeKeyboardEvent(e) {
    if (e.ctrlKey || e.metaKey) {
      if (['Control', 'Meta', 'Shift', 'Alt'].includes(e.key)) return null;
      return 'ctrl+' + e.key.toLowerCase();
    }
    if (e.key === ' ') return ' ';
    if (e.key.length === 1 && /[a-zA-Z]/.test(e.key)) {
      return e.key.toLowerCase();
    }
    return e.key;
  }

  getActionForKeyboard(e) {
    const keyStr = this.serializeKeyboardEvent(e);
    if (!keyStr) return null;
    return this.keyboardLookup.get(keyStr) || null;
  }

  getActionForGamepad(buttonIndex) {
    return this.gamepadLookup.get(buttonIndex) || null;
  }

  findConflict(type, value, targetAction) {
    if (type === 'keyboard') {
      const normalized = this.normalizeKeyString(value);
      for (const [action, keys] of Object.entries(this.bindings.keyboard)) {
        if (action === targetAction) continue;
        if (Array.isArray(keys) && keys.some(k => this.normalizeKeyString(k) === normalized)) {
          return action;
        }
      }
    } else if (type === 'gamepad') {
      const btn = Number(value);
      for (const [action, assignedBtn] of Object.entries(this.bindings.gamepad)) {
        if (action === targetAction) continue;
        if (assignedBtn === btn) {
          return action;
        }
      }
    }
    return null;
  }

  setKeyboardBinding(action, keysArray) {
    if (!this.bindings.keyboard[action]) return false;
    this.bindings.keyboard[action] = [...keysArray];
    this.rebuildLookups();
    this.save();
    return true;
  }

  setGamepadBinding(action, buttonIndex) {
    if (this.bindings.gamepad[action] === undefined) return false;
    this.bindings.gamepad[action] = buttonIndex;
    this.rebuildLookups();
    this.save();
    return true;
  }

  async resetToDefault() {
    this.bindings = JSON.parse(JSON.stringify(DEFAULT_KEYBINDINGS));
    this.rebuildLookups();
    await this.save();
  }

  async save() {
    if (window.electronAPI && window.electronAPI.saveKeybindings) {
      try {
        await window.electronAPI.saveKeybindings(this.bindings);
      } catch (err) {
        console.error('Gagal menyimpan keybindings:', err);
      }
    }
  }

  formatKeyName(key) {
    if (!key) return '';
    if (key === ' ') return 'Space';
    if (key.toLowerCase().startsWith('ctrl+')) {
      return 'Ctrl + ' + key.slice(5).toUpperCase();
    }
    switch (key) {
      case 'ArrowRight': return '→';
      case 'ArrowLeft': return '←';
      case 'ArrowUp': return '↑';
      case 'ArrowDown': return '↓';
      case 'Delete': return 'Del';
      case 'Backspace': return 'Bksp';
      default: return key.toUpperCase();
    }
  }

  formatGamepadButton(buttonIndex) {
    if (buttonIndex === null || buttonIndex === undefined || buttonIndex < 0) {
      return 'Tidak Ada';
    }
    return GAMEPAD_BUTTON_LABELS[buttonIndex] || `Tombol ${buttonIndex}`;
  }

  onChange(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notifyChange() {
    for (const cb of this.listeners) {
      try {
        cb(this.bindings);
      } catch (e) {
        console.error('Error in keybindings listener:', e);
      }
    }
  }
}

window.keybindingsManager = new KeybindingsManager();
