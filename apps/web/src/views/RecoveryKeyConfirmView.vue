<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { VButton } from '@vaultpass/ui';
import { vaultSession } from '@/utils/api';

const router = useRouter();
const input = ref('');
const setup = vaultSession.getPendingVaultSetup();
const lastGroup = setup?.recoveryLastGroup ?? '';
const error = ref('');

if (!lastGroup) {
  router.replace('/create-vault-password');
}

function confirm() {
  if (input.value.trim().toUpperCase() !== lastGroup) {
    error.value = '恢复密钥最后 4 位不正确';
    return;
  }
  vaultSession.clearPendingVaultSetup();
  input.value = '';
  router.replace('/app/dashboard');
}
</script>

<template>
  <div class="min-h-screen bg-gradient-to-b from-blue-50 to-white px-4 py-10">
    <div class="mx-auto max-w-xl rounded-3xl bg-white p-8 shadow-sm ring-1 ring-blue-100">
      <p class="text-sm font-semibold text-blue-600">确认恢复密钥</p>
      <h1 class="mt-3 text-3xl font-bold text-slate-900">确认您已保存恢复密钥</h1>
      <p class="mt-3 text-slate-500">请输入恢复密钥的最后 4 位，用于确认您已经妥善保存。</p>

      <label class="mt-8 block text-sm font-medium text-slate-700">恢复密钥最后 4 位</label>
      <input
        v-model="input"
        maxlength="4"
        class="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-center text-xl font-bold uppercase tracking-widest outline-none focus:border-blue-500"
        placeholder="例如 W4BN"
      />

      <p v-if="error" class="mt-4 text-sm text-red-600">{{ error }}</p>
      <VButton class="mt-6 !w-full" variant="primary" :disabled="input.length !== 4" @click="confirm">
        完成并进入保险箱
      </VButton>
    </div>
  </div>
</template>
