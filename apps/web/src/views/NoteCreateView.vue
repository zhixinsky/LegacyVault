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
const content = ref('');
const loading = ref(false);
const error = ref('');

onMounted(async () => {
  if (!isEdit.value) return;
  loading.value = true;
  try {
    const item = await getVaultItem(editId.value);
    title.value = await decryptVaultTitle(item.titleCiphertext);
    const payload = await decryptVaultPayload<{ content?: string }>(item.encryptedPayload);
    content.value = payload.content ?? '';
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载失败';
  } finally {
    loading.value = false;
  }
});

async function handleSave() {
  if (!title.value || !content.value) {
    error.value = '请填写标题和内容';
    return;
  }

  loading.value = true;
  try {
    const encrypted = await encryptVaultItemPayload({ content: content.value }, title.value);
    if (isEdit.value) {
      await updateVaultItem(editId.value, {
        titleCiphertext: encrypted.titleCiphertext,
        encryptedPayload: encrypted.encryptedPayload,
      });
    } else {
      await createVaultItem({
        type: 'note',
        titleCiphertext: encrypted.titleCiphertext,
        encryptedPayload: encrypted.encryptedPayload,
      });
    }
    router.push('/app/notes');
  } catch (err) {
    error.value = err instanceof Error ? err.message : '保存失败';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="mx-auto max-w-xl rounded-xl bg-white p-8 ring-1 ring-slate-200">
    <h2 class="text-xl font-bold text-slate-900">{{ isEdit ? '编辑私密笔记' : '新增私密笔记' }}</h2>
    <div v-if="loading && isEdit" class="mt-6 text-center text-slate-400">加载中...</div>
    <div v-else class="mt-6 space-y-4">
      <input v-model="title" class="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="标题" />
      <textarea
        v-model="content"
        class="w-full rounded-lg border border-slate-300 px-3 py-2"
        rows="8"
        placeholder="笔记内容"
      />
      <VButton variant="primary" :disabled="loading" @click="handleSave">
        {{ loading ? '加密保存中...' : '加密保存' }}
      </VButton>
      <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
    </div>
  </div>
</template>
