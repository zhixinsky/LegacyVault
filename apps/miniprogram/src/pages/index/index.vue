<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app';
import { ref } from 'vue';
import { getToken, vaultSession } from '@/utils/api';
import {
  getProfile,
  heartbeat,
  listFiles,
  listTrustedContacts,
  listVaultItems,
} from '@/utils/services';

const loading = ref(false);
const totalItems = ref(0);
const contactCount = ref(0);
const lastLoginText = ref('今天');
const lastSyncText = ref('刚刚');
const securityScore = ref(92);

const coreEntries = [
  {
    title: '账号密码',
    desc: '登录凭据加密保存',
    url: '/pages/passwords/passwords',
    tone: 'blue',
    icon: 'password',
  },
  {
    title: '私密相册',
    desc: '照片视频安全归档',
    url: '/pages/albums/albums',
    tone: 'purple',
    icon: 'album',
  },
  {
    title: '文件保险箱',
    desc: '重要文件本地加密',
    url: '/pages/upload-file/upload-file',
    tone: 'cyan',
    icon: 'file',
  },
  {
    title: '安全联系人',
    desc: '授权联系人可验证接管',
    url: '/pages/trusted-contacts/trusted-contacts',
    tone: 'green',
    icon: 'contact',
  },
];

const tools = [
  { title: '数据导出', url: '/pages/export/export' },
  { title: '回收站', url: '/pages/recycle-bin/recycle-bin' },
  { title: '登录记录', url: '/pages/login-history/login-history' },
  { title: '个人资料', url: '/pages/profile/profile', tab: true },
];

onShow(() => {
  void guardAndLoad();
});

async function guardAndLoad() {
  const token = getToken();
  if (!token) {
    uni.reLaunch({ url: '/pages/login/login' });
    return;
  }

  if (!vaultSession.getVaultKey()) {
    try {
      const profile = await getProfile();
      uni.reLaunch({
        url: profile.hasVault ? '/pages/unlock-vault/unlock-vault' : '/pages/create-vault-password/create-vault-password',
      });
    } catch {
      uni.reLaunch({ url: '/pages/login/login' });
    }
    return;
  }

  void loadDashboard();
}

async function loadDashboard() {
  loading.value = true;
  try {
    const [profile, vaultResult, fileResult, contactResult] = await Promise.all([
      getProfile(),
      listVaultItems(),
      listFiles(),
      listTrustedContacts(),
      heartbeat().catch(() => undefined),
    ]);

    totalItems.value = vaultResult.total + fileResult.total;
    contactCount.value = contactResult.total;
    lastLoginText.value = profile.lastLoginAt ? formatRelativeTime(profile.lastLoginAt) : '今天';
    lastSyncText.value = '刚刚';
    securityScore.value = computeSecurityScore(profile.mfaEnabled, contactResult.total);
  } catch {
    lastSyncText.value = '刚刚';
  } finally {
    loading.value = false;
  }
}

function computeSecurityScore(mfaEnabled: boolean, contacts: number) {
  let score = 82;
  if (mfaEnabled) score += 8;
  if (contacts > 0) score += 6;
  if (contacts >= 2) score += 4;
  return Math.min(score, 98);
}

function formatRelativeTime(value: string) {
  const date = new Date(value);
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  return sameDay ? `今天 ${time}` : `${date.getMonth() + 1}月${date.getDate()}日 ${time}`;
}

function go(url: string, tab = false) {
  if (tab) {
    uni.switchTab({ url });
    return;
  }
  uni.navigateTo({ url });
}
</script>

