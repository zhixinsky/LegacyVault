<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app';
import { ref } from 'vue';
import { decryptText } from '@/utils/api';
import { decryptFileMetadata, decryptVaultTitle } from '@/utils/crypto-flow';
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
    desc: '登录密码、网站账号、应用口令',
    count: 0,
    url: '/pages/passwords/passwords',
    icon: '/static/icons/vault-menu/password.svg',
    tone: 'blue',
  },
  {
    key: 'account',
    title: '敏感账户',
    desc: '银行、股票、邮箱、服务器、证件',
    count: 0,
    url: '/pages/accounts-hub/accounts-hub',
    icon: '/static/icons/vault-menu/accounts.svg',
    tone: 'green',
  },
  {
    key: 'note',
    title: '私密笔记',
    desc: '文字、代码、表格与附件预览',
    count: 0,
    url: '/pages/notes/notes',
    icon: '/static/icons/vault-menu/notes.svg',
    tone: 'violet',
  },
  {
    key: 'file',
    title: '文件管理',
    desc: '文档、压缩包、加密附件',
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
  { title: '搜索', desc: '查找所有保险箱内容', url: '/pages/search/search', icon: '/static/icons/vault-menu/search.svg' },
  { title: '回收站', desc: '恢复或永久删除条目', url: '/pages/recycle-bin/recycle-bin', icon: '/static/icons/vault-menu/recycle.svg' },
  { title: '数据导出', desc: '导出本地解密资料', url: '/pages/export/export', icon: '/static/icons/vault-menu/export.svg' },
];

onShow(() => {
  setCustomTabBarSelected(1);
  loadDashboard();
  heartbeat().catch(() => undefined);
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
      title: error instanceof Error ? error.message : '保险箱加载失败',
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
  uni.navigateTo({ url });
}

function goSearch() {
  uni.navigateTo({ url: '/pages/search/search' });
}

function showFilter() {
  uni.showToast({ title: '可在搜索页按类型筛选', icon: 'none' });
}

function showCreateSheet() {
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
    <view class="hero-card">
      <view>
        <text class="eyebrow">VaultPass</text>
        <text class="page-title">数字保险箱</text>
        <text class="page-subtitle">账号密码、敏感账户、笔记、文件和相册均在本地解密后访问。</text>
      </view>
      <view class="hero-lock">
        <image src="/static/icons/vault-menu/password.svg" mode="aspectFit" />
      </view>
    </view>

    <view class="search-card" @tap="goSearch">
      <image class="search-symbol" src="/static/icons/vault-menu/search.svg" mode="aspectFit" />
      <text class="search-placeholder">搜索账号、笔记、文件、标签</text>
      <view class="filter-button" @tap.stop="showFilter">
        <text>筛选</text>
      </view>
    </view>

    <button class="add-button" @tap="showCreateSheet">新增保险箱内容</button>

    <view class="section">
      <view class="section-header">
        <text class="section-title">保险箱功能</text>
        <text v-if="loading" class="section-note">同步中</text>
      </view>
      <view class="category-grid">
        <view
          v-for="item in categories"
          :key="item.key"
          class="category-card"
          @tap="navigate(item.url)"
        >
          <view class="menu-icon" :class="item.tone">
            <image :src="item.icon" mode="aspectFit" />
          </view>
          <view class="category-copy">
            <text class="category-title">{{ item.title }}</text>
            <text class="category-desc">{{ item.desc }}</text>
            <text class="category-count">{{ item.count }}项</text>
          </view>
        </view>
      </view>
    </view>

    <view class="panel">
      <view class="section-header">
        <text class="section-title">最近保存</text>
        <text class="section-note">标题预览</text>
      </view>
      <view v-if="loading" class="empty">正在同步保险箱内容...</view>
      <view v-else-if="recentItems.length === 0" class="empty">暂无加密资料</view>
      <view v-else>
        <view
          v-for="item in recentItems"
          :key="`${item.type}-${item.id}`"
          class="recent-row"
          @tap="navigate(item.url)"
        >
          <view>
            <text class="recent-title">{{ item.title }}</text>
            <text class="recent-meta">{{ item.type }} · {{ formatTime(item.updatedAt) }}</text>
          </view>
          <text class="row-arrow">›</text>
        </view>
      </view>
    </view>

    <view class="panel">
      <view class="section-header compact">
        <text class="section-title">辅助工具</text>
      </view>
      <view
        v-for="tool in secondaryTools"
        :key="tool.url"
        class="tool-row"
        @tap="navigate(tool.url)"
      >
        <image class="tool-icon" :src="tool.icon" mode="aspectFit" />
        <view class="tool-copy">
          <text class="tool-title">{{ tool.title }}</text>
          <text class="tool-desc">{{ tool.desc }}</text>
        </view>
        <text class="row-arrow">›</text>
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
  font-weight: 800;
  letter-spacing: 1rpx;
}

.page-title {
  display: block;
  margin-top: 10rpx;
  font-size: 46rpx;
  font-weight: 900;
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
  font-weight: 800;
}

.add-button {
  height: 92rpx;
  margin: 28rpx 0 32rpx;
  border-radius: 26rpx;
  background: linear-gradient(135deg, #377dff, #1e4dff);
  color: #fff;
  font-size: 28rpx;
  font-weight: 800;
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
  font-weight: 800;
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
  font-weight: 800;
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
  margin-top: 18rpx;
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
</style>
