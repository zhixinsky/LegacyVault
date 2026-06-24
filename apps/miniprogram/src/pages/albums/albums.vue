<script setup lang="ts">
import { friendlyErrorMessage } from '@/utils/errors';
import { onShow } from '@dcloudio/uni-app';
import { computed, ref } from 'vue';
import { extensionFromMime, isImageFile, isVideoFile } from '@vaultpass/types';
import { decryptText, downloadEncryptedFile } from '@/utils/api';
import {
  decryptDownloadedBuffer,
  encryptField,
  writeDecryptedPreviewFile,
} from '@/utils/crypto-flow';
import { ensureVaultAccess, isLoggedIn, isVaultUnlocked } from '@/utils/access';
import { createAlbum, listAlbums, listFiles, type AlbumItem } from '@/utils/services';
import { setCustomTabBarSelected } from '@/utils/tabbar';

interface AlbumViewItem {
  id: string;
  name: string;
  count: number;
  photoCount: number;
  videoCount: number;
  coverPath?: string;
}

interface RecentMediaItem {
  id: string;
  previewPath?: string;
  time: string;
  isVideo: boolean;
}

const albums = ref<AlbumViewItem[]>([]);
const recentMedia = ref<RecentMediaItem[]>([]);
const loading = ref(false);

const photoCount = computed(() => albums.value.reduce((sum, album) => sum + album.photoCount, 0));
const videoCount = computed(() => albums.value.reduce((sum, album) => sum + album.videoCount, 0));

onShow(() => {
  setCustomTabBarSelected(2);
  if (!isLoggedIn() || !isVaultUnlocked()) {
    loading.value = false;
    albums.value = [];
    return;
  }
  void loadAlbums();
});

async function loadAlbums() {
  loading.value = true;
  try {
    const result = await listAlbums();
    const parsed: AlbumViewItem[] = [];
    const recent: RecentMediaItem[] = [];

    for (const album of result.items) {
      const filesResult = await listFiles(album.id);
      const mediaFiles = filesResult.items.filter((file) => isImageFile(file) || isVideoFile(file));
      const photoTotal = mediaFiles.filter(isImageFile).length;
      const videoTotal = mediaFiles.filter(isVideoFile).length;
      const row = {
        id: album.id,
        name: await decodeName(album),
        count: album._count?.files ?? mediaFiles.length,
        photoCount: photoTotal,
        videoCount: videoTotal,
        coverPath: undefined as string | undefined,
      };

      row.coverPath = await loadCoverPath(album, filesResult.items);

      for (const file of mediaFiles) {
        if (recent.length >= 6) break;
        recent.push({
          id: file.id,
          previewPath: isImageFile(file) ? await loadPreviewPath(file) : undefined,
          time: formatRelativeTime(file.createdAt),
          isVideo: isVideoFile(file),
        });
      }
      parsed.push(row);
    }

    albums.value = parsed;
    recentMedia.value = recent;
  } catch (error) {
    uni.showToast({
      title: friendlyErrorMessage(error, '加载失败'),
      icon: 'none',
    });
  } finally {
    loading.value = false;
  }
}

async function decodeName(album: AlbumItem) {
  try {
    return await decryptText(album.encryptedName);
  } catch {
    return '加密相册';
  }
}

async function loadCoverPath(album: AlbumItem, files?: Awaited<ReturnType<typeof listFiles>>['items']) {
  try {
    const items = files ?? (await listFiles(album.id)).items;
    let coverFile = undefined;

    if (album.encryptedCoverFileId) {
      const coverId = await decryptText(album.encryptedCoverFileId);
      coverFile = items.find((file) => file.id === coverId && isImageFile(file));
    }

    if (!coverFile) {
      coverFile = items.find(isImageFile);
    }

    if (!coverFile) {
      return undefined;
    }

    return await loadPreviewPath(coverFile);
  } catch {
    return undefined;
  }
}

async function loadPreviewPath(file: { id: string; encryptedFileKey: string; mimeType?: string }) {
  const buffer = await downloadEncryptedFile(file.id);
  const decrypted = await decryptDownloadedBuffer(buffer, file.encryptedFileKey);
  const ext = extensionFromMime(file.mimeType || 'image/jpeg');
  return await writeDecryptedPreviewFile(decrypted, ext);
}

