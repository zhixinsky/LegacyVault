<script setup lang="ts">
import { friendlyErrorMessage } from '@/utils/errors';
import { onShow } from '@dcloudio/uni-app';
import { ref } from 'vue';
import {
  getAuditActionLabel,
  getNotificationChannelLabel,
  getNotificationTypeLabel,
} from '@vaultpass/types';
import { vaultSession } from '@/utils/api';
import { buildRecoveryKeyPayload } from '@/utils/crypto-flow';
import { ensureLoggedIn, ensureVaultAccess, isLoggedIn } from '@/utils/access';
import {
  disableMfa,
  enableMfa,
  getProfile,
  listAuditLogs,
  listLoginDevices,
  listNotifications,
  revokeLoginDevice,
  setupMfa,
  setupRecoveryKey,
} from '@/utils/services';
import { setCustomTabBarSelected } from '@/utils/tabbar';

const logs = ref<Array<{ id: string; actionLabel: string; riskLevel: string; time: string }>>([]);
const notifications = ref<
  Array<{ id: string; typeLabel: string; channelLabel: string; status: string; time: string }>
>([]);
const mfaEnabled = ref(false);
const mfaConfigured = ref(false);
const recoveryConfigured = ref(false);
const recoveryHint = ref('');
const setupSecret = ref('');
const otpauthUrl = ref('');
const otpauthQrCode = ref('');
const verifyCode = ref('');
const disableCode = ref('');
const recoveryPassphrase = ref('');
const recoveryConfirm = ref('');
const recoveryHintInput = ref('');
const recoveryMfaCode = ref('');
const devices = ref<Array<{ id: string; deviceName?: string; ip?: string; lastActiveAt: string }>>([]);
const loading = ref(false);
const mfaLoading = ref(false);
const recoveryLoading = ref(false);

onShow(async () => {
  setCustomTabBarSelected(3);
  if (!isLoggedIn()) {
    loading.value = false;
    logs.value = [];
    notifications.value = [];
    devices.value = [];
    mfaEnabled.value = false;
    mfaConfigured.value = false;
    recoveryConfigured.value = false;
    return;
  }
  await Promise.all([loadLogs(), loadProfile(), loadDevices(), loadNotifications()]);
});

