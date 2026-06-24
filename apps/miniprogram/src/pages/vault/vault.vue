<script setup lang="ts">
import { friendlyErrorMessage } from '@/utils/errors';
import { onShow } from '@dcloudio/uni-app';
import { computed, ref } from 'vue';
import { decryptText } from '@/utils/api';
import { decryptFileMetadata, decryptVaultTitle } from '@/utils/crypto-flow';
import { ensureVaultAccess, isLoggedIn, isVaultUnlocked } from '@/utils/access';
import {
  heartbeat,
  listAlbums,
  listFiles,
  listVaultItems,
  type AlbumItem,
  type VaultFileItem,
  type VaultItem,
} from '@/utils/services';
import { setCustomTabBarSelected } from '@/utils/tabbar';

type CategoryKey = 'password' | 'account' | 'note' | 'file' | 'album';

interface VaultCategory {
  key: CategoryKey;
  title: string;
  desc: string;
  count: number;
  url: string;
  icon: string;
  tone: 'blue' | 'green' | 'violet' | 'cyan' | 'rose';
}

interface RecentItem {
  id: string;
  title: string;
  type: string;
  updatedAt: string;
  url: string;
}

const loading = ref(false);
const categories = ref<VaultCategory[]>([
  {
    key: 'password',
    title: '账号密码',
    desc: '网站、应用登录',
    count: 0,
    url: '/pages/passwords/passwords',
    icon: '/static/icons/vault-menu/password.svg',
    tone: 'blue',
  },
  {
    key: 'account',
    title: '敏感账户',
    desc: '银行卡、证件等',
    count: 0,
    url: '/pages/accounts-hub/accounts-hub',
    icon: '/static/icons/vault-menu/accounts.svg',
    tone: 'green',
  },
  {
    key: 'note',
    title: '私密笔记',
    desc: '富文本内容',
    count: 0,
    url: '/pages/notes/notes',
    icon: '/static/icons/vault-menu/notes.svg',
    tone: 'violet',
  },
  {
    key: 'file',
    title: '文件管理',
    desc: '文档、压缩包等',
    count: 0,
    url: '/pages/upload-file/upload-file',
    icon: '/static/icons/vault-menu/files.svg',
    tone: 'cyan',
  },
  {
    key: 'album',
    title: '相册管理',
    desc: '照片、视频、影像',
    count: 0,
    url: '/pages/albums/albums',
    icon: '/static/icons/vault-menu/albums.svg',
    tone: 'rose',
  },
]);
const recentItems = ref<RecentItem[]>([]);

const secondaryTools = [
  { title: '搜索', url: '/pages/search/search', icon: '/static/icons/vault-menu/search.svg', tone: 'blue' },
  { title: '标签管理', url: '/pages/search/search', icon: '/static/icons/vault-menu/accounts.svg', tone: 'green' },
  { title: '分类管理', url: '/pages/vault/vault', icon: '/static/icons/vault-menu/files.svg', tone: 'violet' },
  { title: '导出备份', url: '/pages/export/export', icon: '/static/icons/vault-menu/export.svg', tone: 'orange' },
  { title: '回收站', url: '/pages/recycle-bin/recycle-bin', icon: '/static/icons/vault-menu/recycle.svg', tone: 'gray' },
];

const totalProtectedAssets = computed(() =>
  categories.value.reduce((sum, item) => sum + item.count, 0),
);

onShow(() => {
  setCustomTabBarSelected(1);
  if (!isLoggedIn() || !isVaultUnlocked()) {
    loading.value = false;
    recentItems.value = [];
    updateCategoryCounts({ password: 0, account: 0, note: 0, file: 0, album: 0 });
    return;
  }
  void loadDashboard();
  void heartbeat().catch(() => undefined);
});

