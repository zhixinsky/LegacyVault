<script setup lang="ts">
import { computed, ref } from 'vue';
import { vaultSession } from '@/utils/api';
import { buildCreateVaultPayload, calculatePasswordStrength } from '@/utils/crypto-flow';
import { createVault } from '@/utils/services';

const masterPassword = ref('');
const confirmPassword = ref('');
const showPassword = ref(false);
const showConfirmPassword = ref(false);
const loading = ref(false);

const heroBackgroundUrl =
  'cloud://prod-d4g8kpg7x92d55205.7072-prod-d4g8kpg7x92d55205-1441616383/img/bg.webp';

const strength = computed(() => calculatePasswordStrength(masterPassword.value));
const passwordsMatch = computed(
  () => Boolean(confirmPassword.value) && masterPassword.value === confirmPassword.value,
);
const canSubmit = computed(() => strength.value.valid && passwordsMatch.value && !loading.value);
const strengthPercent = computed(() => {
  const map = { weak: 25, medium: 50, strong: 75, 'very-strong': 100 };
  return map[strength.value.level as keyof typeof map];
});

const ruleItems = computed(() => [
  { label: '至少 12 位', passed: strength.value.rules.minLength },
  { label: '包含大写字母', passed: strength.value.rules.uppercase },
  { label: '包含小写字母', passed: strength.value.rules.lowercase },
  { label: '包含数字', passed: strength.value.rules.number },
  { label: '包含特殊符号', passed: strength.value.rules.special },
  { label: '避开弱密码和生日连续数字', passed: strength.value.rules.notWeak },
]);

function goBack() {
  uni.navigateBack();
}

