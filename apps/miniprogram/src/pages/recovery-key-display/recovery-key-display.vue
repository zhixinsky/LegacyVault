<script setup lang="ts">
import { computed, ref } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { vaultSession } from '@/utils/api';

const confirmed = ref(false);
const recoveryKey = ref('');
const heroBackgroundUrl =
  'cloud://prod-d4g8kpg7x92d55205.7072-prod-d4g8kpg7x92d55205-1441616383/img/bg.webp';

const keyGroups = computed(() => recoveryKey.value.split('-').filter(Boolean));
const userDataPath = ((uni as unknown as { env?: { USER_DATA_PATH?: string } }).env?.USER_DATA_PATH ?? '');

onLoad(() => {
  const setup = vaultSession.getPendingVaultSetup();
  if (!setup?.recoveryKey) {
    uni.reLaunch({ url: '/pages/create-vault-password/create-vault-password' });
    return;
  }
  recoveryKey.value = setup.recoveryKey;
});

function copyKey() {
  uni.setClipboardData({
    data: recoveryKey.value,
    success: () => uni.showToast({ title: '已复制', icon: 'none' }),
  });
}

function downloadTxt() {
  const filePath = `${userDataPath}/LegacyVault-Recovery-Key.txt`;
  const content = [
    'LegacyVault 恢复密钥',
    '',
    recoveryKey.value,
    '',
    '请离线保存。平台不会保存恢复密钥明文，任何获得恢复密钥的人都可能恢复保险箱访问权限。',
  ].join('\n');

  uni.getFileSystemManager().writeFile({
    filePath,
    data: content,
    encoding: 'utf8',
    success: () => {
      uni.showModal({
        title: '已生成 TXT',
        content: `文件已保存到：${filePath}`,
        showCancel: false,
      });
    },
    fail: () => uni.showToast({ title: '下载失败', icon: 'none' }),
  });
}

function nextStep() {
  if (!confirmed.value) return;
  uni.navigateTo({ url: '/pages/recovery-key-confirm/recovery-key-confirm' });
}

function goBack() {
  uni.navigateBack();
}
</script>

<template>
  <view class="recovery-page">
    <image class="page-bg" :src="heroBackgroundUrl" mode="aspectFill" />
    <view class="nav-bar">
      <button class="back-button" @tap="goBack">‹</button>
      <text class="nav-title">保存恢复密钥</text>
      <view class="wx-capsule"><text>•••</text><view /><text>◎</text></view>
    </view>

    <view class="hero">
      <image class="hero-art" src="/static/illustrations/vault-safe-hero.png" mode="aspectFit" />
      <text class="hero-title">请保存您的恢复密钥</text>
      <text class="hero-subtitle">如果您忘记主密码，恢复密钥是找回保险箱访问权限的唯一方式。</text>
    </view>

    <view class="key-card">
      <view class="key-grid">
        <text v-for="group in keyGroups" :key="group">{{ group }}</text>
      </view>
      <view class="action-row">
        <button class="secondary-button" @tap="copyKey">复制</button>
        <button class="secondary-button" @tap="downloadTxt">下载 TXT</button>
      </view>
      <text class="screenshot-hint">也可以截图保存到只有您能访问的位置。</text>
    </view>

    <view class="warning-card">
      <text class="warning-title">重要提醒</text>
      <text>请勿将恢复密钥发送给他人。任何获得恢复密钥的人，都可能在满足验证条件后恢复您的保险箱访问权限。</text>
    </view>

    <view class="confirm-row" @tap="confirmed = !confirmed">
      <view class="checkbox" :class="{ checked: confirmed }" />
      <text>我已将恢复密钥保存到安全位置</text>
    </view>

    <button
      class="primary-button"
      :class="{ disabled: !confirmed }"
      :disabled="!confirmed"
      @tap="nextStep"
    >
      下一步，验证恢复密钥
    </button>
  </view>
</template>

<style scoped lang="scss">
@import '@/uni.scss';

button { margin: 0; }
button::after { border: none; }

.recovery-page {
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
.hero,
.key-card,
.warning-card,
.confirm-row,
.primary-button {
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

.hero {
  padding: 34rpx 0 30rpx;
  text-align: center;
}

.hero-art {
  width: 260rpx;
  height: 220rpx;
}

.hero-title {
  display: block;
  margin-top: 12rpx;
  color: #0b1f4d;
  font-size: 42rpx;
  font-weight: 900;
}

.hero-subtitle {
  display: block;
  margin: 18rpx auto 0;
  max-width: 620rpx;
  color: #66758a;
  font-size: 26rpx;
  line-height: 1.6;
}

.key-card {
  padding: 36rpx 28rpx;
  border-radius: 42rpx;
  background: #fff;
  box-shadow: 0 18rpx 56rpx rgba(11, 31, 77, 0.1);
}

.key-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16rpx;
}

.key-grid text {
  height: 82rpx;
  border-radius: 20rpx;
  background: #f1f6ff;
  color: #0b1f4d;
  font-size: 34rpx;
  font-weight: 900;
  line-height: 82rpx;
  text-align: center;
  letter-spacing: 2rpx;
}

.action-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 18rpx;
  margin-top: 26rpx;
}

.secondary-button {
  height: 76rpx;
  border-radius: 20rpx;
  background: #eaf2ff;
  color: #1667ff;
  font-size: 26rpx;
  font-weight: 800;
  line-height: 76rpx;
}

.screenshot-hint {
  display: block;
  margin-top: 22rpx;
  color: #8b97a8;
  font-size: 24rpx;
  text-align: center;
}

.warning-card {
  margin-top: 28rpx;
  padding: 26rpx;
  border-radius: 24rpx;
  background: #fff4db;
  color: #d46b08;
  font-size: 25rpx;
  line-height: 1.55;
}

.warning-title {
  display: block;
  margin-bottom: 8rpx;
  font-weight: 900;
}

.confirm-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-top: 30rpx;
  color: #0b1f4d;
  font-size: 26rpx;
}

.checkbox {
  width: 34rpx;
  height: 34rpx;
  border: 2rpx solid #b8c7dc;
  border-radius: 10rpx;
  box-sizing: border-box;
}

.checkbox.checked {
  border-color: #1667ff;
  background: #1667ff;
}

.checkbox.checked::after {
  content: '✓';
  display: block;
  color: #fff;
  font-size: 24rpx;
  line-height: 30rpx;
  text-align: center;
  font-weight: 900;
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
