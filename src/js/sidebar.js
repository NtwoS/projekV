// Right Sidebar Manager: High-performance list of selected/rejected photos
class SidebarManager {
  constructor() {
    this.sidebar = document.getElementById('sidebarRight');
    this.sidebarList = document.getElementById('sidebarList');
    this.btnToggle = document.getElementById('btnToggleSidebar');
    this.btnClose = document.getElementById('btnCloseSidebar');
    this.btnExport = document.getElementById('btnSidebarExport');

    this.filterButtons = document.querySelectorAll('.sidebar-filter-btn');
    this.filterCountAll = document.getElementById('filterCountAll');
    this.filterCountPick = document.getElementById('filterCountPick');
    this.filterCountReject = document.getElementById('filterCountReject');
    this.filterCountMaybe = document.getElementById('filterCountMaybe');

    this.currentFilter = 'all'; // 'all' | 'pick' | 'reject' | 'maybe'
    this.isOpen = true;
    this.cardMap = new Map(); // filename -> DOM Card Element (avoids re-creating images!)

    this.initEventListeners();
  }

  initEventListeners() {
    if (this.btnToggle) {
      this.btnToggle.addEventListener('click', () => this.toggle());
    }
    if (this.btnClose) {
      this.btnClose.addEventListener('click', () => this.close());
    }
    if (this.btnExport) {
      this.btnExport.addEventListener('click', () => {
        if (window.exportManager) window.exportManager.openModal();
      });
    }

    this.filterButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        this.filterButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentFilter = btn.dataset.filter || 'all';
        this.render();
      });
    });
  }

  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  open() {
    this.isOpen = true;
    if (this.sidebar) {
      this.sidebar.classList.remove('collapsed');
      this.sidebar.classList.remove('hidden');
    }
    if (this.btnToggle) {
      this.btnToggle.classList.add('active');
    }
    this.render();
  }

  close() {
    this.isOpen = false;
    if (this.sidebar) {
      this.sidebar.classList.add('collapsed');
    }
    if (this.btnToggle) {
      this.btnToggle.classList.remove('active');
    }
  }

  show() {
    if (this.sidebar) {
      this.sidebar.classList.remove('hidden');
      this.open();
    }
  }

  hide() {
    if (this.sidebar) {
      this.sidebar.classList.add('hidden');
    }
  }

  // Fast in-place item update without destroying other cards/images
  updateItem(photo, index, status) {
    this.updateCounts();

    if (!this.isOpen || !this.sidebarList) return;

    const existingCard = this.cardMap.get(photo.filename);

    if (!status) {
      // Photo unmarked: remove card
      if (existingCard) {
        existingCard.remove();
        this.cardMap.delete(photo.filename);
      }
      this.checkEmptyState();
      return;
    }

    // Check filter match
    const matchesFilter = this.currentFilter === 'all' || this.currentFilter === status;

    if (existingCard) {
      if (!matchesFilter) {
        existingCard.style.display = 'none';
      } else {
        existingCard.style.display = 'flex';
        existingCard.className = `sidebar-item status-${status}`;
        const chip = existingCard.querySelector('.status-chip');
        if (chip) {
          const st = this.getStatusConfig(status);
          chip.className = `status-chip ${st.class}`;
          chip.textContent = `${st.icon} ${st.label}`;
        }
      }
    } else if (matchesFilter) {
      const card = this.createCardElement(photo, index, status);
      this.sidebarList.appendChild(card);
      this.cardMap.set(photo.filename, card);
    }

    this.checkEmptyState();
  }

  getStatusConfig(status) {
    const statusLabels = {
      pick: { label: 'PICK', icon: '✓', class: 'badge-pick' },
      reject: { label: 'REJECT', icon: '✕', class: 'badge-reject' },
      maybe: { label: 'MAYBE', icon: '?', class: 'badge-maybe' }
    };
    return statusLabels[status] || { label: status, icon: '', class: '' };
  }

  createCardElement(photo, index, status) {
    const card = document.createElement('div');
    card.className = `sidebar-item status-${status}`;
    card.dataset.filename = photo.filename;

    const st = this.getStatusConfig(status);
    const thumbUrl = window.electronAPI.toPhotoUrl(photo.fullPath);

    card.innerHTML = `
      <img class="sidebar-thumb" src="${thumbUrl}" alt="${photo.filename}" loading="lazy" decoding="async" />
      <div class="sidebar-info">
        <div class="sidebar-item-header">
          <span class="sidebar-item-index">${index + 1}</span>
          <span class="sidebar-item-name" title="${photo.filename}">${photo.filename}</span>
        </div>
        <div class="sidebar-item-meta">
          <span class="status-chip ${st.class}">${st.icon} ${st.label}</span>
        </div>
      </div>
      <div class="sidebar-item-actions">
        <button class="btn-item-action btn-change-pick" title="Ubah jadi Pick">✓</button>
        <button class="btn-item-action btn-change-reject" title="Ubah jadi Reject">✕</button>
        <button class="btn-item-action btn-change-clear" title="Hapus Status">—</button>
      </div>
    `;

    // Click card to jump to photo
    card.addEventListener('click', (e) => {
      if (e.target.closest('.btn-item-action')) return;
      if (window.photoManager && window.photoManager.showPhotoByFilename) {
        window.photoManager.showPhotoByFilename(photo.filename);
      } else {
        window.photoManager.showPhoto(index);
      }
    });

    // Quick action buttons
    card.querySelector('.btn-change-pick').addEventListener('click', (e) => {
      e.stopPropagation();
      this.changePhotoStatus(photo, index, 'pick');
    });

    card.querySelector('.btn-change-reject').addEventListener('click', (e) => {
      e.stopPropagation();
      this.changePhotoStatus(photo, index, 'reject');
    });

    card.querySelector('.btn-change-clear').addEventListener('click', (e) => {
      e.stopPropagation();
      this.changePhotoStatus(photo, index, null);
    });

    return card;
  }

  changePhotoStatus(photo, index, newStatus) {
    if (newStatus) {
      window.selectionManager.selections.set(photo.filename, newStatus);
    } else {
      window.selectionManager.selections.delete(photo.filename);
    }

    if (window.filmstripManager) {
      window.filmstripManager.updateItemStatus(photo.filename, newStatus);
    }
    window.selectionManager.updateViewerBorder();
    window.selectionManager.updateStats();
    window.selectionManager.persist();
    this.updateItem(photo, index, newStatus);
  }

  updateCounts() {
    if (!window.photoManager || !window.selectionManager) return;
    let pickCount = 0, rejectCount = 0, maybeCount = 0;

    for (const [, status] of window.selectionManager.selections.entries()) {
      if (status === 'pick') pickCount++;
      else if (status === 'reject') rejectCount++;
      else if (status === 'maybe') maybeCount++;
    }

    const total = pickCount + rejectCount + maybeCount;
    if (this.filterCountAll) this.filterCountAll.textContent = total;
    if (this.filterCountPick) this.filterCountPick.textContent = pickCount;
    if (this.filterCountReject) this.filterCountReject.textContent = rejectCount;
    if (this.filterCountMaybe) this.filterCountMaybe.textContent = maybeCount;
  }

  render() {
    if (!this.sidebarList || !window.photoManager || !window.selectionManager) return;
    if (!this.isOpen) return;

    this.updateCounts();
    this.sidebarList.innerHTML = '';
    this.cardMap.clear();

    const photos = window.photoManager.photos;
    const selections = window.selectionManager.selections;
    const fragment = document.createDocumentFragment();

    photos.forEach((photo, index) => {
      const status = selections.get(photo.filename);
      if (status) {
        if (this.currentFilter === 'all' || this.currentFilter === status) {
          const card = this.createCardElement(photo, index, status);
          this.cardMap.set(photo.filename, card);
          fragment.appendChild(card);
        }
      }
    });

    this.sidebarList.appendChild(fragment);
    this.checkEmptyState();
    this.highlightCurrent(window.photoManager.currentIndex);
  }

  checkEmptyState() {
    const visibleCards = Array.from(this.sidebarList.children).filter(el => !el.classList.contains('sidebar-empty') && el.style.display !== 'none');
    let emptyEl = this.sidebarList.querySelector('.sidebar-empty');

    if (visibleCards.length === 0) {
      if (!emptyEl) {
        emptyEl = document.createElement('div');
        emptyEl.className = 'sidebar-empty';
        emptyEl.innerHTML = '<p>Belum ada foto yang ditandai.</p>';
        this.sidebarList.appendChild(emptyEl);
      }
      emptyEl.style.display = 'flex';
    } else if (emptyEl) {
      emptyEl.style.display = 'none';
    }
  }

  highlightCurrent(index) {
    if (!this.isOpen || !this.sidebarList) return;
    const photos = window.photoManager.photos;
    if (index < 0 || index >= photos.length) return;

    const currentCard = this.sidebarList.querySelector('.sidebar-item.current');
    if (currentCard) currentCard.classList.remove('current');

    const filename = photos[index].filename;
    const target = this.cardMap.get(filename);
    if (target && target.style.display !== 'none') {
      target.classList.add('current');
      // Instant scroll without animating behavior: 'smooth' which causes queuing lag
      target.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    }
  }
}

window.sidebarManager = new SidebarManager();