async function loadProfile() {
  try {
    const profile = await getProfile();
    mfaEnabled.value = profile.mfaEnabled;
    mfaConfigured.value = profile.mfaConfigured ?? profile.mfaEnabled;
    recoveryConfigured.value = profile.recoveryKeyConfigured ?? false;
    recoveryHint.value = profile.recoveryKeyHint ?? '';
    if (profile.vaultKeyBundle) {
      vaultSession.setKeyBundle(profile.vaultKeyBundle);
    }
    if (profile.encryptedVaultKeyByRecovery) {
      vaultSession.setRecoveryBundle(profile.encryptedVaultKeyByRecovery);
    }
    if (profile.recoverySalt) {
      vaultSession.setRecoverySalt(profile.recoverySalt);
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
      title: friendlyErrorMessage(error, '加载失败'),
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
  if (!ensureLoggedIn('登录后即可查看登录记录。')) return;
  uni.navigateTo({ url: '/pages/login-history/login-history' });
}

function formatTime(value: string) {
  const date = new Date(value);
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
}

async function handleSetupMfa() {
  if (!ensureLoggedIn('登录后即可设置二次验证。')) return;
  mfaLoading.value = true;
  try {
    const result = await setupMfa();
    setupSecret.value = result.secret;
    otpauthUrl.value = result.otpauthUrl;
    otpauthQrCode.value = result.qrCodeDataUrl ?? '';
    uni.showToast({ title: '请用验证器 App 扫码', icon: 'none' });
  } catch (error) {
    uni.showToast({ title: friendlyErrorMessage(error, '初始化失败'), icon: 'none' });
  } finally {
    mfaLoading.value = false;
  }
}

async function handleEnableMfa() {
  if (!ensureLoggedIn('登录后即可启用二次验证。')) return;
  if (!setupSecret.value && !mfaConfigured.value) {
    uni.showToast({ title: '请先生成密钥并输入验证码', icon: 'none' });
    return;
  }
  if (!verifyCode.value) {
    uni.showToast({ title: '请输入验证码', icon: 'none' });
    return;
  }
  try {
    await enableMfa(setupSecret.value || undefined, verifyCode.value);
    mfaEnabled.value = true;
    mfaConfigured.value = true;
    setupSecret.value = '';
    otpauthUrl.value = '';
    otpauthQrCode.value = '';
    verifyCode.value = '';
    uni.showToast({ title: '二次验证已启用', icon: 'success' });
  } catch (error) {
    uni.showToast({ title: friendlyErrorMessage(error, '启用失败'), icon: 'none' });
  }
}

async function handleDisableMfa() {
  if (!ensureLoggedIn('登录后即可关闭二次验证。')) return;
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
    uni.showToast({ title: friendlyErrorMessage(error, '关闭失败'), icon: 'none' });
  }
}

async function handleSetupRecovery() {
  if (!(await ensureVaultAccess('登录并解锁后即可设置恢复密钥。'))) return;
  if (!recoveryPassphrase.value || recoveryPassphrase.value !== recoveryConfirm.value) {
    uni.showToast({ title: '两次输入的恢复密钥不一致', icon: 'none' });
    return;
  }
  recoveryLoading.value = true;
  try {
    const recoveryPayload = await buildRecoveryKeyPayload(recoveryPassphrase.value);
    await setupRecoveryKey(
      {
        encryptedVaultKeyByRecovery: recoveryPayload.encryptedVaultKeyByRecovery,
        recoverySalt: recoveryPayload.recoverySalt,
        recoveryKeyHint: recoveryHintInput.value || undefined,
      },
      recoveryMfaCode.value || undefined,
    );
    vaultSession.setRecoveryBundle(recoveryPayload.encryptedVaultKeyByRecovery);
    vaultSession.setRecoverySalt(recoveryPayload.recoverySalt);
    recoveryConfigured.value = true;
    recoveryHint.value = recoveryHintInput.value;
    recoveryPassphrase.value = '';
    recoveryConfirm.value = '';
    uni.showToast({ title: '恢复密钥已保存', icon: 'success' });
  } catch (error) {
    uni.showToast({ title: friendlyErrorMessage(error, '设置失败'), icon: 'none' });
  } finally {
    recoveryLoading.value = false;
  }
}

function handleRevokeDevice(id: string) {
  if (!ensureLoggedIn('登录后即可管理登录设备。')) return;
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
        uni.showToast({ title: friendlyErrorMessage(error, '操作失败'), icon: 'none' });
      }
    },
  });
}

function handleLogout() {
  if (!ensureLoggedIn('当前处于预览模式，无需退出登录。')) return;
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
  if (!ensureLoggedIn('登录后即可锁定保险箱。')) return;
  vaultSession.clearVaultKey();
  uni.showToast({ title: '已锁定保险箱', icon: 'success' });
  uni.reLaunch({ url: '/pages/unlock-vault/unlock-vault' });
}

function copyMfaText(text: string, title: string) {
  if (!text) return;
  uni.setClipboardData({
    data: text,
    success: () => uni.showToast({ title, icon: 'none' }),
    fail: () => uni.showToast({ title: '复制失败，请长按手动复制', icon: 'none' }),
  });
}
</script>