function formatRelativeTime(value: string) {
  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  if (diff < 5 * 60 * 1000) return '刚刚';
  if (diff < 60 * 60 * 1000) return `${Math.max(1, Math.round(diff / 60000))} 分钟前`;
  if (diff < 24 * 60 * 60 * 1000) return `${Math.max(1, Math.round(diff / 3600000))} 小时前`;
  if (diff < 48 * 60 * 60 * 1000) return '昨天';
  return `${Math.max(2, Math.round(diff / 86400000))} 天前`;
}

async function createAlbumByName(name: string) {
  if (!(await ensureVaultAccess('登录并解锁后即可创建加密相册。'))) return;
  const value = name.trim();
  if (!value) {
    uni.showToast({ title: '请输入相册名称', icon: 'none' });
    return;
  }

  try {
    const encryptedName = await encryptField(value);
    await createAlbum({ encryptedName });
    uni.showToast({ title: '相册已创建', icon: 'success' });
    await loadAlbums();
  } catch (error) {
    uni.showToast({
      title: friendlyErrorMessage(error, '创建失败'),
      icon: 'none',
    });
  }
}

async function promptCreateAlbum() {
  if (!(await ensureVaultAccess('登录并解锁后即可创建加密相册。'))) return;
  uni.showModal({
    title: '新建相册',
    editable: true,
    placeholderText: '例如：家庭旅行',
    success: async (res) => {
      if (!res.confirm) return;
      await createAlbumByName(res.content || '');
    },
  });
}

async function showAddSheet() {
  if (!(await ensureVaultAccess('登录并解锁后即可管理相册。'))) return;
  uni.showActionSheet({
    itemList: ['上传照片/视频', '新建相册'],
    success: async (res) => {
      if (res.tapIndex === 0) {
        await goUpload();
      } else {
        await promptCreateAlbum();
      }
    },
  });
}

async function openAlbum(album: { id: string; name: string }) {
  if (!(await ensureVaultAccess('登录并解锁后即可查看加密相册。'))) return;
  uni.navigateTo({
    url: `/pages/album-detail/album-detail?albumId=${album.id}&name=${encodeURIComponent(album.name)}`,
  });
}

async function goUpload(albumId?: string) {
  if (!(await ensureVaultAccess('登录并解锁后即可上传加密图片或视频。'))) return;
  const query = albumId ? `?albumId=${albumId}` : '';
  uni.navigateTo({ url: `/pages/upload-image/upload-image${query}` });
}

function goSearch() {
  uni.navigateTo({ url: '/pages/search/search' });
}

function goRecycleBin() {
  uni.navigateTo({ url: '/pages/recycle-bin/recycle-bin' });
}

function goExport() {
  uni.navigateTo({ url: '/pages/export/export' });
}

</script>

