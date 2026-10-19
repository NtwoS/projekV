// Filmstrip component: renders horizontal thumbnails and tracks active photo
// Performance: IntersectionObserver lazy-loads only visible thumbnails
// instead of loading ALL photos at once (which causes massive lag)
class FilmstripManager {
  constructor() {
    this.track = document.getElementById('filmstripTrack');
    this.btnScrollLeft = document.getElementById('btnScrollFilmstripLeft');
    this.btnScrollRight = document.getElementById('btnScrollFilmstripRight');
    this.itemsMap = new Map(); // filename -> DOM element
    this.activeItem = null;    // cached reference — no querySelector needed

    // IntersectionObserver: only load thumbnail images when they scroll into view
    this.observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const img = entry.target;
          const src = img.dataset.src;
          if (src && !img.src) {
            img.decoding = 'async';
            img.src = src;
          }
          this.observer.unobserve(img);
        }
      }
    }, {
      root: this.track,
      rootMargin: '0px 300px' // preload 300px ahead/behind scroll area
    });

    this.initEventListeners();
  }

  initEventListeners() {
    if (this.btnScrollLeft) {
      this.btnScrollLeft.addEventListener('click', () => {
        this.track.scrollLeft -= 320;
      });
    }

    if (this.btnScrollRight) {
      this.btnScrollRight.addEventListener('click', () => {
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
    // Disconnect all previous observers before clearing
    this.observer.disconnect();
    this.track.innerHTML = '';
    this.itemsMap.clear();
    this.activeItem = null;

    const fragment = document.createDocumentFragment();

    photos.forEach((photo, index) => {
      const item = document.createElement('div');
      item.className = 'filmstrip-item';
      item.dataset.index = index;
      item.dataset.filename = photo.filename;

      // Create img but DON'T set src — use data-src for lazy loading
      const img = document.createElement('img');
      img.dataset.src = window.electronAPI.toPhotoUrl(photo.fullPath);
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

      // Observe the img for lazy loading
      this.observer.observe(img);

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