async function loadDashboard() {
  loading.value = true;
  try {
    const [
      passwordResult,
      noteResult,
      documentResult,
      stockResult,
      bankResult,
      emailResult,
      serverResult,
      customResult,
      fileResult,
      albumResult,
      allVaultResult,
    ] = await Promise.all([
      listVaultItems('password'),
      listVaultItems('note'),
      listVaultItems('document'),
      listVaultItems('stock_account'),
      listVaultItems('bank_account'),
      listVaultItems('email_account'),
      listVaultItems('server_account'),
      listVaultItems('custom'),
      listFiles(),
      listAlbums(),
      listVaultItems(undefined, 1),
    ]);
    const managedFileCount = await countManagedFiles(fileResult.items);

    updateCategoryCounts({
      password: passwordResult.total,
      account:
        documentResult.total +
        stockResult.total +
        bankResult.total +
        emailResult.total +
        serverResult.total +
        customResult.total,
      note: noteResult.total,
      file: managedFileCount,
      album: albumResult.total,
    });

    recentItems.value = await buildRecentItems(
      allVaultResult.items,
      fileResult.items,
      albumResult.items,
    );
  } catch (error) {
    uni.showToast({
      title: friendlyErrorMessage(error, '保险箱加载失败'),
      icon: 'none',
    });
  } finally {
    loading.value = false;
  }
}

async function countManagedFiles(files: VaultFileItem[]) {
  let total = 0;
  for (const file of files) {
    if (file.fileType !== 'document' || file.albumId) continue;
    try {
      const meta = file.encryptedMetadata ? await decryptFileMetadata(file.encryptedMetadata) : {};
      if (meta.tags === '私密笔记') continue;
    } catch {
      // Undecryptable metadata should not hide an otherwise valid encrypted document.
    }
    total += 1;
  }
  return total;
}

function updateCategoryCounts(counts: Record<CategoryKey, number>) {
  categories.value = categories.value.map((item) => ({
    ...item,
    count: counts[item.key] ?? 0,
  }));
}

async function buildRecentItems(
  vaultItems: VaultItem[],
  files: VaultFileItem[],
  albums: AlbumItem[],
) {
  const rows: RecentItem[] = [];

  for (const item of vaultItems.slice(0, 8)) {
    rows.push({
      id: item.id,
      title: await decodeVaultTitle(item),
      type: getVaultTypeLabel(item.type),
      updatedAt: item.updatedAt,
      url: getVaultItemUrl(item),
    });
  }

  for (const file of files.slice(0, 4)) {
    if (file.fileType !== 'document' || file.albumId) continue;
    try {
      const meta = file.encryptedMetadata ? await decryptFileMetadata(file.encryptedMetadata) : {};
      if (meta.tags === '私密笔记') continue;
    } catch {
      // ignore
    }
    rows.push({
      id: file.id,
      title: await decodeFileTitle(file),
      type: '文件管理',
      updatedAt: file.createdAt,
      url: '/pages/upload-file/upload-file',
    });
  }

  for (const album of albums.slice(0, 3)) {
    const name = await decodeAlbumName(album);
    rows.push({
      id: album.id,
      title: name,
      type: '相册管理',
      updatedAt: album.createdAt,
      url: `/pages/album-detail/album-detail?albumId=${album.id}&name=${encodeURIComponent(name)}`,
    });
  }

  return rows
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5);
}

async function decodeVaultTitle(item: VaultItem) {
  try {
    return await decryptVaultTitle(item.titleCiphertext);
  } catch {
    return '已加密资料';
  }
}

async function decodeFileTitle(file: VaultFileItem) {
  try {
    if (file.encryptedMetadata) {
      const metadata = await decryptFileMetadata(file.encryptedMetadata);
      return metadata.displayName || '加密文件';
    }
  } catch {
    // ignore
  }
  return file.mimeType || '加密文件';
}

async function decodeAlbumName(album: AlbumItem) {
  try {
    return await decryptText(album.encryptedName);
  } catch {
    return '加密相册';
  }
}

