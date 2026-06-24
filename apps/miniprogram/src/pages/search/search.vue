<script setup lang="ts">
import { friendlyErrorMessage } from '@/utils/errors';
import { ref } from 'vue';
import { searchVaultItems, type VaultSearchResult } from '@/utils/vault-search';
import { ensureVaultAccess } from '@/utils/access';

const query = ref('');
const results = ref<VaultSearchResult[]>([]);
const loading = ref(false);

async function handleSearch() {
  if (!(await ensureVaultAccess('登录并解锁后即可搜索保险箱内容。'))) return;
  const trimmed = query.value.trim();
  if (!trimmed) {
    results.value = [];
    return;
  }

  loading.value = true;
  try {
    results.value = await searchVaultItems(trimmed);
  } catch (error) {
    uni.showToast({
      title: friendlyErrorMessage(error, '搜索失败'),
      icon: 'none',
    });
  } finally {
    loading.value = false;
  }
}

async function openResult(item: VaultSearchResult) {
  if (!(await ensureVaultAccess('登录并解锁后即可查看搜索结果。'))) return;
  uni.navigateTo({ url: item.route });
}
</script>

<template>
  <view class="container">
    <view class="card">
      <text class="title">保险箱搜索</text>
      <text class="subtitle">在本地解密后匹配，服务器无法获知搜索内容</text>

      <input v-model="query" class="input" placeholder="搜索账号、笔记、证件..." />
      <button class="btn btn-primary" :loading="loading" @tap="handleSearch">搜索</button>
    </view>

    <view class="card">
      <view v-if="loading" class="empty">搜索中...</view>
      <view v-else-if="!query.trim()" class="empty">输入关键词开始搜索</view>
      <view v-else-if="results.length === 0" class="empty">未找到匹配条目</view>
      <view v-else>
        <view
          v-for="item in results"
          :key="`${item.type}-${item.id}`"
          class="list-item column"
          @tap="openResult(item)"
        >
          <text class="item-title">{{ item.title }}</text>
          <text class="hint">
            {{ item.category }}
            <text v-if="item.subtitle"> · {{ item.subtitle }}</text>
          </text>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
@import '@/uni.scss';

.column {
  flex-direction: column;
  align-items: flex-start;
  gap: 8rpx;
}

.item-title {
  font-weight: 600;
}
</style>
