<script setup lang="ts">
import { friendlyErrorMessage } from '@/utils/errors';
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
import { ensureLoggedIn, isLoggedIn } from '@/utils/access';
import { setCustomTabBarSelected } from '@/utils/tabbar';

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

onShow(() => {
  setCustomTabBarSelected(4);
  if (!isLoggedIn()) {
    loading.value = false;
    username.value = '游客';
    phone.value = '';
    email.value = '';
    emailInput.value = '';
    wxBound.value = false;
    mfaEnabled.value = false;
    createdAt.value = '登录后显示';
    lastLoginAt.value = '登录后显示';
    return;
  }
  void loadProfile();
});

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
      title: friendlyErrorMessage(error, '加载失败'),
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
  if (!ensureLoggedIn('登录后即可绑定微信身份。')) return;
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
    uni.showToast({ title: friendlyErrorMessage(error, '绑定失败'), icon: 'none' });
  } finally {
    wxLoading.value = false;
  }
}

function handleUnbindWechat() {
  if (!ensureLoggedIn('登录后即可解绑微信身份。')) return;
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
        uni.showToast({ title: friendlyErrorMessage(error, '解绑失败'), icon: 'none' });
      } finally {
        wxLoading.value = false;
      }
    },
  });
}

async function handleBindPhone(event: { detail?: { code?: string; errMsg?: string } }) {
  if (!ensureLoggedIn('登录后即可绑定手机号。')) return;
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
      title: friendlyErrorMessage(error, '绑定失败'),
      icon: 'none',
    });
  } finally {
    phoneLoading.value = false;
  }
}

async function handleSendEmailCode() {
  if (!ensureLoggedIn('登录后即可绑定邮箱。')) return;
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
    uni.showToast({ title: friendlyErrorMessage(error, '发送失败'), icon: 'none' });
  } finally {
    sendingEmailCode.value = false;
  }
}

async function handleBindEmail() {
  if (!ensureLoggedIn('登录后即可绑定邮箱。')) return;
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
    uni.showToast({ title: friendlyErrorMessage(error, '绑定失败'), icon: 'none' });
  } finally {
    emailLoading.value = false;
  }
}

function goSecurity() {
  uni.switchTab({ url: '/pages/security/security' });
}
</script>

<template>
  <view class="profile-page tabbar-page">
    <text class="custom-page-title">我的</text>
    <view class="profile-hero">
      <view class="avatar">
        <image src="/static/icons/tabbar/profile-active.svg" mode="aspectFit" />
      </view>
      <view class="hero-copy">
        <text class="eyebrow">Account Center</text>
        <text class="page-title">我的账号</text>
        <text class="page-subtitle">管理登录身份、联系方式和安全验证状态。</text>
      </view>
    </view>

    <view class="profile-card">
      <text v-if="loading" class="hint">加载中...</text>

      <template v-else>
        <view class="identity-card">
          <view class="identity-icon blue">
            <image src="/static/icons/login/login.svg" mode="aspectFit" />
          </view>
          <view>
            <text class="identity-title">用户名</text>
            <text class="identity-desc">{{ username || '未设置' }}</text>
          </view>
          <text class="status-pill bound">已启用</text>
        </view>

        <view class="identity-card">
          <view class="identity-icon green">
            <image src="/static/icons/login/wechat.svg" mode="aspectFit" />
          </view>
          <view>
            <text class="identity-title">微信</text>
            <text class="identity-desc">{{ wxBound ? '已绑定，可用于快捷登录与扫码确认' : '未绑定，建议立即绑定' }}</text>
          </view>
          <button v-if="!wxBound" class="mini-btn primary" :loading="wxLoading" @tap="handleBindWechat">绑定微信</button>
          <button v-else class="mini-btn secondary" :loading="wxLoading" @tap="handleUnbindWechat">解绑</button>
        </view>

        <view class="identity-card">
          <view class="identity-icon cyan">
            <image src="/static/icons/login/phone.svg" mode="aspectFit" />
          </view>
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
            <view class="identity-icon amber">
              <image src="/static/icons/login/backup.svg" mode="aspectFit" />
            </view>
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
          <view class="info-item">
            <text class="info-label">二次验证</text>
            <text class="info-value">{{ mfaEnabled ? '已启用' : '未启用' }}</text>
          </view>
          <view class="info-item">
            <text class="info-label">注册时间</text>
            <text class="info-value">{{ createdAt }}</text>
          </view>
          <view class="info-item">
            <text class="info-label">最近登录</text>
            <text class="info-value">{{ lastLoginAt }}</text>
          </view>
        </view>

        <button class="security-btn" @tap="goSecurity">前往安全中心</button>
      </template>
    </view>
  </view>
</template>

<style scoped lang="scss">
@import '@/uni.scss';

.profile-page {
  min-height: 100vh;
  padding: 32rpx 30rpx 160rpx;
  background:
    radial-gradient(circle at 16% 4%, rgba(30, 77, 255, 0.13), transparent 32%),
    radial-gradient(circle at 92% 18%, rgba(34, 197, 94, 0.1), transparent 30%),
    linear-gradient(180deg, #f5f9ff 0%, #eef6ff 48%, #f8fafc 100%);
  box-sizing: border-box;
}

.profile-hero {
  display: flex;
  align-items: center;
  gap: 24rpx;
  padding: 34rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.82);
  border-radius: 38rpx;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 18rpx 46rpx rgba(11, 31, 77, 0.08);
}