function getVaultTypeLabel(type: string) {
  const labels: Record<string, string> = {
    password: '账号密码',
    note: '私密笔记',
    document: '敏感账户',
    stock_account: '敏感账户',
    bank_account: '敏感账户',
    email_account: '敏感账户',
    server_account: '敏感账户',
    custom: '敏感账户',
  };
  return labels[type] ?? '私密资料';
}

function getVaultItemUrl(item: VaultItem) {
  if (item.type === 'password') {
    return `/pages/password-create/password-create?id=${item.id}`;
  }
  if (item.type === 'note') return `/pages/note-create/note-create?id=${item.id}`;
  if (
    ['document', 'stock_account', 'bank_account', 'email_account', 'server_account', 'custom'].includes(
      item.type,
    )
  ) {
    return `/pages/accounts/accounts?type=${item.type}`;
  }
  return '/pages/search/search';
}

function formatTime(value: string) {
  const date = new Date(value);
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  return sameDay ? `今天 ${time}` : `${date.getMonth() + 1}月${date.getDate()}日 ${time}`;
}

function navigate(url: string) {
  if (url === '/pages/vault/vault') {
    uni.showToast({ title: '当前已在分类页', icon: 'none' });
    return;
  }
  if (isTabBarPage(url)) {
    uni.switchTab({ url });
    return;
  }
  uni.navigateTo({ url });
}

function isTabBarPage(url: string) {
  return ['/pages/index/index', '/pages/vault/vault', '/pages/albums/albums', '/pages/security/security', '/pages/profile/profile'].includes(
    url.split('?')[0],
  );
}

function goSearch() {
  uni.navigateTo({ url: '/pages/search/search' });
}

function getCategoryUnit(item: VaultCategory) {
  return item.key === 'album' ? '张' : '项';
}

function getRecentTone(type: string) {
  if (type === '账号密码') return 'blue';
  if (type === '文件管理') return 'orange';
  if (type === '相册管理') return 'rose';
  if (type === '私密笔记') return 'violet';
  return 'green';
}

async function showCreateSheet() {
  if (!(await ensureVaultAccess('登录并解锁保险箱后即可新增加密内容。'))) return;
  const items = ['账号密码', '敏感账户', '私密笔记', '上传文件', '上传图片/视频'];
  uni.showActionSheet({
    itemList: items,
    success: (res) => {
      const routes = [
        '/pages/password-create/password-create',
        '/pages/accounts-hub/accounts-hub',
        '/pages/note-create/note-create',
        '/pages/upload-file/upload-file',
        '/pages/upload-image/upload-image',
      ];
      const url = routes[res.tapIndex];
      if (url) navigate(url);
    },
  });
}
</script>

