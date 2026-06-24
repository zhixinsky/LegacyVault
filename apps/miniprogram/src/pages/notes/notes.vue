<script setup lang="ts">
import { friendlyErrorMessage } from '@/utils/errors';
import { onShow } from '@dcloudio/uni-app';
import { ref } from 'vue';
import { decryptText } from '@/utils/api';
import { deleteVaultItem, listVaultItems } from '@/utils/services';
import { ensureVaultAccess, isLoggedIn, isVaultUnlocked } from '@/utils/access';

const notes = ref<Array<{ id: string; title: string }>>([]);
const loading = ref(false);

onShow(loadNotes);

async function loadNotes() {
  if (!isLoggedIn() || !isVaultUnlocked()) {
    notes.value = [];
    loading.value = false;
    return;
  }
  loading.value = true;
  try {
    const result = await listVaultItems('note');
    const rows = [];
    for (const item of result.items) {
      const title = await decryptText(item.titleCiphertext);
      rows.push({ id: item.id, title });
    }
    notes.value = rows;
  } catch (error) {
    uni.showToast({
      title: friendlyErrorMessage(error, '加载失败'),
      icon: 'none',
    });
  } finally {
    loading.value = false;
  }
}

async function goCreate() {
  if (!(await ensureVaultAccess('登录并解锁后即可新增私密笔记。'))) return;
  uni.navigateTo({ url: '/pages/note-create/note-create' });
}

async function goEdit(id: string) {
  if (!(await ensureVaultAccess('登录并解锁后即可编辑私密笔记。'))) return;
  uni.navigateTo({ url: `/pages/note-create/note-create?id=${id}` });
}

async function handleDelete(id: string) {
  if (!(await ensureVaultAccess('登录并解锁后即可删除私密笔记。'))) return;
  uni.showModal({
    title: '删除确认',
    content: '将移入回收站',
    success: async (res) => {
      if (!res.confirm) return;
      await deleteVaultItem(id);
      await loadNotes();
    },
  });
}
</script>

<template>
  <view class="container">
    <view class="card">
      <view class="header-row">
        <text class="title">私密笔记</text>
        <button class="btn btn-primary" size="mini" @tap="goCreate">新增</button>
      </view>
      <view class="sync-note">
        <text>小程序支持文字编辑，PC 富文本内容以安全预览方式打开。</text>
      </view>
      <view v-if="loading" class="hint">加载中...</view>
      <view v-else>
        <view v-for="item in notes" :key="item.id" class="list-item">
          <text class="item-title">{{ item.title }}</text>
          <view class="actions">
            <button class="btn btn-secondary btn-small" @tap="goEdit(item.id)">编辑</button>
            <button class="btn btn-secondary btn-small" @tap="handleDelete(item.id)">删除</button>
          </view>
        </view>
        <text v-if="notes.length === 0" class="hint">暂无笔记</text>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
@import '@/uni.scss';

.header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24rpx;
}

.item-title {
  display: block;
  font-weight: 600;
}

.sync-note {
  margin-bottom: 20rpx;
  padding: 18rpx 22rpx;
  border-radius: 18rpx;
  background: #eef6ff;
  color: #64748b;
  font-size: 24rpx;
  line-height: 1.45;
}

.actions {
  display: flex;
  gap: 16rpx;
  margin-top: 16rpx;
}

.btn-small {
  margin: 0;
  font-size: 24rpx;
  line-height: 56rpx;
  height: 56rpx;
  padding: 0 24rpx;
}
</style>
