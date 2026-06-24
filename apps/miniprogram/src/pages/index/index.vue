<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app';
import { ref } from 'vue';
import {
  getProfile,
  heartbeat,
  listAlbums,
  listFiles,
  listTrustedContacts,
  listVaultItems,
} from '@/utils/services';
import { isLoggedIn, isVaultUnlocked } from '@/utils/access';
import { setCustomTabBarSelected } from '@/utils/tabbar';

const loading = ref(false);
const totalItems = ref(0);
const contactCount = ref(0);
const lastLoginText = ref('今天');
const lastSyncText = ref('刚刚');
const securityScore = ref(92);
const passwordCount = ref(0);
const fileCount = ref(0);
const albumCount = ref(0);
const noteCount = ref(0);
const homeHeroImage =
  'cloud://prod-d4g8kpg7x92d55205.7072-prod-d4g8kpg7x92d55205-1441616383/img/home.webp';
const inheritanceImage =
  'cloud://prod-d4g8kpg7x92d55205.7072-prod-d4g8kpg7x92d55205-1441616383/img/yc.webp';

const coreEntries = [
  {
    title: '账号密码',
    desc: '登录凭据管理',
    url: '/pages/passwords/passwords',
    tone: 'blue',
    icon: '/static/icons/vault-menu/password.svg',
  },
  {
    title: '文件保险箱',
    desc: '重要文件集中管理',
    url: '/pages/upload-file/upload-file',
    tone: 'green',
    icon: '/static/icons/vault-menu/files.svg',
  },
  {
    title: '私密相册',
    desc: '照片视频加密归档',
    url: '/pages/albums/albums',
    tone: 'violet',
    icon: '/static/icons/vault-menu/albums.svg',
  },
  {
    title: '私密笔记',
    desc: '文字附件安全记录',
    url: '/pages/notes/notes',
    tone: 'orange',
    icon: '/static/icons/vault-menu/notes.svg',
  },
];

const tools = [
  { title: '数据导出', desc: '本地解密后导出', url: '/pages/export/export', icon: '/static/icons/vault-menu/export.svg' },
  { title: '回收站', desc: '恢复误删内容', url: '/pages/recycle-bin/recycle-bin', icon: '/static/icons/vault-menu/recycle.svg' },
  { title: '登录记录', desc: '查看账号访问历史', url: '/pages/login-history/login-history', icon: '/static/icons/tabbar/security.svg' },
  { title: '个人资料', desc: '身份与绑定管理', url: '/pages/profile/profile', tab: true, icon: '/static/icons/tabbar/profile.svg' },
];

onShow(() => {
  setCustomTabBarSelected(0);
  void loadPreviewOrDashboard();
});

async function loadPreviewOrDashboard() {
  if (!isLoggedIn() || !isVaultUnlocked()) {
    loading.value = false;
    totalItems.value = 0;
    contactCount.value = 0;
    passwordCount.value = 0;
    fileCount.value = 0;
    albumCount.value = 0;
    noteCount.value = 0;
    lastLoginText.value = '预览模式';
    lastSyncText.value = '登录后同步';
    securityScore.value = 88;
    return;
  }

  await loadDashboard();
}