<template>
  <view class="vault-page tabbar-page">
    <view class="vault-header">
      <text class="vault-title">保险箱</text>
      <view class="asset-summary">
        <text>已保护</text>
        <text class="asset-number">{{ totalProtectedAssets }}</text>
        <text>项资产</text>
      </view>
    </view>

    <view class="search-row">
      <view class="search-card" @tap="goSearch">
        <image class="search-symbol" src="/static/icons/vault-menu/search.svg" mode="aspectFit" />
        <text class="search-placeholder">搜索账号、文件、笔记、相册等</text>
      </view>
      <button class="add-fab" @tap="showCreateSheet">
        <view class="plus-mark" />
      </button>
    </view>

    <view class="category-grid">
      <view
        v-for="item in categories"
        :key="item.key"
        class="category-card"
        :class="[item.tone, { wide: item.key === 'album' }]"
        @tap="navigate(item.url)"
      >
        <view class="category-icon-wrap">
          <view class="menu-icon">
            <image :src="item.icon" mode="aspectFit" />
          </view>
        </view>
        <view class="category-copy">
          <text class="category-title">{{ item.title }}</text>
          <view class="category-count-line">
            <text class="category-count">{{ item.count }}</text>
            <text class="category-unit">{{ getCategoryUnit(item) }}</text>
          </view>
          <text class="category-desc">{{ item.desc }}</text>
        </view>
        <text class="card-arrow">›</text>
      </view>
    </view>

    <view class="section-block">
      <view class="section-header">
        <text class="section-title">最近新增</text>
        <text class="section-link" @tap="goSearch">查看全部 ›</text>
      </view>
      <view class="recent-panel">
        <view v-if="loading" class="empty">正在同步保险箱内容...</view>
        <view v-else-if="recentItems.length === 0" class="empty">暂无加密资料</view>
        <view
          v-else
          v-for="item in recentItems"
          :key="`${item.type}-${item.id}`"
          class="recent-row"
          @tap="navigate(item.url)"
        >
          <view class="recent-icon" :class="getRecentTone(item.type)">
            <image
              :src="item.type === '文件管理'
                ? '/static/icons/vault-menu/files.svg'
                : item.type === '相册管理'
                  ? '/static/icons/vault-menu/albums.svg'
                  : item.type === '私密笔记'
                    ? '/static/icons/vault-menu/notes.svg'
                    : '/static/icons/vault-menu/password.svg'"
              mode="aspectFit"
            />
          </view>
          <view class="recent-copy">
            <text class="recent-title">{{ item.title }}</text>
            <text class="recent-tag" :class="getRecentTone(item.type)">{{ item.type }}</text>
          </view>
          <text class="recent-time">{{ formatTime(item.updatedAt) }}</text>
          <text class="recent-more">•••</text>
        </view>
      </view>
    </view>

    <view class="section-block tools-block">
      <view class="section-header">
        <text class="section-title">更多工具</text>
      </view>
      <view class="tools-grid">
        <view
          v-for="tool in secondaryTools"
          :key="tool.title"
          class="tool-card"
          @tap="navigate(tool.url)"
        >
          <view class="tool-icon-wrap" :class="tool.tone">
            <image class="tool-icon" :src="tool.icon" mode="aspectFit" />
          </view>
          <text class="tool-title">{{ tool.title }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
@import '@/uni.scss';

.vault-page {
  min-height: 100vh;
  padding: 32rpx 30rpx 160rpx;
  background:
    radial-gradient(circle at 80% 0%, rgba(30, 77, 255, 0.14), transparent 34%),
    linear-gradient(180deg, #f5f8ff 0%, #eef4ff 44%, #f8fafc 100%);
  box-sizing: border-box;
}

.hero-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 230rpx;
  padding: 34rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.82);
  border-radius: 38rpx;
  background: rgba(255, 255, 255, 0.78);
  box-shadow: 0 18rpx 48rpx rgba(11, 31, 77, 0.1);
  box-sizing: border-box;
}

.eyebrow {
  display: block;
  color: #1e4dff;
  font-size: 22rpx;
  font-weight: 700;
  letter-spacing: 1rpx;
}

.page-title {
  display: block;
  margin-top: 10rpx;
  font-size: 46rpx;
  font-weight: 700;
  color: #0b1f4d;
}

.page-subtitle {
  display: block;
  max-width: 470rpx;
  margin-top: 16rpx;
  font-size: 25rpx;
  line-height: 1.55;
  color: #6b7280;
}

.hero-lock {
  display: flex;
  width: 104rpx;
  height: 104rpx;
  flex: 0 0 104rpx;
  align-items: center;
  justify-content: center;
  border-radius: 32rpx;
  background: #eef4ff;
}

.hero-lock image {
  width: 78rpx;
  height: 78rpx;
}

.search-card {
  display: flex;
  align-items: center;
  height: 88rpx;
  margin-top: 28rpx;
  padding: 0 24rpx;
  border-radius: 28rpx;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 12rpx 30rpx rgba(11, 31, 77, 0.06);
}

.search-symbol {
  width: 48rpx;
  height: 48rpx;
}

.search-placeholder {
  flex: 1;
  margin-left: 10rpx;
  font-size: 26rpx;
  color: #6b7280;
}