<template>
  <view class="home-page tabbar-page">
    <view class="brand-card">
      <view class="brand-top">
        <view>
          <text class="brand-name">VaultPass</text>
          <text class="brand-subtitle">安全存储 · 数字传承</text>
        </view>
        <view class="brand-mark">
          <view class="mark-shield" />
        </view>
      </view>

      <view class="vault-summary">
        <text class="summary-label">我的保险箱</text>
        <text class="summary-title">已开启零知识加密</text>
        <view class="summary-row">
          <text>已存储 {{ totalItems }} 项资料</text>
          <text>最近同步：{{ lastSyncText }}</text>
        </view>
      </view>
    </view>

    <view class="security-panel">
      <view class="security-item">
        <text class="security-value">{{ securityScore }}</text>
        <text class="security-label">安全评分</text>
      </view>
      <view class="security-divider" />
      <view class="security-copy">
        <text class="security-title">所有内容已加密存储</text>
        <text class="security-desc">只有你和授权联系人可以访问</text>
      </view>
    </view>

    <view class="section">
      <view class="section-header">
        <text class="section-title">核心入口</text>
        <text class="section-note">高频安全操作</text>
      </view>
      <view class="core-grid">
        <view
          v-for="item in coreEntries"
          :key="item.url"
          class="core-card"
          @tap="go(item.url)"
        >
          <view class="line-icon" :class="[item.tone, item.icon]">
            <view class="icon-shape" />
          </view>
          <text class="core-title">{{ item.title }}</text>
          <text class="core-desc">{{ item.desc }}</text>
        </view>
      </view>
    </view>

    <view class="status-card">
      <view class="section-header compact">
        <text class="section-title">安全状态</text>
        <text v-if="loading" class="section-note">同步中</text>
      </view>
      <view class="status-row">
        <text class="status-label">数字传承状态</text>
        <text class="status-value safe">未触发</text>
      </view>
      <view class="status-row">
        <text class="status-label">安全联系人</text>
        <text class="status-value">{{ contactCount }}人</text>
      </view>
      <view class="status-row">
        <text class="status-label">上次登录</text>
        <text class="status-value">{{ lastLoginText }}</text>
      </view>
      <text class="status-footnote">安全联系人未触发，保险箱保持主动保护状态。</text>
    </view>

    <view class="tools-card">
      <view class="section-header compact">
        <text class="section-title">更多工具</text>
        <text class="section-note">低频管理</text>
      </view>
      <view class="tool-list">
        <view
          v-for="tool in tools"
          :key="tool.url"
          class="tool-item"
          @tap="go(tool.url, tool.tab)"
        >
          <text>{{ tool.title }}</text>
          <text class="tool-arrow">›</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
@import '@/uni.scss';

.home-page {
  min-height: 100vh;
  padding: 32rpx;
  padding-bottom: 56rpx;
  background: #f6f8fc;
  box-sizing: border-box;
}

.brand-card {
  padding: 40rpx;
  border-radius: 40rpx;
  background:
    radial-gradient(circle at 85% 12%, rgba(30, 77, 255, 0.42), transparent 36%),
    linear-gradient(135deg, #0b1f4d 0%, #123a8c 52%, #1e4dff 100%);
  box-shadow: 0 24rpx 56rpx rgba(11, 31, 77, 0.24);
  color: #fff;
}

.brand-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.brand-name {
  display: block;
  font-size: 40rpx;
  font-weight: 800;
  letter-spacing: 1rpx;
}

.brand-subtitle {
  display: block;
  margin-top: 12rpx;
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.72);
}

.brand-mark {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 88rpx;
  height: 88rpx;
  border-radius: 28rpx;
  background: rgba(255, 255, 255, 0.14);
  border: 1rpx solid rgba(255, 255, 255, 0.2);
}

.mark-shield {
  width: 38rpx;
  height: 46rpx;
  border: 4rpx solid rgba(255, 255, 255, 0.95);
  border-top-left-radius: 20rpx;
  border-top-right-radius: 20rpx;
  border-bottom-left-radius: 24rpx;
  border-bottom-right-radius: 24rpx;
  transform: perspective(60rpx) rotateX(10deg);
}

.vault-summary {
  margin-top: 64rpx;
}

.summary-label {
  display: block;
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.72);
}

.summary-title {
  display: block;
  margin-top: 14rpx;
  font-size: 44rpx;
  font-weight: 800;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  gap: 24rpx;
  margin-top: 28rpx;
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.78);
}

.security-panel,
.status-card,
.tools-card {
  margin-top: 32rpx;
  padding: 32rpx;
  border-radius: 36rpx;
  background: #fff;
  box-shadow: 0 12rpx 32rpx rgba(11, 31, 77, 0.06);
}

.security-panel {
  display: flex;
  align-items: center;
}

.security-item {
  width: 156rpx;
}

.security-value {
  display: block;
  font-size: 52rpx;
  font-weight: 800;
  color: #1e4dff;
}

.security-label,
.security-desc,
.section-note,
.core-desc,
.status-label,
.status-footnote {
  color: #7a879a;
}

