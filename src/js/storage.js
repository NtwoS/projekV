// Storage manager for selection-data.json
class StorageManager {
  constructor() {
    this.saveTimeout = null;
    this.debounceMs = 400; // Save to disk 400ms after last change
  }

  async load(folderPath) {
    if (!window.electronAPI) return null;
    try {
      return await window.electronAPI.loadSelection(folderPath);
    } catch (err) {
      console.error('Failed to load selection data:', err);
      return null;
    }
  }

  saveDebounced(folderPath, data) {
    if (!window.electronAPI || !folderPath) return;

    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    this.saveTimeout = setTimeout(async () => {
      try {
        await window.electronAPI.saveSelection(folderPath, data);
      } catch (err) {
        console.error('Failed to save selection data:', err);
      }
    }, this.debounceMs);
  }

  async saveImmediate(folderPath, data) {
    if (!window.electronAPI || !folderPath) return;
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    try {
      return await window.electronAPI.saveSelection(folderPath, data);
    } catch (err) {
      console.error('Failed to save selection data immediately:', err);
      return { success: false, error: err.message };
    }
  }
}

window.storageManager = new StorageManager();
