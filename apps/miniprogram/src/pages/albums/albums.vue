<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app';
import { ref } from 'vue';
import { extensionFromMime, isImageFile } from '@vaultpass/types';
import { decryptText, downloadEncryptedFile } from '@/utils/api';
import {
  decryptDownloadedBuffer,
  encryptField,
  writeDecryptedPreviewFile,
} from '@/utils/crypto-flow';
import { createAlbum, listAlbums, listFiles, updateAlbum, type AlbumItem } from '@/utils/services';

const albums = ref<Array<{ id: string; name: string; count: number; coverPath?: string }>>([]);
const newAlbumName = ref('');
const loading = ref(false);

onShow(loadAlbums);

async function loadAlbums() {
  loading.value = true;
  try {
    const result = await listAlbums();
    const parsed: Array<{ id: string; name: string; count: number; coverPath?: string }> = [];

    for (const album of result.items) {
      const row = {
        id: album.id,
        name: await decodeName(album),
        count: album._count?.files ?? 0,
        coverPath: undefined as string | undefined,
      };
      if (row.count > 0) {
        row.coverPath = await loadCoverPath(album);
      }
      parsed.push(row);
    }

    albums.value = parsed;
  } catch (error) {
    uni.showToast({
      title: error instanceof Error ? error.message : '加载失败',
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

async function loadCoverPath(album: AlbumItem) {
  try {
    const filesResult = await listFiles(album.id);
    let coverFile = undefined;

    if (album.encryptedCoverFileId) {
      const coverId = await decryptText(album.encryptedCoverFileId);
      coverFile = filesResult.items.find((file) => file.id === coverId && isImageFile(file));
    }

    if (!coverFile) {
      coverFile = filesResult.items.find(isImageFile);
    }

    if (!coverFile) {
      return undefined;
    }

    const buffer = await downloadEncryptedFile(coverFile.id);
    const decrypted = await decryptDownloadedBuffer(buffer, coverFile.encryptedFileKey);
    const ext = extensionFromMime(coverFile.mimeType || 'image/jpeg');
    return await writeDecryptedPreviewFile(decrypted, ext);
  } catch {
    return undefined;
  }
}

async function handleCreateAlbum() {
  if (!newAlbumName.value.trim()) {
    uni.showToast({ title: '请输入相册名称', icon: 'none' });
    return;
  }

  try {
    const encryptedName = await encryptField(newAlbumName.value.trim());
    await createAlbum({ encryptedName });
    newAlbumName.value = '';
    uni.showToast({ title: '相册已创建', icon: 'success' });
    loadAlbums();
  } catch (error) {
    uni.showToast({
      title: error instanceof Error ? error.message : '创建失败',
      icon: 'none',
    });
  }
}

function openAlbum(album: { id: string; name: string }) {
  uni.navigateTo({
    url: `/pages/album-detail/album-detail?albumId=${album.id}&name=${encodeURIComponent(album.name)}`,
  });
}

function goUpload(albumId?: string) {
  const query = albumId ? `?albumId=${albumId}` : '';
  uni.navigateTo({ url: `/pages/upload-image/upload-image${query}` });
}

function renameAlbum(album: { id: string; name: string }) {
  uni.showModal({
    title: '重命名相册',
    editable: true,
    placeholderText: album.name,
    content: album.name,
    success: async (res) => {
      if (!res.confirm) return;
      const nextName = (res.content || album.name).trim();
      if (!nextName) return;
      try {
        await updateAlbum(album.id, {
          encryptedName: await encryptField(nextName),
        });
        uni.showToast({ title: '已重命名', icon: 'success' });
        await loadAlbums();
      } catch (error) {
        uni.showToast({
          title: error instanceof Error ? error.message : '重命名失败',
          icon: 'none',
        });
      }
    },
  });
}
</script>

<template>
  <view class="container tabbar-page">
    <view class="card">
      <text class="title">私密相册</text>
      <text class="subtitle">相册名称与图片均在本地加密</text>

      <text class="field-label">新建相册</text>
      <input v-model="newAlbumName" class="input" placeholder="相册名称" />
      <button class="btn btn-primary" @tap="handleCreateAlbum">创建相册</button>
    </view>

    <view class="card">
      <view class="section-header">
        <text class="section-title">我的相册</text>
        <text class="link" @tap="goUpload()">上传图片</text>
      </view>

      <view v-if="loading" class="empty">加载中...</view>
      <view v-else-if="albums.length === 0" class="empty">暂无相册</view>
      <view v-else class="album-grid">
        <view v-for="album in albums" :key="album.id" class="album-card" @tap="openAlbum(album)">
          <image
            v-if="album.coverPath"
            :src="album.coverPath"
            class="cover"
            mode="aspectFill"
          />
          <view v-else class="cover placeholder">
            <text>相册</text>
          </view>
          <view class="album-meta">
            <text class="album-name">{{ album.name }}</text>
            <text class="hint">{{ album.count }} 个文件</text>
          </view>
          <view class="card-actions" @tap.stop>
            <text class="action-link" @tap="renameAlbum(album)">重命名</text>
            <text class="action-link" @tap="goUpload(album.id)">上传</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
@import '@/uni.scss';

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.section-title {
  font-size: 30rpx;
  font-weight: 600;
}

.link {
  color: #2563eb;
  font-size: 24rpx;
}

.album-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20rpx;
  margin-top: 24rpx;
}

.album-card {
  position: relative;
  border-radius: 16rpx;
  overflow: hidden;
  background: #f8fafc;
}

.cover {
  width: 100%;
  height: 200rpx;
  display: block;
}

.cover.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #e2e8f0, #cbd5e1);
  color: #64748b;
  font-size: 28rpx;
}

.album-meta {
  padding: 16rpx;
}

.album-name {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
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
</style>
