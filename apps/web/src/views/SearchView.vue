<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { searchVaultItems, type VaultSearchResult } from '@/utils/vault-search';

const route = useRoute();
const router = useRouter();

const query = ref('');
const results = ref<VaultSearchResult[]>([]);
const loading = ref(false);
const error = ref('');

onMounted(() => {
  const initial = typeof route.query.q === 'string' ? route.query.q : '';
  query.value = initial;
  if (initial) {
    void runSearch(initial);
  }
});

watch(
  () => route.query.q,
  (value) => {
    const next = typeof value === 'string' ? value : '';
    if (next !== query.value) {
      query.value = next;
      void runSearch(next);
    }
  },
);

async function runSearch(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    results.value = [];
    return;
  }

  loading.value = true;
  error.value = '';
  try {
    results.value = await searchVaultItems(trimmed);
  } catch (err) {
    error.value = err instanceof Error ? err.message : '搜索失败';
  } finally {
    loading.value = false;
  }
}

function handleSubmit() {
  router.replace({ path: '/app/search', query: { q: query.value.trim() || undefined } });
  void runSearch(query.value);
}
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-6">
    <section class="rounded-xl bg-white p-6 ring-1 ring-slate-200">
      <h2 class="text-xl font-bold text-slate-900">保险箱搜索</h2>
      <p class="mt-2 text-sm text-slate-500">在本地解密后匹配标题与字段，服务器无法获知搜索内容。</p>

      <form class="mt-4 flex gap-2" @submit.prevent="handleSubmit">
        <input
          v-model="query"
          class="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          placeholder="搜索账号、笔记、证件、合同..."
        />
        <button
          type="submit"
          class="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-200 hover:bg-blue-700"
        >
          搜索
        </button>
      </form>
    </section>

    <section class="rounded-xl bg-white p-6 ring-1 ring-slate-200">
      <div v-if="loading" class="text-sm text-slate-400">搜索中...</div>
      <div v-else-if="!query.trim()" class="text-sm text-slate-400">输入关键词开始搜索</div>
      <div v-else-if="results.length === 0" class="text-sm text-slate-400">未找到匹配条目</div>
      <ul v-else class="divide-y divide-slate-100">
        <li v-for="item in results" :key="`${item.type}-${item.id}`" class="py-4">
          <RouterLink :to="item.route" class="block hover:text-blue-700">
            <p class="font-medium text-slate-900">{{ item.title }}</p>
            <p class="mt-1 text-sm text-slate-500">
              {{ item.category }}
              <span v-if="item.subtitle"> · {{ item.subtitle }}</span>
            </p>
          </RouterLink>
        </li>
      </ul>
      <p v-if="error" class="mt-3 text-sm text-red-600">{{ error }}</p>
    </section>
  </div>
</template>
