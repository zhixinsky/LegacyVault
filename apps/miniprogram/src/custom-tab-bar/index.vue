<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { onShow } from '@dcloudio/uni-app';

interface TabItem {
  pagePath: string;
  text: string;
  icon: string;
}

const tabs: TabItem[] = [
  { pagePath: '/pages/index/index', text: '首页', icon: '⌂' },
  { pagePath: '/pages/vault/vault', text: '保险箱', icon: '▣' },
  { pagePath: '/pages/albums/albums', text: '相册', icon: '◫' },
  { pagePath: '/pages/security/security', text: '安全', icon: '◈' },
  { pagePath: '/pages/profile/profile', text: '我的', icon: '◉' },
];

const currentPath = ref('');

function normalizePath(path = '') {
  return path.startsWith('/') ? path : `/${path}`;
}

function syncCurrentPath() {
  const pages = getCurrentPages();
  const current = pages[pages.length - 1];
  currentPath.value = normalizePath(current?.route ?? '');
}

function switchTab(item: TabItem) {
  if (normalizePath(currentPath.value) === item.pagePath) return;
  uni.switchTab({ url: item.pagePath });
}

onMounted(syncCurrentPath);
onShow(syncCurrentPath);
</script>

<template>
  <cover-view class="vp-tabbar-shell">
    <cover-view class="vp-tabbar-glass">
      <cover-view
        v-for="item in tabs"
        :key="item.pagePath"
        class="vp-tabbar-item"
        :class="{ active: currentPath === item.pagePath }"
        @tap="switchTab(item)"
      >
        <cover-view class="vp-tabbar-icon">{{ item.icon }}</cover-view>
        <cover-view class="vp-tabbar-text">{{ item.text }}</cover-view>
      </cover-view>
    </cover-view>
  </cover-view>
</template>

<style scoped>
.vp-tabbar-shell {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 9999;
  padding: 0 28rpx calc(18rpx + env(safe-area-inset-bottom));
  pointer-events: none;
}

.vp-tabbar-glass {
  pointer-events: auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 108rpx;
  overflow: hidden;
  border: 1rpx solid rgba(255, 255, 255, 0.72);
  border-radius: 999rpx;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.78), rgba(239, 246, 255, 0.48)),
    rgba(255, 255, 255, 0.36);
  box-shadow:
    0 24rpx 60rpx rgba(15, 23, 42, 0.18),
    inset 0 1rpx 0 rgba(255, 255, 255, 0.92),
    inset 0 -1rpx 0 rgba(148, 163, 184, 0.16);
  backdrop-filter: blur(28rpx) saturate(1.8);
  -webkit-backdrop-filter: blur(28rpx) saturate(1.8);
}

.vp-tabbar-item {
  position: relative;
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  height: 84rpx;
  margin: 12rpx 6rpx;
  border-radius: 999rpx;
  color: rgba(71, 85, 105, 0.86);
  transition: all 180ms ease;
}

.vp-tabbar-item.active {
  color: #0f172a;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.92), rgba(219, 234, 254, 0.76)),
    rgba(255, 255, 255, 0.64);
  box-shadow:
    0 12rpx 34rpx rgba(37, 99, 235, 0.18),
    inset 0 1rpx 0 rgba(255, 255, 255, 0.96);
}

.vp-tabbar-icon {
  font-size: 30rpx;
  font-weight: 900;
  line-height: 1;
}

.vp-tabbar-text {
  font-size: 22rpx;
  font-weight: 800;
  line-height: 1;
}
</style>