.filter-button {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 88rpx;
  height: 50rpx;
  border-radius: 18rpx;
  background: #eef3ff;
  color: #1e4dff;
  font-size: 22rpx;
  font-weight: 700;
}

.add-button {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 92rpx;
  margin: 28rpx 0 32rpx;
  border-radius: 26rpx;
  background: linear-gradient(135deg, #377dff, #1e4dff);
  color: #fff;
  font-size: 28rpx;
  font-weight: 700;
  line-height: 1;
  box-shadow: 0 16rpx 32rpx rgba(30, 77, 255, 0.24);
}

.section {
  margin-top: 32rpx;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24rpx;
}

.section-header.compact {
  margin-bottom: 18rpx;
}

.section-title {
  font-size: 30rpx;
  font-weight: 700;
  color: #0b1f4d;
}

.section-note {
  font-size: 24rpx;
  color: #6b7280;
}

.category-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20rpx;
}

.category-card {
  min-height: 226rpx;
  padding: 26rpx;
  border: 1rpx solid rgba(226, 232, 240, 0.8);
  border-radius: 30rpx;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 14rpx 34rpx rgba(11, 31, 77, 0.07);
  box-sizing: border-box;
}

.category-card:first-child {
  grid-column: span 2;
  min-height: 178rpx;
}

.menu-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 72rpx;
  height: 72rpx;
  margin-bottom: 22rpx;
  border-radius: 24rpx;
}

.menu-icon image {
  width: 64rpx;
  height: 64rpx;
}

.blue { background: rgba(30, 77, 255, 0.08); }
.violet { background: rgba(124, 58, 237, 0.08); }
.green { background: rgba(22, 163, 74, 0.08); }
.cyan { background: rgba(8, 145, 178, 0.08); }
.rose { background: rgba(225, 29, 72, 0.08); }

.category-title {
  display: block;
  font-size: 29rpx;
  font-weight: 700;
  color: #0b1f4d;
}

.category-desc,
.tool-desc,
.recent-meta {
  display: block;
  margin-top: 8rpx;
  font-size: 22rpx;
  color: #6b7280;
  line-height: 1.45;
}

.category-count {
  display: block;
  flex: 0 0 auto;
  margin-left: 18rpx;
  font-size: 24rpx;
  font-weight: 700;
  color: #1e4dff;
}

.panel {
  margin-top: 32rpx;
  padding: 30rpx;
  border: 1rpx solid rgba(226, 232, 240, 0.8);
  border-radius: 30rpx;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 14rpx 34rpx rgba(11, 31, 77, 0.07);
}

.recent-row,
.tool-row {
  display: flex;
  align-items: center;
  min-height: 88rpx;
  border-bottom: 1rpx solid #eef1f6;
}

.recent-row:last-child,
.tool-row:last-child {
  border-bottom: none;
}

.recent-title,
.tool-title {
  display: block;
  font-size: 28rpx;
  font-weight: 700;
  color: #0b1f4d;
}

.tool-icon {
  width: 56rpx;
  height: 56rpx;
  margin-right: 18rpx;
  flex: 0 0 56rpx;
}

.tool-copy {
  min-width: 0;
  flex: 1;
}

.row-arrow {
  color: #9aa5b5;
  font-size: 42rpx;
}

.empty {
  padding: 56rpx 0;
  text-align: center;
  font-size: 26rpx;
  color: #9aa5b5;
}

/* Refined compact mobile style */
.vault-page {
  padding: 108rpx 24rpx 132rpx;
  background: #f6f8fb;
}

.hero-card,
.search-card,
.category-card,
.panel {
  border-radius: 24rpx;
  border-color: #e6ebf2;
  background: #fff;
  box-shadow: 0 8rpx 24rpx rgba(15, 23, 42, 0.04);
}

.hero-card {
  min-height: 152rpx;
  padding: 26rpx;
  border-color: transparent;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.94), rgba(245, 248, 255, 0.96)),
    #f6f8fb;
  box-shadow: 0 10rpx 28rpx rgba(15, 23, 42, 0.05);
}

