<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { VButton } from '@vaultpass/ui';
import {
  addAdminIpBlacklist,
  listAdminIpBlacklist,
  removeAdminIpBlacklist,
  type AdminIpBlacklistItem,
} from '@/utils/services';

const items = ref<AdminIpBlacklistItem[]>([]);
const loading = ref(true);
const error = ref('');
const ipInput = ref('');
const reasonInput = ref('');
const saving = ref(false);

onMounted(loadList);

async function loadList() {
  loading.value = true;
  error.value = '';
  try {
    const result = await listAdminIpBlacklist();
    items.value = result.items;
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载失败';
  } finally {
    loading.value = false;
  }
}

async function handleAdd() {
  const ip = ipInput.value.trim();
  if (!ip) {
    error.value = '请输入 IP 地址';
    return;
  }

  saving.value = true;
  error.value = '';
  try {
    await addAdminIpBlacklist(ip, reasonInput.value.trim() || undefined);
    ipInput.value = '';
    reasonInput.value = '';
    await loadList();
  } catch (err) {
    error.value = err instanceof Error ? err.message : '添加失败';
  } finally {
    saving.value = false;
  }
}

async function handleRemove(ip: string, source: string) {
  if (source === 'env') {
    error.value = '环境变量 IP_BLACKLIST 中的条目需在服务器 .env 中修改';
    return;
  }

  if (!confirm(`确定将 ${ip} 移出黑名单？`)) {
    return;
  }

  try {
    await removeAdminIpBlacklist(ip);
    await loadList();
  } catch (err) {
    error.value = err instanceof Error ? err.message : '删除失败';
  }
}
</script>

<template>
  <section class="rounded-[22px] border border-slate-100 bg-white p-6 shadow-sm">
    <h3 class="font-semibold text-slate-950">IP 黑名单</h3>
    <p class="mt-2 text-sm text-slate-500">
      拦截来自指定 IP 的登录与验证码请求。也可在服务器环境变量
      <code class="text-slate-700">IP_BLACKLIST</code> 中配置（逗号分隔）。
    </p>

    <div class="mt-6 flex flex-wrap items-end gap-3">
      <label class="block text-sm font-medium text-slate-700">
        IP 地址
        <input
          v-model="ipInput"
          class="mt-1 block w-48 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900 outline-none focus:border-blue-300 focus:bg-white"
          placeholder="例如 203.0.113.10"
        />
      </label>
      <label class="block text-sm font-medium text-slate-700">
        备注（可选）
        <input
          v-model="reasonInput"
          class="mt-1 block w-64 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900 outline-none focus:border-blue-300 focus:bg-white"
          placeholder="封禁原因"
        />
      </label>
      <VButton :disabled="saving" @click="handleAdd">{{ saving ? '添加中...' : '添加' }}</VButton>
    </div>

    <div v-if="loading" class="mt-6 text-slate-500">加载中...</div>
    <div v-else-if="items.length === 0" class="mt-6 text-slate-500">暂无黑名单条目</div>
    <ul v-else class="mt-6 divide-y divide-slate-100 text-sm">
      <li v-for="item in items" :key="`${item.source}-${item.ip}`" class="flex items-center justify-between py-3">
        <div>
          <p class="font-mono font-medium text-slate-950">{{ item.ip }}</p>
          <p class="mt-1 text-slate-500">{{ item.reason || '—' }}</p>
          <p class="mt-1 text-xs text-slate-400">
            {{ item.source === 'env' ? '环境变量' : '数据库' }}
            <span v-if="item.createdAt"> · {{ new Date(item.createdAt).toLocaleString() }}</span>
          </p>
        </div>
        <button
          v-if="item.source === 'database'"
          class="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-100"
          @click="handleRemove(item.ip, item.source)"
        >
          移除
        </button>
        <span v-else class="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">只读</span>
      </li>
    </ul>

    <p v-if="error" class="mt-4 text-sm text-red-600">{{ error }}</p>
  </section>
</template>
