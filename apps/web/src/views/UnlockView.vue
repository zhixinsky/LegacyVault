<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { VButton } from '@vaultpass/ui';
import { vaultSession } from '@/utils/api';
import { buildRecoveredMasterPasswordPayload, unlockVaultWithMasterPassword } from '@/utils/crypto-flow';
import { getProfile, heartbeat, recoverMasterPassword } from '@/utils/services';

const router = useRouter();
const mode = ref<'master' | 'recovery'>('master');
const masterPassword = ref('');
const recoveryPassphrase = ref('');

const newMasterPassword = ref('');

const confirmMasterPassword = ref('');
const recoveryConfigured = ref(false);
const recoveryHint = ref('');
const loading = ref(false);
const error = ref('');

onMounted(async () => {
  if (vaultSession.getRecoveryBundle()) {
    recoveryConfigured.value = true;
  }
  try {
    const profile = await getProfile();
    if (!profile.hasVault) {
      router.replace('/create-vault-password');
      return;
    }
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

      if (newMasterPassword.value.length < 12) {

        throw new Error('新主密码至少 12 位');

      }

      if (newMasterPassword.value !== confirmMasterPassword.value) {

        throw new Error('两次输入的新主密码不一致');

      }

      const recovered = await buildRecoveredMasterPasswordPayload(

        recoveryPassphrase.value,

        bundle,

        newMasterPassword.value,

      );

      await recoverMasterPassword(recovered.payload);

      vaultSession.setKeyBundle(recovered.keyBundle);

      vaultSession.setVaultKey(recovered.vaultKey);

      recoveryPassphrase.value = '';

      newMasterPassword.value = '';

      confirmMasterPassword.value = '';

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
  <div class="unlock-page px-4">
    <div class="w-full max-w-md rounded-[28px] bg-white/90 p-8 shadow-[0_28px_80px_rgba(11,31,77,0.16)] ring-1 ring-white/80 backdrop-blur">
      <h1 class="text-2xl font-bold text-slate-900">解锁保险箱</h1>
      <p class="mt-2 text-sm text-slate-500">密钥仅在本地使用，不会发送到服务器</p>

      <template v-if="mode === 'master'">

        <label class="mt-6 block text-sm font-medium text-slate-700">主密码</label>

        <input
          v-model="masterPassword"
          type="password"
          class="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
          placeholder="请输入主密码"
          @keyup.enter="handleUnlock"
        />

        <div class="mt-3 text-right">
          <button
            type="button"
            class="text-sm font-semibold text-blue-600 hover:text-blue-700 disabled:cursor-not-allowed disabled:text-slate-400"
            :disabled="!recoveryConfigured"
            @click="mode = 'recovery'"
          >
            忘记主密码？
          </button>
        </div>

      </template>

      <template v-else>

        <button
          type="button"
          class="mt-5 text-sm font-semibold text-blue-600 hover:text-blue-700"
          @click="mode = 'master'"
        >
          返回主密码解锁
        </button>

        <div class="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
          恢复密钥只用于找回访问权限。验证成功后必须设置新的主密码，之后仍使用主密码解锁保险箱。
        </div>

        <p v-if="recoveryHint" class="mt-4 text-sm text-slate-500">提示：{{ recoveryHint }}</p>

        <label class="mt-4 block text-sm font-medium text-slate-700">恢复密钥</label>

        <input
          v-model="recoveryPassphrase"
          type="password"
          class="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
          placeholder="请输入恢复密钥"
        />

        <label class="mt-4 block text-sm font-medium text-slate-700">新主密码</label>

        <input
          v-model="newMasterPassword"
          type="password"
          class="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
          placeholder="至少 12 位的新主密码"
        />

        <label class="mt-4 block text-sm font-medium text-slate-700">确认新主密码</label>

        <input
          v-model="confirmMasterPassword"
          type="password"
          class="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
          placeholder="再次输入新主密码"
          @keyup.enter="handleUnlock"
        />

      </template>


      <p v-if="error" class="mt-3 text-sm text-red-600">{{ error }}</p>

      <VButton class="mt-6 !w-full" variant="primary" :disabled="loading" @click="handleUnlock">
        {{ loading ? '处理中...' : mode === 'master' ? '解锁保险箱' : '重置主密码并进入' }}
      </VButton>
    </div>
  </div>
</template>

<style scoped>
.unlock-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background:
    linear-gradient(135deg, rgba(247, 251, 255, 0.9), rgba(232, 245, 255, 0.86)),
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1300' height='850' viewBox='0 0 1300 850'%3E%3Cdefs%3E%3CradialGradient id='g' cx='50%25' cy='45%25' r='50%25'%3E%3Cstop offset='0' stop-color='%2368a4ff' stop-opacity='.55'/%3E%3Cstop offset='.65' stop-color='%23d8ecff' stop-opacity='.25'/%3E%3Cstop offset='1' stop-color='%23ffffff' stop-opacity='0'/%3E%3C/radialGradient%3E%3ClinearGradient id='s' x1='0' x2='1' y1='0' y2='1'%3E%3Cstop stop-color='%23f5fbff'/%3E%3Cstop offset='1' stop-color='%23eaf5ff'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='1300' height='850' fill='url(%23s)'/%3E%3Ccircle cx='660' cy='390' r='360' fill='url(%23g)'/%3E%3Crect x='730' y='245' width='260' height='240' rx='48' fill='%231667ff' fill-opacity='.16' stroke='%232b74ff' stroke-width='7'/%3E%3Cpath d='M800 245v-44c0-72 44-125 98-125s98 53 98 125v44' fill='none' stroke='%231667ff' stroke-width='25' stroke-linecap='round' stroke-opacity='.45'/%3E%3Ccircle cx='860' cy='365' r='28' fill='%231667ff' fill-opacity='.55'/%3E%3Cpath d='M220 550c240-132 466-136 680-12' fill='none' stroke='%238dbdff' stroke-width='3' stroke-opacity='.4'/%3E%3Cpath d='M260 250c162-72 321-62 476 30' fill='none' stroke='%238bd5d1' stroke-width='3' stroke-opacity='.32'/%3E%3C/svg%3E");
  background-size: cover;
  background-position: center;
}
</style>
