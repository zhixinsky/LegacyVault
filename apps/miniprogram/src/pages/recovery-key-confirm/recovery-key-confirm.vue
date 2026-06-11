<script setup lang="ts">
import { computed, ref } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { vaultSession } from '@/utils/api';

const input = ref('');
const lastGroup = ref('');
const heroBackgroundUrl =
  'cloud://prod-d4g8kpg7x92d55205.7072-prod-d4g8kpg7x92d55205-1441616383/img/bg.webp';

const canSubmit = computed(() => input.value.trim().length === 4);

onLoad(() => {
  const setup = vaultSession.getPendingVaultSetup();
  if (!setup?.recoveryLastGroup) {
    uni.reLaunch({ url: '/pages/create-vault-password/create-vault-password' });
    return;
  }
  lastGroup.value = setup.recoveryLastGroup;
});

function confirmRecoveryKey() {
  if (input.value.trim().toUpperCase() !== lastGroup.value) {
    uni.showToast({ title: '恢复密钥后 4 位不正确', icon: 'none' });
    return;
  }

  vaultSession.clearPendingVaultSetup();
  input.value = '';
  lastGroup.value = '';
  uni.showToast({ title: '保险箱创建成功', icon: 'success' });
  setTimeout(() => {
    uni.switchTab({ url: '/pages/vault/vault' });
  }, 450);
}

function goBack() {
  uni.navigateBack();
}
</script>

<template>
  <view class="confirm-page">
    <image class="page-bg" :src="heroBackgroundUrl" mode="aspectFill" />
    <view class="nav-bar">
      <button class="back-button" @tap="goBack">‹</button>
      <text class="nav-title">确认恢复密钥</text>
      <view class="wx-capsule"><text>•••</text><view /><text>◎</text></view>
    </view>

    <view class="panel">
      <image class="hero-art" src="/static/illustrations/vault-safe-hero.png" mode="aspectFit" />
      <text class="title">确认您已保存恢复密钥</text>
      <text class="subtitle">请输入恢复密钥的最后 4 位，用于确认您已经妥善保存。</text>

      <text class="field-label">恢复密钥最后 4 位</text>
      <input
        v-model="input"
        class="input"
        maxlength="4"
        placeholder="请输入恢复密钥最后 4 位"
        placeholder-class="placeholder"
      />

      <view class="risk-card">
        <text>账号可以找回，但保险箱内容无法被平台找回。恢复密钥只会在这里验证一次。</text>
      </view>

      <button
        class="primary-button"
        :class="{ disabled: !canSubmit }"
        :disabled="!canSubmit"
        @tap="confirmRecoveryKey"
      >
        完成并进入保险箱
      </button>
    </view>
  </view>
</template>

<style scoped lang="scss">
@import '@/uni.scss';

button { margin: 0; }
button::after { border: none; }

.confirm-page {
  position: relative;
  min-height: 100vh;
  padding: 80rpx 32rpx 44rpx;
  background: linear-gradient(180deg, #f7fbff 0%, #eef6ff 100%);
  box-sizing: border-box;
}

.page-bg {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  opacity: 0.92;
}

.nav-bar,
.panel {
  position: relative;
  z-index: 1;
}

.nav-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 88rpx;
}

.back-button {
  width: 72rpx;
  height: 72rpx;
  padding: 0;
  background: transparent;
  color: #071a38;
  font-size: 64rpx;
  line-height: 60rpx;
}

.nav-title {
  font-size: 30rpx;
  font-weight: 800;
  color: #0b1f4d;
}

.wx-capsule {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 18rpx;
  width: 172rpx;
  height: 64rpx;
  border: 1rpx solid rgba(11, 31, 77, 0.14);
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.76);
  color: #111827;
  font-size: 28rpx;
}

.wx-capsule view {
  width: 1rpx;
  height: 34rpx;
  background: #d8dee8;
}

.panel {
  margin-top: 42rpx;
  padding: 42rpx 34rpx 36rpx;
  border-radius: 48rpx;
  background: #fff;
  box-shadow: 0 18rpx 56rpx rgba(11, 31, 77, 0.1);
  text-align: center;
}

.hero-art {
  width: 260rpx;
  height: 220rpx;
}

.title {
  display: block;
  margin-top: 12rpx;
  color: #0b1f4d;
  font-size: 42rpx;
  font-weight: 900;
}

.subtitle {
  display: block;
  margin-top: 18rpx;
  color: #66758a;
  font-size: 26rpx;
  line-height: 1.6;
}

.field-label {
  display: block;
  margin: 44rpx 0 16rpx;
  color: #0b1f4d;
  font-size: 28rpx;
  font-weight: 900;
  text-align: left;
}

.input {
  height: 94rpx;
  padding: 0 28rpx;
  border: 1rpx solid #d7e1ef;
  border-radius: 22rpx;
  color: #0b1f4d;
  font-size: 34rpx;
  font-weight: 900;
  letter-spacing: 4rpx;
  text-align: center;
  background: #fff;
}

.placeholder {
  color: #a7b1c2;
  font-size: 27rpx;
  font-weight: 500;
  letter-spacing: 0;
}

.risk-card {
  margin-top: 28rpx;
  padding: 24rpx;
  border-radius: 20rpx;
  background: #fff4db;
  color: #d46b08;
  font-size: 24rpx;
  line-height: 1.5;
  text-align: left;
}

.primary-button {
  height: 94rpx;
  margin-top: 34rpx;
  border-radius: 22rpx;
  background: linear-gradient(135deg, #3d83ff, #0962ff);
  color: #fff;
  font-size: 30rpx;
  font-weight: 900;
  line-height: 94rpx;
  box-shadow: 0 16rpx 30rpx rgba(30, 99, 255, 0.26);
}

.primary-button.disabled {
  opacity: 0.45;
}
</style>
