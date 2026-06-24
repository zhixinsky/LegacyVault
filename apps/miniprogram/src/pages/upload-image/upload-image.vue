<script setup lang="ts">
import { friendlyErrorMessage } from '@/utils/errors';
import { onLoad } from '@dcloudio/uni-app';
import { ref } from 'vue';
import { prepareEncryptedUpload } from '@/utils/crypto-flow';
import { uploadEncryptedFile } from '@/utils/services';

const albumId = ref('');
const loading = ref(false);
const uploadedCount = ref(0);

onLoad((query) => {
  albumId.value = typeof query?.albumId === 'string' ? query.albumId : '';
});

async function chooseAndUpload() {
  if (loading.value) return;
  const chooseMedia = (uni as unknown as {
    chooseMedia?: (options: {
      count: number;
      mediaType: Array<'image' | 'video'>;
      sourceType: Array<'album' | 'camera'>;
      sizeType?: string[];
      success: (result: { tempFiles?: Array<{ tempFilePath: string; fileType?: 'image' | 'video' }> }) => void;
      fail?: (error: { errMsg?: string }) => void;
    }) => void;
  }).chooseMedia;

  if (chooseMedia) {
    chooseMedia({
      count: 9,
      mediaType: ['image', 'video'],
      sourceType: ['album', 'camera'],
      sizeType: ['original'],
      success: (result) => {
        void uploadSelectedMedia(
          (result.tempFiles ?? [])
            .map((file) => ({ path: file.tempFilePath, type: file.fileType ?? guessMediaType(file.tempFilePath) }))
            .filter((file) => file.path),
        );
      },
      fail: (error) => {
        if (!error.errMsg?.includes('cancel')) {
          uni.showToast({ title: friendlyErrorMessage(error.errMsg, '选择文件失败'), icon: 'none' });
        }
      },
    });
    return;
  }

  uni.chooseImage({
    count: 9,
    sizeType: ['original'],
    sourceType: ['album', 'camera'],
    success: (chooseResult) => {
      const paths = Array.isArray(chooseResult.tempFilePaths)
        ? chooseResult.tempFilePaths
        : [chooseResult.tempFilePaths].filter(Boolean);
      void uploadSelectedMedia(paths.map((path) => ({ path, type: 'image' })));
    },
  });
}

function guessMediaType(filePath: string): 'image' | 'video' {
  return /\.(mp4|mov|m4v|webm)$/i.test(filePath) ? 'video' : 'image';
}

async function uploadSelectedMedia(files: Array<{ path: string; type: 'image' | 'video' }>) {
  if (files.length === 0) return;

  loading.value = true;
  uploadedCount.value = 0;
  try {
    for (const file of files) {
      const prepared = await prepareEncryptedUpload(
        file.path,
        file.type,
        albumId.value || undefined,
        file.type === 'video' ? 'video/mp4' : undefined,
      );
      await uploadEncryptedFile({
        filePath: prepared.tempPath,
        formData: prepared.formData,
      });
      uploadedCount.value += 1;
    }
    uni.showToast({ title: `已加密上传 ${uploadedCount.value} 个文件`, icon: 'success' });
    setTimeout(() => uni.navigateBack(), 650);
  } catch (error) {
    uni.showToast({
      title: friendlyErrorMessage(error, '上传失败'),
      icon: 'none',
    });
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <view class="container">
    <view class="card">
      <text class="title">上传加密照片/视频</text>
      <text class="subtitle">照片和视频将在本地加密后再上传，服务器无法查看原文件</text>
      <text v-if="albumId" class="hint">目标相册 ID：{{ albumId }}</text>
      <text v-if="loading" class="hint">正在上传 {{ uploadedCount }} 个文件...</text>

      <button class="btn btn-primary" :loading="loading" @tap="chooseAndUpload">
        选择照片或视频
      </button>
    </view>
  </view>
</template>

<style scoped lang="scss">
@import '@/uni.scss';
</style>
