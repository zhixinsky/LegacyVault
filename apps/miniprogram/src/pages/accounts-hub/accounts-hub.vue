<script setup lang="ts">
import { listManagedVaultConfigs } from '@vaultpass/types';

const cards = listManagedVaultConfigs();

function navigate(type: string) {
  uni.navigateTo({ url: `/pages/accounts/accounts?type=${type}` });
}
</script>

<template>
  <view class="container">
    <view class="card">
      <text class="title">敏感账户</text>
      <text class="subtitle">股票、银行、邮箱、服务器、证件与合同，均在本地加密后同步</text>

      <view class="grid">
        <view v-for="item in cards" :key="item.type" class="grid-item" @tap="navigate(item.type)">
          <text class="emoji">{{ item.emoji }}</text>
          <text class="grid-text">{{ item.label }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
@import '@/uni.scss';

.grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20rpx;
  margin-top: 28rpx;
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