<template>
  <view class="security-page tabbar-page">
    <text class="custom-page-title">安全</text>
    <view class="security-hero">
      <view>
        <text class="eyebrow">Security Center</text>
        <text class="page-title">安全中心</text>
        <text class="page-subtitle">统一管理二次验证、恢复密钥、登录设备与审计记录。</text>
      </view>
      <view class="hero-icon">
        <image src="/static/icons/tabbar/security-active.svg" mode="aspectFit" />
      </view>
    </view>

    <view class="security-stats">
      <view class="stat-card blue">
        <text class="stat-value">{{ mfaEnabled ? '已启用' : '未启用' }}</text>
        <text class="stat-label">二次验证</text>
      </view>
      <view class="stat-card green">
        <text class="stat-value">{{ recoveryConfigured ? '已配置' : '待配置' }}</text>
        <text class="stat-label">恢复密钥</text>
      </view>
      <view class="stat-card amber">
        <text class="stat-value">{{ devices.length }}</text>
        <text class="stat-label">登录设备</text>
      </view>
    </view>

    <view class="security-panel">

      <view class="section">
        <view class="section-heading">
          <view class="section-icon blue">
            <image src="/static/icons/login/shield.svg" mode="aspectFit" />
          </view>
          <view>
            <text class="section-title">二次验证 (TOTP)</text>
            <text class="section-desc">使用验证器 App 为登录增加第二道确认。</text>
          </view>
        </view>
        <text v-if="mfaEnabled" class="status-pill success-text">已启用</text>
        <view v-if="!mfaEnabled" class="form">
          <view v-if="mfaConfigured && !setupSecret" class="mfa-guide">
            <text class="guide-title">已绑定验证器 App</text>
            <text class="guide-text">如果您之前已用 Google Authenticator、Microsoft Authenticator 等 App 扫码绑定过，直接输入当前 6 位验证码即可重新启用。</text>
            <text class="guide-text guide-accent">只有更换手机或想重新绑定时，才需要重新生成二维码。</text>
          </view>
          <view v-else class="mfa-guide">
            <text class="guide-title">使用方式</text>
            <text class="guide-text">点击生成后，打开 Microsoft Authenticator、Google Authenticator、1Password 或 Authy，选择“添加账号/扫描二维码”。</text>
            <text class="guide-text">扫描成功后，验证器 App 会每 30 秒生成一个 6 位验证码，把当前验证码填回本页并确认启用。</text>
            <text class="guide-text guide-accent">如果无法扫码，可以复制手动密钥添加账号。</text>
          </view>
          <button
            v-if="!mfaConfigured || setupSecret"
            class="btn btn-primary"
            :disabled="mfaLoading"
            @tap="handleSetupMfa"
          >
            生成验证密钥
          </button>
          <button
            v-else
            class="btn btn-secondary"
            :disabled="mfaLoading"
            @tap="handleSetupMfa"
          >
            更换验证器 / 重新生成二维码
          </button>
          <view v-if="setupSecret" class="mfa-setup-card">
            <view v-if="otpauthQrCode" class="qr-card">
              <text class="qr-title">使用验证器 App 扫描二维码</text>
              <image class="totp-qr" :src="otpauthQrCode" mode="aspectFit" />
              <text class="hint">二维码仅用于绑定验证器，不是登录二维码，请勿发给他人。</text>
            </view>
            <view class="manual-card">
              <text class="guide-title">手动输入密钥</text>
              <text class="secret-text selectable" selectable>{{ setupSecret }}</text>
              <button class="btn btn-secondary btn-small" @tap="copyMfaText(setupSecret, '密钥已复制')">复制密钥</button>
            </view>
            <view v-if="otpauthUrl" class="manual-card">
              <text class="guide-title">兼容 URI</text>
              <text class="uri-text selectable" selectable>{{ otpauthUrl }}</text>
              <button class="btn btn-secondary btn-small" @tap="copyMfaText(otpauthUrl, 'URI 已复制')">复制 URI</button>
            </view>
          </view>
          <input v-model="verifyCode" class="input" placeholder="输入 6 位验证码" />
          <button class="btn btn-primary" @tap="handleEnableMfa">
            {{ mfaConfigured && !setupSecret ? '重新启用二次验证' : '确认启用' }}
          </button>
        </view>
        <view v-else class="form">
          <input v-model="disableCode" class="input" placeholder="输入验证码以关闭" />
          <button class="btn btn-secondary" @tap="handleDisableMfa">关闭二次验证</button>
        </view>
      </view>

      <view class="section">
        <view class="section-heading">
          <view class="section-icon green">
            <image src="/static/icons/login/backup.svg" mode="aspectFit" />
          </view>
          <view>
            <text class="section-title">恢复密钥</text>
            <text class="section-desc">忘记主密码时用于重新恢复保险箱访问权限。</text>
          </view>
        </view>
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
          <view class="section-heading">
            <view class="section-icon cyan">
              <image src="/static/icons/vault-menu/search.svg" mode="aspectFit" />
            </view>
            <view>
              <text class="section-title">登录记录</text>
              <text class="section-desc">新设备、异地 IP 等登录事件</text>
            </view>
          </view>
          <text class="link" @tap="goLoginHistory">查看全部</text>
        </view>
      </view>

      <view class="section">
        <view class="section-heading">
          <view class="section-icon amber">
            <image src="/static/icons/login/phone-muted.svg" mode="aspectFit" />
          </view>
          <view>
            <text class="section-title">安全通知</text>
            <text class="section-desc">新设备登录、异地 IP 等告警将发送至手机或邮箱。</text>
          </view>
        </view>
        <view v-if="notifications.length === 0" class="hint">暂无通知记录</view>
        <view v-for="item in notifications" :key="item.id" class="notify-item">
          <text class="notify-title">{{ item.typeLabel }}</text>
          <text class="hint">{{ item.channelLabel }} · {{ item.status }} · {{ item.time }}</text>
        </view>
      </view>

      <view class="section">
        <view class="section-heading">
          <view class="section-icon violet">
            <image src="/static/icons/login/private-control.svg" mode="aspectFit" />
          </view>
          <view>
            <text class="section-title">登录设备</text>
            <text class="section-desc">查看并移除不再使用的设备。</text>
          </view>
        </view>
        <view v-if="devices.length === 0" class="hint">暂无设备记录</view>
        <view v-for="device in devices" :key="device.id" class="device-item">
          <view>
            <text class="device-name">{{ device.deviceName || '未知设备' }}</text>
            <text class="hint">{{ device.ip || '-' }} · {{ formatTime(device.lastActiveAt) }}</text>
          </view>
          <text class="link-danger" @tap="handleRevokeDevice(device.id)">移除</text>
        </view>
      </view>

      <view class="action-grid">
        <button class="btn btn-secondary" @tap="lockVault">锁定保险箱</button>
        <button class="btn btn-primary" @tap="handleLogout">退出登录</button>
      </view>
    </view>

    <view class="audit-panel">
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

