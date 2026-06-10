<script setup lang="ts">
import { onLoad, onShow, onUnload } from '@dcloudio/uni-app';
import { getCurrentInstance, nextTick, ref, watch } from 'vue';
import { extensionFromMime, isImageFile, isVideoFile } from '@vaultpass/types';
import { downloadEncryptedFile } from '@/utils/api';
import {
  decryptDownloadedBuffer,
  encryptField,
  writeDecryptedPreviewFile,
} from '@/utils/crypto-flow';
import {
  deleteFile,
  getProfile,
  listFiles,
  updateAlbum,
  type VaultFileItem,
} from '@/utils/services';

const albumId = ref('');
const albumName = ref('相册');
const files = ref<VaultFileItem[]>([]);
const loading = ref(false);
const previewingId = ref('');
const mfaEnabled = ref(false);
const mfaCode = ref('');
const videoPreviewPath = ref('');
const thumbPaths = ref<Record<string, string>>({});
const loadingThumbIds = new Set<string>();
const thumbObservers: UniApp.IntersectionObserver[] = [];
const selectMode = ref(false);
const selectedIds = ref<string[]>([]);
const settingCoverId = ref('');

onLoad((query) => {
  albumId.value = typeof query?.albumId === 'string' ? query.albumId : '';
  albumName.value = typeof query?.name === 'string' ? decodeURIComponent(query.name) : '相册';
  uni.setNavigationBarTitle({ title: albumName.value });
});

onShow(async () => {
  if (!albumId.value) return;
  try {
    const profile = await getProfile();
    mfaEnabled.value = profile.mfaEnabled;
  } catch {
    // ignore
  }
  await loadFiles();
});

onUnload(() => {
  disconnectThumbObservers();
});

watch(mfaCode, () => {
  if (!mfaEnabled.value || mfaCode.value.trim()) {
    setupThumbObservers();
  }
});

async function loadFiles() {
  loading.value = true;
  disconnectThumbObservers();
  thumbPaths.value = {};
  try {
    const result = await listFiles(albumId.value);
    files.value = result.items;
    setupThumbObservers();
  } catch (error) {
    uni.showToast({
      title: error instanceof Error ? error.message : '加载失败',
      icon: 'none',
    });
  } finally {
    loading.value = false;
  }
}

function disconnectThumbObservers() {
  thumbObservers.forEach((observer) => observer.disconnect());
  thumbObservers.length = 0;
}

function canLoadThumbnails() {
  return !mfaEnabled.value || Boolean(mfaCode.value.trim());
}

async function loadThumbnail(file: VaultFileItem) {
  if (!isImageFile(file) || thumbPaths.value[file.id] || loadingThumbIds.has(file.id)) {
    return;
  }
  if (!canLoadThumbnails()) {
    return;
  }

  loadingThumbIds.add(file.id);
  try {
    const buffer = await downloadEncryptedFile(file.id, mfaCode.value.trim() || undefined);
    const decrypted = await decryptDownloadedBuffer(buffer, file.encryptedFileKey);
    const ext = extensionFromMime(file.mimeType || 'image/jpeg');
    thumbPaths.value[file.id] = await writeDecryptedPreviewFile(decrypted, ext);
  } catch {
    // ignore single thumbnail failures
  } finally {
    loadingThumbIds.delete(file.id);
  }
}

function setupThumbObservers() {
  disconnectThumbObservers();
  if (!canLoadThumbnails()) {
    return;
  }

  const instance = getCurrentInstance();
  if (!instance) {
    return;
  }

  nextTick(() => {
    files.value.filter(isImageFile).forEach((file) => {
      const observer = uni.createIntersectionObserver(instance);
      observer.relativeToViewport({ bottom: 80 }).observe(`#thumb-${file.id}`, (res) => {
        if (res.intersectionRatio > 0) {
          void loadThumbnail(file);
          observer.disconnect();
        }
      });
      thumbObservers.push(observer);
    });
  });
}

function goUpload(kind: 'image' | 'video') {
  const page = kind === 'image' ? 'upload-image' : 'upload-video';
  uni.navigateTo({ url: `/pages/${page}/${page}?albumId=${albumId.value}` });
}