async function loadDashboard() {
  loading.value = true;
  try {
    const [
      profile,
      vaultResult,
      fileResult,
      contactResult,
      passwordResult,
      noteResult,
      albumResult,
    ] = await Promise.all([
      getProfile(),
      listVaultItems(),
      listFiles(),
      listTrustedContacts(),
      listVaultItems('password'),
      listVaultItems('note'),
      listAlbums(),
      heartbeat().catch(() => undefined),
    ]);

    totalItems.value = vaultResult.total + fileResult.total;
    contactCount.value = contactResult.total;
    passwordCount.value = passwordResult.total;
    fileCount.value = fileResult.total;
    albumCount.value = albumResult.total;
    noteCount.value = noteResult.total;
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
  if (tab || isTabBarPage(url)) {
    uni.switchTab({ url });
    return;
  }
  uni.navigateTo({ url });
}

function isTabBarPage(url: string) {
  return ['/pages/index/index', '/pages/vault/vault', '/pages/albums/albums', '/pages/security/security', '/pages/profile/profile'].includes(
    url.split('?')[0],
  );
}
</script>

<template>
  <view class="home-page tabbar-page">
    <view class="hero-section">
      <image
        class="hero-bg-image"
        :src="homeHeroImage"
        mode="aspectFill"
      />
      <view class="hero-overlay" />
      <view class="hero-nav">
        <view class="brand-logo">
          <image src="/static/icons/login/shield-solid.svg" mode="aspectFit" />
          <text>VaultPass</text>
        </view>
      </view>

      <view class="hero-content">
        <view>
          <text class="hero-title">你的数字资产保险箱</text>
          <text class="hero-subtitle">零知识加密保护</text>
          <text class="hero-subtitle muted">只有你能解锁你的数据</text>
          <view class="hero-actions">
            <button class="hero-btn primary" @tap="go('/pages/vault/vault', true)">解锁保险箱</button>
            <button class="hero-btn secondary" @tap="go('/pages/security/security', true)">了解安全机制</button>
          </view>
        </view>
      </view>
    </view>

    <view class="content-panel">
      <view class="section compact">
        <text class="section-title">我的保险箱</text>
        <view class="asset-grid">
          <view class="asset-card blue" @tap="go('/pages/passwords/passwords')">
            <image src="/static/icons/vault-menu/password.svg" mode="aspectFit" />
            <text class="asset-value">{{ passwordCount }}</text>
            <text class="asset-label">条记录</text>
            <text class="asset-name">密码</text>
          </view>
          <view class="asset-card green" @tap="go('/pages/upload-file/upload-file')">
            <image src="/static/icons/vault-menu/files.svg" mode="aspectFit" />
            <text class="asset-value">{{ fileCount }}</text>
            <text class="asset-label">个文件</text>
            <text class="asset-name">文件</text>
          </view>
          <view class="asset-card violet" @tap="go('/pages/albums/albums')">
            <image src="/static/icons/vault-menu/albums.svg" mode="aspectFit" />
            <text class="asset-value">{{ albumCount }}</text>
            <text class="asset-label">个相册</text>
            <text class="asset-name">相册</text>
          </view>
          <view class="asset-card orange" @tap="go('/pages/notes/notes')">
            <image src="/static/icons/vault-menu/notes.svg" mode="aspectFit" />
            <text class="asset-value">{{ noteCount }}</text>
            <text class="asset-label">条记录</text>
            <text class="asset-name">笔记</text>
          </view>
        </view>
      </view>

      <view class="plan-card">
        <view class="plan-copy">
          <text class="plan-title">数字遗产计划</text>
          <text class="plan-desc">如果长期失联，系统将按照你的设置向安全联系人移交数字资产。</text>
          <text class="plan-status">状态：未开启</text>
          <button class="plan-btn" @tap="go('/pages/inheritance/inheritance')">立即设置</button>
        </view>
        <image class="plan-visual" :src="inheritanceImage" mode="aspectFit" />
      </view>

      <view class="security-grid">
        <view class="security-card">
          <text class="section-title">安全中心</text>
          <view class="check-row">
            <text class="check-dot done" />
            <text class="check-label">主密码已设置</text>
            <text class="check-state done">已完成</text>
          </view>
          <view class="check-row">
            <text class="check-dot done" />
            <text class="check-label">零知识加密已开启</text>
            <text class="check-state done">已完成</text>
          </view>
          <view class="check-row">
            <text class="check-dot warn" />
            <text class="check-label">恢复密钥未备份</text>
            <text class="check-state warn">去备份</text>
          </view>
          <view class="check-row">
            <text class="check-dot danger" />
            <text class="check-label">未添加安全联系人</text>
            <text class="check-state danger">去添加</text>
          </view>
        </view>
        <view class="score-card">
          <text class="score-title">安全等级</text>
          <view class="score-ring">
            <text class="score-value">{{ securityScore }}%</text>
            <text class="score-label">良好</text>
          </view>
          <text class="score-desc">继续完善设置以提升安全等级</text>
        </view>
      </view>

      <view class="section">
        <view class="section-header">
          <text class="section-title">核心功能</text>
        </view>
        <view class="feature-layout">
          <view class="feature-primary" @tap="go('/pages/passwords/passwords')">
            <image src="/static/icons/vault-menu/password.svg" mode="aspectFit" />
            <text class="feature-title light">账号密码</text>
            <text class="feature-desc light">{{ passwordCount }} 条记录</text>
          </view>
          <view class="feature-side">
            <view
              v-for="item in coreEntries.slice(1)"
              :key="item.url"
              class="feature-row"
              :class="item.tone"
              @tap="go(item.url)"
            >
              <image :src="item.icon" mode="aspectFit" />
              <view class="feature-copy">
                <text class="feature-title">{{ item.title }}</text>
                <text class="feature-desc">{{ item.desc }}</text>
              </view>
              <text class="row-arrow">›</text>
            </view>
          </view>
        </view>
      </view>

      <view class="tools-card">
        <view
          v-for="tool in tools"
          :key="tool.url"
          class="tool-item"
          @tap="go(tool.url, tool.tab)"
        >
          <image :src="tool.icon" mode="aspectFit" />
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
  padding-bottom: 132rpx;
  background: #f4f7fc;
  box-sizing: border-box;
}

