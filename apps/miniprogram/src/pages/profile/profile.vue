<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app';
import { ref } from 'vue';
import {
  bindEmailWithCode,
  bindWechat,
  bindWechatPhone,
  getProfile,
  sendEmailLoginCode,
  unbindWechat,
} from '@/utils/services';

const loading = ref(false);
const wxLoading = ref(false);
const phoneLoading = ref(false);
const emailLoading = ref(false);
const sendingEmailCode = ref(false);
const username = ref('');
const phone = ref('');
const email = ref('');
const emailInput = ref('');
const emailCode = ref('');
const wxBound = ref(false);
const mfaEnabled = ref(false);
const createdAt = ref('');
const lastLoginAt = ref('');
const emailCountdown = ref(0);

let emailCountdownTimer: ReturnType<typeof setInterval> | null = null;

onShow(loadProfile);

async function loadProfile() {
  loading.value = true;
  try {
    const profile = await getProfile();
    username.value = profile.username ?? '';
    phone.value = profile.phone ?? '';
    email.value = profile.email ?? '';
    emailInput.value = profile.email ?? '';
    wxBound.value = profile.wxBound ?? false;
    mfaEnabled.value = profile.mfaEnabled;
    createdAt.value = formatTime(profile.createdAt);
    lastLoginAt.value = profile.lastLoginAt ? formatTime(profile.lastLoginAt) : '暂无记录';
  } catch (error) {
    uni.showToast({
      title: error instanceof Error ? error.message : '加载失败',
      icon: 'none',
    });
  } finally {
    loading.value = false;
  }
}

function formatTime(value: string) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function startEmailCountdown() {
  emailCountdown.value = 60;
  if (emailCountdownTimer) clearInterval(emailCountdownTimer);
  emailCountdownTimer = setInterval(() => {
    emailCountdown.value -= 1;
    if (emailCountdown.value <= 0 && emailCountdownTimer) {
      clearInterval(emailCountdownTimer);
      emailCountdownTimer = null;
    }
  }, 1000);
}

async function handleBindWechat() {
  wxLoading.value = true;
  try {
    const loginRes = await new Promise<UniApp.LoginRes>((resolve, reject) => {
      uni.login({ provider: 'weixin', success: resolve, fail: reject });
    });
    if (!loginRes.code) throw new Error('微信授权失败');
    await bindWechat(loginRes.code);
    wxBound.value = true;
    uni.showToast({ title: '微信已绑定', icon: 'success' });
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '绑定失败', icon: 'none' });
  } finally {
    wxLoading.value = false;
  }
}

function handleUnbindWechat() {
  uni.showModal({
    title: '解绑微信',
    content: '解绑后将无法使用微信快捷登录和 PC 扫码登录',
    success: async (result) => {
      if (!result.confirm) return;
      wxLoading.value = true;
      try {
        await unbindWechat();
        wxBound.value = false;
        uni.showToast({ title: '已解绑', icon: 'success' });
      } catch (error) {
        uni.showToast({ title: error instanceof Error ? error.message : '解绑失败', icon: 'none' });
      } finally {
        wxLoading.value = false;
      }
    },
  });
}

async function handleBindPhone(event: { detail?: { code?: string; errMsg?: string } }) {
  const detail = event.detail;
  if (!detail?.code) {
    uni.showToast({
      title: detail?.errMsg?.includes('deny') ? '请授权手机号绑定' : '手机号授权失败',
      icon: 'none',
    });
    return;
  }

  phoneLoading.value = true;
  try {
    const result = await bindWechatPhone(detail.code);
    phone.value = result.phone;
    uni.showToast({ title: '手机号已绑定', icon: 'success' });
  } catch (error) {
    uni.showToast({
      title: error instanceof Error ? error.message : '绑定失败',
      icon: 'none',
    });
  } finally {
    phoneLoading.value = false;
  }
}

async function handleSendEmailCode() {
  const value = emailInput.value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    uni.showToast({ title: '请输入正确邮箱', icon: 'none' });
    return;
  }
  if (emailCountdown.value > 0) return;

  sendingEmailCode.value = true;
  try {
    await sendEmailLoginCode(value);
    startEmailCountdown();
    uni.showToast({ title: '邮箱验证码已发送', icon: 'none' });
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '发送失败', icon: 'none' });
  } finally {
    sendingEmailCode.value = false;
  }
}

async function handleBindEmail() {
  const value = emailInput.value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    uni.showToast({ title: '请输入正确邮箱', icon: 'none' });
    return;
  }
  if (!/^\d{6}$/.test(emailCode.value)) {
    uni.showToast({ title: '请输入 6 位验证码', icon: 'none' });
    return;
  }

  emailLoading.value = true;
  try {
    const result = await bindEmailWithCode(value, emailCode.value);
    email.value = result.email;
    emailInput.value = result.email;
    emailCode.value = '';
    uni.showToast({ title: '邮箱已绑定', icon: 'success' });
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '绑定失败', icon: 'none' });
  } finally {
    emailLoading.value = false;
  }
}

function goSecurity() {
  uni.switchTab({ url: '/pages/security/security' });
}
</script>

