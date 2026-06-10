<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app';
import { ref } from 'vue';
import { decryptVaultTitle } from '@/utils/crypto-flow';
import {
  getProfile,
  listTrashVaultItems,
  permanentDeleteVaultItem,
  restoreVaultItem,
  type VaultItem,
} from '@/utils/services';

const items = ref<Array<{ id: string; title: string; type: string }>>([]);
const mfaEnabled = ref(false);
const mfaCode = ref('');
const loading = ref(false);

onShow(async () => {
  try {
    const profile = await getProfile();
    mfaEnabled.value = profile.mfaEnabled;
  } catch {
    // ignore
  }
  await loadItems();
});

async function loadItems() {
  loading.value = true;
  try {
    const result = await listTrashVaultItems();
    const rows = [];
    for (const item of result.items) {
      try {
        rows.push({ id: item.id, title: await decryptVaultTitle(item.titleCiphertext), type: item.type });
      } catch {
        rows.push({ id: item.id, title: '解密失败', type: item.type });
      }
    }
    items.value = rows;
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '加载失败', icon: 'none' });
  } finally {
    loading.value = false;
  }
}

async function handleRestore(id: string) {
  await restoreVaultItem(id);
  await loadItems();
  uni.showToast({ title: '已恢复', icon: 'success' });
}

async function handlePurge(id: string) {
  if (mfaEnabled.value && !mfaCode.value) {
    uni.showToast({ title: '请输入验证码', icon: 'none' });
    return;
  }
  uni.showModal({
    title: '永久删除',
    content: '删除后无法恢复',
    success: async (res) => {
      if (!res.confirm) return;
      try {
        await permanentDeleteVaultItem(id, mfaCode.value || undefined);
        await loadItems();
      } catch (error) {
        uni.showToast({ title: error instanceof Error ? error.message : '删除失败', icon: 'none' });
      }
    },
  });
}
</script>

<template>
  <view class="container">
    <view class="card">
      <text class="title">回收站</text>
      <input v-if="mfaEnabled" v-model="mfaCode" class="input" placeholder="永久删除时输入验证码" />
      <view v-if="loading" class="hint">加载中...</view>
      <view v-else-if="items.length === 0" class="hint">回收站为空</view>
      <view v-else>
        <view v-for="item in items" :key="item.id" class="list-item">
          <text class="item-title">{{ item.title }} ({{ item.type }})</text>
          <view class="actions">
            <button class="btn btn-secondary btn-small" @tap="handleRestore(item.id)">恢复</button>
            <button class="btn btn-secondary btn-small" @tap="handlePurge(item.id)">永久删除</button>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
@import '@/uni.scss';

.item-title { display: block; font-weight: 600; margin-bottom: 8rpx; }
.actions { display: flex; gap: 16rpx; margin-top: 12rpx; }
.btn-small { margin: 0; font-size: 24rpx; line-height: 56rpx; height: 56rpx; padding: 0 24rpx; }
.input { border: 1rpx solid #cbd5e1; border-radius: 12rpx; padding: 16rpx; margin-bottom: 16rpx; }
</style>
