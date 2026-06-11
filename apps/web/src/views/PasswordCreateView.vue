<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { VButton } from '@vaultpass/ui';
import { decryptVaultPayload, decryptVaultTitle, encryptVaultItemPayload } from '@/utils/crypto-flow';
import { createVaultItem, getVaultItem, updateVaultItem } from '@/utils/services';

const route = useRoute();
const router = useRouter();
const editId = computed(() => String(route.params.id ?? ''));
const isEdit = computed(() => Boolean(editId.value));

const title = ref('');
const platform = ref('');
const username = ref('');
const password = ref('');
const website = ref('');
const note = ref('');
const loading = ref(false);
const error = ref('');

onMounted(async () => {
  if (!isEdit.value) return;
  loading.value = true;
  try {
    const item = await getVaultItem(editId.value);
    title.value = await decryptVaultTitle(item.titleCiphertext);
    const payload = await decryptVaultPayload<{
      platform?: string;
      provider?: string;
      host?: string;
      username?: string;
      address?: string;
      password?: string;
      website?: string;
      note?: string;
    }>(item.encryptedPayload);
    platform.value = payload.platform ?? payload.provider ?? payload.host ?? '';
    username.value = payload.username ?? payload.address ?? '';
    password.value = payload.password ?? '';
    website.value = payload.website ?? '';
    note.value = payload.note ?? '';
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载失败';
  } finally {
    loading.value = false;
  }
});

async function handleSave() {
  if (!title.value || !username.value || !password.value) {
    error.value = '请填写标题、账号和密码';
    return;
  }

  loading.value = true;
  error.value = '';
  try {
    const encrypted = await encryptVaultItemPayload(
      {
        platform: platform.value,
        provider: platform.value,
        username: username.value,
        address: username.value,
        password: password.value,
        website: website.value,
        note: note.value,
      },
      title.value,
    );

    if (isEdit.value) {
      await updateVaultItem(editId.value, {
        titleCiphertext: encrypted.titleCiphertext,
        encryptedPayload: encrypted.encryptedPayload,
      });
    } else {
      await createVaultItem({
        type: 'email_account',
        titleCiphertext: encrypted.titleCiphertext,
        encryptedPayload: encrypted.encryptedPayload,
      });
    }

    router.push('/app/passwords');
  } catch (err) {
    error.value = err instanceof Error ? err.message : '保存失败';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="mx-auto max-w-2xl rounded-xl bg-white p-8 ring-1 ring-slate-200">
    <h2 class="text-xl font-bold text-slate-900">{{ isEdit ? '编辑账号密码' : '新增账号密码' }}</h2>
    <p class="mt-2 text-sm text-slate-500">内容将在本地加密后上传</p>

    <div v-if="loading && isEdit" class="mt-6 text-center text-slate-400">加载中...</div>
    <div v-else class="mt-6 grid gap-4">
      <label class="block">
        <span class="text-sm text-slate-600">标题</span>
        <input v-model="title" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
      </label>
      <label class="block">
        <span class="text-sm text-slate-600">平台</span>
        <input v-model="platform" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
      </label>
      <label class="block">
        <span class="text-sm text-slate-600">账号</span>
        <input v-model="username" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
      </label>
      <label class="block">
        <span class="text-sm text-slate-600">密码</span>
        <input v-model="password" type="password" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
      </label>
      <label class="block">
        <span class="text-sm text-slate-600">网址</span>
        <input v-model="website" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
      </label>
      <label class="block">
        <span class="text-sm text-slate-600">备注</span>
        <textarea v-model="note" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" rows="3" />
      </label>
    </div>

    <p v-if="error" class="mt-4 text-sm text-red-600">{{ error }}</p>

    <div class="mt-6 flex gap-3">
      <VButton variant="primary" :disabled="loading" @click="handleSave">
        {{ loading ? '保存中...' : '加密保存' }}
      </VButton>
      <VButton variant="secondary" @click="router.back()">取消</VButton>
    </div>
  </div>
</template>
