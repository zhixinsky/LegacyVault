<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { VButton } from '@vaultpass/ui';
import { vaultSession } from '@/utils/api';
import { persistAuthResult, register } from '@/utils/services';
import { registerWithMasterPassword } from '@/utils/crypto-flow';

const router = useRouter();
const masterPassword = ref('');
const confirmPassword = ref('');
const loading = ref(false);
const error = ref('');

async function handleSubmit() {
  if (masterPassword.value.length < 8) {
    error.value = '主密码至少 8 位';
    return;
  }
  if (masterPassword.value !== confirmPassword.value) {
    error.value = '两次密码不一致';
    return;
  }

  const phone = vaultSession.getPendingPhone();
  if (!phone) {
    error.value = '缺少手机号，请返回登录页';
    return;
  }

  loading.value = true;
  error.value = '';
  try {
    const { vaultKey, registerPayload } = await registerWithMasterPassword(
      phone,
      masterPassword.value,
    );
    const result = await register(registerPayload);
    persistAuthResult(result);
    vaultSession.setVaultKey(vaultKey);
    vaultSession.clearPendingPhone();
    masterPassword.value = '';
    confirmPassword.value = '';
    router.replace('/app/dashboard');
  } catch (err) {
    error.value = err instanceof Error ? err.message : '注册失败';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-slate-100 px-4">
    <div class="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
      <h1 class="text-2xl font-bold text-slate-900">设置主密码</h1>
      <p class="mt-2 text-sm text-slate-500">请设置用于加密保险箱的主密码</p>

      <label class="mt-6 block text-sm font-medium text-slate-700">主密码</label>
      <input
        v-model="masterPassword"
        type="password"
        class="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
        placeholder="至少 8 位"
      />

      <label class="mt-4 block text-sm font-medium text-slate-700">确认主密码</label>
      <input
        v-model="confirmPassword"
        type="password"
        class="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
        placeholder="再次输入主密码"
      />

      <p class="mt-3 text-xs text-slate-400">主密码无法找回。vault_key 不会写入 localStorage。</p>
      <p v-if="error" class="mt-3 text-sm text-red-600">{{ error }}</p>

      <VButton class="mt-6 w-full" variant="primary" :disabled="loading" @click="handleSubmit">
        {{ loading ? '创建中...' : '创建保险箱' }}
      </VButton>
    </div>
  </div>
</template>

<style scoped>
.w-full {
  width: 100%;
}
</style>