.eyebrow {
  font-size: 20rpx;
  font-weight: 600;
}

.page-title {
  margin-top: 8rpx;
  font-size: 36rpx;
  font-weight: 650;
}

.page-subtitle {
  max-width: 500rpx;
  margin-top: 8rpx;
  font-size: 23rpx;
  line-height: 1.45;
}

.hero-lock {
  width: 68rpx;
  height: 68rpx;
  flex-basis: 68rpx;
  border-radius: 20rpx;
  background: rgba(255, 255, 255, 0.72);
  box-shadow: none;
}

.hero-lock image {
  width: 46rpx;
  height: 46rpx;
}

.search-card {
  height: 76rpx;
  margin-top: 18rpx;
  padding: 0 18rpx;
}

.search-symbol {
  width: 36rpx;
  height: 36rpx;
}

.search-placeholder {
  font-size: 24rpx;
}

.filter-button {
  min-width: 76rpx;
  height: 44rpx;
  border-radius: 14rpx;
  font-size: 21rpx;
  font-weight: 600;
}

.add-button {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 80rpx;
  margin: 18rpx 0 22rpx;
  border-radius: 20rpx;
  font-size: 26rpx;
  font-weight: 650;
  line-height: 1;
  box-shadow: 0 10rpx 22rpx rgba(30, 77, 255, 0.18);
}

.section {
  margin-top: 22rpx;
}

.section-header {
  margin-bottom: 14rpx;
}

.section-title {
  font-size: 28rpx;
  font-weight: 650;
}

.section-note {
  font-size: 22rpx;
}

.category-grid {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.category-card,
.category-card:first-child {
  display: flex;
  align-items: center;
  min-height: 104rpx;
  padding: 20rpx;
}

.menu-icon {
  width: 50rpx;
  height: 50rpx;
  flex: 0 0 50rpx;
  margin: 0 18rpx 0 0;
  border-radius: 16rpx;
}

.menu-icon image {
  width: 36rpx;
  height: 36rpx;
}

.category-copy {
  min-width: 0;
  flex: 1;
}

.category-title,
.recent-title,
.tool-title {
  font-size: 26rpx;
  font-weight: 600;
}

.category-desc,
.recent-meta,
.tool-desc {
  margin-top: 5rpx;
  font-size: 21rpx;
}

.category-count {
  margin-left: 14rpx;
  font-size: 22rpx;
  font-weight: 600;
}

.panel {
  margin-top: 18rpx;
  padding: 24rpx;
}

.recent-row,
.tool-row {
  min-height: 74rpx;
}

.tool-icon {
  width: 42rpx;
  height: 42rpx;
  margin-right: 14rpx;
}

.row-arrow {
  font-size: 34rpx;
}

.empty {
  padding: 40rpx 0;
  font-size: 24rpx;
}

/* Screenshot-inspired vault overview */
.vault-page {
  padding: 112rpx 36rpx 156rpx;
  background:
    radial-gradient(circle at 50% -8%, rgba(30, 77, 255, 0.1), transparent 42%),
    linear-gradient(180deg, #f7faff 0%, #f3f7ff 46%, #f8fafc 100%);
}

.vault-header {
  padding: 18rpx 6rpx 0;
}

.vault-title {
  display: block;
  color: #0b1f4d;
  font-size: 54rpx;
  font-weight: 650;
  line-height: 1.1;
}

.asset-summary {
  display: flex;
  align-items: baseline;
  gap: 10rpx;
  margin-top: 16rpx;
  color: #65728a;
  font-size: 25rpx;
}

.asset-number {
  color: #1e63ff;
  font-size: 32rpx;
  font-weight: 700;
}

.search-row {
  display: flex;
  align-items: center;
  gap: 26rpx;
  margin-top: 34rpx;
  height: 76rpx;
}

.search-card {
  display: flex;
  flex: 1;
  height: 76rpx;
  min-height: 76rpx;
  max-height: 76rpx;
  align-items: center;
  margin: 0;
  padding: 0 24rpx;
  border: none;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.92);
  box-shadow:
    inset 0 0 0 1rpx rgba(226, 232, 240, 0.7),
    0 16rpx 38rpx rgba(28, 55, 100, 0.06);
  box-sizing: border-box;
}

.search-symbol {
  width: 36rpx;
  height: 36rpx;
  opacity: 0.62;
}

.search-placeholder {
  flex: 1;
  margin-left: 18rpx;
  color: #9aa5b8;
  font-size: 27rpx;
}

.add-fab {
  display: flex;
  width: 76rpx;
  height: 76rpx;
  flex: 0 0 76rpx;
  align-items: center;
  justify-content: center;
  margin: 0;
  padding: 0;
  border-radius: 50%;
  background: linear-gradient(145deg, #3f7cff, #1157f2);
  color: #fff;
  box-shadow: 0 16rpx 28rpx rgba(30, 77, 255, 0.25);
}

.add-fab::after {
  border: none;
}

.plus-mark {
  position: relative;
  width: 34rpx;
  height: 34rpx;
}

.plus-mark::before,
.plus-mark::after {
  position: absolute;
  left: 50%;
  top: 50%;
  display: block;
  width: 34rpx;
  height: 5rpx;
  border-radius: 999rpx;
  background: #fff;
  content: '';
  transform: translate(-50%, -50%);
}

.plus-mark::after {
  transform: translate(-50%, -50%) rotate(90deg);
}

.category-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 24rpx;
  margin-top: 42rpx;
}

.category-card,
.category-card:first-child {
  position: relative;
  display: flex;
  flex-direction: row;
  grid-column: auto;
  min-height: 194rpx;
  align-items: center;
  padding: 28rpx 24rpx;
  overflow: hidden;
  border: none;
  border-radius: 28rpx;
  background: rgba(255, 255, 255, 0.88);
  box-shadow:
    inset 0 0 0 1rpx rgba(255, 255, 255, 0.72),
    0 18rpx 44rpx rgba(28, 55, 100, 0.07);
  box-sizing: border-box;
}

.category-card.wide {
  grid-column: span 2;
  min-height: 174rpx;
}

.category-card.blue {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.94), rgba(240, 246, 255, 0.9));
}

