<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { VButton } from '@vaultpass/ui';
import { decryptVaultTitle } from '@/utils/crypto-flow';
import { authorizeNoteEdit } from '@/utils/note-edit-auth';
import { deleteVaultItem, getProfile, listVaultItems, verifyMfa, type VaultItem } from '@/utils/services';

interface NoteRow {
  id: string;
  title: string;
}

const router = useRouter();
const items = ref<NoteRow[]>([]);
const loading = ref(true);
const error = ref('');
const mfaEnabled = ref(false);
const mfaPromptOpen = ref(false);
const mfaCode = ref('');
const mfaSubmitting = ref(false);
const pendingEditId = ref('');

onMounted(async () => {
  await loadMfaState();
  await loadItems();
});

async function loadMfaState() {
  try {
    const profile = await getProfile();
    mfaEnabled.value = profile.mfaEnabled;
  } catch {
    // Notes still load; protected edit navigation will fail closed only when profile says MFA is enabled.
  }
}

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
    return { id: item.id, title };
  } catch {
    return { id: item.id, title: '解密失败' };
  }
}

async function handleDelete(id: string) {
  if (!confirm('确定删除该笔记？将移入回收站')) return;
  await deleteVaultItem(id);
  await loadItems();
}

async function handleEdit(id: string) {
  if (!mfaEnabled.value) {
    await router.push({ path: `/app/notes/${id}/edit`, query: { mode: 'edit' } });
    return;
  }

  pendingEditId.value = id;
  mfaCode.value = '';
  error.value = '';
  mfaPromptOpen.value = true;
}

async function confirmEditMfa() {
  const code = mfaCode.value.trim();
  if (!pendingEditId.value) return;
  if (!code) {
    error.value = '请输入二次验证码';
    return;
  }

  mfaSubmitting.value = true;
  error.value = '';
  try {
    await verifyMfa(code);
    authorizeNoteEdit(pendingEditId.value, code);
    const id = pendingEditId.value;
    mfaPromptOpen.value = false;
    pendingEditId.value = '';
    mfaCode.value = '';
    await router.push({ path: `/app/notes/${id}/edit`, query: { mode: 'edit' } });
  } catch (err) {
    error.value = err instanceof Error ? err.message : '二次验证失败';
  } finally {
    mfaSubmitting.value = false;
  }
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
          </div>
          <div class="shrink-0 space-x-3 text-sm">
            <button class="rounded-xl bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-200" @click="handleEdit(item.id)">编辑</button>
            <button class="rounded-xl bg-red-50 px-3 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-100" @click="handleDelete(item.id)">删除</button>
          </div>
        </div>
      </li>
    </ul>
    <p v-else class="mt-6 text-center text-slate-400">暂无笔记</p>
    <p v-if="error" class="mt-4 text-sm text-red-600">{{ error }}</p>

    <div
      v-if="mfaPromptOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      @click.self="mfaPromptOpen = false"
    >
      <div class="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl ring-1 ring-slate-200">
        <h3 class="text-lg font-bold text-slate-900">编辑私密笔记前二次验证</h3>
        <p class="mt-2 text-sm text-slate-500">验证通过后再进入编辑页，笔记正文不会提前展示。</p>
        <input
          v-model="mfaCode"
          class="mt-4 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
          placeholder="6 位验证码"
          @keyup.enter="confirmEditMfa"
        />
        <div class="mt-5 flex gap-2">
          <VButton variant="primary" :disabled="mfaSubmitting" @click="confirmEditMfa">
            {{ mfaSubmitting ? '验证中...' : '确认编辑' }}
          </VButton>
          <VButton variant="secondary" @click="mfaPromptOpen = false">取消</VButton>
        </div>
      </div>
    </div>
  </div>
</template>
