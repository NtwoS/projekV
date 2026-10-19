// Filmstrip component: renders horizontal thumbnails and tracks active photo
class FilmstripManager {
  constructor() {
    this.track = document.getElementById('filmstripTrack');
    this.btnScrollLeft = document.getElementById('btnScrollFilmstripLeft');
    this.btnScrollRight = document.getElementById('btnScrollFilmstripRight');
    this.itemsMap = new Map(); // filename -> DOM element

    this.initEventListeners();
  }

  initEventListeners() {
    if (this.btnScrollLeft) {
      this.btnScrollLeft.addEventListener('click', () => {
        this.track.scrollBy({ left: -320, behavior: 'smooth' });
      });
    }

    if (this.btnScrollRight) {
      this.btnScrollRight.addEventListener('click', () => {
        this.track.scrollBy({ left: 320, behavior: 'smooth' });
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

    const fragment = document.createDocumentFragment();

    photos.forEach((photo, index) => {
      const item = document.createElement('div');
      item.className = 'filmstrip-item';
      item.dataset.index = index;
      item.dataset.filename = photo.filename;

      const img = document.createElement('img');
      img.loading = 'lazy';
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
    const currentActive = this.track.querySelector('.filmstrip-item.active');
    if (currentActive) {
      currentActive.classList.remove('active');
    }

    const photos = window.photoManager.photos;
    if (index >= 0 && index < photos.length) {
      const photo = photos[index];
      const item = this.itemsMap.get(photo.filename);
      if (item) {
        item.classList.add('active');
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
    const trackRect = this.track.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();

    const scrollLeft = this.track.scrollLeft + (itemRect.left - trackRect.left) - (trackRect.width / 2) + (itemRect.width / 2);
    this.track.scrollTo({ left: scrollLeft, behavior: 'smooth' });
  }

  scrollBy(amount) {
    if (this.track) {
      this.track.scrollLeft += amount;
    }
  }
}

window.filmstripManager = new FilmstripManager();
