<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app';
import { ref } from 'vue';
import { vaultSession } from '@/utils/api';
import {
  persistAuthResult,
  register,
} from '@/utils/services';
import {
  registerWithMasterPassword,
  unlockVaultWithMasterPassword,
  unlockVaultWithRecoveryKey,
} from '@/utils/crypto-flow';
import { getProfile } from '@/utils/services';

const mode = ref<'register' | 'unlock'>('register');
const unlockMode = ref<'master' | 'recovery'>('master');
const masterPassword = ref('');
const recoveryPassphrase = ref('');
const recoveryConfigured = ref(false);
const confirmPassword = ref('');
const loading = ref(false);

onLoad(async (query) => {
  mode.value = query?.mode === 'unlock' ? 'unlock' : 'register';
  uni.setNavigationBarTitle({
    title: mode.value === 'register' ? '设置主密码' : '解锁保险箱',
  });
  if (mode.value === 'unlock') {
    try {
      const profile = await getProfile();
      recoveryConfigured.value = profile.recoveryKeyConfigured ?? false;
      if (profile.encryptedVaultKeyByRecovery) {
        vaultSession.setRecoveryBundle(profile.encryptedVaultKeyByRecovery);
      }
    } catch {
      // ignore
    }
  }
});

async function handleSubmit() {
  if (mode.value === 'unlock' && unlockMode.value === 'recovery') {
    if (!recoveryPassphrase.value) {
      uni.showToast({ title: '请输入恢复密钥', icon: 'none' });
      return;
    }
  } else if (!masterPassword.value || masterPassword.value.length < 8) {
    uni.showToast({ title: '主密码至少 8 位', icon: 'none' });
    return;
  }

  if (mode.value === 'register' && masterPassword.value !== confirmPassword.value) {
    uni.showToast({ title: '两次密码不一致', icon: 'none' });
    return;
  }

  loading.value = true;
  try {
    if (mode.value === 'register') {
      const phone = vaultSession.getPendingPhone();
      if (!phone) {
        throw new Error('缺少手机号，请返回登录页');
      }

      const { vaultKey, registerPayload } = await registerWithMasterPassword(
        phone,
        masterPassword.value,
      );
      const wxCode = vaultSession.getPendingWxCode();
      const result = await register({
        ...registerPayload,
        ...(wxCode ? { wxCode } : {}),
      });
      persistAuthResult(result);
      vaultSession.setVaultKey(vaultKey);
      vaultSession.clearPendingPhone();
      vaultSession.clearPendingWxCode();
    } else if (unlockMode.value === 'master') {
      await unlockVaultWithMasterPassword(masterPassword.value);
      await import('@/utils/services').then((m) => m.heartbeat());
    } else {
      const bundle = vaultSession.getRecoveryBundle();
      if (!bundle) throw new Error('未配置恢复密钥');
      await unlockVaultWithRecoveryKey(recoveryPassphrase.value, bundle);
      await import('@/utils/services').then((m) => m.heartbeat());
    }

    masterPassword.value = '';
    confirmPassword.value = '';
    uni.reLaunch({ url: '/pages/vault/vault' });
  } catch (error) {
    const message = error instanceof Error ? error.message : '操作失败';
    if (mode.value === 'register' && /已注册|已绑定/.test(message)) {
      uni.showModal({
        title: '账号已存在',
        content: `${message}，请返回登录后解锁保险箱。`,
        showCancel: false,
        success: () => {
          uni.reLaunch({ url: '/pages/login/login' });
        },
      });
      return;
    }

    uni.showToast({
      title: message,
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
      <text class="title">{{ mode === 'register' ? '设置主密码' : '解锁保险箱' }}</text>
      <text class="subtitle">
        {{ mode === 'register' ? '请设置用于加密保险箱的主密码' : '使用主密码或恢复密钥解锁' }}
      </text>

      <view v-if="mode === 'unlock'" class="mode-tabs">
        <button class="tab" :class="{ active: unlockMode === 'master' }" @tap="unlockMode = 'master'">主密码</button>
        <button class="tab" :class="{ active: unlockMode === 'recovery' }" :disabled="!recoveryConfigured" @tap="unlockMode = 'recovery'">恢复密钥</button>
      </view>

      <template v-if="mode === 'register' || unlockMode === 'master'">
        <text class="field-label">主密码</text>
        <input v-model="masterPassword" class="input" password placeholder="至少 8 位" />
      </template>

      <template v-else-if="mode === 'unlock'">
        <text class="field-label">恢复密钥</text>
        <input v-model="recoveryPassphrase" class="input" password placeholder="请输入恢复密钥" />
      </template>

      <template v-if="mode === 'register'">
        <text class="field-label">确认主密码</text>
        <input
          v-model="confirmPassword"
          class="input"
          password
          placeholder="再次输入主密码"
        />
      </template>

      <text class="hint">主密码无法找回，请妥善保管。密钥不会写入本地存储。</text>

      <button class="btn btn-primary" :loading="loading" @tap="handleSubmit">
        {{ mode === 'register' ? '创建保险箱' : '解锁' }}
      </button>
    </view>
  </view>
</template>

<style scoped lang="scss">
@import '@/uni.scss';

.mode-tabs {
  display: flex;
  gap: 16rpx;
  margin: 24rpx 0;
}

.tab {
  flex: 1;
  margin: 0;
  font-size: 26rpx;
  background: #f1f5f9;
  color: #64748b;
}

.tab.active {
  background: #2563eb;
  color: #fff;
}
</style>
