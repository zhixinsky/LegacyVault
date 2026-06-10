<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app';
import { ref } from 'vue';
import {
  getAuditActionLabel,
  getNotificationChannelLabel,
  getNotificationTypeLabel,
} from '@vaultpass/types';
import { vaultSession } from '@/utils/api';
import { buildRecoveryKeyPayload } from '@/utils/crypto-flow';
import {
  bindWechat,
  disableMfa,
  enableMfa,
  getProfile,
  listAuditLogs,
  listLoginDevices,
  listNotifications,
  revokeLoginDevice,
  setupMfa,
  setupRecoveryKey,
  unbindWechat,
} from '@/utils/services';

const logs = ref<Array<{ id: string; actionLabel: string; riskLevel: string; time: string }>>([]);
const notifications = ref<
  Array<{ id: string; typeLabel: string; channelLabel: string; status: string; time: string }>
>([]);
const mfaEnabled = ref(false);
const wxBound = ref(false);
const recoveryConfigured = ref(false);
const recoveryHint = ref('');
const setupSecret = ref('');
const verifyCode = ref('');
const disableCode = ref('');
const recoveryPassphrase = ref('');
const recoveryConfirm = ref('');
const recoveryHintInput = ref('');
const recoveryMfaCode = ref('');
const devices = ref<Array<{ id: string; deviceName?: string; ip?: string; lastActiveAt: string }>>([]);
const loading = ref(false);
const mfaLoading = ref(false);
const wxLoading = ref(false);
const recoveryLoading = ref(false);

onShow(async () => {
  await Promise.all([loadLogs(), loadProfile(), loadDevices(), loadNotifications()]);
});

async function loadProfile() {
  try {
    const profile = await getProfile();
    mfaEnabled.value = profile.mfaEnabled;
    wxBound.value = profile.wxBound ?? false;
    recoveryConfigured.value = profile.recoveryKeyConfigured ?? false;
    recoveryHint.value = profile.recoveryKeyHint ?? '';
    if (profile.encryptedVaultKeyByRecovery) {
      vaultSession.setRecoveryBundle(profile.encryptedVaultKeyByRecovery);
    }
  } catch {
    // ignore
  }
}

async function loadDevices() {
  try {
    const result = await listLoginDevices();
    devices.value = result.items;
  } catch {
    // ignore
  }
}

async function loadLogs() {
  loading.value = true;
  try {
    const result = await listAuditLogs();
    logs.value = result.items.map((item) => ({
      id: item.id,
      actionLabel: getAuditActionLabel(item.action),
      riskLevel: item.riskLevel,
      time: formatTime(item.createdAt),
    }));
  } catch (error) {
    uni.showToast({
      title: error instanceof Error ? error.message : '加载失败',
      icon: 'none',
    });
  } finally {
    loading.value = false;
  }
}

async function loadNotifications() {
  try {
    const result = await listNotifications();
    notifications.value = result.items.map((item) => ({
      id: item.id,
      typeLabel: getNotificationTypeLabel(item.notificationType),
      channelLabel: getNotificationChannelLabel(item.channel),
      status: item.status,
      time: formatTime(item.createdAt),
    }));
  } catch {
    // ignore
  }
}

function goLoginHistory() {
  uni.navigateTo({ url: '/pages/login-history/login-history' });
}

function formatTime(value: string) {
  const date = new Date(value);
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
}

async function handleSetupMfa() {
  mfaLoading.value = true;
  try {
    const result = await setupMfa();
    setupSecret.value = result.secret;
    uni.showToast({ title: '请用验证器扫码', icon: 'none' });
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '初始化失败', icon: 'none' });
  } finally {
    mfaLoading.value = false;
  }
}

async function handleEnableMfa() {
  if (!setupSecret.value || !verifyCode.value) {
    uni.showToast({ title: '请先生成密钥并输入验证码', icon: 'none' });
    return;
  }
  try {
    await enableMfa(setupSecret.value, verifyCode.value);
    mfaEnabled.value = true;
    setupSecret.value = '';
    verifyCode.value = '';
    uni.showToast({ title: '二次验证已启用', icon: 'success' });
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '启用失败', icon: 'none' });
  }
}