<template>
  <view class="albums-page tabbar-page">
    <view class="album-header">
      <text class="album-title">相册</text>
      <view class="album-summary">
        <text>已保护</text>
        <text class="summary-number">{{ photoCount }}</text>
        <text>张照片，</text>
        <text class="summary-number">{{ videoCount }}</text>
        <text>个视频</text>
      </view>
    </view>

    <view class="search-row">
      <view class="search-card" @tap="goSearch">
        <image class="search-symbol" src="/static/icons/vault-menu/search.svg" mode="aspectFit" />
        <text class="search-placeholder">搜索相册、照片、地点、人物</text>
        <view class="filter-icon">
          <text />
        </view>
      </view>
      <button class="add-fab" @tap="showAddSheet">
        <view class="plus-mark" />
      </button>
    </view>

    <view class="stats-grid">
      <view class="stat-card rose">
        <view class="stat-icon">
          <image src="/static/icons/album-stats/photo.svg" mode="aspectFit" />
        </view>
        <text class="stat-value">{{ photoCount }}</text>
        <text class="stat-label">照片</text>
      </view>
      <view class="stat-card violet">
        <view class="stat-icon">
          <image src="/static/icons/album-stats/video.svg" mode="aspectFit" />
        </view>
        <text class="stat-value">{{ videoCount }}</text>
        <text class="stat-label">视频</text>
      </view>
      <view class="stat-card blue">
        <view class="stat-icon">
          <image src="/static/icons/album-stats/album.svg" mode="aspectFit" />
        </view>
        <text class="stat-value">{{ albums.length }}</text>
        <text class="stat-label">相册</text>
      </view>
    </view>

    <view class="section-block">
      <view class="section-header">
        <text class="section-title">我的相册</text>
        <text class="section-link" @tap="goSearch">查看全部 ›</text>
      </view>

      <view class="album-list-panel">
        <view v-if="loading" class="empty">加载中...</view>
        <view v-else-if="albums.length === 0" class="empty-state">
          <image src="/static/icons/vault-menu/albums.svg" mode="aspectFit" />
          <text class="empty-title">暂无相册</text>
          <text class="empty-desc">创建相册后，可以加密保存照片和视频。</text>
        </view>
        <view v-else v-for="album in albums" :key="album.id" class="album-row" @tap="openAlbum(album)">
          <image v-if="album.coverPath" :src="album.coverPath" class="album-thumb" mode="aspectFill" />
          <view v-else class="album-thumb placeholder">
            <image src="/static/icons/vault-menu/albums.svg" mode="aspectFit" />
          </view>
          <view class="album-copy">
            <text class="album-name">{{ album.name }}</text>
            <text class="album-meta">{{ album.photoCount }} 张照片{{ album.videoCount ? `，${album.videoCount} 个视频` : '' }}</text>
          </view>
          <text class="row-arrow">›</text>
        </view>
      </view>
    </view>

    <view class="section-block recent-block">
      <view class="section-header">
        <text class="section-title">最近添加</text>
        <text class="section-link" @tap="goSearch">查看全部 ›</text>
      </view>
      <scroll-view scroll-x class="recent-scroll">
        <view class="recent-strip">
          <view v-if="recentMedia.length === 0" class="recent-empty">暂无最近添加</view>
          <view v-for="item in recentMedia" v-else :key="item.id" class="recent-media">
            <image v-if="item.previewPath" :src="item.previewPath" mode="aspectFill" />
            <view v-else class="recent-placeholder">
              <text v-if="item.isVideo">▶</text>
              <image v-else src="/static/icons/vault-menu/albums.svg" mode="aspectFit" />
            </view>
            <text>{{ item.time }}</text>
          </view>
        </view>
      </scroll-view>
    </view>

    <view class="section-block tools-block">
      <view class="section-header">
        <text class="section-title">更多工具</text>
      </view>
      <view class="tools-grid">
        <view class="tool-card" @tap="promptCreateAlbum">
          <view class="tool-icon-wrap blue">
            <image src="/static/icons/album-tools/manage.svg" mode="aspectFit" />
          </view>
          <text class="tool-title">相册管理</text>
        </view>
        <view class="tool-card" @tap="goUpload()">
          <view class="tool-icon-wrap violet">
            <image src="/static/icons/album-tools/private.svg" mode="aspectFit" />
          </view>
          <text class="tool-title">隐私相册</text>
        </view>
        <view class="tool-card" @tap="goExport">
          <view class="tool-icon-wrap orange">
            <image src="/static/icons/album-tools/backup.svg" mode="aspectFit" />
          </view>
          <text class="tool-title">备份与恢复</text>
        </view>
        <view class="tool-card" @tap="goRecycleBin">
          <view class="tool-icon-wrap gray">
            <image src="/static/icons/album-tools/trash.svg" mode="aspectFit" />
          </view>
          <text class="tool-title">回收站</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
@import '@/uni.scss';

.albums-page {
  min-height: 100vh;
  padding: 32rpx 30rpx 160rpx;
  background:
    radial-gradient(circle at 8% 6%, rgba(225, 29, 72, 0.12), transparent 32%),
    radial-gradient(circle at 92% 18%, rgba(30, 77, 255, 0.12), transparent 34%),
    linear-gradient(180deg, #f7faff 0%, #eef6ff 48%, #f8fafc 100%);
  box-sizing: border-box;
}

.hero-card,
.create-card,
.album-panel {
  border: 1rpx solid rgba(226, 232, 240, 0.76);
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 16rpx 38rpx rgba(11, 31, 77, 0.07);
}

.hero-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 224rpx;
  padding: 36rpx;
  border-radius: 38rpx;
}

