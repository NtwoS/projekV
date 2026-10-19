// Settings Modal & Keybinding Customization Controller
// Allows users to remap keyboard and joystick controls flexibly

class SettingsManager {
  constructor() {
    this.activeTab = 'keyboard'; // 'keyboard' | 'gamepad'
    this.isRecording = false;
    this.isRecordingGamepad = false;
    this.recordingTarget = null; // { type, action }

    // DOM Elements
    this.modal = null;
    this.tableBody = null;
    this.recordingOverlay = null;
    this.recordingPromptText = null;

    this.init();
  }

  init() {
    document.addEventListener('DOMContentLoaded', () => {
      this.modal = document.getElementById('settingsModal');
      this.tableBody = document.getElementById('settingsTableBody');
      this.recordingOverlay = document.getElementById('settingsRecordingOverlay');
      this.recordingPromptText = document.getElementById('settingsRecordingPrompt');

      this.initListeners();
    });
  }

  initListeners() {
    // Top-bar settings button
    const btnSettings = document.getElementById('btnSettings');
    if (btnSettings) {
      btnSettings.addEventListener('click', () => this.openModal());
    }

    // Modal close buttons
    const btnCloseSettingsModal = document.getElementById('btnCloseSettingsModal');
    if (btnCloseSettingsModal) {
      btnCloseSettingsModal.addEventListener('click', () => this.closeModal());
    }

    const btnFinishSettings = document.getElementById('btnFinishSettings');
    if (btnFinishSettings) {
      btnFinishSettings.addEventListener('click', () => this.closeModal());
    }

    // Tab buttons
    const tabKeyboard = document.getElementById('tabSettingsKeyboard');
    const tabGamepad = document.getElementById('tabSettingsGamepad');

    if (tabKeyboard && tabGamepad) {
      tabKeyboard.addEventListener('click', () => {
        this.switchTab('keyboard');
      });
      tabGamepad.addEventListener('click', () => {
        this.switchTab('gamepad');
      });
    }

    // Reset all to default button
    const btnResetDefaults = document.getElementById('btnResetKeybindings');
    if (btnResetDefaults) {
      btnResetDefaults.addEventListener('click', async () => {
        if (confirm('Kembalikan semua pengaturan tombol ke bawaan aplikasi?')) {
          await window.keybindingsManager.resetToDefault();
          this.renderList();
          if (window.app) {
            window.app.showToast('✅ Semua shortcut dikembalikan ke bawaan');
          }
        }
      });
    }

    // Auto-advance checkbox
    const chkAutoAdvance = document.getElementById('chkSettingsAutoAdvance');
    if (chkAutoAdvance) {
      chkAutoAdvance.addEventListener('change', (e) => {
        if (window.selectionManager) {
          window.selectionManager.setAutoAdvance(e.target.checked);
        }
      });
    }

    // Cancel recording button
    const btnCancelRecording = document.getElementById('btnCancelRecording');
    if (btnCancelRecording) {
      btnCancelRecording.addEventListener('click', () => {
        this.stopRecording();
      });
    }

    // Window key listener for recording remaps
    window.addEventListener('keydown', (e) => {
      if (!this.isRecording || this.activeTab !== 'keyboard') return;

      e.preventDefault();
      e.stopPropagation();

      // Escape cancels recording
      if (e.key === 'Escape') {
        this.stopRecording();
        if (window.app) window.app.showToast('Batal mengubah tombol');
        return;
      }

      this.recordKeyboardKey(e);
    }, true);
  }

  openModal() {
    if (!this.modal) return;
    this.stopRecording();
    const chkAutoAdvance = document.getElementById('chkSettingsAutoAdvance');
    if (chkAutoAdvance && window.selectionManager) {
      chkAutoAdvance.checked = window.selectionManager.autoAdvance;
    }
    this.modal.classList.remove('hidden');
    this.renderList();
  }

  closeModal() {
    if (!this.modal) return;
    this.stopRecording();
    this.modal.classList.add('hidden');
  }

