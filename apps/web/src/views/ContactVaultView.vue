<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { VButton } from '@vaultpass/ui';
import { contactVaultSession, downloadContactVaultFile } from '@/utils/api';
import { decryptJson } from '@vaultpass/crypto';
import { decryptStoredFile } from '@/utils/crypto-flow';
import { listContactVaultFiles, listContactVaultItems } from '@/utils/services';

const route = useRoute();
const sessionId = ref(String(route.query.sessionId ?? contactVaultSession.getSessionId()));
const scope = ref('');
const items = ref<Array<{ id: string; title: string; summary: string; type: string }>>([]);
const files = ref<
  Array<{ id: string; fileType: string; fileSize: number; mimeType: string; encryptedFileKey: string }>
>([]);
const loading = ref(true);
const downloadingId = ref('');
const error = ref('');

onMounted(loadData);

async function loadData() {
  if (!sessionId.value) {
    error.value = '缺少联系人会话';
    loading.value = false;
    return;
  }

  try {
    const vaultKey = contactVaultSession.requireVaultKey();
    const [itemResult, fileResult] = await Promise.all([
      listContactVaultItems(sessionId.value),
      listContactVaultFiles(sessionId.value).catch(() => ({ items: [], permissionScope: '' })),
    ]);

    scope.value = itemResult.permissionScope;
    const rows = [];

    for (const item of itemResult.items) {
      try {
        const titleData = await decryptJson<{ title: string }>(item.titleCiphertext, vaultKey);
        const payload = await decryptJson<Record<string, string>>(item.encryptedPayload, vaultKey);
        const summary = Object.entries(payload)
          .slice(0, 3)
          .map(([key, value]) => `${key}: ${value}`)
          .join(' · ');
        rows.push({ id: item.id, title: titleData.title, summary, type: item.type });
      } catch {
        rows.push({ id: item.id, title: '解密失败', summary: '', type: item.type });
      }
    }

    items.value = rows;
    files.value = fileResult.items ?? [];
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载失败';
  } finally {
    loading.value = false;
  }
}

async function handleDownload(file: {
  id: string;
  mimeType: string;
  encryptedFileKey: string;
}) {
  downloadingId.value = file.id;
  error.value = '';
  try {
    const vaultKey = contactVaultSession.requireVaultKey();
    const buffer = await downloadContactVaultFile(sessionId.value, file.id);
    const encryptedContent = new TextDecoder().decode(new Uint8Array(buffer));
    const decrypted = await decryptStoredFile(encryptedContent, file.encryptedFileKey, vaultKey);
    const blob = new Blob([new Uint8Array(decrypted)], {
      type: file.mimeType || 'application/octet-stream',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `vaultpass-${file.id}`;
    link.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    error.value = err instanceof Error ? err.message : '下载失败';
  } finally {
    downloadingId.value = '';
  }
}

function handleExit() {
  contactVaultSession.clear();
  window.location.href = '/contact-takeover';
}
</script>

<template>
  <div class="flex min-h-screen bg-slate-100 px-4 py-10">
    <div class="mx-auto w-full max-w-3xl rounded-xl bg-white p-8 ring-1 ring-slate-200">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-slate-900">联系人保险箱视图</h1>
          <p class="mt-1 text-sm text-slate-500">权限范围：{{ scope || '加载中' }}</p>
        </div>
        <VButton variant="secondary" @click="handleExit">退出</VButton>
      </div>

      <div v-if="loading" class="mt-8 text-center text-slate-400">加载中...</div>
      <div v-else-if="error" class="mt-8 text-sm text-red-600">{{ error }}</div>
      <div v-else class="mt-8 space-y-8">
        <section>
          <h2 class="font-semibold text-slate-900">保险箱条目</h2>
          <ul v-if="items.length" class="mt-4 divide-y divide-slate-100">
            <li v-for="item in items" :key="item.id" class="py-3">
              <p class="font-medium">{{ item.title }} <span class="text-xs text-slate-400">({{ item.type }})</span></p>
              <p class="text-sm text-slate-500">{{ item.summary }}</p>
            </li>
          </ul>
          <p v-else class="mt-4 text-sm text-slate-400">暂无可见条目</p>
        </section>

        <section v-if="files.length">
          <h2 class="font-semibold text-slate-900">加密文件</h2>
          <ul class="mt-4 divide-y divide-slate-100">
            <li v-for="file in files" :key="file.id" class="flex items-center justify-between py-3 text-sm text-slate-600">
              <span>{{ file.fileType }} · {{ file.fileSize }} bytes</span>
              <VButton
                variant="secondary"
                :disabled="downloadingId === file.id"
                @click="handleDownload(file)"
              >
                {{ downloadingId === file.id ? '解密中...' : '下载解密' }}
              </VButton>
            </li>
          </ul>
        </section>
      </div>
    </div>
  </div>
</template>