async function handleDisableMfa() {
  if (!disableCode.value) {
    uni.showToast({ title: '请输入验证码', icon: 'none' });
    return;
  }
  try {
    await disableMfa(disableCode.value);
    mfaEnabled.value = false;
    disableCode.value = '';
    uni.showToast({ title: '二次验证已关闭', icon: 'success' });
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '关闭失败', icon: 'none' });
  }
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

async function handleSetupRecovery() {
  if (!recoveryPassphrase.value || recoveryPassphrase.value !== recoveryConfirm.value) {
    uni.showToast({ title: '两次输入的恢复密钥不一致', icon: 'none' });
    return;
  }
  recoveryLoading.value = true;
  try {
    const encryptedVaultKeyByRecovery = await buildRecoveryKeyPayload(recoveryPassphrase.value);
    await setupRecoveryKey(
      {
        encryptedVaultKeyByRecovery,
        recoveryKeyHint: recoveryHintInput.value || undefined,
      },
      recoveryMfaCode.value || undefined,
    );
    vaultSession.setRecoveryBundle(encryptedVaultKeyByRecovery);
    recoveryConfigured.value = true;
    recoveryHint.value = recoveryHintInput.value;
    recoveryPassphrase.value = '';
    recoveryConfirm.value = '';
    uni.showToast({ title: '恢复密钥已保存', icon: 'success' });
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '设置失败', icon: 'none' });
  } finally {
    recoveryLoading.value = false;
  }
}

function handleRevokeDevice(id: string) {
  uni.showModal({
    title: '移除设备',
    content: '确定移除此设备的登录记录？',
    success: async (result) => {
      if (!result.confirm) return;
      try {
        await revokeLoginDevice(id);
        await loadDevices();
        uni.showToast({ title: '设备已移除', icon: 'success' });
      } catch (error) {
        uni.showToast({ title: error instanceof Error ? error.message : '操作失败', icon: 'none' });
      }
    },
  });
}

function handleLogout() {
  uni.showModal({
    title: '退出登录',
    content: '退出后将清除内存中的 vault_key，需重新输入主密码解锁',
    success: (result) => {
      if (result.confirm) {
        vaultSession.logout();
        uni.reLaunch({ url: '/pages/login/login' });
      }
    },
  });
}

function lockVault() {
  vaultSession.clearVaultKey();
  uni.showToast({ title: '已锁定保险箱', icon: 'success' });
  uni.reLaunch({ url: '/pages/setup-password/setup-password?mode=unlock' });
}
</script>