  switchTab(tabName) {
    this.stopRecording();
    this.activeTab = tabName;

    const tabKeyboard = document.getElementById('tabSettingsKeyboard');
    const tabGamepad = document.getElementById('tabSettingsGamepad');

    if (tabKeyboard && tabGamepad) {
      if (tabName === 'keyboard') {
        tabKeyboard.classList.add('active');
        tabGamepad.classList.remove('active');
      } else {
        tabKeyboard.classList.remove('active');
        tabGamepad.classList.add('active');
      }
    }

    this.renderList();
  }

  renderList() {
    if (!this.tableBody || !window.keybindingsManager) return;

    this.tableBody.innerHTML = '';
    const km = window.keybindingsManager;

    if (this.activeTab === 'keyboard') {
      const keyboardBindings = km.bindings.keyboard;

      for (const [action, keys] of Object.entries(keyboardBindings)) {
        const meta = ACTION_METADATA[action] || { label: action, icon: '⚡' };
        const row = document.createElement('tr');
        row.className = 'settings-row';

        // Action title with icon
        const tdAction = document.createElement('td');
        tdAction.className = 'col-action';
        tdAction.innerHTML = `<span class="action-icon">${meta.icon}</span> <strong class="action-name">${meta.label}</strong>`;

        // Keys list
        const tdKeys = document.createElement('td');
        tdKeys.className = 'col-keys';
        const keyGroup = document.createElement('div');
        keyGroup.className = 'key-badges-group';

        if (Array.isArray(keys) && keys.length > 0) {
          keys.forEach(k => {
            const badge = document.createElement('span');
            badge.className = 'key-badge key-badge-remap';
            badge.textContent = km.formatKeyName(k);
            keyGroup.appendChild(badge);
          });
        } else {
          keyGroup.innerHTML = '<span class="text-muted">Belum ada tombol</span>';
        }
        tdKeys.appendChild(keyGroup);

        // Control buttons
        const tdControl = document.createElement('td');
        tdControl.className = 'col-control';

        const btnRemap = document.createElement('button');
        btnRemap.className = 'btn btn-tiny btn-secondary';
        btnRemap.textContent = 'Ganti';
        btnRemap.title = `Ganti tombol untuk ${meta.label}`;
        btnRemap.addEventListener('click', () => {
          this.startRecording('keyboard', action);
        });

        const btnAdd = document.createElement('button');
        btnAdd.className = 'btn btn-tiny btn-outline';
        btnAdd.textContent = '+ Tambah';
        btnAdd.title = `Tambah alternatif tombol untuk ${meta.label}`;
        btnAdd.addEventListener('click', () => {
          this.startRecording('keyboard', action, true);
        });

        tdControl.appendChild(btnRemap);
        tdControl.appendChild(btnAdd);

        row.appendChild(tdAction);
        row.appendChild(tdKeys);
        row.appendChild(tdControl);

        this.tableBody.appendChild(row);
      }
    } else {
      // Gamepad Tab
      const gamepadBindings = km.bindings.gamepad;

      for (const [action, btnIndex] of Object.entries(gamepadBindings)) {
        const meta = ACTION_METADATA[action] || { label: action, icon: '🎮' };
        const row = document.createElement('tr');
        row.className = 'settings-row';

        // Action title with icon
        const tdAction = document.createElement('td');
        tdAction.className = 'col-action';
        tdAction.innerHTML = `<span class="action-icon">${meta.icon}</span> <strong class="action-name">${meta.label}</strong>`;

        // Button label
        const tdKeys = document.createElement('td');
        tdKeys.className = 'col-keys';
        const badge = document.createElement('span');
        badge.className = 'key-badge key-badge-remap gp-badge';
        badge.textContent = km.formatGamepadButton(btnIndex);
        tdKeys.appendChild(badge);

        // Control buttons
        const tdControl = document.createElement('td');
        tdControl.className = 'col-control';

        const btnRemap = document.createElement('button');
        btnRemap.className = 'btn btn-tiny btn-secondary';
        btnRemap.textContent = 'Ganti';
        btnRemap.title = `Ganti tombol joystick untuk ${meta.label}`;
        btnRemap.addEventListener('click', () => {
          this.startRecording('gamepad', action);
        });

        tdControl.appendChild(btnRemap);

        row.appendChild(tdAction);
        row.appendChild(tdKeys);
        row.appendChild(tdControl);

        this.tableBody.appendChild(row);
      }
    }
  }

