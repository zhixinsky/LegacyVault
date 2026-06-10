<script setup lang="ts">

import { onShow } from '@dcloudio/uni-app';

import { ref } from 'vue';

import { downloadEncryptedFile } from '@/utils/api';

import { decryptStoredFile, prepareEncryptedUpload } from '@/utils/crypto-flow';

import { getProfile, listFiles, uploadEncryptedFile, type VaultFileItem } from '@/utils/services';



const files = ref<VaultFileItem[]>([]);

const loading = ref(false);

const uploading = ref(false);

const downloadingId = ref('');

const mfaEnabled = ref(false);

const mfaCode = ref('');
const uploadTags = ref('');
const uploadDisplayName = ref('');



onShow(async () => {

  try {

    const profile = await getProfile();

    mfaEnabled.value = profile.mfaEnabled;

  } catch {

    // ignore

  }

  await loadFiles();

});



async function loadFiles() {

  loading.value = true;

  try {

    const result = await listFiles();

    files.value = result.items;

  } catch (error) {

    uni.showToast({

      title: error instanceof Error ? error.message : '加载失败',

      icon: 'none',

    });

  } finally {

    loading.value = false;

  }

}



async function chooseAndUpload() {

  uni.chooseMessageFile({

    count: 1,

    type: 'file',

    success: async (chooseResult) => {

      const file = chooseResult.tempFiles[0];

      if (!file?.path) return;



      uploading.value = true;

      try {

        const prepared = await prepareEncryptedUpload(file.path, 'document', undefined, file.type, {
          displayName: uploadDisplayName.value.trim() || file.name,
          tags: uploadTags.value.trim() || undefined,
        });

        await uploadEncryptedFile({

          filePath: prepared.tempPath,

          formData: {

            ...prepared.formData,

            mimeType: file.type || 'application/octet-stream',

          },

        });

        uni.showToast({ title: '文件已加密上传', icon: 'success' });

        await loadFiles();

      } catch (error) {

        uni.showToast({

          title: error instanceof Error ? error.message : '上传失败',

          icon: 'none',

        });

      } finally {

        uploading.value = false;

      }

    },

    fail: () => {

      uni.showToast({ title: '未选择文件', icon: 'none' });

    },

  });

}



async function handleDownload(file: VaultFileItem) {

  if (mfaEnabled.value && !mfaCode.value) {

    uni.showToast({ title: '请先输入验证码', icon: 'none' });

    return;

  }



  downloadingId.value = file.id;

  try {

    const { vaultSession } = await import('@/utils/api');

    const vaultKey = vaultSession.requireVaultKey();

    const buffer = await downloadEncryptedFile(file.id, mfaCode.value || undefined);

    const encryptedContent = new TextDecoder().decode(new Uint8Array(buffer));

    const decrypted = await decryptStoredFile(encryptedContent, file.encryptedFileKey, vaultKey);

    const fs = uni.getFileSystemManager();

    const userPath = `${(wx as { env?: { USER_DATA_PATH?: string } }).env?.USER_DATA_PATH ?? ''}/vaultpass-${file.id}`;

    fs.writeFile({

      filePath: userPath,

      data: decrypted.buffer,

      success: () => {

        uni.openDocument({ filePath: userPath, showMenu: true });

      },

      fail: () => {

        uni.showToast({ title: '保存失败', icon: 'none' });

      },

    });

  } catch (error) {

    uni.showToast({

      title: error instanceof Error ? error.message : '下载失败',

      icon: 'none',

    });

  } finally {

    downloadingId.value = '';

  }

}

</script>



<template>

  <view class="container">

    <view class="card">

      <text class="title">加密文件</text>

      <text class="subtitle">本地加密上传；下载需二次验证（如已启用 MFA）</text>



      <input

        v-if="mfaEnabled"

        v-model="mfaCode"

        class="input"

        placeholder="下载前输入验证码"

      />

      <input v-model="uploadDisplayName" class="input" placeholder="显示名称（可选）" />
      <input v-model="uploadTags" class="input" placeholder="标签，逗号分隔（可选）" />

      <button class="btn btn-primary" :loading="uploading" @tap="chooseAndUpload">

        选择文件并加密上传

      </button>

    </view>



    <view class="card">

      <text class="section-title">我的文件</text>

      <view v-if="loading" class="hint">加载中...</view>

      <view v-else-if="files.length === 0" class="hint">暂无文件</view>

      <view v-else>

        <view v-for="file in files" :key="file.id" class="list-item file-row">

          <text class="hint">{{ file.fileType }} · {{ file.fileSize }} bytes</text>

          <button

            class="btn btn-secondary btn-small"

            :disabled="downloadingId === file.id"

            @tap="handleDownload(file)"

          >

            {{ downloadingId === file.id ? '解密中' : '下载' }}

          </button>

        </view>

      </view>

    </view>

  </view>

</template>



<style scoped lang="scss">

@import '@/uni.scss';



.section-title {

  display: block;

  font-size: 30rpx;

  font-weight: 600;

  margin-bottom: 16rpx;

}



.input {

  border: 1rpx solid #cbd5e1;

  border-radius: 12rpx;

  padding: 16rpx 24rpx;

  font-size: 28rpx;

  margin-bottom: 16rpx;

}



.file-row {

  display: flex;

  align-items: center;

  justify-content: space-between;

}



.btn-small {

  margin: 0;

  padding: 0 24rpx;

  font-size: 24rpx;

  line-height: 56rpx;

  height: 56rpx;

}

</style>

