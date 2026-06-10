<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { getAuditActionLabel } from '@vaultpass/types';
import { listAuditLogs } from '@/utils/services';

interface LogRow {
  id: string;
  action: string;
  actionLabel: string;
  riskLevel: string;
  ip?: string;
  time: string;
}

const logs = ref<LogRow[]>([]);
const loading = ref(true);
const error = ref('');

onMounted(async () => {
  try {
    const result = await listAuditLogs();
    logs.value = result.items.map((item) => ({
      id: item.id,
      action: item.action,
      actionLabel: getAuditActionLabel(item.action),
      riskLevel: item.riskLevel,
      ip: item.ip,
      time: new Date(item.createdAt).toLocaleString(),
    }));
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载失败';
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
    <div v-if="loading" class="p-8 text-center text-slate-400">加载中...</div>
    <div v-else-if="error" class="p-8 text-center text-red-600">{{ error }}</div>
    <div v-else-if="logs.length === 0" class="p-8 text-center text-slate-400">暂无审计记录</div>
    <table v-else class="min-w-full text-sm">
      <thead class="bg-slate-50 text-left text-slate-500">
        <tr>
          <th class="px-6 py-3">操作</th>
          <th class="px-6 py-3">IP</th>
          <th class="px-6 py-3">风险等级</th>
          <th class="px-6 py-3">时间</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100">
        <tr v-for="log in logs" :key="log.id">
          <td class="px-6 py-4">{{ log.actionLabel }}</td>
          <td class="px-6 py-4 font-mono text-xs">{{ log.ip ?? '—' }}</td>
          <td class="px-6 py-4">
            <span class="rounded-full bg-slate-100 px-2 py-1 text-xs">{{ log.riskLevel }}</span>
          </td>
          <td class="px-6 py-4">{{ log.time }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
