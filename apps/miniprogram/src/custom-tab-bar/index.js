const tabs = [
  { pagePath: '/pages/index/index', text: '首页', icon: '⌂' },
  { pagePath: '/pages/vault/vault', text: '保险箱', icon: '▣' },
  { pagePath: '/pages/albums/albums', text: '相册', icon: '◫' },
  { pagePath: '/pages/security/security', text: '安全', icon: '◈' },
  { pagePath: '/pages/profile/profile', text: '我的', icon: '◉' },
];

function normalizePath(path = '') {
  return path.startsWith('/') ? path : `/${path}`;
}

Component({
  data: {
    tabs,
    currentPath: '',
  },

  lifetimes: {
    attached() {
      this.syncCurrentPath();
    },
  },

  pageLifetimes: {
    show() {
      this.syncCurrentPath();
    },
  },

  methods: {
    syncCurrentPath() {
      const pages = getCurrentPages();
      const current = pages[pages.length - 1];
      this.setData({ currentPath: normalizePath(current && current.route) });
    },

    switchTab(event) {
      const index = event.currentTarget.dataset.index;
      const item = this.data.tabs[index];
      if (!item || this.data.currentPath === item.pagePath) return;
      wx.switchTab({ url: item.pagePath });
    },
  },
});
