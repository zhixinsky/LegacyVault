<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app';
import { getToken, vaultSession } from '@/utils/api';

onShow(() => {
  const token = getToken();
  if (!token) {
    uni.reLaunch({ url: '/pages/login/login' });
    return;
  }

  if (!vaultSession.getVaultKey()) {
    uni.reLaunch({ url: '/pages/setup-password/setup-password?mode=unlock' });
    return;
  }

  uni.reLaunch({ url: '/pages/vault/vault' });
});
</script>

<template>
  <view class="container">
    <view class="card">
      <text class="title">VaultPass</text>
      <text class="subtitle">正在进入保险箱...</text>
    </view>
  </view>
</template>

<style scoped lang="scss">
@import '@/uni.scss';
</style>
