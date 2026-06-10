<script setup lang="ts">
import { ref } from 'vue';
import { vaultSession } from '@/utils/api';
import {
  isAuthResult,
  loginWithCode,
  persistAuthResult,
  sendLoginCode,
  wxLogin,
} from '@/utils/services';

const phone = ref('');
const code = ref('');
const loading = ref(false);
const sendingCode = ref(false);
const countdown = ref(0);
const agreed = ref(false);
const phoneFocused = ref(false);
const heroBackgroundUrl =
  'cloud://prod-d4g8kpg7x92d55205.7072-prod-d4g8kpg7x92d55205-1441616383/img/bg.webp';

let countdownTimer: ReturnType<typeof setInterval> | null = null;

function ensureAgreed() {
  if (!agreed.value) {
    uni.showToast({ title: '请先阅读并同意用户协议和隐私政策', icon: 'none' });
    return false;
  }
  return true;
}

function startCountdown() {
  countdown.value = 60;
  if (countdownTimer) clearInterval(countdownTimer);
  countdownTimer = setInterval(() => {
    countdown.value -= 1;
    if (countdown.value <= 0 && countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
  }, 1000);
}

function goRegister() {
  if (!ensureAgreed()) return;
  if (!/^1\d{10}$/.test(phone.value)) {
    uni.showToast({ title: '请输入正确手机号', icon: 'none' });
    return;
  }
  vaultSession.setPendingPhone(phone.value);
  uni.navigateTo({ url: '/pages/setup-password/setup-password?mode=register' });
}

async function handleSendCode() {
  if (!/^1\d{10}$/.test(phone.value)) {
    uni.showToast({ title: '请输入正确手机号', icon: 'none' });
    return;
  }
  if (countdown.value > 0) return;

  sendingCode.value = true;
  try {
    await sendLoginCode(phone.value);
    startCountdown();
    uni.showToast({ title: '验证码已发送', icon: 'none' });
  } catch (error) {
    uni.showToast({
      title: error instanceof Error ? error.message : '发送失败',
      icon: 'none',
    });
  } finally {
    sendingCode.value = false;
  }
}

async function goLogin() {
  if (!ensureAgreed()) return;
  if (!/^1\d{10}$/.test(phone.value)) {
    uni.showToast({ title: '请输入正确手机号', icon: 'none' });
    return;
  }
  if (!/^\d{6}$/.test(code.value)) {
    uni.showToast({ title: '请输入 6 位验证码', icon: 'none' });
    return;
  }

  loading.value = true;
  try {
    const result = await loginWithCode(phone.value, code.value);
    if (!isAuthResult(result)) {
      uni.showToast({ title: '用户不存在，请先注册', icon: 'none' });
      return;
    }
    persistAuthResult(result);
    vaultSession.setPendingPhone(phone.value);
    uni.navigateTo({ url: '/pages/setup-password/setup-password?mode=unlock' });
  } catch (error) {
    uni.showToast({
      title: error instanceof Error ? error.message : '登录失败',
      icon: 'none',
    });
  } finally {
    loading.value = false;
  }
}

async function handleWxLogin() {
  if (!ensureAgreed()) return;
  loading.value = true;
  try {
    const loginRes = await new Promise<UniApp.LoginRes>((resolve, reject) => {
      uni.login({
        provider: 'weixin',
        success: resolve,
        fail: reject,
      });
    });

    if (!loginRes.code) {
      throw new Error('微信登录失败');
    }

    vaultSession.setPendingWxCode(loginRes.code);
    const result = await wxLogin(loginRes.code);

    if (!isAuthResult(result)) {
      uni.showToast({
        title: '首次使用请授权手机号注册',
        icon: 'none',
        duration: 2500,
      });
      return;
    }

    persistAuthResult(result);
    if (result.user.phone) {
      vaultSession.setPendingPhone(result.user.phone);
    }
    uni.navigateTo({ url: '/pages/setup-password/setup-password?mode=unlock' });
  } catch (error) {
    uni.showToast({
      title: error instanceof Error ? error.message : '微信登录失败',
      icon: 'none',
    });
  } finally {
    loading.value = false;
  }
}

function focusPhoneInput() {
  phoneFocused.value = true;
  uni.pageScrollTo({ scrollTop: 260, duration: 180 });
}

function toggleAgreement() {
  agreed.value = !agreed.value;
}

function openLegal(type: 'user' | 'privacy') {
  uni.showToast({
    title: type === 'user' ? '用户协议暂未配置' : '隐私政策暂未配置',
    icon: 'none',
  });
}

function handleHeroImageError(error: unknown) {
  console.warn('[login] 背景图加载失败', heroBackgroundUrl, error);
}
</script>

<template>
  <view class="login-page">
    <image class="login-bg" :src="heroBackgroundUrl" mode="aspectFill" @error="handleHeroImageError" />
    <view class="hero">
      <view class="brand-copy">
        <view class="welcome-line">
          <image class="inline-icon mini-shield" src="/static/icons/login/shield.svg" mode="aspectFit" />
          <text>Welcome to</text>
        </view>
        <text class="brand-title">LegacyVault</text>
        <text class="brand-subtitle">您的数字保险箱</text>
        <view class="security-line">
          <image class="inline-icon lock-icon" src="/static/icons/login/lock.svg" mode="aspectFit" />
          <text>端到端加密 · 只有您可以访问</text>
        </view>
      </view>
    </view>

    <view class="login-card">
      <view class="quick-row">
        <!-- #ifdef MP-WEIXIN -->
        <button class="quick-btn wx-btn" :loading="loading" @tap="handleWxLogin">
          <image class="quick-icon" src="/static/icons/login/wechat.svg" mode="aspectFit" />
          <text>微信快捷登录</text>
        </button>
        <!-- #endif -->
        <button class="quick-btn phone-btn" @tap="focusPhoneInput">
          <image class="quick-icon" src="/static/icons/login/phone.svg" mode="aspectFit" />
          <text>手机号快捷登录</text>
        </button>
      </view>

      <view class="divider">
        <view class="divider-line" />
        <text class="divider-text">或使用密码登录</text>
        <view class="divider-line" />
      </view>

      <text class="field-label">手机号</text>
      <view class="input-wrap">
        <image class="field-icon" src="/static/icons/login/phone.svg" mode="aspectFit" />
        <input
          v-model="phone"
          class="field-input"
          type="number"
          maxlength="11"
          placeholder="请输入手机号"
          placeholder-class="placeholder"
          :focus="phoneFocused"
          @blur="phoneFocused = false"
        />
      </view>

      <text class="field-label">验证码</text>
      <view class="code-row">
        <view class="input-wrap code-input">
          <image class="field-icon" src="/static/icons/login/lock.svg" mode="aspectFit" />
          <input
            v-model="code"
            class="field-input"
            type="number"
            maxlength="6"
            placeholder="请输入6位验证码"
            placeholder-class="placeholder"
          />
        </view>
        <button
          class="code-btn"
          :disabled="sendingCode || countdown > 0"
          @tap="handleSendCode"
        >
          {{ countdown > 0 ? `${countdown}s` : '获取验证码' }}
        </button>
      </view>

      <view class="agreement" @tap="toggleAgreement">
        <view class="check" :class="{ checked: agreed }" />
        <text class="agreement-text">我已阅读并同意</text>
        <text class="legal-link" @tap.stop="openLegal('user')">《用户协议》</text>
        <text class="agreement-text">和</text>
        <text class="legal-link" @tap.stop="openLegal('privacy')">《隐私政策》</text>
      </view>

      <button
        class="login-btn"
        :class="{ disabled: !agreed }"
        :loading="loading"
        @tap="goLogin"
      >
        <image class="button-icon login-icon" src="/static/icons/login/login.svg" mode="aspectFit" />
        <text>登录</text>
      </button>

      <button class="register-btn" @tap="goRegister">
        <image class="button-icon" src="/static/icons/login/register.svg" mode="aspectFit" />
        <text>注册新账户</text>
      </button>

      <view class="security-points">
        <view class="point">
          <image class="point-icon" src="/static/icons/login/data-encryption.svg" mode="aspectFit" />
          <text class="point-title">数据加密存储</text>
          <text class="point-desc">银行级安全保障</text>
        </view>
        <view class="point">
          <image class="point-icon" src="/static/icons/login/private-control.svg" mode="aspectFit" />
          <text class="point-title">完全私密控制</text>
          <text class="point-desc">只有您可以访问</text>
        </view>
        <view class="point">
          <image class="point-icon" src="/static/icons/login/backup.svg" mode="aspectFit" />
          <text class="point-title">多重备份保护</text>
          <text class="point-desc">永不丢失您的数据</text>
        </view>
      </view>
    </view>

    <text class="copyright">© 2024 LegacyVault. 保留所有权利。</text>
  </view>
</template>

<style scoped lang="scss">
@import '@/uni.scss';

.login-page {
  position: relative;
  min-height: 100vh;
  padding: 96rpx 32rpx 36rpx;
  background: linear-gradient(180deg, #f7fbff 0%, #eef5ff 100%);
  box-sizing: border-box;
  overflow: hidden;
}

.login-bg {
  position: fixed;
  left: 0;
  top: 0;
  width: 100vw;
  height: 100vh;
  z-index: 0;
}

.hero {
  position: relative;
  z-index: 1;
  display: flex;
  justify-content: space-between;
  align-items: center;
  min-height: 280rpx;
  padding: 0 12rpx 24rpx;
}

.brand-copy {
  position: relative;
  z-index: 1;
  flex: 1;
  min-width: 0;
}

.welcome-line,
.security-line {
  display: flex;
  align-items: center;
  gap: 10rpx;
  color: #3b6ebf;
}

.welcome-line {
  font-size: 24rpx;
  font-weight: 600;
}

.inline-icon {
  display: block;
  flex-shrink: 0;
}

.mini-shield {
  width: 28rpx;
  height: 28rpx;
}

.brand-title {
  display: block;
  margin-top: 12rpx;
  font-size: 54rpx;
  line-height: 1;
  font-weight: 900;
  color: #0b1f4d;
  letter-spacing: -1rpx;
}

.brand-subtitle {
  display: block;
  margin-top: 18rpx;
  font-size: 30rpx;
  font-weight: 700;
  color: #0b1f4d;
}

.security-line {
  margin-top: 28rpx;
  font-size: 22rpx;
  color: #6b7280;
}

.lock-icon {
  width: 24rpx;
  height: 24rpx;
}

.login-card {
  position: relative;
  z-index: 1;
  width: 100%;
  padding: 48rpx 36rpx 34rpx;
  border-radius: 48rpx;
  background: #fff;
  box-shadow: 0 18rpx 56rpx rgba(11, 31, 77, 0.1);
  box-sizing: border-box;
}

.quick-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20rpx;
}

button {
  margin: 0;
}

button::after {
  border: none;
}

.quick-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  height: 92rpx;
  padding: 0;
  border-radius: 24rpx;
  font-size: 26rpx;
  font-weight: 700;
  line-height: 92rpx;
}