async function handleCreateVault() {
  if (!canSubmit.value) {
    uni.showToast({ title: '请按规则填写主密码', icon: 'none' });
    return;
  }

  loading.value = true;
  try {
    const result = await buildCreateVaultPayload(masterPassword.value);
    await createVault(result.createPayload);

    vaultSession.setKeyBundle(result.keyBundle);
    vaultSession.setRecoveryBundle(result.recoveryBundle);
    vaultSession.setVaultKey(result.vaultKey);
    vaultSession.setPendingVaultSetup({
      recoveryKey: result.recoveryKey,
      recoveryLastGroup: result.recoveryKey.split('-').slice(-1)[0] ?? '',
    });

    masterPassword.value = '';
    confirmPassword.value = '';
    uni.navigateTo({ url: '/pages/recovery-key-display/recovery-key-display' });
  } catch (error) {
    uni.showToast({
      title: error instanceof Error ? error.message : '保险箱创建失败',
      icon: 'none',
    });
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <view class="vault-create-page">
    <image class="page-bg" :src="heroBackgroundUrl" mode="aspectFill" />

    <view class="nav-bar">
      <button class="back-button" @tap="goBack">‹</button>
      <text class="nav-title">创建保险箱</text>
      <view class="wx-capsule">
        <view class="dot-row"><text /><text /><text /></view>
        <view class="capsule-divider" />
        <view class="ring" />
      </view>
    </view>

    <view class="hero">
      <view class="hero-copy">
        <text class="hero-title">创建您的</text>
        <text class="hero-title blue">数字保险箱</text>
        <text class="hero-subtitle">主密码用于加密您的所有数据，只有您本人可以解锁和访问。</text>
        <view class="feature-row">
          <text>端到端加密</text>
          <text>完全私密</text>
          <text>密码不会上传</text>
        </view>
      </view>
      <image class="hero-art" src="/static/illustrations/vault-safe-hero.png" mode="aspectFit" />
    </view>

    <view class="form-card">
      <text class="field-label">主密码</text>
      <view class="input-wrap">
        <image class="field-icon" src="/static/icons/login/lock.svg" mode="aspectFit" />
        <input
          v-model="masterPassword"
          class="field-input"
          :password="!showPassword"
          placeholder="请输入主密码"
          placeholder-class="placeholder"
        />
        <button class="eye-button" @tap="showPassword = !showPassword">{{ showPassword ? '隐藏' : '显示' }}</button>
      </view>

      <view class="strength-head">
        <text>密码强度：</text>
        <text :class="['strength-label', strength.color]">{{ strength.label }}</text>
      </view>
      <view class="strength-track">
        <view :class="['strength-fill', strength.color]" :style="{ width: `${strengthPercent}%` }" />
      </view>
      <view class="rules">
        <text v-for="item in ruleItems" :key="item.label" :class="{ passed: item.passed }">{{ item.label }}</text>
      </view>

      <text class="field-label">确认主密码</text>
      <view class="input-wrap">
        <image class="field-icon" src="/static/icons/login/lock.svg" mode="aspectFit" />
        <input
          v-model="confirmPassword"
          class="field-input"
          :password="!showConfirmPassword"
          placeholder="再次输入主密码"
          placeholder-class="placeholder"
        />
        <button class="eye-button" @tap="showConfirmPassword = !showConfirmPassword">{{ showConfirmPassword ? '隐藏' : '显示' }}</button>
      </view>
      <view v-if="passwordsMatch" class="match-line">
        <text class="match-check">✓</text>
        <text>两次输入的密码一致</text>
      </view>

      <view class="security-card">
        <view class="security-icon">
          <image src="/static/icons/login/shield-solid.svg" mode="aspectFit" />
        </view>
        <view>
          <text class="security-title">安全提示</text>
          <text class="security-text">主密码不会上传到服务器，平台无法查看或恢复</text>
          <text class="security-text">忘记主密码将无法找回保险箱内的任何数据</text>
          <text class="security-text">请务必牢记主密码，并妥善保管恢复密钥</text>
        </view>
      </view>

      <view class="risk-card">
        <text class="risk-icon">!</text>
        <text>您的账号可以找回，但保险箱内容无法找回，请务必牢记主密码。</text>
      </view>

      <button
        class="primary-button"
        :class="{ disabled: !canSubmit }"
        :disabled="!canSubmit"
        :loading="loading"
        @tap="handleCreateVault"
      >
        创建我的保险箱
      </button>
    </view>

    <view class="footer-note">
      <image src="/static/icons/login/lock.svg" mode="aspectFit" />
      <text>端到端加密 · 只有您可以访问</text>
    </view>
  </view>
</template>

<style scoped lang="scss">
@import '@/uni.scss';

button {
  margin: 0;
}

button::after {
  border: none;
}

.vault-create-page {
  position: relative;
  min-height: 100vh;
  padding: 80rpx 32rpx 40rpx;
  background: linear-gradient(180deg, #f7fbff 0%, #eef6ff 100%);
  box-sizing: border-box;
  overflow: hidden;
}

.page-bg {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  opacity: 0.92;
  z-index: 0;
}

.nav-bar,
.hero,
.form-card,
.footer-note {
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
}

.dot-row {
  display: flex;
  gap: 7rpx;
}

.dot-row text {
  width: 9rpx;
  height: 9rpx;
  border-radius: 50%;
  background: #111827;
}

.capsule-divider {
  width: 1rpx;
  height: 34rpx;
  background: #d8dee8;
}

.ring {
  width: 34rpx;
  height: 34rpx;
  border: 7rpx solid #111827;
  border-radius: 50%;
  box-sizing: border-box;
}

.hero {
  display: grid;
  grid-template-columns: 1fr 260rpx;
  align-items: center;
  min-height: 330rpx;
}

.hero-title {
  display: block;
  font-size: 50rpx;
  line-height: 1.14;
  font-weight: 900;
  color: #12233f;
}

.hero-title.blue {
  color: #1667ff;
}

.hero-subtitle {
  display: block;
  margin-top: 26rpx;
  max-width: 430rpx;
  font-size: 26rpx;
  line-height: 1.65;
  color: #67748a;
}

.feature-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 24rpx;
}

.feature-row text {
  padding: 8rpx 14rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.7);
  color: #1e63d6;
  font-size: 20rpx;
  font-weight: 700;
}

.hero-art {
  width: 280rpx;
  height: 280rpx;
}

.form-card {
  padding: 42rpx 34rpx 34rpx;
  border-radius: 48rpx;
  background: #fff;
  box-shadow: 0 18rpx 56rpx rgba(11, 31, 77, 0.1);
}

.field-label {
  display: block;
  margin: 4rpx 0 16rpx;
  font-size: 30rpx;
  font-weight: 900;
  color: #0b1f4d;
}

.input-wrap {
  display: flex;
  align-items: center;
  height: 90rpx;
  padding: 0 22rpx;
  border: 1rpx solid #d7e1ef;
  border-radius: 22rpx;
  background: #fff;
}

.field-icon {
  width: 30rpx;
  height: 30rpx;
  margin-right: 18rpx;
  opacity: 0.72;
}

.field-input {
  flex: 1;
  height: 100%;
  font-size: 28rpx;
  color: #0b1f4d;
}

.placeholder {
  color: #a7b1c2;
}

.eye-button {
  width: 76rpx;
  height: 56rpx;
  padding: 0;
  background: transparent;
  color: #8b97a8;
  font-size: 23rpx;
  line-height: 56rpx;
}

.strength-head {
  display: flex;
  align-items: center;
  gap: 8rpx;
  margin: 24rpx 0 14rpx;
  color: #66758a;
  font-size: 25rpx;
}

.strength-label {
  font-weight: 900;
}

.red { color: #ef4444; }
.orange { color: #f59e0b; }
.green { color: #22c55e; }
.blue { color: #1e63ff; }

.strength-track {
  height: 12rpx;
  border-radius: 999rpx;
  background: #e8eef8;
  overflow: hidden;
}

.strength-fill {
  height: 100%;
  border-radius: 999rpx;
  transition: width 0.2s ease;
}

.strength-fill.red { background: #ef4444; }
.strength-fill.orange { background: #f59e0b; }
.strength-fill.green { background: #22c55e; }
.strength-fill.blue { background: #1e63ff; }

.rules {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin: 18rpx 0 30rpx;
}

.rules text {
  font-size: 23rpx;
  color: #8b97a8;
}

.rules text.passed {
  color: #1e63d6;
  font-weight: 700;
}

.match-line {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin: 22rpx 0 30rpx;
  color: #68778c;
  font-size: 25rpx;
}

.match-check {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34rpx;
  height: 34rpx;
  border-radius: 50%;
  background: #22c55e;
  color: #fff;
  font-size: 24rpx;
}

.security-card {
  display: grid;
  grid-template-columns: 104rpx 1fr;
  gap: 18rpx;
  margin-top: 30rpx;
  padding: 28rpx 24rpx;
  border: 1rpx solid #b9d7ff;
  border-radius: 24rpx;
  background: #eef7ff;
}

.security-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 76rpx;
  height: 76rpx;
  border-radius: 50%;
  background: #dbeafe;
}

.security-icon image {
  width: 44rpx;
  height: 44rpx;
}

.security-title {
  display: block;
  margin-bottom: 14rpx;
  font-size: 28rpx;
  font-weight: 900;
  color: #0b1f4d;
}

.security-text {
  display: block;
  margin-top: 10rpx;
  font-size: 24rpx;
  line-height: 1.35;
  color: #69788d;
}

.security-text::before {
  content: '✓';
  margin-right: 12rpx;
  color: #1667ff;
  font-weight: 900;
}

.risk-card {
  display: flex;
  align-items: center;
  gap: 14rpx;
  margin-top: 28rpx;
  padding: 24rpx;
  border-radius: 20rpx;
  background: #fff4db;
  color: #d46b08;
  font-size: 24rpx;
  line-height: 1.45;
}

.risk-icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30rpx;
  height: 30rpx;
  border: 2rpx solid #f59e0b;
  border-radius: 50%;
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

.footer-note {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  margin-top: 38rpx;
  color: #8b97a8;
  font-size: 24rpx;
}

.footer-note image {
  width: 26rpx;
  height: 26rpx;
  opacity: 0.62;
}
</style>
