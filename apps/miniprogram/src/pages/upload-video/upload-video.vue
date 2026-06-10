<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app';
import { ref } from 'vue';
import { prepareEncryptedUpload } from '@/utils/crypto-flow';
import { uploadEncryptedFile } from '@/utils/services';

const albumId = ref('');
const loading = ref(false);

onLoad((query) => {
  albumId.value = typeof query?.albumId === 'string' ? query.albumId : '';
});

async function chooseAndUpload() {
  uni.chooseVideo({
    sourceType: ['album', 'camera'],
    compressed: false,
    success: async (chooseResult) => {
      const filePath = chooseResult.tempFilePath;
      if (!filePath) return;

      loading.value = true;
      try {
        const prepared = await prepareEncryptedUpload(
          filePath,
          'video',
          albumId.value || undefined,
          'video/mp4',
        );
        await uploadEncryptedFile({
          filePath: prepared.tempPath,
          formData: prepared.formData,
        });
        uni.showToast({ title: '视频已加密上传', icon: 'success' });
        setTimeout(() => uni.navigateBack(), 500);
      } catch (error) {
        uni.showToast({
          title: error instanceof Error ? error.message : '上传失败',
          icon: 'none',
        });
      } finally {
        loading.value = false;
      }
    },
  });
}
</script>

<template>
  <view class="container">
    <view class="card">
      <text class="title">上传加密视频</text>
      <text class="subtitle">视频将在本地加密后再上传，服务器无法查看原片</text>
      <text v-if="albumId" class="hint">目标相册 ID：{{ albumId }}</text>

      <button class="btn btn-primary" :loading="loading" @tap="chooseAndUpload">
        选择视频并加密上传
      </button>
    </view>
  </view>
</template>

<style scoped lang="scss">
@import '@/uni.scss';
</style>
