<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app';
import { ref } from 'vue';
import { getProfile, updateProfile } from '@/utils/services';

const loading = ref(false);
const saving = ref(false);
const phone = ref('');
const email = ref('');
const wxBound = ref(false);
const mfaEnabled = ref(false);
const createdAt = ref('');
const lastLoginAt = ref('');

onShow(loadProfile);

async function loadProfile() {
  loading.value = true;
  try {
    const profile = await getProfile();
    phone.value = profile.phone ?? '';
    email.value = profile.email ?? '';
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

async function handleSave() {
  const payload: { phone?: string; email?: string } = {};
  if (phone.value.trim()) {
    if (!/^1\d{10}$/.test(phone.value.trim())) {
      uni.showToast({ title: '手机号格式不正确', icon: 'none' });
      return;
    }
    payload.phone = phone.value.trim();
  }
  if (email.value.trim()) {
    payload.email = email.value.trim();
  }

  if (!payload.phone && !payload.email) {
    uni.showToast({ title: '请至少填写手机号或邮箱', icon: 'none' });
    return;
  }

  saving.value = true;
  try {
    const profile = await updateProfile(payload);
    phone.value = profile.phone ?? '';
    email.value = profile.email ?? '';
    uni.showToast({ title: '资料已保存', icon: 'success' });
  } catch (error) {
    uni.showToast({
      title: error instanceof Error ? error.message : '保存失败',
      icon: 'none',
    });
  } finally {
    saving.value = false;
  }
}

function goSecurity() {
  uni.navigateTo({ url: '/pages/security/security' });
}
</script>

<template>
  <view class="container">
    <view class="card">
      <text class="title">个人资料</text>
      <text class="subtitle">管理账号联系方式</text>

      <text v-if="loading" class="hint">加载中...</text>

      <template v-else>
        <text class="field-label">手机号</text>
        <input v-model="phone" class="input" type="number" maxlength="11" placeholder="11 位手机号" />

        <text class="field-label">邮箱</text>
        <input v-model="email" class="input" type="text" placeholder="可选" />

        <view class="info-box">
          <text class="info-line">微信绑定：{{ wxBound ? '已绑定' : '未绑定' }}</text>
          <text class="info-line">二次验证：{{ mfaEnabled ? '已启用' : '未启用' }}</text>
          <text class="info-line">注册时间：{{ createdAt }}</text>
          <text class="info-line">最近登录：{{ lastLoginAt }}</text>
        </view>

        <button class="btn btn-primary" :loading="saving" @tap="handleSave">保存资料</button>
        <button class="btn btn-secondary" @tap="goSecurity">前往安全中心（微信/MFA）</button>
      </template>
    </view>
  </view>
</template>

<style scoped lang="scss">
@import '@/uni.scss';

.info-box {
  margin-top: 28rpx;
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
</style>
