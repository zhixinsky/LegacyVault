interface CustomTabBar {
  setData?: (data: { selected: number }) => void;
}

interface TabPage {
  getTabBar?: () => CustomTabBar | undefined;
}

export function setCustomTabBarSelected(selected: number) {
  const pages = getCurrentPages();
  const current = pages[pages.length - 1] as TabPage | undefined;
  const tabBar = current?.getTabBar?.();
  tabBar?.setData?.({ selected });
}
