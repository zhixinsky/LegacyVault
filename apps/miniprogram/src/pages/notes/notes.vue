<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app';
import { ref } from 'vue';
import { decryptText } from '@/utils/api';
import { decryptVaultPayload } from '@/utils/crypto-flow';
import { richNoteToPlainText, type RichNotePayload } from '@/utils/rich-note';
import { deleteVaultItem, listVaultItems } from '@/utils/services';

const notes = ref<Array<{ id: string; title: string; content: string }>>([]);
const loading = ref(false);

onShow(loadNotes);

async function loadNotes() {
  loading.value = true;
  try {
    const result = await listVaultItems('note');
    const rows = [];
    for (const item of result.items) {
      const title = await decryptText(item.titleCiphertext);
      const payload = await decryptVaultPayload<RichNotePayload>(item.encryptedPayload);
      rows.push({ id: item.id, title, content: richNoteToPlainText(payload) });
    }
    notes.value = rows;
  } catch (error) {
    uni.showToast({
      title: error instanceof Error ? error.message : '加载失败',
      icon: 'none',
    });
  } finally {
    loading.value = false;
  }
}

function goCreate() {
  uni.navigateTo({ url: '/pages/note-create/note-create' });
}

function goEdit(id: string) {
  uni.navigateTo({ url: `/pages/note-create/note-create?id=${id}` });
}

function handleDelete(id: string) {
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
      <view v-if="loading" class="hint">加载中...</view>
      <view v-else>
        <view v-for="item in notes" :key="item.id" class="list-item">
          <text class="item-title">{{ item.title }}</text>
          <text class="hint">{{ item.content }}</text>
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
  margin-bottom: 8rpx;
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