.avatar {
  display: flex;
  width: 112rpx;
  height: 112rpx;
  flex: 0 0 112rpx;
  align-items: center;
  justify-content: center;
  border-radius: 36rpx;
  background: linear-gradient(135deg, #eaf2ff, #eefdf7);
}

.avatar image {
  width: 74rpx;
  height: 74rpx;
}

.hero-copy {
  min-width: 0;
  flex: 1;
}

.eyebrow {
  display: block;
  color: #1e4dff;
  font-size: 22rpx;
  font-weight: 700;
}

.page-title {
  display: block;
  margin-top: 8rpx;
  color: #0b1f4d;
  font-size: 42rpx;
  font-weight: 700;
}

.page-subtitle {
  display: block;
  margin-top: 10rpx;
  color: #64748b;
  font-size: 24rpx;
  line-height: 1.5;
}

.profile-card {
  margin-top: 28rpx;
  padding: 12rpx 0 0;
}

.info-box {
  margin-top: 30rpx;
  padding: 24rpx;
  border: 1rpx solid rgba(226, 232, 240, 0.78);
  border-radius: 28rpx;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 12rpx 30rpx rgba(11, 31, 77, 0.05);
}

.info-item {
  display: flex;
  justify-content: space-between;
  gap: 20rpx;
  padding: 16rpx 0;
  border-bottom: 1rpx solid #eef2f7;
}

.info-item:last-child {
  border-bottom: none;
}

.info-label,
.info-value {
  font-size: 26rpx;
}

.info-label {
  color: #475569;
}

.info-value {
  color: #0b1f4d;
  font-weight: 600;
  text-align: right;
}

.security-btn {
  height: 88rpx;
  margin-top: 20rpx;
  border-radius: 24rpx;
  background: linear-gradient(135deg, #377dff, #1e4dff);
  color: #fff;
  font-size: 28rpx;
  font-weight: 700;
  line-height: 88rpx;
}

.security-btn::after {
  border: none;
}

.identity-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  margin-top: 24rpx;
  padding: 28rpx;
  border: 1rpx solid #e2e8f0;
  border-radius: 30rpx;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 14rpx 34rpx rgba(11, 31, 77, 0.06);
}

.identity-card > view:not(.identity-icon) {
  min-width: 0;
  flex: 1;
}

.identity-icon {
  display: flex;
  width: 72rpx;
  height: 72rpx;
  flex: 0 0 72rpx;
  align-items: center;
  justify-content: center;
  border-radius: 24rpx;
}

.identity-icon image {
  width: 48rpx;
  height: 48rpx;
}

.identity-icon.blue { background: #eef5ff; }
.identity-icon.green { background: #ecfdf5; }
.identity-icon.cyan { background: #ecfeff; }
.identity-icon.amber { background: #fff7ed; }

.email-head {
  display: flex;
  align-items: flex-start;
  gap: 18rpx;
}

.identity-title {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
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
  background: linear-gradient(135deg, #377dff, #1e4dff);
}

.mini-btn.secondary {
  color: #334155;
  background: #f8fafc;
  border: 1rpx solid #cbd5e1;
}

.email-card {
  display: block;
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

/* Refined compact mobile style */
.profile-page {
  padding: 108rpx 24rpx 132rpx;
  background: #f6f8fb;
}

.profile-hero,
.identity-card,
.info-box {
  border-color: #e6ebf2;
  background: #fff;
  box-shadow: 0 8rpx 24rpx rgba(15, 23, 42, 0.04);
}

.profile-hero {
  gap: 18rpx;
  padding: 26rpx;
  border-radius: 24rpx;
  border-color: transparent;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.94), rgba(245, 249, 252, 0.96)),
    #f6f8fb;
  box-shadow: 0 10rpx 28rpx rgba(15, 23, 42, 0.05);
}

.avatar {
  width: 72rpx;
  height: 72rpx;
  flex-basis: 72rpx;
  border-radius: 22rpx;
  background: rgba(255, 255, 255, 0.72);
  box-shadow: none;
}

.avatar image {
  width: 46rpx;
  height: 46rpx;
}

.eyebrow {
  font-size: 20rpx;
  font-weight: 600;
}

.page-title {
  margin-top: 6rpx;
  font-size: 36rpx;
  font-weight: 650;
}

.page-subtitle {
  margin-top: 6rpx;
  font-size: 23rpx;
}

.profile-card {
  margin-top: 12rpx;
}

.identity-card {
  gap: 14rpx;
  margin-top: 12rpx;
  padding: 20rpx;
  border-radius: 20rpx;
}

.identity-icon {
  width: 48rpx;
  height: 48rpx;
  flex-basis: 48rpx;
  border-radius: 15rpx;
}

.identity-icon image {
  width: 32rpx;
  height: 32rpx;
}

.identity-title {
  font-size: 26rpx;
  font-weight: 600;
}

.identity-desc {
  margin-top: 4rpx;
  font-size: 21rpx;
}

.status-pill {
  padding: 5rpx 12rpx;
  font-size: 20rpx;
}

.mini-btn {
  min-width: 112rpx;
  height: 56rpx;
  border-radius: 16rpx;
  font-size: 22rpx;
  line-height: 56rpx;
}

.email-head {
  gap: 14rpx;
}

.email-form {
  margin-top: 16rpx;
}

.code-row {
  gap: 10rpx;
  margin-top: 10rpx;
}

.code-btn {
  height: 76rpx;
  min-width: 152rpx;
  border-radius: 16rpx;
  font-size: 22rpx;
  line-height: 76rpx;
}

.info-box {
  margin-top: 16rpx;
  padding: 18rpx;
  border-radius: 20rpx;
}

.info-item {
  padding: 13rpx 0;
}

.info-label,
.info-value {
  font-size: 24rpx;
}

.security-btn {
  height: 78rpx;
  margin-top: 16rpx;
  border-radius: 18rpx;
  font-size: 26rpx;
  font-weight: 650;
  line-height: 78rpx;
}
</style>