.wx-btn {
  color: #fff;
  background: linear-gradient(135deg, #07c160, #05a84f);
  box-shadow: 0 12rpx 24rpx rgba(7, 193, 96, 0.22);
}

.phone-btn {
  color: #0b1f4d;
  background: #fff;
  border: 1rpx solid #d6e4ff;
}

.quick-icon {
  display: block;
  width: 36rpx;
  height: 36rpx;
  flex-shrink: 0;
}

.divider {
  display: flex;
  align-items: center;
  gap: 18rpx;
  margin: 36rpx 0 28rpx;
}

.divider-line {
  flex: 1;
  height: 1rpx;
  background: #e1e8f0;
}

.divider-text {
  font-size: 22rpx;
  color: #9aa5b5;
}

.field-label {
  display: block;
  margin: 24rpx 0 14rpx;
  font-size: 26rpx;
  font-weight: 700;
  color: #0b1f4d;
}

.input-wrap {
  display: flex;
  align-items: center;
  height: 104rpx;
  padding: 0 24rpx;
  border: 1rpx solid #e1e8f0;
  border-radius: 28rpx;
  background: #fff;
  box-sizing: border-box;
}

.field-icon {
  width: 32rpx;
  height: 32rpx;
  margin-right: 18rpx;
  flex-shrink: 0;
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

.code-row {
  display: flex;
  gap: 16rpx;
  align-items: center;
}

.code-input {
  flex: 1;
}

.code-btn {
  height: 104rpx;
  min-width: 200rpx;
  padding: 0 20rpx;
  border-radius: 28rpx;
  background: #eef3ff;
  color: #1e4dff;
  font-size: 24rpx;
  font-weight: 700;
  line-height: 104rpx;
}

.agreement {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6rpx;
  margin-top: 28rpx;
}

.check {
  width: 30rpx;
  height: 30rpx;
  margin-right: 8rpx;
  border: 2rpx solid #c7d2e3;
  border-radius: 50%;
  box-sizing: border-box;
}

.check.checked {
  position: relative;
  border-color: #1e4dff;
  background: #1e4dff;
}

.check.checked::after {
  content: '';
  position: absolute;
  left: 8rpx;
  top: 4rpx;
  width: 8rpx;
  height: 14rpx;
  border-right: 3rpx solid #fff;
  border-bottom: 3rpx solid #fff;
  transform: rotate(40deg);
}

.agreement-text {
  font-size: 23rpx;
  color: #6b7280;
}

.legal-link {
  font-size: 23rpx;
  color: #1e4dff;
}

.login-btn,
.register-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  height: 108rpx;
  border-radius: 28rpx;
  font-size: 30rpx;
  font-weight: 800;
}

.login-btn {
  margin-top: 28rpx;
  color: #fff;
  background: linear-gradient(135deg, #1e4dff, #0066ff);
  box-shadow: 0 16rpx 34rpx rgba(30, 77, 255, 0.26);
}

.login-btn.disabled {
  background: #cbd5e1;
  box-shadow: none;
}

.button-icon {
  display: block;
  width: 36rpx;
  height: 36rpx;
  flex-shrink: 0;
}

.login-icon {
  padding: 4rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.96);
  box-sizing: border-box;
}

.register-btn {
  margin-top: 22rpx;
  color: #1e4dff;
  background: #fff;
  border: 1rpx solid #b8c8ff;
}

.security-points {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0;
  margin-top: 46rpx;
  padding-top: 30rpx;
  border-top: 1rpx solid #eef2f7;
}

.point {
  min-width: 0;
  padding: 0 10rpx;
  text-align: center;
  border-right: 1rpx solid #eef2f7;
}

.point:last-child {
  border-right: none;
}

.point-icon {
  display: block;
  width: 58rpx;
  height: 58rpx;
  margin: 0 auto 18rpx;
}

.point-title {
  display: block;
  font-size: 23rpx;
  font-weight: 800;
  color: #0b1f4d;
}

.point-desc {
  display: block;
  margin-top: 8rpx;
  font-size: 20rpx;
  color: #6b7280;
  line-height: 1.35;
}

.copyright {
  position: relative;
  z-index: 1;
  display: block;
  margin-top: 34rpx;
  text-align: center;
  font-size: 22rpx;
  color: #9aa5b5;
}
</style>

