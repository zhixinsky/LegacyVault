<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { VButton } from '@vaultpass/ui';
import { vaultSession } from '@/utils/api';
import { unlockVaultWithMasterPassword, unlockVaultWithRecoveryKey } from '@/utils/crypto-flow';
import { getProfile, heartbeat } from '@/utils/services';

const router = useRouter();
const mode = ref<'master' | 'recovery'>('master');
const masterPassword = ref('');
const recoveryPassphrase = ref('');
const recoveryConfigured = ref(false);
const recoveryHint = ref('');
const loading = ref(false);
const error = ref('');

onMounted(async () => {
  if (vaultSession.getRecoveryBundle()) {
    recoveryConfigured.value = true;
    return;
  }
  try {
    const profile = await getProfile();
    if (!profile.hasVault) {
      router.replace('/create-vault-password');
      return;
    }
    recoveryConfigured.value = profile.recoveryKeyConfigured ?? false;
    recoveryHint.value = profile.recoveryKeyHint ?? '';
    if (profile.encryptedVaultKeyByRecovery) {
      vaultSession.setRecoveryBundle(profile.encryptedVaultKeyByRecovery);
    }
  } catch {
    // ignore
  }
});

async function handleUnlock() {
  loading.value = true;
  error.value = '';
  try {
    if (mode.value === 'master') {
      await unlockVaultWithMasterPassword(masterPassword.value);
      masterPassword.value = '';
    } else {
      const bundle = vaultSession.getRecoveryBundle();
      if (!bundle) {
        throw new Error('未配置恢复密钥');
      }
      await unlockVaultWithRecoveryKey(recoveryPassphrase.value, bundle);
      recoveryPassphrase.value = '';
    }
    await heartbeat().catch(() => undefined);
    router.replace('/app/dashboard');
  } catch (err) {
    error.value = err instanceof Error ? err.message : '解锁失败';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-slate-100 px-4">
    <div class="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
      <h1 class="text-2xl font-bold text-slate-900">解锁保险箱</h1>
      <p class="mt-2 text-sm text-slate-500">密钥仅在本地使用，不会发送到服务器</p>

      <div class="mt-6 flex gap-2 rounded-lg bg-slate-100 p-1">
        <button
          type="button"
          class="flex-1 rounded-md py-2 text-sm"
          :class="mode === 'master' ? 'bg-white font-medium text-slate-900 shadow-sm' : 'text-slate-500'"
          @click="mode = 'master'"
        >
          主密码
        </button>
        <button
          type="button"
          class="flex-1 rounded-md py-2 text-sm disabled:opacity-50"
          :class="mode === 'recovery' ? 'bg-white font-medium text-slate-900 shadow-sm' : 'text-slate-500'"
          :disabled="!recoveryConfigured"
          @click="mode = 'recovery'"
        >
          恢复密钥
        </button>
      </div>

      <template v-if="mode === 'master'">
        <label class="mt-6 block text-sm font-medium text-slate-700">主密码</label>
        <input
          v-model="masterPassword"
          type="password"
          class="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
          placeholder="请输入主密码"
          @keyup.enter="handleUnlock"
        />
      </template>

      <template v-else>
        <p v-if="recoveryHint" class="mt-4 text-sm text-slate-500">提示：{{ recoveryHint }}</p>
        <label class="mt-4 block text-sm font-medium text-slate-700">恢复密钥</label>
        <input
          v-model="recoveryPassphrase"
          type="password"
          class="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
          placeholder="请输入恢复密钥"
          @keyup.enter="handleUnlock"
        />
      </template>

      <p v-if="error" class="mt-3 text-sm text-red-600">{{ error }}</p>

      <VButton class="mt-6 !w-full" variant="primary" :disabled="loading" @click="handleUnlock">
        {{ loading ? '解锁中...' : '解锁' }}
      </VButton>
    </div>
  </div>
</template>
