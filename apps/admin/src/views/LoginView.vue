<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { VButton } from '@vaultpass/ui';
import { saveAdminKey } from '@/utils/api';

const router = useRouter();
const apiKey = ref('');
const error = ref('');

function handleLogin() {
  if (!apiKey.value.trim()) {
    error.value = '请输入 Admin API Key';
    return;
  }

  saveAdminKey(apiKey.value.trim());
  router.push('/');
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center px-4">
    <div class="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8">
      <h1 class="text-2xl font-bold text-white">管理员登录</h1>
      <p class="mt-2 text-sm text-slate-400">使用 .env 中的 ADMIN_API_KEY 登录</p>
      <input
        v-model="apiKey"
        type="password"
        class="mt-6 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
        placeholder="Admin API Key"
      />
      <VButton class="mt-4 w-full" variant="primary" @click="handleLogin">进入控制台</VButton>
      <p v-if="error" class="mt-3 text-sm text-red-400">{{ error }}</p>
    </div>
  </div>
</template>

<style scoped>
.vp-btn {
  width: 100%;
}
</style>
