<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { VButton } from '@vaultpass/ui';
import { decryptVaultPayload, decryptVaultTitle } from '@/utils/crypto-flow';
import { deleteVaultItem, listVaultItems, type VaultItem } from '@/utils/services';

interface NoteRow {
  id: string;
  title: string;
  content: string;
}

const router = useRouter();
const items = ref<NoteRow[]>([]);
const loading = ref(true);
const error = ref('');

onMounted(loadItems);

async function loadItems() {
  loading.value = true;
  try {
    const result = await listVaultItems('note');
    const rows: NoteRow[] = [];
    for (const item of result.items) {
      rows.push(await parseItem(item));
    }
    items.value = rows;
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载失败';
  } finally {
    loading.value = false;
  }
}

async function parseItem(item: VaultItem): Promise<NoteRow> {
  try {
    const title = await decryptVaultTitle(item.titleCiphertext);
    const payload = await decryptVaultPayload<{ content?: string }>(item.encryptedPayload);
    return { id: item.id, title, content: payload.content ?? '' };
  } catch {
    return { id: item.id, title: '解密失败', content: '' };
  }
}

async function handleDelete(id: string) {
  if (!confirm('确定删除该笔记？将移入回收站')) return;
  await deleteVaultItem(id);
  await loadItems();
}
</script>

<template>
  <div class="rounded-xl bg-white p-6 ring-1 ring-slate-200">
    <div class="flex items-center justify-between">
      <h2 class="font-semibold text-slate-900">私密笔记</h2>
      <VButton variant="primary" @click="router.push('/app/notes/new')">新增笔记</VButton>
    </div>

    <div v-if="loading" class="mt-6 text-center text-slate-400">加载中...</div>
    <ul v-else-if="items.length" class="mt-6 divide-y divide-slate-100">
      <li v-for="item in items" :key="item.id" class="py-4">
        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0 flex-1">
            <p class="font-medium text-slate-900">{{ item.title }}</p>
            <p class="mt-1 whitespace-pre-wrap text-sm text-slate-600">{{ item.content }}</p>
          </div>
          <div class="shrink-0 space-x-3 text-sm">
            <button class="rounded-xl bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-200" @click="router.push(`/app/notes/${item.id}/edit`)">编辑</button>
            <button class="rounded-xl bg-red-50 px-3 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-100" @click="handleDelete(item.id)">删除</button>
          </div>
        </div>
      </li>
    </ul>
    <p v-else class="mt-6 text-center text-slate-400">暂无笔记</p>
    <p v-if="error" class="mt-4 text-sm text-red-600">{{ error }}</p>
  </div>
</template>