.security-label {
  display: block;
  margin-top: 4rpx;
  font-size: 22rpx;
}

.security-divider {
  width: 1rpx;
  height: 76rpx;
  margin: 0 30rpx;
  background: #e7ebf3;
}

.security-copy {
  flex: 1;
}

.security-title {
  display: block;
  font-size: 30rpx;
  font-weight: 700;
  color: #0b1f4d;
}

.security-desc {
  display: block;
  margin-top: 10rpx;
  font-size: 24rpx;
}

.section {
  margin-top: 32rpx;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24rpx;
}

.section-header.compact {
  margin-bottom: 12rpx;
}

.section-title {
  font-size: 32rpx;
  font-weight: 800;
  color: #0b1f4d;
}

.section-note {
  font-size: 24rpx;
}

.core-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 32rpx;
}

.core-card {
  min-height: 192rpx;
  padding: 30rpx;
  border-radius: 36rpx;
  background: #fff;
  box-shadow: 0 12rpx 32rpx rgba(11, 31, 77, 0.07);
  box-sizing: border-box;
}

.line-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 58rpx;
  height: 58rpx;
  border-radius: 20rpx;
  margin-bottom: 24rpx;
}

.line-icon.blue {
  background: rgba(30, 77, 255, 0.1);
  color: #1e4dff;
}

.line-icon.purple {
  background: rgba(124, 58, 237, 0.1);
  color: #7c3aed;
}

.line-icon.cyan {
  background: rgba(8, 145, 178, 0.1);
  color: #0891b2;
}

.line-icon.green {
  background: rgba(22, 163, 74, 0.1);
  color: #16a34a;
}

.icon-shape {
  position: relative;
  width: 30rpx;
  height: 30rpx;
  border: 4rpx solid currentColor;
  box-sizing: border-box;
}

.password .icon-shape {
  border-radius: 50%;
}

.password .icon-shape::after {
  content: '';
  position: absolute;
  left: 24rpx;
  top: 9rpx;
  width: 24rpx;
  height: 4rpx;
  background: currentColor;
  box-shadow: 12rpx 0 0 currentColor;
}

.album .icon-shape {
  border-radius: 8rpx;
}

.album .icon-shape::after {
  content: '';
  position: absolute;
  left: 5rpx;
  bottom: 5rpx;
  width: 18rpx;
  height: 12rpx;
  border-left: 4rpx solid currentColor;
  border-bottom: 4rpx solid currentColor;
  transform: rotate(-35deg);
}

.file .icon-shape {
  border-radius: 6rpx;
}

.file .icon-shape::after {
  content: '';
  position: absolute;
  right: -4rpx;
  top: -4rpx;
  width: 12rpx;
  height: 12rpx;
  border-left: 4rpx solid currentColor;
  border-bottom: 4rpx solid currentColor;
  background: #fff;
}

.contact .icon-shape {
  width: 32rpx;
  height: 20rpx;
  border-radius: 18rpx 18rpx 8rpx 8rpx;
}

.contact .icon-shape::before {
  content: '';
  position: absolute;
  left: 7rpx;
  top: -18rpx;
  width: 14rpx;
  height: 14rpx;
  border: 4rpx solid currentColor;
  border-radius: 50%;
  background: #fff;
}

.core-title {
  display: block;
  font-size: 30rpx;
  font-weight: 800;
  color: #0b1f4d;
}

.core-desc {
  display: block;
  margin-top: 8rpx;
  font-size: 22rpx;
  line-height: 1.45;
}

.status-row,
.tool-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  min-height: 84rpx;
  border-bottom: 1rpx solid #eef1f6;
}

.status-row:last-of-type,
.tool-item:last-child {
  border-bottom: none;
}

.status-label {
  font-size: 26rpx;
}

.status-value {
  font-size: 26rpx;
  font-weight: 700;
  color: #0b1f4d;
}

.status-value.safe {
  color: #16a34a;
}

.status-footnote {
  display: block;
  margin-top: 20rpx;
  padding: 22rpx 24rpx;
  border-radius: 24rpx;
  background: #f6f8fc;
  font-size: 24rpx;
}

.tool-list {
  margin-top: 4rpx;
}

.tool-item {
  font-size: 28rpx;
  color: #0b1f4d;
}

.tool-arrow {
  color: #9aa5b5;
  font-size: 40rpx;
}
</style>
