<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { VButton } from '@vaultpass/ui';
import { vaultSession } from '@/utils/api';
import { buildCreateVaultPayload } from '@/utils/crypto-flow';
import { createVault } from '@/utils/services';

const router = useRouter();
const masterPassword = ref('');
const confirmPassword = ref('');
const loading = ref(false);
const error = ref('');

const rules = computed(() => ({
  minLength: masterPassword.value.length >= 12,
  upper: /[A-Z]/.test(masterPassword.value),
  lower: /[a-z]/.test(masterPassword.value),
  number: /\d/.test(masterPassword.value),
  special: /[^A-Za-z0-9]/.test(masterPassword.value),
  notWeak: !/(123456|password|qwerty|88888888)/i.test(masterPassword.value),
}));

const validPassword = computed(() => Object.values(rules.value).every(Boolean));
const passwordMatched = computed(
  () => Boolean(confirmPassword.value) && masterPassword.value === confirmPassword.value,
);

async function handleCreate() {
  if (!validPassword.value) {
    error.value = '主密码需至少 12 位，并包含大小写字母、数字和特殊符号';
    return;
  }
  if (!passwordMatched.value) {
    error.value = '两次密码不一致';
    return;
  }

  loading.value = true;
  error.value = '';
  try {
    const result = await buildCreateVaultPayload(masterPassword.value);
    await createVault(result.createPayload);
    vaultSession.setKeyBundle(result.keyBundle);
    vaultSession.setRecoveryBundle(result.recoveryBundle);
    vaultSession.setVaultKey(result.vaultKey);
    vaultSession.setPendingVaultSetup({
      recoveryKey: result.recoveryKey,
      recoveryLastGroup: result.recoveryKey.split('-').slice(-1)[0] ?? '',
    });
    masterPassword.value = '';
    confirmPassword.value = '';
    router.push('/recovery-key-display');
  } catch (err) {
    error.value = err instanceof Error ? err.message : '保险箱创建失败';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen bg-gradient-to-b from-blue-50 to-white px-4 py-10">
    <div class="mx-auto max-w-xl rounded-3xl bg-white p-8 shadow-sm ring-1 ring-blue-100">
      <p class="text-sm font-semibold text-blue-600">创建保险箱</p>
      <h1 class="mt-3 text-3xl font-bold text-slate-900">创建您的数字保险箱</h1>
      <p class="mt-3 text-slate-500">主密码用于加密您的所有数据，只有您本人可以解锁和访问。</p>

      <div class="mt-6 grid grid-cols-3 gap-3 text-center text-sm font-medium text-blue-700">
        <span class="rounded-full bg-blue-50 px-3 py-2">端到端加密</span>
        <span class="rounded-full bg-blue-50 px-3 py-2">完全私密</span>
        <span class="rounded-full bg-blue-50 px-3 py-2">密码不会上传</span>
      </div>

      <label class="mt-8 block text-sm font-medium text-slate-700">主密码</label>
      <input
        v-model="masterPassword"
        type="password"
        class="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
        placeholder="至少 12 位"
      />

      <div class="mt-4 grid grid-cols-2 gap-2 text-sm">
        <span :class="rules.minLength ? 'text-green-600' : 'text-slate-400'">至少 12 位</span>
        <span :class="rules.upper ? 'text-green-600' : 'text-slate-400'">包含大写字母</span>
        <span :class="rules.lower ? 'text-green-600' : 'text-slate-400'">包含小写字母</span>
        <span :class="rules.number ? 'text-green-600' : 'text-slate-400'">包含数字</span>
        <span :class="rules.special ? 'text-green-600' : 'text-slate-400'">包含特殊符号</span>
        <span :class="rules.notWeak ? 'text-green-600' : 'text-slate-400'">避开弱密码</span>
      </div>

      <label class="mt-6 block text-sm font-medium text-slate-700">确认主密码</label>
      <input
        v-model="confirmPassword"
        type="password"
        class="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
        placeholder="再次输入主密码"
      />
      <p v-if="passwordMatched" class="mt-2 text-sm text-green-600">两次输入的密码一致</p>

      <div class="mt-6 rounded-2xl bg-blue-50 p-4 text-sm text-slate-600">
        <p class="font-semibold text-slate-900">安全提示</p>
        <p class="mt-2">主密码不会上传到服务器，平台无法查看或恢复。</p>
        <p>忘记主密码将无法找回保险箱内的任何数据。</p>
      </div>

      <div class="mt-4 rounded-2xl bg-orange-50 p-4 text-sm text-orange-700">
        您的账号可以找回，但保险箱内容无法找回，请务必牢记主密码。
      </div>

      <p v-if="error" class="mt-4 text-sm text-red-600">{{ error }}</p>
      <VButton
        class="mt-6 !w-full"
        variant="primary"
        :disabled="loading || !validPassword || !passwordMatched"
        @click="handleCreate"
      >
        {{ loading ? '创建中...' : '创建我的保险箱' }}
      </VButton>
    </div>
  </div>
</template>