<template>
  <view class="container">
    <view class="card">
      <text class="title">安全中心</text>
      <text class="subtitle">二次验证、微信绑定、恢复密钥与设备管理</text>

      <view class="section">
        <text class="section-title">二次验证 (TOTP)</text>
        <text v-if="mfaEnabled" class="hint success-text">已启用</text>
        <view v-if="!mfaEnabled" class="form">
          <button class="btn btn-primary" :disabled="mfaLoading" @tap="handleSetupMfa">生成验证密钥</button>
          <text v-if="setupSecret" class="hint break-all">密钥：{{ setupSecret }}</text>
          <input v-model="verifyCode" class="input" placeholder="输入 6 位验证码" />
          <button class="btn btn-primary" @tap="handleEnableMfa">确认启用</button>
        </view>
        <view v-else class="form">
          <input v-model="disableCode" class="input" placeholder="输入验证码以关闭" />
          <button class="btn btn-secondary" @tap="handleDisableMfa">关闭二次验证</button>
        </view>
      </view>

      <view class="section">
        <text class="section-title">微信绑定</text>
        <text v-if="wxBound" class="hint success-text">已绑定，可用于快捷登录与 PC 扫码确认</text>
        <button v-if="!wxBound" class="btn btn-primary" :loading="wxLoading" @tap="handleBindWechat">绑定微信</button>
        <button v-else class="btn btn-secondary" :loading="wxLoading" @tap="handleUnbindWechat">解绑微信</button>
      </view>

      <view class="section">
        <text class="section-title">恢复密钥</text>
        <text v-if="recoveryConfigured" class="hint success-text">
          已配置{{ recoveryHint ? `，提示：${recoveryHint}` : '' }}
        </text>
        <view v-else class="form">
          <input v-model="recoveryPassphrase" class="input" password placeholder="设置恢复密钥" />
          <input v-model="recoveryConfirm" class="input" password placeholder="确认恢复密钥" />
          <input v-model="recoveryHintInput" class="input" placeholder="提示语（可选）" />
          <input v-if="mfaEnabled" v-model="recoveryMfaCode" class="input" placeholder="二次验证码" />
          <button class="btn btn-primary" :loading="recoveryLoading" @tap="handleSetupRecovery">保存恢复密钥</button>
        </view>
      </view>

      <view class="section">
        <view class="section-header">
          <text class="section-title">登录记录</text>
          <text class="link" @tap="goLoginHistory">查看全部</text>
        </view>
        <text class="hint">新设备、异地 IP 等登录事件</text>
      </view>

      <view class="section">
        <text class="section-title">安全通知</text>
        <text class="hint">新设备登录、异地 IP 等告警将发送至手机或邮箱</text>
        <view v-if="notifications.length === 0" class="hint">暂无通知记录</view>
        <view v-for="item in notifications" :key="item.id" class="notify-item">
          <text class="notify-title">{{ item.typeLabel }}</text>
          <text class="hint">{{ item.channelLabel }} · {{ item.status }} · {{ item.time }}</text>
        </view>
      </view>

      <view class="section">
        <text class="section-title">登录设备</text>
        <view v-if="devices.length === 0" class="hint">暂无设备记录</view>
        <view v-for="device in devices" :key="device.id" class="device-item">
          <view>
            <text class="device-name">{{ device.deviceName || '未知设备' }}</text>
            <text class="hint">{{ device.ip || '-' }} · {{ formatTime(device.lastActiveAt) }}</text>
          </view>
          <text class="link-danger" @tap="handleRevokeDevice(device.id)">移除</text>
        </view>
      </view>

      <button class="btn btn-secondary" @tap="lockVault">锁定保险箱</button>
      <button class="btn btn-primary" @tap="handleLogout">退出登录</button>
    </view>

    <view class="card">
      <text class="section-title">最近操作审计</text>
      <view v-if="loading" class="empty">加载中...</view>
      <view v-else-if="logs.length === 0" class="empty">暂无审计记录</view>
      <view v-else>
        <view v-for="item in logs" :key="item.id" class="list-item">
          <view>
            <text>{{ item.actionLabel }}</text>
            <text class="hint">{{ item.time }}</text>
          </view>
          <text class="badge">{{ item.riskLevel }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
@import '@/uni.scss';

.section {
  margin: 24rpx 0;
  padding: 24rpx 0;
  border-top: 1rpx solid #e2e8f0;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.section-title {
  font-size: 30rpx;
  font-weight: 600;
}

.link {
  color: #2563eb;
  font-size: 26rpx;
}

.notify-item {
  padding: 12rpx 0;
  border-bottom: 1rpx solid #f1f5f9;
}

.notify-title {
  display: block;
  font-size: 28rpx;
  font-weight: 500;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.input {
  border: 1rpx solid #cbd5e1;
  border-radius: 12rpx;
  padding: 16rpx 24rpx;
  font-size: 28rpx;
}

.device-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16rpx 0;
  border-bottom: 1rpx solid #f1f5f9;
}

.device-name {
  display: block;
  font-size: 28rpx;
  font-weight: 500;
}

.link-danger {
  color: #dc2626;
  font-size: 26rpx;
}

.break-all {
  word-break: break-all;
}

.success-text {
  color: #059669;
}
</style>
