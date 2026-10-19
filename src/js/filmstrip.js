// Filmstrip component: renders horizontal thumbnails and tracks active photo
// Optimized: O(1) active tracking, instant scroll, no querySelector scanning
class FilmstripManager {
  constructor() {
    this.track = document.getElementById('filmstripTrack');
    this.btnScrollLeft = document.getElementById('btnScrollFilmstripLeft');
    this.btnScrollRight = document.getElementById('btnScrollFilmstripRight');
    this.itemsMap = new Map(); // filename -> DOM element
    this.activeItem = null;    // cached reference — no querySelector needed

    this.initEventListeners();
  }

  initEventListeners() {
    if (this.btnScrollLeft) {
      this.btnScrollLeft.addEventListener('click', () => {
        // Instant scroll — no smooth queuing
        this.track.scrollLeft -= 320;
      });
    }

    if (this.btnScrollRight) {
      this.btnScrollRight.addEventListener('click', () => {
        // Instant scroll — no smooth queuing
        this.track.scrollLeft += 320;
      });
    }

    // Scroll horizontally with mouse wheel inside filmstrip
    if (this.track) {
      this.track.addEventListener('wheel', (e) => {
        if (e.deltaY !== 0) {
          e.preventDefault();
          this.track.scrollLeft += e.deltaY;
        }
      }, { passive: false });
    }
  }

  render(photos) {
    this.track.innerHTML = '';
    this.itemsMap.clear();
    this.activeItem = null;

    const fragment = document.createDocumentFragment();

    photos.forEach((photo, index) => {
      const item = document.createElement('div');
      item.className = 'filmstrip-item';
      item.dataset.index = index;
      item.dataset.filename = photo.filename;

      const img = document.createElement('img');
      img.loading = 'lazy';
      img.decoding = 'async';
      img.src = window.electronAPI.toPhotoUrl(photo.fullPath);
      img.alt = photo.filename;

      const indexLabel = document.createElement('span');
      indexLabel.className = 'filmstrip-index';
      indexLabel.textContent = index + 1;

      item.appendChild(img);
      item.appendChild(indexLabel);

      // Check existing status
      if (window.selectionManager) {
        const status = window.selectionManager.getSelection(photo.filename);
        if (status) {
          item.classList.add(`status-${status}`);
        }
      }

      // Click to jump to photo
      item.addEventListener('click', () => {
        window.photoManager.showPhoto(index);
      });

      this.itemsMap.set(photo.filename, item);
      fragment.appendChild(item);
    });

    this.track.appendChild(fragment);
  }

  setActive(index) {
    // O(1) deactivation using cached reference instead of querySelector scan
    if (this.activeItem) {
      this.activeItem.classList.remove('active');
    }

    const photos = window.photoManager.photos;
    if (index >= 0 && index < photos.length) {
      const photo = photos[index];
      const item = this.itemsMap.get(photo.filename);
      if (item) {
        item.classList.add('active');
        this.activeItem = item; // cache for next deactivation
        this.scrollToItem(item);
      }
    }
  }

  updateItemStatus(filename, status) {
    const item = this.itemsMap.get(filename);
    if (!item) return;

    item.classList.remove('status-pick', 'status-reject', 'status-maybe');
    if (status) {
      item.classList.add(`status-${status}`);
    }
  }

  scrollToItem(item) {
    if (!item || !this.track) return;
    // Instant arithmetic scroll — no animation queuing
    const targetScroll = item.offsetLeft - (this.track.clientWidth / 2) + (item.clientWidth / 2);
    this.track.scrollLeft = targetScroll;
  }

  scrollBy(amount) {
    if (this.track) {
      this.track.scrollLeft += amount;
    }
  }
}

window.filmstripManager = new FilmstripManager();
