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

function getCurrentRoute() {
  const pages = getCurrentPages();
  const current = pages[pages.length - 1];
  return normalizePath(current && current.route);
}

Component({
  data: {
    list: tabs,
    selected: 0,
  },

  lifetimes: {
    attached() {
      this.updateSelected();
    },
  },

  pageLifetimes: {
    show() {
      this.updateSelected();
    },
  },

  methods: {
    updateSelected() {
      const route = getCurrentRoute();
      const selected = this.data.list.findIndex((item) => normalizePath(item.pagePath) === route);
      if (selected >= 0 && selected !== this.data.selected) {
        this.setData({ selected });
      }
    },

    switchTab(event) {
      const { index, path } = event.currentTarget.dataset;
      const nextSelected = Number(index);
      if (!path || Number.isNaN(nextSelected) || nextSelected === this.data.selected) return;
      this.setData({ selected: nextSelected });
      wx.switchTab({
        url: `/${normalizePath(path)}`,
        fail: () => this.updateSelected(),
      });
    },
  },
});