.eyebrow {
  display: block;
  color: #e11d48;
  font-size: 22rpx;
  font-weight: 700;
}

.page-title {
  display: block;
  margin-top: 10rpx;
  color: #0b1f4d;
  font-size: 44rpx;
  font-weight: 700;
}

.page-subtitle {
  display: block;
  max-width: 470rpx;
  margin-top: 14rpx;
  color: #64748b;
  font-size: 25rpx;
  line-height: 1.55;
}

.hero-icon {
  display: flex;
  width: 104rpx;
  height: 104rpx;
  flex: 0 0 104rpx;
  align-items: center;
  justify-content: center;
  border-radius: 34rpx;
  background: #fff1f4;
}

.hero-icon image {
  width: 78rpx;
  height: 78rpx;
}

.create-card,
.album-panel {
  margin-top: 28rpx;
  padding: 30rpx;
  border-radius: 34rpx;
}

.card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20rpx;
  margin-bottom: 24rpx;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.section-title {
  display: block;
  font-size: 30rpx;
  font-weight: 700;
  color: #0b1f4d;
}

.section-desc {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #64748b;
}

.secure-pill {
  flex-shrink: 0;
  padding: 9rpx 16rpx;
  border-radius: 999rpx;
  background: #ecfdf5;
  color: #16a34a;
  font-size: 22rpx;
  font-weight: 700;
}

.field-label {
  margin-bottom: 12rpx;
  color: #0b1f4d;
  font-size: 26rpx;
  font-weight: 600;
}

.create-row {
  display: flex;
  gap: 14rpx;
  align-items: center;
}

.album-input {
  flex: 1;
  min-width: 0;
  height: 86rpx;
  border-radius: 24rpx;
  background: #f8fbff;
}

.create-btn,
.upload-btn {
  margin: 0;
  border-radius: 22rpx;
  background: linear-gradient(135deg, #377dff, #1e4dff);
  color: #fff;
  font-weight: 700;
}

.create-btn {
  width: 148rpx;
  height: 86rpx;
  padding: 0;
  line-height: 86rpx;
  font-size: 26rpx;
}

.upload-btn {
  width: 132rpx;
  height: 68rpx;
  padding: 0;
  line-height: 68rpx;
  font-size: 24rpx;
}

.create-btn::after,
.upload-btn::after {
  border: none;
}

.album-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20rpx;
  margin-top: 24rpx;
}

.album-card {
  position: relative;
  border-radius: 28rpx;
  overflow: hidden;
  background: #fff;
  border: 1rpx solid #eef2f7;
  box-shadow: 0 10rpx 28rpx rgba(11, 31, 77, 0.06);
}

.cover {
  width: 100%;
  height: 214rpx;
  display: block;
}

.cover.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #fff1f4, #eef5ff);
}

.cover.placeholder image {
  width: 86rpx;
  height: 86rpx;
  opacity: 0.92;
}

.album-meta {
  padding: 16rpx;
}

.album-name {
  display: block;
  font-size: 28rpx;
  font-weight: 700;
  color: #0b1f4d;
}

.card-actions {
  position: absolute;
  top: 12rpx;
  right: 12rpx;
  display: flex;
  gap: 8rpx;
}

.action-link {
  background: rgba(15, 23, 42, 0.55);
  color: #fff;
  font-size: 22rpx;
  padding: 6rpx 14rpx;
  border-radius: 999rpx;
}

.empty,
.empty-state {
  padding: 56rpx 0;
  text-align: center;
  color: #94a3b8;
  font-size: 26rpx;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10rpx;
}

.empty-state image {
  width: 92rpx;
  height: 92rpx;
  opacity: 0.76;
}

.empty-title {
  color: #0b1f4d;
  font-size: 30rpx;
  font-weight: 700;
}