.security-page {
  min-height: 100vh;
  padding: 32rpx 30rpx 160rpx;
  background:
    radial-gradient(circle at 10% 8%, rgba(30, 77, 255, 0.14), transparent 32%),
    radial-gradient(circle at 92% 18%, rgba(245, 158, 11, 0.11), transparent 30%),
    linear-gradient(180deg, #f6faff 0%, #eef6ff 48%, #f8fafc 100%);
  box-sizing: border-box;
}

.security-hero,
.security-panel,
.audit-panel,
.stat-card {
  border: 1rpx solid rgba(226, 232, 240, 0.76);
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 16rpx 38rpx rgba(11, 31, 77, 0.07);
}

.security-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 36rpx;
  border-radius: 38rpx;
}

.eyebrow {
  display: block;
  color: #1e4dff;
  font-size: 22rpx;
  font-weight: 700;
}

.page-title {
  display: block;
  margin-top: 10rpx;
  color: #0b1f4d;
  font-size: 44rpx;
  font-weight: 700;
}

.page-subtitle {
  display: block;
  max-width: 470rpx;
  margin-top: 14rpx;
  color: #64748b;
  font-size: 25rpx;
  line-height: 1.55;
}

.hero-icon {
  display: flex;
  width: 104rpx;
  height: 104rpx;
  flex: 0 0 104rpx;
  align-items: center;
  justify-content: center;
  border-radius: 34rpx;
  background: #eef5ff;
}