<template>
  <view class="container tabbar-page">
    <view class="card">
      <text class="title">账号与身份认证</text>
      <text class="subtitle">绑定可信身份，用于快捷登录、安全通知与找回验证</text>

      <text v-if="loading" class="hint">加载中...</text>

      <template v-else>
        <view class="identity-card">
          <view>
            <text class="identity-title">用户名</text>
            <text class="identity-desc">{{ username || '未设置' }}</text>
          </view>
          <text class="status-pill bound">已启用</text>
        </view>

        <view class="identity-card">
          <view>
            <text class="identity-title">微信</text>
            <text class="identity-desc">{{ wxBound ? '已绑定，可用于快捷登录与扫码确认' : '未绑定，建议立即绑定' }}</text>
          </view>
          <button v-if="!wxBound" class="mini-btn primary" :loading="wxLoading" @tap="handleBindWechat">绑定微信</button>
          <button v-else class="mini-btn secondary" :loading="wxLoading" @tap="handleUnbindWechat">解绑</button>
        </view>

        <view class="identity-card">
          <view>
            <text class="identity-title">手机号</text>
            <text class="identity-desc">{{ phone || '未绑定，用于快捷登录和安全通知' }}</text>
          </view>
          <button class="mini-btn primary" open-type="getPhoneNumber" :loading="phoneLoading" @getphonenumber="handleBindPhone">
            {{ phone ? '更换' : '绑定' }}
          </button>
        </view>

        <view class="identity-card email-card">
          <view class="email-head">
            <view>
              <text class="identity-title">邮箱</text>
              <text class="identity-desc">{{ email || '未绑定，用于安全通知和邮箱验证码登录' }}</text>
            </view>
            <text class="status-pill" :class="{ bound: email }">{{ email ? '已绑定' : '未绑定' }}</text>
          </view>
          <view class="email-form">
            <input v-model="emailInput" class="input" type="text" placeholder="请输入邮箱" />
            <view class="code-row">
              <input v-model="emailCode" class="input code-input" type="number" maxlength="6" placeholder="验证码" />
              <button class="code-btn" :disabled="sendingEmailCode || emailCountdown > 0" @tap="handleSendEmailCode">
                {{ emailCountdown > 0 ? `${emailCountdown}s` : '获取验证码' }}
              </button>
            </view>
            <button class="btn btn-primary" :loading="emailLoading" @tap="handleBindEmail">
              {{ email ? '更换邮箱' : '绑定邮箱' }}
            </button>
          </view>
        </view>

        <view class="info-box">
          <text class="info-line">二次验证：{{ mfaEnabled ? '已启用' : '未启用' }}</text>
          <text class="info-line">注册时间：{{ createdAt }}</text>
          <text class="info-line">最近登录：{{ lastLoginAt }}</text>
        </view>

        <button class="btn btn-secondary" @tap="goSecurity">前往安全中心（MFA / 恢复密钥）</button>
      </template>
    </view>
  </view>
</template>

<style scoped lang="scss">
@import '@/uni.scss';

.info-box {
  margin-top: 30rpx;
  padding: 24rpx;
  border-radius: 16rpx;
  background: #f8fafc;
}

.info-line {
  display: block;
  font-size: 26rpx;
  color: #475569;
  line-height: 1.8;
}

.btn-secondary {
  margin-top: 20rpx;
  background: #fff;
  color: #334155;
  border: 1rpx solid #cbd5e1;
}

.identity-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  margin-top: 24rpx;
  padding: 26rpx;
  border: 1rpx solid #e2e8f0;
  border-radius: 24rpx;
  background: #fff;
  box-shadow: 0 10rpx 28rpx rgba(15, 23, 42, 0.04);
}

.identity-title {
  display: block;
  font-size: 28rpx;
  font-weight: 700;
  color: #0f172a;
}

.identity-desc {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  line-height: 1.5;
  color: #64748b;
}

.status-pill {
  flex-shrink: 0;
  padding: 8rpx 16rpx;
  border-radius: 999rpx;
  background: #f1f5f9;
  color: #64748b;
  font-size: 22rpx;
}

.status-pill.bound {
  background: #e8f7ef;
  color: #16a34a;
}

.mini-btn {
  flex-shrink: 0;
  min-width: 132rpx;
  height: 64rpx;
  margin: 0;
  padding: 0 20rpx;
  border-radius: 18rpx;
  font-size: 24rpx;
  line-height: 64rpx;
}

.mini-btn::after,
.code-btn::after {
  border: none;
}

.mini-btn.primary {
  color: #fff;
  background: #1e4dff;
}

.mini-btn.secondary {
  color: #334155;
  background: #f8fafc;
  border: 1rpx solid #cbd5e1;
}

.email-card {
  display: block;
}

.email-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20rpx;
}

.email-form {
  margin-top: 22rpx;
}

.code-row {
  display: flex;
  gap: 16rpx;
  align-items: center;
  margin-top: 16rpx;
}

.code-input {
  flex: 1;
}

.code-btn {
  height: 88rpx;
  min-width: 176rpx;
  margin: 0;
  padding: 0 18rpx;
  border-radius: 18rpx;
  background: #eef3ff;
  color: #1e4dff;
  font-size: 24rpx;
  line-height: 88rpx;
}
</style>