.hero-section {
  position: relative;
  min-height: 426rpx;
  padding: 88rpx 28rpx 74rpx;
  overflow: hidden;
  background:
    radial-gradient(circle at 64% 28%, rgba(45, 120, 255, 0.58), transparent 25%),
    radial-gradient(circle at 94% 18%, rgba(75, 112, 255, 0.3), transparent 24%),
    linear-gradient(145deg, #06113d 0%, #081c5a 52%, #0f2d8f 100%);
  box-sizing: border-box;
  color: #fff;
}

.hero-bg-image {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0.92;
}

.hero-overlay {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(90deg, rgba(3, 12, 47, 0.95) 0%, rgba(5, 19, 73, 0.86) 44%, rgba(6, 24, 86, 0.42) 100%),
    linear-gradient(180deg, rgba(3, 12, 47, 0.18) 0%, rgba(4, 14, 52, 0.62) 100%);
}

.hero-nav,
.brand-logo,
.hero-content,
.hero-actions {
  display: flex;
  align-items: center;
}

.hero-nav {
  position: relative;
  z-index: 1;
  justify-content: space-between;
  margin-bottom: 26rpx;
}

.brand-logo {
  gap: 10rpx;
  color: #fff;
  font-size: 24rpx;
  font-weight: 700;
}

.brand-logo image {
  width: 30rpx;
  height: 30rpx;
}

.hero-content {
  position: relative;
  z-index: 1;
  justify-content: space-between;
}

.hero-title {
  display: block;
  width: 380rpx;
  font-size: 37rpx;
  line-height: 1.2;
  font-weight: 750;
}

.hero-subtitle {
  display: block;
  margin-top: 18rpx;
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.88);
}

.hero-subtitle.muted {
  margin-top: 8rpx;
  color: rgba(255, 255, 255, 0.66);
}

.hero-actions {
  gap: 14rpx;
  margin-top: 24rpx;
}

.hero-btn {
  height: 58rpx;
  margin: 0;
  padding: 0 22rpx;
  border-radius: 999rpx;
  font-size: 22rpx;
  line-height: 58rpx;
}

.hero-btn::after {
  border: none;
}

.hero-btn.primary {
  color: #fff;
  background: #2367ff;
}

.hero-btn.secondary {
  color: rgba(255, 255, 255, 0.88);
  border: 1rpx solid rgba(255, 255, 255, 0.28);
  background: rgba(255, 255, 255, 0.08);
}

.content-panel {
  position: relative;
  z-index: 2;
  margin-top: -44rpx;
  padding: 28rpx 24rpx 34rpx;
  border-top-left-radius: 34rpx;
  border-top-right-radius: 34rpx;
  background: #fff;
  box-shadow: 0 -8rpx 28rpx rgba(11, 31, 77, 0.08);
}

.section {
  margin-top: 24rpx;
}

.section.compact {
  margin-top: 0;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16rpx;
}

.section-title {
  display: block;
  color: #132347;
  font-size: 28rpx;
  font-weight: 700;
}

.asset-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12rpx;
  margin-top: 18rpx;
}

.asset-card {
  position: relative;
  min-height: 148rpx;
  padding: 18rpx 14rpx;
  border-radius: 18rpx;
  box-sizing: border-box;
}

