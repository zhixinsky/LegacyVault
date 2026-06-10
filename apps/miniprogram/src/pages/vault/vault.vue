<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app';
import { ref } from 'vue';
import { decryptVaultTitle } from '@/utils/crypto-flow';
import { heartbeat, listVaultItems, type VaultItem } from '@/utils/services';

const loading = ref(false);
const passwordItems = ref<Array<{ id: string; title: string }>>([]);

const modules = [
  { title: '保险箱搜索', url: '/pages/search/search', emoji: '🔍' },
  { title: '账号密码', url: '/pages/passwords/passwords', emoji: '🔐' },
  { title: '敏感账户', url: '/pages/accounts-hub/accounts-hub', emoji: '💼' },
  { title: '私密笔记', url: '/pages/notes/notes', emoji: '📝' },
  { title: '回收站', url: '/pages/recycle-bin/recycle-bin', emoji: '🗑️' },
  { title: '私密相册', url: '/pages/albums/albums', emoji: '🖼️' },
  { title: '上传图片', url: '/pages/upload-image/upload-image', emoji: '📷' },
  { title: '上传视频', url: '/pages/upload-video/upload-video', emoji: '🎬' },
  { title: '上传文件', url: '/pages/upload-file/upload-file', emoji: '📁' },
  { title: '安全联系人', url: '/pages/trusted-contacts/trusted-contacts', emoji: '👥' },
  { title: '数字遗产', url: '/pages/inheritance/inheritance', emoji: '📜' },
  { title: '个人资料', url: '/pages/profile/profile', emoji: '👤' },
  { title: '数据导出', url: '/pages/export/export', emoji: '📤' },
  { title: '登录记录', url: '/pages/login-history/login-history', emoji: '📋' },
  { title: '安全中心', url: '/pages/security/security', emoji: '🛡️' },
];

onShow(() => {
  loadItems();
  heartbeat().catch(() => undefined);
});

async function loadItems() {
  loading.value = true;
  try {
    const result = await listVaultItems('password');
    const items: Array<{ id: string; title: string }> = [];

    for (const item of result.items.slice(0, 5)) {
      items.push({
        id: item.id,
        title: await decodeTitle(item),
      });
    }

    passwordItems.value = items;
  } catch (error) {
    uni.showToast({
      title: error instanceof Error ? error.message : '加载失败',
      icon: 'none',
    });
  } finally {
    loading.value = false;
  }
}

async function decodeTitle(item: VaultItem) {
  try {
    return await decryptVaultTitle(item.titleCiphertext);
  } catch {
    return '已加密条目';
  }
}

function navigate(url: string) {
  uni.navigateTo({ url });
}
</script>

<template>
  <view class="container">
    <view class="card hero">
      <text class="title">我的保险箱</text>
      <text class="subtitle">所有内容均已本地加密后同步</text>
    </view>

    <view class="card">
      <text class="section-title">快捷入口</text>
      <view class="grid">
        <view
          v-for="item in modules"
          :key="item.url"
          class="grid-item"
          @tap="navigate(item.url)"
        >
          <text class="emoji">{{ item.emoji }}</text>
          <text class="grid-text">{{ item.title }}</text>
        </view>
      </view>
    </view>

    <view class="card">
      <view class="section-header">
        <text class="section-title">最近账号密码</text>
        <text class="link" @tap="navigate('/pages/password-create/password-create')">新增</text>
      </view>

      <view v-if="loading" class="empty">加载中...</view>
      <view v-else-if="passwordItems.length === 0" class="empty">暂无账号密码，点击新增</view>
      <view v-else>
        <view v-for="item in passwordItems" :key="item.id" class="list-item">
          <text>{{ item.title }}</text>
          <text class="badge">已加密</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
@import '@/uni.scss';

.hero {
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
}

.hero .title,
.hero .subtitle {
  color: #fff;
}

.hero .subtitle {
  opacity: 0.85;
}

.section-title {
  font-size: 30rpx;
  font-weight: 600;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.link {
  color: #2563eb;
  font-size: 24rpx;
}

.grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20rpx;
  margin-top: 24rpx;
}

.grid-item {
  background: #f8fafc;
  border-radius: 16rpx;
  padding: 28rpx 20rpx;
  text-align: center;
}

.emoji {
  display: block;
  font-size: 40rpx;
}

.grid-text {
  display: block;
  margin-top: 12rpx;
  font-size: 24rpx;
  color: #334155;
}
</style>
