// Right Sidebar Manager: Displays list of selected/rejected/maybe photos
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
      this.render();
    }
  }

  hide() {
    if (this.sidebar) {
      this.sidebar.classList.add('hidden');
    }
  }

  render() {
    if (!this.sidebarList || !window.photoManager || !window.selectionManager) return;

    const photos = window.photoManager.photos;
    const selections = window.selectionManager.selections;

    // Collect all reviewed photos
    const items = [];
    let pickCount = 0;
    let rejectCount = 0;
    let maybeCount = 0;

    photos.forEach((photo, index) => {
      const status = selections.get(photo.filename);
      if (status) {
        if (status === 'pick') pickCount++;
        else if (status === 'reject') rejectCount++;
        else if (status === 'maybe') maybeCount++;

        if (this.currentFilter === 'all' || this.currentFilter === status) {
          items.push({ photo, index, status });
        }
      }
    });

    const totalReviewed = pickCount + rejectCount + maybeCount;

    // Update filter counts
    if (this.filterCountAll) this.filterCountAll.textContent = totalReviewed;
    if (this.filterCountPick) this.filterCountPick.textContent = pickCount;
    if (this.filterCountReject) this.filterCountReject.textContent = rejectCount;
    if (this.filterCountMaybe) this.filterCountMaybe.textContent = maybeCount;

    // Empty state
    if (items.length === 0) {
      const emptyMessages = {
        all: 'Belum ada foto yang ditandai.<br><small>Gunakan tombol Pick (A/1), Reject (B/2), atau Maybe (Y/3).</small>',
        pick: 'Belum ada foto yang di-Pick (Pilih).',
        reject: 'Belum ada foto yang di-Reject (Tolak).',
        maybe: 'Belum ada foto yang di-tanda Ragu-ragu.'
      };

      this.sidebarList.innerHTML = `
        <div class="sidebar-empty">
          <span class="sidebar-empty-icon">📁</span>
          <p>${emptyMessages[this.currentFilter] || emptyMessages.all}</p>
        </div>
      `;
      return;
    }

    this.sidebarList.innerHTML = '';
    const fragment = document.createDocumentFragment();
    const currentIndex = window.photoManager.currentIndex;

    items.forEach(({ photo, index, status }) => {
      const card = document.createElement('div');
      card.className = `sidebar-item status-${status}`;
      if (index === currentIndex) {
        card.classList.add('current');
      }

      const statusLabels = {
        pick: { label: 'Pick', icon: '✅', class: 'badge-pick' },
        reject: { label: 'Reject', icon: '❌', class: 'badge-reject' },
        maybe: { label: 'Ragu', icon: '🤔', class: 'badge-maybe' }
      };
      const st = statusLabels[status] || { label: status, icon: '', class: '' };

      const thumbUrl = window.electronAPI.toPhotoUrl(photo.fullPath);

      card.innerHTML = `
        <img class="sidebar-thumb" src="${thumbUrl}" alt="${photo.filename}" loading="lazy" />
        <div class="sidebar-info">
          <div class="sidebar-item-header">
            <span class="sidebar-item-index">#${index + 1}</span>
            <span class="sidebar-item-name" title="${photo.filename}">${photo.filename}</span>
          </div>
          <div class="sidebar-item-meta">
            <span class="status-chip ${st.class}">${st.icon} ${st.label}</span>
          </div>
        </div>
        <div class="sidebar-item-actions">
          <button class="btn-item-action btn-change-pick" title="Ubah jadi Pick">✅</button>
          <button class="btn-item-action btn-change-reject" title="Ubah jadi Reject">❌</button>
          <button class="btn-item-action btn-change-clear" title="Hapus Status">✕</button>
        </div>
      `;

      // Click card to jump to photo
      card.addEventListener('click', (e) => {
        if (e.target.closest('.btn-item-action')) return;
        window.photoManager.showPhoto(index);
      });

      // Quick action buttons
      const btnPick = card.querySelector('.btn-change-pick');
      btnPick.addEventListener('click', (e) => {
        e.stopPropagation();
        this.changePhotoStatus(photo, index, 'pick');
      });

      const btnReject = card.querySelector('.btn-change-reject');
      btnReject.addEventListener('click', (e) => {
        e.stopPropagation();
        this.changePhotoStatus(photo, index, 'reject');
      });

      const btnClear = card.querySelector('.btn-change-clear');
      btnClear.addEventListener('click', (e) => {
        e.stopPropagation();
        this.changePhotoStatus(photo, index, null);
      });

      fragment.appendChild(card);
    });

    this.sidebarList.appendChild(fragment);
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
    this.render();
  }

  highlightCurrent(index) {
    if (!this.sidebarList) return;
    const items = this.sidebarList.querySelectorAll('.sidebar-item');
    items.forEach(item => item.classList.remove('current'));

    const photos = window.photoManager.photos;
    if (index >= 0 && index < photos.length) {
      const filename = photos[index].filename;
      const target = Array.from(items).find(el => {
        const nameEl = el.querySelector('.sidebar-item-name');
        return nameEl && nameEl.textContent === filename;
      });
      if (target) {
        target.classList.add('current');
        target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }
}

window.sidebarManager = new SidebarManager();