  startRecording(type, action, isAppend = false) {
    this.isRecording = true;
    this.isRecordingGamepad = (type === 'gamepad');
    this.recordingTarget = { type, action, isAppend };

    const meta = ACTION_METADATA[action] || { label: action };

    if (this.recordingOverlay) {
      this.recordingOverlay.classList.remove('hidden');
    }

    if (this.recordingPromptText) {
      if (type === 'keyboard') {
        this.recordingPromptText.innerHTML = `Tekan tombol <strong>Keyboard</strong> untuk aksi <em>${meta.label}</em>...<br><small class="text-muted">(Tekan Esc untuk batal)</small>`;
      } else {
        this.recordingPromptText.innerHTML = `Tekan tombol pada <strong>Joystick / Controller</strong> untuk aksi <em>${meta.label}</em>...<br><small class="text-muted">(Tekan Esc pada keyboard untuk batal)</small>`;
      }
    }
  }

  stopRecording() {
    this.isRecording = false;
    this.isRecordingGamepad = false;
    this.recordingTarget = null;

    if (this.recordingOverlay) {
      this.recordingOverlay.classList.add('hidden');
    }
  }

  recordKeyboardKey(e) {
    if (!this.recordingTarget || this.recordingTarget.type !== 'keyboard') return;

    const km = window.keybindingsManager;
    const keyStr = km.serializeKeyboardEvent(e);

    if (!keyStr) return;

    const action = this.recordingTarget.action;
    const isAppend = this.recordingTarget.isAppend;

    // Check duplicate / conflict
    const conflictAction = km.findConflict('keyboard', keyStr, action);
    if (conflictAction) {
      const conflictMeta = ACTION_METADATA[conflictAction] || { label: conflictAction };
      if (window.app) {
        window.app.showToast(`⚠️ Tombol "${km.formatKeyName(keyStr)}" sudah dipakai untuk "${conflictMeta.label}"!`);
      }
      this.stopRecording();
      return;
    }

    // Apply new binding
    let currentKeys = km.bindings.keyboard[action] || [];
    if (isAppend) {
      if (!currentKeys.includes(keyStr)) {
        currentKeys = [...currentKeys, keyStr];
      }
    } else {
      currentKeys = [keyStr];
    }

    km.setKeyboardBinding(action, currentKeys);

    this.stopRecording();
    this.renderList();

    const meta = ACTION_METADATA[action] || { label: action };
    if (window.app) {
      window.app.showToast(`✅ Tombol untuk "${meta.label}" disimpan: ${km.formatKeyName(keyStr)}`);
    }
  }

  recordGamepadButton(buttonIndex) {
    if (!this.recordingTarget || this.recordingTarget.type !== 'gamepad') return;

    const km = window.keybindingsManager;
    const action = this.recordingTarget.action;

    // Check duplicate / conflict
    const conflictAction = km.findConflict('gamepad', buttonIndex, action);
    if (conflictAction) {
      const conflictMeta = ACTION_METADATA[conflictAction] || { label: conflictAction };
      if (window.app) {
        window.app.showToast(`⚠️ Tombol ini sudah dipakai untuk "${conflictMeta.label}"!`);
      }
      this.stopRecording();
      return;
    }

    km.setGamepadBinding(action, buttonIndex);

    this.stopRecording();
    this.renderList();

    const meta = ACTION_METADATA[action] || { label: action };
    if (window.app) {
      window.app.showToast(`✅ Tombol controller untuk "${meta.label}" disimpan: ${km.formatGamepadButton(buttonIndex)}`);
    }
  }
}

window.settingsManager = new SettingsManager();
