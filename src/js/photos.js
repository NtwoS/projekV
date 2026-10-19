// Photos Manager: scanning, loading, preloading, zooming & panning
class PhotoManager {
  constructor() {
    this.folderPath = null;
    this.photos = [];
    this.currentIndex = -1;

    // Zoom & Pan state
    this.scale = 1.0;
    this.panX = 0;
    this.panY = 0;
    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartY = 0;

    // DOM Elements
    this.mainImage = document.getElementById('mainImage');
    this.preloadNext = document.getElementById('preloadNext');
    this.preloadPrev = document.getElementById('preloadPrev');
    this.photoFilename = document.getElementById('photoFilename');
    this.photoDimensions = document.getElementById('photoDimensions');
    this.photoFileSize = document.getElementById('photoFileSize');
    this.zoomBadge = document.getElementById('zoomBadge');
    this.zoomPercent = document.getElementById('zoomPercent');
    this.imageStage = document.getElementById('imageStage');
    this.viewerArea = document.getElementById('viewerArea');

    this.initEventListeners();
  }

  initEventListeners() {
    // Image loaded event to extract natural dimensions
    this.mainImage.addEventListener('load', () => {
      if (this.mainImage.naturalWidth && this.mainImage.naturalHeight) {
        this.photoDimensions.textContent = `${this.mainImage.naturalWidth} × ${this.mainImage.naturalHeight}`;
      }
    });

    // Reset zoom button
    const btnResetZoom = document.getElementById('btnResetZoom');
    if (btnResetZoom) {
      btnResetZoom.addEventListener('click', () => this.resetZoom());
    }

    // Mouse drag for panning when zoomed
    this.imageStage.addEventListener('mousedown', (e) => {
      if (this.scale > 1.05) {
        this.isDragging = true;
        this.dragStartX = e.clientX - this.panX;
        this.dragStartY = e.clientY - this.panY;
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isDragging) {
        this.panX = e.clientX - this.dragStartX;
        this.panY = e.clientY - this.dragStartY;
        this.applyTransform();
      }
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    // Double click to toggle 2x zoom or reset
    this.imageStage.addEventListener('dblclick', (e) => {
      if (this.scale > 1.1) {
        this.resetZoom();
      } else {
        this.setZoom(2.2, e.clientX, e.clientY);
      }
    });
  }

  async loadFolder(folderPath) {
    if (!folderPath) return false;
    try {
      const photos = await window.electronAPI.scanPhotos(folderPath);
      if (!photos || photos.length === 0) {
        window.app.showToast('Tidak ada foto yang didukung di folder ini.', 'error');
        return false;
      }

      this.folderPath = folderPath;
      this.photos = photos;
      return true;
    } catch (err) {
      console.error('Failed to load photos from folder:', err);
      window.app.showToast(`Gagal membuka folder: ${err.message}`, 'error');
      return false;
    }
  }

  getCurrentPhoto() {
    if (this.currentIndex >= 0 && this.currentIndex < this.photos.length) {
      return this.photos[this.currentIndex];
    }
    return null;
  }

  showPhoto(index) {
    if (index < 0 || index >= this.photos.length) return false;

    this.currentIndex = index;
    const photo = this.photos[index];
    const photoUrl = window.electronAPI.toPhotoUrl(photo.fullPath);

    // Reset zoom when switching photos
    this.resetZoom(false);

    // Set main image source
    this.mainImage.src = photoUrl;

    // Update metadata info
    this.photoFilename.textContent = photo.filename;
    this.photoFileSize.textContent = this.formatFileSize(photo.size);
    this.photoDimensions.textContent = '';

    // Preload next 2 photos and previous 1 photo
    this.preloadAdjacentPhotos(index);

    // Notify listeners
    if (window.filmstripManager) {
      window.filmstripManager.setActive(index);
    }
    if (window.selectionManager) {
      window.selectionManager.updateViewerBorder();
      window.selectionManager.updateStats();
    }

    return true;
  }

  preloadAdjacentPhotos(currentIndex) {
    // Preload next photo
    if (currentIndex + 1 < this.photos.length) {
      const nextUrl = window.electronAPI.toPhotoUrl(this.photos[currentIndex + 1].fullPath);
      this.preloadNext.src = nextUrl;
    }
    // Preload prev photo
    if (currentIndex - 1 >= 0) {
      const prevUrl = window.electronAPI.toPhotoUrl(this.photos[currentIndex - 1].fullPath);
      this.preloadPrev.src = prevUrl;
    }
  }

  nextPhoto() {
    if (this.currentIndex + 1 < this.photos.length) {
      this.showPhoto(this.currentIndex + 1);
      return true;
    }
    window.app.showToast('Sudah mencapai foto terakhir');
    return false;
  }

  prevPhoto() {
    if (this.currentIndex - 1 >= 0) {
      this.showPhoto(this.currentIndex - 1);
      return true;
    }
    window.app.showToast('Ini adalah foto pertama');
    return false;
  }

  // Zoom and Pan Controls
  zoomIn(delta = 0.3) {
    this.setZoom(this.scale + delta);
  }

  zoomOut(delta = 0.3) {
    this.setZoom(this.scale - delta);
  }

  setZoom(newScale) {
    this.scale = Math.max(1.0, Math.min(newScale, 5.0));

    if (this.scale <= 1.05) {
      this.resetZoom();
      return;
    }

    this.zoomBadge.classList.remove('hidden');
    this.zoomPercent.textContent = `${Math.round(this.scale * 100)}%`;
    this.applyTransform();
  }

  resetZoom(render = true) {
    this.scale = 1.0;
    this.panX = 0;
    this.panY = 0;
    this.zoomBadge.classList.add('hidden');
    if (render) {
      this.applyTransform();
    }
  }

  panBy(dx, dy) {
    if (this.scale <= 1.05) return;
    this.panX += dx;
    this.panY += dy;
    this.applyTransform();
  }

  applyTransform() {
    this.mainImage.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.scale})`;
  }

  formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
}

window.photoManager = new PhotoManager();
