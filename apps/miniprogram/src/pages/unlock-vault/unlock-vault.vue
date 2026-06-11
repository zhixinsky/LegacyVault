<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app';
import { ref } from 'vue';
import { vaultSession } from '@/utils/api';
import {
  unlockVaultWithMasterPassword,
  unlockVaultWithRecoveryKey,
} from '@/utils/crypto-flow';
import { getProfile, heartbeat } from '@/utils/services';

const unlockMode = ref<'master' | 'recovery'>('master');
const masterPassword = ref('');
const recoveryKey = ref('');
const recoveryConfigured = ref(false);
const loading = ref(false);

const heroBackgroundUrl =
  'cloud://prod-d4g8kpg7x92d55205.7072-prod-d4g8kpg7x92d55205-1441616383/img/bg.webp';

onLoad(async () => {
  try {
    const profile = await getProfile();
    recoveryConfigured.value = profile.recoveryKeyConfigured ?? false;
    if (profile.encryptedVaultKeyByRecovery) {
      vaultSession.setRecoveryBundle(profile.encryptedVaultKeyByRecovery);
    }
  } catch {
    // ignore
  }
});

async function handleUnlock() {
  if (unlockMode.value === 'master' && !masterPassword.value) {
    uni.showToast({ title: '请输入主密码', icon: 'none' });
    return;
  }
  if (unlockMode.value === 'recovery' && !recoveryKey.value) {
    uni.showToast({ title: '请输入恢复密钥', icon: 'none' });
    return;
  }

  loading.value = true;
  try {
    if (unlockMode.value === 'master') {
      await unlockVaultWithMasterPassword(masterPassword.value);
    } else {
      const bundle = vaultSession.getRecoveryBundle();
      if (!bundle) throw new Error('未配置恢复密钥');
      await unlockVaultWithRecoveryKey(recoveryKey.value, bundle);
    }

    masterPassword.value = '';
    recoveryKey.value = '';
    await heartbeat().catch(() => undefined);
    uni.switchTab({ url: '/pages/vault/vault' });
  } catch (error) {
    uni.showToast({
      title: error instanceof Error ? error.message : '解锁失败',
      icon: 'none',
    });
  } finally {
    loading.value = false;
  }
}

function goLogin() {
  vaultSession.logout();
  uni.reLaunch({ url: '/pages/login/login' });
}
</script>

<template>
  <view class="unlock-page">
    <image class="page-bg" :src="heroBackgroundUrl" mode="aspectFill" />

    <view class="hero">
      <text class="title">解锁保险箱</text>
      <text class="subtitle">请输入主密码解锁本机内存中的 vaultKey。主密码不会上传服务器。</text>
    </view>

    <view class="card">
      <view class="mode-tabs">
        <button class="tab" :class="{ active: unlockMode === 'master' }" @tap="unlockMode = 'master'">主密码</button>
        <button
          class="tab"
          :class="{ active: unlockMode === 'recovery' }"
          :disabled="!recoveryConfigured"
          @tap="unlockMode = 'recovery'"
        >
          恢复密钥
        </button>
      </view>

      <template v-if="unlockMode === 'master'">
        <text class="field-label">主密码</text>
        <input
          v-model="masterPassword"
          class="input"
          password
          placeholder="请输入主密码"
          placeholder-class="placeholder"
        />
      </template>

      <template v-else>
        <text class="field-label">恢复密钥</text>
        <input
          v-model="recoveryKey"
          class="input"
          password
          placeholder="请输入恢复密钥"
          placeholder-class="placeholder"
        />
      </template>

      <view class="tip-card">
        <text>平台无法查看或恢复您的保险箱内容。账号可找回，但保险箱必须由主密码或恢复密钥解锁。</text>
      </view>

      <button class="primary-button" :loading="loading" @tap="handleUnlock">解锁并进入保险箱</button>
      <button class="ghost-button" @tap="goLogin">切换账号</button>
    </view>
  </view>
</template>

<style scoped lang="scss">
@import '@/uni.scss';

button { margin: 0; }
button::after { border: none; }

.unlock-page {
  position: relative;
  min-height: 100vh;
  padding: 92rpx 32rpx 44rpx;
  background: linear-gradient(180deg, #f7fbff 0%, #eef6ff 100%);
  box-sizing: border-box;
}

.page-bg {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  opacity: 0.92;
}

.hero,
.card {
  position: relative;
  z-index: 1;
}

.hero {
  text-align: left;
  padding: 30rpx 0 32rpx;
}

.title {
  display: block;
  color: #0b1f4d;
  font-size: 44rpx;
  font-weight: 900;
}

.subtitle {
  display: block;
  margin: 18rpx 0 0;
  max-width: 620rpx;
  color: #66758a;
  font-size: 26rpx;
  line-height: 1.6;
}

.card {
  padding: 38rpx 34rpx 34rpx;
  border-radius: 42rpx;
  background: #fff;
  box-shadow: 0 18rpx 56rpx rgba(11, 31, 77, 0.1);
}

.mode-tabs {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14rpx;
  padding: 8rpx;
  border-radius: 22rpx;
  background: #f3f7ff;
}

.tab {
  height: 70rpx;
  padding: 0;
  border-radius: 18rpx;
  background: transparent;
  color: #6b7280;
  font-size: 25rpx;
  line-height: 70rpx;
}

.tab.active {
  background: #fff;
  color: #1667ff;
  font-weight: 800;
  box-shadow: 0 8rpx 18rpx rgba(22, 119, 255, 0.1);
}

.field-label {
  display: block;
  margin: 34rpx 0 16rpx;
  color: #0b1f4d;
  font-size: 29rpx;
  font-weight: 900;
}

.input {
  height: 92rpx;
  padding: 0 26rpx;
  border: 1rpx solid #d7e1ef;
  border-radius: 22rpx;
  background: #fff;
  color: #0b1f4d;
  font-size: 29rpx;
}

.placeholder {
  color: #a7b1c2;
}

.tip-card {
  margin-top: 28rpx;
  padding: 24rpx;
  border-radius: 20rpx;
  background: #eef7ff;
  color: #55708e;
  font-size: 24rpx;
  line-height: 1.5;
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
}

.ghost-button {
  height: 82rpx;
  margin-top: 18rpx;
  border-radius: 22rpx;
  background: #eef3ff;
  color: #1667ff;
  font-size: 27rpx;
  font-weight: 800;
  line-height: 82rpx;
}
</style>
