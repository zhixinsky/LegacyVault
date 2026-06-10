<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app';
import { ref } from 'vue';
import { contactVaultSession, downloadContactVaultFile } from '@/utils/api';
import { decryptStoredFile } from '@/utils/crypto-flow';
import { listContactVaultFiles, listContactVaultItems } from '@/utils/services';

const scope = ref('');
const items = ref<Array<{ title: string; summary: string; type: string }>>([]);
const files = ref<
  Array<{ id: string; fileType: string; fileSize: number; mimeType: string; encryptedFileKey: string }>
>([]);
const loading = ref(false);
const downloadingId = ref('');

onShow(loadData);

async function loadData() {
  const sessionId = contactVaultSession.getSessionId();
  if (!sessionId) {
    uni.showToast({ title: '请先完成接管验证', icon: 'none' });
    return;
  }

  loading.value = true;
  try {
    const vaultKey = contactVaultSession.requireVaultKey();
    const { decryptJson } = await import('@vaultpass/crypto');
    const [itemResult, fileResult] = await Promise.all([
      listContactVaultItems(sessionId),
      listContactVaultFiles(sessionId).catch(() => ({ items: [], permissionScope: '' })),
    ]);
    scope.value = itemResult.permissionScope;
    const rows = [];

    for (const item of itemResult.items) {
      try {
        const titleData = await decryptJson<{ title: string }>(item.titleCiphertext, vaultKey);
        const payload = await decryptJson<Record<string, string>>(item.encryptedPayload, vaultKey);
        const summary = Object.values(payload).slice(0, 2).join(' · ');
        rows.push({ title: titleData.title, summary, type: item.type });
      } catch {
        rows.push({ title: '解密失败', summary: '', type: item.type });
      }
    }

    items.value = rows;
    files.value = fileResult.items ?? [];
  } catch (error) {
    uni.showToast({
      title: error instanceof Error ? error.message : '加载失败',
      icon: 'none',
    });
  } finally {
    loading.value = false;
  }
}

async function handleDownload(file: {
  id: string;
  mimeType: string;
  encryptedFileKey: string;
}) {
  const sessionId = contactVaultSession.getSessionId();
  if (!sessionId) return;

  downloadingId.value = file.id;
  try {
    const vaultKey = contactVaultSession.requireVaultKey();
    const buffer = await downloadContactVaultFile(sessionId, file.id);
    const encryptedContent = new TextDecoder().decode(new Uint8Array(buffer));
    const decrypted = await decryptStoredFile(encryptedContent, file.encryptedFileKey, vaultKey);
    const fs = uni.getFileSystemManager();
    const filePath = `${(wx as { env?: { USER_DATA_PATH?: string } }).env?.USER_DATA_PATH ?? ''}/vaultpass-${file.id}`;
    fs.writeFile({
      filePath,
      data: decrypted.buffer,
      success: () => {
        uni.openDocument({ filePath, showMenu: true });
      },
      fail: () => {
        uni.showToast({ title: '文件已解密，保存失败', icon: 'none' });
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

function handleExit() {
  contactVaultSession.clear();
  uni.navigateBack();
}
</script>

<template>
  <view class="container">
    <view class="card">
      <text class="title">联系人保险箱</text>
      <text class="subtitle">权限：{{ scope || '加载中' }}</text>
      <view v-if="loading" class="hint">加载中...</view>
      <view v-else>
        <view v-for="(item, index) in items" :key="index" class="list-item">
          <text class="item-title">{{ item.title }} ({{ item.type }})</text>
          <text class="hint">{{ item.summary }}</text>
        </view>
        <text v-if="items.length === 0" class="hint">暂无可见内容</text>

        <view v-if="files.length" class="file-section">
          <text class="section-title">加密文件</text>
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
      <button class="btn btn-secondary" @tap="handleExit">退出</button>
    </view>
  </view>
</template>

<style scoped lang="scss">
@import '@/uni.scss';

.item-title {
  display: block;
  font-weight: 600;
  margin-bottom: 8rpx;
}

.section-title {
  display: block;
  margin-top: 24rpx;
  font-size: 30rpx;
  font-weight: 600;
}

.file-section {
  margin-top: 16rpx;
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