.asset-card.blue { background: #edf5ff; }
.asset-card.green { background: #eefbf4; }
.asset-card.violet { background: #f4f1ff; }
.asset-card.orange { background: #fff7eb; }

.asset-card image {
  width: 30rpx;
  height: 30rpx;
}

.asset-value,
.asset-label,
.asset-name {
  display: block;
}

.asset-value {
  margin-top: 20rpx;
  color: #10203f;
  font-size: 34rpx;
  font-weight: 760;
}

.asset-label {
  margin-top: 2rpx;
  color: #6f7b91;
  font-size: 20rpx;
}

.asset-name {
  position: absolute;
  top: 20rpx;
  left: 50rpx;
  color: #57647a;
  font-size: 21rpx;
  font-weight: 600;
}

.plan-card {
  position: relative;
  min-height: 190rpx;
  margin-top: 26rpx;
  padding: 26rpx;
  overflow: hidden;
  border-radius: 22rpx;
  background:
    radial-gradient(circle at 86% 50%, rgba(139, 116, 255, 0.2), transparent 38%),
    linear-gradient(135deg, #fbfaff 0%, #f2f0ff 58%, #f7fbff 100%);
  box-shadow: 0 8rpx 24rpx rgba(91, 84, 180, 0.08);
}

.plan-copy {
  position: relative;
  z-index: 1;
  width: 390rpx;
}

.plan-title {
  display: block;
  color: #132347;
  font-size: 28rpx;
  font-weight: 700;
}

.plan-desc {
  display: block;
  margin-top: 10rpx;
  color: #5f647c;
  font-size: 22rpx;
  line-height: 1.45;
}

.plan-status {
  display: block;
  margin-top: 14rpx;
  color: #ff6b6b;
  font-size: 21rpx;
}

.plan-btn {
  width: 150rpx;
  height: 54rpx;
  margin: 16rpx 0 0;
  padding: 0;
  border-radius: 14rpx;
  background: #2367ff;
  color: #fff;
  font-size: 22rpx;
  line-height: 54rpx;
}

.plan-btn::after {
  border: none;
}

.plan-visual {
  position: absolute;
  right: -4rpx;
  bottom: -10rpx;
  width: 220rpx;
  height: 190rpx;
  opacity: 0.96;
}

.security-grid {
  display: grid;
  grid-template-columns: 1.15fr 0.85fr;
  gap: 14rpx;
  margin-top: 24rpx;
}

.security-card,
.score-card,
.feature-primary,
.feature-row,
.tools-card {
  border-radius: 20rpx;
  background: #fff;
  box-shadow: 0 8rpx 24rpx rgba(15, 23, 42, 0.06);
}

.security-card,
.score-card {
  min-height: 198rpx;
  padding: 22rpx;
  box-sizing: border-box;
}

.check-row {
  display: flex;
  align-items: center;
  min-height: 34rpx;
  margin-top: 9rpx;
}

.check-dot {
  width: 12rpx;
  height: 12rpx;
  flex: 0 0 12rpx;
  margin-right: 10rpx;
  border-radius: 50%;
}

.check-dot.done { background: #20c76f; }
.check-dot.warn { background: #ffb020; }
.check-dot.danger { background: #ff5d5d; }

.check-label {
  flex: 1;
  color: #35415a;
  font-size: 21rpx;
}

.check-state {
  font-size: 20rpx;
}

.check-state.done { color: #20a865; }
.check-state.warn { color: #f5a000; }
.check-state.danger { color: #ef4444; }

.score-title,
.score-desc {
  display: block;
  text-align: center;
}

.score-title {
  color: #7a8496;
  font-size: 22rpx;
}

.score-ring {
  display: flex;
  width: 110rpx;
  height: 110rpx;
  margin: 16rpx auto 10rpx;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 12rpx solid #2367ff;
  border-left-color: #e8eefb;
  border-radius: 50%;
  box-sizing: border-box;
}

.score-value {
  color: #132347;
  font-size: 27rpx;
  font-weight: 760;
}

.score-label {
  color: #64748b;
  font-size: 18rpx;
}

.score-desc {
  color: #8a94a6;
  font-size: 19rpx;
  line-height: 1.35;
}

.feature-layout {
  display: grid;
  grid-template-columns: 0.9fr 1.5fr;
  gap: 14rpx;
}

.feature-primary {
  min-height: 178rpx;
  padding: 24rpx;
  background: linear-gradient(145deg, #1f60ff 0%, #7957ff 100%);
  box-sizing: border-box;
}

.feature-primary image {
  width: 48rpx;
  height: 48rpx;
  margin-bottom: 28rpx;
}

.feature-side {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.feature-row {
  display: flex;
  min-height: 78rpx;
  align-items: center;
  padding: 15rpx 18rpx;
  box-sizing: border-box;
}

.feature-row.green { background: #effcf5; }
.feature-row.violet { background: #f5f2ff; }
.feature-row.orange { background: #fff7ec; }

.feature-row image {
  width: 42rpx;
  height: 42rpx;
  flex: 0 0 42rpx;
}

.feature-copy {
  flex: 1;
  min-width: 0;
  margin-left: 14rpx;
}

.feature-title,
.feature-desc {
  display: block;
}

.feature-title {
  color: #132347;
  font-size: 24rpx;
  font-weight: 700;
}

.feature-title.light {
  color: #fff;
}

.feature-desc {
  margin-top: 4rpx;
  color: #758197;
  font-size: 20rpx;
}

.feature-desc.light {
  color: rgba(255, 255, 255, 0.78);
}

.row-arrow,
.tool-arrow {
  color: #95a0b2;
  font-size: 32rpx;
}

.tools-card {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rpx;
  margin-top: 24rpx;
  overflow: hidden;
  background: #edf1f7;
  box-shadow: none;
}

.tool-item {
  display: flex;
  min-height: 88rpx;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #fff;
  color: #4d5b73;
  font-size: 21rpx;
}

.tool-item image {
  width: 32rpx;
  height: 32rpx;
  margin-bottom: 8rpx;
}

.tool-arrow {
  display: none;
}
</style>
