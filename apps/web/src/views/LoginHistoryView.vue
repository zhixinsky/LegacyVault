<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { getAuditActionLabel, isLoginAuditAction } from '@vaultpass/types';
import { listAuditLogs } from '@/utils/services';

interface LogRow {
  id: string;
  action: string;
  actionLabel: string;
  riskLevel: string;
  ip?: string;
  device?: string;
  time: string;
  alert: boolean;
}

const logs = ref<LogRow[]>([]);
const loading = ref(true);
const error = ref('');

const alertCount = computed(() => logs.value.filter((log) => log.alert).length);

onMounted(async () => {
  try {
    const result = await listAuditLogs();
    logs.value = result.items
      .filter((item) => isLoginAuditAction(item.action))
      .map((item) => ({
        id: item.id,
        action: item.action,
        actionLabel: getAuditActionLabel(item.action),
        riskLevel: item.riskLevel,
        ip: item.ip,
        device: item.device,
        time: new Date(item.createdAt).toLocaleString(),
        alert: item.action === 'auth.login.failed' || item.action === 'auth.login.new_ip' || item.action === 'auth.new_device',
      }));
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载失败';
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="space-y-4">
    <p class="text-sm text-slate-500">
      记录登录成功、失败、新设备与异地 IP 等安全事件。
      <span v-if="alertCount > 0" class="text-amber-600">近期有 {{ alertCount }} 条需关注记录。</span>
    </p>

    <div class="overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
      <div v-if="loading" class="p-8 text-center text-slate-400">加载中...</div>
      <div v-else-if="error" class="p-8 text-center text-red-600">{{ error }}</div>
      <div v-else-if="logs.length === 0" class="p-8 text-center text-slate-400">暂无登录记录</div>
      <table v-else class="min-w-full text-sm">
        <thead class="bg-slate-50 text-left text-slate-500">
          <tr>
            <th class="px-6 py-3">事件</th>
            <th class="px-6 py-3">IP</th>
            <th class="px-6 py-3">设备</th>
            <th class="px-6 py-3">风险</th>
            <th class="px-6 py-3">时间</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-for="log in logs" :key="log.id" :class="{ 'bg-amber-50/60': log.alert }">
            <td class="px-6 py-4 font-medium">{{ log.actionLabel }}</td>
            <td class="px-6 py-4 font-mono text-xs">{{ log.ip ?? '—' }}</td>
            <td class="max-w-xs truncate px-6 py-4 text-xs text-slate-600" :title="log.device">
              {{ log.device ?? '—' }}
            </td>
            <td class="px-6 py-4">
              <span
                class="rounded-full px-2 py-1 text-xs"
                :class="log.alert ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'"
              >
                {{ log.riskLevel }}
              </span>
            </td>
            <td class="px-6 py-4">{{ log.time }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
