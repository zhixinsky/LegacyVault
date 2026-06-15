const TAB_BAR_PAGES = [
  '/pages/index/index',
  '/pages/vault/vault',
  '/pages/albums/albums',
  '/pages/security/security',
  '/pages/profile/profile',
];

interface TabBarHost {
  route?: string;
  getTabBar?: () =>
    | {
        setData?: (data: { selected?: number; visible?: boolean }) => void;
        syncCurrentPath?: (path?: string) => void;
      }
    | undefined;
}

function normalizePath(path = '') {
  const purePath = String(path).split('?')[0].replace(/^\/+/, '');
  return purePath ? `/${purePath}` : '';
}

function getCurrentRoute() {
  const pages = getCurrentPages();
  const current = pages[pages.length - 1] as TabBarHost | undefined;
  return normalizePath(current?.route);
}

function getHiddenState() {
  const app = getApp<{ globalData?: { tabBarHidden?: boolean } }>();
  return Boolean(app.globalData?.tabBarHidden);
}

function syncOnce(route?: string) {
  const pages = getCurrentPages();
  const current = pages[pages.length - 1] as TabBarHost | undefined;
  const currentPath = normalizePath(route || current?.route || getCurrentRoute());
  const selected = TAB_BAR_PAGES.findIndex((page) => normalizePath(page) === currentPath);
  if (selected < 0 || typeof current?.getTabBar !== 'function') return;

  const tabBar = current.getTabBar();
  if (!tabBar) return;

  if (typeof tabBar.syncCurrentPath === 'function') {
    tabBar.syncCurrentPath(currentPath);
    return;
  }

  if (typeof tabBar.setData === 'function') {
    tabBar.setData({
      selected,
      visible: !getHiddenState(),
    });
  }
}

export function syncCustomTabBar(route?: string) {
  syncOnce(route);
  [50, 180, 360, 720].forEach((delay) => {
    setTimeout(() => syncOnce(route), delay);
  });
}
