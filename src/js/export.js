// Export Manager: Copy or Move categorized photos into subfolders
class ExportManager {
  constructor() {
    this.modal = document.getElementById('exportModal');
    this.btnClose = document.getElementById('btnCloseExportModal');
    this.btnCancel = document.getElementById('btnCancelExport');
    this.btnConfirm = document.getElementById('btnConfirmExport');

    this.modalPickCount = document.getElementById('modalPickCount');
    this.modalMaybeCount = document.getElementById('modalMaybeCount');
    this.modalRejectCount = document.getElementById('modalRejectCount');

    this.chkExportPicks = document.getElementById('chkExportPicks');
    this.chkExportMaybes = document.getElementById('chkExportMaybes');
    this.chkExportRejects = document.getElementById('chkExportRejects');

    this.progressContainer = document.getElementById('exportProgressContainer');
    this.progressBar = document.getElementById('exportProgressBar');
    this.statusText = document.getElementById('exportStatusText');

    this.initEventListeners();
  }

  initEventListeners() {
    if (this.btnClose) {
      this.btnClose.addEventListener('click', () => this.closeModal());
    }
    if (this.btnCancel) {
      this.btnCancel.addEventListener('click', () => this.closeModal());
    }
    if (this.btnConfirm) {
      this.btnConfirm.addEventListener('click', () => this.startExport());
    }
  }

  openModal() {
    if (!window.photoManager || window.photoManager.photos.length === 0) {
      window.app.showToast('Belum ada foto yang dimuat');
      return;
    }

    let picks = 0, maybes = 0, rejects = 0;
    for (const [, status] of window.selectionManager.selections.entries()) {
      if (status === 'pick') picks++;
      else if (status === 'maybe') maybes++;
      else if (status === 'reject') rejects++;
    }

    if (picks + maybes + rejects === 0) {
      window.app.showToast('Belum ada foto yang ditandai untuk di-export');
      return;
    }

    this.modalPickCount.textContent = picks;
    this.modalMaybeCount.textContent = maybes;
    this.modalRejectCount.textContent = rejects;

    this.progressContainer.classList.add('hidden');
    this.btnConfirm.disabled = false;
    this.btnCancel.disabled = false;
    this.modal.classList.remove('hidden');
  }

  closeModal() {
    this.modal.classList.add('hidden');
  }

  async startExport() {
    const folderPath = window.photoManager.folderPath;
    if (!folderPath) return;

    const mode = document.querySelector('input[name="exportMode"]:checked')?.value || 'copy';

    const includePicks = this.chkExportPicks.checked;
    const includeMaybes = this.chkExportMaybes.checked;
    const includeRejects = this.chkExportRejects.checked;

    if (!includePicks && !includeMaybes && !includeRejects) {
      window.app.showToast('Pilih minimal satu kategori untuk di-export', 'error');
      return;
    }

    // Collect target photos
    const targets = [];
    for (const photo of window.photoManager.photos) {
      const status = window.selectionManager.getSelection(photo.filename);
      if (!status) continue;

      if ((status === 'pick' && includePicks) ||
          (status === 'maybe' && includeMaybes) ||
          (status === 'reject' && includeRejects)) {
        targets.push({
          filename: photo.filename,
          fullPath: photo.fullPath,
          status: status
        });
      }
    }

    if (targets.length === 0) {
      window.app.showToast('Tidak ada foto yang cocok dengan kategori yang dipilih');
      return;
    }

    // Start UI progress
    this.progressContainer.classList.remove('hidden');
    this.progressBar.style.width = '30%';
    this.statusText.textContent = `Mengekspor ${targets.length} foto (${mode === 'move' ? 'Move' : 'Copy'})...`;
    this.btnConfirm.disabled = true;
    this.btnCancel.disabled = true;

    try {
      const result = await window.electronAPI.exportPhotos({
        folderPath: folderPath,
        mode: mode,
        targets: targets
      });

      this.progressBar.style.width = '100%';

      if (result.success) {
        this.statusText.textContent = `Selesai! ${result.results.processed} foto berhasil di-${mode === 'move' ? 'pindahkan' : 'salin'}.`;
        window.app.showToast(`Export berhasil: ${result.results.processed} foto diproses`);

        // If files were moved, reload the folder
        if (mode === 'move') {
          setTimeout(async () => {
            this.closeModal();
            await window.app.loadFolder(folderPath);
          }, 1200);
        } else {
          setTimeout(() => {
            this.closeModal();
          }, 1500);
        }
      } else {
        this.statusText.textContent = `Gagal: ${result.error}`;
        this.btnConfirm.disabled = false;
        this.btnCancel.disabled = false;
      }
    } catch (err) {
      console.error('Export failed:', err);
      this.statusText.textContent = `Terjadi kesalahan: ${err.message}`;
      this.btnConfirm.disabled = false;
      this.btnCancel.disabled = false;
    }
  }
}

window.exportManager = new ExportManager();