.empty-desc {
  max-width: 440rpx;
  color: #64748b;
  font-size: 24rpx;
  line-height: 1.5;
}

/* Refined compact mobile style */
.albums-page {
  padding: 108rpx 24rpx 132rpx;
  background: #f6f8fb;
}

.hero-card,
.create-card,
.album-panel,
.album-card {
  border-color: #e6ebf2;
  background: #fff;
  box-shadow: 0 8rpx 24rpx rgba(15, 23, 42, 0.04);
}

.hero-card {
  min-height: 148rpx;
  padding: 26rpx;
  border-radius: 24rpx;
  border-color: transparent;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.94), rgba(248, 246, 252, 0.96)),
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

.hero-icon {
  width: 68rpx;
  height: 68rpx;
  flex-basis: 68rpx;
  border-radius: 20rpx;
  background: rgba(255, 255, 255, 0.72);
  box-shadow: none;
}

.hero-icon image {
  width: 46rpx;
  height: 46rpx;
}

.create-card,
.album-panel {
  margin-top: 18rpx;
  padding: 24rpx;
  border-radius: 24rpx;
}

.card-head {
  margin-bottom: 18rpx;
}

.section-title {
  font-size: 28rpx;
  font-weight: 650;
}

.section-desc {
  margin-top: 5rpx;
  font-size: 22rpx;
}

.secure-pill {
  padding: 6rpx 12rpx;
  font-size: 20rpx;
  font-weight: 600;
}

.field-label {
  font-size: 24rpx;
}

.album-input {
  height: 76rpx;
  border-radius: 18rpx;
}

.create-btn {
  width: 124rpx;
  height: 76rpx;
  border-radius: 18rpx;
  line-height: 76rpx;
  font-size: 24rpx;
  font-weight: 650;
}

.upload-btn {
  width: 112rpx;
  height: 60rpx;
  border-radius: 16rpx;
  line-height: 60rpx;
  font-size: 23rpx;
  font-weight: 650;
}

.album-grid {
  gap: 14rpx;
  margin-top: 18rpx;
}

.album-card {
  border-radius: 20rpx;
}

.cover {
  height: 180rpx;
}

.cover.placeholder image {
  width: 58rpx;
  height: 58rpx;
}

.album-meta {
  padding: 14rpx;
}

.album-name {
  font-size: 25rpx;
  font-weight: 600;
}

.action-link {
  padding: 5rpx 11rpx;
  font-size: 20rpx;
}

.empty,
.empty-state {
  padding: 42rpx 0;
  font-size: 24rpx;
}

.empty-state image {
  width: 64rpx;
  height: 64rpx;
}

.empty-title {
  font-size: 28rpx;
  font-weight: 650;
}

.empty-desc {
  font-size: 22rpx;
}