.hero-icon image {
  width: 72rpx;
  height: 72rpx;
}

.security-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14rpx;
  margin-top: 24rpx;
}

.stat-card {
  min-height: 112rpx;
  padding: 20rpx 16rpx;
  border-radius: 26rpx;
  box-sizing: border-box;
}

.stat-card.blue { background: linear-gradient(135deg, #ffffff, #eef5ff); }
.stat-card.green { background: linear-gradient(135deg, #ffffff, #ecfdf5); }
.stat-card.amber { background: linear-gradient(135deg, #ffffff, #fff7ed); }

.stat-value,
.stat-label {
  display: block;
  text-align: center;
}

.stat-value {
  color: #0b1f4d;
  font-size: 26rpx;
  font-weight: 700;
}

.stat-label {
  margin-top: 8rpx;
  color: #64748b;
  font-size: 22rpx;
}

.security-panel,
.audit-panel {
  margin-top: 28rpx;
  padding: 30rpx;
  border-radius: 34rpx;
}

.section {
  margin: 24rpx 0;
  padding: 26rpx;
  border: 1rpx solid #eef2f7;
  border-radius: 28rpx;
  background: #fff;
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
  display: block;
  font-size: 30rpx;
  font-weight: 700;
  color: #0b1f4d;
}

.section-desc {
  display: block;
  margin-top: 6rpx;
  color: #64748b;
  font-size: 23rpx;
  line-height: 1.45;
}

.section-heading {
  display: flex;
  align-items: flex-start;
  gap: 18rpx;
}

.section-icon {
  display: flex;
  width: 66rpx;
  height: 66rpx;
  flex: 0 0 66rpx;
  align-items: center;
  justify-content: center;
  border-radius: 22rpx;
}

.section-icon image {
  width: 44rpx;
  height: 44rpx;
}

.section-icon.blue { background: #eef5ff; }
.section-icon.green { background: #ecfdf5; }
.section-icon.cyan { background: #ecfeff; }
.section-icon.amber { background: #fff7ed; }
.section-icon.violet { background: #f5f3ff; }

.status-pill {
  align-self: flex-start;
  padding: 8rpx 16rpx;
  border-radius: 999rpx;
  background: #ecfdf5;
  font-size: 22rpx;
  font-weight: 700;
}

.link {
  color: #2563eb;
  font-size: 26rpx;
  flex-shrink: 0;
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
  border: 1rpx solid #dbe4f0;
  border-radius: 20rpx;
  background: #f8fbff;
  padding: 16rpx 24rpx;
  font-size: 28rpx;
}

.mfa-guide {
  padding: 24rpx;
  border: 1rpx solid #bfdbfe;
  border-radius: 24rpx;
  background: #eff6ff;
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.guide-title {
  font-size: 26rpx;
  font-weight: 600;
  color: #0f172a;
}

.guide-text {
  font-size: 24rpx;
  line-height: 1.6;
  color: #475569;
}

.guide-accent {
  color: #1d4ed8;
}

.mfa-setup-card {
  padding: 20rpx;
  border: 1rpx solid #e2e8f0;
  border-radius: 24rpx;
  background: #f8fafc;
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.qr-card {
  padding: 24rpx;
  border: 1rpx solid #e2e8f0;
  border-radius: 24rpx;
  background: #fff;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16rpx;
}

.qr-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #0f172a;
}

.totp-qr {
  width: 360rpx;
  height: 360rpx;
  padding: 16rpx;
  border: 1rpx solid #f1f5f9;
  border-radius: 20rpx;
  background: #fff;
}

.manual-card {
  padding: 20rpx;
  border-radius: 20rpx;
  background: #fff;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.secret-text,
.uri-text {
  font-family: monospace;
  word-break: break-all;
  color: #0f172a;
}

.secret-text {
  font-size: 26rpx;
}

.uri-text {
  font-size: 22rpx;
  color: #64748b;
}

.btn-small {
  margin-top: 4rpx;
}

.device-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 18rpx 0;
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

.action-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 18rpx;
  margin-top: 8rpx;
}

.action-grid .btn {
  margin: 0;
}

.badge {
  border-radius: 999rpx;
  background: #eef5ff;
  color: #1e4dff;
}

/* Refined compact mobile style */
.security-page {
  padding: 108rpx 24rpx 132rpx;
  background: #f6f8fb;
}

.security-hero,
.security-panel,
.audit-panel,
.stat-card,
.section {
  border-color: #e6ebf2;
  background: #fff;
  box-shadow: 0 8rpx 24rpx rgba(15, 23, 42, 0.04);
}

.security-hero {
  padding: 26rpx;
  border-radius: 24rpx;
  border-color: transparent;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.94), rgba(245, 249, 252, 0.96)),
    #f6f8fb;
  box-shadow: 0 10rpx 28rpx rgba(15, 23, 42, 0.05);
}

.eyebrow {
  font-size: 20rpx;
  font-weight: 600;
}

.page-title {
  margin-top: 8rpx;
  font-size: 36rpx;
  font-weight: 650;
}

.page-subtitle {
  max-width: 500rpx;
  margin-top: 8rpx;
  font-size: 23rpx;
  line-height: 1.45;
}

.hero-icon {
  width: 68rpx;
  height: 68rpx;
  flex-basis: 68rpx;
  border-radius: 20rpx;
  background: rgba(255, 255, 255, 0.72);
  box-shadow: none;
}

.hero-icon image {
  width: 44rpx;
  height: 44rpx;
}

.security-stats {
  gap: 10rpx;
  margin-top: 16rpx;
}

.stat-card {
  min-height: 88rpx;
  padding: 15rpx 10rpx;
  border-radius: 18rpx;
}

.stat-card.blue,
.stat-card.green,
.stat-card.amber {
  background: #fff;
}

.stat-value {
  font-size: 24rpx;
  font-weight: 650;
}

.stat-label {
  margin-top: 5rpx;
  font-size: 20rpx;
}

.security-panel,
.audit-panel {
  margin-top: 18rpx;
  padding: 18rpx;
  border-radius: 24rpx;
}

.section {
  margin: 12rpx 0;
  padding: 20rpx;
  border-radius: 20rpx;
  gap: 12rpx;
}

.section-heading {
  gap: 14rpx;
}

.section-icon {
  width: 48rpx;
  height: 48rpx;
  flex-basis: 48rpx;
  border-radius: 15rpx;
}

.section-icon image {
  width: 32rpx;
  height: 32rpx;
}

.section-title {
  font-size: 27rpx;
  font-weight: 650;
}

.section-desc {
  margin-top: 4rpx;
  font-size: 21rpx;
}

.status-pill {
  padding: 5rpx 12rpx;
  font-size: 20rpx;
  font-weight: 600;
}

.form {
  gap: 12rpx;
}

.input {
  border-radius: 16rpx;
  padding: 13rpx 18rpx;
  font-size: 25rpx;
}

.mfa-guide,
.mfa-setup-card,
.qr-card,
.manual-card {
  border-radius: 18rpx;
}

.mfa-guide {
  padding: 18rpx;
}

.guide-title,
.device-name {
  font-size: 25rpx;
  font-weight: 600;
}

.guide-text {
  font-size: 22rpx;
}

.notify-title {
  font-size: 25rpx;
}

.device-item {
  padding: 14rpx 0;
}

.link,
.link-danger {
  font-size: 24rpx;
}

.action-grid {
  gap: 12rpx;
}

.totp-qr {
  width: 300rpx;
  height: 300rpx;
}
</style>