async function handlePreview(file: VaultFileItem) {
  if (!isImageFile(file) && !isVideoFile(file)) return;
  if (mfaEnabled.value && !mfaCode.value.trim()) {
    uni.showToast({ title: '请先输入二次验证码', icon: 'none' });
    return;
  }

  previewingId.value = file.id;
  try {
    const buffer = await downloadEncryptedFile(file.id, mfaCode.value.trim() || undefined);
    const decrypted = await decryptDownloadedBuffer(buffer, file.encryptedFileKey);
    const ext = extensionFromMime(file.mimeType || 'application/octet-stream');
    const tempPath = await writeDecryptedPreviewFile(decrypted, ext);

    if (isImageFile(file)) {
      uni.previewImage({ urls: [tempPath], current: tempPath });
      return;
    }

    videoPreviewPath.value = tempPath;
  } catch (error) {
    uni.showToast({
      title: error instanceof Error ? error.message : '预览失败',
      icon: 'none',
    });
  } finally {
    previewingId.value = '';
  }
}

function closeVideoPreview() {
  videoPreviewPath.value = '';
}

function toggleSelectMode() {
  selectMode.value = !selectMode.value;
  if (!selectMode.value) {
    selectedIds.value = [];
  }
}

function toggleSelected(id: string) {
  if (selectedIds.value.includes(id)) {
    selectedIds.value = selectedIds.value.filter((item) => item !== id);
    return;
  }
  selectedIds.value = [...selectedIds.value, id];
}

function handleBatchDelete() {
  if (selectedIds.value.length === 0) return;
  uni.showModal({
    title: '批量删除',
    content: `确定删除选中的 ${selectedIds.value.length} 个文件？`,
    success: async (res) => {
      if (!res.confirm) return;
      try {
        await Promise.all(selectedIds.value.map((id) => deleteFile(id)));
        selectedIds.value = [];
        selectMode.value = false;
        await loadFiles();
        uni.showToast({ title: '已删除', icon: 'success' });
      } catch (error) {
        uni.showToast({
          title: error instanceof Error ? error.message : '删除失败',
          icon: 'none',
        });
      }
    },
  });
}

async function handleSetCover(file: VaultFileItem) {
  if (!albumId.value || !isImageFile(file)) return;

  settingCoverId.value = file.id;
  try {
    await updateAlbum(albumId.value, {
      encryptedCoverFileId: await encryptField(file.id),
    });
    uni.showToast({ title: '封面已更新', icon: 'success' });
  } catch (error) {
    uni.showToast({
      title: error instanceof Error ? error.message : '设置失败',
      icon: 'none',
    });
  } finally {
    settingCoverId.value = '';
  }
}

function handleDelete(id: string) {
  uni.showModal({
    title: '确认删除',
    content: '确定删除该文件？',
    success: async (res) => {
      if (!res.confirm) return;
      try {
        await deleteFile(id);
        await loadFiles();
        uni.showToast({ title: '已删除', icon: 'success' });
      } catch (error) {
        uni.showToast({
          title: error instanceof Error ? error.message : '删除失败',
          icon: 'none',
        });
      }
    },
  });
}

function formatSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function fileLabel(file: VaultFileItem) {
  if (isImageFile(file)) return '图片';
  if (isVideoFile(file)) return '视频';
  return file.fileType;
}
</script>