.category-card.green {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.94), rgba(239, 252, 246, 0.92));
}

.category-card.violet {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.94), rgba(248, 243, 255, 0.92));
}

.category-card.cyan {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.94), rgba(255, 247, 237, 0.92));
}

.category-card.rose {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(255, 241, 246, 0.92));
}

.category-icon-wrap {
  display: flex;
  width: 92rpx;
  height: 92rpx;
  flex: 0 0 92rpx;
  align-items: center;
  justify-content: center;
  margin-right: 18rpx;
  border-radius: 50%;
}

.category-card.blue .category-icon-wrap { background: #eef4ff; }
.category-card.green .category-icon-wrap { background: #eafaf2; }
.category-card.violet .category-icon-wrap { background: #f5efff; }
.category-card.cyan .category-icon-wrap { background: #fff4e5; }
.category-card.rose .category-icon-wrap { background: #fff0f5; }

.menu-icon {
  display: flex;
  width: 72rpx;
  height: 72rpx;
  align-items: center;
  justify-content: center;
  margin: 0;
  border-radius: 0;
  background: transparent;
}

.menu-icon image {
  width: 72rpx;
  height: 72rpx;
}

.category-copy {
  min-width: 0;
  flex: 1;
  padding-right: 10rpx;
}

.category-title {
  display: block;
  color: #101f3f;
  font-size: 29rpx;
  font-weight: 650;
  line-height: 1.18;
}

.category-count-line {
  display: flex;
  align-items: baseline;
  gap: 8rpx;
  margin-top: 18rpx;
}

.category-count {
  margin: 0;
  color: #102447;
  font-size: 44rpx;
  font-weight: 650;
  line-height: 1;
}

.category-unit {
  color: #64748b;
  font-size: 22rpx;
}

.category-desc {
  display: block;
  margin-top: 12rpx;
  overflow: hidden;
  color: #64748b;
  font-size: 23rpx;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-arrow {
  position: absolute;
  right: 16rpx;
  top: 50%;
  transform: translateY(-50%);
  color: #7d899c;
  font-size: 44rpx;
  font-weight: 300;
}

.section-block {
  margin-top: 48rpx;
}

.section-header {
  margin: 0 10rpx 22rpx;
}

.section-title {
  color: #0b1f4d;
  font-size: 29rpx;
  font-weight: 650;
}

.section-link {
  color: #8a96aa;
  font-size: 24rpx;
}

.recent-panel {
  overflow: hidden;
  border-radius: 28rpx;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 18rpx 44rpx rgba(28, 55, 100, 0.07);
}

.recent-row {
  display: flex;
  min-height: 96rpx;
  align-items: center;
  padding: 0 28rpx;
  border-bottom: 1rpx solid #edf1f7;
}

.recent-row:last-child {
  border-bottom: none;
}

.recent-icon {
  display: flex;
  width: 52rpx;
  height: 52rpx;
  flex: 0 0 52rpx;
  align-items: center;
  justify-content: center;
  margin-right: 22rpx;
  border-radius: 14rpx;
}

.recent-icon image {
  width: 36rpx;
  height: 36rpx;
}

.recent-icon.blue { background: #eaf2ff; }
.recent-icon.green { background: #eafaf2; }
.recent-icon.violet { background: #f4edff; }
.recent-icon.orange { background: #fff4e5; }
.recent-icon.rose { background: #fff0f5; }

.recent-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: 14rpx;
}

.recent-title {
  display: block;
  max-width: 250rpx;
  overflow: hidden;
  color: #102447;
  font-size: 27rpx;
  font-weight: 620;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recent-tag {
  flex: 0 0 auto;
  padding: 5rpx 12rpx;
  border-radius: 10rpx;
  font-size: 20rpx;
  line-height: 1;
}

.recent-tag.blue { background: #edf4ff; color: #1e63ff; }
.recent-tag.green { background: #edfdf5; color: #12a166; }
.recent-tag.violet { background: #f4efff; color: #7c3aed; }
.recent-tag.orange { background: #fff4e5; color: #f08a12; }
.recent-tag.rose { background: #fff0f5; color: #db2777; }

.recent-time {
  flex: 0 0 auto;
  margin-left: 12rpx;
  color: #8a96aa;
  font-size: 23rpx;
}

.recent-more {
  flex: 0 0 auto;
  margin-left: 22rpx;
  color: #8d97aa;
  font-size: 28rpx;
  letter-spacing: 2rpx;
}

.tools-block {
  margin-top: 42rpx;
}

.tools-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 16rpx;
}

.tool-card {
  display: flex;
  min-height: 128rpx;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 22rpx;
  background: rgba(255, 255, 255, 0.84);
  box-shadow: 0 14rpx 34rpx rgba(28, 55, 100, 0.06);
}

.tool-icon-wrap {
  display: flex;
  width: 46rpx;
  height: 46rpx;
  align-items: center;
  justify-content: center;
  margin-bottom: 16rpx;
  border-radius: 14rpx;
}

.tool-icon-wrap.blue { background: #eaf2ff; }
.tool-icon-wrap.green { background: #eafaf2; }
.tool-icon-wrap.violet { background: #f4edff; }
.tool-icon-wrap.orange { background: #fff4e5; }
.tool-icon-wrap.gray { background: #f1f5f9; }

.tool-icon {
  width: 38rpx;
  height: 38rpx;
  margin: 0;
}

.tool-title {
  color: #102447;
  font-size: 22rpx;
  font-weight: 600;
  line-height: 1;
}

.empty {
  padding: 48rpx 0;
  color: #8a96aa;
  font-size: 24rpx;
}
</style>
