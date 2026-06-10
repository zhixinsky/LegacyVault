<script setup lang="ts">
import { ref } from 'vue';
import { vaultSession } from '@/utils/api';
import {
  isAuthResult,
  loginWithCode,
  persistAuthResult,
  sendLoginCode,
  wechatPhoneLogin,
  wxLogin,
} from '@/utils/services';

const phone = ref('');
const code = ref('');
const loading = ref(false);
const sendingCode = ref(false);
const countdown = ref(0);

let countdownTimer: ReturnType<typeof setInterval> | null = null;

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

async function onGetPhoneNumber(event: UniHelper.ButtonOnGetphonenumber) {
  const detail = event.detail as { errMsg?: string; code?: string };
  if (detail.errMsg !== 'getPhoneNumber:ok' || !detail.code) {
    uni.showToast({ title: '需要授权手机号才能登录', icon: 'none' });
    return;
  }

  loading.value = true;
  try {
    const result = await wechatPhoneLogin(detail.code);

    if (!isAuthResult(result)) {
      vaultSession.setPendingPhone(result.phone ?? '');
      const wxCode = vaultSession.getPendingWxCode();
      uni.navigateTo({
        url: `/pages/setup-password/setup-password?mode=register${wxCode ? '&wx=1' : ''}`,
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
      title: error instanceof Error ? error.message : '手机号登录失败',
      icon: 'none',
    });
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <view class="container">
    <view class="card">
      <text class="title">登录 VaultPass</text>
      <text class="subtitle">主密码仅在本地使用，不会发送到服务器</text>

      <!-- #ifdef MP-WEIXIN -->
      <button class="btn btn-wx" :loading="loading" @tap="handleWxLogin">微信快捷登录</button>
      <button
        class="btn btn-phone-quick"
        open-type="getPhoneNumber"
        :loading="loading"
        @getphonenumber="onGetPhoneNumber"
      >
        手机号快捷登录
      </button>
      <view class="divider">
        <view class="divider-line" />
        <text class="divider-text">或短信验证码登录</text>
        <view class="divider-line" />
      </view>
      <!-- #endif -->

      <text class="field-label">手机号</text>
      <input v-model="phone" class="input" type="number" maxlength="11" placeholder="请输入手机号" />

      <text class="field-label">验证码</text>
      <view class="code-row">
        <input v-model="code" class="input code-input" type="number" maxlength="6" placeholder="6 位验证码" />
        <button
          class="btn btn-code"
          :disabled="sendingCode || countdown > 0"
          @tap="handleSendCode"
        >
          {{ countdown > 0 ? `${countdown}s` : '获取验证码' }}
        </button>
      </view>

      <button class="btn btn-primary" :loading="loading" @tap="goLogin">登录</button>
      <button class="btn btn-secondary" @tap="goRegister">注册新账户</button>
    </view>
  </view>
</template>

<style scoped lang="scss">
@import '@/uni.scss';

.container {
  min-height: 100vh;
  padding: 48rpx 32rpx;
  background: #f1f5f9;
}

.card {
  background: #fff;
  border-radius: 24rpx;
  padding: 48rpx 40rpx;
  box-shadow: 0 8rpx 32rpx rgba(15, 23, 42, 0.06);
}

.title {
  display: block;
  font-size: 40rpx;
  font-weight: 700;
  color: #0f172a;
}

.subtitle {
  display: block;
  margin-top: 12rpx;
  font-size: 24rpx;
  color: #64748b;
}

.field-label {
  display: block;
  margin-top: 32rpx;
  font-size: 26rpx;
  color: #334155;
}

.input {
  margin-top: 12rpx;
  padding: 20rpx 24rpx;
  border: 1px solid #cbd5e1;
  border-radius: 16rpx;
  font-size: 28rpx;
}

.code-row {
  display: flex;
  gap: 16rpx;
  align-items: center;
}

.code-input {
  flex: 1;
}

.btn {
  margin-top: 24rpx;
  border-radius: 16rpx;
  font-size: 28rpx;
}

.btn-wx {
  margin-top: 40rpx;
  background: #07c160;
  color: #fff;
}

.btn-phone-quick {
  background: #2563eb;
  color: #fff;
}

.btn-code {
  margin-top: 12rpx;
  min-width: 200rpx;
  padding: 0 20rpx;
  background: #e2e8f0;
  color: #334155;
  font-size: 24rpx;
}

.btn-primary {
  background: #2563eb;
  color: #fff;
}

.btn-secondary {
  background: #f1f5f9;
  color: #334155;
}

.divider {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin: 32rpx 0 8rpx;
}

.divider-line {
  flex: 1;
  height: 1px;
  background: #e2e8f0;
}

.divider-text {
  font-size: 22rpx;
  color: #94a3b8;
}
</style>
