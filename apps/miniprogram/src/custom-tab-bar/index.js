const tabs = [
  {
    pagePath: 'pages/index/index',
    text: '首页',
    icon: '/static/icons/tabbar/home.svg',
    activeIcon: '/static/icons/tabbar/home-active.svg',
  },
  {
    pagePath: 'pages/vault/vault',
    text: '保险箱',
    icon: '/static/icons/tabbar/vault.svg',
    activeIcon: '/static/icons/tabbar/vault-active.svg',
  },
  {
    pagePath: 'pages/albums/albums',
    text: '相册',
    icon: '/static/icons/tabbar/albums.svg',
    activeIcon: '/static/icons/tabbar/albums-active.svg',
  },
  {
    pagePath: 'pages/security/security',
    text: '安全',
    icon: '/static/icons/tabbar/security.svg',
    activeIcon: '/static/icons/tabbar/security-active.svg',
  },
  {
    pagePath: 'pages/profile/profile',
    text: '我的',
    icon: '/static/icons/tabbar/profile.svg',
    activeIcon: '/static/icons/tabbar/profile-active.svg',
  },
];

function normalizePath(path = '') {
  const purePath = String(path).split('?')[0].replace(/^\/+/, '');
  return purePath;
}

Component({
  data: {
    list: tabs,
    selected: 0,
    dragging: false,
  },

  methods: {
    getDragIndex(touch) {
      const rect = this.dragRect;
      if (!rect || !touch) return -1;

      const ratio = (touch.clientX - rect.left) / rect.width;
      const rawIndex = Math.floor(ratio * this.data.list.length);
      return Math.max(0, Math.min(this.data.list.length - 1, rawIndex));
    },

    navigateToIndex(index) {
      const nextSelected = Number(index);
      const item = this.data.list[nextSelected];
      const currentSelected = this.committedSelected ?? this.data.selected;
      if (!item || Number.isNaN(nextSelected) || nextSelected === currentSelected) {
        this.setData({ selected: currentSelected });
        return;
      }

      const previousSelected = currentSelected;
      this.committedSelected = nextSelected;
      this.setData({ selected: nextSelected });
      wx.switchTab({
        url: `/${normalizePath(item.pagePath)}`,
        fail: () => {
          this.committedSelected = previousSelected;
          this.setData({ selected: previousSelected });
        },
      });
    },

    switchTab(event) {
      const { index, path } = event.currentTarget.dataset;
      const nextSelected = Number(index);
      if (this.ignoreNextTap) {
        this.ignoreNextTap = false;
        return;
      }
      if (!path || Number.isNaN(nextSelected)) return;
      this.committedSelected = this.data.selected;
      this.navigateToIndex(nextSelected);
    },

    handleTouchStart(event) {
      const touch = event.touches && event.touches[0];
      this.dragStartX = touch ? touch.clientX : 0;
      this.dragMoved = false;
      this.committedSelected = this.data.selected;
      this.createSelectorQuery()
        .select('.tab-capsule')
        .boundingClientRect((rect) => {
          this.dragRect = rect;
        })
        .exec();
    },

    handleTouchMove(event) {
      const touch = event.touches && event.touches[0];
      if (!touch || !this.dragRect) return;
      if (Math.abs(touch.clientX - this.dragStartX) < 6 && !this.dragMoved) return;

      const nextSelected = this.getDragIndex(touch);
      if (nextSelected < 0) return;
      this.dragMoved = true;
      if (!this.data.dragging) {
        this.setData({ dragging: true });
      }
      if (nextSelected !== this.data.selected) {
        this.setData({ selected: nextSelected });
      }
    },

    handleTouchEnd(event) {
      if (!this.dragMoved) return;
      const changed = this.data.selected !== this.committedSelected;
      this.ignoreNextTap = true;
      this.setData({ dragging: false });
      if (changed) {
        this.navigateToIndex(this.data.selected);
        return;
      }
      this.setData({ selected: this.committedSelected });
    },

    handleTouchCancel() {
      this.ignoreNextTap = false;
      this.dragMoved = false;
      this.setData({
        dragging: false,
        selected: this.committedSelected ?? this.data.selected,
      });
    },
  },
});