<template>
  <view class="container">
    <view class="card">
      <view class="section-header">
        <text class="section-title">{{ albumName }}</text>
        <view class="links">
          <text class="link" @tap="goUpload('image')">上传图片</text>
          <text class="link" @tap="goUpload('video')">上传视频</text>
          <text class="link" @tap="toggleSelectMode">{{ selectMode ? '取消多选' : '批量选择' }}</text>
          <text
            v-if="selectMode && selectedIds.length > 0"
            class="link danger"
            @tap="handleBatchDelete"
          >
            删除 {{ selectedIds.length }} 项
          </text>
        </view>
      </view>

      <input
        v-if="mfaEnabled"
        v-model="mfaCode"
        class="input"
        placeholder="预览/缩略图前输入二次验证码"
      />

      <view v-if="loading" class="empty">加载中...</view>
      <view v-else-if="files.length === 0" class="empty">暂无图片或视频</view>
      <view v-else class="media-grid">
        <view
          v-for="file in files"
          :id="`thumb-${file.id}`"
          :key="file.id"
          class="media-tile"
          :class="{ selected: selectMode && selectedIds.includes(file.id) }"
          @tap="selectMode ? toggleSelected(file.id) : handlePreview(file)"
        >
          <view v-if="selectMode" class="select-badge">
            <text>{{ selectedIds.includes(file.id) ? '✓' : '' }}</text>
          </view>
          <image
            v-if="isImageFile(file) && thumbPaths[file.id]"
            :src="thumbPaths[file.id]"
            class="thumb"
            mode="aspectFill"
          />
          <view v-else-if="isImageFile(file)" class="thumb-placeholder">
            <text>{{ previewingId === file.id ? '…' : '图' }}</text>
          </view>
          <view v-else-if="isVideoFile(file)" class="thumb-placeholder video">
            <text>▶</text>
          </view>
          <view class="tile-meta">
            <text class="tile-label">{{ fileLabel(file) }}</text>
            <text class="tile-size">{{ formatSize(file.fileSize) }}</text>
          </view>
          <view class="tile-actions" @tap.stop>
            <text
              v-if="isImageFile(file)"
              class="tile-action"
              @tap="handleSetCover(file)"
            >
              {{ settingCoverId === file.id ? '…' : '封面' }}
            </text>
            <text class="tile-action danger" @tap="handleDelete(file.id)">删除</text>
          </view>
        </view>
      </view>
    </view>

    <view v-if="videoPreviewPath" class="modal-mask" @tap="closeVideoPreview">
      <view class="modal-card video-card" @tap.stop>
        <video :src="videoPreviewPath" class="video-player" controls autoplay />
        <button class="btn btn-secondary" @tap="closeVideoPreview">关闭</button>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
@import '@/uni.scss';

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16rpx;
}

.section-title {
  font-size: 30rpx;
  font-weight: 600;
}

.links {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8rpx;
}

.link {
  color: #2563eb;
  font-size: 24rpx;
}

.empty {
  margin-top: 24rpx;
  color: #64748b;
  font-size: 26rpx;
}

.media-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20rpx;
  margin-top: 24rpx;
}

.media-tile {
  position: relative;
  border-radius: 16rpx;
  overflow: hidden;
  background: #f1f5f9;
  min-height: 220rpx;
}

.thumb {
  width: 100%;
  height: 220rpx;
  display: block;
}

.thumb-placeholder {
  width: 100%;
  height: 220rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #e2e8f0, #cbd5e1);
  color: #475569;
  font-size: 40rpx;
  font-weight: 600;
}

.thumb-placeholder.video {
  background: linear-gradient(135deg, #1e293b, #334155);
  color: #f8fafc;
}

.tile-meta {
  padding: 12rpx 16rpx 8rpx;
}

.tile-label {
  display: block;
  font-size: 24rpx;
  font-weight: 600;
  color: #334155;
}

.tile-size {
  display: block;
  font-size: 22rpx;
  color: #64748b;
  margin-top: 4rpx;
}

.media-tile.selected {
  outline: 4rpx solid #2563eb;
}

.select-badge {
  position: absolute;
  top: 12rpx;
  left: 12rpx;
  width: 40rpx;
  height: 40rpx;
  border-radius: 999rpx;
  background: rgba(37, 99, 235, 0.9);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24rpx;
}

.tile-actions {
  position: absolute;
  top: 12rpx;
  right: 12rpx;
  display: flex;
  gap: 8rpx;
}

.tile-action {
  background: rgba(15, 23, 42, 0.55);
  color: #fff;
  font-size: 22rpx;
  padding: 6rpx 14rpx;
  border-radius: 999rpx;
}

.tile-action.danger {
  color: #fecaca;
}

.link.danger {
  color: #dc2626;
}

.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32rpx;
}

.video-card {
  width: 100%;
}

.video-player {
  width: 100%;
  height: 420rpx;
}

.btn-secondary {
  margin-top: 16rpx;
  background: #fff;
  color: #334155;
  border: 1rpx solid #cbd5e1;
}
</style>
