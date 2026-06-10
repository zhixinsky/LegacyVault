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

type CategoryKey = 'password' | 'note' | 'document' | 'finance' | 'file' | 'album';

interface VaultCategory {
  key: CategoryKey;
  title: string;
  desc: string;
  count: number;
  url: string;
  icon: 'key' | 'note' | 'id' | 'finance' | 'file' | 'album';
  tone: 'blue' | 'violet' | 'amber' | 'green' | 'cyan' | 'rose';
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
    desc: '邮箱、网站、服务器',
    count: 0,
    url: '/pages/passwords/passwords',
    icon: 'key',
    tone: 'blue',
  },
  {
    key: 'note',
    title: '私密笔记',
    desc: '备忘、密钥、想法',
    count: 0,
    url: '/pages/notes/notes',
    icon: 'note',
    tone: 'violet',
  },
  {
    key: 'document',
    title: '证件资料',
    desc: '身份证、护照、合同',
    count: 0,
    url: '/pages/accounts/accounts?type=document',
    icon: 'id',
    tone: 'amber',
  },
  {
    key: 'finance',
    title: '金融账户',
    desc: '股票、银行、基金',
    count: 0,
    url: '/pages/accounts-hub/accounts-hub',
    icon: 'finance',
    tone: 'green',
  },
  {
    key: 'file',
    title: '文件保险箱',
    desc: '文档、压缩包、附件',
    count: 0,
    url: '/pages/upload-file/upload-file',
    icon: 'file',
    tone: 'cyan',
  },
  {
    key: 'album',
    title: '私密相册',
    desc: '照片、视频、影像',
    count: 0,
    url: '/pages/albums/albums',
    icon: 'album',
    tone: 'rose',
  },
]);
const recentItems = ref<RecentItem[]>([]);

const tags = ['工作', '家庭', '金融', '证件', '重要'];
const tools = [
  { title: '回收站', desc: '管理已删除的加密资料', url: '/pages/recycle-bin/recycle-bin' },
  { title: '数据导出', desc: '导出审计记录与资料清单', url: '/pages/export/export' },
  { title: '分类管理', desc: '整理账号、证件与金融资料', url: '/pages/accounts-hub/accounts-hub' },
];

