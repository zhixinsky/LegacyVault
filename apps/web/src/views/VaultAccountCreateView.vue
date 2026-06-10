<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { VButton } from '@vaultpass/ui';
import { getVaultItemTypeConfig, isManagedVaultType } from '@vaultpass/types';
import { decryptVaultPayload, decryptVaultTitle, encryptVaultItemPayload } from '@/utils/crypto-flow';
import { createVaultItem, getVaultItem, updateVaultItem } from '@/utils/services';

const route = useRoute();
const router = useRouter();
const vaultType = computed(() => String(route.params.type ?? ''));
const editId = computed(() => String(route.params.id ?? ''));
const isEdit = computed(() => Boolean(editId.value));
const config = computed(() => getVaultItemTypeConfig(vaultType.value));

const title = ref('');
const form = ref<Record<string, string>>({});
const loading = ref(false);
const error = ref('');

onMounted(async () => {
  if (!isManagedVaultType(vaultType.value)) {
    router.replace('/app/accounts');
    return;
  }

  if (!isEdit.value) return;

  loading.value = true;
  try {
    const item = await getVaultItem(editId.value);
    title.value = await decryptVaultTitle(item.titleCiphertext);
    const payload = await decryptVaultPayload<Record<string, string>>(item.encryptedPayload);
    form.value = { ...payload };
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载失败';
  } finally {
    loading.value = false;
  }
});

async function handleSave() {
  if (!config.value) return;
  if (!title.value.trim()) {
    error.value = '请填写标题';
    return;
  }

  for (const field of config.value.fields) {
    if (field.required && !form.value[field.key]?.trim()) {
      error.value = `请填写${field.label}`;
      return;
    }
  }

  loading.value = true;
  error.value = '';
  try {
    const encrypted = await encryptVaultItemPayload({ ...form.value }, title.value.trim());
    if (isEdit.value) {
      await updateVaultItem(editId.value, {
        titleCiphertext: encrypted.titleCiphertext,
        encryptedPayload: encrypted.encryptedPayload,
      });
    } else {
      await createVaultItem({
        type: vaultType.value,
        titleCiphertext: encrypted.titleCiphertext,
        encryptedPayload: encrypted.encryptedPayload,
      });
    }
    router.push(`/app/accounts/${vaultType.value}`);
  } catch (err) {
    error.value = err instanceof Error ? err.message : '保存失败';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div v-if="config" class="mx-auto max-w-2xl rounded-xl bg-white p-8 ring-1 ring-slate-200">
    <h2 class="text-xl font-bold text-slate-900">{{ isEdit ? `编辑${config.label}` : `新增${config.label}` }}</h2>
    <p class="mt-2 text-sm text-slate-500">内容将在本地加密后上传</p>

    <div v-if="loading && isEdit" class="mt-6 text-center text-slate-400">加载中...</div>
    <div v-else class="mt-6 grid gap-4">
      <label class="block">
        <span class="text-sm text-slate-600">标题</span>
        <input v-model="title" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
      </label>

      <label v-for="field in config.fields" :key="field.key" class="block">
        <span class="text-sm text-slate-600">
          {{ field.label }}
          <span v-if="field.required" class="text-red-500">*</span>
        </span>
        <textarea
          v-if="field.inputType === 'textarea'"
          v-model="form[field.key]"
          class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          rows="3"
          :placeholder="field.placeholder"
        />
        <input
          v-else
          v-model="form[field.key]"
          :type="field.inputType === 'password' ? 'password' : 'text'"
          class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          :placeholder="field.placeholder"
        />
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
