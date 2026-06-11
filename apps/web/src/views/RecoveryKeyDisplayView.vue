<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { VButton } from '@vaultpass/ui';
import { vaultSession } from '@/utils/api';

const router = useRouter();
const confirmed = ref(false);
const setup = vaultSession.getPendingVaultSetup();
const recoveryKey = setup?.recoveryKey ?? '';
const groups = computed(() => recoveryKey.split('-').filter(Boolean));

if (!recoveryKey) {
  router.replace('/create-vault-password');
}

function copyKey() {
  void navigator.clipboard.writeText(recoveryKey);
}

function downloadTxt() {
  const blob = new Blob([`LegacyVault 恢复密钥\n\n${recoveryKey}\n`], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'LegacyVault-Recovery-Key.txt';
  link.click();
  URL.revokeObjectURL(url);
}
</script>

<template>
  <div class="min-h-screen bg-gradient-to-b from-blue-50 to-white px-4 py-10">
    <div class="mx-auto max-w-xl rounded-3xl bg-white p-8 shadow-sm ring-1 ring-blue-100">
      <p class="text-sm font-semibold text-blue-600">保存恢复密钥</p>
      <h1 class="mt-3 text-3xl font-bold text-slate-900">请保存您的恢复密钥</h1>
      <p class="mt-3 text-slate-500">如果您忘记主密码，恢复密钥是找回保险箱访问权限的唯一方式。</p>

      <div class="mt-8 grid grid-cols-2 gap-3">
        <span
          v-for="group in groups"
          :key="group"
          class="rounded-xl bg-blue-50 px-4 py-4 text-center text-2xl font-bold tracking-widest text-slate-900"
        >
          {{ group }}
        </span>
      </div>

      <div class="mt-5 grid grid-cols-2 gap-3">
        <VButton variant="secondary" @click="copyKey">复制</VButton>
        <VButton variant="secondary" @click="downloadTxt">下载 TXT</VButton>
      </div>

      <div class="mt-6 rounded-2xl bg-orange-50 p-4 text-sm text-orange-700">
        请勿将恢复密钥发送给他人。任何获得恢复密钥的人，都可能在满足验证条件后恢复您的保险箱访问权限。
      </div>

      <label class="mt-6 flex items-center gap-3 text-sm text-slate-700">
        <input v-model="confirmed" type="checkbox" class="h-4 w-4" />
        我已将恢复密钥保存到安全位置
      </label>

      <VButton
        class="mt-6 !w-full"
        variant="primary"
        :disabled="!confirmed"
        @click="router.push('/recovery-key-confirm')"
      >
        下一步，验证恢复密钥
      </VButton>
    </div>
  </div>
</template>
