<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { MANAGED_VAULT_TYPES } from '@vaultpass/types';
import { decryptVaultTitle } from '@/utils/crypto-flow';
import { heartbeat, listFiles, listVaultItems, type VaultItem } from '@/utils/services';

const router = useRouter();
const loading = ref(true);
const stats = ref({
  passwords: 0,
  notes: 0,
  accounts: 0,
  files: 0,
  recent: [] as Array<{ id: string; title: string }>,
});

onMounted(async () => {
  try {
    const [emailAccounts, serverAccounts, notes, files, ...accountResults] = await Promise.all([
      listVaultItems('email_account'),
      listVaultItems('server_account'),
      listVaultItems('note'),
      listFiles(),
      ...MANAGED_VAULT_TYPES.map((type) => listVaultItems(type)),
    ]);

    const accountTotal = accountResults.reduce((sum, result) => sum + result.total, 0);
    const recent: Array<{ id: string; title: string }> = [];

    const passwordItems = [...emailAccounts.items, ...serverAccounts.items];
    for (const item of passwordItems.slice(0, 5)) {
      recent.push({ id: item.id, title: await decodeTitle(item) });
    }

    stats.value = {
      passwords: emailAccounts.total + serverAccounts.total,
      notes: notes.total,
      accounts: accountTotal,
      files: files.total,
      recent,
    };
    await heartbeat().catch(() => undefined);
  } finally {
    loading.value = false;
  }
});

async function decodeTitle(item: VaultItem) {
  try {
    return await decryptVaultTitle(item.titleCiphertext);
  } catch {
    return '已加密条目';
  }
}

const shortcuts = [
  { label: '新增账号密码', to: '/app/passwords/new' },
  { label: '敏感账户', to: '/app/accounts' },
  { label: '私密笔记', to: '/app/notes' },
  { label: '相册管理', to: '/app/albums' },
  { label: '数据导出', to: '/app/export' },
];
</script>

<template>
  <div class="space-y-6">
    <section class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <article class="rounded-xl bg-white p-6 ring-1 ring-slate-200">
        <p class="text-sm text-slate-500">账号密码</p>
        <p class="mt-2 text-3xl font-bold text-slate-900">{{ loading ? '—' : stats.passwords }}</p>
      </article>
      <article class="rounded-xl bg-white p-6 ring-1 ring-slate-200">
        <p class="text-sm text-slate-500">敏感账户</p>
        <p class="mt-2 text-3xl font-bold text-slate-900">{{ loading ? '—' : stats.accounts }}</p>
      </article>
      <article class="rounded-xl bg-white p-6 ring-1 ring-slate-200">
        <p class="text-sm text-slate-500">私密笔记</p>
        <p class="mt-2 text-3xl font-bold text-slate-900">{{ loading ? '—' : stats.notes }}</p>
      </article>
      <article class="rounded-xl bg-white p-6 ring-1 ring-slate-200">
        <p class="text-sm text-slate-500">加密文件</p>
        <p class="mt-2 text-3xl font-bold text-slate-900">{{ loading ? '—' : stats.files }}</p>
      </article>
    </section>

    <article class="rounded-xl bg-white p-6 ring-1 ring-slate-200">
      <p class="text-sm text-slate-500">安全状态</p>
      <p class="mt-2 text-lg font-semibold text-emerald-600">保险箱已解锁 · 本地加密生效</p>
    </article>

    <section class="rounded-xl bg-white p-6 ring-1 ring-slate-200">
      <h2 class="font-semibold text-slate-900">快捷操作</h2>
      <div class="mt-4 flex flex-wrap gap-3">
        <button
          v-for="item in shortcuts"
          :key="item.to"
          class="rounded-xl bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 shadow-sm ring-1 ring-blue-100 hover:bg-blue-100"
          @click="router.push(item.to)"
        >
          {{ item.label }}
        </button>
      </div>
    </section>

    <section class="rounded-xl bg-white p-6 ring-1 ring-slate-200">
      <div class="flex items-center justify-between">
        <h2 class="font-semibold text-slate-900">最近账号密码</h2>
        <button class="rounded-xl bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-700 hover:bg-blue-100" @click="router.push('/app/passwords')">查看全部</button>
      </div>
      <div v-if="loading" class="py-8 text-center text-slate-400">加载中...</div>
      <div v-else-if="stats.recent.length === 0" class="py-8 text-center text-slate-400">暂无数据</div>
      <ul v-else class="mt-4 divide-y divide-slate-100">
        <li v-for="item in stats.recent" :key="item.id" class="flex items-center justify-between py-3">
          <span>{{ item.title }}</span>
          <span class="rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-600">已加密</span>
        </li>
      </ul>
    </section>
  </div>
</template>
