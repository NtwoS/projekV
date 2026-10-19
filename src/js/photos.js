// Photos Manager: scanning, loading, preloading, zooming & panning
// Optimized for zero-lag high-speed photo culling
class PhotoManager {
  constructor() {
    this.folderPath = null;
    this.photos = [];
    this.currentIndex = -1;

    // Decoded image cache — keeps fully decoded bitmaps in memory
    // so switching photos is instant without re-decoding from disk
    this.imageCache = new Map(); // index -> Image object (decoded)
    this.CACHE_AHEAD = 3;  // pre-decode 3 photos ahead
    this.CACHE_BEHIND = 1; // keep 1 photo behind

    // Zoom & Pan state
    this.scale = 1.0;
    this.panX = 0;
    this.panY = 0;
    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartY = 0;

    // DOM Elements (cached once, never re-queried)
    this.mainImage = document.getElementById('mainImage');
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
      // Clear old cache when switching folders
      this.imageCache.clear();
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

    // Reset zoom when switching photos (skip DOM update if already at 1x)
    if (this.scale !== 1.0) {
      this.resetZoom(false);
    } else {
      this.panX = 0;
      this.panY = 0;
    }

    // Check if this photo is already decoded in cache
    const cached = this.imageCache.get(index);
    if (cached && cached.complete && cached.src) {
      // Use cached decoded bitmap — instant display
      this.mainImage.src = cached.src;
    } else {
      // Fallback: load directly with async decode
      this.mainImage.decoding = 'async';
      this.mainImage.src = photoUrl;
    }

    // Update metadata info
    this.photoFilename.textContent = photo.filename;
    this.photoFileSize.textContent = this.formatFileSize(photo.size);
    this.photoDimensions.textContent = '';

    // Preload adjacent photos into cache
    this.preloadAdjacentPhotos(index);

    // Notify listeners — only update what's needed
    if (window.filmstripManager) {
      window.filmstripManager.setActive(index);
    }
    if (window.selectionManager) {
      window.selectionManager.updateViewerBorder();
      window.selectionManager.updateStats();
    }
    if (window.sidebarManager) {
      window.sidebarManager.highlightCurrent(index);
    }

    return true;
  }

  preloadAdjacentPhotos(currentIndex) {
    // Pre-decode photos ahead (most likely direction of navigation)
    for (let offset = 1; offset <= this.CACHE_AHEAD; offset++) {
      const idx = currentIndex + offset;
      if (idx < this.photos.length && !this.imageCache.has(idx)) {
        const url = window.electronAPI.toPhotoUrl(this.photos[idx].fullPath);
        const img = new Image();
        img.decoding = 'async';
        img.src = url;
        this.imageCache.set(idx, img);
      }
    }

    // Pre-decode photo behind
    for (let offset = 1; offset <= this.CACHE_BEHIND; offset++) {
      const idx = currentIndex - offset;
      if (idx >= 0 && !this.imageCache.has(idx)) {
        const url = window.electronAPI.toPhotoUrl(this.photos[idx].fullPath);
        const img = new Image();
        img.decoding = 'async';
        img.src = url;
        this.imageCache.set(idx, img);
      }
    }

    // Evict distant photos from cache to prevent memory bloat
    // Keep only photos within [currentIndex - CACHE_BEHIND - 2, currentIndex + CACHE_AHEAD + 2]
    const keepMin = currentIndex - this.CACHE_BEHIND - 2;
    const keepMax = currentIndex + this.CACHE_AHEAD + 2;
    for (const cachedIdx of this.imageCache.keys()) {
      if (cachedIdx < keepMin || cachedIdx > keepMax) {
        this.imageCache.delete(cachedIdx);
      }
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