/* Screenshot-inspired album overview */
.albums-page {
  padding: 112rpx 36rpx 160rpx;
  background:
    radial-gradient(circle at 50% -8%, rgba(30, 77, 255, 0.09), transparent 42%),
    linear-gradient(180deg, #f7faff 0%, #f3f7ff 48%, #f8fafc 100%);
}

.album-header {
  padding: 18rpx 6rpx 0;
}

.album-title {
  display: block;
  color: #0b1f4d;
  font-size: 54rpx;
  font-weight: 650;
  line-height: 1.1;
}

.album-summary {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8rpx;
  margin-top: 16rpx;
  color: #65728a;
  font-size: 25rpx;
}

.summary-number {
  color: #1e63ff;
  font-size: 31rpx;
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
    inset 0 0 0 1rpx rgba(226, 232, 240, 0.68),
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

.filter-icon {
  position: relative;
  width: 42rpx;
  height: 42rpx;
}

.filter-icon::before,
.filter-icon::after,
.filter-icon text {
  position: absolute;
  left: 7rpx;
  display: block;
  width: 28rpx;
  height: 4rpx;
  border-radius: 999rpx;
  background: #8a96aa;
  content: '';
}

.filter-icon::before { top: 10rpx; }
.filter-icon text { top: 19rpx; }
.filter-icon::after { top: 28rpx; }

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

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18rpx;
  margin-top: 42rpx;
}

.stat-card {
  display: flex;
  min-height: 164rpx;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  padding: 24rpx 8rpx 20rpx;
  border-radius: 24rpx;
  background: rgba(255, 255, 255, 0.88);
  box-shadow: 0 18rpx 44rpx rgba(28, 55, 100, 0.06);
  box-sizing: border-box;
}

.stat-icon {
  display: flex;
  width: 72rpx;
  height: 72rpx;
  align-items: center;
  justify-content: center;
  margin-bottom: 14rpx;
  border-radius: 18rpx;
}

.stat-card.rose .stat-icon { background: #fff0f5; }
.stat-card.violet .stat-icon { background: #f4edff; }
.stat-card.blue .stat-icon { background: #eaf2ff; }
.stat-card.green .stat-icon { background: #eafaf2; }

.stat-icon image {
  width: 60rpx;
  height: 60rpx;
}

.stat-value {
  color: #102447;
  font-size: 34rpx;
  font-weight: 650;
  line-height: 1;
}

.stat-label {
  margin-top: 12rpx;
  color: #64748b;
  font-size: 23rpx;
}

.section-block {
  margin-top: 42rpx;
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

.album-list-panel {
  overflow: hidden;
  border-radius: 28rpx;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 18rpx 44rpx rgba(28, 55, 100, 0.07);
}

.album-row {
  display: flex;
  min-height: 112rpx;
  align-items: center;
  padding: 18rpx 26rpx;
  border-bottom: 1rpx solid #edf1f7;
  box-sizing: border-box;
}

.album-row:last-child {
  border-bottom: none;
}

.album-thumb {
  width: 78rpx;
  height: 78rpx;
  flex: 0 0 78rpx;
  margin-right: 28rpx;
  border-radius: 12rpx;
  background: #f1f5f9;
}

.album-thumb.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff0f5;
}

.album-thumb.placeholder image {
  width: 48rpx;
  height: 48rpx;
}

.album-copy {
  min-width: 0;
  flex: 1;
}

.album-name {
  color: #102447;
  font-size: 28rpx;
  font-weight: 650;
}

.album-meta {
  display: block;
  margin-top: 12rpx;
  padding: 0;
  color: #64748b;
  font-size: 23rpx;
}

.row-arrow {
  color: #7d899c;
  font-size: 42rpx;
  font-weight: 300;
}

.recent-block {
  margin-top: 44rpx;
}

.recent-scroll {
  width: 100%;
  white-space: nowrap;
}

.recent-strip {
  display: flex;
  gap: 16rpx;
  padding: 0 0 4rpx;
}

.recent-media {
  display: inline-flex;
  width: 116rpx;
  flex: 0 0 116rpx;
  flex-direction: column;
}

.recent-media image,
.recent-placeholder {
  width: 116rpx;
  height: 104rpx;
  border-radius: 12rpx;
  background: #eef2f7;
}

.recent-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
}

.recent-placeholder image {
  width: 54rpx;
  height: 54rpx;
}

.recent-placeholder text {
  color: #9b4df5;
  font-size: 36rpx;
}

.recent-media text {
  margin-top: 14rpx;
  color: #7b879a;
  font-size: 21rpx;
  text-align: center;
}

.recent-empty {
  color: #8a96aa;
  font-size: 24rpx;
}

.tools-block {
  margin-top: 42rpx;
}

.tools-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16rpx;
}

.tool-card {
  display: flex;
  min-height: 128rpx;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding-top: 0;
  border-radius: 22rpx;
  background: rgba(255, 255, 255, 0.84);
  box-shadow: 0 14rpx 34rpx rgba(28, 55, 100, 0.06);
  box-sizing: border-box;
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
.tool-icon-wrap.violet { background: #f4edff; }
.tool-icon-wrap.orange { background: #fff4e5; }
.tool-icon-wrap.gray { background: #f1f5f9; }

.tool-icon-wrap image {
  width: 38rpx;
  height: 38rpx;
}

.tool-title {
  color: #102447;
  font-size: 22rpx;
  font-weight: 600;
  line-height: 1;
}
</style>