onShow(() => {
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
      fileResult,
      albumResult,
      allVaultResult,
    ] = await Promise.all([
      listVaultItems('password'),
      listVaultItems('note'),
      listVaultItems('document'),
      listVaultItems('stock_account'),
      listVaultItems('bank_account'),
      listFiles(),
      listAlbums(),
      listVaultItems(undefined, 1),
    ]);

    updateCategoryCounts({
      password: passwordResult.total,
      note: noteResult.total,
      document: documentResult.total,
      finance: stockResult.total + bankResult.total,
      file: fileResult.total,
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
    rows.push({
      id: file.id,
      title: await decodeFileTitle(file),
      type: '文件保险箱',
      updatedAt: file.createdAt,
      url: '/pages/upload-file/upload-file',
    });
  }

  for (const album of albums.slice(0, 3)) {
    const name = await decodeAlbumName(album);
    rows.push({
      id: album.id,
      title: name,
      type: '私密相册',
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
    document: '证件资料',
    stock_account: '金融账户',
    bank_account: '金融账户',
    email_account: '账号密码',
    server_account: '账号密码',
    custom: '私密资料',
  };
  return labels[type] ?? '私密资料';
}

function getVaultItemUrl(item: VaultItem) {
  if (item.type === 'password') return `/pages/password-create/password-create?id=${item.id}`;
  if (item.type === 'note') return `/pages/note-create/note-create?id=${item.id}`;
  if (item.type === 'document') return '/pages/accounts/accounts?type=document';
  if (['stock_account', 'bank_account', 'email_account', 'server_account', 'custom'].includes(item.type)) {
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
  const items = ['账号密码', '私密笔记', '身份证件', '银行/股票账户', '上传文件', '上传图片/视频'];
  uni.showActionSheet({
    itemList: items,
    success: (res) => {
      const routes = [
        '/pages/password-create/password-create',
        '/pages/note-create/note-create',
        '/pages/account-create/account-create?type=document',
        '/pages/accounts-hub/accounts-hub',
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
  <view class="vault-page">
    <view class="page-header">
      <text class="page-title">保险箱</text>
      <text class="page-subtitle">管理所有已加密存储的私密资料</text>
    </view>

    <view class="search-card" @tap="goSearch">
      <view class="search-icon">
        <view class="search-lens" />
      </view>
      <text class="search-placeholder">搜索账号、笔记、文件、标签</text>
      <view class="filter-button" @tap.stop="showFilter">
        <view class="filter-line" />
      </view>
    </view>

    <button class="add-button" @tap="showCreateSheet">新增私密资料</button>

    <view class="section">
      <view class="section-header">
        <text class="section-title">核心分类</text>
        <text v-if="loading" class="section-note">同步中</text>
      </view>
      <view class="category-grid">
        <view
          v-for="item in categories"
          :key="item.key"
          class="category-card"
          @tap="navigate(item.url)"
        >
          <view class="line-icon" :class="[item.tone, item.icon]">
            <view class="icon-shape" />
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
        <text class="section-note">仅显示标题与类型</text>
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
        <text class="section-title">常用标签</text>
      </view>
      <view class="tag-list">
        <text v-for="tag in tags" :key="tag" class="tag">{{ tag }}</text>
      </view>
    </view>

    <view class="panel bottom-tools">
      <view class="section-header compact">
        <text class="section-title">底部工具</text>
        <text class="section-note">低频管理</text>
      </view>
      <view
        v-for="tool in tools"
        :key="tool.url"
        class="tool-row"
        @tap="navigate(tool.url)"
      >
        <view>
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
  padding: 32rpx;
  padding-bottom: 56rpx;
  background: #f6f8fc;
  box-sizing: border-box;
}

.page-header {
  margin-bottom: 28rpx;
}

.page-title {
  display: block;
  font-size: 44rpx;
  font-weight: 800;
  color: #0b1f4d;
}

.page-subtitle {
  display: block;
  margin-top: 10rpx;
  font-size: 24rpx;
  color: #6b7280;
}

.search-card {
  display: flex;
  align-items: center;
  height: 96rpx;
  padding: 0 24rpx;
  border-radius: 32rpx;
  background: #fff;
  box-shadow: 0 12rpx 30rpx rgba(11, 31, 77, 0.06);
}

.search-icon,
.filter-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52rpx;
  height: 52rpx;
}

.search-lens {
  width: 26rpx;
  height: 26rpx;
  border: 4rpx solid #1e4dff;
  border-radius: 50%;
  position: relative;
}

.search-lens::after {
  content: '';
  position: absolute;
  right: -12rpx;
  bottom: -9rpx;
  width: 16rpx;
  height: 4rpx;
  border-radius: 999rpx;
  background: #1e4dff;
  transform: rotate(45deg);
}

.search-placeholder {
  flex: 1;
  margin-left: 18rpx;
  font-size: 28rpx;
  color: #6b7280;
}

.filter-button {
  border-radius: 18rpx;
  background: #eef3ff;
}

.filter-line,
.filter-line::before,
.filter-line::after {
  width: 26rpx;
  height: 4rpx;
  border-radius: 999rpx;
  background: #1e4dff;
  content: '';
  display: block;
}

.filter-line {
  position: relative;
}

.filter-line::before {
  position: absolute;
  top: -10rpx;
  width: 18rpx;
}

.filter-line::after {
  position: absolute;
  top: 10rpx;
  right: 0;
  width: 18rpx;
}

.add-button {
  height: 96rpx;
  margin: 28rpx 0 32rpx;
  border-radius: 32rpx;
  background: #1e4dff;
  color: #fff;
  font-size: 30rpx;
  font-weight: 700;
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
  font-size: 32rpx;
  font-weight: 800;
  color: #0b1f4d;
}

.section-note {
  font-size: 24rpx;
  color: #6b7280;
}

.category-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24rpx;
}

.category-card {
  min-height: 230rpx;
  padding: 30rpx;
  border-radius: 36rpx;
  background: #fff;
  box-shadow: 0 12rpx 30rpx rgba(11, 31, 77, 0.06);
  box-sizing: border-box;
}

.line-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 60rpx;
  height: 60rpx;
  margin-bottom: 22rpx;
  border-radius: 20rpx;
}

.blue { color: #1e4dff; background: rgba(30, 77, 255, 0.1); }
.violet { color: #7c3aed; background: rgba(124, 58, 237, 0.1); }
.amber { color: #d97706; background: rgba(217, 119, 6, 0.12); }
.green { color: #16a34a; background: rgba(22, 163, 74, 0.1); }
.cyan { color: #0891b2; background: rgba(8, 145, 178, 0.1); }
.rose { color: #e11d48; background: rgba(225, 29, 72, 0.1); }

.icon-shape {
  position: relative;
  width: 32rpx;
  height: 32rpx;
  border: 4rpx solid currentColor;
  box-sizing: border-box;
}

.key .icon-shape {
  border-radius: 50%;
}

.key .icon-shape::after {
  content: '';
  position: absolute;
  left: 24rpx;
  top: 10rpx;
  width: 28rpx;
  height: 4rpx;
  background: currentColor;
  box-shadow: 12rpx 0 0 currentColor;
}

.note .icon-shape,
.id .icon-shape,
.file .icon-shape,
.album .icon-shape {
  border-radius: 8rpx;
}

.note .icon-shape::after {
  content: '';
  position: absolute;
  left: 6rpx;
  top: 8rpx;
  width: 18rpx;
  height: 4rpx;
  background: currentColor;
  box-shadow: 0 10rpx 0 currentColor;
}

.id .icon-shape::after {
  content: '';
  position: absolute;
  left: 6rpx;
  top: 6rpx;
  width: 10rpx;
  height: 10rpx;
  border-radius: 50%;
  background: currentColor;
  box-shadow: 0 14rpx 0 -2rpx currentColor, 14rpx 2rpx 0 -2rpx currentColor, 14rpx 14rpx 0 -2rpx currentColor;
}

.finance .icon-shape {
  border-radius: 50%;
}

.finance .icon-shape::before {
  content: '';
  position: absolute;
  left: 12rpx;
  top: -8rpx;
  width: 4rpx;
  height: 40rpx;
  background: currentColor;
}

.finance .icon-shape::after {
  content: '';
  position: absolute;
  left: 4rpx;
  top: 8rpx;
  width: 20rpx;
  height: 4rpx;
  background: currentColor;
}

.file .icon-shape::after {
  content: '';
  position: absolute;
  right: -4rpx;
  top: -4rpx;
  width: 12rpx;
  height: 12rpx;
  border-left: 4rpx solid currentColor;
  border-bottom: 4rpx solid currentColor;
  background: #fff;
}

.album .icon-shape::after {
  content: '';
  position: absolute;
  left: 6rpx;
  bottom: 6rpx;
  width: 18rpx;
  height: 12rpx;
  border-left: 4rpx solid currentColor;
  border-bottom: 4rpx solid currentColor;
  transform: rotate(-35deg);
}

.category-title {
  display: block;
  font-size: 30rpx;
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
  padding: 32rpx;
  border-radius: 36rpx;
  background: #fff;
  box-shadow: 0 12rpx 30rpx rgba(11, 31, 77, 0.06);
}

.recent-row,
.tool-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
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

.row-arrow {
  color: #9aa5b5;
  font-size: 42rpx;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 18rpx;
}

.tag {
  padding: 14rpx 24rpx;
  border-radius: 999rpx;
  background: #f1f5ff;
  color: #1e4dff;
  font-size: 24rpx;
  font-weight: 600;
}

.empty {
  padding: 56rpx 0;
  text-align: center;
  font-size: 26rpx;
  color: #9aa5b5;
}
</style>
