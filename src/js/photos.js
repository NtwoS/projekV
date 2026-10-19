// Photos Manager: scanning, loading, preloading, zooming & panning
// Optimized for zero-lag high-speed photo culling
class PhotoManager {
  constructor() {
    this.folderPath = null;
    this.allPhotos = []; // Master list of all photos in original folder order
    this.photos = [];    // Active list of photos currently displayed (filtered/sorted)
    this.currentIndex = -1;

    // Filter & Sort state
    this.isFilterActive = false;
    this.currentFilter = 'all'; // 'all' | 'unmarked' | 'pick' | 'reject' | 'maybe'
    this.currentSort = 'name-asc';

    // Decoded image cache — keeps fully decoded bitmaps in memory
    // so switching photos is instant without re-decoding from disk
    this.imageCache = new Map(); // index -> Image object (decoded)
    this.CACHE_AHEAD = 1;  // pre-decode 1 photo ahead (lightweight & saves RAM)
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

    // Filter & Sort Toolbar DOM elements
    this.viewerFilterToolbar = document.getElementById('viewerFilterToolbar');
    this.btnToggleViewerFilter = document.getElementById('btnToggleViewerFilter');
    this.btnCloseViewerFilter = document.getElementById('btnCloseViewerFilter');
    this.viewerFilterPills = document.querySelectorAll('#viewerFilterPills .filter-pill');
    this.viewerSortSelect = document.getElementById('viewerSortSelect');
    this.viewerFilterInfoText = document.getElementById('viewerFilterInfoText');
    this.viewerFilterEmptyState = document.getElementById('viewerFilterEmptyState');
    this.btnResetViewerFilter = document.getElementById('btnResetViewerFilter');

    // Filter count elements
    this.vfCountAll = document.getElementById('vfCountAll');
    this.vfCountUnmarked = document.getElementById('vfCountUnmarked');
    this.vfCountPick = document.getElementById('vfCountPick');
    this.vfCountReject = document.getElementById('vfCountReject');
    this.vfCountMaybe = document.getElementById('vfCountMaybe');

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

    // Filter & Sort Toolbar listeners
    if (this.btnToggleViewerFilter) {
      this.btnToggleViewerFilter.addEventListener('click', () => this.toggleFilterToolbar());
    }

    if (this.btnCloseViewerFilter) {
      this.btnCloseViewerFilter.addEventListener('click', () => this.toggleFilterToolbar(false));
    }

    if (this.btnResetViewerFilter) {
      this.btnResetViewerFilter.addEventListener('click', () => this.resetFilter());
    }

    if (this.viewerFilterPills) {
      this.viewerFilterPills.forEach(pill => {
        pill.addEventListener('click', () => {
          const filter = pill.dataset.filter || 'all';
          this.setFilter(filter);
        });
      });
    }

    if (this.viewerSortSelect) {
      this.viewerSortSelect.addEventListener('change', (e) => {
        this.setSort(e.target.value);
      });
    }
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
      this.allPhotos = photos.slice();
      this.photos = photos.slice();
      this.isFilterActive = false;
      this.currentFilter = 'all';
      this.currentSort = 'name-asc';

      if (this.viewerSortSelect) this.viewerSortSelect.value = 'name-asc';
      if (this.viewerFilterPills) {
        this.viewerFilterPills.forEach(p => p.classList.toggle('active', p.dataset.filter === 'all'));
      }
      if (this.viewerFilterToolbar) {
        this.viewerFilterToolbar.classList.add('hidden');
      }
      if (this.btnToggleViewerFilter) {
        this.btnToggleViewerFilter.classList.remove('active');
      }
      if (this.viewerFilterEmptyState) {
        this.viewerFilterEmptyState.classList.add('hidden');
      }

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

  showPhotoByFilename(filename) {
    if (!filename) return false;
    const idx = this.photos.findIndex(p => p.filename === filename);
    if (idx !== -1) {
      return this.showPhoto(idx);
    }
    // If not found in current active view (filtered out), reset filter and jump to it
    if (this.isFilterActive) {
      this.resetFilterAndSort();
      const newIdx = this.photos.findIndex(p => p.filename === filename);
      if (newIdx !== -1) {
        return this.showPhoto(newIdx);
      }
    }
    return false;
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

  // Filter & Sort Controls
  toggleFilterToolbar(forceState) {
    this.isFilterActive = (forceState !== undefined) ? forceState : !this.isFilterActive;
    if (this.viewerFilterToolbar) {
      this.viewerFilterToolbar.classList.toggle('hidden', !this.isFilterActive);
    }
    if (this.btnToggleViewerFilter) {
      this.btnToggleViewerFilter.classList.toggle('active', this.isFilterActive);
    }

    if (!this.isFilterActive) {
      this.resetFilterAndSort();
      if (window.app) window.app.showToast('Filter & Sort dinonaktifkan');
    } else {
      this.applyFilterAndSort();
      if (window.app) window.app.showToast('Filter & Sort diaktifkan');
    }
  }

  setFilter(filterType) {
    this.currentFilter = filterType;
    if (this.viewerFilterPills) {
      this.viewerFilterPills.forEach(p => p.classList.toggle('active', p.dataset.filter === filterType));
    }
    this.applyFilterAndSort();
  }

  setSort(sortType) {
    this.currentSort = sortType;
    if (this.viewerSortSelect) {
      this.viewerSortSelect.value = sortType;
    }
    this.applyFilterAndSort();
  }

  resetFilter() {
    this.setFilter('all');
  }

  resetFilterAndSort() {
    const currentPhoto = this.getCurrentPhoto();
    this.photos = this.allPhotos.slice();
    this.currentFilter = 'all';
    this.currentSort = 'name-asc';
    if (this.viewerSortSelect) this.viewerSortSelect.value = 'name-asc';
    if (this.viewerFilterPills) {
      this.viewerFilterPills.forEach(p => p.classList.toggle('active', p.dataset.filter === 'all'));
    }
    if (this.viewerFilterEmptyState) {
      this.viewerFilterEmptyState.classList.add('hidden');
    }

    if (window.filmstripManager) {
      window.filmstripManager.render(this.photos);
    }

    let targetIdx = 0;
    if (currentPhoto) {
      const found = this.photos.findIndex(p => p.filename === currentPhoto.filename);
      if (found !== -1) targetIdx = found;
    }
    this.showPhoto(targetIdx);
    this.updateFilterCounts();
  }

  applyFilterAndSort() {
    if (!this.allPhotos || this.allPhotos.length === 0) return;
    const currentPhoto = this.getCurrentPhoto();

    let list = this.allPhotos.slice();

    // 1. Filter
    if (this.currentFilter !== 'all' && window.selectionManager) {
      list = list.filter(p => {
        const status = window.selectionManager.getSelection(p.filename);
        if (this.currentFilter === 'unmarked') return !status;
        return status === this.currentFilter;
      });
    }

    // 2. Sort
    list.sort((a, b) => {
      switch (this.currentSort) {
        case 'name-desc':
          return b.filename.localeCompare(a.filename, undefined, { numeric: true, sensitivity: 'base' });
        case 'name-asc':
          return a.filename.localeCompare(b.filename, undefined, { numeric: true, sensitivity: 'base' });
        case 'date-desc':
          return (b.mtime || 0) - (a.mtime || 0);
        case 'date-asc':
          return (a.mtime || 0) - (b.mtime || 0);
        case 'size-desc':
          return (b.size || 0) - (a.size || 0);
        case 'size-asc':
          return (a.size || 0) - (b.size || 0);
        case 'status': {
          const priority = { pick: 1, maybe: 2, reject: 3, null: 4 };
          const stA = window.selectionManager ? (window.selectionManager.getSelection(a.filename) || 'null') : 'null';
          const stB = window.selectionManager ? (window.selectionManager.getSelection(b.filename) || 'null') : 'null';
          const diff = (priority[stA] || 4) - (priority[stB] || 4);
          return diff !== 0 ? diff : a.filename.localeCompare(b.filename, undefined, { numeric: true, sensitivity: 'base' });
        }
        default:
          return 0;
      }
    });

    this.photos = list;
    this.imageCache.clear();

    if (window.filmstripManager) {
      window.filmstripManager.render(this.photos);
    }

    if (this.photos.length === 0) {
      this.currentIndex = -1;
      if (this.viewerFilterEmptyState) {
        this.viewerFilterEmptyState.classList.remove('hidden');
      }
      this.mainImage.src = '';
      this.photoFilename.textContent = '-';
      this.photoDimensions.textContent = '';
      this.photoFileSize.textContent = '';
      if (window.selectionManager) {
        window.selectionManager.updateViewerBorder();
        window.selectionManager.updateStats();
      }
    } else {
      if (this.viewerFilterEmptyState) {
        this.viewerFilterEmptyState.classList.add('hidden');
      }
      let targetIdx = 0;
      if (currentPhoto) {
        const found = this.photos.findIndex(p => p.filename === currentPhoto.filename);
        if (found !== -1) {
          targetIdx = found;
        } else {
          targetIdx = Math.min(Math.max(0, this.currentIndex), this.photos.length - 1);
        }
      }
      this.showPhoto(targetIdx);
    }

    this.updateFilterCounts();
  }

  onPhotoMarked(photo, status) {
    if (this.isFilterActive && this.currentFilter !== 'all') {
      const stillMatches = (this.currentFilter === 'unmarked' && !status) || (status === this.currentFilter);
      if (!stillMatches) {
        this.applyFilterAndSort();
        return;
      }
    }
    this.nextPhoto();
  }

  updateFilterCounts() {
    if (!this.allPhotos || !window.selectionManager) return;
    const sm = window.selectionManager;
    const totalAll = this.allPhotos.length;
    const pick = sm._pickCount;
    const reject = sm._rejectCount;
    const maybe = sm._maybeCount;
    const unmarked = Math.max(0, totalAll - (pick + reject + maybe));

    if (this.vfCountAll) this.vfCountAll.textContent = totalAll;
    if (this.vfCountUnmarked) this.vfCountUnmarked.textContent = unmarked;
    if (this.vfCountPick) this.vfCountPick.textContent = pick;
    if (this.vfCountReject) this.vfCountReject.textContent = reject;
    if (this.vfCountMaybe) this.vfCountMaybe.textContent = maybe;

    if (this.viewerFilterInfoText) {
      this.viewerFilterInfoText.textContent = `Menampilkan ${this.photos.length} dari ${totalAll} foto`;
    }
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
