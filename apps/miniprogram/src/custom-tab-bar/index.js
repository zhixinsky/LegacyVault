const tabs = [
  {
    pagePath: '/pages/index/index',
    text: '首页',
    icon: '/static/icons/tabbar/home.svg',
    activeIcon: '/static/icons/tabbar/home-active.svg',
  },
  {
    pagePath: '/pages/vault/vault',
    text: '保险箱',
    icon: '/static/icons/tabbar/vault.svg',
    activeIcon: '/static/icons/tabbar/vault-active.svg',
  },
  {
    pagePath: '/pages/albums/albums',
    text: '相册',
    icon: '/static/icons/tabbar/albums.svg',
    activeIcon: '/static/icons/tabbar/albums-active.svg',
  },
  {
    pagePath: '/pages/security/security',
    text: '安全',
    icon: '/static/icons/tabbar/security.svg',
    activeIcon: '/static/icons/tabbar/security-active.svg',
  },
  {
    pagePath: '/pages/profile/profile',
    text: '我的',
    icon: '/static/icons/tabbar/profile.svg',
    activeIcon: '/static/icons/tabbar/profile-active.svg',
  },
];

function normalizePath(path = '') {
  const purePath = String(path).split('?')[0].replace(/^\/+/, '');
  return purePath ? `/${purePath}` : '';
}

function getSelectedIndex(path, list) {
  const currentPath = normalizePath(path);
  return list.findIndex((item) => normalizePath(item.pagePath) === currentPath);
}

Component({
  data: {
    list: tabs,
    selected: 0,
    visible: true,
  },

  lifetimes: {
    attached() {
      this.syncCurrentPath();
    },

    ready() {
      this.syncCurrentPathLater();
    },
  },

  pageLifetimes: {
    show() {
      this.syncCurrentPath();
      this.syncCurrentPathLater();
    },
  },

  methods: {
    syncCurrentPath(path) {
      const app = getApp();
      const hidden = app.globalData && app.globalData.tabBarHidden;
      const pages = getCurrentPages();
      const current = pages[pages.length - 1];
      const currentPath = normalizePath(path || (current && current.route));
      const selected = getSelectedIndex(currentPath, this.data.list);
      this.setData({
        selected: selected >= 0 ? selected : this.data.selected,
        visible: !hidden,
      });
    },

    syncCurrentPathLater(path) {
      setTimeout(() => this.syncCurrentPath(path), 50);
      setTimeout(() => this.syncCurrentPath(path), 180);
      setTimeout(() => this.syncCurrentPath(path), 360);
    },

    switchTab(event) {
      const index = event.currentTarget.dataset.index;
      const item = this.data.list[index];
      if (!item || Number(index) === this.data.selected) return;
      const app = getApp();
      if (app && app.globalData) {
        app.globalData.tabBarHidden = false;
      }
      this.setData({ selected: Number(index), visible: true });
      wx.switchTab({
        url: item.pagePath,
        success: () => this.syncCurrentPathLater(item.pagePath),
        fail: () => this.syncCurrentPathLater(),
      });
    },
  },
});
